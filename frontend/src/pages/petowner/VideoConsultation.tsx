import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import apiService from '../../services/api'
import { VideoSession, ChatMessage } from '../../types'
import { useWebRTC } from '../../hooks/useWebRTC'
import EndedSessionView from '../../components/videoConsultation/EndedSessionView'
import VideoStage from '../../components/videoConsultation/VideoStage'
import ChatPanel from '../../components/videoConsultation/ChatPanel'
import { formatDuration } from '../../components/videoConsultation/videoConsultationShared'
import '../../styles/modules.css'

interface VideoConsultationProps {
  consultationId?: string
  onNavigate: (path: string) => void
}

const VideoConsultation: React.FC<VideoConsultationProps> = ({ consultationId, onNavigate }) => {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [session, setSession] = useState<VideoSession | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [showChat, setShowChat] = useState(true)
  const [cameraError, setCameraError] = useState('')
  const [mediaMode, setMediaMode] = useState<'video' | 'audio-only' | 'none'>('none')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sessionPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(true)

  // Media stream refs
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null)
  const [prescriptions, setPrescriptions] = useState<any[]>([])
  const [streamToSend, setStreamToSend] = useState<MediaStream | null>(null)

  // WebRTC peer connection (patient = guest = waits for offer)
  const { remoteStream, connectionState, cleanup: webrtcCleanup } = useWebRTC(
    session?.id || null,
    streamToSend,
    false,
    session?.status === 'active' && !!streamToSend
  )

  const conId = consultationId || window.location.pathname.split('/').pop() || ''

  // ─── Message cache helpers (sessionStorage) ────────────────
  const cacheKey = `chat_messages_${conId}`
  const getCachedMessages = (): ChatMessage[] => {
    try {
      const cached = sessionStorage.getItem(cacheKey)
      return cached ? JSON.parse(cached) : []
    } catch { return [] }
  }
  const setCachedMessages = (msgs: ChatMessage[]) => {
    try { sessionStorage.setItem(cacheKey, JSON.stringify(msgs)) } catch { /* quota */ }
  }

  // Start the camera & microphone - with graceful fallback
  const startLocalStream = useCallback(async () => {
    setCameraError('')

    // Attempt 1: Video + Audio
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: true
      })
      localStreamRef.current = stream
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }
      setStreamToSend(stream)
      setMediaMode('video')
      setIsCameraOff(false)
      setIsMuted(false)
      return // success
    } catch (err: any) {
}

    // Attempt 2: Audio only (camera might be in use by another tab)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      localStreamRef.current = stream
      setStreamToSend(stream)
      setMediaMode('audio-only')
      setIsCameraOff(true)
      setIsMuted(false)
      setCameraError(t('videoConsultation.cameraUnavailableAudioOnly'))
      return
    } catch (err: any) {
}

    // Attempt 3: No media at all - still allow chat
    setMediaMode('none')
    setStreamToSend(null)
    setIsCameraOff(true)
    setIsMuted(true)
    setCameraError(t('videoConsultation.cameraAndMicUnavailable'))
  }, [])

  // Stop all local media tracks
  const stopLocalStream = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop())
      localStreamRef.current = null
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop())
      screenStreamRef.current = null
    }
    setStreamToSend(null)
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null
    }
  }, [])

  // Restore cached messages immediately on mount (before any API call)
  useEffect(() => {
    const cached = getCachedMessages()
    if (cached.length > 0) setMessages(cached)
  }, [conId])

  useEffect(() => {
    mountedRef.current = true
    initializeSession()
    return () => {
      mountedRef.current = false
      if (timerRef.current) clearInterval(timerRef.current)
      if (pollRef.current) clearInterval(pollRef.current)
      if (sessionPollRef.current) clearInterval(sessionPollRef.current)
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
      stopLocalStream()
    }
  }, [conId])

  // Safety-net: if session is active but no polling is running, restart it
  useEffect(() => {
    if (session && (session.status === 'active' || session.status === 'waiting') && !pollRef.current) {
      startMessagePolling(session.id)
    }
  }, [session?.id, session?.status])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Attach remote stream from WebRTC to video element
  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream
    }
  }, [remoteStream])

  // Re-attach stream to video element when camera is toggled back on
  useEffect(() => {
    if (!isCameraOff && localStreamRef.current) {
      const activeStream = isScreenSharing && screenStreamRef.current
        ? screenStreamRef.current
        : localStreamRef.current
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = activeStream
      }
    }
  }, [isCameraOff, mediaMode])

  const initializeSession = async () => {
    try {
      setLoading(true); setError('')
      let sessionData: any = null

      // 1. Try to find an existing session (backend prefers active/waiting over ended)
      try {
        const existing = await apiService.getVideoSessionByConsultation(conId)
        if (existing.data) {
          sessionData = existing.data
        }
      } catch { /* no existing session */ }

      // 2. If no session at all, check consultation status before creating one
      if (!sessionData) {
        try {
          let participantId = ''
          let consultStatus = ''
          try {
            const consultRes = await apiService.getConsultation(conId)
            const consult = consultRes.data
            if (consult) {
              consultStatus = consult.status || ''
              participantId = user?.role === 'veterinarian'
                ? (consult.userId || consult.petOwnerId || '')
                : (consult.veterinarianId || '')
            }
          } catch { /* ignore */ }

          // If consultation is already completed, show the ended view without creating a session
          if (consultStatus === 'completed') {
            setSession({ id: '', consultationId: conId, status: 'ended', roomId: '', hostUserId: '', participantUserId: '', duration: 0 } as any)
            loadPrescriptions()
            setLoading(false)
            return
          }

          if (!participantId) participantId = 'pending'

          const created = await apiService.createVideoSession({
            consultationId: conId,
            participantUserId: participantId
          })
          if (created.data) sessionData = created.data
        } catch (err: any) {
          setError(t('videoConsultation.failedToCreateVideoRoom') + ': ' + (err?.response?.data?.error?.message || err?.message || ''))
        }
      }

      // 3. Set session and start appropriate polling
      if (sessionData) {
        setSession(sessionData)
        if (sessionData.status === 'active') {
          startTimer()
          loadMessages(sessionData.id)
          startMessagePolling(sessionData.id)
          await startLocalStream()
        } else if (sessionData.status === 'waiting') {
          startSessionPolling(sessionData.id)
          startMessagePolling(sessionData.id)
        } else if (sessionData.status === 'ended') {
          // Load messages for the ended session (chat transcript)
          loadMessages(sessionData.id)
          // Also load prescriptions for the consultation
          loadPrescriptions()
        }
      }
    } catch (err: any) {
      setError(t('videoConsultation.failedToInitialize') + ': ' + (err?.message || ''))
    } finally { setLoading(false) }
  }

  // Poll session status during 'waiting' to detect when the other party starts the call
  const startSessionPolling = (sessionId: string) => {
    if (sessionPollRef.current) clearInterval(sessionPollRef.current)
    sessionPollRef.current = setInterval(async () => {
      try {
        const res = await apiService.getVideoSession(sessionId)
        if (res.data && res.data.status === 'active') {
          // Session started by the other party!
          if (sessionPollRef.current) { clearInterval(sessionPollRef.current); sessionPollRef.current = null }
          setSession(res.data)
          startTimer()
          loadMessages(res.data.id)
          startMessagePolling(res.data.id)
          await startLocalStream()
        } else if (res.data && res.data.status === 'ended') {
          if (sessionPollRef.current) { clearInterval(sessionPollRef.current); sessionPollRef.current = null }
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
          setSession(res.data)
          loadMessages(res.data.id)
        }
      } catch {
        // Fallback: re-fetch via consultation ID if getVideoSession fails (auth issue)
        try {
          const res2 = await apiService.getVideoSessionByConsultation(conId)
          if (res2.data && res2.data.id !== sessionId) {
            // A different session was created - switch to it
            if (sessionPollRef.current) { clearInterval(sessionPollRef.current); sessionPollRef.current = null }
            setSession(res2.data)
            if (res2.data.status === 'active') {
              startTimer()
              startMessagePolling(res2.data.id)
              await startLocalStream()
            } else if (res2.data.status === 'waiting') {
              startSessionPolling(res2.data.id)
              startMessagePolling(res2.data.id)
            }
          } else if (res2.data && res2.data.status === 'active') {
            if (sessionPollRef.current) { clearInterval(sessionPollRef.current); sessionPollRef.current = null }
            setSession(res2.data)
            startTimer()
            startMessagePolling(res2.data.id)
            await startLocalStream()
          }
        } catch { /* ignore */ }
      }
    }, 3000)
  }

  const handleStartSession = async () => {
    if (!session) return
    try {
      if (sessionPollRef.current) { clearInterval(sessionPollRef.current); sessionPollRef.current = null }
      setError('')
      const result = await apiService.startVideoSession(session.id)
      if (result.data) {
        setSession(result.data)
        startTimer()
        startMessagePolling(result.data.id)
        await startLocalStream()
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || t('videoConsultation.failedToStartSession'))
    }
  }

  const handleEndSession = async () => {
    if (!session) return
    if (!window.confirm(t('videoConsultation.confirmEndConsultation'))) return
    try {
      // Stop recording first so blob is ready
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
        mediaRecorderRef.current = null
      }
      setIsRecording(false)
      if (sessionPollRef.current) { clearInterval(sessionPollRef.current); sessionPollRef.current = null }
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
      webrtcCleanup()
      const result = await apiService.endVideoSession(session.id)
      if (result.data) setSession(result.data)
      stopLocalStream()
    } catch (err: any) {
const msg = err?.response?.data?.error?.message
        || err?.response?.data?.message
        || err?.message
        || t('videoConsultation.failedToEndSession')
      setError(msg)
      // Even if API fails, clean up local resources
      stopLocalStream()
    }
  }

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => setCallDuration(prev => prev + 1), 1000)
  }

  const startMessagePolling = (sessionId: string) => {
    if (pollRef.current) clearInterval(pollRef.current)
    loadMessages(sessionId) // load immediately, then poll
    pollRef.current = setInterval(() => loadMessages(sessionId), 3000)
  }

  const loadMessages = async (sessionId: string, retryCount = 0) => {
    try {
      const result = await apiService.getVideoMessages(sessionId)
      if (!mountedRef.current) return
      const msgs = result.data || []
      setMessages(msgs)
      if (msgs.length > 0) setCachedMessages(msgs)
    } catch (err) {
// On first failure, retry once after a short delay
      if (retryCount < 2 && mountedRef.current) {
        setTimeout(() => loadMessages(sessionId, retryCount + 1), 1000)
      }
    }
  }

  const loadPrescriptions = async () => {
    try {
      const result = await apiService.getPrescriptionsByConsultation(conId)
      if (result.data) setPrescriptions(Array.isArray(result.data) ? result.data : (result.data.items || []))
    } catch { /* ignore */ }
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !session) return
    const messageText = newMessage.trim()
    setNewMessage('') // clear input immediately for responsiveness
    try {
      const result = await apiService.sendVideoMessage(session.id, messageText)
      if (result.data) {
        setMessages(prev => {
          // Avoid duplicate if polling already picked it up
          const exists = prev.some(m => m.id === result.data.id)
          const updated = exists ? prev : [...prev, result.data]
          setCachedMessages(updated)
          return updated
        })
      }
    } catch (err: any) {
setNewMessage(messageText) // restore message on failure
      const msg = err?.response?.data?.error?.message
        || err?.response?.data?.message
        || err?.message
        || t('videoConsultation.failedToSendMessage')
      setError(msg)
    }
  }

  const toggleRecording = () => {
    if (!isRecording) {
      // Start recording
      const stream = screenStreamRef.current || localStreamRef.current
      if (!stream) {
        setError(t('videoConsultation.noMediaStream'))
        return
      }
      try {
        recordedChunksRef.current = []
        // Try webm with vp9, then vp8, then default
        let mimeType = 'video/webm;codecs=vp9'
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm;codecs=vp8'
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'video/webm'
          }
        }
        const recorder = new MediaRecorder(stream, { mimeType })
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            recordedChunksRef.current.push(event.data)
          }
        }
        recorder.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: mimeType })
          const url = URL.createObjectURL(blob)
          setRecordingUrl(url)
        }
        recorder.start(1000) // collect data every second
        mediaRecorderRef.current = recorder
        setIsRecording(true)
        if (session) {
          apiService.sendVideoMessage(session.id, '🔴 Recording started').catch(() => setError(t('videoConsultation.recordingNotifyFailed')))
        }
      } catch (err) {
setError(t('videoConsultation.failedToStartRecording'))
      }
    } else {
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
        mediaRecorderRef.current = null
      }
      setIsRecording(false)
      if (session) {
        apiService.sendVideoMessage(session.id, '⏹️ Recording stopped').catch(() => setError(t('videoConsultation.recordingNotifyFailed')))
      }
    }
  }

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = isMuted
      })
      setIsMuted(!isMuted)
    } else if (mediaMode === 'none') {
      setError(t('videoConsultation.micUnavailable'))
    }
  }

  const toggleCamera = async () => {
    if (mediaMode === 'none' || mediaMode === 'audio-only') {
      // Try to acquire camera if we don't have it yet
      if (!isCameraOff) {
        setIsCameraOff(true)
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: false
        })
        // Add video track to existing stream or create new
        if (localStreamRef.current) {
          stream.getVideoTracks().forEach(t => localStreamRef.current!.addTrack(t))
        } else {
          localStreamRef.current = stream
        }
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current
        }
        setMediaMode('video')
        setIsCameraOff(false)
        setCameraError('')
      } catch {
        setError(t('videoConsultation.cameraStillUnavailable'))
      }
      return
    }
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = isCameraOff // currently off -> enable; currently on -> disable
      })
    }
    setIsCameraOff(!isCameraOff)
  }

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop())
        screenStreamRef.current = null
      }
      setStreamToSend(localStreamRef.current)
      setIsScreenSharing(false)
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true })
        screenStreamRef.current = screenStream
        setStreamToSend(screenStream)
        screenStream.getVideoTracks()[0].onended = () => {
          screenStreamRef.current = null
          setStreamToSend(localStreamRef.current)
          setIsScreenSharing(false)
        }
        setIsScreenSharing(true)
      } catch (err) {
}
    }
  }

  if (loading) {
    return (
      <div className="module-page">
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>{t('videoConsultation.connecting')}</p>
        </div>
      </div>
    )
  }

  // Session ended view
  if (session?.status === 'ended') {
    return (
      <EndedSessionView
        session={session}
        recordingUrl={recordingUrl}
        callDuration={callDuration}
        conId={conId}
        messages={messages}
        prescriptions={prescriptions}
        onNavigate={onNavigate}
      />
    )
  }

  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <h1>{t('videoConsultation.title')}</h1>
          <p className="page-subtitle">
            {session?.status === 'active' ? (
              <span className="si-e5391e22">
                🔴 {t('videoConsultation.live')} - {formatDuration(callDuration)}
              </span>
            ) : session?.status === 'waiting' ? (
              t('videoConsultation.waitingForDoctor')
            ) : (
              t('videoConsultation.readyToStart')
            )}
          </p>
        </div>
        {session && (session.status as string) !== 'ended' && (
          <div className="page-header-actions">
            <span className="badge badge-active si-2cefa73a">
              {t('videoConsultation.room')}: {session.roomId}
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="si-131754ed">
          ⚠️ {error}
          <button className="si-f8c15521" onClick={() => setError('')}>{t('videoConsultation.dismiss')}</button>
        </div>
      )}

      {!session ? (
        <div className="si-9ae995d6">
          <div className="si-7615cf7c">📹</div>
          <h2 className="si-dab75309">{t('videoConsultation.settingUp')}</h2>
          <p className="si-0490821b">
            {t('videoConsultation.connectingRoom')}
          </p>
          <div className="loading-spinner" />
        </div>
      ) : (
        <div className="video-container">
          <VideoStage
            session={session}
            remoteVideoRef={remoteVideoRef}
            localVideoRef={localVideoRef}
            remoteStream={remoteStream}
            connectionState={connectionState}
            mediaMode={mediaMode}
            isScreenSharing={isScreenSharing}
            isCameraOff={isCameraOff}
            cameraError={cameraError}
            isRecording={isRecording}
            callDuration={callDuration}
            userRole={user?.role}
            isMuted={isMuted}
            onToggleMute={toggleMute}
            onToggleCamera={toggleCamera}
            onToggleScreenShare={toggleScreenShare}
            onToggleRecording={toggleRecording}
            onEndSession={handleEndSession}
            onStartSession={handleStartSession}
          />

          <ChatPanel
            showChat={showChat}
            setShowChat={setShowChat}
            messages={messages}
            currentUserId={user?.id}
            newMessage={newMessage}
            setNewMessage={setNewMessage}
            onSend={handleSendMessage}
            chatEndRef={chatEndRef}
          />
        </div>
      )}
    </div>
  )
}

export default VideoConsultation

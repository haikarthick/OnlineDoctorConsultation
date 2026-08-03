import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import apiService from '../../services/api'
import { VideoSession, ChatMessage } from '../../types'
import { useWebRTC } from '../../hooks/useWebRTC'
import '../../styles/modules.css'

interface VideoConsultationProps {
  consultationId?: string
  onNavigate: (path: string) => void
}

const VideoConsultation: React.FC<VideoConsultationProps> = ({ consultationId, onNavigate }) => {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { formatTime, formatDate } = useSettings()
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

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return h > 0
      ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
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
      <div className="module-page">
        <div className="si-bd60beb2">
          <div className="si-7615cf7c">📹</div>
          <h1 className="si-dab75309">{t('videoConsultation.ended')}</h1>
          <p className="si-712f4327">
            {t('videoConsultation.duration')}: {formatDuration(session.duration || callDuration)}
          </p>
          {(session.recordingUrl || recordingUrl) && (
            <div className="si-ef14b2c1">
              <p className="si-c338391d">
                🎬 {t('videoConsultation.recordingAvailable')}
              </p>
              {recordingUrl && (
                <>
                  <video
                    src={recordingUrl}
                    controls
                    className="si-a7540650"
                  />
                  <br />
                  <a
                    href={recordingUrl}
                    download={`consultation-${conId}-${new Date().toISOString().slice(0,10)}.webm`}
                    className="btn btn-outline si-315b6ed5"
                   
                  >
                    ⬇️ {t('videoConsultation.downloadRecording')}
                  </a>
                </>
              )}
              {!recordingUrl && session.recordingUrl && (
                <p className="si-c3b93ebb">{t('videoConsultation.recordingSaved')}</p>
              )}
            </div>
          )}
          <div className="si-cf8b12ae">
            <button className="btn btn-primary" onClick={() => onNavigate('/consultations')}>
              {t('videoConsultation.viewConsultations')}
            </button>
            <button className="btn btn-outline" onClick={() => onNavigate('/dashboard')}>
              {t('videoConsultation.dashboard')}
            </button>
          </div>
          {/* Chat transcript */}
          {messages.length > 0 && (
            <div className="si-969bb5a5">
              <h3 className="si-bab8e8bc">💬 {t('videoConsultation.chatTranscript')} ({messages.length} {t('videoConsultation.messages')})</h3>
              <div className="si-cfed40cb">
                {messages.map(msg => (
                  <div key={msg.id} className="si-4815af7f">
                    <strong>{msg.senderName}</strong>: {msg.message}
                    <span className="si-a69da2c2">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Prescriptions */}
          {prescriptions.length > 0 && (
            <div className="si-8b56bd22">
              <h3 className="si-bab8e8bc">💊 {t('videoConsultation.prescriptions')} ({prescriptions.length})</h3>
              {prescriptions.map((rx: any) => (
                <div key={rx.id} className="si-7731684c">
                  {Array.isArray(rx.medications) && rx.medications.map((med: any, mi: number) => (
                    <div key={mi} style={{ marginBottom: mi < rx.medications.length - 1 ? 8 : 0 }}>
                      <div className="si-d1107ba4">💊 {med.name || t('videoConsultation.medication')}</div>
                      {med.dosage && <p className="si-b04aa309"><strong>{t('videoConsultation.dosage')}:</strong> {med.dosage}</p>}
                      {med.frequency && <p className="si-b04aa309"><strong>{t('videoConsultation.frequency')}:</strong> {med.frequency}</p>}
                      {med.duration && <p className="si-b04aa309"><strong>{t('videoConsultation.durationLabel')}:</strong> {med.duration}</p>}
                    </div>
                  ))}
                  {rx.instructions && <p className="si-4bdc4082"><strong>{t('videoConsultation.instructions')}:</strong> {rx.instructions}</p>}
                  <p className="si-3341a4cc">{t('videoConsultation.validUntil')}: {rx.validUntil ? formatDate(rx.validUntil) : 'N/A'}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
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
          {/* Main Video Area */}
          <div className="video-main">
            {/* Main view: remote peer video when connected, placeholder otherwise */}
            {session.status === 'active' ? (
              <>
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    background: '#000',
                    display: remoteStream ? 'block' : 'none'
                  }}
                />
                {!remoteStream && (
                  <div className="video-placeholder">
                    <div className="video-avatar">{user?.role === 'veterinarian' ? '🧑' : '👨‍⚕️'}</div>
                    <p>{connectionState === 'connecting' ? t('videoConsultation.connectingDoctor') : t('videoConsultation.waitingDoctorVideo')}</p>
                    {mediaMode === 'audio-only' && (
                      <p className="si-8e438b3b">🎤 {t('videoConsultation.audioOnlyMode')}</p>
                    )}
                    {mediaMode === 'none' && (
                      <p className="si-ff8aeeff">💬 {t('videoConsultation.chatOnlyMode')}</p>
                    )}
                  </div>
                )}
                {isScreenSharing && (
                  <div className="si-1ded27be">
                    🖥️ {t('videoConsultation.screenSharingActive')}
                  </div>
                )}
              </>
            ) : (
              <div className="video-placeholder">
                <div className="video-avatar">👨‍⚕️</div>
                <p>{t('videoConsultation.waitingForDoctor')}</p>
              </div>
            )}

            {/* Camera error / info message */}
            {cameraError && (
              <div style={{
                position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
                background: mediaMode === 'none' ? 'rgba(220,38,38,.85)' : 'rgba(217,119,6,.85)',
                color: 'white', padding: '8px 16px',
                borderRadius: 8, fontSize: 13, maxWidth: '80%', textAlign: 'center', zIndex: 10
              }}>
                {mediaMode === 'audio-only' ? '🎤' : '⚠️'} {cameraError}
              </div>
            )}

            {/* Self view - real camera feed or status indicator */}
            <div className="video-self" style={isCameraOff || mediaMode !== 'video' ? {} : { padding: 0, overflow: 'hidden' }}>
              {isCameraOff || mediaMode !== 'video' ? (
                <span className="si-ecda976e">
                  {mediaMode === 'audio-only' ? t('videoConsultation.audioOnly') : mediaMode === 'none' ? t('videoConsultation.chatOnly') : t('videoConsultation.cameraOff')}
                </span>
              ) : (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="si-cb5aeea0"
                />
              )}
            </div>

            {/* Controls */}
            {session.status === 'active' && (
              <div className="video-controls">
                <button
                  className={`video-control-btn ${!isMuted ? 'active' : ''}`}
                  onClick={toggleMute}
                  title={isMuted ? t('videoConsultation.unmute') : t('videoConsultation.mute')}
                >
                  {isMuted ? '🔇' : '🎤'}
                </button>
                <button
                  className={`video-control-btn ${!isCameraOff ? 'active' : ''}`}
                  onClick={toggleCamera}
                  title={isCameraOff ? t('videoConsultation.turnOnCamera') : t('videoConsultation.turnOffCamera')}
                >
                  {isCameraOff ? '📷' : '📹'}
                </button>
                <button
                  className={`video-control-btn ${isScreenSharing ? 'active' : ''}`}
                  onClick={toggleScreenShare}
                  title={t('videoConsultation.shareScreen')}
                >
                  🖥️
                </button>
                <button
                  className={`video-control-btn ${isRecording ? 'recording' : ''}`}
                  onClick={toggleRecording}
                  title={isRecording ? t('videoConsultation.stopRecording') : t('videoConsultation.startRecording')}
                  style={isRecording ? { background: '#dc2626', color: 'white', animation: 'pulse 1.5s infinite' } : {}}
                >
                  {isRecording ? '⏹️' : '⏺️'}
                </button>
                <button
                  className="video-control-btn end-call"
                  onClick={handleEndSession}
                  title={t('videoConsultation.endCallTitle')}
                >
                  📞
                </button>
              </div>
            )}

            {session.status === 'waiting' && (
              <div className="video-controls si-fdd5bef3">
                <button className="btn btn-success btn-lg" onClick={handleStartSession}>
                  ▶ {t('videoConsultation.joinCall')}
                </button>
              </div>
            )}

            {isRecording && (
              <div className="si-fe782970">
                <span className="si-00e70c6a" />
                REC {formatDuration(callDuration)}
              </div>
            )}
          </div>

          {/* Chat Panel */}
          {showChat && (
            <div className="chat-panel">
              <div className="card-header">
                <h3>💬 {t('videoConsultation.chat')}</h3>
                <button className="btn btn-sm btn-outline" onClick={() => setShowChat(false)}>✕</button>
              </div>

              <div className="chat-messages">
                {messages.length === 0 && (
                  <div className="si-4f4232ea">
                    <p>{t('videoConsultation.noMessages')}</p>
                    <p className="si-0a803082">{t('videoConsultation.startConversation')}</p>
                  </div>
                )}
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`chat-message ${msg.senderId === user?.id ? 'sent' : 'received'}`}
                  >
                    <div className="msg-sender">{msg.senderName}</div>
                    <div>{msg.message}</div>
                    <div className="msg-time">
                      {formatTime(msg.timestamp)}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              <div className="chat-input-area">
                <input
                  className="chat-input"
                  type="text"
                  placeholder={t('videoConsultation.typeMessage')}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <button className="chat-send-btn" onClick={handleSendMessage}>
                  ➤
                </button>
              </div>
            </div>
          )}

          {!showChat && (
            <button
              className="btn btn-outline si-b34d9cba"
             
              onClick={() => setShowChat(true)}
            >
              💬 {t('videoConsultation.chat')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default VideoConsultation

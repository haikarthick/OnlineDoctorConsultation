import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import apiService from '../../services/api'
import { VideoSession, ChatMessage } from '../../types'
import '../../styles/modules.css'

interface VideoConsultationProps {
  consultationId?: string
  onNavigate: (path: string) => void
}

const VideoConsultation: React.FC<VideoConsultationProps> = ({ consultationId, onNavigate }) => {
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

  // Media stream refs
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null)
  const [prescriptions, setPrescriptions] = useState<any[]>([])

  const conId = consultationId || window.location.pathname.split('/').pop() || ''

  // Start the camera & microphone — with graceful fallback
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
      // Also display in main video area
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream
      }
      setMediaMode('video')
      setIsCameraOff(false)
      setIsMuted(false)
      return // success
    } catch (err: any) {
      console.warn('Video+Audio failed, trying audio-only:', err.message)
    }

    // Attempt 2: Audio only (camera might be in use by another tab)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      localStreamRef.current = stream
      setMediaMode('audio-only')
      setIsCameraOff(true)
      setIsMuted(false)
      setCameraError('Camera is unavailable (may be in use by another tab). Audio-only mode enabled.')
      return
    } catch (err: any) {
      console.warn('Audio-only also failed:', err.message)
    }

    // Attempt 3: No media at all — still allow chat
    setMediaMode('none')
    setIsCameraOff(true)
    setIsMuted(true)
    setCameraError('Camera & microphone unavailable. You can still use chat.')
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
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null
    }
  }, [])

  useEffect(() => {
    initializeSession()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (pollRef.current) clearInterval(pollRef.current)
      if (sessionPollRef.current) clearInterval(sessionPollRef.current)
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
      stopLocalStream()
    }
  }, [conId])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Re-attach stream to video element when camera is toggled back on
  useEffect(() => {
    if (!isCameraOff && localStreamRef.current) {
      const activeStream = isScreenSharing && screenStreamRef.current
        ? screenStreamRef.current
        : localStreamRef.current
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = activeStream
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = activeStream
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
          setError('Failed to create video room: ' + (err?.response?.data?.error?.message || err?.message || ''))
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
      setError('Failed to initialize: ' + (err?.message || ''))
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
            // A different session was created — switch to it
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
      setError(err?.response?.data?.error?.message || 'Failed to start session')
    }
  }

  const handleEndSession = async () => {
    if (!session) return
    if (!window.confirm('Are you sure you want to end this consultation?')) return
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
      const result = await apiService.endVideoSession(session.id)
      if (result.data) setSession(result.data)
      stopLocalStream()
    } catch (err: any) {
      console.error('End session error:', err)
      const msg = err?.response?.data?.error?.message
        || err?.response?.data?.message
        || err?.message
        || 'Failed to end session'
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

  const loadMessages = async (sessionId: string) => {
    try {
      const result = await apiService.getVideoMessages(sessionId)
      if (result.data) setMessages(result.data)
    } catch { /* ignore polling errors */ }
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
          return exists ? prev : [...prev, result.data]
        })
      }
    } catch (err: any) {
      console.error('Send message error:', err)
      setNewMessage(messageText) // restore message on failure
      const msg = err?.response?.data?.error?.message
        || err?.response?.data?.message
        || err?.message
        || 'Failed to send message'
      setError(msg)
    }
  }

  const toggleRecording = () => {
    if (!isRecording) {
      // Start recording
      const stream = screenStreamRef.current || localStreamRef.current
      if (!stream) {
        setError('No media stream available to record')
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
          apiService.sendVideoMessage(session.id, '🔴 Recording started').catch(() => {})
        }
      } catch (err) {
        console.error('Failed to start recording:', err)
        setError('Failed to start recording — your browser may not support MediaRecorder')
      }
    } else {
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
        mediaRecorderRef.current = null
      }
      setIsRecording(false)
      if (session) {
        apiService.sendVideoMessage(session.id, '⏹️ Recording stopped').catch(() => {})
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
      setError('Microphone is unavailable')
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
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = localStreamRef.current
        }
        setMediaMode('video')
        setIsCameraOff(false)
        setCameraError('')
      } catch {
        setError('Camera is still unavailable')
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
      // Stop screen sharing, restore camera
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop())
        screenStreamRef.current = null
      }
      // Re-attach camera stream to local video
      if (localVideoRef.current && localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current
      }
      if (remoteVideoRef.current && localStreamRef.current) {
        remoteVideoRef.current.srcObject = localStreamRef.current
      }
      setIsScreenSharing(false)
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true })
        screenStreamRef.current = screenStream
        // Show screen share in the main video area (self-view)
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream
        }
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = screenStream
        }
        // When user stops sharing via browser UI
        screenStream.getVideoTracks()[0].onended = () => {
          if (localVideoRef.current && localStreamRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current
          }
          if (remoteVideoRef.current && localStreamRef.current) {
            remoteVideoRef.current.srcObject = localStreamRef.current
          }
          screenStreamRef.current = null
          setIsScreenSharing(false)
        }
        setIsScreenSharing(true)
      } catch (err) {
        console.error('Screen share error:', err)
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
          <p>Connecting to consultation room...</p>
        </div>
      </div>
    )
  }

  // Session ended view
  if (session?.status === 'ended') {
    return (
      <div className="module-page">
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ fontSize: 64, marginBottom: 20 }}>📹</div>
          <h1 style={{ marginBottom: 8 }}>Consultation Ended</h1>
          <p style={{ color: '#6b7280', fontSize: 16, marginBottom: 8 }}>
            Duration: {formatDuration(session.duration || callDuration)}
          </p>
          {(session.recordingUrl || recordingUrl) && (
            <div style={{ marginTop: 20, marginBottom: 16 }}>
              <p style={{ color: '#059669', fontSize: 14, marginBottom: 12 }}>
                🎬 Recording available
              </p>
              {recordingUrl && (
                <>
                  <video
                    src={recordingUrl}
                    controls
                    style={{ maxWidth: 500, width: '100%', borderRadius: 8, marginBottom: 12 }}
                  />
                  <br />
                  <a
                    href={recordingUrl}
                    download={`consultation-${conId}-${new Date().toISOString().slice(0,10)}.webm`}
                    className="btn btn-outline"
                    style={{ display: 'inline-block', textDecoration: 'none' }}
                  >
                    ⬇️ Download Recording
                  </a>
                </>
              )}
              {!recordingUrl && session.recordingUrl && (
                <p style={{ color: '#6b7280', fontSize: 13 }}>Recording saved on server</p>
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24 }}>
            <button className="btn btn-primary" onClick={() => onNavigate('/consultations')}>
              View Consultations
            </button>
            <button className="btn btn-outline" onClick={() => onNavigate('/dashboard')}>
              Dashboard
            </button>
          </div>
          {/* Chat transcript */}
          {messages.length > 0 && (
            <div style={{ maxWidth: 500, margin: '32px auto 0', textAlign: 'left' }}>
              <h3 style={{ marginBottom: 12 }}>💬 Chat Transcript ({messages.length} messages)</h3>
              <div style={{ background: '#f9fafb', borderRadius: 8, padding: 16, maxHeight: 300, overflow: 'auto' }}>
                {messages.map(msg => (
                  <div key={msg.id} style={{ marginBottom: 8, fontSize: 13 }}>
                    <strong>{msg.senderName}</strong>: {msg.message}
                    <span style={{ color: '#9ca3af', marginLeft: 8, fontSize: 11 }}>
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Prescriptions */}
          {prescriptions.length > 0 && (
            <div style={{ maxWidth: 500, margin: '24px auto 0', textAlign: 'left' }}>
              <h3 style={{ marginBottom: 12 }}>💊 Prescriptions ({prescriptions.length})</h3>
              {prescriptions.map((rx: any) => (
                <div key={rx.id} style={{ background: '#f0fdf4', borderRadius: 8, padding: 16, marginBottom: 12, border: '1px solid #bbf7d0' }}>
                  {Array.isArray(rx.medications) && rx.medications.map((med: any, mi: number) => (
                    <div key={mi} style={{ marginBottom: mi < rx.medications.length - 1 ? 8 : 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>💊 {med.name || 'Medication'}</div>
                      {med.dosage && <p style={{ fontSize: 13, margin: '4px 0' }}><strong>Dosage:</strong> {med.dosage}</p>}
                      {med.frequency && <p style={{ fontSize: 13, margin: '4px 0' }}><strong>Frequency:</strong> {med.frequency}</p>}
                      {med.duration && <p style={{ fontSize: 13, margin: '4px 0' }}><strong>Duration:</strong> {med.duration}</p>}
                    </div>
                  ))}
                  {rx.instructions && <p style={{ fontSize: 13, margin: '8px 0 0' }}><strong>Instructions:</strong> {rx.instructions}</p>}
                  <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Valid until: {rx.validUntil ? formatDate(rx.validUntil) : 'N/A'}</p>
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
          <h1>Video Consultation</h1>
          <p className="page-subtitle">
            {session?.status === 'active' ? (
              <span style={{ color: '#059669', fontWeight: 600 }}>
                🔴 Live — {formatDuration(callDuration)}
              </span>
            ) : session?.status === 'waiting' ? (
              'Waiting for participants...'
            ) : (
              'Ready to start'
            )}
          </p>
        </div>
        {session && (session.status as string) !== 'ended' && (
          <div className="page-header-actions">
            <span className="badge badge-active" style={{ fontSize: 14, padding: '6px 14px' }}>
              Room: {session.roomId}
            </span>
          </div>
        )}
      </div>

      {error && (
        <div style={{ padding: '12px 18px', background: '#fef2f2', color: '#dc2626', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
          ⚠️ {error}
          <button style={{ marginLeft: 12, background: 'none', border: '1px solid #dc2626', color: '#dc2626', padding: '4px 10px', borderRadius: 4, cursor: 'pointer' }} onClick={() => setError('')}>Dismiss</button>
        </div>
      )}

      {!session ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 64, marginBottom: 20 }}>📹</div>
          <h2 style={{ marginBottom: 8 }}>Setting up...</h2>
          <p style={{ color: '#6b7280', marginBottom: 24 }}>
            Connecting to your consultation room
          </p>
          <div className="loading-spinner" />
        </div>
      ) : (
        <div className="video-container">
          {/* Main Video Area */}
          <div className="video-main">
            {/* Main view: show local camera as simulated remote feed */}
            {session.status === 'active' && mediaMode === 'video' && !isCameraOff && !isScreenSharing ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
            ) : session.status === 'active' && isScreenSharing ? (
              <div className="video-placeholder">
                <div className="video-avatar">🖥️</div>
                <p>Screen Sharing Active</p>
              </div>
            ) : session.status === 'active' ? (
              <div className="video-placeholder">
                <div className="video-avatar">{user?.role === 'veterinarian' ? '🧑' : '👨‍⚕️'}</div>
                <p>Connected</p>
                {mediaMode === 'audio-only' && (
                  <p style={{ fontSize: 13, color: '#fbbf24', marginTop: 8 }}>🎤 Audio-only mode — camera unavailable</p>
                )}
                {mediaMode === 'none' && (
                  <p style={{ fontSize: 13, color: '#f87171', marginTop: 8 }}>💬 Chat-only mode</p>
                )}
              </div>
            ) : (
              <div className="video-placeholder">
                <div className="video-avatar">👨‍⚕️</div>
                <p>Waiting for participants...</p>
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

            {/* Self view — real camera feed or status indicator */}
            <div className="video-self" style={isCameraOff || mediaMode !== 'video' ? {} : { padding: 0, overflow: 'hidden' }}>
              {isCameraOff || mediaMode !== 'video' ? (
                <span style={{ textAlign: 'center', fontSize: 13 }}>
                  {mediaMode === 'audio-only' ? '🎤 Audio Only' : mediaMode === 'none' ? '💬 Chat Only' : '📷 Camera Off'}
                </span>
              ) : (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: 'inherit',
                    transform: 'scaleX(-1)'
                  }}
                />
              )}
            </div>

            {/* Controls */}
            {session.status === 'active' && (
              <div className="video-controls">
                <button
                  className={`video-control-btn ${!isMuted ? 'active' : ''}`}
                  onClick={toggleMute}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? '🔇' : '🎤'}
                </button>
                <button
                  className={`video-control-btn ${!isCameraOff ? 'active' : ''}`}
                  onClick={toggleCamera}
                  title={isCameraOff ? 'Turn on camera' : 'Turn off camera'}
                >
                  {isCameraOff ? '📷' : '📹'}
                </button>
                <button
                  className={`video-control-btn ${isScreenSharing ? 'active' : ''}`}
                  onClick={toggleScreenShare}
                  title="Share screen"
                >
                  🖥️
                </button>
                <button
                  className={`video-control-btn ${isRecording ? 'recording' : ''}`}
                  onClick={toggleRecording}
                  title={isRecording ? 'Stop Recording' : 'Start Recording'}
                  style={isRecording ? { background: '#dc2626', color: 'white', animation: 'pulse 1.5s infinite' } : {}}
                >
                  {isRecording ? '⏹️' : '⏺️'}
                </button>
                <button
                  className="video-control-btn end-call"
                  onClick={handleEndSession}
                  title="End call"
                >
                  📞
                </button>
              </div>
            )}

            {session.status === 'waiting' && (
              <div className="video-controls" style={{ gap: 12 }}>
                <button className="btn btn-success btn-lg" onClick={handleStartSession}>
                  ▶ Join Call
                </button>
              </div>
            )}

            {isRecording && (
              <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(220,38,38,.9)', color: 'white', padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'white', display: 'inline-block', animation: 'pulse 1s infinite' }} />
                REC {formatDuration(callDuration)}
              </div>
            )}
          </div>

          {/* Chat Panel */}
          {showChat && (
            <div className="chat-panel">
              <div className="card-header">
                <h3>💬 Chat</h3>
                <button className="btn btn-sm btn-outline" onClick={() => setShowChat(false)}>✕</button>
              </div>

              <div className="chat-messages">
                {messages.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
                    <p>No messages yet</p>
                    <p style={{ fontSize: 13 }}>Start the conversation</p>
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
                  placeholder="Type a message..."
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
              className="btn btn-outline"
              style={{ position: 'fixed', bottom: 20, right: 20 }}
              onClick={() => setShowChat(true)}
            >
              💬 Chat
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default VideoConsultation

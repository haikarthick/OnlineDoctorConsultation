import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import apiService from '../../services/api'
import { VideoSession, ChatMessage } from '../../types'
import '../../styles/modules.css'

interface ConsultationRoomProps {
  consultationId?: string
  onNavigate: (path: string) => void
}

const ConsultationRoom: React.FC<ConsultationRoomProps> = ({ consultationId, onNavigate }) => {
  const { user } = useAuth()
  const { formatTime } = useSettings()

  // Session & chat state
  const [session, setSession] = useState<VideoSession | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [callDuration, setCallDuration] = useState(0)

  // Consultation notes
  const [notes, setNotes] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const [consultationStatus, setConsultationStatus] = useState<string>('scheduled')

  // UI state
  const [activePanel, setActivePanel] = useState<'chat' | 'notes' | 'prescribe'>('chat')
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [mediaMode, setMediaMode] = useState<'video' | 'audio-only' | 'none'>('none')
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null)

  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sessionPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(true)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])

  const conId = consultationId || window.location.pathname.split('/').pop() || ''

  // --- Message cache helpers (sessionStorage) ----------------
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

  // --- Camera / Microphone ----------------------------------
  const startLocalStream = useCallback(async () => {
    setCameraError('')
    // Attempt 1: Video + Audio
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: true
      })
      localStreamRef.current = stream
      if (localVideoRef.current) localVideoRef.current.srcObject = stream
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream
      setMediaMode('video')
      setIsCameraOff(false)
      setIsMuted(false)
      return
    } catch (err: any) {
}
    // Attempt 2: Audio only
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      localStreamRef.current = stream
      setMediaMode('audio-only')
      setIsCameraOff(true)
      setIsMuted(false)
      setCameraError('Camera unavailable — audio-only mode.')
      return
    } catch (err: any) {
}
    // Attempt 3: No media
    setMediaMode('none')
    setIsCameraOff(true)
    setIsMuted(true)
    setCameraError('Camera & microphone unavailable. Chat still works.')
  }, [])

  const stopLocalStream = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop())
      localStreamRef.current = null
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop())
      screenStreamRef.current = null
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
  }, [])

  // --- Lifecycle --------------------------------------------
  // Restore cached messages immediately on mount
  useEffect(() => {
    const cached = getCachedMessages()
    if (cached.length > 0) setMessages(cached)
  }, [conId])

  useEffect(() => {
    mountedRef.current = true
    initRoom()
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

  // Safety-net: if session is active/waiting but no polling is running, restart it
  useEffect(() => {
    if (session && (session.status === 'active' || session.status === 'waiting') && !pollRef.current) {
      startMessagePolling(session.id)
    }
  }, [session?.id, session?.status])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Re-attach stream when camera is toggled
  useEffect(() => {
    if (!isCameraOff && localStreamRef.current) {
      const active = isScreenSharing && screenStreamRef.current
        ? screenStreamRef.current
        : localStreamRef.current
      if (localVideoRef.current) localVideoRef.current.srcObject = active
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = active
    }
  }, [isCameraOff, mediaMode])

  // --- Room Initialization ---------------------------------
  const initRoom = async () => {
    try {
      setLoading(true)
      setError('')

      // 1. Check for existing video session for this consultation
      let existingSession: VideoSession | null = null
      try {
        const res = await apiService.getVideoSessionByConsultation(conId)
        existingSession = res.data
      } catch { /* no existing session */ }

      if (existingSession) {
        // Skip ended sessions — allow creating a new one
        if (existingSession.status === 'ended') {
          setSession(existingSession)
          loadMessages(existingSession.id)
          loadConsultationData()
          return
        }

        setSession(existingSession)
        if (existingSession.status === 'active') {
          startTimer()
          startMessagePolling(existingSession.id)
          await startLocalStream()
        } else if (existingSession.status === 'waiting') {
          // Start polling to detect when patient starts/joins
          startSessionPolling(existingSession.id)
          // Also start message polling — patient might chat while waiting
          startMessagePolling(existingSession.id)
        }
      } else {
        // No session exists — check consultation status before creating one
        try {
          const consultRes = await apiService.getConsultation(conId)
          const consult = consultRes.data

          // If consultation is already completed, load data and show completed view
          if (consult?.status === 'completed') {
            setConsultationStatus('completed')
            if (consult.diagnosis) setDiagnosis(consult.diagnosis)
            if (consult.notes) setNotes(consult.notes)
            // Create a synthetic ended session to trigger the ended view
            setSession({ id: '', consultationId: conId, status: 'ended', roomId: '', hostUserId: '', participantUserId: '', duration: consult.duration || 0 } as VideoSession)
            setLoading(false)
            return
          }

          const participantId = consult?.userId || consult?.petOwnerId || 'pending'

          const created = await apiService.createVideoSession({
            consultationId: conId,
            participantUserId: participantId
          })
          if (created.data) {
            setSession(created.data)
            startSessionPolling(created.data.id)
            startMessagePolling(created.data.id)
          }
        } catch (err: any) {
          setError('Failed to create video session: ' + (err?.response?.data?.error?.message || err?.message || ''))
        }
      }

      // Load consultation data for notes
      loadConsultationData()
    } catch (err: any) {
      setError('Failed to initialize room: ' + (err?.message || ''))
    } finally {
      setLoading(false)
    }
  }

  const loadConsultationData = async () => {
    try {
      const res = await apiService.getConsultation(conId)
      if (res.data) {
        if (res.data.diagnosis) setDiagnosis(res.data.diagnosis)
        if (res.data.notes) setNotes(res.data.notes)
        if (res.data.status) setConsultationStatus(res.data.status)
      }
    } catch { /* ignore */ }
  }

  // --- Session Polling --------------------------------------
  const startSessionPolling = (sessionId: string) => {
    if (sessionPollRef.current) clearInterval(sessionPollRef.current)
    sessionPollRef.current = setInterval(async () => {
      try {
        const res = await apiService.getVideoSession(sessionId)
        if (res.data) {
          if (res.data.status === 'active') {
            if (sessionPollRef.current) { clearInterval(sessionPollRef.current); sessionPollRef.current = null }
            setSession(res.data)
            startTimer()
            startMessagePolling(res.data.id)
            await startLocalStream()
          } else if (res.data.status === 'ended') {
            if (sessionPollRef.current) { clearInterval(sessionPollRef.current); sessionPollRef.current = null }
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
            setSession(res.data)
            loadMessages(res.data.id)
          }
        }
      } catch {
        // If getVideoSession fails (auth issue), try via consultation endpoint
        try {
          const res2 = await apiService.getVideoSessionByConsultation(conId)
          if (res2.data && res2.data.id !== sessionId) {
            // A different session was created — switch to that one
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
          }
        } catch { /* ignore */ }
      }
    }, 3000) // Poll every 3 seconds for faster detection
  }

  // --- Call Controls ----------------------------------------
  const handleStartCall = async () => {
    if (!session) return
    try {
      setError('')
      if (sessionPollRef.current) { clearInterval(sessionPollRef.current); sessionPollRef.current = null }
      const result = await apiService.startVideoSession(session.id)
      if (result.data) {
        setSession(result.data)
        startTimer()
        startMessagePolling(result.data.id)
        await startLocalStream()
      }
    } catch (err: any) {
      setError('Failed to start call: ' + (err?.response?.data?.error?.message || err?.message || ''))
    }
  }

  const handleEndCall = async () => {
    if (!session) return
    if (!window.confirm('End this video consultation?')) return
    try {
      // Stop recording if active
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
        mediaRecorderRef.current = null
      }
      setIsRecording(false)

      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      if (sessionPollRef.current) { clearInterval(sessionPollRef.current); sessionPollRef.current = null }

      const result = await apiService.endVideoSession(session.id)
      if (result.data) setSession(result.data)
      stopLocalStream()
    } catch (err: any) {
      setError('Failed to end call: ' + (err?.response?.data?.error?.message || err?.message || ''))
      stopLocalStream()
    }
  }

  // --- Media Controls ---------------------------------------
  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = isMuted })
      setIsMuted(!isMuted)
    } else if (mediaMode === 'none') {
      setError('Microphone is unavailable')
    }
  }

  const toggleCamera = async () => {
    if (mediaMode === 'none' || mediaMode === 'audio-only') {
      if (!isCameraOff) { setIsCameraOff(true); return }
      // Try to acquire camera
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: false
        })
        if (localStreamRef.current) {
          stream.getVideoTracks().forEach(t => localStreamRef.current!.addTrack(t))
        } else {
          localStreamRef.current = stream
        }
        if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = localStreamRef.current
        setMediaMode('video')
        setIsCameraOff(false)
        setCameraError('')
      } catch {
        setError('Camera is unavailable')
      }
      return
    }
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(t => { t.enabled = isCameraOff })
    }
    setIsCameraOff(!isCameraOff)
  }

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop())
        screenStreamRef.current = null
      }
      if (localVideoRef.current && localStreamRef.current) localVideoRef.current.srcObject = localStreamRef.current
      if (remoteVideoRef.current && localStreamRef.current) remoteVideoRef.current.srcObject = localStreamRef.current
      setIsScreenSharing(false)
    } else {
      try {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true })
        screenStreamRef.current = screen
        if (localVideoRef.current) localVideoRef.current.srcObject = screen
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = screen
        screen.getVideoTracks()[0].onended = () => {
          if (localVideoRef.current && localStreamRef.current) localVideoRef.current.srcObject = localStreamRef.current
          if (remoteVideoRef.current && localStreamRef.current) remoteVideoRef.current.srcObject = localStreamRef.current
          screenStreamRef.current = null
          setIsScreenSharing(false)
        }
        setIsScreenSharing(true)
      } catch (err) {
}
    }
  }

  const toggleRecording = () => {
    if (!isRecording) {
      const stream = screenStreamRef.current || localStreamRef.current
      if (!stream) { setError('No media stream available to record'); return }
      try {
        recordedChunksRef.current = []
        let mimeType = 'video/webm;codecs=vp9'
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm;codecs=vp8'
          if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm'
        }
        const recorder = new MediaRecorder(stream, { mimeType })
        recorder.ondataavailable = (e) => { if (e.data?.size > 0) recordedChunksRef.current.push(e.data) }
        recorder.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: mimeType })
          setRecordingUrl(URL.createObjectURL(blob))
        }
        recorder.start(1000)
        mediaRecorderRef.current = recorder
        setIsRecording(true)
        if (session) apiService.sendVideoMessage(session.id, '?? Recording started').catch(() => {})
      } catch {
        setError('Failed to start recording')
      }
    } else {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
        mediaRecorderRef.current = null
      }
      setIsRecording(false)
      if (session) apiService.sendVideoMessage(session.id, '?? Recording stopped').catch(() => {})
    }
  }

  // --- Chat / Notes / Timer ---------------------------------
  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => setCallDuration(p => p + 1), 1000)
  }

  const startMessagePolling = (sessionId: string) => {
    if (pollRef.current) clearInterval(pollRef.current)
    loadMessages(sessionId)
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
if (retryCount < 2 && mountedRef.current) {
        setTimeout(() => loadMessages(sessionId, retryCount + 1), 1000)
      }
    }
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !session) return
    const text = newMessage.trim()
    setNewMessage('')
    try {
      const result = await apiService.sendVideoMessage(session.id, text)
      if (result.data) {
        setMessages(prev => {
          if (prev.some(m => m.id === result.data.id)) return prev
          const updated = [...prev, result.data]
          setCachedMessages(updated)
          return updated
        })
      }
    } catch (err) {
setNewMessage(text)
    }
  }

  const handleSaveNotes = async () => {
    if (!diagnosis.trim() && !notes.trim()) return
    try {
      setSavingNotes(true)
      await apiService.updateConsultation(conId, {
        diagnosis: diagnosis || undefined,
        notes: notes || undefined
      })
      setNotesSaved(true)
      setTimeout(() => setNotesSaved(false), 3000)
    } catch (err: any) {
setError('Failed to save notes: ' + (err?.response?.data?.error?.message || err?.message || 'Unknown error'))
    } finally {
      setSavingNotes(false)
    }
  }

  const handleCompleteConsultation = async () => {
    if (!window.confirm('Complete this consultation? Status will be set to completed.')) return
    try {
      // Save notes first
      if (diagnosis.trim() || notes.trim()) {
        await apiService.updateConsultation(conId, {
          status: 'completed',
          diagnosis: diagnosis || undefined,
          notes: notes || undefined
        })
      } else {
        await apiService.updateConsultation(conId, { status: 'completed' })
      }
      // End video session if still active
      if (session && (session.status === 'active' || session.status === 'waiting')) {
        try { await apiService.endVideoSession(session.id) } catch { /* ignore */ }
      }
      setConsultationStatus('completed')
      stopLocalStream()
      onNavigate('/dashboard')
    } catch (err: any) {
      setError('Failed to complete: ' + (err?.response?.data?.error?.message || err?.message || ''))
    }
  }

  const formatDuration = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    return h > 0
      ? `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
      : `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }

  // --- Loading State ----------------------------------------
  if (loading) {
    return (
      <div className="module-page">
        <div className="loading-container"><div className="loading-spinner" /><p>Setting up consultation room...</p></div>
      </div>
    )
  }

  // --- Session Ended View -----------------------------------
  if (session?.status === 'ended') {
    const isCompleted = consultationStatus === 'completed'
    return (
      <div className="module-page">
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 64, marginBottom: 20 }}>{isCompleted ? '?' : '??'}</div>
          <h1 style={{ marginBottom: 8 }}>{isCompleted ? 'Consultation Completed' : 'Consultation Session Ended'}</h1>
          <p style={{ color: '#6b7280', fontSize: 16, marginBottom: 8 }}>
            Duration: {formatDuration(session.duration || callDuration)}
          </p>
          {isCompleted && (
            <p style={{ color: '#059669', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
              ? This consultation has been marked as completed
            </p>
          )}

          {/* Recording playback */}
          {recordingUrl && (
            <div style={{ marginTop: 20, marginBottom: 16 }}>
              <p style={{ color: '#059669', fontSize: 14, marginBottom: 12 }}>?? Recording available</p>
              <video src={recordingUrl} controls style={{ maxWidth: 500, width: '100%', borderRadius: 8, marginBottom: 12 }} />
              <br />
              <a href={recordingUrl} download={`consultation-${conId}-${new Date().toISOString().slice(0,10)}.webm`}
                className="btn btn-outline" style={{ display: 'inline-block', textDecoration: 'none' }}>
                ?? Download Recording
              </a>
            </div>
          )}

          {/* Notes section */}
          <div style={{ maxWidth: 600, margin: '24px auto', textAlign: 'left' }}>
            <h3>?? Consultation Notes</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Diagnosis</label>
              <textarea className="form-input" rows={2} placeholder="Enter diagnosis..."
                value={diagnosis} onChange={e => setDiagnosis(e.target.value)} style={{ width: '100%' }}
                readOnly={isCompleted} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Notes</label>
              <textarea className="form-input" rows={4} placeholder="Notes..."
                value={notes} onChange={e => setNotes(e.target.value)} style={{ width: '100%' }}
                readOnly={isCompleted} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {!isCompleted && (
                <>
                  <button className="btn btn-outline" onClick={handleSaveNotes} disabled={savingNotes}>
                    {savingNotes ? '?? Saving...' : notesSaved ? '? Saved!' : '?? Save Notes'}
                  </button>
                  <button className="btn btn-primary" onClick={handleCompleteConsultation}>
                    ? Complete Consultation
                  </button>
                  <button className="btn btn-outline" onClick={() => onNavigate(`/doctor/prescriptions/new?consultationId=${conId}`)}>
                    ?? Write Prescription
                  </button>
                </>
              )}
              {isCompleted && (
                <button className="btn btn-outline" onClick={() => onNavigate(`/doctor/prescriptions/new?consultationId=${conId}`)}>
                  ?? Write Prescription
                </button>
              )}
            </div>
          </div>

          {/* Chat transcript */}
          {messages.length > 0 && (
            <div style={{ maxWidth: 600, margin: '24px auto', textAlign: 'left' }}>
              <h3>?? Chat Transcript ({messages.length} messages)</h3>
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

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24 }}>
            <button className="btn btn-outline" onClick={() => onNavigate('/dashboard')}>
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  // --- Main Consultation Room -------------------------------
  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <h1>Consultation Room</h1>
          <p className="page-subtitle">
            {session?.status === 'active' ? (
              <span style={{ color: '#dc2626', fontWeight: 600 }}>?? Live — {formatDuration(callDuration)}</span>
            ) : 'Waiting for session to start...'}
          </p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={() => onNavigate(`/doctor/prescriptions/new?consultationId=${conId}`)}>
            ?? Prescription
          </button>
          {session?.status === 'active' && (
            <button className="btn btn-danger" onClick={handleEndCall} style={{ background: '#dc2626', color: 'white', border: 'none' }}>
              ?? End Call
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 18px', background: '#fef2f2', color: '#dc2626', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
          ?? {error}
          <button style={{ marginLeft: 12, background: 'none', border: '1px solid #dc2626', color: '#dc2626', padding: '4px 10px', borderRadius: 4, cursor: 'pointer' }}
            onClick={() => setError('')}>Dismiss</button>
        </div>
      )}

      <div className="video-container">
        {/* Video Area */}
        <div className="video-main">
          {/* Main video: Show camera feed when active, placeholder otherwise */}
          {session?.status === 'active' && mediaMode === 'video' && !isCameraOff && !isScreenSharing ? (
            <video ref={remoteVideoRef} autoPlay playsInline muted
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : session?.status === 'active' && isScreenSharing ? (
            <div className="video-placeholder">
              <div className="video-avatar">???</div>
              <p>Screen Sharing Active</p>
            </div>
          ) : session?.status === 'active' ? (
            <div className="video-placeholder">
              <div className="video-avatar">??</div>
              <p>Patient Connected</p>
              {mediaMode === 'audio-only' && <p style={{ fontSize: 13, color: '#fbbf24', marginTop: 8 }}>?? Audio-only mode</p>}
              {mediaMode === 'none' && <p style={{ fontSize: 13, color: '#f87171', marginTop: 8 }}>?? Chat-only mode</p>}
            </div>
          ) : (
            <div className="video-placeholder">
              <div className="video-avatar">??</div>
              <p>Waiting for patient to join...</p>
              <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>
                {session ? `Room: ${session.roomId}` : 'Creating room...'}
              </p>
            </div>
          )}

          {/* Camera error banner */}
          {cameraError && session?.status === 'active' && (
            <div style={{
              position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
              background: mediaMode === 'none' ? 'rgba(220,38,38,.85)' : 'rgba(217,119,6,.85)',
              color: 'white', padding: '8px 16px', borderRadius: 8, fontSize: 13,
              maxWidth: '80%', textAlign: 'center', zIndex: 10
            }}>
              {mediaMode === 'audio-only' ? '??' : '??'} {cameraError}
            </div>
          )}

          {/* Self-view (PIP) */}
          <div className="video-self" style={isCameraOff || mediaMode !== 'video' ? {} : { padding: 0, overflow: 'hidden' }}>
            {isCameraOff || mediaMode !== 'video' ? (
              <span style={{ textAlign: 'center', fontSize: 13 }}>
                {session?.status !== 'active' ? `Dr. ${user?.lastName?.charAt(0) || ''}` :
                  mediaMode === 'audio-only' ? '?? Audio' : mediaMode === 'none' ? '?? Chat' : '?? Off'}
              </span>
            ) : (
              <video ref={localVideoRef} autoPlay playsInline muted
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit', transform: 'scaleX(-1)' }} />
            )}
          </div>

          {/* Controls */}
          <div className="video-controls">
            {session?.status === 'waiting' && (
              <button className="btn btn-success btn-lg" onClick={handleStartCall}>â–¶ Start Call</button>
            )}
            {session?.status === 'active' && (
              <>
                <button className={`video-control-btn ${!isMuted ? 'active' : ''}`}
                  onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
                  {isMuted ? '??' : '??'}
                </button>
                <button className={`video-control-btn ${!isCameraOff ? 'active' : ''}`}
                  onClick={toggleCamera} title={isCameraOff ? 'Turn on camera' : 'Turn off camera'}>
                  {isCameraOff ? '??' : '??'}
                </button>
                <button className={`video-control-btn ${isScreenSharing ? 'active' : ''}`}
                  onClick={toggleScreenShare} title="Share screen">
                  ???
                </button>
                <button className={`video-control-btn ${isRecording ? 'recording' : ''}`}
                  onClick={toggleRecording} title={isRecording ? 'Stop Recording' : 'Start Recording'}
                  style={isRecording ? { background: '#dc2626', color: 'white', animation: 'pulse 1.5s infinite' } : {}}>
                  {isRecording ? '??' : '??'}
                </button>
                <button className="video-control-btn end-call" onClick={handleEndCall} title="End call">
                  ??
                </button>
              </>
            )}
          </div>

          {/* Recording indicator */}
          {isRecording && (
            <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(220,38,38,.9)', color: 'white', padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'white', display: 'inline-block', animation: 'pulse 1s infinite' }} />
              REC {formatDuration(callDuration)}
            </div>
          )}
        </div>

        {/* Side Panel */}
        <div className="chat-panel" style={{ minWidth: 340 }}>
          {/* Panel Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
            {(['chat', 'notes', 'prescribe'] as const).map(tab => (
              <button key={tab}
                className={`tab ${activePanel === tab ? 'active' : ''}`}
                style={{ flex: 1, border: 'none', padding: '10px', fontSize: 13 }}
                onClick={() => setActivePanel(tab)}>
                {tab === 'chat' ? `?? Chat${messages.length > 0 ? ` (${messages.length})` : ''}` : tab === 'notes' ? '?? Notes' : '?? Rx'}
              </button>
            ))}
          </div>

          {/* Chat Tab */}
          {activePanel === 'chat' && (
            <>
              <div className="chat-messages">
                {messages.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px 16px', color: '#9ca3af' }}>
                    <p>No messages yet</p>
                    <p style={{ fontSize: 13 }}>Start the conversation</p>
                  </div>
                )}
                {messages.map(msg => (
                  <div key={msg.id} className={`chat-message ${msg.senderId === user?.id ? 'sent' : 'received'}`}>
                    <div className="msg-sender">{msg.senderName}</div>
                    <div>{msg.message}</div>
                    <div className="msg-time">{formatTime(msg.timestamp)}</div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div className="chat-input-area">
                <input className="chat-input" placeholder="Type a message..."
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendMessage()} />
                <button className="chat-send-btn" onClick={handleSendMessage}>?</button>
              </div>
            </>
          )}

          {/* Notes Tab */}
          {activePanel === 'notes' && (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
              <div className="form-group">
                <label className="form-label">Diagnosis</label>
                <textarea className="form-input" rows={3} placeholder="Enter diagnosis..."
                  value={diagnosis} onChange={e => setDiagnosis(e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Consultation Notes</label>
                <textarea className="form-input" rows={8}
                  placeholder="Document findings, observations, recommendations..."
                  value={notes} onChange={e => setNotes(e.target.value)} style={{ resize: 'vertical' }} />
              </div>
              <button className="btn btn-primary" onClick={handleSaveNotes} disabled={savingNotes}>
                {savingNotes ? '?? Saving...' : notesSaved ? '? Saved!' : '?? Save Notes'}
              </button>
            </div>
          )}

          {/* Quick Prescribe Tab */}
          {activePanel === 'prescribe' && (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
              <p style={{ fontSize: 14, color: '#6b7280' }}>
                Quick access to prescription writing during consultation.
              </p>
              <button className="btn btn-primary"
                onClick={() => onNavigate(`/doctor/prescriptions/new?consultationId=${conId}`)}>
                ?? Open Prescription Writer
              </button>
              <div style={{ marginTop: 12 }}>
                <h4>Common Prescriptions</h4>
                {[
                  { label: 'Antibiotics Course (7 days)', name: 'Amoxicillin', dosage: '250mg', frequency: 'Twice daily', duration: '7 days', instructions: 'Give with food' },
                  { label: 'Pain Relief (5 days)', name: 'Meloxicam', dosage: '0.1mg/kg', frequency: 'Once daily', duration: '5 days', instructions: 'Give with food, monitor appetite' },
                  { label: 'Anti-inflammatory (10 days)', name: 'Carprofen', dosage: '2mg/kg', frequency: 'Twice daily', duration: '10 days', instructions: 'Give with food, plenty of water' },
                  { label: 'Vitamins & Supplements', name: 'Pet Multivitamin', dosage: '1 tablet', frequency: 'Once daily', duration: '30 days', instructions: 'Mix with food' },
                ].map(tpl => (
                  <div key={tpl.label} style={{
                    padding: '8px 12px', background: '#f3f4f6', borderRadius: 8, marginBottom: 6,
                    cursor: 'pointer', fontSize: 14, display: 'flex', justifyContent: 'space-between',
                    transition: 'background 0.15s',
                  }}
                  onClick={() => {
                    const med = encodeURIComponent(JSON.stringify([{
                      name: tpl.name, dosage: tpl.dosage, frequency: tpl.frequency,
                      duration: tpl.duration, instructions: tpl.instructions
                    }]))
                    onNavigate(`/doctor/prescriptions/new?consultationId=${conId}&meds=${med}`)
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#e5e7eb')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#f3f4f6')}
                  >
                    <span>{tpl.label}</span>
                    <span style={{ color: '#3b82f6', fontWeight: 600 }}>+</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ConsultationRoom

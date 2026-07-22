import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import apiService from '../../services/api'
import { VideoSession, ChatMessage } from '../../types'
import { useWebRTC } from '../../hooks/useWebRTC'
import '../../styles/modules.css'

interface ConsultationRoomProps {
  consultationId?: string
  onNavigate: (path: string) => void
}

const ConsultationRoom: React.FC<ConsultationRoomProps> = ({ consultationId, onNavigate }) => {
  const { t } = useTranslation()
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
  const [activePanel, setActivePanel] = useState<'chat' | 'notes' | 'prescribe' | 'history'>('chat')
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [mediaMode, setMediaMode] = useState<'video' | 'audio-only' | 'none'>('none')
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null)
  const [streamToSend, setStreamToSend] = useState<MediaStream | null>(null)

  // Medical history state (for doctors)
  const [animalInfo, setAnimalInfo] = useState<any>(null)
  const [medicalRecords, setMedicalRecords] = useState<any[]>([])
  const [vaccinations, setVaccinations] = useState<any[]>([])
  const [allergies, setAllergies] = useState<any[]>([])
  const [labResults, setLabResults] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)

  // Referral state
  const [showReferralModal, setShowReferralModal] = useState(false)
  const [referralForm, setReferralForm] = useState({ networkId: '', fromHospitalId: '', toHospitalId: '', reason: '', priority: 'normal', clinicalNotes: '' })
  const [networksList, setNetworksList] = useState<any[]>([])
  const [networkHospitals, setNetworkHospitals] = useState<any[]>([])
  const [referralSubmitting, setReferralSubmitting] = useState(false)
  const [referralSuccess, setReferralSuccess] = useState('')
  const [referralError, setReferralError] = useState('')

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

  // WebRTC peer connection (doctor = host = creates offer)
  const { remoteStream, connectionState, cleanup: webrtcCleanup } = useWebRTC(
    session?.id || null,
    streamToSend,
    true,
    session?.status === 'active' && !!streamToSend
  )

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
      setStreamToSend(stream)
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
      setStreamToSend(stream)
      setMediaMode('audio-only')
      setIsCameraOff(true)
      setIsMuted(false)
      setCameraError(t('consultationRoom.cameraUnavailableAudioOnly'))
      return
    } catch (err: any) {
}
    // Attempt 3: No media
    setMediaMode('none')
    setStreamToSend(null)
    setIsCameraOff(true)
    setIsMuted(true)
    setCameraError(t('consultationRoom.cameraAndMicUnavailable'))
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
    setStreamToSend(null)
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

  // Attach remote stream from WebRTC to video element
  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream
    }
  }, [remoteStream])

  // Re-attach stream when camera is toggled
  useEffect(() => {
    if (!isCameraOff && localStreamRef.current) {
      const active = isScreenSharing && screenStreamRef.current
        ? screenStreamRef.current
        : localStreamRef.current
      if (localVideoRef.current) localVideoRef.current.srcObject = active
    }
  }, [isCameraOff, mediaMode])

  // Load available networks when referral modal opens
  useEffect(() => {
    if (showReferralModal) {
      (apiService as any).listHospitalNetworks?.()
        .then((res: any) => setNetworksList(res.networks || res.data || []))
        .catch(() => {})
    }
  }, [showReferralModal])

  // Load hospitals in selected network
  useEffect(() => {
    if (referralForm.networkId) {
      (apiService as any).client.get(`/hospital-networks/${referralForm.networkId}/hospitals`)
        .then((res: any) => setNetworkHospitals(res.data?.hospitals || []))
        .catch(() => {})
    }
  }, [referralForm.networkId])

  const handleCreateReferral = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!referralForm.networkId || !referralForm.toHospitalId || !referralForm.reason) {
      setReferralError('Please fill all required fields')
      return
    }
    setReferralSubmitting(true)
    setReferralError('')
    try {
      await (apiService as any).createNetworkReferral({
        ...referralForm,
        animalId: animalInfo?.id,
        consultationId: conId,
      })
      setReferralSuccess('Referral sent successfully!')
      setShowReferralModal(false)
      setTimeout(() => setReferralSuccess(''), 4000)
    } catch (err: any) {
      setReferralError(err?.response?.data?.error || err?.message || 'Failed to send referral')
    } finally {
      setReferralSubmitting(false)
    }
  }

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
          setError(t('consultationRoom.failedToCreateVideoSession') + ': ' + (err?.response?.data?.error?.message || err?.message || ''))
        }
      }

      // Load consultation data for notes
      loadConsultationData()
    } catch (err: any) {
      setError(t('consultationRoom.failedToInitializeRoom') + ': ' + (err?.message || ''))
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
        // Load medical history if there's an animal associated
        const animalId = res.data.animalId || res.data.animal_id
        if (animalId && !historyLoaded) {
          loadMedicalHistory(animalId)
        }
      }
    } catch { /* ignore */ }
  }

  const loadMedicalHistory = async (animalId: string) => {
    if (historyLoaded || historyLoading) return
    try {
      setHistoryLoading(true)
      const [animalRes, recordsRes, vaccsRes, allergiesRes, labRes] = await Promise.all([
        apiService.getAnimal(animalId).catch(() => null),
        apiService.listMedicalRecords({ animalId, limit: 20 }).catch(() => ({ data: { items: [] } })),
        apiService.listVaccinations(animalId, { limit: 20 }).catch(() => ({ data: { items: [] } })),
        apiService.listAllergies(animalId).catch(() => ({ data: { items: [] } })),
        apiService.listLabResults(animalId, { limit: 20 }).catch(() => ({ data: { items: [] } }))
      ])
      if (animalRes?.data) setAnimalInfo(animalRes.data)
      setMedicalRecords(recordsRes?.data?.items || recordsRes?.data?.records || (Array.isArray(recordsRes?.data) ? recordsRes.data : []))
      setVaccinations(vaccsRes?.data?.items || vaccsRes?.data?.vaccinations || (Array.isArray(vaccsRes?.data) ? vaccsRes.data : []))
      setAllergies(allergiesRes?.data?.items || allergiesRes?.data?.allergies || (Array.isArray(allergiesRes?.data) ? allergiesRes.data : []))
      setLabResults(labRes?.data?.items || labRes?.data?.results || (Array.isArray(labRes?.data) ? labRes.data : []))
      setHistoryLoaded(true)
    } catch { /* ignore */ }
    finally { setHistoryLoading(false) }
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
      setError(t('consultationRoom.failedToStartCall') + ': ' + (err?.response?.data?.error?.message || err?.message || ''))
    }
  }

  const handleEndCall = async () => {
    if (!session) return
    if (!window.confirm(t('consultationRoom.confirmEndCall'))) return
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

      webrtcCleanup()
      const result = await apiService.endVideoSession(session.id)
      if (result.data) setSession(result.data)
      stopLocalStream()
    } catch (err: any) {
      setError(t('consultationRoom.failedToEndCall') + ': ' + (err?.response?.data?.error?.message || err?.message || ''))
      stopLocalStream()
    }
  }

  // --- Media Controls ---------------------------------------
  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = isMuted })
      setIsMuted(!isMuted)
    } else if (mediaMode === 'none') {
      setError(t('consultationRoom.micUnavailable'))
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
        setMediaMode('video')
        setIsCameraOff(false)
        setCameraError('')
      } catch {
        setError(t('consultationRoom.cameraUnavailable'))
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
      setStreamToSend(localStreamRef.current)
      setIsScreenSharing(false)
    } else {
      try {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true })
        screenStreamRef.current = screen
        setStreamToSend(screen)
        screen.getVideoTracks()[0].onended = () => {
          screenStreamRef.current = null
          setStreamToSend(localStreamRef.current)
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
      if (!stream) { setError(t('consultationRoom.noMediaStream')); return }
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
        if (session) apiService.sendVideoMessage(session.id, '🔴 Recording started').catch(() => setError(t('consultationRoom.recordingNotifyFailed')))
      } catch {
        setError(t('consultationRoom.failedToStartRecording'))
      }
    } else {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
        mediaRecorderRef.current = null
      }
      setIsRecording(false)
      if (session) apiService.sendVideoMessage(session.id, '⏹️ Recording stopped').catch(() => setError(t('consultationRoom.recordingNotifyFailed')))
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
setError(t('consultationRoom.failedToSaveNotes') + ': ' + (err?.response?.data?.error?.message || err?.message || ''))
    } finally {
      setSavingNotes(false)
    }
  }

  const handleCompleteConsultation = async () => {
    if (!window.confirm(t('consultationRoom.confirmComplete'))) return
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
      setError(t('consultationRoom.failedToComplete') + ': ' + (err?.response?.data?.error?.message || err?.message || ''))
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
        <div className="loading-container"><div className="loading-spinner" /><p>{t('consultationRoom.settingUpRoom')}</p></div>
      </div>
    )
  }

  // --- Session Ended View -----------------------------------
  if (session?.status === 'ended') {
    const isCompleted = consultationStatus === 'completed'
    return (
      <div className="module-page">
        <div className="si-9ae995d6">
          <div className="si-7615cf7c">{isCompleted ? '✅' : '📹'}</div>
          <h1 className="si-dab75309">{isCompleted ? t('consultationRoom.consultationCompleted') : t('consultationRoom.sessionEnded')}</h1>
          <p className="si-712f4327">
            {t('consultationRoom.duration')}: {formatDuration(session.duration || callDuration)}
          </p>
          {isCompleted && (
            <p className="si-739c4b9c">
              {t('consultationRoom.markedAsCompleted')}
            </p>
          )}

          {/* Recording playback */}
          {recordingUrl && (
            <div className="si-ef14b2c1">
              <p className="si-c338391d">🎬 {t('consultationRoom.recordingAvailable')}</p>
              <video src={recordingUrl} controls className="si-a7540650" />
              <br />
              <a href={recordingUrl} download={`consultation-${conId}-${new Date().toISOString().slice(0,10)}.webm`}
                className="btn btn-outline si-315b6ed5">
                ⬇️ {t('consultationRoom.downloadRecording')}
              </a>
            </div>
          )}

          {/* Notes section */}
          <div className="si-4734e5a8">
            <h3>📝 {t('consultationRoom.consultationNotes')}</h3>
            <div className="si-bab8e8bc">
              <label className="si-e334d170">{t('consultationRoom.diagnosis')}</label>
              <textarea className="form-input si-7d984748" rows={2} placeholder={t('consultationRoom.enterDiagnosis')}
                value={diagnosis} onChange={e => setDiagnosis(e.target.value)}
                readOnly={isCompleted} />
            </div>
            <div className="si-bab8e8bc">
              <label className="si-e334d170">{t('consultationRoom.notes')}</label>
              <textarea className="form-input si-7d984748" rows={4} placeholder={t('consultationRoom.notesPlaceholder')}
                value={notes} onChange={e => setNotes(e.target.value)}
                readOnly={isCompleted} />
            </div>
            <div className="si-d223efb3">
              {!isCompleted && (
                <>
                  <button className="btn btn-outline" onClick={handleSaveNotes} disabled={savingNotes}>
                    {savingNotes ? `⏳ ${t('consultationRoom.saving')}` : notesSaved ? `✅ ${t('consultationRoom.saved')}` : `💾 ${t('consultationRoom.saveNotes')}`}
                  </button>
                  <button className="btn btn-primary" onClick={handleCompleteConsultation}>
                    ✅ {t('consultationRoom.completeConsultation')}
                  </button>
                  <button className="btn btn-outline" onClick={() => onNavigate(`/doctor/prescriptions/new?consultationId=${conId}`)}>
                    💊 {t('consultationRoom.writePrescription')}
                  </button>
                </>
              )}
              {isCompleted && (
                <button className="btn btn-outline" onClick={() => onNavigate(`/doctor/prescriptions/new?consultationId=${conId}`)}>
                  💊 {t('consultationRoom.writePrescription')}
                </button>
              )}
            </div>
          </div>

          {/* Chat transcript */}
          {messages.length > 0 && (
            <div className="si-4734e5a8">
              <h3>💬 {t('consultationRoom.chatTranscript', { count: messages.length })}</h3>
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

          <div className="si-cf8b12ae">
            <button className="btn btn-outline" onClick={() => onNavigate('/dashboard')}>
              {t('consultationRoom.returnToDashboard')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // --- Main Consultation Room -------------------------------
  return (
    <>
    <div className="module-page">
      <div className="page-header">
        <div>
          <h1>{t('consultationRoom.title')}</h1>
          <p className="page-subtitle">
            {session?.status === 'active' ? (
              <span className="si-1c396c88">🔴 {t('consultationRoom.live')} — {formatDuration(callDuration)}</span>
            ) : t('consultationRoom.waitingForSession')}
          </p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={() => onNavigate(`/doctor/prescriptions/new?consultationId=${conId}`)}>
            💊 {t('consultationRoom.prescription')}
          </button>
          <button
            className="module-btn si-89f878b4"
           
            onClick={() => setShowReferralModal(true)}
          >
            🔄 Refer to Network Hospital
          </button>
          {session?.status === 'active' && (
            <button className="btn btn-danger si-afc65bbc" onClick={handleEndCall}>
              📞 {t('consultationRoom.endCall')}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="si-131754ed">
          ⚠️ {error}
          <button className="si-f8c15521"
            onClick={() => setError('')}>{t('consultationRoom.dismiss')}</button>
        </div>
      )}

      <div className="video-container">
        {/* Video Area */}
        <div className="video-main">
          {/* Main video: Show remote peer video when connected, placeholder otherwise */}
          {session?.status === 'active' ? (
            <>
              <video ref={remoteVideoRef} autoPlay playsInline
                style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000',
                  display: remoteStream ? 'block' : 'none' }} />
              {!remoteStream && (
                <div className="video-placeholder">
                  <div className="video-avatar">🧑</div>
                  <p>{connectionState === 'connecting' ? t('consultationRoom.connectingToPatient') : t('consultationRoom.waitingForPatientVideo')}</p>
                  {mediaMode === 'audio-only' && <p className="si-8e438b3b">🎤 {t('consultationRoom.audioOnlyMode')}</p>}
                  {mediaMode === 'none' && <p className="si-ff8aeeff">💬 {t('consultationRoom.chatOnlyMode')}</p>}
                </div>
              )}
              {isScreenSharing && (
                <div className="si-1ded27be">
                  🖥️ {t('consultationRoom.screenSharingActive')}
                </div>
              )}
            </>
          ) : (
            <div className="video-placeholder">
              <div className="video-avatar">👨‍⚕️</div>
              <p>{t('consultationRoom.waitingForPatient')}</p>
              <p className="si-7dcbd386">
                {session ? `${t('consultationRoom.room')}: ${session.roomId}` : t('consultationRoom.creatingRoom')}
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
              {mediaMode === 'audio-only' ? '🎤' : '⚠️'} {cameraError}
            </div>
          )}

          {/* Self-view (PIP) */}
          <div className="video-self" style={isCameraOff || mediaMode !== 'video' ? {} : { padding: 0, overflow: 'hidden' }}>
            {isCameraOff || mediaMode !== 'video' ? (
              <span className="si-ecda976e">
                {session?.status !== 'active' ? `Dr. ${user?.lastName?.charAt(0) || ''}` :
                  mediaMode === 'audio-only' ? '🎤 Audio' : mediaMode === 'none' ? '💬 Chat' : '📷 Off'}
              </span>
            ) : (
              <video ref={localVideoRef} autoPlay playsInline muted
                className="si-cb5aeea0" />
            )}
          </div>

          {/* Controls */}
          <div className="video-controls">
            {session?.status === 'waiting' && (
              <button className="btn btn-success btn-lg" onClick={handleStartCall}>▶ {t('consultationRoom.startCall')}</button>
            )}
            {session?.status === 'active' && (
              <>
                <button className={`video-control-btn ${!isMuted ? 'active' : ''}`}
                  onClick={toggleMute} title={isMuted ? t('consultationRoom.unmute') : t('consultationRoom.mute')}>
                  {isMuted ? '🔇' : '🎤'}
                </button>
                <button className={`video-control-btn ${!isCameraOff ? 'active' : ''}`}
                  onClick={toggleCamera} title={isCameraOff ? t('consultationRoom.turnOnCamera') : t('consultationRoom.turnOffCamera')}>
                  {isCameraOff ? '📷' : '📹'}
                </button>
                <button className={`video-control-btn ${isScreenSharing ? 'active' : ''}`}
                  onClick={toggleScreenShare} title={t('consultationRoom.shareScreen')}>
                  🖥️
                </button>
                <button className={`video-control-btn ${isRecording ? 'recording' : ''}`}
                  onClick={toggleRecording} title={isRecording ? t('consultationRoom.stopRecording') : t('consultationRoom.startRecording')}
                  style={isRecording ? { background: '#dc2626', color: 'white', animation: 'pulse 1.5s infinite' } : {}}>
                  {isRecording ? '⏹️' : '⏺️'}
                </button>
                <button className="video-control-btn end-call" onClick={handleEndCall} title={t('consultationRoom.endCallTitle')}>
                  📞
                </button>
              </>
            )}
          </div>

          {/* Recording indicator */}
          {isRecording && (
            <div className="si-fe782970">
              <span className="si-00e70c6a" />
              REC {formatDuration(callDuration)}
            </div>
          )}
        </div>

        {/* Side Panel */}
        <div className="chat-panel si-78f95ca5">
          {/* Panel Tabs */}
          <div className="si-ffe739ab">
            {(['chat', 'history', 'notes', 'prescribe'] as const).map(tab => (
              <button key={tab}
                className={`tab ${activePanel === tab ? 'active' : ''} si-1114bb34`}
               
                onClick={() => { setActivePanel(tab); if (tab === 'history' && !historyLoaded && !historyLoading) { /* auto-load on first click is handled in loadConsultationData */ } }}>
                {tab === 'chat' ? `💬 ${t('consultationRoom.chat')}${messages.length > 0 ? ` (${messages.length})` : ''}` : tab === 'history' ? `📋 ${t('consultationRoom.historyTab')}` : tab === 'notes' ? `📝 ${t('consultationRoom.notesTab')}` : `💊 ${t('consultationRoom.rx')}`}
              </button>
            ))}
          </div>

          {/* Chat Tab */}
          {activePanel === 'chat' && (
            <>
              <div className="chat-messages">
                {messages.length === 0 && (
                  <div className="si-97639f58">
                    <p>{t('consultationRoom.noMessagesYet')}</p>
                    <p className="si-0a803082">{t('consultationRoom.startConversation')}</p>
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
                <input className="chat-input" placeholder={t('consultationRoom.typeMessage')}
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendMessage()} />
                <button className="chat-send-btn" onClick={handleSendMessage}>➤</button>
              </div>
            </>
          )}

          {/* Medical History Tab */}
          {activePanel === 'history' && (
            <div className="si-3dc8ac19">
              {historyLoading && (
                <div className="si-ed5d7a12">
                  <div className="loading-spinner si-8d6ac58b" />
                  <p className="si-b416ac63">{t('consultationRoom.loadingMedicalHistory')}</p>
                </div>
              )}

              {!historyLoading && !animalInfo && (
                <div className="si-b1c6542e">
                  <div className="si-75bae6a3">📋</div>
                  <p className="si-c6905158">{t('consultationRoom.noAnimalLinked')}</p>
                  <p className="si-0a803082">{t('consultationRoom.animalLinkMessage')}</p>
                </div>
              )}

              {!historyLoading && animalInfo && (
                <>
                  {/* Animal Info Card */}
                  <div className="si-843e21c5">
                    <div className="si-2cd8f04c">
                      🐾 {animalInfo.name || 'Unknown'}
                    </div>
                    <div className="si-9ac294d9">
                      {animalInfo.species || ''}{animalInfo.breed ? ` / ${animalInfo.breed}` : ''}
                      {animalInfo.age ? ` — ${animalInfo.age}` : ''}
                      {animalInfo.weight ? ` — ${animalInfo.weight}kg` : ''}
                    </div>
                    {animalInfo.uniqueId && <div className="si-b1a83cef">ID: {animalInfo.uniqueId}</div>}
                    {(animalInfo.enterpriseName || animalInfo.enterprise_name) && (
                      <div className="si-acad5bc1">
                        🏢 Farm: {animalInfo.enterpriseName || animalInfo.enterprise_name}
                        {(animalInfo.groupName || animalInfo.group_name) && ` › ${animalInfo.groupName || animalInfo.group_name}`}
                      </div>
                    )}
                  </div>

                  {/* Allergies */}
                  <div className="si-bab8e8bc">
                    <h4 className="si-d151fd1b">
                      ⚠️ {t('consultationRoom.allergies')} ({allergies.length})
                    </h4>
                    {allergies.length === 0 ? (
                      <p className="si-df056d61">{t('consultationRoom.noKnownAllergies')}</p>
                    ) : (
                      <div className="si-a78c2ab8">
                        {allergies.map((a: any, i: number) => (
                          <span key={i} style={{
                            background: a.severity === 'severe' ? '#fef2f2' : '#fef3c7',
                            color: a.severity === 'severe' ? '#991b1b' : '#92400e',
                            padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600
                          }}>
                            {a.allergen || a.name || 'Unknown'} ({a.severity || 'unknown'})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Vaccinations */}
                  <div className="si-bab8e8bc">
                    <h4 className="si-72539157">
                      💉 {t('consultationRoom.vaccinations')} ({vaccinations.length})
                    </h4>
                    {vaccinations.length === 0 ? (
                      <p className="si-df056d61">{t('consultationRoom.noVaccinationRecords')}</p>
                    ) : (
                      <div className="si-859b1456">
                        {vaccinations.slice(0, 10).map((v: any, i: number) => (
                          <div key={i} className="si-4c23d640">
                            <strong>{v.vaccineName || v.vaccine_name || v.name || 'Vaccine'}</strong>
                            {v.dateAdministered || v.date_administered ? (
                              <span className="si-ee2911f8">
                                {new Date(v.dateAdministered || v.date_administered).toLocaleDateString()}
                              </span>
                            ) : null}
                            {v.status && <span style={{ marginLeft: 6, color: v.status === 'completed' ? '#059669' : '#d97706' }}>({v.status})</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recent Medical Records */}
                  <div className="si-bab8e8bc">
                    <h4 className="si-1ea073bf">
                      🩺 {t('consultationRoom.medicalRecords')} ({medicalRecords.length})
                    </h4>
                    {medicalRecords.length === 0 ? (
                      <p className="si-df056d61">{t('consultationRoom.noMedicalRecords')}</p>
                    ) : (
                      <div className="si-a01c8940">
                        {medicalRecords.slice(0, 10).map((r: any, i: number) => (
                          <div key={i} className="si-55c66e92">
                            <div className="si-b2cfcbec">{r.recordType || r.record_type || r.type || 'Record'}</div>
                            {r.diagnosis && <div className="si-93b487ee">Dx: {r.diagnosis}</div>}
                            {r.treatment && <div className="si-23033f05">Tx: {r.treatment}</div>}
                            {(r.createdAt || r.created_at || r.date) && (
                              <div className="si-a5de6cea">
                                {new Date(r.createdAt || r.created_at || r.date).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Lab Results */}
                  <div className="si-dab75309">
                    <h4 className="si-7af7d0b5">
                      🔬 {t('consultationRoom.labResults')} ({labResults.length})
                    </h4>
                    {labResults.length === 0 ? (
                      <p className="si-df056d61">{t('consultationRoom.noLabResults')}</p>
                    ) : (
                      <div className="si-859b1456">
                        {labResults.slice(0, 10).map((l: any, i: number) => (
                          <div key={i} className="si-4c23d640">
                            <strong>{l.testName || l.test_name || l.name || 'Test'}</strong>
                            {l.result && <span className="si-c3560ab0">→ {l.result}</span>}
                            {l.status && (
                              <span style={{
                                marginLeft: 6, fontSize: 11, padding: '1px 6px', borderRadius: 4,
                                background: l.status === 'completed' ? '#d1fae5' : '#fef3c7',
                                color: l.status === 'completed' ? '#065f46' : '#92400e'
                              }}>{l.status}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Notes Tab */}
          {activePanel === 'notes' && (
            <div className="si-daad42f2">
              <div className="form-group">
                <label className="form-label">{t('consultationRoom.diagnosis')}</label>
                <textarea className="form-input" rows={3} placeholder={t('consultationRoom.enterDiagnosis')}
                  value={diagnosis} onChange={e => setDiagnosis(e.target.value)} />
              </div>
              <div className="form-group si-6acd75e8">
                <label className="form-label">{t('consultationRoom.consultationNotesLabel')}</label>
                <textarea className="form-input si-3f7753b6" rows={8}
                  placeholder={t('consultationRoom.notesDocumentPlaceholder')}
                  value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
              <button className="btn btn-primary" onClick={handleSaveNotes} disabled={savingNotes}>
                {savingNotes ? `⏳ ${t('consultationRoom.saving')}` : notesSaved ? `✅ ${t('consultationRoom.saved')}` : `💾 ${t('consultationRoom.saveNotes')}`}
              </button>
            </div>
          )}

          {/* Quick Prescribe Tab */}
          {activePanel === 'prescribe' && (
            <div className="si-c710217c">
              <p className="si-09dee8a9">
                {t('consultationRoom.quickPrescribeAccess')}
              </p>
              <button className="btn btn-primary"
                onClick={() => onNavigate(`/doctor/prescriptions/new?consultationId=${conId}`)}>
                💊 {t('consultationRoom.openPrescriptionWriter')}
              </button>
              <div className="si-66faea9d">
                <h4>{t('consultationRoom.commonPrescriptions')}</h4>
                {[
                  { label: 'Antibiotics Course (7 days)', name: 'Amoxicillin', dosage: '250mg', frequency: 'Twice daily', duration: '7 days', instructions: 'Give with food' },
                  { label: 'Pain Relief (5 days)', name: 'Meloxicam', dosage: '0.1mg/kg', frequency: 'Once daily', duration: '5 days', instructions: 'Give with food, monitor appetite' },
                  { label: 'Anti-inflammatory (10 days)', name: 'Carprofen', dosage: '2mg/kg', frequency: 'Twice daily', duration: '10 days', instructions: 'Give with food, plenty of water' },
                  { label: 'Vitamins & Supplements', name: 'Pet Multivitamin', dosage: '1 tablet', frequency: 'Once daily', duration: '30 days', instructions: 'Mix with food' },
                ].map(tpl => (
                  <div key={tpl.label} className="si-394b4e9f"
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
                    <span className="si-0134f7a1">+</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

      {/* Referral Modal */}
      {showReferralModal && (
        <div className="si-5044997e"
          onClick={() => setShowReferralModal(false)}>
          <div className="si-e6c98afe"
            onClick={e => e.stopPropagation()}>
            <div className="si-101fd1d0">
              <h3 className="si-44087c4b">🔄 Refer Patient to Network Hospital</h3>
              <button onClick={() => setShowReferralModal(false)} className="si-30be827b">✕</button>
            </div>
            {referralError && <div className="si-80ee1308">{referralError}</div>}
            <form onSubmit={handleCreateReferral}>
              <div className="si-bab8e8bc">
                <label className="si-0402f865">Network <span className="si-f84f41a5">*</span></label>
                <select className="si-c8d05a40" required
                  value={referralForm.networkId} onChange={e => setReferralForm(f => ({ ...f, networkId: e.target.value, toHospitalId: '' }))}>
                  <option value="">— Select Network —</option>
                  {networksList.map((n: any) => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
              </div>
              <div className="si-bab8e8bc">
                <label className="si-0402f865">
                  Receiving Hospital <span className="si-f84f41a5">*</span>
                  {!referralForm.networkId && <span className="si-18d8dcb2">⚠️ Select a network first</span>}
                </label>
                <select className="si-c8d05a40" required
                  disabled={!referralForm.networkId}
                  value={referralForm.toHospitalId} onChange={e => setReferralForm(f => ({ ...f, toHospitalId: e.target.value }))}>
                  <option value="">— Select Hospital —</option>
                  {networkHospitals.map((h: any) => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </div>
              <div className="si-bab8e8bc">
                <label className="si-0402f865">Reason <span className="si-f84f41a5">*</span></label>
                <textarea className="si-d41674e2"
                  rows={3} required placeholder="Reason for referral..."
                  value={referralForm.reason} onChange={e => setReferralForm(f => ({ ...f, reason: e.target.value }))} />
              </div>
              <div className="si-bab8e8bc">
                <label className="si-0402f865">Priority</label>
                <select className="si-c8d05a40"
                  value={referralForm.priority} onChange={e => setReferralForm(f => ({ ...f, priority: e.target.value }))}>
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="emergency">Emergency</option>
                </select>
              </div>
              <div className="si-7e63ec4f">
                <label className="si-0402f865">Clinical Notes (optional)</label>
                <textarea className="si-d41674e2"
                  rows={4} placeholder="Include relevant history, diagnosis, what you need from the receiving hospital..."
                  value={referralForm.clinicalNotes} onChange={e => setReferralForm(f => ({ ...f, clinicalNotes: e.target.value }))} />
              </div>
              <p className="si-7dc8bae5">* Required field</p>
              <div className="si-b1214800">
                <button type="button" onClick={() => setShowReferralModal(false)} className="si-bf48a746">Cancel</button>
                <button type="submit" disabled={referralSubmitting || !referralForm.networkId || !referralForm.toHospitalId}
                  style={{ flex: 2, padding: '10px 20px', borderRadius: 8, border: 'none', background: (referralSubmitting || !referralForm.networkId || !referralForm.toHospitalId) ? '#94a3b8' : '#2563eb', color: '#fff', fontWeight: 600, cursor: (referralSubmitting || !referralForm.networkId || !referralForm.toHospitalId) ? 'not-allowed' : 'pointer' }}>
                  {referralSubmitting ? '⏳ Sending...' : '🔄 Send Referral'}
                </button>
              </div>
              {(!referralForm.networkId || !referralForm.toHospitalId) && (
                <p className="si-d46111c1">⚠️ Select a network and hospital to enable submission</p>
              )}
            </form>
          </div>
        </div>
      )}
      {referralSuccess && (
        <div className="si-6e46e0f9">
          ✓ {referralSuccess}
        </div>
      )}
    </>
  )
}

export default ConsultationRoom

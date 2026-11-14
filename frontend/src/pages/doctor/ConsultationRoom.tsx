import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import apiService from '../../services/api'
import { VideoSession, ChatMessage } from '../../types'
import { useWebRTC } from '../../hooks/useWebRTC'
import ConsultationVideoStage from '../../components/consultationRoom/ConsultationVideoStage'
import EndedSessionView from '../../components/consultationRoom/EndedSessionView'
import ChatPanel from '../../components/consultationRoom/ChatPanel'
import MedicalHistoryPanel from '../../components/consultationRoom/MedicalHistoryPanel'
import NotesPanel from '../../components/consultationRoom/NotesPanel'
import PrescribePanel from '../../components/consultationRoom/PrescribePanel'
import ReferralModal, { ReferralFormState } from '../../components/consultationRoom/ReferralModal'
import { formatDuration } from '../../components/consultationRoom/consultationRoomShared'
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
  const [referralForm, setReferralForm] = useState<ReferralFormState>({ networkId: '', fromHospitalId: '', toHospitalId: '', reason: '', priority: 'normal', clinicalNotes: '' })
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
        // Skip ended sessions - allow creating a new one
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
          // Also start message polling - patient might chat while waiting
          startMessagePolling(existingSession.id)
        }
      } else {
        // No session exists - check consultation status before creating one
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
            // A different session was created - switch to that one
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
      <EndedSessionView
        isCompleted={isCompleted}
        duration={session.duration || callDuration}
        recordingUrl={recordingUrl}
        conId={conId}
        diagnosis={diagnosis}
        onChangeDiagnosis={setDiagnosis}
        notes={notes}
        onChangeNotes={setNotes}
        savingNotes={savingNotes}
        notesSaved={notesSaved}
        onSaveNotes={handleSaveNotes}
        onCompleteConsultation={handleCompleteConsultation}
        messages={messages}
        formatTime={formatTime}
        onNavigate={onNavigate}
      />
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
              <span className="si-1c396c88">🔴 {t('consultationRoom.live')} - {formatDuration(callDuration)}</span>
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
        <ConsultationVideoStage
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
          isMuted={isMuted}
          doctorInitial={user?.lastName?.charAt(0) || ''}
          onToggleMute={toggleMute}
          onToggleCamera={toggleCamera}
          onToggleScreenShare={toggleScreenShare}
          onToggleRecording={toggleRecording}
          onEndCall={handleEndCall}
          onStartCall={handleStartCall}
        />

        {/* Side Panel */}
        <div className="chat-panel si-78f95ca5">
          {/* Panel Tabs */}
          <div className="si-ffe739ab">
            {(['chat', 'history', 'notes', 'prescribe'] as const).map(tab => (
              <button key={tab}
                className={`tab ${activePanel === tab ? 'active' : ''} si-1114bb34`}
                onClick={() => setActivePanel(tab)}>
                {tab === 'chat' ? `💬 ${t('consultationRoom.chat')}${messages.length > 0 ? ` (${messages.length})` : ''}` : tab === 'history' ? `📋 ${t('consultationRoom.historyTab')}` : tab === 'notes' ? `📝 ${t('consultationRoom.notesTab')}` : `💊 ${t('consultationRoom.rx')}`}
              </button>
            ))}
          </div>

          {activePanel === 'chat' && (
            <ChatPanel
              messages={messages}
              currentUserId={user?.id}
              formatTime={formatTime}
              newMessage={newMessage}
              onChangeMessage={setNewMessage}
              onSendMessage={handleSendMessage}
              chatEndRef={chatEndRef}
            />
          )}

          {activePanel === 'history' && (
            <MedicalHistoryPanel
              historyLoading={historyLoading}
              animalInfo={animalInfo}
              allergies={allergies}
              vaccinations={vaccinations}
              medicalRecords={medicalRecords}
              labResults={labResults}
            />
          )}

          {activePanel === 'notes' && (
            <NotesPanel
              diagnosis={diagnosis}
              onChangeDiagnosis={setDiagnosis}
              notes={notes}
              onChangeNotes={setNotes}
              savingNotes={savingNotes}
              notesSaved={notesSaved}
              onSave={handleSaveNotes}
            />
          )}

          {activePanel === 'prescribe' && (
            <PrescribePanel conId={conId} onNavigate={onNavigate} />
          )}
        </div>
      </div>
    </div>

      {/* Referral Modal */}
      {showReferralModal && (
        <ReferralModal
          referralForm={referralForm}
          onChangeForm={setReferralForm}
          networksList={networksList}
          networkHospitals={networkHospitals}
          referralError={referralError}
          referralSubmitting={referralSubmitting}
          onClose={() => setShowReferralModal(false)}
          onSubmit={handleCreateReferral}
        />
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

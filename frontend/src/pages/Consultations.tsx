import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import apiService from '../services/api'
import './ModulePage.css'
import { useTranslation } from 'react-i18next'
import { useAutoRefresh } from '../hooks/useAutoRefresh'

interface BookingRow {
  id: string; petOwnerName?: string; petOwnerId?: string; vetName?: string; scheduledDate: string;
  timeSlotStart: string; timeSlotEnd: string; bookingType?: string;
  reasonForVisit?: string; reason?: string; symptoms?: string;
  priority?: string; status: string; veterinarianId?: string;
  consultationId?: string | null; animalId?: string;
  // Enterprise / group / animal context
  enterpriseId?: string; groupId?: string;
  animalName?: string; animalSpecies?: string; animalBreed?: string; animalUniqueId?: string;
  enterpriseName?: string; enterpriseType?: string;
  groupName?: string; groupType?: string;
  rescheduleCount?: number;
  missedBy?: 'doctor' | 'patient' | 'both';
  cancelledBy?: string;
  cancelledAt?: string;
  confirmedAt?: string;
}
interface ConsultRow {
  id: string; animalType?: string; symptomDescription?: string;
  status: string; diagnosis?: string; scheduledAt?: string;
  createdAt?: string; veterinarianId?: string;
  networkId?: string; networkName?: string;
}
interface TimeSlot { startTime: string; endTime: string; isAvailable: boolean }

/** Filter out past time slots for today using browser local time + 15min buffer */
const filterFutureSlots = (slots: TimeSlot[], forDate: string) => {
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return slots.filter(s => {
    if (!s.isAvailable) return false
    if (forDate !== todayStr) return true

    const [h, m] = (s.startTime || '00:00').split(':').map(Number)
    return h * 60 + m > now.getHours() * 60 + now.getMinutes() + 15
  })
}

/** Check if a booking's scheduled time has already passed (browser local time) */
const isExpiredPending = (b: BookingRow): boolean => {
  if (b.status !== 'pending') return false
  const d = new Date(b.scheduledDate + 'T' + b.timeSlotEnd + ':00')
  return d < new Date()
}

/** Check if a user can reschedule (within limit) */
const canReschedule = (b: BookingRow, maxReschedules: number, patientNoShowLimit: number): boolean => {
  // Expired pending → always allowed (not user's fault)
  if (isExpiredPending(b)) return true
  // For pending pre-acceptance reschedules, check limit
  if (b.status === 'pending') return maxReschedules === 0 || (b.rescheduleCount || 0) < maxReschedules
  // Missed booking logic
  if (b.status === 'missed') {
    const missedBy = b.missedBy
    // Doctor no-show → unlimited reschedules for patient
    if (!missedBy || missedBy === 'doctor') return true
    // Patient/both no-show → check patientNoShowLimit
    return patientNoShowLimit === 0 || (b.rescheduleCount || 0) < patientNoShowLimit
  }
  // confirmed → always allowed
  return true
}

const Consultations: React.FC = () => {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { formatDate, isJoinable, formatSlotTime, settings: appSettings, estimateRefund } = useSettings()
  const { maxReschedules, patientNoShowRescheduleLimit } = appSettings
  const navigate = useNavigate()
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [consultations, setConsultations] = useState<ConsultRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'bookings' | 'consultations'>('bookings')
  const [statusFilter, setStatusFilter] = useState('')

  // Split bookings into active (needs attention) vs history (reference only)
  // 'rescheduled' goes to history — the old booking is superseded, the new one appears separately
  const activeStatuses = ['pending', 'confirmed', 'missed']
  const historyStatuses = ['completed', 'cancelled', 'rescheduled']

  const activeBookings = bookings.filter(b => activeStatuses.includes(b.status))
  const historyBookings = bookings.filter(b => historyStatuses.includes(b.status))

  // Build diagnosis and network lookups from consultations
  const diagnosisMap = new Map(consultations.map(c => [c.id, c.diagnosis || '']))
  const networkMap = new Map(consultations.filter(c => c.networkId).map(c => [c.id, { networkId: c.networkId!, networkName: c.networkName || '' }]))

  // Apply client-side status filter
  const filteredActive = statusFilter ? activeBookings.filter(b => b.status === statusFilter) : activeBookings
  const filteredHistory = statusFilter ? historyBookings.filter(b => b.status === statusFilter) : historyBookings

  // Tab-specific filter options
  const currentFilterStatuses = activeTab === 'bookings' ? activeStatuses : historyStatuses

  const handleTabSwitch = (tab: 'bookings' | 'consultations') => {
    setStatusFilter('')
    setActiveTab(tab)
  }

  // Reschedule modal state
  const [rescheduleBooking, setRescheduleBooking] = useState<BookingRow | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleSlots, setRescheduleSlots] = useState<TimeSlot[]>([])
  const [rescheduleSelectedSlot, setRescheduleSelectedSlot] = useState<TimeSlot | null>(null)
  const [rescheduleDateMsg, setRescheduleDateMsg] = useState('')
  const [rescheduleSlotsLoading, setRescheduleSlotsLoading] = useState(false)
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false)
  const [rescheduleError, setRescheduleError] = useState('')
  // Doctor selection for reschedule (when changing vet)
  const [rescheduleVetId, setRescheduleVetId] = useState<string>('')
  const [vetList, setVetList] = useState<{ id: string; name: string; specialization?: string }[]>([])
  const [vetListLoading, setVetListLoading] = useState(false)

  // Cancel modal state
  const [cancelModal, setCancelModal] = useState<{ show: boolean; bookingId: string; reason: string }>({
    show: false, bookingId: '', reason: ''
  })
  const [cancelError, setCancelError] = useState('')

  // Action Log modal state
  const [actionLogBookingId, setActionLogBookingId] = useState<string | null>(null)
  const [actionLogs, setActionLogs] = useState<any[]>([])
  const [actionLogsLoading, setActionLogsLoading] = useState(false)

  const isVet = user?.role === 'veterinarian'
  const isPetOwner = user?.role === 'pet_owner' || user?.role === 'farmer'
  const isAdmin = user?.role === 'admin'

  const mountedRef = useRef(true)
  useEffect(() => { return () => { mountedRef.current = false } }, [])

  const [searchParams] = useSearchParams()
  // Sync tab and status filter from URL whenever navigation occurs
  useEffect(() => {
    const tab = searchParams.get('tab')
    const status = searchParams.get('status') || ''
    setActiveTab(tab === 'consultations' ? 'consultations' : 'bookings')
    setStatusFilter(status)
  }, [searchParams])

  const actionLabel = (action: string): string => {
    const map: Record<string, string> = {
      BOOKING_CREATED: t('consultations.actionLabels.created'),
      BOOKING_CONFIRMED: t('consultations.actionLabels.confirmed'),
      BOOKING_CANCELLED: t('consultations.actionLabels.cancelled'),
      BOOKING_RESCHEDULED: t('consultations.actionLabels.rescheduled'),
    }
    return map[action] || action
  }

  const openActionLog = async (bookingId: string) => {
    setActionLogBookingId(bookingId)
    setActionLogsLoading(true)
    try {
      const res = await apiService.getBookingActionLogs(bookingId)
      if (mountedRef.current) setActionLogs(res.data || [])
    } catch (err: any) {
      console.error('Failed to load action logs:', err?.message)
      if (mountedRef.current) setActionLogs([])
    } finally {
      if (mountedRef.current) setActionLogsLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      setLoading(true); setError('')
      const [bRes, cRes] = await Promise.all([
        apiService.listBookings({ limit: 100 }),
        apiService.listConsultations({ limit: 100 })
      ])
      setBookings(bRes.data?.items || (Array.isArray(bRes.data) ? bRes.data : []))
      setConsultations(cRes.data?.items || (Array.isArray(cRes.data) ? cRes.data : []))
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || t('consultations.failedToLoad'))
    } finally { setLoading(false) }
  }
  useAutoRefresh(['bookings', 'consultations'], loadData)

  const handleConfirmBooking= async (id: string) => {
    setActionLoading(id)
    try { await apiService.confirmBooking(id); loadData() }
    catch (err: any) { setError(err?.response?.data?.error?.message || t('consultations.failedToConfirm')) }
    finally { setActionLoading(null) }
  }

  const handleCancelBooking = async (id?: string) => {
    const bookingId = id || cancelModal.bookingId
    if (!bookingId) return
    // If called directly (not from modal), show the modal
    if (!cancelModal.show) {
      setCancelModal({ show: true, bookingId, reason: '' })
      return
    }
    try {
      await apiService.cancelBooking(bookingId, cancelModal.reason.trim())
      setCancelModal({ show: false, bookingId: '', reason: '' })
      setCancelError('')
      loadData()
    } catch (err: any) {
      setCancelError(err?.response?.data?.message || err?.response?.data?.error?.message || t('consultations.failedToCancel'))
    }
  }

  // ─── Reschedule helpers ─────────────────────────────────
  const openRescheduleModal = async (b: BookingRow) => {
    setRescheduleBooking(b)
    setRescheduleDate('')
    setRescheduleSlots([])
    setRescheduleSelectedSlot(null)
    setRescheduleError('')
    setRescheduleVetId(b.veterinarianId || '')
    // Load vet list so user can optionally change doctor
    if (vetList.length === 0) {
      try {
        setVetListLoading(true)
        const res = await apiService.listVets({ limit: 100 })
        // API returns { success, data: { vets: [...], total: N } }
        const rawVets = res.data?.vets || res.data?.items || (Array.isArray(res.data) ? res.data : []) || []
        const vets = rawVets.map((v: any) => ({
          id: v.userId || v.id,
          name: `Dr. ${v.firstName || ''} ${v.lastName || ''}`.trim(),
          specialization: (v.specializations && v.specializations[0]) || v.specialization || ''
        }))
        setVetList(vets)
      } catch (err: any) {
        console.error('Failed to load vet list:', err?.message)
      } finally { setVetListLoading(false) }
    }
  }

  const loadRescheduleSlots = async (date: string, vetId?: string) => {
    const targetVetId = vetId || rescheduleVetId || rescheduleBooking?.veterinarianId
    if (!targetVetId) return
    setRescheduleDate(date)
    setRescheduleSelectedSlot(null)
    setRescheduleDateMsg('')
    try {
      setRescheduleSlotsLoading(true)
      const result = await apiService.getVetAvailability(targetVetId, date)
      const data = result.data || result || {}
      if (data.holiday) setRescheduleDateMsg(`\uD83C\uDF89 Holiday: ${data.holiday}`)
      else if (data.unavailableReason) setRescheduleDateMsg(`\uD83D\uDEAB ${data.unavailableReason}`)
      setRescheduleSlots(data.slots || [])
    } catch (err: any) {
      console.error('Failed to load reschedule slots:', err?.message)
      setRescheduleSlots([])
    } finally {
      setRescheduleSlotsLoading(false)
    }
  }

  const handleVetChange = (newVetId: string) => {
    setRescheduleVetId(newVetId)
    setRescheduleSelectedSlot(null)
    if (rescheduleDate) {
      loadRescheduleSlots(rescheduleDate, newVetId)
    }
  }

  const handleRescheduleSubmit = async () => {
    if (!rescheduleBooking || !rescheduleDate || !rescheduleSelectedSlot) return
    // Validate: cannot reschedule to a past time
    const slotDateTime = new Date(`${rescheduleDate}T${rescheduleSelectedSlot.startTime}:00`)
    if (slotDateTime <= new Date()) {
      setRescheduleError(t('consultations.pastTimeError'))
      return
    }
    try {
      setRescheduleSubmitting(true)
      const payload: any = {
        scheduledDate: rescheduleDate,
        timeSlotStart: rescheduleSelectedSlot.startTime,
        timeSlotEnd: rescheduleSelectedSlot.endTime
      }
      // Include veterinarianId if changed
      if (rescheduleVetId && rescheduleVetId !== rescheduleBooking.veterinarianId) {
        payload.veterinarianId = rescheduleVetId
      }
      await apiService.rescheduleBooking(rescheduleBooking.id, payload)
      setRescheduleBooking(null)
      setRescheduleError('')
      loadData()
    } catch (err: any) {
      setRescheduleError(err?.response?.data?.message || err?.response?.data?.error?.message || t('consultations.failedToReschedule'))
    } finally {
      setRescheduleSubmitting(false)
    }
  }

  const handleStartConsultation = async (booking: BookingRow) => {
    try {
      setError('')

      // If the booking already has a linked consultation, navigate to it directly
      if (booking.consultationId) {
        const conId = booking.consultationId
        if (isVet) {
          navigate(`/doctor/consultation-room/${conId}`)
        } else {
          navigate(`/video-consultation/${conId}`)
        }
        return
      }

      const reason = booking.reasonForVisit || booking.reason || 'General consultation'
      const symptoms = booking.symptoms || ''
      let description = symptoms || reason
      if (description.length < 10) {
        description = `Consultation: ${description} — scheduled appointment`
      }

      const res = await apiService.createConsultation({
        veterinarianId: booking.veterinarianId || '',
        animalType: booking.animalSpecies ? `${booking.animalSpecies}${booking.animalBreed ? ' - ' + booking.animalBreed : ''}` : 'General',
        symptomDescription: description,
        animalId: booking.animalId || undefined,
        bookingId: booking.id,
        petOwnerId: booking.petOwnerId || undefined
      })
      if (res.data?.id) {
        if (isVet) {
          navigate(`/doctor/consultation-room/${res.data.id}`)
        } else {
          navigate(`/video-consultation/${res.data.id}`)
        }
      }
    } catch (err: any) { setError(err?.response?.data?.error?.message || t('consultations.failedToStart')) }
  }

  const fmt = (d: string) => {
    if (!d) return 'N/A'
    try { return formatDate(d) }
    catch { return d }
  }

  const badge = (status: string) => {
    const m: Record<string, { bg: string; fg: string }> = {
      pending: { bg: '#fff3cd', fg: '#856404' }, confirmed: { bg: '#d4edda', fg: '#155724' },
      scheduled: { bg: '#cce5ff', fg: '#004085' }, in_progress: { bg: '#e7f3ff', fg: '#0366d6' },
      completed: { bg: '#d4edda', fg: '#155724' }, cancelled: { bg: '#f8d7da', fg: '#721c24' },
      rescheduled: { bg: '#fef3c7', fg: '#92400e' }, missed: { bg: '#fde8e8', fg: '#c53030' },
      active: { bg: '#c3f7c8', fg: '#0d5415' }, ended: { bg: '#e2e2e2', fg: '#555' },
    }
    const s = m[status] || { bg: '#f0f0f0', fg: '#333' }
    return <span style={{ background: s.bg, color: s.fg, padding: '4px 12px', borderRadius: 12, fontSize: 12, fontWeight: 600, textTransform: 'capitalize' as const }}>{t(`consultations.statuses.${status}`, status.replace(/_/g, ' '))}</span>
  }

  const missedBadge = (missedBy?: 'doctor' | 'patient' | 'both') => {
    if (!missedBy) return null
    const config = {
      doctor:  { bg: '#fef3c7', fg: '#92400e', icon: '🩺', label: t('consultations.missedLabels.doctorNoShow') },
      patient: { bg: '#ede9fe', fg: '#6d28d9', icon: '🙋', label: t('consultations.missedLabels.patientNoShow') },
      both:    { bg: '#f1f5f9', fg: '#475569', icon: '❌', label: t('consultations.missedLabels.bothNoShow') },
    }
    const c = config[missedBy]
    return (
      <span style={{ background: c.bg, color: c.fg, padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600, display: 'inline-block', marginTop: 4 }}>
        {c.icon} {c.label}
      </span>
    )
  }

  if (loading) return (
    <div className="module-page">
      <div style={{ textAlign: 'center', padding: 60 }}>
        <div className="loading-spinner" />
        <p style={{ color: '#6b7280', marginTop: 16 }}>{t('consultations.loading')}</p>
      </div>
    </div>
  )

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <h1>{t('consultations.pageTitle')}</h1>
          <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>
            {isAdmin ? t('consultations.subtitles.admin') : isVet ? t('consultations.subtitles.vet') : t('consultations.subtitles.petOwner')}
          </p>
        </div>
        {isPetOwner && (
          <button className="btn-primary" onClick={() => navigate('/book-consultation')}>{t('consultations.bookConsultation')}</button>
        )}
      </div>

      {error && (
        <div style={{ padding: '12px 18px', background: '#fef2f2', color: '#dc2626', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
          ⚠️ {error}
          <button style={{ marginLeft: 12, background: 'none', border: '1px solid #dc2626', color: '#dc2626', padding: '4px 10px', borderRadius: 4, cursor: 'pointer' }} onClick={() => setError('')}>{t('consultations.dismiss')}</button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e5e7eb', marginBottom: 20 }}>
        {[{ key: 'bookings' as const, label: t('consultations.tabs.appointments'), count: activeBookings.length },
          { key: 'consultations' as const, label: t('consultations.tabs.history'), count: historyBookings.length }
        ].map(t => (
          <button key={t.key} type="button" onClick={() => handleTabSwitch(t.key)}
            style={{ padding: '12px 24px', fontWeight: 600, fontSize: 14, cursor: 'pointer', border: 'none', background: 'none',
              borderBottom: activeTab === t.key ? '3px solid #667eea' : '3px solid transparent',
              color: activeTab === t.key ? '#667eea' : '#6b7280'
            }}>
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: '#6b7280' }}>{t('consultations.filterLabel')}:</span>
        {['', ...currentFilterStatuses].map(s => (
          <button key={s} type="button" onClick={() => setStatusFilter(s)}
            style={{ padding: '5px 14px', borderRadius: 16, fontSize: 12, fontWeight: 500, cursor: 'pointer',
              border: statusFilter === s ? '2px solid #667eea' : '1px solid #d1d5db',
              background: statusFilter === s ? '#eef2ff' : 'white', color: statusFilter === s ? '#667eea' : '#6b7280'
            }}>
            {s ? t(`consultations.statuses.${s}`, s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())) : t('consultations.filterAll')}
          </button>
        ))}
        <button type="button" onClick={loadData} style={{ marginLeft: 'auto', padding: '5px 14px', borderRadius: 6, border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 500, color: '#374151' }}>{t('common.refresh')}</button>
      </div>

      {/* Appointments Tab — items needing attention or upcoming */}
      {activeTab === 'bookings' && (
        <div className="module-content">
          {filteredActive.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
              <p style={{ fontSize: 16, fontWeight: 500 }}>{statusFilter ? t('consultations.noMatchAppointments') : t('consultations.emptyAppointments')}</p>
              <p style={{ fontSize: 13, margin: '4px 0 12px' }}>{t('consultations.appointmentHint')}</p>
              {isPetOwner && !statusFilter && <button className="btn-primary" style={{ marginTop: 4 }} onClick={() => navigate('/book-consultation')}>{t('consultations.bookButton')}</button>}
            </div>
          ) : (
            <div className="appt-card-grid">
              {filteredActive.map(b => (
                <div key={b.id} className="appt-card">
                  {/* Card Header */}
                  <div className="appt-card-header">
                    <div className="appt-card-who">
                      {isVet && <strong>{b.petOwnerName || t('common.patient')}</strong>}
                      {isPetOwner && <strong>{b.vetName || t('common.doctor')}</strong>}
                      {isAdmin && <span>{b.petOwnerName || '—'} / {b.vetName || '—'}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                      <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                        background: b.priority === 'high' || b.priority === 'urgent' || b.priority === 'emergency' ? '#fef2f2' : '#f0f0f0',
                        color: b.priority === 'high' || b.priority === 'urgent' || b.priority === 'emergency' ? '#dc2626' : '#555'
                      }}>{b.priority ? t(`consultations.priorities.${b.priority}`, b.priority) : t('common.normal')}</span>
                      {badge(b.status)}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="appt-card-body">
                    {/* Animal / Farm info */}
                    <div className="appt-card-animal">
                      {b.enterpriseName ? (
                        <>
                          <span style={{ fontWeight: 600, color: '#059669' }}>🏢 {b.enterpriseName}</span>
                          {b.groupName && <span style={{ color: '#6b7280' }}> · 📋 {b.groupName}</span>}
                          {b.animalName ? <span> · 🐾 {b.animalName}{b.animalBreed ? ` (${b.animalBreed})` : ''}</span>
                            : <span style={{ color: '#9ca3af', fontStyle: 'italic' }}> · {t('consultations.herdLevel')}</span>}
                        </>
                      ) : b.animalName ? (
                        <span>🐾 {b.animalName}{b.animalSpecies ? ` — ${b.animalSpecies}` : ''}{b.animalBreed ? ` / ${b.animalBreed}` : ''}</span>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>—</span>
                      )}
                    </div>

                    {/* Date, Time, Type row */}
                    <div className="appt-card-meta">
                      <span>📅 {fmt(b.scheduledDate)}</span>
                      <span>⏰ {formatSlotTime(b.timeSlotStart)} - {formatSlotTime(b.timeSlotEnd)}</span>
                      <span>{b.bookingType === 'video_call' ? t('consultations.types.video') : b.bookingType === 'phone' ? t('consultations.types.phone') : b.bookingType === 'in_person' ? t('consultations.types.inPerson') : t('consultations.types.chat')}</span>
                    </div>

                    {/* Reason */}
                    {(b.reasonForVisit || b.reason) && (
                      <div className="appt-card-reason">{b.reasonForVisit || b.reason}</div>
                    )}

                    {/* ─── Status-specific info banners ─── */}

                    {/* PENDING — awaiting vet confirmation */}
                    {b.status === 'pending' && !isExpiredPending(b) && (
                      <div style={{ padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, fontSize: 12, color: '#92400e', marginTop: 6 }}>
                        {isPetOwner && t('consultations.pendingMessages.petOwner')}
                        {isVet && t('consultations.pendingMessages.vet')}
                        {isAdmin && t('consultations.pendingMessages.admin')}
                      </div>
                    )}

                    {/* PENDING but expired (safety fallback — backend normally auto-expires these) */}
                    {isExpiredPending(b) && (
                      <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 12, color: '#991b1b', marginTop: 6 }}>
                        {isPetOwner ? t('consultations.expiredPendingMessages.petOwner') : t('consultations.expiredPendingMessages.general')}
                      </div>
                    )}

                    {/* CONFIRMED — appointment is set */}
                    {b.status === 'confirmed' && (
                      <div style={{ padding: '8px 12px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 6, fontSize: 12, color: '#065f46', marginTop: 6 }}>
                        {isPetOwner && t('consultations.confirmedMessages.petOwner')}
                        {isVet && t('consultations.confirmedMessages.vet')}
                        {isAdmin && t('consultations.confirmedMessages.admin')}
                      </div>
                    )}

                    {/* MISSED — distinguish pending→missed vs confirmed→missed */}
                    {b.status === 'missed' && (
                      <div style={{ marginTop: 8 }}>
                        {missedBadge(b.missedBy)}

                        {/* Doctor missed — was never confirmed (pending → missed) */}
                        {b.missedBy === 'doctor' && !b.confirmedAt && (
                          <>
                            {isPetOwner && (
                              <div style={{ padding: '8px 12px', background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 6, fontSize: 12, color: '#78350f', marginTop: 6 }}>
                                {t('consultations.doctorMissedPending.petOwner')}
                              </div>
                            )}
                            {isVet && (
                              <div style={{ padding: '8px 12px', background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 6, fontSize: 12, color: '#78350f', marginTop: 6 }}>
                                {t('consultations.doctorMissedPending.vet')}
                              </div>
                            )}
                            {isAdmin && (
                              <div style={{ padding: '8px 12px', background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 6, fontSize: 12, color: '#78350f', marginTop: 6 }}>
                                {t('consultations.doctorMissedPending.admin')}
                              </div>
                            )}
                          </>
                        )}

                        {/* Doctor missed — was confirmed but didn't show up (confirmed → missed) */}
                        {b.missedBy === 'doctor' && b.confirmedAt && (
                          <>
                            {isPetOwner && (
                              <div style={{ padding: '8px 12px', background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 6, fontSize: 12, color: '#78350f', marginTop: 6 }}>
                                {t('consultations.doctorMissedConfirmed.petOwner')}
                              </div>
                            )}
                            {isVet && (
                              <div style={{ padding: '8px 12px', background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 6, fontSize: 12, color: '#78350f', marginTop: 6 }}>
                                {t('consultations.doctorMissedConfirmed.vet')}
                              </div>
                            )}
                            {isAdmin && (
                              <div style={{ padding: '8px 12px', background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 6, fontSize: 12, color: '#78350f', marginTop: 6 }}>
                                {t('consultations.doctorMissedConfirmed.admin')}
                              </div>
                            )}
                          </>
                        )}

                        {/* Patient missed */}
                        {isPetOwner && (b.missedBy === 'patient' || b.missedBy === 'both') && (() => {
                          const used = b.rescheduleCount || 0
                          const limit = patientNoShowRescheduleLimit
                          const remaining = limit === 0 ? null : Math.max(0, limit - used)
                          return (
                            <div style={{ padding: '8px 12px', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 6, fontSize: 12, color: '#5b21b6', marginTop: 6 }}>
                              {b.missedBy === 'both' ? t('consultations.missedMessages.bothMissed') : t('consultations.missedMessages.youMissed')}{' '}
                              {limit === 0
                                ? t('consultations.missedMessages.rescheduleAnytime')
                                : remaining !== null && remaining > 0
                                  ? t('consultations.missedMessages.rescheduleRemaining', { count: remaining })
                                  : t('consultations.missedMessages.rescheduleUsed')}
                            </div>
                          )
                        })()}
                        {isVet && b.missedBy === 'patient' && (
                          <div style={{ padding: '8px 12px', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 6, fontSize: 12, color: '#5b21b6', marginTop: 6 }}>
                            {t('consultations.missedMessages.patientNoJoin')}
                          </div>
                        )}
                        {isVet && b.missedBy === 'both' && (
                          <div style={{ padding: '8px 12px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12, color: '#475569', marginTop: 6 }}>
                            {t('consultations.missedMessages.neitherJoined')}
                          </div>
                        )}
                        {isAdmin && (b.missedBy === 'patient' || b.missedBy === 'both') && (
                          <div style={{ padding: '8px 12px', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 6, fontSize: 12, color: '#5b21b6', marginTop: 6 }}>
                            {b.missedBy === 'patient' ? t('consultations.adminMissed.patientNoShow') : t('consultations.adminMissed.bothMissed')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Card Actions */}
                  <div className="appt-card-actions">
                    {isVet && b.status === 'pending' && !isExpiredPending(b) && (
                      <button className="btn-small" disabled={actionLoading === b.id} style={{ background: '#059669', color: 'white', border: 'none' }} onClick={() => handleConfirmBooking(b.id)}>{actionLoading === b.id ? '⏳' : t('consultations.actions.confirm')}</button>
                    )}
                    {(isVet || isAdmin) && b.status === 'confirmed' && b.bookingType === 'video_call' && (
                      isJoinable(b.scheduledDate, b.timeSlotStart, b.timeSlotEnd)
                        ? <button className="btn-small" style={{ background: '#667eea', color: 'white', border: 'none' }} onClick={() => handleStartConsultation(b)}>{t('consultations.actions.start')}</button>
                        : <button className="btn-small" style={{ background: '#e5e7eb', color: '#9ca3af', border: 'none', cursor: 'not-allowed' }} disabled title={t('consultations.joinWindowTooltip', { minutes: appSettings.joinWindowMinutes })}>{t('consultations.actions.notYet')}</button>
                    )}
                    {isPetOwner && b.status === 'confirmed' && b.bookingType === 'video_call' && (
                      isJoinable(b.scheduledDate, b.timeSlotStart, b.timeSlotEnd)
                        ? <button className="btn-small" style={{ background: '#667eea', color: 'white', border: 'none' }} onClick={() => handleStartConsultation(b)}>{t('consultations.actions.join')}</button>
                        : <button className="btn-small" style={{ background: '#e5e7eb', color: '#9ca3af', border: 'none', cursor: 'not-allowed' }} disabled title={t('consultations.joinWindowTooltip', { minutes: appSettings.joinWindowMinutes })}>{t('consultations.actions.notYet')}</button>
                    )}
                    {/* Reschedule button — conditional on who missed and reschedule limits */}
                    {(b.status === 'confirmed' || (b.status === 'pending' && canReschedule(b, maxReschedules, patientNoShowRescheduleLimit)) || (b.status === 'missed' && canReschedule(b, maxReschedules, patientNoShowRescheduleLimit))) && (
                      <button className="btn-small" style={{
                        background: isExpiredPending(b) ? '#dc2626' : '#f59e0b',
                        color: 'white', border: 'none'
                      }} onClick={() => openRescheduleModal(b)}>
                        {isExpiredPending(b) ? `⚠️ ${t('consultations.actions.reschedule')}` : `🔄 ${t('consultations.actions.reschedule')}`}
                      </button>
                    )}
                    {(b.status === 'pending' || b.status === 'confirmed') && (
                      <button className="btn-small" style={{ color: '#dc2626', border: '1px solid #dc2626', background: 'white' }} onClick={() => handleCancelBooking(b.id)}>{t('consultations.actions.cancelBooking')}</button>
                    )}
                    {isAdmin && b.status === 'pending' && !isExpiredPending(b) && (
                      <button className="btn-small" disabled={actionLoading === b.id} style={{ background: '#059669', color: 'white', border: 'none' }} onClick={() => handleConfirmBooking(b.id)}>{actionLoading === b.id ? '⏳' : t('consultations.actions.confirm')}</button>
                    )}
                    <button className="btn-small" style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db' }} onClick={() => openActionLog(b.id)} title={t('consultations.viewActionHistory')}>{t('consultations.actions.log')}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Consultation History Tab — completed/cancelled, reference only */}
      {activeTab === 'consultations' && (
        <div className="module-content">
          {filteredHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🩺</div>
              <p style={{ fontSize: 16, fontWeight: 500 }}>{statusFilter ? t('consultations.noMatchFilter') : t('consultations.noHistory')}</p>
              <p style={{ fontSize: 13 }}>{t('consultations.historyHint')}</p>
            </div>
          ) : (
            <div className="appt-card-grid">
              {filteredHistory.map(b => {
                const diagnosis = b.consultationId ? diagnosisMap.get(b.consultationId) : ''
                const networkInfo = b.consultationId ? networkMap.get(b.consultationId) : undefined
                return (
                  <div key={b.id} className="appt-card">
                    {/* Card Header */}
                    <div className="appt-card-header">
                      <div className="appt-card-who">
                        {isVet && <strong>{b.petOwnerName || t('common.patient')}</strong>}
                        {isPetOwner && <strong>{b.vetName || t('common.doctor')}</strong>}
                        {isAdmin && <span>{b.petOwnerName || '—'} / {b.vetName || '—'}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                        {networkInfo && networkInfo.networkName && (
                          <span className="badge" style={{ background: '#e8f4f8', color: '#1a6a8a', fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4 }}>
                            🏥 {networkInfo.networkName}
                          </span>
                        )}
                        {badge(b.status)}
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="appt-card-body">
                      <div className="appt-card-animal">
                        {b.enterpriseName ? (
                          <>
                            <span style={{ fontWeight: 600, color: '#059669' }}>🏢 {b.enterpriseName}</span>
                            {b.groupName && <span style={{ color: '#6b7280' }}> · 📋 {b.groupName}</span>}
                            {b.animalName && <span> · 🐾 {b.animalName}{b.animalBreed ? ` (${b.animalBreed})` : ''}</span>}
                          </>
                        ) : b.animalName ? (
                          <span>🐾 {b.animalName}{b.animalSpecies ? ` — ${b.animalSpecies}` : ''}</span>
                        ) : (
                          <span style={{ color: '#9ca3af' }}>—</span>
                        )}
                      </div>

                      <div className="appt-card-meta">
                        <span>📅 {fmt(b.scheduledDate)}</span>
                        <span>⏰ {formatSlotTime(b.timeSlotStart)} - {formatSlotTime(b.timeSlotEnd)}</span>
                      </div>

                      {(b.reasonForVisit || b.reason) && (
                        <div className="appt-card-reason">{b.reasonForVisit || b.reason}</div>
                      )}

                      {diagnosis && (
                        <div style={{ fontSize: 13, color: '#059669', marginTop: 4 }}>🩺 {diagnosis}</div>
                      )}

                      {/* Cancelled by indicator */}
                      {b.status === 'cancelled' && b.cancelledBy && (
                        <div style={{ fontSize: 12, marginTop: 6, padding: '4px 10px', borderRadius: 6,
                          background: b.cancelledBy === user?.id ? '#fef3c7' : '#fef2f2',
                          color: b.cancelledBy === user?.id ? '#92400e' : '#991b1b' }}>
                          {b.cancelledBy === user?.id ? t('consultations.cancelledByYou') : t('consultations.cancelledByOther')}
                          {b.cancelledAt && <span style={{ marginLeft: 8, fontSize: 11, color: '#9ca3af' }}>
                            {formatDate(b.cancelledAt)}
                          </span>}
                        </div>
                      )}

                      {/* Rescheduled indicator — this is the OLD booking that was superseded */}
                      {b.status === 'rescheduled' && (
                        <div style={{ fontSize: 12, marginTop: 6, padding: '8px 12px', borderRadius: 6,
                          background: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e' }}>
                          {t('consultations.rescheduledNotice')}
                        </div>
                      )}
                    </div>

                    {/* Card Actions */}
                    <div className="appt-card-actions">
                      {b.status === 'completed' && b.consultationId && (
                        <button className="btn-small" style={{ background: '#f0fdf4', color: '#059669', border: '1px solid #059669' }}
                          onClick={() => {
                            if (isVet) navigate(`/doctor/consultation-room/${b.consultationId}`)
                            else navigate(`/video-consultation/${b.consultationId}`)
                          }}>{t('consultations.actions.view')}</button>
                      )}
                      {b.status === 'completed' && isPetOwner && b.consultationId && (
                        <button className="btn-small" onClick={() => navigate(`/write-review?consultationId=${b.consultationId}&veterinarianId=${b.veterinarianId}`)}>{t('consultations.actions.review')}</button>
                      )}
                      {b.status === 'cancelled' && (
                        <button className="btn-small" style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db' }} onClick={() => openActionLog(b.id)} title={t('consultations.viewCancellationDetails')}>{t('consultations.actions.details')}</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── Reschedule Modal ──────────────────────────────── */}
      {rescheduleBooking && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999
        }} onClick={() => { setRescheduleBooking(null); setRescheduleError('') }}>
          <div style={{
            background: 'white', borderRadius: 16, padding: 32, width: '95%', maxWidth: 520,
            maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0 }}>{t('consultations.reschedule.title')}</h2>
              <button type="button" onClick={() => { setRescheduleBooking(null); setRescheduleError('') }}
                style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#6b7280' }}>✕</button>
            </div>

            {/* Current booking info */}
            <div style={{ background: '#fef3c7', borderRadius: 8, padding: 14, marginBottom: 20, border: '1px solid #fcd34d' }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#92400e' }}>{t('consultations.reschedule.originalLabel')}</p>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: '#92400e' }}>
                {rescheduleBooking.vetName || t('common.doctor')} — {fmt(rescheduleBooking.scheduledDate)} {t('common.at')} {formatSlotTime(rescheduleBooking.timeSlotStart)} - {formatSlotTime(rescheduleBooking.timeSlotEnd)}
              </p>
            </div>

            {/* Reschedule count info */}
            {rescheduleBooking.status === 'pending' && !isExpiredPending(rescheduleBooking) && appSettings.maxReschedules > 0 && (
              <div style={{ padding: '8px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, marginBottom: 16, fontSize: 13, color: '#1e40af' }}>
                {t('consultations.reschedule.rescheduleCount', { current: (rescheduleBooking.rescheduleCount || 0) + 1, max: appSettings.maxReschedules })}
              </div>
            )}

            {/* Missed booking context */}
            {rescheduleBooking.status === 'missed' && (
              <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13,
                background: !rescheduleBooking.missedBy || rescheduleBooking.missedBy === 'doctor' ? '#fef9c3' : '#f5f3ff',
                border: !rescheduleBooking.missedBy || rescheduleBooking.missedBy === 'doctor' ? '1px solid #fde68a' : '1px solid #ddd6fe',
                color: !rescheduleBooking.missedBy || rescheduleBooking.missedBy === 'doctor' ? '#78350f' : '#5b21b6',
              }}>
                {!rescheduleBooking.missedBy || rescheduleBooking.missedBy === 'doctor'
                  ? (rescheduleBooking.confirmedAt
                    ? t('consultations.reschedule.doctorConfirmedNoShow')
                    : t('consultations.reschedule.doctorNoConfirm'))
                  : (() => {
                      const used = rescheduleBooking.rescheduleCount || 0
                      const limit = patientNoShowRescheduleLimit
                      return limit === 0
                        ? t('consultations.reschedule.patientNoShowNoLimit')
                        : t('consultations.reschedule.patientNoShowLimit', { current: used + 1, max: limit })
                    })()
                }
              </div>
            )}

            {/* Expired pending notice */}
            {isExpiredPending(rescheduleBooking) && (
              <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, marginBottom: 16, fontSize: 13, color: '#991b1b' }}>
                {t('consultations.reschedule.expiredPendingNotice')}
              </div>
            )}

            {/* Doctor selection */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
                {isExpiredPending(rescheduleBooking) ? t('consultations.reschedule.selectDoctor') : t('consultations.reschedule.selectDoctorOptional')}
              </label>
              {vetListLoading ? (
                <div style={{ padding: 10, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>{t('consultations.reschedule.loadingDoctors')}</div>
              ) : (
                <select
                  value={rescheduleVetId}
                  onChange={(e) => handleVetChange(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '2px solid #d1d5db', fontSize: 14, boxSizing: 'border-box', background: 'white', color: '#1a1a1a' }}
                >
                  <option value="">{t('consultations.reschedule.keepCurrentDoctor')}</option>
                  {vetList.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name}{v.specialization ? ` — ${v.specialization}` : ''}{v.id === rescheduleBooking.veterinarianId ? ` ${t('consultations.reschedule.currentDoctor')}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* New date picker */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>{t('consultations.reschedule.dateLabel')}</label>
              <input
                type="date"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' }}
                value={rescheduleDate}
                min={(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })()}
                onChange={(e) => loadRescheduleSlots(e.target.value)}
              />
            </div>

            {/* Available slots */}
            {rescheduleDate && (() => {
              const futureSlots = filterFutureSlots(rescheduleSlots, rescheduleDate)
              return (
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: 14 }}>{t('consultations.reschedule.slotsTitle')}</label>
                {rescheduleSlotsLoading ? (
                  <div style={{ textAlign: 'center', padding: 20 }}>
                    <div className="loading-spinner" style={{ margin: '0 auto' }} />
                  </div>
                ) : rescheduleDateMsg ? (
                  <div style={{ padding: '12px 16px', borderRadius: 8, background: '#fefce8', border: '1px solid #fde047', fontSize: 13, color: '#854d0e', textAlign: 'center' }}>
                    {rescheduleDateMsg} — {t('consultations.reschedule.selectAnotherDate')}
                  </div>
                ) : futureSlots.length === 0 ? (
                  <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: 16 }}>
                    {t('consultations.reschedule.noSlots')}
                  </p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {futureSlots.map((slot, idx) => (
                      <button
                        key={idx}
                        onClick={() => setRescheduleSelectedSlot(slot)}
                        style={{
                          padding: '10px 8px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                          border: rescheduleSelectedSlot?.startTime === slot.startTime ? '2px solid #667eea' : '1px solid #d1d5db',
                          background: rescheduleSelectedSlot?.startTime === slot.startTime ? '#eef2ff' : 'white',
                          color: rescheduleSelectedSlot?.startTime === slot.startTime ? '#667eea' : '#374151'
                        }}
                      >
                        {slot.startTime ? formatSlotTime(slot.startTime) : ''} - {slot.endTime ? formatSlotTime(slot.endTime) : ''}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              )
            })()}

            {/* Doctor approval note for pet owners */}
            {isPetOwner && rescheduleSelectedSlot && (
              <div style={{ padding: '10px 14px', background: '#dbeafe', color: '#1e40af', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
                {t('consultations.reschedule.approvalNote')}
              </div>
            )}

            {/* Error banner */}
            {rescheduleError && (
              <div style={{ padding: '10px 14px', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, fontWeight: 500, marginBottom: 12 }}>
                ⚠ {rescheduleError}
              </div>
            )}

            {/* Confirm reschedule */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setRescheduleBooking(null); setRescheduleError('') }}
                style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #d1d5db', background: 'white', color: '#374151', cursor: 'pointer', fontWeight: 500 }}
              >{t('common.cancel')}</button>
              <button
                onClick={handleRescheduleSubmit}
                disabled={!rescheduleDate || !rescheduleSelectedSlot || rescheduleSubmitting}
                style={{
                  padding: '10px 24px', borderRadius: 8, border: 'none', fontWeight: 600, cursor: 'pointer',
                  background: (!rescheduleDate || !rescheduleSelectedSlot) ? '#e5e7eb' : '#667eea',
                  color: (!rescheduleDate || !rescheduleSelectedSlot) ? '#6b7280' : 'white'
                }}
              >
                {rescheduleSubmitting ? t('consultations.reschedule.confirming') : t('consultations.reschedule.confirmBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Log Modal */}
      {actionLogBookingId && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1100
        }} onClick={() => setActionLogBookingId(null)}>
          <div style={{
            background: 'white', borderRadius: 12, padding: 24, width: '90%',
            maxWidth: 520, maxHeight: '80vh', overflowY: 'auto'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>{t('consultations.actionLog.title')}</h2>
              <button type="button" onClick={() => setActionLogBookingId(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280' }}>✕</button>
            </div>

            {actionLogsLoading && <p style={{ color: '#6b7280' }}>{t('consultations.actionLog.loading')}</p>}

            {!actionLogsLoading && actionLogs.length === 0 && (
              <p style={{ color: '#9ca3af', textAlign: 'center', padding: 20 }}>{t('consultations.actionLog.empty')}</p>
            )}

            {!actionLogsLoading && actionLogs.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {actionLogs.map((log, idx) => (
                  <div key={log.id} style={{
                    display: 'flex', gap: 12, padding: '12px 0',
                    borderBottom: idx < actionLogs.length - 1 ? '1px solid #f3f4f6' : 'none'
                  }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', marginTop: 6, flexShrink: 0,
                      background: log.action === 'BOOKING_CREATED' ? '#3b82f6'
                        : log.action === 'BOOKING_CONFIRMED' ? '#10b981'
                        : log.action === 'BOOKING_CANCELLED' ? '#ef4444'
                        : log.action === 'BOOKING_RESCHEDULED' ? '#f59e0b' : '#6b7280'
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>
                        {actionLabel(log.action)}
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                        {t('consultations.actionLog.by')} <strong>{log.userName || t('consultations.actionLog.system')}</strong>
                        {log.details?.role && <span> ({log.details.role})</span>}
                        {' · '}
                        {log.createdAt ? new Date(log.createdAt).toLocaleString() : '–'}
                      </div>
                      {log.action === 'BOOKING_RESCHEDULED' && log.details && (
                        <div style={{ fontSize: 12, color: '#4b5563', marginTop: 4, padding: '4px 8px', background: '#fef3c7', borderRadius: 4 }}>
                          {t('consultations.actionLog.newSlot')} {log.details.newDate} {formatSlotTime(log.details.newTimeSlotStart)}–{formatSlotTime(log.details.newTimeSlotEnd)}
                          {log.details.newStatus === 'pending' && (
                            // Check if a subsequent confirmation exists in the log
                            actionLogs.some((l, j) => j > idx && l.action === 'BOOKING_CONFIRMED')
                              ? <span style={{ color: '#059669' }}> {t('consultations.actionLog.approved')}</span>
                              : <span style={{ color: '#d97706' }}> {t('consultations.actionLog.awaitingApproval')}</span>
                          )}
                          {log.details.newStatus === 'confirmed' && <span style={{ color: '#059669' }}> {t('consultations.actionLog.autoConfirmed')}</span>}
                        </div>
                      )}
                      {log.action === 'BOOKING_CANCELLED' && (
                        <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>
                          {log.details?.cancelledByRole && <span>{t('consultations.actionLog.cancelledBy', { role: log.details.cancelledByRole })} </span>}
                          {log.details?.reason && <span>{t('consultations.actionLog.reason', { reason: log.details.reason })}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" className="btn-small" style={{ padding: '8px 20px' }} onClick={() => setActionLogBookingId(null)}>{t('consultations.actionLog.close')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Cancel Booking Modal ──────────────────────────── */}
      {cancelModal.show && (() => {
        const cancelBooking = bookings.find(b => b.id === cancelModal.bookingId)
        const refundEstimate = cancelBooking ? estimateRefund(cancelBooking.scheduledDate, cancelBooking.timeSlotStart, 500) : null
        const reasonPresets = isVet
          ? (t('consultations.cancelModal.reasonPresetsVet', { returnObjects: true }) as string[])
          : (t('consultations.cancelModal.reasonPresetsPatient', { returnObjects: true }) as string[])
        return (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999
        }} onClick={() => { setCancelModal({ show: false, bookingId: '', reason: '' }); setCancelError('') }}>
          <div style={{
            background: 'white', borderRadius: 12, padding: 24, width: '90%', maxWidth: 480,
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>{t('consultations.cancelModal.title')}</h2>
              <button type="button" onClick={() => { setCancelModal({ show: false, bookingId: '', reason: '' }); setCancelError('') }}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280' }}>✕</button>
            </div>
            <div style={{ background: '#fef2f2', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: '#991b1b' }}>
              {t('consultations.cancelModal.warning')}
            </div>

            {/* Refund Policy Preview (for patients) */}
            {isPetOwner && refundEstimate && (
              <div style={{
                background: refundEstimate.percent === 100 ? '#d1fae5' : refundEstimate.percent > 0 ? '#fef3c7' : '#fee2e2',
                border: `1px solid ${refundEstimate.percent === 100 ? '#6ee7b7' : refundEstimate.percent > 0 ? '#fcd34d' : '#fca5a5'}`,
                borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13
              }}>
                <strong>{refundEstimate.percent === 100 ? '✅' : refundEstimate.percent > 0 ? '⚠️' : '❌'} {t('consultations.cancelModal.refundPolicy')}:</strong>
                <div style={{ marginTop: 4 }}>{refundEstimate.reason}</div>
              </div>
            )}

            {/* Quick reason presets */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>{t('consultations.cancelModal.quickReasons')}</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {reasonPresets.map(r => (
                  <button key={r}
                    type="button"
                    className={`btn btn-sm ${cancelModal.reason === r ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setCancelModal({ ...cancelModal, reason: r })}
                    style={{ fontSize: 12 }}
                  >{r}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>{t('consultations.cancelModal.reasonLabel')}</label>
              <textarea
                placeholder={t('consultations.cancelModal.reasonPlaceholder')}
                value={cancelModal.reason}
                onChange={(e) => setCancelModal({ ...cancelModal, reason: e.target.value })}
                style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, minHeight: 80, resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>
            {cancelError && (
              <div style={{ padding: '10px 14px', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, fontWeight: 500, marginBottom: 12 }}>
                ⚠ {cancelError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => { setCancelModal({ show: false, bookingId: '', reason: '' }); setCancelError('') }}
                style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #d1d5db', background: 'white', color: '#374151', cursor: 'pointer', fontWeight: 500 }}
              >{t('consultations.cancelModal.keepBooking')}</button>
              <button
                onClick={() => handleCancelBooking()}
                disabled={!cancelModal.reason.trim()}
                style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: cancelModal.reason.trim() ? '#dc2626' : '#e5e7eb', color: cancelModal.reason.trim() ? 'white' : '#9ca3af', cursor: cancelModal.reason.trim() ? 'pointer' : 'not-allowed', fontWeight: 600 }}
              >{t('consultations.cancelModal.confirmCancel')}</button>
            </div>
          </div>
        </div>
        )
      })()}
    </div>
  )
}

export default Consultations

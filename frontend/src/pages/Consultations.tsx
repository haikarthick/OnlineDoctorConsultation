import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import apiService from '../services/api'
import './ModulePage.css'
import { useTranslation } from 'react-i18next'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import { BookingRow, ConsultRow, TimeSlot } from '../components/consultations/consultationsShared'
import TabsAndFilters from '../components/consultations/TabsAndFilters'
import BookingCard from '../components/consultations/BookingCard'
import HistoryCard from '../components/consultations/HistoryCard'
import RescheduleModal from '../components/consultations/RescheduleModal'
import ActionLogModal from '../components/consultations/ActionLogModal'
import CancelBookingModal from '../components/consultations/CancelBookingModal'
import NoShowModal from '../components/consultations/NoShowModal'

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
  // 'rescheduled' goes to history - the old booking is superseded, the new one appears separately
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
  const [noShowModal, setNoShowModal] = useState<BookingRow | null>(null)
  const [noShowError, setNoShowError] = useState('')
  const [noShowSaving, setNoShowSaving] = useState(false)

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

  const handleConfirmBooking = async (id: string) => {
    setActionLoading(id)
    try { await apiService.confirmBooking(id); loadData() }
    catch (err: any) { setError(err?.response?.data?.error?.message || t('consultations.failedToConfirm')) }
    finally { setActionLoading(null) }
  }

  // Marking a no-show moves money (PaymentOrchestrator.settleMissedBooking
  // compensates the doctor on paid bookings) and caps the patient's remaining
  // reschedules, so it asks for confirmation rather than firing on one click.
  const handleMarkNoShow = async () => {
    const b = noShowModal
    if (!b) return
    setNoShowSaving(true)
    setNoShowError('')
    try {
      await apiService.markBookingNoShow(b.id)
      setNoShowModal(null)
      loadData()
    } catch (err: any) {
      setNoShowError(
        err?.response?.data?.error?.message ||
        err?.response?.data?.error ||
        err?.message ||
        t('consultations.failedToMarkNoShow')
      )
    } finally { setNoShowSaving(false) }
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
      if (data.holiday) setRescheduleDateMsg(`🎉 Holiday: ${data.holiday}`)
      else if (data.unavailableReason) setRescheduleDateMsg(`🚫 ${data.unavailableReason}`)
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
        description = `Consultation: ${description} - scheduled appointment`
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

  const handleNavigateToConsultation = (consultationId: string) => {
    if (isVet) navigate(`/doctor/consultation-room/${consultationId}`)
    else navigate(`/video-consultation/${consultationId}`)
  }

  const handleNavigateToReview = (consultationId: string, veterinarianId?: string) => {
    navigate(`/write-review?consultationId=${consultationId}&veterinarianId=${veterinarianId}`)
  }

  if (loading) return (
    <div className="module-page">
      <div className="si-9fa8d292">
        <div className="loading-spinner" />
        <p className="si-d9bcb803">{t('consultations.loading')}</p>
      </div>
    </div>
  )

  const cancelBooking = cancelModal.show ? bookings.find(b => b.id === cancelModal.bookingId) : undefined
  const refundEstimate = cancelBooking ? estimateRefund(cancelBooking.scheduledDate, cancelBooking.timeSlotStart, 500) : null

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <h1>{t('consultations.pageTitle')}</h1>
          <p className="si-48d05eba">
            {isAdmin ? t('consultations.subtitles.admin') : isVet ? t('consultations.subtitles.vet') : t('consultations.subtitles.petOwner')}
          </p>
        </div>
        {isPetOwner && (
          <button className="btn-primary" onClick={() => navigate('/book-consultation')}>{t('consultations.bookConsultation')}</button>
        )}
      </div>

      {error && (
        <div className="si-131754ed">
          ⚠️ {error}
          <button className="si-f8c15521" onClick={() => setError('')}>{t('consultations.dismiss')}</button>
        </div>
      )}

      <TabsAndFilters
        t={t}
        activeTab={activeTab}
        onTabSwitch={handleTabSwitch}
        activeCount={activeBookings.length}
        historyCount={historyBookings.length}
        currentFilterStatuses={currentFilterStatuses}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onRefresh={loadData}
      />

      {/* Appointments Tab - items needing attention or upcoming */}
      {activeTab === 'bookings' && (
        <div className="module-content">
          {filteredActive.length === 0 ? (
            <div className="si-b409cd9b">
              <div className="si-fc4388e2">📅</div>
              <p className="si-37a5ef01">{statusFilter ? t('consultations.noMatchAppointments') : t('consultations.emptyAppointments')}</p>
              <p className="si-ee604956">{t('consultations.appointmentHint')}</p>
              {isPetOwner && !statusFilter && <button className="btn-primary si-f48bb60f" onClick={() => navigate('/book-consultation')}>{t('consultations.bookButton')}</button>}
            </div>
          ) : (
            <div className="appt-card-grid">
              {filteredActive.map(b => (
                <BookingCard
                  key={b.id}
                  b={b}
                  t={t}
                  isVet={isVet}
                  isPetOwner={isPetOwner}
                  isAdmin={isAdmin}
                  fmt={fmt}
                  formatSlotTime={formatSlotTime}
                  isJoinable={isJoinable}
                  joinWindowMinutes={appSettings.joinWindowMinutes}
                  maxReschedules={maxReschedules}
                  patientNoShowRescheduleLimit={patientNoShowRescheduleLimit}
                  actionLoading={actionLoading}
                  onConfirm={handleConfirmBooking}
                  onStartConsultation={handleStartConsultation}
                  onOpenReschedule={openRescheduleModal}
                  onCancel={handleCancelBooking}
                  onMarkNoShow={(booking) => { setNoShowModal(booking); setNoShowError('') }}
                  onOpenActionLog={openActionLog}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Consultation History Tab - completed/cancelled, reference only */}
      {activeTab === 'consultations' && (
        <div className="module-content">
          {filteredHistory.length === 0 ? (
            <div className="si-b409cd9b">
              <div className="si-fc4388e2">🩺</div>
              <p className="si-37a5ef01">{statusFilter ? t('consultations.noMatchFilter') : t('consultations.noHistory')}</p>
              <p className="si-0a803082">{t('consultations.historyHint')}</p>
            </div>
          ) : (
            <div className="appt-card-grid">
              {filteredHistory.map(b => {
                const diagnosis = b.consultationId ? diagnosisMap.get(b.consultationId) : ''
                const networkInfo = b.consultationId ? networkMap.get(b.consultationId) : undefined
                return (
                  <HistoryCard
                    key={b.id}
                    b={b}
                    t={t}
                    isVet={isVet}
                    isPetOwner={isPetOwner}
                    isAdmin={isAdmin}
                    fmt={fmt}
                    formatSlotTime={formatSlotTime}
                    formatDate={formatDate}
                    diagnosis={diagnosis}
                    networkInfo={networkInfo}
                    currentUserId={user?.id}
                    onNavigateToConsultation={handleNavigateToConsultation}
                    onNavigateToReview={handleNavigateToReview}
                    onOpenActionLog={openActionLog}
                  />
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── Reschedule Modal ──────────────────────────────── */}
      {rescheduleBooking && (
        <RescheduleModal
          t={t}
          rescheduleBooking={rescheduleBooking}
          rescheduleDate={rescheduleDate}
          rescheduleSlots={rescheduleSlots}
          rescheduleSelectedSlot={rescheduleSelectedSlot}
          rescheduleDateMsg={rescheduleDateMsg}
          rescheduleSlotsLoading={rescheduleSlotsLoading}
          rescheduleSubmitting={rescheduleSubmitting}
          rescheduleError={rescheduleError}
          rescheduleVetId={rescheduleVetId}
          vetList={vetList}
          vetListLoading={vetListLoading}
          isPetOwner={isPetOwner}
          maxReschedules={maxReschedules}
          patientNoShowRescheduleLimit={patientNoShowRescheduleLimit}
          fmt={fmt}
          formatSlotTime={formatSlotTime}
          onClose={() => { setRescheduleBooking(null); setRescheduleError('') }}
          onVetChange={handleVetChange}
          onDateChange={(date) => loadRescheduleSlots(date)}
          onSelectSlot={setRescheduleSelectedSlot}
          onSubmit={handleRescheduleSubmit}
        />
      )}

      {/* Action Log Modal */}
      {actionLogBookingId && (
        <ActionLogModal
          t={t}
          actionLogs={actionLogs}
          actionLogsLoading={actionLogsLoading}
          formatSlotTime={formatSlotTime}
          actionLabel={actionLabel}
          onClose={() => setActionLogBookingId(null)}
        />
      )}

      {/* ─── Cancel Booking Modal ──────────────────────────── */}
      {cancelModal.show && (
        <CancelBookingModal
          t={t}
          reason={cancelModal.reason}
          cancelError={cancelError}
          isVet={isVet}
          isPetOwner={isPetOwner}
          refundEstimate={refundEstimate}
          onClose={() => { setCancelModal({ show: false, bookingId: '', reason: '' }); setCancelError('') }}
          onReasonChange={(reason) => setCancelModal({ ...cancelModal, reason })}
          onConfirm={() => handleCancelBooking()}
        />
      )}

      {/* No-show confirmation. Deliberately a dialog and not a one-click action:
          confirming settles the booking as missed, triggers doctor compensation
          on paid bookings, and counts against the patient's reschedule limit. */}
      {noShowModal && (
        <NoShowModal
          t={t}
          noShowModal={noShowModal}
          noShowError={noShowError}
          noShowSaving={noShowSaving}
          formatDate={formatDate}
          formatSlotTime={formatSlotTime}
          onClose={() => { setNoShowModal(null); setNoShowError('') }}
          onConfirm={handleMarkNoShow}
        />
      )}
    </div>
  )
}

export default Consultations

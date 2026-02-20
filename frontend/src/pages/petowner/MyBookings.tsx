import React, { useState, useEffect } from 'react'
import { useSettings } from '../../context/SettingsContext'
import apiService from '../../services/api'
import { Booking } from '../../types'
import '../../styles/modules.css'

interface TimeSlot { startTime: string; endTime: string; isAvailable: boolean }

interface MyBookingsProps {
  onNavigate: (path: string) => void
}

const MyBookings: React.FC<MyBookingsProps> = ({ onNavigate }) => {
  const { formatDate, isJoinable, settings: appSettings } = useSettings()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>('all')
  const [cancelModal, setCancelModal] = useState<{ show: boolean; bookingId: string; reason: string }>({
    show: false, bookingId: '', reason: ''
  })
  const [cancelError, setCancelError] = useState('')

  // Reschedule state
  const [rescheduleTarget, setRescheduleTarget] = useState<Booking | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleSlots, setRescheduleSlots] = useState<TimeSlot[]>([])
  const [rescheduleSelectedSlot, setRescheduleSelectedSlot] = useState<TimeSlot | null>(null)
  const [rescheduleSlotsLoading, setRescheduleSlotsLoading] = useState(false)
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false)

  // Action Log state
  const [actionLogBookingId, setActionLogBookingId] = useState<string | null>(null)
  const [actionLogs, setActionLogs] = useState<any[]>([])
  const [actionLogsLoading, setActionLogsLoading] = useState(false)

  const actionLabel = (action: string): string => {
    const map: Record<string, string> = {
      BOOKING_CREATED: '📅 Booking Created',
      BOOKING_CONFIRMED: '✅ Confirmed by Doctor',
      BOOKING_CANCELLED: '❌ Booking Cancelled',
      BOOKING_RESCHEDULED: '🔄 Rescheduled',
    }
    return map[action] || action
  }

  const openActionLog = async (bookingId: string) => {
    setActionLogBookingId(bookingId)
    setActionLogsLoading(true)
    try {
      const res = await apiService.getBookingActionLogs(bookingId)
      setActionLogs(res.data || [])
    } catch { setActionLogs([]) }
    finally { setActionLogsLoading(false) }
  }

  useEffect(() => {
    loadBookings()
  }, [activeTab])

  const loadBookings = async () => {
    try {
      setLoading(true)
      const params: any = { limit: 50 }
      if (activeTab !== 'all') params.status = activeTab
      const result = await apiService.listBookings(params)
      setBookings(result.data?.items || (Array.isArray(result.data) ? result.data : []))
    } catch (err) {
} finally {
      setLoading(false)
    }
  }

  const handleCancelBooking = async () => {
    try {
      setCancelError('')
      await apiService.cancelBooking(cancelModal.bookingId, cancelModal.reason || 'Cancelled by user')
      setCancelModal({ show: false, bookingId: '', reason: '' })
      loadBookings()
    } catch (err: any) {
setCancelError(err?.response?.data?.error?.message || err?.message || 'Failed to cancel booking')
    }
  }

  // ── Reschedule helpers ──
  const openRescheduleModal = (b: Booking) => {
    setRescheduleTarget(b)
    setRescheduleDate('')
    setRescheduleSlots([])
    setRescheduleSelectedSlot(null)
  }

  const loadRescheduleSlots = async (date: string) => {
    if (!rescheduleTarget?.veterinarianId) return
    setRescheduleDate(date)
    setRescheduleSelectedSlot(null)
    try {
      setRescheduleSlotsLoading(true)
      const result = await apiService.getVetAvailability(rescheduleTarget.veterinarianId, date)
      setRescheduleSlots(result.data?.slots || [])
    } catch { setRescheduleSlots([]) }
    finally { setRescheduleSlotsLoading(false) }
  }

  const handleRescheduleSubmit = async () => {
    if (!rescheduleTarget || !rescheduleDate || !rescheduleSelectedSlot) return
    try {
      setRescheduleSubmitting(true)
      await apiService.rescheduleBooking(rescheduleTarget.id, {
        scheduledDate: rescheduleDate,
        timeSlotStart: rescheduleSelectedSlot.startTime,
        timeSlotEnd: rescheduleSelectedSlot.endTime
      })
      setRescheduleTarget(null)
      loadBookings()
    } catch (err: any) {
      setCancelError(err?.response?.data?.error?.message || 'Failed to reschedule')
    } finally { setRescheduleSubmitting(false) }
  }

  const getStatusBadge = (status: string) => (
    <span className={`badge badge-${status}`}>{status.replace('_', ' ')}</span>
  )

  const getBookingTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      video_call: '📹',
      phone: '📞',
      in_person: '🏥',
      chat: '💬'
    }
    return icons[type] || '📋'
  }

  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <h1>My Bookings</h1>
          <p className="page-subtitle">Manage your consultation appointments</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => onNavigate('/book-consultation')}>
            + New Booking
          </button>
        </div>
      </div>

      <div className="tabs">
        {['all', 'pending', 'confirmed', 'missed', 'rescheduled', 'completed', 'cancelled'].map(tab => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Loading bookings...</p>
        </div>
      ) : bookings.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📅</div>
          <h3>No bookings found</h3>
          <p>You haven't made any bookings yet</p>
          <button className="btn btn-primary" onClick={() => onNavigate('/book-consultation')}>
            Book Your First Consultation
          </button>
        </div>
      ) : (
        <div className="booking-cards">
          {bookings.map(booking => (
            <div key={booking.id} className={`booking-card priority-${booking.priority}`}>
              <div className="booking-card-header">
                <div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#1f2937' }}>
                    {getBookingTypeIcon(booking.bookingType)} {(booking.bookingType || '').replace('_', ' ')}
                  </span>
                </div>
                {getStatusBadge(booking.status)}
              </div>

              <div className="booking-card-details">
                <div className="detail-row">
                  <span className="detail-icon">📅</span>
                  <span>{formatDate(booking.scheduledDate)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-icon">🕐</span>
                  <span>{booking.timeSlotStart} - {booking.timeSlotEnd}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-icon">📋</span>
                  <span>{booking.reasonForVisit}</span>
                </div>
                {booking.notes && (
                  <div className="detail-row">
                    <span className="detail-icon">📝</span>
                    <span style={{ color: '#9ca3af', fontSize: 13 }}>{booking.notes}</span>
                  </div>
                )}
              </div>

              <div className="booking-card-actions">
                {booking.status === 'confirmed' && booking.bookingType === 'video_call' && (
                  isJoinable(booking.scheduledDate, booking.timeSlotStart, booking.timeSlotEnd) ? (
                  <button
                    className="btn btn-success btn-sm"
                    onClick={async () => {
                      // If booking already linked to a consultation, navigate directly
                      if (booking.consultationId) {
                        onNavigate(`/video-consultation/${booking.consultationId}`)
                        return
                      }
                      // Otherwise create a new consultation for this booking
                      try {
                        const reason = booking.reasonForVisit || 'General consultation'
                        let description = booking.symptoms || reason
                        if (description.length < 10) description = `Consultation: ${description} — scheduled appointment`
                        const res = await apiService.createConsultation({
                          veterinarianId: booking.veterinarianId,
                          animalType: reason.length >= 2 ? reason : 'General',
                          symptomDescription: description,
                          animalId: (booking as any).animalId || undefined,
                          bookingId: booking.id,
                          petOwnerId: undefined
                        })
                        if (res.data?.id) {
                          onNavigate(`/video-consultation/${res.data.id}`)
                        }
                      } catch (err: any) {
}
                    }}
                  >
                    📹 Join Video Call
                  </button>
                  ) : (
                  <button
                    className="btn btn-sm"
                    style={{ background: '#e5e7eb', color: '#9ca3af', border: 'none', cursor: 'not-allowed' }}
                    disabled
                    title={`Available ${appSettings.joinWindowMinutes} min before scheduled time`}
                  >
                    🔒 Not Yet
                  </button>
                  )
                )}
                {booking.status === 'missed' && (
                  <button
                    className="btn btn-warning btn-sm"
                    style={{ background: '#f59e0b', color: 'white', border: 'none' }}
                    onClick={() => openRescheduleModal(booking)}
                  >
                    🔄 Reschedule
                  </button>
                )}
                {(booking.status === 'pending' || booking.status === 'confirmed') && (
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => setCancelModal({ show: true, bookingId: booking.id, reason: '' })}
                  >
                    Cancel
                  </button>
                )}
                {booking.status === 'completed' && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => onNavigate(`/write-review/${booking.id}`)}
                  >
                    ⭐ Write Review
                  </button>
                )}
                <button
                  className="btn btn-sm"
                  style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db' }}
                  onClick={() => openActionLog(booking.id)}
                  title="View Action History"
                >
                  📋 History
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cancel Modal */}
      {cancelModal.show && (
        <div className="modal-overlay" onClick={() => setCancelModal({ show: false, bookingId: '', reason: '' })}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Cancel Booking</h2>
              <button className="modal-close" onClick={() => setCancelModal({ show: false, bookingId: '', reason: '' })}>✕</button>
            </div>
            <div className="modal-body">
              {cancelError && (
                <div style={{ padding: '10px 14px', background: '#fef2f2', color: '#dc2626', borderRadius: 8, marginBottom: 12, fontSize: 14 }}>
                  {cancelError}
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Reason for cancellation</label>
                <textarea
                  className="form-textarea"
                  placeholder="Please provide a reason..."
                  value={cancelModal.reason}
                  onChange={(e) => setCancelModal({ ...cancelModal, reason: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setCancelModal({ show: false, bookingId: '', reason: '' })}>
                Keep Booking
              </button>
              <button className="btn btn-danger" onClick={handleCancelBooking}>
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleTarget && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000
        }} onClick={() => setRescheduleTarget(null)}>
          <div style={{
            background: 'white', borderRadius: 12, padding: 24, width: '90%',
            maxWidth: 480, maxHeight: '80vh', overflowY: 'auto'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>Reschedule Appointment</h2>
              <button onClick={() => setRescheduleTarget(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ padding: '10px 14px', background: '#fef3c7', color: '#92400e', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
              ⚠️ Your appointment on <strong>{rescheduleTarget.scheduledDate}</strong> at{' '}
              <strong>{rescheduleTarget.timeSlotStart}–{rescheduleTarget.timeSlotEnd}</strong> was missed. Please select a new slot.
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Select New Date</label>
              <input
                type="date"
                className="form-input"
                value={rescheduleDate}
                min={(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })()}
                onChange={e => {
                  setRescheduleDate(e.target.value);
                  if (e.target.value) loadRescheduleSlots(e.target.value);
                }}
              />
            </div>

            {rescheduleSlotsLoading && <p>Loading available slots...</p>}

            {!rescheduleSlotsLoading && rescheduleSlots.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <label className="form-label">Available Slots</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {rescheduleSlots.filter(s => s.isAvailable).map(slot => (
                    <button
                      key={slot.startTime}
                      onClick={() => setRescheduleSelectedSlot(slot)}
                      style={{
                        padding: '8px 4px', borderRadius: 8, border: '2px solid',
                        borderColor: rescheduleSelectedSlot?.startTime === slot.startTime ? '#2563eb' : '#e5e7eb',
                        background: rescheduleSelectedSlot?.startTime === slot.startTime ? '#eff6ff' : 'white',
                        cursor: 'pointer', fontSize: 13
                      }}
                    >
                      {slot.startTime}–{slot.endTime}
                    </button>
                  ))}
                </div>
                {rescheduleSlots.filter(s => s.isAvailable).length === 0 && (
                  <p style={{ color: '#6b7280', fontSize: 14 }}>No available slots on this date.</p>
                )}
              </div>
            )}

            {!rescheduleSlotsLoading && rescheduleDate && rescheduleSlots.length === 0 && (
              <p style={{ color: '#6b7280', fontSize: 14 }}>No slots found for this date.</p>
            )}

            {rescheduleSelectedSlot && (
              <div style={{ padding: '10px 14px', background: '#dbeafe', color: '#1e40af', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
                ℹ️ Your rescheduled appointment will need <strong>doctor approval</strong> before you can join.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button className="btn btn-outline" onClick={() => setRescheduleTarget(null)}>Cancel</button>
              <button
                className="btn btn-primary"
                disabled={!rescheduleSelectedSlot || rescheduleSubmitting}
                onClick={handleRescheduleSubmit}
              >
                {rescheduleSubmitting ? 'Rescheduling...' : 'Confirm Reschedule'}
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
              <h2 style={{ margin: 0, fontSize: 18 }}>📋 Action Log</h2>
              <button onClick={() => setActionLogBookingId(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            {actionLogsLoading && <p style={{ color: '#6b7280' }}>Loading action history...</p>}

            {!actionLogsLoading && actionLogs.length === 0 && (
              <p style={{ color: '#9ca3af', textAlign: 'center', padding: 20 }}>No action history found for this booking.</p>
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
                        by <strong>{log.userName || 'System'}</strong>
                        {log.details?.role && <span> ({log.details.role})</span>}
                        {' · '}
                        {new Date(log.createdAt).toLocaleString()}
                      </div>
                      {log.action === 'BOOKING_RESCHEDULED' && log.details && (
                        <div style={{ fontSize: 12, color: '#4b5563', marginTop: 4, padding: '4px 8px', background: '#fef3c7', borderRadius: 4 }}>
                          New slot: {log.details.newDate} {log.details.newTimeSlotStart}–{log.details.newTimeSlotEnd}
                          {log.details.newStatus === 'pending' && (
                            actionLogs.some((l, j) => j > idx && l.action === 'BOOKING_CONFIRMED')
                              ? <span style={{ color: '#059669' }}> (approved ✓)</span>
                              : <span style={{ color: '#d97706' }}> (awaiting doctor approval)</span>
                          )}
                          {log.details.newStatus === 'confirmed' && <span style={{ color: '#059669' }}> (auto-confirmed)</span>}
                        </div>
                      )}
                      {log.action === 'BOOKING_CANCELLED' && log.details?.reason && (
                        <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>
                          Reason: {log.details.reason}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-outline" onClick={() => setActionLogBookingId(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MyBookings

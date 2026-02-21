import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import apiService from '../../services/api'
import { Booking } from '../../types'
import '../../styles/modules.css'

interface TimeSlot {
  startTime: string
  endTime: string
  isAvailable: boolean
}

interface PatientQueueProps {
  onNavigate: (path: string) => void
}

const PatientQueue: React.FC<PatientQueueProps> = ({ onNavigate }) => {
  void useAuth() // ensure auth context
  const { formatDate, isJoinable, settings: appSettings } = useSettings()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>('pending')
  const [processing, setProcessing] = useState<string | null>(null)
  const [error, setError] = useState('')

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
  }, [])

  const loadBookings = async () => {
    try {
      setLoading(true)
      const result = await apiService.listBookings()
      setBookings(result.data?.items || (Array.isArray(result.data) ? result.data : []))
    } catch (err) {
} finally {
      setLoading(false)
    }
  }

  const handleConfirm = async (bookingId: string) => {
    try {
      setProcessing(bookingId)
      await apiService.confirmBooking(bookingId)
      loadBookings()
    } catch (err) {
} finally {
      setProcessing(null)
    }
  }

  const handleCancel = async (bookingId: string) => {
    if (!confirm('Cancel this booking?')) return
    try {
      setProcessing(bookingId)
      await apiService.cancelBooking(bookingId, 'Cancelled by doctor')
      loadBookings()
    } catch (err) {
} finally {
      setProcessing(null)
    }
  }

  const handleStartConsultation = async (booking: Booking) => {
    // If the booking already has a consultation linked, go to that
    if (booking.consultationId) {
      onNavigate(`/doctor/consultation-room/${booking.consultationId}`)
      return
    }
    // Otherwise, create a new consultation from this booking
    try {
      setProcessing(booking.id)
      setError('')
      const reason = booking.reasonForVisit || (booking as any).reason || 'General consultation'
      const symptoms = booking.symptoms || ''
      let description = symptoms || reason
      if (description.length < 10) {
        description = `Consultation: ${description} — scheduled appointment`
      }
      const res = await apiService.createConsultation({
        veterinarianId: booking.veterinarianId || '',
        animalType: reason.length >= 2 ? reason : 'General',
        symptomDescription: description,
        animalId: (booking as any).animalId || undefined,
        bookingId: booking.id,
        petOwnerId: booking.petOwnerId || (booking as any).pet_owner_id || undefined
      })
      if (res.data?.id) {
        onNavigate(`/doctor/consultation-room/${res.data.id}`)
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to start consultation')
    } finally {
      setProcessing(null)
    }
  }

  const openRescheduleModal = (b: Booking) => {
    setRescheduleTarget(b)
    setRescheduleDate('')
    setRescheduleSlots([])
    setRescheduleSelectedSlot(null)
  }

  const loadRescheduleSlots = async (date: string) => {
    if (!rescheduleTarget) return
    try {
      setRescheduleSlotsLoading(true)
      const vetId = rescheduleTarget.veterinarianId || (rescheduleTarget as any).veterinarian_id
      const res = await apiService.getVetAvailability(vetId, date)
      const slots = res.data?.slots || res.data?.timeSlots || res.data || []
      setRescheduleSlots(Array.isArray(slots) ? slots : [])
    } catch (err) {
setRescheduleSlots([])
    } finally {
      setRescheduleSlotsLoading(false)
    }
  }

  const handleRescheduleSubmit = async () => {
    if (!rescheduleTarget || !rescheduleSelectedSlot || !rescheduleDate) return
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
      setError(err?.response?.data?.error?.message || 'Failed to reschedule')
    } finally {
      setRescheduleSubmitting(false)
    }
  }

  const tabs = [
    { key: 'pending', label: 'Pending', count: bookings.filter(b => b.status === 'pending').length },
    { key: 'confirmed', label: 'Confirmed', count: bookings.filter(b => b.status === 'confirmed').length },
    { key: 'missed', label: 'Missed', count: bookings.filter(b => b.status === 'missed').length },
    { key: 'rescheduled', label: 'Rescheduled', count: bookings.filter(b => b.status === 'rescheduled').length },
    { key: 'completed', label: 'Completed', count: bookings.filter(b => b.status === 'completed').length },
    { key: 'cancelled', label: 'Cancelled', count: bookings.filter(b => b.status === 'cancelled').length }
  ]

  const filteredBookings = bookings.filter(b => b.status === activeTab)

  const priorityOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 }
  const sortedBookings = [...filteredBookings].sort((a, b) =>
    (priorityOrder[a.priority || 'normal'] || 2) - (priorityOrder[b.priority || 'normal'] || 2)
  )

  if (loading) {
    return (
      <div className="module-page">
        <div className="loading-container"><div className="loading-spinner" /><p>Loading patient queue...</p></div>
      </div>
    )
  }

  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <h1>Patient Queue</h1>
          <p className="page-subtitle">Manage incoming booking requests — confirm bookings, then start consultations</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={loadBookings}>🔄 Refresh</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 24 }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            {tab.count > 0 && <span className="tab-count">{tab.count}</span>}
          </button>
        ))}
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: 16, padding: '12px 16px', background: '#fee2e2', color: '#dc2626', borderRadius: 8 }}>
          {error}
          <button onClick={() => setError('')} style={{ marginLeft: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}>✕</button>
        </div>
      )}

      {/* Bookings List */}
      {sortedBookings.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 48 }}>📋</div>
          <h3>No {activeTab} bookings</h3>
          <p>Check another tab or refresh</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {sortedBookings.map(booking => (
            <div
              key={booking.id}
              className="card"
              style={{
                borderLeft: `4px solid ${
                  booking.priority === 'urgent' ? '#dc2626' :
                  booking.priority === 'high' ? '#f59e0b' :
                  '#10b981'
                }`
              }}
            >
              <div className="card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <h3 style={{ margin: 0 }}>{booking.petOwnerName || 'Pet Owner'}</h3>
                      <span className={`badge badge-${booking.priority === 'urgent' ? 'danger' : booking.priority === 'high' ? 'warning' : 'active'}`}>
                        {booking.priority || 'normal'}
                      </span>
                      <span className="badge badge-pending">
                        {booking.consultationType === 'video' ? '📹 Video' : '💬 Chat'}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 14, color: '#4b5563' }}>
                      <div>📅 <strong>Date:</strong> {formatDate(booking.scheduledDate)}</div>
                      <div>⏰ <strong>Time:</strong> {booking.timeSlotStart} - {booking.timeSlotEnd}</div>
                      {booking.reason && <div style={{ gridColumn: '1/3' }}>📝 <strong>Reason:</strong> {booking.reason}</div>}
                      {booking.symptoms && <div style={{ gridColumn: '1/3' }}>🤒 <strong>Symptoms:</strong> {booking.symptoms}</div>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginLeft: 16 }}>
                    {booking.status === 'pending' && (
                      <>
                        <button
                          className="btn btn-success"
                          disabled={processing === booking.id}
                          onClick={() => handleConfirm(booking.id)}
                        >
                          {processing === booking.id ? '...' : '✓ Confirm'}
                        </button>
                        <button
                          className="btn btn-danger"
                          disabled={processing === booking.id}
                          onClick={() => handleCancel(booking.id)}
                        >
                          ✕ Decline
                        </button>
                      </>
                    )}
                    {booking.status === 'confirmed' && (
                      isJoinable(booking.scheduledDate, booking.timeSlotStart, booking.timeSlotEnd) ? (
                      <button
                        className="btn btn-primary"
                        disabled={processing === booking.id}
                        onClick={() => handleStartConsultation(booking)}
                      >
                        {processing === booking.id ? '⏳ Creating...' : '🩺 Start Consultation'}
                      </button>
                      ) : (
                      <button
                        className="btn btn-outline"
                        disabled
                        style={{ cursor: 'not-allowed', opacity: 0.6 }}
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
              </div>
            </div>
          ))}
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
              ⚠️ The appointment on <strong>{rescheduleTarget.scheduledDate}</strong> at{' '}
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
                        {log.createdAt ? new Date(log.createdAt).toLocaleString() : '–'}
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

export default PatientQueue

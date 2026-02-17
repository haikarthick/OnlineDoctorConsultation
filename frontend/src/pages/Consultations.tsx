import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import apiService from '../services/api'
import './ModulePage.css'

interface BookingRow {
  id: string; petOwnerName?: string; petOwnerId?: string; vetName?: string; scheduledDate: string;
  timeSlotStart: string; timeSlotEnd: string; bookingType?: string;
  reasonForVisit?: string; reason?: string; symptoms?: string;
  priority?: string; status: string; veterinarianId?: string;
  consultationId?: string | null; animalId?: string;
}
interface ConsultRow {
  id: string; animalType?: string; symptomDescription?: string;
  status: string; diagnosis?: string; scheduledAt?: string;
  createdAt?: string; veterinarianId?: string;
}
interface TimeSlot { startTime: string; endTime: string; isAvailable: boolean }

const Consultations: React.FC = () => {
  const { user } = useAuth()
  const { formatDate, isJoinable, settings: appSettings } = useSettings()
  const navigate = useNavigate()
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [consultations, setConsultations] = useState<ConsultRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'bookings' | 'consultations'>('bookings')
  const [statusFilter, setStatusFilter] = useState('')

  // Reschedule modal state
  const [rescheduleBooking, setRescheduleBooking] = useState<BookingRow | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleSlots, setRescheduleSlots] = useState<TimeSlot[]>([])
  const [rescheduleSelectedSlot, setRescheduleSelectedSlot] = useState<TimeSlot | null>(null)
  const [rescheduleSlotsLoading, setRescheduleSlotsLoading] = useState(false)
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false)

  // Cancel modal state
  const [cancelModal, setCancelModal] = useState<{ show: boolean; bookingId: string; reason: string }>({
    show: false, bookingId: '', reason: ''
  })

  // Action Log modal state
  const [actionLogBookingId, setActionLogBookingId] = useState<string | null>(null)
  const [actionLogs, setActionLogs] = useState<any[]>([])
  const [actionLogsLoading, setActionLogsLoading] = useState(false)

  const isVet = user?.role === 'veterinarian'
  const isPetOwner = user?.role === 'pet_owner' || user?.role === 'farmer'
  const isAdmin = user?.role === 'admin'

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

  useEffect(() => { loadData() }, [statusFilter])

  const loadData = async () => {
    try {
      setLoading(true); setError('')
      const params: any = { limit: 50 }
      if (statusFilter) params.status = statusFilter
      const [bRes, cRes] = await Promise.all([
        apiService.listBookings(params),
        apiService.listConsultations({ limit: 50 })
      ])
      setBookings(bRes.data?.items || (Array.isArray(bRes.data) ? bRes.data : []))
      setConsultations(cRes.data?.items || (Array.isArray(cRes.data) ? cRes.data : []))
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Failed to load data')
    } finally { setLoading(false) }
  }

  const handleConfirmBooking = async (id: string) => {
    try { await apiService.confirmBooking(id); loadData() }
    catch (err: any) { setError(err?.response?.data?.error?.message || 'Failed to confirm booking') }
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
      await apiService.cancelBooking(bookingId, cancelModal.reason || 'Cancelled by user')
      setCancelModal({ show: false, bookingId: '', reason: '' })
      loadData()
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to cancel booking')
    }
  }

  // ─── Reschedule helpers ─────────────────────────────────
  const openRescheduleModal = (b: BookingRow) => {
    setRescheduleBooking(b)
    setRescheduleDate('')
    setRescheduleSlots([])
    setRescheduleSelectedSlot(null)
  }

  const loadRescheduleSlots = async (date: string) => {
    if (!rescheduleBooking?.veterinarianId) return
    setRescheduleDate(date)
    setRescheduleSelectedSlot(null)
    try {
      setRescheduleSlotsLoading(true)
      const result = await apiService.getVetAvailability(rescheduleBooking.veterinarianId, date)
      setRescheduleSlots(result.data?.slots || [])
    } catch {
      setRescheduleSlots([])
    } finally {
      setRescheduleSlotsLoading(false)
    }
  }

  const handleRescheduleSubmit = async () => {
    if (!rescheduleBooking || !rescheduleDate || !rescheduleSelectedSlot) return
    try {
      setRescheduleSubmitting(true)
      await apiService.rescheduleBooking(rescheduleBooking.id, {
        scheduledDate: rescheduleDate,
        timeSlotStart: rescheduleSelectedSlot.startTime,
        timeSlotEnd: rescheduleSelectedSlot.endTime
      })
      setRescheduleBooking(null)
      loadData()
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to reschedule booking')
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
        animalType: reason.length >= 2 ? reason : 'General',
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
    } catch (err: any) { setError(err?.response?.data?.error?.message || 'Failed to start consultation') }
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
    return <span style={{ background: s.bg, color: s.fg, padding: '4px 12px', borderRadius: 12, fontSize: 12, fontWeight: 600, textTransform: 'capitalize' as const }}>{status.replace(/_/g, ' ')}</span>
  }

  if (loading) return (
    <div className="module-page">
      <div style={{ textAlign: 'center', padding: 60 }}>
        <div className="loading-spinner" />
        <p style={{ color: '#6b7280', marginTop: 16 }}>Loading consultations...</p>
      </div>
    </div>
  )

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <h1>🏥 Consultations & Appointments</h1>
          <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>
            {isAdmin ? 'All system appointments & consultations' : isVet ? 'Your scheduled appointments & consultations' : 'Your booked appointments & consultation history'}
          </p>
        </div>
        {isPetOwner && (
          <button className="btn-primary" onClick={() => navigate('/book-consultation')}>+ Book Consultation</button>
        )}
      </div>

      {error && (
        <div style={{ padding: '12px 18px', background: '#fef2f2', color: '#dc2626', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
          ⚠️ {error}
          <button style={{ marginLeft: 12, background: 'none', border: '1px solid #dc2626', color: '#dc2626', padding: '4px 10px', borderRadius: 4, cursor: 'pointer' }} onClick={() => setError('')}>Dismiss</button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e5e7eb', marginBottom: 20 }}>
        {[{ key: 'bookings' as const, label: '📅 Appointments', count: bookings.length },
          { key: 'consultations' as const, label: '🩺 Consultation History', count: consultations.length }
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
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
        <span style={{ fontSize: 13, color: '#6b7280' }}>Filter:</span>
        {['', 'pending', 'confirmed', 'missed', 'rescheduled', 'completed', 'cancelled'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            style={{ padding: '5px 14px', borderRadius: 16, fontSize: 12, fontWeight: 500, cursor: 'pointer',
              border: statusFilter === s ? '2px solid #667eea' : '1px solid #d1d5db',
              background: statusFilter === s ? '#eef2ff' : 'white', color: statusFilter === s ? '#667eea' : '#6b7280'
            }}>
            {s || 'All'}
          </button>
        ))}
        <button onClick={loadData} style={{ marginLeft: 'auto', padding: '5px 14px', borderRadius: 6, border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: 12 }}>↻ Refresh</button>
      </div>

      {/* Bookings Tab */}
      {activeTab === 'bookings' && (
        <div className="module-content">
          {bookings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
              <p style={{ fontSize: 16, fontWeight: 500 }}>No appointments found</p>
              {isPetOwner && <button className="btn-primary" style={{ marginTop: 12 }} onClick={() => navigate('/book-consultation')}>Book Your First Consultation</button>}
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    {isVet ? <th>Patient</th> : <th>Doctor</th>}
                    {isAdmin && <><th>Patient</th><th>Doctor</th></>}
                    <th>Date</th><th>Time</th><th>Type</th><th>Reason</th><th>Priority</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map(b => (
                    <tr key={b.id}>
                      {isVet && <td><strong>{b.petOwnerName || 'Patient'}</strong></td>}
                      {isPetOwner && <td><strong>{b.vetName || 'Doctor'}</strong></td>}
                      {isAdmin && <><td>{b.petOwnerName || '—'}</td><td>{b.vetName || '—'}</td></>}
                      <td>{fmt(b.scheduledDate)}</td>
                      <td>{b.timeSlotStart} - {b.timeSlotEnd}</td>
                      <td><span style={{ fontSize: 12 }}>{b.bookingType === 'video_call' ? '📹 Video' : b.bookingType === 'phone' ? '📞 Phone' : b.bookingType === 'in_person' ? '🏥 In-person' : '💬 Chat'}</span></td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.reasonForVisit || b.reason || '—'}</td>
                      <td>
                        <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                          background: b.priority === 'urgent' || b.priority === 'emergency' ? '#fef2f2' : '#f0f0f0',
                          color: b.priority === 'urgent' || b.priority === 'emergency' ? '#dc2626' : '#555'
                        }}>{b.priority || 'normal'}</span>
                      </td>
                      <td>{badge(b.status)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {isVet && b.status === 'pending' && (
                            <button className="btn-small" style={{ background: '#059669', color: 'white', border: 'none' }} onClick={() => handleConfirmBooking(b.id)}>✓ Confirm</button>
                          )}
                          {(isVet || isAdmin) && b.status === 'confirmed' && b.bookingType === 'video_call' && (
                            isJoinable(b.scheduledDate, b.timeSlotStart, b.timeSlotEnd)
                              ? <button className="btn-small" style={{ background: '#667eea', color: 'white', border: 'none' }} onClick={() => handleStartConsultation(b)}>▶ Start</button>
                              : <button className="btn-small" style={{ background: '#e5e7eb', color: '#9ca3af', border: 'none', cursor: 'not-allowed' }} disabled title={`Available ${appSettings.joinWindowMinutes} min before scheduled time`}>🔒 Not Yet</button>
                          )}
                          {isPetOwner && b.status === 'confirmed' && b.bookingType === 'video_call' && (
                            isJoinable(b.scheduledDate, b.timeSlotStart, b.timeSlotEnd)
                              ? <button className="btn-small" style={{ background: '#667eea', color: 'white', border: 'none' }} onClick={() => handleStartConsultation(b)}>📹 Join</button>
                              : <button className="btn-small" style={{ background: '#e5e7eb', color: '#9ca3af', border: 'none', cursor: 'not-allowed' }} disabled title={`Available ${appSettings.joinWindowMinutes} min before scheduled time`}>🔒 Not Yet</button>
                          )}
                          {b.status === 'missed' && (
                            <button className="btn-small" style={{ background: '#f59e0b', color: 'white', border: 'none' }} onClick={() => openRescheduleModal(b)}>🔄 Reschedule</button>
                          )}
                          {b.status === 'completed' && b.consultationId && (
                            <button className="btn-small" style={{ background: '#f0fdf4', color: '#059669', border: '1px solid #059669' }}
                              onClick={() => {
                                if (isVet) navigate(`/doctor/consultation-room/${b.consultationId}`)
                                else navigate(`/video-consultation/${b.consultationId}`)
                              }}>📋 View</button>
                          )}
                          {b.status === 'completed' && isPetOwner && b.consultationId && (
                            <button className="btn-small" onClick={() => navigate(`/write-review?consultationId=${b.consultationId}&veterinarianId=${b.veterinarianId}`)}>⭐ Review</button>
                          )}
                          {(b.status === 'pending' || b.status === 'confirmed') && (
                            <button className="btn-small" style={{ color: '#dc2626', border: '1px solid #dc2626', background: 'white' }} onClick={() => handleCancelBooking(b.id)}>✕ Cancel</button>
                          )}
                          {isAdmin && b.status === 'pending' && (
                            <button className="btn-small" style={{ background: '#059669', color: 'white', border: 'none' }} onClick={() => handleConfirmBooking(b.id)}>✓ Confirm</button>
                          )}
                          <button className="btn-small" style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db' }} onClick={() => openActionLog(b.id)} title="View Action History">📋 History</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Consultations History Tab */}
      {activeTab === 'consultations' && (
        <div className="module-content">
          {consultations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🩺</div>
              <p style={{ fontSize: 16, fontWeight: 500 }}>No consultation history yet</p>
              <p style={{ fontSize: 13 }}>Consultations appear here after appointments are completed</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr><th>Date</th><th>Description</th><th>Status</th><th>Diagnosis</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {consultations.map(c => (
                    <tr key={c.id}>
                      <td>{fmt(c.scheduledAt || c.createdAt || '')}</td>
                      <td>
                        <strong>{c.animalType}</strong><br />
                        <span style={{ fontSize: 12, color: '#6b7280' }}>{c.symptomDescription}</span>
                      </td>
                      <td>{badge(c.status)}</td>
                      <td style={{ maxWidth: 200 }}>{c.diagnosis || '—'}</td>
                      <td>
                        {(c.status === 'scheduled' || c.status === 'in_progress') && isVet && (
                          <button className="btn-small" style={{ background: '#667eea', color: 'white', border: 'none' }}
                            onClick={() => navigate(`/doctor/consultation-room/${c.id}`)}>🩺 Open</button>
                        )}
                        {(c.status === 'scheduled' || c.status === 'in_progress') && isPetOwner && (
                          <button className="btn-small" style={{ background: '#667eea', color: 'white', border: 'none' }}
                            onClick={() => navigate(`/video-consultation/${c.id}`)}>📹 Join</button>
                        )}
                        {c.status === 'completed' && isPetOwner && (
                          <button className="btn-small" onClick={() => navigate(`/write-review?consultationId=${c.id}&veterinarianId=${c.veterinarianId}`)}>⭐ Review</button>
                        )}
                        {c.status === 'completed' && isVet && (
                          <button className="btn-small" style={{ background: '#f0fdf4', color: '#059669', border: '1px solid #059669' }}
                            onClick={() => navigate(`/doctor/consultation-room/${c.id}`)}>📋 View</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── Reschedule Modal ──────────────────────────────── */}
      {rescheduleBooking && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999
        }} onClick={() => setRescheduleBooking(null)}>
          <div style={{
            background: 'white', borderRadius: 16, padding: 32, width: '95%', maxWidth: 520,
            maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0 }}>🔄 Reschedule Appointment</h2>
              <button onClick={() => setRescheduleBooking(null)}
                style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#6b7280' }}>✕</button>
            </div>

            {/* Current booking info */}
            <div style={{ background: '#fef3c7', borderRadius: 8, padding: 14, marginBottom: 20, border: '1px solid #fcd34d' }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#92400e' }}>⚠️ Original Appointment</p>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: '#92400e' }}>
                {rescheduleBooking.vetName || 'Doctor'} — {fmt(rescheduleBooking.scheduledDate)} at {rescheduleBooking.timeSlotStart} - {rescheduleBooking.timeSlotEnd}
              </p>
            </div>

            {/* New date picker */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>Select New Date *</label>
              <input
                type="date"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' }}
                value={rescheduleDate}
                min={(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })()}
                onChange={(e) => loadRescheduleSlots(e.target.value)}
              />
            </div>

            {/* Available slots */}
            {rescheduleDate && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Available Time Slots</label>
                {rescheduleSlotsLoading ? (
                  <div style={{ textAlign: 'center', padding: 20 }}>
                    <div className="loading-spinner" style={{ margin: '0 auto' }} />
                  </div>
                ) : rescheduleSlots.filter(s => s.isAvailable).length === 0 ? (
                  <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: 16 }}>
                    No available slots for this date. Please select another date.
                  </p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {rescheduleSlots.filter(s => s.isAvailable).map((slot, idx) => (
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
                        {slot.startTime} - {slot.endTime}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Doctor approval note for pet owners */}
            {isPetOwner && rescheduleSelectedSlot && (
              <div style={{ padding: '10px 14px', background: '#dbeafe', color: '#1e40af', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
                ℹ️ Your rescheduled appointment will need <strong>doctor approval</strong> before you can join.
              </div>
            )}

            {/* Confirm reschedule */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setRescheduleBooking(null)}
                style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontWeight: 500 }}
              >Cancel</button>
              <button
                onClick={handleRescheduleSubmit}
                disabled={!rescheduleDate || !rescheduleSelectedSlot || rescheduleSubmitting}
                style={{
                  padding: '10px 24px', borderRadius: 8, border: 'none', fontWeight: 600, cursor: 'pointer',
                  background: (!rescheduleDate || !rescheduleSelectedSlot) ? '#e5e7eb' : '#667eea',
                  color: (!rescheduleDate || !rescheduleSelectedSlot) ? '#9ca3af' : 'white'
                }}
              >
                {rescheduleSubmitting ? 'Rescheduling...' : '✓ Confirm Reschedule'}
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
                            // Check if a subsequent confirmation exists in the log
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
              <button className="btn-small" style={{ padding: '8px 20px' }} onClick={() => setActionLogBookingId(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Cancel Booking Modal ──────────────────────────── */}
      {cancelModal.show && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999
        }} onClick={() => setCancelModal({ show: false, bookingId: '', reason: '' })}>
          <div style={{
            background: 'white', borderRadius: 12, padding: 24, width: '90%', maxWidth: 440,
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>❌ Cancel Booking</h2>
              <button onClick={() => setCancelModal({ show: false, bookingId: '', reason: '' })}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280' }}>✕</button>
            </div>
            <div style={{ background: '#fef2f2', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: '#991b1b' }}>
              ⚠️ This action cannot be undone. The appointment will be cancelled.
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>Reason for cancellation</label>
              <textarea
                placeholder="Please provide a reason for cancellation..."
                value={cancelModal.reason}
                onChange={(e) => setCancelModal({ ...cancelModal, reason: e.target.value })}
                style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, minHeight: 80, resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setCancelModal({ show: false, bookingId: '', reason: '' })}
                style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontWeight: 500 }}
              >Keep Booking</button>
              <button
                onClick={() => handleCancelBooking()}
                style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#dc2626', color: 'white', cursor: 'pointer', fontWeight: 600 }}
              >Confirm Cancellation</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Consultations

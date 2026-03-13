import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { vetHospitalApi } from '../services/api/vetHospitalApi'
import apiService from '../services/api'
import type { VetHospital, HospitalDoctor, HospitalDepartment } from '../types'
import './ModulePage.css'
import './VetHospitals.css'
import { useSettings } from '../context/SettingsContext'
import { useTranslation } from 'react-i18next'

interface TimeSlot { startTime: string; endTime: string; isAvailable: boolean }

/** Filter out past time slots for today using browser local time + 15min buffer */
const filterFutureSlots = (slots: TimeSlot[], forDate: string) => {
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return slots.filter(s => {
    if (!s.isAvailable) return false
    if (forDate !== todayStr) return true

    const [h, m] = s.startTime.split(':').map(Number)
    return h * 60 + m > now.getHours() * 60 + now.getMinutes() + 15
  })
}

type Step = 'doctor' | 'datetime' | 'details' | 'confirm'

const BOOKING_TYPES = [
  { value: 'in_person', label: 'In-Person Visit', icon: '🏥', desc: 'Visit the hospital' },
  { value: 'video_call', label: 'Video Call', icon: '📹', desc: 'Online consultation' },
  { value: 'phone', label: 'Phone Call', icon: '📞', desc: 'Phone consultation' },
]

const HospitalBooking: React.FC = () => {
  const { t } = useTranslation()
  const { formatCurrency } = useSettings()
  const { id: hospitalId } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  // Hospital data
  const [hospital, setHospital] = useState<VetHospital | null>(null)
  const [doctors, setDoctors] = useState<HospitalDoctor[]>([])
  const [departments, setDepartments] = useState<HospitalDepartment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Booking wizard state
  const [step, setStep] = useState<Step>('doctor')
  const [selectedDoctor, setSelectedDoctor] = useState<HospitalDoctor | null>(null)
  const [deptFilter, setDeptFilter] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [bookingType, setBookingType] = useState('in_person')
  const [reasonForVisit, setReasonForVisit] = useState('')
  const [symptoms, setSymptoms] = useState('')
  const [notes, setNotes] = useState('')
  const [priority, setPriority] = useState('normal')
  const [animalId, setAnimalId] = useState('')
  const [animals, setAnimals] = useState<any[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [bookingSuccess, setBookingSuccess] = useState(false)

  // Load hospital data
  useEffect(() => {
    if (!hospitalId) return
    const load = async () => {
      setLoading(true)
      try {
        const [h, docs, depts] = await Promise.all([
          vetHospitalApi.getHospital(hospitalId),
          vetHospitalApi.listDoctors(hospitalId),
          vetHospitalApi.listDepartments(hospitalId),
        ])
        setHospital(h)
        setDoctors(docs.filter(d => d.isAcceptingPatients !== false))
        setDepartments(depts)
      } catch { setError('Failed to load hospital information') }
      finally { setLoading(false) }
    }
    load()
  }, [hospitalId])

  // Load user's animals
  useEffect(() => {
    const loadAnimals = async () => {
      try {
        const res = await apiService.listAnimals()
        setAnimals(res?.data?.items || res?.data || [])
      } catch { /* non-blocking */ }
    }
    if (user) loadAnimals()
  }, [user])

  // Load available slots when doctor + date selected
  const loadSlots = useCallback(async (doctorId: string, date: string) => {
    setSlotsLoading(true)
    setSelectedSlot(null)
    try {
      const res = await apiService.getVetAvailability(doctorId, date)
      const allSlots = res?.data?.slots || res?.slots || res?.data || []
      setSlots(allSlots)
    } catch { setSlots([]) }
    finally { setSlotsLoading(false) }
  }, [])

  const handleDateChange = (date: string) => {
    setSelectedDate(date)
    if (selectedDoctor && date) loadSlots(selectedDoctor.doctorId, date)
  }

  const handleDoctorSelect = (doc: HospitalDoctor) => {
    setSelectedDoctor(doc)
    setSelectedDate('')
    setSelectedSlot(null)
    setSlots([])
    setStep('datetime')
  }

  const handleSubmit = async () => {
    if (!selectedDoctor || !selectedDate || !selectedSlot || !reasonForVisit.trim()) return
    // Validate: cannot book in the past
    const slotDateTime = new Date(`${selectedDate}T${selectedSlot.startTime}:00`)
    if (slotDateTime <= new Date()) {
      setError('Cannot book a consultation in the past. Please select a future date and time.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await apiService.createBooking({
        veterinarianId: selectedDoctor.doctorId,
        hospitalId: hospitalId!,
        scheduledDate: selectedDate,
        timeSlotStart: selectedSlot.startTime,
        timeSlotEnd: selectedSlot.endTime,
        bookingType,
        priority,
        reasonForVisit: reasonForVisit.trim(),
        symptoms: symptoms.trim() || undefined,
        notes: notes.trim() || undefined,
        animalId: animalId || undefined,
      })
      setBookingSuccess(true)
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.response?.data?.error?.message || 'Failed to create booking')
    } finally { setSubmitting(false) }
  }

  const filteredDoctors = deptFilter
    ? doctors.filter(d => d.departmentId === deptFilter)
    : doctors

  const today = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()

  const availableSlots = filterFutureSlots(slots, selectedDate)

  if (loading) return <div className="loading-container"><div className="loading-spinner" /></div>
  if (!hospital) return <div className="module-page"><p>Hospital not found</p></div>

  // ── Success State ──
  if (bookingSuccess) {
    return (
      <div className="module-page">
        <div className="hb-success-card">
          <div className="hb-success-icon">✓</div>
          <h2>{t('consultations.pageTitle')}</h2>
          <p>Your appointment at <strong>{hospital.name}</strong> has been submitted successfully.</p>
          <div className="hb-success-details">
            <div><strong>Doctor:</strong> {selectedDoctor?.doctorName}</div>
            <div><strong>Date:</strong> {selectedDate}</div>
            <div><strong>Time:</strong> {selectedSlot?.startTime} – {selectedSlot?.endTime}</div>
            <div><strong>Type:</strong> {BOOKING_TYPES.find(b => b.value === bookingType)?.label}</div>
          </div>
          <p className="hb-success-note">The doctor will review and confirm your appointment. You'll receive a notification once confirmed.</p>
          <div style={{ display: 'flex', gap: '.75rem', justifyContent: 'center', marginTop: '1.5rem' }}>
            <button className="btn-secondary" onClick={() => navigate(`/vet-hospitals/${hospitalId}`)}>Back to Hospital</button>
            <button className="btn-primary" onClick={() => navigate('/my-bookings')}>View My Bookings</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="module-page hb-page">
      {/* Breadcrumb */}
      <div className="hb-breadcrumb">
        <Link to="/vet-hospitals">Hospitals</Link>
        <span> › </span>
        <Link to={`/vet-hospitals/${hospitalId}`}>{hospital.name}</Link>
        <span> › </span>
        <span>Book Appointment</span>
      </div>

      {/* Hospital Mini Header */}
      <div className="hb-hospital-header">
        <div className="hb-hospital-info">
          {hospital.logoUrl
            ? <img src={hospital.logoUrl} alt="" className="hb-hospital-logo" />
            : <div className="hb-hospital-logo">🏥</div>}
          <div>
            <h1>{hospital.name}</h1>
            <div className="hb-hospital-meta">
              {hospital.city && <span>📍 {hospital.city}{hospital.state ? `, ${hospital.state}` : ''}</span>}
              {hospital.isVerified && <span className="badge badge-verified">✓ Verified</span>}
              {hospital.hasEmergency && <span className="badge badge-emergency">⚡ Emergency</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Step Progress */}
      <div className="hb-steps">
        {[
          { key: 'doctor', label: 'Select Doctor', icon: '👨‍⚕️', num: 1 },
          { key: 'datetime', label: 'Date & Time', icon: '📅', num: 2 },
          { key: 'details', label: 'Details', icon: '📋', num: 3 },
          { key: 'confirm', label: 'Confirm', icon: '✓', num: 4 },
        ].map(s => (
          <div
            key={s.key}
            className={`hb-step${step === s.key ? ' active' : ''}${
              ['doctor','datetime','details','confirm'].indexOf(step) > ['doctor','datetime','details','confirm'].indexOf(s.key) ? ' completed' : ''
            }`}
          >
            <div className="hb-step-circle">{
              ['doctor','datetime','details','confirm'].indexOf(step) > ['doctor','datetime','details','confirm'].indexOf(s.key)
                ? '✓' : s.num
            }</div>
            <span className="hb-step-label">{s.label}</span>
          </div>
        ))}
      </div>

      {error && <div className="modal-alert error" style={{ marginBottom: '1rem' }}>⚠ {error}</div>}

      {/* Step 1: Select Doctor */}
      {step === 'doctor' && (
        <div className="hb-step-content">
          <h2>Choose a Doctor</h2>
          {departments.length > 0 && (
            <div className="hb-dept-filter">
              <select className="vh-select" value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
                <option value="">All Departments</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          )}
          {filteredDoctors.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">👨‍⚕️</div>
              <p>No doctors currently accepting patients{deptFilter ? ' in this department' : ''}</p>
            </div>
          ) : (
            <div className="hb-doctor-grid">
              {filteredDoctors.map(doc => (
                <div
                  key={doc.id}
                  className={`hb-doctor-card${selectedDoctor?.id === doc.id ? ' selected' : ''}`}
                  onClick={() => handleDoctorSelect(doc)}
                >
                  <div className="hb-doc-avatar">
                    {doc.profileImage
                      ? <img src={doc.profileImage} alt="" />
                      : <span>👨‍⚕️</span>}
                  </div>
                  <div className="hb-doc-info">
                    <div className="hb-doc-name">{doc.doctorName || 'Doctor'}</div>
                    <div className="hb-doc-role">{doc.hospitalRole?.replace(/_/g, ' ')}</div>
                    {doc.departmentName && <div className="hb-doc-dept">📂 {doc.departmentName}</div>}
                    {doc.specializations && doc.specializations.length > 0 && (
                      <div className="hb-doc-specs">
                        {doc.specializations.slice(0, 3).map(s => <span key={s} className="chip">{s}</span>)}
                      </div>
                    )}
                    {doc.consultationFee && (
                      <div className="hb-doc-fee">{formatCurrency(doc.consultationFee)}</div>
                    )}
                    {doc.vetProfileRating && doc.vetProfileRating > 0 && (
                      <div className="hb-doc-rating">★ {doc.vetProfileRating.toFixed(1)}</div>
                    )}
                  </div>
                  <div className="hb-doc-select-indicator">→</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Date & Time */}
      {step === 'datetime' && selectedDoctor && (
        <div className="hb-step-content">
          <button className="hb-back-btn" onClick={() => setStep('doctor')}>← Back to Doctors</button>
          <h2>Select Date & Time</h2>
          <div className="hb-selected-doctor-banner">
            <span>👨‍⚕️</span>
            <div>
              <strong>{selectedDoctor.doctorName}</strong>
              {selectedDoctor.departmentName && <span> · {selectedDoctor.departmentName}</span>}
              {selectedDoctor.consultationFee && <span> · {formatCurrency(selectedDoctor.consultationFee)}</span>}
            </div>
            <button className="hb-change-btn" onClick={() => setStep('doctor')}>Change</button>
          </div>

          <div className="hb-datetime-grid">
            <div className="hb-date-section">
              <label className="form-label">Select Date</label>
              <input
                type="date"
                className="form-input"
                value={selectedDate}
                min={today}
                onChange={e => handleDateChange(e.target.value)}
              />
            </div>

            <div className="hb-slots-section">
              <label className="form-label">Available Time Slots</label>
              {!selectedDate && <p className="hb-hint">Please select a date first</p>}
              {slotsLoading && <p className="hb-hint">Loading available slots...</p>}
              {selectedDate && !slotsLoading && availableSlots.length === 0 && (
                <p className="hb-hint">No available slots on this date. Try another day.</p>
              )}
              {availableSlots.length > 0 && (
                <div className="hb-slot-grid">
                  {availableSlots.map(slot => (
                    <button
                      key={slot.startTime}
                      className={`hb-slot${selectedSlot?.startTime === slot.startTime ? ' selected' : ''}`}
                      onClick={() => setSelectedSlot(slot)}
                    >
                      {slot.startTime} – {slot.endTime}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="hb-step-actions">
            <button
              className="btn-primary"
              disabled={!selectedDate || !selectedSlot}
              onClick={() => setStep('details')}
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Appointment Details */}
      {step === 'details' && (
        <div className="hb-step-content">
          <button className="hb-back-btn" onClick={() => setStep('datetime')}>← Back to Schedule</button>
          <h2>Appointment Details</h2>

          <div className="hb-form">
            <div className="hb-form-group">
              <label className="form-label">Appointment Type *</label>
              <div className="hb-type-grid">
                {BOOKING_TYPES.map(bt => (
                  <div
                    key={bt.value}
                    className={`hb-type-card${bookingType === bt.value ? ' selected' : ''}`}
                    onClick={() => setBookingType(bt.value)}
                  >
                    <span className="hb-type-icon">{bt.icon}</span>
                    <span className="hb-type-label">{bt.label}</span>
                    <span className="hb-type-desc">{bt.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {animals.length > 0 && (
              <div className="hb-form-group">
                <label className="form-label">Select Pet/Animal (optional)</label>
                <select className="form-input" value={animalId} onChange={e => setAnimalId(e.target.value)}>
                  <option value="">— Select —</option>
                  {animals.map((a: any) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.species}{a.breed ? ` — ${a.breed}` : ''})</option>
                  ))}
                </select>
              </div>
            )}

            <div className="hb-form-group">
              <label className="form-label">Reason for Visit *</label>
              <textarea
                className="form-input"
                rows={3}
                placeholder="Describe why you're visiting (e.g., annual checkup, vaccination, illness symptoms...)"
                value={reasonForVisit}
                onChange={e => setReasonForVisit(e.target.value)}
              />
            </div>

            <div className="hb-form-group">
              <label className="form-label">Symptoms (optional)</label>
              <textarea
                className="form-input"
                rows={2}
                placeholder="Any symptoms you've noticed..."
                value={symptoms}
                onChange={e => setSymptoms(e.target.value)}
              />
            </div>

            <div className="hb-form-row">
              <div className="hb-form-group">
                <label className="form-label">Priority</label>
                <select className="form-input" value={priority} onChange={e => setPriority(e.target.value)}>
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                  <option value="emergency">Emergency</option>
                </select>
              </div>
              <div className="hb-form-group">
                <label className="form-label">Additional Notes</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Special requirements..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="hb-step-actions">
            <button
              className="btn-primary"
              disabled={!reasonForVisit.trim()}
              onClick={() => setStep('confirm')}
            >
              Review Booking →
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Confirm */}
      {step === 'confirm' && (
        <div className="hb-step-content">
          <button className="hb-back-btn" onClick={() => setStep('details')}>← Back to Details</button>
          <h2>Confirm Your Appointment</h2>

          <div className="hb-confirm-card">
            <div className="hb-confirm-section">
              <h3>🏥 Hospital</h3>
              <p>{hospital.name}</p>
              {hospital.address && <p className="hb-confirm-sub">{hospital.address}{hospital.city ? `, ${hospital.city}` : ''}</p>}
            </div>

            <div className="hb-confirm-section">
              <h3>👨‍⚕️ Doctor</h3>
              <p>{selectedDoctor?.doctorName}</p>
              {selectedDoctor?.departmentName && <p className="hb-confirm-sub">{selectedDoctor.departmentName}</p>}
              {selectedDoctor?.consultationFee && <p className="hb-confirm-fee">Fee: {formatCurrency(selectedDoctor.consultationFee)}</p>}
            </div>

            <div className="hb-confirm-section">
              <h3>📅 Schedule</h3>
              <p>{selectedDate} · {selectedSlot?.startTime} – {selectedSlot?.endTime}</p>
              <p className="hb-confirm-sub">{BOOKING_TYPES.find(b => b.value === bookingType)?.label}</p>
            </div>

            <div className="hb-confirm-section">
              <h3>📋 Details</h3>
              <p><strong>Reason:</strong> {reasonForVisit}</p>
              {symptoms && <p><strong>Symptoms:</strong> {symptoms}</p>}
              {animalId && <p><strong>Pet:</strong> {animals.find(a => a.id === animalId)?.name}</p>}
              {priority !== 'normal' && <p><strong>Priority:</strong> <span className={`badge badge-${priority}`}>{priority}</span></p>}
              {notes && <p><strong>Notes:</strong> {notes}</p>}
            </div>
          </div>

          <div className="hb-confirm-note">
            ℹ️ After booking, the doctor will review your request. You'll receive a notification once your appointment is confirmed.
          </div>

          <div className="hb-step-actions">
            <button className="btn-secondary" onClick={() => setStep('details')}>← Edit Details</button>
            <button
              className="btn-primary hb-confirm-btn"
              disabled={submitting}
              onClick={handleSubmit}
            >
              {submitting ? 'Booking...' : '✓ Confirm Appointment'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default HospitalBooking

import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import apiService from '../../services/api'
import { useSettings } from '../../context/SettingsContext'
import { VetProfile, TimeSlot, Animal } from '../../types'
import '../../styles/modules.css'

/** Filter out past time slots for today using browser local time + 15min buffer */
const filterFutureSlots = <T extends { startTime: string; isAvailable: boolean }>(slots: T[], forDate: string): T[] => {
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return slots.filter(s => {
    if (!s.isAvailable) return false
    if (forDate !== todayStr) return true
    const [h, m] = (s.startTime || '00:00').split(':').map(Number)
    return h * 60 + m > now.getHours() * 60 + now.getMinutes() + 15
  })
}

interface Enterprise { id: string; name: string; type: string; location?: string }
interface AnimalGroup { id: string; name: string; type: string; animalCount?: number }

interface BookConsultationProps {
  onNavigate: (path: string) => void
}

const BookConsultation: React.FC<BookConsultationProps> = ({ onNavigate }) => {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { formatCurrency, formatSlotTime } = useSettings()
  const [step, setStep] = useState(1)
  const [vets, setVets] = useState<VetProfile[]>([])
  const [animals, setAnimals] = useState<Animal[]>([])
  const [selectedVet, setSelectedVet] = useState<VetProfile | null>(null)
  const [selectedAnimal, setSelectedAnimal] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState('')
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [bookingType, setBookingType] = useState<string>('video_call')
  const [reasonForVisit, setReasonForVisit] = useState('')
  const [certPurpose, setCertPurpose] = useState('')
  const [symptoms, setSymptoms] = useState('')
  const [priority, setPriority] = useState('normal')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [dateSearching, setDateSearching] = useState(false)
  const [autoSelectedDate, setAutoSelectedDate] = useState(false)
  const [error, setError] = useState('')
  const [step3Error, setStep3Error] = useState('')
  const [success, setSuccess] = useState(false)

  // Enterprise / Herd / Group state (farmers)
  const isFarmer = user?.role === 'farmer'
  const isAdmin = user?.role === 'admin'
  const [selectionMode, setSelectionMode] = useState<'individual' | 'enterprise'>(isFarmer ? 'enterprise' : 'individual')
  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [selectedEnterprise, setSelectedEnterprise] = useState<string>('')
  const [selectedEnterpriseName, setSelectedEnterpriseName] = useState('')
  const [groups, setGroups] = useState<AnimalGroup[]>([])
  const [selectedGroup, setSelectedGroup] = useState<string>('')
  const [selectedGroupName, setSelectedGroupName] = useState('')
  const [enterpriseAnimals, setEnterpriseAnimals] = useState<Animal[]>([])
  const [loadingEnterpriseData, setLoadingEnterpriseData] = useState(false)

  // Track pre-filled context from URL for the info banner
  const [prefilledContext, setPrefilledContext] = useState<{ animalName?: string; groupName?: string; enterpriseName?: string } | null>(null)

  // Stores the time param from URL so loadAvailability can auto-select the slot (one-shot)
  const prefilledTimeRef = useRef<string | null>(null)

  // Pre-fill from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const vetId = params.get('vetId')
    const animalId = params.get('animalId')
    const enterpriseId = params.get('enterpriseId')
    const groupId = params.get('groupId')
    const date = params.get('date')
    const time = params.get('time')
    if (date) setSelectedDate(date)
    if (time) prefilledTimeRef.current = time
    loadInitialData(vetId, animalId, enterpriseId, groupId)
  }, [])

  const loadInitialData = async (
    preselectedVetId?: string | null,
    preselectedAnimalId?: string | null,
    preselectedEnterpriseId?: string | null,
    preselectedGroupId?: string | null
  ) => {
    try {
      setLoading(true)
      const promises: Promise<any>[] = [
        apiService.listVets({ limit: 50 }),
        apiService.listAnimals({ limit: 50 })
      ]
      // Farmers & admins: also load enterprises
      if (isFarmer || isAdmin) {
        promises.push(apiService.listEnterprises({ limit: 50 }))
      }
      const results = await Promise.all(promises)

      const vetsRes = results[0]
      const animalsRes = results[1]
      const vetList = vetsRes.data?.vets || vetsRes.data?.items || (Array.isArray(vetsRes.data) ? vetsRes.data : [])
      const animalList = animalsRes.data?.animals || animalsRes.data?.items || (Array.isArray(animalsRes.data) ? animalsRes.data : [])
      setVets(vetList)
      setAnimals(animalList)

      let entList: any[] = []
      if (results[2]) {
        entList = results[2].data?.items || results[2].data?.enterprises || (Array.isArray(results[2].data) ? results[2].data : [])
        setEnterprises(entList)
      }

      if (preselectedVetId) {
        const vet = vetList.find((v: VetProfile) => v.userId === preselectedVetId)
        if (vet) {
          setSelectedVet(vet)
          setStep(2)
        }
      }

      // ── Pre-select animal from URL (individual mode) ──
      if (preselectedAnimalId && !preselectedEnterpriseId) {
        const animal = animalList.find((a: Animal) => a.id === preselectedAnimalId)
        if (animal) {
          setSelectionMode('individual')
          setSelectedAnimal(preselectedAnimalId)
          setPrefilledContext({ animalName: `${animal.name} (${animal.species}${animal.breed ? ' • ' + animal.breed : ''})` })
        }
      }

      // ── Pre-select enterprise + group from URL (enterprise mode) ──
      if (preselectedEnterpriseId && entList.length > 0) {
        const ent = entList.find((e: any) => e.id === preselectedEnterpriseId)
        if (ent) {
          setSelectionMode('enterprise')
          setSelectedEnterprise(preselectedEnterpriseId)
          setSelectedEnterpriseName(ent.name || '')
          const prefillCtx: { enterpriseName?: string; groupName?: string; animalName?: string } = { enterpriseName: ent.name }
          // Load groups + animals for this enterprise
          try {
            const [groupsRes, animalsRes] = await Promise.all([
              apiService.listAnimalGroups(preselectedEnterpriseId, { limit: 100 }),
              apiService.listEnterpriseAnimals(preselectedEnterpriseId, { limit: 200 })
            ])
            const groupList = groupsRes.data?.items || groupsRes.data?.groups || (Array.isArray(groupsRes.data) ? groupsRes.data : [])
            const entAnimalList = animalsRes.data?.items || animalsRes.data?.animals || (Array.isArray(animalsRes.data) ? animalsRes.data : [])
            setGroups(groupList)
            setEnterpriseAnimals(entAnimalList)

            if (preselectedGroupId) {
              const grp = groupList.find((g: any) => g.id === preselectedGroupId)
              if (grp) {
                setSelectedGroup(preselectedGroupId)
                setSelectedGroupName(grp.name || '')
                prefillCtx.groupName = grp.name
              }
            }

            // If animalId was also passed, pre-select that animal
            if (preselectedAnimalId) {
              const animal = entAnimalList.find((a: any) => a.id === preselectedAnimalId)
              if (animal) {
                setSelectedAnimal(preselectedAnimalId)
                prefillCtx.animalName = `${animal.name} (${animal.species})`
              }
            }
          } catch { /* ignore */ }
          setPrefilledContext(prefillCtx)
        }
      }
    } catch (err) {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  // Load groups & animals when enterprise selected
  const handleEnterpriseChange = async (enterpriseId: string) => {
    setSelectedEnterprise(enterpriseId)
    setSelectedGroup('')
    setSelectedGroupName('')
    setSelectedAnimal('')
    setEnterpriseAnimals([])
    setGroups([])
    const ent = enterprises.find(e => e.id === enterpriseId)
    setSelectedEnterpriseName(ent?.name || '')

    if (!enterpriseId) return
    try {
      setLoadingEnterpriseData(true)
      const [groupsRes, animalsRes] = await Promise.all([
        apiService.listAnimalGroups(enterpriseId, { limit: 100 }),
        apiService.listEnterpriseAnimals(enterpriseId, { limit: 200 })
      ])
      const groupList = groupsRes.data?.items || groupsRes.data?.groups || (Array.isArray(groupsRes.data) ? groupsRes.data : [])
      const animalList = animalsRes.data?.items || animalsRes.data?.animals || (Array.isArray(animalsRes.data) ? animalsRes.data : [])
      setGroups(groupList)
      setEnterpriseAnimals(animalList)
    } catch {
      /* ignore */
    } finally {
      setLoadingEnterpriseData(false)
    }
  }

  const handleGroupChange = (groupId: string) => {
    setSelectedGroup(groupId)
    setSelectedAnimal('')
    const grp = groups.find(g => g.id === groupId)
    setSelectedGroupName(grp?.name || '')
  }

  // Filter enterprise animals by selected group
  const filteredEnterpriseAnimals = selectedGroup
    ? enterpriseAnimals.filter((a: any) => a.groupId === selectedGroup || a.group_id === selectedGroup)
    : enterpriseAnimals

  // Get the current animals list based on mode
  const displayAnimals = selectionMode === 'enterprise' ? filteredEnterpriseAnimals : animals
  const selectedAnimalObj = displayAnimals.find(a => a.id === selectedAnimal)

  const loadAvailability = async (date: string) => {
    if (!selectedVet) return
    try {
      setSlotsLoading(true)
      const result = await apiService.getVetAvailability(selectedVet.userId, date)
      const slots: TimeSlot[] = result.data?.slots || []
      setAvailableSlots(slots)

      // Auto-select the slot that was clicked in FindDoctor (one-shot, clears after use)
      if (prefilledTimeRef.current) {
        const autoTime = prefilledTimeRef.current
        prefilledTimeRef.current = null // clear so subsequent date changes don't re-auto-select
        const futureSlots = filterFutureSlots(slots, date)
        const match = futureSlots.find(s => s.startTime === autoTime)
        if (match) {
          setSelectedSlot(match)
          setStep(3) // skip the "Choose Time" step — user already chose in FindDoctor
        }
      }
    } catch (err: any) {
      setAvailableSlots([])
    } finally {
      setSlotsLoading(false)
    }
  }

  useEffect(() => {
    if (selectedDate && selectedVet) {
      loadAvailability(selectedDate)
    }
  }, [selectedDate, selectedVet])

  // Auto-find the next available date when the user arrives at Step 2 without a pre-filled date
  useEffect(() => {
    if (step !== 2 || !selectedVet || selectedDate) return
    autoFindNextDate(selectedVet.userId)
  }, [step, selectedVet])

  const autoFindNextDate = async (vetId: string) => {
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    setDateSearching(true)
    setAutoSelectedDate(false)
    // Try current month then next month
    for (let offset = 0; offset <= 1; offset++) {
      const d = new Date(today.getFullYear(), today.getMonth() + offset, 1)
      const year = d.getFullYear()
      const month = d.getMonth() + 1
      try {
        const res = await apiService.getMonthlyAvailability(vetId, year, month)
        const days: { date: string; status: string }[] = res.data?.summary || res.data || []
        const next = days.find(
          day => day.date >= todayStr && (day.status === 'available' || day.status === 'custom')
        )
        if (next) {
          setSelectedDate(next.date)
          setAutoSelectedDate(true)
          setDateSearching(false)
          return
        }
      } catch {
        // ignore — let user pick manually
      }
    }
    setDateSearching(false)
  }

  const handleSubmitBooking = async () => {
    if (!selectedVet || !selectedSlot || !reasonForVisit) {
      setError(t('bookConsultation.fillRequired'))
      return
    }

    // Validate: cannot book in the past
    const slotDateTime = new Date(`${selectedDate}T${selectedSlot.startTime}:00`)
    if (slotDateTime <= new Date()) {
      setError(t('bookConsultation.cannotBookPast'))
      return
    }

    try {
      setLoading(true)
      setError('')

      await apiService.createBooking({
        veterinarianId: selectedVet.userId,
        animalId: selectedAnimal || undefined,
        enterpriseId: (selectionMode === 'enterprise' && selectedEnterprise) ? selectedEnterprise : undefined,
        groupId: (selectionMode === 'enterprise' && selectedGroup) ? selectedGroup : undefined,
        scheduledDate: selectedDate,
        timeSlotStart: selectedSlot.startTime,
        timeSlotEnd: selectedSlot.endTime,
        bookingType,
        priority,
        reasonForVisit,
        symptoms: symptoms || undefined,
        notes: notes || undefined
      })

      setSuccess(true)
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || t('bookConsultation.failedToCreate'))
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="module-page">
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ fontSize: 64, marginBottom: 20 }}>✅</div>
          <h1 style={{ marginBottom: 8 }}>{t('bookConsultation.successTitle')}</h1>
          <p style={{ color: '#6b7280', fontSize: 16, marginBottom: 24 }}>
            {t('bookConsultation.successMessage')}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => onNavigate('/my-bookings')}>
              {t('bookConsultation.viewMyBookings')}
            </button>
            <button className="btn btn-outline" onClick={() => onNavigate('/dashboard')}>
              {t('bookConsultation.goToDashboard')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (loading && step === 1) {
    return (
      <div className="module-page">
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <h1>{t('bookConsultation.title')}</h1>
          <p className="page-subtitle">{t('bookConsultation.subtitle')}</p>
        </div>
        <div className="page-header-actions">
          <button className="page-back-btn" onClick={() => onNavigate('/find-doctor')}>
            ← {t('common.back')}
          </button>
        </div>
      </div>

      {/* Progress Steps */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 36, gap: 0 }}>
        {[t('bookConsultation.steps.selectDoctor'), t('bookConsultation.steps.chooseTime'), t('bookConsultation.steps.details'), t('bookConsultation.steps.confirm')].map((label, i) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600,
                background: step > i + 1 ? '#059669' : step === i + 1 ? '#2563eb' : '#e5e7eb',
                color: step >= i + 1 ? 'white' : '#9ca3af'
              }}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 12, color: step === i + 1 ? '#2563eb' : '#9ca3af', fontWeight: 500 }}>
                {label}
              </span>
            </div>
            {i < 3 && (
              <div style={{
                width: 60, height: 2, margin: '0 8px',
                background: step > i + 1 ? '#059669' : '#e5e7eb',
                marginBottom: 20
              }} />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="toast toast-error" style={{ position: 'relative', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Persistent Doctor Info Panel — visible on steps 2, 3, 4 */}
      {selectedVet && step > 1 && (
        <div className="card" style={{ marginBottom: 24, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
          <div className="card-body" style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '14px 20px' }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%', background: '#2563eb',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 22, fontWeight: 700, flexShrink: 0
            }}>
              {selectedVet.firstName?.charAt(0) || '🐾'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#1e40af' }}>
                {t('bookConsultation.bookingWith')} Dr. {selectedVet.firstName} {selectedVet.lastName}
              </div>
              <div style={{ fontSize: 13, color: '#3b82f6', marginTop: 2 }}>
                {(selectedVet.specializations || []).join(', ') || t('bookConsultation.generalVeterinarian')}
              </div>
              {selectedVet.clinicName && (
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>🏥 {selectedVet.clinicName}</div>
              )}
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 18, color: '#2563eb' }}>
                {formatCurrency(selectedVet.consultationFee || 0)}
              </div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{t('bookConsultation.perSession')}</div>
              {(selectedVet.rating ?? 0) > 0 && (
                <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 2 }}>
                  ⭐ {(selectedVet.rating ?? 0).toFixed(1)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Select Doctor */}
      {step === 1 && (
        <div>
          <h2 style={{ marginBottom: 16 }}>{t('bookConsultation.selectVet')}</h2>
          <div className="vet-grid">
            {vets.map(vet => (
              <div
                key={vet.id}
                className="vet-card"
                style={{
                  cursor: 'pointer',
                  border: selectedVet?.id === vet.id ? '2px solid #2563eb' : undefined
                }}
                onClick={() => setSelectedVet(vet)}
              >
                <div className="vet-avatar">
                  {vet.firstName?.charAt(0) || '🐾'}
                </div>
                <h3 className="vet-name">Dr. {vet.firstName || ''} {vet.lastName || ''}</h3>
                <p className="vet-specialty">{(vet.specializations || []).join(', ') || 'General Veterinarian'}</p>
                <div className="vet-fee">{formatCurrency(vet.consultationFee || 0)}/session</div>
              </div>
            ))}
          </div>
          {vets.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">👨‍⚕️</div>
              <h3>{t('bookConsultation.noVets')}</h3>
              <p>{t('bookConsultation.checkBackLater')}</p>
            </div>
          )}
          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn btn-primary btn-lg"
              disabled={!selectedVet}
              onClick={() => setStep(2)}
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Choose Time */}
      {step === 2 && (
        <div>
          <h2 style={{ marginBottom: 16 }}>{t('bookConsultation.chooseDateTime')}</h2>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">{t('bookConsultation.selectDate')}</label>
                  {dateSearching ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8 }}>
                      <div className="loading-spinner" style={{ width: 16, height: 16, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: '#0369a1' }}>{t('bookConsultation.findingNextDate')}</span>
                    </div>
                  ) : (
                    <>
                      <input
                        type="date"
                        className="form-input"
                        value={selectedDate}
                        min={(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })()}
                        onChange={(e) => {
                          setSelectedDate(e.target.value)
                          setSelectedSlot(null)
                          setAutoSelectedDate(false)
                        }}
                      />
                      {autoSelectedDate && selectedDate && (
                        <p style={{ margin: '6px 0 0', fontSize: 12, color: '#059669' }}>
                          ✓ {t('bookConsultation.nextAvailableAutoSelected')}
                        </p>
                      )}
                    </>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">{t('bookConsultation.consultationType')}</label>
                  <select
                    className="form-select"
                    value={bookingType}
                    onChange={(e) => setBookingType(e.target.value)}
                  >
                    <option value="video_call">📹 {t('bookConsultation.videoCall')}</option>
                    <option value="phone">📞 {t('bookConsultation.phoneCall')}</option>
                    <option value="in_person">🏥 {t('bookConsultation.inPerson')}</option>
                    <option value="chat">💬 {t('bookConsultation.chatType')}</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {selectedDate && (
            <div className="card">
              <div className="card-header">
                <h3>{t('bookConsultation.availableSlots')}</h3>
              </div>
              <div className="card-body">
                {slotsLoading ? (
                  <div className="loading-container" style={{ padding: 30 }}>
                    <div className="loading-spinner" />
                  </div>
                ) : (() => {
                  const futureSlots = filterFutureSlots(availableSlots, selectedDate)
                  return futureSlots.length === 0 ? (
                    <div className="empty-state" style={{ padding: 20 }}>
                      <p>{availableSlots.length === 0
                        ? t('bookConsultation.noSlotsAvailable')
                        : t('bookConsultation.allSlotsPassed')}</p>
                    </div>
                  ) : (
                    <div className="time-slots-grid">
                      {futureSlots.map((slot, idx) => (
                        <div
                          key={idx}
                          className={`time-slot ${selectedSlot?.startTime === slot.startTime ? 'selected' : ''}`}
                          onClick={() => setSelectedSlot(slot)}
                        >
                          {formatSlotTime(slot.startTime)} - {formatSlotTime(slot.endTime)}
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>
          )}

          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
            <button className="btn btn-outline" onClick={() => setStep(1)}>{t('bookConsultation.back')}</button>
            <button
              className="btn btn-primary btn-lg"
              disabled={!selectedSlot}
              onClick={() => setStep(3)}
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Details */}
      {step === 3 && (
        <div>
          <h2 style={{ marginBottom: 16 }}>{t('bookConsultation.consultationDetails')}</h2>

          {/* Pre-filled context banner */}
          {prefilledContext && (
            <div style={{
              background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8,
              padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#1e40af'
            }}>
              <strong>ℹ️ Pre-selected:</strong>{' '}
              {prefilledContext.animalName && <span>Animal: <strong>{prefilledContext.animalName}</strong></span>}
              {prefilledContext.enterpriseName && <span>Enterprise: <strong>{prefilledContext.enterpriseName}</strong></span>}
              {prefilledContext.groupName && <span> → Group: <strong>{prefilledContext.groupName}</strong></span>}
              <span style={{ marginLeft: 8, color: '#6b7280', fontSize: 12 }}>
                (You can change the selection below if needed)
              </span>
            </div>
          )}

          {/* Selection Mode Toggle (Farmers & Admins) */}
          {(isFarmer || isAdmin) && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-body" style={{ padding: '12px 16px' }}>
                <label className="form-label" style={{ marginBottom: 8 }}>{t('bookConsultation.bookingFor')}</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    style={{
                      flex: 1, padding: '10px 16px', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer',
                      border: selectionMode === 'individual' ? '2px solid #2563eb' : '1px solid #d1d5db',
                      background: selectionMode === 'individual' ? '#eff6ff' : 'white',
                      color: selectionMode === 'individual' ? '#2563eb' : '#374151'
                    }}
                    onClick={() => { setSelectionMode('individual'); setSelectedEnterprise(''); setSelectedGroup(''); setSelectedAnimal('') }}
                  >
                    🐾 {t('bookConsultation.individualPet')}
                  </button>
                  <button
                    type="button"
                    style={{
                      flex: 1, padding: '10px 16px', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer',
                      border: selectionMode === 'enterprise' ? '2px solid #059669' : '1px solid #d1d5db',
                      background: selectionMode === 'enterprise' ? '#ecfdf5' : 'white',
                      color: selectionMode === 'enterprise' ? '#059669' : '#374151'
                    }}
                    onClick={() => { setSelectionMode('enterprise'); setSelectedAnimal('') }}
                  >
                    🏢 {t('bookConsultation.farmEnterprise')}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-body">

              {/* Enterprise Mode: Farm → Group → Animal cascade */}
              {selectionMode === 'enterprise' && (isFarmer || isAdmin) && (
                <>
                  <div className="form-group">
                    <label className="form-label">🏢 {t('bookConsultation.selectFarm')}</label>
                    <select
                      className="form-select"
                      value={selectedEnterprise}
                      onChange={(e) => handleEnterpriseChange(e.target.value)}
                    >
                      <option value="">-- {t('bookConsultation.selectFarmPlaceholder')} --</option>
                      {enterprises.map(ent => (
                        <option key={ent.id} value={ent.id}>
                          {ent.name} — {ent.type}{ent.location ? ` (${ent.location})` : ''}
                        </option>
                      ))}
                    </select>
                    {enterprises.length === 0 && (
                      <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                        {t('bookConsultation.noEnterprises')}
                      </p>
                    )}
                  </div>

                  {selectedEnterprise && (
                    <div className="form-group">
                      <label className="form-label">🐄 {t('bookConsultation.selectHerd')}</label>
                      {loadingEnterpriseData ? (
                        <div style={{ padding: 10, textAlign: 'center' }}>
                          <div className="loading-spinner" style={{ width: 20, height: 20, margin: '0 auto' }} />
                        </div>
                      ) : (
                        <select
                          className="form-select"
                          value={selectedGroup}
                          onChange={(e) => handleGroupChange(e.target.value)}
                        >
                          <option value="">-- {t('bookConsultation.allAnimalsNoFilter')} --</option>
                          {groups.map(g => (
                            <option key={g.id} value={g.id}>
                              {g.name} — {g.type}{g.animalCount != null ? ` (${g.animalCount} animals)` : ''}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}

                  {selectedEnterprise && !loadingEnterpriseData && (
                    <div className="form-group">
                      <label className="form-label">🐾 {t('bookConsultation.selectAnimal')}</label>
                      <select
                        className="form-select"
                        value={selectedAnimal}
                        onChange={(e) => setSelectedAnimal(e.target.value)}
                      >
                        <option value="">-- {t('bookConsultation.selectAnimalOptional')} --</option>
                        {filteredEnterpriseAnimals.map((a: any) => (
                          <option key={a.id} value={a.id}>
                            {a.name} — {a.species}{a.breed ? ` / ${a.breed}` : ''}{a.uniqueId ? ` [${a.uniqueId}]` : ''}
                          </option>
                        ))}
                      </select>
                      {filteredEnterpriseAnimals.length === 0 && (
                        <div style={{ fontSize: 13, color: '#6b7280', marginTop: 6, padding: '10px 14px', background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8 }}>
                          <strong style={{ color: '#92400e' }}>⚠️ {selectedGroup ? t('bookConsultation.noAnimalsInGroup') : t('bookConsultation.noAnimalsInEnterprise')}</strong>
                          <p style={{ margin: '6px 0 0', fontSize: 12, lineHeight: 1.5 }}>
                            {t('bookConsultation.toAddAnimals')}{' '}
                            <button type="button" onClick={() => onNavigate('/animals')}
                              style={{ background: 'none', border: 'none', color: '#4F46E5', cursor: 'pointer', textDecoration: 'underline', fontSize: 12, padding: 0, fontWeight: 600 }}>
                              {t('bookConsultation.registerNewAnimal')}
                            </button>
                            {' '}{t('bookConsultation.andAssign')}{' '}
                            <button type="button" onClick={() => onNavigate('/animal-groups')}
                              style={{ background: 'none', border: 'none', color: '#4F46E5', cursor: 'pointer', textDecoration: 'underline', fontSize: 12, padding: 0, fontWeight: 600 }}>
                              {t('bookConsultation.herdsAndGroups')}
                            </button>
                            {' '}{t('bookConsultation.toAssignExisting')}
                          </p>
                          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#78716c' }}>
                            {t('bookConsultation.canStillProceed')}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Quick summary of selection */}
                  {selectedEnterprise && (
                    <div style={{
                      background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8,
                      padding: '10px 14px', marginBottom: 8, fontSize: 13
                    }}>
                      <strong style={{ color: '#166534' }}>📋 Selection:</strong>{' '}
                      <span style={{ color: '#15803d' }}>
                        {selectedEnterpriseName}
                        {selectedGroupName ? ` → ${selectedGroupName}` : ''}
                        {selectedAnimalObj ? ` → ${selectedAnimalObj.name}` : ' (general / herd-level)'}
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* Individual Mode: Flat pet selection */}
              {selectionMode === 'individual' && (
                <div className="form-group">
                  <label className="form-label">{t('bookConsultation.selectYourPet')}</label>
                  {animals.length === 0 ? (
                    <div style={{ padding: '14px 16px', background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <strong style={{ color: '#92400e', fontSize: 13 }}>🐾 {t('bookConsultation.noPetsRegistered')}</strong>
                        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#78350f' }}>{t('bookConsultation.noPetsHint')}</p>
                      </div>
                      <button
                        type="button"
                        className="module-btn primary"
                        style={{ whiteSpace: 'nowrap', fontSize: 13 }}
                        onClick={() => onNavigate('/animals')}
                      >
                        + {t('bookConsultation.addPet')}
                      </button>
                    </div>
                  ) : (
                    <select
                      className="form-select"
                      value={selectedAnimal}
                      onChange={(e) => setSelectedAnimal(e.target.value)}
                    >
                      <option value="">-- {t('bookConsultation.selectPetOptional')} --</option>
                      {animals.map(a => (
                        <option key={a.id} value={a.id}>{a.name} — {a.species}{a.breed ? ` / ${a.breed}` : ''}{a.uniqueId ? ` [${a.uniqueId}]` : ''}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Certificate Purpose (optional)</label>
                <select
                  className="form-input"
                  value={certPurpose}
                  onChange={e => {
                    const ct = e.target.value
                    setCertPurpose(ct)
                    if (ct) {
                      const label = ct.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
                      setReasonForVisit(`Certificate: ${label}`)
                    } else {
                      setReasonForVisit('')
                    }
                  }}
                >
                  <option value="">Regular Consultation</option>
                  {['health_certificate','fitness_to_travel','rabies_vaccination','vaccination_record','pre_travel','sterilization','treatment','animal_injury','post_mortem','breeding_soundness','pregnancy_diagnosis','infertility_evaluation','fitness_for_sale','animal_valuation'].map(ct => (
                    <option key={ct} value={ct}>{ct.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">{t('bookConsultation.reasonForVisit')}</label>
                <input
                  type="text"
                  className={`form-input${step3Error && reasonForVisit.trim().length < 3 ? ' input-error' : ''}`}
                  placeholder={t('bookConsultation.reasonPlaceholder')}
                  value={reasonForVisit}
                  onChange={(e) => {
                    setReasonForVisit(e.target.value)
                    if (step3Error) setStep3Error('')
                  }}
                />
                {step3Error && (
                  <p style={{ margin: '6px 0 0', fontSize: 13, color: '#dc2626' }}>
                    ⚠ {step3Error}
                  </p>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">{t('bookConsultation.symptoms')}</label>
                <textarea
                  className="form-textarea"
                  placeholder={t('bookConsultation.symptomsPlaceholder')}
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">{t('bookConsultation.priority')}</label>
                  <select
                    className="form-select"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                  >
                    <option value="low">{t('bookConsultation.priorityLow')}</option>
                    <option value="normal">{t('bookConsultation.priorityNormal')}</option>
                    <option value="high">{t('bookConsultation.priorityHigh')}</option>
                    <option value="emergency">🚨 {t('bookConsultation.priorityEmergency')}</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">{t('bookConsultation.additionalNotes')}</label>
                <textarea
                  className="form-textarea"
                  placeholder={t('bookConsultation.notesPlaceholder')}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </div>

          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
            <button className="btn btn-outline" onClick={() => setStep(2)}>{t('bookConsultation.back')}</button>
            <button
              className="btn btn-primary btn-lg"
              disabled={!reasonForVisit.trim()}
              onClick={() => {
                if (reasonForVisit.trim().length < 3) {
                  setStep3Error(t('bookConsultation.reasonTooShort'))
                  return
                }
                setStep3Error('')
                setStep(4)
              }}
            >
              {t('bookConsultation.reviewBooking')}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Confirm */}
      {step === 4 && (
        <div>
          <h2 style={{ marginBottom: 16 }}>{t('bookConsultation.reviewConfirm')}</h2>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-body">
              <div style={{ display: 'grid', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <strong style={{ color: '#6b7280', fontSize: 13 }}>{t('bookConsultation.veterinarianLabel')}</strong>
                    <p style={{ margin: '4px 0', fontSize: 16 }}>
                      Dr. {selectedVet?.firstName} {selectedVet?.lastName}
                    </p>
                  </div>
                  <div>
                    <strong style={{ color: '#6b7280', fontSize: 13 }}>{t('bookConsultation.feeLabel')}</strong>
                    <p style={{ margin: '4px 0', fontSize: 16, fontWeight: 700, color: '#2563eb' }}>
                      {formatCurrency(selectedVet?.consultationFee || 0)}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <strong style={{ color: '#6b7280', fontSize: 13 }}>{t('bookConsultation.dateTimeLabel')}</strong>
                    <p style={{ margin: '4px 0', fontSize: 16 }}>
                      {selectedDate} | {selectedSlot?.startTime} - {selectedSlot?.endTime}
                    </p>
                  </div>
                  <div>
                    <strong style={{ color: '#6b7280', fontSize: 13 }}>{t('bookConsultation.typeLabel')}</strong>
                    <p style={{ margin: '4px 0', fontSize: 16, textTransform: 'capitalize' }}>
                      {bookingType.replace('_', ' ')}
                    </p>
                  </div>
                </div>

                {/* Enterprise / Group / Animal info */}
                {selectionMode === 'enterprise' && selectedEnterprise && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 16px' }}>
                    <strong style={{ color: '#166534', fontSize: 13 }}>🏢 {t('bookConsultation.farmDetails')}</strong>
                    <div style={{ margin: '6px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <span style={{ fontSize: 12, color: '#6b7280' }}>{t('bookConsultation.enterpriseLabel')}:</span>
                        <p style={{ margin: '2px 0', fontWeight: 600 }}>{selectedEnterpriseName}</p>
                      </div>
                      {selectedGroupName && (
                        <div>
                          <span style={{ fontSize: 12, color: '#6b7280' }}>{t('bookConsultation.herdGroupLabel')}:</span>
                          <p style={{ margin: '2px 0', fontWeight: 600 }}>{selectedGroupName}</p>
                        </div>
                      )}
                    </div>
                    {selectedAnimalObj && (
                      <div style={{ marginTop: 4 }}>
                        <span style={{ fontSize: 12, color: '#6b7280' }}>{t('bookConsultation.animalLabel')}:</span>
                        <p style={{ margin: '2px 0', fontWeight: 600 }}>
                          {selectedAnimalObj.name} — {selectedAnimalObj.species}
                          {selectedAnimalObj.breed ? ` / ${selectedAnimalObj.breed}` : ''}
                        </p>
                      </div>
                    )}
                    {!selectedAnimalObj && (
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: '#059669', fontStyle: 'italic' }}>
                        {t('bookConsultation.generalConsultation')}
                      </p>
                    )}
                  </div>
                )}

                {selectionMode === 'individual' && selectedAnimalObj && (
                  <div>
                    <strong style={{ color: '#6b7280', fontSize: 13 }}>{t('bookConsultation.petLabel')}</strong>
                    <p style={{ margin: '4px 0' }}>
                      {selectedAnimalObj.name} — {selectedAnimalObj.species}
                      {selectedAnimalObj.breed ? ` / ${selectedAnimalObj.breed}` : ''}
                    </p>
                  </div>
                )}

                <div>
                  <strong style={{ color: '#6b7280', fontSize: 13 }}>{t('bookConsultation.reasonLabel')}</strong>
                  <p style={{ margin: '4px 0' }}>{reasonForVisit}</p>
                </div>
                {symptoms && (
                  <div>
                    <strong style={{ color: '#6b7280', fontSize: 13 }}>{t('bookConsultation.symptomsLabel')}</strong>
                    <p style={{ margin: '4px 0' }}>{symptoms}</p>
                  </div>
                )}
                <div>
                  <strong style={{ color: '#6b7280', fontSize: 13 }}>{t('bookConsultation.priorityReviewLabel')}</strong>
                  <p style={{ margin: '4px 0' }}>
                    <span className={`badge badge-${priority === 'emergency' ? 'cancelled' : priority === 'high' ? 'pending' : 'confirmed'}`}>
                      {priority}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
            <button className="btn btn-outline" onClick={() => setStep(3)}>{t('bookConsultation.back')}</button>
            <button
              className="btn btn-success btn-lg"
              disabled={loading}
              onClick={handleSubmitBooking}
            >
              {loading ? t('bookConsultation.booking') : t('bookConsultation.confirmBooking')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default BookConsultation

import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import apiService from '../../services/api'
import { VetProfile, TimeSlot, Animal } from '../../types'
import '../../styles/modules.css'

interface Enterprise { id: string; name: string; type: string; location?: string }
interface AnimalGroup { id: string; name: string; type: string; animalCount?: number }

interface BookConsultationProps {
  onNavigate: (path: string) => void
}

const BookConsultation: React.FC<BookConsultationProps> = ({ onNavigate }) => {
  const { user } = useAuth()
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
  const [symptoms, setSymptoms] = useState('')
  const [priority, setPriority] = useState('normal')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [error, setError] = useState('')
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

  // Pre-fill from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const vetId = params.get('vetId')
    const animalId = params.get('animalId')
    const enterpriseId = params.get('enterpriseId')
    const groupId = params.get('groupId')
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
      setAvailableSlots(result.data?.slots || [])
    } catch (err) {
// Generate sample slots for demo
      const demoSlots: TimeSlot[] = []
      const now = new Date()
      const isToday = date === now.toISOString().split('T')[0]
      const currentMinutes = now.getHours() * 60 + now.getMinutes()
      for (let h = 9; h < 17; h++) {
        const slot1Start = h * 60
        const slot2Start = h * 60 + 30
        if (!isToday || slot1Start > currentMinutes) {
          demoSlots.push({
            startTime: `${h.toString().padStart(2, '0')}:00`,
            endTime: `${h.toString().padStart(2, '0')}:30`,
            isAvailable: Math.random() > 0.3
          })
        }
        if (!isToday || slot2Start > currentMinutes) {
          demoSlots.push({
            startTime: `${h.toString().padStart(2, '0')}:30`,
            endTime: `${(h + 1).toString().padStart(2, '0')}:00`,
            isAvailable: Math.random() > 0.3
          })
        }
      }
      setAvailableSlots(demoSlots)
    } finally {
      setSlotsLoading(false)
    }
  }

  useEffect(() => {
    if (selectedDate && selectedVet) {
      loadAvailability(selectedDate)
    }
  }, [selectedDate, selectedVet])

  const handleSubmitBooking = async () => {
    if (!selectedVet || !selectedSlot || !reasonForVisit) {
      setError('Please fill in all required fields')
      return
    }

    // Validate: cannot book in the past
    const slotDateTime = new Date(`${selectedDate}T${selectedSlot.startTime}:00`)
    if (slotDateTime <= new Date()) {
      setError('Cannot book a consultation in the past. Please select a future date and time.')
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
      setError(err.response?.data?.error?.message || 'Failed to create booking')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="module-page">
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ fontSize: 64, marginBottom: 20 }}>✅</div>
          <h1 style={{ marginBottom: 8 }}>Booking Confirmed!</h1>
          <p style={{ color: '#6b7280', fontSize: 16, marginBottom: 24 }}>
            Your consultation has been booked successfully. You'll receive a confirmation notification.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => onNavigate('/my-bookings')}>
              View My Bookings
            </button>
            <button className="btn btn-outline" onClick={() => onNavigate('/dashboard')}>
              Go to Dashboard
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
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <h1>Book a Consultation</h1>
          <p className="page-subtitle">Schedule an appointment with a veterinarian</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 36, gap: 0 }}>
        {['Select Doctor', 'Choose Time', 'Details', 'Confirm'].map((label, i) => (
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

      {/* Step 1: Select Doctor */}
      {step === 1 && (
        <div>
          <h2 style={{ marginBottom: 16 }}>Select a Veterinarian</h2>
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
                <div className="vet-fee">{vet.currency || '$'}{vet.consultationFee || 0}/session</div>
              </div>
            ))}
          </div>
          {vets.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">👨‍⚕️</div>
              <h3>No veterinarians available</h3>
              <p>Please check back later</p>
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
          <h2 style={{ marginBottom: 16 }}>Choose Date & Time</h2>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Select Date *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={selectedDate}
                    min={(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })()}
                    onChange={(e) => {
                      setSelectedDate(e.target.value)
                      setSelectedSlot(null)
                    }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Consultation Type *</label>
                  <select
                    className="form-select"
                    value={bookingType}
                    onChange={(e) => setBookingType(e.target.value)}
                  >
                    <option value="video_call">📹 Video Call</option>
                    <option value="phone">📞 Phone Call</option>
                    <option value="in_person">🏥 In Person</option>
                    <option value="chat">💬 Chat</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {selectedDate && (
            <div className="card">
              <div className="card-header">
                <h3>Available Time Slots</h3>
              </div>
              <div className="card-body">
                {slotsLoading ? (
                  <div className="loading-container" style={{ padding: 30 }}>
                    <div className="loading-spinner" />
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="empty-state" style={{ padding: 20 }}>
                    <p>{selectedDate === new Date().toISOString().split('T')[0]
                      ? 'No remaining time slots for today. All available slots have passed — please select a future date.'
                      : 'No slots available for this date. The doctor may not have a schedule on this day.'}</p>
                  </div>
                ) : (
                  <div className="time-slots-grid">
                    {availableSlots.map((slot, idx) => (
                      <div
                        key={idx}
                        className={`time-slot ${!slot.isAvailable ? 'unavailable' : ''} ${selectedSlot?.startTime === slot.startTime ? 'selected' : ''}`}
                        onClick={() => slot.isAvailable && setSelectedSlot(slot)}
                      >
                        {slot.startTime} - {slot.endTime}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
            <button className="btn btn-outline" onClick={() => setStep(1)}>← Back</button>
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
          <h2 style={{ marginBottom: 16 }}>Consultation Details</h2>

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
                <label className="form-label" style={{ marginBottom: 8 }}>Booking For</label>
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
                    🐾 Individual Pet
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
                    🏢 Farm / Enterprise
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
                    <label className="form-label">🏢 Select Farm / Enterprise *</label>
                    <select
                      className="form-select"
                      value={selectedEnterprise}
                      onChange={(e) => handleEnterpriseChange(e.target.value)}
                    >
                      <option value="">-- Select your farm --</option>
                      {enterprises.map(ent => (
                        <option key={ent.id} value={ent.id}>
                          {ent.name} — {ent.type}{ent.location ? ` (${ent.location})` : ''}
                        </option>
                      ))}
                    </select>
                    {enterprises.length === 0 && (
                      <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                        No enterprises found. Register a farm first.
                      </p>
                    )}
                  </div>

                  {selectedEnterprise && (
                    <div className="form-group">
                      <label className="form-label">🐄 Select Herd / Group</label>
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
                          <option value="">-- All animals (no group filter) --</option>
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
                      <label className="form-label">🐾 Select Animal</label>
                      <select
                        className="form-select"
                        value={selectedAnimal}
                        onChange={(e) => setSelectedAnimal(e.target.value)}
                      >
                        <option value="">-- Select an animal (optional) --</option>
                        {filteredEnterpriseAnimals.map((a: any) => (
                          <option key={a.id} value={a.id}>
                            {a.name} — {a.species}{a.breed ? ` / ${a.breed}` : ''}{a.uniqueId ? ` [${a.uniqueId}]` : ''}
                          </option>
                        ))}
                      </select>
                      {filteredEnterpriseAnimals.length === 0 && (
                        <div style={{ fontSize: 13, color: '#6b7280', marginTop: 6, padding: '10px 14px', background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8 }}>
                          <strong style={{ color: '#92400e' }}>⚠️ {selectedGroup ? 'No animals in this group.' : 'No animals in this enterprise.'}</strong>
                          <p style={{ margin: '6px 0 0', fontSize: 12, lineHeight: 1.5 }}>
                            To add animals:{' '}
                            <button type="button" onClick={() => onNavigate('/animals')}
                              style={{ background: 'none', border: 'none', color: '#4F46E5', cursor: 'pointer', textDecoration: 'underline', fontSize: 12, padding: 0, fontWeight: 600 }}>
                              Register a new animal
                            </button>
                            {' '}and assign it to an enterprise/group, or go to{' '}
                            <button type="button" onClick={() => onNavigate('/animal-groups')}
                              style={{ background: 'none', border: 'none', color: '#4F46E5', cursor: 'pointer', textDecoration: 'underline', fontSize: 12, padding: 0, fontWeight: 600 }}>
                              Herds &amp; Groups
                            </button>
                            {' '}to assign existing animals.
                          </p>
                          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#78716c' }}>
                            You can still proceed with a herd-level (general) consultation without selecting a specific animal.
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
                  <label className="form-label">Select Your Pet</label>
                  <select
                    className="form-select"
                    value={selectedAnimal}
                    onChange={(e) => setSelectedAnimal(e.target.value)}
                  >
                    <option value="">-- Select a pet (optional) --</option>
                    {animals.map(a => (
                      <option key={a.id} value={a.id}>{a.name} — {a.species}{a.breed ? ` / ${a.breed}` : ''}{a.uniqueId ? ` [${a.uniqueId}]` : ''}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Reason for Visit *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., Annual checkup, skin irritation, limping..."
                  value={reasonForVisit}
                  onChange={(e) => setReasonForVisit(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Symptoms</label>
                <textarea
                  className="form-textarea"
                  placeholder="Describe any symptoms your pet is experiencing..."
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select
                    className="form-select"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                  >
                    <option value="low">Low - Routine</option>
                    <option value="normal">Normal</option>
                    <option value="high">High - Urgent</option>
                    <option value="emergency">🚨 Emergency</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Additional Notes</label>
                <textarea
                  className="form-textarea"
                  placeholder="Any additional information for the veterinarian..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </div>

          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
            <button className="btn btn-outline" onClick={() => setStep(2)}>← Back</button>
            <button
              className="btn btn-primary btn-lg"
              disabled={!reasonForVisit}
              onClick={() => setStep(4)}
            >
              Review Booking →
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Confirm */}
      {step === 4 && (
        <div>
          <h2 style={{ marginBottom: 16 }}>Review & Confirm Booking</h2>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-body">
              <div style={{ display: 'grid', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <strong style={{ color: '#6b7280', fontSize: 13 }}>VETERINARIAN</strong>
                    <p style={{ margin: '4px 0', fontSize: 16 }}>
                      Dr. {selectedVet?.firstName} {selectedVet?.lastName}
                    </p>
                  </div>
                  <div>
                    <strong style={{ color: '#6b7280', fontSize: 13 }}>FEE</strong>
                    <p style={{ margin: '4px 0', fontSize: 16, fontWeight: 700, color: '#2563eb' }}>
                      {selectedVet?.currency || '$'}{selectedVet?.consultationFee || 0}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <strong style={{ color: '#6b7280', fontSize: 13 }}>DATE & TIME</strong>
                    <p style={{ margin: '4px 0', fontSize: 16 }}>
                      {selectedDate} | {selectedSlot?.startTime} - {selectedSlot?.endTime}
                    </p>
                  </div>
                  <div>
                    <strong style={{ color: '#6b7280', fontSize: 13 }}>TYPE</strong>
                    <p style={{ margin: '4px 0', fontSize: 16, textTransform: 'capitalize' }}>
                      {bookingType.replace('_', ' ')}
                    </p>
                  </div>
                </div>

                {/* Enterprise / Group / Animal info */}
                {selectionMode === 'enterprise' && selectedEnterprise && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 16px' }}>
                    <strong style={{ color: '#166534', fontSize: 13 }}>🏢 FARM / ENTERPRISE DETAILS</strong>
                    <div style={{ margin: '6px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <span style={{ fontSize: 12, color: '#6b7280' }}>Enterprise:</span>
                        <p style={{ margin: '2px 0', fontWeight: 600 }}>{selectedEnterpriseName}</p>
                      </div>
                      {selectedGroupName && (
                        <div>
                          <span style={{ fontSize: 12, color: '#6b7280' }}>Herd/Group:</span>
                          <p style={{ margin: '2px 0', fontWeight: 600 }}>{selectedGroupName}</p>
                        </div>
                      )}
                    </div>
                    {selectedAnimalObj && (
                      <div style={{ marginTop: 4 }}>
                        <span style={{ fontSize: 12, color: '#6b7280' }}>Animal:</span>
                        <p style={{ margin: '2px 0', fontWeight: 600 }}>
                          {selectedAnimalObj.name} — {selectedAnimalObj.species}
                          {selectedAnimalObj.breed ? ` / ${selectedAnimalObj.breed}` : ''}
                        </p>
                      </div>
                    )}
                    {!selectedAnimalObj && (
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: '#059669', fontStyle: 'italic' }}>
                        General / herd-level consultation
                      </p>
                    )}
                  </div>
                )}

                {selectionMode === 'individual' && selectedAnimalObj && (
                  <div>
                    <strong style={{ color: '#6b7280', fontSize: 13 }}>PET</strong>
                    <p style={{ margin: '4px 0' }}>
                      {selectedAnimalObj.name} — {selectedAnimalObj.species}
                      {selectedAnimalObj.breed ? ` / ${selectedAnimalObj.breed}` : ''}
                    </p>
                  </div>
                )}

                <div>
                  <strong style={{ color: '#6b7280', fontSize: 13 }}>REASON</strong>
                  <p style={{ margin: '4px 0' }}>{reasonForVisit}</p>
                </div>
                {symptoms && (
                  <div>
                    <strong style={{ color: '#6b7280', fontSize: 13 }}>SYMPTOMS</strong>
                    <p style={{ margin: '4px 0' }}>{symptoms}</p>
                  </div>
                )}
                <div>
                  <strong style={{ color: '#6b7280', fontSize: 13 }}>PRIORITY</strong>
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
            <button className="btn btn-outline" onClick={() => setStep(3)}>← Back</button>
            <button
              className="btn btn-success btn-lg"
              disabled={loading}
              onClick={handleSubmitBooking}
            >
              {loading ? 'Booking...' : '✓ Confirm Booking'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default BookConsultation

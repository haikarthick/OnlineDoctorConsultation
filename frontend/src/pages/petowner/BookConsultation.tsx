import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import apiService from '../../services/api'
import { useSettings } from '../../context/SettingsContext'
import { useMasterData } from '../../context/MasterDataContext'
import { VetProfile, TimeSlot, Animal } from '../../types'
import PaymentCheckout from '../../components/PaymentCheckout'
import { Enterprise, AnimalGroup, filterFutureSlots } from '../../components/bookConsultation/bookConsultationShared'
import BookingProgressSteps from '../../components/bookConsultation/BookingProgressSteps'
import DoctorInfoPanel from '../../components/bookConsultation/DoctorInfoPanel'
import Step1SelectDoctor from '../../components/bookConsultation/Step1SelectDoctor'
import Step2ChooseTime from '../../components/bookConsultation/Step2ChooseTime'
import Step3Details from '../../components/bookConsultation/Step3Details'
import Step4Confirm from '../../components/bookConsultation/Step4Confirm'
import BookingSuccessScreen from '../../components/bookConsultation/BookingSuccessScreen'
import '../../styles/modules.css'

interface BookConsultationProps {
  onNavigate: (path: string) => void
}

const BookConsultation: React.FC<BookConsultationProps> = ({ onNavigate }) => {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { formatCurrency, formatSlotTime } = useSettings()
  const { speciesLabel } = useMasterData()
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
  const [paymentInfo, setPaymentInfo] = useState<{
    bookingId: string; paymentId: string; amount: number; expiresAt: string | null
  } | null>(null)

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
          setPrefilledContext({ animalName: `${animal.name} (${speciesLabel(animal.species, t)}${animal.breed ? ' • ' + animal.breed : ''})` })
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
                prefillCtx.animalName = `${animal.name} (${speciesLabel(animal.species, t)})`
              }
            }
          } catch (err: any) {
            console.error('Failed to load enterprise data:', err?.message)
          }
          setPrefilledContext(prefillCtx)
        }
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || t('bookConsultation.failedToCreate'))
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
    } catch (err: any) {
      console.error('Failed to load enterprise group data:', err?.message)
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
          setStep(3) // skip the "Choose Time" step - user already chose in FindDoctor
        }
      } else {
        // If all slots for the selected date are in the past (common on initial load with today's date),
        // automatically advance to the next available date rather than showing an empty slot list.
        const now = new Date()
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
        if (date === todayStr && !autoSelectedDate) {
          const futureSlots = filterFutureSlots(slots, date)
          if (futureSlots.length === 0 && slots.length > 0) {
            // Today has slots but all are past - skip to next available date
            autoFindNextDate(selectedVet.userId, date)
          }
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

  const autoFindNextDate = async (vetId: string, skipDate?: string) => {
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    // If it's past 23:00, skip today entirely in the monthly search
    const isLateTodaySkip = now.getHours() >= 23 || skipDate === todayStr
    setDateSearching(true)
    setAutoSelectedDate(false)
    // Try current month then next month
    for (let offset = 0; offset <= 1; offset++) {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
      const year = d.getFullYear()
      const month = d.getMonth() + 1
      try {
        const res = await apiService.getMonthlyAvailability(vetId, year, month)
        const days: { date: string; status: string }[] = res.data?.summary || res.data || []
        const next = days.find(day => {
          if (day.status !== 'available' && day.status !== 'custom') return false
          if (day.date < todayStr) return false
          // Skip today if explicitly told to (all slots were past) or very late in the day
          if (day.date === todayStr && isLateTodaySkip) return false
          return true
        })
        if (next) {
          setSelectedDate(next.date)
          setAutoSelectedDate(true)
          setDateSearching(false)
          return
        }
      } catch {
        // ignore - let user pick manually
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

      const resp = await apiService.createBooking({
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

      // Payment module: booking created in payment_pending → show payment step
      const created = resp?.data || resp
      if (created?.paymentId && created?.id) {
        setPaymentInfo({
          bookingId: created.id,
          paymentId: created.paymentId,
          amount: parseFloat(String(created.paymentAmount || selectedVet.consultationFee || 0)),
          expiresAt: created.paymentExpiresAt || null,
        })
      } else {
        setSuccess(true)
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || t('bookConsultation.failedToCreate'))
    } finally {
      setLoading(false)
    }
  }

  const handleDateChange = (date: string) => {
    setSelectedDate(date)
    setSelectedSlot(null)
    setAutoSelectedDate(false)
  }

  const handleSelectionModeChange = (mode: 'individual' | 'enterprise') => {
    setSelectionMode(mode)
    if (mode === 'individual') {
      setSelectedEnterprise('')
      setSelectedGroup('')
      setSelectedAnimal('')
    } else {
      setSelectedAnimal('')
    }
  }

  const handleCertPurposeChange = (ct: string) => {
    setCertPurpose(ct)
    if (ct) {
      const label = ct.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
      setReasonForVisit(`Certificate: ${label}`)
    } else {
      setReasonForVisit('')
    }
  }

  const handleStep3Continue = () => {
    if (reasonForVisit.trim().length < 3) {
      setStep3Error(t('bookConsultation.reasonTooShort'))
      return
    }
    setStep3Error('')
    setStep(4)
  }

  if (paymentInfo && !success) {
    return (
      <div className="module-page">
        <PaymentCheckout
          bookingId={paymentInfo.bookingId}
          amount={paymentInfo.amount}
          expiresAt={paymentInfo.expiresAt}
          onSuccess={() => { setPaymentInfo(null); setSuccess(true) }}
          onCancel={() => onNavigate('/my-bookings')}
        />
      </div>
    )
  }

  if (success) {
    return <BookingSuccessScreen onNavigate={onNavigate} />
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
          <button type="button" className="page-back-btn" onClick={() => onNavigate('/find-doctor')}>
            ← {t('common.back')}
          </button>
        </div>
      </div>

      <BookingProgressSteps
        step={step}
        labels={[
          t('bookConsultation.steps.selectDoctor'),
          t('bookConsultation.steps.chooseTime'),
          t('bookConsultation.steps.details'),
          t('bookConsultation.steps.confirm')
        ]}
      />

      {error && (
        <div className="toast toast-error si-ef1b80b9">
          {error}
        </div>
      )}

      {selectedVet && step > 1 && (
        <DoctorInfoPanel selectedVet={selectedVet} formatCurrency={formatCurrency} />
      )}

      {step === 1 && (
        <Step1SelectDoctor
          vets={vets}
          selectedVet={selectedVet}
          onSelectVet={setSelectedVet}
          onContinue={() => setStep(2)}
          formatCurrency={formatCurrency}
        />
      )}

      {step === 2 && (
        <Step2ChooseTime
          selectedDate={selectedDate}
          onDateChange={handleDateChange}
          dateSearching={dateSearching}
          autoSelectedDate={autoSelectedDate}
          bookingType={bookingType}
          onBookingTypeChange={setBookingType}
          isFarmerOrEnterprise={user?.role === 'farmer' || selectionMode === 'enterprise'}
          slotsLoading={slotsLoading}
          availableSlots={availableSlots}
          selectedSlot={selectedSlot}
          onSelectSlot={setSelectedSlot}
          onBack={() => setStep(1)}
          onContinue={() => setStep(3)}
          formatSlotTime={formatSlotTime}
        />
      )}

      {step === 3 && (
        <Step3Details
          prefilledContext={prefilledContext}
          isFarmer={isFarmer}
          isAdmin={isAdmin}
          selectionMode={selectionMode}
          onSelectionModeChange={handleSelectionModeChange}
          enterprises={enterprises}
          selectedEnterprise={selectedEnterprise}
          selectedEnterpriseName={selectedEnterpriseName}
          onEnterpriseChange={handleEnterpriseChange}
          groups={groups}
          selectedGroup={selectedGroup}
          selectedGroupName={selectedGroupName}
          onGroupChange={handleGroupChange}
          loadingEnterpriseData={loadingEnterpriseData}
          filteredEnterpriseAnimals={filteredEnterpriseAnimals}
          animals={animals}
          selectedAnimal={selectedAnimal}
          onSelectedAnimalChange={setSelectedAnimal}
          selectedAnimalObj={selectedAnimalObj}
          onNavigate={onNavigate}
          speciesLabel={speciesLabel}
          certPurpose={certPurpose}
          onCertPurposeChange={handleCertPurposeChange}
          reasonForVisit={reasonForVisit}
          onReasonForVisitChange={setReasonForVisit}
          step3Error={step3Error}
          onClearStep3Error={() => setStep3Error('')}
          symptoms={symptoms}
          onSymptomsChange={setSymptoms}
          priority={priority}
          onPriorityChange={setPriority}
          notes={notes}
          onNotesChange={setNotes}
          onBack={() => setStep(2)}
          onContinue={handleStep3Continue}
        />
      )}

      {step === 4 && (
        <Step4Confirm
          selectedVet={selectedVet}
          selectedDate={selectedDate}
          selectedSlot={selectedSlot}
          bookingType={bookingType}
          selectionMode={selectionMode}
          selectedEnterprise={selectedEnterprise}
          selectedEnterpriseName={selectedEnterpriseName}
          selectedGroupName={selectedGroupName}
          selectedAnimalObj={selectedAnimalObj}
          reasonForVisit={reasonForVisit}
          symptoms={symptoms}
          priority={priority}
          loading={loading}
          onBack={() => setStep(3)}
          onSubmit={handleSubmitBooking}
          formatCurrency={formatCurrency}
          speciesLabel={speciesLabel}
        />
      )}
    </div>
  )
}

export default BookConsultation

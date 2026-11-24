import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { useMasterData } from '../../context/MasterDataContext'
import apiService from '../../services/api'
import client from '../../services/api/client'
import { SubjectSummary } from '../../components/shared/SubjectSummary'
import { GroupSummary, groupFromConsultation, type ConsultationGroup } from '../../components/shared/GroupSummary'
import { Medication } from '../../types'
import PrescriptionLineForm, { type RecentLine } from '../../components/prescription/PrescriptionLineForm'
import { isFoodSegment } from '../../utils/withdrawal'
import { DateQuick, localIsoDate } from '../../components/mobile/DateQuick'
import '../../styles/modules.css'

import { userMessage } from '../../utils/userMessage'
interface PrescriptionWriterProps {
  consultationId?: string
  onNavigate: (path: string) => void
}

const PrescriptionWriter: React.FC<PrescriptionWriterProps> = ({ consultationId, onNavigate }) => {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { speciesLabel, farmMaster } = useMasterData()
  const params = new URLSearchParams(window.location.search)
  const conId = consultationId || params.get('consultationId') || ''
  const urlAnimalId = params.get('animalId') || ''

  const [diagnosis, setDiagnosis] = useState('')
  const [instructions, setInstructions] = useState('')
  const [followUpDate, setFollowUpDate] = useState('')
  // The day the course starts: today unless the vet says otherwise (food animals only - it decides when milk / meat can go again).
  const [courseStart, setCourseStart] = useState(localIsoDate())
  const [medications, setMedications] = useState<Medication[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  // Standalone patient/animal selection (when no consultationId)
  const [patients, setPatients] = useState<{ id: string; name: string; role: string }[]>([])
  const [animals, setAnimals] = useState<{ id: string; name: string; species: string }[]>([])
  const [selectedPetOwnerId, setSelectedPetOwnerId] = useState('')
  const [selectedAnimalId, setSelectedAnimalId] = useState(urlAnimalId)
  const [loadingPatients, setLoadingPatients] = useState(false)
  const [loadingAnimals, setLoadingAnimals] = useState(false)
  // Network pharmacy routing - auto-detected from animal's care contexts
  const [networkOptions, setNetworkOptions] = useState<{ id: string; name: string }[]>([])
  const [selectedNetworkId, setSelectedNetworkId] = useState<string | null>(null)

  const isVet = user?.role === 'veterinarian'
  const isAdmin = user?.role === 'admin'
  const isStandalone = !conId

  // The animal being prescribed for, so the vet sees pregnancy and milk BEFORE choosing a medicine.
  // Chosen in the selector, passed in the link, or - from a consultation - the consultation's own.
  const [consultationAnimalId, setConsultationAnimalId] = useState('')
  const [summaryAnimal, setSummaryAnimal] = useState<any>(null)
  // An appointment for a whole group: one prescription for the group, not one per head.
  const [consultationGroup, setConsultationGroup] = useState<ConsultationGroup | null>(null)
  // An appointment booked with no animal and no group (e.g. a general question): the vet chooses which of the owner's animals
  // the prescription is for - a prescription always has a subject.
  const [needsSubject, setNeedsSubject] = useState(false)
  const [consultationOwnerId, setConsultationOwnerId] = useState('')
  const [ownerAnimals, setOwnerAnimals] = useState<{ id: string; name: string; species: string }[]>([])
  const [ownerAnimalsLoaded, setOwnerAnimalsLoaded] = useState(false)
  useEffect(() => {
    if (!conId) return
    let cancelled = false
    apiService.getConsultation(conId)
      .then((res: any) => { if (!cancelled) { setConsultationAnimalId(res?.data?.animalId || res?.data?.animal_id || ''); setConsultationGroup(groupFromConsultation(res?.data)); setConsultationOwnerId(res?.data?.userId || ''); setNeedsSubject(!res?.data?.animalId && !res?.data?.animal_id && !res?.data?.groupId) } })
      .catch(() => { /* the summary is a courtesy; the prescription does not depend on it */ })
    return () => { cancelled = true }
  }, [conId])
  const summaryAnimalId = selectedAnimalId || urlAnimalId || consultationAnimalId
  useEffect(() => {
    if (!needsSubject || !consultationOwnerId) return
    let cancelled = false
    apiService.listAnimals({ limit: 100, ownerId: consultationOwnerId })
      .then((res: any) => {
        if (cancelled) return
        const list = res.data?.animals || res.data?.items || (Array.isArray(res.data) ? res.data : [])
        setOwnerAnimals(list.map((a: any) => ({ id: a.id, name: a.name, species: a.species })))
        if (list.length === 1) setSelectedAnimalId(list[0].id)
      })
      .catch(() => { if (!cancelled) setOwnerAnimals([]) })
      .finally(() => { if (!cancelled) setOwnerAnimalsLoaded(true) })
    return () => { cancelled = true }
  }, [needsSubject, consultationOwnerId])
  useEffect(() => {
    if (!summaryAnimalId) { setSummaryAnimal(null); return }
    let cancelled = false
    apiService.getAnimal(summaryAnimalId)
      .then((res: any) => { if (!cancelled) setSummaryAnimal(res?.data || null) })
      .catch(() => { if (!cancelled) setSummaryAnimal(null) })
    return () => { cancelled = true }
  }, [summaryAnimalId])

  // Load all animals directly when animalId is pre-selected
  useEffect(() => {
    if (!isStandalone || (!isVet && !isAdmin)) return
    const loadPatients = async () => {
      try {
        setLoadingPatients(true)
        const res = await apiService.listPatients({ limit: 200 })
        const users = res.data?.users || (Array.isArray(res.data) ? res.data : [])
        setPatients(users.map((u: any) => ({ id: u.id, name: `${u.firstName || u.first_name} ${u.lastName || u.last_name}`, role: u.role })))
      } catch { setPatients([]) }
      finally { setLoadingPatients(false) }
    }
    loadPatients()
  }, [isStandalone, isVet, isAdmin])

  // Load animals when a pet owner is selected, or when animalId is pre-selected
  useEffect(() => {
    if (!isStandalone) return
    if (!selectedPetOwnerId && !urlAnimalId) { setAnimals([]); return }
    const loadAnimals = async () => {
      try {
        setLoadingAnimals(true)
        const queryParams: any = { limit: 100 }
        if (selectedPetOwnerId) queryParams.ownerId = selectedPetOwnerId
        const res = await apiService.listAnimals(queryParams)
        const list = res.data?.animals || res.data?.items || (Array.isArray(res.data) ? res.data : [])
        setAnimals(list.map((a: any) => ({ id: a.id, name: a.name, species: a.species })))
        if (list.length === 1 && !selectedAnimalId) setSelectedAnimalId(list[0].id)
      } catch { setAnimals([]) }
      finally { setLoadingAnimals(false) }
    }
    loadAnimals()
  }, [selectedPetOwnerId, urlAnimalId, isStandalone])

  // Auto-detect network enrollment for selected animal → pharmacy routing
  useEffect(() => {
    const animalId = selectedAnimalId || urlAnimalId
    if (!animalId) {
      setNetworkOptions([]); setSelectedNetworkId(null)
      return
    }
    client.get(`/animals/${animalId}/care-contexts`)
      .then(res => {
        const contexts: any[] = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : []
        const activeContexts = contexts.filter(c => c.enrollmentStatus === 'active' || !c.enrollmentStatus)
        setNetworkOptions(activeContexts.map((c: any) => ({ id: c.networkId, name: c.networkName })))
        if (activeContexts.length === 1) {
          setSelectedNetworkId(activeContexts[0].networkId)
        } else {
          setSelectedNetworkId(null)
        }
      })
      .catch(() => { setNetworkOptions([]); setSelectedNetworkId(null) })
  }, [selectedAnimalId, urlAnimalId])

  // The vet's OWN recent medicines (with the label days they typed) fill a line in one tap; the platform lists no medicine.
  const [recentLines, setRecentLines] = useState<RecentLine[]>([])
  useEffect(() => {
    if (!isVet && !isAdmin) return
    apiService.myRecentPrescriptionLines().then((res: any) => setRecentLines(res?.data || [])).catch(() => setRecentLines([]))
  }, [isVet, isAdmin])

  // A food-producing animal or herd (master data: the species' farm segment) needs the label's withdrawal days on each medicine line.
  const subjectSpecies: string | null = consultationGroup?.groupSpecies
    || summaryAnimal?.species
    || [...animals, ...ownerAnimals].find(a => a.id === (selectedAnimalId || consultationAnimalId || urlAnimalId))?.species
    || null
  const foodProducing = isFoodSegment(farmMaster.species.find(sp => sp.code === subjectSpecies)?.farmSegment)

  const removeMedication = (index: number) => {
    setMedications(medications.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (isStandalone && (isVet || isAdmin) && !selectedPetOwnerId) {
      setError(t('prescriptionWriter.errorPatientRequired'))
      return
    }
    if (needsSubject && !selectedAnimalId) { setError(t('prescriptionWriter.errorAnimalRequired')); return }
    if (!diagnosis.trim()) { setError(t('prescriptionWriter.errorDiagnosisRequired')); return }
    if (medications.length === 0) { setError(t('prescriptionWriter.errorMedicationRequired')); return }

    try {
      setSubmitting(true)
      await apiService.createPrescription({
        consultationId: conId || undefined,
        petOwnerId: selectedPetOwnerId || undefined,
        animalId: selectedAnimalId || undefined,
        diagnosis,
        medications,
        instructions: instructions || '',
        followUpDate: followUpDate || undefined,
        ...(foodProducing && courseStart !== localIsoDate() ? { courseStartOn: courseStart } : {}),
        networkId: selectedNetworkId || undefined,
      } as any)
      setSubmitted(true)
    } catch (err: any) {
      setError(userMessage(err, 'prescriptionWriter.failedToCreate'))
    } finally {
      setSubmitting(false)
    }
  }

  // Auto-redirect back to consultation after prescription is created
  const [redirectCountdown, setRedirectCountdown] = useState(3)
  React.useEffect(() => {
    if (!submitted || !conId) return
    if (redirectCountdown <= 0) {
      onNavigate(`/doctor/consultation-room/${conId}`)
      return
    }
    const timer = setTimeout(() => setRedirectCountdown(prev => prev - 1), 1000)
    return () => clearTimeout(timer)
  }, [submitted, conId, redirectCountdown])

  if (submitted) {
    return (
      <div className="module-page">
        <div className="si-bd60beb2">
          <div className="si-7615cf7c">💊</div>
          <h1 className="si-dab75309">{t('prescriptionWriter.prescriptionCreated')}</h1>
          <p className="si-6bc9c38d">
            {t('prescriptionWriter.medicationsPrescribed', { count: medications.length })}
          </p>
          {conId ? (
            <>
              <p className="si-bff71ae0">
                {t('prescriptionWriter.returningToConsultation', { seconds: redirectCountdown })}
              </p>
              <div className="si-7b7a3b80">
                <button className="btn btn-primary" onClick={() => onNavigate(`/doctor/consultation-room/${conId}`)}>
                  ← {t('prescriptionWriter.backToConsultationNow')}
                </button>
                <button className="btn btn-outline" onClick={() => {
                  setRedirectCountdown(999)
                  setSubmitted(false); setMedications([]); setDiagnosis('')
                }}>
                  {t('prescriptionWriter.writeAnotherPrescription')}
                </button>
              </div>
            </>
          ) : (
            <div className="si-7b7a3b80">
              <button className="btn btn-primary" onClick={() => onNavigate('/dashboard')}>
                {t('prescriptionWriter.dashboard')}
              </button>
              <button className="btn btn-outline" onClick={() => { setSubmitted(false); setMedications([]); setDiagnosis(''); }}>
                {t('prescriptionWriter.writeAnother')}
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <h1>{t('prescriptionWriter.title')}</h1>
          <p className="page-subtitle">{t('prescriptionWriter.subtitle')}</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={() => onNavigate(conId ? `/doctor/consultation-room/${conId}` : '/dashboard')}>
            ← {t('prescriptionWriter.back')}
          </button>
        </div>
      </div>

      {error && (
        <div className="si-2d8d745c">
          {error}
        </div>
      )}

      {!summaryAnimal && consultationGroup && <GroupSummary group={consultationGroup} />}
      {summaryAnimal && (
        <div className="si-af65fe13">
          <SubjectSummary animal={summaryAnimal} emphasis showFarm />
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {needsSubject && (
          <div className="card si-af65fe13">
            <div className="card-header"><h2>🐾 {t('prescriptionWriter.chooseSubjectTitle')}</h2></div>
            <div className="card-body">
              <p className="rx-subject-hint">{t('prescriptionWriter.chooseSubjectHint')}</p>
              {ownerAnimalsLoaded && ownerAnimals.length === 0 ? (
                <p className="rx-subject-hint" role="status">{t('prescriptionWriter.ownerHasNoAnimals')}</p>
              ) : (
                <select className="module-input" aria-label={t('prescriptionWriter.selectAnimal')} value={selectedAnimalId} onChange={e => setSelectedAnimalId(e.target.value)}>
                  <option value="">{t('prescriptionWriter.chooseAnimal')}</option>
                  {ownerAnimals.map(a => <option key={a.id} value={a.id}>{a.name} ({speciesLabel(a.species, t)})</option>)}
                </select>
              )}
            </div>
          </div>
        )}
        {/* Standalone patient/animal selector */}
        {isStandalone && (isVet || isAdmin) && (
          <div className="card si-af65fe13">
            <div className="card-header"><h2>👤 {t('prescriptionWriter.patientSelection')}</h2></div>
            <div className="card-body">
              <div className="module-form-row">
                <div className="module-form-group">
                  <label className="module-label">{t('prescriptionWriter.selectPatient')} *</label>
                  {loadingPatients ? (
                    <p className="si-09dee8a9">{t('prescriptionWriter.loadingPatients')}</p>
                  ) : (
                    <select
                      className="module-input"
                      value={selectedPetOwnerId}
                      onChange={e => { setSelectedPetOwnerId(e.target.value); setSelectedAnimalId(''); setAnimals([]) }}
                    >
                      <option value="">{t('prescriptionWriter.choosePatient')}</option>
                      {patients.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="module-form-group">
                  <label className="module-label">{t('prescriptionWriter.selectAnimal')}</label>
                  {loadingAnimals ? (
                    <p className="si-09dee8a9">{t('prescriptionWriter.loadingAnimals')}</p>
                  ) : (
                    <select
                      className="module-input"
                      value={selectedAnimalId}
                      onChange={e => setSelectedAnimalId(e.target.value)}
                      disabled={!selectedPetOwnerId && !urlAnimalId}
                    >
                      <option value="">{t('prescriptionWriter.chooseAnimal')}</option>
                      {animals.map(a => (
                        <option key={a.id} value={a.id}>{a.name} ({speciesLabel(a.species, t)})</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
              {/* Network pharmacy routing indicator */}
              {networkOptions.length > 0 && (
                <div className="si-b491f410">
                  <div style={{ fontSize: '0.87rem', fontWeight: 600, color: '#2e7d32', marginBottom: networkOptions.length > 1 ? 8 : 0 }}>
                    💊 {networkOptions.length === 1
                      ? `${t('prescriptions.pharmacy.autoRouted')} ${networkOptions[0].name}`
                      : t('prescriptions.pharmacy.selectNetwork')}
                  </div>
                  {networkOptions.length > 1 && (
                    <select
                      className="module-input si-f48bb60f"
                     
                      value={selectedNetworkId || ''}
                      onChange={e => setSelectedNetworkId(e.target.value || null)}
                    >
                      <option value="">{t('prescriptions.pharmacy.noRouting')}</option>
                      {networkOptions.map(n => (
                        <option key={n.id} value={n.id}>{n.name}</option>
                      ))}
                    </select>
                  )}
                  {networkOptions.length === 1 && (
                    <div className="si-d4883bd1">
                      {t('prescriptions.pharmacy.routingNote')}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="si-e1725f0f">
          {/* Left: Diagnosis & Instructions */}
          <div>
            <div className="card">
              <div className="card-header"><h2>🩺 {t('prescriptionWriter.diagnosisAndNotes')}</h2></div>
              <div className="card-body">
                <div className="form-group">
                  <label className="form-label">{t('prescriptionWriter.diagnosis')} *</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder={t('prescriptionWriter.enterDiagnosis')}
                    value={diagnosis}
                    onChange={e => setDiagnosis(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('prescriptionWriter.generalInstructions')}</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder={t('prescriptionWriter.instructionsPlaceholder')}
                    value={instructions}
                    onChange={e => setInstructions(e.target.value)}
                  />
                </div>
                {foodProducing && (
                  <div className="form-group">
                    <DateQuick label={t('prescriptionWriter.courseStart')} value={courseStart} onChange={setCourseStart} max={localIsoDate(14)} allowTomorrow />
                    <p className="wd-hint">{t('prescriptionWriter.courseStartHint')}</p>
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">{t('prescriptionWriter.followUpDate')}</label>
                  <input
                    className="form-input"
                    type="date"
                    value={followUpDate}
                    onChange={e => setFollowUpDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right: Medications */}
          <div>
            <div className="card">
              <div className="card-header">
                <h2>💊 {t('prescriptionWriter.medications')} ({medications.length})</h2>
              </div>
              <div className="card-body">
                {/* Current Medications */}
                {medications.map((med, i) => (
                  <div key={i} className="si-b081583e">
                    <button
                      type="button"
                      className="si-74524240"
                      onClick={() => removeMedication(i)}
                    >✕</button>
                    <strong>{med.name}</strong>
                    <p className="si-65fb0667">
                      {med.dosage} • {med.frequency} • {med.duration || 'As needed'}
                    </p>
                    {(med.withdrawalMilkDays !== undefined || med.withdrawalNone) && (
                      <p className="wd-hint">{t('withdrawal.lineSummary', { milk: med.withdrawalMilkDays ?? 0, meat: med.withdrawalMeatDays ?? 0 })}</p>
                    )}
                    {med.instructions && (
                      <p className="si-4debe0bb">
                        📝 {med.instructions}
                      </p>
                    )}
                  </div>
                ))}

                <PrescriptionLineForm foodProducing={foodProducing} recent={recentLines} onAdd={line => setMedications(m => [...m, line as Medication])} />
              </div>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="si-94316ddc">
          <button type="button" className="btn btn-outline" onClick={() => onNavigate(conId ? `/doctor/consultation-room/${conId}` : '/dashboard')}>{t('prescriptionWriter.cancel')}</button>
          <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
            {submitting ? t('prescriptionWriter.creating') : `💊 ${t('prescriptionWriter.createPrescription')}`}
          </button>
        </div>
      </form>
    </div>
  )
}

export default PrescriptionWriter

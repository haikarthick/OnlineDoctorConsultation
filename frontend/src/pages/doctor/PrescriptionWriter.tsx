import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import apiService from '../../services/api'
import client from '../../services/api/client'
import { Medication } from '../../types'
import '../../styles/modules.css'

interface PrescriptionWriterProps {
  consultationId?: string
  onNavigate: (path: string) => void
}

const PrescriptionWriter: React.FC<PrescriptionWriterProps> = ({ consultationId, onNavigate }) => {
  const { t } = useTranslation()
  const { user } = useAuth()
  const params = new URLSearchParams(window.location.search)
  const conId = consultationId || params.get('consultationId') || ''
  const urlAnimalId = params.get('animalId') || ''

  // Pre-populate medications from query param (Common Prescriptions templates)
  const getInitialMeds = (): Medication[] => {
    try {
      const medsParam = params.get('meds')
      if (medsParam) return JSON.parse(decodeURIComponent(medsParam))
    } catch { /* ignore parse errors */ }
    return []
  }

  const [diagnosis, setDiagnosis] = useState('')
  const [instructions, setInstructions] = useState('')
  const [followUpDate, setFollowUpDate] = useState('')
  const [medications, setMedications] = useState<Medication[]>(getInitialMeds)
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
  // Network pharmacy routing — auto-detected from animal's care contexts
  const [networkOptions, setNetworkOptions] = useState<{ id: string; name: string }[]>([])
  const [selectedNetworkId, setSelectedNetworkId] = useState<string | null>(null)

  const isVet = user?.role === 'veterinarian'
  const isAdmin = user?.role === 'admin'
  const isStandalone = !conId

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

  // New med form
  const [newMed, setNewMed] = useState<Medication>({
    name: '', dosage: '', frequency: '', duration: '', instructions: ''
  })

  const addMedication = () => {
    if (!newMed.name || !newMed.dosage || !newMed.frequency) {
      setError(t('prescriptionWriter.errorNameDosageFrequency'))
      return
    }
    setMedications([...medications, { ...newMed }])
    setNewMed({ name: '', dosage: '', frequency: '', duration: '', instructions: '' })
    setError('')
  }

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
        networkId: selectedNetworkId || undefined,
      } as any)
      setSubmitted(true)
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || t('prescriptionWriter.failedToCreate'))
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
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ fontSize: 64, marginBottom: 20 }}>💊</div>
          <h1 style={{ marginBottom: 8 }}>{t('prescriptionWriter.prescriptionCreated')}</h1>
          <p style={{ color: '#6b7280', fontSize: 16, marginBottom: 24 }}>
            {t('prescriptionWriter.medicationsPrescribed', { count: medications.length })}
          </p>
          {conId ? (
            <>
              <p style={{ color: '#667eea', fontSize: 14, marginBottom: 20 }}>
                {t('prescriptionWriter.returningToConsultation', { seconds: redirectCountdown })}
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
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
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
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
        <div style={{ padding: '12px 16px', background: '#fef2f2', color: '#dc2626', borderRadius: 8, marginBottom: 20, fontSize: 14 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Standalone patient/animal selector */}
        {isStandalone && (isVet || isAdmin) && (
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header"><h2>👤 {t('prescriptionWriter.patientSelection')}</h2></div>
            <div className="card-body">
              <div className="module-form-row">
                <div className="module-form-group">
                  <label className="module-label">{t('prescriptionWriter.selectPatient')} *</label>
                  {loadingPatients ? (
                    <p style={{ fontSize: 14, color: '#6b7280' }}>{t('prescriptionWriter.loadingPatients')}</p>
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
                    <p style={{ fontSize: 14, color: '#6b7280' }}>{t('prescriptionWriter.loadingAnimals')}</p>
                  ) : (
                    <select
                      className="module-input"
                      value={selectedAnimalId}
                      onChange={e => setSelectedAnimalId(e.target.value)}
                      disabled={!selectedPetOwnerId && !urlAnimalId}
                    >
                      <option value="">{t('prescriptionWriter.chooseAnimal')}</option>
                      {animals.map(a => (
                        <option key={a.id} value={a.id}>{a.name} ({a.species})</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
              {/* Network pharmacy routing indicator */}
              {networkOptions.length > 0 && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: '#e8f5e9', borderRadius: 8, border: '1px solid #a5d6a7' }}>
                  <div style={{ fontSize: '0.87rem', fontWeight: 600, color: '#2e7d32', marginBottom: networkOptions.length > 1 ? 8 : 0 }}>
                    💊 {networkOptions.length === 1
                      ? `${t('prescriptions.pharmacy.autoRouted')} ${networkOptions[0].name}`
                      : t('prescriptions.pharmacy.selectNetwork')}
                  </div>
                  {networkOptions.length > 1 && (
                    <select
                      className="module-input"
                      style={{ marginTop: 4 }}
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
                    <div style={{ fontSize: '0.8rem', color: '#388e3c', marginTop: 2 }}>
                      {t('prescriptions.pharmacy.routingNote')}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
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
                  <div key={i} style={{
                    padding: 12, background: '#f0fdf4', borderRadius: 8, marginBottom: 10,
                    border: '1px solid #bbf7d0', position: 'relative'
                  }}>
                    <button
                      type="button"
                      style={{
                        position: 'absolute', top: 6, right: 6, background: 'none',
                        border: 'none', cursor: 'pointer', fontSize: 16, color: '#dc2626'
                      }}
                      onClick={() => removeMedication(i)}
                    >✕</button>
                    <strong>{med.name}</strong>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: '#4b5563' }}>
                      {med.dosage} • {med.frequency} • {med.duration || 'As needed'}
                    </p>
                    {med.instructions && (
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>
                        📝 {med.instructions}
                      </p>
                    )}
                  </div>
                ))}

                {/* Add Medication Form */}
                <div style={{ padding: 12, background: '#f9fafb', borderRadius: 8, border: '1px dashed #d1d5db' }}>
                  <h4 style={{ margin: '0 0 10px', fontSize: 14 }}>+ {t('prescriptionWriter.addMedication')}</h4>
                  <div className="form-group">
                    <input className="form-input" placeholder={t('prescriptionWriter.medicationName')} value={newMed.name}
                      onChange={e => setNewMed({ ...newMed, name: e.target.value })} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <input className="form-input" placeholder={t('prescriptionWriter.dosage')} value={newMed.dosage}
                      onChange={e => setNewMed({ ...newMed, dosage: e.target.value })} />
                    <input className="form-input" placeholder={t('prescriptionWriter.frequency')} value={newMed.frequency}
                      onChange={e => setNewMed({ ...newMed, frequency: e.target.value })} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                    <input className="form-input" placeholder={t('prescriptionWriter.duration')} value={newMed.duration}
                      onChange={e => setNewMed({ ...newMed, duration: e.target.value })} />
                    <input className="form-input" placeholder={t('prescriptionWriter.instructions')} value={newMed.instructions}
                      onChange={e => setNewMed({ ...newMed, instructions: e.target.value })} />
                  </div>
                  <button type="button" className="btn btn-outline" style={{ marginTop: 10, width: '100%' }} onClick={addMedication}>
                    + {t('prescriptionWriter.addMedication')}
                  </button>
                </div>

                {/* Quick Add Templates */}
                <div style={{ marginTop: 12 }}>
                  <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>{t('prescriptionWriter.quickAdd')}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {[
                      { name: 'Amoxicillin', dosage: '250mg', frequency: 'Twice daily', duration: '7 days' },
                      { name: 'Meloxicam', dosage: '0.1mg/kg', frequency: 'Once daily', duration: '5 days' },
                      { name: 'Metronidazole', dosage: '15mg/kg', frequency: 'Twice daily', duration: '10 days' }
                    ].map(template => (
                      <button
                        key={template.name}
                        type="button"
                        className="btn btn-outline"
                        style={{ fontSize: 12, padding: '4px 8px' }}
                        onClick={() => setMedications([...medications, { ...template, instructions: '' }])}
                      >
                        + {template.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
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

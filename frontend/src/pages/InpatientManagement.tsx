import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../context/SettingsContext'
import { useMasterData } from '../context/MasterDataContext'
import { vetHospitalApi } from '../services/api/vetHospitalApi'
import apiService from '../services/api'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import { InpatientStatsPanel } from '../components/inpatient/InpatientStatsPanel'
import { InpatientStatusFilters } from '../components/inpatient/InpatientStatusFilters'
import { InpatientCard } from '../components/inpatient/InpatientCard'
import { AdmitPatientModal, type AdmitForm } from '../components/inpatient/AdmitPatientModal'
import { RecordVitalsModal, type VitalsForm } from '../components/inpatient/RecordVitalsModal'
import { VitalsHistoryModal } from '../components/inpatient/VitalsHistoryModal'
import { MedicalHistoryModal } from '../components/inpatient/MedicalHistoryModal'

export default function InpatientManagement() {
  const { t } = useTranslation()
  const { formatDateTime, formatCurrency } = useSettings()
  const { speciesLabel } = useMasterData()

  const [hospitalId, setHospitalId] = useState('')
  const [hospitals, setHospitals] = useState<any[]>([])
  const [patients, setPatients] = useState<any[]>([])
  const [dashboard, setDashboard] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showAdmit, setShowAdmit] = useState(false)
  const [showVitals, setShowVitals] = useState<any>(null)
  const [vitalsError, setVitalsError] = useState('')
  const [vitalsSubmitting, setVitalsSubmitting] = useState(false)
  const [showVitalsHistory, setShowVitalsHistory] = useState<any>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [admitAnimal, setAdmitAnimal] = useState<any>(null)
  const [viewHistory, setViewHistory] = useState<any>(null)
  const [medicalHistory, setMedicalHistory] = useState<any>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)

  const [admitForm, setAdmitForm] = useState<AdmitForm>({
    admissionType: 'overnight_observation', roomNumber: '', bedNumber: '',
    careInstructions: '', specialNeeds: '', estimatedDischarge: '', dailyRate: 0,
  })
  const [admitError, setAdmitError] = useState('')
  const [admitSubmitting, setAdmitSubmitting] = useState(false)
  const [vitalsForm, setVitalsForm] = useState<VitalsForm>({ temperature: '', heartRate: '', weight: '', notes: '' })

  useEffect(() => {
    (async () => {
      try {
        const list = await vetHospitalApi.listMyHospitals()
        setHospitals(list || [])
        if (list.length > 0) setHospitalId(list[0].id)
      } catch { /* empty */ }
    })()
  }, [])

  const loadData = useCallback(async () => {
    if (!hospitalId) return
    setLoading(true)
    try {
      const [p, d] = await Promise.all([
        apiService.listInpatients(hospitalId, statusFilter || undefined),
        apiService.getInpatientDashboard(hospitalId),
      ])
      setPatients(p.data || [])
      setDashboard(d.data || null)
    } catch { /* empty */ }
    setLoading(false)
  }, [hospitalId, statusFilter])

  useEffect(() => { loadData() }, [loadData])
  useAutoRefresh('inpatients', loadData)

  function closeAdmitModal() {
    setShowAdmit(false)
    setAdmitAnimal(null)
    setAdmitError('')
  }

  async function handleAdmit() {
    if (!hospitalId || !admitAnimal) return
    setAdmitError('')
    setAdmitSubmitting(true)
    try {
      await apiService.admitPatient(hospitalId, {
        ...admitForm,
        animalId: admitAnimal.id,
        ownerId: admitAnimal.owner_id,
      })
      setShowAdmit(false)
      setAdmitAnimal(null)
      setAdmitError('')
      setAdmitForm({ admissionType: 'overnight_observation', roomNumber: '', bedNumber: '', careInstructions: '', specialNeeds: '', estimatedDischarge: '', dailyRate: 0 })
      loadData()
    } catch (err: any) {
      setAdmitError(err?.response?.data?.error || err?.message || 'Failed to admit patient. Please try again.')
    }
    setAdmitSubmitting(false)
  }

  async function handleStatusChange(id: string, status: string) {
    try {
      await apiService.updateInpatientStatus(id, status)
      loadData()
    } catch { /* empty */ }
  }

  function closeVitalsModal() {
    setShowVitals(null)
    setVitalsError('')
  }

  async function handleVitalsSubmit() {
    if (!showVitals) return
    setVitalsError('')
    // Validate: no negative values
    const temp = vitalsForm.temperature ? parseFloat(vitalsForm.temperature) : null
    const hr = vitalsForm.heartRate ? parseInt(vitalsForm.heartRate) : null
    const wt = vitalsForm.weight ? parseFloat(vitalsForm.weight) : null
    if ((temp !== null && temp <= 0) || (hr !== null && hr <= 0) || (wt !== null && wt <= 0)) {
      setVitalsError(t('inpatientManagement.vitalsErrorNegative'))
      return
    }
    setVitalsSubmitting(true)
    try {
      const data: Record<string, unknown> = { notes: vitalsForm.notes }
      if (temp !== null) data.temperature = temp
      if (hr !== null) data.heartRate = hr
      if (wt !== null) data.weight = wt
      await apiService.addVitalsLog(showVitals.id, data)
      setShowVitals(null)
      setVitalsForm({ temperature: '', heartRate: '', weight: '', notes: '' })
      loadData()
    } catch (err: any) {
      setVitalsError(err?.response?.data?.error || err?.message || 'Failed to save vitals. Please try again.')
    }
    setVitalsSubmitting(false)
  }

  async function loadMedicalHistory(patient: any) {
    if (!patient.animal_id) return
    setViewHistory(patient)
    setLoadingHistory(true)
    setMedicalHistory(null)
    try {
      const res = await apiService.getAnimalMedicalSummary(patient.animal_id)
      setMedicalHistory(res.data || null)
    } catch { /* empty */ }
    setLoadingHistory(false)
  }

  return (
    <div className="module-page si-5cec5e87">
      <div className="si-a307e2db">
        <div>
          <h1 className="si-1bc3a9fe">🛏️ {t('inpatientManagement.title')}</h1>
          <p className="si-d078dad1">{t('inpatientManagement.subtitle')}</p>
        </div>
        <div className="si-d223efb3">
          {hospitals.length > 1 && (
            <select value={hospitalId} onChange={e => setHospitalId(e.target.value)} className="si-89cf1ca1">
              {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          )}
          <button onClick={() => setShowAdmit(true)} className="si-880bdf60">+ {t('inpatientManagement.admitPatient')}</button>
        </div>
      </div>

      {dashboard && (
        <InpatientStatsPanel dashboard={dashboard} statusFilter={statusFilter} onFilterChange={setStatusFilter} t={t} />
      )}

      <InpatientStatusFilters statusFilter={statusFilter} onChange={setStatusFilter} t={t} />

      {/* Patient Cards */}
      {loading ? (
        <div className="si-9fa8d292"><div className="spinner" /></div>
      ) : (
        <div className="si-ce7dfd54">
          {patients.length === 0 && <p className="si-2128b2c3">{t('inpatientManagement.noInpatients')}</p>}
          {patients.map(p => (
            <InpatientCard
              key={p.id}
              p={p}
              t={t}
              formatDateTime={formatDateTime}
              formatCurrency={formatCurrency}
              speciesLabel={speciesLabel}
              onShowVitals={setShowVitals}
              onShowVitalsHistory={setShowVitalsHistory}
              onLoadMedicalHistory={loadMedicalHistory}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}

      {showAdmit && (
        <AdmitPatientModal
          admitAnimal={admitAnimal}
          admitForm={admitForm}
          admitError={admitError}
          admitSubmitting={admitSubmitting}
          t={t}
          onSelectAnimal={a => { setAdmitAnimal(a); setAdmitError('') }}
          onFormChange={setAdmitForm}
          onSubmit={handleAdmit}
          onClose={closeAdmitModal}
        />
      )}

      {showVitals && (
        <RecordVitalsModal
          animalName={showVitals.animal_name}
          vitalsForm={vitalsForm}
          vitalsError={vitalsError}
          vitalsSubmitting={vitalsSubmitting}
          t={t}
          onFormChange={setVitalsForm}
          onSubmit={handleVitalsSubmit}
          onClose={closeVitalsModal}
        />
      )}

      {showVitalsHistory && (
        <VitalsHistoryModal
          patient={showVitalsHistory}
          t={t}
          formatDateTime={formatDateTime}
          onClose={() => setShowVitalsHistory(null)}
        />
      )}

      {viewHistory && (
        <MedicalHistoryModal
          patient={viewHistory}
          medicalHistory={medicalHistory}
          loadingHistory={loadingHistory}
          t={t}
          formatDateTime={formatDateTime}
          speciesLabel={speciesLabel}
          onClose={() => { setViewHistory(null); setMedicalHistory(null) }}
        />
      )}
    </div>
  )
}

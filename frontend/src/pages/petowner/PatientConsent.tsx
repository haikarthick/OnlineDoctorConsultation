import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../../context/SettingsContext'
import { useMasterData } from '../../context/MasterDataContext'
import apiService from '../../services/api'
import '../../styles/modules.css'
import './PatientConsent.css'
import AnimalSidebar from '../../components/patientConsent/AnimalSidebar'
import ConsentCard from '../../components/patientConsent/ConsentCard'
import GrantConsentModal from '../../components/patientConsent/GrantConsentModal'
import type { Animal, PatientConsent, ScopeType, ConsentFormState } from '../../components/patientConsent/patientConsentShared'
import { DEFAULT_FORM, todayISO, tomorrowISO } from '../../components/patientConsent/patientConsentShared'

const PatientConsentPage: React.FC = () => {
  const { t } = useTranslation()
  const { formatDate } = useSettings()
  const { speciesLabel } = useMasterData()

  const [animals, setAnimals] = useState<Animal[]>([])
  const [animalsLoading, setAnimalsLoading] = useState(true)
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null)

  const [consents, setConsents] = useState<PatientConsent[]>([])
  const [consentsLoading, setConsentsLoading] = useState(false)

  const [consentCounts, setConsentCounts] = useState<Record<string, number>>({})

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<ConsentFormState>({ ...DEFAULT_FORM })
  const [submitting, setSubmitting] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [grantToLabel, setGrantToLabel] = useState('')

  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    setAnimalsLoading(true)
    apiService.listAnimals()
      .then((res: any) => {
        // Backend returns { success: true, data: { animals: [...], total: N } }
        const list: Animal[] = Array.isArray(res?.data?.animals)
          ? res.data.animals
          : Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res)
          ? res
          : []
        setAnimals(list)
      })
      .catch(() => setErrorMsg('Failed to load animals.'))
      .finally(() => setAnimalsLoading(false))
  }, [])

  const loadConsents = useCallback((animalId: string) => {
    setConsentsLoading(true)
    apiService.listPatientConsents(animalId)
      .then((res: any) => {
        const list: PatientConsent[] = res?.data || res || []
        setConsents(list)
        setConsentCounts(prev => ({
          ...prev,
          [animalId]: list.filter((c: PatientConsent) => c.isActive).length,
        }))
      })
      .catch(() => setErrorMsg('Failed to load consents.'))
      .finally(() => setConsentsLoading(false))
  }, [])

  useEffect(() => {
    if (selectedAnimal) {
      setConsents([])
      loadConsents(selectedAnimal.id)
    }
  }, [selectedAnimal, loadConsents])

  useEffect(() => {
    if (!successMsg) return
    const timer = setTimeout(() => setSuccessMsg(''), 3000)
    return () => clearTimeout(timer)
  }, [successMsg])

  function openModal() {
    setForm({ ...DEFAULT_FORM, validFrom: todayISO() })
    setErrorMsg('')
    setShowModal(true)
  }

  function applyPreset(preset: 'view_only' | 'treatment' | 'emergency') {
    if (preset === 'view_only') {
      setForm(f => ({
        ...f,
        scope: 'view_only',
        allowMedicalRecords: true,
        allowVaccinationRecords: true,
        allowPrescriptions: false,
        allowLabResults: false,
        allowGeneticData: false,
        includeHospitalRecords: false,
        allowView: true,
        allowCreateNotes: false,
        allowPrescribe: false,
        validUntil: '',
      }))
    } else if (preset === 'treatment') {
      setForm(f => ({
        ...f,
        scope: 'treatment',
        allowMedicalRecords: true,
        allowVaccinationRecords: true,
        allowPrescriptions: true,
        allowLabResults: true,
        allowGeneticData: false,
        includeHospitalRecords: false,
        allowView: true,
        allowCreateNotes: true,
        allowPrescribe: true,
        validUntil: '',
      }))
    } else {
      setForm(f => ({
        ...f,
        scope: 'emergency',
        allowMedicalRecords: true,
        allowVaccinationRecords: true,
        allowPrescriptions: true,
        allowLabResults: true,
        allowGeneticData: true,
        includeHospitalRecords: true,
        allowView: true,
        allowCreateNotes: true,
        allowPrescribe: true,
        validUntil: tomorrowISO(),
      }))
    }
  }

  async function handleGrantConsent(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedAnimal) return
    if (!form.grantToId.trim()) {
      setErrorMsg('Please enter an ID for the recipient.')
      return
    }
    setSubmitting(true)
    setErrorMsg('')
    try {
      const payload: Record<string, any> = {
        animalId: selectedAnimal.id,
        consentScope: form.scope,
        allowMedicalRecords: form.allowMedicalRecords,
        allowVaccinationRecords: form.allowVaccinationRecords,
        allowPrescriptions: form.allowPrescriptions,
        allowLabResults: form.allowLabResults,
        allowGeneticData: form.allowGeneticData,
        includeHospitalRecords: form.includeHospitalRecords,
        allowView: form.allowView,
        allowCreateNotes: form.allowCreateNotes,
        allowPrescribe: form.allowPrescribe,
        validFrom: form.validFrom,
        validUntil: form.validUntil || null,
      }
      if (form.grantToType === 'doctor')   payload.grantedToUserId     = form.grantToId.trim()
      if (form.grantToType === 'hospital') payload.grantedToHospitalId = form.grantToId.trim()
      if (form.grantToType === 'network')  payload.grantedToNetworkId  = form.grantToId.trim()

      await apiService.createPatientConsent(payload)
      setShowModal(false)
      setSuccessMsg('Consent granted successfully.')
      loadConsents(selectedAnimal.id)
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || 'Failed to grant consent.'
      setErrorMsg(msg)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRevoke(consentId: string) {
    if (!window.confirm('Are you sure you want to revoke this consent? This cannot be undone.')) return
    setRevoking(consentId)
    setErrorMsg('')
    try {
      await apiService.revokePatientConsent(consentId)
      setSuccessMsg('Consent revoked.')
      if (selectedAnimal) loadConsents(selectedAnimal.id)
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || 'Failed to revoke consent.'
      setErrorMsg(msg)
    } finally {
      setRevoking(null)
    }
  }

  const totalConsents   = consents.length
  const activeConsents  = consents.filter(c => c.isActive).length
  const revokedConsents = consents.filter(c => !c.isActive).length

  function scopeLabel(scope: ScopeType): string {
    const map: Record<ScopeType, string> = {
      view_only:    t('patientConsent.scope.viewOnly'),
      full_history: t('patientConsent.scope.fullHistory'),
      treatment:    t('patientConsent.scope.treatment'),
      emergency:    t('patientConsent.scope.emergency'),
    }
    return map[scope] || scope
  }

  function scopeIcon(scope: ScopeType): string {
    const icons: Record<ScopeType, string> = {
      view_only: '🔍', full_history: '📋', treatment: '💊', emergency: '🚨',
    }
    return icons[scope] || '📄'
  }

  function grantedToDisplay(c: PatientConsent): string {
    if (c.grantedToUserName)     return c.grantedToUserName
    if (c.grantedToHospitalName) return c.grantedToHospitalName
    if (c.grantedToNetworkName)  return c.grantedToNetworkName
    if (c.grantedToUserId)       return c.grantedToUserId
    if (c.grantedToHospitalId)   return c.grantedToHospitalId
    if (c.grantedToNetworkId)    return c.grantedToNetworkId
    return '-'
  }

  function permissionItems(c: PatientConsent) {
    return [
      { key: 'medicalRecords',     label: t('patientConsent.permissions.medicalRecords'),     enabled: c.allowMedicalRecords },
      { key: 'vaccinationRecords', label: t('patientConsent.permissions.vaccinationRecords'), enabled: c.allowVaccinationRecords },
      { key: 'prescriptions',      label: t('patientConsent.permissions.prescriptions'),      enabled: c.allowPrescriptions },
      { key: 'labResults',         label: t('patientConsent.permissions.labResults'),         enabled: c.allowLabResults },
      { key: 'geneticData',        label: t('patientConsent.permissions.geneticData'),        enabled: c.allowGeneticData },
      { key: 'hospitalRecords',    label: t('patientConsent.permissions.hospitalRecords'),    enabled: c.includeHospitalRecords },
    ]
  }

  return (
    <div className="module-page pc-page">
      <div className="module-header">
        <h1>{t('patientConsent.title')}</h1>
        <p className="page-subtitle">{t('patientConsent.subtitle')}</p>
      </div>

      {successMsg && (
        <div className="module-alert success" role="status">✓ {successMsg}</div>
      )}
      {errorMsg && !showModal && (
        <div className="module-alert error" role="alert">⚠ {errorMsg}</div>
      )}

      <div className="pc-layout">
        <AnimalSidebar
          animals={animals}
          animalsLoading={animalsLoading}
          selectedAnimal={selectedAnimal}
          consentCounts={consentCounts}
          onSelect={setSelectedAnimal}
          speciesLabel={speciesLabel}
          t={t}
        />

        <main className="pc-main">
          {!selectedAnimal ? (
            <div className="pc-main-empty">
              <div className="pc-main-empty-icon">🔐</div>
              <div className="pc-main-empty-title">{t('patientConsent.selectAnimal')}</div>
              <div className="pc-main-empty-desc">
                Select an animal from the sidebar to manage their data consents
              </div>
            </div>
          ) : (
            <>
              <div className="pc-consent-header">
                <h2>{t('patientConsent.title')} - {selectedAnimal.name}</h2>
                <button className="module-btn primary" onClick={openModal}>
                  + {t('patientConsent.grantConsent')}
                </button>
              </div>

              <div className="pc-stats-row">
                <div className="pc-stat-card">
                  <div className="pc-stat-value">{totalConsents}</div>
                  <div className="pc-stat-label">Total Consents</div>
                </div>
                <div className="pc-stat-card">
                  <div className="pc-stat-value si-adb11626">{activeConsents}</div>
                  <div className="pc-stat-label">{t('patientConsent.status.active')}</div>
                </div>
                <div className="pc-stat-card">
                  <div className="pc-stat-value si-7d7d4e5e">{revokedConsents}</div>
                  <div className="pc-stat-label">{t('patientConsent.status.revoked')}</div>
                </div>
              </div>

              {consentsLoading ? (
                <div className="pc-loading"><div className="pc-spinner" /></div>
              ) : consents.length === 0 ? (
                <div className="pc-main-empty">
                  <div className="pc-main-empty-icon">🛡️</div>
                  <div className="pc-main-empty-title">{t('patientConsent.noConsents')}</div>
                  <div className="pc-main-empty-desc">
                    {t('patientConsent.noConsentsDesc')} - <strong>{selectedAnimal.name}</strong>.
                    Grant access only to trusted vets and hospitals.
                  </div>
                </div>
              ) : (
                <div className="pc-consent-list">
                  {consents.map(consent => (
                    <ConsentCard
                      key={consent.id}
                      consent={consent}
                      scopeLabel={scopeLabel}
                      scopeIcon={scopeIcon}
                      grantedToDisplay={grantedToDisplay}
                      permissionItems={permissionItems}
                      formatDate={formatDate}
                      t={t}
                      onRevoke={handleRevoke}
                      revoking={revoking}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      <GrantConsentModal
        show={showModal}
        form={form}
        setForm={setForm}
        errorMsg={errorMsg}
        submitting={submitting}
        grantToLabel={grantToLabel}
        setGrantToLabel={setGrantToLabel}
        onClose={() => setShowModal(false)}
        onSubmit={handleGrantConsent}
        applyPreset={applyPreset}
        t={t}
      />
    </div>
  )
}

export default PatientConsentPage

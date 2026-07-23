import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../../context/SettingsContext'
import { useMasterData } from '../../context/MasterDataContext'
import apiService from '../../services/api'
import SearchSelect, { SearchSelectOption } from '../../components/SearchSelect'
import '../../styles/modules.css'
import './PatientConsent.css'

interface Animal {
  id: string
  name: string
  species: string
  uniqueId?: string
  breed?: string
}

interface PatientConsent {
  id: string
  animalId: string
  ownerId: string
  grantedToUserId?: string
  grantedToHospitalId?: string
  grantedToNetworkId?: string
  consentScope: 'view_only' | 'full_history' | 'treatment' | 'emergency'
  allowMedicalRecords: boolean
  allowVaccinationRecords: boolean
  allowPrescriptions: boolean
  allowLabResults: boolean
  allowGeneticData: boolean
  includeHospitalRecords: boolean
  allowView: boolean
  allowCreateNotes: boolean
  allowPrescribe: boolean
  validFrom: string
  validUntil?: string
  isActive: boolean
  revokedAt?: string
  revokedReason?: string
  createdAt: string
  animalName?: string
  grantedToUserName?: string
  grantedToHospitalName?: string
  grantedToNetworkName?: string
}

type GrantToType = 'doctor' | 'hospital' | 'network'
type ScopeType = 'view_only' | 'full_history' | 'treatment' | 'emergency'

interface ConsentFormState {
  scope: ScopeType
  grantToType: GrantToType
  grantToId: string
  allowMedicalRecords: boolean
  allowVaccinationRecords: boolean
  allowPrescriptions: boolean
  allowLabResults: boolean
  allowGeneticData: boolean
  includeHospitalRecords: boolean
  allowView: boolean
  allowCreateNotes: boolean
  allowPrescribe: boolean
  validFrom: string
  validUntil: string
}

const SPECIES_EMOJI: Record<string, string> = {
  dog: '🐕', cat: '🐈', cow: '🐄', sheep: '🐑', horse: '🐴',
  pig: '🐖', goat: '🐐', rabbit: '🐇', bird: '🐦', fish: '🐟',
  default: '🐾',
}

function speciesEmoji(species: string): string {
  const key = (species || '').toLowerCase()
  return SPECIES_EMOJI[key] || SPECIES_EMOJI.default
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

function tomorrowISO(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

const DEFAULT_FORM: ConsentFormState = {
  scope: 'view_only',
  grantToType: 'doctor',
  grantToId: '',
  allowMedicalRecords: true,
  allowVaccinationRecords: true,
  allowPrescriptions: false,
  allowLabResults: false,
  allowGeneticData: false,
  includeHospitalRecords: false,
  allowView: true,
  allowCreateNotes: false,
  allowPrescribe: false,
  validFrom: todayISO(),
  validUntil: '',
}

interface ToggleProps {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  note?: string
}

const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label, note }) => (
  <div>
    <label className="consent-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
      />
      <span className="slider" />
      <span>{label}</span>
    </label>
    {note && <p className="pc-warning-note">⚠️ {note}</p>}
  </div>
)

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
    return '—'
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
    <div className="module-page">
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
        <aside className="pc-sidebar">
          <p className="pc-sidebar-title">Your Animals</p>

          {animalsLoading ? (
            <div className="pc-loading"><div className="pc-spinner" /></div>
          ) : animals.length === 0 ? (
            <p className="si-965ccfa5">
              No animals found.
            </p>
          ) : (
            animals.map(animal => {
              const activeCount = consentCounts[animal.id] ?? 0
              const isSelected = selectedAnimal?.id === animal.id
              return (
                <div
                  key={animal.id}
                  className={'pc-animal-card' + (isSelected ? ' active' : '')}
                  onClick={() => setSelectedAnimal(animal)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && setSelectedAnimal(animal)}
                  aria-pressed={isSelected}
                >
                  <div className="pc-animal-avatar">{speciesEmoji(animal.species)}</div>
                  <div className="pc-animal-info">
                    <div className="pc-animal-name">{animal.name}</div>
                    <div className="pc-animal-species">{speciesLabel(animal.species, t)}</div>
                  </div>
                  <span className={'pc-consent-count-badge' + (activeCount === 0 ? ' zero' : '')}>
                    {activeCount}
                  </span>
                </div>
              )
            })
          )}
        </aside>

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
                <h2>{t('patientConsent.title')} — {selectedAnimal.name}</h2>
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
                    {t('patientConsent.noConsentsDesc')} — <strong>{selectedAnimal.name}</strong>.
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

      {showModal && (
        <div
          className="pc-modal-overlay"
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pc-modal-title"
        >
          <div className="pc-modal">
            <div className="pc-modal-header">
              <h3 id="pc-modal-title">{t('patientConsent.modal.title')}</h3>
              <button className="pc-modal-close" onClick={() => setShowModal(false)} aria-label="Close">
                ✕
              </button>
            </div>

            <form onSubmit={handleGrantConsent}>
              <div className="pc-modal-body">
                {errorMsg && (
                  <div className="module-alert error" role="alert">⚠ {errorMsg}</div>
                )}

                <div>
                  <p className="pc-form-section-label">Quick Presets</p>
                  <div className="pc-preset-bar">
                    <button type="button" className="pc-preset-btn" onClick={() => applyPreset('view_only')}>
                      🔍 {t('patientConsent.modal.preset.viewOnly')}
                    </button>
                    <button type="button" className="pc-preset-btn" onClick={() => applyPreset('treatment')}>
                      💊 {t('patientConsent.modal.preset.treatment')}
                    </button>
                    <button type="button" className="pc-preset-btn" onClick={() => applyPreset('emergency')}>
                      🚨 {t('patientConsent.modal.preset.emergency')}
                    </button>
                  </div>
                </div>

                <div>
                  <p className="pc-form-section-label">Consent Scope</p>
                  <div className="pc-scope-grid">
                    {([
                      { value: 'view_only'    as ScopeType, icon: '🔍', title: t('patientConsent.scope.viewOnly'),    desc: 'Read-only access to selected records' },
                      { value: 'full_history' as ScopeType, icon: '📋', title: t('patientConsent.scope.fullHistory'), desc: 'Complete medical history access' },
                      { value: 'treatment'    as ScopeType, icon: '💊', title: t('patientConsent.scope.treatment'),   desc: 'Full access to provide treatment' },
                      { value: 'emergency'    as ScopeType, icon: '🚨', title: t('patientConsent.scope.emergency'),   desc: 'Emergency-only access (expires in 24h)' },
                    ]).map(opt => (
                      <label
                        key={opt.value}
                        className={'pc-scope-option' + (form.scope === opt.value ? ' selected-' + opt.value : '')}
                      >
                        <input
                          type="radio"
                          name="scope"
                          value={opt.value}
                          checked={form.scope === opt.value}
                          onChange={() => setForm(f => ({ ...f, scope: opt.value }))}
                        />
                        <span className="pc-scope-option-title">{opt.icon} {opt.title}</span>
                        <span className="pc-scope-option-desc">{opt.desc}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="pc-form-section-label">{t('patientConsent.grantedTo')}</p>
                  <div className="pc-grant-to-tabs">
                    {(['doctor', 'hospital', 'network'] as GrantToType[]).map(tab => (
                      <button
                        key={tab}
                        type="button"
                        className={'pc-grant-to-tab' + (form.grantToType === tab ? ' active' : '')}
                        onClick={() => { setForm(f => ({ ...f, grantToType: tab, grantToId: '' })); setGrantToLabel('') }}
                      >
                        {t('patientConsent.modal.grantTo.' + tab)}
                      </button>
                    ))}
                  </div>
                  <div className="module-form-group">
                    <label className="module-label">
                      {form.grantToType === 'doctor'   && 'Search Doctor *'}
                      {form.grantToType === 'hospital' && 'Search Hospital *'}
                      {form.grantToType === 'network'  && 'Search Network *'}
                    </label>
                    <SearchSelect
                      placeholder={
                        form.grantToType === 'doctor'   ? 'Search by name or email...' :
                        form.grantToType === 'hospital' ? 'Search by hospital name or city...' :
                        'Search by network name...'
                      }
                      value={form.grantToId}
                      displayValue={grantToLabel}
                      loadOnOpen={true}
                      required
                      onSelect={(val, label) => { setForm(f => ({ ...f, grantToId: val })); setGrantToLabel(label) }}
                      onClear={() => { setForm(f => ({ ...f, grantToId: '' })); setGrantToLabel('') }}
                      onSearch={async (q: string): Promise<SearchSelectOption[]> => {
                        if (form.grantToType === 'doctor') {
                          const res = await apiService.get('/consent/search-doctors', { params: { q } })
                          return (res.data?.data || []).map((d: any) => ({
                            value: d.id,
                            label: d.name,
                            sublabel: [d.email, d.specialization].filter(Boolean).join(' · '),
                          }))
                        } else if (form.grantToType === 'hospital') {
                          const res = await apiService.get('/consent/search-hospitals', { params: { q } })
                          return (res.data?.data || []).map((h: any) => ({
                            value: h.id,
                            label: h.name,
                            sublabel: [h.city, h.state].filter(Boolean).join(', '),
                          }))
                        } else {
                          const res = await apiService.get('/consent/search-networks', { params: { q } })
                          return (res.data?.data || []).map((n: any) => ({
                            value: n.id,
                            label: n.name,
                            sublabel: n.networkType,
                          }))
                        }
                      }}
                    />
                  </div>
                </div>

                <div>
                  <p className="pc-form-section-label">Data Permissions</p>
                  <div className="pc-modal-permissions-grid">
                    <Toggle checked={form.allowMedicalRecords}     onChange={v => setForm(f => ({ ...f, allowMedicalRecords: v }))}     label={t('patientConsent.permissions.medicalRecords')} />
                    <Toggle checked={form.allowVaccinationRecords} onChange={v => setForm(f => ({ ...f, allowVaccinationRecords: v }))} label={t('patientConsent.permissions.vaccinationRecords')} />
                    <Toggle checked={form.allowPrescriptions}      onChange={v => setForm(f => ({ ...f, allowPrescriptions: v }))}      label={t('patientConsent.permissions.prescriptions')} />
                    <Toggle checked={form.allowLabResults}         onChange={v => setForm(f => ({ ...f, allowLabResults: v }))}         label={t('patientConsent.permissions.labResults')} />
                    <Toggle checked={form.allowGeneticData}        onChange={v => setForm(f => ({ ...f, allowGeneticData: v }))}        label={t('patientConsent.permissions.geneticData')} />
                    <Toggle checked={form.includeHospitalRecords}  onChange={v => setForm(f => ({ ...f, includeHospitalRecords: v }))}  label={t('patientConsent.permissions.hospitalRecords')} note="Private by default — only enable if needed" />
                  </div>
                </div>

                <div>
                  <p className="pc-form-section-label">Action Permissions</p>
                  <div className="pc-modal-permissions-grid">
                    <Toggle checked={form.allowView}        onChange={v => setForm(f => ({ ...f, allowView: v }))}        label={t('patientConsent.permissions.allowView')} />
                    <Toggle checked={form.allowCreateNotes} onChange={v => setForm(f => ({ ...f, allowCreateNotes: v }))} label={t('patientConsent.permissions.allowNotes')} />
                    <Toggle checked={form.allowPrescribe}   onChange={v => setForm(f => ({ ...f, allowPrescribe: v }))}   label={t('patientConsent.permissions.allowPrescribe')} />
                  </div>
                </div>

                <div>
                  <p className="pc-form-section-label">Validity Period</p>
                  <div className="module-form-row">
                    <div className="module-form-group">
                      <label className="module-label">{t('patientConsent.validFrom')}</label>
                      <input
                        className="module-input"
                        type="date"
                        value={form.validFrom}
                        onChange={e => setForm(f => ({ ...f, validFrom: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="module-form-group">
                      <label className="module-label">
                        {t('patientConsent.validUntil')}{' '}
                        <span className="si-f7f517fe">(optional)</span>
                      </label>
                      <input
                        className="module-input"
                        type="date"
                        value={form.validUntil}
                        min={form.validFrom}
                        onChange={e => setForm(f => ({ ...f, validUntil: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pc-modal-footer">
                <button type="button" className="module-btn" onClick={() => setShowModal(false)} disabled={submitting}>
                  {t('common.cancel')}
                </button>
                <button type="submit" className="module-btn primary" disabled={submitting}>
                  {submitting ? 'Granting…' : t('patientConsent.grantConsent')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

interface ConsentCardProps {
  consent: PatientConsent
  scopeLabel: (s: ScopeType) => string
  scopeIcon: (s: ScopeType) => string
  grantedToDisplay: (c: PatientConsent) => string
  permissionItems: (c: PatientConsent) => Array<{ key: string; label: string; enabled: boolean }>
  formatDate: (d: string) => string
  t: (key: string) => string
  onRevoke: (id: string) => void
  revoking: string | null
}

const ConsentCard: React.FC<ConsentCardProps> = ({
  consent, scopeLabel, scopeIcon, grantedToDisplay, permissionItems,
  formatDate, t, onRevoke, revoking,
}) => {
  const perms = permissionItems(consent)

  return (
    <div className="pc-consent-card" data-scope={consent.consentScope}>
      <div className="pc-consent-card-header">
        <div className="si-28e38327">
          <span className={'pc-scope-badge pc-scope-badge-' + consent.consentScope}>
            {scopeIcon(consent.consentScope)} {scopeLabel(consent.consentScope)}
          </span>
          <span className={'pc-status-badge ' + (consent.isActive ? 'active' : 'revoked')}>
            {consent.isActive ? '● ' + t('patientConsent.status.active') : '○ ' + t('patientConsent.status.revoked')}
          </span>
        </div>
        <span className="si-3a6a64e1">
          {formatDate(consent.createdAt)}
        </span>
      </div>

      <div className="pc-consent-card-body">
        <div className="pc-info-row">
          <span className="pc-info-label">{t('patientConsent.grantedTo')}</span>
          <span>{grantedToDisplay(consent)}</span>
        </div>

        <div className="pc-info-row">
          <span className="pc-info-label">{t('patientConsent.validFrom')}</span>
          <span>
            {formatDate(consent.validFrom)}
            {' → '}
            {consent.validUntil
              ? formatDate(consent.validUntil)
              : <em className="si-7d7d4e5e">{t('patientConsent.noExpiry')}</em>
            }
          </span>
        </div>

        {!consent.isActive && consent.revokedAt && (
          <div className="pc-revoked-info">
            🚫 Revoked on {formatDate(consent.revokedAt)}
            {consent.revokedReason && ' — ' + consent.revokedReason}
          </div>
        )}

        <div className="pc-permissions-grid">
          {perms.map(p => (
            <div key={p.key} className={'pc-permission-item ' + (p.enabled ? 'enabled' : 'disabled')}>
              <span className="pc-permission-icon">{p.enabled ? '✅' : '⬜'}</span>
              {p.label}
            </div>
          ))}
        </div>

        <div className="si-0f7a7cdd">
          <span className={consent.allowView        ? '' : 'pc-permission-item disabled'}>
            {consent.allowView        ? '✅' : '⬜'} {t('patientConsent.permissions.allowView')}
          </span>
          <span className={consent.allowCreateNotes ? '' : 'pc-permission-item disabled'}>
            {consent.allowCreateNotes ? '✅' : '⬜'} {t('patientConsent.permissions.allowNotes')}
          </span>
          <span className={consent.allowPrescribe   ? '' : 'pc-permission-item disabled'}>
            {consent.allowPrescribe   ? '✅' : '⬜'} {t('patientConsent.permissions.allowPrescribe')}
          </span>
        </div>
      </div>

      <div className="pc-consent-card-footer">
        <span className="si-3a6a64e1">
          ID: {consent.id.slice(0, 8)}…
        </span>
        {consent.isActive && (
          <button
            className="pc-revoke-btn"
            onClick={() => onRevoke(consent.id)}
            disabled={revoking === consent.id}
          >
            {revoking === consent.id ? t('patientConsent.actions.revoking') : t('patientConsent.actions.revoke')}
          </button>
        )}
      </div>
    </div>
  )
}

export default PatientConsentPage
import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import AutocompleteInput from '../../components/AutocompleteInput'
import '../../styles/modules.css'
import './VaccineProtocolAdmin.css'

interface VaccineProtocolAdminProps {
  onNavigate: (path: string) => void
}

interface Protocol {
  id: string
  name: string
  disease: string
  species: string[]
  applicableGender: 'all' | 'male' | 'female'
  minAgeWeeks: number | null
  maxAgeWeeks: number | null
  vaccineCategory: 'core' | 'non_core' | 'mandatory_govt' | 'legally_mandated'
  isZoonotic: boolean
  initialDoseAgeWeeks: number | null
  boosterIntervalDays: number
  seriesDoseCount: number
  seriesIntervalDays: number
  route: string
  dosageMl: string | null
  site: string | null
  regulatoryBody: string | null
  regulatoryStandard: string | null
  seasonalWindow: string | null
  country: string
  isActive: boolean
  notes: string | null
}

interface ProtocolChange {
  id: string
  changedField: string
  oldValue: string | null
  newValue: string | null
  changeReason: string | null
  regulatoryStandard: string | null
  effectiveDate: string
  changedByName: string | null
  createdAt: string
}

interface Stats {
  total: number
  active: number
  byCategory: Record<string, number>
  bySpecies: Record<string, number>
}

const SPECIES_OPTIONS = ['cattle', 'buffalo', 'sheep', 'goat', 'pig', 'horse', 'dog', 'cat', 'rabbit', 'poultry']
const CATEGORY_COLORS: Record<string, string> = {
  core: 'badge-success',
  non_core: 'badge-pending',
  mandatory_govt: 'badge-error',
  legally_mandated: 'badge-error',
}
const ROUTE_OPTIONS = ['intramuscular', 'subcutaneous', 'intranasal', 'oral', 'intravenous', 'topical']

const getStatusBadge = (isActive: boolean, t: any) =>
  isActive ? (
    <span className="module-badge badge-success">{t('vaccineProtocol.status.active')}</span>
  ) : (
    <span className="module-badge badge-error">{t('vaccineProtocol.status.archived')}</span>
  )

const getCategoryDisplay = (cat: string, t: any) => {
  const labels: Record<string, string> = {
    core: t('vaccineProtocol.category.core'),
    non_core: t('vaccineProtocol.category.nonCore'),
    mandatory_govt: t('vaccineProtocol.category.mandatoryGovt'),
    legally_mandated: t('vaccineProtocol.category.legallyMandated'),
  }
  return (
    <span className={`module-badge ${CATEGORY_COLORS[cat] || 'badge-pending'}`}>
      {labels[cat] || cat}
    </span>
  )
}

const EMPTY_FORM: Partial<Protocol> = {
  name: '',
  disease: '',
  species: [],
  applicableGender: 'all',
  minAgeWeeks: null,
  maxAgeWeeks: null,
  vaccineCategory: 'core',
  isZoonotic: false,
  initialDoseAgeWeeks: null,
  boosterIntervalDays: 365,
  seriesDoseCount: 1,
  seriesIntervalDays: 21,
  route: 'intramuscular',
  dosageMl: '',
  site: '',
  regulatoryBody: '',
  regulatoryStandard: '',
  seasonalWindow: '',
  country: 'IN',
  notes: '',
}

const VaccineProtocolAdmin: React.FC<VaccineProtocolAdminProps> = ({ onNavigate: _onNavigate }) => {
  const { t } = useTranslation()
  const [protocols, setProtocols] = useState<Protocol[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Filters
  const [filterSpecies, setFilterSpecies] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [search, setSearch] = useState('')

  // Modal state
  const [showFormModal, setShowFormModal] = useState(false)
  const [editProtocol, setEditProtocol] = useState<Protocol | null>(null)
  const [formData, setFormData] = useState<Partial<Protocol>>(EMPTY_FORM)
  const [formSaving, setFormSaving] = useState(false)

  // Change history panel
  const [historyProtocol, setHistoryProtocol] = useState<Protocol | null>(null)
  const [changes, setChanges] = useState<ProtocolChange[]>([])
  const [loadingChanges, setLoadingChanges] = useState(false)
  const [showAddChange, setShowAddChange] = useState(false)
  const [changeForm, setChangeForm] = useState({
    changedField: '', oldValue: '', newValue: '', changeReason: '', regulatoryStandard: '', effectiveDate: new Date().toISOString().split('T')[0],
  })
  const [savingChange, setSavingChange] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const res = await apiService.adminListVaccineProtocols({
        species: filterSpecies || undefined,
        category: filterCategory || undefined,
        activeOnly: !showArchived,
      })
      setProtocols(res.data?.protocols || [])
      setStats(res.data?.stats || null)
    } catch (e: any) {
      setError(e.response?.data?.message || t('common.errorLoading'))
    } finally {
      setLoading(false)
    }
  }, [filterSpecies, filterCategory, showArchived, t])

  useEffect(() => { load() }, [load])

  const openAdd = () => {
    setEditProtocol(null)
    setFormData(EMPTY_FORM)
    setShowFormModal(true)
  }

  const openEdit = (p: Protocol) => {
    setEditProtocol(p)
    setFormData({ ...p })
    setShowFormModal(true)
  }

  const saveForm = async () => {
    if (!formData.name || !formData.disease || !formData.species?.length) {
      setError(t('vaccineProtocol.validation.nameDiseasesSpeciesRequired'))
      return
    }
    setFormSaving(true)
    setError('')
    try {
      if (editProtocol) {
        await apiService.adminUpdateVaccineProtocol(editProtocol.id, formData)
        setSuccess(t('vaccineProtocol.updatedSuccess'))
      } else {
        await apiService.adminCreateVaccineProtocol(formData)
        setSuccess(t('vaccineProtocol.createdSuccess'))
      }
      setShowFormModal(false)
      load()
    } catch (e: any) {
      setError(e.response?.data?.message || t('common.errorSaving'))
    } finally {
      setFormSaving(false)
    }
  }

  const toggleArchive = async (p: Protocol) => {
    try {
      if (p.isActive) {
        await apiService.adminArchiveVaccineProtocol(p.id)
        setSuccess(t('vaccineProtocol.archivedSuccess'))
      } else {
        await apiService.adminRestoreVaccineProtocol(p.id)
        setSuccess(t('vaccineProtocol.restoredSuccess'))
      }
      load()
    } catch (e: any) {
      setError(e.response?.data?.message || t('common.errorSaving'))
    }
  }

  const openHistory = async (p: Protocol) => {
    setHistoryProtocol(p)
    setLoadingChanges(true)
    setShowAddChange(false)
    try {
      const res = await apiService.getVaccineProtocolChanges(p.id)
      setChanges(res.data || [])
    } catch {
      setChanges([])
    } finally {
      setLoadingChanges(false)
    }
  }

  const saveChange = async () => {
    if (!historyProtocol || !changeForm.changedField || !changeForm.newValue) return
    setSavingChange(true)
    try {
      await apiService.addVaccineProtocolChange(historyProtocol.id, changeForm)
      const res = await apiService.getVaccineProtocolChanges(historyProtocol.id)
      setChanges(res.data || [])
      setShowAddChange(false)
      setChangeForm({ changedField: '', oldValue: '', newValue: '', changeReason: '', regulatoryStandard: '', effectiveDate: new Date().toISOString().split('T')[0] })
    } catch (e: any) {
      setError(e.response?.data?.message || t('common.errorSaving'))
    } finally {
      setSavingChange(false)
    }
  }

  const handleSpeciesToggle = (sp: string) => {
    const current = formData.species || []
    setFormData(prev => ({
      ...prev,
      species: current.includes(sp) ? current.filter(s => s !== sp) : [...current, sp],
    }))
  }

  const filtered = protocols.filter(p => {
    if (!search) return true
    return (
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.disease.toLowerCase().includes(search.toLowerCase()) ||
      p.species.some(s => s.toLowerCase().includes(search.toLowerCase()))
    )
  })

  const getIntervalLabel = (days: number) => {
    if (days === 365) return '1 year'
    if (days === 182) return '6 months'
    if (days === 1095) return '3 years'
    if (days === 730) return '2 years'
    if (days === 0) return t('vaccineProtocol.oneTime')
    return `${days} ${t('vaccineProtocol.days')}`
  }

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>{t('vaccineProtocol.title')}</h1>
        <p>{t('vaccineProtocol.subtitle')}</p>
      </div>

      {error && (
        <div className="module-alert error">
          {error}
          <button onClick={() => setError('')}>×</button>
        </div>
      )}
      {success && (
        <div className="module-alert success">
          {success}
          <button onClick={() => setSuccess('')}>×</button>
        </div>
      )}

      {/* Stats Grid */}
      {stats && (
        <div className="module-stats">
          <div className="stat-card">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">{t('vaccineProtocol.stats.total')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.active}</div>
            <div className="stat-label">{t('vaccineProtocol.stats.active')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.byCategory?.mandatory_govt || 0}</div>
            <div className="stat-label">{t('vaccineProtocol.stats.mandatoryGovt')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.byCategory?.core || 0}</div>
            <div className="stat-label">{t('vaccineProtocol.stats.core')}</div>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="vpa-filter-bar">
        <div className="vpa-filter-search">
          <AutocompleteInput
            value={search}
            onChange={setSearch}
            options={protocols.map(p => p.name)}
            placeholder={t('vaccineProtocol.searchPlaceholder')}
          />
        </div>
        <div className="vpa-filter-row">
          <div className="vpa-filter-section">
            <span className="vpa-filter-label">{t('vaccineProtocol.allSpecies')}:</span>
            <div className="vpa-filter-chips">
              <button
                className={`vpa-filter-chip ${!filterSpecies ? 'active' : ''}`}
                onClick={() => setFilterSpecies('')}
              >{t('vaccineProtocol.allSpecies')}</button>
              {SPECIES_OPTIONS.map(s => (
                <button
                  key={s}
                  className={`vpa-filter-chip ${filterSpecies === s ? 'active' : ''}`}
                  onClick={() => setFilterSpecies(filterSpecies === s ? '' : s)}
                >{s}</button>
              ))}
            </div>
          </div>
          <div className="vpa-filter-section">
            <span className="vpa-filter-label">{t('vaccineProtocol.allCategories')}:</span>
            <div className="vpa-filter-chips">
              <button className={`vpa-filter-chip cat-all ${!filterCategory ? 'active' : ''}`} onClick={() => setFilterCategory('')}>{t('vaccineProtocol.allCategories')}</button>
              <button className={`vpa-filter-chip cat-core ${filterCategory === 'core' ? 'active' : ''}`} onClick={() => setFilterCategory(filterCategory === 'core' ? '' : 'core')}>{t('vaccineProtocol.category.core')}</button>
              <button className={`vpa-filter-chip cat-noncore ${filterCategory === 'non_core' ? 'active' : ''}`} onClick={() => setFilterCategory(filterCategory === 'non_core' ? '' : 'non_core')}>{t('vaccineProtocol.category.nonCore')}</button>
              <button className={`vpa-filter-chip cat-mandatory ${filterCategory === 'mandatory_govt' ? 'active' : ''}`} onClick={() => setFilterCategory(filterCategory === 'mandatory_govt' ? '' : 'mandatory_govt')}>{t('vaccineProtocol.category.mandatoryGovt')}</button>
              <button className={`vpa-filter-chip cat-legal ${filterCategory === 'legally_mandated' ? 'active' : ''}`} onClick={() => setFilterCategory(filterCategory === 'legally_mandated' ? '' : 'legally_mandated')}>{t('vaccineProtocol.category.legallyMandated')}</button>
            </div>
          </div>
        </div>
        <div className="vpa-filter-actions">
          <label className="vpa-checkbox-label">
            <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
            {t('vaccineProtocol.showArchived')}
          </label>
          <span className="vpa-results-count">{filtered.length} {t('vaccineProtocol.stats.total').toLowerCase()}</span>
          <button className="module-btn primary" onClick={openAdd}>
            + {t('vaccineProtocol.addProtocol')}
          </button>
        </div>
      </div>

      {/* Protocol Card Grid */}
      {loading ? (
        <div className="module-loading">{t('common.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="vpa-empty-state">
          <div className="vpa-empty-icon">💉</div>
          <p>{t('vaccineProtocol.noProtocols')}</p>
        </div>
      ) : (
        <div className="vpa-protocol-grid">
          {filtered.map(p => (
            <div key={p.id} className={`vpa-protocol-card ${!p.isActive ? 'vpa-card-archived' : ''}`}>
              <div className="vpa-card-header">
                <div className="vpa-card-title-row">
                  <h3 className="vpa-card-title">{p.name}</h3>
                  {p.isZoonotic && (
                    <span className="vpa-zoonotic-badge">⚠ {t('vaccineProtocol.zoonotic')}</span>
                  )}
                </div>
                <div className="vpa-card-badges">
                  {getCategoryDisplay(p.vaccineCategory, t)}
                  {getStatusBadge(p.isActive, t)}
                </div>
              </div>
              <div className="vpa-card-disease">
                🦠 <span>{p.disease}</span>
              </div>
              <div className="vpa-species-chips">
                {p.species.slice(0, 4).map(s => (
                  <span key={s} className="vpa-species-chip">{s}</span>
                ))}
                {p.species.length > 4 && (
                  <span className="vpa-species-chip">+{p.species.length - 4}</span>
                )}
              </div>
              <div className="vpa-card-meta">
                <span className="vpa-meta-item">🔄 {getIntervalLabel(p.boosterIntervalDays)}</span>
                <span className="vpa-meta-item">💉 {p.route}</span>
                {p.country && <span className="vpa-meta-item">🌍 {p.country}</span>}
                {p.regulatoryBody && <span className="vpa-meta-item">📋 {p.regulatoryBody}</span>}
              </div>
              <div className="vpa-card-actions">
                <button className="module-btn module-btn-small" onClick={() => openEdit(p)}>
                  ✏️ {t('common.edit')}
                </button>
                <button className="module-btn module-btn-small" onClick={() => openHistory(p)}>
                  📋 {t('vaccineProtocol.history')}
                </button>
                <button
                  className={`module-btn module-btn-small ${p.isActive ? '' : 'primary'}`}
                  onClick={() => toggleArchive(p)}
                >
                  {p.isActive ? `🗃 ${t('vaccineProtocol.archive')}` : `♻️ ${t('vaccineProtocol.restore')}`}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Protocol Form Modal */}
      {showFormModal && (
        <div className="vpa-modal-overlay" onClick={() => setShowFormModal(false)}>
          <div className="vpa-modal" onClick={e => e.stopPropagation()}>
            <div className="vpa-modal-header">
              <h2>{editProtocol ? t('vaccineProtocol.editProtocol') : t('vaccineProtocol.addProtocol')}</h2>
              <button className="vpa-close-btn" onClick={() => setShowFormModal(false)}>×</button>
            </div>
            <div className="vpa-modal-body">
              <div className="module-form">
                <div className="module-form-row">
                  <div className="module-form-group">
                    <label className="module-label">{t('vaccineProtocol.form.name')} *</label>
                    <input className="module-input" value={formData.name || ''} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className="module-form-group">
                    <label className="module-label">{t('vaccineProtocol.form.disease')} *</label>
                    <input className="module-input" value={formData.disease || ''} onChange={e => setFormData(p => ({ ...p, disease: e.target.value }))} />
                  </div>
                </div>

                <div className="module-form-group">
                  <label className="module-label">{t('vaccineProtocol.form.species')} *</label>
                  <div className="vpa-species-checkboxes">
                    {SPECIES_OPTIONS.map(sp => (
                      <label key={sp} className="vpa-checkbox-label">
                        <input
                          type="checkbox"
                          checked={(formData.species || []).includes(sp)}
                          onChange={() => handleSpeciesToggle(sp)}
                        />
                        {sp}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="module-form-row module-form-row-3">
                  <div className="module-form-group">
                    <label className="module-label">{t('vaccineProtocol.form.category')}</label>
                    <select className="module-input" value={formData.vaccineCategory || 'core'} onChange={e => setFormData(p => ({ ...p, vaccineCategory: e.target.value as any }))}>
                      <option value="core">{t('vaccineProtocol.category.core')}</option>
                      <option value="non_core">{t('vaccineProtocol.category.nonCore')}</option>
                      <option value="mandatory_govt">{t('vaccineProtocol.category.mandatoryGovt')}</option>
                      <option value="legally_mandated">{t('vaccineProtocol.category.legallyMandated')}</option>
                    </select>
                  </div>
                  <div className="module-form-group">
                    <label className="module-label">{t('vaccineProtocol.form.gender')}</label>
                    <select className="module-input" value={formData.applicableGender || 'all'} onChange={e => setFormData(p => ({ ...p, applicableGender: e.target.value as any }))}>
                      <option value="all">{t('vaccineProtocol.gender.all')}</option>
                      <option value="male">{t('vaccineProtocol.gender.male')}</option>
                      <option value="female">{t('vaccineProtocol.gender.female')}</option>
                    </select>
                  </div>
                  <div className="module-form-group">
                    <label className="module-label">{t('vaccineProtocol.form.country')}</label>
                    <input className="module-input" value={formData.country || ''} onChange={e => setFormData(p => ({ ...p, country: e.target.value }))} placeholder="IN" />
                  </div>
                </div>

                <div className="module-form-row module-form-row-3">
                  <div className="module-form-group">
                    <label className="module-label">{t('vaccineProtocol.form.boosterInterval')}</label>
                    <input type="number" className="module-input" min={0} value={formData.boosterIntervalDays ?? 365} onChange={e => setFormData(p => ({ ...p, boosterIntervalDays: parseInt(e.target.value) || 365 }))} />
                  </div>
                  <div className="module-form-group">
                    <label className="module-label">{t('vaccineProtocol.form.seriesDoseCount')}</label>
                    <input type="number" className="module-input" min={1} max={10} value={formData.seriesDoseCount ?? 1} onChange={e => setFormData(p => ({ ...p, seriesDoseCount: parseInt(e.target.value) || 1 }))} />
                  </div>
                  <div className="module-form-group">
                    <label className="module-label">{t('vaccineProtocol.form.seriesInterval')}</label>
                    <input type="number" className="module-input" min={0} value={formData.seriesIntervalDays ?? 21} onChange={e => setFormData(p => ({ ...p, seriesIntervalDays: parseInt(e.target.value) || 21 }))} />
                  </div>
                </div>

                <div className="module-form-row">
                  <div className="module-form-group">
                    <label className="module-label">{t('vaccineProtocol.form.route')}</label>
                    <select className="module-input" value={formData.route || 'intramuscular'} onChange={e => setFormData(p => ({ ...p, route: e.target.value }))}>
                      {ROUTE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="module-form-group">
                    <label className="module-label">{t('vaccineProtocol.form.dosageMl')}</label>
                    <input className="module-input" value={formData.dosageMl || ''} onChange={e => setFormData(p => ({ ...p, dosageMl: e.target.value }))} placeholder="e.g. 2 ml" />
                  </div>
                </div>

                <div className="module-form-row">
                  <div className="module-form-group">
                    <label className="module-label">{t('vaccineProtocol.form.regulatoryBody')}</label>
                    <input className="module-input" value={formData.regulatoryBody || ''} onChange={e => setFormData(p => ({ ...p, regulatoryBody: e.target.value }))} />
                  </div>
                  <div className="module-form-group">
                    <label className="module-label">{t('vaccineProtocol.form.seasonalWindow')}</label>
                    <input className="module-input" value={formData.seasonalWindow || ''} onChange={e => setFormData(p => ({ ...p, seasonalWindow: e.target.value }))} placeholder="e.g. Pre-monsoon (May–Jun)" />
                  </div>
                </div>

                <div className="module-form-group">
                  <label className="module-label">{t('vaccineProtocol.form.regulatoryStandard')}</label>
                  <input className="module-input" value={formData.regulatoryStandard || ''} onChange={e => setFormData(p => ({ ...p, regulatoryStandard: e.target.value }))} placeholder="e.g. WSAVA 2022, DAHD Circular 2023" />
                </div>

                <div className="module-form-group">
                  <label className="module-label">{t('vaccineProtocol.form.notes')}</label>
                  <textarea className="module-input" rows={3} value={formData.notes || ''} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} />
                </div>

                <label className="vpa-checkbox-label">
                  <input type="checkbox" checked={formData.isZoonotic || false} onChange={e => setFormData(p => ({ ...p, isZoonotic: e.target.checked }))} />
                  {t('vaccineProtocol.form.isZoonotic')}
                </label>
              </div>
            </div>
            <div className="vpa-modal-footer">
              <button className="module-btn" onClick={() => setShowFormModal(false)}>{t('common.cancel')}</button>
              <button className="module-btn primary" onClick={saveForm} disabled={formSaving}>
                {formSaving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Regulatory Change History Panel */}
      {historyProtocol && (
        <div className="vpa-modal-overlay" onClick={() => setHistoryProtocol(null)}>
          <div className="vpa-modal vpa-wide-modal" onClick={e => e.stopPropagation()}>
            <div className="vpa-modal-header">
              <h2>{t('vaccineProtocol.changeHistory')}: {historyProtocol.name}</h2>
              <button className="vpa-close-btn" onClick={() => setHistoryProtocol(null)}>×</button>
            </div>
            <div className="vpa-modal-body">
              <button className="module-btn module-btn-small primary" onClick={() => setShowAddChange(v => !v)}>
                + {t('vaccineProtocol.addChange')}
              </button>

              {showAddChange && (
                <div className="vpa-change-form module-card">
                  <div className="module-form-row">
                    <div className="module-form-group">
                      <label className="module-label">{t('vaccineProtocol.changeForm.field')}</label>
                      <input className="module-input" value={changeForm.changedField} onChange={e => setChangeForm(p => ({ ...p, changedField: e.target.value }))} placeholder="e.g. booster_interval_days" />
                    </div>
                    <div className="module-form-group">
                      <label className="module-label">{t('vaccineProtocol.changeForm.effectiveDate')}</label>
                      <input type="date" className="module-input" value={changeForm.effectiveDate} onChange={e => setChangeForm(p => ({ ...p, effectiveDate: e.target.value }))} />
                    </div>
                  </div>
                  <div className="module-form-row">
                    <div className="module-form-group">
                      <label className="module-label">{t('vaccineProtocol.changeForm.oldValue')}</label>
                      <input className="module-input" value={changeForm.oldValue} onChange={e => setChangeForm(p => ({ ...p, oldValue: e.target.value }))} />
                    </div>
                    <div className="module-form-group">
                      <label className="module-label">{t('vaccineProtocol.changeForm.newValue')} *</label>
                      <input className="module-input" value={changeForm.newValue} onChange={e => setChangeForm(p => ({ ...p, newValue: e.target.value }))} />
                    </div>
                  </div>
                  <div className="module-form-group">
                    <label className="module-label">{t('vaccineProtocol.changeForm.regulatoryStandard')}</label>
                    <input className="module-input" value={changeForm.regulatoryStandard} onChange={e => setChangeForm(p => ({ ...p, regulatoryStandard: e.target.value }))} placeholder="e.g. WSAVA 2022" />
                  </div>
                  <div className="module-form-group">
                    <label className="module-label">{t('vaccineProtocol.changeForm.reason')}</label>
                    <textarea className="module-input" rows={2} value={changeForm.changeReason} onChange={e => setChangeForm(p => ({ ...p, changeReason: e.target.value }))} />
                  </div>
                  <button className="module-btn primary" onClick={saveChange} disabled={savingChange}>
                    {savingChange ? t('common.saving') : t('common.save')}
                  </button>
                </div>
              )}

              {loadingChanges ? (
                <div className="module-loading">{t('common.loading')}</div>
              ) : changes.length === 0 ? (
                <p className="vpa-empty">{t('vaccineProtocol.noChanges')}</p>
              ) : (
                <div className="vpa-timeline">
                  {changes.map(c => (
                    <div key={c.id} className="vpa-timeline-item">
                      <div className="vpa-timeline-dot" />
                      <div className="vpa-timeline-content module-card">
                        <div className="vpa-change-header">
                          <strong>{c.changedField}</strong>
                          <span className="vpa-change-date">{new Date(c.effectiveDate).toLocaleDateString()}</span>
                        </div>
                        <div className="vpa-change-values">
                          <span className="vpa-old-val">{c.oldValue || '–'}</span>
                          <span className="vpa-arrow">→</span>
                          <span className="vpa-new-val">{c.newValue}</span>
                        </div>
                        {c.regulatoryStandard && (
                          <div className="vpa-regulatory-tag">📋 {c.regulatoryStandard}</div>
                        )}
                        {c.changeReason && <p className="vpa-change-reason">{c.changeReason}</p>}
                        {c.changedByName && (
                          <small className="vpa-changed-by">{t('vaccineProtocol.changedBy')}: {c.changedByName}</small>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default VaccineProtocolAdmin

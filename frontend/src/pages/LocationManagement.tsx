import React, { useState, useEffect } from 'react'
import apiService from '../services/api'
import './ModulePage.css'
import { Enterprise, FarmLocation } from '../types'
import MapView from '../components/MapView'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '../components/mobile/BottomSheet'
import { ChipSelect } from '../components/mobile/ChipSelect'
import { NumberStepper } from '../components/mobile/NumberStepper'
import { SaveState } from '../components/mobile/SaveState'
import { StepForm, type FormStep } from '../components/mobile/StepForm'
import { useSaveAction } from '../hooks/useSaveAction'
import { useMyFarmRole } from '../hooks/useMyFarmRole'
import { userMessage } from '../utils/userMessage'

/** The kinds the table accepts (locations.location_type). */
const LOCATION_TYPES = [
  'barn', 'stable', 'pen', 'paddock', 'field', 'pasture', 'quarantine', 'isolation', 'aviary', 'tank',
  'pond', 'enclosure', 'kennel', 'cattery', 'warehouse', 'office', 'treatment_area', 'milking_parlor', 'feed_storage', 'other',
]
const LOCATION_TYPE_ICONS: Record<string, string> = {
  barn: '🏚️', stable: '🐴', pen: '🐷', paddock: '🌿', field: '🌾',
  pasture: '🌳', quarantine: '⚠️', isolation: '🔒', aviary: '🦜',
  tank: '🐟', pond: '🌊', enclosure: '🦁', kennel: '🐕', cattery: '🐈',
  warehouse: '🏭', office: '🏢', treatment_area: '🏥', milking_parlor: '🥛',
  feed_storage: '🌽', other: '📍',
}
const AREA_UNITS = ['sqft', 'sqm', 'acres', 'hectares']
/** Who may add, change or remove a place (server: EnterpriseController.createLocation). */
const MANAGE_ROLES = ['owner', 'manager']

interface LocationForm {
  name: string; locationType: string; parentLocationId: string; capacity: string; area: string; areaUnit: string
  description: string; gpsLatitude: string; gpsLongitude: string
}
const emptyForm = (): LocationForm => ({ name: '', locationType: '', parentLocationId: '', capacity: '', area: '', areaUnit: 'sqft', description: '', gpsLatitude: '', gpsLongitude: '' })
/** A bar width in 5% steps (a class each - no inline style). */
const barStep = (used: number, total: number) => Math.min(20, Math.max(0, Math.round((used / Math.max(1, total)) * 20)))

const LocationManagement: React.FC = () => {
  const { t } = useTranslation()

  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [selectedEnterpriseId, setSelectedEnterpriseId] = useState('')
  const [locations, setLocations] = useState<FarmLocation[]>([])
  const [locationTree, setLocationTree] = useState<FarmLocation[]>([])
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'tree' | 'map'>('grid')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<FarmLocation | null>(null)
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<LocationForm>(emptyForm)
  const [deleting, setDeleting] = useState<FarmLocation | null>(null)
  const [locating, setLocating] = useState(false)
  const [gpsNote, setGpsNote] = useState('')
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const farm = enterprises.find(e => e.id === selectedEnterpriseId)
  const role = useMyFarmRole(farm)
  const canManage = !!role && MANAGE_ROLES.includes(role)

  useEffect(() => {
    apiService.listEnterprises({ limit: 100 })
      .then((res: any) => {
        const items = res.data?.items || []
        setEnterprises(items)
        if (items.length === 1) setSelectedEnterpriseId(items[0].id)
      })
      .catch(() => setEnterprises([]))
  }, [])

  const fetchLocations = async () => {
    if (!selectedEnterpriseId) return
    try {
      setLoading(true); setError('')
      const [listRes, treeRes] = await Promise.all([
        apiService.listLocations(selectedEnterpriseId, { limit: 200 }),
        apiService.getLocationTree(selectedEnterpriseId),
      ])
      setLocations(listRes.data?.items || [])
      setLocationTree(treeRes.data || [])
    } catch (err: any) {
      setLocations([]); setLocationTree([])
      setError(userMessage(err, 'locationManagement.loadFailed'))
    } finally { setLoading(false) }
  }
  useEffect(() => { fetchLocations() }, [selectedEnterpriseId])

  const typeLabel = (c: string) => t('locationManagement.types.' + c, { defaultValue: c })
  const unitLabel = (u: string) => t('locationManagement.areaUnits.' + u, { defaultValue: u })
  const set = <K extends keyof LocationForm>(key: K, value: LocationForm[K]) => setForm(f => ({ ...f, [key]: value }))

  const save = useSaveAction(async () => {
    const num = (v: string) => (v !== '' && !Number.isNaN(parseFloat(v.replace(',', '.'))) ? parseFloat(v.replace(',', '.')) : undefined)
    const payload: Record<string, unknown> = {
      enterpriseId: selectedEnterpriseId, name: form.name.trim(), locationType: form.locationType,
      parentLocationId: form.parentLocationId || undefined,
      capacity: form.capacity ? Math.round(num(form.capacity) || 0) : 0,
      area: num(form.area), areaUnit: form.areaUnit, description: form.description || undefined,
      gpsLatitude: num(form.gpsLatitude), gpsLongitude: num(form.gpsLongitude),
    }
    if (editing) await apiService.updateLocation(editing.id, payload)
    else await apiService.createLocation(payload as any)
  }, t('locationManagement.toasts.failed'))

  const close = () => { setShowForm(false); setEditing(null); setStep(0); setGpsNote(''); save.reset() }
  const openNew = () => { setForm(emptyForm()); setEditing(null); setStep(0); setGpsNote(''); save.reset(); setShowForm(true) }
  const openEdit = (loc: FarmLocation) => {
    setEditing(loc); setStep(0); setGpsNote(''); save.reset()
    setForm({
      name: loc.name, locationType: loc.locationType, parentLocationId: loc.parentLocationId || '',
      capacity: loc.capacity ? String(loc.capacity) : '', area: loc.area ? String(loc.area) : '', areaUnit: loc.areaUnit || 'sqft',
      description: loc.description || '', gpsLatitude: loc.gpsLatitude != null ? String(loc.gpsLatitude) : '', gpsLongitude: loc.gpsLongitude != null ? String(loc.gpsLongitude) : '',
    })
    setShowForm(true)
  }
  const submit = async () => {
    setSuccessMsg('')
    const wasEditing = !!editing
    if (await save.run()) {
      close()
      setSuccessMsg(t(wasEditing ? 'locationManagement.toasts.updated' : 'locationManagement.toasts.created'))
      void fetchLocations()
    }
  }

  const removal = useSaveAction(async () => { if (deleting) await apiService.deleteLocation(deleting.id) }, t('locationManagement.toasts.deleteFailed'))
  const submitDelete = async () => {
    if (await removal.run()) { setDeleting(null); setSuccessMsg(t('locationManagement.toasts.deleted')); void fetchLocations() }
  }

  // Standing at the place with the phone is the easiest way to get its coordinates.
  const useMyLocation = () => {
    setGpsNote('')
    if (!('geolocation' in navigator)) { setGpsNote(t('locationManagement.gpsUnavailable')); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => { setForm(f => ({ ...f, gpsLatitude: pos.coords.latitude.toFixed(6), gpsLongitude: pos.coords.longitude.toFixed(6) })); setLocating(false) },
      () => { setLocating(false); setGpsNote(t('locationManagement.gpsDenied')) },
      { enableHighAccuracy: true, timeout: 15000 },
    )
  }

  const withGps = locations.filter(l => l.gpsLatitude && l.gpsLongitude)
  const withoutGps = locations.filter(l => !l.gpsLatitude || !l.gpsLongitude)

  const steps: FormStep[] = [
    {
      id: 'what', title: t('locationManagement.steps.what'),
      blockedReason: !form.name.trim() ? t('locationManagement.blocked.name') : !form.locationType ? t('locationManagement.blocked.type') : undefined,
      content: (
        <>
          <div className="loc-field">
            <label htmlFor="loc-name">{t('locationManagement.form.name')}</label>
            <input id="loc-name" type="text" className="an-field" value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div className="loc-field">
            <label htmlFor="loc-type">{t('locationManagement.form.type')}</label>
            <select id="loc-type" className="an-field" value={form.locationType} onChange={e => set('locationType', e.target.value)}>
              <option value="">{t('locationManagement.form.typeChoose')}</option>
              {LOCATION_TYPES.map(c => <option key={c} value={c}>{LOCATION_TYPE_ICONS[c]} {typeLabel(c)}</option>)}
            </select>
          </div>
          <div className="loc-field">
            <label htmlFor="loc-parent">{t('locationManagement.form.parentLocation')}</label>
            <select id="loc-parent" className="an-field" value={form.parentLocationId} onChange={e => set('parentLocationId', e.target.value)}>
              <option value="">{t('locationManagement.modal.parentDefault')}</option>
              {locations.filter(l => l.id !== editing?.id).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        </>
      ),
    },
    {
      id: 'size', title: t('locationManagement.steps.size'),
      content: (
        <>
          <NumberStepper label={t('locationManagement.form.capacity')} value={form.capacity} onChange={v => set('capacity', v)} integer min={0} hint={t('locationManagement.form.capacityHint')} />
          <NumberStepper label={t('locationManagement.form.area')} value={form.area} onChange={v => set('area', v)} min={0} />
          <ChipSelect label={t('locationManagement.form.areaUnit')} variant="segmented" value={form.areaUnit}
            options={AREA_UNITS.map(u => ({ value: u, label: unitLabel(u) }))} onChange={v => set('areaUnit', v)} />
        </>
      ),
    },
    {
      id: 'where', title: t('locationManagement.steps.where'),
      content: (
        <>
          <button type="button" className="btn btn-secondary loc-gps-button" onClick={useMyLocation} disabled={locating}>
            📍 {locating ? t('locationManagement.locating') : t('locationManagement.useMyLocation')}
          </button>
          {gpsNote && <p className="loc-hint" role="status">{gpsNote}</p>}
          <div className="loc-field">
            <label htmlFor="loc-lat">{t('locationManagement.form.gpsLatitude')}</label>
            <input id="loc-lat" type="number" inputMode="decimal" step="0.000001" className="an-field" value={form.gpsLatitude} onChange={e => set('gpsLatitude', e.target.value)} />
          </div>
          <div className="loc-field">
            <label htmlFor="loc-lng">{t('locationManagement.form.gpsLongitude')}</label>
            <input id="loc-lng" type="number" inputMode="decimal" step="0.000001" className="an-field" value={form.gpsLongitude} onChange={e => set('gpsLongitude', e.target.value)} />
          </div>
          <p className="loc-hint">💡 {t('locationManagement.clickMapHint')}</p>
          <MapView
            height={220}
            markers={form.gpsLatitude && form.gpsLongitude ? [{
              id: 'form-location', lat: +form.gpsLatitude, lng: +form.gpsLongitude, color: '#3b82f6', pulse: true,
              popup: <div><strong>{form.name || t('locationManagement.modal.createTitle')}</strong></div>,
            }] : []}
            onClick={(lat, lng) => setForm(f => ({ ...f, gpsLatitude: lat.toFixed(6), gpsLongitude: lng.toFixed(6) }))}
            center={form.gpsLatitude && form.gpsLongitude ? [+form.gpsLatitude, +form.gpsLongitude] : undefined}
            zoom={form.gpsLatitude ? 14 : undefined}
          />
          <div className="loc-field">
            <label htmlFor="loc-desc">{t('common.description')}</label>
            <textarea id="loc-desc" rows={2} className="an-field an-field--textarea" value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
        </>
      ),
    },
  ]

  const renderTreeNode = (loc: FarmLocation, depth = 0): React.ReactNode => (
    <div key={loc.id} className={`loc-node loc-depth-${Math.min(depth, 6)}`}>
      <div className="loc-node-row">
        <span>{LOCATION_TYPE_ICONS[loc.locationType] || '📍'}</span>
        <strong className="loc-node-name">{loc.name}</strong>
        <span className="badge">{typeLabel(loc.locationType)}</span>
        <span className="loc-node-occ">{loc.currentOccupancy}/{loc.capacity} {t('locationManagement.occupancy').toLowerCase()}</span>
        {canManage && (
          <>
            <button className="btn btn-sm btn-secondary" onClick={() => openEdit(loc)}>{t('common.edit')}</button>
            <button className="btn btn-sm btn-danger" aria-label={t('common.delete')} onClick={() => { removal.reset(); setDeleting(loc) }}>×</button>
          </>
        )}
      </div>
      {loc.children?.map(child => renderTreeNode(child, depth + 1))}
    </div>
  )

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <h1>{t('locationManagement.pageTitle')}</h1>
          <p className="subtitle">{t('locationManagement.subtitle')}</p>
        </div>
        <div className="header-actions">
          {selectedEnterpriseId && canManage && <button className="btn btn-primary" onClick={openNew}>{t('locationManagement.newLocation')}</button>}
        </div>
      </div>

      {successMsg && <div className="alert alert-success" role="status">{successMsg}</div>}
      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <div className="filters-bar">
        <select aria-label={t('locationManagement.selectEnterprise')} value={selectedEnterpriseId} onChange={e => setSelectedEnterpriseId(e.target.value)} className="search-input">
          <option value="">{t('locationManagement.selectEnterprise')}</option>
          {enterprises.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
        </select>
      </div>

      {selectedEnterpriseId && (
        <ChipSelect label={t('locationManagement.viewAs')} variant="segmented" value={viewMode} onChange={v => setViewMode(v as 'grid' | 'tree' | 'map')}
          options={[{ value: 'grid', label: t('locationManagement.viewGrid') }, { value: 'tree', label: t('locationManagement.viewTree') }, { value: 'map', label: t('locationManagement.viewMap') }]} />
      )}

      {showForm && (
        <div className="edit-form-overlay" onClick={close}>
          <div className="edit-form-panel edit-form-modal" onClick={e => e.stopPropagation()}>
            <button className="edit-form-close" onClick={close} aria-label={t('mobileUi.close')}>✕</button>
            <h2>{editing ? t('locationManagement.modal.editTitle') : t('locationManagement.modal.createTitle')}</h2>
            <StepForm
              steps={steps} current={step} onStepChange={setStep} onSubmit={submit}
              submitLabel={editing ? t('locationManagement.modal.updateBtn') : t('locationManagement.modal.createBtn')}
              busy={save.status === 'saving'} onCancel={close}
              saveNowLabel={editing ? t('farmProfile.form.saveNow') : undefined}
              footer={<SaveState status={save.status} error={save.error} offline={save.offline} onRetry={save.retry} />}
            />
          </div>
        </div>
      )}

      <BottomSheet open={!!deleting} title={t('locationManagement.toasts.deleteConfirm')} onClose={() => { setDeleting(null); removal.reset() }}>
        <p>{deleting?.name}</p>
        <p className="loc-hint">{t('locationManagement.deleteExplain')}</p>
        <SaveState status={removal.status} error={removal.error} offline={removal.offline} onRetry={removal.retry} />
        <button type="button" className="btn btn-danger loc-sheet-action" disabled={removal.status === 'saving'} onClick={submitDelete}>{t('common.delete')}</button>
      </BottomSheet>

      {!selectedEnterpriseId ? (
        <div className="empty-state">
          <div className="empty-icon">📍</div>
          <h3>{t('locationManagement.emptyEnterprise')}</h3>
          <p>{t('locationManagement.emptyEnterpriseSubtitle')}</p>
        </div>
      ) : loading ? (
        <div className="loading-spinner">{t('locationManagement.loading')}</div>
      ) : locations.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📍</div>
          <h3>{t('locationManagement.emptyTitle')}</h3>
          <p>{t('locationManagement.emptySubtitle')}</p>
          {canManage && <button className="btn btn-primary" onClick={openNew}>{t('locationManagement.createBtn')}</button>}
        </div>
      ) : viewMode === 'tree' ? (
        <div className="loc-tree">{locationTree.map(loc => renderTreeNode(loc))}</div>
      ) : viewMode === 'map' ? (
        <div>
          <h3>{t('locationManagement.mapTitle')}</h3>
          <p className="loc-hint">{t('locationManagement.gpsCount', { have: withGps.length, total: locations.length })}</p>
          <MapView
            height={380}
            markers={withGps.map(loc => ({
              id: loc.id, lat: +(loc.gpsLatitude || 0), lng: +(loc.gpsLongitude || 0),
              color: loc.locationType === 'quarantine' || loc.locationType === 'isolation' ? '#ef4444'
                : loc.locationType === 'treatment_area' ? '#f97316'
                : loc.locationType === 'barn' || loc.locationType === 'stable' ? '#8b5cf6'
                : '#22c55e',
              popup: (
                <div>
                  <strong>{LOCATION_TYPE_ICONS[loc.locationType] || '📍'} {loc.name}</strong><br />
                  <span>{typeLabel(loc.locationType)}</span><br />
                  <span>{t('locationManagement.occupancy')}: {loc.currentOccupancy} / {loc.capacity}</span>
                  {loc.area ? <><br /><span>{t('locationManagement.area')} {loc.area} {unitLabel(loc.areaUnit || 'sqft')}</span></> : null}
                  {loc.description && <><br /><span>{loc.description}</span></>}
                </div>
              ),
            }))}
            fitToData={withGps.length > 0}
          />
          {withoutGps.length > 0 && (
            <p className="loc-warning" role="status">⚠️ {t('locationManagement.gpsMissing', { names: withoutGps.map(l => l.name).join(', ') })}</p>
          )}
        </div>
      ) : (
        <ul className="loc-list">
          {locations.map(loc => (
            <li key={loc.id} className="loc-card">
              <div className="loc-card-head">
                <span className="loc-card-icon">{LOCATION_TYPE_ICONS[loc.locationType] || '📍'}</span>
                <div className="loc-card-title">
                  <strong className="loc-card-name">{loc.name}</strong>
                  <span className="badge">{typeLabel(loc.locationType)}</span>
                </div>
              </div>
              {loc.parentLocationName && <p className="loc-hint">{t('locationManagement.inside')} {loc.parentLocationName}</p>}
              <div className="loc-occupancy">
                <span>{t('locationManagement.occupancy')}</span>
                <strong className={loc.capacity > 0 && loc.currentOccupancy >= loc.capacity ? 'loc-full' : ''}>{loc.currentOccupancy} / {loc.capacity}</strong>
              </div>
              {loc.capacity > 0 && (
                <div className="loc-bar" role="progressbar" aria-valuemin={0} aria-valuemax={loc.capacity} aria-valuenow={loc.currentOccupancy}>
                  <div className={`loc-bar-fill loc-bar-${barStep(loc.currentOccupancy, loc.capacity)} ${loc.currentOccupancy >= loc.capacity ? 'is-full' : ''}`} />
                </div>
              )}
              {loc.area ? <p className="loc-hint">{t('locationManagement.area')} {loc.area} {unitLabel(loc.areaUnit || 'sqft')}</p> : null}
              {loc.description && <p className="loc-desc">{loc.description}</p>}
              {canManage && (
                <div className="loc-card-actions">
                  <button className="btn btn-sm btn-secondary" onClick={() => openEdit(loc)}>{t('common.edit')}</button>
                  <button className="btn btn-sm btn-danger" onClick={() => { removal.reset(); setDeleting(loc) }}>{t('common.delete')}</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default LocationManagement

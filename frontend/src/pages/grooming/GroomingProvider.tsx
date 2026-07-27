import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { useSettings } from '../../context/SettingsContext'
import { usePermission } from '../../context/PermissionContext'
import '../../styles/modules.css'

interface Props { onNavigate: (path: string) => void }

type Tab = 'overview' | 'services' | 'locations' | 'resources' | 'staff'

const STATUS_BADGE: Record<string, { bg: string; color: string; icon: string }> = {
  pending:   { bg: '#fef3c7', color: '#92400e', icon: '⏳' },
  verified:  { bg: '#d1fae5', color: '#065f46', icon: '✓' },
  rejected:  { bg: '#fee2e2', color: '#991b1b', icon: '✕' },
  suspended: { bg: '#e5e7eb', color: '#374151', icon: '⏸' },
}

const GroomingProvider: React.FC<Props> = () => {
  const { t } = useTranslation()
  const { formatCurrency } = useSettings()
  const { reloadPermissions } = usePermission()
  const [loading, setLoading] = useState(true)
  const [provider, setProvider] = useState<any>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  // create form
  const [form, setForm] = useState<any>({ businessName: '', providerType: 'groomer', contactPhone: '', contactEmail: '', offersMobile: false })

  const load = useCallback(async () => {
    try {
      setLoading(true); setErr('')
      const res = await apiService.getMyGroomingProvider()
      setProvider(res.data || null)
    } catch (e: any) {
      setErr(e?.response?.data?.message || e.message)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const flash = (m: string) => { setMsg(m); setErr(''); setTimeout(() => setMsg(''), 3000) }
  const fail = (e: any) => setErr(e?.response?.data?.message || e?.message || t('grooming.genericError'))

  const handleCreate = async () => {
    if (!form.businessName.trim()) { setErr(t('grooming.businessNameRequired')); return }
    try {
      setSaving(true); setErr('')
      const res = await apiService.createGroomingProvider(form)
      setProvider(res.data)
      // createProvider() grants the 'groomer' role in the DB, and authMiddleware reads roles live
      // on every request — so refetching permissions here lights up the provider nav (console,
      // orders, earnings) immediately, with no re-login.
      await reloadPermissions()
      flash(t('grooming.created'))
    } catch (e) { fail(e) } finally { setSaving(false) }
  }

  if (loading) return <div className="module-page"><div className="loading-container"><div className="loading-spinner" /></div></div>

  // ── Onboarding: no provider yet ──
  if (!provider) {
    return (
      <div className="module-page">
        <div className="module-header"><h1>💈 {t('grooming.providerTitle')}</h1></div>
        <p className="si-edc77e88">{t('grooming.onboardIntro')}</p>
        {err && <div className="module-alert error">{err}</div>}
        <div className="module-card" style={{ maxWidth: 640 }}>
          <h3>{t('grooming.createBusiness')}</h3>
          <div className="module-form-group">
            <label className="module-label">{t('grooming.businessName')} *</label>
            <input className="module-input" value={form.businessName}
              onChange={e => setForm({ ...form, businessName: e.target.value })}
              placeholder={t('grooming.businessNamePlaceholder')} />
          </div>
          <div className="module-form-row">
            <div className="module-form-group">
              <label className="module-label">{t('grooming.providerType')}</label>
              <select className="module-input" value={form.providerType}
                onChange={e => setForm({ ...form, providerType: e.target.value })}>
                <option value="groomer">{t('grooming.type.groomer')}</option>
                <option value="business">{t('grooming.type.business')}</option>
                <option value="veterinarian">{t('grooming.type.veterinarian')}</option>
                <option value="clinic">{t('grooming.type.clinic')}</option>
              </select>
            </div>
            <div className="module-form-group">
              <label className="module-label">{t('grooming.contactPhone')}</label>
              <input className="module-input" value={form.contactPhone}
                onChange={e => setForm({ ...form, contactPhone: e.target.value })} />
            </div>
          </div>
          <div className="module-form-group">
            <label className="module-label">{t('grooming.contactEmail')}</label>
            <input className="module-input" type="email" value={form.contactEmail}
              onChange={e => setForm({ ...form, contactEmail: e.target.value })} />
          </div>
          <label className="si-6fa2ebba" style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0' }}>
            <input type="checkbox" checked={form.offersMobile}
              onChange={e => setForm({ ...form, offersMobile: e.target.checked })} />
            <span>🚐 {t('grooming.offersMobile')}</span>
          </label>
          <button className="module-btn primary" disabled={saving || !form.businessName.trim()} onClick={handleCreate}>
            {saving ? t('grooming.creating') : t('grooming.createBusinessBtn')}
          </button>
        </div>
      </div>
    )
  }

  const badge = STATUS_BADGE[provider.verificationStatus] || STATUS_BADGE.pending
  const canManage = provider.myRole === 'owner' || provider.myRole === 'manager'

  return (
    <div className="module-page">
      <div className="module-header" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h1>💈 {provider.businessName}</h1>
        <span style={{ background: badge.bg, color: badge.color, padding: '6px 14px', borderRadius: 20, fontWeight: 700, fontSize: 13, alignSelf: 'center' }}>
          {badge.icon} {t(`grooming.status.${provider.verificationStatus}`)}
        </span>
      </div>

      {provider.verificationStatus === 'pending' && (
        <div className="module-alert" style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}>
          {t('grooming.pendingReview')}
        </div>
      )}
      {provider.verificationStatus === 'rejected' && provider.rejectionReason && (
        <div className="module-alert error">{t('grooming.rejectedReason', { reason: provider.rejectionReason })}</div>
      )}
      {msg && <div className="module-alert success">{msg}</div>}
      {err && <div className="module-alert error">{err}</div>}

      <div className="module-tabs si-7e63ec4f">
        {(['overview', 'services', 'locations', 'resources', 'staff'] as Tab[]).map(tb => (
          <button key={tb} className={`module-tab${tab === tb ? ' active' : ''}`} onClick={() => setTab(tb)}>
            {t(`grooming.tab.${tb}`)}
          </button>
        ))}
      </div>

      {tab === 'overview'   && <OverviewTab provider={provider} canManage={canManage} onSaved={load} flash={flash} fail={fail} t={t} />}
      {tab === 'services'   && <ServicesTab provider={provider} canManage={canManage} formatCurrency={formatCurrency} flash={flash} fail={fail} t={t} />}
      {tab === 'locations'  && <LocationsTab provider={provider} canManage={canManage} flash={flash} fail={fail} t={t} />}
      {tab === 'resources'  && <ResourcesTab provider={provider} canManage={canManage} flash={flash} fail={fail} t={t} />}
      {tab === 'staff'      && <StaffTab provider={provider} canManage={canManage} flash={flash} fail={fail} t={t} />}
    </div>
  )
}

// ── Overview: edit business + legal/payout ──
const OverviewTab: React.FC<any> = ({ provider, canManage, onSaved, flash, fail, t }) => {
  const [f, setF] = useState<any>({ ...provider })
  const [saving, setSaving] = useState(false)
  const save = async () => {
    try {
      setSaving(true)
      await apiService.updateGroomingProvider(provider.id, {
        businessName: f.businessName, description: f.description, contactPhone: f.contactPhone,
        contactEmail: f.contactEmail, offersMobile: f.offersMobile, offersAtPremises: f.offersAtPremises,
        legalName: f.legalName, pan: f.pan, gstin: f.gstin, businessAddress: f.businessAddress,
        payoutAccountName: f.payoutAccountName, payoutAccountNumber: f.payoutAccountNumber,
        payoutIfsc: f.payoutIfsc, payoutUpi: f.payoutUpi,
      })
      flash(t('grooming.saved')); onSaved()
    } catch (e) { fail(e) } finally { setSaving(false) }
  }
  const set = (k: string, v: any) => setF({ ...f, [k]: v })
  return (
    <div className="module-card">
      <h3>{t('grooming.businessProfile')}</h3>
      <div className="module-form-row">
        <div className="module-form-group"><label className="module-label">{t('grooming.businessName')}</label>
          <input className="module-input" value={f.businessName || ''} disabled={!canManage} onChange={e => set('businessName', e.target.value)} /></div>
        <div className="module-form-group"><label className="module-label">{t('grooming.contactPhone')}</label>
          <input className="module-input" value={f.contactPhone || ''} disabled={!canManage} onChange={e => set('contactPhone', e.target.value)} /></div>
      </div>
      <div className="module-form-group"><label className="module-label">{t('grooming.description')}</label>
        <textarea className="module-input" rows={2} value={f.description || ''} disabled={!canManage} onChange={e => set('description', e.target.value)} /></div>

      <h3 style={{ marginTop: 18 }}>{t('grooming.legalPayout')}</h3>
      <div className="module-form-row">
        <div className="module-form-group"><label className="module-label">{t('grooming.legalName')}</label>
          <input className="module-input" value={f.legalName || ''} disabled={!canManage} onChange={e => set('legalName', e.target.value)} /></div>
        <div className="module-form-group"><label className="module-label">PAN</label>
          <input className="module-input" value={f.pan || ''} disabled={!canManage} onChange={e => set('pan', e.target.value)} /></div>
      </div>
      <div className="module-form-row">
        <div className="module-form-group"><label className="module-label">GSTIN</label>
          <input className="module-input" value={f.gstin || ''} disabled={!canManage} onChange={e => set('gstin', e.target.value)} /></div>
        <div className="module-form-group"><label className="module-label">{t('grooming.payoutUpi')}</label>
          <input className="module-input" value={f.payoutUpi || ''} disabled={!canManage} onChange={e => set('payoutUpi', e.target.value)} /></div>
      </div>
      <div className="module-form-row">
        <div className="module-form-group"><label className="module-label">{t('grooming.payoutAccountName')}</label>
          <input className="module-input" value={f.payoutAccountName || ''} disabled={!canManage} onChange={e => set('payoutAccountName', e.target.value)} /></div>
        <div className="module-form-group"><label className="module-label">{t('grooming.payoutAccountNumber')}</label>
          <input className="module-input" value={f.payoutAccountNumber || ''} disabled={!canManage} onChange={e => set('payoutAccountNumber', e.target.value)} /></div>
      </div>
      <div className="module-form-group"><label className="module-label">IFSC</label>
        <input className="module-input" value={f.payoutIfsc || ''} disabled={!canManage} onChange={e => set('payoutIfsc', e.target.value)} /></div>
      {canManage && <button className="module-btn primary" disabled={saving} onClick={save}>{saving ? t('grooming.saving') : t('grooming.saveChanges')}</button>}
    </div>
  )
}

// ── Services ──
const ServicesTab: React.FC<any> = ({ provider, canManage, formatCurrency, flash, fail, t }) => {
  const [items, setItems] = useState<any[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [n, setN] = useState<any>({ name: '', basePrice: '', durationMinutes: 60, taxPercent: 18, paymentRule: 'full' })
  const reload = useCallback(async () => { try { setItems((await apiService.listGroomingServices(provider.id)).data || []) } catch (e) { fail(e) } }, [provider.id])
  useEffect(() => { reload() }, [reload])
  const add = async () => {
    if (!n.name.trim() || !n.basePrice) { fail({ message: t('grooming.serviceNamePriceRequired') }); return }
    try { await apiService.addGroomingService(provider.id, { ...n, basePrice: Number(n.basePrice) }); setShowAdd(false); setN({ name: '', basePrice: '', durationMinutes: 60, taxPercent: 18, paymentRule: 'full' }); flash(t('grooming.serviceAdded')); reload() } catch (e) { fail(e) }
  }
  const remove = async (id: string) => { try { await apiService.deleteGroomingService(provider.id, id); reload() } catch (e) { fail(e) } }
  return (
    <div className="module-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <h3>{t('grooming.tab.services')}</h3>
        {canManage && <button className="module-btn primary small" onClick={() => setShowAdd(s => !s)}>+ {t('grooming.addService')}</button>}
      </div>
      {showAdd && canManage && (
        <div className="module-alert si-e120eda2" style={{ marginTop: 10 }}>
          <div className="module-form-row">
            <div className="module-form-group"><label className="module-label">{t('grooming.serviceName')} *</label>
              <input className="module-input" value={n.name} onChange={e => setN({ ...n, name: e.target.value })} placeholder={t('grooming.serviceNamePlaceholder')} /></div>
            <div className="module-form-group"><label className="module-label">{t('grooming.price')} *</label>
              <input className="module-input" type="number" min={0} value={n.basePrice} onChange={e => setN({ ...n, basePrice: e.target.value })} /></div>
          </div>
          <div className="module-form-row">
            <div className="module-form-group"><label className="module-label">{t('grooming.durationMin')}</label>
              <input className="module-input" type="number" min={0} value={n.durationMinutes} onChange={e => setN({ ...n, durationMinutes: Number(e.target.value) })} /></div>
            <div className="module-form-group"><label className="module-label">{t('grooming.taxPercent')}</label>
              <input className="module-input" type="number" min={0} value={n.taxPercent} onChange={e => setN({ ...n, taxPercent: Number(e.target.value) })} /></div>
            <div className="module-form-group"><label className="module-label">{t('grooming.paymentRule')}</label>
              <select className="module-input" value={n.paymentRule} onChange={e => setN({ ...n, paymentRule: e.target.value })}>
                <option value="full">{t('grooming.payFull')}</option>
                <option value="deposit">{t('grooming.payDeposit')}</option>
              </select></div>
          </div>
          <button className="module-btn primary" onClick={add}>{t('grooming.addService')}</button>
        </div>
      )}
      {items.length === 0 ? <p className="si-676930d7">{t('grooming.noServices')}</p> : (
        <div className="data-table-container" style={{ marginTop: 10 }}>
          <table className="data-table">
            <thead><tr><th>{t('grooming.serviceName')}</th><th>{t('grooming.price')}</th><th>{t('grooming.durationMin')}</th><th>{t('grooming.paymentRule')}</th>{canManage && <th></th>}</tr></thead>
            <tbody>
              {items.map(s => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{formatCurrency(Number(s.basePrice))}{Number(s.taxPercent) > 0 ? ` +${s.taxPercent}%` : ''}</td>
                  <td>{s.durationMinutes} min</td>
                  <td>{t(s.paymentRule === 'deposit' ? 'grooming.payDeposit' : 'grooming.payFull')}</td>
                  {canManage && <td><button className="btn btn-sm btn-outline" onClick={() => remove(s.id)}>{t('grooming.remove')}</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Locations ──
const LocationsTab: React.FC<any> = ({ provider, canManage, flash, fail, t }) => {
  const [items, setItems] = useState<any[]>([])
  const [n, setN] = useState<any>({ name: '', locationType: 'premises', city: '' })
  const reload = useCallback(async () => { try { setItems((await apiService.listGroomingLocations(provider.id)).data || []) } catch (e) { fail(e) } }, [provider.id])
  useEffect(() => { reload() }, [reload])
  const add = async () => { if (!n.name.trim()) { fail({ message: t('grooming.nameRequired') }); return } try { await apiService.addGroomingLocation(provider.id, n); setN({ name: '', locationType: 'premises', city: '' }); flash(t('grooming.saved')); reload() } catch (e) { fail(e) } }
  const remove = async (id: string) => { try { await apiService.deleteGroomingLocation(provider.id, id); reload() } catch (e) { fail(e) } }
  return (
    <div className="module-card">
      <h3>{t('grooming.tab.locations')}</h3>
      {canManage && (
        <div className="module-form-row" style={{ alignItems: 'flex-end' }}>
          <div className="module-form-group"><label className="module-label">{t('grooming.locationName')}</label>
            <input className="module-input" value={n.name} onChange={e => setN({ ...n, name: e.target.value })} /></div>
          <div className="module-form-group"><label className="module-label">{t('grooming.locationType')}</label>
            <select className="module-input" value={n.locationType} onChange={e => setN({ ...n, locationType: e.target.value })}>
              <option value="premises">{t('grooming.premises')}</option>
              <option value="mobile_zone">{t('grooming.mobileZone')}</option>
            </select></div>
          <div className="module-form-group"><label className="module-label">{t('grooming.city')}</label>
            <input className="module-input" value={n.city} onChange={e => setN({ ...n, city: e.target.value })} /></div>
          <button className="module-btn primary" onClick={add}>+ {t('grooming.add')}</button>
        </div>
      )}
      {items.length === 0 ? <p className="si-676930d7">{t('grooming.noLocations')}</p> : (
        <ul style={{ listStyle: 'none', padding: 0, marginTop: 10 }}>
          {items.map(l => (
            <li key={l.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #eee' }}>
              <span>📍 <strong>{l.name}</strong> · {t(l.locationType === 'mobile_zone' ? 'grooming.mobileZone' : 'grooming.premises')}{l.city ? ` · ${l.city}` : ''}</span>
              {canManage && <button className="btn btn-sm btn-outline" onClick={() => remove(l.id)}>{t('grooming.remove')}</button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Resources ──
const ResourcesTab: React.FC<any> = ({ provider, canManage, flash, fail, t }) => {
  const [items, setItems] = useState<any[]>([])
  const [n, setN] = useState<any>({ name: '', resourceType: 'grooming_table' })
  const reload = useCallback(async () => { try { setItems((await apiService.listGroomingResources(provider.id)).data || []) } catch (e) { fail(e) } }, [provider.id])
  useEffect(() => { reload() }, [reload])
  const add = async () => { if (!n.name.trim()) { fail({ message: t('grooming.nameRequired') }); return } try { await apiService.addGroomingResource(provider.id, n); setN({ name: '', resourceType: 'grooming_table' }); flash(t('grooming.saved')); reload() } catch (e) { fail(e) } }
  const remove = async (id: string) => { try { await apiService.deleteGroomingResource(provider.id, id); reload() } catch (e) { fail(e) } }
  const types = ['grooming_table', 'bath_station', 'drying_cage', 'spa_room', 'other']
  return (
    <div className="module-card">
      <h3>{t('grooming.tab.resources')}</h3>
      {canManage && (
        <div className="module-form-row" style={{ alignItems: 'flex-end' }}>
          <div className="module-form-group"><label className="module-label">{t('grooming.resourceName')}</label>
            <input className="module-input" value={n.name} onChange={e => setN({ ...n, name: e.target.value })} /></div>
          <div className="module-form-group"><label className="module-label">{t('grooming.resourceType')}</label>
            <select className="module-input" value={n.resourceType} onChange={e => setN({ ...n, resourceType: e.target.value })}>
              {types.map(ty => <option key={ty} value={ty}>{t(`grooming.resType.${ty}`)}</option>)}
            </select></div>
          <button className="module-btn primary" onClick={add}>+ {t('grooming.add')}</button>
        </div>
      )}
      {items.length === 0 ? <p className="si-676930d7">{t('grooming.noResources')}</p> : (
        <ul style={{ listStyle: 'none', padding: 0, marginTop: 10 }}>
          {items.map(r => (
            <li key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #eee' }}>
              <span>🛁 <strong>{r.name}</strong> · {t(`grooming.resType.${r.resourceType}`)}</span>
              {canManage && <button className="btn btn-sm btn-outline" onClick={() => remove(r.id)}>{t('grooming.remove')}</button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Staff ──
const StaffTab: React.FC<any> = ({ provider, canManage, flash, fail, t }) => {
  const [items, setItems] = useState<any[]>([])
  const [email, setEmail] = useState(''); const [role, setRole] = useState('staff')
  const reload = useCallback(async () => { try { setItems((await apiService.listGroomingStaff(provider.id)).data || []) } catch (e) { fail(e) } }, [provider.id])
  useEffect(() => { reload() }, [reload])
  const add = async () => { if (!email.trim()) { fail({ message: t('grooming.emailRequired') }); return } try { await apiService.addGroomingStaff(provider.id, email.trim(), role); setEmail(''); flash(t('grooming.staffAdded')); reload() } catch (e) { fail(e) } }
  const remove = async (userId: string) => { try { await apiService.removeGroomingStaff(provider.id, userId); reload() } catch (e) { fail(e) } }
  return (
    <div className="module-card">
      <h3>{t('grooming.tab.staff')}</h3>
      <p className="si-676930d7">{t('grooming.staffIntro')}</p>
      {canManage && (
        <div className="module-form-row" style={{ alignItems: 'flex-end' }}>
          <div className="module-form-group"><label className="module-label">{t('grooming.staffEmail')}</label>
            <input className="module-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" /></div>
          <div className="module-form-group"><label className="module-label">{t('grooming.role')}</label>
            <select className="module-input" value={role} onChange={e => setRole(e.target.value)}>
              <option value="staff">{t('grooming.roleStaff')}</option>
              <option value="manager">{t('grooming.roleManager')}</option>
            </select></div>
          <button className="module-btn primary" onClick={add}>+ {t('grooming.addStaff')}</button>
        </div>
      )}
      <ul style={{ listStyle: 'none', padding: 0, marginTop: 10 }}>
        {items.map(s => (
          <li key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #eee' }}>
            <span>👤 <strong>{s.firstName} {s.lastName}</strong> · {s.email} · {t(`grooming.role${s.providerRole === 'manager' ? 'Manager' : s.providerRole === 'owner' ? 'Owner' : 'Staff'}`)}</span>
            {canManage && s.providerRole !== 'owner' && <button className="btn btn-sm btn-outline" onClick={() => remove(s.userId)}>{t('grooming.remove')}</button>}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default GroomingProvider

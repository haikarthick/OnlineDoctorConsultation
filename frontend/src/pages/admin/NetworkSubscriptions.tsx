import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { useSettings } from '../../context/SettingsContext'
import './NetworkSubscriptions.css'

interface SubscriptionPlan {
  id: string
  name: string
  description?: string
  maxSeats?: number
  maxHospitals?: number
  priceMonthly?: number
  priceAnnually?: number
  currency: string
  features: Record<string, boolean>
  isPublished: boolean
  sortOrder: number
  isActive: boolean
}

interface NetworkSub {
  networkId: string
  networkName: string
  isApproved: boolean
  subscriptionId?: string
  seatLimit: number
  status: string
  billingCycle: string
  suspendedAt?: string
  suspensionReason?: string
  adminNotes?: string
  planName?: string
  planId?: string
  seatsUsed: number
  hospitalsCount: number
}

interface PricingSettings {
  plans: SubscriptionPlan[]
  settings: Record<string, string>
}

type TabType = 'networks' | 'plans' | 'pricing'

function getSeatColor(used: number, limit: number): string {
  if (!limit) return 'seat-bar-green'
  const pct = (used / limit) * 100
  if (pct >= 100) return 'seat-bar-red'
  if (pct >= 70) return 'seat-bar-amber'
  return 'seat-bar-green'
}

// formatPrice is replaced by useSettings().formatCurrency inside the component

export default function NetworkSubscriptions() {
  const { t } = useTranslation()
  const { formatCurrency } = useSettings()
  const [tab, setTab] = useState<TabType>('networks')
  const [networks, setNetworks] = useState<NetworkSub[]>([])
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [pricingSettings, setPricingSettings] = useState<PricingSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Modals
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [editingPlan, setEditingPlan] = useState<Partial<SubscriptionPlan> | null>(null)
  const [showSubModal, setShowSubModal] = useState<NetworkSub | null>(null)
  const [showSuspendModal, setShowSuspendModal] = useState<NetworkSub | null>(null)
  const [showOverrideModal, setShowOverrideModal] = useState<NetworkSub | null>(null)
  const [suspendReason, setSuspendReason] = useState('')
  const [overrideSeatLimit, setOverrideSeatLimit] = useState('')
  const [subForm, setSubForm] = useState({ planId: '', seatLimit: '', status: 'active', billingCycle: 'none', adminNotes: '' })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [netsRes, pricingRes] = await Promise.all([
        apiService.adminListNetworkSubscriptions(),
        apiService.getPricingSettings(),
      ])
      if (netsRes.success) setNetworks(netsRes.data || [])
      if (pricingRes.success) {
        setPricingSettings(pricingRes.data)
        setPlans(pricingRes.data?.plans || [])
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const showMsg = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }

  const handleSavePlan = async () => {
    try {
      if (editingPlan?.id) {
        await apiService.updateNetworkPlan(editingPlan.id, editingPlan)
      } else {
        await apiService.createNetworkPlan(editingPlan || {})
      }
      showMsg('Plan saved successfully')
      setShowPlanModal(false)
      setEditingPlan(null)
      loadData()
    } catch (e: any) { setError(e.message) }
  }

  const handlePublishToggle = async (plan: SubscriptionPlan) => {
    try {
      await apiService.updateNetworkPlan(plan.id, { is_published: !plan.isPublished })
      showMsg(`Plan ${plan.isPublished ? 'hidden' : 'published'}`)
      loadData()
    } catch (e: any) { setError(e.message) }
  }

  const handleSetSubscription = async () => {
    if (!showSubModal) return
    try {
      await apiService.setNetworkSubscription(showSubModal.networkId, {
        plan_id: subForm.planId || undefined,
        seat_limit: parseInt(subForm.seatLimit) || 5,
        status: subForm.status,
        billing_cycle: subForm.billingCycle,
        admin_notes: subForm.adminNotes,
      })
      showMsg('Subscription updated')
      setShowSubModal(null)
      loadData()
    } catch (e: any) { setError(e.message) }
  }

  const handleSuspend = async () => {
    if (!showSuspendModal) return
    try {
      await apiService.suspendNetwork(showSuspendModal.networkId, suspendReason)
      showMsg('Network suspended')
      setShowSuspendModal(null)
      setSuspendReason('')
      loadData()
    } catch (e: any) { setError(e.message) }
  }

  const handleUnsuspend = async (networkId: string) => {
    try {
      await apiService.unsuspendNetwork(networkId)
      showMsg('Network unsuspended')
      loadData()
    } catch (e: any) { setError(e.message) }
  }

  const handleOverrideSeats = async () => {
    if (!showOverrideModal) return
    try {
      await apiService.overrideSeatLimit(showOverrideModal.networkId, parseInt(overrideSeatLimit))
      showMsg('Seat limit overridden')
      setShowOverrideModal(null)
      setOverrideSeatLimit('')
      loadData()
    } catch (e: any) { setError(e.message) }
  }

  const handlePricingSave = async (updates: Record<string, string>) => {
    try {
      await apiService.updatePricingSettings(updates)
      showMsg('Pricing settings saved')
      loadData()
    } catch (e: any) { setError(e.message) }
  }

  if (loading) return <div className="module-page"><div className="loading-spinner" /></div>

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>💳 {t('adminNetworkSubscriptions.title')}</h1>
        <p>{t('adminNetworkSubscriptions.subtitle')}</p>
      </div>

      {error && <div className="module-alert error" onClick={() => setError('')}>{error} ✕</div>}
      {success && <div className="module-alert success">{success}</div>}

      <div className="module-tabs">
        <button className={`module-tab ${tab === 'networks' ? 'active' : ''}`} onClick={() => setTab('networks')}>
          🏥 {t('adminNetworkSubscriptions.networksTab')} ({networks.length})
        </button>
        <button className={`module-tab ${tab === 'plans' ? 'active' : ''}`} onClick={() => setTab('plans')}>
          📋 {t('adminNetworkSubscriptions.plansTab')} ({plans.length})
        </button>
        <button className={`module-tab ${tab === 'pricing' ? 'active' : ''}`} onClick={() => setTab('pricing')}>
          👁️ {t('adminNetworkSubscriptions.pricingTab')}
        </button>
      </div>

      {/* ── Tab: Networks ── */}
      {tab === 'networks' && (
        <div className="module-card">
          <div className="data-table-container">
            <table className="module-table">
              <thead>
                <tr>
                  <th>{t('adminNetworkSubscriptions.col.network')}</th>
                  <th>{t('adminNetworkSubscriptions.col.plan')}</th>
                  <th>{t('adminNetworkSubscriptions.col.seats')}</th>
                  <th>{t('adminNetworkSubscriptions.col.hospitals')}</th>
                  <th>{t('adminNetworkSubscriptions.col.status')}</th>
                  <th>{t('adminNetworkSubscriptions.col.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {networks.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>No networks found</td></tr>
                ) : networks.map(n => {
                  const pct = n.seatLimit ? Math.round((n.seatsUsed / n.seatLimit) * 100) : 0
                  const barClass = getSeatColor(n.seatsUsed, n.seatLimit)
                  return (
                    <tr key={n.networkId}>
                      <td><strong>{n.networkName}</strong></td>
                      <td>{n.planName || <span className="no-plan-badge">No Plan</span>}</td>
                      <td>
                        <div className="seat-usage">
                          <span className="seat-count">{n.seatsUsed}/{n.seatLimit ?? '∞'}</span>
                          {n.seatLimit && (
                            <div className="seat-bar-track">
                              <div className={`seat-bar ${barClass}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                          )}
                        </div>
                      </td>
                      <td>{n.hospitalsCount}</td>
                      <td>
                        <span className={`module-badge badge-${n.status === 'active' || n.status === 'trial' ? 'success' : n.status === 'suspended' ? 'error' : 'pending'}`}>
                          {n.status}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button className="module-btn small" onClick={() => { setShowSubModal(n); setSubForm({ planId: n.planId || '', seatLimit: String(n.seatLimit), status: n.status, billingCycle: n.billingCycle || 'none', adminNotes: n.adminNotes || '' }) }}>
                            {t('adminNetworkSubscriptions.action.setPlan')}
                          </button>
                          <button className="module-btn small" onClick={() => { setShowOverrideModal(n); setOverrideSeatLimit(String(n.seatLimit)) }}>
                            {t('adminNetworkSubscriptions.action.overrideSeats')}
                          </button>
                          {n.status === 'suspended' ? (
                            <button className="module-btn small success" onClick={() => handleUnsuspend(n.networkId)}>
                              {t('adminNetworkSubscriptions.action.unsuspend')}
                            </button>
                          ) : (
                            <button className="module-btn small danger" onClick={() => { setShowSuspendModal(n); setSuspendReason('') }}>
                              {t('adminNetworkSubscriptions.action.suspend')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab: Plans ── */}
      {tab === 'plans' && (
        <div className="module-card">
          <div className="card-header">
            <h3>{t('adminNetworkSubscriptions.plansTitle')}</h3>
            <button className="module-btn primary" onClick={() => { setEditingPlan({}); setShowPlanModal(true) }}>
              + {t('adminNetworkSubscriptions.newPlan')}
            </button>
          </div>
          <div className="data-table-container">
            <table className="module-table">
              <thead>
                <tr>
                  <th>{t('adminNetworkSubscriptions.col.planName')}</th>
                  <th>{t('adminNetworkSubscriptions.col.seats')}</th>
                  <th>{t('adminNetworkSubscriptions.col.hospitals')}</th>
                  <th>{t('adminNetworkSubscriptions.col.monthly')}</th>
                  <th>{t('adminNetworkSubscriptions.col.annual')}</th>
                  <th>{t('adminNetworkSubscriptions.col.visibility')}</th>
                  <th>{t('adminNetworkSubscriptions.col.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {plans.map(plan => (
                  <tr key={plan.id}>
                    <td><strong>{plan.name}</strong>{plan.description && <div className="plan-desc">{plan.description}</div>}</td>
                    <td>{plan.maxSeats ?? '∞'}</td>
                    <td>{plan.maxHospitals ?? '∞'}</td>
                    <td>{plan.priceMonthly != null ? formatCurrency(plan.priceMonthly) : '—'}</td>
                    <td>{plan.priceAnnually != null ? formatCurrency(plan.priceAnnually) : '—'}</td>
                    <td>
                      <span className={`module-badge ${plan.isPublished ? 'badge-success' : 'badge-pending'}`}>
                        {plan.isPublished ? '🟢 Published' : '🔴 Hidden'}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button className="module-btn small" onClick={() => { setEditingPlan(plan); setShowPlanModal(true) }}>Edit</button>
                        <button className={`module-btn small ${plan.isPublished ? '' : 'success'}`} onClick={() => handlePublishToggle(plan)}>
                          {plan.isPublished ? 'Hide' : 'Publish'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab: Pricing Visibility ── */}
      {tab === 'pricing' && pricingSettings && (
        <PricingVisibilityPanel settings={pricingSettings.settings} onSave={handlePricingSave} />
      )}

      {/* ── Modal: Set Subscription ── */}
      {showSubModal && (
        <div className="modal-overlay" onClick={() => setShowSubModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowSubModal(null)}>✕</button>
            <h3>Set Subscription: {showSubModal.networkName}</h3>
            <div className="module-form">
              <div className="module-form-group">
                <label className="module-label">Subscription Plan</label>
                <select className="module-input" value={subForm.planId} onChange={e => setSubForm(f => ({ ...f, planId: e.target.value }))}>
                  <option value="">— No plan —</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.name} (max {p.maxSeats ?? '∞'} seats)</option>)}
                </select>
              </div>
              <div className="module-form-row">
                <div className="module-form-group">
                  <label className="module-label">Seat Limit</label>
                  <input type="number" className="module-input" value={subForm.seatLimit} onChange={e => setSubForm(f => ({ ...f, seatLimit: e.target.value }))} min={1} />
                </div>
                <div className="module-form-group">
                  <label className="module-label">Status</label>
                  <select className="module-input" value={subForm.status} onChange={e => setSubForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="trial">Trial</option>
                    <option value="active">Active</option>
                    <option value="expired">Expired</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
              <div className="module-form-group">
                <label className="module-label">Billing Cycle</label>
                <select className="module-input" value={subForm.billingCycle} onChange={e => setSubForm(f => ({ ...f, billingCycle: e.target.value }))}>
                  <option value="none">None / Custom</option>
                  <option value="monthly">Monthly</option>
                  <option value="annually">Annually</option>
                </select>
              </div>
              <div className="module-form-group">
                <label className="module-label">Admin Notes</label>
                <textarea className="module-input" rows={2} value={subForm.adminNotes} onChange={e => setSubForm(f => ({ ...f, adminNotes: e.target.value }))} />
              </div>
              <button className="module-btn primary" onClick={handleSetSubscription}>Save Subscription</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Suspend ── */}
      {showSuspendModal && (
        <div className="modal-overlay" onClick={() => setShowSuspendModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowSuspendModal(null)}>✕</button>
            <h3>⛔ Suspend: {showSuspendModal.networkName}</h3>
            <p className="suspend-warning">All staff in this network will lose access. Pet owners are unaffected.</p>
            <div className="module-form-group">
              <label className="module-label">Reason for Suspension *</label>
              <textarea className="module-input" rows={3} value={suspendReason} onChange={e => setSuspendReason(e.target.value)} placeholder="E.g., Non-payment, Terms violation..." />
            </div>
            <button className="module-btn danger" disabled={!suspendReason.trim()} onClick={handleSuspend}>Confirm Suspend</button>
          </div>
        </div>
      )}

      {/* ── Modal: Override Seats ── */}
      {showOverrideModal && (
        <div className="modal-overlay" onClick={() => setShowOverrideModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowOverrideModal(null)}>✕</button>
            <h3>Override Seat Limit: {showOverrideModal.networkName}</h3>
            <p>Current: {showOverrideModal.seatsUsed}/{showOverrideModal.seatLimit} seats used</p>
            <div className="module-form-group">
              <label className="module-label">New Seat Limit</label>
              <input type="number" className="module-input" value={overrideSeatLimit} onChange={e => setOverrideSeatLimit(e.target.value)} min={1} />
            </div>
            <button className="module-btn primary" onClick={handleOverrideSeats}>Apply Override</button>
          </div>
        </div>
      )}

      {/* ── Modal: Plan Edit ── */}
      {showPlanModal && editingPlan !== null && (
        <div className="modal-overlay" onClick={() => setShowPlanModal(false)}>
          <div className="modal-content modal-wide" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowPlanModal(false)}>✕</button>
            <h3>{editingPlan.id ? 'Edit Plan' : 'New Subscription Plan'}</h3>
            <div className="module-form">
              <div className="module-form-row">
                <div className="module-form-group">
                  <label className="module-label">Plan Name *</label>
                  <input className="module-input" value={editingPlan.name || ''} onChange={e => setEditingPlan(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="module-form-group">
                  <label className="module-label">Sort Order</label>
                  <input type="number" className="module-input" value={editingPlan.sortOrder ?? 0} onChange={e => setEditingPlan(p => ({ ...p, sortOrder: parseInt(e.target.value) }))} />
                </div>
              </div>
              <div className="module-form-group">
                <label className="module-label">Description</label>
                <textarea className="module-input" rows={2} value={editingPlan.description || ''} onChange={e => setEditingPlan(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="module-form-row">
                <div className="module-form-group">
                  <label className="module-label">Max Seats (blank = unlimited)</label>
                  <input type="number" className="module-input" value={editingPlan.maxSeats ?? ''} onChange={e => setEditingPlan(p => ({ ...p, maxSeats: e.target.value ? parseInt(e.target.value) : undefined }))} min={1} />
                </div>
                <div className="module-form-group">
                  <label className="module-label">Max Hospitals (blank = unlimited)</label>
                  <input type="number" className="module-input" value={editingPlan.maxHospitals ?? ''} onChange={e => setEditingPlan(p => ({ ...p, maxHospitals: e.target.value ? parseInt(e.target.value) : undefined }))} min={1} />
                </div>
              </div>
              <div className="module-form-row">
                <div className="module-form-group">
                  <label className="module-label">Monthly Price (leave blank = not set)</label>
                  <input type="number" className="module-input" value={editingPlan.priceMonthly ?? ''} onChange={e => setEditingPlan(p => ({ ...p, priceMonthly: e.target.value ? parseFloat(e.target.value) : undefined }))} min={0} />
                </div>
                <div className="module-form-group">
                  <label className="module-label">Annual Price (leave blank = not set)</label>
                  <input type="number" className="module-input" value={editingPlan.priceAnnually ?? ''} onChange={e => setEditingPlan(p => ({ ...p, priceAnnually: e.target.value ? parseFloat(e.target.value) : undefined }))} min={0} />
                </div>
              </div>
              <div className="module-form-group">
                <label className="module-label publish-toggle-label">
                  <input type="checkbox" checked={editingPlan.isPublished || false} onChange={e => setEditingPlan(p => ({ ...p, isPublished: e.target.checked }))} />
                  Publish this plan (visible to corporate admins when global visibility is ON)
                </label>
              </div>
              <button className="module-btn primary" onClick={handleSavePlan}>Save Plan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PricingVisibilityPanel({ settings, onSave }: { settings: Record<string, string>; onSave: (updates: Record<string, string>) => void }) {
  const [form, setForm] = useState<Record<string, string>>({ ...settings })

  const toggle = (key: string) => setForm(f => ({ ...f, [key]: f[key] === 'true' ? 'false' : 'true' }))
  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  const globalOn = form['pricing.visibility.global'] === 'true'

  return (
    <div className="pricing-panel module-card">
      <h3>🔒 Pricing Visibility Control</h3>
      <p className="pricing-panel-desc">All pricing is private by default. Toggle on when you're ready to publish prices to corporate admins and the public.</p>

      <div className="pricing-global-row">
        <div>
          <strong>Global Pricing Visibility</strong>
          <div className="pricing-hint">When OFF, all pricing placeholders show CTA text instead of prices</div>
        </div>
        <button className={`toggle-btn ${globalOn ? 'on' : 'off'}`} onClick={() => toggle('pricing.visibility.global')}>
          {globalOn ? '🟢 ON' : '🔴 OFF'}
        </button>
      </div>

      <div className="pricing-cta-section">
        <h4>Contact-us Fallback Text (shown when pricing is hidden)</h4>
        <div className="module-form-row-3">
          <div className="module-form-group">
            <label className="module-label">CTA Text</label>
            <input className="module-input" value={form['pricing.cta_text'] || ''} onChange={e => set('pricing.cta_text', e.target.value)} placeholder="Contact us for pricing" />
          </div>
          <div className="module-form-group">
            <label className="module-label">CTA Email</label>
            <input className="module-input" type="email" value={form['pricing.cta_email'] || ''} onChange={e => set('pricing.cta_email', e.target.value)} placeholder="sales@vetcare.com" />
          </div>
          <div className="module-form-group">
            <label className="module-label">CTA Phone</label>
            <input className="module-input" value={form['pricing.cta_phone'] || ''} onChange={e => set('pricing.cta_phone', e.target.value)} placeholder="+91 98765 43210" />
          </div>
        </div>
      </div>

      <div className="pricing-sections">
        <h4>Visibility by Section (only applies when Global is ON)</h4>
        {[
          { key: 'pricing.visibility.landing_page', label: '🏠 Landing page pricing section' },
          { key: 'pricing.visibility.registration', label: '📝 Corporate admin registration' },
          { key: 'pricing.visibility.corp_dashboard', label: '📊 Corporate admin dashboard' },
          { key: 'pricing.visibility.upgrade_prompts', label: '⬆️ Seat limit upgrade prompts' },
        ].map(({ key, label }) => (
          <div key={key} className="pricing-section-row">
            <span>{label}</span>
            <button className={`toggle-btn small ${form[key] === 'true' ? 'on' : 'off'}`} onClick={() => toggle(key)} disabled={!globalOn}>
              {form[key] === 'true' ? '🟢 ON' : '🔴 OFF'}
            </button>
          </div>
        ))}
      </div>

      <div className="pricing-preview">
        <h4>Preview: What corporate admins currently see</h4>
        <div className="preview-card">
          <div className="preview-plan-name">Your Plan: Trial</div>
          <div className="preview-seats">Seats used: 2 / 5 ████░░░░░░</div>
          {globalOn && form['pricing.visibility.corp_dashboard'] === 'true'
            ? <div className="preview-price">Monthly: {form['pricing.price_example'] || 'Contact admin to set prices first'}</div>
            : <div className="preview-cta">{form['pricing.cta_text'] || 'Contact us for pricing'} · {form['pricing.cta_email']}</div>
          }
        </div>
      </div>

      <button className="module-btn primary" onClick={() => onSave(form)}>Save All Settings</button>
    </div>
  )
}

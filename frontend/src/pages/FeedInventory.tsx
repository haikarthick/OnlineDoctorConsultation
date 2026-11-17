import React, { useState, useEffect } from 'react'
import apiService from '../services/api'
import './ModulePage.css'
import { Enterprise, FeedItem, FeedAnalytics } from '../types'
import { useTranslation } from 'react-i18next'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import { useSaveAction } from '../hooks/useSaveAction'
import { useSettings } from '../context/SettingsContext'
import { BottomSheet } from '../components/mobile/BottomSheet'
import { NumberStepper } from '../components/mobile/NumberStepper'
import { SaveState } from '../components/mobile/SaveState'
import { StepForm, type FormStep } from '../components/mobile/StepForm'
import { userMessage } from '../utils/userMessage'

const FEED_TYPES = ['hay', 'grain', 'pellet', 'silage', 'mineral', 'supplement', 'concentrate', 'forage', 'medicated', 'other']
const UNITS = ['kg', 'lb', 'ton', 'bag', 'bale', 'liter', 'gallon']

interface FeedForm {
  feedType: string; name: string; brand: string; batchNumber: string; quantityInStock: string; unit: string
  minimumStockLevel: string; costPerUnit: string; expiryDate: string; storageLocation: string; supplier: string
}
const emptyForm = (): FeedForm => ({
  feedType: 'hay', name: '', brand: '', batchNumber: '', quantityInStock: '', unit: 'kg',
  minimumStockLevel: '50', costPerUnit: '', expiryDate: '', storageLocation: '', supplier: '',
})
/** The bar's height in 5% steps (a class each - no inline style): 0..20. */
const barStep = (value: number, peak: number) => Math.min(20, Math.max(0, Math.round((value / Math.max(1, peak)) * 20)))
const toNumber = (v: string) => parseFloat(v.replace(',', '.'))

const FeedInventory: React.FC = () => {
  const { t } = useTranslation()
  const { formatCurrency, formatDate } = useSettings()

  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [selectedEnterpriseId, setSelectedEnterpriseId] = useState('')
  const [feeds, setFeeds] = useState<FeedItem[]>([])
  const [analytics, setAnalytics] = useState<FeedAnalytics | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'inventory' | 'analytics'>('inventory')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FeedForm>(emptyForm)
  const [restockFeed, setRestockFeed] = useState<FeedItem | null>(null)
  const [restockQty, setRestockQty] = useState('')
  const [showUse, setShowUse] = useState(false)
  const [use, setUse] = useState({ feedId: '', quantityUsed: '', notes: '' })
  const [deleting, setDeleting] = useState<FeedItem | null>(null)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    apiService.listEnterprises({ limit: 100 })
      .then((res: any) => {
        const items = res.data?.items || []
        setEnterprises(items)
        if (items.length === 1) setSelectedEnterpriseId(items[0].id)
      })
      .catch(() => setEnterprises([]))
  }, [])

  const fetchData = async () => {
    if (!selectedEnterpriseId) return
    try {
      setLoading(true); setError('')
      const [feedRes, analyticsRes] = await Promise.all([
        apiService.listFeeds(selectedEnterpriseId),
        apiService.getFeedAnalytics(selectedEnterpriseId),
      ])
      setFeeds(feedRes.data?.items || [])
      setAnalytics(analyticsRes.data || null)
    } catch (err: any) {
      setError(userMessage(err, 'feedInventory.loadFailed'))
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [selectedEnterpriseId])
  useAutoRefresh('feed-inventory', fetchData)

  const typeLabel = (c: string) => t('feedInventory.types.' + c, { defaultValue: c })
  const unitLabel = (u: string) => t('feedInventory.units.' + u, { defaultValue: u })
  const setF = <K extends keyof FeedForm>(key: K, value: FeedForm[K]) => setForm(f => ({ ...f, [key]: value }))

  // ── Add / edit a feed ──
  const saveFeed = useSaveAction(async () => {
    const payload: Record<string, unknown> = {
      enterpriseId: selectedEnterpriseId, ...form,
      quantityInStock: toNumber(form.quantityInStock),
      minimumStockLevel: toNumber(form.minimumStockLevel || '0'),
      costPerUnit: toNumber(form.costPerUnit),
      expiryDate: form.expiryDate || undefined,
    }
    if (editingId) await apiService.updateFeed(editingId, payload)
    else await apiService.createFeed(selectedEnterpriseId, payload)
  }, t('feedInventory.toasts.saveFailed'))

  const closeForm = () => { setShowForm(false); setEditingId(null); setStep(0); saveFeed.reset() }
  const openNew = () => { setForm(emptyForm()); setEditingId(null); setStep(0); saveFeed.reset(); setShowForm(true) }
  const openEdit = (feed: FeedItem) => {
    setEditingId(feed.id); setStep(0); saveFeed.reset()
    setForm({
      feedType: feed.feedType, name: feed.name, brand: feed.brand || '', batchNumber: feed.batchNumber || '',
      quantityInStock: String(feed.quantityInStock), unit: feed.unit, minimumStockLevel: String(feed.minimumStockLevel),
      costPerUnit: String(feed.costPerUnit), expiryDate: feed.expiryDate?.split('T')[0] || '',
      storageLocation: feed.storageLocation || '', supplier: feed.supplier || '',
    })
    setShowForm(true)
  }
  const submitFeed = async () => {
    setSuccessMsg('')
    const wasEditing = !!editingId
    if (await saveFeed.run()) {
      closeForm()
      setSuccessMsg(t(wasEditing ? 'feedInventory.toasts.feedUpdated' : 'feedInventory.toasts.feedAdded'))
      void fetchData()
    }
  }

  // ── Restock ──
  const restock = useSaveAction(async () => {
    if (restockFeed) await apiService.restockFeed(restockFeed.id, toNumber(restockQty))
  }, t('feedInventory.toasts.restockFailed'))
  const submitRestock = async () => {
    if (await restock.run()) {
      setRestockFeed(null); setRestockQty('')
      setSuccessMsg(t('feedInventory.toasts.restocked'))
      void fetchData()
    }
  }

  // ── Log what was used ──
  const logUse = useSaveAction(async () => {
    await apiService.logFeedConsumption(selectedEnterpriseId, {
      enterpriseId: selectedEnterpriseId, feedId: use.feedId, quantityUsed: toNumber(use.quantityUsed), notes: use.notes || undefined,
    })
  }, t('feedInventory.toasts.consumptionFailed'))
  const submitUse = async () => {
    if (await logUse.run()) {
      setShowUse(false); setUse({ feedId: '', quantityUsed: '', notes: '' })
      setSuccessMsg(t('feedInventory.toasts.consumptionLogged'))
      void fetchData()
    }
  }

  // ── Delete ──
  const removeFeed = useSaveAction(async () => { if (deleting) await apiService.deleteFeed(deleting.id) }, t('feedInventory.toasts.deleteFailed'))
  const submitDelete = async () => {
    if (await removeFeed.run()) {
      setDeleting(null)
      setSuccessMsg(t('feedInventory.toasts.feedDeleted'))
      void fetchData()
    }
  }

  const steps: FormStep[] = [
    {
      id: 'what', title: t('feedInventory.steps.what'),
      blockedReason: form.name.trim() ? undefined : t('feedInventory.blocked.name'),
      content: (
        <>
          <div className="feed-field">
            <label htmlFor="feed-name">{t('feedInventory.form.name')}</label>
            <input id="feed-name" className="an-field" value={form.name} onChange={e => setF('name', e.target.value)} />
          </div>
          <div className="feed-field">
            <label htmlFor="feed-type">{t('feedInventory.form.feedType')}</label>
            <select id="feed-type" className="an-field" value={form.feedType} onChange={e => setF('feedType', e.target.value)}>
              {FEED_TYPES.map(c => <option key={c} value={c}>{typeLabel(c)}</option>)}
            </select>
          </div>
        </>
      ),
    },
    {
      id: 'stock', title: t('feedInventory.steps.stock'),
      blockedReason: !form.quantityInStock ? t('feedInventory.blocked.quantity') : !form.costPerUnit ? t('feedInventory.blocked.cost') : undefined,
      content: (
        <>
          <div className="feed-field">
            <label htmlFor="feed-unit">{t('feedInventory.form.unit')}</label>
            <select id="feed-unit" className="an-field" value={form.unit} onChange={e => setF('unit', e.target.value)}>
              {UNITS.map(u => <option key={u} value={u}>{unitLabel(u)}</option>)}
            </select>
          </div>
          <NumberStepper label={t('feedInventory.form.quantityInStock')} value={form.quantityInStock} onChange={v => setF('quantityInStock', v)} min={0} unit={unitLabel(form.unit)} />
          <NumberStepper label={t('feedInventory.form.minimumStockLevel')} value={form.minimumStockLevel} onChange={v => setF('minimumStockLevel', v)} min={0} unit={unitLabel(form.unit)} hint={t('feedInventory.minHint')} />
          <NumberStepper label={t('feedInventory.form.costPerUnit')} value={form.costPerUnit} onChange={v => setF('costPerUnit', v)} min={0} />
        </>
      ),
    },
    {
      id: 'more', title: t('feedInventory.steps.more'),
      content: (
        <>
          <div className="feed-field">
            <label htmlFor="feed-expiry">{t('feedInventory.form.expiryDate')}</label>
            <input id="feed-expiry" type="date" className="an-field" value={form.expiryDate} onChange={e => setF('expiryDate', e.target.value)} />
          </div>
          {([['brand', 'brand'], ['batchNumber', 'batchNumber'], ['storageLocation', 'storageLocation'], ['supplier', 'supplier']] as const).map(([key, tk]) => (
            <div className="feed-field" key={key}>
              <label htmlFor={`feed-${key}`}>{t('feedInventory.form.' + tk)}</label>
              <input id={`feed-${key}`} className="an-field" value={form[key]} onChange={e => setF(key, e.target.value)} />
            </div>
          ))}
        </>
      ),
    },
  ]

  const peak = Math.max(1, ...(analytics?.dailyConsumptionTrend || []).map(x => Number(x.total_used)))

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>{t('feedInventory.pageTitle')}</h1>
        <p>{t('feedInventory.subtitle')}</p>
      </div>

      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {successMsg && <div className="alert alert-success" role="status">{successMsg}</div>}

      <div className="enterprise-selector">
        <label htmlFor="feed-farm">{t('feedInventory.selectEnterprise')}</label>
        <select id="feed-farm" value={selectedEnterpriseId} onChange={e => setSelectedEnterpriseId(e.target.value)}>
          <option value="">{t('feedInventory.selectDefault')}</option>
          {enterprises.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
        </select>
      </div>

      {selectedEnterpriseId && (
        <>
          <div className="tab-bar">
            <button className={`tab-btn ${tab === 'inventory' ? 'active' : ''}`} onClick={() => setTab('inventory')}>{t('feedInventory.tabs.inventory')}</button>
            <button className={`tab-btn ${tab === 'analytics' ? 'active' : ''}`} onClick={() => setTab('analytics')}>{t('feedInventory.tabs.analytics')}</button>
            <button className="btn btn-primary" onClick={openNew}>{t('feedInventory.addFeed')}</button>
            <button className="btn btn-secondary" onClick={() => { logUse.reset(); setShowUse(true) }}>{t('feedInventory.logConsumption')}</button>
          </div>

          {showForm && (
            <div className="edit-form-overlay" onClick={closeForm}>
              <div className="edit-form-panel edit-form-modal" onClick={e => e.stopPropagation()}>
                <button className="edit-form-close" onClick={closeForm} aria-label={t('mobileUi.close')}>✕</button>
                <h2>{editingId ? t('feedInventory.form.editTitle') : t('feedInventory.form.createTitle')}</h2>
                <StepForm
                  steps={steps} current={step} onStepChange={setStep} onSubmit={submitFeed}
                  submitLabel={editingId ? t('common.update') : t('feedInventory.addFeed')}
                  busy={saveFeed.status === 'saving'} onCancel={closeForm}
                  saveNowLabel={editingId ? t('farmProfile.form.saveNow') : undefined}
                  footer={<SaveState status={saveFeed.status} error={saveFeed.error} offline={saveFeed.offline} onRetry={saveFeed.retry} />}
                />
              </div>
            </div>
          )}

          <BottomSheet open={!!restockFeed} title={t('feedInventory.restockTitle', { name: restockFeed?.name || '' })} onClose={() => { setRestockFeed(null); restock.reset() }}>
            <NumberStepper label={t('feedInventory.restockQty')} value={restockQty} onChange={setRestockQty} min={0} unit={restockFeed ? unitLabel(restockFeed.unit) : undefined} />
            <SaveState status={restock.status} error={restock.error} offline={restock.offline} onRetry={restock.retry} />
            <button type="button" className="btn btn-primary feed-sheet-action" disabled={!restockQty || toNumber(restockQty) <= 0 || restock.status === 'saving'} onClick={submitRestock}>{t('feedInventory.restock')}</button>
          </BottomSheet>

          <BottomSheet open={showUse} title={t('feedInventory.consumptionForm.title')} onClose={() => setShowUse(false)}>
            <div className="feed-field">
              <label htmlFor="feed-use-feed">{t('feedInventory.consumptionForm.feed')}</label>
              <select id="feed-use-feed" className="an-field" value={use.feedId} onChange={e => setUse({ ...use, feedId: e.target.value })}>
                <option value="">{t('feedInventory.consumptionForm.selectFeed')}</option>
                {feeds.map(f => <option key={f.id} value={f.id}>{f.name} ({f.quantityInStock} {unitLabel(f.unit)})</option>)}
              </select>
            </div>
            <NumberStepper label={t('feedInventory.consumptionForm.quantityUsed')} value={use.quantityUsed} onChange={v => setUse({ ...use, quantityUsed: v })} min={0}
              unit={unitLabel(feeds.find(f => f.id === use.feedId)?.unit || '')} />
            <div className="feed-field">
              <label htmlFor="feed-use-notes">{t('common.notes')}</label>
              <input id="feed-use-notes" className="an-field" value={use.notes} onChange={e => setUse({ ...use, notes: e.target.value })} />
            </div>
            <SaveState status={logUse.status} error={logUse.error} offline={logUse.offline} onRetry={logUse.retry} />
            <button type="button" className="btn btn-primary feed-sheet-action" disabled={!use.feedId || !use.quantityUsed || toNumber(use.quantityUsed) <= 0 || logUse.status === 'saving'} onClick={submitUse}>{t('feedInventory.consumptionForm.submitBtn')}</button>
          </BottomSheet>

          <BottomSheet open={!!deleting} title={t('feedInventory.toasts.deleteConfirm')} onClose={() => { setDeleting(null); removeFeed.reset() }}>
            <p>{deleting?.name}</p>
            <SaveState status={removeFeed.status} error={removeFeed.error} offline={removeFeed.offline} onRetry={removeFeed.retry} />
            <button type="button" className="btn btn-danger feed-sheet-action" disabled={removeFeed.status === 'saving'} onClick={submitDelete}>{t('common.delete')}</button>
          </BottomSheet>

          {loading ? <p className="loading-text">{t('common.loading')}</p> : tab === 'inventory' ? (
            <div className="card full-width">
              <h3>{t('feedInventory.inventoryTitle')}</h3>
              {feeds.length === 0 ? <p className="empty-text">{t('feedInventory.emptyInventory')}</p> : (
                <ul className="feed-list">
                  {feeds.map(f => {
                    const isLow = f.quantityInStock <= f.minimumStockLevel
                    return (
                      <li key={f.id} className={`feed-card ${isLow ? 'is-low' : ''}`}>
                        <div className="feed-card-head">
                          <strong className="feed-card-name">{f.name}{f.brand && <small> ({f.brand})</small>}</strong>
                          {isLow ? <span className="badge badge-danger">{t('feedInventory.lowStock')}</span> : <span className="badge badge-success">{t('feedInventory.ok')}</span>}
                        </div>
                        <p className="feed-card-stock">{f.quantityInStock} {unitLabel(f.unit)}</p>
                        <dl className="feed-facts">
                          <div><dt>{t('common.type')}</dt><dd>{typeLabel(f.feedType)}</dd></div>
                          <div><dt>{t('feedInventory.headers.minLevel')}</dt><dd>{f.minimumStockLevel} {unitLabel(f.unit)}</dd></div>
                          <div><dt>{t('feedInventory.headers.costPerUnit')}</dt><dd>{formatCurrency(f.costPerUnit)}</dd></div>
                          <div><dt>{t('feedInventory.headers.expiry')}</dt><dd>{f.expiryDate ? formatDate(f.expiryDate) : '-'}</dd></div>
                          <div><dt>{t('feedInventory.headers.location')}</dt><dd>{f.storageLocation || '-'}</dd></div>
                        </dl>
                        <div className="feed-card-actions">
                          <button className="btn btn-sm btn-primary" onClick={() => { restock.reset(); setRestockQty(''); setRestockFeed(f) }}>{t('feedInventory.restock')}</button>
                          <button className="btn btn-sm btn-secondary" onClick={() => openEdit(f)}>{t('common.edit')}</button>
                          <button className="btn btn-sm btn-danger" onClick={() => { removeFeed.reset(); setDeleting(f) }}>{t('common.delete')}</button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          ) : analytics ? (
            <div className="dashboard-grid">
              <div className="card">
                <h3>{t('feedInventory.totalValue')}</h3>
                <div className="big-stat">{formatCurrency(analytics.totalInventoryValue || 0)}</div>
              </div>

              <div className="card">
                <h3>{t('feedInventory.lowStockAlerts')}</h3>
                {(analytics.lowStockAlerts || []).length === 0 ? (
                  <p className="empty-text">{t('feedInventory.allOk')}</p>
                ) : (
                  <ul className="alert-list">
                    {analytics.lowStockAlerts.map(f => (
                      <li key={f.id} className="alert-item danger">
                        <strong>{f.name}</strong>: {f.quantityInStock} {unitLabel(f.unit)} ({t('feedInventory.headers.minLevel')}: {f.minimumStockLevel})
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="card">
                <h3>{t('feedInventory.consumptionByType')}</h3>
                <ul className="feed-list">
                  {(analytics.consumptionByType || []).map(c => (
                    <li key={c.feed_type} className="feed-usage-row">
                      <span>{typeLabel(c.feed_type)}</span>
                      <span>{t('feedInventory.analytics.used')}: {Number(c.total_used).toFixed(1)}</span>
                      <span>{t('feedInventory.analytics.cost')}: {formatCurrency(c.total_cost)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="card">
                <h3>{t('feedInventory.dailyTrend')}</h3>
                <div className="mini-chart">
                  {(analytics.dailyConsumptionTrend || []).slice(-14).map((d, i) => (
                    <div key={i} className="chart-bar-wrapper">
                      <div className={`chart-bar feed-bar-${barStep(Number(d.total_used), peak)}`}></div>
                      <span className="chart-label">{Number(d.total_used).toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

export default FeedInventory

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import './ModulePage.css'
import { Enterprise, FeedItem, FeedAnalytics } from '../types'
import { useTranslation } from 'react-i18next'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import { useSaveAction } from '../hooks/useSaveAction'
import { useSettings } from '../context/SettingsContext'
import { useMasterData } from '../context/MasterDataContext'
import { BottomSheet } from '../components/mobile/BottomSheet'
import { NumberStepper } from '../components/mobile/NumberStepper'
import { SaveState } from '../components/mobile/SaveState'
import { StepForm, type FormStep } from '../components/mobile/StepForm'
import { userMessage } from '../utils/userMessage'

const FEED_TYPES = ['hay', 'grain', 'pellet', 'silage', 'mineral', 'supplement', 'concentrate', 'forage', 'medicated', 'other']
const UNITS = ['kg', 'bag', 'bale', 'ton', 'g', 'lb', 'pcs', 'liter', 'gallon']
/** Units that are a weight convert to kg by themselves; any other unit asks "how many kg is one". */
const WEIGHT_UNITS = ['kg', 'g', 'ton', 'lb']

interface LibraryFeed { id: string; label: string; labelKey?: string | null; kind: string }

interface FeedForm {
  feedType: string; feedName: string; ingredientId: string; brand: string; batchNumber: string; currentStock: string; unit: string
  kgPerUnit: string; minimumStock: string; costPerUnit: string; expiryDate: string; storageLocation: string; supplier: string
}
const emptyForm = (): FeedForm => ({
  feedType: 'concentrate', feedName: '', ingredientId: '', brand: '', batchNumber: '', currentStock: '', unit: 'kg', kgPerUnit: '',
  minimumStock: '50', costPerUnit: '', expiryDate: '', storageLocation: '', supplier: '',
})
/** The bar's height in 5% steps (a class each - no inline style): 0..20. */
const barStep = (value: number, peak: number) => Math.min(20, Math.max(0, Math.round((value / Math.max(1, peak)) * 20)))
const toNumber = (v: string) => parseFloat(v.replace(',', '.'))
const optionalNumber = (v: string) => (v.trim() === '' ? null : toNumber(v))

/**
 * Feed Inventory: what feed the farm has in store and what it costs - nothing else (owner rule 2026-11-23: one place
 * per task). Feed GIVEN is recorded in Daily records, which takes it out of stock here automatically; this screen
 * links there instead of offering a second way to record it. Buying more (restock) with a price also writes the feed
 * expense to Finance once.
 */
const FeedInventory: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { formatCurrency, formatDate } = useSettings()
  const { resolveLabel } = useMasterData()

  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [selectedEnterpriseId, setSelectedEnterpriseId] = useState('')
  const [feeds, setFeeds] = useState<FeedItem[]>([])
  const [library, setLibrary] = useState<LibraryFeed[]>([])
  const [analytics, setAnalytics] = useState<FeedAnalytics | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'inventory' | 'analytics'>('inventory')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FeedForm>(emptyForm)
  const [restockFeed, setRestockFeed] = useState<FeedItem | null>(null)
  const [restockQty, setRestockQty] = useState('')
  const [restockPrice, setRestockPrice] = useState('')
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

  useEffect(() => { void fetchData() }, [selectedEnterpriseId]) // eslint-disable-line react-hooks/exhaustive-deps
  useAutoRefresh('feed-inventory', fetchData)
  useEffect(() => {
    if (!selectedEnterpriseId) return
    apiService.feedLibrary(selectedEnterpriseId)
      .then((res: any) => setLibrary(res?.data?.items || []))
      .catch(() => setLibrary([])) // linking a library feed is optional
  }, [selectedEnterpriseId])

  const typeLabel = (c: string) => t('feedInventory.types.' + c, { defaultValue: c })
  const unitLabel = (u: string) => t('feedInventory.units.' + u, { defaultValue: u })
  const libLabel = (f: LibraryFeed) => resolveLabel(f as any, t) || f.label
  const setF = <K extends keyof FeedForm>(key: K, value: FeedForm[K]) => setForm(f => ({ ...f, [key]: value }))
  const needsKgPerUnit = !WEIGHT_UNITS.includes(form.unit)

  // ── Add / edit a feed ──
  const saveFeed = useSaveAction(async () => {
    const payload: Record<string, unknown> = {
      feedName: form.feedName.trim(), feedType: form.feedType, unit: form.unit,
      ingredientId: form.ingredientId || null,
      kgPerUnit: needsKgPerUnit ? optionalNumber(form.kgPerUnit) : null,
      currentStock: toNumber(form.currentStock),
      minimumStock: toNumber(form.minimumStock || '0'),
      costPerUnit: toNumber(form.costPerUnit),
      brand: form.brand || null, batchNumber: form.batchNumber || null, supplier: form.supplier || null,
      storageLocation: form.storageLocation || null, expiryDate: form.expiryDate || null,
    }
    if (editingId) await apiService.updateFeed(editingId, payload)
    else await apiService.createFeed(selectedEnterpriseId, payload)
  }, t('feedInventory.toasts.saveFailed'))

  const closeForm = () => { setShowForm(false); setEditingId(null); setStep(0); saveFeed.reset() }
  const openNew = () => { setForm(emptyForm()); setEditingId(null); setStep(0); saveFeed.reset(); setShowForm(true) }
  const openEdit = (feed: FeedItem) => {
    setEditingId(feed.id); setStep(0); saveFeed.reset()
    setForm({
      feedType: feed.feedType, feedName: feed.feedName, ingredientId: feed.ingredientId || '', brand: feed.brand || '',
      batchNumber: feed.batchNumber || '', currentStock: String(feed.currentStock), unit: feed.unit,
      kgPerUnit: feed.kgPerUnit && !WEIGHT_UNITS.includes(feed.unit) ? String(feed.kgPerUnit) : '',
      minimumStock: String(feed.minimumStock), costPerUnit: String(feed.costPerUnit), expiryDate: feed.expiryDate?.split('T')[0] || '',
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

  // ── Restock (a purchase) ──
  const restock = useSaveAction(async () => {
    if (restockFeed) await apiService.restockFeed(restockFeed.id, { quantity: toNumber(restockQty), pricePerUnit: optionalNumber(restockPrice) })
  }, t('feedInventory.toasts.restockFailed'))
  const openRestock = (f: FeedItem) => { restock.reset(); setRestockQty(''); setRestockPrice(f.costPerUnit ? String(f.costPerUnit) : ''); setRestockFeed(f) }
  const submitRestock = async () => {
    if (await restock.run()) {
      setRestockFeed(null); setRestockQty(''); setRestockPrice('')
      setSuccessMsg(t('feedInventory.toasts.restocked'))
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
      blockedReason: form.feedName.trim() ? undefined : t('feedInventory.blocked.name'),
      content: (
        <>
          <div className="feed-field">
            <label htmlFor="feed-name">{t('feedInventory.form.name')}</label>
            <input id="feed-name" className="an-field" value={form.feedName} onChange={e => setF('feedName', e.target.value)} />
          </div>
          <div className="feed-field">
            <label htmlFor="feed-type">{t('feedInventory.form.feedType')}</label>
            <select id="feed-type" className="an-field" value={form.feedType} onChange={e => setF('feedType', e.target.value)}>
              {FEED_TYPES.map(c => <option key={c} value={c}>{typeLabel(c)}</option>)}
            </select>
          </div>
          {library.length > 0 && (
            <div className="feed-field">
              <label htmlFor="feed-library">{t('feedInventory.form.isWhat')}</label>
              <select id="feed-library" className="an-field" value={form.ingredientId} onChange={e => setF('ingredientId', e.target.value)}>
                <option value="">{t('feedInventory.form.isWhatNone')}</option>
                {library.map(f => <option key={f.id} value={f.id}>{libLabel(f)}</option>)}
              </select>
              <small className="feed-hint">{t('feedInventory.form.isWhatHint')}</small>
            </div>
          )}
        </>
      ),
    },
    {
      id: 'stock', title: t('feedInventory.steps.stock'),
      blockedReason: !form.currentStock ? t('feedInventory.blocked.quantity')
        : !form.costPerUnit ? t('feedInventory.blocked.cost')
          : needsKgPerUnit && !(toNumber(form.kgPerUnit || '0') > 0) ? t('feedInventory.blocked.kgPerUnit', { unit: unitLabel(form.unit) }) : undefined,
      content: (
        <>
          <div className="feed-field">
            <label htmlFor="feed-unit">{t('feedInventory.form.unit')}</label>
            <select id="feed-unit" className="an-field" value={form.unit} onChange={e => setF('unit', e.target.value)}>
              {UNITS.map(u => <option key={u} value={u}>{unitLabel(u)}</option>)}
            </select>
          </div>
          {needsKgPerUnit && (
            <NumberStepper label={t('feedInventory.form.kgPerUnit', { unit: unitLabel(form.unit) })} value={form.kgPerUnit}
              onChange={v => setF('kgPerUnit', v)} min={0} step={5} unit="kg" hint={t('feedInventory.form.kgPerUnitHint')} />
          )}
          <NumberStepper label={t('feedInventory.form.quantityInStock')} value={form.currentStock} onChange={v => setF('currentStock', v)} min={0} unit={unitLabel(form.unit)} />
          <NumberStepper label={t('feedInventory.form.minimumStockLevel')} value={form.minimumStock} onChange={v => setF('minimumStock', v)} min={0} unit={unitLabel(form.unit)} hint={t('feedInventory.minHint')} />
          <NumberStepper label={t('feedInventory.form.costPerUnit', { unit: unitLabel(form.unit) })} value={form.costPerUnit} onChange={v => setF('costPerUnit', v)} min={0} />
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

  const peak = Math.max(1, ...(analytics?.dailyConsumptionTrend || []).map(x => Number(x.totalKg)))

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
          </div>

          <div className="alert alert-info feed-given-note" role="note">
            <span>{t('feedInventory.feedGivenNote')}</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/farm-records')}>{t('feedInventory.goDailyRecords')}</button>
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

          <BottomSheet open={!!restockFeed} title={t('feedInventory.restockTitle', { name: restockFeed?.feedName || '' })} onClose={() => { setRestockFeed(null); restock.reset() }}>
            <NumberStepper label={t('feedInventory.restockQty')} value={restockQty} onChange={setRestockQty} min={0} unit={restockFeed ? unitLabel(restockFeed.unit) : undefined} />
            <NumberStepper label={t('feedInventory.restockPrice', { unit: restockFeed ? unitLabel(restockFeed.unit) : '' })} value={restockPrice} onChange={setRestockPrice} min={0}
              hint={t('feedInventory.restockPriceHint')} />
            <SaveState status={restock.status} error={restock.error} offline={restock.offline} onRetry={restock.retry} />
            <button type="button" className="btn btn-primary feed-sheet-action" disabled={!restockQty || toNumber(restockQty) <= 0 || restock.status === 'saving'} onClick={submitRestock}>{t('feedInventory.restock')}</button>
          </BottomSheet>

          <BottomSheet open={!!deleting} title={t('feedInventory.toasts.deleteConfirm')} onClose={() => { setDeleting(null); removeFeed.reset() }}>
            <p>{deleting?.feedName}</p>
            <SaveState status={removeFeed.status} error={removeFeed.error} offline={removeFeed.offline} onRetry={removeFeed.retry} />
            <button type="button" className="btn btn-danger feed-sheet-action" disabled={removeFeed.status === 'saving'} onClick={submitDelete}>{t('common.delete')}</button>
          </BottomSheet>

          {loading ? <p className="loading-text">{t('common.loading')}</p> : tab === 'inventory' ? (
            <div className="card full-width">
              <h3>{t('feedInventory.inventoryTitle')}</h3>
              {feeds.length === 0 ? <p className="empty-text">{t('feedInventory.emptyInventory')}</p> : (
                <ul className="feed-list">
                  {feeds.map(f => (
                    <li key={f.id} className={`feed-card ${f.isLow ? 'is-low' : ''}`}>
                      <div className="feed-card-head">
                        <strong className="feed-card-name">{f.feedName}{f.brand && <small> ({f.brand})</small>}</strong>
                        {f.isLow ? <span className="badge badge-danger">{t('feedInventory.lowStock')}</span> : <span className="badge badge-success">{t('feedInventory.ok')}</span>}
                      </div>
                      <p className="feed-card-stock">
                        {f.currentStock} {unitLabel(f.unit)}
                        {f.stockKg !== null && f.unit !== 'kg' ? <small> ({t('feedInventory.aboutKg', { kg: f.stockKg })})</small> : null}
                      </p>
                      <dl className="feed-facts">
                        <div><dt>{t('common.type')}</dt><dd>{typeLabel(f.feedType)}</dd></div>
                        {f.ingredientLabel && <div><dt>{t('feedInventory.headers.isWhat')}</dt><dd>{f.ingredientLabel}</dd></div>}
                        <div><dt>{t('feedInventory.headers.minLevel')}</dt><dd>{f.minimumStock} {unitLabel(f.unit)}</dd></div>
                        <div><dt>{t('feedInventory.headers.costPerUnit')}</dt><dd>{formatCurrency(f.costPerUnit)}{f.costPerKg !== null && f.unit !== 'kg' ? ` (${formatCurrency(f.costPerKg)}/kg)` : ''}</dd></div>
                        <div><dt>{t('feedInventory.headers.expiry')}</dt><dd>{f.expiryDate ? formatDate(f.expiryDate) : '-'}</dd></div>
                        <div><dt>{t('feedInventory.headers.location')}</dt><dd>{f.storageLocation || '-'}</dd></div>
                      </dl>
                      {f.kgPerUnit === null && <p className="feed-hint is-warning">{t('feedInventory.needsKgPerUnit', { unit: unitLabel(f.unit) })}</p>}
                      <div className="feed-card-actions">
                        <button className="btn btn-sm btn-primary" onClick={() => openRestock(f)}>{t('feedInventory.restock')}</button>
                        <button className="btn btn-sm btn-secondary" onClick={() => openEdit(f)}>{t('common.edit')}</button>
                        <button className="btn btn-sm btn-danger" onClick={() => { removeFeed.reset(); setDeleting(f) }}>{t('common.delete')}</button>
                      </div>
                    </li>
                  ))}
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
                        <strong>{f.feedName}</strong>: {f.currentStock} {unitLabel(f.unit)} ({t('feedInventory.headers.minLevel')}: {f.minimumStock})
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="card">
                <h3>{t('feedInventory.consumptionByType')}</h3>
                {(analytics.consumptionByType || []).length === 0 ? <p className="empty-text">{t('feedInventory.noFeedGiven')}</p> : (
                  <ul className="feed-list">
                    {analytics.consumptionByType.map(c => (
                      <li key={c.feedType} className="feed-usage-row">
                        <span>{typeLabel(c.feedType)}</span>
                        <span>{t('feedInventory.analytics.used')}: {c.totalKg.toFixed(1)} kg</span>
                        <span>{t('feedInventory.analytics.cost')}: {formatCurrency(c.totalCost)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="card">
                <h3>{t('feedInventory.dailyTrend')}</h3>
                <div className="mini-chart">
                  {(analytics.dailyConsumptionTrend || []).slice(-14).map(d => (
                    <div key={d.day} className="chart-bar-wrapper">
                      <div className={`chart-bar feed-bar-${barStep(Number(d.totalKg), peak)}`}></div>
                      <span className="chart-label">{Number(d.totalKg).toFixed(0)}</span>
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

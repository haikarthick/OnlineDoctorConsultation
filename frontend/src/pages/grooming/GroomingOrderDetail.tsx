import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { useSettings } from '../../context/SettingsContext'
import '../../styles/modules.css'

interface Props { onNavigate: (path: string) => void; id?: string }

const SCENT_KEYS = ['Skin', 'Coat', 'Ears', 'Nails', 'Teeth'] as const
const SCENT_OPTS = ['good', 'watch', 'vet_advised']

const GroomingOrderDetail: React.FC<Props> = ({ onNavigate, id }) => {
  const { t } = useTranslation()
  const { formatCurrency } = useSettings()
  const [order, setOrder] = useState<any>(null)
  const [isProvider, setIsProvider] = useState(false)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [intake, setIntake] = useState<any>({})
  const [report, setReport] = useState<any>({ summary: '', aftercareNotes: '', productsUsed: '' })

  const load = useCallback(async () => {
    if (!id) return
    try {
      setLoading(true); setErr('')
      const res = await apiService.getGroomingOrderDetail(id)
      const o = res.data; setOrder(o)
      setIntake(o.intake || {})
      if (o.reportCard) setReport(o.reportCard)
      try { const mine = (await apiService.getMyGroomingProvider()).data; setIsProvider(!!mine && mine.id === o.providerId) } catch { setIsProvider(false) }
    } catch (e: any) { setErr(e?.response?.data?.message || e.message) } finally { setLoading(false) }
  }, [id])
  useEffect(() => { load() }, [load])

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2500) }
  const fail = (e: any) => setErr(e?.response?.data?.message || e?.message)

  const saveIntake = async () => { try { setBusy(true); await apiService.saveGroomingIntake(id!, intake); flash(t('groomingDetail.intakeSaved')); load() } catch (e) { fail(e) } finally { setBusy(false) } }
  const setItem = async (itemId: string, status: string) => { try { await apiService.updateGroomingItem(id!, itemId, status); load() } catch (e) { fail(e) } }
  const submitReport = async () => { try { setBusy(true); await apiService.createGroomingReportCard(id!, report); flash(t('groomingDetail.reportSaved')); load() } catch (e) { fail(e) } finally { setBusy(false) } }

  // P4: variable-price + ETA tracking
  const [varName, setVarName] = useState(''); const [varPrice, setVarPrice] = useState(''); const [varReason, setVarReason] = useState(''); const [eta, setEta] = useState('')
  const requestVariable = async () => {
    if (!varName.trim() || !varPrice) { fail({ message: t('groomingVar.namePriceRequired') }); return }
    try { setBusy(true); await apiService.requestGroomingVariableItem(id!, { name: varName.trim(), price: Number(varPrice), reason: varReason || undefined }); setVarName(''); setVarPrice(''); setVarReason(''); flash(t('groomingVar.requested')); load() } catch (e) { fail(e) } finally { setBusy(false) }
  }
  const respondVariable = async (itemId: string, approve: boolean) => {
    try { setBusy(true); await apiService.respondGroomingVariableItem(id!, itemId, approve); flash(approve ? t('groomingVar.approved') : t('groomingVar.declined')); load() } catch (e) { fail(e) } finally { setBusy(false) }
  }
  const setOnTheWay = async () => {
    try { setBusy(true); if (eta) await apiService.assignGroomingOrder(id!, { etaMinutes: Number(eta) }); await apiService.transitionGroomingOrder(id!, 'en_route'); flash(t('groomingVar.enRouteSet')); load() } catch (e) { fail(e) } finally { setBusy(false) }
  }

  if (loading) return <div className="module-page"><div className="loading-container"><div className="loading-spinner" /></div></div>
  if (!order) return <div className="module-page"><div className="module-alert error">{err || t('groomingDetail.notFound')}</div></div>

  const completed = ['completed', 'closed'].includes(order.status)
  const active = ['checked_in', 'intake_done', 'in_progress'].includes(order.status)
  const pendingVar = (order.items || []).filter((it: any) => it.itemType === 'variable' && it.approvalStatus === 'requested')

  return (
    <div className="module-page">
      <button className="module-btn" style={{ marginBottom: 12 }} onClick={() => onNavigate(isProvider ? '/grooming/orders' : '/grooming/my-orders')}>← {t('groomingDetail.back')}</button>
      {msg && <div className="module-alert success">{msg}</div>}
      {err && <div className="module-alert error">{err}</div>}

      <div className="module-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div><h2 style={{ margin: 0 }}>{order.orderNumber}</h2>
            <div className="si-676930d7">{order.scheduledDate} · {order.timeSlotStart} · {t(order.serviceMode === 'mobile' ? 'groomingBook.mobile' : 'groomingBook.atPremises')}</div></div>
          <div style={{ textAlign: 'right' }}>
            <span className="badge badge-info">{t(`groomingStatus.${order.status}`, { defaultValue: (order.status || '').replace(/_/g, ' ') })}</span>
            <div style={{ fontWeight: 700, marginTop: 4 }}>{formatCurrency(Number(order.grandTotal))}</div>
          </div>
        </div>
      </div>

      {/* Mobile tracking */}
      {order.serviceMode === 'mobile' && (order.status === 'en_route' || (isProvider && !completed)) && (
        <div className="module-card" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
          {order.status === 'en_route'
            ? <div>🚚 <strong>{t('groomingVar.onTheWay')}</strong>{order.etaMinutes ? ` · ${t('groomingVar.eta', { min: order.etaMinutes })}` : ''}</div>
            : isProvider && <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div className="module-form-group" style={{ margin: 0 }}>
                  <label className="module-label">{t('groomingVar.etaLabel')}</label>
                  <input className="module-input" type="number" min={0} value={eta} onChange={e => setEta(e.target.value)} style={{ width: 120 }} />
                </div>
                <button className="module-btn primary" disabled={busy} onClick={setOnTheWay}>🚚 {t('groomingVar.markOnTheWay')}</button>
              </div>}
        </div>
      )}

      {/* Variable-price extra work */}
      {(pendingVar.length > 0 || (isProvider && active)) && (
        <div className="module-card" style={{ border: '1px solid #fde68a', background: '#fffbeb' }}>
          <h3>➕ {t('groomingVar.title')}</h3>
          {pendingVar.map((it: any) => (
            <div key={it.id} style={{ padding: 10, border: '1px solid #fcd34d', borderRadius: 8, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div><strong>{it.name}</strong>{it.reason ? <div className="si-676930d7">{it.reason}</div> : null}</div>
                <div style={{ fontWeight: 700 }}>+{formatCurrency(Number(it.lineTotal))}</div>
              </div>
              {!isProvider ? (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => respondVariable(it.id, true)}>{t('groomingVar.approvePay')}</button>
                  <button className="btn btn-sm btn-outline" disabled={busy} onClick={() => respondVariable(it.id, false)}>{t('groomingVar.decline')}</button>
                </div>
              ) : <div className="si-676930d7" style={{ marginTop: 6 }}>{t('groomingVar.waitingOwner')}</div>}
            </div>
          ))}
          {isProvider && active && (
            <div className="module-form-row" style={{ alignItems: 'flex-end' }}>
              <div className="module-form-group"><label className="module-label">{t('groomingVar.workName')}</label>
                <input className="module-input" value={varName} onChange={e => setVarName(e.target.value)} placeholder={t('groomingVar.workPlaceholder')} /></div>
              <div className="module-form-group"><label className="module-label">{t('groomingVar.price')}</label>
                <input className="module-input" type="number" min={0} value={varPrice} onChange={e => setVarPrice(e.target.value)} /></div>
              <div className="module-form-group"><label className="module-label">{t('groomingVar.reason')}</label>
                <input className="module-input" value={varReason} onChange={e => setVarReason(e.target.value)} /></div>
              <button className="module-btn primary" disabled={busy} onClick={requestVariable}>{t('groomingVar.requestApproval')}</button>
            </div>
          )}
        </div>
      )}

      {/* Items / execution */}
      <div className="module-card">
        <h3>{t('groomingDetail.items')}</h3>
        {(order.items || []).map((it: any) => (
          <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #eee', flexWrap: 'wrap' }}>
            <span>{it.itemType === 'addon' ? '➕ ' : ''}{it.name} · {formatCurrency(Number(it.lineTotal))}</span>
            {isProvider && !completed ? (
              <select className="module-input" style={{ width: 'auto' }} value={it.status} onChange={e => setItem(it.id, e.target.value)}>
                {['pending', 'started', 'completed', 'skipped', 'awaiting_approval', 'paused'].map(s => <option key={s} value={s}>{t(`groomingItem.${s}`, { defaultValue: s.replace(/_/g, ' ') })}</option>)}
              </select>
            ) : <span className="badge badge-inactive">{t(`groomingItem.${it.status}`, { defaultValue: (it.status || '').replace(/_/g, ' ') })}</span>}
          </div>
        ))}
      </div>

      {/* Intake + S.C.E.N.T. */}
      <div className="module-card">
        <h3>{t('groomingDetail.intake')}</h3>
        {isProvider && !completed ? (
          <>
            <div className="module-form-group"><label className="module-label">{t('groomingDetail.arrivalCondition')}</label>
              <textarea className="module-input" rows={2} value={intake.arrivalCondition || ''} onChange={e => setIntake({ ...intake, arrivalCondition: e.target.value })} /></div>
            <label className="module-label">{t('groomingDetail.scent')}</label>
            <div className="module-form-row" style={{ flexWrap: 'wrap' }}>
              {SCENT_KEYS.map(k => (
                <div className="module-form-group" key={k} style={{ minWidth: 120 }}>
                  <label className="module-label">{t(`groomingDetail.scent${k}`)}</label>
                  <select className="module-input" value={intake[`scent${k}`] || ''} onChange={e => setIntake({ ...intake, [`scent${k}`]: e.target.value || null })}>
                    <option value="">—</option>
                    {SCENT_OPTS.map(o => <option key={o} value={o}>{t(`groomingScent.${o}`)}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="module-form-group"><label className="module-label">{t('groomingDetail.scentNotes')}</label>
              <textarea className="module-input" rows={2} value={intake.scentNotes || ''} onChange={e => setIntake({ ...intake, scentNotes: e.target.value })} /></div>
            <button className="module-btn primary" disabled={busy} onClick={saveIntake}>{t('groomingDetail.saveIntake')}</button>
          </>
        ) : order.intake ? (
          <div>
            {order.intake.arrivalCondition && <p>{order.intake.arrivalCondition}</p>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {SCENT_KEYS.map(k => order.intake[`scent${k}`] && (
                <span key={k} className="badge badge-inactive">{t(`groomingDetail.scent${k}`)}: {t(`groomingScent.${order.intake[`scent${k}`]}`)}</span>
              ))}
            </div>
            {order.intake.scentNotes && <p className="si-676930d7">{order.intake.scentNotes}</p>}
          </div>
        ) : <p className="si-676930d7">{t('groomingDetail.noIntake')}</p>}
      </div>

      {/* Report card */}
      <div className="module-card">
        <h3>{t('groomingDetail.reportCard')}</h3>
        {isProvider && !completed ? (
          <>
            <div className="module-form-group"><label className="module-label">{t('groomingDetail.summary')}</label>
              <textarea className="module-input" rows={2} value={report.summary || ''} onChange={e => setReport({ ...report, summary: e.target.value })} /></div>
            <div className="module-form-group"><label className="module-label">{t('groomingDetail.aftercare')}</label>
              <textarea className="module-input" rows={2} value={report.aftercareNotes || ''} onChange={e => setReport({ ...report, aftercareNotes: e.target.value })} /></div>
            <div className="module-form-group"><label className="module-label">{t('groomingDetail.productsUsed')}</label>
              <input className="module-input" value={report.productsUsed || ''} onChange={e => setReport({ ...report, productsUsed: e.target.value })} /></div>
            <button className="module-btn primary" disabled={busy} onClick={submitReport}>✅ {t('groomingDetail.completeWithReport')}</button>
          </>
        ) : order.reportCard ? (
          <div>
            {order.reportCard.summary && <p><strong>{order.reportCard.summary}</strong></p>}
            {order.reportCard.aftercareNotes && <p>🧴 {order.reportCard.aftercareNotes}</p>}
            {order.reportCard.productsUsed && <p className="si-676930d7">{t('groomingDetail.productsUsed')}: {order.reportCard.productsUsed}</p>}
          </div>
        ) : <p className="si-676930d7">{t('groomingDetail.noReport')}</p>}
      </div>

      {/* Timeline */}
      <div className="module-card">
        <h3>{t('groomingDetail.timeline')}</h3>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {(order.history || []).map((h: any, i: number) => (
            <li key={i} style={{ padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
              <span className="badge badge-info">{t(`groomingStatus.${h.toStatus}`, { defaultValue: (h.toStatus || '').replace(/_/g, ' ') })}</span>
              <span className="si-676930d7" style={{ marginLeft: 8 }}>{new Date(h.createdAt).toLocaleString()}{h.note ? ` · ${h.note}` : ''}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default GroomingOrderDetail

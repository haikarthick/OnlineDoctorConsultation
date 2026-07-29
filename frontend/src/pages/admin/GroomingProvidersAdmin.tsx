import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { useSettings } from '../../context/SettingsContext'
import '../../styles/modules.css'

interface Props { onNavigate: (path: string) => void }

type StatusFilter = 'pending' | 'verified' | 'rejected' | 'suspended'

const GroomingProvidersAdmin: React.FC<Props> = () => {
  const { t } = useTranslation()
  const { formatCurrency } = useSettings()
  const [filter, setFilter] = useState<StatusFilter>('pending')
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [rejectModal, setRejectModal] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [recon, setRecon] = useState<any>(null)
  const [report, setReport] = useState<any>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true); setErr('')
      const res = await apiService.adminListGroomingProviders(filter)
      setItems(Array.isArray(res.data) ? res.data : [])
    } catch (e: any) { setErr(e?.response?.data?.message || e.message) } finally { setLoading(false) }
  }, [filter])
  useEffect(() => { load() }, [load])
  useEffect(() => { apiService.adminGroomingReconciliation().then(r => setRecon(r.data)).catch(() => {}) }, [msg])
  useEffect(() => { apiService.getGroomingPlatformReport().then(r => setReport(r.data)).catch(() => {}) }, [msg])

  const settle = async (id: string) => {
    const ref = prompt(t('groomingAdmin.settlePrompt')); if (ref === null) return
    try { setBusy(id); const r = await apiService.adminSettleGrooming(id, { method: 'bank_transfer', reference: ref || undefined }); flash(t('groomingAdmin.settled', { amount: formatCurrency(Number(r.data?.netPaid || 0)) })); load() }
    catch (e: any) { setErr(e?.response?.data?.message || e.message) } finally { setBusy(null) }
  }

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000) }
  const verify = async (id: string) => { try { setBusy(id); await apiService.adminVerifyGroomingProvider(id); flash(t('groomingAdmin.verified')); load() } catch (e: any) { setErr(e?.response?.data?.message || e.message) } finally { setBusy(null) } }
  const suspend = async (id: string) => { const r = prompt(t('groomingAdmin.suspendReason')); if (!r) return; try { setBusy(id); await apiService.adminSuspendGroomingProvider(id, r); flash(t('groomingAdmin.suspended')); load() } catch (e: any) { setErr(e?.response?.data?.message || e.message) } finally { setBusy(null) } }
  const doReject = async () => { if (!reason.trim() || !rejectModal) return; try { setBusy(rejectModal); await apiService.adminRejectGroomingProvider(rejectModal, reason.trim()); setRejectModal(null); setReason(''); flash(t('groomingAdmin.rejected')); load() } catch (e: any) { setErr(e?.response?.data?.message || e.message) } finally { setBusy(null) } }

  return (
    <div className="module-page">
      <div className="module-header"><h1>💈 {t('groomingAdmin.title')}</h1></div>
      <p className="si-edc77e88">{t('groomingAdmin.subtitle')}</p>
      {recon && (
        <div className="module-card metric-strip">
          <div><div className="metric-value">{formatCurrency(Number(recon.orders?.collected || 0))}</div><div className="slot-hint">{t('groomingAdmin.collected')}</div></div>
          <div><div className="metric-value is-success">{formatCurrency(Number(recon.orders?.commission || 0))}</div><div className="slot-hint">{t('groomingAdmin.commission')}</div></div>
          <div><div className="metric-value is-warning">{formatCurrency(Number(recon.payableNow || 0))}</div><div className="slot-hint">{t('groomingAdmin.payableNow')}</div></div>
          <div><div className="metric-value is-info">{formatCurrency(Number(recon.totalSettled || 0))}</div><div className="slot-hint">{t('groomingAdmin.settledTotal')}</div></div>
        </div>
      )}
      {report?.moat && (
        <div className="module-card metric-strip is-accent">
          <div><div className="metric-value">{report.moat.escalationRatePct}%</div><div className="slot-hint">{t('groomingReport.escalationRate')}</div></div>
          <div><div className="metric-value">{report.moat.wellnessNudgeConversionPct}%</div><div className="slot-hint">{t('groomingReport.wellnessConversion')}</div></div>
          <div><div className="metric-value">{report.disputes?.open || 0}</div><div className="slot-hint">{t('groomingReport.openDisputes')}</div></div>
        </div>
      )}
      {msg && <div className="module-alert success">{msg}</div>}
      {err && <div className="module-alert error">{err}</div>}

      <div className="module-tabs si-7e63ec4f">
        {(['pending', 'verified', 'rejected', 'suspended'] as StatusFilter[]).map(s => (
          <button key={s} className={`module-tab${filter === s ? ' active' : ''}`} onClick={() => setFilter(s)}>{t(`groomingAdmin.tab.${s}`)}</button>
        ))}
      </div>

      {loading ? <div className="loading-container"><div className="loading-spinner" /></div>
        : items.length === 0 ? <div className="empty-state"><div className="si-0067e898">💈</div><p>{t('groomingAdmin.empty', { status: t(`groomingAdmin.tab.${filter}`) })}</p></div>
          : (
            <div className="data-table-container">
              <table className="data-table">
                <thead><tr>
                  <th>{t('groomingAdmin.business')}</th><th>{t('groomingAdmin.owner')}</th><th>{t('groomingAdmin.type')}</th>
                  <th>{t('groomingAdmin.legal')}</th><th>{t('groomingAdmin.actions')}</th>
                </tr></thead>
                <tbody>
                  {items.map(p => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.businessName}</strong>
                        <div className="si-48a0b045">{p.contactPhone || ''} {p.contactEmail || ''}</div>
                        {p.offersMobile && <span className="si-a5de6cea">🚐 {t('groomingAdmin.mobile')}</span>}
                      </td>
                      <td>{p.ownerFirstName} {p.ownerLastName}<div className="si-48a0b045">{p.ownerEmail}</div></td>
                      <td>{t(`grooming.type.${p.providerType}`)}</td>
                      <td className="si-af971f42">
                        {p.legalName && <div>{p.legalName}</div>}
                        {p.pan && <div>PAN: {p.pan}</div>}
                        {p.gstin && <div>GSTIN: {p.gstin}</div>}
                        {p.payoutUpi && <div>UPI: {p.payoutUpi}</div>}
                      </td>
                      <td>
                        <div className="order-row-actions">
                          {filter !== 'verified' && <button className="btn btn-sm btn-primary" disabled={busy === p.id} onClick={() => verify(p.id)}>{busy === p.id ? '…' : t('groomingAdmin.verify')}</button>}
                          {filter === 'pending' && <button className="btn btn-sm btn-outline" disabled={busy === p.id} onClick={() => { setRejectModal(p.id); setReason('') }}>{t('groomingAdmin.reject')}</button>}
                          {filter === 'verified' && <button className="btn btn-sm btn-primary" disabled={busy === p.id} onClick={() => settle(p.id)}>{t('groomingAdmin.settle')}</button>}
                          {filter === 'verified' && <button className="btn btn-sm btn-outline" disabled={busy === p.id} onClick={() => suspend(p.id)}>{t('groomingAdmin.suspend')}</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

      {rejectModal && (
        <div className="modal-overlay" onClick={() => setRejectModal(null)}>
          <div className="modal si-3196bd33" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>{t('groomingAdmin.rejectTitle')}</h2><button className="modal-close" onClick={() => setRejectModal(null)}>✕</button></div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">{t('groomingAdmin.rejectReasonLabel')}</label>
                <textarea className="form-input" rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder={t('groomingAdmin.rejectReasonPlaceholder')} />
              </div>
              <div className="si-f5f9f5f6">
                <button className="btn btn-outline" onClick={() => setRejectModal(null)}>{t('groomingAdmin.cancel')}</button>
                <button className="btn btn-primary" disabled={!reason.trim() || busy === rejectModal} onClick={doReject}>{t('groomingAdmin.confirmReject')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default GroomingProvidersAdmin

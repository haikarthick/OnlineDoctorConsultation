import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { useSettings } from '../../context/SettingsContext'
import '../../styles/modules.css'

interface Props { onNavigate: (path: string) => void }

const GroomingEarnings: React.FC<Props> = ({ onNavigate }) => {
  const { t } = useTranslation()
  const { formatCurrency } = useSettings()
  const [summary, setSummary] = useState<any>(null)
  const [entries, setEntries] = useState<any[]>([])
  const [settlements, setSettlements] = useState<any[]>([])
  const [report, setReport] = useState<any>(null)
  const [disputes, setDisputes] = useState<any[]>([])
  const [providerId, setProviderId] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [refundFor, setRefundFor] = useState<any | null>(null)
  const [refundAmt, setRefundAmt] = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    try {
      setLoading(true); setErr('')
      const prov = (await apiService.getMyGroomingProvider()).data
      if (!prov) { setErr(t('groomingEarnings.noProvider')); setLoading(false); return }
      setProviderId(prov.id)
      const e = (await apiService.getGroomingEarnings(prov.id)).data
      setSummary(e.summary); setEntries(e.entries || [])
      setSettlements((await apiService.listGroomingSettlements(prov.id)).data || [])
      try { setReport((await apiService.getGroomingProviderReport(prov.id)).data) } catch { /* optional */ }
      try { setDisputes((await apiService.listGroomingProviderDisputes(prov.id)).data || []) } catch { /* optional */ }
    } catch (e: any) { setErr(e?.response?.data?.message || e.message) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  // A partial refund now opens a proper dialog instead of a browser prompt(): the amount is real
  // money leaving the provider's balance and going back to the customer, so it deserves a field
  // that can be validated and cancelled rather than an untyped string box.
  const respondDispute = async (id: string, status: string, refundAmount?: number) => {
    try { setBusy(id); await apiService.respondGroomingDispute(id, { status, refundAmount }); setRefundFor(null); load() }
    catch (e: any) { setErr(e?.response?.data?.message || e.message) } finally { setBusy(null) }
  }
  void providerId

  if (loading) return <div className="module-page"><div className="loading-container"><div className="loading-spinner" /></div></div>

  const stat = (label: string, val: number, color: string) => (
    <div className="module-card" style={{ flex: '1 1 160px', textAlign: 'center' }}>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{formatCurrency(val)}</div>
      <div className="si-676930d7">{label}</div>
    </div>
  )

  return (
    <div className="module-page">
      <div className="module-header" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h1>💰 {t('groomingEarnings.title')}</h1>
        <button className="module-btn" onClick={() => onNavigate('/grooming/orders')}>← {t('groomingEarnings.backToBoard')}</button>
      </div>
      {err && <div className="module-alert error">{err}</div>}
      {summary && (
        <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {stat(t('groomingEarnings.available'), Number(summary.available), '#16a34a')}
            {stat(t('groomingEarnings.clearing'), Number(summary.clearing), '#d97706')}
            {stat(t('groomingEarnings.paid'), Number(summary.paid), '#2563eb')}
          </div>
          <p className="si-676930d7">{t('groomingEarnings.manualNote')}</p>
        </>
      )}

      {report && (
        <div className="module-card">
          <h3>{t('groomingReport.title')}</h3>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div><strong>{report.ordersByStatus?.completed || 0}</strong> {t('groomingReport.completed')}</div>
            <div><strong>{report.ordersByStatus?.confirmed || 0}</strong> {t('groomingReport.upcoming')}</div>
            <div><strong>{report.ordersByStatus?.no_show || 0}</strong> {t('groomingReport.noShows')}</div>
            <div><strong>{report.disputes?.total || 0}</strong> {t('groomingReport.disputes')}</div>
          </div>
          {report.revenueByService?.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div className="si-676930d7">{t('groomingReport.byService')}</div>
              {report.revenueByService.map((s: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span>{s.name} ×{s.count}</span><span>{formatCurrency(Number(s.revenue))}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {disputes.length > 0 && (
        <div className="module-card" style={{ border: '1px solid #fca5a5' }}>
          <h3>{t('groomingDispute.title')}</h3>
          {disputes.map(d => (
            <div key={d.id} style={{ padding: 10, border: '1px solid #fecaca', borderRadius: 8, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div><strong>{d.orderNumber}</strong> · {d.reason}{d.comments ? <div className="si-676930d7">{d.comments}</div> : null}</div>
                <span className="badge badge-inactive">{t(`groomingDispute.st.${d.status}`, { defaultValue: (d.status || '').replace(/_/g, ' ') })}</span>
              </div>
              {['open', 'under_review'].includes(d.status) && (
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-sm btn-outline" disabled={busy === d.id} onClick={() => respondDispute(d.id, 'under_review')}>{t('groomingDispute.review')}</button>
                  <button className="btn btn-sm btn-primary" disabled={busy === d.id} onClick={() => { setRefundFor(d); setRefundAmt('') }}>{t('groomingDispute.partialRefund')}</button>
                  <button className="btn btn-sm btn-outline" disabled={busy === d.id} onClick={() => respondDispute(d.id, 'resolved')}>{t('groomingDispute.resolve')}</button>
                  <button className="btn btn-sm btn-outline" disabled={busy === d.id} onClick={() => respondDispute(d.id, 'rejected')}>{t('groomingDispute.reject')}</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="module-card">
        <h3>{t('groomingEarnings.ledger')}</h3>
        {entries.length === 0 ? <p className="si-676930d7">{t('groomingEarnings.noEntries')}</p> : (
          <div className="data-table-container">
            <table className="data-table">
              <thead><tr><th>{t('groomingEarnings.order')}</th><th>{t('groomingEarnings.gross')}</th><th>{t('groomingEarnings.commission')}</th><th>{t('groomingEarnings.net')}</th><th>{t('groomingEarnings.status')}</th></tr></thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id}>
                    <td>{e.orderNumber || '—'}</td>
                    <td>{formatCurrency(Number(e.grossAmount))}</td>
                    <td>-{formatCurrency(Number(e.commissionAmount))}</td>
                    <td>{formatCurrency(Number(e.netAmount))}</td>
                    <td><span className="badge badge-inactive">{t(`groomingEarnings.st.${e.status}`, { defaultValue: e.status })}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="module-card">
        <h3>{t('groomingEarnings.settlements')}</h3>
        {settlements.length === 0 ? <p className="si-676930d7">{t('groomingEarnings.noSettlements')}</p> : (
          <div className="data-table-container">
            <table className="data-table">
              <thead><tr><th>{t('groomingEarnings.date')}</th><th>{t('groomingEarnings.amount')}</th><th>TDS</th><th>{t('groomingEarnings.netPaid')}</th><th>{t('groomingEarnings.method')}</th><th>{t('groomingEarnings.reference')}</th></tr></thead>
              <tbody>
                {settlements.map(s => (
                  <tr key={s.id}>
                    <td>{s.settledAt ? new Date(s.settledAt).toLocaleDateString() : '—'}</td>
                    <td>{formatCurrency(Number(s.amount))}</td>
                    <td>{formatCurrency(Number(s.tdsAmount))}</td>
                    <td>{formatCurrency(Number(s.netPaid))}</td>
                    <td>{s.method}</td>
                    <td>{s.reference || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {refundFor && (
        <div className="modal-overlay" onClick={() => setRefundFor(null)}>
          <div className="modal-content" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <h3>{t('groomingDispute.partialRefund')}</h3>
            <p className="si-676930d7">{refundFor.orderNumber} · {refundFor.reason}</p>
            <label className="module-label">{t('groomingDispute.refundPrompt')}</label>
            <input className="module-input" type="number" min="0" step="0.01" value={refundAmt}
              onChange={e => setRefundAmt(e.target.value)} />
            <div className="si-a5de6cea" style={{ marginTop: 6 }}>{t('groomingDispute.refundHint')}</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button className="btn btn-outline" onClick={() => setRefundFor(null)}>{t('groomingDispute.cancel')}</button>
              <button className="btn btn-primary"
                disabled={!(Number(refundAmt) > 0) || busy === refundFor.id}
                onClick={() => respondDispute(refundFor.id, 'partially_refunded', Number(refundAmt))}>
                {t('groomingDispute.issueRefund')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default GroomingEarnings

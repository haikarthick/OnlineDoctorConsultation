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
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    try {
      setLoading(true); setErr('')
      const prov = (await apiService.getMyGroomingProvider()).data
      if (!prov) { setErr(t('groomingEarnings.noProvider')); setLoading(false); return }
      const e = (await apiService.getGroomingEarnings(prov.id)).data
      setSummary(e.summary); setEntries(e.entries || [])
      setSettlements((await apiService.listGroomingSettlements(prov.id)).data || [])
    } catch (e: any) { setErr(e?.response?.data?.message || e.message) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

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
    </div>
  )
}

export default GroomingEarnings

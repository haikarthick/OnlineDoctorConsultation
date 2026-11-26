import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import client from '../../services/api/client'
import { userMessage } from '../../utils/userMessage'
import { appLocale } from '../../utils/appLocale'
import '../../components/mobile/ownerTools.css'

interface Row { id: string; med_id: string; adjustment_type: string; adjustment_qty: number; reason?: string; adjusted_by_name?: string; adjusted_at: string }

/** What changed this medicine's stock before: who, when, how much and why. Read only; the same pharmacy gate as the adjustment itself. */
export function StockHistory({ pharmacyId, medId }: { pharmacyId: string; medId: string }) {
  const { t } = useTranslation()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    client.get(`/pharmacies/${pharmacyId}/stock-adjustments`)
      .then(res => { if (live) setRows((Array.isArray(res.data) ? res.data : []).filter((r: Row) => r.med_id === medId).slice(0, 10)) })
      .catch(err => { if (live) { setRows([]); setError(userMessage(err, 'accountTools.historyFailed')) } })
    return () => { live = false }
  }, [pharmacyId, medId])

  return (
    <div className="ot-sheet">
      <h3>{t('accountTools.historyTitle')}</h3>
      {error && <div className="ot-error" role="alert">{error}</div>}
      {rows && rows.length === 0 && !error && <p className="ot-muted">{t('accountTools.historyEmpty')}</p>}
      <ul>
        {(rows || []).map(r => (
          <li key={r.id}>
            {t('accountTools.historyLine', {
              type: t(`pharmacy.stock.types.${r.adjustment_type}`, { defaultValue: r.adjustment_type }), qty: r.adjustment_qty,
              who: r.adjusted_by_name || '-', date: new Date(r.adjusted_at).toLocaleDateString(appLocale()),
            })}
            {r.reason ? <span className="ot-muted"> · {r.reason}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

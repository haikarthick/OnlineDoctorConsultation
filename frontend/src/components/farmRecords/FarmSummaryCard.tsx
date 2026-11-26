import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { useMasterData } from '../../context/MasterDataContext'
import { userMessage } from '../../utils/userMessage'
import { formatQuantity } from './recordShared'
import { summaryTotals, type SummaryRow } from './summaryTotals'
import '../mobile/ownerTools.css'

const DAYS = 30

/**
 * "The last 30 days" on the Daily records page: what the farm wrote down, added up per record type. Milk, eggs, feed and so on appear
 * only if this farm records them; the label and unit come from the master data (the farm profile engine), never from a species name.
 * It reloads whenever `refreshKey` changes (a record was saved or deleted).
 */
export function FarmSummaryCard({ farmId, refreshKey }: { farmId: string; refreshKey: number }) {
  const { t } = useTranslation()
  const { farmMaster, recordTypeEntry, resolveLabel } = useMasterData()
  const [rows, setRows] = useState<SummaryRow[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setError('')
    apiService.farmRecordsSummary(farmId, DAYS)
      .then((res: any) => { if (active) setRows(Array.isArray(res?.data?.items) ? res.data.items : []) })
      .catch((err: unknown) => { if (active) { setRows(null); setError(userMessage(err, 'farmSummary.failed')) } })
    return () => { active = false }
  }, [farmId, refreshKey])

  const order = useMemo(() => [...farmMaster.recordTypes].sort((a, b) => a.sortOrder - b.sortOrder).map(r => r.code), [farmMaster.recordTypes])
  const totals = useMemo(() => summaryTotals(rows || [], order), [rows, order])
  const unitOf = (code: string) => farmMaster.recordTypes.find(r => r.code === code)?.unit || ''
  const labelOf = (code: string) => { const e = recordTypeEntry(code); return e ? (resolveLabel(e, t) || code) : code }

  if (error) return <div className="ot-note" role="status">{error}</div>
  if (rows === null) return null
  return (
    <section className="ot-card" aria-label={t('farmSummary.title', { days: DAYS })}>
      <h3>{t('farmSummary.title', { days: DAYS })}</h3>
      {totals.length === 0
        ? <p className="ot-muted">{t('farmSummary.empty')}</p>
        : (
          <div className="ot-stats">
            {totals.map(x => (
              <div key={x.recordType} className="ot-stat">
                <span className="ot-muted"><span aria-hidden="true">{recordTypeEntry(x.recordType)?.icon}</span> {labelOf(x.recordType)}</span>
                <strong>{x.hasQuantity ? `${formatQuantity(x.total)}${unitOf(x.recordType) ? ` ${unitOf(x.recordType)}` : ''}` : t('farmSummary.entries', { count: x.entries })}</strong>
                <span className="ot-muted">{t('farmSummary.days', { count: x.days })}</span>
              </div>
            ))}
          </div>
        )}
    </section>
  )
}

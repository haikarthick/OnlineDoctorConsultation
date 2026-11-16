import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useMasterData } from '../../context/MasterDataContext'
import { useFarmRecordsEnabled } from '../../hooks/useFarmRecordsEnabled'
import { localIsoDate } from '../mobile/DateQuick'
import { formatQuantity, type FarmRecord } from './recordShared'

/**
 * What the farm team has written down about an animal in the last 7 days - milk, eggs, feed - for the vet
 * who is looking at that animal (consultation room, prescription writer). The server only answers a vet who
 * holds an appointment for the animal (or has a farm role), so for anyone else - or while the module is
 * switched off, or when nothing is recorded - this renders nothing: it is an addition, never an error.
 */
export const RecentFarmRecords: React.FC<{ animalId?: string | null; groupId?: string | null }> = ({ animalId, groupId }) => {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { enabled } = useFarmRecordsEnabled(!!user)
  const { recordTypeEntry, resolveLabel } = useMasterData()
  const [records, setRecords] = useState<FarmRecord[]>([])

  useEffect(() => {
    if (!enabled || (!animalId && !groupId)) { setRecords([]); return }
    let active = true
    apiService.listFarmRecords({
      ...(animalId ? { animalId } : { groupId: groupId || undefined }),
      from: localIsoDate(-6), to: localIsoDate(), limit: 200,
    })
      .then((res: any) => { if (active) setRecords(res?.data?.items || []) })
      .catch(() => { if (active) setRecords([]) })
    return () => { active = false }
  }, [enabled, animalId, groupId])

  if (!enabled || records.length === 0) return null

  // Per record type: the total, how many days it was written down, and the latest entry.
  const byType = new Map<string, FarmRecord[]>()
  for (const r of records) byType.set(r.recordType, [...(byType.get(r.recordType) || []), r])

  return (
    <section className="recent-farm-records" aria-label={t('farmRecords.recent.title')}>
      <h4 className="recent-farm-records-title">{t('farmRecords.recent.title')}</h4>
      <ul className="recent-farm-records-list">
        {[...byType.entries()].map(([code, list]) => {
          const entry = recordTypeEntry(code)
          const unit = list[0].unit ? ` ${list[0].unit}` : ''
          const withQty = list.filter(r => r.quantity !== null)
          const total = withQty.reduce((sum, r) => sum + (r.quantity || 0), 0)
          const days = new Set(list.map(r => r.recordDate)).size
          const latest = [...list].sort((a, b) => b.recordDate.localeCompare(a.recordDate))[0]
          return (
            <li key={code} className="recent-farm-record">
              <span aria-hidden="true">{entry?.icon}</span>{' '}
              <strong>{entry ? (resolveLabel(entry, t) || code) : code}</strong>{' '}
              {withQty.length > 0 && <span>{t('farmRecords.recent.total', { total: `${formatQuantity(total)}${unit}`, days })}</span>}
              {latest.quantity !== null && (
                <span className="recent-farm-record-latest"> · {t('farmRecords.recent.latest', { value: `${formatQuantity(latest.quantity)}${unit}`, date: latest.recordDate })}</span>
              )}
            </li>
          )
        })}
      </ul>
      <p className="recent-farm-records-hint">{t('farmRecords.recent.hint')}</p>
    </section>
  )
}

export default RecentFarmRecords

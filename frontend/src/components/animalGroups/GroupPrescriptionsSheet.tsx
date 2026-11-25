import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { BottomSheet } from '../mobile/BottomSheet'
import { userMessage } from '../../utils/userMessage'
import { appLocale } from '../../utils/appLocale'
import type { Medication } from '../../types/medicalRecords'
import './GroupPrescriptionsSheet.css'

interface GroupPrescription {
  id: string
  veterinarianName?: string
  medications: Medication[]
  instructions?: string
  validUntil?: string | null
  isActive: boolean
  headCountTreated?: number | null
  cycleName?: string | null
  createdAt: string
}

interface Props { open: boolean; groupId: string; groupName: string; onClose: () => void }

const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(appLocale(), { day: 'numeric', month: 'short', year: 'numeric' }) : '')

/**
 * Every prescription a vet wrote for ONE herd or flock, newest first: the same list the farmer, the farm team and the vet see.
 * Milk and meat holding days come from the prescription itself (the vet typed them once; nothing is typed twice).
 */
export function GroupPrescriptionsSheet({ open, groupId, groupName, onClose }: Props) {
  const { t } = useTranslation()
  const [rows, setRows] = useState<GroupPrescription[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    let live = true
    setLoading(true); setError(''); setRows([])
    apiService.listGroupPrescriptions(groupId)
      .then(res => { if (live) setRows(Array.isArray(res?.data?.prescriptions) ? res.data.prescriptions : []) })
      .catch(e => { if (live) setError(userMessage(e, 'groupPrescriptions.loadFailed')) })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [open, groupId])

  return (
    <BottomSheet open={open} title={t('groupPrescriptions.title', { name: groupName })} onClose={onClose}>
      <div className="gp-sheet">
        {loading && <p role="status">{t('groupPrescriptions.loading')}</p>}
        {error && <p className="gp-error" role="alert">{error}</p>}
        {!loading && !error && rows.length === 0 && (
          <p className="gp-empty">{t('groupPrescriptions.empty')}</p>
        )}
        <ul className="gp-list">
          {rows.map(p => (
            <li key={p.id} className="gp-card">
              <div className="gp-head">
                <strong>{t('groupPrescriptions.byVet', { name: p.veterinarianName || t('groupPrescriptions.aVet') })}</strong>
                <span className={`gp-pill${p.isActive ? ' gp-pill-active' : ''}`}>{p.isActive ? t('groupPrescriptions.active') : t('groupPrescriptions.ended')}</span>
              </div>
              <div className="gp-muted">
                {day(p.createdAt)}
                {p.validUntil ? ` · ${t('groupPrescriptions.validUntil', { date: day(p.validUntil) })}` : ''}
                {p.headCountTreated ? ` · ${t('groupPrescriptions.headTreated', { count: p.headCountTreated })}` : ''}
                {p.cycleName ? ` · ${p.cycleName}` : ''}
              </div>
              <ul className="gp-meds">
                {(p.medications || []).map((m, i) => (
                  <li key={i}>
                    <strong>{m.name}</strong> {[m.dosage, m.frequency, m.duration].filter(Boolean).join(' · ')}
                    {Number(m.withdrawalMilkDays) > 0 && <div className="gp-hold">{t('groupPrescriptions.holdMilk', { count: Number(m.withdrawalMilkDays) })}</div>}
                    {Number(m.withdrawalMeatDays) > 0 && <div className="gp-hold">{t('groupPrescriptions.holdMeat', { count: Number(m.withdrawalMeatDays) })}</div>}
                  </li>
                ))}
              </ul>
              {p.instructions && <p className="gp-muted">{p.instructions}</p>}
            </li>
          ))}
        </ul>
      </div>
    </BottomSheet>
  )
}

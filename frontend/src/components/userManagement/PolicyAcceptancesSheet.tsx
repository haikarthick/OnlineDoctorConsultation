import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { BottomSheet } from '../mobile/BottomSheet'
import { userMessage } from '../../utils/userMessage'
import { appLocale } from '../../utils/appLocale'
import type { User } from './userManagementShared'
import '../mobile/ownerTools.css'

interface Acceptance { docType: string; version: string | number; acceptedAt: string }

/** Admin: the policy documents a person accepted, with version and date (the proof asked for in a dispute or an audit). */
export function PolicyAcceptancesSheet({ user, onClose }: { user: User | null; onClose: () => void }) {
  const { t } = useTranslation()
  const [rows, setRows] = useState<Acceptance[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    let live = true
    setRows(null); setError('')
    apiService.adminGetUserAcceptances(user.id)
      .then(res => { if (live) setRows(Array.isArray(res?.data) ? res.data : []) })
      .catch(err => { if (live) { setRows([]); setError(userMessage(err, 'accountTools.policiesFailed')) } })
    return () => { live = false }
  }, [user])

  const name = user ? `${user.firstName} ${user.lastName}`.trim() || user.email : ''
  return (
    <BottomSheet open={!!user} title={t('accountTools.policiesTitle', { name })} onClose={onClose}>
      <div className="ot-sheet">
        {rows === null && <p role="status">{t('common.loading')}</p>}
        {error && <div className="ot-error" role="alert">{error}</div>}
        {rows && rows.length === 0 && !error && <p className="ot-muted">{t('accountTools.policiesEmpty')}</p>}
        <ul>
          {(rows || []).map((r, i) => (
            <li key={i}>
              <strong>{r.docType.replace(/_/g, ' ')}</strong> · {t('accountTools.policiesLine', { version: r.version, date: new Date(r.acceptedAt).toLocaleDateString(appLocale()) })}
            </li>
          ))}
        </ul>
      </div>
    </BottomSheet>
  )
}

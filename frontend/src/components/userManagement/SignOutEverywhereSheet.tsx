import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { BottomSheet } from '../mobile/BottomSheet'
import { userMessage } from '../../utils/userMessage'
import type { User } from './userManagementShared'
import '../mobile/ownerTools.css'

/**
 * Admin: end every visit a person has open - on every phone and browser. They stay registered and can sign in again straight away; they are
 * only asked to. The server makes every sign-in issued before this moment stop working (it is not just a list that is cleared).
 */
export function SignOutEverywhereSheet({ user, onClose }: { user: User | null; onClose: () => void }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [reason, setReason] = useState('')

  const close = () => { setDone(false); setError(''); setReason(''); onClose() }
  const confirm = async () => {
    if (!user || busy) return
    setBusy(true); setError('')
    try { await apiService.revokeUserSessions(user.id, reason.trim()); setDone(true) }
    catch (err) { setError(userMessage(err, 'signOutEverywhere.failed')) }
    finally { setBusy(false) }
  }

  const name = user ? `${user.firstName} ${user.lastName}`.trim() || user.email : ''
  return (
    <BottomSheet open={!!user} title={t('signOutEverywhere.title')} onClose={close}>
      {user && (
        <div className="ot-sheet">
          {done ? (
            <>
              <div className="ot-ok" role="status">{t('signOutEverywhere.done', { name })}</div>
              <div className="ot-actions"><button type="button" className="module-btn primary" onClick={close}>{t('common.close')}</button></div>
            </>
          ) : (
            <>
              <p>{t('signOutEverywhere.confirm', { name })}</p>
              <p className="ot-muted">{t('signOutEverywhere.hint')}</p>
              <label>{t('accountTools.signOutReason')}
                <input value={reason} onChange={e => setReason(e.target.value)} autoComplete="off" />
              </label>
              {error && <div className="ot-error" role="alert">{error}</div>}
              <div className="ot-actions">
                <button type="button" className="module-btn" onClick={close}>{t('common.cancel')}</button>
                <button type="button" className="module-btn primary" disabled={busy || reason.trim().length < 3} onClick={confirm}>{t('signOutEverywhere.action')}</button>
              </div>
            </>
          )}
        </div>
      )}
    </BottomSheet>
  )
}

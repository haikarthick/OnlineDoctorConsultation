import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { BottomSheet } from '../mobile/BottomSheet'
import { userMessage } from '../../utils/userMessage'
import '../mobile/ownerTools.css'

/** Every person, every role: end all of my sign-ins (a lost phone, a shared computer). Asks first, then signs this device out too. */
export function SignOutAllDevices() {
  const { t } = useTranslation()
  const { logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const confirm = async () => {
    if (busy) return
    setBusy(true); setError('')
    try { await apiService.logoutAll(); await logout() }
    catch (err) { setError(userMessage(err, 'accountTools.signOutAllFailed')); setBusy(false) }
  }

  return (
    <>
      <button type="button" className="btn btn-outline" onClick={() => { setError(''); setOpen(true) }}>{t('accountTools.signOutAll')}</button>
      <BottomSheet open={open} title={t('accountTools.signOutAll')} onClose={() => setOpen(false)}>
        <div className="ot-sheet">
          <p>{t('accountTools.signOutAllConfirm')}</p>
          {error && <div className="ot-error" role="alert">{error}</div>}
          <div className="ot-actions">
            <button type="button" className="module-btn" onClick={() => setOpen(false)}>{t('common.cancel')}</button>
            <button type="button" className="module-btn primary" disabled={busy} onClick={confirm}>{t('accountTools.signOutAllAction')}</button>
          </div>
        </div>
      </BottomSheet>
    </>
  )
}

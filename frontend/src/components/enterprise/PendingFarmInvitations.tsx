import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { usePermission } from '../../context/PermissionContext'
import { userMessage } from '../../utils/userMessage'

interface Mine { id: string; farmName: string; role: string; inviterName: string | null; expiresAt: string }

/**
 * "Ravi invited you to join Green Pastures as worker" - shown at the top of every signed-in screen while
 * the person has an invitation waiting, with Accept and Decline. They do not need the link: the
 * invitation is found by their own mobile number or email. Accepting reloads their permissions, because
 * joining a farm gives them the farm screens.
 */
export const PendingFarmInvitations: React.FC = () => {
  const { t } = useTranslation()
  const { reloadPermissions } = usePermission()
  const [items, setItems] = useState<Mine[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await apiService.myFarmInvitations()
      setItems(res.data?.items || [])
    } catch {
      setItems([]) // a banner is a nicety: if it cannot load, the rest of the app still works
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const answer = async (inv: Mine, accept: boolean) => {
    setBusyId(inv.id); setError(''); setMessage('')
    try {
      if (accept) {
        await apiService.acceptFarmInvitationById(inv.id)
        setMessage(t('farmTeam.banner.joined', { farm: inv.farmName }))
        await reloadPermissions()
      } else {
        await apiService.declineFarmInvitationById(inv.id)
        setMessage(t('farmTeam.banner.declined'))
      }
      await load()
    } catch (err) {
      setError(userMessage(err))
    } finally { setBusyId(null) }
  }

  if (items.length === 0 && !message && !error) return null

  return (
    <div className="pending-invitations" aria-live="polite">
      {message && <div className="alert alert-success" role="status">{message}</div>}
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {items.map(inv => {
        const role = t(`farmTeam.roles.${inv.role}`, { defaultValue: inv.role })
        return (
          <div key={inv.id} className="pending-invitation">
            <span className="pending-invitation-text">
              🐄 {inv.inviterName
                ? t('farmTeam.banner.text', { inviter: inv.inviterName, farm: inv.farmName, role })
                : t('farmTeam.banner.textNoName', { farm: inv.farmName, role })}
            </span>
            <span className="pending-invitation-actions">
              <button type="button" className="btn btn-sm btn-primary" disabled={busyId === inv.id} onClick={() => answer(inv, true)}>{t('farmTeam.banner.accept')}</button>
              <button type="button" className="btn btn-sm btn-secondary" disabled={busyId === inv.id} onClick={() => answer(inv, false)}>{t('farmTeam.banner.decline')}</button>
            </span>
          </div>
        )
      })}
    </div>
  )
}

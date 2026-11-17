import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { userMessage } from '../../utils/userMessage'
import { FarmRole, canInvite } from '../../utils/farmRoles'
import { InviteResult, InviteResultNotice } from './InviteResultNotice'

interface Invitation {
  id: string; role: string; status: string; inviteeName: string | null; inviteePhoneMasked: string | null; inviteeEmail: string | null
  expiresAt: string; sendCount: number; canResendAt: string | null
}

/**
 * The invitations a farm has sent: who, which role, and where each one stands (waiting, joined, declined,
 * expired, cancelled). Visible to the owner and managers. A waiting invitation can be sent again (a new
 * link, a fresh 7 days) or cancelled.
 */
export const FarmInvitationsPanel: React.FC<{
  enterpriseId: string
  actorRole: FarmRole | null
  /** Bumped by the page when an invitation was created, so the list reloads. */
  refreshKey: number
  /** Called when someone's answer changes the team (so the members list can refresh). */
  onChanged: () => void
}> = ({ enterpriseId, actorRole, refreshKey, onChanged }) => {
  const { t } = useTranslation()
  const [items, setItems] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState<InviteResult | null>(null)
  const [message, setMessage] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const allowed = canInvite(actorRole)

  const load = useCallback(async () => {
    if (!allowed) { setLoading(false); return }
    try {
      const res = await apiService.listFarmInvitations(enterpriseId)
      setItems(res.data?.items || [])
      setError('')
    } catch (err) {
      setError(userMessage(err))
    } finally {
      setLoading(false)
    }
  }, [enterpriseId, allowed])

  useEffect(() => { setLoading(true); void load() }, [load, refreshKey])

  if (!allowed) return null

  const resend = async (inv: Invitation) => {
    setBusyId(inv.id); setError(''); setMessage(''); setNotice(null)
    try {
      const res = await apiService.resendFarmInvitation(enterpriseId, inv.id)
      setNotice({ ...res.data, who: inv.inviteeName || inv.inviteePhoneMasked || inv.inviteeEmail || '' })
      await load()
    } catch (err) {
      setError(userMessage(err))
    } finally { setBusyId(null) }
  }

  const cancel = async (inv: Invitation) => {
    setBusyId(inv.id); setError(''); setMessage(''); setNotice(null)
    try {
      await apiService.cancelFarmInvitation(enterpriseId, inv.id)
      setMessage(t('farmTeam.cancelled'))
      await load()
      onChanged()
    } catch (err) {
      setError(userMessage(err))
    } finally { setBusyId(null) }
  }

  return (
    <section className="farm-invitations card" aria-label={t('farmTeam.pendingTitle')}>
      <h3 className="farm-invitations-title">✉️ {t('farmTeam.pendingTitle')}</h3>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {message && <div className="alert alert-success" role="status">{message}</div>}
      {notice && <InviteResultNotice result={notice} />}
      {loading ? (
        <p className="farm-invitations-empty">{t('farmRecords.loading')}</p>
      ) : items.length === 0 ? (
        <p className="farm-invitations-empty">{t('farmTeam.pendingEmpty')}</p>
      ) : (
        <ul className="farm-invitations-list">
          {items.map(inv => (
            <li key={inv.id} className="farm-invitation">
              <div className="farm-invitation-who">
                <strong>{inv.inviteeName || inv.inviteePhoneMasked || inv.inviteeEmail}</strong>
                <span className="farm-invitation-detail">
                  {[inv.inviteeName ? (inv.inviteePhoneMasked || inv.inviteeEmail) : null, t(`farmTeam.roles.${inv.role}`)].filter(Boolean).join(' · ')}
                </span>
              </div>
              <span className={`farm-invitation-status is-${inv.status}`}>{t(`farmTeam.statuses.${inv.status}`)}</span>
              {inv.status === 'pending' && (
                <div className="farm-invitation-actions">
                  <span className="farm-invitation-expires">{t('farmTeam.expiresOn', { date: new Date(inv.expiresAt).toLocaleDateString() })}</span>
                  <button type="button" className="btn btn-sm btn-secondary" disabled={busyId === inv.id} onClick={() => resend(inv)}>{t('farmTeam.resend')}</button>
                  <button type="button" className="btn btn-sm btn-secondary" disabled={busyId === inv.id} onClick={() => cancel(inv)}>{t('farmTeam.cancelInvite')}</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

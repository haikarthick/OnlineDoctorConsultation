import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import apiService from '../../services/api'
import { userMessage } from '../../utils/userMessage'

interface Mine { id: string; token: string; networkName: string; hospitalName: string | null; inviterName: string | null; animalName: string | null; expiresAt: string }

const DISMISSED = 'walkInInvites:dismissed'
const readDismissed = (): string[] => { try { return JSON.parse(localStorage.getItem(DISMISSED) || '[]') } catch { return [] } }

/**
 * "Green Valley Vets invited you" - shown at the top of every signed-in screen while a hospital walk-in invitation is waiting for
 * this person's email. Accepting shares NO animal data (the hospital still has to ask for consent); "Not now" only hides it here.
 */
export const PendingWalkInInvites: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [items, setItems] = useState<Mine[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await apiService.myWalkInInvites()
      const hidden = readDismissed()
      setItems((res.data?.items || []).filter((i: Mine) => !hidden.includes(i.id)))
    } catch { setItems([]) } // a banner is a nicety: if it cannot load, the rest of the app still works
  }, [])
  useEffect(() => { void load() }, [load])

  const accept = async (inv: Mine) => {
    setBusyId(inv.id); setError(''); setMessage('')
    try {
      await apiService.acceptWalkInInvite(inv.token)
      setMessage(t('walkInInvite.accepted', { network: inv.networkName, pet: inv.animalName || t('walkInInvite.yourPet') }))
      await load()
    } catch (err) { setError(userMessage(err)) } finally { setBusyId(null) }
  }
  const later = (inv: Mine) => {
    try { localStorage.setItem(DISMISSED, JSON.stringify([...readDismissed(), inv.id])) } catch { /* storage blocked: it just shows again */ }
    setItems(list => list.filter(i => i.id !== inv.id))
  }

  if (items.length === 0 && !message && !error) return null
  return (
    <div className="pending-invitations" aria-live="polite">
      {message && (
        <div className="alert alert-success" role="status">
          {message}{' '}
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => navigate('/network-memberships')}>{t('walkInInvite.seeConnections')}</button>
        </div>
      )}
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {items.map(inv => (
        <div key={inv.id} className="pending-invitation">
          <div className="pending-invitation-text">
            <strong>{t('walkInInvite.bannerTitle', { network: inv.networkName })}</strong>
            <p>{t('walkInInvite.bannerBody', { inviter: inv.inviterName || t('walkInInvite.theHospital'), pet: inv.animalName || t('walkInInvite.yourPet') })}</p>
            <p className="pending-invitation-note">{t('walkInInvite.noDataShared')}</p>
          </div>
          <div className="pending-invitation-actions">
            <button type="button" className="btn btn-primary" disabled={busyId === inv.id} onClick={() => void accept(inv)}>{t('walkInInvite.accept')}</button>
            <button type="button" className="btn btn-secondary" disabled={busyId === inv.id} onClick={() => later(inv)}>{t('walkInInvite.notNow')}</button>
          </div>
        </div>
      ))}
    </div>
  )
}

export default PendingWalkInInvites

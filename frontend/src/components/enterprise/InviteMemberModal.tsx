import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { BottomSheet } from '../mobile/BottomSheet'
import { ChipSelect } from '../mobile/ChipSelect'
import { userMessage } from '../../utils/userMessage'
import { InviteResult, InviteResultNotice } from './InviteResultNotice'

/**
 * Invite a person to the farm by mobile number and/or email, with a role. Nobody asks to join: the owner
 * (or a manager, for the roles below a manager) invites. The roles offered are the ones the signed-in
 * person may give - a manager is not offered "manager". On success it shows what happened (text sent or
 * not, email sent or not) and the link, so the invitation can still be shared by hand.
 */
export const InviteMemberModal: React.FC<{
  enterpriseId: string
  /** Role values the signed-in person may give. */
  roles: string[]
  onClose: () => void
  /** Called after an invitation was created, so the list can refresh. */
  onInvited: () => void
}> = ({ enterpriseId, roles, onClose, onInvited }) => {
  const { t } = useTranslation()
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState(roles.includes('worker') ? 'worker' : roles[0] || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<InviteResult | null>(null)

  const hasContact = phone.trim() !== '' || email.trim() !== ''

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hasContact) { setError(t('farmTeam.needContact')); return }
    setBusy(true); setError('')
    try {
      const res = await apiService.inviteToFarm(enterpriseId, { phone: phone.trim() || undefined, email: email.trim() || undefined, name: name.trim() || undefined, role })
      setResult({ ...res.data, who: name.trim() || phone.trim() || email.trim() })
      onInvited()
    } catch (err) {
      setError(userMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <BottomSheet open title={t('farmTeam.inviteTitle')} onClose={onClose}>
      {result ? (
        <div className="team-invite-sheet">
          <InviteResultNotice result={result} />
          <button type="button" className="btn btn-primary" onClick={onClose}>{t('mobileUi.close')}</button>
        </div>
      ) : (
        <form className="team-invite-sheet" onSubmit={submit}>
          <p className="team-invite-hint">{t('farmTeam.inviteHint')}</p>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <div className="form-group">
            <label htmlFor="invite-phone">{t('farmTeam.phone')}</label>
            <input id="invite-phone" className="module-input" type="tel" inputMode="tel" autoComplete="off" value={phone} onChange={e => setPhone(e.target.value)} placeholder="98765 43210" />
          </div>
          <div className="form-group">
            <label htmlFor="invite-email">{t('farmTeam.email')}</label>
            <input id="invite-email" className="module-input" type="email" inputMode="email" autoComplete="off" autoCapitalize="none" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" />
          </div>
          <div className="form-group">
            <label htmlFor="invite-name">{t('farmTeam.name')}</label>
            <input id="invite-name" className="module-input" type="text" autoComplete="off" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <ChipSelect
            label={t('farmTeam.role')}
            options={roles.map(r => ({ value: r, label: t(`farmTeam.roles.${r}`) }))}
            value={role}
            onChange={setRole}
          />
          {role && <p className="team-invite-role-help">{t(`farmTeam.roleHelp.${role}`)}</p>}
          {!hasContact && <p className="team-invite-hint" role="status">{t('farmTeam.needContact')}</p>}
          <div className="team-invite-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>{t('farmTeam.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={!hasContact || !role || busy}>{busy ? t('farmTeam.sending') : t('farmTeam.send')}</button>
          </div>
        </form>
      )}
    </BottomSheet>
  )
}

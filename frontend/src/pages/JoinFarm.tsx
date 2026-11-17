import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import apiService from '../services/api'
import { useAuth } from '../context/AuthContext'
import PasswordInput from '../components/PasswordInput'
import { userMessage } from '../utils/userMessage'
import './ModulePage.css'

interface Preview {
  farmName: string; role: string; inviterName: string | null; inviteeName: string | null
  problem: string | null; hasAccount: boolean; sentTo: string | null; byPhone: boolean; byEmail: boolean
}

/**
 * The page an invitation link opens (public). It shows who invited the person to which farm and as what,
 * then the one thing they can do next:
 *   - already signed in            -> accept or decline
 *   - has an account, signed out   -> sign in (and come straight back here)
 *   - no account                   -> create one (the link proves they hold the number / email it went to)
 * Anything wrong with the link (expired, cancelled, used) is said in words, with what to do.
 */
const JoinFarm: React.FC = () => {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, login } = useAuth()

  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<'joined' | 'declined' | null>(null)
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (!token) { setLoading(false); return }
    apiService.previewFarmInvitation(token)
      .then((res: any) => setPreview(res.data))
      .catch(err => setError(userMessage(err)))
      .finally(() => setLoading(false))
  }, [token])

  const role = preview ? t(`farmTeam.roles.${preview.role}`, { defaultValue: preview.role }) : ''
  const sentence = preview
    ? (preview.inviterName
      ? t('farmTeam.join.invitedBy', { inviter: preview.inviterName, farm: preview.farmName, role })
      : t('farmTeam.join.invitedNoName', { farm: preview.farmName, role }))
    : ''

  const answer = async (accept: boolean) => {
    setBusy(true); setError('')
    try {
      if (accept) await apiService.acceptFarmInvitation(token)
      else await apiService.declineFarmInvitation(token)
      setDone(accept ? 'joined' : 'declined')
    } catch (err) {
      setError(userMessage(err))
    } finally { setBusy(false) }
  }

  const register = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      const res = await apiService.registerFromFarmInvitation({ token, firstName: first.trim(), lastName: last.trim(), password, email: email.trim() || undefined })
      // The account exists and they are on the farm: sign them in with the number / email the invitation went to.
      await login(res.data.identifier, password)
    } catch (err) {
      setError(userMessage(err))
      setBusy(false)
    }
  }

  const goHome = () => navigate(isAuthenticated ? '/dashboard' : '/')

  if (loading) return <div className="module-page"><div className="loading-spinner">{t('farmTeam.join.loading')}</div></div>

  return (
    <div className="module-page join-farm">
      <div className="card join-farm-card">
        <h1 className="join-farm-title">🐄 {t('farmTeam.join.title')}</h1>

        {!token && <p role="alert">{t('farmTeam.join.noToken')}</p>}
        {error && !preview && <p role="alert">{error}</p>}

        {preview && done === 'joined' && (
          <>
            <p className="join-farm-ok" role="status">✓ {t('farmTeam.join.joined', { farm: preview.farmName })}</p>
            <button type="button" className="btn btn-primary" onClick={() => navigate('/enterprises')}>{t('farmTeam.join.openFarm')}</button>
          </>
        )}
        {preview && done === 'declined' && (
          <>
            <p role="status">{t('farmTeam.join.declined')}</p>
            <button type="button" className="btn btn-secondary" onClick={goHome}>{t('farmTeam.join.home')}</button>
          </>
        )}

        {preview && !done && (
          <>
            <p className="join-farm-sentence">{sentence}</p>
            {preview.sentTo && <p className="join-farm-sent">{t('farmTeam.join.sentTo', { to: preview.sentTo })}</p>}

            {preview.problem ? (
              <>
                <p role="alert">{preview.problem}</p>
                <button type="button" className="btn btn-secondary" onClick={goHome}>{t('farmTeam.join.home')}</button>
              </>
            ) : (
              <>
                {error && <div className="alert alert-error" role="alert">{error}</div>}

                {isAuthenticated && (
                  <div className="join-farm-actions">
                    <button type="button" className="btn btn-primary" disabled={busy} onClick={() => answer(true)}>{busy ? t('farmTeam.join.working') : t('farmTeam.join.accept')}</button>
                    <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => answer(false)}>{t('farmTeam.join.decline')}</button>
                  </div>
                )}

                {!isAuthenticated && preview.hasAccount && (
                  <>
                    <p>{t('farmTeam.join.haveAccount')}</p>
                    <button type="button" className="btn btn-primary" onClick={() => navigate('/login', { state: { from: location } })}>{t('farmTeam.join.signIn')}</button>
                  </>
                )}

                {!isAuthenticated && !preview.hasAccount && (
                  <form className="join-farm-form" onSubmit={register}>
                    <h2 className="join-farm-subtitle">{t('farmTeam.join.createTitle')}</h2>
                    <div className="form-group">
                      <label htmlFor="join-first">{t('farmTeam.join.firstName')}</label>
                      <input id="join-first" className="module-input" type="text" autoComplete="given-name" required value={first} onChange={e => setFirst(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label htmlFor="join-last">{t('farmTeam.join.lastName')}</label>
                      <input id="join-last" className="module-input" type="text" autoComplete="family-name" required value={last} onChange={e => setLast(e.target.value)} />
                    </div>
                    {!preview.byEmail && (
                      <div className="form-group">
                        <label htmlFor="join-email">{t('farmTeam.join.email')}</label>
                        <input id="join-email" className="module-input" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={email} onChange={e => setEmail(e.target.value)} />
                      </div>
                    )}
                    <div className="form-group">
                      <label htmlFor="join-password">{t('farmTeam.join.password')}</label>
                      <PasswordInput id="join-password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" required />
                      <small className="field-hint">{t('farmTeam.join.passwordHint')}</small>
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={busy || !first.trim() || !last.trim() || !password}>{busy ? t('farmTeam.join.working') : t('farmTeam.join.create')}</button>
                  </form>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default JoinFarm

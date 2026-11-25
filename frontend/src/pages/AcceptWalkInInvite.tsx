import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import apiService from '../services/api'
import { useAuth } from '../context/AuthContext'
import { userMessage } from '../utils/userMessage'
import './AcceptHospitalInvite.css'

interface Preview { networkName: string; hospitalName: string | null; inviterName: string | null; animalName: string | null; message: string | null }

/**
 * The page behind the link a hospital shares with a walk-in patient. Signed in: shows who invited them and asks to accept (accepting
 * shares no animal data). Not signed in: says to sign in or register with the invited email, after which the same invitation also
 * appears as a banner - the link is a shortcut, not the only way.
 */
export default function AcceptWalkInInvite() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const token = useSearchParams()[0].get('token') || ''
  const [step, setStep] = useState<'loading' | 'ready' | 'signin' | 'done' | 'error'>('loading')
  const [info, setInfo] = useState<Preview | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!token) { setError(t('walkInInvite.noToken')); setStep('error'); return }
    if (!user) { setStep('signin'); return }
    apiService.walkInInvitePreview(token)
      .then((res: any) => { setInfo(res.data); setStep('ready') })
      .catch(err => { setError(userMessage(err)); setStep('error') })
  }, [token, user, t])

  const accept = async () => {
    setBusy(true); setError('')
    try { await apiService.acceptWalkInInvite(token); setStep('done') }
    catch (err) { setError(userMessage(err)) } finally { setBusy(false) }
  }

  const pet = info?.animalName || t('walkInInvite.yourPet')
  return (
    <div className="invite-page">
      <div className="invite-card">
        <div className="invite-logo">🐾 waytovet</div>
        {step === 'loading' && <><div className="loading-spinner" /><p>{t('walkInInvite.loading')}</p></>}
        {step === 'signin' && (
          <>
            <h2>{t('walkInInvite.pageTitle')}</h2>
            <p>{t('walkInInvite.signInFirst')}</p>
            <button className="invite-btn" onClick={() => navigate('/login')}>{t('walkInInvite.signIn')}</button>
            <button className="invite-btn" onClick={() => navigate('/register')}>{t('walkInInvite.register')}</button>
          </>
        )}
        {step === 'ready' && info && (
          <>
            <h2>{t('walkInInvite.bannerTitle', { network: info.networkName })}</h2>
            <p>{t('walkInInvite.bannerBody', { inviter: info.inviterName || t('walkInInvite.theHospital'), pet })}</p>
            {info.message && <p className="invite-hint">{info.message}</p>}
            <p className="invite-hint">{t('walkInInvite.noDataShared')}</p>
            {error && <p className="invite-error-msg" role="alert">{error}</p>}
            <button className="invite-btn" disabled={busy} onClick={() => void accept()}>{t('walkInInvite.accept')}</button>
          </>
        )}
        {step === 'done' && info && (
          <>
            <div className="invite-success-icon">✅</div>
            <h2>{t('walkInInvite.doneTitle')}</h2>
            <p>{t('walkInInvite.accepted', { network: info.networkName, pet })}</p>
            <button className="invite-btn" onClick={() => navigate('/network-memberships')}>{t('walkInInvite.seeConnections')}</button>
          </>
        )}
        {step === 'error' && (
          <>
            <div className="invite-error-icon">⛔</div>
            <h2>{t('walkInInvite.invalidTitle')}</h2>
            <p className="invite-error-msg">{error}</p>
            <button className="invite-btn" onClick={() => navigate('/')}>{t('walkInInvite.home')}</button>
          </>
        )}
      </div>
    </div>
  )
}

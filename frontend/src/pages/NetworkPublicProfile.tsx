import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import apiService from '../services/api'
import './NetworkPublicProfile.css'

interface PublicNetwork {
  id: string; name: string; logoUrl?: string | null; contactEmail?: string | null; websiteUrl?: string | null; website?: string | null
  specializations?: string[] | null; emergencyServices?: boolean | null; headquartersCity?: string | null; headquartersState?: string | null; country?: string | null
}

/**
 * The public face of a hospital network: name, where it is, what it treats, how to reach it. Only public-safe fields (the server sends
 * nothing about patients, staff or money). Anyone with the link can open it, signed in or not.
 */
export default function NetworkPublicProfile() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const [net, setNet] = useState<PublicNetwork | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading')

  useEffect(() => {
    if (!id) { setState('missing'); return }
    let live = true
    setState('loading')
    apiService.getNetworkPublicProfile(id)
      .then(res => { if (live) { setNet(res?.data || null); setState(res?.data ? 'ready' : 'missing') } })
      .catch(() => { if (live) setState('missing') })
    return () => { live = false }
  }, [id])

  const site = net?.websiteUrl || net?.website
  return (
    <main className="npp">
      <Link to="/" className="npp-back">← {t('networkProfile.back')}</Link>
      {state === 'loading' && <p role="status">{t('common.loading')}</p>}
      {state === 'missing' && (
        <div className="npp-card">
          <h1>{t('networkProfile.missingTitle')}</h1>
          <p>{t('networkProfile.missingBody')}</p>
        </div>
      )}
      {state === 'ready' && net && (
        <div className="npp-card">
          {net.logoUrl && <img className="npp-logo" src={net.logoUrl} alt="" />}
          <h1>{net.name}</h1>
          {(net.headquartersCity || net.headquartersState) && (
            <p className="npp-muted">📍 {[net.headquartersCity, net.headquartersState, net.country].filter(Boolean).join(', ')}</p>
          )}
          {net.emergencyServices && <p className="npp-pill">{t('networkProfile.emergency')}</p>}
          {!!net.specializations?.length && (
            <>
              <h2>{t('networkProfile.treats')}</h2>
              <ul className="npp-tags">{net.specializations.map(s => <li key={s}>{s}</li>)}</ul>
            </>
          )}
          <h2>{t('networkProfile.contact')}</h2>
          <ul className="npp-contact">
            {net.contactEmail && <li><a href={`mailto:${net.contactEmail}`}>{net.contactEmail}</a></li>}
            {site && <li><a href={site} target="_blank" rel="noopener noreferrer">{site}</a></li>}
            {!net.contactEmail && !site && <li className="npp-muted">{t('networkProfile.noContact')}</li>}
          </ul>
        </div>
      )}
    </main>
  )
}

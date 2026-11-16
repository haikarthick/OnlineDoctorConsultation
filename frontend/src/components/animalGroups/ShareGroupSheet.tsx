import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { BottomSheet } from '../mobile/BottomSheet'
import { SaveState } from '../mobile/SaveState'
import { useSaveAction } from '../../hooks/useSaveAction'
import { useSettings } from '../../context/SettingsContext'
import { userMessage } from '../../utils/userMessage'

interface Sharing { id: string; networkName: string; hospitalName?: string | null; status: string; validUntil?: string | null; sharedSince: string; endedReason?: string | null; medicalRecords: boolean; vaccinationRecords: boolean; prescriptions: boolean }
interface OpenCode { id: string; expiresAt: string }
interface Created { code: string; expiresAt: string; cycleNumber: number | null }

/**
 * The farm owner shares a group with a hospital network for the group's current production cycle: choose what is shared,
 * get a one-time code, give it to the hospital. The code is shown ONCE (only its hash is kept). Sharing ends when the cycle
 * closes or when the owner stops it here. Only the farm owner sees the button (the server enforces it too).
 */
export const ShareGroupSheet: React.FC<{ group: { id: string; name: string } | null; onClose: () => void }> = ({ group, onClose }) => {
  const { t } = useTranslation()
  const { formatDate } = useSettings()
  const [scope, setScope] = useState({ medicalRecords: true, vaccinationRecords: true, prescriptions: true })
  const [sharings, setSharings] = useState<Sharing[]>([])
  const [openCodes, setOpenCodes] = useState<OpenCode[]>([])
  const [created, setCreated] = useState<Created | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    if (!group) return
    try {
      const res = await apiService.listGroupNetworkShares(group.id)
      setSharings(res.data?.sharings || []); setOpenCodes(res.data?.openCodes || []); setError('')
    } catch (err: any) { setError(userMessage(err, 'groupSharing.loadFailed')) }
  }, [group])
  useEffect(() => { setCreated(null); setCopied(false); void load() }, [load])

  const create = useSaveAction(async () => {
    if (!group) return
    const res = await apiService.createGroupShareCode(group.id, scope)
    setCreated(res.data)
  }, t('groupSharing.createFailed'))
  const stop = useSaveAction(async (contextId: string) => { if (group) await apiService.stopGroupNetworkShare(group.id, contextId) }, t('groupSharing.stopFailed'))
  const cancel = useSaveAction(async (codeId: string) => { if (group) await apiService.cancelGroupShareCode(group.id, codeId) }, t('groupSharing.cancelFailed'))

  const onCreate = async () => { if (await create.run()) void load() }
  const onStop = async (id: string) => { if (await stop.run(id)) void load() }
  const onCancel = async (id: string) => { if (await cancel.run(id)) void load() }
  const copy = async () => {
    if (!created) return
    try { await navigator.clipboard.writeText(created.code); setCopied(true) } catch { setCopied(false) }
  }

  const live = sharings.filter(s => s.status === 'active')
  const past = sharings.filter(s => s.status !== 'active').slice(0, 5)
  const endedWords = (s: Sharing) => t(s.endedReason === 'cycle_closed' ? 'groupSharing.endedCycle' : 'groupSharing.endedOwner')

  return (
    <BottomSheet open={!!group} title={t('groupSharing.title', { name: group?.name || '' })} onClose={onClose}>
      <p className="share-hint">{t('groupSharing.explain')}</p>
      {error && <p className="alert alert-error" role="alert">{error}</p>}

      {live.length > 0 && (
        <section className="share-section">
          <h4>{t('groupSharing.sharedNow')}</h4>
          <ul className="share-list">
            {live.map(s => (
              <li key={s.id} className="share-row">
                <span className="share-row-name">{s.networkName}{s.hospitalName ? ` · ${s.hospitalName}` : ''}</span>
                <span className="share-row-meta">{t('groupSharing.since', { date: formatDate(s.sharedSince) })}</span>
                <button type="button" className="btn btn-sm btn-danger" disabled={stop.status === 'saving'} onClick={() => onStop(s.id)}>{t('groupSharing.stop')}</button>
              </li>
            ))}
          </ul>
          <p className="share-hint">{t('groupSharing.endsWithCycle')}</p>
        </section>
      )}

      {created ? (
        <section className="share-section share-code-box" role="status">
          <h4>{t('groupSharing.codeReady')}</h4>
          <p className="share-code">{created.code}</p>
          <p className="share-hint">{t('groupSharing.codeNote', { date: formatDate(created.expiresAt) })}</p>
          <button type="button" className="btn btn-secondary share-action" onClick={copy}>{copied ? t('groupSharing.copied') : t('groupSharing.copy')}</button>
        </section>
      ) : (
        <section className="share-section">
          <h4>{t('groupSharing.whatToShare')}</h4>
          {(['medicalRecords', 'vaccinationRecords', 'prescriptions'] as const).map(k => (
            <label key={k} className="share-check">
              <input type="checkbox" checked={scope[k]} onChange={e => setScope(s => ({ ...s, [k]: e.target.checked }))} />
              <span>{t('groupSharing.scope.' + k)}</span>
            </label>
          ))}
          <SaveState status={create.status} error={create.error} offline={create.offline} onRetry={create.retry} />
          <button type="button" className="btn btn-primary share-action" disabled={create.status === 'saving' || !(scope.medicalRecords || scope.vaccinationRecords || scope.prescriptions)} onClick={onCreate}>
            {t('groupSharing.createCode')}
          </button>
        </section>
      )}

      {openCodes.length > 0 && !created && (
        <section className="share-section">
          <h4>{t('groupSharing.openCodes')}</h4>
          <ul className="share-list">
            {openCodes.map(c => (
              <li key={c.id} className="share-row">
                <span className="share-row-meta">{t('groupSharing.validTo', { date: formatDate(c.expiresAt) })}</span>
                <button type="button" className="btn btn-sm btn-secondary" disabled={cancel.status === 'saving'} onClick={() => onCancel(c.id)}>{t('groupSharing.cancelCode')}</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {past.length > 0 && (
        <section className="share-section">
          <h4>{t('groupSharing.earlier')}</h4>
          <ul className="share-list">
            {past.map(s => <li key={s.id} className="share-row"><span className="share-row-name">{s.networkName}</span><span className="share-row-meta">{endedWords(s)}</span></li>)}
          </ul>
        </section>
      )}
      <SaveState status={stop.status} error={stop.error} offline={stop.offline} onRetry={stop.retry} />
      <SaveState status={cancel.status} error={cancel.error} offline={cancel.offline} onRetry={cancel.retry} />
    </BottomSheet>
  )
}

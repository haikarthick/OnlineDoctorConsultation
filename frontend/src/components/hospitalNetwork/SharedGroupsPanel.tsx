import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { BottomSheet } from '../mobile/BottomSheet'
import { SaveState } from '../mobile/SaveState'
import { useSaveAction } from '../../hooks/useSaveAction'
import { useSettings } from '../../context/SettingsContext'
import { userMessage } from '../../utils/userMessage'

interface SharedGroup { id: string; groupId: string; groupName: string; species?: string; headCount?: number; farmName?: string; sharedSince: string }

/**
 * A network's view of GROUPS (herds / flocks) farms have shared with it: add one with the code the farm owner gave you,
 * list the groups shared with your branch, and read their records for the shared cycle (read only). A farm shares one cycle
 * at a time; when the cycle closes or the owner stops sharing, the group disappears from here.
 */
export const SharedGroupsPanel: React.FC<{ networkId: string }> = ({ networkId }) => {
  const { t } = useTranslation()
  const { formatDate } = useSettings()
  const [groups, setGroups] = useState<SharedGroup[]>([])
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [open, setOpen] = useState<SharedGroup | null>(null)
  const [records, setRecords] = useState<any>(null)
  const [recordsError, setRecordsError] = useState('')

  const load = useCallback(async () => {
    try { const res = await apiService.listNetworkSharedGroups(networkId); setGroups(res.data || []); setError('') }
    catch (err: any) { setError(userMessage(err, 'groupSharing.network.loadFailed')) }
  }, [networkId])
  useEffect(() => { void load() }, [load])

  const redeem = useSaveAction(async () => { await apiService.enrollGroupByCode(networkId, { code: code.trim() }) }, t('groupSharing.network.redeemFailed'))
  const onRedeem = async () => {
    setMessage('')
    if (await redeem.run()) { setCode(''); setMessage(t('groupSharing.network.added')); void load() }
  }

  const view = async (g: SharedGroup) => {
    setOpen(g); setRecords(null); setRecordsError('')
    try { const res = await apiService.getSharedGroupRecords(networkId, g.groupId); setRecords(res.data) }
    catch (err: any) { setRecordsError(userMessage(err, 'groupSharing.network.recordsFailed')) }
  }

  return (
    <section className="shared-groups" aria-label={t('groupSharing.network.title')}>
      <h3>{t('groupSharing.network.title')}</h3>
      <p className="share-hint">{t('groupSharing.network.explain')}</p>
      <div className="shared-groups-add">
        <label htmlFor="shared-group-code">{t('groupSharing.network.codeLabel')}</label>
        <input id="shared-group-code" className="an-field" value={code} autoCapitalize="characters" autoComplete="off"
          placeholder="XXXX-XXXX" onChange={e => setCode(e.target.value)} />
        <SaveState status={redeem.status} error={redeem.error} offline={redeem.offline} onRetry={redeem.retry} />
        <button type="button" className="btn btn-primary share-action" disabled={!code.trim() || redeem.status === 'saving'} onClick={onRedeem}>{t('groupSharing.network.add')}</button>
        {message && <p className="alert alert-success" role="status">{message}</p>}
      </div>

      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {groups.length === 0 && !error ? (
        <p className="share-hint">{t('groupSharing.network.none')}</p>
      ) : (
        <ul className="share-list">
          {groups.map(g => (
            <li key={g.id} className="share-row">
              <span className="share-row-name">{g.groupName}{g.farmName ? ` · ${g.farmName}` : ''}</span>
              <span className="share-row-meta">{typeof g.headCount === 'number' ? t('groupSharing.network.heads', { count: g.headCount }) + ' · ' : ''}{t('groupSharing.since', { date: formatDate(g.sharedSince) })}</span>
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => view(g)}>{t('groupSharing.network.view')}</button>
            </li>
          ))}
        </ul>
      )}

      <BottomSheet open={!!open} title={open?.groupName || ''} onClose={() => setOpen(null)}>
        {recordsError && <p className="alert alert-error" role="alert">{recordsError}</p>}
        {!records && !recordsError && <p>{t('common.loading')}</p>}
        {records && (
          <>
            <p className="share-hint">{t('groupSharing.network.cycleOnly')}</p>
            <h4>{t('groupSharing.scope.medicalRecords')} ({records.medicalRecords.length})</h4>
            <ul className="share-list">{records.medicalRecords.map((m: any) => <li key={m.id} className="share-row"><span className="share-row-name">{m.title}</span><span className="share-row-meta">{m.eventDate ? formatDate(m.eventDate) : formatDate(m.createdAt)}{m.headCountTreated != null ? ` · ${t('consultationRoom.group.treated', { count: m.headCountTreated })}` : ''}</span></li>)}</ul>
            <h4>{t('groupSharing.scope.vaccinationRecords')} ({records.vaccinations.length})</h4>
            <ul className="share-list">{records.vaccinations.map((v: any) => <li key={v.id} className="share-row"><span className="share-row-name">{v.vaccineName}</span><span className="share-row-meta">{formatDate(v.dateAdministered)}{v.headCountTreated != null ? ` · ${t('consultationRoom.group.treated', { count: v.headCountTreated })}` : ''}</span></li>)}</ul>
            <h4>{t('groupSharing.scope.prescriptions')} ({records.prescriptions.length})</h4>
            <ul className="share-list">{records.prescriptions.map((p: any) => <li key={p.id} className="share-row"><span className="share-row-name">{p.diagnosis || (p.medications || []).map((m: any) => m.name).join(', ') || '-'}</span><span className="share-row-meta">{formatDate(p.createdAt)}</span></li>)}</ul>
          </>
        )}
      </BottomSheet>
    </section>
  )
}

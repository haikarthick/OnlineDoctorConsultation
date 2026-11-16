import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import apiService from '../services/api'
import './ModulePage.css'
import { Enterprise } from '../types'
import { useAuth } from '../context/AuthContext'
import { useMasterData } from '../context/MasterDataContext'
import { useFarmRecordsEnabled } from '../hooks/useFarmRecordsEnabled'
import { resolveFarmProfile } from '../utils/farmProfile/resolveFarmProfile'
import { DateQuick, localIsoDate } from '../components/mobile/DateQuick'
import RecordEntrySheet from '../components/farmRecords/RecordEntrySheet'
import {
  recordableTypesFor, formatQuantity, totalsByType, type FarmRecord, type RecordSubject,
} from '../components/farmRecords/recordShared'

/**
 * Daily records: milk, eggs, feed, sample weights, water readings and deaths - one screen for the
 * whole farm, phone first. Every animal and group that has something to record today is a card;
 * tapping Record opens the one entry sheet. What a card offers is decided by the farm profile
 * (master data), never by a species name here.
 */
const FarmRecords: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { enabled, loading: flagLoading } = useFarmRecordsEnabled(!!user)
  const { farmMaster, farmMasterLoaded, recordTypeEntry, resolveLabel, speciesIcon, groupTypeLabel } = useMasterData()

  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [farmId, setFarmId] = useState('')
  const [date, setDate] = useState(() => localIsoDate())
  const [subjects, setSubjects] = useState<RecordSubject[]>([])
  const [counts, setCounts] = useState<Record<string, number | null>>({})
  const [records, setRecords] = useState<FarmRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [open, setOpen] = useState<{ subject: RecordSubject; type?: string } | null>(null)

  useEffect(() => {
    apiService.listEnterprises({ limit: 100 })
      .then((res: any) => {
        const items: Enterprise[] = res.data?.items || []
        setEnterprises(items)
        if (items.length === 1) setFarmId(items[0].id)
      })
      .catch(() => setEnterprises([]))
  }, [])

  const load = useCallback(async () => {
    if (!farmId) return
    setLoading(true); setError('')
    try {
      const [groupsRes, animalsRes, recordsRes] = await Promise.all([
        apiService.listAnimalGroups(farmId, { limit: 200 }),
        apiService.listEnterpriseAnimals(farmId, { limit: 200 }),
        apiService.listFarmRecords({ enterpriseId: farmId, from: date, to: date, limit: 500 }),
      ])
      const groups: any[] = groupsRes.data?.items || []
      const animals: any[] = animalsRes.data?.items || []
      const list: RecordSubject[] = [
        ...groups.map((g): RecordSubject => ({
          kind: 'group', id: g.id, name: g.name, enterpriseId: farmId, speciesCode: g.species || null, animalClass: null,
          gender: null, managementMode: g.managementMode || null, groupType: g.groupType || null,
          headCount: typeof g.currentCount === 'number' ? g.currentCount : null,
        })),
        // A sold or dead animal has nothing more to record.
        ...animals.filter(a => a.status !== 'sold' && a.status !== 'deceased').map((a): RecordSubject => ({
          kind: 'animal', id: a.id, name: a.name, enterpriseId: farmId, speciesCode: a.species || null,
          animalClass: a.animalClass || null, gender: a.gender || null, managementMode: 'individual', groupType: null,
        })),
      ]
      setSubjects(list)
      setCounts(Object.fromEntries(groups.map(g => [g.id, typeof g.currentCount === 'number' ? g.currentCount : null])))
      setRecords(recordsRes.data?.items || [])
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.response?.data?.message || t('farmRecords.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [farmId, date, t])

  useEffect(() => { void load() }, [load])

  // Only subjects with something to record today get a card: a bull or a pet has no daily records.
  const cards = useMemo(() => subjects
    .map(subject => {
      const profile = resolveFarmProfile(farmMaster, {
        speciesCode: subject.speciesCode, animalClass: subject.animalClass, gender: subject.gender,
        managementMode: subject.managementMode, groupType: subject.groupType,
      })
      return { subject, types: recordableTypesFor(profile, subject.kind, { emptyGroup: subject.headCount === 0 }) }
    })
    .filter(c => c.types.length > 0)
    // Herds and flocks first (one entry covers many animals), then single animals with the most to
    // record - a milking cow before a bull that only has feed - then by name.
    .sort((x, y) =>
      (x.subject.kind === y.subject.kind ? 0 : x.subject.kind === 'group' ? -1 : 1) ||
      y.types.length - x.types.length ||
      x.subject.name.localeCompare(y.subject.name)), [subjects, farmMaster])

  const recordsOf = (s: RecordSubject) => records.filter(r => (s.kind === 'animal' ? r.animalId === s.id : r.groupId === s.id))
  const totals = useMemo(() => totalsByType(records), [records])
  const labelFor = (code: string): string => {
    const e = recordTypeEntry(code)
    return e ? (resolveLabel(e, t) || code) : code
  }

  const onSaved = (result: any) => {
    setOpen(null)
    if (result?.ledger) {
      setMessage(t('farmRecords.deathsSaved', { count: Math.abs(result.quantity) }))
    } else if (typeof result?.currentCount === 'number') {
      // A head-count event: say what happened to the batch, then how many animals the group has now.
      const batch = result.cycleOpened ? `${t('farmRecords.batchStarted')} ` : result.cycleClosed ? `${t('farmRecords.batchClosed')} ` : ''
      setMessage(`${batch}${t('farmRecords.eventSaved', { count: result.currentCount })}`)
    } else if (result?.expectedDueDate) {
      setMessage(t('farmRecords.dueAbout', { date: new Date(result.expectedDueDate).toLocaleDateString() }))
    } else {
      setMessage(result?.replaced ? t('farmRecords.updated') : t('farmRecords.saved'))
    }
    void load()
  }

  if (flagLoading) return <div className="module-page"><div className="loading-spinner">{t('farmRecords.loading')}</div></div>
  if (!enabled) {
    return (
      <div className="module-page">
        <div className="empty-state">
          <div className="empty-icon">📝</div>
          <h3>{t('farmRecords.disabledTitle')}</h3>
          <p>{t('farmRecords.disabledBody')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <h1>{t('farmRecords.pageTitle')}</h1>
          <p className="subtitle">{t('farmRecords.subtitle')}</p>
        </div>
      </div>

      {message && <div className="alert alert-success" role="status">{message}</div>}
      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <div className="filters-bar">
        <select value={farmId} onChange={e => { setFarmId(e.target.value); setMessage('') }} className="search-input" aria-label={t('farmRecords.selectFarm')}>
          <option value="">{t('farmRecords.selectFarm')}</option>
          {enterprises.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
        </select>
      </div>

      {!farmId ? (
        <div className="empty-state">
          <div className="empty-icon">🏢</div>
          <h3>{t('farmRecords.pickFarmTitle')}</h3>
          <p>{t('farmRecords.pickFarmBody')}</p>
        </div>
      ) : (
        <>
          <DateQuick label={t('farmRecords.day')} value={date} onChange={d => { setDate(d); setMessage('') }} />

          {totals.length > 0 && (
            <div className="record-totals" aria-label={t('farmRecords.totalsLabel')}>
              {totals.map(x => (
                <span key={x.recordType} className="record-total">
                  <span aria-hidden="true">{recordTypeEntry(x.recordType)?.icon}</span> {labelFor(x.recordType)} <strong>{formatQuantity(x.total)}{x.unit ? ` ${x.unit}` : ''}</strong>
                </span>
              ))}
            </div>
          )}

          {loading || !farmMasterLoaded ? (
            <div className="loading-spinner">{t('farmRecords.loading')}</div>
          ) : cards.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🐾</div>
              <h3>{t('farmRecords.emptyTitle')}</h3>
              <p>{t('farmRecords.emptyBody')}</p>
              <button className="btn btn-primary" onClick={() => navigate('/animal-groups')}>{t('farmRecords.goHerds')}</button>
            </div>
          ) : (
            <div className="record-card-grid">
              {cards.map(({ subject, types }) => {
                const done = recordsOf(subject)
                const head = counts[subject.id]
                return (
                  <div key={`${subject.kind}:${subject.id}`} className="card record-card">
                    <div className="record-card-head">
                      <span className="record-card-icon" aria-hidden="true">{speciesIcon(subject.speciesCode || '')}</span>
                      <div className="record-card-title">
                        <strong>{subject.name}</strong>
                        <span className="record-card-sub">
                          {subject.kind === 'group'
                            ? [groupTypeLabel(subject.speciesCode, subject.groupType, t), typeof head === 'number' ? t('farmRecords.headCount', { count: head }) : ''].filter(Boolean).join(' · ')
                            : t('farmRecords.animalLabel')}
                        </span>
                      </div>
                    </div>

                    <div className="record-chips">
                      {done.length === 0
                        ? <span className="record-chip is-empty">{t('farmRecords.nothingYet')}</span>
                        : done.map(r => (
                          <span key={r.id} className="record-chip">
                            <span aria-hidden="true">{recordTypeEntry(r.recordType)?.icon}</span> {labelFor(r.recordType)}
                            {r.session !== 'day' ? ` ${t(`farmRecords.options.${r.session}`)}` : ''}{' '}
                            <strong>{r.quantity !== null ? `${formatQuantity(r.quantity)}${r.unit ? ` ${r.unit}` : ''}` : '✓'}</strong>
                          </span>
                        ))}
                    </div>

                    <div className="record-card-actions">
                      {types.slice(0, 3).map(r => (
                        <button key={r.code} type="button" className="btn btn-secondary record-quick" onClick={() => setOpen({ subject, type: r.code })}>
                          <span aria-hidden="true">{recordTypeEntry(r.code)?.icon}</span> {labelFor(r.code)}
                        </button>
                      ))}
                      {types.length > 3 && (
                        <button type="button" className="btn btn-secondary record-quick" onClick={() => setOpen({ subject })}>{t('farmRecords.more')}</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {open && (
        <RecordEntrySheet
          subject={open.subject}
          date={date}
          records={records}
          initialType={open.type}
          onClose={() => setOpen(null)}
          onSaved={onSaved}
        />
      )}
    </div>
  )
}

export default FarmRecords

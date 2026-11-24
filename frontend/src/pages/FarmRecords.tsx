import TreatmentsCard from '../components/treatments/TreatmentsCard'
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
import { FarmOutboxBanner } from '../components/farmRecords/FarmOutboxBanner'
import { useFarmOutbox } from '../hooks/useFarmOutbox'
import {
  recordableTypesFor, formatQuantity, totalsByType, dueTiming, farmWideTypes, isRecordOf, type DueItem, type FarmRecord, type RecordSubject,
} from '../components/farmRecords/recordShared'

import { userMessage } from '../utils/userMessage'

/** Three families of subject, each with its own colour: batches/flocks, herds, single animals. */
type CardKind = 'batch' | 'herd' | 'single'
const KIND_ORDER: CardKind[] = ['batch', 'herd', 'single']
const KIND_ICON: Record<CardKind, string> = { batch: '🐣', herd: '🐄', single: '🐾' }
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
  const [due, setDue] = useState<DueItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [open, setOpen] = useState<{ subject: RecordSubject; type?: string } | null>(null)
  const [view, setView] = useState<'all' | CardKind>('all')
  const [search, setSearch] = useState('')

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
      const [groupsRes, animalsRes, recordsRes, dueRes] = await Promise.all([
        apiService.listAnimalGroups(farmId, { limit: 200 }),
        apiService.listEnterpriseAnimals(farmId, { limit: 200 }),
        apiService.listFarmRecords({ enterpriseId: farmId, from: date, to: date, limit: 500 }),
        // The due list is a nicety: if it cannot load, the screen still works.
        apiService.farmRecordsDue(farmId).catch(() => ({ data: { items: [] } })),
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
      setDue(dueRes.data?.items || [])
    } catch (err: any) {
      setError(userMessage(err, 'farmRecords.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [farmId, date, t])

  useEffect(() => { void load() }, [load])

  // Entries saved with no signal wait on the phone; when some are sent the screen reloads.
  const outbox = useFarmOutbox(() => { setMessage(t('farmRecords.outbox.sent')); void load() })

  // Only subjects with something to record today get a card: a bull or a pet has no daily records.
  const cards = useMemo(() => subjects
    .map(subject => {
      const profile = resolveFarmProfile(farmMaster, {
        speciesCode: subject.speciesCode, animalClass: subject.animalClass, gender: subject.gender,
        managementMode: subject.managementMode, groupType: subject.groupType,
      })
      // Colour family comes from how the farm keeps records (master data), never from a species name.
      const kind: CardKind = subject.kind === 'animal' ? 'single' : profile.managementMode === 'batch' ? 'batch' : 'herd'
      return { subject, kind, types: recordableTypesFor(profile, subject.kind as 'animal' | 'group', { emptyGroup: subject.headCount === 0 }) }
    })
    .filter(c => c.types.length > 0)
    // Herds and flocks first (one entry covers many animals), then single animals with the most to
    // record - a milking cow before a bull that only has feed - then by name.
    .sort((x, y) =>
      (x.subject.kind === y.subject.kind ? 0 : x.subject.kind === 'group' ? -1 : 1) ||
      y.types.length - x.types.length ||
      x.subject.name.localeCompare(y.subject.name)), [subjects, farmMaster])

  const sections = useMemo(() => {
    const q = search.trim().toLowerCase()
    const visible = q ? cards.filter(c => c.subject.name.toLowerCase().includes(q)) : cards
    return KIND_ORDER
      .map(kind => {
        const list = visible.filter(c => c.kind === kind)
        const doneCount = list.filter(c => records.some(r => (c.subject.kind === 'animal' ? r.animalId === c.subject.id : r.groupId === c.subject.id))).length
        return { kind, list, doneCount }
      })
      .filter(s => s.list.length > 0)
  }, [cards, records, search])
  const shownSections = view === 'all' ? sections : sections.filter(s => s.kind === view)

  const recordsOf = (s: RecordSubject) => records.filter(r => isRecordOf(r, s))

  // "All my animals": feed given from one bag to everything on the farm - a small farm needs no groups to record it.
  const farmTypes = useMemo(() => farmWideTypes(farmMaster.recordTypes, code => recordTypeEntry(code)?.fields || []), [farmMaster.recordTypes, recordTypeEntry])
  const wholeFarm: RecordSubject | null = farmId && subjects.length > 0 && farmTypes.length > 0 ? {
    kind: 'farm', id: farmId, name: t('farmRecords.allAnimals'), enterpriseId: farmId, speciesCode: null, animalClass: null,
    gender: null, managementMode: null, groupType: null,
  } : null
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
    } else if (Array.isArray(result?.newborns) && result.newborns.length > 0) {
      setMessage(t('farmRecords.newbornsAdded', { count: result.newborns.length }))
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

      <FarmOutboxBanner items={outbox.items} waiting={outbox.waiting} onSendNow={() => { void outbox.flush() }} onDiscard={outbox.discard} onRetry={outbox.retry} />
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

          {due.length > 0 && (
            <section className="record-due" aria-label={t('farmRecords.due.title')}>
              <h2 className="record-due-title">{t('farmRecords.due.title')}</h2>
              <ul className="record-due-list">
                {due.slice(0, 8).map(item => {
                  const when = dueTiming(item.inDays)
                  const text = t(`farmRecords.due.${item.kind}`, {
                    name: item.name,
                    detail: item.kind === 'withdrawal_ending' ? t(`farmRecords.due.${item.detail}`) : item.detail,
                  })
                  const subject = item.kind === 'birth_expected' ? subjects.find(x => x.kind === 'animal' && x.id === item.animalId) : undefined
                  const row = (
                    <>
                      <span className={`record-due-when ${item.inDays < 0 ? 'is-overdue' : ''}`}>{when.key === 'today' ? t('farmRecords.due.today') : t(`farmRecords.due.${when.key}`, { count: when.count })}</span>
                      <span className="record-due-text">{text}</span>
                    </>
                  )
                  return (
                    <li key={`${item.kind}:${item.animalId || item.groupId}:${item.detail}`}>
                      {subject
                        ? <button type="button" className="record-due-row" onClick={() => setOpen({ subject, type: 'birth' })}>{row}</button>
                        : <div className="record-due-row">{row}</div>}
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          <TreatmentsCard farmId={farmId} subjects={subjects} />

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
            <>
              <div className="record-kind-tabs" role="group" aria-label={t('farmRecords.kinds.label')}>
                <button type="button" className={`record-kind-tab ${view === 'all' ? 'is-selected' : ''}`} aria-pressed={view === 'all'} onClick={() => setView('all')}>
                  <span className="record-kind-tab-name">{t('farmRecords.kinds.all')}</span>
                  <span className="record-kind-tab-count">{cards.length}</span>
                </button>
                {KIND_ORDER.filter(k => cards.some(c => c.kind === k)).map(k => {
                  const all = cards.filter(c => c.kind === k)
                  const done = all.filter(c => recordsOf(c.subject).length > 0).length
                  return (
                    <button key={k} type="button" className={`record-kind-tab is-${k} ${view === k ? 'is-selected' : ''}`} aria-pressed={view === k} onClick={() => setView(k)}>
                      <span className="record-kind-tab-name"><span aria-hidden="true">{KIND_ICON[k]}</span> {t(`farmRecords.kinds.${k}`)}</span>
                      <span className="record-kind-tab-count">{t('farmRecords.kinds.progress', { done, total: all.length })}</span>
                    </button>
                  )
                })}
              </div>

              {cards.length > 8 && (
                <input type="search" className="search-input record-search" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder={t('farmRecords.kinds.search')} aria-label={t('farmRecords.kinds.search')} />
              )}

              {wholeFarm && view === 'all' && !search.trim() && (
                <div className={`card record-card is-farm ${recordsOf(wholeFarm).length > 0 ? 'is-done' : ''}`}>
                  <div className="record-card-head">
                    <span className="record-card-icon" aria-hidden="true">🏡</span>
                    <div className="record-card-title">
                      <strong>{t('farmRecords.allAnimals')}</strong>
                      <span className="record-card-sub">{t('farmRecords.allAnimalsHint')}</span>
                    </div>
                  </div>
                  <div className="record-chips">
                    {recordsOf(wholeFarm).length === 0
                      ? <span className="record-chip is-empty">{t('farmRecords.nothingYet')}</span>
                      : recordsOf(wholeFarm).map(r => (
                        <span key={r.id} className="record-chip">
                          <span aria-hidden="true">{recordTypeEntry(r.recordType)?.icon}</span> {labelFor(r.recordType)}{' '}
                          <strong>{r.quantity !== null ? `${formatQuantity(r.quantity)}${r.unit ? ` ${r.unit}` : ''}` : '✓'}</strong>
                        </span>
                      ))}
                  </div>
                  <div className="record-card-actions">
                    {farmTypes.map(r => (
                      <button key={r.code} type="button" className="btn btn-secondary record-quick" onClick={() => setOpen({ subject: wholeFarm, type: r.code })}>
                        <span aria-hidden="true">{recordTypeEntry(r.code)?.icon}</span> {labelFor(r.code)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {shownSections.length === 0 && <p className="record-note">{t('farmRecords.kinds.noMatch')}</p>}

              {shownSections.map(section => (
              <section key={section.kind} className={`record-kind-section is-${section.kind}`} aria-label={t(`farmRecords.kinds.${section.kind}`)}>
                <header className="record-kind-head">
                  <h2 className="record-kind-title"><span aria-hidden="true">{KIND_ICON[section.kind]}</span> {t(`farmRecords.kinds.${section.kind}`)}</h2>
                  <span className="record-kind-hint">{t(`farmRecords.kinds.${section.kind}Hint`)}</span>
                  <span className="record-kind-progress">{t('farmRecords.kinds.progress', { done: section.doneCount, total: section.list.length })}</span>
                </header>
            <div className="record-card-grid">
              {section.list.map(({ subject, types }) => {
                const done = recordsOf(subject)
                const head = counts[subject.id]
                return (
                  <div key={`${subject.kind}:${subject.id}`} className={`card record-card is-${section.kind} ${done.length > 0 ? 'is-done' : ''}`}>
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
              </section>
              ))}
            </>
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
          onQueued={() => { setOpen(null); setMessage(t('farmRecords.outbox.queued')) }}
        />
      )}
    </div>
  )
}

export default FarmRecords

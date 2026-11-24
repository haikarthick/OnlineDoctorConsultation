import WithdrawalBanner from '../treatments/WithdrawalBanner'
import { sendWithWithdrawalConfirm } from '../../utils/withdrawal'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { useMasterData } from '../../context/MasterDataContext'
import { useFarmProfile } from '../../hooks/useFarmProfile'
import { useSaveAction } from '../../hooks/useSaveAction'
import { useFarmOutbox } from '../../hooks/useFarmOutbox'
import { BottomSheet } from '../mobile/BottomSheet'
import { ChipSelect } from '../mobile/ChipSelect'
import { NumberStepper } from '../mobile/NumberStepper'
import { SaveState } from '../mobile/SaveState'
import { useNutritionEnabled } from '../../hooks/useNutritionEnabled'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import {
  buildEventPayload, buildRecordPayload, recordableTypesFor, defaultSession, findExisting, firstMissingField, formatQuantity, formatRange,
  initialValues, isWholeNumberField, stepFor, visibleFields, farmWideTypes, usesStock,
  type FarmRecord, type FieldValues, type RecordSubject,
} from './recordShared'

/** A feed in the farm's stock, as the feed picker shows it (backend FeedInventoryService.mapFeed). */
interface StockFeed { id: string; feedName: string; unit: string; currentStock: number; stockKg: number | null; costPerKg: number | null; ingredientId: string | null }

/** The farm's stock list, kept on the phone so feed can be recorded with no signal (the outbox sends it later). */
const stockCacheKey = (farmId: string) => `farmFeedStock:${farmId}`
function readStockCache(farmId: string): StockFeed[] {
  try { return JSON.parse(localStorage.getItem(stockCacheKey(farmId)) || '[]') } catch { return [] }
}
function writeStockCache(farmId: string, items: StockFeed[]): void {
  try { localStorage.setItem(stockCacheKey(farmId), JSON.stringify(items)) } catch { /* storage full or blocked: the list still works online */ }
}

interface RecordEntrySheetProps {
  subject: RecordSubject
  /** The day being recorded (YYYY-MM-DD). */
  date: string
  /** What is already recorded for that day, so a second entry says it will correct the first. */
  records: FarmRecord[]
  /** Open on this record type (the tile the farmer tapped); defaults to the first that applies. */
  initialType?: string
  onClose: () => void
  /** Called after a successful save with the API result; the screen refreshes and closes the sheet. */
  onSaved: (result: any) => void
  /** Called when the entry was kept on the phone to be sent later (no signal). */
  onQueued?: () => void
}

/**
 * The one entry sheet for every daily record: milk for a cow, eggs for a flock, deaths, sample
 * weight, water readings. What it offers and asks for is decided by master data (the farm profile
 * says which record types apply, the record type says which fields), so there is no per-species or
 * per-record code here. Saving the same entry again corrects it - a double tap cannot duplicate.
 */
export const RecordEntrySheet: React.FC<RecordEntrySheetProps> = ({ subject, date, records, initialType, onClose, onSaved, onQueued }) => {
  const { t } = useTranslation()
  const { recordTypeEntry, resolveLabel, farmMaster } = useMasterData()
  const { user } = useAuth()
  const { formatCurrency } = useSettings()
  const { enabled: nutritionOn } = useNutritionEnabled(!!user)
  const { profile } = useFarmProfile({
    speciesCode: subject.speciesCode, animalClass: subject.animalClass, gender: subject.gender,
    managementMode: subject.managementMode, groupType: subject.groupType,
  })

  const emptyGroup = subject.kind === 'group' && subject.headCount === 0
  const types = useMemo(() => (subject.kind === 'farm'
    ? farmWideTypes(farmMaster.recordTypes, code => recordTypeEntry(code)?.fields || [])
    : recordableTypesFor(profile, subject.kind, { emptyGroup })), [profile, subject.kind, emptyGroup, farmMaster.recordTypes, recordTypeEntry])
  const [typeCode, setTypeCode] = useState<string>(initialType && types.some(x => x.code === initialType) ? initialType : (types[0]?.code || ''))
  const entry = typeCode ? recordTypeEntry(typeCode) : undefined
  const fields = useMemo(() => visibleFields(entry?.fields || []), [entry])
  const unit = entry?.unit || null
  // A head-count event (place flock, cull, sale, harvest) is written through the population ledger.
  const isEvent = entry?.kind === 'event'

  const [values, setValues] = useState<FieldValues>(() => initialValues(entry?.fields || [], defaultSession()))
  // A different record type asks for different fields: start that form fresh.
  useEffect(() => { setValues(initialValues(fields, defaultSession())) }, [typeCode]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = (key: string, v: string) => setValues(prev => ({ ...prev, [key]: v }))

  // A birth can also add the newborn(s) to the farm as animals (the farmer's choice, on by default).
  const [addNewborns, setAddNewborns] = useState(true)
  const [calves, setCalves] = useState<Array<{ name: string; gender: string }>>([])
  const liveBirths = typeCode === 'birth' ? Math.min(Math.max(Math.round(Number((values.liveBirths || '0').replace(',', '.')) || 0), 0), 10) : 0
  const calfRows = Array.from({ length: liveBirths }, (_, i) => calves[i] || { name: '', gender: 'unknown' })
  const setCalf = (i: number, patch: Partial<{ name: string; gender: string }>) =>
    setCalves(prev => Array.from({ length: Math.max(prev.length, i + 1) }, (_, k) => (k === i ? { ...(prev[k] || { name: '', gender: 'unknown' }), ...patch } : (prev[k] || { name: '', gender: 'unknown' }))))

  const [last, setLast] = useState<{ quantity: number; date: string; feedId: string | null } | null>(null)
  const session = values.session
  const stockField = usesStock(fields)
  const existing = typeCode && !isEvent ? findExisting(records, subject, typeCode, date, session, stockField ? (values.feedId || null) : undefined) : undefined

  // Feed: which stock item. The list is the farm's own stock (cached for no-signal days); empty = home-grown fodder.
  const [stock, setStock] = useState<StockFeed[]>(() => readStockCache(subject.enterpriseId))
  useEffect(() => {
    if (!stockField) return
    let active = true
    apiService.listFeeds(subject.enterpriseId)
      .then((res: any) => {
        const items: StockFeed[] = (res?.data?.items || []).map((f: any) => ({
          id: f.id, feedName: f.feedName, unit: f.unit, currentStock: f.currentStock, stockKg: f.stockKg, costPerKg: f.costPerKg, ingredientId: f.ingredientId,
        }))
        if (active) { setStock(items); writeStockCache(subject.enterpriseId, items) }
      })
      .catch(() => { /* offline: the cached list stays */ })
    return () => { active = false }
  }, [stockField, subject.enterpriseId])
  const chosenFeed = stock.find(f => f.id === values.feedId) || null

  // Today's suggested amount from the nutrition engine (feeding table, herd ration or the animal's ration) - shown and
  // one tap away, never filled in silently.
  const [suggested, setSuggested] = useState<number | null>(null)
  // Medicated feed the vet prescribed that is still running for this animal or herd (shown beside the feed entry).
  const [feedCourses, setFeedCourses] = useState<Array<{ medicine: string; dosage: string | null; startedOn: string; daysLeft: number }>>([])
  useEffect(() => {
    setFeedCourses([])
    if (!stockField || subject.kind === 'farm') return
    let active = true
    apiService.feedCourses(subject.kind === 'group' ? { groupId: subject.id } : { animalId: subject.id })
      .then((res: any) => { if (active) setFeedCourses(res?.data || []) }).catch(() => { /* optional hint */ })
    return () => { active = false }
  }, [stockField, subject.kind, subject.id])
  useEffect(() => {
    setSuggested(null)
    if (!stockField || !nutritionOn || subject.kind === 'farm') return
    let active = true
    const lineFor = (plan: any, perHerd: boolean): number | null => {
      if (!plan?.items?.length) return null
      const match = chosenFeed?.ingredientId ? plan.items.find((i: any) => i.ingredientId === chosenFeed.ingredientId) : null
      if (match) return perHerd && plan.ration?.herd ? (plan.ration.herd.lines.find((l: any) => l.key === match.ingredientId)?.kgAsFedPerDay ?? null) : match.amountPerDay
      return null
    }
    const ask = subject.kind === 'group'
      ? apiService.groupFeeding(subject.id).then(async (res: any) => {
        const d = res?.data
        if (d?.status === 'ok' && d.today?.status === 'ok') return d.today.kgPerDay as number
        if (d?.status === 'herd_ration') return lineFor((await apiService.groupRation(subject.id))?.data?.plan, true)
        return null
      })
      : apiService.nutritionOverview(subject.id).then((res: any) => lineFor(res?.data?.plan, false))
    ask.then(v => { if (active) setSuggested(typeof v === 'number' && v > 0 ? Math.round(v * 10) / 10 : null) }).catch(() => { /* optional hint */ })
    return () => { active = false }
  }, [stockField, nutritionOn, subject.kind, subject.id, chosenFeed?.ingredientId]) // eslint-disable-line react-hooks/exhaustive-deps

  // "Last time" - the figure from the most recent earlier day, one tap away.
  useEffect(() => {
    let active = true
    setLast(null)
    if (!typeCode || isEvent) return
    apiService.listFarmRecords({
      ...(subject.kind === 'animal' ? { animalId: subject.id } : subject.kind === 'group' ? { groupId: subject.id } : { enterpriseId: subject.enterpriseId, wholeFarm: true }),
      recordType: typeCode, limit: 30,
    }).then((res: any) => {
      if (!active) return
      const items: FarmRecord[] = res?.data?.items || []
      const prev = items.find(r => r.recordDate < date && r.quantity !== null && (!session || r.session === session || r.session === 'day'))
      setLast(prev && prev.quantity !== null ? { quantity: prev.quantity, date: prev.recordDate, feedId: prev.feedId || null } : null)
      // The feed used last time is the likely one today - one tap fewer.
      if (prev?.feedId) setValues(v => (v.feedId === undefined ? { ...v, feedId: prev.feedId as string } : v))
    }).catch(() => { /* the hint is optional */ })
    return () => { active = false }
  }, [subject.kind, subject.id, typeCode, date, session, isEvent])

  // useSaveAction reports only success or failure; the screen also needs what the server answered
  // (a death entry says how many are left), so the response is kept here.
  const answer = useRef<any>(null)
  const save = useSaveAction(
    async (payload: Record<string, unknown>) => {
      // A sale, death or milk / egg entry for an animal under a withdrawal asks first (the server warns, the person confirms).
      const res = await sendWithWithdrawalConfirm(confirmWithdrawal => ('eventType' in payload
        ? apiService.saveGroupEvent((confirmWithdrawal ? { ...payload, confirmWithdrawal } : payload) as any)
        : apiService.saveFarmRecord((confirmWithdrawal ? { ...payload, confirmWithdrawal } : payload) as any)), t)
      answer.current = res?.data ?? null
      return res
    },
    t('farmRecords.saveFailed'),
  )

  const missing = firstMissingField(fields, values)
  // A feed taken from stock cannot use more than is in the store - said before saving, not after.
  const overStock = !!chosenFeed && chosenFeed.stockKg !== null && Number((values.quantity || '0').replace(',', '.')) > chosenFeed.stockKg + (existing?.feedId === chosenFeed.id ? (existing.quantity || 0) : 0)
  const labelOf = (key: string): string => {
    if (key === 'quantity' && entry) return resolveLabel(entry, t) || key
    return t(`farmRecords.fields.${key}`, { defaultValue: key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()) })
  }

  const submit = async () => {
    if (!typeCode || missing) return
    const payload = (isEvent ? buildEventPayload : buildRecordPayload)(subject, typeCode, fields, values, date)
    if (typeCode === 'birth' && addNewborns && liveBirths > 0) payload.offspring = calfRows.map(c => ({ name: c.name.trim(), gender: c.gender }))
    const ok = await save.run(payload)
    if (ok) onSaved({ ...(answer.current || {}), recordType: typeCode })
  }

  // No signal: keep the entry on this phone and send it when the connection is back.
  const outbox = useFarmOutbox()
  const saveForLater = () => {
    if (!typeCode) return
    const payload = (isEvent ? buildEventPayload : buildRecordPayload)(subject, typeCode, fields, values, date)
    if (typeCode === 'birth' && addNewborns && liveBirths > 0) payload.offspring = calfRows.map(c => ({ name: c.name.trim(), gender: c.gender }))
    const entry = recordTypeEntry(typeCode)
    outbox.add({ kind: isEvent ? 'event' : 'record', payload, label: `${subject.name} - ${entry ? (resolveLabel(entry, t) || typeCode) : typeCode}` })
    onQueued?.()
  }

  const typeOptions = types.map(r => {
    const e = recordTypeEntry(r.code)
    return { value: r.code, label: e ? (resolveLabel(e, t) || r.code) : r.code, icon: e?.icon || undefined }
  })

  return (
    <BottomSheet open title={t('farmRecords.sheetTitle', { name: subject.kind === 'farm' ? t('farmRecords.allAnimals') : subject.name })} onClose={onClose}>
      <div className="record-sheet">
        {subject.kind !== 'farm' && <WithdrawalBanner {...(subject.kind === 'group' ? { groupId: subject.id } : { animalId: subject.id })} />}
        {feedCourses.map(c => (
          <p key={`${c.medicine}:${c.startedOn}`} className="record-note">💊 {t('withdrawal.feedCourse', { name: c.medicine, dosage: c.dosage || '', count: c.daysLeft })}</p>
        ))}
        {types.length === 0 ? (
          <p className="record-note">{t('farmRecords.nothingToRecord')}</p>
        ) : (
          <>
            {types.length > 1 && (
              <ChipSelect label={t('farmRecords.whatToRecord')} options={typeOptions} value={typeCode} onChange={code => { save.reset(); setTypeCode(code) }} />
            )}

            {fields.map(f => {
              if (f.type === 'stock') {
                const HOME = 'home'
                return (
                  <div key={f.key} className="record-stock-field">
                    <ChipSelect
                      label={t('farmRecords.fields.feedId')}
                      value={values.feedId ? values.feedId : HOME}
                      options={[
                        ...stock.map(s => ({ value: s.id, label: `${s.feedName} (${formatQuantity(s.currentStock)} ${s.unit})` })),
                        { value: HOME, label: t('farmRecords.homeGrown') },
                      ]}
                      onChange={v => set('feedId', v === HOME ? '' : v)}
                    />
                    {stock.length === 0 && <p className="record-note">{t('farmRecords.noStockYet')}</p>}
                  </div>
                )
              }
              if (f.type === 'choice') {
                return (
                  <ChipSelect
                    key={f.key}
                    label={t(`farmRecords.fields.${f.key}`, { defaultValue: labelOf(f.key) })}
                    variant="segmented"
                    value={values[f.key] || ''}
                    options={(f.options || []).map(o => ({ value: o, label: t(`farmRecords.options.${o}`, { defaultValue: o }) }))}
                    onChange={v => set(f.key, v)}
                  />
                )
              }
              if (f.type === 'number') {
                const range = f.key === 'quantity' ? null : formatRange(profile.waterQualityRanges?.[f.key])
                const qty = Number((values.quantity || '').replace(',', '.'))
                const hint = f.key === 'quantity'
                  ? [
                    suggested !== null ? t('farmRecords.suggestedToday', { value: `${formatQuantity(suggested)}${unit ? ` ${unit}` : ''}` }) : '',
                    last ? t('farmRecords.lastTime', { value: `${formatQuantity(last.quantity)}${unit ? ` ${unit}` : ''}` }) : '',
                    chosenFeed?.costPerKg && qty > 0 ? t('farmRecords.feedCost', { cost: formatCurrency(Math.round(qty * chosenFeed.costPerKg)) }) : '',
                  ].filter(Boolean).join(' · ') || undefined
                  : range ? t('farmRecords.usualRange', { range }) : undefined
                const quick = f.key === 'quantity' ? [suggested, last?.quantity ?? null].filter((v, i, a): v is number => v !== null && a.indexOf(v) === i) : []
                return (
                  <NumberStepper
                    key={f.key}
                    label={labelOf(f.key)}
                    value={values[f.key] || ''}
                    onChange={v => set(f.key, v)}
                    step={stepFor(f, unit)}
                    min={0}
                    unit={f.unit || (f.key === 'quantity' ? (unit || undefined) : undefined)}
                    integer={isWholeNumberField(f, unit)}
                    quickValues={quick.length ? quick : undefined}
                    hint={hint}
                  />
                )
              }
              return (
                <label key={f.key} className="record-text-field">
                  <span>{labelOf(f.key)}</span>
                  <input className="form-input" type="text" maxLength={500} value={values[f.key] || ''} onChange={e => set(f.key, e.target.value)} />
                </label>
              )
            })}

            {typeCode === 'birth' && liveBirths > 0 && (
              <div className="newborn-section">
                <label className="newborn-toggle">
                  <input type="checkbox" checked={addNewborns} onChange={e => setAddNewborns(e.target.checked)} />
                  <span>{t('farmRecords.newborn.add', { count: liveBirths })}</span>
                </label>
                {addNewborns && calfRows.map((c, i) => (
                  <div key={i} className="newborn-row">
                    <input
                      className="form-input" type="text" maxLength={100} value={c.name} onChange={e => setCalf(i, { name: e.target.value })}
                      placeholder={t('farmRecords.newborn.name', { n: i + 1 })} aria-label={t('farmRecords.newborn.name', { n: i + 1 })}
                    />
                    <ChipSelect
                      label={t('farmRecords.newborn.sex')} variant="segmented" value={c.gender}
                      options={[{ value: 'female', label: t('farmRecords.newborn.female') }, { value: 'male', label: t('farmRecords.newborn.male') }, { value: 'unknown', label: t('farmRecords.newborn.unknown') }]}
                      onChange={v => setCalf(i, { gender: v })}
                    />
                  </div>
                ))}
              </div>
            )}

            {existing && existing.quantity !== null && (
              <p className="record-note is-update" role="status">
                {t('farmRecords.alreadyRecorded', { value: `${formatQuantity(existing.quantity)}${unit ? ` ${unit}` : ''}` })}
              </p>
            )}
            {missing && <p className="record-note" role="status">{t('farmRecords.needsField', { field: labelOf(missing) })}</p>}
            {overStock && chosenFeed && <p className="record-note is-update" role="status">{t('farmRecords.moreThanStock', { kg: formatQuantity(chosenFeed.stockKg as number), feed: chosenFeed.feedName })}</p>}
          </>
        )}

        <SaveState status={save.status} error={save.error} offline={save.offline} onRetry={save.retry} />
        {save.status === 'failed' && save.offline && onQueued && (
          <button type="button" className="btn btn-secondary" onClick={saveForLater}>📤 {t('farmRecords.outbox.saveLater')}</button>
        )}

        <div className="record-sheet-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel', { defaultValue: 'Cancel' })}</button>
          <button type="button" className="btn btn-primary" disabled={!typeCode || !!missing || save.status === 'saving'} onClick={submit}>
            {existing ? t('farmRecords.update') : t('farmRecords.save')}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}

export default RecordEntrySheet

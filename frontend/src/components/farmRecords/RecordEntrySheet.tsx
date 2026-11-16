import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { useMasterData } from '../../context/MasterDataContext'
import { useFarmProfile } from '../../hooks/useFarmProfile'
import { useSaveAction } from '../../hooks/useSaveAction'
import { BottomSheet } from '../mobile/BottomSheet'
import { ChipSelect } from '../mobile/ChipSelect'
import { NumberStepper } from '../mobile/NumberStepper'
import { SaveState } from '../mobile/SaveState'
import {
  buildEventPayload, buildRecordPayload, recordableTypesFor, defaultSession, findExisting, firstMissingField, formatQuantity, formatRange,
  initialValues, isWholeNumberField, stepFor, visibleFields,
  type FarmRecord, type FieldValues, type RecordSubject,
} from './recordShared'

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
}

/**
 * The one entry sheet for every daily record: milk for a cow, eggs for a flock, deaths, sample
 * weight, water readings. What it offers and asks for is decided by master data (the farm profile
 * says which record types apply, the record type says which fields), so there is no per-species or
 * per-record code here. Saving the same entry again corrects it - a double tap cannot duplicate.
 */
export const RecordEntrySheet: React.FC<RecordEntrySheetProps> = ({ subject, date, records, initialType, onClose, onSaved }) => {
  const { t } = useTranslation()
  const { recordTypeEntry, resolveLabel } = useMasterData()
  const { profile } = useFarmProfile({
    speciesCode: subject.speciesCode, animalClass: subject.animalClass, gender: subject.gender,
    managementMode: subject.managementMode, groupType: subject.groupType,
  })

  const emptyGroup = subject.kind === 'group' && subject.headCount === 0
  const types = useMemo(() => recordableTypesFor(profile, subject.kind, { emptyGroup }), [profile, subject.kind, emptyGroup])
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

  const [last, setLast] = useState<{ quantity: number; date: string } | null>(null)
  const session = values.session
  const existing = typeCode && !isEvent ? findExisting(records, subject, typeCode, date, session) : undefined

  // "Last time" - the figure from the most recent earlier day, one tap away.
  useEffect(() => {
    let active = true
    setLast(null)
    if (!typeCode || isEvent) return
    apiService.listFarmRecords({
      ...(subject.kind === 'animal' ? { animalId: subject.id } : { groupId: subject.id }), recordType: typeCode, limit: 30,
    }).then((res: any) => {
      if (!active) return
      const items: FarmRecord[] = res?.data?.items || []
      const prev = items.find(r => r.recordDate < date && r.quantity !== null && (!session || r.session === session || r.session === 'day'))
      setLast(prev && prev.quantity !== null ? { quantity: prev.quantity, date: prev.recordDate } : null)
    }).catch(() => { /* the hint is optional */ })
    return () => { active = false }
  }, [subject.kind, subject.id, typeCode, date, session, isEvent])

  // useSaveAction reports only success or failure; the screen also needs what the server answered
  // (a death entry says how many are left), so the response is kept here.
  const answer = useRef<any>(null)
  const save = useSaveAction(
    async (payload: Record<string, unknown>) => {
      const res = 'eventType' in payload ? await apiService.saveGroupEvent(payload as any) : await apiService.saveFarmRecord(payload as any)
      answer.current = res?.data ?? null
      return res
    },
    t('farmRecords.saveFailed'),
  )

  const missing = firstMissingField(fields, values)
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

  const typeOptions = types.map(r => {
    const e = recordTypeEntry(r.code)
    return { value: r.code, label: e ? (resolveLabel(e, t) || r.code) : r.code, icon: e?.icon || undefined }
  })

  return (
    <BottomSheet open title={t('farmRecords.sheetTitle', { name: subject.name })} onClose={onClose}>
      <div className="record-sheet">
        {types.length === 0 ? (
          <p className="record-note">{t('farmRecords.nothingToRecord')}</p>
        ) : (
          <>
            {types.length > 1 && (
              <ChipSelect label={t('farmRecords.whatToRecord')} options={typeOptions} value={typeCode} onChange={code => { save.reset(); setTypeCode(code) }} />
            )}

            {fields.map(f => {
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
                const hint = f.key === 'quantity' && last
                  ? t('farmRecords.lastTime', { value: `${formatQuantity(last.quantity)}${unit ? ` ${unit}` : ''}` })
                  : range ? t('farmRecords.usualRange', { range }) : undefined
                return (
                  <NumberStepper
                    key={f.key}
                    label={labelOf(f.key)}
                    value={values[f.key] || ''}
                    onChange={v => set(f.key, v)}
                    step={stepFor(f, unit)}
                    min={0}
                    unit={f.key === 'quantity' ? (unit || undefined) : undefined}
                    integer={isWholeNumberField(f, unit)}
                    quickValues={f.key === 'quantity' && last ? [last.quantity] : undefined}
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
          </>
        )}

        <SaveState status={save.status} error={save.error} offline={save.offline} onRetry={save.retry} />

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

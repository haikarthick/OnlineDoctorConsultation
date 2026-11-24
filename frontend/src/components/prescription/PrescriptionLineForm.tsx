import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChipSelect } from '../mobile/ChipSelect'
import type { PrescriptionLine } from '../../utils/withdrawal'

export interface RecentLine {
  name: string; kind: string; dosage: string; frequency: string
  treatmentDays: number | null; withdrawalMilkDays: number | null; withdrawalMeatDays: number | null
}

interface Props {
  /** A food-producing animal or herd: the label's treatment days and milk / egg and meat withdrawal days are required. */
  foodProducing: boolean
  /** The vet's OWN recent medicines (their data, never a list from the platform). */
  recent: RecentLine[]
  /** A line to start from, e.g. one from the consultation link. */
  start?: Partial<PrescriptionLine> | null
  onAdd: (line: PrescriptionLine) => void
}

const KINDS = ['medicine', 'medicated_feed', 'diet', 'supplement'] as const
const empty = (): PrescriptionLine => ({ name: '', dosage: '', frequency: '', duration: '', instructions: '', kind: 'medicine' })
const num = (v: string): number | undefined => (v.trim() === '' || !/^\d+$/.test(v.trim()) ? undefined : Number(v.trim()))

/**
 * One medicine, diet, supplement or medicated-feed line on a prescription. The platform lists no medicine and suggests no
 * dose: the vet types the product and, for a food-producing animal, the label's treatment days and withdrawal days (or
 * "none"). Their own recent medicines fill the form in one tap, label days included.
 */
export const PrescriptionLineForm: React.FC<Props> = ({ foodProducing, recent, start, onAdd }) => {
  const { t } = useTranslation()
  const [line, setLine] = useState<PrescriptionLine>(() => ({ ...empty(), ...(start || {}) }))
  const [days, setDays] = useState(start?.treatmentDays ? String(start.treatmentDays) : '')
  const [milk, setMilk] = useState(start?.withdrawalMilkDays !== undefined ? String(start.withdrawalMilkDays) : '')
  const [meat, setMeat] = useState(start?.withdrawalMeatDays !== undefined ? String(start.withdrawalMeatDays) : '')
  const [none, setNone] = useState(!!start?.withdrawalNone)
  const [error, setError] = useState('')

  const kind = line.kind || 'medicine'
  const needsLabel = foodProducing && (kind === 'medicine' || kind === 'medicated_feed')
  const names = useMemo(() => recent.map(r => r.name), [recent])

  const fillFrom = (r: RecentLine) => {
    setLine(l => ({ ...l, name: r.name, kind: (r.kind as PrescriptionLine['kind']) || 'medicine', dosage: r.dosage, frequency: r.frequency }))
    setDays(r.treatmentDays ? String(r.treatmentDays) : '')
    const sawLabel = r.withdrawalMilkDays !== null && r.withdrawalMeatDays !== null
    setMilk(r.withdrawalMilkDays !== null ? String(r.withdrawalMilkDays) : '')
    setMeat(r.withdrawalMeatDays !== null ? String(r.withdrawalMeatDays) : '')
    setNone(sawLabel && r.withdrawalMilkDays === 0 && r.withdrawalMeatDays === 0)
    setError('')
  }

  // Typing a name the vet used before fills the rest.
  const onName = (value: string) => {
    setLine(l => ({ ...l, name: value }))
    const hit = recent.find(r => r.name.toLowerCase() === value.trim().toLowerCase())
    if (hit && !line.dosage && !line.frequency) fillFrom(hit)
  }

  const add = () => {
    if (!line.name.trim() || !line.dosage.trim() || !line.frequency.trim()) { setError(t('prescriptionWriter.errorNameDosageFrequency')); return }
    const out: PrescriptionLine = { ...line, name: line.name.trim() }
    const d = num(days)
    if (d) { out.treatmentDays = d; out.duration = out.duration || t('withdrawal.daysText', { count: d }) }
    if (needsLabel) {
      if (!d) { setError(t('withdrawal.errorDays')); return }
      if (none) { out.withdrawalNone = true; out.withdrawalMilkDays = 0; out.withdrawalMeatDays = 0 }
      else {
        const m = num(milk); const e = num(meat)
        if (m === undefined || e === undefined) { setError(t('withdrawal.errorWithdrawal')); return }
        out.withdrawalMilkDays = m; out.withdrawalMeatDays = e
      }
    }
    onAdd(out)
    setLine(empty()); setDays(''); setMilk(''); setMeat(''); setNone(false); setError('')
  }

  return (
    <div className="wd-line-form">
      {recent.length > 0 && (
        <div className="wd-recent">
          <p className="wd-hint">{t('withdrawal.recentTitle')}</p>
          <div className="wd-chips">
            {recent.slice(0, 8).map(r => (
              <button key={r.name} type="button" className="btn btn-outline btn-sm" onClick={() => fillFrom(r)}>+ {r.name}</button>
            ))}
          </div>
        </div>
      )}
      <ChipSelect label={t('withdrawal.kindLabel')} value={kind} onChange={v => setLine(l => ({ ...l, kind: v as PrescriptionLine['kind'] }))}
        options={KINDS.map(k => ({ value: k, label: t(`withdrawal.kind.${k}`) }))} />
      <div className="form-group">
        <input className="form-input" list="wd-recent-names" placeholder={t('prescriptionWriter.medicationName')} value={line.name} onChange={e => onName(e.target.value)} />
        <datalist id="wd-recent-names">{names.map(n => <option key={n} value={n} />)}</datalist>
      </div>
      <div className="wd-two">
        <input className="form-input" placeholder={t('prescriptionWriter.dosage')} value={line.dosage} onChange={e => setLine(l => ({ ...l, dosage: e.target.value }))} />
        <input className="form-input" placeholder={t('prescriptionWriter.frequency')} value={line.frequency} onChange={e => setLine(l => ({ ...l, frequency: e.target.value }))} />
      </div>
      <div className="wd-two">
        <label className="wd-field">
          <span>{t('withdrawal.treatmentDays')}</span>
          <input className="form-input" inputMode="numeric" value={days} onChange={e => setDays(e.target.value.replace(/\D/g, '').slice(0, 3))} />
        </label>
        <input className="form-input" placeholder={t('prescriptionWriter.instructions')} value={line.instructions || ''} onChange={e => setLine(l => ({ ...l, instructions: e.target.value }))} />
      </div>
      {needsLabel && (
        <fieldset className="wd-label-box">
          <legend>{t('withdrawal.fromLabel')}</legend>
          <p className="wd-hint">{t('withdrawal.labelHint')}</p>
          <div className="wd-two">
            <label className="wd-field">
              <span>{t('withdrawal.milkDays')}</span>
              <input className="form-input" inputMode="numeric" disabled={none} value={none ? '0' : milk} onChange={e => setMilk(e.target.value.replace(/\D/g, '').slice(0, 3))} />
            </label>
            <label className="wd-field">
              <span>{t('withdrawal.meatDays')}</span>
              <input className="form-input" inputMode="numeric" disabled={none} value={none ? '0' : meat} onChange={e => setMeat(e.target.value.replace(/\D/g, '').slice(0, 3))} />
            </label>
          </div>
          <label className="wd-none">
            <input type="checkbox" checked={none} onChange={e => setNone(e.target.checked)} /> {t('withdrawal.none')}
          </label>
        </fieldset>
      )}
      {error && <p className="wd-error" role="alert">{error}</p>}
      <button type="button" className="btn btn-outline" onClick={add}>+ {t('prescriptionWriter.addMedication')}</button>
    </div>
  )
}

export default PrescriptionLineForm

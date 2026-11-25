import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { BottomSheet } from '../mobile/BottomSheet'
import { DateQuick, localIsoDate } from '../mobile/DateQuick'
import { userMessage } from '../../utils/userMessage'
import type { PassportAnimal, PassportDose } from './vaccinationPassportShared'
import './VaccinePlanPanel.css'

interface Protocol { id: string; name: string; disease?: string }
interface ScheduleRow { id: string; protocolId: string; protocolName?: string; doseNumber: number; dueDate: string; status: string }
interface Props {
  animal: PassportAnimal
  /** Called after anything was saved so the passport reloads. */
  onChanged: () => void
}

/**
 * The vaccination PLAN of one animal: add a plan from the protocol list (the server then builds the dose dates) and give a due dose.
 * Giving a dose writes ONE vaccination entry and links the schedule row to it in the same action, so the passport's counts and the
 * animal's vaccination history can never disagree. A person who is not allowed to reach this animal is refused by the server in plain words.
 */
export function VaccinePlanPanel({ animal, onChanged }: Props) {
  const { t } = useTranslation()
  const [protocols, setProtocols] = useState<Protocol[]>([])
  const [choice, setChoice] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const [giving, setGiving] = useState<{ dose: PassportDose; protocolName: string } | null>(null)
  const [date, setDate] = useState(localIsoDate())
  const [batch, setBatch] = useState('')

  const [schedule, setSchedule] = useState<ScheduleRow[]>([])
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set(animal.protocols.map(p => p.protocolId)))
  const [reload, setReload] = useState(0)

  // The plan's own lists come from the plan endpoints, so they are right the moment something is saved.
  useEffect(() => {
    let live = true
    Promise.all([apiService.getAnimalVaccineSchedule(animal.animalId), apiService.getAnimalVaccineAssignments(animal.animalId)])
      .then(([s, a]) => {
        if (!live) return
        setSchedule(Array.isArray(s?.data) ? s.data : [])
        const rows: Array<{ protocolId?: string; protocol_id?: string }> = Array.isArray(a?.data) ? a.data : []
        setAssignedIds(new Set(rows.map(r => String(r.protocolId ?? r.protocol_id)).filter(Boolean)))
      })
      .catch(() => { /* the passport below still shows what is saved */ })
    return () => { live = false }
  }, [animal.animalId, reload])
  const openDoses = schedule
    .filter(r => r.status === 'pending' || r.status === 'overdue')
    .map(r => ({ dose: { scheduleId: r.id, doseNumber: r.doseNumber, dueDate: r.dueDate, administeredAt: null, status: r.status as PassportDose['status'], reminderSent: false, vaccinationRecordId: null }, protocolName: r.protocolName || '' }))
  const assigned = assignedIds
  useEffect(() => {
    let live = true
    apiService.listVaccineProtocols({ species: animal.species })
      .then(res => { if (live) setProtocols(Array.isArray(res?.data) ? res.data : []) })
      .catch(() => { if (live) setProtocols([]) })
    return () => { live = false }
  }, [animal.species])
  const choices = protocols.filter(p => !assigned.has(p.id))

  const run = async (fn: () => Promise<unknown>, okText: string) => {
    if (busy) return
    setBusy(true); setMessage(null)
    try { await fn(); setMessage({ text: okText, ok: true }); setReload(n => n + 1); onChanged() }
    catch (e) { setMessage({ text: userMessage(e, 'vaccinePlan.saveFailed'), ok: false }) }
    finally { setBusy(false) }
  }

  const addPlan = () => run(async () => { await apiService.assignVaccineProtocol(animal.animalId, { protocolId: choice }); setChoice('') }, t('vaccinePlan.planAdded'))

  const giveDose = () => {
    if (!giving) return
    const { dose, protocolName } = giving
    return run(async () => {
      const created = await apiService.createVaccination({ animalId: animal.animalId, vaccineName: protocolName, dateAdministered: date, batchNumber: batch.trim() || undefined })
      const recordId = created?.data?.id
      if (!recordId) throw new Error('no record')
      await apiService.markVaccineDoseAdministered(dose.scheduleId, { vaccinationRecordId: recordId, administeredAt: date })
      setGiving(null); setBatch('')
    }, t('vaccinePlan.doseSaved'))
  }

  return (
    <div className="vp-plan-panel">
      <h4>{t('vaccinePlan.title')}</h4>
      {message && <div className={message.ok ? 'vp-plan-ok' : 'vp-plan-error'} role={message.ok ? 'status' : 'alert'}>{message.text}</div>}

      {openDoses.length > 0 && (
        <ul className="vp-plan-doses">
          {openDoses.map(({ dose, protocolName }) => (
            <li key={dose.scheduleId}>
              <span>{protocolName} · {t('vaccinationPassport.dose')} #{dose.doseNumber}</span>
              <button type="button" className="module-btn primary" disabled={busy} onClick={() => { setGiving({ dose, protocolName }); setDate(localIsoDate()) }}>{t('vaccinePlan.giveDose')}</button>
            </li>
          ))}
        </ul>
      )}

      <div className="vp-plan-add">
        <label htmlFor={`vp-plan-${animal.animalId}`}>{t('vaccinePlan.addLabel')}</label>
        {choices.length === 0 ? <p className="vp-plan-muted">{t('vaccinePlan.nothingToAdd')}</p> : (
          <div className="vp-plan-row">
            <select id={`vp-plan-${animal.animalId}`} value={choice} onChange={e => setChoice(e.target.value)}>
              <option value="">{t('vaccinePlan.choose')}</option>
              {choices.map(p => <option key={p.id} value={p.id}>{p.name}{p.disease ? ` (${p.disease})` : ''}</option>)}
            </select>
            <button type="button" className="module-btn primary" disabled={busy || !choice} onClick={addPlan}>{t('vaccinePlan.add')}</button>
          </div>
        )}
      </div>

      <BottomSheet open={!!giving} title={t('vaccinePlan.giveTitle', { name: animal.animalName })} onClose={() => setGiving(null)}>
        {giving && (
          <div className="vp-plan-sheet">
            <p><strong>{giving.protocolName}</strong> · {t('vaccinationPassport.dose')} #{giving.dose.doseNumber}</p>
            <DateQuick label={t('vaccinePlan.dateGiven')} value={date} onChange={setDate} />
            <label>{t('vaccinePlan.batchNumber')}
              <input value={batch} onChange={e => setBatch(e.target.value)} autoComplete="off" />
            </label>
            <div className="record-sheet-actions">
              <button type="button" className="module-btn" onClick={() => setGiving(null)}>{t('common.cancel')}</button>
              <button type="button" className="module-btn primary" disabled={busy || !date} onClick={giveDose}>{busy ? t('vaccinePlan.saving') : t('vaccinePlan.saveDose')}</button>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  )
}

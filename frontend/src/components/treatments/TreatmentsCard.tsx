import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { BottomSheet } from '../mobile/BottomSheet'
import { DateQuick, localIsoDate } from '../mobile/DateQuick'
import { userMessage } from '../../utils/userMessage'
import type { RecordSubject } from '../farmRecords/recordShared'
import { shortDate } from './WithdrawalBanner'

interface UnderRow { animalId: string | null; groupId: string | null; name: string; what: 'milk' | 'meat'; until: string; inDays: number; medicine: string; source: 'prescription' | 'self'; sourceId: string }
interface HistoryRow { source: 'prescription' | 'self'; sourceId: string; medicine: string; kind: string; startedOn: string; lastDose: string; milkUntil: string | null; meatUntil: string | null; name: string; treatmentDays: number }

interface Props {
  farmId: string
  /** Every animal and herd of the farm (the picker for "I treated an animal myself"). */
  subjects: RecordSubject[]
}

/**
 * "Medicines and withdrawal" on the Daily records screen: what is held back now (with a one-tap correction when the
 * course stopped early), the farm's treatment history built from the vet's prescriptions, and a short entry for a farmer who
 * treated without a vet. Nothing is typed twice: the vet's prescription already carries the medicine and the label days.
 */
export const TreatmentsCard: React.FC<Props> = ({ farmId, subjects }) => {
  const { t, i18n } = useTranslation()
  const [under, setUnder] = useState<UnderRow[]>([])
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [fix, setFix] = useState<UnderRow | null>(null)
  const [fixDate, setFixDate] = useState(localIsoDate())
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState(false)

  const load = useCallback(() => {
    apiService.farmTreatments(farmId)
      .then((res: any) => { setUnder(res?.data?.underWithdrawal || []); setHistory(res?.data?.history || []); setLoadError(false); setLoaded(true) })
      .catch(() => { setUnder([]); setHistory([]); setLoadError(true); setLoaded(true) })
  }, [farmId])
  useEffect(() => { setLoaded(false); load() }, [load])

  const saveFix = async (lastDoseOn: string | null) => {
    if (!fix) return
    setBusy(true); setError('')
    try {
      if (fix.source === 'prescription') await apiService.correctTreatmentCourse(fix.sourceId, lastDoseOn)
      else await apiService.correctSelfTreatmentCourse(fix.sourceId, lastDoseOn)
      setFix(null); load()
    } catch (err) { setError(userMessage(err, 'withdrawal.saveFailed')) } finally { setBusy(false) }
  }

  if (!loaded || (under.length === 0 && history.length === 0 && subjects.length === 0)) return null
  const date = (iso: string) => shortDate(iso, i18n.language)

  return (
    <section className="wd-card" aria-label={t('withdrawal.cardTitle')}>
      <div className="wd-card-head">
        <h2 className="wd-card-title">💊 {t('withdrawal.cardTitle')}</h2>
        {subjects.length > 0 && (
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => { setAdding(true); setError('') }}>{t('withdrawal.treatedMyself')}</button>
        )}
      </div>

      {loadError && <p className="wd-error" role="alert">{t('withdrawal.loadFailed')}</p>}
      <h3 className="wd-sub">{t('withdrawal.underTitle')}</h3>
      {loadError ? null : under.length === 0 ? <p className="wd-hint">{t('withdrawal.nothingNow')}</p> : (
        <ul className="wd-list">
          {under.map(u => (
            <li key={`${u.sourceId}:${u.what}:${u.animalId || u.groupId}`} className="wd-row">
              <div>
                <strong>{u.name}</strong>
                <p>{t(u.what === 'milk' ? 'withdrawal.holdMilk' : 'withdrawal.holdMeat', { date: date(u.until) })}</p>
                <p className="wd-hint">{t('withdrawal.because', { medicine: u.medicine })}</p>
              </div>
              <button type="button" className="btn btn-sm btn-outline" onClick={() => { setFix(u); setFixDate(localIsoDate()); setError('') }}>{t('withdrawal.stoppedEarly')}</button>
            </li>
          ))}
        </ul>
      )}

      {history.length > 0 && (
        <>
          <h3 className="wd-sub">{t('withdrawal.historyTitle')}</h3>
          <ul className="wd-list">
            {history.slice(0, 10).map(h => (
              <li key={`${h.source}:${h.sourceId}:${h.medicine}:${h.name}`} className="wd-row">
                <div>
                  <strong>{h.medicine}</strong> <span className="wd-hint">- {h.name}</span>
                  <p className="wd-hint">
                    {t('withdrawal.course', { count: h.treatmentDays, date: date(h.startedOn) })} · {t(h.source === 'prescription' ? 'withdrawal.byVet' : 'withdrawal.byYou')}
                    {h.milkUntil ? ` · ${t('withdrawal.milkThrough', { date: date(h.milkUntil) })}` : ''}
                    {h.meatUntil ? ` · ${t('withdrawal.meatThrough', { date: date(h.meatUntil) })}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <BottomSheet open={!!fix} title={t('withdrawal.fixTitle')} onClose={() => setFix(null)}>
        <p className="wd-hint">{t('withdrawal.fixHint', { medicine: fix?.medicine || '', name: fix?.name || '' })}</p>
        <DateQuick label={t('withdrawal.lastDoseOn')} value={fixDate} onChange={setFixDate} />
        {error && <p className="wd-error" role="alert">{error}</p>}
        <button type="button" className="btn btn-primary nutri-wide-btn" disabled={busy} onClick={() => void saveFix(fixDate)}>{t('withdrawal.save')}</button>
        <button type="button" className="btn btn-outline nutri-wide-btn" disabled={busy} onClick={() => void saveFix(null)}>{t('withdrawal.backAsPrescribed')}</button>
      </BottomSheet>

      {adding && <SelfTreatmentSheet farmId={farmId} subjects={subjects} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load() }} />}
    </section>
  )
}

/** A farmer who treated without a vet: the medicine as written on the label, the days, and the label's withdrawal days. */
const SelfTreatmentSheet: React.FC<{ farmId: string; subjects: RecordSubject[]; onClose: () => void; onSaved: () => void }> = ({ farmId, subjects, onClose, onSaved }) => {
  const { t } = useTranslation()
  const [subjectKey, setSubjectKey] = useState('')
  const [name, setName] = useState('')
  const [days, setDays] = useState('')
  const [milk, setMilk] = useState('')
  const [meat, setMeat] = useState('')
  const [none, setNone] = useState(false)
  const [started, setStarted] = useState(localIsoDate())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 3)

  const save = async () => {
    const subject = subjects.find(s => `${s.kind}:${s.id}` === subjectKey)
    if (!subject) { setError(t('withdrawal.errorSubject')); return }
    if (!name.trim()) { setError(t('withdrawal.errorName')); return }
    if (!days || Number(days) < 1) { setError(t('withdrawal.errorDays')); return }
    if (!none && (milk === '' || meat === '')) { setError(t('withdrawal.errorWithdrawal')); return }
    setBusy(true); setError('')
    try {
      await apiService.addSelfTreatment(farmId, {
        ...(subject.kind === 'group' ? { groupId: subject.id } : { animalId: subject.id }),
        medicineName: name.trim(), treatmentDays: Number(days),
        withdrawalMilkDays: none ? 0 : Number(milk), withdrawalMeatDays: none ? 0 : Number(meat), startedOn: started,
      })
      onSaved()
    } catch (err) { setError(userMessage(err, 'withdrawal.saveFailed')) } finally { setBusy(false) }
  }

  return (
    <BottomSheet open title={t('withdrawal.selfTitle')} onClose={onClose}>
      <p className="wd-hint">{t('withdrawal.selfHint')}</p>
      <label className="wd-field"><span>{t('withdrawal.selfWho')}</span>
        <select className="form-input" value={subjectKey} onChange={e => setSubjectKey(e.target.value)}>
          <option value="">{t('withdrawal.choose')}</option>
          {subjects.map(s => <option key={`${s.kind}:${s.id}`} value={`${s.kind}:${s.id}`}>{s.name}</option>)}
        </select>
      </label>
      <label className="wd-field"><span>{t('withdrawal.medicineName')}</span>
        <input className="form-input" value={name} maxLength={255} onChange={e => setName(e.target.value)} />
      </label>
      <DateQuick label={t('withdrawal.startedOn')} value={started} onChange={setStarted} />
      <label className="wd-field"><span>{t('withdrawal.treatmentDays')}</span>
        <input className="form-input" inputMode="numeric" value={days} onChange={e => setDays(digits(e.target.value))} />
      </label>
      <fieldset className="wd-label-box">
        <legend>{t('withdrawal.fromLabel')}</legend>
        <div className="wd-two">
          <label className="wd-field"><span>{t('withdrawal.milkDays')}</span>
            <input className="form-input" inputMode="numeric" disabled={none} value={none ? '0' : milk} onChange={e => setMilk(digits(e.target.value))} />
          </label>
          <label className="wd-field"><span>{t('withdrawal.meatDays')}</span>
            <input className="form-input" inputMode="numeric" disabled={none} value={none ? '0' : meat} onChange={e => setMeat(digits(e.target.value))} />
          </label>
        </div>
        <label className="wd-none"><input type="checkbox" checked={none} onChange={e => setNone(e.target.checked)} /> {t('withdrawal.none')}</label>
      </fieldset>
      {error && <p className="wd-error" role="alert">{error}</p>}
      <button type="button" className="btn btn-primary nutri-wide-btn" disabled={busy} onClick={() => void save()}>{t('withdrawal.save')}</button>
    </BottomSheet>
  )
}

export default TreatmentsCard

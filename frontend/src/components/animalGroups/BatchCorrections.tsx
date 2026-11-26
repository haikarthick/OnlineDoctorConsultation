import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { NumberStepper, parseStepperValue } from '../mobile/NumberStepper'
import { ChipSelect } from '../mobile/ChipSelect'
import { codedMessage } from '../../utils/codedMessage'
import '../mobile/ownerTools.css'

interface Props {
  groupId: string
  enterpriseId?: string
  species?: string
  breed?: string
  /** The running batch: its id and how many the app thinks are in it now. */
  cycleId: string
  currentCount: number
  /** Called after a change was saved, with the sentence to tell the person. */
  onDone: (message: string) => void
}

type Gender = 'male' | 'female' | 'unknown'

/**
 * The two things a farmer can do to a running batch besides what Daily records covers: "Correct the count" (they recounted and the number
 * is different - the correction is written to the ledger WITH a reason, never as a silent overwrite) and "Keep one as an individual animal"
 * (one bird, fish or calf is taken out of the lot and given its own record). Deaths and sales are NOT entered here - Daily records is the
 * only place for those, so a head is never counted twice.
 */
export function BatchCorrections({ groupId, enterpriseId, species, breed, cycleId, currentCount, onDone }: Props) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<'none' | 'correct' | 'keep'>('none')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [realText, setRealText] = useState('')
  const [reason, setReason] = useState('')
  const [name, setName] = useState('')
  const [gender, setGender] = useState<Gender>('unknown')

  const real = parseStepperValue(realText)
  const delta = real === null ? 0 : real - currentCount
  const open = (m: 'correct' | 'keep') => { setMode(m); setError(''); setRealText(String(currentCount)); setReason(''); setName(''); setGender('unknown') }

  const saveCorrection = async () => {
    if (busy || real === null || delta === 0 || !reason.trim()) return
    setBusy(true); setError('')
    try {
      await apiService.recordPopulationEvent(groupId, { cycleId, eventType: 'adjustment', quantity: delta, reason: reason.trim() })
      setMode('none')
      onDone(t('batchCorrections.corrected', { count: real }))
    } catch (err) { setError(codedMessage(err, 'batchCorrections', 'batchCorrections.failed')) }
    finally { setBusy(false) }
  }

  const keepOne = async () => {
    if (busy || !name.trim() || !species || !enterpriseId) return
    setBusy(true); setError('')
    let createdId = ''
    try {
      const created = await apiService.createAnimal({ name: name.trim(), species, breed: breed || undefined, gender, enterpriseId })
      createdId = created?.data?.id || ''
      if (!createdId) throw new Error('no id')
      await apiService.promoteAnimalFromBatch(groupId, { animalId: createdId, cycleId, reason: t('batchCorrections.keepReason', { name: name.trim() }) })
      setMode('none')
      onDone(t('batchCorrections.kept', { name: name.trim() }))
    } catch (err) {
      // The animal record was made first; if taking it out of the count failed, remove it again so nothing is left half done.
      if (createdId) await apiService.deleteAnimal(createdId).catch(() => undefined)
      setError(codedMessage(err, 'batchCorrections', 'batchCorrections.failed'))
    } finally { setBusy(false) }
  }

  return (
    <div className="ot-sheet">
      {mode === 'none' && (
        <div className="ot-actions">
          <button type="button" className="module-btn" onClick={() => open('correct')}>{t('batchCorrections.correct')}</button>
          {species && enterpriseId && currentCount > 0 && <button type="button" className="module-btn" onClick={() => open('keep')}>{t('batchCorrections.keep')}</button>}
        </div>
      )}

      {mode === 'correct' && (
        <div className="ot-form">
          <p className="ot-muted">{t('batchCorrections.correctHint', { count: currentCount })}</p>
          <NumberStepper label={t('batchCorrections.realCount')} value={realText} min={0} integer onChange={setRealText} />
          {real !== null && delta !== 0 && <p className="ot-note">{delta > 0 ? t('batchCorrections.moreBy', { count: delta }) : t('batchCorrections.fewerBy', { count: -delta })}</p>}
          <label>{t('batchCorrections.reasonLabel')}
            <input value={reason} onChange={e => setReason(e.target.value)} autoComplete="off" maxLength={200} placeholder={t('batchCorrections.reasonPlaceholder')} />
          </label>
          {error && <div className="ot-error" role="alert">{error}</div>}
          <div className="ot-actions">
            <button type="button" className="module-btn" onClick={() => setMode('none')}>{t('common.cancel')}</button>
            <button type="button" className="module-btn primary" disabled={busy || real === null || delta === 0 || !reason.trim()} onClick={saveCorrection}>{t('batchCorrections.saveCorrection')}</button>
          </div>
        </div>
      )}

      {mode === 'keep' && (
        <div className="ot-form">
          <p className="ot-muted">{t('batchCorrections.keepHint')}</p>
          <label>{t('batchCorrections.keepName')}
            <input value={name} onChange={e => setName(e.target.value)} autoComplete="off" maxLength={100} placeholder={t('batchCorrections.keepNamePlaceholder')} />
          </label>
          <ChipSelect<Gender> label={t('batchCorrections.gender')} value={gender} onChange={setGender} options={[
            { value: 'female', label: t('batchCorrections.female') }, { value: 'male', label: t('batchCorrections.male') }, { value: 'unknown', label: t('batchCorrections.unknown') },
          ]} />
          {error && <div className="ot-error" role="alert">{error}</div>}
          <div className="ot-actions">
            <button type="button" className="module-btn" onClick={() => setMode('none')}>{t('common.cancel')}</button>
            <button type="button" className="module-btn primary" disabled={busy || !name.trim()} onClick={keepOne}>{t('batchCorrections.keepSave')}</button>
          </div>
        </div>
      )}
    </div>
  )
}

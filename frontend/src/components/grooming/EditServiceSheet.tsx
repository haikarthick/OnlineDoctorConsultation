import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { BottomSheet } from '../mobile/BottomSheet'
import { ChipSelect } from '../mobile/ChipSelect'
import { codedMessage } from '../../utils/codedMessage'
import '../mobile/ownerTools.css'

export interface GroomingServiceRow {
  id: string
  name: string
  basePrice: number | string
  durationMinutes: number
  taxPercent: number | string
  paymentRule: 'full' | 'deposit'
  depositAmount?: number | string | null
  isPaused?: boolean
}

interface Props {
  providerId: string
  service: GroomingServiceRow | null
  onClose: () => void
  onSaved: () => void
}

/** The grooming provider's "edit this service" sheet: name, price, time, tax, how it is paid, and pausing it for new bookings. */
export function EditServiceSheet({ providerId, service, onClose, onSaved }: Props) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [minutes, setMinutes] = useState('')
  const [tax, setTax] = useState('')
  const [rule, setRule] = useState<'full' | 'deposit'>('full')
  const [deposit, setDeposit] = useState('')
  const [paused, setPaused] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!service) return
    setName(service.name); setPrice(String(service.basePrice)); setMinutes(String(service.durationMinutes)); setTax(String(service.taxPercent ?? 0))
    setRule(service.paymentRule === 'deposit' ? 'deposit' : 'full'); setDeposit(service.depositAmount != null ? String(service.depositAmount) : ''); setPaused(!!service.isPaused); setError('')
  }, [service])

  const valid = name.trim().length > 0 && Number(price) >= 0 && price !== '' && Number(minutes) > 0 && (rule === 'full' || Number(deposit) > 0)
  const save = async () => {
    if (!service || busy || !valid) return
    setBusy(true); setError('')
    try {
      await apiService.updateGroomingService(providerId, service.id, {
        name: name.trim(), basePrice: Number(price), durationMinutes: Math.round(Number(minutes)), taxPercent: Number(tax) || 0,
        paymentRule: rule, ...(rule === 'deposit' ? { depositAmount: Number(deposit) } : {}), isPaused: paused,
      })
      onSaved()
    } catch (err) { setError(codedMessage(err, 'groomingConsole', 'groomingConsole.saveFailed')) }
    finally { setBusy(false) }
  }

  return (
    <BottomSheet open={!!service} title={t('groomingConsole.editTitle')} onClose={onClose}>
      <div className="ot-form">
        <label>{t('grooming.serviceName')}
          <input value={name} maxLength={200} onChange={e => setName(e.target.value)} />
        </label>
        <label>{t('grooming.price')}
          <input type="number" inputMode="decimal" min={0} value={price} onChange={e => setPrice(e.target.value)} />
        </label>
        <label>{t('grooming.durationMin')}
          <input type="number" inputMode="numeric" min={1} max={1440} value={minutes} onChange={e => setMinutes(e.target.value)} />
        </label>
        <label>{t('grooming.taxPercent')}
          <input type="number" inputMode="decimal" min={0} max={100} value={tax} onChange={e => setTax(e.target.value)} />
        </label>
        <ChipSelect<'full' | 'deposit'> label={t('grooming.paymentRule')} value={rule} onChange={setRule} variant="segmented" options={[
          { value: 'full', label: t('grooming.payFull') }, { value: 'deposit', label: t('grooming.payDeposit') },
        ]} />
        {rule === 'deposit' && (
          <label>{t('groomingConsole.depositAmount')}
            <input type="number" inputMode="decimal" min={0} value={deposit} onChange={e => setDeposit(e.target.value)} />
          </label>
        )}
        <label className="ot-check">
          <input type="checkbox" checked={paused} onChange={e => setPaused(e.target.checked)} />
          <span>{t('groomingConsole.pause')}</span>
        </label>
        <p className="ot-muted">{t('groomingConsole.pauseHint')}</p>
        {error && <div className="ot-error" role="alert">{error}</div>}
        <div className="ot-actions">
          <button type="button" className="module-btn" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className="module-btn primary" disabled={busy || !valid} onClick={save}>{t('groomingConsole.save')}</button>
        </div>
      </div>
    </BottomSheet>
  )
}

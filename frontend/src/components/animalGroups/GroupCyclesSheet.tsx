import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { BottomSheet } from '../mobile/BottomSheet'
import { BatchCorrections } from './BatchCorrections'
import { DateQuick, localIsoDate } from '../mobile/DateQuick'
import { NumberStepper, parseStepperValue } from '../mobile/NumberStepper'
import { userMessage } from '../../utils/userMessage'
import { appLocale } from '../../utils/appLocale'
import './GroupCyclesSheet.css'

interface Cycle { id: string; cycleNumber: number; name?: string | null; placedCount: number; currentCount: number; startedAt: string; endedAt?: string | null; status: 'active' | 'closed' }
interface PopEvent { id: string; eventType: string; quantity: number; eventDate: string; reason?: string | null }
interface Reconcile { stored: number; fromLedger: number; reconciles: boolean; drift: number }

interface Props { open: boolean; groupId: string; groupName: string; enterpriseId?: string; species?: string; breed?: string; onClose: () => void; onChanged?: () => void }

const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(appLocale(), { day: 'numeric', month: 'short', year: 'numeric' }) : '')

/**
 * The batches (cycles) of one flock or herd run in batch mode: the running batch on top, start a new one, close it with the count that
 * must reconcile, and the read-only ledger of every head that came in or went out. Deaths and sales are still entered in Daily records;
 * this screen only reads them, so a head is never counted twice.
 */
export function GroupCyclesSheet({ open, groupId, groupName, enterpriseId, species, breed, onClose, onChanged }: Props) {
  const { t } = useTranslation()
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [active, setActive] = useState<Cycle | null>(null)
  const [events, setEvents] = useState<PopEvent[]>([])
  const [rec, setRec] = useState<Reconcile | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [starting, setStarting] = useState(false)
  const [closing, setClosing] = useState(false)
  const [name, setName] = useState('')
  const [placedText, setPlacedText] = useState('')
  const placed = parseStepperValue(placedText) ?? 0
  const [startedAt, setStartedAt] = useState(localIsoDate())
  const [reason, setReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [c, a, e, r] = await Promise.all([apiService.listGroupCycles(groupId), apiService.getActiveGroupCycle(groupId), apiService.listPopulationEvents(groupId), apiService.reconcileGroup(groupId)])
      setCycles(Array.isArray(c?.data) ? c.data : [])
      setActive(a?.data && a.data.status === 'active' ? a.data : null)
      setEvents(Array.isArray(e?.data) ? e.data : [])
      setRec(r?.data || null)
    } catch (err) {
      setMessage({ text: userMessage(err, 'batchCycles.loadFailed'), ok: false })
    } finally { setLoading(false) }
  }, [groupId])

  useEffect(() => { if (open) { setMessage(null); setStarting(false); setClosing(false); void load() } }, [open, load])

  const past = cycles.filter(c => c.status === 'closed')

  const run = async (fn: () => Promise<unknown>, okText: string) => {
    if (busy) return
    setBusy(true); setMessage(null)
    try { await fn(); setMessage({ text: okText, ok: true }); setStarting(false); setClosing(false); await load(); onChanged?.() }
    catch (err) { setMessage({ text: userMessage(err, 'batchCycles.saveFailed'), ok: false }) }
    finally { setBusy(false) }
  }

  return (
    <BottomSheet open={open} title={t('batchCycles.title', { name: groupName })} onClose={onClose}>
      <div className="gc-sheet">
        {message && <div className={message.ok ? 'gc-ok' : 'gc-error'} role={message.ok ? 'status' : 'alert'}>{message.text}</div>}
        {loading && <p role="status">{t('batchCycles.loading')}</p>}

        {!loading && (
          <section className="gc-card" aria-label={t('batchCycles.active')}>
            <h4>{t('batchCycles.active')}</h4>
            {active ? (
              <>
                <strong>{active.name || t('batchCycles.batchN', { n: active.cycleNumber })}</strong>
                <div className="gc-muted">{t('batchCycles.startedOn', { date: day(active.startedAt) })} · {t('batchCycles.placed', { count: active.placedCount })} · {t('batchCycles.current', { count: active.currentCount })}</div>
                {rec && <div className={rec.reconciles ? 'gc-good' : 'gc-warn'}>{rec.reconciles ? t('batchCycles.reconcileOk', { count: rec.stored }) : t('batchCycles.reconcileOff', { stored: rec.stored, ledger: rec.fromLedger })}</div>}
                <p className="gc-muted">{t('batchCycles.mortalityHint')}</p>
                <BatchCorrections groupId={groupId} enterpriseId={enterpriseId} species={species} breed={breed} cycleId={active.id} currentCount={active.currentCount}
                  onDone={text => { setMessage({ text, ok: true }); void load(); onChanged?.() }} />
                {!closing
                  ? <button type="button" className="module-btn" onClick={() => { setClosing(true); setReason('') }}>{t('batchCycles.close')}</button>
                  : (
                    <div className="gc-form">
                      <p>{t('batchCycles.closeConfirm', { count: active.currentCount })}</p>
                      <label>{t('batchCycles.closeReason')}<input value={reason} onChange={e => setReason(e.target.value)} autoComplete="off" /></label>
                      <div className="record-sheet-actions">
                        <button type="button" className="module-btn" onClick={() => setClosing(false)}>{t('common.cancel')}</button>
                        <button type="button" className="module-btn primary" disabled={busy} onClick={() => run(() => apiService.closeGroupCycle(active.id, reason.trim() || undefined), t('batchCycles.closedMsg'))}>{t('batchCycles.closeNow')}</button>
                      </div>
                    </div>
                  )}
              </>
            ) : (
              <>
                <p className="gc-muted">{t('batchCycles.none')}</p>
                {!starting
                  ? <button type="button" className="module-btn primary" onClick={() => { setStarting(true); setName(''); setPlacedText(''); setStartedAt(localIsoDate()) }}>{t('batchCycles.start')}</button>
                  : (
                    <div className="gc-form">
                      <label>{t('batchCycles.nameLabel')}<input value={name} onChange={e => setName(e.target.value)} autoComplete="off" /></label>
                      <NumberStepper label={t('batchCycles.placedLabel')} value={placedText} min={0} integer onChange={setPlacedText} />
                      <DateQuick label={t('batchCycles.startDate')} value={startedAt} onChange={setStartedAt} />
                      <div className="record-sheet-actions">
                        <button type="button" className="module-btn" onClick={() => setStarting(false)}>{t('common.cancel')}</button>
                        <button type="button" className="module-btn primary" disabled={busy || placed < 1} onClick={() => run(() => apiService.openGroupCycle(groupId, { name: name.trim() || undefined, placedCount: placed, startedAt }), t('batchCycles.startedMsg'))}>{t('batchCycles.startNow')}</button>
                      </div>
                    </div>
                  )}
              </>
            )}
          </section>
        )}

        {!loading && past.length > 0 && (
          <section className="gc-card" aria-label={t('batchCycles.past')}>
            <h4>{t('batchCycles.past')}</h4>
            <ul className="gc-list">
              {past.map(c => (
                <li key={c.id}><strong>{c.name || t('batchCycles.batchN', { n: c.cycleNumber })}</strong> <span className="gc-muted">{day(c.startedAt)} – {day(c.endedAt)} · {t('batchCycles.placed', { count: c.placedCount })}</span></li>
              ))}
            </ul>
          </section>
        )}

        {!loading && (
          <section className="gc-card" aria-label={t('batchCycles.ledgerTitle')}>
            <h4>{t('batchCycles.ledgerTitle')}</h4>
            {events.length === 0 ? <p className="gc-muted">{t('batchCycles.ledgerEmpty')}</p> : (
              <ul className="gc-list">
                {events.map(ev => (
                  <li key={ev.id}>
                    <span className={ev.quantity < 0 ? 'gc-out' : 'gc-in'}>{ev.quantity > 0 ? `+${ev.quantity}` : ev.quantity}</span>{' '}
                    <strong>{t(`batchCycles.event.${ev.eventType}`, { defaultValue: ev.eventType })}</strong>{' '}
                    <span className="gc-muted">{day(ev.eventDate)}{ev.reason ? ` · ${ev.reason}` : ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </BottomSheet>
  )
}

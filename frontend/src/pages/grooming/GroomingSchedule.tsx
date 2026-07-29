import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import '../../styles/modules.css'

interface Props { onNavigate: (path: string) => void }

interface ScheduleRow {
  id?: string
  dayOfWeek: number
  openTime: string
  closeTime: string
  slotIntervalMinutes: number
  capacity: number
  isActive: boolean
}

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

/** A closed day is represented by isActive=false rather than a missing row, so the form is a
 *  stable seven-row grid the provider can toggle instead of add/remove. */
function emptyWeek(): ScheduleRow[] {
  return DAY_KEYS.map((_, i) => ({
    dayOfWeek: i, openTime: '09:00', closeTime: '18:00',
    slotIntervalMinutes: 30, capacity: 1, isActive: false,
  }))
}

const GroomingSchedule: React.FC<Props> = ({ onNavigate }) => {
  const { t } = useTranslation()
  const [providerId, setProviderId] = useState('')
  const [week, setWeek] = useState<ScheduleRow[]>(emptyWeek())
  const [overrides, setOverrides] = useState<any[]>([])
  const [blocks, setBlocks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [savingDay, setSavingDay] = useState<number | null>(null)

  const [ovrForm, setOvrForm] = useState({ overrideDate: '', overrideType: 'closed', openTime: '09:00', closeTime: '18:00', reason: '' })
  const [blockForm, setBlockForm] = useState({ isRecurring: true, recurringDay: 1, blockDate: '', startTime: '13:00', endTime: '14:00', reason: '' })

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2500) }

  const load = useCallback(async () => {
    try {
      setLoading(true); setErr('')
      const prov = (await apiService.getMyGroomingProvider()).data
      if (!prov) { setErr(t('groomingSchedule.noProvider')); setLoading(false); return }
      setProviderId(prov.id)

      const [sch, ovr, blk] = await Promise.all([
        apiService.listGroomingSchedules(prov.id),
        apiService.listGroomingDateOverrides(prov.id),
        apiService.listGroomingBlockedSlots(prov.id),
      ])
      const rows: ScheduleRow[] = Array.isArray(sch.data) ? sch.data : []
      const merged = emptyWeek()
      for (const r of rows) {
        if (r.dayOfWeek >= 0 && r.dayOfWeek <= 6) {
          merged[r.dayOfWeek] = {
            id: r.id, dayOfWeek: r.dayOfWeek,
            openTime: String(r.openTime).slice(0, 5), closeTime: String(r.closeTime).slice(0, 5),
            slotIntervalMinutes: Number(r.slotIntervalMinutes) || 30,
            capacity: Number(r.capacity) || 1,
            isActive: r.isActive !== false,
          }
        }
      }
      setWeek(merged)
      setOverrides(Array.isArray(ovr.data) ? ovr.data : [])
      setBlocks(Array.isArray(blk.data) ? blk.data : [])
    } catch (e: any) { setErr(e?.response?.data?.message || e.message) } finally { setLoading(false) }
  }, [t])
  useEffect(() => { load() }, [load])

  const patchDay = (day: number, patch: Partial<ScheduleRow>) =>
    setWeek(w => w.map(r => (r.dayOfWeek === day ? { ...r, ...patch } : r)))

  const saveDay = async (day: number) => {
    const row = week[day]
    if (row.closeTime <= row.openTime) { setErr(t('groomingSchedule.closeAfterOpen')); return }
    try {
      setSavingDay(day); setErr('')
      await apiService.saveGroomingSchedule(providerId, {
        dayOfWeek: day, openTime: row.openTime, closeTime: row.closeTime,
        slotIntervalMinutes: row.slotIntervalMinutes, capacity: row.capacity, isActive: row.isActive,
      })
      flash(t('groomingSchedule.saved'))
      await load()
    } catch (e: any) { setErr(e?.response?.data?.message || e.message) } finally { setSavingDay(null) }
  }

  const addOverride = async () => {
    if (!ovrForm.overrideDate) { setErr(t('groomingSchedule.pickDate')); return }
    try {
      setErr('')
      await apiService.saveGroomingDateOverride(providerId, {
        overrideDate: ovrForm.overrideDate,
        overrideType: ovrForm.overrideType,
        ...(ovrForm.overrideType === 'custom_hours'
          ? { openTime: ovrForm.openTime, closeTime: ovrForm.closeTime } : {}),
        reason: ovrForm.reason || undefined,
      })
      setOvrForm({ ...ovrForm, overrideDate: '', reason: '' })
      flash(t('groomingSchedule.saved'))
      await load()
    } catch (e: any) { setErr(e?.response?.data?.message || e.message) }
  }

  const addBlock = async () => {
    try {
      setErr('')
      await apiService.createGroomingBlockedSlot(providerId, {
        startTime: blockForm.startTime, endTime: blockForm.endTime,
        isRecurring: blockForm.isRecurring,
        ...(blockForm.isRecurring
          ? { recurringDay: Number(blockForm.recurringDay) }
          : { blockDate: blockForm.blockDate }),
        reason: blockForm.reason || undefined,
      })
      setBlockForm({ ...blockForm, reason: '', blockDate: '' })
      flash(t('groomingSchedule.saved'))
      await load()
    } catch (e: any) { setErr(e?.response?.data?.message || e.message) }
  }

  const removeOverride = async (id: string) => {
    try { await apiService.deleteGroomingDateOverride(providerId, id); await load() }
    catch (e: any) { setErr(e?.response?.data?.message || e.message) }
  }
  const removeBlock = async (id: string) => {
    try { await apiService.deleteGroomingBlockedSlot(providerId, id); await load() }
    catch (e: any) { setErr(e?.response?.data?.message || e.message) }
  }

  if (loading) return <div className="module-page"><div className="loading-container"><div className="loading-spinner" /></div></div>
  if (err && !providerId) return (
    <div className="module-page">
      <div className="module-alert error">{err}</div>
      <button className="module-btn" onClick={() => onNavigate('/grooming/provider')}>{t('groomingSchedule.goToProvider')}</button>
    </div>
  )

  return (
    <div className="module-page">
      <div className="module-header"><h1>🗓️ {t('groomingSchedule.title')}</h1></div>
      <p className="slot-hint">{t('groomingSchedule.subtitle')}</p>

      {err && <div className="module-alert error">{err}</div>}
      {msg && <div className="module-alert success">{msg}</div>}

      {/* ── Weekly working hours ── */}
      <div className="module-card">
        <h3>{t('groomingSchedule.weeklyHours')}</h3>
        <p className="slot-hint">{t('groomingSchedule.capacityHint')}</p>
        <div className="schedule-day-list">
          {week.map(row => (
            <div key={row.dayOfWeek} className={`schedule-day-row${row.isActive ? '' : ' is-closed'}`}>
              <label className="schedule-day-toggle">
                <input type="checkbox" checked={row.isActive}
                  onChange={e => patchDay(row.dayOfWeek, { isActive: e.target.checked })} />
                <span className="schedule-day-name">{t(`groomingSchedule.days.${DAY_KEYS[row.dayOfWeek]}`)}</span>
              </label>

              {row.isActive ? (
                <div className="schedule-day-fields">
                  <label>
                    <span className="field-caption">{t('groomingSchedule.open')}</span>
                    <input className="module-input" type="time" value={row.openTime}
                      onChange={e => patchDay(row.dayOfWeek, { openTime: e.target.value })} />
                  </label>
                  <label>
                    <span className="field-caption">{t('groomingSchedule.close')}</span>
                    <input className="module-input" type="time" value={row.closeTime}
                      onChange={e => patchDay(row.dayOfWeek, { closeTime: e.target.value })} />
                  </label>
                  <label>
                    <span className="field-caption">{t('groomingSchedule.every')}</span>
                    <select className="module-input" value={row.slotIntervalMinutes}
                      onChange={e => patchDay(row.dayOfWeek, { slotIntervalMinutes: Number(e.target.value) })}>
                      {[15, 20, 30, 45, 60, 90, 120].map(n => <option key={n} value={n}>{n} {t('groomingBook.minutes')}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="field-caption">{t('groomingSchedule.capacity')}</span>
                    <input className="module-input" type="number" min={1} max={100} value={row.capacity}
                      onChange={e => patchDay(row.dayOfWeek, { capacity: Number(e.target.value) })} />
                  </label>
                </div>
              ) : <span className="schedule-closed-label">{t('groomingSchedule.closed')}</span>}

              <button className="btn btn-sm btn-primary" disabled={savingDay === row.dayOfWeek}
                onClick={() => saveDay(row.dayOfWeek)}>
                {savingDay === row.dayOfWeek ? t('groomingSchedule.saving') : t('groomingSchedule.save')}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Date overrides ── */}
      <div className="module-card">
        <h3>{t('groomingSchedule.overridesTitle')}</h3>
        <p className="slot-hint">{t('groomingSchedule.overridesHint')}</p>
        <div className="inline-form-row">
          <label>
            <span className="field-caption">{t('groomingSchedule.date')}</span>
            <input className="module-input" type="date" value={ovrForm.overrideDate}
              onChange={e => setOvrForm({ ...ovrForm, overrideDate: e.target.value })} />
          </label>
          <label>
            <span className="field-caption">{t('groomingSchedule.type')}</span>
            <select className="module-input" value={ovrForm.overrideType}
              onChange={e => setOvrForm({ ...ovrForm, overrideType: e.target.value })}>
              <option value="closed">{t('groomingSchedule.closedAllDay')}</option>
              <option value="custom_hours">{t('groomingSchedule.customHours')}</option>
            </select>
          </label>
          {ovrForm.overrideType === 'custom_hours' && (
            <>
              <label>
                <span className="field-caption">{t('groomingSchedule.open')}</span>
                <input className="module-input" type="time" value={ovrForm.openTime}
                  onChange={e => setOvrForm({ ...ovrForm, openTime: e.target.value })} />
              </label>
              <label>
                <span className="field-caption">{t('groomingSchedule.close')}</span>
                <input className="module-input" type="time" value={ovrForm.closeTime}
                  onChange={e => setOvrForm({ ...ovrForm, closeTime: e.target.value })} />
              </label>
            </>
          )}
          <label className="inline-form-grow">
            <span className="field-caption">{t('groomingSchedule.reason')}</span>
            <input className="module-input" value={ovrForm.reason}
              placeholder={t('groomingSchedule.reasonPlaceholder')}
              onChange={e => setOvrForm({ ...ovrForm, reason: e.target.value })} />
          </label>
          <button className="btn btn-sm btn-primary" onClick={addOverride}>{t('groomingSchedule.add')}</button>
        </div>

        {overrides.length === 0 ? <p className="slot-hint">{t('groomingSchedule.noOverrides')}</p> : (
          <ul className="rule-list">
            {overrides.map(o => (
              <li key={o.id}>
                <span>
                  <strong>{String(o.overrideDate).slice(0, 10)}</strong> ·{' '}
                  {o.overrideType === 'closed'
                    ? t('groomingSchedule.closedAllDay')
                    : `${String(o.openTime).slice(0, 5)}–${String(o.closeTime).slice(0, 5)}`}
                  {o.reason ? ` · ${o.reason}` : ''}
                </span>
                <button className="btn btn-sm btn-outline" onClick={() => removeOverride(o.id)}>
                  {t('groomingSchedule.remove')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Blocked ranges ── */}
      <div className="module-card">
        <h3>{t('groomingSchedule.blocksTitle')}</h3>
        <p className="slot-hint">{t('groomingSchedule.blocksHint')}</p>
        <div className="inline-form-row">
          <label>
            <span className="field-caption">{t('groomingSchedule.repeats')}</span>
            <select className="module-input" value={blockForm.isRecurring ? 'weekly' : 'once'}
              onChange={e => setBlockForm({ ...blockForm, isRecurring: e.target.value === 'weekly' })}>
              <option value="weekly">{t('groomingSchedule.everyWeek')}</option>
              <option value="once">{t('groomingSchedule.onceOnly')}</option>
            </select>
          </label>
          {blockForm.isRecurring ? (
            <label>
              <span className="field-caption">{t('groomingSchedule.day')}</span>
              <select className="module-input" value={blockForm.recurringDay}
                onChange={e => setBlockForm({ ...blockForm, recurringDay: Number(e.target.value) })}>
                {DAY_KEYS.map((k, i) => <option key={k} value={i}>{t(`groomingSchedule.days.${k}`)}</option>)}
              </select>
            </label>
          ) : (
            <label>
              <span className="field-caption">{t('groomingSchedule.date')}</span>
              <input className="module-input" type="date" value={blockForm.blockDate}
                onChange={e => setBlockForm({ ...blockForm, blockDate: e.target.value })} />
            </label>
          )}
          <label>
            <span className="field-caption">{t('groomingSchedule.from')}</span>
            <input className="module-input" type="time" value={blockForm.startTime}
              onChange={e => setBlockForm({ ...blockForm, startTime: e.target.value })} />
          </label>
          <label>
            <span className="field-caption">{t('groomingSchedule.to')}</span>
            <input className="module-input" type="time" value={blockForm.endTime}
              onChange={e => setBlockForm({ ...blockForm, endTime: e.target.value })} />
          </label>
          <label className="inline-form-grow">
            <span className="field-caption">{t('groomingSchedule.reason')}</span>
            <input className="module-input" value={blockForm.reason}
              placeholder={t('groomingSchedule.blockReasonPlaceholder')}
              onChange={e => setBlockForm({ ...blockForm, reason: e.target.value })} />
          </label>
          <button className="btn btn-sm btn-primary" onClick={addBlock}>{t('groomingSchedule.add')}</button>
        </div>

        {blocks.length === 0 ? <p className="slot-hint">{t('groomingSchedule.noBlocks')}</p> : (
          <ul className="rule-list">
            {blocks.map(b => (
              <li key={b.id}>
                <span>
                  <strong>
                    {b.isRecurring
                      ? t('groomingSchedule.everyDayName', { day: t(`groomingSchedule.days.${DAY_KEYS[b.recurringDay]}`) })
                      : String(b.blockDate).slice(0, 10)}
                  </strong>
                  {' · '}{String(b.startTime).slice(0, 5)}–{String(b.endTime).slice(0, 5)}
                  {b.reason ? ` · ${b.reason}` : ''}
                </span>
                <button className="btn btn-sm btn-outline" onClick={() => removeBlock(b.id)}>
                  {t('groomingSchedule.remove')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="order-footer-actions">
        <button className="module-btn" onClick={() => onNavigate('/grooming/orders')}>
          📋 {t('groomingSchedule.backToOrders')}
        </button>
      </div>
    </div>
  )
}

export default GroomingSchedule

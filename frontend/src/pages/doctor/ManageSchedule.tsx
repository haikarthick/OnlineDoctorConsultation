import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { useSettings } from '../../context/SettingsContext'
import { VetSchedule } from '../../types'
import '../../styles/modules.css'

interface ManageScheduleProps {
  onNavigate: (path: string) => void
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const DAY_LABELS: Record<string, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday'
}
const DAY_SHORT: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun'
}

interface DateOverride {
  id: string; overrideDate: string; overrideType: 'unavailable' | 'custom_hours';
  startTime?: string; endTime?: string; slotDuration?: number; reason?: string;
}
interface BlockedSlot {
  id: string; blockDate?: string; startTime: string; endTime: string;
  reason?: string; isRecurring: boolean; recurringDay?: string;
}
interface Holiday {
  id: string; holidayDate: string; name: string; holidayType: string;
  isFullDay: boolean; startTime?: string; endTime?: string;
}
interface CalendarDay {
  date: string; status: 'available' | 'unavailable' | 'custom' | 'holiday' | 'no_schedule';
  reason?: string;
}

const ManageSchedule: React.FC<ManageScheduleProps> = (_props) => {
  const { t } = useTranslation()
  const { formatSlotTime } = useSettings()
  const [activeTab, setActiveTab] = useState<'weekly' | 'calendar' | 'blocks' | 'holidays'>('weekly')
  const [schedules, setSchedules] = useState<VetSchedule[]>([])
  const [overrides, setOverrides] = useState<DateOverride[]>([])
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([])
  const [loading, setLoading] = useState(true)
  const [pageMsg, setPageMsg] = useState<{ text: string; isError: boolean } | null>(null)

  // Weekly schedule form
  const [showSchedForm, setShowSchedForm] = useState(false)
  const [editingSchedId, setEditingSchedId] = useState<string | null>(null)
  const [schedForm, setSchedForm] = useState({ dayOfWeek: 'monday', startTime: '09:00', endTime: '17:00', slotDurationMinutes: 30, isAvailable: true })
  const [schedFormError, setSchedFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Calendar month view
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() + 1 } })

  // Override form
  const [showOverrideForm, setShowOverrideForm] = useState(false)
  const [overrideForm, setOverrideForm] = useState({ overrideDate: '', overrideType: 'unavailable' as 'unavailable' | 'custom_hours', startTime: '09:00', endTime: '17:00', slotDuration: 30, reason: '' })

  // Vacation form
  const [showVacationForm, setShowVacationForm] = useState(false)
  const [vacationForm, setVacationForm] = useState({ startDate: '', endDate: '', reason: '' })

  // Blocked slot form
  const [showBlockForm, setShowBlockForm] = useState(false)
  const [blockForm, setBlockForm] = useState({ blockDate: '', startTime: '12:00', endTime: '13:00', reason: '', isRecurring: false, recurringDay: 'monday' })

  // Holiday form (admin)
  const [showHolidayForm, setShowHolidayForm] = useState(false)
  const [holidayForm, setHolidayForm] = useState({ holidayDate: '', name: '', holidayType: 'general', isFullDay: true, startTime: '09:00', endTime: '17:00' })

  const msg = (text: string, isError = false) => { setPageMsg({ text, isError }); setTimeout(() => setPageMsg(null), 3500) }

  const loadAll = useCallback(async () => {
    try {
      setLoading(true)
      const [schedRes, overRes, blockRes, holRes] = await Promise.all([
        apiService.getMySchedules(),
        apiService.listDateOverrides(),
        apiService.listBlockedSlots(),
        apiService.listHolidays({ year: calMonth.year })
      ])
      setSchedules(schedRes.data || [])
      setOverrides(overRes.data || [])
      setBlockedSlots(blockRes.data || [])
      setHolidays(holRes.data || [])
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [calMonth.year])

  useEffect(() => { loadAll() }, [loadAll])

  const loadCalendar = useCallback(async () => {
    try {
      const res = await apiService.getMonthlyAvailability('me', calMonth.year, calMonth.month)
      setCalendarDays(res.data || [])
    } catch { setCalendarDays([]) }
  }, [calMonth])

  useEffect(() => { if (activeTab === 'calendar') loadCalendar() }, [activeTab, loadCalendar])

  // ── Weekly Schedule handlers ──────────────────────────────
  const resetSchedForm = () => setSchedForm({ dayOfWeek: 'monday', startTime: '09:00', endTime: '17:00', slotDurationMinutes: 30, isAvailable: true })

  const handleSchedSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSubmitting(true); setSchedFormError('')
      if (editingSchedId) await apiService.updateSchedule(editingSchedId, schedForm)
      else await apiService.createSchedule(schedForm)
      setShowSchedForm(false); setEditingSchedId(null); resetSchedForm()
      loadAll(); msg(editingSchedId ? t('manageSchedule.scheduleUpdated') : t('manageSchedule.scheduleCreated'))
    } catch (err: any) { setSchedFormError(err?.response?.data?.message || err?.response?.data?.error?.message || t('common.failedToSave')) }
    finally { setSubmitting(false) }
  }

  const handleEditSched = (s: VetSchedule) => {
    setSchedForm({ dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime, slotDurationMinutes: s.slotDuration || s.slotDurationMinutes || 30, isAvailable: s.isActive ?? s.isAvailable ?? true })
    setEditingSchedId(s.id); setSchedFormError(''); setShowSchedForm(true)
  }

  const handleDeleteSched = async (id: string) => {
    if (!confirm(t('manageSchedule.confirmDeleteSchedule'))) return
    try { await apiService.deleteSchedule(id); loadAll(); msg(t('manageSchedule.scheduleDeleted')) } catch { msg(t('common.failedToDelete'), true) }
  }

  const handleCopyDay = async (fromDay: string) => {
    const source = schedules.find(s => s.dayOfWeek === fromDay)
    if (!source) return
    const available = DAYS.filter(d => d !== fromDay && !schedules.find(s => s.dayOfWeek === d))
    if (available.length === 0) { msg(t('manageSchedule.allDaysHaveSchedules'), true); return }
    try {
      for (const day of available) {
        await apiService.createSchedule({ dayOfWeek: day, startTime: source.startTime, endTime: source.endTime, slotDuration: source.slotDuration || 30 })
      }
      loadAll(); msg(t('manageSchedule.copiedToDays', { count: available.length }))
    } catch { msg(t('manageSchedule.failedToCopy'), true) }
  }

  // ── Override handlers ─────────────────────────────────────
  const handleOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSubmitting(true)
      await apiService.createDateOverride({
        overrideDate: overrideForm.overrideDate,
        overrideType: overrideForm.overrideType,
        ...(overrideForm.overrideType === 'custom_hours' ? { startTime: overrideForm.startTime, endTime: overrideForm.endTime, slotDuration: overrideForm.slotDuration } : {}),
        reason: overrideForm.reason || undefined
      })
      setShowOverrideForm(false); loadAll(); loadCalendar(); msg(t('manageSchedule.overrideSaved'))
    } catch (err: any) { msg(err?.response?.data?.message || t('manageSchedule.failedToSaveOverride'), true) }
    finally { setSubmitting(false) }
  }

  const handleVacationSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!vacationForm.startDate || !vacationForm.endDate) return
    try {
      setSubmitting(true)
      const dates: string[] = []
      const current = new Date(vacationForm.startDate + 'T12:00:00')
      const end = new Date(vacationForm.endDate + 'T12:00:00')
      while (current <= end) {
        dates.push(current.toISOString().split('T')[0])
        current.setDate(current.getDate() + 1)
      }
      if (dates.length === 0 || dates.length > 90) { msg(t('manageSchedule.select1to90days'), true); return }
      await apiService.bulkCreateDateOverrides({ dates, overrideType: 'unavailable', reason: vacationForm.reason || 'Vacation / Leave' })
      setShowVacationForm(false); loadAll(); loadCalendar(); msg(t('manageSchedule.daysMarkedAsLeave', { count: dates.length }))
    } catch (err: any) { msg(err?.response?.data?.message || t('manageSchedule.failedToSetVacation'), true) }
    finally { setSubmitting(false) }
  }

  const handleDeleteOverride = async (id: string) => {
    try { await apiService.deleteDateOverride(id); loadAll(); loadCalendar(); msg(t('manageSchedule.overrideRemoved')) } catch { msg(t('manageSchedule.failedToRemove'), true) }
  }

  // ── Block handlers ────────────────────────────────────────
  const handleBlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSubmitting(true)
      await apiService.createBlockedSlot({
        ...(blockForm.isRecurring ? { recurringDay: blockForm.recurringDay, isRecurring: true } : { blockDate: blockForm.blockDate, isRecurring: false }),
        startTime: blockForm.startTime, endTime: blockForm.endTime, reason: blockForm.reason || undefined
      })
      setShowBlockForm(false); loadAll(); msg(t('manageSchedule.timeBlockCreated'))
    } catch (err: any) { msg(err?.response?.data?.message || t('manageSchedule.failedToCreateBlock'), true) }
    finally { setSubmitting(false) }
  }

  const handleDeleteBlock = async (id: string) => {
    try { await apiService.deleteBlockedSlot(id); loadAll(); msg(t('manageSchedule.blockRemoved')) } catch { msg(t('manageSchedule.failedToRemove'), true) }
  }

  // ── Holiday handlers ──────────────────────────────────────
  const handleHolidaySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSubmitting(true)
      await apiService.createHoliday({
        holidayDate: holidayForm.holidayDate, name: holidayForm.name,
        holidayType: holidayForm.holidayType, isFullDay: holidayForm.isFullDay,
        ...(holidayForm.isFullDay ? {} : { startTime: holidayForm.startTime, endTime: holidayForm.endTime })
      })
      setShowHolidayForm(false); loadAll(); loadCalendar(); msg(t('manageSchedule.holidayAdded'))
    } catch (err: any) { msg(err?.response?.data?.message || t('manageSchedule.failedToAddHoliday'), true) }
    finally { setSubmitting(false) }
  }

  const handleDeleteHoliday = async (id: string) => {
    try { await apiService.deleteHoliday(id); loadAll(); loadCalendar(); msg(t('manageSchedule.holidayRemoved')) } catch { msg(t('manageSchedule.failedToRemove'), true) }
  }

  // ── Calendar helpers ──────────────────────────────────────
  const calendarGrid = () => {
    const firstDay = new Date(calMonth.year, calMonth.month - 1, 1)
    const lastDay = new Date(calMonth.year, calMonth.month, 0)
    const startPad = firstDay.getDay() // 0=Sun
    const days: (CalendarDay | null)[] = []
    for (let i = 0; i < startPad; i++) days.push(null)
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateStr = `${calMonth.year}-${String(calMonth.month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const cd = calendarDays.find(c => c.date === dateStr)
      days.push(cd || { date: dateStr, status: 'no_schedule' })
    }
    return days
  }

  const statusColor = (status: string) => {
    switch (status) {
      case 'available': return { bg: '#f0fdf4', border: '#86efac', text: '#166534' }
      case 'custom': return { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af' }
      case 'unavailable': return { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b' }
      case 'holiday': return { bg: '#fefce8', border: '#fde047', text: '#854d0e' }
      default: return { bg: '#f9fafb', border: '#e5e7eb', text: '#9ca3af' }
    }
  }

  const getScheduleForDay = (day: string) => schedules.filter(s => s.dayOfWeek === day)
  const todayStr = new Date().toISOString().split('T')[0]

  if (loading) {
    return (
      <div className="module-page">
        <div className="loading-container"><div className="loading-spinner" /><p>{t('manageSchedule.loadingSchedule')}</p></div>
      </div>
    )
  }

  const activeDays = schedules.filter(s => s.isActive ?? s.isAvailable).length
  const upcomingOverrides = overrides.filter(o => o.overrideDate >= todayStr).length
  const recurringBlocks = blockedSlots.filter(b => b.isRecurring).length
  const upcomingHolidays = holidays.filter(h => h.holidayDate >= todayStr).length

  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <h1>📆️ {t('manageSchedule.title')}</h1>
          <p className="page-subtitle">{t('manageSchedule.subtitle')}</p>
        </div>
      </div>

      {pageMsg && <div className={`modal-alert ${pageMsg.isError ? 'error' : 'success'} si-7e63ec4f`}>{pageMsg.text}</div>}

      {/* Stats Row */}
      <div className="si-cfa92bf8">
        {[
          { label: t('manageSchedule.activeDays'), value: `${activeDays}/7`, color: '#16a34a', icon: '📅' },
          { label: t('manageSchedule.dateOverrides'), value: upcomingOverrides, color: '#dc2626', icon: '🚫' },
          { label: t('manageSchedule.timeBlocks'), value: `${recurringBlocks} ${t('manageSchedule.recurring')}`, color: '#2563eb', icon: '⏰' },
          { label: t('manageSchedule.holidays'), value: upcomingHolidays, color: '#ca8a04', icon: '🎉' },
        ].map((s, i) => (
          <div key={i} className="card si-54a779b9">
            <div className="si-2ae66f62">{s.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div className="si-48a0b045">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="si-b2cab0f1">
        {([
          { key: 'weekly', label: `📅 ${t('manageSchedule.weeklySchedule')}`, subtitle: t('manageSchedule.recurringHours') },
          { key: 'calendar', label: `📆 ${t('manageSchedule.calendar')}`, subtitle: t('manageSchedule.dateOverridesSubtitle') },
          { key: 'blocks', label: `⏰ ${t('manageSchedule.timeBlocksTab')}`, subtitle: t('manageSchedule.blockSlots') },
          { key: 'holidays', label: `🎉 ${t('manageSchedule.holidays')}`, subtitle: t('manageSchedule.systemHolidays') },
        ] as { key: typeof activeTab; label: string; subtitle: string }[]).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1, padding: '10px 8px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: activeTab === tab.key ? 'white' : 'transparent',
              boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              fontWeight: activeTab === tab.key ? 600 : 400, fontSize: 13, transition: 'all 0.2s'
            }}>
            <div>{tab.label}</div>
            <div className="si-e79ab918">{tab.subtitle}</div>
          </button>
        ))}
      </div>

      {/* ═══ TAB 1: Weekly Schedule ═══ */}
      {activeTab === 'weekly' && (
        <div>
          <div className="si-101fd1d0">
            <h2 className="si-670df8d2">{t('manageSchedule.weeklyRecurringSchedule')}</h2>
            <button className="btn btn-primary" onClick={() => { resetSchedForm(); setEditingSchedId(null); setSchedFormError(''); setShowSchedForm(true) }}>
              + {t('manageSchedule.addTimeSlot')}
            </button>
          </div>

          {/* Visual Week Grid */}
          <div className="si-4ca33dc3">
            {DAYS.map(day => {
              const daySched = getScheduleForDay(day)
              const isActive = daySched.some(s => s.isActive ?? s.isAvailable)
              return (
                <div key={day} style={{
                  borderRadius: 10, padding: '10px 8px', textAlign: 'center',
                  background: isActive ? '#f0fdf4' : daySched.length ? '#fef2f2' : '#f9fafb',
                  border: `2px solid ${isActive ? '#86efac' : daySched.length ? '#fca5a5' : '#e5e7eb'}`,
                  minHeight: 100
                }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, color: isActive ? '#166534' : '#6b7280' }}>{DAY_SHORT[day]}</div>
                  {daySched.length === 0 ? (
                    <div className="si-ed6d4afe">{t('manageSchedule.off')}</div>
                  ) : daySched.map(s => (
                    <div key={s.id} className="si-692258ce">
                      <div className="si-b2cfcbec">{formatSlotTime(s.startTime)}-{formatSlotTime(s.endTime)}</div>
                      <div className="si-a213bf41">{s.slotDuration || s.slotDurationMinutes}min</div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>

          {/* Day Details */}
          {DAYS.map(day => {
            const daySched = getScheduleForDay(day)
            if (daySched.length === 0) return null
            return (
              <div key={day} className="card si-170de209">
                <div className="si-a0cc3086">
                  <div className="si-98d3a741">
                    <h3 className="si-5ec640a4">{DAY_LABELS[day]}</h3>
                    <span className={`badge ${(daySched[0].isActive ?? daySched[0].isAvailable) ? 'badge-active' : 'badge-inactive'}`}>
                      {(daySched[0].isActive ?? daySched[0].isAvailable) ? t('common.active') : t('manageSchedule.inactive')}
                    </span>
                  </div>
                  <div className="si-9f20fe5e">
                    <button className="btn btn-sm btn-outline" title={t('manageSchedule.copyToAllEmpty')} onClick={() => handleCopyDay(day)}>📋 {t('manageSchedule.copyToAll')}</button>
                    <button className="btn btn-sm btn-outline" onClick={() => handleEditSched(daySched[0])}>✏️ {t('manageSchedule.edit')}</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDeleteSched(daySched[0].id)}>🗑️</button>
                  </div>
                </div>
                <div className="si-9e38e1e1">
                  <span>🕐 {formatSlotTime(daySched[0].startTime)} - {formatSlotTime(daySched[0].endTime)}</span>
                  <span>⏱️ {daySched[0].slotDuration || daySched[0].slotDurationMinutes}{t('manageSchedule.minSlots')}</span>
                </div>
              </div>
            )
          })}

          {schedules.length === 0 && (
            <div className="card si-f6d75b01">
              <div className="si-75bae6a3">📅</div>
              <p>{t('manageSchedule.noScheduleConfigured')}</p>
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB 2: Calendar View ═══ */}
      {activeTab === 'calendar' && (
        <div>
          <div className="si-101fd1d0">
            <div className="si-0b20392f">
              <button className="btn btn-sm btn-outline" onClick={() => setCalMonth(p => { const m = p.month - 1; return m < 1 ? { year: p.year - 1, month: 12 } : { ...p, month: m } })}>◀</button>
              <h2 className="si-de4136e0">
                {new Date(calMonth.year, calMonth.month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h2>
              <button className="btn btn-sm btn-outline" onClick={() => setCalMonth(p => { const m = p.month + 1; return m > 12 ? { year: p.year + 1, month: 1 } : { ...p, month: m } })}>▶</button>
            </div>
            <div className="si-d223efb3">
              <button className="btn btn-outline" onClick={() => { setVacationForm({ startDate: '', endDate: '', reason: '' }); setShowVacationForm(true) }}>🏖️ {t('manageSchedule.setVacation')}</button>
              <button className="btn btn-primary" onClick={() => { setOverrideForm({ overrideDate: '', overrideType: 'unavailable', startTime: '09:00', endTime: '17:00', slotDuration: 30, reason: '' }); setShowOverrideForm(true) }}>+ {t('manageSchedule.dayOverride')}</button>
            </div>
          </div>

          {/* Legend */}
          <div className="si-f5a443a7">
            {[
              { status: 'available', label: t('manageSchedule.available') }, { status: 'custom', label: t('manageSchedule.customHours') },
              { status: 'unavailable', label: t('manageSchedule.dayOff') }, { status: 'holiday', label: t('manageSchedule.holiday') },
              { status: 'no_schedule', label: t('manageSchedule.noSchedule') }
            ].map(l => {
              const c = statusColor(l.status)
              return (
                <div key={l.status} className="si-aace88d4">
                  <div style={{ width: 14, height: 14, borderRadius: 3, background: c.bg, border: `2px solid ${c.border}` }} />
                  <span style={{ color: c.text }}>{l.label}</span>
                </div>
              )
            })}
          </div>

          {/* Calendar Grid */}
          <div className="si-a1d48e67">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="si-ac98329f">{d}</div>
            ))}
            {calendarGrid().map((cd, i) => {
              if (!cd) return <div key={`pad-${i}`} />
              const c = statusColor(cd.status)
              const dayNum = parseInt(cd.date.split('-')[2])
              const isPast = cd.date < todayStr
              return (
                <div key={cd.date} style={{
                  padding: '8px 6px', borderRadius: 8, textAlign: 'center', cursor: isPast ? 'default' : 'pointer',
                  background: isPast ? '#f9fafb' : c.bg, border: `2px solid ${isPast ? '#e5e7eb' : c.border}`,
                  opacity: isPast ? 0.5 : 1, minHeight: 56, position: 'relative'
                }} onClick={() => {
                  if (isPast) return
                  setOverrideForm({ overrideDate: cd.date, overrideType: 'unavailable', startTime: '09:00', endTime: '17:00', slotDuration: 30, reason: '' })
                  setShowOverrideForm(true)
                }}>
                  <div style={{ fontWeight: cd.date === todayStr ? 800 : 500, fontSize: 14, color: isPast ? '#9ca3af' : c.text,
                    ...(cd.date === todayStr ? { background: '#2563eb', color: 'white', borderRadius: '50%', width: 24, height: 24, lineHeight: '24px', margin: '0 auto' } : {}) }}>
                    {dayNum}
                  </div>
                  {cd.status !== 'no_schedule' && !isPast && (
                    <div style={{ fontSize: 9, color: c.text, marginTop: 3, fontWeight: 500 }}>
                      {cd.status === 'holiday' ? '🎉' : cd.status === 'unavailable' ? '🚫' : cd.status === 'custom' ? '⚙️' : '✅'}
                      {cd.reason && <div className="si-3b8d5aa2" title={cd.reason}>{cd.reason}</div>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Upcoming Overrides List */}
          <h3 className="si-b1238182">{t('manageSchedule.upcomingDateOverrides')}</h3>
          {overrides.filter(o => o.overrideDate >= todayStr).length === 0 ? (
            <div className="card si-6c943430">{t('manageSchedule.noUpcomingOverrides')}</div>
          ) : (
            <div className="si-b1691638">
              {overrides.filter(o => o.overrideDate >= todayStr).map(o => (
                <div key={o.id} className="card" style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  borderLeft: `4px solid ${o.overrideType === 'unavailable' ? '#ef4444' : '#3b82f6'}` }}>
                  <div>
                    <strong>{new Date(o.overrideDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</strong>
                    <span className="si-fddef076">
                      {o.overrideType === 'unavailable' ? `🚫 ${t('manageSchedule.dayOff')}` : `⚙️ ${t('manageSchedule.custom')}: ${formatSlotTime(o.startTime || '')}\u2013${formatSlotTime(o.endTime || '')}`}
                    </span>
                    {o.reason && <span className="si-824a7a1e">({o.reason})</span>}
                  </div>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDeleteOverride(o.id)}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB 3: Time Blocks ═══ */}
      {activeTab === 'blocks' && (
        <div>
          <div className="si-101fd1d0">
            <h2 className="si-670df8d2">{t('manageSchedule.timeBlocksTitle')}</h2>
            <button className="btn btn-primary" onClick={() => { setBlockForm({ blockDate: '', startTime: '12:00', endTime: '13:00', reason: '', isRecurring: false, recurringDay: 'monday' }); setShowBlockForm(true) }}>+ {t('manageSchedule.addTimeBlock')}</button>
          </div>

          <div className="card si-c5145b89">
            <p className="si-272ffbdb">
              💡 <strong>{t('manageSchedule.timeBlocksInfo')}</strong>
            </p>
          </div>

          {/* Recurring blocks */}
          <h3 className="si-37c342ae">🔄 {t('manageSchedule.recurringWeeklyBlocks')}</h3>
          {blockedSlots.filter(b => b.isRecurring).length === 0 ? (
            <div className="card si-05535ed3">{t('manageSchedule.noRecurringBlocks')}</div>
          ) : (
            <div className="si-ade41b1f">
              {blockedSlots.filter(b => b.isRecurring).map(b => (
                <div key={b.id} className="card si-25d97c4a">
                  <div>
                    <strong>{t('manageSchedule.every')} {DAY_LABELS[b.recurringDay || '']}</strong>
                    <span className="si-fddef076">🕐 {formatSlotTime(b.startTime)} - {formatSlotTime(b.endTime)}</span>
                    {b.reason && <span className="si-824a7a1e">({b.reason})</span>}
                  </div>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDeleteBlock(b.id)}>✕</button>
                </div>
              ))}
            </div>
          )}

          {/* One-time blocks */}
          <h3 className="si-37c342ae">📌 {t('manageSchedule.oneTimeBlocks')}</h3>
          {blockedSlots.filter(b => !b.isRecurring).length === 0 ? (
            <div className="card si-eb9d45f8">{t('manageSchedule.noOneTimeBlocks')}</div>
          ) : (
            <div className="si-b1691638">
              {blockedSlots.filter(b => !b.isRecurring).map(b => (
                <div key={b.id} className="card si-1ad6e65d">
                  <div>
                    <strong>{b.blockDate ? new Date(b.blockDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '-'}</strong>
                    <span className="si-fddef076">🕐 {formatSlotTime(b.startTime)} - {formatSlotTime(b.endTime)}</span>
                    {b.reason && <span className="si-824a7a1e">({b.reason})</span>}
                  </div>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDeleteBlock(b.id)}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB 4: Holidays ═══ */}
      {activeTab === 'holidays' && (
        <div>
          <div className="si-101fd1d0">
            <h2 className="si-670df8d2">{t('manageSchedule.hospitalSystemHolidays')}</h2>
            <button className="btn btn-primary" onClick={() => { setHolidayForm({ holidayDate: '', name: '', holidayType: 'general', isFullDay: true, startTime: '09:00', endTime: '17:00' }); setShowHolidayForm(true) }}>+ {t('manageSchedule.addHoliday')}</button>
          </div>

          <div className="card si-20cc5dae">
            <p className="si-9f6f0e77">
              🎉 <strong>{t('manageSchedule.systemHolidaysInfo')}</strong>
            </p>
          </div>

          {/* Holiday year filter */}
          <div className="si-cf4a3ba4">
            {[calMonth.year - 1, calMonth.year, calMonth.year + 1].map(y => (
              <button key={y} className={`btn btn-sm ${calMonth.year === y ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setCalMonth(p => ({ ...p, year: y }))}>{y}</button>
            ))}
          </div>

          {holidays.length === 0 ? (
            <div className="card si-f6d75b01">
              <div className="si-75bae6a3">🎉</div>
              <p>{t('manageSchedule.noHolidaysConfigured', { year: calMonth.year })}</p>
            </div>
          ) : (
            <div className="si-b1691638">
              {holidays.map(h => (
                <div key={h.id} className="card" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  borderLeft: `4px solid ${h.holidayType === 'emergency_closure' ? '#ef4444' : '#eab308'}`,
                  opacity: h.holidayDate < todayStr ? 0.5 : 1 }}>
                  <div>
                    <strong className="si-38c57a68">{h.name}</strong>
                    <span className="si-3d174d55">
                      {new Date(h.holidayDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span className={`badge ${h.holidayType === 'general' ? 'badge-active' : h.holidayType === 'emergency_closure' ? 'badge-danger' : 'badge-warning'} si-7984dfbc`}>
                      {(h.holidayType || '').replace('_', ' ')}
                    </span>
                    {!h.isFullDay && <span className="si-824a7a1e">({formatSlotTime(h.startTime || '')}-{formatSlotTime(h.endTime || '')})</span>}
                  </div>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDeleteHoliday(h.id)}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ MODALS ═══ */}

      {/* Weekly Schedule Form Modal */}
      {showSchedForm && (
        <div className="modal-overlay" onClick={() => setShowSchedForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingSchedId ? t('manageSchedule.editSchedule') : t('manageSchedule.addWeeklySchedule')}</h2>
              <button className="modal-close" onClick={() => setShowSchedForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              {schedFormError && <div className="modal-alert error si-7e63ec4f">{schedFormError}</div>}
              <form onSubmit={handleSchedSubmit}>
                <div className="form-group">
                  <label className="form-label">{t('manageSchedule.dayOfWeek')}</label>
                  <select className="form-input" value={schedForm.dayOfWeek} onChange={e => setSchedForm({ ...schedForm, dayOfWeek: e.target.value })}>
                    {DAYS.map(d => <option key={d} value={d}>{DAY_LABELS[d]}</option>)}
                  </select>
                </div>
                <div className="si-f23844fb">
                  <div className="form-group">
                    <label className="form-label">{t('manageSchedule.startTime')}</label>
                    <input className="form-input" type="time" value={schedForm.startTime} onChange={e => setSchedForm({ ...schedForm, startTime: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('manageSchedule.endTime')}</label>
                    <input className="form-input" type="time" value={schedForm.endTime} onChange={e => setSchedForm({ ...schedForm, endTime: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">{t('manageSchedule.slotDuration')}</label>
                  <select className="form-input" value={schedForm.slotDurationMinutes} onChange={e => setSchedForm({ ...schedForm, slotDurationMinutes: Number(e.target.value) })}>
                    {[15, 20, 30, 45, 60].map(m => <option key={m} value={m}>{m} {t('manageSchedule.minutes')}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="si-0c7e7279">
                    <input type="checkbox" checked={schedForm.isAvailable} onChange={e => setSchedForm({ ...schedForm, isAvailable: e.target.checked })} className="si-8f286607" />
                    <span>{t('manageSchedule.availableForBookings')}</span>
                  </label>
                </div>
                <div className="si-2afd2545">
                  <button type="button" className="btn btn-outline" onClick={() => setShowSchedForm(false)}>{t('manageSchedule.cancel')}</button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? t('manageSchedule.saving') : editingSchedId ? t('manageSchedule.update') : t('manageSchedule.create')}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Date Override Modal */}
      {showOverrideForm && (
        <div className="modal-overlay" onClick={() => setShowOverrideForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📅 {t('manageSchedule.dateOverrideTitle')}</h2>
              <button className="modal-close" onClick={() => setShowOverrideForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleOverrideSubmit}>
                <div className="form-group">
                  <label className="form-label">{t('manageSchedule.date')}</label>
                  <input className="form-input" type="date" value={overrideForm.overrideDate} min={todayStr}
                    onChange={e => setOverrideForm({ ...overrideForm, overrideDate: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('manageSchedule.overrideType')}</label>
                  <div className="si-b1214800">
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '8px 14px', borderRadius: 8,
                      background: overrideForm.overrideType === 'unavailable' ? '#fef2f2' : '#f9fafb', border: `2px solid ${overrideForm.overrideType === 'unavailable' ? '#fca5a5' : '#e5e7eb'}` }}>
                      <input type="radio" name="overrideType" value="unavailable" checked={overrideForm.overrideType === 'unavailable'}
                        onChange={() => setOverrideForm({ ...overrideForm, overrideType: 'unavailable' })} />
                      <span>🚫 {t('manageSchedule.dayOff')}</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '8px 14px', borderRadius: 8,
                      background: overrideForm.overrideType === 'custom_hours' ? '#eff6ff' : '#f9fafb', border: `2px solid ${overrideForm.overrideType === 'custom_hours' ? '#93c5fd' : '#e5e7eb'}` }}>
                      <input type="radio" name="overrideType" value="custom_hours" checked={overrideForm.overrideType === 'custom_hours'}
                        onChange={() => setOverrideForm({ ...overrideForm, overrideType: 'custom_hours' })} />
                      <span>⚙️ {t('manageSchedule.customHours')}</span>
                    </label>
                  </div>
                </div>
                {overrideForm.overrideType === 'custom_hours' && (
                  <>
                    <div className="si-f23844fb">
                      <div className="form-group">
                        <label className="form-label">{t('manageSchedule.startTime')}</label>
                        <input className="form-input" type="time" value={overrideForm.startTime} onChange={e => setOverrideForm({ ...overrideForm, startTime: e.target.value })} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">{t('manageSchedule.endTime')}</label>
                        <input className="form-input" type="time" value={overrideForm.endTime} onChange={e => setOverrideForm({ ...overrideForm, endTime: e.target.value })} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('manageSchedule.slotDuration')}</label>
                      <select className="form-input" value={overrideForm.slotDuration} onChange={e => setOverrideForm({ ...overrideForm, slotDuration: Number(e.target.value) })}>
                        {[15, 20, 30, 45, 60].map(m => <option key={m} value={m}>{m} {t('manageSchedule.minutes')}</option>)}
                      </select>
                    </div>
                  </>
                )}
                <div className="form-group">
                  <label className="form-label">{t('manageSchedule.reason')}</label>
                  <input className="form-input" value={overrideForm.reason} onChange={e => setOverrideForm({ ...overrideForm, reason: e.target.value })}
                    placeholder={t('manageSchedule.reasonPlaceholder')} />
                </div>
                <div className="si-2afd2545">
                  <button type="button" className="btn btn-outline" onClick={() => setShowOverrideForm(false)}>{t('manageSchedule.cancel')}</button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? t('manageSchedule.saving') : t('manageSchedule.saveOverride')}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Vacation Modal */}
      {showVacationForm && (
        <div className="modal-overlay" onClick={() => setShowVacationForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🏖️ {t('manageSchedule.vacationLeave')}</h2>
              <button className="modal-close" onClick={() => setShowVacationForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="card si-a9e61de4">
                <p className="si-272ffbdb">
                  {t('manageSchedule.vacationInfoText')}
                </p>
              </div>
              <form onSubmit={handleVacationSubmit}>
                <div className="si-f23844fb">
                  <div className="form-group">
                    <label className="form-label">{t('manageSchedule.startDate')}</label>
                    <input className="form-input" type="date" value={vacationForm.startDate} min={todayStr}
                      onChange={e => setVacationForm({ ...vacationForm, startDate: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('manageSchedule.endDate')}</label>
                    <input className="form-input" type="date" value={vacationForm.endDate} min={vacationForm.startDate || todayStr}
                      onChange={e => setVacationForm({ ...vacationForm, endDate: e.target.value })} required />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">{t('manageSchedule.reason')}</label>
                  <input className="form-input" value={vacationForm.reason} onChange={e => setVacationForm({ ...vacationForm, reason: e.target.value })}
                    placeholder={t('manageSchedule.vacationReasonPlaceholder')} />
                </div>
                {vacationForm.startDate && vacationForm.endDate && (
                  <div className="si-80778f39">
                    📅 {t('manageSchedule.daysWillBeMarked', { count: Math.max(1, Math.ceil((new Date(vacationForm.endDate).getTime() - new Date(vacationForm.startDate).getTime()) / 86400000) + 1) })}
                  </div>
                )}
                <div className="si-2afd2545">
                  <button type="button" className="btn btn-outline" onClick={() => setShowVacationForm(false)}>{t('manageSchedule.cancel')}</button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? t('manageSchedule.setting') : t('manageSchedule.setVacationBtn')}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Blocked Slot Modal */}
      {showBlockForm && (
        <div className="modal-overlay" onClick={() => setShowBlockForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>⏰ {t('manageSchedule.blockTimeSlot')}</h2>
              <button className="modal-close" onClick={() => setShowBlockForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleBlockSubmit}>
                <div className="form-group">
                  <label className="form-label">{t('manageSchedule.blockType')}</label>
                  <div className="si-b1214800">
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '8px 14px', borderRadius: 8,
                      background: !blockForm.isRecurring ? '#eff6ff' : '#f9fafb', border: `2px solid ${!blockForm.isRecurring ? '#93c5fd' : '#e5e7eb'}` }}>
                      <input type="radio" name="blockType" checked={!blockForm.isRecurring}
                        onChange={() => setBlockForm({ ...blockForm, isRecurring: false })} />
                      <span>📌 {t('manageSchedule.oneTime')}</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '8px 14px', borderRadius: 8,
                      background: blockForm.isRecurring ? '#f0fdf4' : '#f9fafb', border: `2px solid ${blockForm.isRecurring ? '#86efac' : '#e5e7eb'}` }}>
                      <input type="radio" name="blockType" checked={blockForm.isRecurring}
                        onChange={() => setBlockForm({ ...blockForm, isRecurring: true })} />
                      <span>🔄 {t('manageSchedule.everyWeek')}</span>
                    </label>
                  </div>
                </div>
                {blockForm.isRecurring ? (
                  <div className="form-group">
                    <label className="form-label">{t('manageSchedule.dayOfWeek')}</label>
                    <select className="form-input" value={blockForm.recurringDay} onChange={e => setBlockForm({ ...blockForm, recurringDay: e.target.value })}>
                      {DAYS.map(d => <option key={d} value={d}>{DAY_LABELS[d]}</option>)}
                    </select>
                  </div>
                ) : (
                  <div className="form-group">
                    <label className="form-label">{t('manageSchedule.date')}</label>
                    <input className="form-input" type="date" value={blockForm.blockDate} min={todayStr}
                      onChange={e => setBlockForm({ ...blockForm, blockDate: e.target.value })} required />
                  </div>
                )}
                <div className="si-f23844fb">
                  <div className="form-group">
                    <label className="form-label">{t('manageSchedule.blockStart')}</label>
                    <input className="form-input" type="time" value={blockForm.startTime} onChange={e => setBlockForm({ ...blockForm, startTime: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('manageSchedule.blockEnd')}</label>
                    <input className="form-input" type="time" value={blockForm.endTime} onChange={e => setBlockForm({ ...blockForm, endTime: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">{t('manageSchedule.reason')}</label>
                  <input className="form-input" value={blockForm.reason} onChange={e => setBlockForm({ ...blockForm, reason: e.target.value })}
                    placeholder={t('manageSchedule.blockReasonPlaceholder')} />
                </div>
                <div className="si-2afd2545">
                  <button type="button" className="btn btn-outline" onClick={() => setShowBlockForm(false)}>{t('manageSchedule.cancel')}</button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? t('manageSchedule.saving') : t('manageSchedule.createBlock')}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Holiday Modal */}
      {showHolidayForm && (
        <div className="modal-overlay" onClick={() => setShowHolidayForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🎉 {t('manageSchedule.addHolidayTitle')}</h2>
              <button className="modal-close" onClick={() => setShowHolidayForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleHolidaySubmit}>
                <div className="form-group">
                  <label className="form-label">{t('manageSchedule.holidayName')}</label>
                  <input className="form-input" value={holidayForm.name} onChange={e => setHolidayForm({ ...holidayForm, name: e.target.value })}
                    placeholder={t('manageSchedule.holidayNamePlaceholder')} required />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('manageSchedule.date')}</label>
                  <input className="form-input" type="date" value={holidayForm.holidayDate}
                    onChange={e => setHolidayForm({ ...holidayForm, holidayDate: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('manageSchedule.type')}</label>
                  <select className="form-input" value={holidayForm.holidayType} onChange={e => setHolidayForm({ ...holidayForm, holidayType: e.target.value })}>
                    <option value="general">{t('manageSchedule.generalHoliday')}</option>
                    <option value="hospital_specific">{t('manageSchedule.hospitalSpecific')}</option>
                    <option value="emergency_closure">{t('manageSchedule.emergencyClosure')}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="si-0c7e7279">
                    <input type="checkbox" checked={holidayForm.isFullDay} onChange={e => setHolidayForm({ ...holidayForm, isFullDay: e.target.checked })} className="si-8f286607" />
                    <span>{t('manageSchedule.fullDayClosure')}</span>
                  </label>
                </div>
                {!holidayForm.isFullDay && (
                  <div className="si-f23844fb">
                    <div className="form-group">
                      <label className="form-label">{t('manageSchedule.closureStart')}</label>
                      <input className="form-input" type="time" value={holidayForm.startTime} onChange={e => setHolidayForm({ ...holidayForm, startTime: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('manageSchedule.closureEnd')}</label>
                      <input className="form-input" type="time" value={holidayForm.endTime} onChange={e => setHolidayForm({ ...holidayForm, endTime: e.target.value })} />
                    </div>
                  </div>
                )}
                <div className="si-2afd2545">
                  <button type="button" className="btn btn-outline" onClick={() => setShowHolidayForm(false)}>{t('manageSchedule.cancel')}</button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? t('manageSchedule.saving') : t('manageSchedule.addHolidayBtn')}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ManageSchedule

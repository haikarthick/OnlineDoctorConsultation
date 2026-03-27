import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
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

const ManageSchedule: React.FC<ManageScheduleProps> = ({  }) => {
  const { t } = useTranslation()
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
      loadAll(); msg(editingSchedId ? 'Schedule updated ✓' : 'Schedule created ✓')
    } catch (err: any) { setSchedFormError(err?.response?.data?.message || err?.response?.data?.error?.message || 'Failed to save') }
    finally { setSubmitting(false) }
  }

  const handleEditSched = (s: VetSchedule) => {
    setSchedForm({ dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime, slotDurationMinutes: s.slotDuration || s.slotDurationMinutes || 30, isAvailable: s.isActive ?? s.isAvailable ?? true })
    setEditingSchedId(s.id); setSchedFormError(''); setShowSchedForm(true)
  }

  const handleDeleteSched = async (id: string) => {
    if (!confirm('Delete this schedule?')) return
    try { await apiService.deleteSchedule(id); loadAll(); msg('Schedule deleted') } catch { msg('Failed to delete', true) }
  }

  const handleCopyDay = async (fromDay: string) => {
    const source = schedules.find(s => s.dayOfWeek === fromDay)
    if (!source) return
    const available = DAYS.filter(d => d !== fromDay && !schedules.find(s => s.dayOfWeek === d))
    if (available.length === 0) { msg('All days already have schedules', true); return }
    try {
      for (const day of available) {
        await apiService.createSchedule({ dayOfWeek: day, startTime: source.startTime, endTime: source.endTime, slotDuration: source.slotDuration || 30 })
      }
      loadAll(); msg(`Copied to ${available.length} day(s) ✓`)
    } catch { msg('Failed to copy', true) }
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
      setShowOverrideForm(false); loadAll(); loadCalendar(); msg('Override saved ✓')
    } catch (err: any) { msg(err?.response?.data?.message || 'Failed to save override', true) }
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
      if (dates.length === 0 || dates.length > 90) { msg('Select 1-90 days', true); return }
      await apiService.bulkCreateDateOverrides({ dates, overrideType: 'unavailable', reason: vacationForm.reason || 'Vacation / Leave' })
      setShowVacationForm(false); loadAll(); loadCalendar(); msg(`${dates.length} day(s) marked as leave ✓`)
    } catch (err: any) { msg(err?.response?.data?.message || 'Failed to set vacation', true) }
    finally { setSubmitting(false) }
  }

  const handleDeleteOverride = async (id: string) => {
    try { await apiService.deleteDateOverride(id); loadAll(); loadCalendar(); msg('Override removed ✓') } catch { msg('Failed to remove', true) }
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
      setShowBlockForm(false); loadAll(); msg('Time block created ✓')
    } catch (err: any) { msg(err?.response?.data?.message || 'Failed to create block', true) }
    finally { setSubmitting(false) }
  }

  const handleDeleteBlock = async (id: string) => {
    try { await apiService.deleteBlockedSlot(id); loadAll(); msg('Block removed ✓') } catch { msg('Failed to remove', true) }
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
      setShowHolidayForm(false); loadAll(); loadCalendar(); msg('Holiday added ✓')
    } catch (err: any) { msg(err?.response?.data?.message || 'Failed to add holiday', true) }
    finally { setSubmitting(false) }
  }

  const handleDeleteHoliday = async (id: string) => {
    try { await apiService.deleteHoliday(id); loadAll(); loadCalendar(); msg('Holiday removed ✓') } catch { msg('Failed to remove', true) }
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

      {pageMsg && <div className={`modal-alert ${pageMsg.isError ? 'error' : 'success'}`} style={{ marginBottom: 16 }}>{pageMsg.text}</div>}

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: t('manageSchedule.activeDays'), value: `${activeDays}/7`, color: '#16a34a', icon: '📅' },
          { label: t('manageSchedule.dateOverrides'), value: upcomingOverrides, color: '#dc2626', icon: '🚫' },
          { label: t('manageSchedule.timeBlocks'), value: `${recurringBlocks} ${t('manageSchedule.recurring')}`, color: '#2563eb', icon: '⏰' },
          { label: t('manageSchedule.holidays'), value: upcomingHolidays, color: '#ca8a04', icon: '🎉' },
        ].map((s, i) => (
          <div key={i} className="card" style={{ padding: '14px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 24 }}>{s.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#f3f4f6', borderRadius: 10, padding: 4 }}>
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
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{tab.subtitle}</div>
          </button>
        ))}
      </div>

      {/* ═══ TAB 1: Weekly Schedule ═══ */}
      {activeTab === 'weekly' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>{t('manageSchedule.weeklyRecurringSchedule')}</h2>
            <button className="btn btn-primary" onClick={() => { resetSchedForm(); setEditingSchedId(null); setSchedFormError(''); setShowSchedForm(true) }}>
              + {t('manageSchedule.addTimeSlot')}
            </button>
          </div>

          {/* Visual Week Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 16 }}>
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
                    <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 12 }}>{t('manageSchedule.off')}</div>
                  ) : daySched.map(s => (
                    <div key={s.id} style={{ fontSize: 12, marginTop: 4 }}>
                      <div style={{ fontWeight: 600 }}>{s.startTime}–{s.endTime}</div>
                      <div style={{ color: '#6b7280', fontSize: 11 }}>{s.slotDuration || s.slotDurationMinutes}min</div>
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
              <div key={day} className="card" style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h3 style={{ margin: 0, fontSize: 15 }}>{DAY_LABELS[day]}</h3>
                    <span className={`badge ${(daySched[0].isActive ?? daySched[0].isAvailable) ? 'badge-active' : 'badge-inactive'}`}>
                      {(daySched[0].isActive ?? daySched[0].isAvailable) ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-sm btn-outline" title="Copy to all empty days" onClick={() => handleCopyDay(day)}>📋 {t('manageSchedule.copyToAll')}</button>
                    <button className="btn btn-sm btn-outline" onClick={() => handleEditSched(daySched[0])}>✏️ {t('manageSchedule.edit')}</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDeleteSched(daySched[0].id)}>🗑️</button>
                  </div>
                </div>
                <div style={{ padding: '4px 16px 10px', display: 'flex', gap: 16, fontSize: 13, color: '#374151' }}>
                  <span>🕐 {daySched[0].startTime} – {daySched[0].endTime}</span>
                  <span>⏱️ {daySched[0].slotDuration || daySched[0].slotDurationMinutes}min slots</span>
                </div>
              </div>
            )
          })}

          {schedules.length === 0 && (
            <div className="card" style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>📅</div>
              <p>{t('manageSchedule.noScheduleConfigured')}</p>
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB 2: Calendar View ═══ */}
      {activeTab === 'calendar' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button className="btn btn-sm btn-outline" onClick={() => setCalMonth(p => { const m = p.month - 1; return m < 1 ? { year: p.year - 1, month: 12 } : { ...p, month: m } })}>◀</button>
              <h2 style={{ margin: 0, fontSize: 18, minWidth: 160, textAlign: 'center' }}>
                {new Date(calMonth.year, calMonth.month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h2>
              <button className="btn btn-sm btn-outline" onClick={() => setCalMonth(p => { const m = p.month + 1; return m > 12 ? { year: p.year + 1, month: 1 } : { ...p, month: m } })}>▶</button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline" onClick={() => { setVacationForm({ startDate: '', endDate: '', reason: '' }); setShowVacationForm(true) }}>🏖️ {t('manageSchedule.setVacation')}</button>
              <button className="btn btn-primary" onClick={() => { setOverrideForm({ overrideDate: '', overrideType: 'unavailable', startTime: '09:00', endTime: '17:00', slotDuration: 30, reason: '' }); setShowOverrideForm(true) }}>+ {t('manageSchedule.dayOverride')}</button>
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
            {[
              { status: 'available', label: t('manageSchedule.available') }, { status: 'custom', label: t('manageSchedule.customHours') },
              { status: 'unavailable', label: t('manageSchedule.dayOff') }, { status: 'holiday', label: t('manageSchedule.holiday') },
              { status: 'no_schedule', label: t('manageSchedule.noSchedule') }
            ].map(l => {
              const c = statusColor(l.status)
              return (
                <div key={l.status} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                  <div style={{ width: 14, height: 14, borderRadius: 3, background: c.bg, border: `2px solid ${c.border}` }} />
                  <span style={{ color: c.text }}>{l.label}</span>
                </div>
              )
            })}
          </div>

          {/* Calendar Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 16 }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} style={{ textAlign: 'center', fontWeight: 600, fontSize: 12, color: '#6b7280', padding: 6 }}>{d}</div>
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
                      {cd.reason && <div style={{ fontSize: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={cd.reason}>{cd.reason}</div>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Upcoming Overrides List */}
          <h3 style={{ fontSize: 15, marginBottom: 8 }}>{t('manageSchedule.upcomingDateOverrides')}</h3>
          {overrides.filter(o => o.overrideDate >= todayStr).length === 0 ? (
            <div className="card" style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>{t('manageSchedule.noUpcomingOverrides')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {overrides.filter(o => o.overrideDate >= todayStr).map(o => (
                <div key={o.id} className="card" style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  borderLeft: `4px solid ${o.overrideType === 'unavailable' ? '#ef4444' : '#3b82f6'}` }}>
                  <div>
                    <strong>{new Date(o.overrideDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</strong>
                    <span style={{ marginLeft: 10, fontSize: 13 }}>
                      {o.overrideType === 'unavailable' ? '🚫 Day Off' : `⚙️ Custom: ${o.startTime}–${o.endTime}`}
                    </span>
                    {o.reason && <span style={{ marginLeft: 8, color: '#6b7280', fontSize: 12 }}>({o.reason})</span>}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>{t('manageSchedule.timeBlocksTitle')}</h2>
            <button className="btn btn-primary" onClick={() => { setBlockForm({ blockDate: '', startTime: '12:00', endTime: '13:00', reason: '', isRecurring: false, recurringDay: 'monday' }); setShowBlockForm(true) }}>+ {t('manageSchedule.addTimeBlock')}</button>
          </div>

          <div className="card" style={{ padding: 16, marginBottom: 16, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
            <p style={{ margin: 0, fontSize: 13, color: '#1e40af' }}>
              💡 <strong>{t('manageSchedule.timeBlocksInfo')}</strong>
            </p>
          </div>

          {/* Recurring blocks */}
          <h3 style={{ fontSize: 15, marginBottom: 8, color: '#374151' }}>🔄 {t('manageSchedule.recurringWeeklyBlocks')}</h3>
          {blockedSlots.filter(b => b.isRecurring).length === 0 ? (
            <div className="card" style={{ padding: 16, textAlign: 'center', color: '#6b7280', marginBottom: 16 }}>{t('manageSchedule.noRecurringBlocks')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
              {blockedSlots.filter(b => b.isRecurring).map(b => (
                <div key={b.id} className="card" style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '4px solid #3b82f6' }}>
                  <div>
                    <strong>Every {DAY_LABELS[b.recurringDay || '']}</strong>
                    <span style={{ marginLeft: 10, fontSize: 13 }}>🕐 {b.startTime} – {b.endTime}</span>
                    {b.reason && <span style={{ marginLeft: 8, color: '#6b7280', fontSize: 12 }}>({b.reason})</span>}
                  </div>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDeleteBlock(b.id)}>✕</button>
                </div>
              ))}
            </div>
          )}

          {/* One-time blocks */}
          <h3 style={{ fontSize: 15, marginBottom: 8, color: '#374151' }}>📌 {t('manageSchedule.oneTimeBlocks')}</h3>
          {blockedSlots.filter(b => !b.isRecurring).length === 0 ? (
            <div className="card" style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>{t('manageSchedule.noOneTimeBlocks')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {blockedSlots.filter(b => !b.isRecurring).map(b => (
                <div key={b.id} className="card" style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '4px solid #f97316' }}>
                  <div>
                    <strong>{b.blockDate ? new Date(b.blockDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '—'}</strong>
                    <span style={{ marginLeft: 10, fontSize: 13 }}>🕐 {b.startTime} – {b.endTime}</span>
                    {b.reason && <span style={{ marginLeft: 8, color: '#6b7280', fontSize: 12 }}>({b.reason})</span>}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>{t('manageSchedule.hospitalSystemHolidays')}</h2>
            <button className="btn btn-primary" onClick={() => { setHolidayForm({ holidayDate: '', name: '', holidayType: 'general', isFullDay: true, startTime: '09:00', endTime: '17:00' }); setShowHolidayForm(true) }}>+ {t('manageSchedule.addHoliday')}</button>
          </div>

          <div className="card" style={{ padding: 16, marginBottom: 16, background: '#fefce8', border: '1px solid #fde047' }}>
            <p style={{ margin: 0, fontSize: 13, color: '#854d0e' }}>
              🎉 <strong>{t('manageSchedule.systemHolidaysInfo')}</strong>
            </p>
          </div>

          {/* Holiday year filter */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {[calMonth.year - 1, calMonth.year, calMonth.year + 1].map(y => (
              <button key={y} className={`btn btn-sm ${calMonth.year === y ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setCalMonth(p => ({ ...p, year: y }))}>{y}</button>
            ))}
          </div>

          {holidays.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
              <p>{t('manageSchedule.noHolidaysConfigured', { year: calMonth.year })}</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {holidays.map(h => (
                <div key={h.id} className="card" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  borderLeft: `4px solid ${h.holidayType === 'emergency_closure' ? '#ef4444' : '#eab308'}`,
                  opacity: h.holidayDate < todayStr ? 0.5 : 1 }}>
                  <div>
                    <strong style={{ fontSize: 14 }}>{h.name}</strong>
                    <span style={{ marginLeft: 10, fontSize: 13, color: '#6b7280' }}>
                      {new Date(h.holidayDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span style={{ marginLeft: 8 }} className={`badge ${h.holidayType === 'general' ? 'badge-active' : h.holidayType === 'emergency_closure' ? 'badge-danger' : 'badge-warning'}`}>
                      {h.holidayType.replace('_', ' ')}
                    </span>
                    {!h.isFullDay && <span style={{ marginLeft: 8, fontSize: 12, color: '#6b7280' }}>({h.startTime}–{h.endTime})</span>}
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
              {schedFormError && <div className="modal-alert error" style={{ marginBottom: 16 }}>{schedFormError}</div>}
              <form onSubmit={handleSchedSubmit}>
                <div className="form-group">
                  <label className="form-label">{t('manageSchedule.dayOfWeek')}</label>
                  <select className="form-input" value={schedForm.dayOfWeek} onChange={e => setSchedForm({ ...schedForm, dayOfWeek: e.target.value })}>
                    {DAYS.map(d => <option key={d} value={d}>{DAY_LABELS[d]}</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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
                    {[15, 20, 30, 45, 60].map(m => <option key={m} value={m}>{m} minutes</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={schedForm.isAvailable} onChange={e => setSchedForm({ ...schedForm, isAvailable: e.target.checked })} style={{ width: 18, height: 18 }} />
                    <span>{t('manageSchedule.availableForBookings')}</span>
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
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
                  <div style={{ display: 'flex', gap: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '8px 14px', borderRadius: 8,
                      background: overrideForm.overrideType === 'unavailable' ? '#fef2f2' : '#f9fafb', border: `2px solid ${overrideForm.overrideType === 'unavailable' ? '#fca5a5' : '#e5e7eb'}` }}>
                      <input type="radio" name="overrideType" value="unavailable" checked={overrideForm.overrideType === 'unavailable'}
                        onChange={() => setOverrideForm({ ...overrideForm, overrideType: 'unavailable' })} />
                      <span>🚫 Day Off</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '8px 14px', borderRadius: 8,
                      background: overrideForm.overrideType === 'custom_hours' ? '#eff6ff' : '#f9fafb', border: `2px solid ${overrideForm.overrideType === 'custom_hours' ? '#93c5fd' : '#e5e7eb'}` }}>
                      <input type="radio" name="overrideType" value="custom_hours" checked={overrideForm.overrideType === 'custom_hours'}
                        onChange={() => setOverrideForm({ ...overrideForm, overrideType: 'custom_hours' })} />
                      <span>⚙️ Custom Hours</span>
                    </label>
                  </div>
                </div>
                {overrideForm.overrideType === 'custom_hours' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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
                        {[15, 20, 30, 45, 60].map(m => <option key={m} value={m}>{m} minutes</option>)}
                      </select>
                    </div>
                  </>
                )}
                <div className="form-group">
                  <label className="form-label">{t('manageSchedule.reason')}</label>
                  <input className="form-input" value={overrideForm.reason} onChange={e => setOverrideForm({ ...overrideForm, reason: e.target.value })}
                    placeholder={t('manageSchedule.reasonPlaceholder')} />
                </div>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
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
              <div className="card" style={{ padding: 12, marginBottom: 16, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                <p style={{ margin: 0, fontSize: 13, color: '#1e40af' }}>
                  Select a date range to mark all those days as unavailable. Existing bookings on those dates will NOT be automatically cancelled — please manage them separately.
                </p>
              </div>
              <form onSubmit={handleVacationSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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
                  <div style={{ padding: 12, borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', marginBottom: 12, fontSize: 13 }}>
                    📅 {Math.max(1, Math.ceil((new Date(vacationForm.endDate).getTime() - new Date(vacationForm.startDate).getTime()) / 86400000) + 1)} day(s) will be marked unavailable
                  </div>
                )}
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
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
                  <div style={{ display: 'flex', gap: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '8px 14px', borderRadius: 8,
                      background: !blockForm.isRecurring ? '#eff6ff' : '#f9fafb', border: `2px solid ${!blockForm.isRecurring ? '#93c5fd' : '#e5e7eb'}` }}>
                      <input type="radio" name="blockType" checked={!blockForm.isRecurring}
                        onChange={() => setBlockForm({ ...blockForm, isRecurring: false })} />
                      <span>📌 One-time</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '8px 14px', borderRadius: 8,
                      background: blockForm.isRecurring ? '#f0fdf4' : '#f9fafb', border: `2px solid ${blockForm.isRecurring ? '#86efac' : '#e5e7eb'}` }}>
                      <input type="radio" name="blockType" checked={blockForm.isRecurring}
                        onChange={() => setBlockForm({ ...blockForm, isRecurring: true })} />
                      <span>🔄 Every Week</span>
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
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
                    <option value="general">General Holiday</option>
                    <option value="hospital_specific">Hospital Specific</option>
                    <option value="emergency_closure">Emergency Closure</option>
                  </select>
                </div>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={holidayForm.isFullDay} onChange={e => setHolidayForm({ ...holidayForm, isFullDay: e.target.checked })} style={{ width: 18, height: 18 }} />
                    <span>{t('manageSchedule.fullDayClosure')}</span>
                  </label>
                </div>
                {!holidayForm.isFullDay && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
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

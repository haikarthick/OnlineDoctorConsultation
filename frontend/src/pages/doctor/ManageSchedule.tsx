import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { useSettings } from '../../context/SettingsContext'
import { VetSchedule } from '../../types'
import '../../styles/modules.css'
import { DateOverride, BlockedSlot, Holiday, CalendarDay, DAYS } from '../../components/manageSchedule/manageScheduleShared'
import WeeklyScheduleTab from '../../components/manageSchedule/WeeklyScheduleTab'
import CalendarTab from '../../components/manageSchedule/CalendarTab'
import TimeBlocksTab from '../../components/manageSchedule/TimeBlocksTab'
import HolidaysTab from '../../components/manageSchedule/HolidaysTab'
import ScheduleFormModal from '../../components/manageSchedule/ScheduleFormModal'
import OverrideModal from '../../components/manageSchedule/OverrideModal'
import VacationModal from '../../components/manageSchedule/VacationModal'
import BlockModal from '../../components/manageSchedule/BlockModal'
import HolidayModal from '../../components/manageSchedule/HolidayModal'

interface ManageScheduleProps {
  onNavigate: (path: string) => void
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

  const statTiles = [
    { label: t('manageSchedule.activeDays'), value: `${activeDays}/7`, colorClass: 'green', icon: '📅' },
    { label: t('manageSchedule.dateOverrides'), value: upcomingOverrides, colorClass: 'red', icon: '🚫' },
    { label: t('manageSchedule.timeBlocks'), value: `${recurringBlocks} ${t('manageSchedule.recurring')}`, colorClass: 'blue', icon: '⏰' },
    { label: t('manageSchedule.holidays'), value: upcomingHolidays, colorClass: 'amber', icon: '🎉' },
  ]

  const tabs: { key: typeof activeTab; label: string; subtitle: string }[] = [
    { key: 'weekly', label: `📅 ${t('manageSchedule.weeklySchedule')}`, subtitle: t('manageSchedule.recurringHours') },
    { key: 'calendar', label: `📆 ${t('manageSchedule.calendar')}`, subtitle: t('manageSchedule.dateOverridesSubtitle') },
    { key: 'blocks', label: `⏰ ${t('manageSchedule.timeBlocksTab')}`, subtitle: t('manageSchedule.blockSlots') },
    { key: 'holidays', label: `🎉 ${t('manageSchedule.holidays')}`, subtitle: t('manageSchedule.systemHolidays') },
  ]

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
        {statTiles.map((s, i) => (
          <div key={i} className="card si-54a779b9">
            <div className="si-2ae66f62">{s.icon}</div>
            <div className={`ms-stat-value color-${s.colorClass}`}>{s.value}</div>
            <div className="si-48a0b045">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="si-b2cab0f1">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`ms-tab-btn ${activeTab === tab.key ? 'is-active' : ''}`}>
            <div>{tab.label}</div>
            <div className="si-e79ab918">{tab.subtitle}</div>
          </button>
        ))}
      </div>

      {activeTab === 'weekly' && (
        <WeeklyScheduleTab
          schedules={schedules}
          formatSlotTime={formatSlotTime}
          onAddNew={() => { resetSchedForm(); setEditingSchedId(null); setSchedFormError(''); setShowSchedForm(true) }}
          onEdit={handleEditSched}
          onDelete={handleDeleteSched}
          onCopyDay={handleCopyDay}
        />
      )}

      {activeTab === 'calendar' && (
        <CalendarTab
          calMonth={calMonth}
          setCalMonth={setCalMonth}
          calendarDays={calendarDays}
          overrides={overrides}
          todayStr={todayStr}
          formatSlotTime={formatSlotTime}
          onOpenVacation={() => { setVacationForm({ startDate: '', endDate: '', reason: '' }); setShowVacationForm(true) }}
          onOpenOverride={() => { setOverrideForm({ overrideDate: '', overrideType: 'unavailable', startTime: '09:00', endTime: '17:00', slotDuration: 30, reason: '' }); setShowOverrideForm(true) }}
          onOpenOverrideForDate={(date) => { setOverrideForm({ overrideDate: date, overrideType: 'unavailable', startTime: '09:00', endTime: '17:00', slotDuration: 30, reason: '' }); setShowOverrideForm(true) }}
          onDeleteOverride={handleDeleteOverride}
        />
      )}

      {activeTab === 'blocks' && (
        <TimeBlocksTab
          blockedSlots={blockedSlots}
          formatSlotTime={formatSlotTime}
          onAddNew={() => { setBlockForm({ blockDate: '', startTime: '12:00', endTime: '13:00', reason: '', isRecurring: false, recurringDay: 'monday' }); setShowBlockForm(true) }}
          onDelete={handleDeleteBlock}
        />
      )}

      {activeTab === 'holidays' && (
        <HolidaysTab
          holidays={holidays}
          calMonth={calMonth}
          setCalMonth={setCalMonth}
          todayStr={todayStr}
          formatSlotTime={formatSlotTime}
          onAddNew={() => { setHolidayForm({ holidayDate: '', name: '', holidayType: 'general', isFullDay: true, startTime: '09:00', endTime: '17:00' }); setShowHolidayForm(true) }}
          onDelete={handleDeleteHoliday}
        />
      )}

      <ScheduleFormModal
        show={showSchedForm}
        onClose={() => setShowSchedForm(false)}
        editingSchedId={editingSchedId}
        schedForm={schedForm}
        setSchedForm={setSchedForm}
        schedFormError={schedFormError}
        submitting={submitting}
        onSubmit={handleSchedSubmit}
      />

      <OverrideModal
        show={showOverrideForm}
        onClose={() => setShowOverrideForm(false)}
        overrideForm={overrideForm}
        setOverrideForm={setOverrideForm}
        todayStr={todayStr}
        submitting={submitting}
        onSubmit={handleOverrideSubmit}
      />

      <VacationModal
        show={showVacationForm}
        onClose={() => setShowVacationForm(false)}
        vacationForm={vacationForm}
        setVacationForm={setVacationForm}
        todayStr={todayStr}
        submitting={submitting}
        onSubmit={handleVacationSubmit}
      />

      <BlockModal
        show={showBlockForm}
        onClose={() => setShowBlockForm(false)}
        blockForm={blockForm}
        setBlockForm={setBlockForm}
        todayStr={todayStr}
        submitting={submitting}
        onSubmit={handleBlockSubmit}
      />

      <HolidayModal
        show={showHolidayForm}
        onClose={() => setShowHolidayForm(false)}
        holidayForm={holidayForm}
        setHolidayForm={setHolidayForm}
        submitting={submitting}
        onSubmit={handleHolidaySubmit}
      />
    </div>
  )
}

export default ManageSchedule

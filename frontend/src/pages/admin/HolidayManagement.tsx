import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { useSettings } from '../../context/SettingsContext'
import './HolidayManagement.css'

interface Holiday {
  id: string; holidayDate: string; name: string; holidayType: string;
  isFullDay: boolean; startTime?: string; endTime?: string; createdAt: string;
}

const EMPTY_FORM = { holidayDate: '', name: '', holidayType: 'general', isFullDay: true, startTime: '09:00', endTime: '17:00' }
const TYPE_LABELS: Record<string, string> = { general: 'General', hospital_specific: 'Hospital Specific', emergency_closure: 'Emergency Closure' }
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function parseDate(raw: string): string {
  // Safely extract YYYY-MM-DD from ISO or DATE string
  return raw ? raw.toString().split('T')[0] : ''
}

function formatDisplayDate(raw: string, opts?: Intl.DateTimeFormatOptions): string {
  const dateStr = parseDate(raw)
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString('en-US', opts || { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

export default function HolidayManagement() {
  const { t } = useTranslation()
  const { formatSlotTime } = useSettings()
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(new Date().getFullYear())
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [pageMsg, setPageMsg] = useState<{ text: string; isError: boolean } | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  const msg = (text: string, isError = false) => { setPageMsg({ text, isError }); setTimeout(() => setPageMsg(null), 3500) }

  const loadHolidays = useCallback(async () => {
    try {
      setLoading(true)
      const res = await apiService.listHolidays({ year })
      setHolidays(res.data || [])
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [year])

  useEffect(() => { loadHolidays() }, [loadHolidays])

  // Filtered holidays
  const filtered = useMemo(() => {
    let list = holidays
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(h => h.name.toLowerCase().includes(q))
    }
    if (typeFilter !== 'all') {
      list = list.filter(h => h.holidayType === typeFilter)
    }
    return list
  }, [holidays, search, typeFilter])

  const todayStr = new Date().toISOString().split('T')[0]
  const upcoming = filtered.filter(h => parseDate(h.holidayDate) >= todayStr)
  const past = filtered.filter(h => parseDate(h.holidayDate) < todayStr)

  // Group holidays by month
  function groupByMonth(list: Holiday[]) {
    const groups: { month: number; holidays: Holiday[] }[] = []
    for (const h of list) {
      const m = parseInt(parseDate(h.holidayDate).split('-')[1], 10) - 1
      const last = groups[groups.length - 1]
      if (last && last.month === m) {
        last.holidays.push(h)
      } else {
        groups.push({ month: m, holidays: [h] })
      }
    }
    return groups
  }

  // Open add modal
  const openAdd = () => { setEditId(null); setForm({ ...EMPTY_FORM }); setShowModal(true) }

  // Open edit modal
  const openEdit = (h: Holiday) => {
    setEditId(h.id)
    setForm({
      holidayDate: parseDate(h.holidayDate),
      name: h.name,
      holidayType: h.holidayType,
      isFullDay: h.isFullDay,
      startTime: h.startTime || '09:00',
      endTime: h.endTime || '17:00',
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSubmitting(true)
      const payload = {
        holidayDate: form.holidayDate, name: form.name,
        holidayType: form.holidayType, isFullDay: form.isFullDay,
        ...(form.isFullDay ? {} : { startTime: form.startTime, endTime: form.endTime })
      }
      if (editId) {
        await apiService.updateHoliday(editId, payload)
        msg('Holiday updated ✓')
      } else {
        await apiService.createHoliday(payload)
        msg('Holiday added ✓')
      }
      setShowModal(false); loadHolidays()
    } catch (err: any) { msg(err?.response?.data?.message || 'Failed to save holiday', true) }
    finally { setSubmitting(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('holidayManagement.removeHolidayConfirm'))) return
    try { await apiService.deleteHoliday(id); loadHolidays(); msg('Holiday removed ✓') }
    catch { msg('Failed to remove', true) }
  }

  // Year range for dropdown
  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 21 }, (_, i) => currentYear - 5 + i)

  // Stats from unfiltered holidays
  const stats = [
    { label: t('holidayManagement.total'), value: holidays.length, color: '#ca8a04', icon: '📅' },
    { label: t('holidayManagement.upcoming'), value: holidays.filter(h => parseDate(h.holidayDate) >= todayStr).length, color: '#16a34a', icon: '🔜' },
    { label: t('holidayManagement.general'), value: holidays.filter(h => h.holidayType === 'general').length, color: '#2563eb', icon: '🌐' },
    { label: t('holidayManagement.hospital'), value: holidays.filter(h => h.holidayType === 'hospital_specific').length, color: '#f97316', icon: '🏥' },
    { label: t('holidayManagement.emergency'), value: holidays.filter(h => h.holidayType === 'emergency_closure').length, color: '#dc2626', icon: '🚨' },
  ]

  const renderTable = (list: Holiday[], isPast = false) => {
    if (list.length === 0) {
      return (
        <div className="empty-state">
          <div className="empty-icon">{isPast ? '📭' : '🎊'}</div>
          <div>{isPast ? t('holidayManagement.noPastHolidays') : t('holidayManagement.noUpcomingHolidays')} {t('holidayManagement.for')} {year}{search || typeFilter !== 'all' ? ' ' + t('holidayManagement.matchingFilters') : ''}.</div>
        </div>
      )
    }
    const groups = groupByMonth(list)
    return (
      <table className="holiday-table">
        <thead>
          <tr>
            <th>{t('holidayManagement.holidayName')}</th>
            <th>{t('holidayManagement.date')}</th>
            <th>{t('holidayManagement.type')}</th>
            <th>{t('holidayManagement.duration')}</th>
            <th style={{ textAlign: 'right' }}>{t('holidayManagement.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {groups.map(g => (
            <>
              <tr key={`m-${g.month}`} className="month-group-row">
                <td colSpan={5}>📆 {MONTH_NAMES[g.month]} {year}</td>
              </tr>
              {g.holidays.map(h => (
                <tr key={h.id}>
                  <td className="td-name">{h.name}</td>
                  <td className="td-date">{formatDisplayDate(h.holidayDate)}</td>
                  <td>
                    <span className={`type-badge ${h.holidayType}`}>
                      {TYPE_LABELS[h.holidayType] || h.holidayType}
                    </span>
                  </td>
                  <td>
                    {h.isFullDay
                      ? <span className="time-info">{t('holidayManagement.fullDay')}</span>
                      : <span className="time-info partial">{formatSlotTime(h.startTime || '')} – {formatSlotTime(h.endTime || '')}</span>
                    }
                  </td>
                  <td className="td-actions">
                    <button className="btn-edit" onClick={() => openEdit(h)} title={t('holidayManagement.edit')}>✏️ {t('holidayManagement.edit')}</button>
                    <button className="btn-delete" onClick={() => handleDelete(h.id)} title={t('holidayManagement.delete')}>🗑️ {t('holidayManagement.delete')}</button>
                  </td>
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>
    )
  }

  if (loading) {
    return <div className="module-page"><div className="loading-container"><div className="loading-spinner" /><p>{t('holidayManagement.loading')}</p></div></div>
  }

  return (
    <div className="module-page holiday-page">
      <div className="page-header">
        <div>
          <h1>🎉 {t('holidayManagement.title')}</h1>
          <p className="page-subtitle">{t('holidayManagement.subtitle')}</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={openAdd}>+ {t('holidayManagement.addHoliday')}</button>
        </div>
      </div>

      {pageMsg && <div className={`modal-alert ${pageMsg.isError ? 'error' : 'success'}`} style={{ marginBottom: 16 }}>{pageMsg.text}</div>}

      {/* Stats */}
      <div className="holiday-stats">
        {stats.map((s, i) => (
          <div key={i} className="holiday-stat-card">
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar: Search + Type filter + Year nav */}
      <div className="holiday-toolbar">
        <div className="holiday-search">
          <span className="search-icon">🔍</span>
          <input
            placeholder={t('holidayManagement.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="holiday-type-filter">
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="all">{t('holidayManagement.allTypes')}</option>
            <option value="general">{t('holidayManagement.general')}</option>
            <option value="hospital_specific">{t('holidayManagement.hospitalSpecific')}</option>
            <option value="emergency_closure">{t('holidayManagement.emergencyClosure')}</option>
          </select>
        </div>
        <div className="year-nav">
          <button onClick={() => setYear(y => y - 1)} title={t('holidayManagement.previousYear')}>◀</button>
          <select value={year} onChange={e => setYear(Number(e.target.value))}>
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => setYear(y => y + 1)} title={t('holidayManagement.nextYear')}>▶</button>
          <button className={year === currentYear ? 'active' : ''} onClick={() => setYear(currentYear)}>{t('holidayManagement.today')}</button>
        </div>
      </div>

      {/* Upcoming Holidays */}
      <div className="section-header">
        <h3>🔜 {t('holidayManagement.upcomingHolidays')}</h3>
        <span className="section-count">{upcoming.length}</span>
      </div>
      {renderTable(upcoming)}

      {/* Past Holidays */}
      <div className="section-header past">
        <h3>📋 {t('holidayManagement.pastHolidays')}</h3>
        <span className="section-count">{past.length}</span>
      </div>
      <div className="past-section">
        {renderTable(past, true)}
      </div>

      {/* Add/Edit Holiday Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editId ? '✏️ ' + t('holidayManagement.editHoliday') : '🎉 ' + t('holidayManagement.addHolidayTitle')}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label">{t('holidayManagement.holidayNameLabel')}</label>
                  <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder={t('holidayManagement.holidayNamePlaceholder')} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">{t('holidayManagement.dateLabel')}</label>
                    <input className="form-input" type="date" value={form.holidayDate}
                      onChange={e => setForm({ ...form, holidayDate: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('holidayManagement.typeLabel')}</label>
                    <select className="form-input" value={form.holidayType} onChange={e => setForm({ ...form, holidayType: e.target.value })}>
                      <option value="general">{t('holidayManagement.generalHoliday')}</option>
                      <option value="hospital_specific">{t('holidayManagement.hospitalSpecificType')}</option>
                      <option value="emergency_closure">{t('holidayManagement.emergencyClosureType')}</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.isFullDay} onChange={e => setForm({ ...form, isFullDay: e.target.checked })} style={{ width: 18, height: 18 }} />
                    <span>{t('holidayManagement.fullDayClosure')}</span>
                  </label>
                </div>
                {!form.isFullDay && (
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">{t('holidayManagement.startTime')}</label>
                      <input className="form-input" type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('holidayManagement.endTime')}</label>
                      <input className="form-input" type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} />
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
                  <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>{t('holidayManagement.cancel')}</button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? t('holidayManagement.saving') : editId ? t('holidayManagement.updateHoliday') : t('holidayManagement.addHoliday')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

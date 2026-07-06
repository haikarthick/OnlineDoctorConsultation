import React, { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { useSettings } from '../../context/SettingsContext'
import { SystemSetting, GatewaySettings } from '../../types'
import '../../styles/modules.css'

interface SystemSettingsProps {
  onNavigate: (path: string) => void
}

// Keys managed by dedicated UI cards — excluded from the generic table
const MANAGED_KEYS = new Set([
  'display.timeFormat',
  'display.dateFormat',
  'consultation.joinWindowMinutes',
  'consultation.maxDurationMinutes',
  'booking.maxReschedules',
  'booking.patientNoShowRescheduleLimit',
  'booking.advanceBookingDays',
  'booking.cancellationWindowHours',
  // Legacy aliases from seed.sql — same concepts, different key names
  'max_booking_days_ahead',
  'default_slot_duration',
  'payment.currency',
  'payment.gatewayMode',
  'payment.gatewayUrl',
  'payment.gatewayApiKey',
  'payment.gatewayProvider',
  'cancellation.autoRefundOnDoctorCancel',
  'cancellation.patientFreeWindowHours',
  'cancellation.partialRefundPercent',
  'cancellation.partialRefundWindowHours',
  'cancellation.goodwillBonusPercent',
  'cancellation.doctorMaxCancellationsPerMonth',
  'email.devRedirect',
  'email.fromName',
  'email.fromAddress',
  'maintenance.enabled',
  'maintenance.message',
])

const inputStyle: React.CSSProperties = { color: '#111827', WebkitTextFillColor: '#111827' }

const SystemSettings: React.FC<SystemSettingsProps> = ({ onNavigate }) => {
  const { t } = useTranslation()
  const { settings: appSettings, reloadSettings, formatCurrency } = useSettings()
  const [settings, setSettings] = useState<SystemSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [newSetting, setNewSetting] = useState({ key: '', value: '', description: '' })
  const [showAdd, setShowAdd] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSection, setActiveSection] = useState<string | null>(null)

  // Dedicated card state
  const [timeFormat, setTimeFormat] = useState(appSettings.timeFormat)
  const [savingTimeFormat, setSavingTimeFormat] = useState(false)
  const [timeFormatSaved, setTimeFormatSaved] = useState(false)
  const [joinWindow, setJoinWindow] = useState(appSettings.joinWindowMinutes)
  const [savingJoinWindow, setSavingJoinWindow] = useState(false)
  const [joinWindowSaved, setJoinWindowSaved] = useState(false)
  const [patientNoShowLimit, setPatientNoShowLimit] = useState(appSettings.patientNoShowRescheduleLimit)
  const [savingPatientLimit, setSavingPatientLimit] = useState(false)
  const [patientLimitSaved, setPatientLimitSaved] = useState(false)

  // Currency state
  const [selectedCurrency, setSelectedCurrency] = useState(appSettings.currency || 'INR')
  const [savingCurrency, setSavingCurrency] = useState(false)
  const [currencySaved, setCurrencySaved] = useState(false)

  // Payment Gateway state
  const [gatewayMode, setGatewayMode] = useState(appSettings.paymentGatewayMode || 'demo')
  const [gatewayUrl, setGatewayUrl] = useState('')
  const [gatewayApiKey, setGatewayApiKey] = useState('')
  const [gatewayProvider, setGatewayProvider] = useState('stripe')
  const [savingGateway, setSavingGateway] = useState(false)
  const [gatewaySaved, setGatewaySaved] = useState(false)

  // Cancellation Policy state
  const [cancellationPolicy, setCancellationPolicy] = useState(appSettings.cancellationPolicy)
  const [savingCancellation, setSavingCancellation] = useState(false)
  const [cancellationSaved, setCancellationSaved] = useState(false)

  // Additional managed settings state (loaded from DB)
  const [dateFormat, setDateFormat] = useState('MMM d, yyyy')
  const [maxDurationMinutes, setMaxDurationMinutes] = useState(60)
  const [advanceBookingDays, setAdvanceBookingDays] = useState(60)
  const [cancellationWindowHours, setCancellationWindowHours] = useState(24)
  const [maxReschedules, setMaxReschedules] = useState(1)

  // Email settings card state
  const [emailDevRedirect, setEmailDevRedirect] = useState('')
  const [emailFromName, setEmailFromName] = useState('VetCare')
  const [emailFromAddress, setEmailFromAddress] = useState('noreply@vetcare.app')
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailSaved, setEmailSaved] = useState(false)
  const [testEmailTo, setTestEmailTo] = useState('')
  const [testEmailSending, setTestEmailSending] = useState(false)
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message: string; previewUrl?: string | null } | null>(null)

  // Maintenance mode state
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false)
  const [maintenanceMessage, setMaintenanceMessage] = useState('System is temporarily unavailable for maintenance. Please try again later.')
  const [savingMaintenance, setSavingMaintenance] = useState(false)
  const [maintenanceSaved, setMaintenanceSaved] = useState(false)

  // Email Templates state
  const [emailTemplates, setEmailTemplates] = useState<Record<string, {subject: string, body: string}>>({})
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null)
  const [templateDraft, setTemplateDraft] = useState({ subject: '', body: '' })
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateSaved, setTemplatesSaved] = useState(false)

  useEffect(() => {
    loadSettings()
    loadGatewaySettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const result = await apiService.adminGetSettings()
      const list: SystemSetting[] = result.data || []
      setSettings(list)
      // Hydrate additional card-managed settings from DB
      const find = (k: string) => list.find(s => s.key === k)?.value
      if (find('display.dateFormat')) setDateFormat(find('display.dateFormat')!)
      if (find('consultation.maxDurationMinutes')) setMaxDurationMinutes(parseInt(find('consultation.maxDurationMinutes')!, 10) || 60)
      if (find('booking.advanceBookingDays')) setAdvanceBookingDays(parseInt(find('booking.advanceBookingDays')!, 10) || 60)
      if (find('booking.cancellationWindowHours')) setCancellationWindowHours(parseInt(find('booking.cancellationWindowHours')!, 10) || 24)
      if (find('booking.maxReschedules')) setMaxReschedules(parseInt(find('booking.maxReschedules')!, 10) || 1)
      if (find('payment.currency')) setSelectedCurrency(find('payment.currency')!)
      if (find('email.devRedirect') !== undefined) setEmailDevRedirect(find('email.devRedirect') || '')
      if (find('email.fromName')) setEmailFromName(find('email.fromName')!)
      if (find('email.fromAddress')) setEmailFromAddress(find('email.fromAddress')!)
      if (find('maintenance.enabled')) setMaintenanceEnabled(find('maintenance.enabled')!.trim().toLowerCase() === 'true')
      if (find('maintenance.message')) setMaintenanceMessage(find('maintenance.message')!)
      // Load email templates
      try {
        const tmplRes = await fetch('/api/v1/admin/email-templates', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        const tmplData = await tmplRes.json()
        if (tmplData.success) {
          const defaults: Record<string, {subject: string, body: string}> = {
            booking_confirmation: { subject: 'Booking Confirmed', body: 'Your appointment has been confirmed for {{date}} at {{time}} with {{vetName}}' },
            booking_cancellation: { subject: 'Booking Cancelled', body: 'Your appointment on {{date}} has been cancelled. Reason: {{reason}}' },
            booking_reminder: { subject: 'Appointment Reminder', body: 'Reminder: You have an appointment tomorrow at {{time}} with {{vetName}}' },
            password_reset: { subject: 'Password Reset', body: 'Use this link to reset your password: {{resetLink}}' },
            staff_invite: { subject: 'Staff Invitation', body: 'You have been invited to join {{networkName}} as {{role}}' },
          }
          const loaded: Record<string, {subject: string, body: string}> = {}
          const rawTemplates = tmplData.data || {}
          Object.keys(defaults).forEach(k => {
            try { loaded[k] = rawTemplates[k] ? JSON.parse(rawTemplates[k]) : defaults[k] }
            catch { loaded[k] = defaults[k] }
          })
          setEmailTemplates(loaded)
        }
      } catch { /* non-fatal */ }
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return
    try {
      setSavingTemplate(true)
      await fetch(`/api/v1/admin/email-templates/${editingTemplate}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify(templateDraft)
      })
      setEmailTemplates(prev => ({ ...prev, [editingTemplate]: templateDraft }))
      setEditingTemplate(null)
      setTemplatesSaved(true)
      setTimeout(() => setTemplatesSaved(false), 3000)
    } catch { /* non-fatal */ } finally {
      setSavingTemplate(false)
    }
  }

  const handleSave = async (key: string) => {
    try {
      setSaving(true)
      await apiService.adminUpdateSetting(key, editValue)
      setSettings(settings.map(s => s.key === key ? { ...s, value: editValue } : s))
      setEditingKey(null)
      await reloadSettings()
    } catch {
    } finally {
      setSaving(false)
    }
  }

  const handleAddSetting = async () => {
    if (!newSetting.key || !newSetting.value) return
    try {
      setSaving(true)
      await apiService.adminUpdateSetting(newSetting.key, newSetting.value)
      setSettings([...settings, { ...newSetting, updatedAt: new Date().toISOString() }])
      setNewSetting({ key: '', value: '', description: '' })
      setShowAdd(false)
    } catch {
    } finally {
      setSaving(false)
    }
  }

  const handleTimeFormatChange = async (newFormat: '12h' | '24h') => {
    try {
      setSavingTimeFormat(true)
      setTimeFormatSaved(false)
      await apiService.adminUpdateSetting('display.timeFormat', newFormat)
      setTimeFormat(newFormat)
      setSettings(settings.map(s => s.key === 'display.timeFormat' ? { ...s, value: newFormat } : s))
      await reloadSettings()
      setTimeFormatSaved(true)
      setTimeout(() => setTimeFormatSaved(false), 3000)
    } catch {
    } finally {
      setSavingTimeFormat(false)
    }
  }

  const handleJoinWindowChange = async (minutes: number) => {
    try {
      setSavingJoinWindow(true)
      setJoinWindowSaved(false)
      await apiService.adminUpdateSetting('consultation.joinWindowMinutes', String(minutes))
      setJoinWindow(minutes)
      setSettings(settings.map(s => s.key === 'consultation.joinWindowMinutes' ? { ...s, value: String(minutes) } : s))
      await reloadSettings()
      setJoinWindowSaved(true)
      setTimeout(() => setJoinWindowSaved(false), 3000)
    } catch {
    } finally {
      setSavingJoinWindow(false)
    }
  }

  const handlePatientNoShowLimitChange = async (limit: number) => {
    try {
      setSavingPatientLimit(true)
      setPatientLimitSaved(false)
      await apiService.adminUpdateSetting('booking.patientNoShowRescheduleLimit', String(limit))
      setPatientNoShowLimit(limit)
      setSettings(settings.map(s => s.key === 'booking.patientNoShowRescheduleLimit' ? { ...s, value: String(limit) } : s))
      await reloadSettings()
      setPatientLimitSaved(true)
      setTimeout(() => setPatientLimitSaved(false), 3000)
    } catch {
    } finally {
      setSavingPatientLimit(false)
    }
  }

  const loadGatewaySettings = async () => {
    try {
      const result = await apiService.adminGetGatewaySettings()
      const gw = result.data as GatewaySettings
      if (gw) {
        setGatewayMode(gw.gatewayMode || 'demo')
        setGatewayUrl(gw.gatewayUrl || '')
        setGatewayApiKey(gw.gatewayApiKey || '')
        setGatewayProvider(gw.gatewayProvider || 'stripe')
      }
    } catch { /* ignore */ }
  }

  const handleSaveGateway = async () => {
    try {
      setSavingGateway(true)
      setGatewaySaved(false)
      await Promise.all([
        apiService.adminUpdateSetting('payment.gatewayMode', gatewayMode),
        apiService.adminUpdateSetting('payment.gatewayUrl', gatewayUrl),
        apiService.adminUpdateSetting('payment.gatewayApiKey', gatewayApiKey),
        apiService.adminUpdateSetting('payment.gatewayProvider', gatewayProvider),
      ])
      await reloadSettings()
      setGatewaySaved(true)
      setTimeout(() => setGatewaySaved(false), 3000)
    } catch {
    } finally {
      setSavingGateway(false)
    }
  }

  const handleSaveCurrency = async (code: string) => {
    try {
      setSavingCurrency(true)
      setCurrencySaved(false)
      setSelectedCurrency(code)
      await apiService.adminUpdateSetting('payment.currency', code)
      setSettings(settings.map(s => s.key === 'payment.currency' ? { ...s, value: code } : s))
      await reloadSettings()
      setCurrencySaved(true)
      setTimeout(() => setCurrencySaved(false), 3000)
    } catch {
    } finally {
      setSavingCurrency(false)
    }
  }

  const handleSaveCancellation = async () => {
    try {
      setSavingCancellation(true)
      setCancellationSaved(false)
      await Promise.all([
        apiService.adminUpdateSetting('cancellation.autoRefundOnDoctorCancel', String(cancellationPolicy.autoRefundOnDoctorCancel)),
        apiService.adminUpdateSetting('cancellation.patientFreeWindowHours', String(cancellationPolicy.patientFreeWindowHours)),
        apiService.adminUpdateSetting('cancellation.partialRefundPercent', String(cancellationPolicy.partialRefundPercent)),
        apiService.adminUpdateSetting('cancellation.partialRefundWindowHours', String(cancellationPolicy.partialRefundWindowHours)),
        apiService.adminUpdateSetting('cancellation.goodwillBonusPercent', String(cancellationPolicy.goodwillBonusPercent)),
        apiService.adminUpdateSetting('cancellation.doctorMaxCancellationsPerMonth', String(cancellationPolicy.doctorMaxCancellationsPerMonth)),
      ])
      await reloadSettings()
      setCancellationSaved(true)
      setTimeout(() => setCancellationSaved(false), 3000)
    } catch {
    } finally {
      setSavingCancellation(false)
    }
  }

  const handleSaveEmailSettings = async () => {
    try {
      setEmailSaving(true)
      setEmailSaved(false)
      await Promise.all([
        apiService.adminUpdateSetting('email.devRedirect', emailDevRedirect),
        apiService.adminUpdateSetting('email.fromName', emailFromName),
        apiService.adminUpdateSetting('email.fromAddress', emailFromAddress),
      ])
      setEmailSaved(true)
      setTimeout(() => setEmailSaved(false), 3000)
    } catch {
    } finally {
      setEmailSaving(false)
    }
  }

  const handleSendTestEmail = async () => {
    if (!testEmailTo) return
    try {
      setTestEmailSending(true)
      setTestEmailResult(null)
      const res = await apiService.adminSendTestEmail(testEmailTo)
      setTestEmailResult({ success: true, message: res.message || 'Sent', previewUrl: res.data?.previewUrl })
    } catch (err: any) {
      setTestEmailResult({ success: false, message: err.response?.data?.message || err.message || 'Failed' })
    } finally {
      setTestEmailSending(false)
    }
  }

  const handleSaveMaintenance = async () => {
    try {
      setSavingMaintenance(true)
      setMaintenanceSaved(false)
      await Promise.all([
        apiService.adminUpdateSetting('maintenance.enabled', String(maintenanceEnabled)),
        apiService.adminUpdateSetting('maintenance.message', maintenanceMessage),
      ])
      setMaintenanceSaved(true)
      setTimeout(() => setMaintenanceSaved(false), 3000)
    } catch {
    } finally {
      setSavingMaintenance(false)
    }
  }

  // Generic inline-save helper for card-managed settings
  const [savingInline, setSavingInline] = useState<string | null>(null)
  const [savedInline, setSavedInline] = useState<string | null>(null)
  const saveInlineSetting = async (key: string, value: string) => {
    try {
      setSavingInline(key)
      await apiService.adminUpdateSetting(key, value)
      setSettings(prev => prev.map(s => s.key === key ? { ...s, value } : s))
      await reloadSettings()
      setSavedInline(key)
      setTimeout(() => setSavedInline(null), 3000)
    } catch {
    } finally {
      setSavingInline(null)
    }
  }

  // Filter out managed keys and apply search
  const unmanagedSettings = useMemo(() => {
    return settings.filter(s => !MANAGED_KEYS.has(s.key))
  }, [settings])

  const filteredSettings = useMemo(() => {
    if (!searchQuery.trim()) return unmanagedSettings
    const q = searchQuery.toLowerCase()
    return unmanagedSettings.filter(s =>
      s.key.toLowerCase().includes(q) ||
      s.value.toLowerCase().includes(q) ||
      (s.description && s.description.toLowerCase().includes(q))
    )
  }, [unmanagedSettings, searchQuery])

  // Group filtered settings by category
  const groupedSettings = useMemo(() => {
    const grouped: Record<string, SystemSetting[]> = {}
    filteredSettings.forEach(s => {
      const category = s.key.split('.')[0] || 'general'
      if (!grouped[category]) grouped[category] = []
      grouped[category].push(s)
    })
    return grouped
  }, [filteredSettings])

  // Section nav labels for quick jump
  const sections = [
    { id: 'maintenance', label: '🚧 Maintenance', icon: '🚧' },
    { id: 'display', label: '🕐 Display', icon: '🕐' },
    { id: 'consultation', label: '🩺 Consultation', icon: '🩺' },
    { id: 'booking', label: '📅 Booking', icon: '📅' },
    { id: 'payment', label: '💳 Payment', icon: '💳' },
    { id: 'cancellation', label: '🔄 Cancellation', icon: '🔄' },
    { id: 'other', label: '⚙️ Other', icon: '⚙️' },
  ]

  // Check if dedicated card sections match search
  const matchesSearch = (text: string) => {
    if (!searchQuery.trim()) return true
    return text.toLowerCase().includes(searchQuery.toLowerCase())
  }

  const showMaintenanceCard = matchesSearch('maintenance mode enabled message')
  const showDisplayCard = matchesSearch('display time format 12h 24h date format')
  const showConsultationCard = matchesSearch('consultation join window minutes duration max')
  const showBookingCard = matchesSearch('booking no-show reschedule patient doctor limit advance days cancellation window hours')
  const showCurrencyCard = matchesSearch('payment currency INR USD EUR GBP AUD CAD JPY')
  const showPaymentCard = matchesSearch('payment gateway mode provider url api key stripe demo test live')
  const showCancellationCard = matchesSearch('cancellation refund policy goodwill bonus patient doctor')

  const scrollToSection = (id: string) => {
    setActiveSection(id)
    const el = document.getElementById(`settings-section-${id}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="module-page" style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header" style={{ flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ color: '#111827' }}>{t('systemSettings.title')}</h1>
          <p className="page-subtitle">{t('systemSettings.subtitle', { count: settings.length })}</p>
        </div>
        <div className="page-header-actions" style={{ flexWrap: 'wrap', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ {t('systemSettings.addSetting')}</button>
          <button
            className="btn btn-outline"
            onClick={() => onNavigate('/admin/prescription-settings')}
            style={{ borderColor: '#2b6cb0', color: '#2b6cb0' }}
          >
            📄 {t('systemSettings.prescriptionTemplate')}
          </button>
          <button
            className="btn btn-outline"
            onClick={() => onNavigate('/admin/certificate-settings')}
            style={{ borderColor: '#2d3748', color: '#2d3748' }}
          >
            📋 {t('systemSettings.certificateTemplate')}
          </button>
          <button className="btn btn-outline" onClick={() => onNavigate('/admin/dashboard')}>← {t('systemSettings.dashboard')}</button>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'linear-gradient(135deg, #f5f7fa 0%, #fafbfc 100%)',
        paddingBottom: 16, marginBottom: 16
      }}>
        <div style={{
          display: 'flex', gap: 12, alignItems: 'center',
          background: 'white', borderRadius: 12,
          border: '1px solid #e5e7eb', padding: '8px 16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
        }}>
          <span style={{ fontSize: 18, color: '#9ca3af' }}>🔍</span>
          <input
            type="text"
            placeholder={t('systemSettings.searchPlaceholder')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              flex: 1, border: 'none', outline: 'none', fontSize: 15, padding: '8px 0',
              background: 'transparent', color: '#111827', WebkitTextFillColor: '#111827'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                background: '#f3f4f6', border: 'none', borderRadius: 6,
                padding: '4px 10px', fontSize: 13, cursor: 'pointer',
                color: '#6b7280', WebkitTextFillColor: '#6b7280'
              }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Quick nav pills */}
        <div style={{
          display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap'
        }}>
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => scrollToSection(s.id)}
              style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500,
                border: activeSection === s.id ? '1px solid #2563eb' : '1px solid #e5e7eb',
                background: activeSection === s.id ? '#eff6ff' : 'white',
                color: activeSection === s.id ? '#2563eb' : '#4b5563',
                WebkitTextFillColor: activeSection === s.id ? '#2563eb' : '#4b5563',
                cursor: 'pointer', transition: 'all 0.15s'
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Add Setting Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h2 style={{ color: '#111827' }}>{t('systemSettings.addSetting')}</h2>
              <button className="modal-close" onClick={() => setShowAdd(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">{t('systemSettings.key')}</label>
                <input className="form-input" placeholder="e.g. system.maintenance_mode" value={newSetting.key}
                  onChange={e => setNewSetting({ ...newSetting, key: e.target.value })} style={inputStyle} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('systemSettings.value')}</label>
                <input className="form-input" placeholder={t('systemSettings.settingValuePlaceholder')} value={newSetting.value}
                  onChange={e => setNewSetting({ ...newSetting, value: e.target.value })} style={inputStyle} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('systemSettings.description')}</label>
                <input className="form-input" placeholder={t('systemSettings.descriptionPlaceholder')} value={newSetting.description}
                  onChange={e => setNewSetting({ ...newSetting, description: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                <button className="btn btn-outline" onClick={() => setShowAdd(false)}>{t('systemSettings.cancel')}</button>
                <button className="btn btn-primary" disabled={saving} onClick={handleAddSetting}>
                  {saving ? t('systemSettings.saving') : t('systemSettings.addSetting')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Maintenance Mode ─── */}
      {showMaintenanceCard && (
        <div id="settings-section-maintenance" className="card" style={{ marginBottom: 20 }}>
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ color: '#111827' }}>🚧 {t('systemSettings.maintenanceMode')}</h2>
            {maintenanceEnabled && (
              <span style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                🔴 ACTIVE
              </span>
            )}
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <h3 style={{ margin: 0, fontSize: 15, color: '#111827' }}>{t('systemSettings.maintenanceEnabled')}</h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
                  {t('systemSettings.maintenanceActive')}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className={`btn btn-sm ${maintenanceEnabled ? 'btn-primary' : 'btn-outline'}`}
                  style={maintenanceEnabled ? { background: '#dc2626', borderColor: '#dc2626' } : {}}
                  onClick={() => setMaintenanceEnabled(true)}>🔴 Enabled</button>
                <button
                  className={`btn btn-sm ${!maintenanceEnabled ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setMaintenanceEnabled(false)}>✅ Disabled</button>
              </div>
            </div>
            <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px 0' }}>
              <label className="module-label">{t('systemSettings.maintenanceMessage')}</label>
              <textarea
                className="module-input"
                rows={3}
                value={maintenanceMessage}
                onChange={e => setMaintenanceMessage(e.target.value)}
                placeholder="Message shown to users during maintenance..."
                style={{ marginTop: 8, ...inputStyle }}
              />
            </div>
            {maintenanceEnabled && (
              <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b', marginBottom: 12 }}>
                ⚠️ <strong>Maintenance mode is ON.</strong> Non-admin users will see a maintenance page. {t('systemSettings.maintenanceBypass')}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
              {maintenanceSaved && <span style={{ fontSize: 12, color: '#059669', fontWeight: 600, paddingTop: 8 }}>✅ Saved!</span>}
              <button className="btn btn-primary" disabled={savingMaintenance} onClick={handleSaveMaintenance}>
                {savingMaintenance ? t('systemSettings.saving') : '🚧 Save Maintenance Settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Display Settings ─── */}
      {showDisplayCard && (
        <div id="settings-section-display" className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><h2 style={{ color: '#111827' }}>🕐 {t('systemSettings.displaySettings')}</h2></div>
          <div className="card-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <h3 style={{ margin: 0, fontSize: 15, color: '#111827' }}>{t('systemSettings.timeFormat')}</h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
                  {t('systemSettings.timeFormatDesc')}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button className={`btn btn-sm ${timeFormat === '12h' ? 'btn-primary' : 'btn-outline'}`}
                  disabled={savingTimeFormat} onClick={() => handleTimeFormatChange('12h')}>12h (AM/PM)</button>
                <button className={`btn btn-sm ${timeFormat === '24h' ? 'btn-primary' : 'btn-outline'}`}
                  disabled={savingTimeFormat} onClick={() => handleTimeFormatChange('24h')}>24 Hour</button>
                {savingTimeFormat && <span style={{ fontSize: 12, color: '#6b7280' }}>{t('systemSettings.saving')}</span>}
                {timeFormatSaved && <span style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>✅ Saved!</span>}
              </div>
            </div>
            <div style={{ padding: '8px 0', borderTop: '1px solid #f3f4f6' }}>
              <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
                <strong>Preview:</strong>{' '}
                {timeFormat === '12h'
                  ? new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
                  : new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
              </p>
            </div>

            {/* Date Format */}
            <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <h3 style={{ margin: 0, fontSize: 15, color: '#111827' }}>{t('systemSettings.dateFormat')}</h3>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>{t('systemSettings.dateFormatDesc')}</p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {['MMM d, yyyy', 'dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd'].map(fmt => (
                    <button key={fmt} className={`btn btn-sm ${dateFormat === fmt ? 'btn-primary' : 'btn-outline'}`}
                      disabled={savingInline === 'display.dateFormat'}
                      onClick={() => { setDateFormat(fmt); saveInlineSetting('display.dateFormat', fmt) }}>
                      {fmt}
                    </button>
                  ))}
                  {savingInline === 'display.dateFormat' && <span style={{ fontSize: 12, color: '#6b7280' }}>Saving...</span>}
                  {savedInline === 'display.dateFormat' && <span style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>✅ Saved!</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Consultation Settings ─── */}
      {showConsultationCard && (
        <div id="settings-section-consultation" className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><h2 style={{ color: '#111827' }}>🩺 {t('systemSettings.consultationSettings')}</h2></div>
          <div className="card-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <h3 style={{ margin: 0, fontSize: 15, color: '#111827' }}>{t('systemSettings.joinWindow')}</h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
                  {t('systemSettings.joinWindowDesc')}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {[5, 10, 15, 30].map(mins => (
                  <button key={mins} className={`btn btn-sm ${joinWindow === mins ? 'btn-primary' : 'btn-outline'}`}
                    disabled={savingJoinWindow} onClick={() => handleJoinWindowChange(mins)}>{mins} min</button>
                ))}
                <input type="number" className="form-input"
                  style={{ width: 70, padding: '4px 8px', fontSize: 13, textAlign: 'center', ...inputStyle }}
                  value={joinWindow} min={0} max={120} disabled={savingJoinWindow}
                  onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 0 && v <= 120) setJoinWindow(v) }}
                  onBlur={() => handleJoinWindowChange(joinWindow)}
                  onKeyDown={e => { if (e.key === 'Enter') handleJoinWindowChange(joinWindow) }} />
                {savingJoinWindow && <span style={{ fontSize: 12, color: '#6b7280' }}>{t('systemSettings.saving')}</span>}
                {joinWindowSaved && <span style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>✅ Saved!</span>}
              </div>
            </div>
            <div style={{ padding: '8px 0', borderTop: '1px solid #f3f4f6' }}>
              <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
                <strong>Current:</strong> Join/Start available <strong>{joinWindow} minutes</strong> before appointment.
                {joinWindow === 0 && ' (0 = always available)'}
              </p>
            </div>

            {/* Max Duration */}
            <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <h3 style={{ margin: 0, fontSize: 15, color: '#111827' }}>{t('systemSettings.maxDuration')}</h3>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>{t('systemSettings.maxDurationDesc')}</p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {[30, 45, 60, 90].map(mins => (
                    <button key={mins} className={`btn btn-sm ${maxDurationMinutes === mins ? 'btn-primary' : 'btn-outline'}`}
                      disabled={savingInline === 'consultation.maxDurationMinutes'}
                      onClick={() => { setMaxDurationMinutes(mins); saveInlineSetting('consultation.maxDurationMinutes', String(mins)) }}>
                      {mins} min
                    </button>
                  ))}
                  <input type="number" className="form-input"
                    style={{ width: 70, padding: '4px 8px', fontSize: 13, textAlign: 'center', ...inputStyle }}
                    value={maxDurationMinutes} min={10} max={240}
                    disabled={savingInline === 'consultation.maxDurationMinutes'}
                    onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 10 && v <= 240) setMaxDurationMinutes(v) }}
                    onBlur={() => saveInlineSetting('consultation.maxDurationMinutes', String(maxDurationMinutes))}
                    onKeyDown={e => { if (e.key === 'Enter') saveInlineSetting('consultation.maxDurationMinutes', String(maxDurationMinutes)) }} />
                  {savingInline === 'consultation.maxDurationMinutes' && <span style={{ fontSize: 12, color: '#6b7280' }}>Saving...</span>}
                  {savedInline === 'consultation.maxDurationMinutes' && <span style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>✅ Saved!</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Booking Settings ─── */}
      {showBookingCard && (
        <div id="settings-section-booking" className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><h2 style={{ color: '#111827' }}>📅 {t('systemSettings.bookingSettings')}</h2></div>
          <div className="card-body">
            {/* Advance Booking Days */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <h3 style={{ margin: 0, fontSize: 15, color: '#111827' }}>{t('systemSettings.advanceBooking')}</h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>{t('systemSettings.advanceBookingDesc')}</p>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {[7, 14, 30, 60, 90].map(d => (
                  <button key={d} className={`btn btn-sm ${advanceBookingDays === d ? 'btn-primary' : 'btn-outline'}`}
                    disabled={savingInline === 'booking.advanceBookingDays'}
                    onClick={() => { setAdvanceBookingDays(d); saveInlineSetting('booking.advanceBookingDays', String(d)) }}>
                    {d}d
                  </button>
                ))}
                <input type="number" className="form-input"
                  style={{ width: 70, padding: '4px 8px', fontSize: 13, textAlign: 'center', ...inputStyle }}
                  value={advanceBookingDays} min={1} max={365}
                  disabled={savingInline === 'booking.advanceBookingDays'}
                  onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 1 && v <= 365) setAdvanceBookingDays(v) }}
                  onBlur={() => saveInlineSetting('booking.advanceBookingDays', String(advanceBookingDays))}
                  onKeyDown={e => { if (e.key === 'Enter') saveInlineSetting('booking.advanceBookingDays', String(advanceBookingDays)) }} />
                {savingInline === 'booking.advanceBookingDays' && <span style={{ fontSize: 12, color: '#6b7280' }}>Saving...</span>}
                {savedInline === 'booking.advanceBookingDays' && <span style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>✅ Saved!</span>}
              </div>
            </div>

            {/* Cancellation Window Hours */}
            <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <h3 style={{ margin: 0, fontSize: 15, color: '#111827' }}>{t('systemSettings.freeCancellationWindow')}</h3>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>{t('systemSettings.freeCancellationWindowDesc')}</p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {[6, 12, 24, 48].map(h => (
                    <button key={h} className={`btn btn-sm ${cancellationWindowHours === h ? 'btn-primary' : 'btn-outline'}`}
                      disabled={savingInline === 'booking.cancellationWindowHours'}
                      onClick={() => { setCancellationWindowHours(h); saveInlineSetting('booking.cancellationWindowHours', String(h)) }}>
                      {h}h
                    </button>
                  ))}
                  {savingInline === 'booking.cancellationWindowHours' && <span style={{ fontSize: 12, color: '#6b7280' }}>Saving...</span>}
                  {savedInline === 'booking.cancellationWindowHours' && <span style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>✅ Saved!</span>}
                </div>
              </div>
            </div>

            {/* Max Reschedules */}
            <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <h3 style={{ margin: 0, fontSize: 15, color: '#111827' }}>{t('systemSettings.maxReschedules')}</h3>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>{t('systemSettings.maxReschedulesDesc')}</p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {[0, 1, 2, 3, 5].map(n => (
                    <button key={n} className={`btn btn-sm ${maxReschedules === n ? 'btn-primary' : 'btn-outline'}`}
                      disabled={savingInline === 'booking.maxReschedules'}
                      onClick={() => { setMaxReschedules(n); saveInlineSetting('booking.maxReschedules', String(n)) }}>
                      {n === 0 ? '∞' : n}
                    </button>
                  ))}
                  {savingInline === 'booking.maxReschedules' && <span style={{ fontSize: 12, color: '#6b7280' }}>Saving...</span>}
                  {savedInline === 'booking.maxReschedules' && <span style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>✅ Saved!</span>}
                </div>
              </div>
            </div>

            {/* No-Show Rules Divider */}
            <div style={{ borderTop: '2px solid #e5e7eb', padding: '12px 0 4px', marginTop: 4 }}>
              <h3 style={{ margin: 0, fontSize: 14, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('systemSettings.noShowRules')}</h3>
            </div>

            {/* Doctor No-Show */}
            <div style={{ padding: '12px 0', borderTop: '1px solid #f3f4f6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <h3 style={{ margin: 0, fontSize: 15, color: '#111827' }}>🩺 {t('systemSettings.doctorNoShow')}</h3>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
                    {t('systemSettings.doctorNoShowDesc')}
                  </p>
                </div>
                <span style={{ background: '#d1fae5', color: '#065f46', padding: '5px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>♾ {t('systemSettings.unlimited')}</span>
              </div>
            </div>

            {/* Patient No-Show */}
            <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <h3 style={{ margin: 0, fontSize: 15, color: '#111827' }}>🙋 {t('systemSettings.patientNoShowLimit')}</h3>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
                    {t('systemSettings.patientNoShowLimitDesc')}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {[0, 1, 2, 3].map(n => (
                    <button key={n} className={`btn btn-sm ${patientNoShowLimit === n ? 'btn-primary' : 'btn-outline'}`}
                      disabled={savingPatientLimit} onClick={() => handlePatientNoShowLimitChange(n)}>
                      {n === 0 ? '∞' : n}
                    </button>
                  ))}
                  <input type="number" className="form-input"
                    style={{ width: 70, padding: '4px 8px', fontSize: 13, textAlign: 'center', ...inputStyle }}
                    value={patientNoShowLimit} min={0} max={10} disabled={savingPatientLimit}
                    onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 0 && v <= 10) setPatientNoShowLimit(v) }}
                    onBlur={() => handlePatientNoShowLimitChange(patientNoShowLimit)}
                    onKeyDown={e => { if (e.key === 'Enter') handlePatientNoShowLimitChange(patientNoShowLimit) }} />
                  {savingPatientLimit && <span style={{ fontSize: 12, color: '#6b7280' }}>{t('systemSettings.saving')}</span>}
                  {patientLimitSaved && <span style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>✅ Saved!</span>}
                </div>
              </div>
              <p style={{ margin: '8px 0 0', fontSize: 13, color: '#6b7280' }}>
                <strong>Current:</strong> Patient may reschedule a no-show{' '}
                {patientNoShowLimit === 0 ? <strong>unlimited times</strong> : <><strong>{patientNoShowLimit} time{patientNoShowLimit !== 1 ? 's' : ''}</strong></>}.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── Platform Currency ─── */}
      {showCurrencyCard && (
        <div id="settings-section-currency" className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><h2 style={{ color: '#111827' }}>💱 {t('systemSettings.platformCurrency')}</h2></div>
          <div className="card-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <h3 style={{ margin: 0, fontSize: 15, color: '#111827' }}>{t('systemSettings.defaultCurrency')}</h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
                  {t('systemSettings.defaultCurrencyDesc')}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  className="form-input"
                  value={selectedCurrency}
                  onChange={e => handleSaveCurrency(e.target.value)}
                  disabled={savingCurrency}
                  style={{ fontSize: 14, padding: '8px 12px', minWidth: 220, ...inputStyle }}
                >
                  <option value="INR">🇮🇳 INR — Indian Rupee (₹)</option>
                  <option value="USD">🇺🇸 USD — US Dollar ($)</option>
                  <option value="EUR">🇪🇺 EUR — Euro (€)</option>
                  <option value="GBP">🇬🇧 GBP — British Pound (£)</option>
                  <option value="AUD">🇦🇺 AUD — Australian Dollar (A$)</option>
                  <option value="CAD">🇨🇦 CAD — Canadian Dollar (C$)</option>
                  <option value="JPY">🇯🇵 JPY — Japanese Yen (¥)</option>
                  <option value="CNY">🇨🇳 CNY — Chinese Yuan (¥)</option>
                  <option value="KES">🇰🇪 KES — Kenyan Shilling (KSh)</option>
                  <option value="ZAR">🇿🇦 ZAR — South African Rand (R)</option>
                  <option value="BRL">🇧🇷 BRL — Brazilian Real (R$)</option>
                  <option value="SGD">🇸🇬 SGD — Singapore Dollar (S$)</option>
                  <option value="AED">🇦🇪 AED — UAE Dirham (د.إ)</option>
                  <option value="SAR">🇸🇦 SAR — Saudi Riyal (﷼)</option>
                  <option value="MYR">🇲🇾 MYR — Malaysian Ringgit (RM)</option>
                  <option value="THB">🇹🇭 THB — Thai Baht (฿)</option>
                  <option value="PHP">🇵🇭 PHP — Philippine Peso (₱)</option>
                  <option value="IDR">🇮🇩 IDR — Indonesian Rupiah (Rp)</option>
                  <option value="NZD">🇳🇿 NZD — New Zealand Dollar (NZ$)</option>
                  <option value="CHF">🇨🇭 CHF — Swiss Franc (CHF)</option>
                </select>
                {savingCurrency && <span style={{ fontSize: 12, color: '#6b7280' }}>{t('systemSettings.saving')}</span>}
                {currencySaved && <span style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>✅ Saved!</span>}
              </div>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: '#6b7280' }}>
              <strong>Current:</strong> All prices across the platform display in <strong>{selectedCurrency}</strong>.
              Changing this will update currency symbols on all pages for all users.
            </p>
          </div>
        </div>
      )}

      {/* ─── Payment Gateway Settings ─── */}
      {showPaymentCard && (
        <div id="settings-section-payment" className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><h2 style={{ color: '#111827' }}>💳 {t('systemSettings.paymentGateway')}</h2></div>
          <div className="card-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <h3 style={{ margin: 0, fontSize: 15, color: '#111827' }}>{t('systemSettings.gatewayMode')}</h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
                  <strong>Demo:</strong> Simulated payments. <strong>Test:</strong> Sandbox. <strong>Live:</strong> Real processing.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {(['demo', 'test', 'live'] as const).map(mode => (
                  <button key={mode} className={`btn btn-sm ${gatewayMode === mode ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setGatewayMode(mode)}>
                    {mode === 'demo' ? '🧪 Demo' : mode === 'test' ? '🔧 Test' : '🟢 Live'}
                  </button>
                ))}
              </div>
            </div>

            {gatewayMode !== 'demo' && (
              <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px 0' }}>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <label className="form-label" style={{ fontSize: 13 }}>Provider</label>
                    <select className="form-input" value={gatewayProvider} onChange={e => setGatewayProvider(e.target.value)} style={inputStyle}>
                      <option value="stripe">Stripe</option>
                      <option value="razorpay">Razorpay</option>
                      <option value="paypal">PayPal</option>
                      <option value="square">Square</option>
                    </select>
                  </div>
                  <div style={{ flex: 2, minWidth: 200 }}>
                    <label className="form-label" style={{ fontSize: 13 }}>Gateway URL</label>
                    <input className="form-input" placeholder="https://api.stripe.com/v1" value={gatewayUrl}
                      onChange={e => setGatewayUrl(e.target.value)} style={inputStyle} />
                  </div>
                  <div style={{ flex: 2, minWidth: 200 }}>
                    <label className="form-label" style={{ fontSize: 13 }}>API Key</label>
                    <input className="form-input" type="password" placeholder="sk_test_..." value={gatewayApiKey}
                      onChange={e => setGatewayApiKey(e.target.value)} style={inputStyle} />
                  </div>
                </div>
              </div>
            )}

            {gatewayMode === 'demo' && (
              <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px 0' }}>
                <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
                  ⚠️ <strong>{t('systemSettings.demoModeActive')}</strong> — {t('systemSettings.demoModeDesc')}
                </div>
              </div>
            )}

            {gatewayMode === 'live' && (
              <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px 0' }}>
                <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
                  🔴 <strong>{t('systemSettings.liveMode')}</strong> — {t('systemSettings.liveModeDesc')}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
              {gatewaySaved && <span style={{ fontSize: 12, color: '#059669', fontWeight: 600, paddingTop: 8 }}>✅ {t('systemSettings.gatewaySaved')}</span>}
              <button className="btn btn-primary" disabled={savingGateway} onClick={handleSaveGateway}>
                {savingGateway ? t('systemSettings.saving') : t('systemSettings.saveGateway')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Cancellation & Refund Policy ─── */}
      {showCancellationCard && (
        <div id="settings-section-cancellation" className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><h2 style={{ color: '#111827' }}>🔄 {t('systemSettings.cancellationPolicy')}</h2></div>
          <div className="card-body">
            {/* Auto-refund on doctor cancel */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <h3 style={{ margin: 0, fontSize: 15, color: '#111827' }}>{t('systemSettings.autoRefund')}</h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
                  {t('systemSettings.autoRefundDesc')}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className={`btn btn-sm ${cancellationPolicy.autoRefundOnDoctorCancel ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setCancellationPolicy({ ...cancellationPolicy, autoRefundOnDoctorCancel: true })}>✅ Enabled</button>
                <button className={`btn btn-sm ${!cancellationPolicy.autoRefundOnDoctorCancel ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setCancellationPolicy({ ...cancellationPolicy, autoRefundOnDoctorCancel: false })}>❌ Disabled</button>
              </div>
            </div>

            {/* Goodwill bonus */}
            <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <h3 style={{ margin: 0, fontSize: 15, color: '#111827' }}>{t('systemSettings.goodwillBonus')}</h3>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>{t('systemSettings.goodwillBonusDesc')}</p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {[0, 5, 10, 15, 20].map(n => (
                    <button key={n} className={`btn btn-sm ${cancellationPolicy.goodwillBonusPercent === n ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setCancellationPolicy({ ...cancellationPolicy, goodwillBonusPercent: n })}>{n}%</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Patient free cancellation window */}
            <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <h3 style={{ margin: 0, fontSize: 15, color: '#111827' }}>{t('systemSettings.freeCancellationHours')}</h3>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>{t('systemSettings.freeCancellationHoursDesc')}</p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {[12, 24, 48, 72].map(h => (
                    <button key={h} className={`btn btn-sm ${cancellationPolicy.patientFreeWindowHours === h ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setCancellationPolicy({ ...cancellationPolicy, patientFreeWindowHours: h })}>{h}h</button>
                  ))}
                  <input type="number" className="form-input"
                    style={{ width: 70, padding: '4px 8px', fontSize: 13, textAlign: 'center', ...inputStyle }}
                    value={cancellationPolicy.patientFreeWindowHours} min={1} max={168}
                    onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 1 && v <= 168) setCancellationPolicy({ ...cancellationPolicy, patientFreeWindowHours: v }) }} />
                </div>
              </div>
            </div>

            {/* Partial refund window */}
            <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <h3 style={{ margin: 0, fontSize: 15, color: '#111827' }}>{t('systemSettings.partialRefundWindow')}</h3>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>{t('systemSettings.partialRefundWindowDesc')}</p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {[1, 2, 4, 6].map(h => (
                    <button key={h} className={`btn btn-sm ${cancellationPolicy.partialRefundWindowHours === h ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setCancellationPolicy({ ...cancellationPolicy, partialRefundWindowHours: h })}>{h}h</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Partial refund percentage */}
            <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <h3 style={{ margin: 0, fontSize: 15, color: '#111827' }}>{t('systemSettings.partialRefundPercent')}</h3>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>{t('systemSettings.partialRefundPercentDesc')}</p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {[25, 50, 75].map(n => (
                    <button key={n} className={`btn btn-sm ${cancellationPolicy.partialRefundPercent === n ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setCancellationPolicy({ ...cancellationPolicy, partialRefundPercent: n })}>{n}%</button>
                  ))}
                  <input type="number" className="form-input"
                    style={{ width: 70, padding: '4px 8px', fontSize: 13, textAlign: 'center', ...inputStyle }}
                    value={cancellationPolicy.partialRefundPercent} min={0} max={100}
                    onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 0 && v <= 100) setCancellationPolicy({ ...cancellationPolicy, partialRefundPercent: v }) }} />
                </div>
              </div>
            </div>

            {/* Doctor max cancellations per month */}
            <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <h3 style={{ margin: 0, fontSize: 15, color: '#111827' }}>{t('systemSettings.doctorMaxCancellations')}</h3>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>0 = unlimited.</p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {[0, 3, 5, 10].map(n => (
                    <button key={n} className={`btn btn-sm ${cancellationPolicy.doctorMaxCancellationsPerMonth === n ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setCancellationPolicy({ ...cancellationPolicy, doctorMaxCancellationsPerMonth: n })}>
                      {n === 0 ? '∞' : n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Refund policy preview */}
            <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px 0' }}>
              <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#1e3a5f' }}>
                <strong>📋 Policy Preview (for a {formatCurrency(1000)} consultation):</strong>
                <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                  <li>Cancel {cancellationPolicy.patientFreeWindowHours}+ hours before → <strong style={{ color: '#059669' }}>{formatCurrency(1000)} full refund</strong></li>
                  <li>Cancel {cancellationPolicy.partialRefundWindowHours}–{cancellationPolicy.patientFreeWindowHours} hours before → <strong style={{ color: '#d97706' }}>{formatCurrency(cancellationPolicy.partialRefundPercent * 10)} ({cancellationPolicy.partialRefundPercent}%)</strong></li>
                  <li>Cancel &lt; {cancellationPolicy.partialRefundWindowHours} hours before → <strong style={{ color: '#dc2626' }}>No refund</strong></li>
                  <li>Doctor cancels → <strong style={{ color: '#059669' }}>{formatCurrency(1000)} + {formatCurrency(cancellationPolicy.goodwillBonusPercent * 10)} bonus ({cancellationPolicy.goodwillBonusPercent}%)</strong></li>
                </ul>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
              {cancellationSaved && <span style={{ fontSize: 12, color: '#059669', fontWeight: 600, paddingTop: 8 }}>✅ {t('systemSettings.cancellationSaved')}</span>}
              <button className="btn btn-primary" disabled={savingCancellation} onClick={handleSaveCancellation}>
                {savingCancellation ? t('systemSettings.saving') : t('systemSettings.saveCancellationPolicy')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Email Configuration ─── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h2 style={{ color: '#111827' }}>📧 Email Configuration</h2>
        </div>
        <div className="card-body">
          <div className="module-form">
            <div className="module-form-row">
              <div className="module-form-group">
                <label className="module-label">Dev/Demo Email Redirect</label>
                <input type="email" className="module-input" value={emailDevRedirect} style={inputStyle}
                  onChange={e => setEmailDevRedirect(e.target.value)}
                  placeholder="test@example.com" />
                <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>When set, ALL outgoing emails are redirected to this address instead of the actual recipient. Use for testing.</p>
              </div>
            </div>
            <div className="module-form-row">
              <div className="module-form-group">
                <label className="module-label">From Name</label>
                <input type="text" className="module-input" value={emailFromName} style={inputStyle}
                  onChange={e => setEmailFromName(e.target.value)}
                  placeholder="VetCare" />
              </div>
              <div className="module-form-group">
                <label className="module-label">From Address</label>
                <input type="email" className="module-input" value={emailFromAddress} style={inputStyle}
                  onChange={e => setEmailFromAddress(e.target.value)}
                  placeholder="noreply@vetcare.app" />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 12, borderTop: '1px solid #f3f4f6', marginTop: 12 }}>
            {emailSaved && <span style={{ fontSize: 12, color: '#059669', fontWeight: 600, paddingTop: 8 }}>✅ Saved</span>}
            <button className="btn btn-primary" disabled={emailSaving} onClick={handleSaveEmailSettings}>
              {emailSaving ? 'Saving...' : 'Save Email Settings'}
            </button>
          </div>
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #f3f4f6' }}>
            <label className="module-label">Send Test Email</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input type="email" className="module-input" value={testEmailTo} style={{ ...inputStyle, flex: 1 }}
                onChange={e => setTestEmailTo(e.target.value)}
                placeholder="recipient@example.com" />
              <button className="btn btn-primary" disabled={testEmailSending || !testEmailTo} onClick={handleSendTestEmail}>
                {testEmailSending ? 'Sending...' : '📤 Send Test'}
              </button>
            </div>
            {testEmailResult && (
              <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 6, background: testEmailResult.success ? '#f0fdf4' : '#fef2f2', color: testEmailResult.success ? '#059669' : '#dc2626', fontSize: 13 }}>
                {testEmailResult.success ? '✅ ' : '❌ '}{testEmailResult.message}
                {testEmailResult.previewUrl && (
                  <> — <a href={testEmailResult.previewUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#0369a1' }}>Preview Email</a></>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Other Settings (non-managed only) ─── */}
      <div id="settings-section-other">
        {loading ? (
          <div className="loading-container"><div className="loading-spinner" /></div>
        ) : filteredSettings.length === 0 && !searchQuery ? (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-body" style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 40 }}>⚙️</div>
              <h3 style={{ color: '#111827', marginTop: 12 }}>{t('systemSettings.noAdditional')}</h3>
              <p style={{ color: '#6b7280' }}>{t('systemSettings.noAdditionalDesc')}</p>
              <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setShowAdd(true)}>+ {t('systemSettings.addCustomSetting')}</button>
            </div>
          </div>
        ) : filteredSettings.length === 0 && searchQuery ? (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-body" style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 40 }}>🔍</div>
              <h3 style={{ color: '#111827', marginTop: 12 }}>{t('systemSettings.noMatch', { query: searchQuery })}</h3>
              <p style={{ color: '#6b7280' }}>{t('systemSettings.noMatchDesc')}</p>
              <button className="btn btn-outline" style={{ marginTop: 12 }} onClick={() => setSearchQuery('')}>{t('systemSettings.clearSearch')}</button>
            </div>
          </div>
        ) : (
          Object.entries(groupedSettings).map(([category, items]) => (
            <div key={category} className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <h2 style={{ textTransform: 'capitalize', color: '#111827' }}>⚙️ {category}</h2>
                <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 500 }}>{items.length} setting{items.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                {items.map(setting => (
                  <div key={setting.key} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '14px 20px', borderBottom: '1px solid #f3f4f6',
                    flexWrap: 'wrap', gap: 8
                  }}>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <code style={{ fontSize: 13, background: '#f3f4f6', padding: '2px 8px', borderRadius: 4, color: '#374151' }}>
                          {setting.key}
                        </code>
                      </div>
                      {setting.description && (
                        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>{setting.description}</p>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 200, flexWrap: 'wrap' }}>
                      {editingKey === setting.key ? (
                        <>
                          <input
                            className="form-input"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            style={{ flex: 1, fontSize: 13, minWidth: 120, ...inputStyle }}
                            autoFocus
                            onKeyDown={e => { if (e.key === 'Enter') handleSave(setting.key); if (e.key === 'Escape') setEditingKey(null) }}
                          />
                          <button className="btn btn-sm btn-primary" disabled={saving} onClick={() => handleSave(setting.key)}>
                            {saving ? '...' : '✓'}
                          </button>
                          <button className="btn btn-sm btn-outline" onClick={() => setEditingKey(null)}>✕</button>
                        </>
                      ) : (
                        <>
                          <span style={{ fontSize: 14, fontWeight: 500, background: '#f9fafb', padding: '4px 12px', borderRadius: 6, color: '#111827' }}>
                            {setting.value}
                          </span>
                          <button className="btn btn-sm btn-outline"
                            onClick={() => { setEditingKey(setting.key); setEditValue(setting.value) }}>
                            ✏️ Edit
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ─── Email Templates Card ─────────────────────────────────── */}
      <div className="module-card" style={{ marginBottom: 24 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>📧 {t('emailTemplates.title')}</h2>
        </div>
        <div className="card-body">
          {templateSaved && <div className="module-alert success">{t('emailTemplates.saved')}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {(['booking_confirmation', 'booking_cancellation', 'booking_reminder', 'password_reset', 'staff_invite'] as const).map(key => {
              const labelMap: Record<string, string> = {
                booking_confirmation: t('emailTemplates.bookingConfirmation'),
                booking_cancellation: t('emailTemplates.bookingCancellation'),
                booking_reminder: t('emailTemplates.bookingReminder'),
                password_reset: t('emailTemplates.passwordReset'),
                staff_invite: t('emailTemplates.staffInvite'),
              }
              const tmpl = emailTemplates[key]
              return (
                <div key={key} className="module-card" style={{ margin: 0 }}>
                  <div className="card-header">
                    <strong>{labelMap[key]}</strong>
                  </div>
                  <div className="card-body" style={{ fontSize: 13 }}>
                    {tmpl ? (
                      <p style={{ color: '#666', marginBottom: 8 }}>{t('emailTemplates.subject')}: {tmpl.subject}</p>
                    ) : null}
                    <button
                      className="module-btn primary small"
                      onClick={() => {
                        setEditingTemplate(key)
                        setTemplateDraft(tmpl || { subject: '', body: '' })
                      }}
                    >
                      ✏️ {t('emailTemplates.edit')}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Email Template Edit Modal */}
      {editingTemplate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div className="module-card" style={{ width: '100%', maxWidth: 560, margin: 16 }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>✏️ {t('emailTemplates.edit')}</h3>
              <button className="module-btn" onClick={() => setEditingTemplate(null)}>✕</button>
            </div>
            <div className="card-body">
              <div className="module-form-group">
                <label className="module-label">{t('emailTemplates.subject')} *</label>
                <input
                  className="module-input"
                  value={templateDraft.subject}
                  onChange={e => setTemplateDraft(prev => ({ ...prev, subject: e.target.value }))}
                />
              </div>
              <div className="module-form-group">
                <label className="module-label">{t('emailTemplates.body')} *</label>
                <textarea
                  className="module-input"
                  rows={6}
                  value={templateDraft.body}
                  onChange={e => setTemplateDraft(prev => ({ ...prev, body: e.target.value }))}
                  style={{ resize: 'vertical' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button className="module-btn" onClick={() => setEditingTemplate(null)}>{t('common.cancel')}</button>
                <button
                  className="module-btn primary"
                  disabled={savingTemplate || !templateDraft.subject || !templateDraft.body}
                  onClick={handleSaveTemplate}
                >
                  {savingTemplate ? '⏳' : t('emailTemplates.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SystemSettings

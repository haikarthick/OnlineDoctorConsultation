import React, { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { useSettings } from '../../context/SettingsContext'
import { SystemSetting, GatewaySettings } from '../../types'
import '../../styles/modules.css'
import SettingsNav from '../../components/systemSettings/SettingsNav'
import AddSettingModal from '../../components/systemSettings/AddSettingModal'
import MaintenanceCard from '../../components/systemSettings/MaintenanceCard'
import DisplayCard from '../../components/systemSettings/DisplayCard'
import ConsultationCard from '../../components/systemSettings/ConsultationCard'
import BookingCard from '../../components/systemSettings/BookingCard'
import CurrencyCard from '../../components/systemSettings/CurrencyCard'
import PaymentGatewayCard from '../../components/systemSettings/PaymentGatewayCard'
import RazorpayCredentialsCard from '../../components/systemSettings/RazorpayCredentialsCard'
import CancellationPolicyCard from '../../components/systemSettings/CancellationPolicyCard'
import EmailConfigCard from '../../components/systemSettings/EmailConfigCard'
import OtherSettingsSection from '../../components/systemSettings/OtherSettingsSection'
import EmailTemplatesCard, { EmailTemplate } from '../../components/systemSettings/EmailTemplatesCard'
import EmailTemplateEditModal from '../../components/systemSettings/EmailTemplateEditModal'

interface SystemSettingsProps {
  onNavigate: (path: string) => void
}

// Keys managed by dedicated UI cards - excluded from the generic table
const MANAGED_KEYS = new Set([
  'display.timeFormat',
  'display.dateFormat',
  'consultation.joinWindowMinutes',
  'consultation.maxDurationMinutes',
  'booking.maxReschedules',
  'booking.patientNoShowRescheduleLimit',
  'booking.advanceBookingDays',
  'booking.cancellationWindowHours',
  // Legacy aliases from seed.sql - same concepts, different key names
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

  // Razorpay credentials state (payment module - stored encrypted in DB, never returned in plaintext)
  const [razorpayWebhookUrl, setRazorpayWebhookUrl] = useState('')
  const [razorpayStatus, setRazorpayStatus] = useState<Record<'test' | 'live', { configured: boolean; keyId: string | null; keySecretConfigured: boolean; webhookSecretConfigured: boolean; updatedAt: string | null }>>({
    test: { configured: false, keyId: null, keySecretConfigured: false, webhookSecretConfigured: false, updatedAt: null },
    live: { configured: false, keyId: null, keySecretConfigured: false, webhookSecretConfigured: false, updatedAt: null },
  })
  const [razorpayForm, setRazorpayForm] = useState<Record<'test' | 'live', { keyId: string; keySecret: string; webhookSecret: string }>>({
    test: { keyId: '', keySecret: '', webhookSecret: '' },
    live: { keyId: '', keySecret: '', webhookSecret: '' },
  })
  const [savingRazorpay, setSavingRazorpay] = useState<'test' | 'live' | null>(null)
  const [razorpaySaved, setRazorpaySaved] = useState<'test' | 'live' | null>(null)

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
  const [emailFromName, setEmailFromName] = useState('waytovet')
  const [emailFromAddress, setEmailFromAddress] = useState('noreply@waytovet.app')
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
  const [emailTemplates, setEmailTemplates] = useState<Record<string, EmailTemplate>>({})
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null)
  const [templateDraft, setTemplateDraft] = useState<EmailTemplate>({ subject: '', body: '' })
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateSaved, setTemplatesSaved] = useState(false)

  useEffect(() => {
    loadSettings()
    loadGatewaySettings()
    loadRazorpayCredentials()
  }, [])

  const loadRazorpayCredentials = async () => {
    try {
      const result = await apiService.adminGetRazorpayCredentials()
      const data = result.data
      if (data) {
        setRazorpayStatus({ test: data.test, live: data.live })
        setRazorpayWebhookUrl(data.webhookUrl || '')
        setRazorpayForm({
          test: { keyId: data.test?.keyId || '', keySecret: '', webhookSecret: '' },
          live: { keyId: data.live?.keyId || '', keySecret: '', webhookSecret: '' },
        })
      }
    } catch { /* ignore */ }
  }

  const handleSaveRazorpay = async (environment: 'test' | 'live') => {
    try {
      setSavingRazorpay(environment)
      setRazorpaySaved(null)
      const form = razorpayForm[environment]
      await apiService.adminUpdateRazorpayCredentials(environment, {
        keyId: form.keyId,
        keySecret: form.keySecret || undefined,
        webhookSecret: form.webhookSecret || undefined,
      })
      await loadRazorpayCredentials()
      setRazorpaySaved(environment)
      setTimeout(() => setRazorpaySaved(null), 3000)
    } catch {
    } finally {
      setSavingRazorpay(null)
    }
  }

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
        const tmplData = await apiService.adminGetEmailTemplates()
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
      await apiService.adminUpdateEmailTemplate(editingTemplate, templateDraft)
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
    <div className="module-page si-7751cc54">
      {/* Header */}
      <div className="page-header si-70c30b8a">
        <div>
          <h1 className="si-63c2680d">{t('systemSettings.title')}</h1>
          <p className="page-subtitle">{t('systemSettings.subtitle', { count: settings.length })}</p>
        </div>
        <div className="page-header-actions si-f83c50b4">
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ {t('systemSettings.addSetting')}</button>
          <button
            className="btn btn-outline si-cc651457"
            onClick={() => onNavigate('/admin/prescription-settings')}
          >
            📄 {t('systemSettings.prescriptionTemplate')}
          </button>
          <button
            className="btn btn-outline si-5634b397"
            onClick={() => onNavigate('/admin/certificate-settings')}
          >
            📋 {t('systemSettings.certificateTemplate')}
          </button>
          <button className="btn btn-outline" onClick={() => onNavigate('/admin/dashboard')}>← {t('systemSettings.dashboard')}</button>
        </div>
      </div>

      <SettingsNav
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        activeSection={activeSection}
        scrollToSection={scrollToSection}
      />

      <AddSettingModal
        show={showAdd}
        onClose={() => setShowAdd(false)}
        newSetting={newSetting}
        setNewSetting={setNewSetting}
        saving={saving}
        onAdd={handleAddSetting}
      />

      <MaintenanceCard
        show={showMaintenanceCard}
        maintenanceEnabled={maintenanceEnabled}
        setMaintenanceEnabled={setMaintenanceEnabled}
        maintenanceMessage={maintenanceMessage}
        setMaintenanceMessage={setMaintenanceMessage}
        savingMaintenance={savingMaintenance}
        maintenanceSaved={maintenanceSaved}
        onSave={handleSaveMaintenance}
      />

      <DisplayCard
        show={showDisplayCard}
        timeFormat={timeFormat}
        onTimeFormatChange={handleTimeFormatChange}
        savingTimeFormat={savingTimeFormat}
        timeFormatSaved={timeFormatSaved}
        dateFormat={dateFormat}
        setDateFormat={setDateFormat}
        savingInline={savingInline}
        savedInline={savedInline}
        onSaveInline={saveInlineSetting}
      />

      <ConsultationCard
        show={showConsultationCard}
        joinWindow={joinWindow}
        setJoinWindow={setJoinWindow}
        onJoinWindowChange={handleJoinWindowChange}
        savingJoinWindow={savingJoinWindow}
        joinWindowSaved={joinWindowSaved}
        maxDurationMinutes={maxDurationMinutes}
        setMaxDurationMinutes={setMaxDurationMinutes}
        savingInline={savingInline}
        savedInline={savedInline}
        onSaveInline={saveInlineSetting}
      />

      <BookingCard
        show={showBookingCard}
        advanceBookingDays={advanceBookingDays}
        setAdvanceBookingDays={setAdvanceBookingDays}
        cancellationWindowHours={cancellationWindowHours}
        setCancellationWindowHours={setCancellationWindowHours}
        maxReschedules={maxReschedules}
        setMaxReschedules={setMaxReschedules}
        savingInline={savingInline}
        savedInline={savedInline}
        onSaveInline={saveInlineSetting}
        patientNoShowLimit={patientNoShowLimit}
        setPatientNoShowLimit={setPatientNoShowLimit}
        onPatientNoShowLimitChange={handlePatientNoShowLimitChange}
        savingPatientLimit={savingPatientLimit}
        patientLimitSaved={patientLimitSaved}
      />

      <CurrencyCard
        show={showCurrencyCard}
        selectedCurrency={selectedCurrency}
        onCurrencyChange={handleSaveCurrency}
        savingCurrency={savingCurrency}
        currencySaved={currencySaved}
      />

      <PaymentGatewayCard
        show={showPaymentCard}
        gatewayMode={gatewayMode}
        setGatewayMode={setGatewayMode}
        gatewayProvider={gatewayProvider}
        setGatewayProvider={setGatewayProvider}
        gatewayUrl={gatewayUrl}
        setGatewayUrl={setGatewayUrl}
        gatewayApiKey={gatewayApiKey}
        setGatewayApiKey={setGatewayApiKey}
        savingGateway={savingGateway}
        gatewaySaved={gatewaySaved}
        onSave={handleSaveGateway}
      />

      <RazorpayCredentialsCard
        show={showPaymentCard}
        gatewayMode={gatewayMode}
        razorpayStatus={razorpayStatus}
        razorpayForm={razorpayForm}
        setRazorpayForm={setRazorpayForm}
        savingRazorpay={savingRazorpay}
        razorpaySaved={razorpaySaved}
        onSave={handleSaveRazorpay}
        razorpayWebhookUrl={razorpayWebhookUrl}
      />

      <CancellationPolicyCard
        show={showCancellationCard}
        cancellationPolicy={cancellationPolicy}
        setCancellationPolicy={setCancellationPolicy}
        savingCancellation={savingCancellation}
        cancellationSaved={cancellationSaved}
        onSave={handleSaveCancellation}
        formatCurrency={formatCurrency}
      />

      <EmailConfigCard
        emailDevRedirect={emailDevRedirect}
        setEmailDevRedirect={setEmailDevRedirect}
        emailFromName={emailFromName}
        setEmailFromName={setEmailFromName}
        emailFromAddress={emailFromAddress}
        setEmailFromAddress={setEmailFromAddress}
        emailSaving={emailSaving}
        emailSaved={emailSaved}
        onSave={handleSaveEmailSettings}
        testEmailTo={testEmailTo}
        setTestEmailTo={setTestEmailTo}
        testEmailSending={testEmailSending}
        testEmailResult={testEmailResult}
        onSendTestEmail={handleSendTestEmail}
      />

      <OtherSettingsSection
        loading={loading}
        filteredSettings={filteredSettings}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        groupedSettings={groupedSettings}
        editingKey={editingKey}
        setEditingKey={setEditingKey}
        editValue={editValue}
        setEditValue={setEditValue}
        saving={saving}
        onSave={handleSave}
        onShowAdd={() => setShowAdd(true)}
      />

      <EmailTemplatesCard
        emailTemplates={emailTemplates}
        templateSaved={templateSaved}
        onEditTemplate={(key, tmpl) => {
          setEditingTemplate(key)
          setTemplateDraft(tmpl || { subject: '', body: '' })
        }}
      />

      <EmailTemplateEditModal
        editingTemplate={editingTemplate}
        templateDraft={templateDraft}
        setTemplateDraft={setTemplateDraft}
        savingTemplate={savingTemplate}
        onClose={() => setEditingTemplate(null)}
        onSave={handleSaveTemplate}
      />
    </div>
  )
}

export default SystemSettings

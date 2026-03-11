import React, { useState, useEffect } from 'react'
import apiService from '../../services/api'
import { useSettings } from '../../context/SettingsContext'
import { SystemSetting, GatewaySettings } from '../../types'
import '../../styles/modules.css'

interface SystemSettingsProps {
  onNavigate: (path: string) => void
}

const SystemSettings: React.FC<SystemSettingsProps> = ({ onNavigate }) => {
  const { settings: appSettings, reloadSettings } = useSettings()
  const [settings, setSettings] = useState<SystemSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [newSetting, setNewSetting] = useState({ key: '', value: '', description: '' })
  const [showAdd, setShowAdd] = useState(false)
  const [timeFormat, setTimeFormat] = useState(appSettings.timeFormat)
  const [savingTimeFormat, setSavingTimeFormat] = useState(false)
  const [timeFormatSaved, setTimeFormatSaved] = useState(false)
  const [joinWindow, setJoinWindow] = useState(appSettings.joinWindowMinutes)
  const [savingJoinWindow, setSavingJoinWindow] = useState(false)
  const [joinWindowSaved, setJoinWindowSaved] = useState(false)
  const [patientNoShowLimit, setPatientNoShowLimit] = useState(appSettings.patientNoShowRescheduleLimit)
  const [savingPatientLimit, setSavingPatientLimit] = useState(false)
  const [patientLimitSaved, setPatientLimitSaved] = useState(false)

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

  useEffect(() => {
    loadSettings()
    loadGatewaySettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const result = await apiService.adminGetSettings()
      setSettings(result.data || [])
    } catch (err) {
} finally {
      setLoading(false)
    }
  }

  const handleSave = async (key: string) => {
    try {
      setSaving(true)
      await apiService.adminUpdateSetting(key, editValue)
      setSettings(settings.map(s => s.key === key ? { ...s, value: editValue } : s))
      setEditingKey(null)
    } catch (err) {
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
    } catch (err) {
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
      // Update the local settings list
      setSettings(settings.map(s => s.key === 'display.timeFormat' ? { ...s, value: newFormat } : s))
      // Reload global settings context so all pages pick up the change
      await reloadSettings()
      setTimeFormatSaved(true)
      setTimeout(() => setTimeFormatSaved(false), 3000)
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
    } finally {
      setSavingGateway(false)
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
    } catch (err) {
    } finally {
      setSavingCancellation(false)
    }
  }

  // Group settings by category
  const groupedSettings: Record<string, SystemSetting[]> = {}
  settings.forEach(s => {
    const category = s.key.split('.')[0] || 'general'
    if (!groupedSettings[category]) groupedSettings[category] = []
    groupedSettings[category].push(s)
  })

  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <h1>System Settings</h1>
          <p className="page-subtitle">{settings.length} configuration entries</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Setting</button>
          <button className="btn btn-outline" onClick={() => onNavigate('/admin/dashboard')}>← Dashboard</button>
        </div>
      </div>

      {/* Add Setting Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h2>Add Setting</h2>
              <button className="modal-close" onClick={() => setShowAdd(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Key</label>
                <input className="form-input" placeholder="e.g. system.maintenance_mode" value={newSetting.key}
                  onChange={e => setNewSetting({ ...newSetting, key: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Value</label>
                <input className="form-input" placeholder="Setting value" value={newSetting.value}
                  onChange={e => setNewSetting({ ...newSetting, value: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input className="form-input" placeholder="What does this setting control?" value={newSetting.description}
                  onChange={e => setNewSetting({ ...newSetting, description: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                <button className="btn btn-outline" onClick={() => setShowAdd(false)}>Cancel</button>
                <button className="btn btn-primary" disabled={saving} onClick={handleAddSetting}>
                  {saving ? 'Saving...' : 'Add Setting'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Display Settings — Time Format ─── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h2>🕐 Display Settings</h2>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>Time Format</h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
                Choose how times are displayed across the application. This affects all users.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                className={`btn btn-sm ${timeFormat === '12h' ? 'btn-primary' : 'btn-outline'}`}
                disabled={savingTimeFormat}
                onClick={() => handleTimeFormatChange('12h')}
                style={{ minWidth: 120 }}
              >
                12 Hour (AM/PM)
              </button>
              <button
                className={`btn btn-sm ${timeFormat === '24h' ? 'btn-primary' : 'btn-outline'}`}
                disabled={savingTimeFormat}
                onClick={() => handleTimeFormatChange('24h')}
                style={{ minWidth: 120 }}
              >
                24 Hour
              </button>
              {savingTimeFormat && <span style={{ fontSize: 12, color: '#6b7280' }}>Saving...</span>}
              {timeFormatSaved && <span style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>✅ Saved!</span>}
            </div>
          </div>
          <div style={{ padding: '12px 0', borderTop: '1px solid #f3f4f6' }}>
            <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
              <strong>Preview:</strong>{' '}
              {timeFormat === '12h'
                ? new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
                : new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
              }
            </p>
          </div>
        </div>
      </div>

      {/* ─── Consultation Settings — Join Window ─── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h2>🩺 Consultation Settings</h2>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>Join Window (minutes)</h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
                How many minutes before the scheduled time can users join/start a consultation.
                The Join/Start button will be disabled until this window opens.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {[5, 10, 15, 30].map(mins => (
                <button
                  key={mins}
                  className={`btn btn-sm ${joinWindow === mins ? 'btn-primary' : 'btn-outline'}`}
                  disabled={savingJoinWindow}
                  onClick={() => handleJoinWindowChange(mins)}
                  style={{ minWidth: 60 }}
                >
                  {mins} min
                </button>
              ))}
              <input
                type="number"
                className="form-input"
                style={{ width: 70, padding: '4px 8px', fontSize: 13, textAlign: 'center' }}
                value={joinWindow}
                min={0}
                max={120}
                disabled={savingJoinWindow}
                onChange={e => {
                  const v = parseInt(e.target.value, 10)
                  if (!isNaN(v) && v >= 0 && v <= 120) setJoinWindow(v)
                }}
                onBlur={() => handleJoinWindowChange(joinWindow)}
                onKeyDown={e => { if (e.key === 'Enter') handleJoinWindowChange(joinWindow) }}
              />
              {savingJoinWindow && <span style={{ fontSize: 12, color: '#6b7280' }}>Saving...</span>}
              {joinWindowSaved && <span style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>✅ Saved!</span>}
            </div>
          </div>
          <div style={{ padding: '12px 0', borderTop: '1px solid #f3f4f6' }}>
            <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
              <strong>Current:</strong> Join/Start button becomes available <strong>{joinWindow} minutes</strong> before the scheduled appointment time.
              {joinWindow === 0 && ' (0 = always available)'}
            </p>
          </div>
        </div>
      </div>

      {/* ─── Booking Settings — No-Show Reschedule Rules ─── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h2>📅 Booking — No-Show Reschedule Rules</h2>
        </div>
        <div className="card-body">
          {/* Doctor no-show — always unlimited */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>🩺 Doctor No-Show</h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
                When a doctor doesn't join their confirmed appointment, the patient may reschedule with any available doctor.
                This is <strong>always unlimited</strong> — it's the doctor's fault.
              </p>
            </div>
            <div style={{ minWidth: 120, textAlign: 'right' }}>
              <span style={{ background: '#d1fae5', color: '#065f46', padding: '5px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>♾ Unlimited</span>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: 15 }}>🙋 Patient No-Show Reschedule Limit</h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
                  When a patient misses their confirmed appointment, how many times they may reschedule that booking.
                  Set to <strong>0</strong> for unlimited.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {[0, 1, 2, 3].map(n => (
                  <button
                    key={n}
                    className={`btn btn-sm ${patientNoShowLimit === n ? 'btn-primary' : 'btn-outline'}`}
                    disabled={savingPatientLimit}
                    onClick={() => handlePatientNoShowLimitChange(n)}
                    style={{ minWidth: 52 }}
                  >
                    {n === 0 ? '∞' : n}
                  </button>
                ))}
                <input
                  type="number"
                  className="form-input"
                  style={{ width: 70, padding: '4px 8px', fontSize: 13, textAlign: 'center' }}
                  value={patientNoShowLimit}
                  min={0}
                  max={10}
                  disabled={savingPatientLimit}
                  onChange={e => {
                    const v = parseInt(e.target.value, 10)
                    if (!isNaN(v) && v >= 0 && v <= 10) setPatientNoShowLimit(v)
                  }}
                  onBlur={() => handlePatientNoShowLimitChange(patientNoShowLimit)}
                  onKeyDown={e => { if (e.key === 'Enter') handlePatientNoShowLimitChange(patientNoShowLimit) }}
                />
                {savingPatientLimit && <span style={{ fontSize: 12, color: '#6b7280' }}>Saving...</span>}
                {patientLimitSaved && <span style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>✅ Saved!</span>}
              </div>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: '#6b7280' }}>
              <strong>Current:</strong> Patient may reschedule a no-show booking{' '}
              {patientNoShowLimit === 0 ? <strong>unlimited times</strong> : <><strong>{patientNoShowLimit} time{patientNoShowLimit !== 1 ? 's' : ''}</strong> before needing to contact support</>}.
            </p>
          </div>
        </div>
      </div>

      {/* ─── Payment Gateway Settings ─── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h2>💳 Payment Gateway</h2>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>Gateway Mode</h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
                <strong>Demo:</strong> Simulated payments (no real charges). <strong>Test:</strong> Gateway sandbox mode. <strong>Live:</strong> Real payment processing.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {(['demo', 'test', 'live'] as const).map(mode => (
                <button
                  key={mode}
                  className={`btn btn-sm ${gatewayMode === mode ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setGatewayMode(mode)}
                  style={{ minWidth: 80, textTransform: 'capitalize' }}
                >
                  {mode === 'demo' ? '🧪 Demo' : mode === 'test' ? '🔧 Test' : '🟢 Live'}
                </button>
              ))}
            </div>
          </div>

          {gatewayMode !== 'demo' && (
            <>
              <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px 0' }}>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <label className="form-label" style={{ fontSize: 13 }}>Provider</label>
                    <select className="form-input" value={gatewayProvider} onChange={e => setGatewayProvider(e.target.value)}>
                      <option value="stripe">Stripe</option>
                      <option value="razorpay">Razorpay</option>
                      <option value="paypal">PayPal</option>
                      <option value="square">Square</option>
                    </select>
                  </div>
                  <div style={{ flex: 2, minWidth: 280 }}>
                    <label className="form-label" style={{ fontSize: 13 }}>Gateway URL</label>
                    <input className="form-input" placeholder="https://api.stripe.com/v1" value={gatewayUrl}
                      onChange={e => setGatewayUrl(e.target.value)} />
                  </div>
                  <div style={{ flex: 2, minWidth: 280 }}>
                    <label className="form-label" style={{ fontSize: 13 }}>API Key</label>
                    <input className="form-input" type="password" placeholder="sk_test_..." value={gatewayApiKey}
                      onChange={e => setGatewayApiKey(e.target.value)} />
                  </div>
                </div>
              </div>
            </>
          )}

          {gatewayMode === 'demo' && (
            <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px 0' }}>
              <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
                ⚠️ <strong>Demo Mode Active</strong> — All payments are simulated. No real charges are processed. Payment flows behave identically to production but use stub transactions.
              </div>
            </div>
          )}

          {gatewayMode === 'live' && (
            <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px 0' }}>
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
                🔴 <strong>Live Mode</strong> — Real payments will be processed. Ensure your API key and gateway URL are correctly configured before enabling this mode.
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
            {gatewaySaved && <span style={{ fontSize: 12, color: '#059669', fontWeight: 600, paddingTop: 8 }}>✅ Gateway settings saved!</span>}
            <button className="btn btn-primary" disabled={savingGateway} onClick={handleSaveGateway}>
              {savingGateway ? 'Saving...' : 'Save Gateway Settings'}
            </button>
          </div>
        </div>
      </div>

      {/* ─── Cancellation & Refund Policy ─── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h2>🔄 Cancellation & Refund Policy</h2>
        </div>
        <div className="card-body">
          {/* Auto-refund on doctor cancel */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>Auto-Refund on Doctor Cancellation</h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
                When a doctor cancels an appointment, automatically process a full refund to the patient's wallet.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                className={`btn btn-sm ${cancellationPolicy.autoRefundOnDoctorCancel ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setCancellationPolicy({ ...cancellationPolicy, autoRefundOnDoctorCancel: true })}
                style={{ minWidth: 80 }}
              >
                ✅ Enabled
              </button>
              <button
                className={`btn btn-sm ${!cancellationPolicy.autoRefundOnDoctorCancel ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setCancellationPolicy({ ...cancellationPolicy, autoRefundOnDoctorCancel: false })}
                style={{ minWidth: 80 }}
              >
                ❌ Disabled
              </button>
            </div>
          </div>

          {/* Goodwill bonus */}
          <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: 15 }}>Goodwill Bonus (%)</h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
                  Extra bonus credit added to the patient's wallet when a doctor cancels their appointment (as compensation for inconvenience).
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {[0, 5, 10, 15, 20].map(n => (
                  <button key={n}
                    className={`btn btn-sm ${cancellationPolicy.goodwillBonusPercent === n ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setCancellationPolicy({ ...cancellationPolicy, goodwillBonusPercent: n })}
                    style={{ minWidth: 52 }}
                  >
                    {n}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Patient free cancellation window */}
          <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: 15 }}>Patient Free Cancellation Window (hours)</h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
                  Patients receive a 100% refund if they cancel at least this many hours before the appointment.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {[12, 24, 48, 72].map(h => (
                  <button key={h}
                    className={`btn btn-sm ${cancellationPolicy.patientFreeWindowHours === h ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setCancellationPolicy({ ...cancellationPolicy, patientFreeWindowHours: h })}
                    style={{ minWidth: 52 }}
                  >
                    {h}h
                  </button>
                ))}
                <input type="number" className="form-input" style={{ width: 70, padding: '4px 8px', fontSize: 13, textAlign: 'center' }}
                  value={cancellationPolicy.patientFreeWindowHours} min={1} max={168}
                  onChange={e => {
                    const v = parseInt(e.target.value, 10)
                    if (!isNaN(v) && v >= 1 && v <= 168) setCancellationPolicy({ ...cancellationPolicy, patientFreeWindowHours: v })
                  }} />
              </div>
            </div>
          </div>

          {/* Partial refund window */}
          <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: 15 }}>Partial Refund Window (hours)</h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
                  Patients get a partial refund if they cancel between this time and the free window. Below this threshold, no refund.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {[1, 2, 4, 6].map(h => (
                  <button key={h}
                    className={`btn btn-sm ${cancellationPolicy.partialRefundWindowHours === h ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setCancellationPolicy({ ...cancellationPolicy, partialRefundWindowHours: h })}
                    style={{ minWidth: 52 }}
                  >
                    {h}h
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Partial refund percentage */}
          <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: 15 }}>Partial Refund Percentage</h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
                  The percentage refunded when a patient cancels within the partial refund window.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {[25, 50, 75].map(n => (
                  <button key={n}
                    className={`btn btn-sm ${cancellationPolicy.partialRefundPercent === n ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setCancellationPolicy({ ...cancellationPolicy, partialRefundPercent: n })}
                    style={{ minWidth: 52 }}
                  >
                    {n}%
                  </button>
                ))}
                <input type="number" className="form-input" style={{ width: 70, padding: '4px 8px', fontSize: 13, textAlign: 'center' }}
                  value={cancellationPolicy.partialRefundPercent} min={0} max={100}
                  onChange={e => {
                    const v = parseInt(e.target.value, 10)
                    if (!isNaN(v) && v >= 0 && v <= 100) setCancellationPolicy({ ...cancellationPolicy, partialRefundPercent: v })
                  }} />
              </div>
            </div>
          </div>

          {/* Doctor max cancellations per month */}
          <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: 15 }}>Doctor Max Cancellations / Month</h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
                  Maximum cancellations a doctor can make per month before being flagged as unreliable. Set 0 for unlimited.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {[0, 3, 5, 10].map(n => (
                  <button key={n}
                    className={`btn btn-sm ${cancellationPolicy.doctorMaxCancellationsPerMonth === n ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setCancellationPolicy({ ...cancellationPolicy, doctorMaxCancellationsPerMonth: n })}
                    style={{ minWidth: 52 }}
                  >
                    {n === 0 ? '∞' : n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Refund policy preview */}
          <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px 0' }}>
            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '12px 14px', fontSize: 13 }}>
              <strong>📋 Policy Preview (for a ₹1000 consultation):</strong>
              <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                <li>Cancel {cancellationPolicy.patientFreeWindowHours}+ hours before → <strong style={{ color: '#059669' }}>₹1000 full refund</strong></li>
                <li>Cancel {cancellationPolicy.partialRefundWindowHours}–{cancellationPolicy.patientFreeWindowHours} hours before → <strong style={{ color: '#d97706' }}>₹{cancellationPolicy.partialRefundPercent * 10} ({cancellationPolicy.partialRefundPercent}%) partial refund</strong></li>
                <li>Cancel less than {cancellationPolicy.partialRefundWindowHours} hours before → <strong style={{ color: '#dc2626' }}>No refund</strong></li>
                <li>Doctor cancels → <strong style={{ color: '#059669' }}>₹1000 refund + ₹{cancellationPolicy.goodwillBonusPercent * 10} bonus credit ({cancellationPolicy.goodwillBonusPercent}%)</strong></li>
              </ul>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
            {cancellationSaved && <span style={{ fontSize: 12, color: '#059669', fontWeight: 600, paddingTop: 8 }}>✅ Cancellation policy saved!</span>}
            <button className="btn btn-primary" disabled={savingCancellation} onClick={handleSaveCancellation}>
              {savingCancellation ? 'Saving...' : 'Save Cancellation Policy'}
            </button>
          </div>
        </div>
      </div>

      {/* Settings */}
      {loading ? (
        <div className="loading-container"><div className="loading-spinner" /></div>
      ) : settings.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 48 }}>⚙️</div>
          <h3>No settings configured</h3>
          <p>Add your first system setting</p>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Setting</button>
        </div>
      ) : (
        Object.entries(groupedSettings).map(([category, items]) => (
          <div key={category} className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <h2 style={{ textTransform: 'capitalize' }}>⚙️ {category}</h2>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {items.map(setting => (
                <div key={setting.key} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '14px 20px', borderBottom: '1px solid #f3f4f6'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <code style={{ fontSize: 13, background: '#f3f4f6', padding: '2px 8px', borderRadius: 4 }}>
                        {setting.key}
                      </code>
                    </div>
                    {setting.description && (
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>{setting.description}</p>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 240 }}>
                    {editingKey === setting.key ? (
                      <>
                        <input
                          className="form-input"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          style={{ flex: 1, fontSize: 13 }}
                          autoFocus
                        />
                        <button className="btn btn-sm btn-primary" disabled={saving} onClick={() => handleSave(setting.key)}>
                          {saving ? '...' : '✓'}
                        </button>
                        <button className="btn btn-sm btn-outline" onClick={() => setEditingKey(null)}>✕</button>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: 14, fontWeight: 500, background: '#f9fafb', padding: '4px 12px', borderRadius: 6 }}>
                          {setting.value}
                        </span>
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => { setEditingKey(setting.key); setEditValue(setting.value) }}
                        >
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
  )
}

export default SystemSettings

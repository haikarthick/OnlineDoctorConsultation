import React, { useState, useEffect } from 'react'
import apiService from '../../services/api'
import { useSettings } from '../../context/SettingsContext'
import { SystemSetting } from '../../types'
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

  useEffect(() => {
    loadSettings()
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

import React, { useState, useEffect } from 'react'
import apiService from '../services/api'
import './ModulePage.css'
import { Enterprise, AlertRule, AlertEvent } from '../types'

const SEVERITY_COLORS: Record<string, string> = { info: '#3b82f6', warning: '#f97316', critical: '#ef4444' }
const RULE_TYPES = ['vaccination_due', 'breeding_due', 'low_feed_stock', 'document_expiry', 'health_threshold', 'custom']

const AlertCenter: React.FC = () => {
  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [selectedEnterpriseId, setSelectedEnterpriseId] = useState('')
  const [rules, setRules] = useState<AlertRule[]>([])
  const [events, setEvents] = useState<AlertEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'events' | 'rules'>('events')
  const [showRuleForm, setShowRuleForm] = useState(false)
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [ruleFormData, setRuleFormData] = useState({
    name: '', ruleType: 'vaccination_due', severity: 'warning' as string,
    conditions: '{}'
  })
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    const fetchEnterprises = async () => {
      try {
        const res = await apiService.listEnterprises({ limit: 100 })
        const items = res.data?.items || []
        setEnterprises(items)
        if (items.length === 1) setSelectedEnterpriseId(items[0].id)
      } catch { setEnterprises([]) }
    }
    fetchEnterprises()
  }, [])

  const fetchData = async () => {
    if (!selectedEnterpriseId) return
    try {
      setLoading(true)
      const [rulesRes, eventsRes] = await Promise.all([
        apiService.listAlertRules(selectedEnterpriseId),
        apiService.listAlertEvents(selectedEnterpriseId)
      ])
      setRules(rulesRes.data || [])
      setEvents(eventsRes.data || [])
    } catch { /* silently fail */ }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [selectedEnterpriseId])

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setSuccessMsg('')
    let conditions: any
    try { conditions = JSON.parse(ruleFormData.conditions) } catch { setError('Invalid JSON in conditions'); return }
    const payload = {
      enterpriseId: selectedEnterpriseId, name: ruleFormData.name,
      ruleType: ruleFormData.ruleType, severity: ruleFormData.severity,
      conditions
    }
    try {
      if (editingRuleId) {
        await apiService.updateAlertRule(editingRuleId, payload)
        setSuccessMsg('Rule updated!')
      } else {
        await apiService.createAlertRule(selectedEnterpriseId, payload)
        setSuccessMsg('Rule created!')
      }
      setShowRuleForm(false); setEditingRuleId(null)
      setRuleFormData({ name: '', ruleType: 'vaccination_due', severity: 'warning', conditions: '{}' })
      fetchData()
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to save rule')
    }
  }

  const handleToggleRule = async (id: string, current: boolean) => {
    try {
      await apiService.toggleAlertRule(id, !current)
      setSuccessMsg(`Rule ${!current ? 'enabled' : 'disabled'}`)
      fetchData()
    } catch { setError('Failed to toggle rule') }
  }

  const handleDeleteRule = async (id: string) => {
    if (!window.confirm('Delete this alert rule?')) return
    try {
      await apiService.deleteAlertRule(id)
      setSuccessMsg('Rule deleted!')
      fetchData()
    } catch { setError('Failed to delete') }
  }

  const handleMarkRead = async (id: string) => {
    try {
      await apiService.markAlertRead(id)
      fetchData()
    } catch { /* */ }
  }

  const handleMarkAllRead = async () => {
    try {
      await apiService.markAllAlertsRead(selectedEnterpriseId)
      setSuccessMsg('All alerts marked as read')
      fetchData()
    } catch { setError('Failed to mark all read') }
  }

  const handleAcknowledge = async (id: string) => {
    try {
      await apiService.acknowledgeAlert(id)
      setSuccessMsg('Alert acknowledged')
      fetchData()
    } catch { setError('Failed to acknowledge') }
  }

  const handleRunChecks = async () => {
    try {
      const res = await apiService.runAlertChecks(selectedEnterpriseId)
      const count = res.data?.triggered || 0
      setSuccessMsg(`Alert checks complete: ${count} alert(s) triggered`)
      fetchData()
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to run checks')
    }
  }

  const startEditRule = (rule: AlertRule) => {
    setEditingRuleId(rule.id)
    setRuleFormData({
      name: rule.name, ruleType: rule.ruleType, severity: rule.severity,
      conditions: JSON.stringify(rule.conditions || {}, null, 2)
    })
    setShowRuleForm(true)
  }

  const unreadCount = events.filter(e => !e.isRead).length

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>🔔 Smart Alert Center</h1>
        <p>Configure alert rules, monitor events, and stay on top of critical issues</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {successMsg && <div className="alert alert-success">{successMsg}</div>}

      <div className="enterprise-selector">
        <label>Select Enterprise:</label>
        <select value={selectedEnterpriseId} onChange={e => setSelectedEnterpriseId(e.target.value)}>
          <option value="">-- Select --</option>
          {enterprises.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
        </select>
      </div>

      {selectedEnterpriseId && (
        <>
          <div className="tab-bar">
            <button className={`tab-btn ${tab === 'events' ? 'active' : ''}`} onClick={() => setTab('events')}>
              🔔 Events {unreadCount > 0 && <span className="badge badge-danger" style={{ marginLeft: 6 }}>{unreadCount}</span>}
            </button>
            <button className={`tab-btn ${tab === 'rules' ? 'active' : ''}`} onClick={() => setTab('rules')}>⚙️ Rules ({rules.length})</button>
            <button className="btn btn-primary" onClick={handleRunChecks}>🔍 Run Alert Checks</button>
            {tab === 'events' && events.length > 0 && <button className="btn btn-secondary" onClick={handleMarkAllRead}>✓ Mark All Read</button>}
            {tab === 'rules' && <button className="btn btn-primary" onClick={() => { setShowRuleForm(!showRuleForm); setEditingRuleId(null) }}>+ New Rule</button>}
          </div>

          {showRuleForm && (
            <form className="module-form" onSubmit={handleCreateRule}>
              <h3>{editingRuleId ? 'Edit Alert Rule' : 'Create Alert Rule'}</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label>Rule Name *</label>
                  <input required value={ruleFormData.name} onChange={e => setRuleFormData({ ...ruleFormData, name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Rule Type</label>
                  <select value={ruleFormData.ruleType} onChange={e => setRuleFormData({ ...ruleFormData, ruleType: e.target.value })}>
                    {RULE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Severity</label>
                  <select value={ruleFormData.severity} onChange={e => setRuleFormData({ ...ruleFormData, severity: e.target.value })}>
                    {['info', 'warning', 'critical'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Conditions (JSON)</label>
                <textarea rows={4} value={ruleFormData.conditions} onChange={e => setRuleFormData({ ...ruleFormData, conditions: e.target.value })} style={{ fontFamily: 'monospace' }} />
                <small>Examples: {`{"daysAhead": 14}`} for vaccination_due, {`{"minScore": 50}`} for health_threshold</small>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">{editingRuleId ? 'Update Rule' : 'Create Rule'}</button>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowRuleForm(false); setEditingRuleId(null) }}>Cancel</button>
              </div>
            </form>
          )}

          {loading ? <p className="loading-text">Loading...</p> : tab === 'events' ? (
            <div className="card full-width">
              <h3>Alert Events</h3>
              {events.length === 0 ? <p className="empty-text">No alert events. Run alert checks to scan for issues.</p> : (
                <div className="alert-events-list">
                  {events.map(ev => (
                    <div key={ev.id} className={`alert-event-card ${!ev.isRead ? 'unread' : ''} severity-${ev.severity}`}>
                      <div className="alert-event-header">
                        <span className="badge" style={{ background: SEVERITY_COLORS[ev.severity] }}>{ev.severity}</span>
                        <strong>{ev.title}</strong>
                        <span className="alert-event-time">{new Date(ev.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="alert-event-message">{ev.message}</p>
                      <div className="alert-event-meta">
                        {ev.ruleName && <span>Rule: {ev.ruleName}</span>}
                        {ev.animalName && <span>Animal: {ev.animalName}</span>}
                        {ev.acknowledgedByName && <span>Acknowledged by: {ev.acknowledgedByName}</span>}
                      </div>
                      <div className="alert-event-actions">
                        {!ev.isRead && <button className="btn btn-sm" onClick={() => handleMarkRead(ev.id)}>Mark Read</button>}
                        {!ev.acknowledgedBy && <button className="btn btn-sm btn-secondary" onClick={() => handleAcknowledge(ev.id)}>Acknowledge</button>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="card full-width">
              <h3>Alert Rules</h3>
              {rules.length === 0 ? <p className="empty-text">No alert rules configured. Create one to start monitoring.</p> : (
                <table className="data-table">
                  <thead><tr><th>Name</th><th>Type</th><th>Severity</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {rules.map(r => (
                      <tr key={r.id}>
                        <td><strong>{r.name}</strong></td>
                        <td>{r.ruleType.replace(/_/g, ' ')}</td>
                        <td><span className="badge" style={{ background: SEVERITY_COLORS[r.severity] }}>{r.severity}</span></td>
                        <td>
                          <button className={`btn btn-sm ${r.isEnabled ? 'btn-success' : 'btn-secondary'}`} onClick={() => handleToggleRule(r.id, r.isEnabled)}>
                            {r.isEnabled ? '✅ Enabled' : '⏸ Disabled'}
                          </button>
                        </td>
                        <td>
                          <button className="btn btn-sm" onClick={() => startEditRule(r)}>Edit</button>
                          <button className="btn btn-sm btn-danger" onClick={() => handleDeleteRule(r.id)}>Del</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default AlertCenter

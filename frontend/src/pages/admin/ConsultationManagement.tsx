import React, { useState, useEffect } from 'react'
import { useSettings } from '../../context/SettingsContext'
import apiService from '../../services/api'
import { Consultation } from '../../types'
import '../../styles/modules.css'

interface ConsultationManagementProps {
  onNavigate: (path: string) => void
}

const ConsultationManagement: React.FC<ConsultationManagementProps> = ({ onNavigate }) => {
  const { formatDate } = useSettings()
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadConsultations()
  }, [statusFilter])

  const loadConsultations = async () => {
    try {
      setLoading(true)
      const result = await apiService.adminListConsultations({ status: statusFilter || undefined })
      setConsultations(result.data?.items || (Array.isArray(result.data) ? result.data : []))
    } catch (err) {
      console.error('Failed to load consultations:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredConsultations = search
    ? consultations.filter(c =>
        (c.title || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.petOwnerName || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.vetName || '').toLowerCase().includes(search.toLowerCase())
      )
    : consultations

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: 'pending', scheduled: 'warning', in_progress: 'active',
      completed: 'active', cancelled: 'danger', no_show: 'inactive'
    }
    return <span className={`badge badge-${map[status] || 'inactive'}`}>{status.replace('_', ' ')}</span>
  }

  const getPriorityColor = (priority: string) => {
    const map: Record<string, string> = { urgent: '#dc2626', high: '#f59e0b', normal: '#10b981', low: '#6b7280' }
    return map[priority] || '#6b7280'
  }

  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <h1>Consultation Management</h1>
          <p className="page-subtitle">{consultations.length} consultations</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={() => onNavigate('/admin/dashboard')}>← Dashboard</button>
        </div>
      </div>

      {/* Filters */}
      <div className="search-filter-bar" style={{ marginBottom: 24 }}>
        <input
          className="form-input"
          placeholder="Search consultations..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1 }}
        />
        <select className="form-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 170 }}>
          <option value="">All Statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="ended">Ended</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button className="btn btn-outline" onClick={loadConsultations}>🔄</button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="loading-container"><div className="loading-spinner" /></div>
      ) : filteredConsultations.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 48 }}>🩺</div>
          <h3>No consultations found</h3>
        </div>
      ) : (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Pet Owner</th>
                <th>Vet</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {filteredConsultations.map(c => (
                <tr key={c.id}>
                  <td><code style={{ fontSize: 12 }}>{c.id.slice(0, 8)}</code></td>
                  <td>{c.title || 'Untitled'}</td>
                  <td>{c.petOwnerName || '—'}</td>
                  <td>{c.vetName || '—'}</td>
                  <td>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      color: getPriorityColor(c.priority || 'normal'), fontWeight: 600, fontSize: 13
                    }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: getPriorityColor(c.priority || 'normal'),
                        display: 'inline-block'
                      }} />
                      {c.priority || 'normal'}
                    </span>
                  </td>
                  <td>{getStatusBadge(c.status)}</td>
                  <td>{formatDate(c.createdAt || '')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default ConsultationManagement

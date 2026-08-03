import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../../context/SettingsContext'
import apiService from '../../services/api'
import { Consultation } from '../../types'
import '../../styles/modules.css'

interface ConsultationManagementProps {
  onNavigate: (path: string) => void
}

const ConsultationManagement: React.FC<ConsultationManagementProps> = ({ onNavigate }) => {
  const { t } = useTranslation()
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
          <h1>{t('consultationManagement.title')}</h1>
          <p className="page-subtitle">{consultations.length} {t('consultationManagement.consultations')}</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={() => onNavigate('/admin/dashboard')}>← {t('consultationManagement.dashboard')}</button>
        </div>
      </div>

      {/* Filters */}
      <div className="search-filter-bar si-af65fe13">
        <input
          className="form-input si-6acd75e8"
          placeholder={t('consultationManagement.searchPlaceholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
         
        />
        <select className="form-input si-f5a545c3" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">{t('consultationManagement.allStatuses')}</option>
          <option value="scheduled">{t('consultationManagement.scheduled')}</option>
          <option value="in_progress">{t('consultationManagement.inProgress')}</option>
          <option value="completed">{t('consultationManagement.completed')}</option>
          <option value="ended">{t('consultationManagement.ended')}</option>
          <option value="cancelled">{t('consultationManagement.cancelled')}</option>
        </select>
        <button className="btn btn-outline" onClick={loadConsultations}>🔄</button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="loading-container"><div className="loading-spinner" /></div>
      ) : filteredConsultations.length === 0 ? (
        <div className="empty-state">
          <div className="si-353e617d">🩺</div>
          <h3>{t('consultationManagement.noConsultationsFound')}</h3>
        </div>
      ) : (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('consultationManagement.id')}</th>
                <th>{t('consultationManagement.titleHeader')}</th>
                <th>{t('consultationManagement.petOwner')}</th>
                <th>{t('consultationManagement.vet')}</th>
                <th>{t('consultationManagement.priority')}</th>
                <th>{t('consultationManagement.status')}</th>
                <th>{t('consultationManagement.created')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredConsultations.map(c => (
                <tr key={c.id}>
                  <td><code className="si-756a9f21">{c.id.slice(0, 8)}</code></td>
                  <td>{c.title || t('consultationManagement.untitled')}</td>
                  <td>{c.petOwnerName || '-'}</td>
                  <td>{c.vetName || '-'}</td>
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

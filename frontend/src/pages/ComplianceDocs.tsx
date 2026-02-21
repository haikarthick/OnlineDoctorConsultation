import React, { useState, useEffect } from 'react'
import apiService from '../services/api'
import './ModulePage.css'
import { Enterprise, ComplianceDocument, ComplianceSummary } from '../types'

const STATUS_COLORS: Record<string, string> = {
  draft: '#94a3b8', active: '#22c55e', expired: '#ef4444', revoked: '#dc2626', pending_renewal: '#f97316'
}

const DOC_TYPES = [
  'movement_permit', 'vaccination_certificate', 'export_certificate',
  'health_certificate', 'inspection_report', 'license', 'insurance',
  'breeding_certificate', 'organic_certification', 'environmental_permit', 'other'
]

const ComplianceDocs: React.FC = () => {
  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [selectedEnterpriseId, setSelectedEnterpriseId] = useState('')
  const [documents, setDocuments] = useState<ComplianceDocument[]>([])
  const [summary, setSummary] = useState<ComplianceSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'documents' | 'summary'>('documents')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    documentType: 'license', title: '', documentNumber: '',
    issuingAuthority: '', issueDate: '', expiryDate: '',
    status: 'draft', fileUrl: '', notes: ''
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
      const [docsRes, summRes] = await Promise.all([
        apiService.listComplianceDocs(selectedEnterpriseId),
        apiService.getComplianceSummary(selectedEnterpriseId)
      ])
      setDocuments(docsRes.data?.items || [])
      setSummary(summRes.data || null)
    } catch { /* silently fail */ }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [selectedEnterpriseId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setSuccessMsg('')
    const payload: Record<string, unknown> = {
      enterpriseId: selectedEnterpriseId,
      ...formData,
      issueDate: formData.issueDate || undefined,
      expiryDate: formData.expiryDate || undefined,
    }
    try {
      if (editingId) {
        await apiService.updateComplianceDoc(editingId, payload)
        setSuccessMsg('Document updated!')
      } else {
        await apiService.createComplianceDoc(selectedEnterpriseId, payload)
        setSuccessMsg('Document created!')
      }
      setShowForm(false); setEditingId(null)
      resetForm()
      fetchData()
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to save document')
    }
  }

  const resetForm = () => setFormData({ documentType: 'license', title: '', documentNumber: '', issuingAuthority: '', issueDate: '', expiryDate: '', status: 'draft', fileUrl: '', notes: '' })

  const handleVerify = async (id: string) => {
    try {
      await apiService.verifyComplianceDoc(id)
      setSuccessMsg('Document verified!')
      fetchData()
    } catch { setError('Failed to verify') }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this document?')) return
    try {
      await apiService.deleteComplianceDoc(id)
      setSuccessMsg('Document deleted!')
      fetchData()
    } catch { setError('Failed to delete') }
  }

  const startEdit = (doc: ComplianceDocument) => {
    setEditingId(doc.id)
    setFormData({
      documentType: doc.documentType, title: doc.title, documentNumber: doc.documentNumber || '',
      issuingAuthority: doc.issuingAuthority || '', issueDate: doc.issueDate?.split('T')[0] || '',
      expiryDate: doc.expiryDate?.split('T')[0] || '', status: doc.status,
      fileUrl: doc.fileUrl || '', notes: doc.notes || ''
    })
    setShowForm(true)
  }

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>📜 Compliance & Regulatory Documents</h1>
        <p>Manage licenses, permits, certifications and track expiry dates</p>
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
            <button className={`tab-btn ${tab === 'documents' ? 'active' : ''}`} onClick={() => setTab('documents')}>📄 Documents</button>
            <button className={`tab-btn ${tab === 'summary' ? 'active' : ''}`} onClick={() => setTab('summary')}>📊 Summary</button>
            <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditingId(null); resetForm() }}>+ Add Document</button>
          </div>

          {showForm && (
            <form className="module-form" onSubmit={handleSubmit}>
              <h3>{editingId ? 'Edit Document' : 'Add Compliance Document'}</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label>Title *</label>
                  <input required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Document Type</label>
                  <select value={formData.documentType} onChange={e => setFormData({ ...formData, documentType: e.target.value })}>
                    {DOC_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Document Number</label>
                  <input value={formData.documentNumber} onChange={e => setFormData({ ...formData, documentNumber: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Issuing Authority</label>
                  <input value={formData.issuingAuthority} onChange={e => setFormData({ ...formData, issuingAuthority: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Issue Date</label>
                  <input type="date" value={formData.issueDate} onChange={e => setFormData({ ...formData, issueDate: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Expiry Date</label>
                  <input type="date" value={formData.expiryDate} onChange={e => setFormData({ ...formData, expiryDate: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                    {['draft', 'active', 'expired', 'revoked', 'pending_renewal'].map(s => <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>File URL</label>
                  <input value={formData.fileUrl} onChange={e => setFormData({ ...formData, fileUrl: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea rows={2} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">{editingId ? 'Update' : 'Add Document'}</button>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); setEditingId(null) }}>Cancel</button>
              </div>
            </form>
          )}

          {loading ? <p className="loading-text">Loading...</p> : tab === 'documents' ? (
            <div className="card full-width">
              <h3>All Compliance Documents</h3>
              {documents.length === 0 ? <p className="empty-text">No documents yet.</p> : (
                <table className="data-table">
                  <thead><tr><th>Title</th><th>Type</th><th>Number</th><th>Authority</th><th>Expiry</th><th>Status</th><th>Verified</th><th>Actions</th></tr></thead>
                  <tbody>
                    {documents.map(d => {
                      const isExpiring = d.expiryDate && new Date(d.expiryDate) < new Date(Date.now() + 30 * 86400000)
                      const isExpired = d.expiryDate && new Date(d.expiryDate) < new Date()
                      return (
                        <tr key={d.id} className={isExpired ? 'row-danger' : isExpiring ? 'row-warning' : ''}>
                          <td><strong>{d.title}</strong></td>
                          <td>{d.documentType.replace(/_/g, ' ')}</td>
                          <td>{d.documentNumber || '–'}</td>
                          <td>{d.issuingAuthority || '–'}</td>
                          <td>{d.expiryDate ? new Date(d.expiryDate).toLocaleDateString() : '–'}</td>
                          <td><span className="badge" style={{ background: STATUS_COLORS[d.status] || '#888' }}>{d.status.replace(/_/g, ' ')}</span></td>
                          <td>{d.verifiedAt ? `✅ ${d.verifiedByName || ''}` : '—'}</td>
                          <td>
                            <button className="btn btn-sm" onClick={() => startEdit(d)}>Edit</button>
                            {!d.verifiedAt && <button className="btn btn-sm btn-success" onClick={() => handleVerify(d.id)}>Verify</button>}
                            <button className="btn btn-sm btn-danger" onClick={() => handleDelete(d.id)}>Del</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          ) : summary ? (
            <div className="dashboard-grid">
              <div className="card">
                <h3>⚠️ Expiring Soon (30 days)</h3>
                {(summary.expiringSoon || []).length === 0 ? <p className="empty-text">No documents expiring soon!</p> : (
                  <ul className="alert-list">
                    {summary.expiringSoon.map(d => (
                      <li key={d.id} className="alert-item warning">
                        <strong>{d.title}</strong> – expires {d.expiryDate ? new Date(d.expiryDate).toLocaleDateString() : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="card">
                <h3>🚨 Expired</h3>
                {(summary.expired || []).length === 0 ? <p className="empty-text">No expired documents!</p> : (
                  <ul className="alert-list">
                    {summary.expired.map(d => (
                      <li key={d.id} className="alert-item danger">
                        <strong>{d.title}</strong> – expired {d.expiryDate ? new Date(d.expiryDate).toLocaleDateString() : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="card">
                <h3>By Document Type</h3>
                <table className="data-table compact">
                  <thead><tr><th>Type</th><th>Count</th></tr></thead>
                  <tbody>
                    {(summary.byType || []).map(t => (
                      <tr key={t.document_type}><td>{t.document_type.replace(/_/g, ' ')}</td><td>{t.count}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="card">
                <h3>By Status</h3>
                <div className="stats-row wrap">
                  {(summary.byStatus || []).map(s => (
                    <div key={s.status} className="stat-item" style={{ borderLeft: `4px solid ${STATUS_COLORS[s.status] || '#888'}` }}>
                      <span className="stat-value">{s.count}</span>
                      <span className="stat-label">{s.status.replace(/_/g, ' ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

export default ComplianceDocs

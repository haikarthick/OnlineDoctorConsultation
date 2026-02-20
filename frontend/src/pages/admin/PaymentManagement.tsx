import React, { useState, useEffect } from 'react'
import { useSettings } from '../../context/SettingsContext'
import apiService from '../../services/api'
import { Payment } from '../../types'
import '../../styles/modules.css'

interface PaymentManagementProps {
  onNavigate: (path: string) => void
}

const PaymentManagement: React.FC<PaymentManagementProps> = ({ onNavigate }) => {
  const { formatDate } = useSettings()
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [refundingId, setRefundingId] = useState<string | null>(null)
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    loadPayments()
  }, [statusFilter])

  const loadPayments = async () => {
    try {
      setLoading(true)
      const result = await apiService.adminListPayments({ status: statusFilter || undefined })
      setPayments(result.data?.items || (Array.isArray(result.data) ? result.data : []))
    } catch (err) {
} finally {
      setLoading(false)
    }
  }

  const handleRefund = async () => {
    if (!refundingId || !refundAmount) return
    try {
      setProcessing(true)
      await apiService.adminProcessRefund(refundingId, parseInt(refundAmount), refundReason)
      setRefundingId(null)
      setRefundAmount('')
      setRefundReason('')
      loadPayments()
    } catch (err) {
} finally {
      setProcessing(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: 'pending', completed: 'active', failed: 'danger', refunded: 'warning', partially_refunded: 'warning'
    }
    return <span className={`badge badge-${map[status] || 'inactive'}`}>{status.replace('_', ' ')}</span>
  }

  const totalRevenue = payments.filter(p => p.status === 'completed').reduce((s, p) => s + p.amount, 0)
  const totalRefunded = payments.filter(p => p.status === 'refunded' || p.status === 'partially_refunded').reduce((s, p) => s + (p.refundAmount || 0), 0)

  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <h1>Payment Management</h1>
          <p className="page-subtitle">{payments.length} payments</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={() => onNavigate('/admin/dashboard')}>← Dashboard</button>
        </div>
      </div>

      {/* Summary */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-value">${(totalRevenue / 100).toLocaleString()}</div>
          <div className="stat-label">Total Revenue</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">↩️</div>
          <div className="stat-value">${(totalRefunded / 100).toLocaleString()}</div>
          <div className="stat-label">Total Refunded</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⏳</div>
          <div className="stat-value">{payments.filter(p => p.status === 'pending').length}</div>
          <div className="stat-label">Pending Payments</div>
        </div>
      </div>

      {/* Refund Modal */}
      {refundingId && (
        <div className="modal-overlay" onClick={() => setRefundingId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2>Process Refund</h2>
              <button className="modal-close" onClick={() => setRefundingId(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Refund Amount (cents)</label>
                <input className="form-input" type="number" value={refundAmount} onChange={e => setRefundAmount(e.target.value)} placeholder="e.g. 5000 for $50" />
              </div>
              <div className="form-group">
                <label className="form-label">Reason</label>
                <textarea className="form-input" rows={3} value={refundReason} onChange={e => setRefundReason(e.target.value)} placeholder="Reason for refund..." />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                <button className="btn btn-outline" onClick={() => setRefundingId(null)}>Cancel</button>
                <button className="btn btn-warning" disabled={processing || !refundAmount} onClick={handleRefund}>
                  {processing ? 'Processing...' : 'Process Refund'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="search-filter-bar" style={{ marginBottom: 16 }}>
        <select className="form-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 180 }}>
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
        <button className="btn btn-outline" onClick={loadPayments}>🔄</button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="loading-container"><div className="loading-spinner" /></div>
      ) : payments.length === 0 ? (
        <div className="empty-state"><div style={{ fontSize: 48 }}>💳</div><h3>No payments found</h3></div>
      ) : (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Amount</th>
                <th>Tax</th>
                <th>Method</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id}>
                  <td><code style={{ fontSize: 12 }}>{p.invoiceNumber || p.id.slice(0, 8)}</code></td>
                  <td><strong>${(p.amount / 100).toFixed(2)}</strong></td>
                  <td>${((p.taxAmount || 0) / 100).toFixed(2)}</td>
                  <td>{p.paymentMethod || '—'}</td>
                  <td>{getStatusBadge(p.status)}</td>
                  <td>{formatDate(p.createdAt || '')}</td>
                  <td>
                    {p.status === 'completed' && (
                      <button className="btn btn-sm btn-warning" onClick={() => { setRefundingId(p.id); setRefundAmount(String(p.amount)) }}>
                        ↩️ Refund
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default PaymentManagement

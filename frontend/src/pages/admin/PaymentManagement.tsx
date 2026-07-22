import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../../context/SettingsContext'
import apiService from '../../services/api'
import { Payment } from '../../types'
import '../../styles/modules.css'

interface PaymentManagementProps {
  onNavigate: (path: string) => void
}

const PaymentManagement: React.FC<PaymentManagementProps> = ({ onNavigate }) => {
  const { formatDate, formatCurrency } = useSettings()
  const { t } = useTranslation()
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [refundingId, setRefundingId] = useState<string | null>(null)
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('')
  const [processing, setProcessing] = useState(false)
  const [activeTab, setActiveTab] = useState<'payments' | 'wallets'>('payments')
  const [walletSummary, setWalletSummary] = useState<any>(null)
  const [walletLoading, setWalletLoading] = useState(false)

  useEffect(() => {
    loadPayments()
  }, [statusFilter])

  useEffect(() => {
    if (activeTab === 'wallets') loadWalletSummary()
  }, [activeTab])

  const loadWalletSummary = async () => {
    try {
      setWalletLoading(true)
      const result = await apiService.adminGetWalletSummary()
      setWalletSummary(result.data)
    } catch (err) {
      console.error('Failed to load wallet summary:', err)
    } finally {
      setWalletLoading(false)
    }
  }

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
          <h1>{t('paymentManagement.title')}</h1>
          <p className="page-subtitle">{payments.length} {t('paymentManagement.payments')}</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={() => onNavigate('/admin/dashboard')}>← {t('paymentManagement.dashboard')}</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="module-tabs si-af65fe13">
        <button className={`module-tab${activeTab === 'payments' ? ' active' : ''}`} onClick={() => setActiveTab('payments')}>
          💳 {t('paymentManagement.title')}
        </button>
        <button className={`module-tab${activeTab === 'wallets' ? ' active' : ''}`} onClick={() => setActiveTab('wallets')}>
          👛 {t('paymentManagement.walletOverview')}
        </button>
      </div>

      {/* Wallet Overview Tab */}
      {activeTab === 'wallets' && (
        <div>
          {walletLoading ? (
            <div className="loading-container"><div className="loading-spinner" /></div>
          ) : walletSummary ? (
            <>
              <div className="stats-grid si-ca072b4a">
                <div className="stat-card">
                  <div className="stat-icon">💰</div>
                  <div className="stat-value">{formatCurrency((walletSummary.summary?.totalPlatformBalance || 0) / 100)}</div>
                  <div className="stat-label">{t('paymentManagement.totalPlatformBalance')}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">👥</div>
                  <div className="stat-value">{walletSummary.summary?.usersWithPositiveBalance || 0}</div>
                  <div className="stat-label">{t('paymentManagement.usersWithBalance')}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">📊</div>
                  <div className="stat-value">{formatCurrency((walletSummary.summary?.avgBalance || 0) / 100)}</div>
                  <div className="stat-label">{t('paymentManagement.avgBalance')}</div>
                </div>
              </div>
              <h3 className="si-bab8e8bc">{t('paymentManagement.topBalances')}</h3>
              {walletSummary.topBalances?.length === 0 ? (
                <div className="empty-state"><p>No wallet balances found.</p></div>
              ) : (
                <div className="data-table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{t('userManagement.user')}</th>
                        <th>{t('userManagement.email')}</th>
                        <th>{t('userManagement.role')}</th>
                        <th>{t('paymentManagement.amount')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(walletSummary.topBalances || []).map((w: any) => (
                        <tr key={w.userId}>
                          <td>{w.userName}</td>
                          <td>{w.email}</td>
                          <td>{w.role}</td>
                          <td><strong>{formatCurrency((w.balance || 0) / 100)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state"><p>Failed to load wallet data.</p></div>
          )}
        </div>
      )}

      {/* Payments Tab */}
      {activeTab === 'payments' && (<>

      {/* Summary */}
      <div className="stats-grid si-30ab8a62">
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-value">{formatCurrency(totalRevenue / 100)}</div>
          <div className="stat-label">{t('paymentManagement.totalRevenue')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">↩️</div>
          <div className="stat-value">{formatCurrency(totalRefunded / 100)}</div>
          <div className="stat-label">{t('paymentManagement.totalRefunded')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⏳</div>
          <div className="stat-value">{payments.filter(p => p.status === 'pending').length}</div>
          <div className="stat-label">{t('paymentManagement.pendingPayments')}</div>
        </div>
      </div>

      {/* Refund Modal */}
      {refundingId && (
        <div className="modal-overlay" onClick={() => setRefundingId(null)}>
          <div className="modal si-25615047" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('paymentManagement.processRefund')}</h2>
              <button className="modal-close" onClick={() => setRefundingId(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">{t('paymentManagement.refundAmountLabel')}</label>
                <input className="form-input" type="number" value={refundAmount} onChange={e => setRefundAmount(e.target.value)} placeholder={t('paymentManagement.refundAmountPlaceholder')} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('paymentManagement.reason')}</label>
                <textarea className="form-input" rows={3} value={refundReason} onChange={e => setRefundReason(e.target.value)} placeholder={t('paymentManagement.reasonPlaceholder')} />
              </div>
              <div className="si-f5f9f5f6">
                <button className="btn btn-outline" onClick={() => setRefundingId(null)}>{t('paymentManagement.cancel')}</button>
                <button className="btn btn-warning" disabled={processing || !refundAmount} onClick={handleRefund}>
                  {processing ? t('paymentManagement.processing') : t('paymentManagement.processRefund')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="search-filter-bar si-7e63ec4f">
        <select className="form-input si-7f996198" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">{t('paymentManagement.allStatuses')}</option>
          <option value="pending">{t('paymentManagement.pending')}</option>
          <option value="completed">{t('paymentManagement.completed')}</option>
          <option value="failed">{t('paymentManagement.failed')}</option>
          <option value="refunded">{t('paymentManagement.refunded')}</option>
        </select>
        <button className="btn btn-outline" onClick={loadPayments}>🔄</button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="loading-container"><div className="loading-spinner" /></div>
      ) : payments.length === 0 ? (
        <div className="empty-state"><div className="si-353e617d">💳</div><h3>{t('paymentManagement.noPaymentsFound')}</h3></div>
      ) : (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('paymentManagement.invoice')}</th>
                <th>{t('paymentManagement.amount')}</th>
                <th>{t('paymentManagement.tax')}</th>
                <th>{t('paymentManagement.method')}</th>
                <th>{t('paymentManagement.status')}</th>
                <th>{t('paymentManagement.date')}</th>
                <th>{t('paymentManagement.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id}>
                  <td><code className="si-756a9f21">{p.invoiceNumber || p.id.slice(0, 8)}</code></td>
                  <td><strong>{formatCurrency(p.amount / 100)}</strong></td>
                  <td>{formatCurrency((p.taxAmount || 0) / 100)}</td>
                  <td>{p.paymentMethod || '—'}</td>
                  <td>{getStatusBadge(p.status)}</td>
                  <td>{formatDate(p.createdAt || '')}</td>
                  <td>
                    {p.status === 'completed' && (
                      <button className="btn btn-sm btn-warning" onClick={() => { setRefundingId(p.id); setRefundAmount(String(p.amount)) }}>
                        ↩️ {t('paymentManagement.refund')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </>)}
    </div>
  )
}

export default PaymentManagement

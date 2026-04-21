import React, { useState, useEffect } from 'react'
import { useSettings } from '../context/SettingsContext'
import apiService from '../services/api'
import { Wallet as WalletType, WalletTransaction } from '../types'
import '../styles/modules.css'
import { useTranslation } from 'react-i18next'
import { useAutoRefresh } from '../hooks/useAutoRefresh'

interface WalletProps {
  onNavigate: (path: string) => void
}

const Wallet: React.FC<WalletProps> = ({ onNavigate }) => {
  const { t } = useTranslation()

  const { formatDateTime, settings, formatCurrency } = useSettings()
  const [wallet, setWallet] = useState<WalletType | null>(null)
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [txLoading, setTxLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const limit = 20

  useEffect(() => {
    loadWallet()
    loadTransactions(0)
  }, [])

  const loadWallet = async () => {
    try {
      const result = await apiService.getWallet()
      setWallet(result.data)
    } catch {
      // Wallet may not exist yet
    } finally {
      setLoading(false)
    }
  }
  useAutoRefresh('wallet', loadWallet)

  const loadTransactions = async (newOffset: number) => {
    try {
      setTxLoading(true)
      const result = await apiService.getWalletTransactions({ limit, offset: newOffset })
      const data = result.data
      if (newOffset === 0) {
        setTransactions(data.items || [])
      } else {
        setTransactions(prev => [...prev, ...(data.items || [])])
      }
      setHasMore(data.hasMore || false)
      setOffset(newOffset)
    } catch {
      // silent
    } finally {
      setTxLoading(false)
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'credit': return '💰'
      case 'refund': return '↩️'
      case 'bonus': return '🎁'
      case 'debit': return '💸'
      default: return '📋'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'credit': case 'refund': case 'bonus': return '#059669'
      case 'debit': return '#dc2626'
      default: return '#6b7280'
    }
  }

  const getTypeBadge = (type: string) => {
    const colors: Record<string, { bg: string; fg: string }> = {
      credit: { bg: '#d1fae5', fg: '#065f46' },
      refund: { bg: '#dbeafe', fg: '#1e40af' },
      bonus: { bg: '#fef3c7', fg: '#92400e' },
      debit: { bg: '#fee2e2', fg: '#991b1b' },
    }
    const c = colors[type] || { bg: '#f3f4f6', fg: '#374151' }
    return (
      <span style={{ background: c.bg, color: c.fg, padding: '3px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>
        {type}
      </span>
    )
  }

  if (loading) {
    return <div className="module-page"><div className="loading-container"><div className="loading-spinner" /></div></div>
  }

  const balance = wallet?.balance || 0
  const bonus = wallet?.bonusCredits || 0
  const total = balance + bonus
  const gatewayMode = settings.paymentGatewayMode

  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <h1>{t('wallet.pageTitle')}</h1>
          <p className="page-subtitle">{t('wallet.subtitle')}</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={() => onNavigate('/consultations')}>{t('wallet.myConsultations')}</button>
        </div>
      </div>

      {/* Balance Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>{t('wallet.totalBalance')}</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#059669' }}>{formatCurrency(total)}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>{t('wallet.refundBalance')}</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: '#2563eb' }}>{formatCurrency(balance)}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>{t('wallet.bonusCredits')}</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: '#d97706' }}>{formatCurrency(bonus)}</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{t('wallet.bonusTip')}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>{t('wallet.paymentMode')}</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>
            {gatewayMode === 'demo' && <span style={{ color: '#d97706' }}>🧪 Demo</span>}
            {gatewayMode === 'test' && <span style={{ color: '#2563eb' }}>🔧 Test</span>}
            {gatewayMode === 'live' && <span style={{ color: '#059669' }}>🟢 Live</span>}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
            {gatewayMode === 'demo' ? t('wallet.simulated') : gatewayMode === 'test' ? t('wallet.sandbox') : t('wallet.realPayments')}
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="card">
        <div className="card-header">
          <h2>{t('wallet.transactionHistory')}</h2>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {transactions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6b7280' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>💳</div>
              <h3>{t('wallet.noTransactions')}</h3>
              <p>{t('wallet.refundsAppearHere')}</p>
            </div>
          ) : (
            <>
              {transactions.map(tx => (
                <div key={tx.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '14px 20px', borderBottom: '1px solid #f3f4f6'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                    <span style={{ fontSize: 24 }}>{getTypeIcon(tx.type)}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{tx.description}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                        {formatDateTime(tx.createdAt)}
                        {tx.referenceType && (
                          <span style={{ marginLeft: 8, background: '#f3f4f6', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>
                            {tx.referenceType}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {getTypeBadge(tx.type)}
                    <span style={{ fontSize: 16, fontWeight: 600, color: getTypeColor(tx.type), minWidth: 80, textAlign: 'right' }}>
                      {tx.type === 'debit' ? '-' : '+'}{formatCurrency(tx.amount)}
                    </span>
                  </div>
                </div>
              ))}
              {hasMore && (
                <div style={{ textAlign: 'center', padding: 16 }}>
                  <button className="btn btn-outline" disabled={txLoading} onClick={() => loadTransactions(offset + limit)}>
                    {txLoading ? t('common.loading') : t('wallet.loadMore')}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default Wallet

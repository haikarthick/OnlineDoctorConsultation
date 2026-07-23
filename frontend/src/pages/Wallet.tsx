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
    } catch (err: any) {
      console.error('Wallet load error:', err?.message)
      // Wallet may not exist yet - non-fatal
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
    } catch (err: any) {
      console.error('Wallet transactions load error:', err?.message)
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
      <div className="si-3b3f146b">
        <div className="card si-5e451b11">
          <div className="si-d8c79ed7">{t('wallet.totalBalance')}</div>
          <div className="si-e6038282">{formatCurrency(total)}</div>
        </div>
        <div className="card si-5e451b11">
          <div className="si-d8c79ed7">{t('wallet.refundBalance')}</div>
          <div className="si-87ce733a">{formatCurrency(balance)}</div>
        </div>
        <div className="card si-5e451b11">
          <div className="si-d8c79ed7">{t('wallet.bonusCredits')}</div>
          <div className="si-a3e9861f">{formatCurrency(bonus)}</div>
          <div className="si-1f14f25b">{t('wallet.bonusTip')}</div>
        </div>
        <div className="card si-5e451b11">
          <div className="si-d8c79ed7">{t('wallet.paymentMode')}</div>
          <div className="si-48056e8a">
            {gatewayMode === 'demo' && <span className="si-cdb09cc1">🧪 Demo</span>}
            {gatewayMode === 'test' && <span className="si-8cec8808">🔧 Test</span>}
            {gatewayMode === 'live' && <span className="si-487e8582">🟢 Live</span>}
          </div>
          <div className="si-1f14f25b">
            {gatewayMode === 'demo' ? t('wallet.simulated') : gatewayMode === 'test' ? t('wallet.sandbox') : t('wallet.realPayments')}
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="card">
        <div className="card-header">
          <h2>{t('wallet.transactionHistory')}</h2>
        </div>
        <div className="card-body si-159de68c">
          {transactions.length === 0 ? (
            <div className="si-f94b6ef9">
              <div className="si-94ee153f">💳</div>
              <h3>{t('wallet.noTransactions')}</h3>
              <p>{t('wallet.refundsAppearHere')}</p>
            </div>
          ) : (
            <>
              {transactions.map(tx => (
                <div key={tx.id} className="si-0d39f6c9">
                  <div className="si-3216ecf2">
                    <span className="si-2ae66f62">{getTypeIcon(tx.type)}</span>
                    <div>
                      <div className="si-0c1df75e">{tx.description}</div>
                      <div className="si-55c58fd0">
                        {formatDateTime(tx.createdAt)}
                        {tx.referenceType && (
                          <span className="si-e084bc25">
                            {tx.referenceType}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="si-0b20392f">
                    {getTypeBadge(tx.type)}
                    <span style={{ fontSize: 16, fontWeight: 600, color: getTypeColor(tx.type), minWidth: 80, textAlign: 'right' }}>
                      {tx.type === 'debit' ? '-' : '+'}{formatCurrency(tx.amount)}
                    </span>
                  </div>
                </div>
              ))}
              {hasMore && (
                <div className="si-0e6b0ac5">
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

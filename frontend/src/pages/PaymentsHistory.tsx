import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../services/api'
import { useSettings } from '../context/SettingsContext'
import './ModulePage.css'
import '../styles/modules.css'

/**
 * Payments & Receipts page (docs/PAYMENT_MODULE_PLAN.md §10 — patient/farmer).
 * Lists the user's payments with status and opens a printable receipt.
 */
export default function PaymentsHistory() {
  const { t } = useTranslation()
  const { formatCurrency } = useSettings()
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [receipt, setReceipt] = useState<any>(null)
  const [receiptLoading, setReceiptLoading] = useState(false)

  useEffect(() => {
    apiService.listPayments({ limit: 50 })
      .then((resp: any) => {
        const data = resp?.data || resp
        const list = data?.payments || data || []
        setPayments(Array.isArray(list) ? list : [])
      })
      .catch(() => setPayments([]))
      .finally(() => setLoading(false))
  }, [])

  const openReceipt = useCallback(async (paymentId: string) => {
    try {
      setReceiptLoading(true)
      const resp: any = await apiService.getPaymentReceipt(paymentId)
      setReceipt(resp?.data || resp)
    } catch { /* receipt unavailable */ } finally {
      setReceiptLoading(false)
    }
  }, [])

  const statusBadge = (status: string) => {
    const colors: Record<string, { bg: string; fg: string }> = {
      completed: { bg: '#dcfce7', fg: '#15803d' },
      partially_refunded: { bg: '#fef9c3', fg: '#a16207' },
      refunded: { bg: '#dbeafe', fg: '#1d4ed8' },
      pending: { bg: '#fef3c7', fg: '#b45309' },
      created: { bg: '#f3f4f6', fg: '#6b7280' },
      expired: { bg: '#f3f4f6', fg: '#6b7280' },
      failed: { bg: '#fee2e2', fg: '#b91c1c' },
      transferred: { bg: '#ede9fe', fg: '#6d28d9' },
    }
    const c = colors[status] || colors.created
    return (
      <span style={{ background: c.bg, color: c.fg, padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
        {t(`payment.status.${status}`, status)}
      </span>
    )
  }

  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <h1>{t('paymentsPage.title')}</h1>
          <p className="page-subtitle">{t('paymentsPage.subtitle')}</p>
        </div>
      </div>

      {loading ? (
        <div className="loading-container"><div className="loading-spinner" /><p>{t('common.loading')}</p></div>
      ) : payments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>💳</div>
          <p>{t('paymentsPage.empty')}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {payments.map((p) => (
            <div key={p.id} style={{
              background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 18px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 17 }}>{formatCurrency(parseFloat(String(p.amount)))}</div>
                <div style={{ color: '#6b7280', fontSize: 13 }}>
                  {p.createdAt ? new Date(p.createdAt).toLocaleString() : '—'}
                  {p.transactionId ? ` · ${p.transactionId}` : ''}
                </div>
                {parseFloat(String(p.refundAmount || 0)) > 0 && (
                  <div style={{ color: '#1d4ed8', fontSize: 13, marginTop: 2 }}>
                    {t('paymentsPage.refunded')}: {formatCurrency(parseFloat(String(p.refundAmount)))}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {statusBadge(p.status)}
                {['completed', 'partially_refunded', 'refunded'].includes(p.status) && (
                  <button className="btn btn-outline" style={{ padding: '6px 14px', fontSize: 13 }}
                    onClick={() => openReceipt(p.id)} disabled={receiptLoading}>
                    {t('paymentsPage.viewReceipt')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Receipt modal (print-friendly) */}
      {receipt && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }} onClick={() => setReceipt(null)}>
          <div style={{ background: 'white', borderRadius: 12, maxWidth: 440, width: '100%', padding: 28 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: 'center', borderBottom: '2px solid #1e3a5f', paddingBottom: 12, marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>{t('paymentsPage.receiptTitle')}</h2>
              <div style={{ color: '#6b7280', fontSize: 13 }}>{receipt.transactionId || receipt.id}</div>
            </div>
            <div style={{ fontSize: 14, lineHeight: 2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#6b7280' }}>{t('paymentsPage.patient')}</span><strong>{receipt.patientName || '—'}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#6b7280' }}>{t('paymentsPage.doctor')}</span><strong>{receipt.doctorName || '—'}</strong></div>
              {receipt.animalName && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#6b7280' }}>{t('paymentsPage.animal')}</span><strong>{receipt.animalName}</strong></div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#6b7280' }}>{t('paymentsPage.date')}</span><strong>{receipt.paidAt ? new Date(receipt.paidAt).toLocaleString() : '—'}</strong></div>
              {parseFloat(String(receipt.walletAmountUsed || 0)) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#6b7280' }}>{t('payment.walletApplied')}</span><strong>{formatCurrency(parseFloat(String(receipt.walletAmountUsed)))}</strong></div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e5e7eb', marginTop: 8, paddingTop: 8, fontSize: 17 }}>
                <strong>{t('paymentsPage.totalPaid')}</strong>
                <strong>{formatCurrency(parseFloat(String(receipt.amount)))}</strong>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setReceipt(null)}>{t('common.close')}</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => window.print()}>{t('paymentsPage.print')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

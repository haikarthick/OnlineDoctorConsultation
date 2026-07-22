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
      const data = resp?.data || resp
      // §7: attach the GST invoice snapshot when one exists
      try {
        const invResp: any = await apiService.getInvoiceByPayment(paymentId)
        const inv = invResp?.data
        if (inv) data.invoice = inv
      } catch { /* invoice optional */ }
      setReceipt(data)
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
        <div className="si-71785fd4">
          <div className="si-fc4388e2">💳</div>
          <p>{t('paymentsPage.empty')}</p>
        </div>
      ) : (
        <div className="si-2a57fba0">
          {payments.map((p) => (
            <div key={p.id} className="si-59aaa11e">
              <div className="si-8b796880">
                <div className="si-1ad73044">{formatCurrency(parseFloat(String(p.amount)))}</div>
                <div className="si-c3b93ebb">
                  {p.createdAt ? new Date(p.createdAt).toLocaleString() : '—'}
                  {p.transactionId ? ` · ${p.transactionId}` : ''}
                </div>
                {parseFloat(String(p.refundAmount || 0)) > 0 && (
                  <div className="si-e55a7786">
                    {t('paymentsPage.refunded')}: {formatCurrency(parseFloat(String(p.refundAmount)))}
                  </div>
                )}
              </div>
              <div className="si-98d3a741">
                {statusBadge(p.status)}
                {['completed', 'partially_refunded', 'refunded'].includes(p.status) && (
                  <button className="btn btn-outline si-efbe533c"
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
        <div className="si-9f028f26" onClick={() => setReceipt(null)}>
          <div className="si-7c046c3b" onClick={(e) => e.stopPropagation()}>
            <div className="si-9442077b">
              <h2 className="si-44087c4b">{t('paymentsPage.receiptTitle')}</h2>
              <div className="si-c3b93ebb">{receipt.transactionId || receipt.id}</div>
            </div>
            <div className="si-134fc453">
              <div className="si-34ec0bf0"><span className="si-23033f05">{t('paymentsPage.patient')}</span><strong>{receipt.patientName || '—'}</strong></div>
              <div className="si-34ec0bf0"><span className="si-23033f05">{t('paymentsPage.doctor')}</span><strong>{receipt.doctorName || '—'}</strong></div>
              {receipt.animalName && (
                <div className="si-34ec0bf0"><span className="si-23033f05">{t('paymentsPage.animal')}</span><strong>{receipt.animalName}</strong></div>
              )}
              <div className="si-34ec0bf0"><span className="si-23033f05">{t('paymentsPage.date')}</span><strong>{receipt.paidAt ? new Date(receipt.paidAt).toLocaleString() : '—'}</strong></div>
              {parseFloat(String(receipt.walletAmountUsed || 0)) > 0 && (
                <div className="si-34ec0bf0"><span className="si-23033f05">{t('payment.walletApplied')}</span><strong>{formatCurrency(parseFloat(String(receipt.walletAmountUsed)))}</strong></div>
              )}
              {receipt.invoice && (
                <>
                  <div className="si-34ec0bf0">
                    <span className="si-23033f05">{t('paymentsPage.invoiceNumber')}</span>
                    <strong>{receipt.invoice.invoiceNumber}</strong>
                  </div>
                  {receipt.invoice.taxAmount > 0 && (
                    <>
                      <div className="si-34ec0bf0">
                        <span className="si-23033f05">{t('paymentsPage.taxableValue')}</span>
                        <strong>{formatCurrency(receipt.invoice.subtotal)}</strong>
                      </div>
                      <div className="si-34ec0bf0">
                        <span className="si-23033f05">GST ({receipt.invoice.taxRate}%)</span>
                        <strong>{formatCurrency(receipt.invoice.taxAmount)}</strong>
                      </div>
                    </>
                  )}
                  {receipt.invoice.taxAmount === 0 && (
                    <div className="si-a5de6cea">{t('paymentsPage.gstExempt')} · SAC {receipt.invoice.sacCode}</div>
                  )}
                </>
              )}
              <div className="si-42ea42ac">
                <strong>{t('paymentsPage.totalPaid')}</strong>
                <strong>{formatCurrency(parseFloat(String(receipt.amount)))}</strong>
              </div>
            </div>
            <div className="si-a4739118">
              <button className="btn btn-outline si-6acd75e8" onClick={() => setReceipt(null)}>{t('common.close')}</button>
              <button className="btn btn-primary si-6acd75e8" onClick={() => window.print()}>{t('paymentsPage.print')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

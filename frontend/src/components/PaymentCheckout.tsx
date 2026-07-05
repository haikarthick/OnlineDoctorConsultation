import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../services/api'
import { useSettings } from '../context/SettingsContext'

interface PaymentCheckoutProps {
  bookingId: string
  amount: number
  expiresAt?: string | null
  onSuccess: () => void
  onCancel: () => void
}

interface Breakdown {
  paymentId: string
  amount: number
  walletApplied: number
  payableNow: number
  gatewayMode: string
  paid: boolean
}

/**
 * Payment step shown after a booking is created in payment_pending state
 * (docs/PAYMENT_MODULE_PLAN.md §10). Demo gateway renders a simulated
 * checkout dialog; P2 swaps in the Razorpay checkout for razorpay modes.
 */
export default function PaymentCheckout({ bookingId, amount, expiresAt, onSuccess, onCancel }: PaymentCheckoutProps) {
  const { t } = useTranslation()
  const { formatCurrency } = useSettings()
  const [walletBalance, setWalletBalance] = useState(0)
  const [useWallet, setUseWallet] = useState(false)
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null)
  const [showDemoDialog, setShowDemoDialog] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [expired, setExpired] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

  useEffect(() => {
    apiService.getWallet()
      .then((resp: any) => {
        const w = resp?.data || resp
        const bal = parseFloat(String(w?.balance ?? 0)) + parseFloat(String(w?.bonusCredits ?? 0))
        setWalletBalance(Number.isFinite(bal) ? bal : 0)
      })
      .catch(() => setWalletBalance(0))
  }, [])

  useEffect(() => {
    if (!expiresAt) return
    const tick = () => {
      const left = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
      setSecondsLeft(left > 0 ? left : 0)
      if (left <= 0) setExpired(true)
    }
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [expiresAt])

  const walletApplied = useWallet ? Math.min(walletBalance, amount) : 0
  const payablePreview = Math.max(0, Math.round((amount - walletApplied) * 100) / 100)

  const handlePay = useCallback(async () => {
    try {
      setProcessing(true)
      setError('')
      const resp = await apiService.initiatePaymentCheckout(bookingId, useWallet)
      const data: Breakdown = resp?.data || resp
      setBreakdown(data)
      if (data.paid) {
        onSuccess()
        return
      }
      if (data.gatewayMode === 'demo') {
        setShowDemoDialog(true)
      } else {
        // Razorpay checkout opens here in P2
        setError(t('payment.gatewayUnavailable'))
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.response?.data?.error || err.response?.data?.message || t('payment.checkoutFailed'))
    } finally {
      setProcessing(false)
    }
  }, [bookingId, useWallet, onSuccess, t])

  const handleDemoResult = useCallback(async (simulateSuccess: boolean) => {
    if (!breakdown) return
    setShowDemoDialog(false)
    if (!simulateSuccess) {
      setError(t('payment.demoFailed'))
      return
    }
    try {
      setProcessing(true)
      setError('')
      await apiService.verifyPayment({ paymentId: breakdown.paymentId })
      onSuccess()
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.response?.data?.error || err.response?.data?.message || t('payment.verificationFailed'))
    } finally {
      setProcessing(false)
    }
  }, [breakdown, onSuccess, t])

  const fmtCountdown = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  if (expired) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>⌛</div>
        <h2 style={{ marginBottom: 8 }}>{t('payment.expiredTitle')}</h2>
        <p style={{ color: '#6b7280', marginBottom: 24 }}>{t('payment.expiredMessage')}</p>
        <button className="btn btn-primary" onClick={onCancel}>{t('payment.bookAgain')}</button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px' }}>
      <h2 style={{ textAlign: 'center', marginBottom: 4 }}>{t('payment.title')}</h2>
      {secondsLeft !== null && (
        <p style={{ textAlign: 'center', color: secondsLeft < 120 ? '#dc2626' : '#6b7280', fontSize: 14, marginBottom: 20 }}>
          {t('payment.slotHeldFor')} {fmtCountdown(secondsLeft)}
        </p>
      )}

      <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ color: '#6b7280' }}>{t('payment.consultationFee')}</span>
          <strong>{formatCurrency(amount)}</strong>
        </div>

        {walletBalance > 0 && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={useWallet}
              onChange={(e) => setUseWallet(e.target.checked)}
              disabled={processing}
            />
            <span style={{ fontSize: 14 }}>
              {t('payment.useWallet')} ({t('payment.walletBalance')}: <strong>{formatCurrency(walletBalance)}</strong>)
            </span>
          </label>
        )}

        {walletApplied > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, color: '#059669' }}>
            <span>{t('payment.walletApplied')}</span>
            <strong>− {formatCurrency(walletApplied)}</strong>
          </div>
        )}

        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 18 }}>
          <strong>{t('payment.payableNow')}</strong>
          <strong>{formatCurrency(payablePreview)}</strong>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 14 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12 }}>
        <button className="btn btn-outline" style={{ flex: 1 }} onClick={onCancel} disabled={processing}>
          {t('payment.payLater')}
        </button>
        <button className="btn btn-primary" style={{ flex: 2 }} onClick={handlePay} disabled={processing || expired}>
          {processing ? t('common.loading') : `${t('payment.payButton')} ${formatCurrency(payablePreview)}`}
        </button>
      </div>

      <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 16 }}>
        {t('payment.refundPolicyNotice')}
      </p>

      {/* Demo gateway simulated checkout */}
      {showDemoDialog && breakdown && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 28, maxWidth: 380, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🧪</div>
            <h3 style={{ marginBottom: 6 }}>{t('payment.demoGatewayTitle')}</h3>
            <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 18 }}>{t('payment.demoGatewayMessage')}</p>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>{formatCurrency(breakdown.payableNow)}</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => handleDemoResult(false)}>
                {t('payment.demoFail')}
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => handleDemoResult(true)}>
                {t('payment.demoPay')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useTranslation } from 'react-i18next'
import { useSettings } from '../../context/SettingsContext'

export interface RefundPreviewData {
  hasPayment: boolean
  amountPaid: number
  processingCharge: number
  refundAmount: number
  bonusAmount?: number
  policy?: string
}

interface Props {
  loading: boolean
  /** Null with loading=false means the server could not tell us; we say so in words rather than guess an amount. */
  preview: RefundPreviewData | null
  /** Whose money comes back: the person cancelling ("You get back") or the patient when a vet cancels. */
  who?: 'self' | 'patient'
}

/**
 * ONE "what you get back" block for every cancel dialog (consultation and grooming): amount paid, any processing charge,
 * what comes back and which rule applied. The numbers always come from the server's refund engine, never an estimate on the phone.
 */
export function RefundPreview({ loading, preview, who = 'self' }: Props) {
  const { t } = useTranslation()
  const { formatCurrency } = useSettings()
  if (loading) return <p className="slot-hint" role="status">{t('refundPreview.loading')}</p>
  if (!preview) return <p className="slot-hint">{t('refundPreview.loadFailed')}</p>
  if (!preview.hasPayment) return <p className="slot-hint">{t('refundPreview.noPayment')}</p>
  return (
    <div className="module-card refund-preview">
      <div className="refund-preview-row">
        <span>{t('refundPreview.amountPaid')}</span><strong>{formatCurrency(Number(preview.amountPaid))}</strong>
      </div>
      {Number(preview.processingCharge) > 0 && (
        <div className="refund-preview-row">
          <span>{t('refundPreview.processingCharge')}</span><span>− {formatCurrency(Number(preview.processingCharge))}</span>
        </div>
      )}
      <div className="refund-preview-row is-total">
        <strong>{who === 'patient' ? t('refundPreview.patientGetsBack') : t('refundPreview.youGetBack')}</strong>
        <strong>{formatCurrency(Number(preview.refundAmount))}</strong>
      </div>
      {Number(preview.bonusAmount) > 0 && who === 'self' && (
        <div className="refund-preview-row"><span>{t('refundPreview.bonus')}</span><span>+ {formatCurrency(Number(preview.bonusAmount))}</span></div>
      )}
      {preview.policy && (
        <div className="slot-hint">{t(`refundPreview.policy.${preview.policy}`, { defaultValue: t('refundPreview.policy.unknown') })}</div>
      )}
    </div>
  )
}

/** The consultation preview names the amount `paymentAmount`; grooming names it `amountPaid`. One shape for the block. */
export function toRefundPreview(raw: any): RefundPreviewData | null {
  if (!raw || typeof raw !== 'object') return null
  return {
    hasPayment: !!raw.hasPayment,
    amountPaid: Number(raw.amountPaid ?? raw.paymentAmount ?? 0),
    processingCharge: Number(raw.processingCharge || 0),
    refundAmount: Number(raw.refundAmount || 0),
    bonusAmount: Number(raw.bonusAmount || 0),
    policy: typeof raw.policy === 'string' ? raw.policy : undefined,
  }
}

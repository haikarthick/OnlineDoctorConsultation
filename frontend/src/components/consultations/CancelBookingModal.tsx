import type { TFunction } from 'i18next'

interface RefundEstimate { percent: number; reason: string }

interface Props {
  t: TFunction
  reason: string
  cancelError: string
  isVet: boolean
  isPetOwner: boolean
  refundEstimate: RefundEstimate | null
  onClose: () => void
  onReasonChange: (reason: string) => void
  onConfirm: () => void
}

const CancelBookingModal = ({
  t, reason, cancelError, isVet, isPetOwner, refundEstimate, onClose, onReasonChange, onConfirm,
}: Props) => {
  const reasonPresets = isVet
    ? (t('consultations.cancelModal.reasonPresetsVet', { returnObjects: true }) as string[])
    : (t('consultations.cancelModal.reasonPresetsPatient', { returnObjects: true }) as string[])

  return (
    <div className="si-10f9485f" onClick={onClose}>
      <div className="si-b6bf627f" onClick={e => e.stopPropagation()}>
        <div className="si-101fd1d0">
          <h2 className="si-670df8d2">{t('consultations.cancelModal.title')}</h2>
          <button type="button" onClick={onClose} className="si-60f45c55">✕</button>
        </div>
        <div className="si-941430f8">
          {t('consultations.cancelModal.warning')}
        </div>

        {/* Refund Policy Preview (for patients) */}
        {isPetOwner && refundEstimate && (
          <div className={`consult-refund-banner${refundEstimate.percent === 100 ? ' refund-full' : refundEstimate.percent > 0 ? ' refund-partial' : ' refund-none'}`}>
            <strong>{refundEstimate.percent === 100 ? '✅' : refundEstimate.percent > 0 ? '⚠️' : '❌'} {t('consultations.cancelModal.refundPolicy')}:</strong>
            <div className="si-f48bb60f">{refundEstimate.reason}</div>
          </div>
        )}

        {/* Quick reason presets */}
        <div className="si-bab8e8bc">
          <label className="si-e68e52cd">{t('consultations.cancelModal.quickReasons')}</label>
          <div className="si-50c82988">
            {reasonPresets.map(r => (
              <button key={r}
                type="button"
                className={`btn btn-sm ${reason === r ? 'btn-primary' : 'btn-outline'} si-756a9f21`}
                onClick={() => onReasonChange(r)}
              >{r}</button>
            ))}
          </div>
        </div>

        <div className="si-7e63ec4f">
          <label className="si-e68e52cd">{t('consultations.cancelModal.reasonLabel')}</label>
          <textarea
            placeholder={t('consultations.cancelModal.reasonPlaceholder')}
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            className="si-6c17b3f3"
          />
        </div>
        {cancelError && (
          <div className="si-919b5437">
            ⚠ {cancelError}
          </div>
        )}
        <div className="si-7be0b9bd">
          <button
            type="button"
            onClick={onClose}
            className="si-60c838b7"
          >{t('consultations.cancelModal.keepBooking')}</button>
          <button
            onClick={onConfirm}
            disabled={!reason.trim()}
            className={`consult-cancel-confirm-btn${reason.trim() ? '' : ' is-disabled'}`}
          >{t('consultations.cancelModal.confirmCancel')}</button>
        </div>
      </div>
    </div>
  )
}

export default CancelBookingModal

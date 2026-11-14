import type { TFunction } from 'i18next'
import { BookingRow } from './consultationsShared'

interface Props {
  t: TFunction
  noShowModal: BookingRow
  noShowError: string
  noShowSaving: boolean
  formatDate: (d: Date) => string
  formatSlotTime: (s: string) => string
  onClose: () => void
  onConfirm: () => void
}

const NoShowModal = ({ t, noShowModal, noShowError, noShowSaving, formatDate, formatSlotTime, onClose, onConfirm }: Props) => (
  <div className="si-10f9485f" onClick={onClose}>
    <div className="si-b6bf627f" onClick={e => e.stopPropagation()}>
      <div className="si-101fd1d0">
        <h2 className="si-670df8d2">{t('consultations.noShow.title')}</h2>
        <button type="button" onClick={onClose} className="si-60f45c55">✕</button>
      </div>
      <div className="si-941430f8">
        {t('consultations.noShow.warning')}
      </div>
      <p className="slot-hint">
        {t('consultations.noShow.forBooking', {
          animal: noShowModal.animalName || '-',
          date: formatDate(new Date(noShowModal.scheduledDate)),
          time: formatSlotTime(noShowModal.timeSlotStart),
        })}
      </p>
      {noShowError && (
        <div className="si-919b5437">
          ⚠ {noShowError}
        </div>
      )}
      <div className="si-7be0b9bd">
        <button
          type="button"
          onClick={onClose}
          className="si-60c838b7"
        >{t('common.cancel')}</button>
        <button
          type="button"
          className="btn btn-danger"
          disabled={noShowSaving}
          onClick={onConfirm}
        >{noShowSaving ? '⏳' : t('consultations.noShow.confirm')}</button>
      </div>
    </div>
  </div>
)

export default NoShowModal

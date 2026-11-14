import type { TFunction } from 'i18next'
import { BookingRow, TimeSlot, filterFutureSlots, isExpiredPending } from './consultationsShared'

interface Props {
  t: TFunction
  rescheduleBooking: BookingRow
  rescheduleDate: string
  rescheduleSlots: TimeSlot[]
  rescheduleSelectedSlot: TimeSlot | null
  rescheduleDateMsg: string
  rescheduleSlotsLoading: boolean
  rescheduleSubmitting: boolean
  rescheduleError: string
  rescheduleVetId: string
  vetList: { id: string; name: string; specialization?: string }[]
  vetListLoading: boolean
  isPetOwner: boolean
  maxReschedules: number
  patientNoShowRescheduleLimit: number
  fmt: (d: string) => string
  formatSlotTime: (s: string) => string
  onClose: () => void
  onVetChange: (vetId: string) => void
  onDateChange: (date: string) => void
  onSelectSlot: (slot: TimeSlot) => void
  onSubmit: () => void
}

const RescheduleModal = ({
  t, rescheduleBooking, rescheduleDate, rescheduleSlots, rescheduleSelectedSlot, rescheduleDateMsg,
  rescheduleSlotsLoading, rescheduleSubmitting, rescheduleError, rescheduleVetId, vetList, vetListLoading,
  isPetOwner, maxReschedules, patientNoShowRescheduleLimit, fmt, formatSlotTime,
  onClose, onVetChange, onDateChange, onSelectSlot, onSubmit,
}: Props) => (
  <div className="si-10f9485f" onClick={onClose}>
    <div className="si-f9e05bb3" onClick={e => e.stopPropagation()}>
      <div className="si-fe2d5bfb">
        <h2 className="si-44087c4b">{t('consultations.reschedule.title')}</h2>
        <button type="button" onClick={onClose} className="si-6a334ebc">✕</button>
      </div>

      {/* Current booking info */}
      <div className="si-9c52ec04">
        <p className="si-75f3eb54">{t('consultations.reschedule.originalLabel')}</p>
        <p className="si-63d91992">
          {rescheduleBooking.vetName || t('common.doctor')} - {fmt(rescheduleBooking.scheduledDate)} {t('common.at')} {formatSlotTime(rescheduleBooking.timeSlotStart)} - {formatSlotTime(rescheduleBooking.timeSlotEnd)}
        </p>
      </div>

      {/* Reschedule count info */}
      {rescheduleBooking.status === 'pending' && !isExpiredPending(rescheduleBooking) && maxReschedules > 0 && (
        <div className="si-b8a27886">
          {t('consultations.reschedule.rescheduleCount', { current: (rescheduleBooking.rescheduleCount || 0) + 1, max: maxReschedules })}
        </div>
      )}

      {/* Missed booking context */}
      {rescheduleBooking.status === 'missed' && (
        <div className={`consult-missed-context${!rescheduleBooking.missedBy || rescheduleBooking.missedBy === 'doctor' ? ' ctx-doctor' : ' ctx-patient'}`}>
          {!rescheduleBooking.missedBy || rescheduleBooking.missedBy === 'doctor'
            ? (rescheduleBooking.confirmedAt
              ? t('consultations.reschedule.doctorConfirmedNoShow')
              : t('consultations.reschedule.doctorNoConfirm'))
            : (() => {
                const used = rescheduleBooking.rescheduleCount || 0
                const limit = patientNoShowRescheduleLimit
                return limit === 0
                  ? t('consultations.reschedule.patientNoShowNoLimit')
                  : t('consultations.reschedule.patientNoShowLimit', { current: used + 1, max: limit })
              })()
          }
        </div>
      )}

      {/* Expired pending notice */}
      {isExpiredPending(rescheduleBooking) && (
        <div className="si-a2619258">
          {t('consultations.reschedule.expiredPendingNotice')}
        </div>
      )}

      {/* Doctor selection */}
      <div className="si-7e63ec4f">
        <label className="si-e68e52cd">
          {isExpiredPending(rescheduleBooking) ? t('consultations.reschedule.selectDoctor') : t('consultations.reschedule.selectDoctorOptional')}
        </label>
        {vetListLoading ? (
          <div className="si-3f8e0459">{t('consultations.reschedule.loadingDoctors')}</div>
        ) : (
          <select
            value={rescheduleVetId}
            onChange={(e) => onVetChange(e.target.value)}
            className="si-92bee81f"
          >
            <option value="">{t('consultations.reschedule.keepCurrentDoctor')}</option>
            {vetList.map(v => (
              <option key={v.id} value={v.id}>
                {v.name}{v.specialization ? ` - ${v.specialization}` : ''}{v.id === rescheduleBooking.veterinarianId ? ` ${t('consultations.reschedule.currentDoctor')}` : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* New date picker */}
      <div className="si-7e63ec4f">
        <label className="si-e68e52cd">{t('consultations.reschedule.dateLabel')}</label>
        <input
          type="date"
          className="si-d0e0df59"
          value={rescheduleDate}
          min={(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })()}
          onChange={(e) => onDateChange(e.target.value)}
        />
      </div>

      {/* Available slots */}
      {rescheduleDate && (() => {
        const futureSlots = filterFutureSlots(rescheduleSlots, rescheduleDate)
        return (
        <div className="si-478be2e9">
          <label className="si-efbbcec8">{t('consultations.reschedule.slotsTitle')}</label>
          {rescheduleSlotsLoading ? (
            <div className="si-5686f5eb">
              <div className="loading-spinner si-8d6ac58b" />
            </div>
          ) : rescheduleDateMsg ? (
            <div className="si-88c863bb">
              {rescheduleDateMsg} - {t('consultations.reschedule.selectAnotherDate')}
            </div>
          ) : futureSlots.length === 0 ? (
            <p className="si-ed4d0fb3">
              {t('consultations.reschedule.noSlots')}
            </p>
          ) : (
            <div className="si-d925f834">
              {futureSlots.map((slot, idx) => (
                <button
                  key={idx}
                  onClick={() => onSelectSlot(slot)}
                  className={`consult-slot-btn${rescheduleSelectedSlot?.startTime === slot.startTime ? ' is-selected' : ''}`}
                >
                  {slot.startTime ? formatSlotTime(slot.startTime) : ''} - {slot.endTime ? formatSlotTime(slot.endTime) : ''}
                </button>
              ))}
            </div>
          )}
        </div>
        )
      })()}

      {/* Doctor approval note for pet owners */}
      {isPetOwner && rescheduleSelectedSlot && (
        <div className="si-c72eca10">
          {t('consultations.reschedule.approvalNote')}
        </div>
      )}

      {/* Error banner */}
      {rescheduleError && (
        <div className="si-919b5437">
          ⚠ {rescheduleError}
        </div>
      )}

      {/* Confirm reschedule */}
      <div className="si-7be0b9bd">
        <button type="button" onClick={onClose} className="si-60c838b7">{t('common.cancel')}</button>
        <button
          onClick={onSubmit}
          disabled={!rescheduleDate || !rescheduleSelectedSlot || rescheduleSubmitting}
          className={`consult-confirm-btn${(!rescheduleDate || !rescheduleSelectedSlot) ? ' is-disabled' : ''}`}
        >
          {rescheduleSubmitting ? t('consultations.reschedule.confirming') : t('consultations.reschedule.confirmBtn')}
        </button>
      </div>
    </div>
  </div>
)

export default RescheduleModal

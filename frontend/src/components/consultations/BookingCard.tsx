import type { TFunction } from 'i18next'
import { BookingRow, StatusBadge, MissedBadge, isExpiredPending, hasSlotEnded, canReschedule } from './consultationsShared'

interface Props {
  b: BookingRow
  t: TFunction
  isVet: boolean
  isPetOwner: boolean
  isAdmin: boolean
  fmt: (d: string) => string
  formatSlotTime: (s: string) => string
  isJoinable: (date: string, start: string, end: string) => boolean
  joinWindowMinutes: number
  maxReschedules: number
  patientNoShowRescheduleLimit: number
  actionLoading: string | null
  onConfirm: (id: string) => void
  onStartConsultation: (b: BookingRow) => void
  onOpenReschedule: (b: BookingRow) => void
  onCancel: (id: string) => void
  onMarkNoShow: (b: BookingRow) => void
  onOpenActionLog: (id: string) => void
}

const BookingCard = ({
  b, t, isVet, isPetOwner, isAdmin, fmt, formatSlotTime, isJoinable, joinWindowMinutes,
  maxReschedules, patientNoShowRescheduleLimit, actionLoading,
  onConfirm, onStartConsultation, onOpenReschedule, onCancel, onMarkNoShow, onOpenActionLog,
}: Props) => (
  <div className="appt-card">
    {/* Card Header */}
    <div className="appt-card-header">
      <div className="appt-card-who">
        {isVet && <strong>{b.petOwnerName || t('common.patient')}</strong>}
        {isPetOwner && <strong>{b.vetName || t('common.doctor')}</strong>}
        {isAdmin && <span>{b.petOwnerName || '-'} / {b.vetName || '-'}</span>}
      </div>
      <div className="si-0fb5fcc7">
        <span className={`consult-priority-badge${b.priority === 'high' || b.priority === 'urgent' || b.priority === 'emergency' ? ' is-urgent' : ''}`}>
          {b.priority ? t(`consultations.priorities.${b.priority}`, b.priority) : t('common.normal')}
        </span>
        <StatusBadge status={b.status} t={t} />
      </div>
    </div>

    {/* Card Body */}
    <div className="appt-card-body">
      {/* Animal / Farm info */}
      <div className="appt-card-animal">
        {b.enterpriseName ? (
          <>
            <span className="si-e5391e22">🏢 {b.enterpriseName}</span>
            {b.groupName && <span className="si-23033f05"> · 📋 {b.groupName}</span>}
            {b.animalName ? <span> · 🐾 {b.animalName}{b.animalBreed ? ` (${b.animalBreed})` : ''}</span>
              : <span className="si-bce9b403"> · {t('consultations.herdLevel')}</span>}
          </>
        ) : b.animalName ? (
          <span>🐾 {b.animalName}{b.animalSpecies ? ` - ${b.animalSpecies}` : ''}{b.animalBreed ? ` / ${b.animalBreed}` : ''}</span>
        ) : (
          <span className="si-e70e9abd">-</span>
        )}
      </div>

      {/* Date, Time, Type row */}
      <div className="appt-card-meta">
        <span>📅 {fmt(b.scheduledDate)}</span>
        <span>⏰ {formatSlotTime(b.timeSlotStart)} - {formatSlotTime(b.timeSlotEnd)}</span>
        <span>{b.bookingType === 'video_call' ? t('consultations.types.video') : b.bookingType === 'phone' ? t('consultations.types.phone') : b.bookingType === 'in_person' ? t('consultations.types.inPerson') : t('consultations.types.chat')}</span>
      </div>

      {/* Reason */}
      {(b.reasonForVisit || b.reason) && (
        <div className="appt-card-reason">{b.reasonForVisit || b.reason}</div>
      )}

      {/* ─── Status-specific info banners ─── */}

      {/* PENDING - awaiting vet confirmation */}
      {b.status === 'pending' && !isExpiredPending(b) && (
        <div className="si-f3ba3645">
          {isPetOwner && t('consultations.pendingMessages.petOwner')}
          {isVet && t('consultations.pendingMessages.vet')}
          {isAdmin && t('consultations.pendingMessages.admin')}
        </div>
      )}

      {/* PENDING but expired (safety fallback - backend normally auto-expires these) */}
      {isExpiredPending(b) && (
        <div className="si-d3e4ea8a">
          {isPetOwner ? t('consultations.expiredPendingMessages.petOwner') : t('consultations.expiredPendingMessages.general')}
        </div>
      )}

      {/* CONFIRMED - appointment is set */}
      {b.status === 'confirmed' && (
        <div className="si-ad9785fc">
          {isPetOwner && t('consultations.confirmedMessages.petOwner')}
          {isVet && t('consultations.confirmedMessages.vet')}
          {isAdmin && t('consultations.confirmedMessages.admin')}
        </div>
      )}

      {/* MISSED - distinguish pending→missed vs confirmed→missed */}
      {b.status === 'missed' && (
        <div className="si-cbfb1eb8">
          <MissedBadge missedBy={b.missedBy} t={t} />

          {/* Doctor missed - was never confirmed (pending → missed) */}
          {b.missedBy === 'doctor' && !b.confirmedAt && (
            <>
              {isPetOwner && (
                <div className="si-3e55ea7f">
                  {t('consultations.doctorMissedPending.petOwner')}
                </div>
              )}
              {isVet && (
                <div className="si-3e55ea7f">
                  {t('consultations.doctorMissedPending.vet')}
                </div>
              )}
              {isAdmin && (
                <div className="si-3e55ea7f">
                  {t('consultations.doctorMissedPending.admin')}
                </div>
              )}
            </>
          )}

          {/* Doctor missed - was confirmed but didn't show up (confirmed → missed) */}
          {b.missedBy === 'doctor' && b.confirmedAt && (
            <>
              {isPetOwner && (
                <div className="si-3e55ea7f">
                  {t('consultations.doctorMissedConfirmed.petOwner')}
                </div>
              )}
              {isVet && (
                <div className="si-3e55ea7f">
                  {t('consultations.doctorMissedConfirmed.vet')}
                </div>
              )}
              {isAdmin && (
                <div className="si-3e55ea7f">
                  {t('consultations.doctorMissedConfirmed.admin')}
                </div>
              )}
            </>
          )}

          {/* Patient missed */}
          {isPetOwner && (b.missedBy === 'patient' || b.missedBy === 'both') && (() => {
            const used = b.rescheduleCount || 0
            const limit = patientNoShowRescheduleLimit
            const remaining = limit === 0 ? null : Math.max(0, limit - used)
            return (
              <div className="si-f9e66937">
                {b.missedBy === 'both' ? t('consultations.missedMessages.bothMissed') : t('consultations.missedMessages.youMissed')}{' '}
                {limit === 0
                  ? t('consultations.missedMessages.rescheduleAnytime')
                  : remaining !== null && remaining > 0
                    ? t('consultations.missedMessages.rescheduleRemaining', { count: remaining })
                    : t('consultations.missedMessages.rescheduleUsed')}
              </div>
            )
          })()}
          {isVet && b.missedBy === 'patient' && (
            <div className="si-f9e66937">
              {t('consultations.missedMessages.patientNoJoin')}
            </div>
          )}
          {isVet && b.missedBy === 'both' && (
            <div className="si-f1d7a58f">
              {t('consultations.missedMessages.neitherJoined')}
            </div>
          )}
          {isAdmin && (b.missedBy === 'patient' || b.missedBy === 'both') && (
            <div className="si-f9e66937">
              {b.missedBy === 'patient' ? t('consultations.adminMissed.patientNoShow') : t('consultations.adminMissed.bothMissed')}
            </div>
          )}
        </div>
      )}
    </div>

    {/* Card Actions */}
    <div className="appt-card-actions">
      {isVet && b.status === 'pending' && !isExpiredPending(b) && (
        <button className="btn-small si-0e51a69a" disabled={actionLoading === b.id} onClick={() => onConfirm(b.id)}>{actionLoading === b.id ? '⏳' : t('consultations.actions.confirm')}</button>
      )}
      {(isVet || isAdmin) && b.status === 'confirmed' && b.bookingType === 'video_call' && (
        isJoinable(b.scheduledDate, b.timeSlotStart, b.timeSlotEnd)
          ? <button className="btn-small si-af66012c" onClick={() => onStartConsultation(b)}>{t('consultations.actions.start')}</button>
          : <button className="btn-small si-33f445bc" disabled title={t('consultations.joinWindowTooltip', { minutes: joinWindowMinutes })}>{t('consultations.actions.notYet')}</button>
      )}
      {isPetOwner && b.status === 'confirmed' && b.bookingType === 'video_call' && (
        isJoinable(b.scheduledDate, b.timeSlotStart, b.timeSlotEnd)
          ? <button className="btn-small si-af66012c" onClick={() => onStartConsultation(b)}>{t('consultations.actions.join')}</button>
          : <button className="btn-small si-33f445bc" disabled title={t('consultations.joinWindowTooltip', { minutes: joinWindowMinutes })}>{t('consultations.actions.notYet')}</button>
      )}
      {/* Reschedule button - conditional on who missed and reschedule limits */}
      {(b.status === 'confirmed' || (b.status === 'pending' && canReschedule(b, maxReschedules, patientNoShowRescheduleLimit)) || (b.status === 'missed' && canReschedule(b, maxReschedules, patientNoShowRescheduleLimit))) && (
        <button className={`btn-small consult-reschedule-btn${isExpiredPending(b) ? ' is-expired' : ''}`} onClick={() => onOpenReschedule(b)}>
          {isExpiredPending(b) ? `⚠️ ${t('consultations.actions.reschedule')}` : `🔄 ${t('consultations.actions.reschedule')}`}
        </button>
      )}
      {(b.status === 'pending' || b.status === 'confirmed') && (
        <button className="btn-small si-b2f36fe7" onClick={() => onCancel(b.id)}>{t('consultations.actions.cancelBooking')}</button>
      )}
      {isAdmin && b.status === 'pending' && !isExpiredPending(b) && (
        <button className="btn-small si-0e51a69a" disabled={actionLoading === b.id} onClick={() => onConfirm(b.id)}>{actionLoading === b.id ? '⏳' : t('consultations.actions.confirm')}</button>
      )}
      {/* Patient no-show. Vet/admin only, and only once the slot has
          ended - the backend allows it earlier, so this is the guard
          that stops a slot being written off while the patient could
          still arrive. */}
      {(isVet || isAdmin) && (b.status === 'confirmed' || b.status === 'pending') && hasSlotEnded(b) && (
        <button
          className="btn-small btn-warning"
          onClick={() => onMarkNoShow(b)}
          title={t('consultations.noShow.tooltip')}
        >
          🙋 {t('consultations.actions.markNoShow')}
        </button>
      )}
      <button className="btn-small si-1827a52c" onClick={() => onOpenActionLog(b.id)} title={t('consultations.viewActionHistory')}>{t('consultations.actions.log')}</button>
    </div>
  </div>
)

export default BookingCard

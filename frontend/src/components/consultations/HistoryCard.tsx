import type { TFunction } from 'i18next'
import { BookingRow, StatusBadge } from './consultationsShared'

interface Props {
  b: BookingRow
  t: TFunction
  isVet: boolean
  isPetOwner: boolean
  isAdmin: boolean
  fmt: (d: string) => string
  formatSlotTime: (s: string) => string
  formatDate: (d: string) => string
  diagnosis?: string
  networkInfo?: { networkId: string; networkName: string }
  currentUserId?: string
  onNavigateToConsultation: (consultationId: string) => void
  onNavigateToReview: (consultationId: string, veterinarianId?: string) => void
  onOpenActionLog: (id: string) => void
}

const HistoryCard = ({
  b, t, isVet, isPetOwner, isAdmin, fmt, formatSlotTime, formatDate,
  diagnosis, networkInfo, currentUserId,
  onNavigateToConsultation, onNavigateToReview, onOpenActionLog,
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
        {networkInfo && networkInfo.networkName && (
          <span className="badge si-3969f1f4">
            🏥 {networkInfo.networkName}
          </span>
        )}
        <StatusBadge status={b.status} t={t} />
      </div>
    </div>

    {/* Card Body */}
    <div className="appt-card-body">
      <div className="appt-card-animal">
        {b.enterpriseName ? (
          <>
            <span className="si-e5391e22">🏢 {b.enterpriseName}</span>
            {b.groupName && <span className="si-23033f05"> · 📋 {b.groupName}</span>}
            {b.animalName && <span> · 🐾 {b.animalName}{b.animalBreed ? ` (${b.animalBreed})` : ''}</span>}
          </>
        ) : b.animalName ? (
          <span>🐾 {b.animalName}{b.animalSpecies ? ` - ${b.animalSpecies}` : ''}</span>
        ) : (
          <span className="si-e70e9abd">-</span>
        )}
      </div>

      <div className="appt-card-meta">
        <span>📅 {fmt(b.scheduledDate)}</span>
        <span>⏰ {formatSlotTime(b.timeSlotStart)} - {formatSlotTime(b.timeSlotEnd)}</span>
      </div>

      {(b.reasonForVisit || b.reason) && (
        <div className="appt-card-reason">{b.reasonForVisit || b.reason}</div>
      )}

      {diagnosis && (
        <div className="si-8c7a9026">🩺 {diagnosis}</div>
      )}

      {/* Cancelled by indicator */}
      {b.status === 'cancelled' && b.cancelledBy && (
        <div className={`consult-cancelled-indicator${b.cancelledBy === currentUserId ? ' is-you' : ''}`}>
          {b.cancelledBy === currentUserId ? t('consultations.cancelledByYou') : t('consultations.cancelledByOther')}
          {b.cancelledAt && <span className="si-a69da2c2">
            {formatDate(b.cancelledAt)}
          </span>}
        </div>
      )}

      {/* Rescheduled indicator - this is the OLD booking that was superseded */}
      {b.status === 'rescheduled' && (
        <div className="si-01262b7b">
          {t('consultations.rescheduledNotice')}
        </div>
      )}
    </div>

    {/* Card Actions */}
    <div className="appt-card-actions">
      {b.status === 'completed' && b.consultationId && (
        <button className="btn-small si-26ca7215"
          onClick={() => onNavigateToConsultation(b.consultationId!)}>{t('consultations.actions.view')}</button>
      )}
      {b.status === 'completed' && isPetOwner && b.consultationId && (
        <button className="btn-small" onClick={() => onNavigateToReview(b.consultationId!, b.veterinarianId)}>{t('consultations.actions.review')}</button>
      )}
      {b.status === 'cancelled' && (
        <button className="btn-small si-1827a52c" onClick={() => onOpenActionLog(b.id)} title={t('consultations.viewCancellationDetails')}>{t('consultations.actions.details')}</button>
      )}
    </div>
  </div>
)

export default HistoryCard

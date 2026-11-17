import type { TFunction } from 'i18next'

export interface BookingRow {
  id: string; petOwnerName?: string; petOwnerId?: string; vetName?: string; scheduledDate: string;
  timeSlotStart: string; timeSlotEnd: string; bookingType?: string;
  reasonForVisit?: string; reason?: string; symptoms?: string;
  priority?: string; status: string; veterinarianId?: string;
  consultationId?: string | null; animalId?: string;
  // Enterprise / group / animal context
  enterpriseId?: string; groupId?: string;
  animalName?: string; animalSpecies?: string; animalBreed?: string; animalUniqueId?: string;
  enterpriseName?: string; enterpriseType?: string;
  groupName?: string; groupType?: string;
  rescheduleCount?: number;
  missedBy?: 'doctor' | 'patient' | 'both';
  cancelledBy?: string;
  cancelledAt?: string;
  confirmedAt?: string;
}
export interface ConsultRow {
  id: string; animalType?: string; symptomDescription?: string;
  status: string; diagnosis?: string; scheduledAt?: string;
  createdAt?: string; veterinarianId?: string;
  networkId?: string; networkName?: string;
}
export interface TimeSlot { startTime: string; endTime: string; isAvailable: boolean }

/** Filter out past time slots for today using browser local time + 15min buffer */
export const filterFutureSlots = (slots: TimeSlot[], forDate: string) => {
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return slots.filter(s => {
    if (!s.isAvailable) return false
    if (forDate !== todayStr) return true

    const [h, m] = (s.startTime || '00:00').split(':').map(Number)
    return h * 60 + m > now.getHours() * 60 + now.getMinutes() + 15
  })
}

/** Check if a booking's scheduled time has already passed (browser local time) */
export const isExpiredPending = (b: BookingRow): boolean => {
  if (b.status !== 'pending') return false
  const d = new Date(b.scheduledDate + 'T' + b.timeSlotEnd + ':00')
  return d < new Date()
}

/**
 * Whether the booked slot has finished (browser local time).
 * A no-show can only be judged after the appointment window has closed - the
 * backend accepts confirmed/pending bookings at any time, so the UI is what
 * stops a slot being written off while the patient could still turn up.
 */
export const hasSlotEnded = (b: BookingRow): boolean => {
  const end = new Date(b.scheduledDate + 'T' + b.timeSlotEnd + ':00')
  return end < new Date()
}

/** Check if a user can reschedule (within limit) */
export const canReschedule = (b: BookingRow, maxReschedules: number, patientNoShowLimit: number): boolean => {
  // Expired pending → always allowed (not user's fault)
  if (isExpiredPending(b)) return true
  // For pending pre-acceptance reschedules, check limit
  if (b.status === 'pending') return maxReschedules === 0 || (b.rescheduleCount || 0) < maxReschedules
  // Missed booking logic
  if (b.status === 'missed') {
    const missedBy = b.missedBy
    // Doctor no-show → unlimited reschedules for patient
    if (!missedBy || missedBy === 'doctor') return true
    // Patient/both no-show → check patientNoShowLimit
    return patientNoShowLimit === 0 || (b.rescheduleCount || 0) < patientNoShowLimit
  }
  // confirmed → always allowed
  return true
}

export const StatusBadge = ({ status, t }: { status: string; t: TFunction }) => (
  <span className={`consult-status-badge status-${status}`}>
    {t(`consultations.statuses.${status}`, status.replace(/_/g, ' '))}
  </span>
)

export const MissedBadge = ({ missedBy, t }: { missedBy?: 'doctor' | 'patient' | 'both'; t: TFunction }) => {
  if (!missedBy) return null
  const config = {
    doctor: { icon: '🩺', label: t('consultations.missedLabels.doctorNoShow') },
    patient: { icon: '🙋', label: t('consultations.missedLabels.patientNoShow') },
    both: { icon: '❌', label: t('consultations.missedLabels.bothNoShow') },
  }
  const c = config[missedBy]
  return (
    <span className={`consult-missed-badge missed-${missedBy}`}>
      {c.icon} {c.label}
    </span>
  )
}

import { TFunction } from 'i18next'
import { VetWithAvailability, TimeOfDay, TIME_RANGES, filterPastSlots, formatDateLabel } from './findDoctorShared'

function renderStars(rating: number) {
  return (
    <span className="si-317a3d7a">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={`fd-star ${i < Math.round(rating) ? 'is-filled' : ''}`}>★</span>
      ))}
    </span>
  )
}

interface SlotChipsProps {
  vet: VetWithAvailability
  selectedDate: string
  timeOfDay: TimeOfDay
  formatSlotTime: (time: string) => string
  onSlotBook: (vet: VetWithAvailability, slotTime: string) => void
}

function SlotChips({ vet, selectedDate, timeOfDay, formatSlotTime, onSlotBook }: SlotChipsProps) {
  const allSlots = vet.availableSlots || []
  if (!selectedDate || allSlots.length === 0) return null
  const slots = filterPastSlots(allSlots, selectedDate)
  if (slots.length === 0) return null
  const shown     = slots.slice(0, 8)
  const remainder = slots.length - 8

  return (
    <div className="si-2bc3baf0">
      <div className="si-f7c49cb1">
        <span className="si-d14faa43">
          ✅ {slots.length} slot{slots.length !== 1 ? 's' : ''} · {formatDateLabel(selectedDate)}
          {timeOfDay ? ` · ${TIME_RANGES[timeOfDay].desc}` : ''}
        </span>
      </div>
      <div className="si-a3a7e182">
        {shown.map(slot => (
          <button
            key={slot.startTime}
            onClick={e => { e.stopPropagation(); onSlotBook(vet, slot.startTime) }}
            title={`Book ${formatSlotTime(slot.startTime)} - pre-fills date & time`}
            className="si-98553089"
          >
            {formatSlotTime(slot.startTime)}
          </button>
        ))}
        {remainder > 0 && (
          <span className="si-e3289aa0">
            +{remainder} more
          </span>
        )}
      </div>
    </div>
  )
}

interface VetCardProps {
  vet: VetWithAvailability
  selectedDate: string
  timeOfDay: TimeOfDay
  formatCurrency: (amount: number) => string
  formatSlotTime: (time: string) => string
  t: TFunction
  onNavigate: (path: string) => void
  onSlotBook: (vet: VetWithAvailability, slotTime: string) => void
}

export default function VetCard({ vet, selectedDate, timeOfDay, formatCurrency, formatSlotTime, t, onNavigate, onSlotBook }: VetCardProps) {
  const experience = vet.yearsOfExperience || vet.experience || 0
  const hasSlots   = Boolean(selectedDate) && (vet.totalAvailableSlots ?? 0) > 0

  return (
    <div
      className={`fd-vet-card ${hasSlots ? 'has-slots' : ''}`}
      onClick={() => onNavigate(`/vet-profile/${vet.userId}`)}
    >
      {/* ── Badge row (top-right) ── */}
      <div className="si-5f623a02">
        {vet.isAvailable
          ? <span className="si-bc5175b0">● Available</span>
          : <span className="si-03c300cb">Unavailable</span>
        }
        {hasSlots && (
          <span className="si-be418e92">
            📅 {vet.totalAvailableSlots} open
          </span>
        )}
      </div>

      {/* ── Avatar + name ── */}
      <div className="si-5c24077d">
        <div className={`fd-vet-avatar ${hasSlots ? 'has-slots' : ''}`}>
          {vet.firstName?.charAt(0) || '🐾'}
        </div>
        <h3 className="si-4777b23e">
          Dr. {vet.firstName || ''} {vet.lastName || ''}
        </h3>
        <p className="si-21080d68">
          {(vet.specializations || []).slice(0, 2).join(' · ') || 'General Veterinarian'}
        </p>
      </div>

      {/* ── Ratings + stats ── */}
      <div className="si-b406d666">
        <div className="si-528a0cfa">
          {renderStars(Number(vet.rating) || 0)}
          <span className="si-2fed5332">{Number(vet.rating || 0).toFixed(1)}</span>
          <span className="si-3f4bbe41">({vet.totalReviews || 0})</span>
        </div>

        <div className="si-963f6cba">
          <div className="si-4b6b7fbc">
            <div className="si-91310d8f">{experience}</div>
            <div className="si-85dee051">Yrs Exp</div>
          </div>
          <div className="si-4b6b7fbc">
            <div className="si-609091ae">{vet.totalConsultations || 0}</div>
            <div className="si-85dee051">Consults</div>
          </div>
          <div className="si-4b6b7fbc">
            <div className="si-9c2e9d7b">{formatCurrency(vet.consultationFee || 0)}</div>
            <div className="si-85dee051">Per Session</div>
          </div>
        </div>

        {/* Tags */}
        <div className="si-620f955b">
          {(vet.languages || []).slice(0, 2).map(l => (
            <span key={l} className="si-d9973be4">
              🌐 {l}
            </span>
          ))}
          {vet.acceptsEmergency && (
            <span className="si-41dff0f1">
              🚨 Emergency
            </span>
          )}
          {vet.isVerified && (
            <span className="si-97e68fb4">
              ✓ Verified
            </span>
          )}
        </div>

        {vet.clinicName && (
          <div className="si-6a41eb8b">
            🏥 {vet.clinicName}
          </div>
        )}
      </div>

      {/* ── Slot chips (availability mode) ── */}
      <SlotChips vet={vet} selectedDate={selectedDate} timeOfDay={timeOfDay} formatSlotTime={formatSlotTime} onSlotBook={onSlotBook} />

      {/* ── Action buttons ── */}
      <div className="si-6e677b63"
        onClick={e => e.stopPropagation()}>
        <button className="btn btn-primary si-1e1fafbf"
          onClick={() => onNavigate(`/book-consultation?vetId=${vet.userId}${selectedDate ? `&date=${selectedDate}` : ''}`)}>
          📅 {t('findDoctor.bookConsultation')}
        </button>
        <button className="btn btn-outline si-1e1fafbf"
          onClick={() => onNavigate(`/vet-profile/${vet.userId}`)}>
          {t('findDoctor.viewProfile')}
        </button>
      </div>
    </div>
  )
}

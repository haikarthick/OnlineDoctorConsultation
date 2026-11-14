import React from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  show: boolean
  advanceBookingDays: number
  setAdvanceBookingDays: (v: number) => void
  cancellationWindowHours: number
  setCancellationWindowHours: (v: number) => void
  maxReschedules: number
  setMaxReschedules: (v: number) => void
  savingInline: string | null
  savedInline: string | null
  onSaveInline: (key: string, value: string) => void
  patientNoShowLimit: number
  setPatientNoShowLimit: (v: number) => void
  onPatientNoShowLimitChange: (limit: number) => void
  savingPatientLimit: boolean
  patientLimitSaved: boolean
}

const BookingCard: React.FC<Props> = ({
  show, advanceBookingDays, setAdvanceBookingDays, cancellationWindowHours, setCancellationWindowHours,
  maxReschedules, setMaxReschedules, savingInline, savedInline, onSaveInline,
  patientNoShowLimit, setPatientNoShowLimit, onPatientNoShowLimitChange, savingPatientLimit, patientLimitSaved,
}) => {
  const { t } = useTranslation()
  if (!show) return null
  return (
    <div id="settings-section-booking" className="card si-478be2e9">
      <div className="card-header"><h2 className="si-63c2680d">📅 {t('systemSettings.bookingSettings')}</h2></div>
      <div className="card-body">
        {/* Advance Booking Days */}
        <div className="si-ccc9b2e4">
          <div className="si-0c982175">
            <h3 className="si-3301c332">{t('systemSettings.advanceBooking')}</h3>
            <p className="si-faa1c026">{t('systemSettings.advanceBookingDesc')}</p>
          </div>
          <div className="si-ef8e09e5">
            {[7, 14, 30, 60, 90].map(d => (
              <button key={d} className={`btn btn-sm ${advanceBookingDays === d ? 'btn-primary' : 'btn-outline'}`}
                disabled={savingInline === 'booking.advanceBookingDays'}
                onClick={() => { setAdvanceBookingDays(d); onSaveInline('booking.advanceBookingDays', String(d)) }}>
                {d}d
              </button>
            ))}
            <input type="number" className="form-input ss-field ss-num-input"
              value={advanceBookingDays} min={1} max={365}
              disabled={savingInline === 'booking.advanceBookingDays'}
              onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 1 && v <= 365) setAdvanceBookingDays(v) }}
              onBlur={() => onSaveInline('booking.advanceBookingDays', String(advanceBookingDays))}
              onKeyDown={e => { if (e.key === 'Enter') onSaveInline('booking.advanceBookingDays', String(advanceBookingDays)) }} />
            {savingInline === 'booking.advanceBookingDays' && <span className="si-48a0b045">Saving...</span>}
            {savedInline === 'booking.advanceBookingDays' && <span className="si-ab4fa2e9">✅ Saved!</span>}
          </div>
        </div>

        {/* Cancellation Window Hours */}
        <div className="si-50d6616f">
          <div className="si-45f02350">
            <div className="si-0c982175">
              <h3 className="si-3301c332">{t('systemSettings.freeCancellationWindow')}</h3>
              <p className="si-faa1c026">{t('systemSettings.freeCancellationWindowDesc')}</p>
            </div>
            <div className="si-ef8e09e5">
              {[6, 12, 24, 48].map(h => (
                <button key={h} className={`btn btn-sm ${cancellationWindowHours === h ? 'btn-primary' : 'btn-outline'}`}
                  disabled={savingInline === 'booking.cancellationWindowHours'}
                  onClick={() => { setCancellationWindowHours(h); onSaveInline('booking.cancellationWindowHours', String(h)) }}>
                  {h}h
                </button>
              ))}
              {savingInline === 'booking.cancellationWindowHours' && <span className="si-48a0b045">Saving...</span>}
              {savedInline === 'booking.cancellationWindowHours' && <span className="si-ab4fa2e9">✅ Saved!</span>}
            </div>
          </div>
        </div>

        {/* Max Reschedules */}
        <div className="si-50d6616f">
          <div className="si-45f02350">
            <div className="si-0c982175">
              <h3 className="si-3301c332">{t('systemSettings.maxReschedules')}</h3>
              <p className="si-faa1c026">{t('systemSettings.maxReschedulesDesc')}</p>
            </div>
            <div className="si-ef8e09e5">
              {[0, 1, 2, 3, 5].map(n => (
                <button key={n} className={`btn btn-sm ${maxReschedules === n ? 'btn-primary' : 'btn-outline'}`}
                  disabled={savingInline === 'booking.maxReschedules'}
                  onClick={() => { setMaxReschedules(n); onSaveInline('booking.maxReschedules', String(n)) }}>
                  {n === 0 ? '∞' : n}
                </button>
              ))}
              {savingInline === 'booking.maxReschedules' && <span className="si-48a0b045">Saving...</span>}
              {savedInline === 'booking.maxReschedules' && <span className="si-ab4fa2e9">✅ Saved!</span>}
            </div>
          </div>
        </div>

        {/* No-Show Rules Divider */}
        <div className="si-8771e243">
          <h3 className="si-74ba25f7">{t('systemSettings.noShowRules')}</h3>
        </div>

        {/* Doctor No-Show */}
        <div className="si-50d6616f">
          <div className="si-45f02350">
            <div className="si-0c982175">
              <h3 className="si-3301c332">🩺 {t('systemSettings.doctorNoShow')}</h3>
              <p className="si-faa1c026">
                {t('systemSettings.doctorNoShowDesc')}
              </p>
            </div>
            <span className="si-5651fa81">♾ {t('systemSettings.unlimited')}</span>
          </div>
        </div>

        {/* Patient No-Show */}
        <div className="si-50d6616f">
          <div className="si-45f02350">
            <div className="si-0c982175">
              <h3 className="si-3301c332">🙋 {t('systemSettings.patientNoShowLimit')}</h3>
              <p className="si-faa1c026">
                {t('systemSettings.patientNoShowLimitDesc')}
              </p>
            </div>
            <div className="si-ef8e09e5">
              {[0, 1, 2, 3].map(n => (
                <button key={n} className={`btn btn-sm ${patientNoShowLimit === n ? 'btn-primary' : 'btn-outline'}`}
                  disabled={savingPatientLimit} onClick={() => onPatientNoShowLimitChange(n)}>
                  {n === 0 ? '∞' : n}
                </button>
              ))}
              <input type="number" className="form-input ss-field ss-num-input"
                value={patientNoShowLimit} min={0} max={10} disabled={savingPatientLimit}
                onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 0 && v <= 10) setPatientNoShowLimit(v) }}
                onBlur={() => onPatientNoShowLimitChange(patientNoShowLimit)}
                onKeyDown={e => { if (e.key === 'Enter') onPatientNoShowLimitChange(patientNoShowLimit) }} />
              {savingPatientLimit && <span className="si-48a0b045">{t('systemSettings.saving')}</span>}
              {patientLimitSaved && <span className="si-ab4fa2e9">✅ Saved!</span>}
            </div>
          </div>
          <p className="si-e73c55d1">
            <strong>Current:</strong> Patient may reschedule a no-show{' '}
            {patientNoShowLimit === 0 ? <strong>unlimited times</strong> : <><strong>{patientNoShowLimit} time{patientNoShowLimit !== 1 ? 's' : ''}</strong></>}.
          </p>
        </div>
      </div>
    </div>
  )
}

export default BookingCard

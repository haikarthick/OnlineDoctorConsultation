import React from 'react'
import { useTranslation } from 'react-i18next'
import { TimeSlot } from '../../types'
import { filterFutureSlots } from './bookConsultationShared'

interface Step2ChooseTimeProps {
  selectedDate: string
  onDateChange: (date: string) => void
  dateSearching: boolean
  autoSelectedDate: boolean
  bookingType: string
  onBookingTypeChange: (type: string) => void
  isFarmerOrEnterprise: boolean
  slotsLoading: boolean
  availableSlots: TimeSlot[]
  selectedSlot: TimeSlot | null
  onSelectSlot: (slot: TimeSlot) => void
  onBack: () => void
  onContinue: () => void
  formatSlotTime: (time: string) => string
}

const Step2ChooseTime: React.FC<Step2ChooseTimeProps> = ({
  selectedDate, onDateChange, dateSearching, autoSelectedDate, bookingType, onBookingTypeChange,
  isFarmerOrEnterprise, slotsLoading, availableSlots, selectedSlot, onSelectSlot, onBack, onContinue, formatSlotTime
}) => {
  const { t } = useTranslation()
  return (
    <div>
      <h2 className="si-7e63ec4f">{t('bookConsultation.chooseDateTime')}</h2>
      <div className="card si-478be2e9">
        <div className="card-body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('bookConsultation.selectDate')}</label>
              {dateSearching ? (
                <div className="si-7a759a78">
                  <div className="loading-spinner si-34eb3f90" />
                  <span className="si-c3e04596">{t('bookConsultation.findingNextDate')}</span>
                </div>
              ) : (
                <>
                  <input
                    type="date"
                    className="form-input"
                    value={selectedDate}
                    min={(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })()}
                    onChange={(e) => onDateChange(e.target.value)}
                  />
                  {autoSelectedDate && selectedDate && (
                    <p className="si-b21ad2cf">
                      ✓ {t('bookConsultation.nextAvailableAutoSelected')}
                    </p>
                  )}
                </>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">{t('bookConsultation.consultationType')}</label>
              <select
                className="form-select"
                value={bookingType}
                onChange={(e) => onBookingTypeChange(e.target.value)}
              >
                <option value="video_call">📹 {t('bookConsultation.videoCall')}</option>
                <option value="phone">📞 {t('bookConsultation.phoneCall')}</option>
                <option value="in_person">🏥 {t('bookConsultation.inPerson')}</option>
                <option value="chat">💬 {t('bookConsultation.chatType')}</option>
                {isFarmerOrEnterprise && (
                  <option value="farm_visit">🚜 {t('bookConsultation.farmVisit')}</option>
                )}
              </select>
            </div>
          </div>
        </div>
      </div>

      {selectedDate && (
        <div className="card">
          <div className="card-header">
            <h3>{t('bookConsultation.availableSlots')}</h3>
          </div>
          <div className="card-body">
            {slotsLoading ? (
              <div className="loading-container si-944918f6">
                <div className="loading-spinner" />
              </div>
            ) : (() => {
              const futureSlots = filterFutureSlots(availableSlots, selectedDate)
              return futureSlots.length === 0 ? (
                <div className="empty-state si-95d82b41">
                  <p>{availableSlots.length === 0
                    ? t('bookConsultation.noSlotsAvailable')
                    : t('bookConsultation.allSlotsPassed')}</p>
                </div>
              ) : (
                <div className="time-slots-grid">
                  {futureSlots.map((slot, idx) => (
                    <div
                      key={idx}
                      className={`time-slot ${selectedSlot?.startTime === slot.startTime ? 'selected' : ''}`}
                      onClick={() => onSelectSlot(slot)}
                    >
                      {formatSlotTime(slot.startTime)} - {formatSlotTime(slot.endTime)}
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        </div>
      )}

      <div className="si-2595c296">
        <button className="btn btn-outline" onClick={onBack}>{t('bookConsultation.back')}</button>
        <button
          className="btn btn-primary btn-lg"
          disabled={!selectedSlot}
          onClick={onContinue}
        >
          Continue →
        </button>
      </div>
    </div>
  )
}

export default Step2ChooseTime

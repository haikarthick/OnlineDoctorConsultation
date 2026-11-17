import React from 'react'
import { useTranslation } from 'react-i18next'
import { VetProfile, TimeSlot, Animal } from '../../types'

interface Step4ConfirmProps {
  selectedVet: VetProfile | null
  selectedDate: string
  selectedSlot: TimeSlot | null
  bookingType: string
  selectionMode: 'individual' | 'enterprise'
  selectedEnterprise: string
  selectedEnterpriseName: string
  selectedGroupName: string
  selectedAnimalObj: Animal | undefined
  reasonForVisit: string
  symptoms: string
  priority: string
  loading: boolean
  onBack: () => void
  onSubmit: () => void
  formatCurrency: (amount: number) => string
  speciesLabel: (species: string, t: any) => string
}

const Step4Confirm: React.FC<Step4ConfirmProps> = ({
  selectedVet, selectedDate, selectedSlot, bookingType, selectionMode, selectedEnterprise,
  selectedEnterpriseName, selectedGroupName, selectedAnimalObj, reasonForVisit, symptoms,
  priority, loading, onBack, onSubmit, formatCurrency, speciesLabel
}) => {
  const { t } = useTranslation()
  return (
    <div>
      <h2 className="si-7e63ec4f">{t('bookConsultation.reviewConfirm')}</h2>
      <div className="card si-478be2e9">
        <div className="card-body">
          <div className="si-e295240a">
            <div className="si-f23844fb">
              <div>
                <strong className="si-c3b93ebb">{t('bookConsultation.veterinarianLabel')}</strong>
                <p className="si-7ddbf1dd">
                  Dr. {selectedVet?.firstName} {selectedVet?.lastName}
                </p>
              </div>
              <div>
                <strong className="si-c3b93ebb">{t('bookConsultation.feeLabel')}</strong>
                <p className="si-0112c347">
                  {formatCurrency(selectedVet?.consultationFee || 0)}
                </p>
              </div>
            </div>
            <div className="si-f23844fb">
              <div>
                <strong className="si-c3b93ebb">{t('bookConsultation.dateTimeLabel')}</strong>
                <p className="si-7ddbf1dd">
                  {selectedDate} | {selectedSlot?.startTime} - {selectedSlot?.endTime}
                </p>
              </div>
              <div>
                <strong className="si-c3b93ebb">{t('bookConsultation.typeLabel')}</strong>
                <p className="si-69225186">
                  {bookingType.replace('_', ' ')}
                </p>
              </div>
            </div>

            {selectionMode === 'enterprise' && selectedEnterprise && (
              <div className="si-42727ee6">
                <strong className="si-85f9b19e">🏢 {t('bookConsultation.farmDetails')}</strong>
                <div className="si-33fa0800">
                  <div>
                    <span className="si-48a0b045">{t('bookConsultation.enterpriseLabel')}:</span>
                    <p className="si-3611a35f">{selectedEnterpriseName}</p>
                  </div>
                  {selectedGroupName && (
                    <div>
                      <span className="si-48a0b045">{t('bookConsultation.herdGroupLabel')}:</span>
                      <p className="si-3611a35f">{selectedGroupName}</p>
                    </div>
                  )}
                </div>
                {selectedAnimalObj && (
                  <div className="si-f48bb60f">
                    <span className="si-48a0b045">{t('bookConsultation.animalLabel')}:</span>
                    <p className="si-3611a35f">
                      {selectedAnimalObj.name} - {speciesLabel(selectedAnimalObj.species, t)}
                      {selectedAnimalObj.breed ? ` / ${selectedAnimalObj.breed}` : ''}
                    </p>
                  </div>
                )}
                {!selectedAnimalObj && (
                  <p className="si-e2573780">
                    {t('bookConsultation.generalConsultation')}
                  </p>
                )}
              </div>
            )}

            {selectionMode === 'individual' && selectedAnimalObj && (
              <div>
                <strong className="si-c3b93ebb">{t('bookConsultation.petLabel')}</strong>
                <p className="si-4dc4c991">
                  {selectedAnimalObj.name} - {selectedAnimalObj.species}
                  {selectedAnimalObj.breed ? ` / ${selectedAnimalObj.breed}` : ''}
                </p>
              </div>
            )}

            <div>
              <strong className="si-c3b93ebb">{t('bookConsultation.reasonLabel')}</strong>
              <p className="si-4dc4c991">{reasonForVisit}</p>
            </div>
            {symptoms && (
              <div>
                <strong className="si-c3b93ebb">{t('bookConsultation.symptomsLabel')}</strong>
                <p className="si-4dc4c991">{symptoms}</p>
              </div>
            )}
            <div>
              <strong className="si-c3b93ebb">{t('bookConsultation.priorityReviewLabel')}</strong>
              <p className="si-4dc4c991">
                <span className={`badge badge-${priority === 'emergency' ? 'cancelled' : priority === 'high' ? 'pending' : 'confirmed'}`}>
                  {priority}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="si-2595c296">
        <button className="btn btn-outline" onClick={onBack}>{t('bookConsultation.back')}</button>
        <button
          className="btn btn-success btn-lg"
          disabled={loading}
          onClick={onSubmit}
        >
          {loading ? t('bookConsultation.booking') : t('bookConsultation.confirmBooking')}
        </button>
      </div>
    </div>
  )
}

export default Step4Confirm

import React from 'react'
import { useTranslation } from 'react-i18next'
import { VetProfile } from '../../types'

interface Step1SelectDoctorProps {
  vets: VetProfile[]
  selectedVet: VetProfile | null
  onSelectVet: (vet: VetProfile) => void
  onContinue: () => void
  formatCurrency: (amount: number) => string
}

const Step1SelectDoctor: React.FC<Step1SelectDoctorProps> = ({ vets, selectedVet, onSelectVet, onContinue, formatCurrency }) => {
  const { t } = useTranslation()
  return (
    <div>
      <h2 className="si-7e63ec4f">{t('bookConsultation.selectVet')}</h2>
      <div className="vet-grid">
        {vets.map(vet => (
          <div
            key={vet.id}
            className={`vet-card${selectedVet?.id === vet.id ? ' is-selected' : ''}`}
            onClick={() => onSelectVet(vet)}
          >
            <div className="vet-avatar">
              {vet.firstName?.charAt(0) || '🐾'}
            </div>
            <h3 className="vet-name">Dr. {vet.firstName || ''} {vet.lastName || ''}</h3>
            <p className="vet-specialty">{(vet.specializations || []).join(', ') || 'General Veterinarian'}</p>
            <div className="vet-fee">{formatCurrency(vet.consultationFee || 0)}/session</div>
          </div>
        ))}
      </div>
      {vets.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">👨‍⚕️</div>
          <h3>{t('bookConsultation.noVets')}</h3>
          <p>{t('bookConsultation.checkBackLater')}</p>
        </div>
      )}
      <div className="si-07572340">
        <button
          className="btn btn-primary btn-lg"
          disabled={!selectedVet}
          onClick={onContinue}
        >
          Continue →
        </button>
      </div>
    </div>
  )
}

export default Step1SelectDoctor

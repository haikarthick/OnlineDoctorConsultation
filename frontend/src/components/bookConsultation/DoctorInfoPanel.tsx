import React from 'react'
import { useTranslation } from 'react-i18next'
import { VetProfile } from '../../types'

interface DoctorInfoPanelProps {
  selectedVet: VetProfile
  formatCurrency: (amount: number) => string
}

const DoctorInfoPanel: React.FC<DoctorInfoPanelProps> = ({ selectedVet, formatCurrency }) => {
  const { t } = useTranslation()
  return (
    <div className="card si-aff059cd">
      <div className="card-body si-bc0f1da3">
        <div className="si-668bc06f">
          {selectedVet.firstName?.charAt(0) || '🐾'}
        </div>
        <div className="si-26d7edc3">
          <div className="si-fcbdf47a">
            {t('bookConsultation.bookingWith')} Dr. {selectedVet.firstName} {selectedVet.lastName}
          </div>
          <div className="si-9ac294d9">
            {(selectedVet.specializations || []).join(', ') || t('bookConsultation.generalVeterinarian')}
          </div>
          {selectedVet.clinicName && (
            <div className="si-d93f66e1">🏥 {selectedVet.clinicName}</div>
          )}
        </div>
        <div className="si-d4499730">
          <div className="si-e9b1e170">
            {formatCurrency(selectedVet.consultationFee || 0)}
          </div>
          <div className="si-48a0b045">{t('bookConsultation.perSession')}</div>
          {(selectedVet.rating ?? 0) > 0 && (
            <div className="si-0d975b1f">
              ⭐ {(selectedVet.rating ?? 0).toFixed(1)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DoctorInfoPanel

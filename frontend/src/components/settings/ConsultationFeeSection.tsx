import React from 'react'
import { useTranslation } from 'react-i18next'

interface ConsultationFeeSectionProps {
  consultationFee: string
  onVetChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  formatCurrency: (amount: number) => string
}

const ConsultationFeeSection: React.FC<ConsultationFeeSectionProps> = ({ consultationFee, onVetChange, formatCurrency }) => {
  const { t } = useTranslation()
  return (
    <div className="settings-section">
      <h2>{t('settings.consultation.title')}</h2>
      <div className="settings-form">
        <div className="form-group">
          <label>{t('settings.consultation.fee')}</label>
          <div className="si-314cecae">
            <input type="number" name="consultationFee" value={consultationFee} onChange={onVetChange}
              min="0" step="0.01" placeholder="500" className="si-054905ad" />
            <span className="si-147c1f2f">
              {formatCurrency(parseFloat(consultationFee) || 0).replace(/[\d,.\s]/g, '').trim() || '$'}
            </span>
          </div>
          <p className="si-ada3b9d6">
            {t('settings.consultation.preview')} {formatCurrency(parseFloat(consultationFee) || 0)}
          </p>
        </div>
      </div>
    </div>
  )
}

export default ConsultationFeeSection

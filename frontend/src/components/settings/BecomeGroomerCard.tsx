import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const BecomeGroomerCard: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <div className="module-card module-card-narrow si-7e63ec4f">
      <h3 className="si-ff527946">💈 {t('settings.becomeGroomer.title')}</h3>
      <p className="si-676930d7">{t('settings.becomeGroomer.desc')}</p>
      <button className="module-btn primary" onClick={() => navigate('/grooming/provider')}>
        {t('settings.becomeGroomer.btn')}
      </button>
    </div>
  )
}

export default BecomeGroomerCard

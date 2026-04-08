import React from 'react'
import { useTranslation } from 'react-i18next'

const HospitalNetworks: React.FC = () => {
  const { t } = useTranslation()
  return (
    <div className="module-page">
      <div className="module-header">
        <h1>{t('hospitalNetworks.title')}</h1>
      </div>
    </div>
  )
}

export default HospitalNetworks

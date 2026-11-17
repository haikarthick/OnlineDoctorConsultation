import React from 'react'
import { TFunction } from 'i18next'
import { certTypeLabel } from './certificateWriterShared'

interface IssuedSuccessScreenProps {
  t: TFunction
  certType: string
  onNavigate: (path: string) => void
}

const IssuedSuccessScreen: React.FC<IssuedSuccessScreenProps> = ({ t, certType, onNavigate }) => (
  <div className="module-page cw-page">
    <div className="module-card cw-success-card">
      <p className="cw-success-icon">✅</p>
      <h2>{t('certificateWriter.certificateIssued')}</h2>
      <p className="cw-success-type">{certTypeLabel(t, certType)}</p>
      <div className="cw-success-actions">
        <button className="module-btn" onClick={() => onNavigate('/vet-certificates')}>
          {t('certificateWriter.viewAllCertificates')}
        </button>
        <button className="module-btn primary" onClick={() => window.location.reload()}>
          {t('certificateWriter.createAnother')}
        </button>
      </div>
    </div>
  </div>
)

export default IssuedSuccessScreen

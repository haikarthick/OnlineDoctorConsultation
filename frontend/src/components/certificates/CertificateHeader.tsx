import type { TFunction } from 'i18next'
import type { CertificateTemplate } from './certificatePrintShared'

interface Props {
  tpl: CertificateTemplate
  status: 'draft' | 'active' | 'revoked' | 'expired'
  t: TFunction
}

export default function CertificateHeader({ tpl, status, t }: Props) {
  return (
    <div className="cert-header">
      <div className="cert-logo-wrap">
        {tpl.clinicLogo ? (
          <img src={tpl.clinicLogo} alt={tpl.clinicName} className="cert-logo-img" />
        ) : (
          <div className="cert-logo-placeholder">🏥</div>
        )}
      </div>
      <div className="cert-clinic-info">
        <h1 className="cert-clinic-name">
          {tpl.clinicName}
          <span className={`cert-status-badge ${status}`}>
            {status === 'active' ? t('certificatePrint.active')
              : status === 'draft' ? t('certificatePrint.draft')
              : status === 'revoked' ? t('certificatePrint.revoked')
              : t('certificatePrint.expired')}
          </span>
        </h1>
        <p className="cert-contact-line">
          {tpl.clinicPhone && <span>📞 {tpl.clinicPhone}</span>}
          {tpl.clinicEmail && <span>✉ {tpl.clinicEmail}</span>}
          {tpl.clinicWebsite && <span>🌐 {tpl.clinicWebsite}</span>}
        </p>
        {tpl.clinicAddress && (
          <p className="cert-contact-line cert-contact-line-spaced">
            <span>📍 {tpl.clinicAddress}</span>
          </p>
        )}
        {tpl.registrationNumber && (
          <p className="cert-reg-badge">
            {t('certificatePrint.regNo')}: {tpl.registrationNumber}
          </p>
        )}
      </div>
    </div>
  )
}

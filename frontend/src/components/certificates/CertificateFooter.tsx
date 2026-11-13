import type { TFunction } from 'i18next'
import type { CertificatePrintData, CertificateTemplate } from './certificatePrintShared'

interface Props {
  cert: CertificatePrintData
  tpl: CertificateTemplate
  vetName: string
  t: TFunction
  formatDate: (d: string) => string
}

export default function CertificateFooter({ cert, tpl, vetName, t, formatDate }: Props) {
  return (
    <>
      {/* ── Validity + Signature footer ── */}
      <div className="cert-footer-row">
        <div className="cert-validity-block">
          <p className="cert-validity-label">{t('certificatePrint.validUntil')}:</p>
          <p className="cert-validity-date">
            {cert.validUntil ? formatDate(cert.validUntil) : t('certificatePrint.noExpiry')}
          </p>
        </div>
        <div className="cert-signature-block">
          <div className="cert-signature-line" />
          <p className="cert-signature-name">Dr. {vetName}</p>
          {cert.vetLicenseNumber && (
            <p className="cert-signature-sub">{t('certificatePrint.regNo')}: {cert.vetLicenseNumber}</p>
          )}
          {cert.vetSpecializations && cert.vetSpecializations.length > 0 && (
            <p className="cert-signature-sub">{cert.vetSpecializations[0]}</p>
          )}
          <p className="cert-signature-sub cert-signature-sub-small">
            {tpl.clinicName}
          </p>
        </div>
      </div>

      {/* ── Document footer ── */}
      <div className="cert-doc-footer">
        <p className="cert-footer-disclaimer">{tpl.footerText}</p>
        <p className="cert-footer-cert-id">
          Cert: {cert.certificateNumber}<br />
          Generated: {formatDate(new Date().toISOString())}
        </p>
      </div>
    </>
  )
}

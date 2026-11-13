import type { TFunction } from 'i18next'
import type { CertificatePrintData } from './certificatePrintShared'
import { calcAge } from './certificatePrintShared'

interface Props {
  cert: CertificatePrintData
  vetName: string
  ownerName: string
  t: TFunction
  formatDate: (d: string) => string
  speciesLabel: (species: string | undefined, t: TFunction) => string
  findClassTerm: (species: string, cls: string) => any
  resolveLabel: (term: any, t: (key: string) => string) => string
}

export default function CertificateInfoGrid({
  cert, vetName, ownerName, t, formatDate, speciesLabel, findClassTerm, resolveLabel,
}: Props) {
  return (
    <div className="cert-info-grid">
      <div className="cert-info-row">
        <span className="cert-info-label">{t('certificatePrint.patient')}:</span>
        <span className="cert-info-value">
          <strong>{cert.animalName || '-'}</strong>
          {cert.animalSpecies && ` (${speciesLabel(cert.animalSpecies, t)}${cert.animalBreed ? ', ' + cert.animalBreed : ''})`}
        </span>
      </div>
      <div className="cert-info-row">
        <span className="cert-info-label">{t('certificatePrint.issuingVet')}:</span>
        <span className="cert-info-value"><strong>Dr. {vetName}</strong></span>
      </div>
      <div className="cert-info-row">
        <span className="cert-info-label">{t('certificatePrint.owner')}:</span>
        <span className="cert-info-value">{ownerName}</span>
      </div>
      <div className="cert-info-row">
        <span className="cert-info-label">{t('certificatePrint.licenseNo')}:</span>
        <span className="cert-info-value">{cert.vetLicenseNumber || '-'}</span>
      </div>
      {(cert.animalGender || cert.animalDob) && (
        <div className="cert-info-row">
          <span className="cert-info-label">{t('certificatePrint.age')} / {t('certificatePrint.gender')}:</span>
          <span className="cert-info-value">
            {(() => {
              const classTerm = cert.animalClass ? findClassTerm(cert.animalSpecies || '', cert.animalClass) : undefined
              const genderOrClass = classTerm ? resolveLabel(classTerm, t) : cert.animalGender
              return [calcAge(cert.animalDob), genderOrClass].filter(Boolean).join(' / ')
            })()}
          </span>
        </div>
      )}
      {cert.examinationDate && (
        <div className="cert-info-row">
          <span className="cert-info-label">{t('certificatePrint.examinationDate')}:</span>
          <span className="cert-info-value">{formatDate(cert.examinationDate)}</span>
        </div>
      )}
      {cert.issuedAt && (
        <div className="cert-info-row">
          <span className="cert-info-label">{t('certificatePrint.issuedDate')}:</span>
          <span className="cert-info-value">{formatDate(cert.issuedAt)}</span>
        </div>
      )}
      {cert.validUntil && (
        <div className="cert-info-row">
          <span className="cert-info-label">{t('certificatePrint.validUntil')}:</span>
          <span className="cert-info-value">{formatDate(cert.validUntil)}</span>
        </div>
      )}
    </div>
  )
}

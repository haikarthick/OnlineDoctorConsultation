import type { TFunction } from 'i18next'
import type { CertificatePrintData } from './certificatePrintShared'

interface Props {
  cert: CertificatePrintData
  isTravelRelated: boolean
  isBreedingRelated: boolean
  isValuation: boolean
  isMovement: boolean
  isHerd: boolean
  t: TFunction
  formatDate: (d: string) => string
  speciesLabel: (species: string | undefined, t: TFunction) => string
}

export default function CertificateTypeDetails({
  cert, isTravelRelated, isBreedingRelated, isValuation, isMovement, isHerd, t, formatDate, speciesLabel,
}: Props) {
  return (
    <>
      {/* ── Type-specific: Travel ── */}
      {isTravelRelated && cert.travelDetails && (
        <div className="cert-section">
          <div className="cert-section-header">
            <span>✈️</span> {t('certificatePrint.travelDetails')}
          </div>
          <div className="cert-kv-grid">
            {cert.travelDetails.destination && (
              <>
                <span className="cert-kv-key">{t('certificateWriter.destination')}:</span>
                <span className="cert-kv-val">{cert.travelDetails.destination}</span>
              </>
            )}
            {cert.travelDetails.departureDate && (
              <>
                <span className="cert-kv-key">{t('certificateWriter.departureDate')}:</span>
                <span className="cert-kv-val">{formatDate(cert.travelDetails.departureDate)}</span>
              </>
            )}
            {cert.travelDetails.airline && (
              <>
                <span className="cert-kv-key">{t('certificateWriter.airline')}:</span>
                <span className="cert-kv-val">{cert.travelDetails.airline}</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Type-specific: Breeding ── */}
      {isBreedingRelated && cert.breedingDetails && (
        <div className="cert-section">
          <div className="cert-section-header">
            <span>🐄</span> {t('certificatePrint.breedingDetails')}
          </div>
          <div className="cert-kv-grid">
            {cert.breedingDetails.soundness && (
              <>
                <span className="cert-kv-key">{t('certificateWriter.breedingSoundness')}:</span>
                <span className="cert-kv-val">{cert.breedingDetails.soundness}</span>
              </>
            )}
            {cert.breedingDetails.pregnancyStatus && (
              <>
                <span className="cert-kv-key">{t('certificateWriter.pregnancyStatus')}:</span>
                <span className="cert-kv-val">{cert.breedingDetails.pregnancyStatus}</span>
              </>
            )}
            {cert.breedingDetails.estimatedGestation && (
              <>
                <span className="cert-kv-key">{t('certificateWriter.estimatedGestation')}:</span>
                <span className="cert-kv-val">{cert.breedingDetails.estimatedGestation}</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Type-specific: Valuation ── */}
      {isValuation && cert.valuationDetails && (
        <div className="cert-section">
          <div className="cert-section-header">
            <span>💰</span> {t('certificatePrint.valuationDetails')}
          </div>
          <div className="cert-kv-grid">
            {cert.valuationDetails.amount !== undefined && (
              <>
                <span className="cert-kv-key">{t('certificateWriter.valuationAmount')}:</span>
                <span className="cert-kv-val">{cert.valuationDetails.amount}</span>
              </>
            )}
            {cert.valuationDetails.basis && (
              <>
                <span className="cert-kv-key">{t('certificateWriter.valuationBasis')}:</span>
                <span className="cert-kv-val">{cert.valuationDetails.basis}</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Type-specific: Movement ── */}
      {isMovement && cert.movementDetails && (
        <div className="cert-section">
          <div className="cert-section-header">
            <span>🚛</span> {t('certificatePrint.movementDetails')}
          </div>
          <div className="cert-kv-grid">
            {cert.movementDetails.fromLocation && (
              <>
                <span className="cert-kv-key">{t('certificateWriter.movementFrom')}:</span>
                <span className="cert-kv-val">{cert.movementDetails.fromLocation}</span>
              </>
            )}
            {cert.movementDetails.toLocation && (
              <>
                <span className="cert-kv-key">{t('certificateWriter.movementTo')}:</span>
                <span className="cert-kv-val">{cert.movementDetails.toLocation}</span>
              </>
            )}
            {cert.movementDetails.transportDate && (
              <>
                <span className="cert-kv-key">{t('certificateWriter.transportDate')}:</span>
                <span className="cert-kv-val">{formatDate(cert.movementDetails.transportDate)}</span>
              </>
            )}
            {cert.movementDetails.vehicleNumber && (
              <>
                <span className="cert-kv-key">{t('certificateWriter.vehicleNumber')}:</span>
                <span className="cert-kv-val">{cert.movementDetails.vehicleNumber}</span>
              </>
            )}
            {cert.movementDetails.driverName && (
              <>
                <span className="cert-kv-key">{t('certificateWriter.driverName')}:</span>
                <span className="cert-kv-val">{cert.movementDetails.driverName}</span>
              </>
            )}
            {cert.movementDetails.purpose && (
              <>
                <span className="cert-kv-key">{t('certificateWriter.movementPurpose')}:</span>
                <span className="cert-kv-val">{cert.movementDetails.purpose}</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Type-specific: Herd ── */}
      {isHerd && cert.herdDetails && (
        <div className="cert-section">
          <div className="cert-section-header">
            <span>🐄</span> {t('certificatePrint.herdDetails')}
          </div>
          <div className="cert-kv-grid">
            {cert.herdDetails.groupName && (
              <>
                <span className="cert-kv-key">{t('certificateWriter.herdGroupName')}:</span>
                <span className="cert-kv-val">{cert.herdDetails.groupName}</span>
              </>
            )}
            {cert.herdDetails.animalCount && (
              <>
                <span className="cert-kv-key">{t('certificateWriter.herdAnimalCount')}:</span>
                <span className="cert-kv-val">{cert.herdDetails.animalCount}</span>
              </>
            )}
            {cert.herdDetails.species && (
              <>
                <span className="cert-kv-key">{t('certificateWriter.herdSpecies')}:</span>
                <span className="cert-kv-val">{speciesLabel(cert.herdDetails.species, t)}</span>
              </>
            )}
            {cert.herdDetails.purpose && (
              <>
                <span className="cert-kv-key">{t('certificateWriter.herdPurpose')}:</span>
                <span className="cert-kv-val">{cert.herdDetails.purpose}</span>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

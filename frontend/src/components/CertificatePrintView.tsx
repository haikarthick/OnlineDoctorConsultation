import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../context/SettingsContext'
import { useMasterData } from '../context/MasterDataContext'
import './CertificatePrintView.css'

// ─── Types ────────────────────────────────────────────────────
export interface CertificatePrintData {
  id: string
  certificateNumber: string
  certificateType: string
  status: 'draft' | 'active' | 'revoked' | 'expired'
  examinationDate?: string
  issuedAt?: string
  validUntil?: string
  clinicalFindings?: string
  diagnosis?: string
  treatmentSummary?: string
  recommendations?: string
  notes?: string
  revocationReason?: string
  // JSONB detail objects
  vaccinationDetails?: { vaccines?: VaccinationEntry[]; [k: string]: any }
  travelDetails?: { destination?: string; departureDate?: string; airline?: string; [k: string]: any }
  breedingDetails?: {
    soundness?: string
    pregnancyStatus?: string
    estimatedGestation?: string
    [k: string]: any
  }
  valuationDetails?: { amount?: string | number; basis?: string; [k: string]: any }
  movementDetails?: {
    fromLocation?: string
    toLocation?: string
    vehicleNumber?: string
    transportDate?: string
    driverName?: string
    purpose?: string
    [k: string]: any
  }
  herdDetails?: {
    groupName?: string
    animalCount?: number | string
    species?: string
    purpose?: string
    [k: string]: any
  }
  // Animal / patient
  animalName?: string
  animalSpecies?: string
  animalBreed?: string
  animalDob?: string
  animalGender?: string
  animalClass?: string
  // Owner
  ownerFirstName?: string
  ownerLastName?: string
  ownerEmail?: string
  // Vet
  vetFirstName?: string
  vetLastName?: string
  vetLicenseNumber?: string
  vetSpecializations?: string[]
  vetClinicName?: string
}

interface VaccinationEntry {
  vaccine?: string
  batchNo?: string
  dateAdministered?: string
  nextDue?: string
  manufacturer?: string
}

export interface CertificateTemplate {
  clinicName: string
  clinicAddress: string
  clinicPhone: string
  clinicEmail: string
  clinicWebsite: string
  registrationNumber: string
  clinicLogo: string
  footerText: string
}

interface Props {
  certificate: CertificatePrintData
  template: CertificateTemplate
  onClose: () => void
}

const DEFAULT_TEMPLATE: CertificateTemplate = {
  clinicName: 'VetCare Platform',
  clinicAddress: '123 Veterinary Avenue, Chennai, Tamil Nadu 600001, India',
  clinicPhone: '+91 44 1234 5678',
  clinicEmail: 'care@vetcareplatform.com',
  clinicWebsite: 'www.vetcareplatform.com',
  registrationNumber: 'VET-REG-2024-001',
  clinicLogo: '',
  footerText:
    'This certificate is digitally generated. Contact the issuing veterinarian for queries or verification.',
}

// ── Type-specific labels ──────────────────────────────────────
const CERT_TYPE_LABELS: Record<string, string> = {
  health_certificate: 'GENERAL HEALTH CERTIFICATE',
  fitness_to_travel: 'FITNESS TO TRAVEL CERTIFICATE',
  rabies_vaccination: 'RABIES VACCINATION CERTIFICATE',
  vaccination_record: 'VACCINATION RECORD',
  pre_travel: 'PRE-TRAVEL VETERINARY CERTIFICATE',
  sterilization: 'STERILIZATION CERTIFICATE',
  treatment: 'TREATMENT CERTIFICATE',
  animal_injury: 'ANIMAL INJURY CERTIFICATE',
  post_mortem: 'POST-MORTEM REPORT',
  breeding_soundness: 'BREEDING SOUNDNESS CERTIFICATE',
  pregnancy_diagnosis: 'PREGNANCY DIAGNOSIS CERTIFICATE',
  infertility_evaluation: 'INFERTILITY / HEALTH EVALUATION',
  fitness_for_sale: 'FITNESS FOR SALE CERTIFICATE',
  animal_valuation: 'ANIMAL VALUATION CERTIFICATE',
}

function calcAge(dob?: string): string {
  if (!dob) return '—'
  const ms = Date.now() - new Date(dob).getTime()
  const years = Math.floor(ms / (1000 * 60 * 60 * 24 * 365.25))
  if (years >= 1) return `${years}y`
  const months = Math.floor(ms / (1000 * 60 * 60 * 24 * 30.44))
  return months > 0 ? `${months}mo` : '<1mo'
}

// ── Shows vaccination details ──────────────────────────────────
function VaccineTable({ details, t }: { details?: { vaccines?: VaccinationEntry[]; [k: string]: any }; t: (k: string) => string }) {
  const rows = details?.vaccines || []
  if (rows.length === 0) {
    // Show raw details if no structured vaccine array
    const entries = details ? Object.entries(details).filter(([k]) => k !== 'vaccines') : []
    if (entries.length === 0) return null
  }

  return (
    <div className="cert-section">
      <div className="cert-section-header">
        <span>💉</span> {t('certificatePrint.vaccinationDetails')}
      </div>
      {rows.length > 0 ? (
        <table className="cert-vacc-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Vaccine</th>
              <th>Batch No.</th>
              <th>Date Administered</th>
              <th>Next Due</th>
              <th>Manufacturer</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{v.vaccine || '—'}</td>
                <td>{v.batchNo || '—'}</td>
                <td>{v.dateAdministered || '—'}</td>
                <td>{v.nextDue || '—'}</td>
                <td>{v.manufacturer || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="cert-section-body">
          {details && Object.entries(details).map(([k, v]) => (
            <div key={k}><strong>{k}:</strong> {String(v)}</div>
          ))}
        </div>
      )}
    </div>
  )
}

const CertificatePrintView: React.FC<Props> = ({ certificate: cert, template, onClose }) => {
  const { t } = useTranslation()
  const { formatDate } = useSettings()
  const { findClassTerm, speciesLabel, resolveLabel } = useMasterData()
  const tpl = { ...DEFAULT_TEMPLATE, ...template }
  const overlayRef = useRef<HTMLDivElement>(null)
  const docRef = useRef<HTMLDivElement>(null)
  const [printing, setPrinting] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const handlePrint = () => {
    const docEl = docRef.current
    if (!docEl) return
    setPrinting(true)

    // Collect all currently-loaded CSS from this page's stylesheets
    const cssTexts: string[] = []
    Array.from(document.styleSheets).forEach(sheet => {
      try {
        Array.from(sheet.cssRules).forEach(rule => { cssTexts.push(rule.cssText) })
      } catch {
        // Cross-origin sheet — import by URL
        if (sheet.href) cssTexts.push(`@import url("${sheet.href}");`)
      }
    })

    // Create an isolated iframe containing ONLY the certificate document
    const iframe = document.createElement('iframe')
    iframe.setAttribute('style', 'position:fixed;top:-9999px;left:-9999px;width:210mm;height:297mm;border:0;visibility:hidden')
    document.body.appendChild(iframe)

    const win = iframe.contentWindow
    if (!win) { document.body.removeChild(iframe); setPrinting(false); return }

    win.document.open()
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background: white; }
    ${cssTexts.join('\n')}
    @media print {
      .cert-watermark { opacity: 0.1; }
    }
  </style>
</head>
<body>${docEl.outerHTML}</body>
</html>`)
    win.document.close()

    // Allow layout to settle then print
    setTimeout(() => {
      win.focus()
      win.print()
      setTimeout(() => {
        if (document.body.contains(iframe)) document.body.removeChild(iframe)
        setPrinting(false)
      }, 1000)
    }, 400)
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose()
  }

  const certTypeLabel = CERT_TYPE_LABELS[cert.certificateType] || cert.certificateType.toUpperCase().replace(/_/g, ' ')
  const vetName = [cert.vetFirstName, cert.vetLastName].filter(Boolean).join(' ') || '—'
  const ownerName = [cert.ownerFirstName, cert.ownerLastName].filter(Boolean).join(' ') || '—'

  const isVaccRelated = ['rabies_vaccination', 'vaccination_record'].includes(cert.certificateType)
  const isTravelRelated = ['fitness_to_travel', 'pre_travel'].includes(cert.certificateType)
  const isBreedingRelated = ['breeding_soundness', 'pregnancy_diagnosis', 'infertility_evaluation'].includes(cert.certificateType)
  const isValuation = cert.certificateType === 'animal_valuation'
  const isMovement = ['movement_permit', 'slaughter_fitness', 'export_health_certificate'].includes(cert.certificateType)
  const isHerd = cert.certificateType === 'herd_health_certificate'

  return (
    <div className="cert-overlay" ref={overlayRef} onClick={handleOverlayClick} id="cert-print-root">
      <div className="cert-modal" onClick={e => e.stopPropagation()}>

        {/* ── Toolbar (hidden during print) ── */}
        <div className="cert-toolbar">
          <p className="cert-toolbar-title">🖨 {t('certificatePrint.previewTitle')}</p>
          <div className="cert-toolbar-actions">
            <button className="cert-btn-print" onClick={handlePrint} disabled={printing}>
              🖨 {printing ? '...' : t('certificatePrint.print')}
            </button>
            <button className="cert-btn-close" onClick={onClose}>✕ {t('common.close')}</button>
          </div>
        </div>

        {/* ── A4 Document ── */}
        <div className="cert-document" ref={docRef}>

          {/* ── Status watermark ── */}
          {cert.status === 'draft' && (
            <div className="cert-watermark cert-watermark-draft">{t('certificatePrint.draft')}</div>
          )}
          {cert.status === 'revoked' && (
            <div className="cert-watermark cert-watermark-revoked">{t('certificatePrint.revoked')}</div>
          )}
          {cert.status === 'expired' && (
            <div className="cert-watermark cert-watermark-expired">{t('certificatePrint.expired')}</div>
          )}

          {/* ── Letterhead ── */}
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
                <span className={`cert-status-badge ${cert.status}`}>
                  {cert.status === 'active' ? t('certificatePrint.active')
                    : cert.status === 'draft' ? t('certificatePrint.draft')
                    : cert.status === 'revoked' ? t('certificatePrint.revoked')
                    : t('certificatePrint.expired')}
                </span>
              </h1>
              <p className="cert-contact-line">
                {tpl.clinicPhone && <span>📞 {tpl.clinicPhone}</span>}
                {tpl.clinicEmail && <span>✉ {tpl.clinicEmail}</span>}
                {tpl.clinicWebsite && <span>🌐 {tpl.clinicWebsite}</span>}
              </p>
              {tpl.clinicAddress && (
                <p className="cert-contact-line" style={{ marginTop: 2 }}>
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

          <hr className="cert-divider-thick" />

          {/* ── Certificate type label ── */}
          <div className="cert-label-bar">
            📜 {certTypeLabel} 📜
          </div>

          {/* ── Certificate number ── */}
          <div className="cert-number-bar">
            {t('certificatePrint.certNo')}{' '}
            <span className="cert-number-value">{cert.certificateNumber}</span>
          </div>

          {/* ── Patient & Vet info grid ── */}
          <div className="cert-info-grid">
            <div className="cert-info-row">
              <span className="cert-info-label">{t('certificatePrint.patient')}:</span>
              <span className="cert-info-value">
                <strong>{cert.animalName || '—'}</strong>
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
              <span className="cert-info-value">{cert.vetLicenseNumber || '—'}</span>
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

          <hr className="cert-divider-thin" />

          {/* ── Clinical findings ── */}
          {cert.clinicalFindings && (
            <div className="cert-section">
              <div className="cert-section-header">
                <span>🩺</span> {t('certificatePrint.clinicalFindings')}
              </div>
              <div className="cert-section-body">{cert.clinicalFindings}</div>
            </div>
          )}

          {/* ── Diagnosis ── */}
          {cert.diagnosis && (
            <div className="cert-section">
              <div className="cert-section-header">
                <span>📋</span> {t('certificatePrint.diagnosis')}
              </div>
              <div className="cert-section-body">{cert.diagnosis}</div>
            </div>
          )}

          {/* ── Treatment summary ── */}
          {cert.treatmentSummary && (
            <div className="cert-section">
              <div className="cert-section-header">
                <span>💊</span> {t('certificatePrint.treatmentSummary')}
              </div>
              <div className="cert-section-body">{cert.treatmentSummary}</div>
            </div>
          )}

          {/* ── Type-specific: Vaccination ── */}
          {isVaccRelated && (
            <VaccineTable details={cert.vaccinationDetails} t={t} />
          )}

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

          {/* ── Recommendations ── */}
          {cert.recommendations && (
            <div className="cert-section">
              <div className="cert-section-header">
                <span>📝</span> {t('certificatePrint.recommendations')}
              </div>
              <div className="cert-section-body">{cert.recommendations}</div>
            </div>
          )}

          {/* ── Notes ── */}
          {cert.notes && (
            <div className="cert-section">
              <div className="cert-section-header">
                <span>🗒</span> {t('certificatePrint.notes')}
              </div>
              <div className="cert-section-body">{cert.notes}</div>
            </div>
          )}

          {/* ── Revocation reason ── */}
          {cert.revocationReason && (
            <div className="cert-section">
              <div className="cert-section-header" style={{ color: '#e53e3e', borderColor: '#e53e3e' }}>
                <span>🚫</span> Revocation Reason
              </div>
              <div className="cert-section-body" style={{ color: '#9b2c2c' }}>{cert.revocationReason}</div>
            </div>
          )}

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
              <p className="cert-signature-sub" style={{ marginTop: 2, fontSize: '7.5pt' }}>
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

        </div>{/* end cert-document */}
      </div>{/* end cert-modal */}
    </div>
  )
}

export default CertificatePrintView

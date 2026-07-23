import React, { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../context/SettingsContext'
import { useMasterData } from '../context/MasterDataContext'
import './PrescriptionPrintView.css'

// ─── Types ────────────────────────────────────────────────────
export interface PrescriptionMedication {
  name: string
  dosage: string
  frequency: string
  duration: string
  route?: string
  instructions?: string
}

export interface PrescriptionPrintData {
  id: string
  consultationId?: string
  isActive: boolean
  createdAt: string
  validUntil?: string
  // Animal / patient
  animalName?: string
  animalSpecies?: string
  animalBreed?: string
  animalAge?: string
  animalGender?: string
  animalClass?: string
  // Owner
  petOwnerName?: string
  // Vet
  vetName?: string
  vetLicense?: string
  vetSpecialization?: string
  vetClinicName?: string
  vetQualifications?: string
  // Clinical
  diagnosis?: string
  chiefComplaints?: string
  instructions?: string
  // Meds
  medications: PrescriptionMedication[]
  // Pharmacy routing (network-coordinated prescriptions only)
  isNetworkCoordinated?: boolean
  pharmacyName?: string
  reviewStatus?: string
}

export interface PrescriptionTemplate {
  clinicName: string
  clinicTagline: string
  clinicAddress: string
  clinicPhone: string
  clinicEmail: string
  clinicWebsite: string
  registrationNumber: string
  clinicLogo: string
  footerText: string
}

interface Props {
  prescription: PrescriptionPrintData
  template: PrescriptionTemplate
  onClose: () => void
}

const DEFAULT_TEMPLATE: PrescriptionTemplate = {
  clinicName: 'VetCare Platform',
  clinicTagline: 'Compassionate Care for Your Animals',
  clinicAddress: '123 Veterinary Avenue, Chennai, Tamil Nadu 600001, India',
  clinicPhone: '+91 44 1234 5678',
  clinicEmail: 'care@vetcareplatform.com',
  clinicWebsite: 'www.vetcareplatform.com',
  registrationNumber: 'VET-REG-2024-001',
  clinicLogo: '',
  footerText: 'This prescription is digitally generated and valid until the date specified. Contact the prescribing veterinarian for queries.',
}

// ── Helper: pad prescription ID for display ──
function shortId(id: string): string {
  return id.replace(/-/g, '').substring(0, 12).toUpperCase()
}

const REVIEW_STATUS_KEY: Record<string, string> = {
  pending_review: 'pendingReview',
  approved_for_dispensing: 'approvedForDispensing',
  dispensed: 'dispensed',
  rejected: 'rejected',
  needs_clarification: 'needsClarification',
}

const PrescriptionPrintView: React.FC<Props> = ({ prescription: rx, template, onClose }) => {
  const { t } = useTranslation()
  const { formatDate } = useSettings()
  const { findClassTerm } = useMasterData()
  const tpl = { ...DEFAULT_TEMPLATE, ...template }
  const overlayRef = useRef<HTMLDivElement>(null)

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const handlePrint = () => window.print()

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose()
  }

  return (
    <div className="rx-overlay" ref={overlayRef} onClick={handleOverlayClick} id="rx-print-root">
      <div className="rx-modal" onClick={e => e.stopPropagation()}>

        {/* ── Toolbar (hidden during print) ── */}
        <div className="rx-toolbar">
          <p className="rx-toolbar-title">🖨 {t('prescriptionPrint.previewTitle')}</p>
          <div className="rx-toolbar-actions">
            <button className="rx-btn-print" onClick={handlePrint}>
              🖨 {t('prescriptionPrint.print')}
            </button>
            <button className="rx-btn-close" onClick={onClose}>✕ {t('common.close')}</button>
          </div>
        </div>

        {/* ── A4 Document ── */}
        <div className="rx-document">

          {/* ── Inactive watermark ── */}
          {!rx.isActive && (
            <div className="rx-inactive-watermark">VOID</div>
          )}

          {/* ────────────────────────────────────────
              LETTERHEAD HEADER
          ─────────────────────────────────────── */}
          <div className="rx-header">
            <div className="rx-logo-wrap">
              {tpl.clinicLogo ? (
                <img src={tpl.clinicLogo} alt={tpl.clinicName} className="rx-logo-img" />
              ) : (
                <div className="rx-logo-placeholder">🐾</div>
              )}
            </div>
            <div className="rx-clinic-info">
              <h1 className="rx-clinic-name">
                {tpl.clinicName}
                {rx.isActive ? (
                  <span className="rx-status-active">{t('prescriptionPrint.active')}</span>
                ) : (
                  <span className="rx-status-inactive">{t('prescriptionPrint.voided')}</span>
                )}
              </h1>
              {tpl.clinicTagline && (
                <p className="rx-clinic-tagline">{tpl.clinicTagline}</p>
              )}
              <p className="rx-contact-line">
                {tpl.clinicPhone && <span>📞 {tpl.clinicPhone}</span>}
                {tpl.clinicEmail && <span>✉ {tpl.clinicEmail}</span>}
                {tpl.clinicWebsite && <span>🌐 {tpl.clinicWebsite}</span>}
              </p>
              {tpl.clinicAddress && (
                <p className="rx-contact-line" style={{ marginTop: 2 }}>
                  <span>📍 {tpl.clinicAddress}</span>
                </p>
              )}
              {tpl.registrationNumber && (
                <p className="rx-reg-badge">
                  {t('prescriptionPrint.regNo')}: {tpl.registrationNumber}
                </p>
              )}
            </div>
          </div>

          <hr className="rx-divider-thick" />

          {/* ── "PRESCRIPTION" label bar ── */}
          <div className="rx-label-bar">
            ⚕ {t('prescriptionPrint.rxLabel')} ⚕
          </div>

          {/* ────────────────────────────────────────
              PATIENT / ANIMAL INFORMATION
          ─────────────────────────────────────── */}
          <div className="rx-patient-section">
            <div className="rx-info-row">
              <span className="rx-info-label">{t('prescriptionPrint.rxId')}:</span>
              <span className="rx-info-value"><strong>{shortId(rx.id)}</strong></span>
            </div>
            <div className="rx-info-row">
              <span className="rx-info-label">{t('prescriptionPrint.date')}:</span>
              <span className="rx-info-value">{formatDate(rx.createdAt)}</span>
            </div>

            <div className="rx-info-row">
              <span className="rx-info-label">{t('prescriptionPrint.patient')}:</span>
              <span className="rx-info-value">
                <strong>{rx.animalName || '—'}</strong>
                {rx.animalSpecies && ` (${rx.animalSpecies}${rx.animalBreed ? ', ' + rx.animalBreed : ''})`}
              </span>
            </div>
            <div className="rx-info-row">
              <span className="rx-info-label">{t('prescriptionPrint.owner')}:</span>
              <span className="rx-info-value">{rx.petOwnerName || '—'}</span>
            </div>

            {(rx.animalAge || rx.animalGender) && (
              <div className="rx-info-row">
                <span className="rx-info-label">{t('prescriptionPrint.ageGender')}:</span>
                <span className="rx-info-value">
                  {(() => {
                    const classTerm = rx.animalClass ? findClassTerm(rx.animalSpecies || '', rx.animalClass) : undefined
                    const genderOrClass = classTerm ? t(classTerm.labelKey) : rx.animalGender
                    return [rx.animalAge, genderOrClass].filter(Boolean).join(' / ')
                  })()}
                </span>
              </div>
            )}
            {rx.consultationId && (
              <div className="rx-info-row">
                <span className="rx-info-label">{t('prescriptionPrint.visitRef')}:</span>
                <span className="rx-info-value" style={{ fontSize: '8.5pt', color: '#718096' }}>
                  {shortId(rx.consultationId)}
                </span>
              </div>
            )}
          </div>

          {/* ────────────────────────────────────────
              PRESCRIBING DOCTOR
          ─────────────────────────────────────── */}
          <div className="rx-doctor-section">
            <div className="rx-info-row">
              <span className="rx-info-label">{t('prescriptionPrint.doctor')}:</span>
              <span className="rx-info-value">
                <strong>Dr. {rx.vetName || '—'}</strong>
              </span>
            </div>
            {rx.vetLicense && (
              <div className="rx-info-row">
                <span className="rx-info-label">{t('prescriptionPrint.licenseNo')}:</span>
                <span className="rx-info-value">{rx.vetLicense}</span>
              </div>
            )}
            {rx.vetSpecialization && (
              <div className="rx-info-row">
                <span className="rx-info-label">{t('prescriptionPrint.specialization')}:</span>
                <span className="rx-info-value">{rx.vetSpecialization}</span>
              </div>
            )}
            {(rx.vetQualifications || rx.vetClinicName) && (
              <div className="rx-info-row">
                <span className="rx-info-label">{t('prescriptionPrint.qualification')}:</span>
                <span className="rx-info-value">
                  {[rx.vetQualifications, rx.vetClinicName].filter(Boolean).join(' | ')}
                </span>
              </div>
            )}
          </div>

          <hr className="rx-divider-thin" />

          {/* ────────────────────────────────────────
              CHIEF COMPLAINTS
          ─────────────────────────────────────── */}
          {rx.chiefComplaints && (
            <div className="rx-section">
              <div className="rx-section-header">
                <span>📋</span> {t('prescriptionPrint.chiefComplaints')}
              </div>
              <div className="rx-section-body">{rx.chiefComplaints}</div>
            </div>
          )}

          {/* ────────────────────────────────────────
              DIAGNOSIS
          ─────────────────────────────────────── */}
          {rx.diagnosis && (
            <div className="rx-section">
              <div className="rx-section-header">
                <span>🩺</span> {t('prescriptionPrint.diagnosis')}
              </div>
              <div className="rx-section-body">{rx.diagnosis}</div>
            </div>
          )}

          {/* ────────────────────────────────────────
              MEDICATIONS TABLE
          ─────────────────────────────────────── */}
          <div className="rx-med-section">
            <div className="rx-section-header">
              <span>💊</span> {t('prescriptionPrint.medications')}
            </div>
            <table className="rx-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t('prescriptionPrint.colMedName')}</th>
                  <th>{t('prescriptionPrint.colDosage')}</th>
                  <th>{t('prescriptionPrint.colFrequency')}</th>
                  <th>{t('prescriptionPrint.colRoute')}</th>
                  <th>{t('prescriptionPrint.colDuration')}</th>
                  <th>{t('prescriptionPrint.colNotes')}</th>
                </tr>
              </thead>
              <tbody>
                {rx.medications.map((med, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td><span className="rx-med-name">{med.name}</span></td>
                    <td>{med.dosage}</td>
                    <td>{med.frequency}</td>
                    <td>{med.route || '—'}</td>
                    <td>{med.duration || '—'}</td>
                    <td style={{ fontSize: '8.5pt', color: '#4a5568' }}>{med.instructions || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ────────────────────────────────────────
              GENERAL INSTRUCTIONS
          ─────────────────────────────────────── */}
          {rx.instructions && (
            <div className="rx-section">
              <div className="rx-section-header">
                <span>📝</span> {t('prescriptionPrint.generalInstructions')}
              </div>
              <div className="rx-section-body">{rx.instructions}</div>
            </div>
          )}

          {/* ────────────────────────────────────────
              PHARMACY ROUTING STAMP (network-coordinated only)
          ─────────────────────────────────────── */}
          {rx.isNetworkCoordinated && (
            <div className="rx-section" style={{ border: '1px dashed #94a3b8', borderRadius: 6, padding: '8px 12px' }}>
              <div className="rx-section-header">
                <span>💊</span> {t('prescriptionPrint.pharmacyRouting')}
              </div>
              <div className="rx-section-body" style={{ fontSize: '9pt' }}>
                {t('prescriptionPrint.forwardedTo', { pharmacy: rx.pharmacyName || t('prescriptionPrint.networkPharmacy') })}
                {rx.reviewStatus && REVIEW_STATUS_KEY[rx.reviewStatus] && ` — ${t(`prescriptions.pharmacy.${REVIEW_STATUS_KEY[rx.reviewStatus]}`)}`}
              </div>
            </div>
          )}

          {/* ────────────────────────────────────────
              FOOTER: Validity + Signature
          ─────────────────────────────────────── */}
          <div className="rx-footer-row">
            <div className="rx-validity-block">
              <p className="rx-validity-label">{t('prescriptionPrint.validUntil')}:</p>
              <p className="rx-validity-date">
                {rx.validUntil ? formatDate(rx.validUntil) : t('prescriptionPrint.noExpiry')}
              </p>
            </div>
            <div className="rx-signature-block">
              <div className="rx-signature-line" />
              <p className="rx-signature-name">Dr. {rx.vetName || '—'}</p>
              {rx.vetLicense && (
                <p className="rx-signature-reg">{t('prescriptionPrint.regNo')}: {rx.vetLicense}</p>
              )}
              {rx.vetSpecialization && (
                <p className="rx-signature-reg">{rx.vetSpecialization}</p>
              )}
              <p className="rx-signature-reg" style={{ marginTop: 2, fontSize: '7.5pt' }}>
                {tpl.clinicName}
              </p>
            </div>
          </div>

          {/* ── Document footer ── */}
          <div className="rx-doc-footer">
            <p className="rx-footer-disclaimer">{tpl.footerText}</p>
            <p className="rx-footer-rx-id">
              {t('prescriptionPrint.rxRef')}: {shortId(rx.id)}<br />
              {t('prescriptionPrint.generated')}: {formatDate(new Date().toISOString())}
            </p>
          </div>

        </div>{/* end rx-document */}
      </div>{/* end rx-modal */}
    </div>
  )
}

export default PrescriptionPrintView

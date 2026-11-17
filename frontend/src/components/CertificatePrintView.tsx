import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../context/SettingsContext'
import { useMasterData } from '../context/MasterDataContext'
import './CertificatePrintView.css'
import {
  CERT_TYPE_LABELS,
  DEFAULT_TEMPLATE,
  type CertificatePrintData,
  type CertificateTemplate,
} from './certificates/certificatePrintShared'
import CertificateHeader from './certificates/CertificateHeader'
import CertificateInfoGrid from './certificates/CertificateInfoGrid'
import CertificateVaccineTable from './certificates/CertificateVaccineTable'
import CertificateTypeDetails from './certificates/CertificateTypeDetails'
import CertificateFooter from './certificates/CertificateFooter'

export type { CertificatePrintData, CertificateTemplate }

interface Props {
  certificate: CertificatePrintData
  template: CertificateTemplate
  onClose: () => void
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
        // Cross-origin sheet - import by URL
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
  const vetName = [cert.vetFirstName, cert.vetLastName].filter(Boolean).join(' ') || '-'
  const ownerName = [cert.ownerFirstName, cert.ownerLastName].filter(Boolean).join(' ') || '-'

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

          <CertificateHeader tpl={tpl} status={cert.status} t={t} />

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

          <CertificateInfoGrid
            cert={cert}
            vetName={vetName}
            ownerName={ownerName}
            t={t}
            formatDate={formatDate}
            speciesLabel={speciesLabel}
            findClassTerm={findClassTerm}
            resolveLabel={resolveLabel}
          />

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
            <CertificateVaccineTable details={cert.vaccinationDetails} t={t} />
          )}

          <CertificateTypeDetails
            cert={cert}
            isTravelRelated={isTravelRelated}
            isBreedingRelated={isBreedingRelated}
            isValuation={isValuation}
            isMovement={isMovement}
            isHerd={isHerd}
            t={t}
            formatDate={formatDate}
            speciesLabel={speciesLabel}
          />

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
              <div className="cert-section-header cert-section-header-danger">
                <span>🚫</span> Revocation Reason
              </div>
              <div className="cert-section-body cert-section-body-danger">{cert.revocationReason}</div>
            </div>
          )}

          <CertificateFooter cert={cert} tpl={tpl} vetName={vetName} t={t} formatDate={formatDate} />

        </div>{/* end cert-document */}
      </div>{/* end cert-modal */}
    </div>
  )
}

export default CertificatePrintView

import React, { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../../context/SettingsContext'
import './DispensingReceiptView.css'

export interface ReceiptLineItem {
  name: string
  quantity: number
  unit?: string
  unitPrice: number
  lineTotal: number
  batchNumber?: string
}

export interface DispensingReceiptData {
  dispensingId: string
  createdAt: string
  dispensingMethod: string
  pharmacyName?: string
  pharmacyAddress?: string
  pharmacyPhone?: string
  animalName?: string
  animalSpecies?: string
  ownerName?: string
  vetName?: string
  pharmacistName?: string
  lineItems: ReceiptLineItem[]
  totalCost: number
}

interface Props {
  receipt: DispensingReceiptData
  onClose: () => void
  secondaryAction?: { label: string; onClick: () => void }
}

function shortId(id: string): string {
  return id.replace(/-/g, '').substring(0, 8).toUpperCase()
}

const DispensingReceiptView: React.FC<Props> = ({ receipt, onClose, secondaryAction }) => {
  const { t } = useTranslation()
  const { formatCurrency, formatDate } = useSettings()
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', handler); document.body.style.overflow = '' }
  }, [onClose])

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose()
  }

  return (
    <div className="pr-overlay" ref={overlayRef} onClick={handleOverlayClick} id="pr-print-root">
      <div className="pr-modal" onClick={e => e.stopPropagation()}>
        <div className="pr-toolbar">
          <p className="pr-toolbar-title">🖨 {t('pharmacyReceipt.previewTitle')}</p>
          <div className="pr-toolbar-actions">
            {secondaryAction && (
              <button className="pr-btn-close" onClick={secondaryAction.onClick}>{secondaryAction.label}</button>
            )}
            <button className="pr-btn-print" onClick={() => window.print()}>🖨 {t('pharmacyReceipt.print')}</button>
            <button className="pr-btn-close" onClick={onClose}>✕ {t('common.close')}</button>
          </div>
        </div>

        <div className="pr-document">
          <div className="pr-header">
            <div className="pr-pharmacy-name">💊 {receipt.pharmacyName || t('pharmacyReceipt.pharmacy')}</div>
            {receipt.pharmacyAddress && <div className="pr-contact-line">📍 {receipt.pharmacyAddress}</div>}
            {receipt.pharmacyPhone && <div className="pr-contact-line">📞 {receipt.pharmacyPhone}</div>}
          </div>

          <hr className="pr-divider" />

          <div className="pr-info-row">
            <span>{t('pharmacyReceipt.receiptNo')}: <strong>PHARM-{shortId(receipt.dispensingId)}</strong></span>
            <span>{t('pharmacyReceipt.date')}: <strong>{formatDate(receipt.createdAt)}</strong></span>
          </div>
          <div className="pr-info-row">
            <span>{t('pharmacyReceipt.patient')}: <strong>{receipt.animalName || '—'}{receipt.animalSpecies ? ` (${receipt.animalSpecies})` : ''}</strong></span>
            <span>{t('pharmacyReceipt.owner')}: <strong>{receipt.ownerName || '—'}</strong></span>
          </div>
          {receipt.vetName && (
            <div className="pr-info-row">
              <span>{t('pharmacyReceipt.vet')}: <strong>Dr. {receipt.vetName}</strong></span>
              <span>{t('pharmacyReceipt.method')}: <strong>{t(`pharmacy.dispense.methods.${receipt.dispensingMethod}`, receipt.dispensingMethod)}</strong></span>
            </div>
          )}

          <table className="pr-table">
            <thead>
              <tr>
                <th>#</th>
                <th>{t('pharmacyReceipt.colMedication')}</th>
                <th>{t('pharmacyReceipt.colQty')}</th>
                <th>{t('pharmacyReceipt.colUnitPrice')}</th>
                <th>{t('pharmacyReceipt.colTotal')}</th>
              </tr>
            </thead>
            <tbody>
              {receipt.lineItems.map((li, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{li.name}{li.batchNumber ? <small className="pr-batch"> · Batch {li.batchNumber}</small> : null}</td>
                  <td>{li.quantity} {li.unit || ''}</td>
                  <td>{formatCurrency(li.unitPrice)}</td>
                  <td>{formatCurrency(li.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pr-total-row">
            <span>{t('pharmacyReceipt.total')}</span>
            <strong>{formatCurrency(receipt.totalCost)}</strong>
          </div>

          <div className="pr-footer">
            {receipt.pharmacistName && <p>{t('pharmacyReceipt.dispensedBy')}: {receipt.pharmacistName}</p>}
            <p className="pr-footer-small">{t('pharmacyReceipt.generated')}: {formatDate(new Date().toISOString())}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DispensingReceiptView

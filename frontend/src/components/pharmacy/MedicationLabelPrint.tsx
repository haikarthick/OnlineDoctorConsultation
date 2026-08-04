import React, { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import './MedicationLabelPrint.css'

export interface LabelItem {
  medicationName: string
  directions?: string
  quantity: number
  unit?: string
}

interface Props {
  pharmacyName?: string
  pharmacyPhone?: string
  animalName?: string
  animalSpecies?: string
  ownerName?: string
  rxRef: string
  items: LabelItem[]
  onClose: () => void
}

function shortId(id: string): string {
  return id.replace(/-/g, '').substring(0, 8).toUpperCase()
}

const MedicationLabelPrint: React.FC<Props> = ({ pharmacyName, pharmacyPhone, animalName, animalSpecies, ownerName, rxRef, items, onClose }) => {
  const { t } = useTranslation()
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
    <div className="ml-overlay" ref={overlayRef} onClick={handleOverlayClick} id="ml-print-root">
      <div className="ml-modal" onClick={e => e.stopPropagation()}>
        <div className="ml-toolbar">
          <p className="ml-toolbar-title">🏷 {t('medicationLabel.previewTitle')}</p>
          <div className="ml-toolbar-actions">
            <button className="ml-btn-print" onClick={() => window.print()}>🖨 {t('medicationLabel.printAll')}</button>
            <button className="ml-btn-close" onClick={onClose}>✕ {t('common.close')}</button>
          </div>
        </div>

        <div className="ml-labels">
          {items.map((item, i) => (
            <div className="ml-label" key={i}>
              <div className="ml-label-header">
                🐾 {(animalName || '-').toUpperCase()}{animalSpecies ? ` (${animalSpecies})` : ''}
              </div>
              <div className="ml-label-sub">{t('medicationLabel.owner')}: {ownerName || '-'}</div>
              <hr className="ml-label-divider" />
              <div className="ml-label-med">{item.medicationName.toUpperCase()}</div>
              {item.directions && <div className="ml-label-directions">{item.directions}</div>}
              <div className="ml-label-qty">{t('medicationLabel.quantity')}: {item.quantity} {item.unit || ''}</div>
              <hr className="ml-label-divider" />
              <div className="ml-label-footer">
                <span>Rx: {shortId(rxRef)}</span>
                <span>{pharmacyName || ''}{pharmacyPhone ? ` · ${pharmacyPhone}` : ''}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default MedicationLabelPrint

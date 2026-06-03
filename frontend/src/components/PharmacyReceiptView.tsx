import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../context/SettingsContext'

interface LineItem {
  med_id: string
  med_name?: string
  batch_number?: string
  quantity_dispensed: number
  unit: string
  unit_price: number
  line_total: number
}

interface DispensingRecord {
  id: string
  created_at: string
  dispensing_method: string
  dispensing_status: string
  total_cost: number
  received_by?: string
  pharmacist_name?: string
  notes?: string
}

interface Props {
  dispensingRecord: DispensingRecord
  lineItems: LineItem[]
  prescription: {
    id: string
    pet_name?: string
    animal_species?: string
    owner_name?: string
    vet_name?: string
    instructions?: string
  }
  pharmacy: {
    pharmacy_name: string
    address?: string
    phone?: string
    email?: string
    license_number?: string
  }
  networkName?: string
  onClose: () => void
}

export default function PharmacyReceiptView({ dispensingRecord, lineItems, prescription, pharmacy, networkName, onClose }: Props) {
  const { t } = useTranslation()
  const { formatCurrency, formatDate } = useSettings()

  useEffect(() => {
    // Small delay to allow render, then print
    const timer = setTimeout(() => window.print(), 400)
    return () => clearTimeout(timer)
  }, [])

  const METHOD_LABELS: Record<string, string> = {
    walk_in_pickup: 'Walk-in Pickup',
    home_delivery: 'Home Delivery',
    courier: 'Courier',
    hospital_pickup: 'Hospital Pickup',
  }

  const receiptNum = `REC-${dispensingRecord.id.slice(0, 8).toUpperCase()}`

  return (
    <>
      {/* Screen overlay */}
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 32, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ margin: 0, color: '#1a237e' }}>🧾 {t('pharmacy.receipt.preview')}</h3>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #3949ab', background: '#3949ab', color: '#fff', cursor: 'pointer', fontWeight: 600 }} onClick={() => window.print()}>
                🖨 {t('pharmacy.receipt.print')}
              </button>
              <button type="button" style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }} onClick={onClose}>
                {t('common.close')}
              </button>
            </div>
          </div>

          {/* Receipt preview */}
          <div id="pharmacy-receipt" style={{ fontFamily: 'monospace', fontSize: 12, border: '1px solid #eee', padding: 16, borderRadius: 8 }}>
            <ReceiptContent {...{ dispensingRecord, lineItems, prescription, pharmacy, networkName, receiptNum, formatCurrency, formatDate, METHOD_LABELS }} />
          </div>
        </div>
      </div>

      {/* Print-only styles */}
      <style>{`
        @media print {
          body > *:not(#pharmacy-receipt-print) { display: none !important; }
          #pharmacy-receipt-print { display: block !important; font-family: monospace; font-size: 11px; padding: 10mm; }
          @page { size: A5; margin: 8mm; }
        }
      `}</style>

      {/* Hidden print target */}
      <div id="pharmacy-receipt-print" style={{ display: 'none' }}>
        <ReceiptContent {...{ dispensingRecord, lineItems, prescription, pharmacy, networkName, receiptNum, formatCurrency, formatDate, METHOD_LABELS }} />
      </div>
    </>
  )
}

function ReceiptContent({ dispensingRecord, lineItems, prescription, pharmacy, networkName, receiptNum, formatCurrency, formatDate, METHOD_LABELS }: any) {
  return (
    <div>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 800, fontSize: 14 }}>{pharmacy.pharmacy_name}</div>
        {networkName && <div style={{ fontSize: 11, color: '#666' }}>{networkName}</div>}
        {pharmacy.address && <div style={{ fontSize: 10, color: '#888' }}>{pharmacy.address}</div>}
        {pharmacy.phone && <div style={{ fontSize: 10, color: '#888' }}>📞 {pharmacy.phone}</div>}
        {pharmacy.license_number && <div style={{ fontSize: 10, color: '#888' }}>Lic: {pharmacy.license_number}</div>}
      </div>
      <div style={{ borderTop: '1px solid #333', marginBottom: 8 }} />

      {/* Receipt number + date */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 8 }}>
        <span>Receipt: <strong>{receiptNum}</strong></span>
        <span>{formatDate(dispensingRecord.created_at)}</span>
      </div>
      <div style={{ borderTop: '1px dashed #999', marginBottom: 8 }} />

      {/* Patient info */}
      <div style={{ marginBottom: 8, fontSize: 11 }}>
        <div>🐾 <strong>{prescription.pet_name || '—'}</strong>{prescription.animal_species ? ` (${prescription.animal_species})` : ''}</div>
        <div>👤 Owner: {prescription.owner_name || '—'}</div>
        {prescription.vet_name && <div>👨‍⚕️ Vet: {prescription.vet_name}</div>}
      </div>
      <div style={{ borderTop: '1px dashed #999', marginBottom: 8 }} />

      {/* Line items */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Medication</th>
            <th style={{ textAlign: 'center' }}>Qty</th>
            <th style={{ textAlign: 'right' }}>Price</th>
            <th style={{ textAlign: 'right' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((item: any, i: number) => (
            <tr key={i}>
              <td style={{ paddingRight: 8 }}>
                {item.med_name || `Med ${i + 1}`}
                {item.batch_number && <div style={{ fontSize: 9, color: '#888' }}>Batch: {item.batch_number}</div>}
              </td>
              <td style={{ textAlign: 'center' }}>{item.quantity_dispensed} {item.unit}</td>
              <td style={{ textAlign: 'right' }}>{formatCurrency(item.unit_price)}</td>
              <td style={{ textAlign: 'right' }}>{formatCurrency(item.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ borderTop: '1px solid #333', marginTop: 6, marginBottom: 6 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 12 }}>
        <span>TOTAL</span>
        <span>{formatCurrency(dispensingRecord.total_cost)}</span>
      </div>
      <div style={{ borderTop: '1px dashed #999', marginTop: 8, marginBottom: 8 }} />

      {/* Method + instructions */}
      <div style={{ fontSize: 10, color: '#555' }}>
        <div>Method: {METHOD_LABELS[dispensingRecord.dispensing_method] || dispensingRecord.dispensing_method}</div>
        {dispensingRecord.received_by && <div>Received by: {dispensingRecord.received_by}</div>}
        {dispensingRecord.pharmacist_name && <div>Dispensed by: {dispensingRecord.pharmacist_name}</div>}
        {prescription.instructions && (
          <div style={{ marginTop: 6, fontStyle: 'italic' }}>Instructions: {prescription.instructions}</div>
        )}
        {dispensingRecord.notes && <div>Notes: {dispensingRecord.notes}</div>}
      </div>
      <div style={{ textAlign: 'center', marginTop: 12, fontSize: 9, color: '#999' }}>
        Thank you for choosing {pharmacy.pharmacy_name}
        <br />Keep medications out of reach of children
      </div>
    </div>
  )
}

import React from 'react'
import { useTranslation } from 'react-i18next'

interface PrescribePanelProps {
  conId: string
  onNavigate: (path: string) => void
}

const COMMON_PRESCRIPTIONS = [
  { label: 'Antibiotics Course (7 days)', name: 'Amoxicillin', dosage: '250mg', frequency: 'Twice daily', duration: '7 days', instructions: 'Give with food' },
  { label: 'Pain Relief (5 days)', name: 'Meloxicam', dosage: '0.1mg/kg', frequency: 'Once daily', duration: '5 days', instructions: 'Give with food, monitor appetite' },
  { label: 'Anti-inflammatory (10 days)', name: 'Carprofen', dosage: '2mg/kg', frequency: 'Twice daily', duration: '10 days', instructions: 'Give with food, plenty of water' },
  { label: 'Vitamins & Supplements', name: 'Pet Multivitamin', dosage: '1 tablet', frequency: 'Once daily', duration: '30 days', instructions: 'Mix with food' },
]

const PrescribePanel: React.FC<PrescribePanelProps> = ({ conId, onNavigate }) => {
  const { t } = useTranslation()

  return (
    <div className="si-c710217c">
      <p className="si-09dee8a9">
        {t('consultationRoom.quickPrescribeAccess')}
      </p>
      <button className="btn btn-primary"
        onClick={() => onNavigate(`/doctor/prescriptions/new?consultationId=${conId}`)}>
        💊 {t('consultationRoom.openPrescriptionWriter')}
      </button>
      <div className="si-66faea9d">
        <h4>{t('consultationRoom.commonPrescriptions')}</h4>
        {COMMON_PRESCRIPTIONS.map(tpl => (
          <div key={tpl.label} className="si-394b4e9f cr-rx-template-item"
            onClick={() => {
              const med = encodeURIComponent(JSON.stringify([{
                name: tpl.name, dosage: tpl.dosage, frequency: tpl.frequency,
                duration: tpl.duration, instructions: tpl.instructions
              }]))
              onNavigate(`/doctor/prescriptions/new?consultationId=${conId}&meds=${med}`)
            }}
          >
            <span>{tpl.label}</span>
            <span className="si-0134f7a1">+</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default PrescribePanel

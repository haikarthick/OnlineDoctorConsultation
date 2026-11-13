import type { TFunction } from 'i18next'
import type { VaccinationEntry } from './certificatePrintShared'

interface Props {
  details?: { vaccines?: VaccinationEntry[]; [k: string]: any }
  t: TFunction
}

export default function CertificateVaccineTable({ details, t }: Props) {
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
                <td>{v.vaccine || '-'}</td>
                <td>{v.batchNo || '-'}</td>
                <td>{v.dateAdministered || '-'}</td>
                <td>{v.nextDue || '-'}</td>
                <td>{v.manufacturer || '-'}</td>
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

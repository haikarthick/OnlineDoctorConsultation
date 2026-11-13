import type { ComplianceSummaryRow } from './vaccinationPassportShared'
import { ComplianceMeter } from './VaccinationPassportHelpers'

interface ComplianceSummaryTabProps {
  summaryLoading: boolean
  complianceSummary: ComplianceSummaryRow[]
  speciesIcon: (species: string) => string
  speciesLabel: (species: string, t: any) => string
  t: (k: string, opts?: any) => string
}

export function ComplianceSummaryTab({
  summaryLoading,
  complianceSummary,
  speciesIcon,
  speciesLabel,
  t,
}: ComplianceSummaryTabProps) {
  return (
    <div>
      {summaryLoading ? (
        <div className="vp-loading">{t('vaccinationPassport.loading')}</div>
      ) : complianceSummary.length === 0 ? (
        <div className="vp-empty">{t('vaccinationPassport.noData')}</div>
      ) : (
        <div className="data-table-container">
          <table className="module-table">
            <thead>
              <tr>
                <th>{t('vaccinationPassport.animal')}</th>
                <th>{t('vaccinationPassport.species')}</th>
                <th>{t('vaccinationPassport.owner')}</th>
                <th>{t('vaccinationPassport.protocols')}</th>
                <th>{t('vaccinationPassport.compliance')}</th>
                <th>{t('vaccinationPassport.overdue')}</th>
                <th>{t('vaccinationPassport.dueSoon')}</th>
              </tr>
            </thead>
            <tbody>
              {complianceSummary.map((row) => (
                <tr key={row.animalId}>
                  <td>
                    <span className="vp-table-icon">{speciesIcon(row.species)}</span>
                    {row.animalName}
                  </td>
                  <td>{speciesLabel(row.species, t)}</td>
                  <td>{row.ownerName || '-'}</td>
                  <td>{row.totalProtocols}</td>
                  <td>
                    {row.totalProtocols === 0 ? (
                      <span className="vp-compliance-na">{t('vaccinationPassport.complianceNA')}</span>
                    ) : (
                      <ComplianceMeter percent={row.compliancePercent} />
                    )}
                  </td>
                  <td>
                    {row.overdueDoses > 0 ? (
                      <span className="module-badge badge-error">{row.overdueDoses}</span>
                    ) : (
                      <span className="module-badge badge-success">0</span>
                    )}
                  </td>
                  <td>
                    {row.dueSoon > 0 ? (
                      <span className="module-badge badge-pending">{row.dueSoon}</span>
                    ) : (
                      <span className="module-badge badge-success">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

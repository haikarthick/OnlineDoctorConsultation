import type { GroupPassportData } from './vaccinationPassportShared'
import { ComplianceMeter } from './VaccinationPassportHelpers'

interface GroupPassportTabProps {
  isAdmin: boolean
  isVet: boolean
  isFarmer: boolean
  groupEnterprises: { id: string; name: string }[]
  groupEnterpriseId: string
  onGroupEnterpriseChange: (id: string) => void
  groupOptions: { id: string; name: string; species?: string; groupType?: string; animalCount?: number }[]
  groupSelectedId: string
  onGroupSelectedChange: (id: string) => void
  groupError: string
  groupLoading: boolean
  groupPassport: GroupPassportData | null
  speciesLabel: (species: string, t: any) => string
  formatDate: (d: string) => string
  t: (k: string, opts?: any) => string
}

export function GroupPassportTab({
  isAdmin,
  isVet,
  isFarmer,
  groupEnterprises,
  groupEnterpriseId,
  onGroupEnterpriseChange,
  groupOptions,
  groupSelectedId,
  onGroupSelectedChange,
  groupError,
  groupLoading,
  groupPassport,
  speciesLabel,
  formatDate,
  t,
}: GroupPassportTabProps) {
  return (
    <div className="vp-group-tab">
      {(isAdmin || isVet || isFarmer) && (
        <>
          <div className="vp-group-filters-grid">
            <div className="module-form-group">
              <label className="module-label">{t('vaccinationPassport.enterprise')}</label>
              <select className="module-input" value={groupEnterpriseId} onChange={e => onGroupEnterpriseChange(e.target.value)}>
                <option value="">- {t('vaccinationPassport.select')} -</option>
                {groupEnterprises.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
            <div className="module-form-group">
              <label className="module-label">{t('vaccinationPassport.group')}</label>
              <select className="module-input" value={groupSelectedId} onChange={e => onGroupSelectedChange(e.target.value)} disabled={!groupEnterpriseId}>
                <option value="">- {t('vaccinationPassport.select')} -</option>
                {groupOptions.map(g => (
                  <option key={g.id} value={g.id}>{g.name}{g.species ? ` (${speciesLabel(g.species, t)})` : ''}{g.animalCount != null ? ` · ${g.animalCount}` : ''}</option>
                ))}
              </select>
            </div>
          </div>
          {groupError && <div className="module-alert error">{groupError}</div>}
          {groupLoading ? (
            <div className="vp-loading">{t('vaccinationPassport.loading')}</div>
          ) : groupPassport ? (
            <div>
              {groupPassport.group && (
                <div className="module-stats">
                  <div className="stat-card">
                    <div className="stat-icon">🐄</div>
                    <div className="stat-value">{groupPassport.group.name}</div>
                    <div className="stat-label">{t('vaccinationPassport.groupName')}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">📊</div>
                    <div className="stat-value">{groupPassport.totalApplications ?? 0}</div>
                    <div className="stat-label">{t('vaccinationPassport.groupApplications')}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">🔢</div>
                    <div className="stat-value">{groupPassport.group.currentCount ?? 0}</div>
                    <div className="stat-label">{t('vaccinationPassport.groupPopulation')}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">😷</div>
                    <div className="stat-value">{groupPassport.vaccines?.length ?? 0}</div>
                    <div className="stat-label">{t('vaccinationPassport.groupVaccines')}</div>
                  </div>
                </div>
              )}
              {(!groupPassport.vaccines || groupPassport.vaccines.length === 0) ? (
                <div className="vp-empty">{t('vaccinationPassport.noGroupVaccines')}</div>
              ) : (
                <div className="data-table-container">
                  <table className="module-table">
                    <thead>
                      <tr>
                        <th>{t('vaccinationPassport.groupVaccine')}</th>
                        <th>{t('vaccinationPassport.groupType')}</th>
                        <th>{t('vaccinationPassport.groupApps')}</th>
                        <th>{t('vaccinationPassport.groupHeadTreated')}</th>
                        <th>{t('vaccinationPassport.groupCoverage')}</th>
                        <th>{t('vaccinationPassport.groupLast')}</th>
                        <th>{t('vaccinationPassport.groupNext')}</th>
                        <th>{t('vaccinationPassport.groupSource')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupPassport.vaccines.map((v, i) => (
                        <tr key={i}>
                          <td><strong>{v.vaccineName}</strong></td>
                          <td>{v.vaccineType || '-'}</td>
                          <td>{v.applications}</td>
                          <td>{v.headCountTreated}</td>
                          <td>
                            {v.coveragePercent == null ? (
                              <span className="vp-compliance-na">{t('vaccinationPassport.complianceNA')}</span>
                            ) : (
                              <ComplianceMeter percent={v.coveragePercent} />
                            )}
                          </td>
                          <td>{v.lastAdministeredAt ? formatDate(v.lastAdministeredAt) : '-'}</td>
                          <td>{v.nextDueDate ? formatDate(v.nextDueDate) : '-'}</td>
                          <td>{v.fromCampaign ? t('vaccinationPassport.groupSourceCampaign') : t('vaccinationPassport.groupSourceManual')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="vp-empty">{t('vaccinationPassport.groupSelectHint')}</div>
          )}
        </>
      )}
      {!(isAdmin || isVet || isFarmer) && (
        <div className="vp-empty">{t('vaccinationPassport.groupRoleHint')}</div>
      )}
    </div>
  )
}

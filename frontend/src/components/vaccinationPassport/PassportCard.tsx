import type { PassportAnimal } from './vaccinationPassportShared'
import { StatusBadge, ComplianceMeter } from './VaccinationPassportHelpers'

interface PassportCardProps {
  animal: PassportAnimal
  isExpanded: boolean
  onToggleExpand: () => void
  expandedProtocolKey: string | null
  onToggleProtocol: (key: string) => void
  copiedId: string | null
  onCopyId: (id: string) => void
  downloadingAnimal: string | null
  onPrintPassport: (animal: PassportAnimal) => void
  isAdmin: boolean
  isVet: boolean
  speciesIcon: (species: string) => string
  speciesLabel: (species: string, t: any) => string
  formatDate: (d: string) => string
  t: (k: string, opts?: any) => string
}

export function PassportCard({
  animal,
  isExpanded,
  onToggleExpand,
  expandedProtocolKey,
  onToggleProtocol,
  copiedId,
  onCopyId,
  downloadingAnimal,
  onPrintPassport,
  isAdmin,
  isVet,
  speciesIcon,
  speciesLabel,
  formatDate,
  t,
}: PassportCardProps) {
  const icon = speciesIcon(animal.species)
  return (
    <div className="vp-passport-card">
      {/* Card header */}
      <div className="vp-card-header" onClick={onToggleExpand}>
        <div className="vp-card-identity">
          <span className="vp-species-icon">{icon}</span>
          <div>
            <div className="vp-animal-name">{animal.animalName}</div>
            {animal.animalUniqueId && (
              <div
                className="vc-id-badge si-4af0b366"
                title={`waytovet ID - click to copy`}
                onClick={(e) => {
                  e.stopPropagation()
                  onCopyId(animal.animalUniqueId!)
                }}
              >
                {copiedId === animal.animalUniqueId ? `✅ ${t('common.copied')}` : `🏷️ ${animal.animalUniqueId}`}
              </div>
            )}
            <div className="vp-animal-meta">
              {speciesLabel(animal.species, t)}
              {animal.breed ? ` · ${animal.breed}` : ''}
              {animal.gender ? ` · ${animal.gender}` : ''}
              {animal.dateOfBirth
                ? ` · ${t('vaccinationPassport.dob')}: ${formatDate(animal.dateOfBirth)}`
                : ''}
              {(isAdmin || isVet) && animal.ownerName
                ? ` · ${t('vaccinationPassport.owner')}: ${animal.ownerName}`
                : ''}
            </div>
          </div>
        </div>
        <div className="vp-card-actions">
          {animal.protocols.length === 0 ? (
            <span className="vp-compliance-na">{t('vaccinationPassport.complianceNA')}</span>
          ) : (
            <ComplianceMeter percent={animal.overallCompliancePercent} />
          )}
          {animal.protocols.length === 0 ? (
            <div className="vp-no-protocols-action">
              {(isAdmin || isVet) ? (
                <span className="vp-no-protocols-note">{t('vaccinationPassport.assignProtocolsFirst')}</span>
              ) : (
                <span className="vp-no-protocols-note">{t('vaccinationPassport.contactVetForProtocols')}</span>
              )}
            </div>
          ) : (
            <button
              className="module-btn primary small"
              onClick={(e) => { e.stopPropagation(); onPrintPassport(animal) }}
              disabled={downloadingAnimal === animal.animalId}
            >
              {downloadingAnimal === animal.animalId
                ? t('vaccinationPassport.downloading')
                : t('vaccinationPassport.downloadPassport')}
            </button>
          )}
          <span className={`vp-expand-icon ${isExpanded ? 'expanded' : ''}`}>▼</span>
        </div>
      </div>

      {/* Expanded protocol list */}
      {isExpanded && (
        <div className="vp-protocol-list">
          {animal.protocols.length === 0 ? (
            <div className="vp-empty-protocols">{t('vaccinationPassport.noProtocols')}</div>
          ) : (
            animal.protocols.map((proto) => {
              const protKey = `${animal.animalId}-${proto.protocolId}`
              const protExpanded = expandedProtocolKey === protKey
              return (
                <div key={proto.protocolId} className={`vp-protocol-row ${proto.waived ? 'vp-waived' : ''}`}>
                  <div
                    className="vp-protocol-summary"
                    onClick={() => onToggleProtocol(protKey)}
                  >
                    <div className="vp-proto-name">
                      <span className="vp-proto-title">{proto.protocolName}</span>
                      {proto.isZoonotic && (
                        <span className="vp-zoonotic-chip">{t('vaccinationPassport.zoonotic')}</span>
                      )}
                      <span className={`module-badge badge-${proto.category === 'Mandatory' ? 'error' : proto.category === 'Core' ? 'success' : 'pending'}`}>
                        {proto.category}
                      </span>
                      {proto.waived && (
                        <span className="module-badge badge-pending">{t('vaccinationPassport.waived')}</span>
                      )}
                    </div>
                    <div className="vp-proto-stats">
                      <span>{t('vaccinationPassport.disease')}: <strong>{proto.disease}</strong></span>
                      <span>{t('vaccinationPassport.lastDose')}: <strong>{proto.lastAdministeredAt ? formatDate(proto.lastAdministeredAt) : '-'}</strong></span>
                      <span>{t('vaccinationPassport.nextDue')}: <strong>{proto.nextDueDate ? formatDate(proto.nextDueDate) : '-'}</strong></span>
                      {proto.overdueCount > 0 && (
                        <span className="vp-overdue-warning">⚠ {proto.overdueCount} {t('vaccinationPassport.overdueDoses')}</span>
                      )}
                    </div>
                    <div className="vp-proto-compliance">
                      <ComplianceMeter percent={proto.compliancePercent} />
                      <span className="vp-expand-icon-sm">{protExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {/* Dose history */}
                  {protExpanded && (
                    <div className="vp-dose-table-wrap">
                      <table className="module-table vp-dose-table">
                        <thead>
                          <tr>
                            <th>{t('vaccinationPassport.dose')}</th>
                            <th>{t('vaccinationPassport.dueDate')}</th>
                            <th>{t('vaccinationPassport.administeredDate')}</th>
                            <th>{t('vaccinationPassport.doseStatus')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {proto.doses.map((dose) => (
                            <tr key={dose.scheduleId}>
                              <td>#{dose.doseNumber}</td>
                              <td>{formatDate(dose.dueDate)}</td>
                              <td>{dose.administeredAt ? formatDate(dose.administeredAt) : '-'}</td>
                              <td><StatusBadge status={dose.status} t={t} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

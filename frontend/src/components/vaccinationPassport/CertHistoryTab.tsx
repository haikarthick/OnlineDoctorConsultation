import type { PassportAnimal, CertificateLog } from './vaccinationPassportShared'

interface CertHistoryTabProps {
  selectedAnimalForHistory: string
  onSelectAnimal: (animalId: string) => void
  passports: PassportAnimal[]
  isAdmin: boolean
  isVet: boolean
  speciesIcon: (species: string) => string
  speciesLabel: (species: string, t: any) => string
  certLoading: boolean
  certLogs: CertificateLog[]
  formatDate: (d: string) => string
  t: (k: string, opts?: any) => string
}

export function CertHistoryTab({
  selectedAnimalForHistory,
  onSelectAnimal,
  passports,
  isAdmin,
  isVet,
  speciesIcon,
  speciesLabel,
  certLoading,
  certLogs,
  formatDate,
  t,
}: CertHistoryTabProps) {
  return (
    <div className="vp-cert-history">
      <div className="vp-cert-filter">
        <select
          className="module-input"
          value={selectedAnimalForHistory}
          onChange={(e) => onSelectAnimal(e.target.value)}
        >
          <option value="">{t('vaccinationPassport.selectAnimal')}</option>
          {passports.map((a) => (
            <option key={a.animalId} value={a.animalId}>
              {speciesIcon(a.species)} {a.animalName} ({speciesLabel(a.species, t)}){(isAdmin || isVet) && a.ownerName ? ` - ${a.ownerName}` : ''}
            </option>
          ))}
        </select>
      </div>
      {certLoading ? (
        <div className="vp-loading">{t('vaccinationPassport.loading')}</div>
      ) : certLogs.length === 0 ? (
        <div className="vp-empty">{t('vaccinationPassport.noCertLogs')}</div>
      ) : (
        <div className="vp-cert-timeline">
          {certLogs.map((log) => (
            <div key={log.id} className="vp-cert-entry">
              <div className="vp-cert-dot" />
              <div className="vp-cert-info">
                <div className="vp-cert-title">
                  <span className="vp-cert-type">{log.certificateType}</span>
                  {log.fileName && <span className="vp-cert-filename">{log.fileName}</span>}
                </div>
                <div className="vp-cert-meta">
                  {t('vaccinationPassport.generatedBy')}: <strong>{log.generatedByName || '-'}</strong>
                  &nbsp;·&nbsp;
                  {log.generatedAt ? formatDate(log.generatedAt) : '-'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

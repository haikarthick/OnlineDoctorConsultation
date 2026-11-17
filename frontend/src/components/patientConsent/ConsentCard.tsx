import React from 'react'
import type { PatientConsent, ScopeType } from './patientConsentShared'

interface ConsentCardProps {
  consent: PatientConsent
  scopeLabel: (s: ScopeType) => string
  scopeIcon: (s: ScopeType) => string
  grantedToDisplay: (c: PatientConsent) => string
  permissionItems: (c: PatientConsent) => Array<{ key: string; label: string; enabled: boolean }>
  formatDate: (d: string) => string
  t: (key: string) => string
  onRevoke: (id: string) => void
  revoking: string | null
}

const ConsentCard: React.FC<ConsentCardProps> = ({
  consent, scopeLabel, scopeIcon, grantedToDisplay, permissionItems,
  formatDate, t, onRevoke, revoking,
}) => {
  const perms = permissionItems(consent)

  return (
    <div className="pc-consent-card" data-scope={consent.consentScope}>
      <div className="pc-consent-card-header">
        <div className="si-28e38327">
          <span className={'pc-scope-badge pc-scope-badge-' + consent.consentScope}>
            {scopeIcon(consent.consentScope)} {scopeLabel(consent.consentScope)}
          </span>
          <span className={'pc-status-badge ' + (consent.isActive ? 'active' : 'revoked')}>
            {consent.isActive ? '● ' + t('patientConsent.status.active') : '○ ' + t('patientConsent.status.revoked')}
          </span>
        </div>
        <span className="si-3a6a64e1">
          {formatDate(consent.createdAt)}
        </span>
      </div>

      <div className="pc-consent-card-body">
        <div className="pc-info-row">
          <span className="pc-info-label">{t('patientConsent.grantedTo')}</span>
          <span>{grantedToDisplay(consent)}</span>
        </div>

        <div className="pc-info-row">
          <span className="pc-info-label">{t('patientConsent.validFrom')}</span>
          <span>
            {formatDate(consent.validFrom)}
            {' → '}
            {consent.validUntil
              ? formatDate(consent.validUntil)
              : <em className="si-7d7d4e5e">{t('patientConsent.noExpiry')}</em>
            }
          </span>
        </div>

        {!consent.isActive && consent.revokedAt && (
          <div className="pc-revoked-info">
            🚫 Revoked on {formatDate(consent.revokedAt)}
            {consent.revokedReason && ' - ' + consent.revokedReason}
          </div>
        )}

        <div className="pc-permissions-grid">
          {perms.map(p => (
            <div key={p.key} className={'pc-permission-item ' + (p.enabled ? 'enabled' : 'disabled')}>
              <span className="pc-permission-icon">{p.enabled ? '✅' : '⬜'}</span>
              {p.label}
            </div>
          ))}
        </div>

        <div className="si-0f7a7cdd">
          <span className={consent.allowView        ? '' : 'pc-permission-item disabled'}>
            {consent.allowView        ? '✅' : '⬜'} {t('patientConsent.permissions.allowView')}
          </span>
          <span className={consent.allowCreateNotes ? '' : 'pc-permission-item disabled'}>
            {consent.allowCreateNotes ? '✅' : '⬜'} {t('patientConsent.permissions.allowNotes')}
          </span>
          <span className={consent.allowPrescribe   ? '' : 'pc-permission-item disabled'}>
            {consent.allowPrescribe   ? '✅' : '⬜'} {t('patientConsent.permissions.allowPrescribe')}
          </span>
        </div>
      </div>

      <div className="pc-consent-card-footer">
        <span className="si-3a6a64e1">
          ID: {consent.id.slice(0, 8)}…
        </span>
        {consent.isActive && (
          <button
            className="pc-revoke-btn"
            onClick={() => onRevoke(consent.id)}
            disabled={revoking === consent.id}
          >
            {revoking === consent.id ? t('patientConsent.actions.revoking') : t('patientConsent.actions.revoke')}
          </button>
        )}
      </div>
    </div>
  )
}

export default ConsentCard

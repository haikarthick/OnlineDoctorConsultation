import React from 'react';
import { useTranslation } from 'react-i18next';
import './NetworkRoleMatrix.css';

type AccessLevel = 'full' | 'view' | 'none' | 'platform_only';

interface MatrixRow {
  featureKey: string;
  corporate_admin: AccessLevel;
  hospital_director: AccessLevel;
  compliance_officer: AccessLevel;
  auditor: AccessLevel;
  hospital_staff: AccessLevel;
}

interface MatrixCategory {
  categoryKey: string;
  rows: MatrixRow[];
}

const MATRIX_DATA: MatrixCategory[] = [
  {
    categoryKey: 'networkManagement',
    rows: [
      { featureKey: 'viewNetworkDetails', corporate_admin: 'full', hospital_director: 'full', compliance_officer: 'full', auditor: 'full', hospital_staff: 'full' },
      { featureKey: 'editNetworkSettings', corporate_admin: 'full', hospital_director: 'none', compliance_officer: 'none', auditor: 'none', hospital_staff: 'none' },
      { featureKey: 'deactivateNetwork', corporate_admin: 'platform_only', hospital_director: 'none', compliance_officer: 'none', auditor: 'none', hospital_staff: 'none' },
    ],
  },
  {
    categoryKey: 'branchHospitals',
    rows: [
      { featureKey: 'viewBranchHospitals', corporate_admin: 'full', hospital_director: 'full', compliance_officer: 'full', auditor: 'full', hospital_staff: 'view' },
      { featureKey: 'addHospitalToNetwork', corporate_admin: 'full', hospital_director: 'none', compliance_officer: 'none', auditor: 'none', hospital_staff: 'none' },
    ],
  },
  {
    categoryKey: 'memberManagement',
    rows: [
      { featureKey: 'viewNetworkMembers', corporate_admin: 'full', hospital_director: 'full', compliance_officer: 'full', auditor: 'full', hospital_staff: 'view' },
      { featureKey: 'addRemoveMembers', corporate_admin: 'full', hospital_director: 'full', compliance_officer: 'none', auditor: 'none', hospital_staff: 'none' },
      { featureKey: 'editMemberRoles', corporate_admin: 'full', hospital_director: 'full', compliance_officer: 'none', auditor: 'none', hospital_staff: 'none' },
    ],
  },
  {
    categoryKey: 'complianceAudit',
    rows: [
      { featureKey: 'viewAuditLogs', corporate_admin: 'full', hospital_director: 'full', compliance_officer: 'full', auditor: 'full', hospital_staff: 'none' },
      { featureKey: 'patientConsentManagement', corporate_admin: 'full', hospital_director: 'full', compliance_officer: 'full', auditor: 'view', hospital_staff: 'none' },
    ],
  },
  {
    categoryKey: 'hospitalOperations',
    rows: [
      { featureKey: 'hospitalWorkflowQueue', corporate_admin: 'full', hospital_director: 'full', compliance_officer: 'none', auditor: 'none', hospital_staff: 'full' },
      { featureKey: 'walkInRegistration', corporate_admin: 'full', hospital_director: 'full', compliance_officer: 'none', auditor: 'none', hospital_staff: 'full' },
      { featureKey: 'inpatientManagement', corporate_admin: 'full', hospital_director: 'full', compliance_officer: 'none', auditor: 'none', hospital_staff: 'full' },
    ],
  },
  {
    categoryKey: 'analyticsReporting',
    rows: [
      { featureKey: 'networkDashboardStats', corporate_admin: 'full', hospital_director: 'full', compliance_officer: 'full', auditor: 'view', hospital_staff: 'none' },
      { featureKey: 'healthAnalytics', corporate_admin: 'full', hospital_director: 'full', compliance_officer: 'view', auditor: 'view', hospital_staff: 'none' },
      { featureKey: 'financialAnalytics', corporate_admin: 'full', hospital_director: 'view', compliance_officer: 'view', auditor: 'view', hospital_staff: 'none' },
      { featureKey: 'interHospitalReferrals', corporate_admin: 'full', hospital_director: 'full', compliance_officer: 'view', auditor: 'view', hospital_staff: 'view' },
    ],
  },
];

const NETWORK_ROLES = ['corporate_admin', 'hospital_director', 'compliance_officer', 'auditor', 'hospital_staff'] as const;

const ACCESS_CONFIG: Record<AccessLevel, { icon: string; label: string; className: string }> = {
  full: { icon: '✅', label: 'Full Access', className: 'nrm-cell-full' },
  view: { icon: '👁️', label: 'View Only', className: 'nrm-cell-view' },
  none: { icon: '❌', label: 'No Access', className: 'nrm-cell-none' },
  platform_only: { icon: '🔐', label: 'Platform Admin Only', className: 'nrm-cell-platform' },
};

const ROLE_DESCRIPTIONS: Record<string, { icon: string; descKey: string }> = {
  corporate_admin: { icon: '🏢', descKey: 'corporateAdminDesc' },
  hospital_director: { icon: '🏥', descKey: 'hospitalDirectorDesc' },
  compliance_officer: { icon: '📋', descKey: 'complianceOfficerDesc' },
  auditor: { icon: '🔍', descKey: 'auditorDesc' },
  hospital_staff: { icon: '👩‍⚕️', descKey: 'hospitalStaffDesc' },
};

const NetworkRoleMatrix: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="nrm-container">
      <div className="nrm-header">
        <h2 className="nrm-title">🔑 {t('networkRoleMatrix.title')}</h2>
        <p className="nrm-subtitle">{t('networkRoleMatrix.subtitle')}</p>
      </div>

      {/* Role description cards */}
      <div className="nrm-role-cards">
        {NETWORK_ROLES.map(role => (
          <div key={role} className="nrm-role-card">
            <div className="nrm-role-icon">{ROLE_DESCRIPTIONS[role].icon}</div>
            <div className="nrm-role-name">{t(`networkRoleMatrix.roles.${role}`)}</div>
            <div className="nrm-role-desc">{t(`networkRoleMatrix.roleDescriptions.${ROLE_DESCRIPTIONS[role].descKey}`)}</div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="nrm-legend">
        {(Object.entries(ACCESS_CONFIG) as [AccessLevel, typeof ACCESS_CONFIG[AccessLevel]][]).map(([level, cfg]) => (
          <span key={level} className={`nrm-legend-item ${cfg.className}`}>
            {cfg.icon} {cfg.label}
          </span>
        ))}
      </div>

      {/* Matrix table */}
      <div className="nrm-table-wrapper">
        <table className="nrm-table">
          <thead>
            <tr>
              <th className="nrm-th-feature">{t('networkRoleMatrix.feature')}</th>
              {NETWORK_ROLES.map(role => (
                <th key={role} className="nrm-th-role">
                  <div className="nrm-th-role-icon">{ROLE_DESCRIPTIONS[role].icon}</div>
                  <div>{t(`networkRoleMatrix.roles.${role}`)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MATRIX_DATA.map(category => (
              <React.Fragment key={category.categoryKey}>
                <tr className="nrm-category-row">
                  <td colSpan={6} className="nrm-category-label">
                    {t(`networkRoleMatrix.categories.${category.categoryKey}`)}
                  </td>
                </tr>
                {category.rows.map(row => (
                  <tr key={row.featureKey} className="nrm-data-row">
                    <td className="nrm-feature-name">
                      {t(`networkRoleMatrix.features.${row.featureKey}`)}
                    </td>
                    {NETWORK_ROLES.map(role => {
                      const level = row[role];
                      const cfg = ACCESS_CONFIG[level];
                      return (
                        <td key={role} className={`nrm-cell ${cfg.className}`} title={cfg.label}>
                          {cfg.icon}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <p className="nrm-note">
        🔐 {t('networkRoleMatrix.platformNote')}
      </p>
    </div>
  );
};

export default NetworkRoleMatrix;

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import apiService from '../../services/api';
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

interface NetworkRoleMatrixProps {
  adminMode?: boolean;
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

/** Actions that cannot be toggled (controlled by platform admin only) */
const PLATFORM_ONLY_ACTIONS = ['deactivateNetwork'];

const NetworkRoleMatrix: React.FC<NetworkRoleMatrixProps> = ({ adminMode = false }) => {
  const { t } = useTranslation();

  // Admin-mode state
  const [dbMatrix, setDbMatrix] = useState<Record<string, Record<string, boolean>>>({});
  const [loadingMatrix, setLoadingMatrix] = useState(false);
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [resettingRole, setResettingRole] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadMatrix = useCallback(async () => {
    if (!adminMode) return;
    try {
      setLoadingMatrix(true);
      setError('');
      const res = await apiService.adminGetNetworkRolePermissions();
      setDbMatrix(res.data?.matrix || {});
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to load network permissions');
    } finally {
      setLoadingMatrix(false);
    }
  }, [adminMode]);

  useEffect(() => { loadMatrix(); }, [loadMatrix]);

  const handleToggle = async (networkRole: string, featureKey: string) => {
    if (!adminMode || PLATFORM_ONLY_ACTIONS.includes(featureKey)) return;
    const current = dbMatrix[networkRole]?.[featureKey] ?? false;
    const newValue = !current;
    const cellKey = `${networkRole}.${featureKey}`;

    setDbMatrix(prev => ({
      ...prev,
      [networkRole]: { ...prev[networkRole], [featureKey]: newValue },
    }));

    try {
      setSavingCell(cellKey);
      setError('');
      await apiService.adminUpdateNetworkRolePermission(networkRole, featureKey, newValue);
      setSuccess(`Saved: ${featureKey} for ${networkRole}`);
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to save permission');
      setDbMatrix(prev => ({
        ...prev,
        [networkRole]: { ...prev[networkRole], [featureKey]: current },
      }));
    } finally {
      setSavingCell(null);
    }
  };

  const handleResetRole = async (networkRole: string) => {
    if (!adminMode) return;
    try {
      setResettingRole(networkRole);
      setError('');
      const res = await apiService.adminResetNetworkRolePermissions(networkRole);
      setDbMatrix(res.data?.matrix || {});
      setSuccess(`Reset ${networkRole} to defaults`);
      setTimeout(() => setSuccess(''), 2500);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to reset permissions');
    } finally {
      setResettingRole(null);
    }
  };

  const renderCell = (role: typeof NETWORK_ROLES[number], row: MatrixRow) => {
    const featureKey = row.featureKey;
    const isPlatformOnly = PLATFORM_ONLY_ACTIONS.includes(featureKey);
    const staticLevel = row[role];
    const cellKey = `${role}.${featureKey}`;
    const isSaving = savingCell === cellKey;

    if (!adminMode) {
      const cfg = ACCESS_CONFIG[staticLevel];
      return (
        <td key={role} className={`nrm-cell ${cfg.className}`} title={cfg.label}>
          {cfg.icon}
        </td>
      );
    }

    // Admin mode: show toggle
    if (isPlatformOnly) {
      return (
        <td key={role} className="nrm-cell nrm-cell-platform" title="Platform Admin Only — not configurable">
          🔐
        </td>
      );
    }

    const isEnabled = dbMatrix[role]?.[featureKey] ?? (staticLevel !== 'none' && staticLevel !== 'platform_only');
    return (
      <td
        key={role}
        className={`nrm-cell nrm-cell-toggle ${isEnabled ? 'nrm-cell-full' : 'nrm-cell-none'}`}
        title={isEnabled ? 'Click to disable' : 'Click to enable'}
        onClick={() => handleToggle(role, featureKey)}
        style={{ cursor: isSaving ? 'wait' : 'pointer' }}
      >
        {isSaving ? '⏳' : isEnabled ? '✅' : '❌'}
      </td>
    );
  };

  return (
    <div className="nrm-container">
      <div className="nrm-header">
        <div>
          <h2 className="nrm-title">🔑 {t('networkRoleMatrix.title')}</h2>
          <p className="nrm-subtitle">
            {adminMode
              ? 'Click any cell to toggle access. Changes take effect immediately.'
              : t('networkRoleMatrix.subtitle')}
          </p>
        </div>
        {adminMode && loadingMatrix && <span className="nrm-loading">⏳ Loading...</span>}
      </div>

      {error && (
        <div className="module-alert error" style={{ marginBottom: 16 }}>
          ⚠️ {error} <button onClick={() => setError('')} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>
      )}
      {success && (
        <div className="module-alert success" style={{ marginBottom: 16 }}>
          ✅ {success}
        </div>
      )}

      {/* Role description cards */}
      <div className="nrm-role-cards">
        {NETWORK_ROLES.map(role => (
          <div key={role} className="nrm-role-card">
            <div className="nrm-role-icon">{ROLE_DESCRIPTIONS[role].icon}</div>
            <div className="nrm-role-name">{t(`networkRoleMatrix.roles.${role}`)}</div>
            <div className="nrm-role-desc">{t(`networkRoleMatrix.roleDescriptions.${ROLE_DESCRIPTIONS[role].descKey}`)}</div>
            {adminMode && (
              <button
                className="nrm-reset-btn"
                onClick={() => handleResetRole(role)}
                disabled={resettingRole === role}
                title={`Reset ${role} to defaults`}
              >
                {resettingRole === role ? '⏳' : '↺'} Reset
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      {!adminMode && (
        <div className="nrm-legend">
          {(Object.entries(ACCESS_CONFIG) as [AccessLevel, typeof ACCESS_CONFIG[AccessLevel]][]).map(([level, cfg]) => (
            <span key={level} className={`nrm-legend-item ${cfg.className}`}>
              {cfg.icon} {cfg.label}
            </span>
          ))}
        </div>
      )}
      {adminMode && (
        <div className="nrm-legend">
          <span className="nrm-legend-item nrm-cell-full">✅ Enabled (click to disable)</span>
          <span className="nrm-legend-item nrm-cell-none">❌ Disabled (click to enable)</span>
          <span className="nrm-legend-item nrm-cell-platform">🔐 Platform Admin Only (not configurable)</span>
        </div>
      )}

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
                    {NETWORK_ROLES.map(role => renderCell(role, row))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {adminMode ? (
        <p className="nrm-note">
          ⚙️ Changes are saved immediately and enforced in real-time. Use Reset to restore role defaults.
        </p>
      ) : (
        <p className="nrm-note">
          🔐 {t('networkRoleMatrix.platformNote')}
        </p>
      )}
    </div>
  );
};

export default NetworkRoleMatrix;


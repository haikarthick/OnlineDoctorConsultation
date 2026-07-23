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
  networkId: string;
  networkName?: string;
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

const NetworkRoleMatrix: React.FC<NetworkRoleMatrixProps> = ({ networkId, networkName, adminMode = false }) => {
  const { t } = useTranslation();

  // Admin-mode state
  const [dbMatrix, setDbMatrix] = useState<Record<string, Record<string, boolean>>>({});
  const [loadingMatrix, setLoadingMatrix] = useState(false);
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [resettingRole, setResettingRole] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Custom roles state
  const [customRoles, setCustomRoles] = useState<Array<{
    roleKey: string; displayName: string; description?: string; baseTemplate: string; icon: string; isCustom: boolean; id?: string;
  }>>([]);
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [newRole, setNewRole] = useState({ roleKey: '', displayName: '', description: '', baseTemplate: 'hospital_staff', icon: '👤' });
  const [creatingRole, setCreatingRole] = useState(false);
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [editRoleData, setEditRoleData] = useState({ displayName: '', description: '', baseTemplate: 'hospital_staff', icon: '👤' });

  const loadMatrix = useCallback(async () => {
    if (!adminMode || !networkId) return;
    try {
      setLoadingMatrix(true);
      setError('');
      const res = await apiService.adminGetNetworkRolePermissions(networkId);
      setDbMatrix(res.data?.matrix || {});
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to load network permissions');
    } finally {
      setLoadingMatrix(false);
    }
  }, [adminMode, networkId]);

  const loadRoles = useCallback(async () => {
    if (!networkId) return;
    try {
      const res = await apiService.getNetworkRoles(networkId);
      setCustomRoles((res.data || []).filter((r: any) => r.isCustom));
    } catch {
      // silent — custom roles are additive
    }
  }, [networkId]);

  useEffect(() => { loadMatrix(); loadRoles(); }, [loadMatrix, loadRoles]);

  const handleToggle = async (networkRole: string, featureKey: string) => {
    if (!adminMode || PLATFORM_ONLY_ACTIONS.includes(featureKey) || !networkId) return;
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
      await apiService.adminUpdateNetworkRolePermission(networkId, networkRole, featureKey, newValue);
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
    if (!adminMode || !networkId) return;
    try {
      setResettingRole(networkRole);
      setError('');
      const res = await apiService.adminResetNetworkRolePermissions(networkId, networkRole);
      setDbMatrix(res.data?.matrix || {});
      setSuccess(`Reset ${networkRole} to defaults`);
      setTimeout(() => setSuccess(''), 2500);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to reset permissions');
    } finally {
      setResettingRole(null);
    }
  };

  const handleCreateRole = async () => {
    if (!newRole.roleKey || !newRole.displayName || !newRole.baseTemplate) return;
    try {
      setCreatingRole(true);
      setError('');
      await apiService.createNetworkCustomRole(networkId, newRole);
      setSuccess(`Custom role "${newRole.displayName}" created!`);
      setTimeout(() => setSuccess(''), 3000);
      setNewRole({ roleKey: '', displayName: '', description: '', baseTemplate: 'hospital_staff', icon: '👤' });
      setShowCreateRole(false);
      await loadRoles();
      await loadMatrix();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to create custom role');
    } finally {
      setCreatingRole(false);
    }
  };

  const handleUpdateRole = async (roleKey: string) => {
    try {
      setError('');
      await apiService.updateNetworkCustomRole(networkId, roleKey, editRoleData);
      setSuccess('Role updated');
      setTimeout(() => setSuccess(''), 2500);
      setEditingRole(null);
      await loadRoles();
      await loadMatrix();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to update role');
    }
  };

  const handleDeleteRole = async (roleKey: string, displayName: string) => {
    if (!window.confirm(`Deactivate custom role "${displayName}"? Members with this role will lose access.`)) return;
    try {
      setError('');
      await apiService.deleteNetworkCustomRole(networkId, roleKey);
      setSuccess(`Role "${displayName}" deactivated`);
      setTimeout(() => setSuccess(''), 2500);
      await loadRoles();
      await loadMatrix();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to delete role');
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
          {networkName && <p className="nrm-network-name">Network: <strong>{networkName}</strong></p>}
          <p className="nrm-subtitle">
            {adminMode
              ? 'Click any cell to toggle access. Changes take effect immediately and apply only to this network.'
              : t('networkRoleMatrix.subtitle')}
          </p>
        </div>
        {adminMode && loadingMatrix && <span className="nrm-loading">⏳ Loading...</span>}
      </div>

      {error && (
        <div className="module-alert error si-7e63ec4f">
          ⚠️ {error} <button onClick={() => setError('')} className="si-c93d89f9">✕</button>
        </div>
      )}
      {success && (
        <div className="module-alert success si-7e63ec4f">
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

      {/* Custom Roles Section */}
      {adminMode && (
        <div className="si-9091d770">
          <div className="si-101fd1d0">
            <div>
              <h3 className="si-091fa5a5">
                🎭 {t('networkRoleMatrix.customRoles')}
              </h3>
              <p className="si-20a3be27">
                Create custom roles specific to this network (e.g., Receptionist, Lab Tech, Night Supervisor)
              </p>
            </div>
            <button
              className="module-btn primary si-1e8b29be"
              onClick={() => setShowCreateRole(v => !v)}
             
            >
              {showCreateRole ? '✕ Cancel' : '+ New Custom Role'}
            </button>
          </div>

          {showCreateRole && (
            <div className="si-8135ec20">
              <div className="module-form-row si-bab8e8bc">
                <div className="module-form-group">
                  <label className="module-label">{t('networkRoleMatrix.roleKey')} * <span className="si-beb3548b">(slug, e.g. receptionist)</span></label>
                  <input className="module-input" placeholder="e.g. receptionist" value={newRole.roleKey}
                    onChange={e => setNewRole(p => ({ ...p, roleKey: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }))} />
                </div>
                <div className="module-form-group">
                  <label className="module-label">{t('networkRoleMatrix.displayName')} *</label>
                  <input className="module-input" placeholder="e.g. Front Desk Receptionist" value={newRole.displayName}
                    onChange={e => setNewRole(p => ({ ...p, displayName: e.target.value }))} />
                </div>
              </div>
              <div className="module-form-row si-bab8e8bc">
                <div className="module-form-group">
                  <label className="module-label">{t('networkRoleMatrix.baseTemplate')} * <span className="si-beb3548b">(inherits default permissions from)</span></label>
                  <select className="module-input" value={newRole.baseTemplate}
                    onChange={e => setNewRole(p => ({ ...p, baseTemplate: e.target.value }))}>
                    <option value="hospital_staff">Hospital Staff</option>
                    <option value="auditor">Auditor</option>
                    <option value="compliance_officer">Compliance Officer</option>
                    <option value="hospital_director">Hospital Director</option>
                    <option value="corporate_admin">Corporate Admin</option>
                  </select>
                </div>
                <div className="module-form-group">
                  <label className="module-label">Icon (emoji)</label>
                  <input className="module-input si-a30c62ec" maxLength={2} placeholder="👤" value={newRole.icon}
                    onChange={e => setNewRole(p => ({ ...p, icon: e.target.value }))} />
                </div>
              </div>
              <div className="module-form-group si-bab8e8bc">
                <label className="module-label">Description (optional)</label>
                <input className="module-input" placeholder="Brief description of this role's responsibilities" value={newRole.description}
                  onChange={e => setNewRole(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="si-6e89f197">
                <button className="module-btn si-e9ff9765" onClick={() => setShowCreateRole(false)}>Cancel</button>
                <button className="module-btn primary" onClick={handleCreateRole} disabled={creatingRole || !newRole.roleKey || !newRole.displayName}>
                  {creatingRole ? '⏳ Creating...' : '✓ Create Role'}
                </button>
              </div>
              {(!newRole.roleKey || !newRole.displayName) && (
                <p className="si-ea3fee8b">⚠️ Role Key and Display Name are required</p>
              )}
            </div>
          )}

          {customRoles.length === 0 ? (
            <p className="si-13b5c4f7">
              {t('networkRoleMatrix.noCustomRoles')}
            </p>
          ) : (
            <div className="si-6e1e433a">
              {customRoles.map(role => (
                <div key={role.roleKey} className="si-51a09952">
                  {editingRole === role.roleKey ? (
                    <div>
                      <div className="module-form-group si-dab75309">
                        <label className="module-label si-bd374474">Display Name</label>
                        <input className="module-input" value={editRoleData.displayName}
                          onChange={e => setEditRoleData(p => ({ ...p, displayName: e.target.value }))} />
                      </div>
                      <div className="module-form-group si-dab75309">
                        <label className="module-label si-bd374474">Base Template</label>
                        <select className="module-input" value={editRoleData.baseTemplate}
                          onChange={e => setEditRoleData(p => ({ ...p, baseTemplate: e.target.value }))}>
                          <option value="hospital_staff">Hospital Staff</option>
                          <option value="auditor">Auditor</option>
                          <option value="compliance_officer">Compliance Officer</option>
                          <option value="hospital_director">Hospital Director</option>
                          <option value="corporate_admin">Corporate Admin</option>
                        </select>
                      </div>
                      <div className="module-form-group si-dab75309">
                        <label className="module-label si-bd374474">Description</label>
                        <input className="module-input" value={editRoleData.description}
                          onChange={e => setEditRoleData(p => ({ ...p, description: e.target.value }))} />
                      </div>
                      <div className="si-f0412db6">
                        <button onClick={() => setEditingRole(null)} className="si-d2765f70">Cancel</button>
                        <button onClick={() => handleUpdateRole(role.roleKey)} className="si-289b3577">Save</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="si-b01feffa">
                        <span className="si-46606d89">{role.icon}</span>
                        <div>
                          <div className="si-e171bea0">{role.displayName}</div>
                          <div className="si-ccfa8f47">{role.roleKey}</div>
                        </div>
                      </div>
                      {role.description && <p className="si-0a144a9b">{role.description}</p>}
                      <div className="si-3e179bf0">
                        Inherits from: <strong>{role.baseTemplate.replace(/_/g, ' ')}</strong>
                      </div>
                      <div className="si-d223efb3">
                        <button
                          onClick={() => { setEditingRole(role.roleKey); setEditRoleData({ displayName: role.displayName, description: role.description || '', baseTemplate: role.baseTemplate, icon: role.icon }); }}
                          className="si-0334bced"
                        >✏️ Edit</button>
                        <button
                          onClick={() => handleDeleteRole(role.roleKey, role.displayName)}
                          className="si-ccc82195"
                        >🗑 Deactivate</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NetworkRoleMatrix;


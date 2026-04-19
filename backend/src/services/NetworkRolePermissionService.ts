import database from '../utils/database';
import logger from '../utils/logger';

export const NETWORK_ROLES = ['corporate_admin', 'hospital_director', 'compliance_officer', 'auditor', 'hospital_staff'] as const;
export type NetworkRole = typeof NETWORK_ROLES[number];

export const NETWORK_ACTIONS = [
  'viewNetworkDetails', 'editNetworkSettings', 'deactivateNetwork',
  'viewBranchHospitals', 'addHospitalToNetwork',
  'viewNetworkMembers', 'addRemoveMembers', 'editMemberRoles',
  'viewAuditLogs', 'patientConsentManagement',
  'hospitalWorkflowQueue', 'walkInRegistration', 'inpatientManagement',
  'networkDashboardStats', 'healthAnalytics', 'financialAnalytics', 'interHospitalReferrals',
] as const;

/** Platform-only actions — never configurable */
export const PLATFORM_ONLY_ACTIONS = ['deactivateNetwork'];

/** Code defaults — used as fallback when no DB row exists for a network */
export const DEFAULTS: Record<string, Record<string, boolean>> = {
  corporate_admin: {
    viewNetworkDetails: true, editNetworkSettings: true, deactivateNetwork: true,
    viewBranchHospitals: true, addHospitalToNetwork: true,
    viewNetworkMembers: true, addRemoveMembers: true, editMemberRoles: true,
    viewAuditLogs: true, patientConsentManagement: true,
    hospitalWorkflowQueue: true, walkInRegistration: true, inpatientManagement: true,
    networkDashboardStats: true, healthAnalytics: true, financialAnalytics: true, interHospitalReferrals: true,
  },
  hospital_director: {
    viewNetworkDetails: true, editNetworkSettings: false, deactivateNetwork: false,
    viewBranchHospitals: true, addHospitalToNetwork: false,
    viewNetworkMembers: true, addRemoveMembers: true, editMemberRoles: true,
    viewAuditLogs: true, patientConsentManagement: true,
    hospitalWorkflowQueue: true, walkInRegistration: true, inpatientManagement: true,
    networkDashboardStats: true, healthAnalytics: true, financialAnalytics: false, interHospitalReferrals: true,
  },
  compliance_officer: {
    viewNetworkDetails: true, editNetworkSettings: false, deactivateNetwork: false,
    viewBranchHospitals: true, addHospitalToNetwork: false,
    viewNetworkMembers: true, addRemoveMembers: false, editMemberRoles: false,
    viewAuditLogs: true, patientConsentManagement: true,
    hospitalWorkflowQueue: false, walkInRegistration: false, inpatientManagement: false,
    networkDashboardStats: true, healthAnalytics: false, financialAnalytics: false, interHospitalReferrals: false,
  },
  auditor: {
    viewNetworkDetails: true, editNetworkSettings: false, deactivateNetwork: false,
    viewBranchHospitals: true, addHospitalToNetwork: false,
    viewNetworkMembers: true, addRemoveMembers: false, editMemberRoles: false,
    viewAuditLogs: true, patientConsentManagement: false,
    hospitalWorkflowQueue: false, walkInRegistration: false, inpatientManagement: false,
    networkDashboardStats: false, healthAnalytics: false, financialAnalytics: false, interHospitalReferrals: false,
  },
  hospital_staff: {
    viewNetworkDetails: true, editNetworkSettings: false, deactivateNetwork: false,
    viewBranchHospitals: false, addHospitalToNetwork: false,
    viewNetworkMembers: false, addRemoveMembers: false, editMemberRoles: false,
    viewAuditLogs: false, patientConsentManagement: false,
    hospitalWorkflowQueue: true, walkInRegistration: true, inpatientManagement: true,
    networkDashboardStats: false, healthAnalytics: false, financialAnalytics: false, interHospitalReferrals: false,
  },
};

class NetworkRolePermissionService {

  async ensureTable(): Promise<void> {
    // If table exists but has old schema (no network_id), drop and recreate
    await database.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'network_role_permissions'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'network_role_permissions' AND column_name = 'network_id'
        ) THEN
          DROP TABLE network_role_permissions;
        END IF;
      END
      $$
    `);
    await database.query(`
      CREATE TABLE IF NOT EXISTS network_role_permissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        network_id UUID NOT NULL REFERENCES hospital_networks(id) ON DELETE CASCADE,
        network_role VARCHAR(50) NOT NULL,
        action VARCHAR(100) NOT NULL,
        is_enabled BOOLEAN NOT NULL DEFAULT true,
        updated_by UUID,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(network_id, network_role, action)
      )
    `);
    await database.query(`
      CREATE INDEX IF NOT EXISTS idx_nrp_network_id ON network_role_permissions(network_id)
    `);
    logger.info('network_role_permissions table ensured (network-scoped)');
  }

  /** Get permission matrix for a specific network (falls back to code defaults for missing rows) */
  async getMatrix(networkId: string): Promise<Record<string, Record<string, boolean>>> {
    const result = await database.query(
      `SELECT network_role, action, is_enabled
       FROM network_role_permissions
       WHERE network_id = $1
       ORDER BY network_role, action`,
      [networkId]
    );

    const matrix: Record<string, Record<string, boolean>> = {};
    for (const row of result.rows) {
      if (!matrix[row.network_role]) matrix[row.network_role] = {};
      matrix[row.network_role][row.action] = row.is_enabled;
    }

    // Fill in code defaults for any missing role/action combinations
    for (const [role, actions] of Object.entries(DEFAULTS)) {
      if (!matrix[role]) matrix[role] = {};
      for (const [action, isEnabled] of Object.entries(actions)) {
        if (matrix[role][action] === undefined) matrix[role][action] = isEnabled;
      }
    }
    return matrix;
  }

  /** Check if a specific role can perform an action in a specific network */
  async checkAccess(networkId: string, networkRole: string, action: string): Promise<boolean> {
    try {
      const result = await database.query(
        `SELECT is_enabled FROM network_role_permissions
         WHERE network_id = $1 AND network_role = $2 AND action = $3`,
        [networkId, networkRole, action]
      );
      if (result.rows.length > 0) return result.rows[0].is_enabled;
    } catch {
      // Fall through to code defaults on DB error
    }
    return DEFAULTS[networkRole]?.[action] ?? false;
  }

  async updatePermission(networkId: string, networkRole: string, action: string, isEnabled: boolean, updatedBy: string): Promise<void> {
    await database.query(
      `INSERT INTO network_role_permissions (network_id, network_role, action, is_enabled, updated_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (network_id, network_role, action) DO UPDATE
         SET is_enabled = $4, updated_by = $5, updated_at = NOW()`,
      [networkId, networkRole, action, isEnabled, updatedBy]
    );
  }

  /** Reset permissions for a network (and optionally a specific role) back to code defaults */
  async resetToDefaults(networkId: string, networkRole?: string): Promise<void> {
    const roles = networkRole ? [networkRole] : Object.keys(DEFAULTS);
    for (const role of roles) {
      for (const [action, isEnabled] of Object.entries(DEFAULTS[role] || {})) {
        await database.query(
          `INSERT INTO network_role_permissions (network_id, network_role, action, is_enabled)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (network_id, network_role, action) DO UPDATE
             SET is_enabled = EXCLUDED.is_enabled, updated_by = NULL, updated_at = NOW()`,
          [networkId, role, action, isEnabled]
        );
      }
    }
  }

  getMetadata() {
    return {
      roles: [...NETWORK_ROLES],
      actions: [...NETWORK_ACTIONS],
      platformOnlyActions: [...PLATFORM_ONLY_ACTIONS],
      roleLabels: {
        corporate_admin: 'Corporate Admin',
        hospital_director: 'Hospital Director',
        compliance_officer: 'Compliance Officer',
        auditor: 'Auditor',
        hospital_staff: 'Hospital Staff',
      },
    };
  }
}

export default new NetworkRolePermissionService();

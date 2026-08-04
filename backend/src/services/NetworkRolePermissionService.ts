import database from '../utils/database';
import logger from '../utils/logger';

export const NETWORK_ROLES = ['corporate_admin', 'hospital_director', 'compliance_officer', 'auditor', 'hospital_staff'] as const;
export type NetworkRole = typeof NETWORK_ROLES[number];

export const NETWORK_ACTIONS = [
  // Governance
  'viewNetworkDetails', 'editNetworkSettings', 'manageBranding', 'deactivateNetwork', 'manageSubscription',
  // Branches
  'viewBranchHospitals', 'createBranchHospital', 'addHospitalToNetwork', 'editBranchHospital',
  // Members & roles
  'viewNetworkMembers', 'inviteStaff', 'addRemoveMembers', 'editMemberRoles', 'manageRolePermissions',
  // Patients & clinical data
  'viewEnrolledPatients', 'enrollPatient', 'walkInRegistration', 'viewPatientClinicalData',
  'patientConsentManagement', 'interHospitalReferrals', 'patientTransfers',
  // Operations
  'hospitalWorkflowQueue', 'inpatientManagement',
  // Analytics & audit
  'networkDashboardStats', 'healthAnalytics', 'financialAnalytics',
  'viewAuditLogs', 'exportComplianceReport',
] as const;

/** Platform-only actions - never configurable, enforced at route level (admin only) */
export const PLATFORM_ONLY_ACTIONS = ['deactivateNetwork', 'manageSubscription'];

/**
 * Network roles whose access is restricted to their OWN branch hospital. When a member with
 * one of these roles passes an action check, requireNetworkAccess attaches their hospital_id as
 * req.branchScopeHospitalId so downstream queries filter rows to that branch.
 */
export const BRANCH_SCOPED_ROLES = ['hospital_director', 'hospital_staff'];

/** Code defaults - used as fallback when no DB row exists for a network */
// NOTE: matrix values are booleans (capability granted yes/no). Branch-scoping for
// hospital_director / hospital_staff (🔵 in the target spec) is NOT expressed here - it is
// enforced at the SQL row level via requireNetworkAccess() attaching req.branchScopeHospitalId.
export const DEFAULTS: Record<string, Record<string, boolean>> = {
  corporate_admin: {
    viewNetworkDetails: true, editNetworkSettings: true, manageBranding: true, deactivateNetwork: true, manageSubscription: false,
    viewBranchHospitals: true, createBranchHospital: true, addHospitalToNetwork: true, editBranchHospital: true,
    viewNetworkMembers: true, inviteStaff: true, addRemoveMembers: true, editMemberRoles: true, manageRolePermissions: true,
    viewEnrolledPatients: true, enrollPatient: true, walkInRegistration: true, viewPatientClinicalData: true,
    patientConsentManagement: true, interHospitalReferrals: true, patientTransfers: true,
    hospitalWorkflowQueue: true, inpatientManagement: true,
    networkDashboardStats: true, healthAnalytics: true, financialAnalytics: true,
    viewAuditLogs: true, exportComplianceReport: true,
  },
  hospital_director: {
    viewNetworkDetails: true, editNetworkSettings: false, manageBranding: false, deactivateNetwork: false, manageSubscription: false,
    viewBranchHospitals: true, createBranchHospital: false, addHospitalToNetwork: false, editBranchHospital: true,
    viewNetworkMembers: true, inviteStaff: true, addRemoveMembers: true, editMemberRoles: true, manageRolePermissions: false,
    viewEnrolledPatients: true, enrollPatient: true, walkInRegistration: true, viewPatientClinicalData: true,
    patientConsentManagement: true, interHospitalReferrals: true, patientTransfers: true,
    hospitalWorkflowQueue: true, inpatientManagement: true,
    networkDashboardStats: true, healthAnalytics: true, financialAnalytics: false,
    viewAuditLogs: true, exportComplianceReport: false,
  },
  compliance_officer: {
    viewNetworkDetails: true, editNetworkSettings: false, manageBranding: false, deactivateNetwork: false, manageSubscription: false,
    viewBranchHospitals: true, createBranchHospital: false, addHospitalToNetwork: false, editBranchHospital: false,
    viewNetworkMembers: true, inviteStaff: false, addRemoveMembers: false, editMemberRoles: false, manageRolePermissions: false,
    viewEnrolledPatients: true, enrollPatient: false, walkInRegistration: false, viewPatientClinicalData: true,
    patientConsentManagement: true, interHospitalReferrals: false, patientTransfers: false,
    hospitalWorkflowQueue: false, inpatientManagement: false,
    networkDashboardStats: true, healthAnalytics: false, financialAnalytics: false,
    viewAuditLogs: true, exportComplianceReport: true,
  },
  auditor: {
    viewNetworkDetails: true, editNetworkSettings: false, manageBranding: false, deactivateNetwork: false, manageSubscription: false,
    viewBranchHospitals: true, createBranchHospital: false, addHospitalToNetwork: false, editBranchHospital: false,
    viewNetworkMembers: true, inviteStaff: false, addRemoveMembers: false, editMemberRoles: false, manageRolePermissions: false,
    viewEnrolledPatients: true, enrollPatient: false, walkInRegistration: false, viewPatientClinicalData: true,
    patientConsentManagement: false, interHospitalReferrals: false, patientTransfers: false,
    hospitalWorkflowQueue: false, inpatientManagement: false,
    networkDashboardStats: false, healthAnalytics: false, financialAnalytics: false,
    viewAuditLogs: true, exportComplianceReport: true,
  },
  hospital_staff: {
    viewNetworkDetails: true, editNetworkSettings: false, manageBranding: false, deactivateNetwork: false, manageSubscription: false,
    viewBranchHospitals: false, createBranchHospital: false, addHospitalToNetwork: false, editBranchHospital: false,
    viewNetworkMembers: false, inviteStaff: false, addRemoveMembers: false, editMemberRoles: false, manageRolePermissions: false,
    viewEnrolledPatients: true, enrollPatient: true, walkInRegistration: true, viewPatientClinicalData: true,
    patientConsentManagement: false, interHospitalReferrals: true, patientTransfers: true,
    hospitalWorkflowQueue: true, inpatientManagement: true,
    networkDashboardStats: false, healthAnalytics: false, financialAnalytics: false,
    viewAuditLogs: false, exportComplianceReport: false,
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

    // Include custom roles (inherit from their base_template)
    try {
      const customRoles = await database.query(
        `SELECT role_key, base_template, display_name, icon FROM network_custom_roles
         WHERE network_id = $1 AND is_active = true`,
        [networkId]
      );
      for (const cr of customRoles.rows) {
        if (!matrix[cr.role_key]) {
          matrix[cr.role_key] = { ...DEFAULTS[cr.base_template] };
        }
        const customPerms = await database.query(
          `SELECT action, is_enabled FROM network_role_permissions
           WHERE network_id = $1 AND network_role = $2`,
          [networkId, cr.role_key]
        );
        for (const perm of customPerms.rows) {
          matrix[cr.role_key][perm.action] = perm.is_enabled;
        }
      }
    } catch (err: any) {
      logger.warn('Failed to load custom roles for matrix', { error: err.message });
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
      // Fall through
    }
    // Check if it's a custom role - inherit from base_template
    try {
      const customRole = await database.query(
        `SELECT base_template FROM network_custom_roles
         WHERE network_id = $1 AND role_key = $2 AND is_active = true`,
        [networkId, networkRole]
      );
      if (customRole.rows.length > 0) {
        const baseTemplate = customRole.rows[0].base_template;
        return DEFAULTS[baseTemplate]?.[action] ?? false;
      }
    } catch {
      // Fall through
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

  /** Get all roles for a network (static + custom) */
  async getNetworkRoles(networkId: string): Promise<Array<{
    roleKey: string;
    displayName: string;
    description?: string;
    baseTemplate: string;
    icon: string;
    isCustom: boolean;
    id?: string;
  }>> {
    const meta = this.getMetadata();
    const staticRoles = NETWORK_ROLES.map(r => ({
      roleKey: r,
      displayName: meta.roleLabels[r],
      baseTemplate: r,
      icon: this.getRoleIcon(r),
      isCustom: false,
    }));
    try {
      const customRoles = await database.query(
        `SELECT id, role_key AS "roleKey", display_name AS "displayName",
                description, base_template AS "baseTemplate", icon
         FROM network_custom_roles
         WHERE network_id = $1 AND is_active = true
         ORDER BY created_at ASC`,
        [networkId]
      );
      return [
        ...staticRoles,
        ...customRoles.rows.map((r: any) => ({ ...r, isCustom: true })),
      ];
    } catch {
      return staticRoles;
    }
  }

  /** Create a custom role for a network */
  async createCustomRole(networkId: string, data: {
    roleKey: string;
    displayName: string;
    description?: string;
    baseTemplate: string;
    icon?: string;
    createdBy: string;
  }): Promise<{ id: string; roleKey: string; displayName: string }> {
    const slug = data.roleKey.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if ((NETWORK_ROLES as readonly string[]).includes(slug)) {
      throw new Error(`"${slug}" is a reserved role name and cannot be used as a custom role`);
    }
    const result = await database.query(
      `INSERT INTO network_custom_roles (network_id, role_key, display_name, description, base_template, icon, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, role_key AS "roleKey", display_name AS "displayName"`,
      [networkId, slug, data.displayName, data.description ?? null,
       data.baseTemplate, data.icon ?? '👤', data.createdBy]
    );
    return result.rows[0];
  }

  /** Update a custom role */
  async updateCustomRole(networkId: string, roleKey: string, data: {
    displayName?: string;
    description?: string;
    baseTemplate?: string;
    icon?: string;
    updatedBy: string;
  }): Promise<void> {
    await database.query(
      `UPDATE network_custom_roles
       SET display_name = COALESCE($3, display_name),
           description = COALESCE($4, description),
           base_template = COALESCE($5, base_template),
           icon = COALESCE($6, icon),
           updated_at = NOW()
       WHERE network_id = $1 AND role_key = $2`,
      [networkId, roleKey, data.displayName ?? null, data.description ?? null,
       data.baseTemplate ?? null, data.icon ?? null]
    );
  }

  /** Deactivate (soft-delete) a custom role */
  async deactivateCustomRole(networkId: string, roleKey: string): Promise<void> {
    await database.query(
      `UPDATE network_custom_roles SET is_active = false WHERE network_id = $1 AND role_key = $2`,
      [networkId, roleKey]
    );
  }

  private getRoleIcon(role: string): string {
    const icons: Record<string, string> = {
      corporate_admin: '🏢', hospital_director: '🏥',
      compliance_officer: '📋', auditor: '🔍', hospital_staff: '👩‍⚕️',
    };
    return icons[role] ?? '👤';
  }
}

export default new NetworkRolePermissionService();

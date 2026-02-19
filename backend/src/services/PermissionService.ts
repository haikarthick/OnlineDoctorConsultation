import database from '../utils/database';
import logger from '../utils/logger';

// ─── Permission Definitions ─────────────────────────────────
// All permissions in the system, grouped by category
export const PERMISSION_CATEGORIES = {
  pages: {
    label: 'Page Access',
    permissions: [
      'dashboard',
      'consultations',
      'find_doctor',
      'book_consultation',
      'animals',
      'medical_records',
      'schedule',
      'prescriptions',
      'reviews',
      'video_consultation',
      'settings',
      'write_review',
    ]
  },
  admin_pages: {
    label: 'Admin Pages',
    permissions: [
      'admin_dashboard',
      'admin_users',
      'admin_consultations',
      'admin_payments',
      'admin_reviews',
      'admin_settings',
      'admin_audit',
      'admin_permissions',
      'admin_medical_records',
    ]
  },
  actions: {
    label: 'Actions',
    permissions: [
      'booking_create',
      'booking_confirm',
      'booking_cancel',
      'booking_reschedule',
      'consultation_create',
      'consultation_start',
      'prescription_create',
      'review_create',
      'review_moderate',
      'animal_manage',
      'schedule_manage',
      'medical_record_create',
    ]
  },
  enterprise: {
    label: 'Enterprise Management',
    permissions: [
      'enterprise_manage',
      'enterprise_groups',
      'enterprise_locations',
      'enterprise_movements',
      'enterprise_campaigns',
      'enterprise_members',
    ]
  },
  dashboard_widgets: {
    label: 'Dashboard Widgets',
    permissions: [
      'dashboard_stats',
      'dashboard_quick_actions',
      'dashboard_recent_activity',
      'dashboard_pending_approvals',
      'dashboard_upcoming_bookings',
      'dashboard_recent_consultations',
      'dashboard_tips',
    ]
  }
};

// All permissions as a flat list
export const ALL_PERMISSIONS: string[] = Object.values(PERMISSION_CATEGORIES)
  .flatMap(cat => cat.permissions);

// ─── Default role → permission mapping ──────────────────────
export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  veterinarian: [
    // Pages
    'dashboard', 'consultations', 'medical_records', 'schedule',
    'prescriptions', 'reviews', 'video_consultation', 'settings',
    // Actions
    'booking_confirm', 'booking_cancel', 'booking_reschedule',
    'consultation_create', 'consultation_start', 'prescription_create',
    'schedule_manage', 'medical_record_create',
    // Dashboard widgets
    'dashboard_stats', 'dashboard_quick_actions', 'dashboard_recent_activity',
    'dashboard_pending_approvals', 'dashboard_upcoming_bookings',
    'dashboard_recent_consultations',
  ],
  pet_owner: [
    // Pages
    'dashboard', 'consultations', 'find_doctor', 'book_consultation',
    'animals', 'medical_records', 'video_consultation',
    'settings', 'write_review',
    // Enterprise (basic access)
    'enterprise_manage',
    // Actions
    'booking_create', 'booking_cancel', 'booking_reschedule',
    'consultation_create', 'review_create', 'animal_manage',
    // Dashboard widgets
    'dashboard_stats', 'dashboard_quick_actions', 'dashboard_recent_activity',
    'dashboard_tips',
  ],
  farmer: [
    // Pages
    'dashboard', 'consultations', 'find_doctor', 'book_consultation',
    'animals', 'video_consultation', 'settings',
    // Enterprise
    'enterprise_manage', 'enterprise_groups', 'enterprise_locations',
    'enterprise_movements', 'enterprise_campaigns', 'enterprise_members',
    // Actions
    'booking_create', 'booking_cancel', 'booking_reschedule',
    'consultation_create', 'animal_manage',
    // Dashboard widgets
    'dashboard_stats', 'dashboard_quick_actions', 'dashboard_recent_activity',
    'dashboard_tips',
  ],
  admin: [
    // Pages
    'dashboard', 'consultations', 'settings',
    // Admin pages
    'admin_dashboard', 'admin_users', 'admin_consultations', 'admin_payments',
    'admin_reviews', 'admin_settings', 'admin_audit', 'admin_permissions', 'admin_medical_records',
    // Enterprise (full access)
    'enterprise_manage', 'enterprise_groups', 'enterprise_locations',
    'enterprise_movements', 'enterprise_campaigns', 'enterprise_members',
    // Actions
    'booking_confirm', 'booking_cancel', 'review_moderate',
    // Dashboard widgets
    'dashboard_stats', 'dashboard_quick_actions', 'dashboard_recent_activity',
  ]
};

// Human-readable labels for permissions
export const PERMISSION_LABELS: Record<string, string> = {
  // Pages
  dashboard: 'Dashboard',
  consultations: 'Consultations Page',
  find_doctor: 'Find Doctor',
  book_consultation: 'Book Consultation',
  animals: 'My Animals / Pets',
  medical_records: 'Medical Records',
  schedule: 'My Schedule',
  prescriptions: 'Prescriptions',
  reviews: 'Reviews',
  video_consultation: 'Video Consultation',
  settings: 'Settings',
  write_review: 'Write Review',
  // Admin pages
  admin_dashboard: 'Admin Dashboard',
  admin_users: 'User Management',
  admin_consultations: 'Consultation Management',
  admin_payments: 'Payment Management',
  admin_reviews: 'Review Moderation',
  admin_settings: 'System Settings',
  admin_audit: 'Audit Logs',
  admin_permissions: 'Permission Management',
  admin_medical_records: 'Medical Record Management',
  // Actions
  booking_create: 'Create Bookings',
  booking_confirm: 'Confirm Bookings',
  booking_cancel: 'Cancel Bookings',
  booking_reschedule: 'Reschedule Bookings',
  consultation_create: 'Create Consultations',
  consultation_start: 'Start Consultations',
  prescription_create: 'Create Prescriptions',
  review_create: 'Create Reviews',
  review_moderate: 'Moderate Reviews',
  animal_manage: 'Manage Animals',
  schedule_manage: 'Manage Schedule',
  medical_record_create: 'Create Medical Records',
  // Enterprise Management
  enterprise_manage: 'Enterprise Management',
  enterprise_groups: 'Animal Groups',
  enterprise_locations: 'Location Management',
  enterprise_movements: 'Movement Log',
  enterprise_campaigns: 'Treatment Campaigns',
  enterprise_members: 'Enterprise Members',
  // Dashboard widgets
  dashboard_stats: 'Dashboard Stats Cards',
  dashboard_quick_actions: 'Dashboard Quick Actions',
  dashboard_recent_activity: 'Dashboard Recent Activity',
  dashboard_pending_approvals: 'Dashboard Pending Approvals',
  dashboard_upcoming_bookings: 'Dashboard Upcoming Bookings',
  dashboard_recent_consultations: 'Dashboard Recent Consultations',
  dashboard_tips: 'Dashboard Tips & Resources',
};

class PermissionService {

  /** Ensure the role_permissions table exists */
  async ensureTable(): Promise<void> {
    await database.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        role VARCHAR(50) NOT NULL,
        permission VARCHAR(100) NOT NULL,
        is_enabled BOOLEAN DEFAULT true,
        updated_by UUID,
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(role, permission)
      )
    `);
    logger.info('role_permissions table ensured');
  }

  /** Seed default permissions if table is empty */
  async seedDefaults(): Promise<void> {
    const check = await database.query('SELECT COUNT(*) as cnt FROM role_permissions');
    if (parseInt(check.rows[0].cnt) > 0) return;

    logger.info('Seeding default role permissions...');
    for (const [role, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      for (const permission of ALL_PERMISSIONS) {
        const isEnabled = permissions.includes(permission);
        await database.query(
          `INSERT INTO role_permissions (role, permission, is_enabled) VALUES ($1, $2, $3)
           ON CONFLICT (role, permission) DO NOTHING`,
          [role, permission, isEnabled]
        );
      }
    }
    logger.info('Default permissions seeded for all roles');
  }

  /** Get all permissions for a specific role (returns only enabled permission keys) */
  async getPermissionsForRole(role: string): Promise<string[]> {
    // First check if any DB overrides exist for this role
    const result = await database.query(
      'SELECT permission FROM role_permissions WHERE role = $1 AND is_enabled = true',
      [role]
    );

    if (result.rows.length > 0) {
      return result.rows.map((r: any) => r.permission);
    }

    // Fallback to defaults if no DB records (e.g., fresh install before seeding)
    return DEFAULT_ROLE_PERMISSIONS[role] || [];
  }

  /** Get full permission matrix — all roles with all permissions (for admin UI) */
  async getFullPermissionMatrix(): Promise<Record<string, Record<string, boolean>>> {
    const result = await database.query(
      'SELECT role, permission, is_enabled FROM role_permissions ORDER BY role, permission'
    );

    const matrix: Record<string, Record<string, boolean>> = {};
    const roles = ['veterinarian', 'pet_owner', 'farmer', 'admin'];

    // Initialize with defaults
    for (const role of roles) {
      matrix[role] = {};
      for (const perm of ALL_PERMISSIONS) {
        matrix[role][perm] = (DEFAULT_ROLE_PERMISSIONS[role] || []).includes(perm);
      }
    }

    // Override with DB values
    for (const row of result.rows) {
      if (!matrix[row.role]) matrix[row.role] = {};
      matrix[row.role][row.permission] = row.is_enabled;
    }

    return matrix;
  }

  /** Update a single permission for a role */
  async updatePermission(
    role: string,
    permission: string,
    isEnabled: boolean,
    updatedBy?: string
  ): Promise<void> {
    if (!ALL_PERMISSIONS.includes(permission)) {
      throw new Error(`Unknown permission: ${permission}`);
    }
    if (!['veterinarian', 'pet_owner', 'farmer', 'admin'].includes(role)) {
      throw new Error(`Unknown role: ${role}`);
    }

    await database.query(
      `INSERT INTO role_permissions (role, permission, is_enabled, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (role, permission) 
       DO UPDATE SET is_enabled = $3, updated_by = $4, updated_at = NOW()`,
      [role, permission, isEnabled, updatedBy || null]
    );

    logger.info(`Permission updated: ${role}.${permission} = ${isEnabled}`);
  }

  /** Bulk update permissions for a role */
  async bulkUpdatePermissions(
    role: string,
    permissions: Record<string, boolean>,
    updatedBy?: string
  ): Promise<void> {
    if (!['veterinarian', 'pet_owner', 'farmer', 'admin'].includes(role)) {
      throw new Error(`Unknown role: ${role}`);
    }

    for (const [permission, isEnabled] of Object.entries(permissions)) {
      if (!ALL_PERMISSIONS.includes(permission)) continue;
      await database.query(
        `INSERT INTO role_permissions (role, permission, is_enabled, updated_by, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (role, permission) 
         DO UPDATE SET is_enabled = $3, updated_by = $4, updated_at = NOW()`,
        [role, permission, isEnabled, updatedBy || null]
      );
    }

    logger.info(`Bulk permissions updated for role: ${role}`);
  }

  /** Reset a role's permissions to defaults */
  async resetToDefaults(role: string): Promise<void> {
    if (!['veterinarian', 'pet_owner', 'farmer', 'admin'].includes(role)) {
      throw new Error(`Unknown role: ${role}`);
    }

    await database.query('DELETE FROM role_permissions WHERE role = $1', [role]);

    const defaults = DEFAULT_ROLE_PERMISSIONS[role] || [];
    for (const permission of ALL_PERMISSIONS) {
      await database.query(
        `INSERT INTO role_permissions (role, permission, is_enabled)
         VALUES ($1, $2, $3)`,
        [role, permission, defaults.includes(permission)]
      );
    }

    logger.info(`Permissions reset to defaults for role: ${role}`);
  }

  /** Check if a specific role has a specific permission */
  async hasPermission(role: string, permission: string): Promise<boolean> {
    const result = await database.query(
      'SELECT is_enabled FROM role_permissions WHERE role = $1 AND permission = $2',
      [role, permission]
    );

    if (result.rows.length > 0) {
      return result.rows[0].is_enabled;
    }

    // Fallback to default
    return (DEFAULT_ROLE_PERMISSIONS[role] || []).includes(permission);
  }

  /** Get permission metadata (categories, labels, all permissions) */
  getPermissionMetadata() {
    return {
      categories: PERMISSION_CATEGORIES,
      labels: PERMISSION_LABELS,
      allPermissions: ALL_PERMISSIONS,
      roles: ['veterinarian', 'pet_owner', 'farmer', 'admin'],
      roleLabels: {
        veterinarian: 'Veterinarian',
        pet_owner: 'Pet Owner',
        farmer: 'Farmer',
        admin: 'Admin'
      }
    };
  }
}

export default new PermissionService();

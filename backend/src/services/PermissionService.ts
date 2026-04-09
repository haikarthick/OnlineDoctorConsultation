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
      'hospital_browse',
      'hospital_manage',
      'animal_timeline',
      'wallet',
      'vaccination_passport',
      'vet_certificates',
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
      'admin_hospitals',
      'admin_compliance',
      'admin_holidays',
      'admin_cancellation_dashboard',
      'admin_vaccine_protocols',
      'admin_certificates',
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
      'herd_medical',
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
  },
  advanced: {
    label: 'Advanced Modules',
    permissions: [
      'health_analytics',
      'breeding_manage',
      'feed_manage',
      'compliance_manage',
      'financial_analytics',
      'alert_manage',
    ]
  },
  innovation: {
    label: 'Innovation Modules',
    permissions: [
      'disease_prediction',
      'genomic_lineage',
      'iot_sensors',
      'supply_chain',
      'workforce_manage',
      'report_builder',
    ]
  },
  intelligence: {
    label: 'Intelligence Modules',
    permissions: [
      'ai_copilot',
      'digital_twin',
      'marketplace_access',
      'sustainability_manage',
      'wellness_portal',
      'geospatial_analytics',
    ]
  },
  hospital: {
    label: 'Vet Hospital',
    permissions: [
      'hospital_browse',
      'hospital_create',
      'hospital_manage',
      'hospital_departments',
      'hospital_services',
      'hospital_staff',
      'hospital_workflow',
      'inpatient_manage',
      'admin_staff_settings',
      'hospital_network_manage',
      'hospital_network_view',
      'hospital_network_audit',
      'patient_consent_manage',
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
    'animals', 'animal_timeline',
    // Pages
    'vaccination_passport', 'vet_certificates',
    // Hospital
    'hospital_browse', 'hospital_create', 'hospital_manage',
    'hospital_departments', 'hospital_services', 'hospital_staff',
    'hospital_workflow', 'inpatient_manage', 'admin_staff_settings',
    // Enterprise (vet serves enterprise clients per Home page)
    'enterprise_campaigns', 'herd_medical',
    // Advanced (vet needs analytics for clinical oversight)
    'health_analytics', 'alert_manage',
    // Innovation (vet-relevant modules)
    'disease_prediction', 'report_builder',
    // Intelligence
    'ai_copilot', 'marketplace_access', 'wellness_portal',
    // Holiday management
    'admin_holidays',
    // Hospital Network
    'hospital_network_view',
    // Wallet
    'wallet',
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
    'prescriptions', 'settings', 'write_review',
    'animal_timeline',
    // Hospital (browse only)
    'hospital_browse',
    // (user-scoped)
    'ai_copilot', 'marketplace_access', 'wellness_portal',
    'vaccination_passport', 'vet_certificates',
    // Data consent
    'patient_consent_manage',
    // Network memberships
    'network_membership_manage',
    // Wallet
    'wallet',
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
    'animals', 'medical_records', 'video_consultation', 'prescriptions', 'settings', 'write_review',
    'animal_timeline',
    // Hospital (browse to find vets)
    'hospital_browse',
    // Vet Certificates
    'vet_certificates',
    // Enterprise
    'enterprise_manage', 'enterprise_groups', 'enterprise_locations',
    'enterprise_movements', 'enterprise_campaigns', 'enterprise_members', 'herd_medical',
    // Advanced
    'health_analytics', 'breeding_manage', 'feed_manage',
    'compliance_manage', 'financial_analytics', 'alert_manage',
    // Innovative Modules
    'disease_prediction', 'genomic_lineage', 'iot_sensors',
    'supply_chain', 'workforce_manage', 'report_builder',
    // Futuristic Modules
    'ai_copilot', 'digital_twin', 'marketplace_access',
    'sustainability_manage', 'wellness_portal', 'geospatial_analytics',
    'vaccination_passport',
    // Data consent
    'patient_consent_manage',
    // Network memberships
    'network_membership_manage',
    // Wallet
    'wallet',
    // Actions
    'booking_create', 'booking_cancel', 'booking_reschedule',
    'consultation_create', 'review_create', 'animal_manage',
    'medical_record_create',
    // Dashboard widgets
    'dashboard_stats', 'dashboard_quick_actions', 'dashboard_recent_activity',
    'dashboard_tips',
  ],
  admin: [
    // Pages
    'dashboard', 'consultations', 'settings',
    'animal_timeline',
    // Admin pages
    'admin_dashboard', 'admin_users', 'admin_consultations', 'admin_payments',
    'admin_reviews', 'admin_settings', 'admin_audit', 'admin_permissions', 'admin_medical_records',
    'admin_hospitals', 'admin_compliance',
    // Hospital (full access)
    'hospital_browse', 'hospital_create', 'hospital_manage',
    'hospital_departments', 'hospital_services', 'hospital_staff',
    'hospital_workflow', 'inpatient_manage', 'admin_staff_settings',
    // Enterprise (full access)
    'enterprise_manage', 'enterprise_groups', 'enterprise_locations',
    'enterprise_movements', 'enterprise_campaigns', 'enterprise_members', 'herd_medical',
    // Advanced (full access)
    'health_analytics', 'breeding_manage', 'feed_manage',
    'compliance_manage', 'financial_analytics', 'alert_manage',
    // Innovative Modules (full access)
    'disease_prediction', 'genomic_lineage', 'iot_sensors',
    'supply_chain', 'workforce_manage', 'report_builder',
    // Futuristic Modules
    'ai_copilot', 'digital_twin', 'marketplace_access',
    'sustainability_manage', 'wellness_portal', 'geospatial_analytics',
    // Vaccine Protocols
    'vaccination_passport', 'admin_vaccine_protocols', 'vet_certificates',
    // Certificates admin
    'admin_certificates',
    // Hospital Network (full access)
    'hospital_network_manage', 'hospital_network_view', 'hospital_network_audit',
    // Patient consent (admin oversight)
    'patient_consent_manage',
    // Wallet & Cancellation
    'wallet', 'admin_cancellation_dashboard',
    // Holiday management
    'admin_holidays',
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
  admin_hospitals: 'Hospital Management',
  admin_compliance: 'HIPAA Compliance Dashboard',
  admin_holidays: 'Holiday Management',
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
  // Hospital
  hospital_browse: 'Browse Vet Hospitals',
  hospital_create: 'Create Vet Hospital',
  hospital_manage: 'Manage Vet Hospital',
  hospital_departments: 'Manage Hospital Departments',
  hospital_services: 'Manage Hospital Services',
  hospital_staff: 'Manage Hospital Staff',
  hospital_workflow: 'Hospital Workflow & Queue',
  inpatient_manage: 'Inpatient & Boarding',
  admin_staff_settings: 'Staff & Positions Admin',
  // Enterprise Management
  enterprise_manage: 'Enterprise Management',
  enterprise_groups: 'Animal Groups',
  enterprise_locations: 'Location Management',
  enterprise_movements: 'Movement Log',
  enterprise_campaigns: 'Treatment Campaigns',
  enterprise_members: 'Enterprise Members',
  herd_medical: 'Herd Medical Management',
  // Advanced Modules
  health_analytics: 'Health Analytics',
  breeding_manage: 'Breeding & Genetics',
  feed_manage: 'Feed & Inventory',
  compliance_manage: 'Compliance & Regulatory',
  financial_analytics: 'Financial Analytics',
  alert_manage: 'Smart Alerts',
  // Innovative Modules
  disease_prediction: 'AI Disease Prediction',
  genomic_lineage: 'Genomic Lineage & Diversity',
  iot_sensors: 'IoT Sensor Integration',
  supply_chain: 'Supply Chain & Traceability',
  workforce_manage: 'Workforce & Task Management',
  report_builder: 'Report Builder & Exports',
  // Futuristic Modules
  ai_copilot: 'AI Vet Copilot',
  digital_twin: 'Digital Twin & Simulator',
  marketplace_access: 'Marketplace & Auctions',
  sustainability_manage: 'Sustainability & ESG',
  wellness_portal: 'Wellness Portal',
  geospatial_analytics: 'Geospatial Analytics',
  // Hospital Network
  hospital_network_manage: 'Hospital Network Management',
  hospital_network_view: 'Hospital Network View',
  hospital_network_audit: 'Hospital Network Audit',
  patient_consent_manage: 'Patient Data Consent',
  network_membership_manage: 'Network Membership Management',
  // Timeline
  animal_timeline: 'Animal Life Timeline',
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
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

  /** Seed default permissions — inserts any missing permissions (safe to re-run) */
  async seedDefaults(): Promise<void> {
    logger.info('Syncing default role permissions...');
    let changed = 0;
    for (const [role, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      for (const permission of ALL_PERMISSIONS) {
        const isEnabled = permissions.includes(permission);
        const res = await database.query(
          `INSERT INTO role_permissions (role, permission, is_enabled) VALUES ($1, $2, $3)
           ON CONFLICT (role, permission) DO UPDATE SET is_enabled = EXCLUDED.is_enabled
           WHERE role_permissions.is_enabled <> EXCLUDED.is_enabled AND role_permissions.updated_by IS NULL`,
          [role, permission, isEnabled]
        );
        if (res.rowCount && res.rowCount > 0) changed++;
      }
    }
    if (changed > 0) {
      logger.info(`Synced ${changed} permission entries (new or updated defaults)`);
    } else {
      logger.info('All permissions already up to date');
    }
  }

  /** Get all permissions for a specific role (returns only enabled permission keys) */
  async getPermissionsForRole(role: string): Promise<string[]> {
    // Read all DB rows for this role (both enabled and disabled, to know explicit overrides)
    const result = await database.query(
      'SELECT permission, is_enabled FROM role_permissions WHERE role = $1',
      [role]
    );

    if (result.rows.length > 0) {
      // Build a map of DB-managed permissions
      const dbMap = new Map<string, boolean>(result.rows.map((r: any) => [r.permission, r.is_enabled]));
      const defaults = DEFAULT_ROLE_PERMISSIONS[role] || [];
      const enabled = new Set<string>();
      // Add DB-enabled permissions
      for (const [perm, isEnabled] of dbMap) {
        if (isEnabled) enabled.add(perm);
      }
      // Add DEFAULT permissions not yet present in DB (new permissions added after initial seed)
      for (const perm of defaults) {
        if (!dbMap.has(perm)) enabled.add(perm);
      }
      return Array.from(enabled);
    }

    // Fallback to defaults if no DB records at all (fresh install)
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

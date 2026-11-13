import database from '../../utils/database';
import { DatabaseError, NotFoundError, ValidationError } from '../../utils/errors';
import logger from '../../utils/logger';
// ─── Update Branch Hospital───────────────────────────────────────────────────
export async function updateBranchHospital(hospitalId: string, networkId: string, data: {
  name?: string; hospitalType?: string; address?: string; city?: string; state?: string;
  country?: string; postalCode?: string; phone?: string; email?: string;
  description?: string; specializations?: string[];
}) {
  const result = await database.query(
    `UPDATE vet_hospitals SET
       name = COALESCE($1, name),
       hospital_type = COALESCE($2, hospital_type),
       address = COALESCE($3, address),
       city = COALESCE($4, city),
       state = COALESCE($5, state),
       country = COALESCE($6, country),
       postal_code = COALESCE($7, postal_code),
       phone = COALESCE($8, phone),
       email = COALESCE($9, email),
       description = COALESCE($10, description),
       specializations = COALESCE($11, specializations),
       updated_at = NOW()
     WHERE id = $12 AND branch_network_id = $13 AND is_network_branch = true
     RETURNING id, name, city, state, hospital_type AS "hospitalType", phone, email, description, specializations`,
    [
      data.name || null, data.hospitalType || null, data.address || null,
      data.city || null, data.state || null, data.country || null,
      data.postalCode || null, data.phone || null, data.email || null,
      data.description || null, data.specializations ? JSON.stringify(data.specializations) : null,
      hospitalId, networkId
    ]
  );
  if (result.rows.length === 0) throw new NotFoundError('Branch hospital not found in this network');
  return result.rows[0];
}

// ─── Delete Branch Hospital ───────────────────────────────────────────────────
export async function deleteBranchHospital(hospitalId: string, networkId: string) {
  const check = await database.query(
    `SELECT id FROM vet_hospitals WHERE id = $1 AND branch_network_id = $2 AND is_network_branch = true`,
    [hospitalId, networkId]
  );
  if (check.rows.length === 0) throw new NotFoundError('Branch hospital not found in this network');
  // Remove from junction table
  await database.query(`DELETE FROM hospital_network_hospitals WHERE hospital_id = $1 AND network_id = $2`, [hospitalId, networkId]);
  // Mark hospital as inactive rather than hard delete
  await database.query(`UPDATE vet_hospitals SET is_active = false, updated_at = NOW() WHERE id = $1`, [hospitalId]);
  return { success: true };
}

// ─── P6-APPROVAL: Approval Workflow ──────────────────────────────────────────

export async function addApprovalEvent(
  networkId: string,
  actorId: string,
  actorRole: string,
  eventType: string,
  notes?: string
): Promise<void> {
  const allowed = ['submitted','under_review','info_requested','info_provided','approved','rejected','suspended','reactivated'];
  if (!allowed.includes(eventType)) throw new ValidationError(`Invalid event_type: ${eventType}`);
  try {
    await database.query(
      `INSERT INTO network_approval_events (network_id, actor_id, actor_role, event_type, notes)
       VALUES ($1, $2, $3, $4, $5)`,
      [networkId, actorId, actorRole, eventType, notes ?? null]
    );
    logger.info('Approval event recorded', { networkId, eventType, actorId });
  } catch (err) {
    throw new DatabaseError('Failed to record approval event', { originalError: err });
  }
}

export async function getApprovalHistory(networkId: string): Promise<any[]> {
  try {
    const result = await database.query(
      `SELECT
         e.id,
         e.network_id AS "networkId",
         e.event_type AS "eventType",
         e.actor_role AS "actorRole",
         e.notes,
         e.created_at AS "createdAt",
         u.first_name || ' ' || u.last_name AS "actorName",
         u.email AS "actorEmail"
       FROM network_approval_events e
       JOIN users u ON u.id = e.actor_id
       WHERE e.network_id = $1
       ORDER BY e.created_at DESC`,
      [networkId]
    );
    return result.rows;
  } catch (err) {
    throw new DatabaseError('Failed to get approval history', { originalError: err });
  }
}

// ─── P6-BRANDING: Network Branding Update ────────────────────────────────────

export async function updateNetworkBranding(networkId: string, data: {
  logoUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
  websiteUrl?: string;
  operatingHours?: Record<string, any>;
  specializations?: string[];
  emergencyServices?: boolean;
}): Promise<any> {
  try {
    const result = await database.query(
      `UPDATE hospital_networks SET
         logo_url = COALESCE($2, logo_url),
         contact_email = COALESCE($3, contact_email),
         contact_phone = COALESCE($4, contact_phone),
         website_url = COALESCE($5, website_url),
         operating_hours = COALESCE($6, operating_hours),
         specializations = COALESCE($7, specializations),
         emergency_services = COALESCE($8, emergency_services),
         updated_at = NOW()
       WHERE id = $1
       RETURNING
         id, name,
         logo_url AS "logoUrl",
         contact_email AS "contactEmail",
         contact_phone AS "contactPhone",
         website AS "website",
         website_url AS "websiteUrl",
         operating_hours AS "operatingHours",
         specializations,
         emergency_services AS "emergencyServices",
         updated_at AS "updatedAt"`,
      [
        networkId,
        data.logoUrl ?? null,
        data.contactEmail ?? null,
        data.contactPhone ?? null,
        data.websiteUrl ?? null,
        data.operatingHours ? JSON.stringify(data.operatingHours) : null,
        data.specializations ? data.specializations : null,
        data.emergencyServices !== undefined ? data.emergencyServices : null,
      ]
    );
    if (result.rows.length === 0) throw new NotFoundError('Network not found');
    return result.rows[0];
  } catch (err: any) {
    if (err instanceof NotFoundError) throw err;
    throw new DatabaseError('Failed to update network branding', { originalError: err });
  }
}

// ─── P6-NOTIFICATIONS: Notification Preferences ──────────────────────────────

export async function getNotificationPreferences(userId: string): Promise<{ digestEmailsEnabled: boolean }> {
  try {
    const result = await database.query(
      `SELECT digest_emails_enabled AS "digestEmailsEnabled" FROM users WHERE id = $1`,
      [userId]
    );
    if (result.rows.length === 0) return { digestEmailsEnabled: true };
    return { digestEmailsEnabled: result.rows[0].digestEmailsEnabled ?? true };
  } catch (err) {
    throw new DatabaseError('Failed to get notification preferences', { originalError: err });
  }
}

export async function updateNotificationPreferences(userId: string, prefs: { digestEmailsEnabled?: boolean }): Promise<void> {
  try {
    await database.query(
      `UPDATE users SET digest_emails_enabled = COALESCE($2, digest_emails_enabled) WHERE id = $1`,
      [userId, prefs.digestEmailsEnabled !== undefined ? prefs.digestEmailsEnabled : null]
    );
  } catch (err) {
    throw new DatabaseError('Failed to update notification preferences', { originalError: err });
  }
}


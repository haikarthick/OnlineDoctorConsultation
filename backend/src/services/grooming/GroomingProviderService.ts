import database from '../../utils/database';
import logger from '../../utils/logger';
import { NotFoundError, ValidationError, ForbiddenError } from '../../utils/errors';

/**
 * Grooming provider onboarding + management (P1).
 * Data isolation: every provider-scoped action goes through resolveProviderAccess()
 * (owner or active staff of THAT provider) - mirrors the network-hospital membership gate.
 * A network-branch entity can never be a grooming provider (platform ≠ network boundary).
 */

export type ProviderRole = 'owner' | 'manager' | 'staff';

const PROVIDER_SELECT = `
  gp.id, gp.owner_user_id as "ownerUserId", gp.provider_type as "providerType",
  gp.business_name as "businessName", gp.slug, gp.description, gp.logo_url as "logoUrl",
  gp.contact_phone as "contactPhone", gp.contact_email as "contactEmail",
  gp.offers_at_premises as "offersAtPremises", gp.offers_mobile as "offersMobile",
  gp.operating_hours as "operatingHours", gp.supported_species as "supportedSpecies",
  gp.size_limits as "sizeLimits", gp.legal_name as "legalName", gp.pan, gp.gstin,
  gp.business_address as "businessAddress",
  gp.payout_account_name as "payoutAccountName", gp.payout_account_number as "payoutAccountNumber",
  gp.payout_ifsc as "payoutIfsc", gp.payout_upi as "payoutUpi",
  gp.verification_status as "verificationStatus", gp.verified_at as "verifiedAt",
  gp.rejection_reason as "rejectionReason", gp.is_paused as "isPaused",
  gp.rating, gp.total_reviews as "totalReviews", gp.total_orders as "totalOrders",
  gp.reliability_score as "reliabilityScore", gp.commission_override_percent as "commissionOverridePercent",
  gp.created_at as "createdAt", gp.updated_at as "updatedAt"
`;

function slugify(name: string): string {
  return (name || 'provider')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200) || 'provider';
}

class GroomingProviderService {
  /** Owner or active staff of a provider → their provider role, else null. */
  async resolveProviderAccess(userId: string, providerId: string): Promise<ProviderRole | null> {
    const owner = await database.query(
      `SELECT 1 FROM grooming_providers WHERE id = $1 AND owner_user_id = $2`,
      [providerId, userId]
    );
    if (owner.rows.length > 0) return 'owner';
    const staff = await database.query(
      `SELECT provider_role FROM grooming_provider_staff
       WHERE provider_id = $1 AND user_id = $2 AND is_active = true`,
      [providerId, userId]
    );
    return staff.rows[0]?.provider_role ?? null;
  }

  /** Require a role at least `manager` (owner/manager) for management actions. */
  private async requireManage(userId: string, providerId: string): Promise<ProviderRole> {
    const role = await this.resolveProviderAccess(userId, providerId);
    if (!role) throw new NotFoundError('GroomingProvider', providerId);
    if (role === 'staff') throw new ForbiddenError('Manager or owner access required');
    return role;
  }

  // ── Provider profile ──────────────────────────────────────
  async createProvider(userId: string, data: any): Promise<any> {
    // A user owns at most one provider (v1). If one exists, return it (idempotent onboarding entry).
    const existing = await database.query(
      `SELECT id FROM grooming_providers WHERE owner_user_id = $1`, [userId]
    );
    if (existing.rows.length > 0) {
      return this.getProviderById(existing.rows[0].id);
    }
    if (!data.businessName?.trim()) throw new ValidationError('businessName is required');
    let slug = slugify(data.businessName);
    // ensure unique slug
    const clash = await database.query(`SELECT 1 FROM grooming_providers WHERE slug = $1`, [slug]);
    if (clash.rows.length > 0) slug = `${slug}-${Math.random().toString(36).slice(2, 7)}`;

    const result = await database.query(
      `INSERT INTO grooming_providers
         (owner_user_id, provider_type, business_name, slug, description, logo_url,
          contact_phone, contact_email, offers_at_premises, offers_mobile,
          operating_hours, supported_species, size_limits,
          legal_name, pan, gstin, business_address,
          payout_account_name, payout_account_number, payout_ifsc, payout_upi,
          verification_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,'pending')
       RETURNING id`,
      [
        userId, data.providerType || 'groomer', data.businessName.trim(), slug,
        data.description || null, data.logoUrl || null,
        data.contactPhone || null, data.contactEmail || null,
        data.offersAtPremises !== false, data.offersMobile === true,
        JSON.stringify(data.operatingHours || {}),
        Array.isArray(data.supportedSpecies) ? data.supportedSpecies : [],
        JSON.stringify(data.sizeLimits || {}),
        data.legalName || null, data.pan || null, data.gstin || null, data.businessAddress || null,
        data.payoutAccountName || null, data.payoutAccountNumber || null,
        data.payoutIfsc || null, data.payoutUpi || null,
      ]
    );
    // Owner is also an owner-role staff member (so staff-scoped queries include them uniformly)
    await database.query(
      `INSERT INTO grooming_provider_staff (provider_id, user_id, provider_role, is_active)
       VALUES ($1, $2, 'owner', true) ON CONFLICT (provider_id, user_id) DO NOTHING`,
      [result.rows[0].id, userId]
    );
    // Grant the groomer base role additively (union model) so the owner's grooming nav/permissions
    // light up - works whether they were a fresh groomer, a vet, or a pet owner adding grooming.
    await database.query(
      `INSERT INTO user_roles (user_id, role, is_primary, granted_by) VALUES ($1, 'groomer', false, $1)
       ON CONFLICT (user_id, role) DO NOTHING`,
      [userId]
    );
    return this.getProviderById(result.rows[0].id);
  }

  async getProviderById(providerId: string): Promise<any> {
    const r = await database.query(`SELECT ${PROVIDER_SELECT} FROM grooming_providers gp WHERE gp.id = $1`, [providerId]);
    if (r.rows.length === 0) throw new NotFoundError('GroomingProvider', providerId);
    return r.rows[0];
  }

  /** The provider this user owns or staffs (v1: first one). null if none. */
  async getMyProvider(userId: string): Promise<any | null> {
    const r = await database.query(
      `SELECT ${PROVIDER_SELECT},
              CASE WHEN gp.owner_user_id = $1 THEN 'owner' ELSE gps.provider_role END as "myRole"
       FROM grooming_providers gp
       LEFT JOIN grooming_provider_staff gps
         ON gps.provider_id = gp.id AND gps.user_id = $1 AND gps.is_active = true
       WHERE gp.owner_user_id = $1 OR gps.user_id = $1
       ORDER BY (gp.owner_user_id = $1) DESC, gp.created_at ASC
       LIMIT 1`,
      [userId]
    );
    return r.rows[0] ?? null;
  }

  async updateProvider(userId: string, providerId: string, data: any): Promise<any> {
    await this.requireManage(userId, providerId);
    const map: Record<string, string> = {
      businessName: 'business_name', description: 'description', logoUrl: 'logo_url',
      contactPhone: 'contact_phone', contactEmail: 'contact_email',
      offersAtPremises: 'offers_at_premises', offersMobile: 'offers_mobile',
      providerType: 'provider_type',
      legalName: 'legal_name', pan: 'pan', gstin: 'gstin', businessAddress: 'business_address',
      payoutAccountName: 'payout_account_name', payoutAccountNumber: 'payout_account_number',
      payoutIfsc: 'payout_ifsc', payoutUpi: 'payout_upi', isPaused: 'is_paused',
    };
    const sets: string[] = []; const params: any[] = []; let i = 0;
    for (const [key, col] of Object.entries(map)) {
      if (data[key] !== undefined) { i++; sets.push(`${col} = $${i}`); params.push(data[key]); }
    }
    if (data.operatingHours !== undefined) { i++; sets.push(`operating_hours = $${i}`); params.push(JSON.stringify(data.operatingHours)); }
    if (data.supportedSpecies !== undefined) { i++; sets.push(`supported_species = $${i}`); params.push(Array.isArray(data.supportedSpecies) ? data.supportedSpecies : []); }
    if (data.sizeLimits !== undefined) { i++; sets.push(`size_limits = $${i}`); params.push(JSON.stringify(data.sizeLimits)); }
    if (sets.length === 0) return this.getProviderById(providerId);
    i++; params.push(providerId);
    await database.query(`UPDATE grooming_providers SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${i}`, params);
    return this.getProviderById(providerId);
  }

  // ── Locations ─────────────────────────────────────────────
  async listLocations(providerId: string): Promise<any[]> {
    const r = await database.query(
      `SELECT id, provider_id as "providerId", name, location_type as "locationType", address, city, state,
              postal_code as "postalCode", gps_latitude as "gpsLatitude", gps_longitude as "gpsLongitude",
              service_radius_km as "serviceRadiusKm", is_active as "isActive"
       FROM grooming_locations WHERE provider_id = $1 ORDER BY created_at ASC`, [providerId]);
    return r.rows;
  }
  async addLocation(userId: string, providerId: string, data: any): Promise<any> {
    await this.requireManage(userId, providerId);
    if (!data.name?.trim()) throw new ValidationError('Location name is required');
    const r = await database.query(
      `INSERT INTO grooming_locations
         (provider_id, name, location_type, address, city, state, postal_code, gps_latitude, gps_longitude, service_radius_km)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [providerId, data.name.trim(), data.locationType || 'premises', data.address || null, data.city || null,
       data.state || null, data.postalCode || null, data.gpsLatitude ?? null, data.gpsLongitude ?? null, data.serviceRadiusKm ?? null]);
    return (await this.listLocations(providerId)).find(l => l.id === r.rows[0].id);
  }
  async deleteLocation(userId: string, providerId: string, locationId: string): Promise<void> {
    await this.requireManage(userId, providerId);
    await database.query(`DELETE FROM grooming_locations WHERE id = $1 AND provider_id = $2`, [locationId, providerId]);
  }

  // ── Resources ─────────────────────────────────────────────
  async listResources(providerId: string): Promise<any[]> {
    const r = await database.query(
      `SELECT id, provider_id as "providerId", location_id as "locationId", name,
              resource_type as "resourceType", is_active as "isActive"
       FROM grooming_resources WHERE provider_id = $1 ORDER BY created_at ASC`, [providerId]);
    return r.rows;
  }
  async addResource(userId: string, providerId: string, data: any): Promise<any> {
    await this.requireManage(userId, providerId);
    if (!data.name?.trim()) throw new ValidationError('Resource name is required');
    const r = await database.query(
      `INSERT INTO grooming_resources (provider_id, location_id, name, resource_type)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [providerId, data.locationId || null, data.name.trim(), data.resourceType || 'grooming_table']);
    return (await this.listResources(providerId)).find(x => x.id === r.rows[0].id);
  }
  async deleteResource(userId: string, providerId: string, resourceId: string): Promise<void> {
    await this.requireManage(userId, providerId);
    await database.query(`DELETE FROM grooming_resources WHERE id = $1 AND provider_id = $2`, [resourceId, providerId]);
  }

  // ── Services ──────────────────────────────────────────────
  async listServices(providerId: string, opts?: { activeOnly?: boolean }): Promise<any[]> {
    const where = opts?.activeOnly ? `AND is_active = true AND is_paused = false` : '';
    const r = await database.query(
      `SELECT id, provider_id as "providerId", category_id as "categoryId", name, description,
              service_kind as "serviceKind", base_price as "basePrice", currency, duration_minutes as "durationMinutes",
              tax_percent as "taxPercent", payment_rule as "paymentRule", deposit_amount as "depositAmount",
              is_variable_price as "isVariablePrice", cancellation_policy as "cancellationPolicy",
              supported_species as "supportedSpecies", available_at_premises as "availableAtPremises",
              available_mobile as "availableMobile", is_active as "isActive", is_paused as "isPaused", sort_order as "sortOrder"
       FROM grooming_services WHERE provider_id = $1 ${where} ORDER BY sort_order ASC, created_at ASC`, [providerId]);
    return r.rows;
  }
  async addService(userId: string, providerId: string, data: any): Promise<any> {
    await this.requireManage(userId, providerId);
    if (!data.name?.trim()) throw new ValidationError('Service name is required');
    const r = await database.query(
      `INSERT INTO grooming_services
         (provider_id, category_id, name, description, service_kind, base_price, currency, duration_minutes,
          tax_percent, payment_rule, deposit_amount, is_variable_price, cancellation_policy, supported_species,
          available_at_premises, available_mobile, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id`,
      [providerId, data.categoryId || null, data.name.trim(), data.description || null,
       data.serviceKind || 'service', Number(data.basePrice) || 0, data.currency || 'INR',
       Number(data.durationMinutes) || 60, Number(data.taxPercent) || 0, data.paymentRule || 'full',
       Number(data.depositAmount) || 0, data.isVariablePrice === true, JSON.stringify(data.cancellationPolicy || {}),
       Array.isArray(data.supportedSpecies) ? data.supportedSpecies : [],
       data.availableAtPremises !== false, data.availableMobile === true, Number(data.sortOrder) || 0]);
    return (await this.listServices(providerId)).find(x => x.id === r.rows[0].id);
  }
  async updateService(userId: string, providerId: string, serviceId: string, data: any): Promise<any> {
    await this.requireManage(userId, providerId);
    const map: Record<string, string> = {
      categoryId: 'category_id', name: 'name', description: 'description', serviceKind: 'service_kind',
      basePrice: 'base_price', durationMinutes: 'duration_minutes', taxPercent: 'tax_percent',
      paymentRule: 'payment_rule', depositAmount: 'deposit_amount', isVariablePrice: 'is_variable_price',
      availableAtPremises: 'available_at_premises', availableMobile: 'available_mobile',
      isActive: 'is_active', isPaused: 'is_paused', sortOrder: 'sort_order',
    };
    const sets: string[] = []; const params: any[] = []; let i = 0;
    for (const [key, col] of Object.entries(map)) {
      if (data[key] !== undefined) { i++; sets.push(`${col} = $${i}`); params.push(data[key]); }
    }
    if (data.supportedSpecies !== undefined) { i++; sets.push(`supported_species = $${i}`); params.push(Array.isArray(data.supportedSpecies) ? data.supportedSpecies : []); }
    if (data.cancellationPolicy !== undefined) { i++; sets.push(`cancellation_policy = $${i}`); params.push(JSON.stringify(data.cancellationPolicy)); }
    if (sets.length === 0) return (await this.listServices(providerId)).find(x => x.id === serviceId);
    i++; params.push(serviceId); const idxService = i;
    i++; params.push(providerId);
    await database.query(`UPDATE grooming_services SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${idxService} AND provider_id = $${i}`, params);
    return (await this.listServices(providerId)).find(x => x.id === serviceId);
  }
  async deleteService(userId: string, providerId: string, serviceId: string): Promise<void> {
    await this.requireManage(userId, providerId);
    await database.query(`UPDATE grooming_services SET is_active = false, updated_at = NOW() WHERE id = $1 AND provider_id = $2`, [serviceId, providerId]);
  }

  // ── Staff ─────────────────────────────────────────────────
  async listStaff(providerId: string): Promise<any[]> {
    const r = await database.query(
      `SELECT gps.id, gps.user_id as "userId", gps.provider_role as "providerRole", gps.capabilities,
              gps.is_active as "isActive", u.first_name as "firstName", u.last_name as "lastName", u.email
       FROM grooming_provider_staff gps JOIN users u ON u.id = gps.user_id
       WHERE gps.provider_id = $1 ORDER BY gps.created_at ASC`, [providerId]);
    return r.rows;
  }
  /** Add an existing platform user (by email) as staff/manager, and grant them the groomer role. */
  async addStaffByEmail(userId: string, providerId: string, email: string, role: ProviderRole, invitedBy: string): Promise<any> {
    await this.requireManage(userId, providerId);
    if (role === 'owner') throw new ValidationError('Cannot assign owner role');
    const u = await database.query(`SELECT id FROM users WHERE email = $1`, [email.trim().toLowerCase()]);
    if (u.rows.length === 0) throw new NotFoundError('User', email);
    const staffUserId = u.rows[0].id;
    await database.query(
      `INSERT INTO grooming_provider_staff (provider_id, user_id, provider_role, invited_by, is_active)
       VALUES ($1,$2,$3,$4,true)
       ON CONFLICT (provider_id, user_id) DO UPDATE SET provider_role = EXCLUDED.provider_role, is_active = true`,
      [providerId, staffUserId, role, invitedBy]);
    // Grant the groomer base role additively (union model) so their nav/permissions light up.
    await database.query(
      `INSERT INTO user_roles (user_id, role, is_primary, granted_by) VALUES ($1, 'groomer', false, $2)
       ON CONFLICT (user_id, role) DO NOTHING`, [staffUserId, invitedBy]);
    return (await this.listStaff(providerId)).find(s => s.userId === staffUserId);
  }
  async removeStaff(userId: string, providerId: string, staffUserId: string): Promise<void> {
    await this.requireManage(userId, providerId);
    // Never remove the owner via this path
    await database.query(
      `UPDATE grooming_provider_staff SET is_active = false
       WHERE provider_id = $1 AND user_id = $2 AND provider_role <> 'owner'`, [providerId, staffUserId]);
  }

  // ── Public discovery (verified, not paused) ───────────────
  async listPublicProviders(filters: any = {}): Promise<{ providers: any[]; total: number }> {
    const params: any[] = []; let i = 0; let where = `WHERE gp.verification_status = 'verified' AND gp.is_paused = false`;
    if (filters.mobile === true) where += ` AND gp.offers_mobile = true`;
    if (filters.species) { i++; where += ` AND $${i} = ANY(gp.supported_species)`; params.push(filters.species); }
    if (filters.search) { i++; where += ` AND (gp.business_name ILIKE $${i} OR gp.description ILIKE $${i})`; params.push(`%${filters.search}%`); }
    const limit = Math.min(Number(filters.limit) || 20, 100);
    const offset = Number(filters.offset) || 0;
    const countRes = await database.query(`SELECT COUNT(*) FROM grooming_providers gp ${where}`, params);
    i++; params.push(limit); i++; params.push(offset);
    const listRes = await database.query(
      `SELECT ${PROVIDER_SELECT},
              (SELECT MIN(base_price) FROM grooming_services gs WHERE gs.provider_id = gp.id AND gs.is_active = true) as "priceFrom"
       FROM grooming_providers gp ${where}
       ORDER BY gp.rating DESC, gp.total_orders DESC
       LIMIT $${i-1} OFFSET $${i}`, params);
    return { providers: listRes.rows, total: parseInt(countRes.rows[0].count, 10) };
  }
  async getPublicProvider(providerId: string): Promise<any> {
    const p = await this.getProviderById(providerId);
    if (p.verificationStatus !== 'verified' || p.isPaused) throw new NotFoundError('GroomingProvider', providerId);
    const services = await this.listServices(providerId, { activeOnly: true });
    const locations = await this.listLocations(providerId);
    return { ...p, services, locations };
  }

  // ── Admin ─────────────────────────────────────────────────
  async adminListProviders(status: string = 'pending'): Promise<any[]> {
    const r = await database.query(
      `SELECT ${PROVIDER_SELECT}, u.email as "ownerEmail", u.first_name as "ownerFirstName", u.last_name as "ownerLastName"
       FROM grooming_providers gp JOIN users u ON u.id = gp.owner_user_id
       WHERE gp.verification_status = $1 ORDER BY gp.created_at ASC`, [status]);
    return r.rows;
  }
  async adminVerify(providerId: string, adminId: string): Promise<any> {
    const r = await database.query(
      `UPDATE grooming_providers SET verification_status = 'verified', verified_by = $2, verified_at = NOW(),
              rejection_reason = NULL, updated_at = NOW() WHERE id = $1 RETURNING id`, [providerId, adminId]);
    if (r.rows.length === 0) throw new NotFoundError('GroomingProvider', providerId);

    // A verified provider with no working hours is bookable on zero days, so it would look
    // permanently closed to every customer until someone found the schedule screen - the most
    // likely way a real booking is silently lost. Seed a default week; it is a no-op if the
    // provider has already set their own. Non-blocking: verification must still succeed.
    try {
      const GroomingScheduleService = (await import('./GroomingScheduleService')).default;
      await GroomingScheduleService.seedDefaultSchedule(providerId);
    } catch (err: any) {
      logger.warn('Default grooming schedule seed failed (non-blocking)', { providerId, error: err.message });
    }
    return this.getProviderById(providerId);
  }
  async adminReject(providerId: string, adminId: string, reason: string): Promise<any> {
    if (!reason?.trim()) throw new ValidationError('Rejection reason is required');
    const r = await database.query(
      `UPDATE grooming_providers SET verification_status = 'rejected', verified_by = $2, verified_at = NOW(),
              rejection_reason = $3, updated_at = NOW() WHERE id = $1 RETURNING id`, [providerId, adminId, reason.trim()]);
    if (r.rows.length === 0) throw new NotFoundError('GroomingProvider', providerId);
    return this.getProviderById(providerId);
  }
  async adminSuspend(providerId: string, adminId: string, reason: string): Promise<any> {
    const r = await database.query(
      `UPDATE grooming_providers SET verification_status = 'suspended', rejection_reason = $3, updated_at = NOW()
       WHERE id = $1 RETURNING id`, [providerId, adminId, reason?.trim() || null]);
    if (r.rows.length === 0) throw new NotFoundError('GroomingProvider', providerId);
    return this.getProviderById(providerId);
  }
}

export default new GroomingProviderService();

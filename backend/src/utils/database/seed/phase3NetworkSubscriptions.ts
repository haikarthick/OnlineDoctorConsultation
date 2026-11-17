import { Pool } from 'pg';
import logger from '../../logger';

import { SYSTEM_ROLES_SQL } from '../constants';

export async function phase3NetworkSubscriptions(pool: Pool): Promise<void> {
    // ── Network Subscription Plans (platform admin tiers) ──────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS network_subscription_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        description TEXT,
        max_seats INTEGER,
        max_hospitals INTEGER,
        price_monthly DECIMAL(10,2),
        price_annually DECIMAL(10,2),
        currency VARCHAR(10) DEFAULT 'INR',
        features JSONB DEFAULT '{}',
        is_published BOOLEAN DEFAULT false,
        sort_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `).catch(() => {});

    await pool.query(`
      CREATE TABLE IF NOT EXISTS network_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        network_id UUID NOT NULL REFERENCES hospital_networks(id) ON DELETE CASCADE,
        plan_id UUID REFERENCES network_subscription_plans(id) ON DELETE SET NULL,
        seat_limit INTEGER NOT NULL DEFAULT 5,
        status VARCHAR(20) NOT NULL DEFAULT 'trial'
          CHECK (status IN ('trial', 'active', 'suspended', 'expired', 'cancelled')),
        billing_cycle VARCHAR(20) DEFAULT 'none'
          CHECK (billing_cycle IN ('monthly', 'annually', 'custom', 'none')),
        starts_at TIMESTAMP NOT NULL DEFAULT NOW(),
        ends_at TIMESTAMP,
        suspended_at TIMESTAMP,
        suspended_by UUID REFERENCES users(id) ON DELETE SET NULL,
        suspension_reason TEXT,
        admin_notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(network_id)
      )
    `).catch(() => {});

    await pool.query(`
      CREATE TABLE IF NOT EXISTS hospital_staff_invites (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        network_id UUID NOT NULL REFERENCES hospital_networks(id) ON DELETE CASCADE,
        hospital_id UUID REFERENCES vet_hospitals(id) ON DELETE SET NULL,
        invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        invitee_email VARCHAR(255) NOT NULL,
        invitee_name VARCHAR(200) NOT NULL,
        staff_position VARCHAR(50) NOT NULL
          CHECK (staff_position IN (
            'nurse','technician','receptionist','lab_tech',
            'radiologist','anesthesiologist','pharmacist','intern','admin_staff'
          )),
        invite_token VARCHAR(128) NOT NULL UNIQUE,
        status VARCHAR(20) DEFAULT 'pending'
          CHECK (status IN ('pending','accepted','expired','revoked')),
        expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '72 hours'),
        accepted_at TIMESTAMPTZ,
        accepted_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `).catch(() => {});

    // Seed 5 default subscription plans if none exist (prices NULL = private)
    const planCount = await pool.query(`SELECT COUNT(*) FROM network_subscription_plans`).catch(() => ({ rows: [{ count: '0' }] }));
    if (parseInt(planCount.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO network_subscription_plans (name, description, max_seats, max_hospitals, sort_order, is_published)
        VALUES
          ('Trial',      '30-day free trial for new networks',            5,    1,  0, false),
          ('Starter',    'For small clinics and single-hospital networks', 20,   2,  1, false),
          ('Growth',     'For growing multi-hospital networks',            75,   5,  2, false),
          ('Enterprise', 'For large hospital chains',                      250,  20, 3, false),
          ('Unlimited',  'Custom enterprise agreements',                   NULL, NULL, 4, false)
        ON CONFLICT DO NOTHING
      `).catch(() => {});
    }

    // Seed pricing visibility settings in platform_settings (key-value)
    const pricingKeys = [
      ['pricing.visibility.global',          'false'],
      ['pricing.visibility.landing_page',     'false'],
      ['pricing.visibility.registration',     'false'],
      ['pricing.visibility.corp_dashboard',   'false'],
      ['pricing.visibility.upgrade_prompts',  'false'],
      ['pricing.cta_text',                    'Contact us for pricing'],
      ['pricing.cta_email',                   ''],
      ['pricing.cta_phone',                   ''],
    ];
    for (const [key, value] of pricingKeys) {
      await pool.query(
        `INSERT INTO system_settings (key, value, description)
         VALUES ($1, $2, $3)
         ON CONFLICT (key) DO NOTHING`,
        [key, value, `Pricing visibility control: ${key}`]
      ).catch(() => {});
    }

    // Also ensure users.role CHECK covers every system role (see SYSTEM_ROLES - never inline
    // the list here again, it is what silently reverted migration 030 on every boot)
    await pool.query(`
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check
    `).catch(() => {});
    await pool.query(`
      ALTER TABLE users ADD CONSTRAINT users_role_check
        CHECK (role IN (${SYSTEM_ROLES_SQL}))
    `).catch(() => {});

    // Marketplace performance indexes - critical for free-tier Render cold-start
    // These are idempotent (CREATE INDEX IF NOT EXISTS) so safe to run on every startup
    const marketplaceIndexes = [
      `CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status_approved ON marketplace_listings(status, admin_approved)`,
      `CREATE INDEX IF NOT EXISTS idx_marketplace_listings_hot_deal ON marketplace_listings(is_hot_deal, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status ON marketplace_listings(status)`,
      `CREATE INDEX IF NOT EXISTS idx_marketplace_bids_listing_status ON marketplace_bids(listing_id, status)`,
    ];
    for (const ddl of marketplaceIndexes) {
      await pool.query(ddl).catch(() => {});
    }

    // Enterprise alignment - add enterprise context to clinical tables
    const enterpriseAlignmentDDL = [
      `ALTER TABLE inpatient_admissions ADD COLUMN IF NOT EXISTS enterprise_id UUID REFERENCES enterprises(id) ON DELETE SET NULL`,
      `ALTER TABLE inpatient_admissions ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES animal_groups(id) ON DELETE SET NULL`,
      `ALTER TABLE inpatient_admissions ADD COLUMN IF NOT EXISTS network_id UUID REFERENCES hospital_networks(id)`,
      `ALTER TABLE workflow_cases ADD COLUMN IF NOT EXISTS enterprise_id UUID REFERENCES enterprises(id) ON DELETE SET NULL`,
      `ALTER TABLE referrals ADD COLUMN IF NOT EXISTS enterprise_id UUID REFERENCES enterprises(id) ON DELETE SET NULL`,
      `ALTER TABLE appointment_queue ADD COLUMN IF NOT EXISTS enterprise_id UUID REFERENCES enterprises(id) ON DELETE SET NULL`,
      `ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS enterprise_id UUID REFERENCES enterprises(id) ON DELETE SET NULL`,
      `ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES animal_groups(id) ON DELETE SET NULL`,
      `ALTER TABLE movement_records ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','completed'))`,
      `ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS enterprise_id UUID REFERENCES enterprises(id) ON DELETE SET NULL`,
      `ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES animal_groups(id) ON DELETE SET NULL`,
    ];
    for (const ddl of enterpriseAlignmentDDL) {
      await pool.query(ddl).catch(() => {});
    }

    // campaign_animals junction table for treatment tracking
    await pool.query(`
      CREATE TABLE IF NOT EXISTS campaign_animals (
        campaign_id UUID NOT NULL REFERENCES treatment_campaigns(id) ON DELETE CASCADE,
        animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','completed','skipped')),
        vaccination_record_id UUID REFERENCES vaccination_records(id) ON DELETE SET NULL,
        completed_at TIMESTAMP,
        PRIMARY KEY (campaign_id, animal_id)
      )
    `).catch(() => {});

    // Reviews integrity: unique constraint prevents duplicate reviews per consultation per reviewer
    await pool.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'reviews_consultation_reviewer_unique'
        ) THEN
          ALTER TABLE reviews ADD CONSTRAINT reviews_consultation_reviewer_unique
            UNIQUE (consultation_id, reviewer_id);
        END IF;
      END $$;
    `).catch(() => {});

    // Ensure total_reviews column on vet_profiles (safe on existing DBs)
    await pool.query(
      `ALTER TABLE vet_profiles ADD COLUMN IF NOT EXISTS total_reviews INTEGER DEFAULT 0`
    ).catch(() => {});

    // Network referrals table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS network_referrals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        network_id UUID REFERENCES hospital_networks(id) ON DELETE SET NULL,
        from_hospital_id UUID REFERENCES vet_hospitals(id) ON DELETE SET NULL,
        to_hospital_id UUID REFERENCES vet_hospitals(id) ON DELETE SET NULL,
        from_vet_id UUID REFERENCES users(id) ON DELETE SET NULL,
        to_vet_id UUID REFERENCES users(id) ON DELETE SET NULL,
        animal_id UUID REFERENCES animals(id) ON DELETE CASCADE,
        consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
        reason TEXT NOT NULL,
        priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'emergency')),
        status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'completed', 'cancelled')),
        clinical_notes TEXT,
        response_notes TEXT,
        accepted_at TIMESTAMPTZ,
        rejected_at TIMESTAMPTZ,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `).catch(() => {});

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_network_referrals_network_id ON network_referrals(network_id)
    `).catch(() => {});
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_network_referrals_to_hospital ON network_referrals(to_hospital_id, status)
    `).catch(() => {});
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_network_referrals_animal ON network_referrals(animal_id)
    `).catch(() => {});

    // Add referral_type column for transfer support
    await pool.query(
      `ALTER TABLE network_referrals ADD COLUMN IF NOT EXISTS referral_type VARCHAR(20) DEFAULT 'referral' CHECK (referral_type IN ('referral', 'transfer'))`
    ).catch(() => {});
    await pool.query(
      `ALTER TABLE network_referrals ADD COLUMN IF NOT EXISTS transfer_reason TEXT`
    ).catch(() => {});
    await pool.query(
      `ALTER TABLE network_referrals ADD COLUMN IF NOT EXISTS transferred_at TIMESTAMPTZ`
    ).catch(() => {});

    // Staff leave requests table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS staff_leave_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        network_id UUID REFERENCES hospital_networks(id) ON DELETE CASCADE,
        hospital_id UUID REFERENCES vet_hospitals(id) ON DELETE SET NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        leave_type VARCHAR(30) NOT NULL DEFAULT 'annual'
          CHECK (leave_type IN ('annual', 'sick', 'personal', 'maternity', 'paternity', 'unpaid', 'training', 'other')),
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        reason TEXT,
        status VARCHAR(20) DEFAULT 'pending'
          CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
        approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
        approved_at TIMESTAMPTZ,
        rejection_reason TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `).catch(() => {});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_leave_requests_network ON staff_leave_requests(network_id)`).catch(() => {});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_leave_requests_user ON staff_leave_requests(user_id)`).catch(() => {});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_leave_requests_hospital ON staff_leave_requests(hospital_id)`).catch(() => {});

    // Missing FK indexes - prevent full table scans on common JOINs
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_consultations_animal_id ON consultations(animal_id)`).catch(() => {});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_bookings_animal_id ON bookings(animal_id)`).catch(() => {});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_bookings_consultation_id ON bookings(consultation_id)`).catch(() => {});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_prescriptions_animal_id ON prescriptions(animal_id)`).catch(() => {});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_medical_records_animal_id ON medical_records(animal_id)`).catch(() => {});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_network_referrals_consultation_id ON network_referrals(consultation_id)`).catch(() => {});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_workflow_cases_animal_id ON workflow_cases(animal_id)`).catch(() => {});

    // Prevent accidental animal deletion when consultations exist
    await pool.query(`
      ALTER TABLE consultations DROP CONSTRAINT IF EXISTS consultations_animal_id_fkey
    `).catch(() => {});
    await pool.query(`
      ALTER TABLE consultations ADD CONSTRAINT consultations_animal_id_fkey
      FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE RESTRICT
    `).catch(() => {});

    // Branch hospital support columns on vet_hospitals
    await pool.query(`ALTER TABLE vet_hospitals ADD COLUMN IF NOT EXISTS is_network_branch BOOLEAN DEFAULT false`).catch(() => {});
    await pool.query(`ALTER TABLE vet_hospitals ADD COLUMN IF NOT EXISTS branch_network_id UUID REFERENCES hospital_networks(id) ON DELETE SET NULL`).catch(() => {});

    // hospital_network_hospitals junction table (branch hospital ↔ network)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS hospital_network_hospitals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        network_id UUID NOT NULL REFERENCES hospital_networks(id) ON DELETE CASCADE,
        hospital_id UUID NOT NULL REFERENCES vet_hospitals(id) ON DELETE CASCADE,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        UNIQUE(network_id, hospital_id)
      )
    `).catch(() => {});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_hn_hospitals_network_id ON hospital_network_hospitals(network_id)`).catch(() => {});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_hn_hospitals_hospital_id ON hospital_network_hospitals(hospital_id)`).catch(() => {});

    // Ensure vet_hospitals.verification_status allows 'approved'
    await pool.query(`ALTER TABLE vet_hospitals DROP CONSTRAINT IF EXISTS vet_hospitals_verification_status_check`).catch(() => {});
    await pool.query(`
      ALTER TABLE vet_hospitals ADD CONSTRAINT vet_hospitals_verification_status_check
      CHECK (verification_status IN ('pending_documents', 'under_review', 'approved', 'rejected', 'expired'))
    `).catch(() => {});

    // Make invitee_name optional on hospital_staff_invites (label says "(optional)")
    await pool.query(`ALTER TABLE hospital_staff_invites ALTER COLUMN invitee_name DROP NOT NULL`).catch(() => {});

    // Network Custom Roles table (safety net - canonical schema is in init.sql)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS network_custom_roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        network_id UUID NOT NULL REFERENCES hospital_networks(id) ON DELETE CASCADE,
        role_key VARCHAR(50) NOT NULL,
        display_name VARCHAR(100) NOT NULL,
        description TEXT,
        base_template VARCHAR(50) NOT NULL DEFAULT 'hospital_staff',
        icon VARCHAR(10) DEFAULT '👤',
        is_active BOOLEAN DEFAULT true,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(network_id, role_key)
      )
    `).catch(() => {});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_ncr_network ON network_custom_roles(network_id)`).catch(() => {});

    // Make users.phone nullable - hospital_staff registering via invite may not have a phone
    await pool.query(`ALTER TABLE users ALTER COLUMN phone DROP NOT NULL`).catch(() => {});

    // Add unique constraint to staff_positions if not exists (needed for ON CONFLICT)
    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE staff_positions ADD CONSTRAINT staff_positions_hospital_user_unique UNIQUE (hospital_id, user_id);
      EXCEPTION WHEN duplicate_table THEN NULL;
      END $$;
    `).catch(() => {});

    // Email settings defaults
    await pool.query(`
      INSERT INTO system_settings (key, value, description, category) VALUES
        ('email.devRedirect', '', 'Dev/demo email redirect address (all emails go here when set)', 'email'),
        ('email.fromName', 'waytovet', 'Email sender display name', 'email'),
        ('email.fromAddress', 'noreply@vetcare.app', 'Email sender address', 'email')
      ON CONFLICT (key) DO NOTHING
    `).catch(() => {});

    // Network security audit log table (P2-GAP1)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS network_security_audit (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        network_id UUID NOT NULL REFERENCES hospital_networks(id) ON DELETE CASCADE,
        actor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        action VARCHAR(100) NOT NULL,
        target_type VARCHAR(50),
        target_id VARCHAR(255),
        old_value JSONB,
        new_value JSONB,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => {});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_nsa_network ON network_security_audit(network_id)`).catch(() => {});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_nsa_actor ON network_security_audit(actor_id)`).catch(() => {});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_nsa_created ON network_security_audit(created_at DESC)`).catch(() => {});

    // Time-bound membership columns on hospital_network_members (P2-GAP3)
    await pool.query(`ALTER TABLE hospital_network_members ADD COLUMN IF NOT EXISTS valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP`).catch(() => {});
    await pool.query(`ALTER TABLE hospital_network_members ADD COLUMN IF NOT EXISTS valid_until TIMESTAMP`).catch(() => {});

    // P3-CRITICAL1: Add network_id to medical data tables
    for (const table of ['consultations', 'prescriptions', 'medical_records', 'lab_results', 'vaccination_records', 'workflow_cases', 'video_sessions']) {
      await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS network_id UUID REFERENCES hospital_networks(id) ON DELETE SET NULL`).catch(() => {});
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_${table}_network ON ${table}(network_id)`).catch(() => {});
    }

    // P4-HIGH1: user_roles table (secondary roles, additive)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_roles (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL CHECK (role IN (${SYSTEM_ROLES_SQL})),
        is_primary BOOLEAN DEFAULT false,
        granted_by UUID REFERENCES users(id),
        granted_at TIMESTAMPTZ DEFAULT NOW(),
        notes TEXT,
        UNIQUE(user_id, role)
      )
    `).catch(() => {});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id)`).catch(() => {});

    // Backfill user_roles from users.role for existing users (idempotent via ON CONFLICT DO NOTHING)
    await pool.query(`
      INSERT INTO user_roles (user_id, role, is_primary, granted_at)
      SELECT id, role, true, created_at FROM users
      ON CONFLICT (user_id, role) DO NOTHING
    `).catch(() => {});

    // P4-MED1: animal_care_contexts.hospital_id safety-net (already in init.sql CREATE TABLE)
    await pool.query(
      `ALTER TABLE animal_care_contexts ADD COLUMN IF NOT EXISTS hospital_id UUID REFERENCES vet_hospitals(id) ON DELETE SET NULL`
    ).catch(() => {});

    // P4-MED2: Link platform referrals ↔ network referrals
    await pool.query(
      `ALTER TABLE referrals ADD COLUMN IF NOT EXISTS network_referral_id UUID REFERENCES network_referrals(id) ON DELETE SET NULL`
    ).catch(() => {});
    await pool.query(
      `ALTER TABLE network_referrals ADD COLUMN IF NOT EXISTS platform_referral_id UUID REFERENCES referrals(id) ON DELETE SET NULL`
    ).catch(() => {});

    // P6-BRANDING: New branding/operational columns for hospital_networks
    await pool.query(`ALTER TABLE hospital_networks ADD COLUMN IF NOT EXISTS website_url TEXT`).catch(() => {});
    await pool.query(`ALTER TABLE hospital_networks ADD COLUMN IF NOT EXISTS operating_hours JSONB`).catch(() => {});
    await pool.query(`ALTER TABLE hospital_networks ADD COLUMN IF NOT EXISTS specializations TEXT[]`).catch(() => {});
    await pool.query(`ALTER TABLE hospital_networks ADD COLUMN IF NOT EXISTS emergency_services BOOLEAN DEFAULT false`).catch(() => {});
    // Widen existing varchar columns to TEXT for base64 storage
    await pool.query(`ALTER TABLE hospital_networks ALTER COLUMN logo_url TYPE TEXT`).catch(() => {});
    await pool.query(`ALTER TABLE hospital_networks ALTER COLUMN website TYPE TEXT`).catch(() => {});
    await pool.query(`ALTER TABLE hospital_networks ALTER COLUMN contact_phone TYPE VARCHAR(50)`).catch(() => {});

    // P6-APPROVAL: network_approval_events table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS network_approval_events (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        network_id UUID NOT NULL REFERENCES hospital_networks(id) ON DELETE CASCADE,
        event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
          'submitted','under_review','info_requested','info_provided','approved','rejected','suspended','reactivated'
        )),
        actor_id UUID NOT NULL REFERENCES users(id),
        actor_role VARCHAR(50) NOT NULL,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `).catch(() => {});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_network_approval_network_id ON network_approval_events(network_id)`).catch(() => {});

    // P6-NOTIFICATIONS: digest preference column on users
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS digest_emails_enabled BOOLEAN DEFAULT true`).catch(() => {});

    // H2: Safety-net - medical_records.consultation_id (already in init.sql but may be missing on older DBs)
    await pool.query(`ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL`).catch(() => {});

    // H6: invite_status on hospital_network_members for pending/active invite flow
    await pool.query(`ALTER TABLE hospital_network_members ADD COLUMN IF NOT EXISTS invite_status VARCHAR(20) DEFAULT 'active'`).catch(() => {});

    // Fix dangerous CASCADE deletes (existing DB migration)
    await pool.query(`
      DO $$ BEGIN
        -- consultations.veterinarian_id: CASCADE → RESTRICT
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'consultations_veterinarian_id_fkey') THEN
          ALTER TABLE consultations DROP CONSTRAINT consultations_veterinarian_id_fkey;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'consultations_veterinarian_id_fkey') THEN
          ALTER TABLE consultations ADD CONSTRAINT consultations_veterinarian_id_fkey
            FOREIGN KEY (veterinarian_id) REFERENCES users(id) ON DELETE RESTRICT;
        END IF;
        -- bookings.veterinarian_id: CASCADE → RESTRICT
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_veterinarian_id_fkey') THEN
          ALTER TABLE bookings DROP CONSTRAINT bookings_veterinarian_id_fkey;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_veterinarian_id_fkey') THEN
          ALTER TABLE bookings ADD CONSTRAINT bookings_veterinarian_id_fkey
            FOREIGN KEY (veterinarian_id) REFERENCES users(id) ON DELETE RESTRICT;
        END IF;
        -- prescriptions.veterinarian_id: CASCADE → RESTRICT
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prescriptions_veterinarian_id_fkey') THEN
          ALTER TABLE prescriptions DROP CONSTRAINT prescriptions_veterinarian_id_fkey;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prescriptions_veterinarian_id_fkey') THEN
          ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_veterinarian_id_fkey
            FOREIGN KEY (veterinarian_id) REFERENCES users(id) ON DELETE RESTRICT;
        END IF;
        -- workflow_transitions.transitioned_by: CASCADE → SET NULL (preserve audit trail)
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workflow_transitions_transitioned_by_fkey') THEN
          ALTER TABLE workflow_transitions DROP CONSTRAINT workflow_transitions_transitioned_by_fkey;
        END IF;
        ALTER TABLE workflow_transitions ALTER COLUMN transitioned_by DROP NOT NULL;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workflow_transitions_transitioned_by_fkey') THEN
          ALTER TABLE workflow_transitions ADD CONSTRAINT workflow_transitions_transitioned_by_fkey
            FOREIGN KEY (transitioned_by) REFERENCES users(id) ON DELETE SET NULL;
        END IF;
        -- referrals.from_vet_id and to_vet_id: CASCADE → SET NULL
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'referrals_from_vet_id_fkey') THEN
          ALTER TABLE referrals DROP CONSTRAINT referrals_from_vet_id_fkey;
        END IF;
        ALTER TABLE referrals ALTER COLUMN from_vet_id DROP NOT NULL;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'referrals_from_vet_id_fkey') THEN
          ALTER TABLE referrals ADD CONSTRAINT referrals_from_vet_id_fkey
            FOREIGN KEY (from_vet_id) REFERENCES users(id) ON DELETE SET NULL;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'referrals_to_vet_id_fkey') THEN
          ALTER TABLE referrals DROP CONSTRAINT referrals_to_vet_id_fkey;
        END IF;
        ALTER TABLE referrals ALTER COLUMN to_vet_id DROP NOT NULL;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'referrals_to_vet_id_fkey') THEN
          ALTER TABLE referrals ADD CONSTRAINT referrals_to_vet_id_fkey
            FOREIGN KEY (to_vet_id) REFERENCES users(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `).catch((e: any) => logger.warn('FK migration warning:', e.message));

    // Disputes table safety net
    await pool.query(`CREATE TABLE IF NOT EXISTS disputes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      reported_by UUID REFERENCES users(id) ON DELETE SET NULL,
      booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
      consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
      subject VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      dispute_type VARCHAR(50) NOT NULL,
      status VARCHAR(20) DEFAULT 'open',
      resolution TEXT,
      resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
      resolved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`).catch(() => {});

    // Ensure department column exists on hospital_network_members
    await pool.query(`ALTER TABLE hospital_network_members ADD COLUMN IF NOT EXISTS department VARCHAR(100)`).catch(() => {});

}

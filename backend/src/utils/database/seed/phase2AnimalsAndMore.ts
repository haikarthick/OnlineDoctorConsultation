import { Pool } from 'pg';

export async function phase2AnimalsAndMore(pool: Pool): Promise<void> {
    // Ensure animals columns added after initial table creation
    const animalColumns = [
      `ALTER TABLE animals ADD COLUMN IF NOT EXISTS enterprise_id UUID`,
      `ALTER TABLE animals ADD COLUMN IF NOT EXISTS group_id UUID`,
      `ALTER TABLE animals ADD COLUMN IF NOT EXISTS breeding_status VARCHAR(50)`,
      `ALTER TABLE animals ADD COLUMN IF NOT EXISTS last_breeding_date DATE`,
      `ALTER TABLE animals ADD COLUMN IF NOT EXISTS expected_due_date DATE`,
      `ALTER TABLE animals ADD COLUMN IF NOT EXISTS current_weight DECIMAL(8,2)`,
      `ALTER TABLE animals ADD COLUMN IF NOT EXISTS weight_unit VARCHAR(10) DEFAULT 'kg'`,
      `ALTER TABLE animals ADD COLUMN IF NOT EXISTS last_weighed_at TIMESTAMP`,
      `ALTER TABLE animals ADD COLUMN IF NOT EXISTS current_location_id UUID`,
      `ALTER TABLE animals ADD COLUMN IF NOT EXISTS avatar_url TEXT`,
      `ALTER TABLE animals ADD COLUMN IF NOT EXISTS animal_class VARCHAR(30)`,
    ];
    for (const ddl of animalColumns) {
      await pool.query(ddl).catch(() => {});
    }

    // animal_class is filtered/grouped on in MarketplaceService's search + aggregation
    // queries (both marketplace_listings and animals) with no backing index - added here
    // as a safety net for DBs that predate this column on marketplace_listings too.
    await pool.query(`ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS animal_class VARCHAR(30)`).catch(() => {});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_marketplace_listings_animal_class ON marketplace_listings(animal_class)`).catch(() => {});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_animals_animal_class ON animals(animal_class)`).catch(() => {});

    // Widen avatar_url columns from VARCHAR(500) to TEXT (base64 photos exceed 500 chars)
    const widenAvatarUrl = [
      `ALTER TABLE animals ALTER COLUMN avatar_url TYPE TEXT`,
      `ALTER TABLE users ALTER COLUMN avatar_url TYPE TEXT`,
    ];
    for (const ddl of widenAvatarUrl) {
      await pool.query(ddl).catch(() => {});
    }

    // Ensure vet_hospitals columns added after initial table creation
    const hospitalColumns = [
      `ALTER TABLE vet_hospitals ADD COLUMN IF NOT EXISTS accreditation_body VARCHAR(255)`,
      `ALTER TABLE vet_hospitals ADD COLUMN IF NOT EXISTS accreditation_number VARCHAR(100)`,
      `ALTER TABLE vet_hospitals ADD COLUMN IF NOT EXISTS accreditation_expiry DATE`,
      `ALTER TABLE vet_hospitals ADD COLUMN IF NOT EXISTS gps_latitude DECIMAL(10,8)`,
      `ALTER TABLE vet_hospitals ADD COLUMN IF NOT EXISTS gps_longitude DECIMAL(11,8)`,
      `ALTER TABLE vet_hospitals ADD COLUMN IF NOT EXISTS has_ambulance BOOLEAN DEFAULT false`,
      `ALTER TABLE vet_hospitals ADD COLUMN IF NOT EXISTS has_pharmacy BOOLEAN DEFAULT false`,
      `ALTER TABLE vet_hospitals ADD COLUMN IF NOT EXISTS has_lab BOOLEAN DEFAULT false`,
      `ALTER TABLE vet_hospitals ADD COLUMN IF NOT EXISTS has_imaging BOOLEAN DEFAULT false`,
      `ALTER TABLE vet_hospitals ADD COLUMN IF NOT EXISTS has_surgery BOOLEAN DEFAULT false`,
      `ALTER TABLE vet_hospitals ADD COLUMN IF NOT EXISTS has_icu BOOLEAN DEFAULT false`,
      `ALTER TABLE vet_hospitals ADD COLUMN IF NOT EXISTS established_year INTEGER`,
      `ALTER TABLE vet_hospitals ADD COLUMN IF NOT EXISTS total_beds INTEGER DEFAULT 0`,
      `ALTER TABLE vet_hospitals ADD COLUMN IF NOT EXISTS icu_beds INTEGER DEFAULT 0`,
      `ALTER TABLE vet_hospitals ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) DEFAULT 'pending_documents'`,
      `ALTER TABLE vet_hospitals ADD COLUMN IF NOT EXISTS drug_license_expiry DATE`,
      `ALTER TABLE vet_hospitals ADD COLUMN IF NOT EXISTS trade_license_expiry DATE`,
      `ALTER TABLE vet_hospitals ADD COLUMN IF NOT EXISTS registration_renewal_date DATE`,
    ];
    for (const ddl of hospitalColumns) {
      await pool.query(ddl).catch(() => {});
    }

    // Ensure enterprise-related columns added after initial table creation
    const enterpriseColumns = [
      `ALTER TABLE enterprises ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20)`,
      `ALTER TABLE enterprises ADD COLUMN IF NOT EXISTS gps_latitude DECIMAL(10,8)`,
      `ALTER TABLE enterprises ADD COLUMN IF NOT EXISTS gps_longitude DECIMAL(11,8)`,
      `ALTER TABLE enterprises ADD COLUMN IF NOT EXISTS total_area DECIMAL(12,2)`,
      `ALTER TABLE enterprises ADD COLUMN IF NOT EXISTS area_unit VARCHAR(50)`,
      `ALTER TABLE enterprises ADD COLUMN IF NOT EXISTS license_number VARCHAR(100)`,
      `ALTER TABLE enterprises ADD COLUMN IF NOT EXISTS regulatory_id VARCHAR(100)`,
      `ALTER TABLE enterprises ADD COLUMN IF NOT EXISTS tax_id VARCHAR(100)`,
      `ALTER TABLE enterprises ADD COLUMN IF NOT EXISTS phone VARCHAR(30)`,
      `ALTER TABLE enterprises ADD COLUMN IF NOT EXISTS email VARCHAR(255)`,
      `ALTER TABLE enterprises ADD COLUMN IF NOT EXISTS website VARCHAR(500)`,
      `ALTER TABLE enterprises ADD COLUMN IF NOT EXISTS owner_id UUID`,
      `ALTER TABLE enterprises ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`,
    ];
    for (const ddl of enterpriseColumns) {
      await pool.query(ddl).catch(() => {});
    }

    // Ensure animal_groups columns added after initial table creation
    const animalGroupColumns = [
      `ALTER TABLE animal_groups ADD COLUMN IF NOT EXISTS species VARCHAR(100)`,
      `ALTER TABLE animal_groups ADD COLUMN IF NOT EXISTS breed VARCHAR(100)`,
      `ALTER TABLE animal_groups ADD COLUMN IF NOT EXISTS purpose VARCHAR(255)`,
      `ALTER TABLE animal_groups ADD COLUMN IF NOT EXISTS target_count INTEGER DEFAULT 0`,
      `ALTER TABLE animal_groups ADD COLUMN IF NOT EXISTS current_count INTEGER DEFAULT 0`,
      `ALTER TABLE animal_groups ADD COLUMN IF NOT EXISTS color_code VARCHAR(20)`,
      `ALTER TABLE animal_groups ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`,
    ];
    for (const ddl of animalGroupColumns) {
      await pool.query(ddl).catch(() => {});
    }

    // Ensure users columns added after initial table creation
    const userColumns = [
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS default_enterprise_id UUID`,
    ];
    for (const ddl of userColumns) {
      await pool.query(ddl).catch(() => {});
    }

    // Ensure medical record related columns added after initial table creation
    const medicalColumns = [
      `ALTER TABLE medical_record_audit_log ADD COLUMN IF NOT EXISTS changed_by UUID`,
      `ALTER TABLE medical_record_audit_log ADD COLUMN IF NOT EXISTS changed_by_name VARCHAR(255)`,
      `ALTER TABLE medical_record_audit_log ADD COLUMN IF NOT EXISTS old_values JSONB`,
      `ALTER TABLE medical_record_audit_log ADD COLUMN IF NOT EXISTS new_values JSONB`,
      `ALTER TABLE medical_record_audit_log ADD COLUMN IF NOT EXISTS change_reason TEXT`,
      `ALTER TABLE medical_record_audit_log ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45)`,
      `ALTER TABLE vaccination_records ADD COLUMN IF NOT EXISTS site_of_administration VARCHAR(255)`,
      `ALTER TABLE vaccination_records ADD COLUMN IF NOT EXISTS created_by UUID`,
      `ALTER TABLE weight_history ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
      `ALTER TABLE lab_results ADD COLUMN IF NOT EXISTS consultation_id UUID`,
      `ALTER TABLE lab_results ADD COLUMN IF NOT EXISTS verified_by UUID`,
      `ALTER TABLE lab_results ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'`,
    ];
    for (const ddl of medicalColumns) {
      await pool.query(ddl).catch(() => {});
    }

    // Ensure marketplace monetization tables exist (safety net)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS marketplace_monetization_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value JSONB NOT NULL DEFAULT '{}',
        is_enabled BOOLEAN DEFAULT false,
        description TEXT,
        category VARCHAR(50) DEFAULT 'general',
        updated_by UUID REFERENCES users(id),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `).catch(() => {});
    await pool.query(`
      CREATE TABLE IF NOT EXISTS marketplace_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        description TEXT,
        price NUMERIC(10,2) NOT NULL DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'INR',
        duration_days INTEGER NOT NULL DEFAULT 30,
        features JSONB NOT NULL DEFAULT '{}',
        max_listings INTEGER,
        max_boosts_per_month INTEGER DEFAULT 0,
        priority_support BOOLEAN DEFAULT false,
        analytics_access BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `).catch(() => {});
    await pool.query(`
      CREATE TABLE IF NOT EXISTS marketplace_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        plan_id UUID NOT NULL REFERENCES marketplace_plans(id),
        status VARCHAR(20) DEFAULT 'active',
        starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        auto_renew BOOLEAN DEFAULT false,
        cancelled_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `).catch(() => {});
    await pool.query(`
      CREATE TABLE IF NOT EXISTS listing_boosts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        listing_id UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id),
        boost_type VARCHAR(30) DEFAULT 'standard',
        price_paid NUMERIC(10,2) DEFAULT 0,
        starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `).catch(() => {});
    await pool.query(`
      CREATE TABLE IF NOT EXISTS marketplace_inquiries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        listing_id UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
        buyer_id UUID NOT NULL REFERENCES users(id),
        seller_id UUID NOT NULL REFERENCES users(id),
        message TEXT,
        contact_revealed BOOLEAN DEFAULT false,
        fee_charged NUMERIC(10,2) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'pending',
        responded_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `).catch(() => {});
    await pool.query(`
      CREATE TABLE IF NOT EXISTS marketplace_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        transaction_type VARCHAR(30) NOT NULL,
        amount NUMERIC(10,2) NOT NULL DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'INR',
        status VARCHAR(20) DEFAULT 'completed',
        reference_id UUID,
        reference_type VARCHAR(30),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `).catch(() => {});

    // Seed default monetization settings (all disabled)
    const monetizationDefaults = [
      { key: 'listing_fee', value: JSON.stringify({ price: 0, free_limit: 10 }), desc: 'Charge per listing after free limit', category: 'fees' },
      { key: 'listing_boost', value: JSON.stringify({ standard: 99, premium: 199, spotlight: 499, duration_days: 7 }), desc: 'Boost listing visibility with paid promotion', category: 'boost' },
      { key: 'subscription_plans', value: JSON.stringify({ enabled_plan_ids: [] }), desc: 'Premium subscription plans for sellers', category: 'subscription' },
      { key: 'inquiry_fee', value: JSON.stringify({ per_inquiry: 0, free_daily_limit: 50 }), desc: 'Charge per inquiry/contact reveal', category: 'fees' },
      { key: 'featured_seller', value: JSON.stringify({ monthly_price: 0 }), desc: 'Featured/verified seller badge', category: 'premium' },
      { key: 'transaction_fee', value: JSON.stringify({ percentage: 0, flat_fee: 0 }), desc: 'Commission on successful transactions', category: 'fees' },
      { key: 'premium_analytics', value: JSON.stringify({ price: 0 }), desc: 'Advanced marketplace analytics for sellers', category: 'premium' },
      { key: 'priority_placement', value: JSON.stringify({ price: 0, duration_days: 30 }), desc: 'Priority placement in search results', category: 'boost' },
    ];
    for (const d of monetizationDefaults) {
      await pool.query(
        `INSERT INTO marketplace_monetization_settings (id, setting_key, setting_value, is_enabled, description, category)
         VALUES (gen_random_uuid(), $1, $2::jsonb, false, $3, $4)
         ON CONFLICT (setting_key) DO NOTHING`,
        [d.key, d.value, d.desc, d.category]
      ).catch(() => {});
    }

    // Ensure vaccination protocol tables exist (safety net for existing DBs)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vaccine_protocols (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        disease VARCHAR(255) NOT NULL,
        species TEXT[] NOT NULL DEFAULT '{}',
        applicable_gender VARCHAR(10) NOT NULL DEFAULT 'all',
        min_age_weeks INTEGER,
        max_age_weeks INTEGER,
        vaccine_category VARCHAR(30) NOT NULL DEFAULT 'core',
        is_zoonotic BOOLEAN DEFAULT false,
        initial_dose_age_weeks INTEGER,
        booster_interval_days INTEGER NOT NULL DEFAULT 365,
        series_dose_count INTEGER DEFAULT 1,
        series_interval_days INTEGER DEFAULT 21,
        route VARCHAR(30) DEFAULT 'intramuscular',
        dosage_ml VARCHAR(50),
        site VARCHAR(100),
        regulatory_body VARCHAR(255),
        regulatory_standard VARCHAR(500),
        seasonal_window VARCHAR(100),
        country VARCHAR(50) DEFAULT 'ALL',
        is_active BOOLEAN DEFAULT true,
        notes TEXT,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => {});
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vaccine_protocol_changes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        protocol_id UUID NOT NULL REFERENCES vaccine_protocols(id) ON DELETE CASCADE,
        changed_field VARCHAR(100) NOT NULL,
        old_value TEXT,
        new_value TEXT,
        change_reason TEXT,
        regulatory_standard VARCHAR(500),
        effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
        changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => {});
    await pool.query(`
      CREATE TABLE IF NOT EXISTS animal_vaccine_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
        protocol_id UUID NOT NULL REFERENCES vaccine_protocols(id) ON DELETE CASCADE,
        assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        waived BOOLEAN DEFAULT false,
        waiver_reason TEXT,
        notes TEXT,
        UNIQUE (animal_id, protocol_id)
      )
    `).catch(() => {});
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vaccine_schedule (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
        protocol_id UUID NOT NULL REFERENCES vaccine_protocols(id) ON DELETE CASCADE,
        assignment_id UUID REFERENCES animal_vaccine_assignments(id) ON DELETE SET NULL,
        dose_number INTEGER NOT NULL DEFAULT 1,
        due_date DATE NOT NULL,
        administered_at DATE,
        vaccination_record_id UUID REFERENCES vaccination_records(id) ON DELETE SET NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        reminder_sent BOOLEAN DEFAULT false,
        reminder_sent_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => {});
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vaccine_certificate_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
        vaccination_record_id UUID REFERENCES vaccination_records(id) ON DELETE SET NULL,
        generated_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        certificate_type VARCHAR(30) NOT NULL DEFAULT 'single',
        file_name VARCHAR(255),
        generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => {});

    // Ensure vaccination_records has new FK columns
    const vaccinationProtocolColumns = [
      `ALTER TABLE vaccination_records ADD COLUMN IF NOT EXISTS protocol_id UUID REFERENCES vaccine_protocols(id) ON DELETE SET NULL`,
      `ALTER TABLE vaccination_records ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES vaccine_schedule(id) ON DELETE SET NULL`,
    ];
    for (const ddl of vaccinationProtocolColumns) {
      await pool.query(ddl).catch(() => {});
    }

    // Enrollment status fields for animal_care_contexts (privacy-first consent flow)
    await pool.query(`ALTER TABLE animal_care_contexts ADD COLUMN IF NOT EXISTS enrollment_status VARCHAR(20) NOT NULL DEFAULT 'pending_consent'`).catch(() => {});
    await pool.query(`ALTER TABLE animal_care_contexts ADD COLUMN IF NOT EXISTS enrollment_requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`).catch(() => {});
    await pool.query(`ALTER TABLE animal_care_contexts ADD COLUMN IF NOT EXISTS enrollment_responded_at TIMESTAMP`).catch(() => {});
    // Backfill existing active records
    await pool.query(`UPDATE animal_care_contexts SET enrollment_status = 'active' WHERE is_active = true AND enrollment_status = 'pending_consent'`).catch(() => {});
    // hospital_patient_invites table safety net
    await pool.query(`
      CREATE TABLE IF NOT EXISTS hospital_patient_invites (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        network_id UUID NOT NULL REFERENCES hospital_networks(id) ON DELETE CASCADE,
        hospital_id UUID REFERENCES vet_hospitals(id) ON DELETE SET NULL,
        invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        patient_name VARCHAR(200) NOT NULL,
        patient_email VARCHAR(255) NOT NULL,
        patient_phone VARCHAR(30),
        animal_name VARCHAR(100),
        animal_species VARCHAR(50),
        invite_token VARCHAR(128) NOT NULL UNIQUE,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        message TEXT,
        expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '72 hours'),
        accepted_at TIMESTAMPTZ,
        accepted_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `).catch(() => {});

    // Extend users.role CHECK constraint - full list set below after hospital_staff tables (line ~837)
    // (skipping partial update here to avoid overwriting the complete constraint)
    // role_change_requests table safety net
    await pool.query(`
      CREATE TABLE IF NOT EXISTS role_change_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "current_role" VARCHAR(50) NOT NULL,
        requested_role VARCHAR(50) NOT NULL,
        reason TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
        reviewed_by UUID REFERENCES users(id),
        reviewed_at TIMESTAMP,
        rejection_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => {});

}

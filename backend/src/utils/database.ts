import { Pool, types } from 'pg';
import config from '../config';
import logger from './logger';
import * as fs from 'fs';
import * as path from 'path';
import PermissionService from '../services/PermissionService';
import RefreshTokenService from '../services/RefreshTokenService';
import VetHospitalService from '../services/VetHospitalService';

// ── Fix node-postgres: NUMERIC/DECIMAL columns return as strings by default ──
// OID 1700 = NUMERIC/DECIMAL → parse to float
types.setTypeParser(1700, (val: string) => parseFloat(val));
// OID 700 = FLOAT4, 701 = FLOAT8 (already returns as number but be safe)
types.setTypeParser(700, (val: string) => parseFloat(val));
types.setTypeParser(701, (val: string) => parseFloat(val));

class PostgresDatabase {
  private pool: Pool;

  constructor() {
    // Use DATABASE_URL (Render.com) when available, else individual params
    const schemaOpt = config.database.schema && config.database.schema !== 'public'
      ? `-c search_path=${config.database.schema},public`
      : undefined;
    const poolConfig = config.database.connectionString
      ? {
          connectionString: config.database.connectionString,
          ssl: config.database.ssl || undefined,
          max: config.database.pool.max,
          min: config.database.pool.min,
          idleTimeoutMillis: config.database.pool.idleTimeoutMillis,
          connectionTimeoutMillis: config.database.pool.connectionTimeoutMillis,
          maxUses: config.database.pool.maxUses,
          ...(schemaOpt ? { options: schemaOpt } : {}),
        }
      : {
          host: config.database.host,
          port: config.database.port,
          user: config.database.user,
          password: config.database.password,
          database: config.database.database,
          max: config.database.pool.max,
          min: config.database.pool.min,
          idleTimeoutMillis: config.database.pool.idleTimeoutMillis,
          connectionTimeoutMillis: config.database.pool.connectionTimeoutMillis,
          maxUses: config.database.pool.maxUses,
          ...(schemaOpt ? { options: schemaOpt } : {}),
        };
    this.pool = new Pool(poolConfig);

    this.pool.on('error', (err: Error) => {
      logger.error('Unexpected idle client error', { error: err.message });
    });
  }

  async connect(): Promise<void> {
    try {
      // Test the connection
      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW()');
      client.release();
      logger.info(`PostgreSQL connected successfully at ${config.database.host}:${config.database.port}/${config.database.database}`, {
        serverTime: result.rows[0].now,
      });

      // Run schema if tables don't exist
      await this.ensureSchema();

      // Ensure default system settings exist
      await this.seedDefaultSettings();

      // Sync stale booking statuses with completed consultations
      await this.syncBookingStatuses();

      // Ensure RBAC permission table and seed defaults
      await PermissionService.ensureTable();
      await PermissionService.seedDefaults();

      // Ensure refresh tokens table
      await RefreshTokenService.ensureTable();

      // Ensure vet hospital tables
      await VetHospitalService.ensureTables();
    } catch (error: any) {
      logger.error('Failed to connect to PostgreSQL', { error: error.message });
      throw error;
    }
  }

  private async ensureSchema(): Promise<void> {
    try {
      // Check if the users table exists
      const schemaName = config.database.schema || 'public';
      const check = await this.pool.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'users')`,
        [schemaName]
      );
      if (!check.rows[0].exists) {
        logger.info('Tables not found — running init.sql schema...');
        const initSqlPath = path.join(__dirname, '../../../docker/init.sql');
        if (fs.existsSync(initSqlPath)) {
          const sql = fs.readFileSync(initSqlPath, 'utf8');
          await this.pool.query(sql);
          logger.info('Schema created successfully from init.sql');
        } else {
          logger.warn('init.sql not found at ' + initSqlPath + ' — skipping schema creation');
        }
      } else {
        logger.info('Database schema already exists');
      }
    } catch (error: any) {
      logger.error('Error ensuring schema', { error: error.message });
      throw error;
    }
  }

  private async seedDefaultSettings(): Promise<void> {
    const defaults = [
      { key: 'display.timeFormat', value: '12h', category: 'display', description: 'Time display format: 12h (AM/PM) or 24h' },
      { key: 'display.dateFormat', value: 'MMM d, yyyy', category: 'display', description: 'Date display format' },
      { key: 'consultation.joinWindowMinutes', value: '5', category: 'consultation', description: 'Minutes before scheduled time when Join/Start button becomes available' },
      { key: 'booking.maxReschedules', value: '1', category: 'booking', description: 'Maximum times a user can reschedule before doctor acceptance (0 = unlimited)' },
      { key: 'payment.currency', value: 'INR', category: 'payment', description: 'Platform currency code (e.g. USD, INR, EUR, GBP)' },
      // Prescription template defaults
      { key: 'prescription.clinicName', value: 'VetCare Platform', category: 'prescription', description: 'Clinic / platform name shown on prescription letterhead' },
      { key: 'prescription.clinicTagline', value: 'Compassionate Care for Your Animals', category: 'prescription', description: 'Tagline shown below clinic name on prescriptions' },
      { key: 'prescription.clinicAddress', value: '123 Veterinary Avenue, Chennai, Tamil Nadu 600001, India', category: 'prescription', description: 'Full clinic address for prescription footer' },
      { key: 'prescription.clinicPhone', value: '+91 44 1234 5678', category: 'prescription', description: 'Phone number printed on prescriptions' },
      { key: 'prescription.clinicEmail', value: 'care@vetcareplatform.com', category: 'prescription', description: 'Email address printed on prescriptions' },
      { key: 'prescription.clinicWebsite', value: 'www.vetcareplatform.com', category: 'prescription', description: 'Website URL printed on prescriptions' },
      { key: 'prescription.registrationNumber', value: 'VET-REG-2024-001', category: 'prescription', description: 'Platform/clinic registration or license number' },
      { key: 'prescription.clinicLogo', value: '', category: 'prescription', description: 'Logo URL or base64 for prescription letterhead (leave blank to use default icon)' },
      { key: 'prescription.footerText', value: 'This prescription is digitally generated and valid until the date specified. Contact the prescribing veterinarian for queries.', category: 'prescription', description: 'Disclaimer text in prescription footer' },
      // Certificate template defaults
      { key: 'cert.clinicName', value: 'VetCare Platform', category: 'cert', description: 'Clinic / platform name shown on certificate letterhead' },
      { key: 'cert.clinicAddress', value: '123 Veterinary Avenue, Chennai, Tamil Nadu 600001, India', category: 'cert', description: 'Full clinic address for certificate letterhead' },
      { key: 'cert.clinicPhone', value: '+91 44 1234 5678', category: 'cert', description: 'Phone number printed on certificates' },
      { key: 'cert.clinicEmail', value: 'care@vetcareplatform.com', category: 'cert', description: 'Email address printed on certificates' },
      { key: 'cert.clinicWebsite', value: 'www.vetcareplatform.com', category: 'cert', description: 'Website URL printed on certificates' },
      { key: 'cert.registrationNumber', value: 'VET-REG-2024-001', category: 'cert', description: 'Official registration / license number for certificates' },
      { key: 'cert.clinicLogo', value: '', category: 'cert', description: 'Logo URL or base64 for certificate letterhead (leave blank to use default icon)' },
      { key: 'cert.footerText', value: 'This certificate is officially issued by a licensed veterinarian and is valid as stated. For queries, contact the issuing veterinarian.', category: 'cert', description: 'Disclaimer text at the bottom of every certificate' },
      { key: 'cert.signatureRequired', value: 'false', category: 'cert', description: 'If true, vets must upload a signature before a certificate can be issued' },
      { key: 'cert.autoNumberPrefix', value: 'VC', category: 'cert', description: 'Prefix for auto-generated certificate numbers (e.g. VC → VC-2026-00001)' },
    ];
    for (const d of defaults) {
      await this.pool.query(
        `INSERT INTO system_settings (id, key, value, category, description)
         VALUES (uuid_generate_v4(), $1, $2, $3, $4)
         ON CONFLICT (key) DO NOTHING`,
        [d.key, d.value, d.category, d.description]
      );
    }
    // Ensure reschedule_count column exists on bookings (safe for existing DBs)
    await this.pool.query(
      `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reschedule_count INTEGER NOT NULL DEFAULT 0`
    ).catch(() => { /* column may already exist */ });

    // Ensure ALL bookings columns that may have been added after initial table creation
    const bookingColumns = [
      `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS missed_by VARCHAR(20)`,
      `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_by UUID`,
      `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP`,
      `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS enterprise_id UUID`,
      `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS group_id UUID`,
    ];
    for (const ddl of bookingColumns) {
      await this.pool.query(ddl).catch(() => {});
    }

    // Ensure vet_profiles columns added after initial table creation
    await this.pool.query(
      `ALTER TABLE vet_profiles ADD COLUMN IF NOT EXISTS certificate_types TEXT[] DEFAULT '{}'`
    ).catch(() => {});

    // Ensure enterprise-related tables exist FIRST (vet_certificates has a FK to enterprises)
    await this.pool.query(
      `CREATE TABLE IF NOT EXISTS enterprises (
         id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
         name VARCHAR(255) NOT NULL,
         enterprise_type VARCHAR(50),
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
       )`
    ).catch(() => { /* table may already exist */ });

    // Ensure vet_certificates table exists (safety net — must run AFTER enterprises is guaranteed)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS vet_certificates (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        certificate_number VARCHAR(100) NOT NULL UNIQUE,
        certificate_type VARCHAR(50) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'draft',
        veterinarian_id UUID NOT NULL REFERENCES users(id),
        pet_owner_id UUID REFERENCES users(id),
        animal_id UUID REFERENCES animals(id) ON DELETE SET NULL,
        consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
        booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
        enterprise_id UUID REFERENCES enterprises(id) ON DELETE SET NULL,
        examination_date DATE,
        clinical_findings TEXT,
        diagnosis TEXT,
        treatment_summary TEXT,
        recommendations TEXT,
        vaccination_details JSONB,
        travel_details JSONB,
        breeding_details JSONB,
        valuation_details JSONB,
        issued_at TIMESTAMP,
        valid_until DATE,
        notes TEXT,
        revocation_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).catch((e: any) => {
      logger.error('Failed to create vet_certificates safety-net table', { error: e.message });
    });
    await this.pool.query(
      `CREATE TABLE IF NOT EXISTS animal_groups (
         id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
         name VARCHAR(255) NOT NULL,
         group_type VARCHAR(50),
         enterprise_id UUID,
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
       )`
    ).catch(() => { /* table may already exist */ });

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
    ];
    for (const ddl of animalColumns) {
      await this.pool.query(ddl).catch(() => {});
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
      await this.pool.query(ddl).catch(() => {});
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
      await this.pool.query(ddl).catch(() => {});
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
      await this.pool.query(ddl).catch(() => {});
    }

    // Ensure users columns added after initial table creation
    const userColumns = [
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS default_enterprise_id UUID`,
    ];
    for (const ddl of userColumns) {
      await this.pool.query(ddl).catch(() => {});
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
      await this.pool.query(ddl).catch(() => {});
    }

    // Ensure marketplace monetization tables exist (safety net)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS marketplace_monetization_settings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS marketplace_plans (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS marketplace_subscriptions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS listing_boosts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS marketplace_inquiries (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS marketplace_transactions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
      await this.pool.query(
        `INSERT INTO marketplace_monetization_settings (id, setting_key, setting_value, is_enabled, description, category)
         VALUES (uuid_generate_v4(), $1, $2::jsonb, false, $3, $4)
         ON CONFLICT (setting_key) DO NOTHING`,
        [d.key, d.value, d.desc, d.category]
      ).catch(() => {});
    }

    // Ensure vaccination protocol tables exist (safety net for existing DBs)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS vaccine_protocols (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS vaccine_protocol_changes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS animal_vaccine_assignments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS vaccine_schedule (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS vaccine_certificate_log (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
      await this.pool.query(ddl).catch(() => {});
    }

    logger.info('Default system settings seeded');
  }

  private async syncBookingStatuses(): Promise<void> {
    try {
      const result = await this.pool.query(
        `UPDATE bookings SET status = 'completed', updated_at = NOW()
         WHERE consultation_id IN (SELECT id FROM consultations WHERE status = 'completed')
         AND status != 'completed'`
      );
      if (result.rowCount && result.rowCount > 0) {
        logger.info(`Synced ${result.rowCount} booking(s) to completed status`);
      }
    } catch (error: any) {
      logger.warn('Failed to sync booking statuses', { error: error.message });
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.pool.end();
      logger.info('PostgreSQL pool disconnected');
    } catch (error: any) {
      logger.error('Error disconnecting from PostgreSQL', { error: error.message });
      throw error;
    }
  }

  async query(text: string, params?: any[]): Promise<any> {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      if (duration > 1000) {
        logger.warn('Slow query detected', { query: text.substring(0, 100), duration, params });
      }
      return result;
    } catch (error: any) {
      logger.error('Database query error', { query: text.substring(0, 200), error: error.message, params });
      throw error;
    }
  }

  async transaction(callback: (client: any) => Promise<any>): Promise<any> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Transaction failed', { error });
      throw error;
    } finally {
      client.release();
    }
  }

  getPool(): Pool {
    return this.pool;
  }
}

// Always use real PostgreSQL
const database = new PostgresDatabase();
export default database;

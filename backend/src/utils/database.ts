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
      try { await this.ensureSchema(); } catch (e: any) { logger.warn('ensureSchema failed', { error: e.message }); }

      // Apply any pending backend/migrations/*.sql files using the server's own pool
      // (correct search_path, connection timeout, proper error handling)
      await this.runSQLMigrations();

      // Ensure default system settings exist
      try { await this.seedDefaultSettings(); } catch (e: any) { logger.warn('seedDefaultSettings failed', { error: e.message }); }

      // Sync stale booking statuses with completed consultations
      await this.syncBookingStatuses();

      // Ensure RBAC permission table and seed defaults
      try { await PermissionService.ensureTable(); } catch (e: any) { logger.warn('PermissionService.ensureTable failed', { error: e.message }); }
      try { await PermissionService.seedDefaults(); } catch (e: any) { logger.warn('PermissionService.seedDefaults failed', { error: e.message }); }

      // Ensure refresh tokens table
      try { await RefreshTokenService.ensureTable(); } catch (e: any) { logger.warn('RefreshTokenService.ensureTable failed', { error: e.message }); }

      // Ensure vet hospital tables
      try { await VetHospitalService.ensureTables(); } catch (e: any) { logger.warn('VetHospitalService.ensureTables failed', { error: e.message }); }
    } catch (error: any) {
      logger.error('Failed to connect to PostgreSQL', { error: error.message });
      throw error;
    }
  }

  /**
   * Applies any pending SQL migration files from backend/migrations/*.sql.
   * Uses the server's own pool (which has the correct search_path set via
   * connection options), so this is far more reliable than running a separate
   * node process. Errors are caught and logged — startup is never blocked.
   */
  private async runSQLMigrations(): Promise<void> {
    try {
      const migDir = path.join(__dirname, '..', '..', 'migrations');
      if (!fs.existsSync(migDir)) {
        logger.info('No migrations directory — skipping SQL migration runner');
        return;
      }

      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS _migrations (
          id         SERIAL PRIMARY KEY,
          name       VARCHAR(255) NOT NULL UNIQUE,
          applied_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
      `);

      const { rows } = await this.pool.query(`SELECT name FROM _migrations ORDER BY id`);
      const applied = new Set(rows.map((r: any) => r.name));

      const pending = fs.readdirSync(migDir)
        .filter(f => f.endsWith('.sql'))
        .sort()
        .filter(f => !applied.has(f));

      if (pending.length === 0) {
        logger.info('SQL migrations: all up to date');
        return;
      }

      logger.info(`SQL migrations: applying ${pending.length} pending file(s)...`);
      for (const file of pending) {
        const sql = fs.readFileSync(path.join(migDir, file), 'utf-8');
        const client = await this.pool.connect();
        try {
          await client.query('BEGIN');
          await client.query(sql);
          await client.query(`INSERT INTO _migrations (name) VALUES ($1)`, [file]);
          await client.query('COMMIT');
          logger.info(`  ✓ Migration applied: ${file}`);
        } catch (err: any) {
          await client.query('ROLLBACK');
          logger.error(`  ✗ Migration failed (${file}): ${err.message}`);
        } finally {
          client.release();
        }
      }
    } catch (error: any) {
      logger.warn('SQL migration runner error', { error: error.message });
    }
  }

  private async ensureSchema(): Promise<void> {
    return this.ensureSchemaPublic();
  }
  async ensureSchemaPublic(): Promise<void> {
    try {
      const schemaName = config.database.schema || 'public';
      // 1. Ensure the schema itself exists first
      if (schemaName !== 'public') {
        await this.pool.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
      }
      // 2. Check if users table exists
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
         VALUES (gen_random_uuid(), $1, $2, $3, $4)
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

    // Add new farm cert columns to vet_certificates (safety net for existing tables)
    await Promise.all([
      this.pool.query(`ALTER TABLE vet_certificates ADD COLUMN IF NOT EXISTS movement_details JSONB`).catch(() => {}),
      this.pool.query(`ALTER TABLE vet_certificates ADD COLUMN IF NOT EXISTS herd_details JSONB`).catch(() => {}),
    ]);

    // Ensure enterprise-related tables exist FIRST (vet_certificates has a FK to enterprises)
    await this.pool.query(
      `CREATE TABLE IF NOT EXISTS enterprises (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         name VARCHAR(255) NOT NULL,
         enterprise_type VARCHAR(50),
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
       )`
    ).catch(() => { /* table may already exist */ });

    // Ensure vet_certificates table exists (safety net — must run AFTER enterprises is guaranteed)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS vet_certificates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
        movement_details JSONB,
        herd_details JSONB,
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
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         name VARCHAR(255) NOT NULL,
         group_type VARCHAR(50),
         enterprise_id UUID,
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
       )`
    ).catch(() => { /* table may already exist */ });

    // Ensure animal_id_sequences table exists (race-safe VC-ID generation)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS animal_id_sequences (
        species  VARCHAR(20) NOT NULL,
        year     INTEGER     NOT NULL,
        last_seq INTEGER     NOT NULL DEFAULT 0,
        PRIMARY KEY (species, year)
      )
    `).catch(() => {});

    // Ensure id_prefix column exists on hospital_networks
    await this.pool.query(
      `ALTER TABLE hospital_networks ADD COLUMN IF NOT EXISTS id_prefix VARCHAR(10)`
    ).catch(() => {});

    // Ensure network_patient_id_sequences table exists (race-safe per-network patient ID generation)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS network_patient_id_sequences (
        network_id  UUID        NOT NULL REFERENCES hospital_networks(id) ON DELETE CASCADE,
        species     VARCHAR(20) NOT NULL,
        year        INTEGER     NOT NULL,
        last_seq    INTEGER     NOT NULL DEFAULT 0,
        PRIMARY KEY (network_id, species, year)
      )
    `).catch(() => {});

    // Backfill VC-IDs for existing animals that have NULL or non-VC-format unique_id
    try {
      const speciesCodeMap: Record<string, string> = {
        dog: 'DOG', canine: 'DOG',
        cat: 'CAT', feline: 'CAT',
        rabbit: 'RAB',
        bird: 'BRD',
        reptile: 'REP',
        cow: 'COW', cattle: 'COW', bovine: 'COW',
        sheep: 'SHP', ovine: 'SHP',
        pig: 'PIG', swine: 'PIG', porcine: 'PIG',
        chicken: 'CHK', poultry: 'CHK',
        horse: 'HRS', equine: 'HRS',
        goat: 'GOT', caprine: 'GOT',
      };
      const noIdRes = await this.pool.query(
        `SELECT id, species, EXTRACT(YEAR FROM created_at)::int AS yr
         FROM animals
         WHERE unique_id IS NULL OR unique_id !~ '^VC-[A-Z]+-[0-9]{2}-[0-9]{6}$'
         ORDER BY created_at`
      );
      for (const row of noIdRes.rows) {
        const code = speciesCodeMap[(row.species || '').toLowerCase().trim()] || 'OTH';
        const yr = row.yr % 100;
        const seqRes = await this.pool.query(
          `INSERT INTO animal_id_sequences (species, year, last_seq)
           VALUES ($1, $2, 1)
           ON CONFLICT (species, year) DO UPDATE
             SET last_seq = animal_id_sequences.last_seq + 1
           RETURNING last_seq`,
          [code, yr]
        );
        const seq = seqRes.rows[0].last_seq as number;
        const uid = `VC-${code}-${yr.toString().padStart(2, '0')}-${seq.toString().padStart(6, '0')}`;
        await this.pool.query(`UPDATE animals SET unique_id = $1 WHERE id = $2`, [uid, row.id]);
      }
      if (noIdRes.rows.length > 0) {
        logger.info(`Backfilled VC-IDs for ${noIdRes.rows.length} animal(s)`);
      }
    } catch (backfillErr: any) {
      logger.warn('Animal VC-ID backfill skipped', { error: backfillErr.message });
    }

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
    await this.pool.query(`
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
    await this.pool.query(`
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
    await this.pool.query(`
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
    await this.pool.query(`
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
    await this.pool.query(`
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
      await this.pool.query(
        `INSERT INTO marketplace_monetization_settings (id, setting_key, setting_value, is_enabled, description, category)
         VALUES (gen_random_uuid(), $1, $2::jsonb, false, $3, $4)
         ON CONFLICT (setting_key) DO NOTHING`,
        [d.key, d.value, d.desc, d.category]
      ).catch(() => {});
    }

    // Ensure vaccination protocol tables exist (safety net for existing DBs)
    await this.pool.query(`
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
    await this.pool.query(`
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
    await this.pool.query(`
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
    await this.pool.query(`
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
    await this.pool.query(`
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
      await this.pool.query(ddl).catch(() => {});
    }

    // Enrollment status fields for animal_care_contexts (privacy-first consent flow)
    await this.pool.query(`ALTER TABLE animal_care_contexts ADD COLUMN IF NOT EXISTS enrollment_status VARCHAR(20) NOT NULL DEFAULT 'pending_consent'`).catch(() => {});
    await this.pool.query(`ALTER TABLE animal_care_contexts ADD COLUMN IF NOT EXISTS enrollment_requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`).catch(() => {});
    await this.pool.query(`ALTER TABLE animal_care_contexts ADD COLUMN IF NOT EXISTS enrollment_responded_at TIMESTAMP`).catch(() => {});
    // Backfill existing active records
    await this.pool.query(`UPDATE animal_care_contexts SET enrollment_status = 'active' WHERE is_active = true AND enrollment_status = 'pending_consent'`).catch(() => {});
    // hospital_patient_invites table safety net
    await this.pool.query(`
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

    // Extend users.role CHECK constraint — full list set below after hospital_staff tables (line ~837)
    // (skipping partial update here to avoid overwriting the complete constraint)
    // role_change_requests table safety net
    await this.pool.query(`
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

    // ── Network Subscription Plans (platform admin tiers) ──────────────────
    await this.pool.query(`
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

    await this.pool.query(`
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

    await this.pool.query(`
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
    const planCount = await this.pool.query(`SELECT COUNT(*) FROM network_subscription_plans`).catch(() => ({ rows: [{ count: '0' }] }));
    if (parseInt(planCount.rows[0].count) === 0) {
      await this.pool.query(`
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
      await this.pool.query(
        `INSERT INTO system_settings (key, value, description, is_public)
         VALUES ($1, $2, $3, false)
         ON CONFLICT (key) DO NOTHING`,
        [key, value, `Pricing visibility control: ${key}`]
      ).catch(() => {});
    }

    // Also ensure users.role CHECK includes hospital_staff
    await this.pool.query(`
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check
    `).catch(() => {});
    await this.pool.query(`
      ALTER TABLE users ADD CONSTRAINT users_role_check
        CHECK (role IN ('farmer', 'pet_owner', 'veterinarian', 'admin', 'corporate_admin', 'hospital_staff'))
    `).catch(() => {});

    // Marketplace performance indexes — critical for free-tier Render cold-start
    // These are idempotent (CREATE INDEX IF NOT EXISTS) so safe to run on every startup
    const marketplaceIndexes = [
      `CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status_approved ON marketplace_listings(status, admin_approved)`,
      `CREATE INDEX IF NOT EXISTS idx_marketplace_listings_hot_deal ON marketplace_listings(is_hot_deal, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status ON marketplace_listings(status)`,
      `CREATE INDEX IF NOT EXISTS idx_marketplace_bids_listing_status ON marketplace_bids(listing_id, status)`,
    ];
    for (const ddl of marketplaceIndexes) {
      await this.pool.query(ddl).catch(() => {});
    }

    // Enterprise alignment — add enterprise context to clinical tables
    const enterpriseAlignmentDDL = [
      `ALTER TABLE inpatient_admissions ADD COLUMN IF NOT EXISTS enterprise_id UUID REFERENCES enterprises(id) ON DELETE SET NULL`,
      `ALTER TABLE inpatient_admissions ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES animal_groups(id) ON DELETE SET NULL`,
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
      await this.pool.query(ddl).catch(() => {});
    }

    // campaign_animals junction table for treatment tracking
    await this.pool.query(`
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
    await this.pool.query(`
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
    await this.pool.query(
      `ALTER TABLE vet_profiles ADD COLUMN IF NOT EXISTS total_reviews INTEGER DEFAULT 0`
    ).catch(() => {});

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

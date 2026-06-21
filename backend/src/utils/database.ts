import { Pool, types } from 'pg';
import config from '../config';
import logger from './logger';
import * as fs from 'fs';
import * as path from 'path';
import PermissionService from '../services/PermissionService';
import NetworkRolePermissionService from '../services/NetworkRolePermissionService';
import RefreshTokenService from '../services/RefreshTokenService';
import VetHospitalService from '../services/VetHospitalService';

/** Split multi-statement SQL respecting dollar-quoted function bodies ($$...$$) */
function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inDollarQuote = false;
  let dollarTag = '';

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    current += ch;

    // Detect start/end of dollar-quoting
    if (ch === '$' && !inDollarQuote) {
      const match = sql.slice(i).match(/^\$([^$]*)\$/);
      if (match) {
        inDollarQuote = true;
        dollarTag = match[0];
        current += match[0].slice(1);
        i += match[0].length - 1;
      }
    } else if (inDollarQuote && sql.slice(i).startsWith(dollarTag)) {
      current += dollarTag.slice(1);
      i += dollarTag.length - 1;
      inDollarQuote = false;
      dollarTag = '';
    } else if (!inDollarQuote && ch === ';') {
      const stmt = current.trim();
      if (stmt && stmt !== ';') {
        statements.push(stmt);
      }
      current = '';
    }
  }
  const remaining = current.trim();
  if (remaining && remaining !== ';') statements.push(remaining);
  return statements;
}

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

      // Ensure network role permissions table (network-scoped, no global seed needed)
      try { await NetworkRolePermissionService.ensureTable(); } catch (e: any) { logger.warn('NetworkRolePermissionService.ensureTable failed', { error: e.message }); }

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
    const schemaName = config.database.schema || 'public';
    const client = await this.pool.connect();
    try {
      // 1. Ensure the schema itself exists (use public search_path for this DDL)
      if (schemaName !== 'public') {
        await client.query(`SET search_path TO public`);
        await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
      }
      // 2. Set search_path so subsequent DDL lands in the correct schema
      await client.query(`SET search_path TO "${schemaName}", public`);

      // 3. Check if core tables exist (users + bookings = healthy schema)
      const check = await client.query(
        `SELECT
          EXISTS (SELECT FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'users') AS has_users,
          EXISTS (SELECT FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'bookings') AS has_bookings`,
        [schemaName]
      );
      const { has_users, has_bookings } = check.rows[0];
      if (!has_users || !has_bookings) {
        logger.info(`Partial or missing schema (users=${has_users}, bookings=${has_bookings}) — running init.sql...`);
        const initSqlPath = path.join(__dirname, '../../../docker/init.sql');
        if (fs.existsSync(initSqlPath)) {
          const sql = fs.readFileSync(initSqlPath, 'utf8');
          // Use client.query (simple query protocol) — supports multi-statement SQL
          await client.query(sql);
          logger.info('Schema created/repaired successfully from init.sql');
        } else {
          logger.warn('init.sql not found at ' + initSqlPath + ' — skipping schema creation');
        }
      } else {
        logger.info('Database schema healthy (users + bookings found)');
      }
    } catch (error: any) {
      logger.error('Error ensuring schema', { error: error.message, schema: schemaName });
      throw error;
    } finally {
      client.release();
    }
  }

  /** Run init.sql statement-by-statement for diagnostics; returns detailed results */
  async repairSchema(): Promise<{ success: boolean; created: boolean; statements: number; errors: string[] }> {
    const schemaName = config.database.schema || 'public';
    const errors: string[] = [];
    let statementsRun = 0;
    let created = false;

    const client = await this.pool.connect();
    try {
      // Always set search_path with public first so CREATE SCHEMA works
      await client.query(`SET search_path TO public`);
      if (schemaName !== 'public') {
        await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
      }
      await client.query(`SET search_path TO "${schemaName}", public`);

      const initSqlPath = path.join(__dirname, '../../../docker/init.sql');
      if (!fs.existsSync(initSqlPath)) {
        errors.push('init.sql not found at: ' + initSqlPath);
        return { success: false, created: false, statements: 0, errors };
      }

      const sql = fs.readFileSync(initSqlPath, 'utf8');
      // Split statements respecting dollar-quoted function bodies
      const stmts = splitSqlStatements(sql);
      for (const stmt of stmts) {
        try {
          await client.query(stmt);
          statementsRun++;
        } catch (e: any) {
          // Ignore "already exists" errors — those are fine for IF NOT EXISTS statements
          if (!e.message?.includes('already exists') && !e.message?.includes('duplicate')) {
            errors.push(`[stmt ${statementsRun + 1}] ${e.message}`);
          }
          statementsRun++;
        }
      }

      // Verify users table was created
      const check = await client.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'users')`,
        [schemaName]
      );
      created = check.rows[0].exists === true;
      return { success: created, created, statements: statementsRun, errors };
    } finally {
      client.release();
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

    // Extend booking_type constraint to allow farm_visit and herd_consultation
    await this.pool.query(
      `ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_booking_type_check`
    ).catch(() => {});
    await this.pool.query(
      `ALTER TABLE bookings ADD CONSTRAINT bookings_booking_type_check
       CHECK (booking_type IN ('video_call', 'chat', 'in_person', 'phone', 'farm_visit', 'herd_consultation'))`
    ).catch(() => {});

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

    // Ensure created_by column exists on hospital_networks (critical — approve + corporate dashboard queries use it)
    await this.pool.query(
      `ALTER TABLE hospital_networks ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL`
    ).catch(() => {});

    // Account status system — account_status replaces is_active as the primary login gate
    await this.pool.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) NOT NULL DEFAULT 'active'`
    ).catch(() => {});
    await this.pool.query(
      `ALTER TABLE users DROP CONSTRAINT IF EXISTS users_account_status_check`
    ).catch(() => {});
    await this.pool.query(
      `ALTER TABLE users ADD CONSTRAINT users_account_status_check
       CHECK (account_status IN ('active','pending_approval','frozen','suspended'))`
    ).catch(() => {});
    await this.pool.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS freeze_reason TEXT`
    ).catch(() => {});
    await this.pool.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMP`
    ).catch(() => {});
    await this.pool.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS frozen_by UUID`
    ).catch(() => {});
    // Sync existing records: is_active=false → suspended; is_active=true → stays active
    await this.pool.query(
      `UPDATE users SET account_status = 'suspended'
       WHERE is_active = false AND account_status = 'active'`
    ).catch(() => {});

    // Fix 2: Ensure id_prefix is unique across all networks
    await this.pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_hospital_networks_id_prefix 
      ON hospital_networks(id_prefix)
    `).catch(() => {});

    // C1: Prevent double-booking race condition via unique partial index
    await this.pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_vet_slot_unique
        ON bookings(veterinarian_id, scheduled_date, time_slot_start)
        WHERE status NOT IN ('cancelled', 'missed')
    `).catch(() => {});

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
      `ALTER TABLE animals ADD COLUMN IF NOT EXISTS avatar_url TEXT`,
    ];
    for (const ddl of animalColumns) {
      await this.pool.query(ddl).catch(() => {});
    }

    // Widen avatar_url columns from VARCHAR(500) to TEXT (base64 photos exceed 500 chars)
    const widenAvatarUrl = [
      `ALTER TABLE animals ALTER COLUMN avatar_url TYPE TEXT`,
      `ALTER TABLE users ALTER COLUMN avatar_url TYPE TEXT`,
    ];
    for (const ddl of widenAvatarUrl) {
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

    // Also ensure users.role CHECK includes hospital_staff + pharmacist
    await this.pool.query(`
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check
    `).catch(() => {});
    await this.pool.query(`
      ALTER TABLE users ADD CONSTRAINT users_role_check
        CHECK (role IN ('farmer', 'pet_owner', 'veterinarian', 'admin', 'corporate_admin', 'hospital_staff', 'pharmacist'))
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

    // Network referrals table
    await this.pool.query(`
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

    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_network_referrals_network_id ON network_referrals(network_id)
    `).catch(() => {});
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_network_referrals_to_hospital ON network_referrals(to_hospital_id, status)
    `).catch(() => {});
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_network_referrals_animal ON network_referrals(animal_id)
    `).catch(() => {});

    // Add referral_type column for transfer support
    await this.pool.query(
      `ALTER TABLE network_referrals ADD COLUMN IF NOT EXISTS referral_type VARCHAR(20) DEFAULT 'referral' CHECK (referral_type IN ('referral', 'transfer'))`
    ).catch(() => {});
    await this.pool.query(
      `ALTER TABLE network_referrals ADD COLUMN IF NOT EXISTS transfer_reason TEXT`
    ).catch(() => {});
    await this.pool.query(
      `ALTER TABLE network_referrals ADD COLUMN IF NOT EXISTS transferred_at TIMESTAMPTZ`
    ).catch(() => {});

    // Staff leave requests table
    await this.pool.query(`
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
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_leave_requests_network ON staff_leave_requests(network_id)`).catch(() => {});
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_leave_requests_user ON staff_leave_requests(user_id)`).catch(() => {});
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_leave_requests_hospital ON staff_leave_requests(hospital_id)`).catch(() => {});

    // Missing FK indexes — prevent full table scans on common JOINs
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_consultations_animal_id ON consultations(animal_id)`).catch(() => {});
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_bookings_animal_id ON bookings(animal_id)`).catch(() => {});
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_bookings_consultation_id ON bookings(consultation_id)`).catch(() => {});
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_prescriptions_animal_id ON prescriptions(animal_id)`).catch(() => {});
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_medical_records_animal_id ON medical_records(animal_id)`).catch(() => {});
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_network_referrals_consultation_id ON network_referrals(consultation_id)`).catch(() => {});
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_workflow_cases_animal_id ON workflow_cases(animal_id)`).catch(() => {});

    // Prevent accidental animal deletion when consultations exist
    await this.pool.query(`
      ALTER TABLE consultations DROP CONSTRAINT IF EXISTS consultations_animal_id_fkey
    `).catch(() => {});
    await this.pool.query(`
      ALTER TABLE consultations ADD CONSTRAINT consultations_animal_id_fkey
      FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE RESTRICT
    `).catch(() => {});

    // Branch hospital support columns on vet_hospitals
    await this.pool.query(`ALTER TABLE vet_hospitals ADD COLUMN IF NOT EXISTS is_network_branch BOOLEAN DEFAULT false`).catch(() => {});
    await this.pool.query(`ALTER TABLE vet_hospitals ADD COLUMN IF NOT EXISTS branch_network_id UUID REFERENCES hospital_networks(id) ON DELETE SET NULL`).catch(() => {});

    // hospital_network_hospitals junction table (branch hospital ↔ network)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS hospital_network_hospitals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        network_id UUID NOT NULL REFERENCES hospital_networks(id) ON DELETE CASCADE,
        hospital_id UUID NOT NULL REFERENCES vet_hospitals(id) ON DELETE CASCADE,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        UNIQUE(network_id, hospital_id)
      )
    `).catch(() => {});
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_hn_hospitals_network_id ON hospital_network_hospitals(network_id)`).catch(() => {});
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_hn_hospitals_hospital_id ON hospital_network_hospitals(hospital_id)`).catch(() => {});

    // Ensure vet_hospitals.verification_status allows 'approved'
    await this.pool.query(`ALTER TABLE vet_hospitals DROP CONSTRAINT IF EXISTS vet_hospitals_verification_status_check`).catch(() => {});
    await this.pool.query(`
      ALTER TABLE vet_hospitals ADD CONSTRAINT vet_hospitals_verification_status_check
      CHECK (verification_status IN ('pending_documents', 'under_review', 'approved', 'rejected', 'expired'))
    `).catch(() => {});

    // Make invitee_name optional on hospital_staff_invites (label says "(optional)")
    await this.pool.query(`ALTER TABLE hospital_staff_invites ALTER COLUMN invitee_name DROP NOT NULL`).catch(() => {});

    // Network Custom Roles table (safety net — canonical schema is in init.sql)
    await this.pool.query(`
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
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_ncr_network ON network_custom_roles(network_id)`).catch(() => {});

    // Make users.phone nullable — hospital_staff registering via invite may not have a phone
    await this.pool.query(`ALTER TABLE users ALTER COLUMN phone DROP NOT NULL`).catch(() => {});

    // Add unique constraint to staff_positions if not exists (needed for ON CONFLICT)
    await this.pool.query(`
      DO $$ BEGIN
        ALTER TABLE staff_positions ADD CONSTRAINT staff_positions_hospital_user_unique UNIQUE (hospital_id, user_id);
      EXCEPTION WHEN duplicate_table THEN NULL;
      END $$;
    `).catch(() => {});

    // Email settings defaults
    await this.pool.query(`
      INSERT INTO system_settings (key, value, description, category) VALUES
        ('email.devRedirect', '', 'Dev/demo email redirect address (all emails go here when set)', 'email'),
        ('email.fromName', 'VetCare', 'Email sender display name', 'email'),
        ('email.fromAddress', 'noreply@vetcare.app', 'Email sender address', 'email')
      ON CONFLICT (key) DO NOTHING
    `).catch(() => {});

    // Network security audit log table (P2-GAP1)
    await this.pool.query(`
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
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_nsa_network ON network_security_audit(network_id)`).catch(() => {});
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_nsa_actor ON network_security_audit(actor_id)`).catch(() => {});
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_nsa_created ON network_security_audit(created_at DESC)`).catch(() => {});

    // Time-bound membership columns on hospital_network_members (P2-GAP3)
    await this.pool.query(`ALTER TABLE hospital_network_members ADD COLUMN IF NOT EXISTS valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP`).catch(() => {});
    await this.pool.query(`ALTER TABLE hospital_network_members ADD COLUMN IF NOT EXISTS valid_until TIMESTAMP`).catch(() => {});

    // P3-CRITICAL1: Add network_id to medical data tables
    for (const table of ['consultations', 'prescriptions', 'medical_records', 'lab_results', 'vaccination_records', 'workflow_cases', 'video_sessions']) {
      await this.pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS network_id UUID REFERENCES hospital_networks(id) ON DELETE SET NULL`).catch(() => {});
      await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_${table}_network ON ${table}(network_id)`).catch(() => {});
    }

    // P4-HIGH1: user_roles table (secondary roles, additive)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS user_roles (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL CHECK (role IN ('pet_owner','farmer','veterinarian','admin','corporate_admin','hospital_staff')),
        is_primary BOOLEAN DEFAULT false,
        granted_by UUID REFERENCES users(id),
        granted_at TIMESTAMPTZ DEFAULT NOW(),
        notes TEXT,
        UNIQUE(user_id, role)
      )
    `).catch(() => {});
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id)`).catch(() => {});

    // Backfill user_roles from users.role for existing users (idempotent via ON CONFLICT DO NOTHING)
    await this.pool.query(`
      INSERT INTO user_roles (user_id, role, is_primary, granted_at)
      SELECT id, role, true, created_at FROM users
      ON CONFLICT (user_id, role) DO NOTHING
    `).catch(() => {});

    // P4-MED1: animal_care_contexts.hospital_id safety-net (already in init.sql CREATE TABLE)
    await this.pool.query(
      `ALTER TABLE animal_care_contexts ADD COLUMN IF NOT EXISTS hospital_id UUID REFERENCES vet_hospitals(id) ON DELETE SET NULL`
    ).catch(() => {});

    // P4-MED2: Link platform referrals ↔ network referrals
    await this.pool.query(
      `ALTER TABLE referrals ADD COLUMN IF NOT EXISTS network_referral_id UUID REFERENCES network_referrals(id) ON DELETE SET NULL`
    ).catch(() => {});
    await this.pool.query(
      `ALTER TABLE network_referrals ADD COLUMN IF NOT EXISTS platform_referral_id UUID REFERENCES referrals(id) ON DELETE SET NULL`
    ).catch(() => {});

    // P6-BRANDING: New branding/operational columns for hospital_networks
    await this.pool.query(`ALTER TABLE hospital_networks ADD COLUMN IF NOT EXISTS website_url TEXT`).catch(() => {});
    await this.pool.query(`ALTER TABLE hospital_networks ADD COLUMN IF NOT EXISTS operating_hours JSONB`).catch(() => {});
    await this.pool.query(`ALTER TABLE hospital_networks ADD COLUMN IF NOT EXISTS specializations TEXT[]`).catch(() => {});
    await this.pool.query(`ALTER TABLE hospital_networks ADD COLUMN IF NOT EXISTS emergency_services BOOLEAN DEFAULT false`).catch(() => {});
    // Widen existing varchar columns to TEXT for base64 storage
    await this.pool.query(`ALTER TABLE hospital_networks ALTER COLUMN logo_url TYPE TEXT`).catch(() => {});
    await this.pool.query(`ALTER TABLE hospital_networks ALTER COLUMN website TYPE TEXT`).catch(() => {});
    await this.pool.query(`ALTER TABLE hospital_networks ALTER COLUMN contact_phone TYPE VARCHAR(50)`).catch(() => {});

    // P6-APPROVAL: network_approval_events table
    await this.pool.query(`
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
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_network_approval_network_id ON network_approval_events(network_id)`).catch(() => {});

    // P6-NOTIFICATIONS: digest preference column on users
    await this.pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS digest_emails_enabled BOOLEAN DEFAULT true`).catch(() => {});

    // H2: Safety-net — medical_records.consultation_id (already in init.sql but may be missing on older DBs)
    await this.pool.query(`ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL`).catch(() => {});

    // H6: invite_status on hospital_network_members for pending/active invite flow
    await this.pool.query(`ALTER TABLE hospital_network_members ADD COLUMN IF NOT EXISTS invite_status VARCHAR(20) DEFAULT 'active'`).catch(() => {});

    // Fix dangerous CASCADE deletes (existing DB migration)
    await this.pool.query(`
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
    await this.pool.query(`CREATE TABLE IF NOT EXISTS disputes (
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
    await this.pool.query(`ALTER TABLE hospital_network_members ADD COLUMN IF NOT EXISTS department VARCHAR(100)`).catch(() => {});

    // ── PHARMACY MODULE (safety net for existing DBs) ──────────────────────
    // Pharmacy tables — created if not exists (idempotent)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS hospital_pharmacies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        network_id UUID NOT NULL REFERENCES hospital_networks(id) ON DELETE CASCADE,
        hospital_id UUID REFERENCES vet_hospitals(id) ON DELETE SET NULL,
        pharmacy_name VARCHAR(255) NOT NULL,
        address TEXT, phone VARCHAR(50), email VARCHAR(255), license_number VARCHAR(100),
        operating_hours JSONB DEFAULT '{}', is_primary_pharmacy BOOLEAN DEFAULT false,
        is_accepting_requests BOOLEAN DEFAULT true, is_active BOOLEAN DEFAULT true,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `).catch(() => {});
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS pharmacy_suppliers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        network_id UUID NOT NULL REFERENCES hospital_networks(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL, contact_name VARCHAR(200), email VARCHAR(255),
        phone VARCHAR(50), address TEXT, is_approved BOOLEAN DEFAULT true,
        payment_terms VARCHAR(100), lead_time_days INTEGER DEFAULT 7, notes TEXT,
        is_active BOOLEAN DEFAULT true, created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `).catch(() => {});
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS pharmacy_medications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        network_id UUID NOT NULL REFERENCES hospital_networks(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL, generic_name VARCHAR(255),
        form VARCHAR(50) DEFAULT 'tablet', strength VARCHAR(100), unit VARCHAR(50) DEFAULT 'unit',
        supplier_id UUID REFERENCES pharmacy_suppliers(id) ON DELETE SET NULL,
        unit_cost DECIMAL(10,2) DEFAULT 0, selling_price DECIMAL(10,2) DEFAULT 0,
        min_stock_level INTEGER DEFAULT 10, max_stock_level INTEGER DEFAULT 500,
        reorder_point INTEGER DEFAULT 20, reorder_quantity INTEGER DEFAULT 100,
        contraindications TEXT[], side_effects TEXT[], common_interactions TEXT[],
        manufacturer VARCHAR(255), registration_number VARCHAR(100),
        is_controlled BOOLEAN DEFAULT false, is_active BOOLEAN DEFAULT true,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `).catch(() => {});
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS pharmacy_reorder_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pharmacy_id UUID NOT NULL REFERENCES hospital_pharmacies(id) ON DELETE CASCADE,
        med_id UUID NOT NULL REFERENCES pharmacy_medications(id) ON DELETE CASCADE,
        supplier_id UUID REFERENCES pharmacy_suppliers(id) ON DELETE SET NULL,
        requested_qty INTEGER NOT NULL DEFAULT 0,
        requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
        triggered_by VARCHAR(20) DEFAULT 'manual', status VARCHAR(30) DEFAULT 'pending',
        requested_at TIMESTAMPTZ DEFAULT NOW(), confirmed_at TIMESTAMPTZ,
        shipped_at TIMESTAMPTZ, received_at TIMESTAMPTZ,
        tracking_number VARCHAR(200), expected_delivery_date DATE, notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `).catch(() => {});
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS pharmacy_inventory (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pharmacy_id UUID NOT NULL REFERENCES hospital_pharmacies(id) ON DELETE CASCADE,
        med_id UUID NOT NULL REFERENCES pharmacy_medications(id) ON DELETE CASCADE,
        batch_number VARCHAR(100), quantity INTEGER NOT NULL DEFAULT 0, unit VARCHAR(50) DEFAULT 'unit',
        expiry_date DATE, received_at TIMESTAMPTZ DEFAULT NOW(),
        received_from VARCHAR(255), received_by UUID REFERENCES users(id) ON DELETE SET NULL,
        location_code VARCHAR(50),
        shipment_request_id UUID REFERENCES pharmacy_reorder_requests(id) ON DELETE SET NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `).catch(() => {});
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS pharmacy_stock_adjustments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pharmacy_id UUID NOT NULL REFERENCES hospital_pharmacies(id) ON DELETE CASCADE,
        med_id UUID NOT NULL REFERENCES pharmacy_medications(id) ON DELETE CASCADE,
        inventory_id UUID REFERENCES pharmacy_inventory(id) ON DELETE SET NULL,
        batch_number VARCHAR(100), adjustment_qty INTEGER NOT NULL,
        adjustment_type VARCHAR(20) NOT NULL, reason TEXT, evidence_url TEXT,
        adjusted_by UUID REFERENCES users(id) ON DELETE SET NULL,
        adjusted_at TIMESTAMPTZ DEFAULT NOW(), created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `).catch(() => {});
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS prescription_reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
        pharmacist_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        review_status VARCHAR(30) NOT NULL,
        validation_checks JSONB DEFAULT '{"dosage_ok":false,"allergy_ok":false,"interaction_ok":false,"stock_ok":false}',
        findings TEXT[], suggested_modifications TEXT, rejection_reason TEXT,
        reviewed_at TIMESTAMPTZ DEFAULT NOW(), created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `).catch(() => {});
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS dispensing_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
        pharmacy_id UUID NOT NULL REFERENCES hospital_pharmacies(id) ON DELETE RESTRICT,
        pharmacist_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        dispensing_method VARCHAR(30) DEFAULT 'walk_in_pickup',
        dispensing_status VARCHAR(20) DEFAULT 'pending',
        total_cost DECIMAL(10,2) DEFAULT 0,
        prepared_at TIMESTAMPTZ, handed_over_at TIMESTAMPTZ,
        received_by VARCHAR(200), signature_url TEXT, notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `).catch(() => {});
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS dispensing_line_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        dispensing_record_id UUID NOT NULL REFERENCES dispensing_records(id) ON DELETE CASCADE,
        med_id UUID NOT NULL REFERENCES pharmacy_medications(id) ON DELETE RESTRICT,
        inventory_id UUID REFERENCES pharmacy_inventory(id) ON DELETE SET NULL,
        batch_number VARCHAR(100), quantity_dispensed INTEGER NOT NULL DEFAULT 0,
        unit VARCHAR(50) DEFAULT 'unit', unit_price DECIMAL(10,2) DEFAULT 0,
        line_total DECIMAL(10,2) DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `).catch(() => {});
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS pharmacy_medication_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_network_id UUID NOT NULL REFERENCES hospital_networks(id) ON DELETE CASCADE,
        source_hospital_id UUID REFERENCES vet_hospitals(id) ON DELETE SET NULL,
        destination_hospital_id UUID REFERENCES vet_hospitals(id) ON DELETE SET NULL,
        prescription_id UUID REFERENCES prescriptions(id) ON DELETE SET NULL,
        requested_medications JSONB NOT NULL DEFAULT '[]',
        status VARCHAR(20) DEFAULT 'pending',
        tracking_number VARCHAR(200),
        fulfilled_by UUID REFERENCES users(id) ON DELETE SET NULL,
        decline_reason TEXT, notes TEXT,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `).catch(() => {});

    // Pharmacy columns on prescriptions (existing DB safety net)
    const pharmacyPrescriptionCols = [
      `ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS review_status VARCHAR(30) DEFAULT 'pending_review'`,
      `ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL`,
      `ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ`,
      `ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS review_notes TEXT`,
      `ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS is_network_coordinated BOOLEAN DEFAULT false`,
      `ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS target_pharmacy_id UUID REFERENCES hospital_pharmacies(id) ON DELETE SET NULL`,
    ];
    for (const ddl of pharmacyPrescriptionCols) {
      await this.pool.query(ddl).catch(() => {});
    }

    // Add pharmacist to users.role CHECK
    await this.pool.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`).catch(() => {});
    await this.pool.query(`
      ALTER TABLE users ADD CONSTRAINT users_role_check
        CHECK (role IN ('farmer', 'pet_owner', 'veterinarian', 'admin', 'corporate_admin', 'hospital_staff', 'pharmacist'))
    `).catch(() => {});

    // Also update user_roles role CHECK to include pharmacist
    await this.pool.query(`ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check`).catch(() => {});
    await this.pool.query(`
      ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check
        CHECK (role IN ('farmer','pet_owner','veterinarian','admin','corporate_admin','hospital_staff','pharmacist'))
    `).catch(() => {});

    // Pharmacy indexes
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_hospital_pharmacies_network ON hospital_pharmacies(network_id)`).catch(() => {});
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_pharmacy ON pharmacy_inventory(pharmacy_id)`).catch(() => {});
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_expiry ON pharmacy_inventory(expiry_date)`).catch(() => {});
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_dispensing_records_pharmacy ON dispensing_records(pharmacy_id)`).catch(() => {});
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_prescription_reviews_prescription ON prescription_reviews(prescription_id)`).catch(() => {});

    // ── Phase 4: Pharmacy billing integration ─────────────────
    // Add dispensing_id and payment_source to payments (link dispensing to payment system)
    await this.pool.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS dispensing_id UUID REFERENCES dispensing_records(id) ON DELETE SET NULL`).catch(() => {});
    await this.pool.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_source VARCHAR(30) DEFAULT 'consultation'`).catch(() => {});
    await this.pool.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='payments_payment_source_check') THEN
          ALTER TABLE payments ADD CONSTRAINT payments_payment_source_check
            CHECK (payment_source IN ('consultation','pharmacy','subscription','other'));
        END IF;
      END $$
    `).catch(() => {});
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_payments_dispensing_id ON payments(dispensing_id)`).catch(() => {});
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_payments_payment_source ON payments(payment_source)`).catch(() => {});

    // Add reviewed_by / reviewed_at / review_notes to prescriptions (safety net)
    await this.pool.query(`ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL`).catch(() => {});
    await this.pool.query(`ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ`).catch(() => {});
    await this.pool.query(`ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS review_notes TEXT`).catch(() => {});

    // Add withdrawal_period_days to pharmacy_medications (for livestock)
    await this.pool.query(`ALTER TABLE pharmacy_medications ADD COLUMN IF NOT EXISTS withdrawal_period_days INTEGER DEFAULT 0`).catch(() => {});
    await this.pool.query(`ALTER TABLE pharmacy_medications ADD COLUMN IF NOT EXISTS is_refrigerated BOOLEAN DEFAULT false`).catch(() => {});

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

import { Pool } from 'pg';
import logger from '../../logger';

import { ensurePaymentModuleSchema } from '../ensurePaymentModuleSchema';
import { BOOKING_TYPES_SQL } from '../constants';

export async function phase1GeneralSafetyNets(pool: Pool): Promise<void> {
    const defaults = [
      { key: 'display.timeFormat', value: '12h', category: 'display', description: 'Time display format: 12h (AM/PM) or 24h' },
      { key: 'display.dateFormat', value: 'MMM d, yyyy', category: 'display', description: 'Date display format' },
      { key: 'consultation.joinWindowMinutes', value: '5', category: 'consultation', description: 'Minutes before scheduled time when Join/Start button becomes available' },
      { key: 'booking.maxReschedules', value: '1', category: 'booking', description: 'Maximum times a user can reschedule before doctor acceptance (0 = unlimited)' },
      { key: 'payment.currency', value: 'INR', category: 'payment', description: 'Platform currency code (e.g. USD, INR, EUR, GBP)' },
      // Prescription template defaults
      { key: 'prescription.clinicName', value: 'waytovet Platform', category: 'prescription', description: 'Clinic / platform name shown on prescription letterhead' },
      { key: 'prescription.clinicTagline', value: 'Compassionate Care for Your Animals', category: 'prescription', description: 'Tagline shown below clinic name on prescriptions' },
      { key: 'prescription.clinicAddress', value: '123 Veterinary Avenue, Chennai, Tamil Nadu 600001, India', category: 'prescription', description: 'Full clinic address for prescription footer' },
      { key: 'prescription.clinicPhone', value: '+91 44 1234 5678', category: 'prescription', description: 'Phone number printed on prescriptions' },
      { key: 'prescription.clinicEmail', value: 'care@vetcareplatform.com', category: 'prescription', description: 'Email address printed on prescriptions' },
      { key: 'prescription.clinicWebsite', value: 'www.vetcareplatform.com', category: 'prescription', description: 'Website URL printed on prescriptions' },
      { key: 'prescription.registrationNumber', value: 'VET-REG-2024-001', category: 'prescription', description: 'Platform/clinic registration or license number' },
      { key: 'prescription.clinicLogo', value: '', category: 'prescription', description: 'Logo URL or base64 for prescription letterhead (leave blank to use default icon)' },
      { key: 'prescription.footerText', value: 'This prescription is digitally generated and valid until the date specified. Contact the prescribing veterinarian for queries.', category: 'prescription', description: 'Disclaimer text in prescription footer' },
      // Certificate template defaults
      { key: 'cert.clinicName', value: 'waytovet Platform', category: 'cert', description: 'Clinic / platform name shown on certificate letterhead' },
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
      await pool.query(
        `INSERT INTO system_settings (id, key, value, category, description)
         VALUES (gen_random_uuid(), $1, $2, $3, $4)
         ON CONFLICT (key) DO NOTHING`,
        [d.key, d.value, d.category, d.description]
      );
    }
    // Ensure reschedule_count column exists on bookings (safe for existing DBs)
    await pool.query(
      `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reschedule_count INTEGER NOT NULL DEFAULT 0`
    ).catch(() => { /* column may already exist */ });

    // Payment module (Phase P0) - safety net mirroring migrations/012_payment_module.sql
    try {
      await ensurePaymentModuleSchema(pool);
    } catch (e: any) {
      logger.warn('ensurePaymentModuleSchema failed (non-blocking)', { error: e.message });
    }

    // Ensure ALL bookings columns that may have been added after initial table creation
    const bookingColumns = [
      `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS missed_by VARCHAR(20)`,
      `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_by UUID`,
      `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP`,
      `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS enterprise_id UUID`,
      `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS group_id UUID`,
    ];
    for (const ddl of bookingColumns) {
      await pool.query(ddl).catch(() => {});
    }

    // Extend booking_type constraint to allow farm_visit and herd_consultation
    await pool.query(
      `ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_booking_type_check`
    ).catch(() => {});
    await pool.query(
      `ALTER TABLE bookings ADD CONSTRAINT bookings_booking_type_check
       CHECK (booking_type IN (${BOOKING_TYPES_SQL}))`
    ).catch(() => {});

    // Ensure vet_profiles columns added after initial table creation
    await pool.query(
      `ALTER TABLE vet_profiles ADD COLUMN IF NOT EXISTS certificate_types TEXT[] DEFAULT '{}'`
    ).catch(() => {});

    // Add new farm cert columns to vet_certificates (safety net for existing tables)
    await Promise.all([
      pool.query(`ALTER TABLE vet_certificates ADD COLUMN IF NOT EXISTS movement_details JSONB`).catch(() => {}),
      pool.query(`ALTER TABLE vet_certificates ADD COLUMN IF NOT EXISTS herd_details JSONB`).catch(() => {}),
    ]);

    // Expand vet_certificates CHECK constraint to include 4 farm/enterprise certificate types
    // added after initial deployment. Postgres cannot ALTER a CHECK inline - must drop+recreate.
    await pool.query(`
      ALTER TABLE vet_certificates
        DROP CONSTRAINT IF EXISTS vet_certificates_certificate_type_check
    `).catch(() => {});
    await pool.query(`
      ALTER TABLE vet_certificates
        ADD CONSTRAINT vet_certificates_certificate_type_check
        CHECK (certificate_type IN (
          'health_certificate','fitness_to_travel','rabies_vaccination','vaccination_record',
          'pre_travel','sterilization','treatment','animal_injury','post_mortem',
          'breeding_soundness','pregnancy_diagnosis','infertility_evaluation',
          'fitness_for_sale','animal_valuation',
          'movement_permit','herd_health_certificate','slaughter_fitness','export_health_certificate'
        ))
    `).catch((e: any) => {
      logger.warn('Could not update vet_certificates_certificate_type_check constraint', { error: e.message });
    });

    // Ensure enterprise-related tables exist FIRST (vet_certificates has a FK to enterprises)
    await pool.query(
      `CREATE TABLE IF NOT EXISTS enterprises (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         name VARCHAR(255) NOT NULL,
         enterprise_type VARCHAR(50),
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
       )`
    ).catch(() => { /* table may already exist */ });

    // Ensure vet_certificates table exists (safety net - must run AFTER enterprises is guaranteed)
    await pool.query(`
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
    await pool.query(
      `CREATE TABLE IF NOT EXISTS animal_groups (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         name VARCHAR(255) NOT NULL,
         group_type VARCHAR(50),
         enterprise_id UUID,
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
       )`
    ).catch(() => { /* table may already exist */ });

    // Ensure animal_id_sequences table exists (race-safe VC-ID generation)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS animal_id_sequences (
        species  VARCHAR(20) NOT NULL,
        year     INTEGER     NOT NULL,
        last_seq INTEGER     NOT NULL DEFAULT 0,
        PRIMARY KEY (species, year)
      )
    `).catch(() => {});

    // Ensure id_prefix column exists on hospital_networks
    await pool.query(
      `ALTER TABLE hospital_networks ADD COLUMN IF NOT EXISTS id_prefix VARCHAR(10)`
    ).catch(() => {});

    // Ensure created_by column exists on hospital_networks (critical - approve + corporate dashboard queries use it)
    await pool.query(
      `ALTER TABLE hospital_networks ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL`
    ).catch(() => {});

    // Account status system - account_status replaces is_active as the primary login gate
    await pool.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) NOT NULL DEFAULT 'active'`
    ).catch(() => {});
    await pool.query(
      `ALTER TABLE users DROP CONSTRAINT IF EXISTS users_account_status_check`
    ).catch(() => {});
    await pool.query(
      `ALTER TABLE users ADD CONSTRAINT users_account_status_check
       CHECK (account_status IN ('active','pending_approval','frozen','suspended'))`
    ).catch(() => {});
    await pool.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS freeze_reason TEXT`
    ).catch(() => {});
    await pool.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMP`
    ).catch(() => {});
    await pool.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS frozen_by UUID`
    ).catch(() => {});
    // Sync existing records: is_active=false → suspended; is_active=true → stays active
    await pool.query(
      `UPDATE users SET account_status = 'suspended'
       WHERE is_active = false AND account_status = 'active'`
    ).catch(() => {});

    // Geospatial extensions for marketplace proximity search
    await pool.query('CREATE EXTENSION IF NOT EXISTS cube CASCADE').catch(() => {});
    await pool.query('CREATE EXTENSION IF NOT EXISTS earthdistance CASCADE').catch(() => {});
    // Seed auction_enabled feature flag (disabled by default)
    await pool.query(
      `INSERT INTO marketplace_monetization_settings (setting_key, is_enabled, description, category)
       VALUES ('auction_enabled', false, 'Enable or disable the auction feature platform-wide', 'feature')
       ON CONFLICT (setting_key) DO NOTHING`
    ).catch(() => {});

    // Fix 2: Ensure id_prefix is unique across all networks
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_hospital_networks_id_prefix 
      ON hospital_networks(id_prefix)
    `).catch(() => {});

    // C1: Prevent double-booking race condition via unique partial index
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_vet_slot_unique
        ON bookings(veterinarian_id, scheduled_date, time_slot_start)
        WHERE status NOT IN ('cancelled', 'missed')
    `).catch(() => {});

    // Ensure network_patient_id_sequences table exists (race-safe per-network patient ID generation)
    await pool.query(`
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
      const noIdRes = await pool.query(
        `SELECT id, species, EXTRACT(YEAR FROM created_at)::int AS yr
         FROM animals
         WHERE unique_id IS NULL OR unique_id !~ '^VC-[A-Z]+-[0-9]{2}-[0-9]{6}$'
         ORDER BY created_at`
      );
      for (const row of noIdRes.rows) {
        const code = speciesCodeMap[(row.species || '').toLowerCase().trim()] || 'OTH';
        const yr = row.yr % 100;
        const seqRes = await pool.query(
          `INSERT INTO animal_id_sequences (species, year, last_seq)
           VALUES ($1, $2, 1)
           ON CONFLICT (species, year) DO UPDATE
             SET last_seq = animal_id_sequences.last_seq + 1
           RETURNING last_seq`,
          [code, yr]
        );
        const seq = seqRes.rows[0].last_seq as number;
        const uid = `VC-${code}-${yr.toString().padStart(2, '0')}-${seq.toString().padStart(6, '0')}`;
        await pool.query(`UPDATE animals SET unique_id = $1 WHERE id = $2`, [uid, row.id]);
      }
      if (noIdRes.rows.length > 0) {
        logger.info(`Backfilled VC-IDs for ${noIdRes.rows.length} animal(s)`);
      }
    } catch (backfillErr: any) {
      logger.warn('Animal VC-ID backfill skipped', { error: backfillErr.message });
    }

}

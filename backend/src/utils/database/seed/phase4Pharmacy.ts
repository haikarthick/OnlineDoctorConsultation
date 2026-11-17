import { Pool } from 'pg';

import { SYSTEM_ROLES_SQL } from '../constants';

export async function phase4Pharmacy(pool: Pool): Promise<void> {
    // ── PHARMACY MODULE (safety net for existing DBs) ──────────────────────
    // Pharmacy tables - created if not exists (idempotent)
    await pool.query(`
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
    await pool.query(`
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
    await pool.query(`
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
    await pool.query(`
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
    await pool.query(`
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
    await pool.query(`
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
    await pool.query(`
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
    await pool.query(`
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
    await pool.query(`
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
    await pool.query(`
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
      await pool.query(ddl).catch(() => {});
    }

    // Keep users.role CHECK aligned with SYSTEM_ROLES (do not inline the list - see above)
    await pool.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`).catch(() => {});
    await pool.query(`
      ALTER TABLE users ADD CONSTRAINT users_role_check
        CHECK (role IN (${SYSTEM_ROLES_SQL}))
    `).catch(() => {});

    // Same for the additive user_roles table - this one is what blocks createProvider()'s
    // 'groomer' grant when it falls behind
    await pool.query(`ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check`).catch(() => {});
    await pool.query(`
      ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check
        CHECK (role IN (${SYSTEM_ROLES_SQL}))
    `).catch(() => {});

    // Pharmacy indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_hospital_pharmacies_network ON hospital_pharmacies(network_id)`).catch(() => {});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_pharmacy ON pharmacy_inventory(pharmacy_id)`).catch(() => {});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_expiry ON pharmacy_inventory(expiry_date)`).catch(() => {});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_dispensing_records_pharmacy ON dispensing_records(pharmacy_id)`).catch(() => {});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_prescription_reviews_prescription ON prescription_reviews(prescription_id)`).catch(() => {});

}

/**
 * Tier-3 Enterprise Migration — Innovative Advanced Features
 *
 * Tables:
 *   disease_predictions, outbreak_zones,
 *   genetic_profiles, lineage_pairs,
 *   iot_sensors, sensor_readings,
 *   traceability_events, product_batches, qr_codes,
 *   workforce_tasks, shift_schedules,
 *   report_templates, generated_reports
 */
import { Pool } from 'pg';

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'postgres123',
  database: 'veterinary_consultation'
});

async function runTier3Migration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ═══════════════════════════════════════════════════════════
    // 1. AI Disease Prediction & Outbreak Mapping
    // ═══════════════════════════════════════════════════════════
    await client.query(`
      CREATE TABLE IF NOT EXISTS disease_predictions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        enterprise_id UUID NOT NULL REFERENCES enterprises(id),
        animal_id UUID REFERENCES animals(id),
        group_id UUID REFERENCES animal_groups(id),
        disease_name VARCHAR(200) NOT NULL,
        risk_score NUMERIC(5,2) NOT NULL DEFAULT 0,
        confidence NUMERIC(5,2) NOT NULL DEFAULT 0,
        predicted_onset DATE,
        risk_factors JSONB DEFAULT '[]',
        recommended_actions JSONB DEFAULT '[]',
        status VARCHAR(30) DEFAULT 'active',
        outcome VARCHAR(30),
        created_by UUID REFERENCES users(id),
        resolved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('  ✓ disease_predictions table');

    await client.query(`
      CREATE TABLE IF NOT EXISTS outbreak_zones (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        enterprise_id UUID NOT NULL REFERENCES enterprises(id),
        location_id UUID REFERENCES locations(id),
        disease_name VARCHAR(200) NOT NULL,
        severity VARCHAR(20) DEFAULT 'low',
        affected_count INTEGER DEFAULT 0,
        total_at_risk INTEGER DEFAULT 0,
        radius_km NUMERIC(8,2),
        center_lat NUMERIC(10,7),
        center_lng NUMERIC(10,7),
        containment_status VARCHAR(30) DEFAULT 'monitoring',
        containment_actions JSONB DEFAULT '[]',
        started_at TIMESTAMPTZ DEFAULT NOW(),
        resolved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('  ✓ outbreak_zones table');

    // ═══════════════════════════════════════════════════════════
    // 2. Genomic Lineage & Genetic Diversity
    // ═══════════════════════════════════════════════════════════
    await client.query(`
      CREATE TABLE IF NOT EXISTS genetic_profiles (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        animal_id UUID NOT NULL REFERENCES animals(id),
        enterprise_id UUID NOT NULL REFERENCES enterprises(id),
        sire_id UUID REFERENCES animals(id),
        dam_id UUID REFERENCES animals(id),
        generation INTEGER DEFAULT 0,
        inbreeding_coefficient NUMERIC(6,4) DEFAULT 0,
        genetic_traits JSONB DEFAULT '{}',
        dna_test_date DATE,
        dna_lab VARCHAR(200),
        dna_sample_id VARCHAR(100),
        known_markers JSONB DEFAULT '[]',
        breed_purity_pct NUMERIC(5,2),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('  ✓ genetic_profiles table');

    await client.query(`
      CREATE TABLE IF NOT EXISTS lineage_pairs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        enterprise_id UUID NOT NULL REFERENCES enterprises(id),
        sire_id UUID NOT NULL REFERENCES animals(id),
        dam_id UUID NOT NULL REFERENCES animals(id),
        compatibility_score NUMERIC(5,2) DEFAULT 0,
        predicted_inbreeding NUMERIC(6,4) DEFAULT 0,
        predicted_traits JSONB DEFAULT '{}',
        recommendation VARCHAR(30) DEFAULT 'neutral',
        reason TEXT,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('  ✓ lineage_pairs table');

    // ═══════════════════════════════════════════════════════════
    // 3. IoT Sensor Integration
    // ═══════════════════════════════════════════════════════════
    await client.query(`
      CREATE TABLE IF NOT EXISTS iot_sensors (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        enterprise_id UUID NOT NULL REFERENCES enterprises(id),
        location_id UUID REFERENCES locations(id),
        animal_id UUID REFERENCES animals(id),
        sensor_type VARCHAR(60) NOT NULL,
        sensor_name VARCHAR(200) NOT NULL,
        serial_number VARCHAR(100),
        manufacturer VARCHAR(200),
        unit VARCHAR(30),
        min_threshold NUMERIC(10,2),
        max_threshold NUMERIC(10,2),
        reading_interval_seconds INTEGER DEFAULT 300,
        status VARCHAR(20) DEFAULT 'active',
        battery_level NUMERIC(5,2),
        last_reading_at TIMESTAMPTZ,
        firmware_version VARCHAR(50),
        metadata JSONB DEFAULT '{}',
        installed_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('  ✓ iot_sensors table');

    await client.query(`
      CREATE TABLE IF NOT EXISTS sensor_readings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        sensor_id UUID NOT NULL REFERENCES iot_sensors(id),
        enterprise_id UUID NOT NULL REFERENCES enterprises(id),
        value NUMERIC(12,4) NOT NULL,
        unit VARCHAR(30),
        is_anomaly BOOLEAN DEFAULT false,
        anomaly_type VARCHAR(50),
        metadata JSONB DEFAULT '{}',
        recorded_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('  ✓ sensor_readings table');

    // ═══════════════════════════════════════════════════════════
    // 4. Supply Chain & Traceability (Farm-to-Fork)
    // ═══════════════════════════════════════════════════════════
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_batches (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        enterprise_id UUID NOT NULL REFERENCES enterprises(id),
        batch_number VARCHAR(100) NOT NULL,
        product_type VARCHAR(60) NOT NULL,
        description TEXT,
        quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
        unit VARCHAR(30) DEFAULT 'kg',
        source_animal_ids UUID[] DEFAULT '{}',
        source_group_id UUID REFERENCES animal_groups(id),
        production_date DATE,
        expiry_date DATE,
        quality_grade VARCHAR(30),
        certifications JSONB DEFAULT '[]',
        current_holder VARCHAR(200),
        status VARCHAR(30) DEFAULT 'in_production',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('  ✓ product_batches table');

    await client.query(`
      CREATE TABLE IF NOT EXISTS traceability_events (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        enterprise_id UUID NOT NULL REFERENCES enterprises(id),
        batch_id UUID REFERENCES product_batches(id),
        animal_id UUID REFERENCES animals(id),
        event_type VARCHAR(60) NOT NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        location VARCHAR(200),
        gps_lat NUMERIC(10,7),
        gps_lng NUMERIC(10,7),
        recorded_by UUID REFERENCES users(id),
        verified_by UUID REFERENCES users(id),
        verification_hash VARCHAR(128),
        metadata JSONB DEFAULT '{}',
        event_date TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('  ✓ traceability_events table');

    await client.query(`
      CREATE TABLE IF NOT EXISTS qr_codes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        enterprise_id UUID NOT NULL REFERENCES enterprises(id),
        entity_type VARCHAR(30) NOT NULL,
        entity_id UUID NOT NULL,
        code_data TEXT NOT NULL,
        short_url VARCHAR(200),
        scan_count INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('  ✓ qr_codes table');

    // ═══════════════════════════════════════════════════════════
    // 5. Workforce & Task Management
    // ═══════════════════════════════════════════════════════════
    await client.query(`
      CREATE TABLE IF NOT EXISTS workforce_tasks (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        enterprise_id UUID NOT NULL REFERENCES enterprises(id),
        title VARCHAR(300) NOT NULL,
        description TEXT,
        task_type VARCHAR(60) DEFAULT 'general',
        priority VARCHAR(20) DEFAULT 'medium',
        status VARCHAR(20) DEFAULT 'pending',
        assigned_to UUID REFERENCES users(id),
        created_by UUID NOT NULL REFERENCES users(id),
        location_id UUID REFERENCES locations(id),
        animal_id UUID REFERENCES animals(id),
        group_id UUID REFERENCES animal_groups(id),
        checklist JSONB DEFAULT '[]',
        due_date TIMESTAMPTZ,
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        estimated_hours NUMERIC(6,2),
        actual_hours NUMERIC(6,2),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('  ✓ workforce_tasks table');

    await client.query(`
      CREATE TABLE IF NOT EXISTS shift_schedules (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        enterprise_id UUID NOT NULL REFERENCES enterprises(id),
        user_id UUID NOT NULL REFERENCES users(id),
        shift_date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        role_on_shift VARCHAR(100),
        location_id UUID REFERENCES locations(id),
        status VARCHAR(20) DEFAULT 'scheduled',
        check_in_at TIMESTAMPTZ,
        check_out_at TIMESTAMPTZ,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('  ✓ shift_schedules table');

    // ═══════════════════════════════════════════════════════════
    // 6. Advanced Report Builder & Export Center
    // ═══════════════════════════════════════════════════════════
    await client.query(`
      CREATE TABLE IF NOT EXISTS report_templates (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        enterprise_id UUID REFERENCES enterprises(id),
        name VARCHAR(200) NOT NULL,
        description TEXT,
        report_type VARCHAR(60) NOT NULL,
        config JSONB DEFAULT '{}',
        columns JSONB DEFAULT '[]',
        filters JSONB DEFAULT '{}',
        grouping JSONB DEFAULT '[]',
        is_system BOOLEAN DEFAULT false,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('  ✓ report_templates table');

    await client.query(`
      CREATE TABLE IF NOT EXISTS generated_reports (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        enterprise_id UUID NOT NULL REFERENCES enterprises(id),
        template_id UUID REFERENCES report_templates(id),
        name VARCHAR(200) NOT NULL,
        report_type VARCHAR(60) NOT NULL,
        format VARCHAR(20) DEFAULT 'json',
        parameters JSONB DEFAULT '{}',
        result_data JSONB DEFAULT '{}',
        row_count INTEGER DEFAULT 0,
        file_url VARCHAR(500),
        status VARCHAR(20) DEFAULT 'completed',
        generated_by UUID NOT NULL REFERENCES users(id),
        generated_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ
      )
    `);
    console.log('  ✓ generated_reports table');

    // ─── Indexes ─────────────────────────────────────────────
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_disease_pred_enterprise ON disease_predictions(enterprise_id)',
      'CREATE INDEX IF NOT EXISTS idx_disease_pred_status ON disease_predictions(status)',
      'CREATE INDEX IF NOT EXISTS idx_outbreak_zones_enterprise ON outbreak_zones(enterprise_id)',
      'CREATE INDEX IF NOT EXISTS idx_genetic_profiles_animal ON genetic_profiles(animal_id)',
      'CREATE INDEX IF NOT EXISTS idx_genetic_profiles_enterprise ON genetic_profiles(enterprise_id)',
      'CREATE INDEX IF NOT EXISTS idx_lineage_pairs_enterprise ON lineage_pairs(enterprise_id)',
      'CREATE INDEX IF NOT EXISTS idx_iot_sensors_enterprise ON iot_sensors(enterprise_id)',
      'CREATE INDEX IF NOT EXISTS idx_sensor_readings_sensor ON sensor_readings(sensor_id)',
      'CREATE INDEX IF NOT EXISTS idx_sensor_readings_recorded ON sensor_readings(recorded_at)',
      'CREATE INDEX IF NOT EXISTS idx_product_batches_enterprise ON product_batches(enterprise_id)',
      'CREATE INDEX IF NOT EXISTS idx_traceability_events_batch ON traceability_events(batch_id)',
      'CREATE INDEX IF NOT EXISTS idx_traceability_events_enterprise ON traceability_events(enterprise_id)',
      'CREATE INDEX IF NOT EXISTS idx_qr_codes_entity ON qr_codes(entity_type, entity_id)',
      'CREATE INDEX IF NOT EXISTS idx_workforce_tasks_enterprise ON workforce_tasks(enterprise_id)',
      'CREATE INDEX IF NOT EXISTS idx_workforce_tasks_assigned ON workforce_tasks(assigned_to)',
      'CREATE INDEX IF NOT EXISTS idx_workforce_tasks_status ON workforce_tasks(status)',
      'CREATE INDEX IF NOT EXISTS idx_shift_schedules_enterprise ON shift_schedules(enterprise_id)',
      'CREATE INDEX IF NOT EXISTS idx_shift_schedules_user ON shift_schedules(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_shift_schedules_date ON shift_schedules(shift_date)',
      'CREATE INDEX IF NOT EXISTS idx_report_templates_enterprise ON report_templates(enterprise_id)',
      'CREATE INDEX IF NOT EXISTS idx_generated_reports_enterprise ON generated_reports(enterprise_id)',
    ];
    for (const idx of indexes) {
      await client.query(idx);
    }
    console.log(`  ✓ ${indexes.length} indexes created`);

    await client.query('COMMIT');
    console.log('\n✅ Tier-3 migration completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Tier-3 migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runTier3Migration();

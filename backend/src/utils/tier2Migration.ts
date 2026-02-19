/**
 * Enterprise Migration — Advanced Features
 * 
 * Tables: breeding_records, feed_inventory, feed_consumption_logs,
 *         compliance_documents, financial_records, alert_rules, alert_events,
 *         health_observations
 */
import { Pool } from 'pg';

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'postgres123',
  database: 'veterinary_consultation'
});

async function runTier2Migration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ─── 1. Health Observations (granular health data) ───
    await client.query(`
      CREATE TABLE IF NOT EXISTS health_observations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        enterprise_id UUID NOT NULL REFERENCES enterprises(id),
        animal_id UUID REFERENCES animals(id),
        group_id UUID REFERENCES animal_groups(id),
        observer_id UUID NOT NULL REFERENCES users(id),
        observation_type VARCHAR(50) NOT NULL DEFAULT 'general',
        severity VARCHAR(20) NOT NULL DEFAULT 'normal',
        title VARCHAR(200) NOT NULL,
        description TEXT,
        body_temperature DECIMAL(5,2),
        weight DECIMAL(10,2),
        weight_unit VARCHAR(10) DEFAULT 'kg',
        heart_rate INT,
        respiratory_rate INT,
        body_condition_score INT,
        symptoms TEXT[],
        diagnosis TEXT,
        treatment_given TEXT,
        follow_up_date DATE,
        is_resolved BOOLEAN DEFAULT false,
        resolved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ health_observations table created');

    // ─── 2. Breeding Records ───
    await client.query(`
      CREATE TABLE IF NOT EXISTS breeding_records (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        enterprise_id UUID NOT NULL REFERENCES enterprises(id),
        dam_id UUID REFERENCES animals(id),
        sire_id UUID REFERENCES animals(id),
        breeding_method VARCHAR(50) NOT NULL DEFAULT 'natural',
        breeding_date DATE NOT NULL,
        expected_due_date DATE,
        actual_birth_date DATE,
        gestation_days INT,
        offspring_count INT DEFAULT 0,
        live_births INT DEFAULT 0,
        stillbirths INT DEFAULT 0,
        status VARCHAR(30) NOT NULL DEFAULT 'bred',
        semen_batch VARCHAR(100),
        technician_id UUID REFERENCES users(id),
        pregnancy_confirmed BOOLEAN DEFAULT false,
        pregnancy_check_date DATE,
        notes TEXT,
        outcome TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ breeding_records table created');

    // ─── 3. Feed Inventory ───
    await client.query(`
      CREATE TABLE IF NOT EXISTS feed_inventory (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        enterprise_id UUID NOT NULL REFERENCES enterprises(id),
        location_id UUID REFERENCES locations(id),
        feed_name VARCHAR(200) NOT NULL,
        feed_type VARCHAR(50) NOT NULL DEFAULT 'grain',
        brand VARCHAR(100),
        unit VARCHAR(20) NOT NULL DEFAULT 'kg',
        current_stock DECIMAL(12,2) NOT NULL DEFAULT 0,
        minimum_stock DECIMAL(12,2) DEFAULT 0,
        cost_per_unit DECIMAL(10,2) DEFAULT 0,
        supplier VARCHAR(200),
        batch_number VARCHAR(100),
        expiry_date DATE,
        storage_location VARCHAR(200),
        nutritional_info JSONB,
        is_active BOOLEAN DEFAULT true,
        last_restocked_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ feed_inventory table created');

    // ─── 4. Feed Consumption Logs ───
    await client.query(`
      CREATE TABLE IF NOT EXISTS feed_consumption_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        enterprise_id UUID NOT NULL REFERENCES enterprises(id),
        feed_id UUID NOT NULL REFERENCES feed_inventory(id),
        group_id UUID REFERENCES animal_groups(id),
        location_id UUID REFERENCES locations(id),
        animal_id UUID REFERENCES animals(id),
        quantity DECIMAL(10,2) NOT NULL,
        unit VARCHAR(20) NOT NULL DEFAULT 'kg',
        consumption_date DATE NOT NULL DEFAULT CURRENT_DATE,
        recorded_by UUID NOT NULL REFERENCES users(id),
        cost DECIMAL(10,2) DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ feed_consumption_logs table created');

    // ─── 5. Compliance Documents ───
    await client.query(`
      CREATE TABLE IF NOT EXISTS compliance_documents (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        enterprise_id UUID NOT NULL REFERENCES enterprises(id),
        document_type VARCHAR(50) NOT NULL,
        title VARCHAR(300) NOT NULL,
        description TEXT,
        reference_number VARCHAR(100),
        issued_date DATE,
        expiry_date DATE,
        issuing_authority VARCHAR(200),
        status VARCHAR(30) NOT NULL DEFAULT 'draft',
        related_campaign_id UUID REFERENCES treatment_campaigns(id),
        related_movement_id UUID REFERENCES movement_records(id),
        animal_ids UUID[],
        group_ids UUID[],
        document_data JSONB,
        file_url TEXT,
        verified_by UUID REFERENCES users(id),
        verified_at TIMESTAMP,
        notes TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ compliance_documents table created');

    // ─── 6. Financial Records ───
    await client.query(`
      CREATE TABLE IF NOT EXISTS financial_records (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        enterprise_id UUID NOT NULL REFERENCES enterprises(id),
        record_type VARCHAR(30) NOT NULL,
        category VARCHAR(50) NOT NULL,
        description TEXT,
        amount DECIMAL(12,2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'USD',
        transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
        reference_id UUID,
        reference_type VARCHAR(50),
        animal_id UUID REFERENCES animals(id),
        group_id UUID REFERENCES animal_groups(id),
        recorded_by UUID NOT NULL REFERENCES users(id),
        payment_method VARCHAR(30),
        vendor VARCHAR(200),
        invoice_number VARCHAR(100),
        receipt_url TEXT,
        tags TEXT[],
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ financial_records table created');

    // ─── 7. Alert Rules ───
    await client.query(`
      CREATE TABLE IF NOT EXISTS alert_rules (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        enterprise_id UUID NOT NULL REFERENCES enterprises(id),
        name VARCHAR(200) NOT NULL,
        description TEXT,
        alert_type VARCHAR(50) NOT NULL,
        conditions JSONB NOT NULL DEFAULT '{}',
        severity VARCHAR(20) NOT NULL DEFAULT 'info',
        is_enabled BOOLEAN DEFAULT true,
        check_interval_hours INT DEFAULT 24,
        notification_channels TEXT[] DEFAULT ARRAY['in_app'],
        target_roles TEXT[] DEFAULT ARRAY['owner', 'manager'],
        last_triggered_at TIMESTAMP,
        created_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ alert_rules table created');

    // ─── 8. Alert Events ───
    await client.query(`
      CREATE TABLE IF NOT EXISTS alert_events (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        enterprise_id UUID NOT NULL REFERENCES enterprises(id),
        rule_id UUID REFERENCES alert_rules(id),
        alert_type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL DEFAULT 'info',
        title VARCHAR(300) NOT NULL,
        message TEXT NOT NULL,
        data JSONB,
        is_read BOOLEAN DEFAULT false,
        is_acknowledged BOOLEAN DEFAULT false,
        acknowledged_by UUID REFERENCES users(id),
        acknowledged_at TIMESTAMP,
        related_entity_type VARCHAR(50),
        related_entity_id UUID,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ alert_events table created');

    // ─── Indexes ───
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_health_obs_enterprise ON health_observations(enterprise_id);
      CREATE INDEX IF NOT EXISTS idx_health_obs_animal ON health_observations(animal_id);
      CREATE INDEX IF NOT EXISTS idx_health_obs_type ON health_observations(observation_type);
      CREATE INDEX IF NOT EXISTS idx_breeding_enterprise ON breeding_records(enterprise_id);
      CREATE INDEX IF NOT EXISTS idx_breeding_dam ON breeding_records(dam_id);
      CREATE INDEX IF NOT EXISTS idx_breeding_status ON breeding_records(status);
      CREATE INDEX IF NOT EXISTS idx_feed_inv_enterprise ON feed_inventory(enterprise_id);
      CREATE INDEX IF NOT EXISTS idx_feed_log_enterprise ON feed_consumption_logs(enterprise_id);
      CREATE INDEX IF NOT EXISTS idx_feed_log_date ON feed_consumption_logs(consumption_date);
      CREATE INDEX IF NOT EXISTS idx_compliance_enterprise ON compliance_documents(enterprise_id);
      CREATE INDEX IF NOT EXISTS idx_compliance_type ON compliance_documents(document_type);
      CREATE INDEX IF NOT EXISTS idx_financial_enterprise ON financial_records(enterprise_id);
      CREATE INDEX IF NOT EXISTS idx_financial_date ON financial_records(transaction_date);
      CREATE INDEX IF NOT EXISTS idx_financial_type ON financial_records(record_type);
      CREATE INDEX IF NOT EXISTS idx_alert_rules_enterprise ON alert_rules(enterprise_id);
      CREATE INDEX IF NOT EXISTS idx_alert_events_enterprise ON alert_events(enterprise_id);
      CREATE INDEX IF NOT EXISTS idx_alert_events_read ON alert_events(is_read);
    `);
    console.log('✅ All indexes created');

    // ─── Add weight tracking columns to animals ───
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE animals ADD COLUMN IF NOT EXISTS birth_weight DECIMAL(10,2);
        ALTER TABLE animals ADD COLUMN IF NOT EXISTS current_weight DECIMAL(10,2);
        ALTER TABLE animals ADD COLUMN IF NOT EXISTS weight_unit VARCHAR(10) DEFAULT 'kg';
        ALTER TABLE animals ADD COLUMN IF NOT EXISTS last_weighed_at TIMESTAMP;
        ALTER TABLE animals ADD COLUMN IF NOT EXISTS expected_due_date DATE;
        ALTER TABLE animals ADD COLUMN IF NOT EXISTS breeding_status VARCHAR(30);
        ALTER TABLE animals ADD COLUMN IF NOT EXISTS last_breeding_date DATE;
        ALTER TABLE animals ADD COLUMN IF NOT EXISTS health_score INT DEFAULT 100;
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'Some animal columns may already exist: %', SQLERRM;
      END $$
    `);
    console.log('✅ Animals table extended with health/breeding fields');

    await client.query('COMMIT');
    console.log('\n🎉 migration completed successfully!');
    console.log('   New tables: health_observations, breeding_records, feed_inventory,');
    console.log('   feed_consumption_logs, compliance_documents, financial_records,');
    console.log('   alert_rules, alert_events');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runTier2Migration().catch(console.error);

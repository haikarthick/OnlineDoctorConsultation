/**
 * Tier-4 Enterprise Migration — Next-Generation Innovative Features
 *
 * Tables:
 *   ai_chat_sessions, ai_chat_messages,
 *   digital_twins, simulation_runs,
 *   marketplace_listings, marketplace_bids, marketplace_orders,
 *   sustainability_metrics, sustainability_goals,
 *   wellness_scorecards, wellness_reminders,
 *   geofence_zones, geospatial_events
 */
import { Pool } from 'pg';

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'postgres123',
  database: 'veterinary_consultation'
});

async function runTier4Migration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ═══════════════════════════════════════════════════════════
    // 1. AI Veterinary Copilot
    // ═══════════════════════════════════════════════════════════
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_chat_sessions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        enterprise_id UUID REFERENCES enterprises(id),
        user_id UUID NOT NULL REFERENCES users(id),
        animal_id UUID REFERENCES animals(id),
        title VARCHAR(300) DEFAULT 'New Chat',
        context_type VARCHAR(50) DEFAULT 'general',
        status VARCHAR(30) DEFAULT 'active',
        message_count INT DEFAULT 0,
        last_message_at TIMESTAMPTZ,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('  ✓ ai_chat_sessions table');

    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_chat_messages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        session_id UUID NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL DEFAULT 'user',
        content TEXT NOT NULL,
        content_type VARCHAR(30) DEFAULT 'text',
        tokens_used INT DEFAULT 0,
        confidence NUMERIC(5,2),
        sources JSONB DEFAULT '[]',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('  ✓ ai_chat_messages table');

    // ═══════════════════════════════════════════════════════════
    // 2. Digital Twin & Scenario Simulator
    // ═══════════════════════════════════════════════════════════
    await client.query(`
      CREATE TABLE IF NOT EXISTS digital_twins (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        enterprise_id UUID NOT NULL REFERENCES enterprises(id),
        name VARCHAR(200) NOT NULL,
        twin_type VARCHAR(50) NOT NULL DEFAULT 'farm',
        description TEXT,
        model_data JSONB DEFAULT '{}',
        current_state JSONB DEFAULT '{}',
        sync_status VARCHAR(30) DEFAULT 'synced',
        last_synced_at TIMESTAMPTZ DEFAULT NOW(),
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('  ✓ digital_twins table');

    await client.query(`
      CREATE TABLE IF NOT EXISTS simulation_runs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        twin_id UUID NOT NULL REFERENCES digital_twins(id) ON DELETE CASCADE,
        enterprise_id UUID NOT NULL REFERENCES enterprises(id),
        name VARCHAR(200) NOT NULL,
        scenario_type VARCHAR(50) NOT NULL DEFAULT 'disease_spread',
        parameters JSONB DEFAULT '{}',
        input_state JSONB DEFAULT '{}',
        result_data JSONB DEFAULT '{}',
        outcome_summary TEXT,
        status VARCHAR(30) DEFAULT 'pending',
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        duration_ms INT,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('  ✓ simulation_runs table');

    // ═══════════════════════════════════════════════════════════
    // 3. Marketplace & Auctions
    // ═══════════════════════════════════════════════════════════
    await client.query(`
      CREATE TABLE IF NOT EXISTS marketplace_listings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        enterprise_id UUID REFERENCES enterprises(id),
        seller_id UUID NOT NULL REFERENCES users(id),
        title VARCHAR(300) NOT NULL,
        description TEXT,
        category VARCHAR(60) NOT NULL DEFAULT 'animal',
        listing_type VARCHAR(30) DEFAULT 'fixed_price',
        price NUMERIC(12,2),
        currency VARCHAR(10) DEFAULT 'USD',
        quantity INT DEFAULT 1,
        unit VARCHAR(30),
        condition VARCHAR(30) DEFAULT 'new',
        images JSONB DEFAULT '[]',
        location VARCHAR(200),
        shipping_options JSONB DEFAULT '[]',
        tags JSONB DEFAULT '[]',
        status VARCHAR(30) DEFAULT 'active',
        featured BOOLEAN DEFAULT false,
        views_count INT DEFAULT 0,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('  ✓ marketplace_listings table');

    await client.query(`
      CREATE TABLE IF NOT EXISTS marketplace_bids (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        listing_id UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
        bidder_id UUID NOT NULL REFERENCES users(id),
        amount NUMERIC(12,2) NOT NULL,
        message TEXT,
        status VARCHAR(30) DEFAULT 'active',
        is_winning BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('  ✓ marketplace_bids table');

    await client.query(`
      CREATE TABLE IF NOT EXISTS marketplace_orders (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        listing_id UUID NOT NULL REFERENCES marketplace_listings(id),
        buyer_id UUID NOT NULL REFERENCES users(id),
        seller_id UUID NOT NULL REFERENCES users(id),
        quantity INT DEFAULT 1,
        unit_price NUMERIC(12,2) NOT NULL,
        total_price NUMERIC(12,2) NOT NULL,
        status VARCHAR(30) DEFAULT 'pending',
        payment_status VARCHAR(30) DEFAULT 'unpaid',
        shipping_address JSONB DEFAULT '{}',
        tracking_number VARCHAR(100),
        notes TEXT,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('  ✓ marketplace_orders table');

    // ═══════════════════════════════════════════════════════════
    // 4. Sustainability & Carbon Tracker
    // ═══════════════════════════════════════════════════════════
    await client.query(`
      CREATE TABLE IF NOT EXISTS sustainability_metrics (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        enterprise_id UUID NOT NULL REFERENCES enterprises(id),
        metric_type VARCHAR(60) NOT NULL,
        metric_name VARCHAR(200) NOT NULL,
        value NUMERIC(14,4) NOT NULL DEFAULT 0,
        unit VARCHAR(30),
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        category VARCHAR(60) DEFAULT 'general',
        scope VARCHAR(30) DEFAULT 'scope_1',
        data_source VARCHAR(100),
        notes TEXT,
        recorded_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('  ✓ sustainability_metrics table');

    await client.query(`
      CREATE TABLE IF NOT EXISTS sustainability_goals (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        enterprise_id UUID NOT NULL REFERENCES enterprises(id),
        goal_name VARCHAR(200) NOT NULL,
        description TEXT,
        metric_type VARCHAR(60) NOT NULL,
        target_value NUMERIC(14,4) NOT NULL,
        current_value NUMERIC(14,4) DEFAULT 0,
        unit VARCHAR(30),
        baseline_value NUMERIC(14,4),
        baseline_date DATE,
        target_date DATE NOT NULL,
        status VARCHAR(30) DEFAULT 'active',
        progress_pct NUMERIC(5,2) DEFAULT 0,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('  ✓ sustainability_goals table');

    // ═══════════════════════════════════════════════════════════
    // 5. Client Portal & Wellness Scorecards
    // ═══════════════════════════════════════════════════════════
    await client.query(`
      CREATE TABLE IF NOT EXISTS wellness_scorecards (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        animal_id UUID NOT NULL REFERENCES animals(id),
        enterprise_id UUID REFERENCES enterprises(id),
        owner_id UUID NOT NULL REFERENCES users(id),
        overall_score NUMERIC(5,2) DEFAULT 0,
        nutrition_score NUMERIC(5,2) DEFAULT 0,
        activity_score NUMERIC(5,2) DEFAULT 0,
        vaccination_score NUMERIC(5,2) DEFAULT 0,
        dental_score NUMERIC(5,2) DEFAULT 0,
        weight_status VARCHAR(30) DEFAULT 'normal',
        next_checkup DATE,
        recommendations JSONB DEFAULT '[]',
        risk_flags JSONB DEFAULT '[]',
        assessed_by UUID REFERENCES users(id),
        assessed_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('  ✓ wellness_scorecards table');

    await client.query(`
      CREATE TABLE IF NOT EXISTS wellness_reminders (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        animal_id UUID NOT NULL REFERENCES animals(id),
        owner_id UUID NOT NULL REFERENCES users(id),
        reminder_type VARCHAR(60) NOT NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        due_date DATE NOT NULL,
        status VARCHAR(30) DEFAULT 'pending',
        priority VARCHAR(20) DEFAULT 'medium',
        recurrence VARCHAR(30),
        recurrence_interval INT,
        snoozed_until DATE,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('  ✓ wellness_reminders table');

    // ═══════════════════════════════════════════════════════════
    // 6. Geospatial Analytics & Geofencing
    // ═══════════════════════════════════════════════════════════
    await client.query(`
      CREATE TABLE IF NOT EXISTS geofence_zones (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        enterprise_id UUID NOT NULL REFERENCES enterprises(id),
        name VARCHAR(200) NOT NULL,
        zone_type VARCHAR(50) DEFAULT 'boundary',
        center_lat NUMERIC(10,6),
        center_lng NUMERIC(10,6),
        radius_meters NUMERIC(12,2),
        polygon_coords JSONB DEFAULT '[]',
        color VARCHAR(20) DEFAULT '#3b82f6',
        alert_on_entry BOOLEAN DEFAULT false,
        alert_on_exit BOOLEAN DEFAULT true,
        is_restricted BOOLEAN DEFAULT false,
        status VARCHAR(30) DEFAULT 'active',
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('  ✓ geofence_zones table');

    await client.query(`
      CREATE TABLE IF NOT EXISTS geospatial_events (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        enterprise_id UUID NOT NULL REFERENCES enterprises(id),
        zone_id UUID REFERENCES geofence_zones(id),
        animal_id UUID REFERENCES animals(id),
        sensor_id UUID REFERENCES iot_sensors(id),
        event_type VARCHAR(50) NOT NULL,
        latitude NUMERIC(10,6) NOT NULL,
        longitude NUMERIC(10,6) NOT NULL,
        altitude NUMERIC(8,2),
        accuracy_meters NUMERIC(8,2),
        speed_kmh NUMERIC(8,2),
        heading NUMERIC(5,2),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('  ✓ geospatial_events table');

    // ═══════════════════════════════════════════════════════════
    // Indexes
    // ═══════════════════════════════════════════════════════════
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_user ON ai_chat_sessions(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_enterprise ON ai_chat_sessions(enterprise_id)',
      'CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_session ON ai_chat_messages(session_id)',
      'CREATE INDEX IF NOT EXISTS idx_digital_twins_enterprise ON digital_twins(enterprise_id)',
      'CREATE INDEX IF NOT EXISTS idx_simulation_runs_twin ON simulation_runs(twin_id)',
      'CREATE INDEX IF NOT EXISTS idx_simulation_runs_enterprise ON simulation_runs(enterprise_id)',
      'CREATE INDEX IF NOT EXISTS idx_marketplace_listings_seller ON marketplace_listings(seller_id)',
      'CREATE INDEX IF NOT EXISTS idx_marketplace_listings_category ON marketplace_listings(category, status)',
      'CREATE INDEX IF NOT EXISTS idx_marketplace_bids_listing ON marketplace_bids(listing_id)',
      'CREATE INDEX IF NOT EXISTS idx_marketplace_orders_buyer ON marketplace_orders(buyer_id)',
      'CREATE INDEX IF NOT EXISTS idx_marketplace_orders_seller ON marketplace_orders(seller_id)',
      'CREATE INDEX IF NOT EXISTS idx_sustainability_metrics_ent ON sustainability_metrics(enterprise_id, metric_type)',
      'CREATE INDEX IF NOT EXISTS idx_sustainability_goals_ent ON sustainability_goals(enterprise_id)',
      'CREATE INDEX IF NOT EXISTS idx_wellness_scorecards_animal ON wellness_scorecards(animal_id)',
      'CREATE INDEX IF NOT EXISTS idx_wellness_scorecards_owner ON wellness_scorecards(owner_id)',
      'CREATE INDEX IF NOT EXISTS idx_wellness_reminders_owner ON wellness_reminders(owner_id, status)',
      'CREATE INDEX IF NOT EXISTS idx_wellness_reminders_due ON wellness_reminders(due_date, status)',
      'CREATE INDEX IF NOT EXISTS idx_geofence_zones_enterprise ON geofence_zones(enterprise_id)',
      'CREATE INDEX IF NOT EXISTS idx_geospatial_events_ent ON geospatial_events(enterprise_id)',
      'CREATE INDEX IF NOT EXISTS idx_geospatial_events_zone ON geospatial_events(zone_id)',
      'CREATE INDEX IF NOT EXISTS idx_geospatial_events_animal ON geospatial_events(animal_id)',
      'CREATE INDEX IF NOT EXISTS idx_geospatial_events_time ON geospatial_events(created_at)',
    ];

    for (const idx of indexes) {
      await client.query(idx);
    }
    console.log(`  ✓ ${indexes.length} indexes created`);

    await client.query('COMMIT');
    console.log('\n✅ Tier-4 migration completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Tier-4 migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runTier4Migration();

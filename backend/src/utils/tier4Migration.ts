/**
 * Enterprise Migration — Next-Generation Innovative Features
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
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres123',
        database: process.env.DB_NAME || 'veterinary_consultation',
      }
);

async function runTier4Migration() {
  const client = await pool.connect();
  try {
    // Align search_path with the schema used by render-start.sh / init.sql
    const schema = process.env.DB_SCHEMA || 'public';
    await client.query(`SET search_path TO ${schema}, public`);

    await client.query('BEGIN');

    // ═══════════════════════════════════════════════════════════
    // 1. AI Veterinary Copilot
    // ═══════════════════════════════════════════════════════════
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_chat_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

    // ═══════════════════════════════════════════════════════════
    // Livestock Marketplace — extend marketplace_listings
    // ═══════════════════════════════════════════════════════════
    const livestockColumns = [
      `ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS species VARCHAR(60)`,
      `ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS breed VARCHAR(100)`,
      `ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS animal_age_months INT`,
      `ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS animal_weight_kg NUMERIC(8,2)`,
      `ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS gender VARCHAR(20)`,
      `ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS lactation_number INT`,
      `ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS daily_milk_yield NUMERIC(6,2)`,
      `ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS pregnancy_status VARCHAR(30)`,
      `ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS pregnancy_month INT`,
      `ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS vaccination_status VARCHAR(30) DEFAULT 'unknown'`,
      `ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS health_certificate BOOLEAN DEFAULT false`,
      `ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS listing_tier VARCHAR(20) DEFAULT 'standard'`,
      `ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS is_hot_deal BOOLEAN DEFAULT false`,
      `ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS linked_animal_id UUID`,
      `ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS auction_end_time TIMESTAMPTZ`,
      `ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS reserve_price NUMERIC(12,2)`,
      `ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20)`,
      `ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,7)`,
      `ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,7)`,
      `ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS admin_approved BOOLEAN DEFAULT true`,
      `ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS admin_notes TEXT`,
      `ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS rejection_reason TEXT`,
      // ── Compliance & Legal (PCA Act 1960, Dog Breeding Rules 2017, Pet Shop Rules 2018) ──
      `ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS seller_type VARCHAR(30) DEFAULT 'individual'`,
      `ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS registration_number VARCHAR(100)`,
      `ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS breeder_verified BOOLEAN DEFAULT false`,
      `ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS welfare_attestation BOOLEAN DEFAULT false`,
      `ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT false`,
      `ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ`,
    ];
    for (const col of livestockColumns) {
      try { await client.query(col); } catch {}
    }
    console.log('  ✓ marketplace_listings livestock + compliance columns added');

    // Indexes for livestock fields
    await client.query('CREATE INDEX IF NOT EXISTS idx_marketplace_listings_species ON marketplace_listings(species)').catch(() => {});
    await client.query('CREATE INDEX IF NOT EXISTS idx_marketplace_listings_breed ON marketplace_listings(breed)').catch(() => {});
    await client.query('CREATE INDEX IF NOT EXISTS idx_marketplace_listings_tier ON marketplace_listings(listing_tier)').catch(() => {});
    await client.query('CREATE INDEX IF NOT EXISTS idx_marketplace_listings_admin ON marketplace_listings(admin_approved)').catch(() => {});
    await client.query('CREATE INDEX IF NOT EXISTS idx_marketplace_listings_seller_type ON marketplace_listings(seller_type)').catch(() => {});
    console.log('  ✓ livestock indexes created');

    // ═══════════════════════════════════════════════════════════
    // 5. Marketplace Monetization Foundation
    // ═══════════════════════════════════════════════════════════
    await client.query(`
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
    `);
    console.log('  ✓ marketplace_monetization_settings table');

    await client.query(`
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
    `);
    console.log('  ✓ marketplace_plans table');

    await client.query(`
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
    `);
    console.log('  ✓ marketplace_subscriptions table');

    await client.query(`
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
    `);
    console.log('  ✓ listing_boosts table');

    await client.query(`
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
    `);
    console.log('  ✓ marketplace_inquiries table');

    await client.query(`
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
    `);
    console.log('  ✓ marketplace_transactions table');

    // Indexes for monetization tables
    await client.query('CREATE INDEX IF NOT EXISTS idx_mp_subscriptions_user ON marketplace_subscriptions(user_id)').catch(() => {});
    await client.query('CREATE INDEX IF NOT EXISTS idx_mp_subscriptions_status ON marketplace_subscriptions(status)').catch(() => {});
    await client.query('CREATE INDEX IF NOT EXISTS idx_listing_boosts_listing ON listing_boosts(listing_id)').catch(() => {});
    await client.query('CREATE INDEX IF NOT EXISTS idx_listing_boosts_active ON listing_boosts(is_active)').catch(() => {});
    await client.query('CREATE INDEX IF NOT EXISTS idx_mp_inquiries_listing ON marketplace_inquiries(listing_id)').catch(() => {});
    await client.query('CREATE INDEX IF NOT EXISTS idx_mp_inquiries_buyer ON marketplace_inquiries(buyer_id)').catch(() => {});
    await client.query('CREATE INDEX IF NOT EXISTS idx_mp_transactions_user ON marketplace_transactions(user_id)').catch(() => {});
    await client.query('CREATE INDEX IF NOT EXISTS idx_mp_transactions_type ON marketplace_transactions(transaction_type)').catch(() => {});
    console.log('  ✓ monetization indexes created');

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
      await client.query(
        `INSERT INTO marketplace_monetization_settings (id, setting_key, setting_value, is_enabled, description, category)
         VALUES (gen_random_uuid(), $1, $2::jsonb, false, $3, $4)
         ON CONFLICT (setting_key) DO NOTHING`,
        [d.key, d.value, d.desc, d.category]
      ).catch(() => {});
    }
    console.log('  ✓ default monetization settings seeded (all disabled)');

    // Seed default plans (inactive by default)
    const defaultPlans = [
      { name: 'Free', desc: 'Basic free plan for all users', price: 0, days: 0, features: JSON.stringify({ listings: 10, boosts: 0, analytics: false, support: 'community' }), maxListings: 10, boosts: 0, sort: 0 },
      { name: 'Starter', desc: 'For small sellers getting started', price: 299, days: 30, features: JSON.stringify({ listings: 25, boosts: 2, analytics: false, support: 'email' }), maxListings: 25, boosts: 2, sort: 1 },
      { name: 'Professional', desc: 'For active sellers and breeders', price: 799, days: 30, features: JSON.stringify({ listings: 100, boosts: 5, analytics: true, support: 'priority' }), maxListings: 100, boosts: 5, sort: 2 },
      { name: 'Enterprise', desc: 'Unlimited access for large farms', price: 1999, days: 30, features: JSON.stringify({ listings: -1, boosts: 20, analytics: true, support: 'dedicated' }), maxListings: -1, boosts: 20, sort: 3 },
    ];
    for (const p of defaultPlans) {
      await client.query(
        `INSERT INTO marketplace_plans (id, name, description, price, duration_days, features, max_listings, max_boosts_per_month, is_active, sort_order)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::jsonb, $6, $7, false, $8)
         ON CONFLICT DO NOTHING`,
        [p.name, p.desc, p.price, p.days, p.features, p.maxListings, p.boosts, p.sort]
      ).catch(() => {});
    }
    console.log('  ✓ default marketplace plans seeded (inactive)');

    await client.query('COMMIT');
    console.log('\n✅ migration completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runTier4Migration();

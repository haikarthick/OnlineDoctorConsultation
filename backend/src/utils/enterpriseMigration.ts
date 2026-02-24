/**
 * Enterprise Schema Migration
 * ============================
 * Adds enterprise/farm management tables and extends existing tables
 * for multi-tenant animal enterprises (farms, zoos, breeding facilities,
 * pet shops, sanctuaries, ranches, equestrian centers, aquaculture, etc.)
 *
 * Run: npx ts-node --project tsconfig.json src/utils/enterpriseMigration.ts
 */
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres123',
  database: process.env.DB_NAME || 'veterinary_consultation',
});

const migration = `
-- ============================================================
-- ENTERPRISE MIGRATION — Farms, Groups, Locations, Movements
-- ============================================================

-- ============================================================
-- E1. ENTERPRISES / FARMS
-- ============================================================
CREATE TABLE IF NOT EXISTS enterprises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  enterprise_type VARCHAR(50) NOT NULL
    CHECK (enterprise_type IN (
      'dairy_farm', 'poultry_farm', 'cattle_ranch', 'mixed_farm',
      'zoo', 'breeding_facility', 'pet_shop', 'sanctuary',
      'equestrian_center', 'aquaculture', 'wildlife_reserve',
      'veterinary_clinic', 'kennel', 'cattery', 'aviary', 'other'
    )),
  description TEXT,
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100) DEFAULT 'US',
  postal_code VARCHAR(20),
  gps_latitude DECIMAL(10,7),
  gps_longitude DECIMAL(10,7),
  total_area DECIMAL(12,2),
  area_unit VARCHAR(10) DEFAULT 'acres',
  license_number VARCHAR(100),
  regulatory_id VARCHAR(100),
  tax_id VARCHAR(100),
  phone VARCHAR(30),
  email VARCHAR(255),
  website VARCHAR(500),
  logo_url VARCHAR(500),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- E2. ENTERPRISE MEMBERS (multi-user access)
-- ============================================================
CREATE TABLE IF NOT EXISTS enterprise_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(30) NOT NULL DEFAULT 'worker'
    CHECK (role IN ('owner', 'manager', 'supervisor', 'worker', 'farm_vet', 'viewer')),
  title VARCHAR(100),
  permissions JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(enterprise_id, user_id)
);

-- ============================================================
-- E3. ANIMAL GROUPS (herds, flocks, pens, enclosures, tanks)
-- ============================================================
CREATE TABLE IF NOT EXISTS animal_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  group_type VARCHAR(50) NOT NULL
    CHECK (group_type IN (
      'herd', 'flock', 'pen', 'paddock', 'enclosure',
      'tank', 'aviary', 'kennel_group', 'breeding_group',
      'quarantine', 'nursery', 'production', 'other'
    )),
  species VARCHAR(50),
  breed VARCHAR(100),
  purpose VARCHAR(50)
    CHECK (purpose IN (
      'dairy', 'meat', 'breeding', 'layer', 'broiler',
      'companion', 'exhibition', 'conservation', 'racing',
      'working', 'research', 'rehabilitation', 'sale', 'other'
    )),
  target_count INTEGER DEFAULT 0,
  current_count INTEGER DEFAULT 0,
  description TEXT,
  color_code VARCHAR(7),
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- E4. LOCATIONS (barns, pens, paddocks, tanks, enclosures)
-- ============================================================
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  location_type VARCHAR(50) NOT NULL
    CHECK (location_type IN (
      'barn', 'stable', 'pen', 'paddock', 'field', 'pasture',
      'quarantine', 'isolation', 'aviary', 'tank', 'pond',
      'enclosure', 'kennel', 'cattery', 'warehouse', 'office',
      'treatment_area', 'milking_parlor', 'feed_storage', 'other'
    )),
  parent_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  capacity INTEGER DEFAULT 0,
  current_occupancy INTEGER DEFAULT 0,
  area DECIMAL(10,2),
  area_unit VARCHAR(10) DEFAULT 'sqft',
  gps_latitude DECIMAL(10,7),
  gps_longitude DECIMAL(10,7),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- E5. MOVEMENT RECORDS (animal/group transfers between locations)
-- ============================================================
CREATE TABLE IF NOT EXISTS movement_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
  animal_id UUID REFERENCES animals(id) ON DELETE SET NULL,
  group_id UUID REFERENCES animal_groups(id) ON DELETE SET NULL,
  from_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  to_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  movement_type VARCHAR(30) NOT NULL DEFAULT 'transfer'
    CHECK (movement_type IN ('transfer', 'intake', 'discharge', 'quarantine', 'sale', 'death', 'birth', 'import', 'export')),
  reason TEXT,
  animal_count INTEGER DEFAULT 1,
  transport_method VARCHAR(50),
  transport_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  regulatory_permit VARCHAR(100),
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  recorded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- E6. TREATMENT CAMPAIGNS (group-level treatments, vaccinations)
-- ============================================================
CREATE TABLE IF NOT EXISTS treatment_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
  group_id UUID REFERENCES animal_groups(id) ON DELETE SET NULL,
  campaign_type VARCHAR(50) NOT NULL
    CHECK (campaign_type IN (
      'vaccination', 'deworming', 'testing', 'treatment',
      'health_check', 'tagging', 'weighing', 'hoof_trimming',
      'shearing', 'dipping', 'other'
    )),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  product_used VARCHAR(200),
  dosage VARCHAR(100),
  target_count INTEGER DEFAULT 0,
  completed_count INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'planned'
    CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  scheduled_date DATE,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  administered_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  cost DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- E7. EXTEND ANIMALS TABLE (add enterprise columns)
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='animals' AND column_name='enterprise_id') THEN
    ALTER TABLE animals ADD COLUMN enterprise_id UUID REFERENCES enterprises(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='animals' AND column_name='group_id') THEN
    ALTER TABLE animals ADD COLUMN group_id UUID REFERENCES animal_groups(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='animals' AND column_name='current_location_id') THEN
    ALTER TABLE animals ADD COLUMN current_location_id UUID REFERENCES locations(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='animals' AND column_name='status') THEN
    ALTER TABLE animals ADD COLUMN status VARCHAR(30) DEFAULT 'active' CHECK (status IN ('active','sold','deceased','transferred','quarantined','retired','lost'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='animals' AND column_name='dam_id') THEN
    ALTER TABLE animals ADD COLUMN dam_id UUID REFERENCES animals(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='animals' AND column_name='sire_id') THEN
    ALTER TABLE animals ADD COLUMN sire_id UUID REFERENCES animals(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='animals' AND column_name='acquisition_date') THEN
    ALTER TABLE animals ADD COLUMN acquisition_date DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='animals' AND column_name='acquisition_source') THEN
    ALTER TABLE animals ADD COLUMN acquisition_source VARCHAR(200);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='animals' AND column_name='production_type') THEN
    ALTER TABLE animals ADD COLUMN production_type VARCHAR(50);
  END IF;
END $$;

-- ============================================================
-- E8. EXTEND USERS TABLE (add enterprise_id for default enterprise)
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='default_enterprise_id') THEN
    ALTER TABLE users ADD COLUMN default_enterprise_id UUID REFERENCES enterprises(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- AUTO-UPDATE TRIGGERS FOR NEW TABLES
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_enterprises_updated_at') THEN
    CREATE TRIGGER update_enterprises_updated_at BEFORE UPDATE ON enterprises
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_enterprise_members_updated_at') THEN
    CREATE TRIGGER update_enterprise_members_updated_at BEFORE UPDATE ON enterprise_members
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_animal_groups_updated_at') THEN
    CREATE TRIGGER update_animal_groups_updated_at BEFORE UPDATE ON animal_groups
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_locations_updated_at') THEN
    CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON locations
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_treatment_campaigns_updated_at') THEN
    CREATE TRIGGER update_treatment_campaigns_updated_at BEFORE UPDATE ON treatment_campaigns
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================================
-- INDEXES FOR NEW TABLES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_enterprises_owner_id ON enterprises(owner_id);
CREATE INDEX IF NOT EXISTS idx_enterprises_type ON enterprises(enterprise_type);
CREATE INDEX IF NOT EXISTS idx_enterprises_is_active ON enterprises(is_active);

CREATE INDEX IF NOT EXISTS idx_enterprise_members_enterprise_id ON enterprise_members(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_members_user_id ON enterprise_members(user_id);

CREATE INDEX IF NOT EXISTS idx_animal_groups_enterprise_id ON animal_groups(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_animal_groups_type ON animal_groups(group_type);

CREATE INDEX IF NOT EXISTS idx_locations_enterprise_id ON locations(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_locations_type ON locations(location_type);
CREATE INDEX IF NOT EXISTS idx_locations_parent ON locations(parent_location_id);

CREATE INDEX IF NOT EXISTS idx_movement_records_enterprise_id ON movement_records(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_movement_records_animal_id ON movement_records(animal_id);
CREATE INDEX IF NOT EXISTS idx_movement_records_group_id ON movement_records(group_id);

CREATE INDEX IF NOT EXISTS idx_treatment_campaigns_enterprise_id ON treatment_campaigns(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_treatment_campaigns_group_id ON treatment_campaigns(group_id);
CREATE INDEX IF NOT EXISTS idx_treatment_campaigns_status ON treatment_campaigns(status);

CREATE INDEX IF NOT EXISTS idx_animals_enterprise_id ON animals(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_animals_group_id ON animals(group_id);
CREATE INDEX IF NOT EXISTS idx_animals_location_id ON animals(current_location_id);
CREATE INDEX IF NOT EXISTS idx_animals_status ON animals(status);

-- ============================================================
-- E9. EXTEND BOOKINGS TABLE (add enterprise + group context)
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='enterprise_id') THEN
    ALTER TABLE bookings ADD COLUMN enterprise_id UUID REFERENCES enterprises(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='group_id') THEN
    ALTER TABLE bookings ADD COLUMN group_id UUID REFERENCES animal_groups(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bookings_enterprise_id ON bookings(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_bookings_group_id ON bookings(group_id);
`;

async function runMigration() {
  console.log('Running enterprise schema migration...');
  try {
    await pool.query(migration);
    console.log('✅ Enterprise migration completed successfully');

    // Verify tables
    const tables = await pool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name IN
       ('enterprises','enterprise_members','animal_groups','locations','movement_records','treatment_campaigns')
       ORDER BY table_name`
    );
    console.log('Created tables:', tables.rows.map((r: any) => r.table_name).join(', '));

    // Verify animal columns
    const cols = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'animals' AND column_name IN ('enterprise_id','group_id','current_location_id','status','dam_id','sire_id')
       ORDER BY column_name`
    );
    console.log('Added animal columns:', cols.rows.map((r: any) => r.column_name).join(', '));
  } catch (error: any) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

export { migration };
runMigration();

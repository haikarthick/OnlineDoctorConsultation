// Medical Records Enhancement Migration Script
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'postgres123',
  database: 'veterinary_consultation'
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Add unique_id columns to users and animals
    console.log('1. Adding unique_id columns...');
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS unique_id VARCHAR(20)`);
    await client.query(`ALTER TABLE animals ADD COLUMN IF NOT EXISTS unique_id VARCHAR(20)`);
    await client.query(`ALTER TABLE animals ADD COLUMN IF NOT EXISTS blood_type VARCHAR(20)`);
    await client.query(`ALTER TABLE animals ADD COLUMN IF NOT EXISTS insurance_provider VARCHAR(255)`);
    await client.query(`ALTER TABLE animals ADD COLUMN IF NOT EXISTS insurance_policy VARCHAR(100)`);
    await client.query(`ALTER TABLE animals ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(255)`);

    // 2. Enhance medical_records table
    console.log('2. Enhancing medical_records table...');
    await client.query(`ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS veterinarian_id UUID REFERENCES users(id) ON DELETE SET NULL`);
    await client.query(`ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS record_number VARCHAR(30)`);
    await client.query(`ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS severity VARCHAR(20) DEFAULT 'normal'`);
    await client.query(`ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'`);
    await client.query(`ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS medications JSONB DEFAULT '[]'`);
    await client.query(`ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'`);
    await client.query(`ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS is_confidential BOOLEAN DEFAULT false`);
    await client.query(`ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS follow_up_date DATE`);
    await client.query(`ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}'`);

    // 3. vaccination_records
    console.log('3. Creating vaccination_records table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS vaccination_records (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
        vaccine_name VARCHAR(255) NOT NULL,
        vaccine_type VARCHAR(100),
        batch_number VARCHAR(100),
        manufacturer VARCHAR(255),
        date_administered DATE NOT NULL,
        next_due_date DATE,
        administered_by UUID REFERENCES users(id) ON DELETE SET NULL,
        site_of_administration VARCHAR(100),
        dosage VARCHAR(100),
        reaction_notes TEXT,
        is_valid BOOLEAN DEFAULT true,
        certificate_number VARCHAR(100),
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 4. weight_history
    console.log('4. Creating weight_history table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS weight_history (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
        weight DECIMAL(8,2) NOT NULL,
        unit VARCHAR(10) DEFAULT 'kg',
        recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 5. allergy_records
    console.log('5. Creating allergy_records table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS allergy_records (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
        allergen VARCHAR(255) NOT NULL,
        reaction TEXT,
        severity VARCHAR(20) DEFAULT 'mild',
        identified_date DATE,
        is_active BOOLEAN DEFAULT true,
        notes TEXT,
        reported_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 6. medical_record_audit_log
    console.log('6. Creating medical_record_audit_log table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS medical_record_audit_log (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        record_id UUID NOT NULL,
        record_type VARCHAR(50) NOT NULL,
        action VARCHAR(50) NOT NULL,
        changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        changed_by_name VARCHAR(200),
        old_values JSONB,
        new_values JSONB,
        change_reason TEXT,
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 7. lab_results
    console.log('7. Creating lab_results table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS lab_results (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
        consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
        medical_record_id UUID REFERENCES medical_records(id) ON DELETE SET NULL,
        test_name VARCHAR(255) NOT NULL,
        test_category VARCHAR(100),
        test_date DATE NOT NULL,
        result_value TEXT,
        normal_range VARCHAR(100),
        unit VARCHAR(50),
        status VARCHAR(30) DEFAULT 'pending',
        interpretation TEXT,
        lab_name VARCHAR(255),
        ordered_by UUID REFERENCES users(id) ON DELETE SET NULL,
        verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
        is_abnormal BOOLEAN DEFAULT false,
        attachments JSONB DEFAULT '[]',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 8. Indexes
    console.log('8. Creating indexes...');
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_vaccination_records_animal ON vaccination_records(animal_id)`,
      `CREATE INDEX IF NOT EXISTS idx_vaccination_records_date ON vaccination_records(date_administered)`,
      `CREATE INDEX IF NOT EXISTS idx_vaccination_records_next_due ON vaccination_records(next_due_date)`,
      `CREATE INDEX IF NOT EXISTS idx_weight_history_animal ON weight_history(animal_id)`,
      `CREATE INDEX IF NOT EXISTS idx_weight_history_recorded ON weight_history(recorded_at)`,
      `CREATE INDEX IF NOT EXISTS idx_allergy_records_animal ON allergy_records(animal_id)`,
      `CREATE INDEX IF NOT EXISTS idx_lab_results_animal ON lab_results(animal_id)`,
      `CREATE INDEX IF NOT EXISTS idx_lab_results_consultation ON lab_results(consultation_id)`,
      `CREATE INDEX IF NOT EXISTS idx_lab_results_date ON lab_results(test_date)`,
      `CREATE INDEX IF NOT EXISTS idx_medical_record_audit_record ON medical_record_audit_log(record_id)`,
      `CREATE INDEX IF NOT EXISTS idx_medical_record_audit_action ON medical_record_audit_log(action)`,
      `CREATE INDEX IF NOT EXISTS idx_medical_records_record_number ON medical_records(record_number)`,
      `CREATE INDEX IF NOT EXISTS idx_medical_records_vet ON medical_records(veterinarian_id)`,
      `CREATE INDEX IF NOT EXISTS idx_medical_records_status ON medical_records(status)`,
      `CREATE INDEX IF NOT EXISTS idx_animals_unique_id ON animals(unique_id)`,
      `CREATE INDEX IF NOT EXISTS idx_users_unique_id ON users(unique_id)`,
    ];
    for (const idx of indexes) {
      await client.query(idx);
    }

    // 9. Triggers for new tables
    console.log('9. Creating triggers...');
    // Drop triggers first if they exist to avoid errors
    try { await client.query(`DROP TRIGGER IF EXISTS update_vaccination_records_updated_at ON vaccination_records`); } catch(e) {}
    try { await client.query(`DROP TRIGGER IF EXISTS update_allergy_records_updated_at ON allergy_records`); } catch(e) {}
    try { await client.query(`DROP TRIGGER IF EXISTS update_lab_results_updated_at ON lab_results`); } catch(e) {}
    
    await client.query(`CREATE TRIGGER update_vaccination_records_updated_at BEFORE UPDATE ON vaccination_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`);
    await client.query(`CREATE TRIGGER update_allergy_records_updated_at BEFORE UPDATE ON allergy_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`);
    await client.query(`CREATE TRIGGER update_lab_results_updated_at BEFORE UPDATE ON lab_results FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`);

    // 10. Generate unique IDs for existing users
    console.log('10. Generating unique IDs for existing users...');
    await client.query(`
      UPDATE users u SET unique_id = sub.uid FROM (
        SELECT id, 'OWN-' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::TEXT, 5, '0') AS uid
        FROM users WHERE role IN ('pet_owner', 'farmer') AND unique_id IS NULL
      ) sub WHERE u.id = sub.id
    `);
    await client.query(`
      UPDATE users u SET unique_id = sub.uid FROM (
        SELECT id, 'VET-' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::TEXT, 5, '0') AS uid
        FROM users WHERE role = 'veterinarian' AND unique_id IS NULL
      ) sub WHERE u.id = sub.id
    `);
    await client.query(`
      UPDATE users u SET unique_id = sub.uid FROM (
        SELECT id, 'ADM-' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::TEXT, 5, '0') AS uid
        FROM users WHERE role = 'admin' AND unique_id IS NULL
      ) sub WHERE u.id = sub.id
    `);

    // 11. Generate unique IDs for existing animals
    console.log('11. Generating unique IDs for existing animals...');
    await client.query(`
      UPDATE animals a SET unique_id = sub.uid FROM (
        SELECT id, 'PET-' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::TEXT, 5, '0') AS uid
        FROM animals WHERE unique_id IS NULL
      ) sub WHERE a.id = sub.id
    `);

    // 12. Generate record numbers for existing medical records
    console.log('12. Generating record numbers for existing medical records...');
    await client.query(`
      UPDATE medical_records mr SET record_number = sub.rn FROM (
        SELECT id, 'MR-' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::TEXT, 6, '0') AS rn
        FROM medical_records WHERE record_number IS NULL
      ) sub WHERE mr.id = sub.id
    `);

    await client.query('COMMIT');
    console.log('\n✅ Migration completed successfully!');

    // Verify
    const tables = await client.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`);
    console.log('\nTables:', tables.rows.map(r => r.tablename).join(', '));
    
    const mrCols = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'medical_records' ORDER BY ordinal_position`);
    console.log('\nmedical_records columns:');
    mrCols.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));

    const userIds = await client.query(`SELECT unique_id, email, role FROM users ORDER BY unique_id`);
    console.log('\nUser unique IDs:');
    userIds.rows.forEach(r => console.log(`  ${r.unique_id} - ${r.email} (${r.role})`));

    const animalIds = await client.query(`SELECT unique_id, name, species FROM animals ORDER BY unique_id`);
    console.log('\nAnimal unique IDs:');
    if (animalIds.rows.length === 0) console.log('  (no animals yet)');
    animalIds.rows.forEach(r => console.log(`  ${r.unique_id} - ${r.name} (${r.species})`));

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => { console.error(err); process.exit(1); });

const { Pool } = require('pg');
const pool = new Pool({ host:'localhost', port:5432, user:'postgres', password:'postgres123', database:'veterinary_consultation' });

(async () => {
  const cmds = [
    'ALTER TABLE animals ADD COLUMN IF NOT EXISTS ear_tag_id VARCHAR(100)',
    'ALTER TABLE animals ADD COLUMN IF NOT EXISTS registration_number VARCHAR(100)',
    'ALTER TABLE animals ADD COLUMN IF NOT EXISTS insurance_provider VARCHAR(200)',
    'ALTER TABLE animals ADD COLUMN IF NOT EXISTS insurance_policy_number VARCHAR(100)',
    'ALTER TABLE animals ADD COLUMN IF NOT EXISTS insurance_expiry DATE',
    'ALTER TABLE animals ADD COLUMN IF NOT EXISTS is_neutered BOOLEAN DEFAULT false',
  ];
  for (const sql of cmds) {
    await pool.query(sql);
    console.log('OK:', sql.substring(0, 70));
  }
  const r = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'animals' ORDER BY ordinal_position");
  console.log('\nAll columns:', r.rows.map(x => x.column_name).join(', '));
  await pool.end();
  console.log('Migration complete!');
})();

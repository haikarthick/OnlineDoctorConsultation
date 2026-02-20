/**
 * seed-demo-data.ts — Run all migrations then seed demo data
 *
 * Usage:  npx ts-node src/utils/seed-demo-data.ts
 */
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres123',
  database: process.env.DB_NAME || 'veterinary_consultation',
};

async function run() {
  const pool = new Pool(config);
  console.log(`\n🔗 Connecting to PostgreSQL at ${config.host}:${config.port}/${config.database}...\n`);

  try {
    // 1. Verify migration tables exist (migrations should already be run)
    console.log('━━━ Step 1: Verifying tables ━━━');
    const { rows: tableRows } = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM pg_tables WHERE schemaname='public'`
    );
    console.log(`  ✓ ${tableRows[0].cnt} tables found in database`);
    if (tableRows[0].cnt < 50) {
      console.log('  ⚠ Expected ~62 tables. Run migrations first:');
      console.log('    npx ts-node src/utils/enterpriseMigration.ts');
      console.log('    npx ts-node src/utils/tier2Migration.ts');
      console.log('    npx ts-node src/utils/tier3Migration.ts');
      console.log('    npx ts-node src/utils/tier4Migration.ts');
    }

    // 2. Execute the SQL seed file
    console.log('\n━━━ Step 2: Executing seed SQL ━━━');
    const sqlPath = path.join(__dirname, '..', '..', '..', 'docker', 'seed-demo-data.sql');
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`Seed SQL not found at: ${sqlPath}`);
    }
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    console.log(`  → Loading ${(sql.length / 1024).toFixed(1)} KB of seed SQL...`);
    await pool.query(sql);
    console.log('  ✓ Seed data inserted successfully');

    // 3. Verify counts
    console.log('\n━━━ Step 3: Verification ━━━');
    const tables = [
      'users', 'vet_profiles', 'animals', 'vet_schedules',
      'bookings', 'consultations', 'video_sessions', 'prescriptions',
      'medical_records', 'vaccination_records', 'weight_history', 'allergy_records',
      'lab_results', 'payments', 'reviews', 'notifications', 'audit_logs',
      'system_settings', 'enterprises', 'enterprise_members', 'locations',
      'animal_groups', 'movement_records', 'treatment_campaigns',
      'health_observations', 'breeding_records', 'feed_inventory',
      'compliance_documents', 'financial_records', 'alert_rules', 'alert_events',
      'iot_sensors', 'sensor_readings', 'disease_predictions', 'outbreak_zones',
      'genetic_profiles', 'product_batches', 'traceability_events', 'qr_codes',
      'workforce_tasks', 'shift_schedules', 'report_templates', 'generated_reports',
      'digital_twins', 'simulation_runs', 'ai_chat_sessions', 'ai_chat_messages',
      'marketplace_listings', 'sustainability_metrics', 'sustainability_goals',
      'wellness_scorecards', 'wellness_reminders', 'geofence_zones', 'geospatial_events',
    ];

    let totalRows = 0;
    for (const t of tables) {
      try {
        const { rows } = await pool.query(`SELECT COUNT(*)::int AS cnt FROM ${t}`);
        const cnt = rows[0].cnt;
        totalRows += cnt;
        if (cnt > 0) {
          console.log(`  ✓ ${t.padEnd(28)} ${String(cnt).padStart(4)} rows`);
        }
      } catch {
        // table may not exist
      }
    }

    console.log(`\n  ═══════════════════════════════════════`);
    console.log(`  TOTAL ROWS SEEDED: ${totalRows}`);
    console.log(`  ═══════════════════════════════════════`);

    console.log('\n━━━ Demo Login Credentials ━━━');
    console.log('  Admin:        admin@vetcare.com              / Admin@123');
    console.log('  Veterinarian: dr.james.carter@vetcare.com    / Doctor@123');
    console.log('  Veterinarian: dr.sarah.bennett@vetcare.com   / Doctor@123');
    console.log('  Veterinarian: dr.michael.reyes@vetcare.com   / Doctor@123');
    console.log('  Pet Owner:    emily.davis@email.com           / Owner@123');
    console.log('  Pet Owner:    robert.chen@email.com           / Owner@123');
    console.log('  Farmer:       john.miller@greenpastures.com   / Farmer@123');
    console.log('  Farmer:       maria.garcia@sunrisefarm.com    / Farmer@123');

    console.log('\n✅ Demo data seeding complete!\n');
  } catch (err) {
    console.error('\n❌ Seed failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();

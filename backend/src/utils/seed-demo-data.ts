/**
 * seed-demo-data.ts — Run all migrations then seed demo data
 *
 * Usage:  npx ts-node src/utils/seed-demo-data.ts
 */
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const config = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres123',
      database: process.env.DB_NAME || 'veterinary_consultation',
    };

async function run() {
  const pool = new Pool(config);
  const dbLabel = (config as any).connectionString ? 'DATABASE_URL' : `${(config as any).host}:${(config as any).port}/${(config as any).database}`;
  console.log(`\n🔗 Connecting to PostgreSQL (${dbLabel})...\n`);

  try {
    // 0. Set search_path to the correct schema (Render uses DB_SCHEMA env var)
    const schema = process.env.DB_SCHEMA || 'public';
    await pool.query(`SET search_path TO ${schema}, public`);
    console.log(`  → Using schema: ${schema}`);

    // 1. Verify migration tables exist (migrations should already be run)
    console.log('━━━ Step 1: Verifying tables ━━━');
    const { rows: tableRows } = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM pg_tables WHERE schemaname=$1`, [schema]
    );
    console.log(`  ✓ ${tableRows[0].cnt} tables found in database`);
    if (tableRows[0].cnt < 50) {
      console.log('  ⚠ Expected ~62 tables. Run migrations first:');
      console.log('    npx ts-node src/utils/enterpriseMigration.ts');
      console.log('    npx ts-node src/utils/tier2Migration.ts');
      console.log('    npx ts-node src/utils/tier3Migration.ts');
      console.log('    npx ts-node src/utils/tier4Migration.ts');
    }

    // 2. Execute the SQL seed file section by section
    console.log('\n━━━ Step 2: Executing seed SQL ━━━');
    const sqlPath = path.join(__dirname, '..', '..', '..', 'docker', 'seed-demo-data.sql');
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`Seed SQL not found at: ${sqlPath}`);
    }
    const sql = fs.readFileSync(sqlPath, 'utf-8').replace(/\r\n/g, '\n');
    console.log(`  → Loading ${(sql.length / 1024).toFixed(1)} KB of seed SQL...`);

    // Split by STEP headers and execute each independently.
    // This way if a tier migration didn't create certain tables, the core
    // data (users, animals, bookings) still gets inserted.
    const stepHeaderRegex = /-- ={10,}\n-- STEP \d+:\s*(.+)\n-- ={10,}/g;
    const stepMatches: { name: string; start: number; end: number }[] = [];
    let m;
    while ((m = stepHeaderRegex.exec(sql)) !== null) {
      stepMatches.push({ name: m[1].trim(), start: m.index, end: stepHeaderRegex.lastIndex });
    }

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < stepMatches.length; i++) {
      const contentStart = stepMatches[i].end;
      const contentEnd = i + 1 < stepMatches.length ? stepMatches[i + 1].start : sql.length;
      const sectionSql = sql.substring(contentStart, contentEnd).trim();
      const sectionName = stepMatches[i].name;

      if (!sectionSql || !/\b(INSERT|TRUNCATE|DELETE|UPDATE|DO)\b/i.test(sectionSql)) continue;

      try {
        await pool.query(sectionSql);
        successCount++;
        console.log(`  ✓ ${sectionName}`);
      } catch (err: any) {
        failCount++;
        console.error(`  ⚠ ${sectionName}: ${err.message.substring(0, 150)}`);
      }
    }

    console.log(`\n  Sections: ${successCount} succeeded, ${failCount} failed`);
    if (failCount > 0) {
      console.log('  (Failed sections are usually from optional tier migrations that were skipped)');
    }

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

    // Check critical data
    const { rows: userRows } = await pool.query('SELECT COUNT(*)::int AS cnt FROM users');
    if (userRows[0].cnt === 0) {
      console.error('\n❌ CRITICAL: No users were inserted! Login will not work.');
      process.exit(1);
    }

    console.log('\n✅ Demo data seeding complete!\n');
  } catch (err) {
    console.error('\n❌ Seed failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();

import bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';
import database from './database';
import logger from './logger';

const DEMO_USERS = [
  { id: 'a0000000-0000-0000-0000-000000000001', email: 'admin@vetcare.com', password: 'Admin@123', firstName: 'System', lastName: 'Administrator', role: 'admin', phone: '+1-555-100-0001', uniqueId: 'USR-ADM-001' },
  { id: 'b0000000-0000-0000-0000-000000000001', email: 'dr.james.carter@vetcare.com', password: 'Doctor@123', firstName: 'James', lastName: 'Carter', role: 'veterinarian', phone: '+1-555-200-0001', uniqueId: 'USR-VET-001' },
  { id: 'b0000000-0000-0000-0000-000000000002', email: 'dr.sarah.bennett@vetcare.com', password: 'Doctor@123', firstName: 'Sarah', lastName: 'Bennett', role: 'veterinarian', phone: '+1-555-200-0002', uniqueId: 'USR-VET-002' },
  { id: 'b0000000-0000-0000-0000-000000000003', email: 'dr.michael.reyes@vetcare.com', password: 'Doctor@123', firstName: 'Michael', lastName: 'Reyes', role: 'veterinarian', phone: '+1-555-200-0003', uniqueId: 'USR-VET-003' },
  { id: 'c0000000-0000-0000-0000-000000000001', email: 'emily.davis@email.com', password: 'Owner@123', firstName: 'Emily', lastName: 'Davis', role: 'pet_owner', phone: '+1-555-300-0001', uniqueId: 'USR-PET-001' },
  { id: 'c0000000-0000-0000-0000-000000000002', email: 'robert.chen@email.com', password: 'Owner@123', firstName: 'Robert', lastName: 'Chen', role: 'pet_owner', phone: '+1-555-300-0002', uniqueId: 'USR-PET-002' },
  { id: 'f0000000-0000-0000-0000-000000000001', email: 'john.miller@greenpastures.com', password: 'Farmer@123', firstName: 'John', lastName: 'Miller', role: 'farmer', phone: '+1-555-400-0001', uniqueId: 'USR-FRM-001' },
  { id: 'f0000000-0000-0000-0000-000000000002', email: 'maria.garcia@sunrisefarm.com', password: 'Farmer@123', firstName: 'Maria', lastName: 'Garcia', role: 'farmer', phone: '+1-555-400-0002', uniqueId: 'USR-FRM-002' },
];

export async function fixDemoPasswords(): Promise<void> {
  try {
    // 1. Ensure demo users exist with correct passwords
    let fixed = 0;
    let created = 0;
    for (const u of DEMO_USERS) {
      const { rows } = await database.query(
        'SELECT id, password_hash FROM users WHERE email = $1', [u.email]
      );

      if (rows.length === 0) {
        const hash = await bcrypt.hash(u.password, 10);
        await database.query(
          `INSERT INTO users (id, email, first_name, last_name, role, phone, password_hash, is_active, unique_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
           ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash, email = EXCLUDED.email`,
          [u.id, u.email, u.firstName, u.lastName, u.role, u.phone, hash, u.uniqueId]
        );
        created++;
        continue;
      }

      const alreadyCorrect = await bcrypt.compare(u.password, rows[0].password_hash);
      if (alreadyCorrect) continue;

      const newHash = await bcrypt.hash(u.password, 10);
      await database.query(
        'UPDATE users SET password_hash = $1 WHERE email = $2', [newHash, u.email]
      );
      fixed++;
    }
    if (fixed > 0 || created > 0) {
      logger.info(`Demo users: ${created} created, ${fixed} passwords fixed`);
    }

    // 2. Seed demo data if missing (check vet_profiles — only populated by seed, never by user registration)
    const { rows: vpRows } = await database.query('SELECT COUNT(*)::int AS cnt FROM vet_profiles');
    if (vpRows[0].cnt > 0) return; // Seed data already exists

    logger.info('No demo data found — seeding via app database connection...');

    // Try multiple paths to find the seed SQL file
    const possiblePaths = [
      path.join(__dirname, '..', '..', '..', 'docker', 'seed-demo-data.sql'),  // from dist/utils/
      path.join(__dirname, '..', '..', 'docker', 'seed-demo-data.sql'),        // from src/utils/
      path.join(process.cwd(), '..', 'docker', 'seed-demo-data.sql'),          // CWD = backend/
      path.join(process.cwd(), 'docker', 'seed-demo-data.sql'),                // CWD = project root
    ];

    let sqlPath: string | null = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) { sqlPath = p; break; }
    }

    if (!sqlPath) {
      logger.warn('seed-demo-data.sql not found at any expected path: ' + possiblePaths.join(', '));
      return;
    }

    logger.info(`Found seed SQL at: ${sqlPath}`);
    const sql = fs.readFileSync(sqlPath, 'utf-8').replace(/\r\n/g, '\n');

    // Split by STEP headers and execute each independently
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
        await database.query(sectionSql);
        successCount++;
        logger.info(`Seed: ✓ ${sectionName}`);
      } catch (err: any) {
        failCount++;
        logger.warn(`Seed: ⚠ ${sectionName}: ${err.message.substring(0, 200)}`);
      }
    }

    logger.info(`Seed complete: ${successCount} succeeded, ${failCount} failed`);

    // Fix passwords again after seed (seed SQL may have inserted wrong hashes)
    for (const u of DEMO_USERS) {
      const hash = await bcrypt.hash(u.password, 10);
      await database.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, u.email]);
    }
    logger.info('Demo passwords re-verified after seed');

  } catch (err: any) {
    logger.error('Demo data fix failed: ' + (err.message || err));
  }
}

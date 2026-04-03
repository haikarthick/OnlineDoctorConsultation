import bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';
import database from './database';
import logger from './logger';

const DEMO_USERS = [
  { id: 'a0000000-0000-0000-0000-000000000001', email: 'admin@vetcare.com',              password: 'Admin@123',  firstName: 'System', lastName: 'Administrator', role: 'admin',        phone: '+1-555-100-0001', uniqueId: 'USR-ADM-001' },
  { id: 'b0000000-0000-0000-0000-000000000001', email: 'dr.james.carter@vetcare.com',   password: 'Demo@123',   firstName: 'James',  lastName: 'Carter',        role: 'veterinarian', phone: '+1-555-200-0001', uniqueId: 'USR-VET-001' },
  { id: 'b0000000-0000-0000-0000-000000000002', email: 'sarah.johnson@example.com',     password: 'Demo@123',   firstName: 'Sarah',  lastName: 'Johnson',       role: 'veterinarian', phone: '+1-555-200-0002', uniqueId: 'USR-VET-002' },
  { id: 'b0000000-0000-0000-0000-000000000003', email: 'dr.michael.reyes@vetcare.com',  password: 'Demo@123',   firstName: 'Michael',lastName: 'Reyes',         role: 'veterinarian', phone: '+1-555-200-0003', uniqueId: 'USR-VET-003' },
  { id: 'c0000000-0000-0000-0000-000000000001', email: 'emily.davis@example.com',       password: 'Demo@123',   firstName: 'Emily',  lastName: 'Davis',         role: 'pet_owner',    phone: '+1-555-300-0001', uniqueId: 'USR-PET-001' },
  { id: 'c0000000-0000-0000-0000-000000000002', email: 'robert.chen@email.com',         password: 'Demo@123',   firstName: 'Robert', lastName: 'Chen',          role: 'pet_owner',    phone: '+1-555-300-0002', uniqueId: 'USR-PET-002' },
  { id: 'f0000000-0000-0000-0000-000000000001', email: 'tom.wilson@example.com',        password: 'Demo@123',   firstName: 'Tom',    lastName: 'Wilson',        role: 'farmer',       phone: '+1-555-400-0001', uniqueId: 'USR-FRM-001' },
  { id: 'f0000000-0000-0000-0000-000000000002', email: 'maria.garcia@sunrisefarm.com',  password: 'Demo@123',   firstName: 'Maria',  lastName: 'Garcia',        role: 'farmer',       phone: '+1-555-400-0002', uniqueId: 'USR-FRM-002' },
];

export async function fixDemoPasswords(): Promise<void> {
  try {
    // 1. Ensure demo users exist with correct passwords AND correct IDs
    let fixed = 0;
    let created = 0;
    for (const u of DEMO_USERS) {
      const { rows } = await database.query(
        'SELECT id, password_hash FROM users WHERE email = $1', [u.email]
      );

      if (rows.length > 0 && rows[0].id !== u.id) {
        // User exists with WRONG ID (e.g. registered via UI with random UUID).
        // Delete dependent data and recreate with the correct hardcoded ID.
        const oldId = rows[0].id;
        const depDeletes = [
          'DELETE FROM notifications WHERE user_id = $1',
          'DELETE FROM audit_logs WHERE user_id = $1',
          'DELETE FROM reviews WHERE user_id = $1',
          'DELETE FROM payments WHERE user_id = $1',
          'DELETE FROM prescriptions WHERE prescribed_by = $1',
          'DELETE FROM medical_records WHERE veterinarian_id = $1',
          'DELETE FROM consultations WHERE pet_owner_id = $1 OR veterinarian_id = $1',
          'DELETE FROM bookings WHERE pet_owner_id = $1 OR veterinarian_id = $1',
          'DELETE FROM vet_schedules WHERE veterinarian_id = $1',
          'DELETE FROM vet_profiles WHERE user_id = $1',
          'DELETE FROM animals WHERE owner_id = $1',
          'DELETE FROM enterprise_members WHERE user_id = $1',
        ];
        for (const sql of depDeletes) {
          try { await database.query(sql, [oldId]); } catch (_e) { /* table may not exist */ }
        }
        await database.query('DELETE FROM users WHERE id = $1', [oldId]);
        logger.info(`Deleted user ${u.email} with wrong ID ${oldId}, will recreate with ${u.id}`);
        // Fall through to create below
      }

      if (rows.length === 0 || (rows.length > 0 && rows[0].id !== u.id)) {
        const hash = await bcrypt.hash(u.password, 10);
        await database.query(
          `INSERT INTO users (id, email, first_name, last_name, role, phone, password_hash, is_active, unique_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
           ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash, email = EXCLUDED.email,
             first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name`,
          [u.id, u.email, u.firstName, u.lastName, u.role, u.phone, hash, u.uniqueId]
        );
        created++;
        continue;
      }

      const alreadyCorrect = await bcrypt.compare(u.password, rows[0].password_hash);
      if (alreadyCorrect) continue;

      const newHash = await bcrypt.hash(u.password, 10);
      await database.query(
        'UPDATE users SET password_hash = $1, email = $2, first_name = $3, last_name = $4 WHERE id = $5',
        [newHash, u.email, u.firstName, u.lastName, u.id]
      );
      fixed++;
    }
    if (fixed > 0 || created > 0) {
      logger.info(`Demo users: ${created} created, ${fixed} passwords fixed`);
    }

    // 1b. Remove any non-seeded test animals accidentally added to pet_owner demo accounts.
    //     All seeded animals for pet owners start with 'aa000000-'. Anything else is a test artefact.
    try {
      const petOwnerIds = [
        'c0000000-0000-0000-0000-000000000001', // Emily Davis
        'c0000000-0000-0000-0000-000000000002', // Robert Chen
      ];
      for (const ownerId of petOwnerIds) {
        const { rows: testAnimals } = await database.query(
          `SELECT id, name FROM animals WHERE owner_id = $1 AND id NOT LIKE 'aa000000-%'`,
          [ownerId]
        );
        if (testAnimals.length > 0) {
          for (const animal of testAnimals) {
            // Remove all dependent rows first to satisfy FK constraints
            await database.query('DELETE FROM vaccine_schedule WHERE animal_id = $1', [animal.id]);
            await database.query('DELETE FROM vaccination_records WHERE animal_id = $1', [animal.id]);
            await database.query('DELETE FROM animal_vaccine_assignments WHERE animal_id = $1', [animal.id]);
            await database.query('DELETE FROM vaccine_certificate_log WHERE animal_id = $1', [animal.id]);
            await database.query('DELETE FROM medical_records WHERE animal_id = $1', [animal.id]);
            await database.query('DELETE FROM bookings WHERE animal_id = $1', [animal.id]);
            await database.query('DELETE FROM consultations WHERE animal_id = $1', [animal.id]);
            await database.query('DELETE FROM animals WHERE id = $1', [animal.id]);
          }
          logger.info(`Demo cleanup: removed ${testAnimals.length} non-seeded animal(s) for owner ${ownerId}: ${testAnimals.map((a: any) => a.name).join(', ')}`);
        }
      }
    } catch (cleanupErr: any) {
      logger.warn('Demo animal cleanup skipped: ' + cleanupErr.message.substring(0, 200));
    }

    // 2. Seed demo data if missing (check multiple indicators — vet_profiles AND consultations must both exist)
    const { rows: vpRows } = await database.query('SELECT COUNT(*)::int AS cnt FROM vet_profiles');
    const { rows: cRows } = await database.query('SELECT COUNT(*)::int AS cnt FROM consultations');

    // 2a. Always seed vaccine protocols independently (separate from main seed guard)
    //     This runs even when full demo data already exists but protocols are missing.
    try {
      const { rows: protocolRows } = await database.query('SELECT COUNT(*)::int AS cnt FROM vaccine_protocols');
      if (protocolRows[0].cnt === 0) {
        logger.info('Vaccine protocols table empty — running STEP 92 & 93 seed...');
        const possibleSeedPaths = [
          path.join(__dirname, '..', '..', '..', 'docker', 'seed-demo-data.sql'),
          path.join(__dirname, '..', '..', 'docker', 'seed-demo-data.sql'),
          path.join(process.cwd(), '..', 'docker', 'seed-demo-data.sql'),
          path.join(process.cwd(), 'docker', 'seed-demo-data.sql'),
        ];
        let vpSqlPath: string | null = null;
        for (const p of possibleSeedPaths) { if (fs.existsSync(p)) { vpSqlPath = p; break; } }
        if (vpSqlPath) {
          const fullSql = fs.readFileSync(vpSqlPath, 'utf-8').replace(/\r\n/g, '\n');
          const vpHeaderRegex = /-- ={10,}\n-- STEP 92:\s*.+\n-- ={10,}/g;
          const vpMatch = vpHeaderRegex.exec(fullSql);
          if (vpMatch) {
            const vpSectionStart = vpHeaderRegex.lastIndex;
            // Stop STEP 92 extraction at STEP 93 header to avoid pulling in subsequent inserts
            // that may fail with FK violations and roll back the whole batch.
            const step93BoundaryRegex = /-- ={10,}\n-- STEP 93:/g;
            step93BoundaryRegex.lastIndex = vpSectionStart;
            const step93BoundaryMatch = step93BoundaryRegex.exec(fullSql);
            const vpSectionSql = fullSql.substring(vpSectionStart, step93BoundaryMatch ? step93BoundaryMatch.index : fullSql.length).trim();
            try { await database.query(vpSectionSql); logger.info('Seed: ✓ VACCINE PROTOCOLS (STEP 92)'); }
            catch (e: any) { logger.warn('Seed: ⚠ VACCINE PROTOCOLS: ' + e.message.substring(0, 200)); }
          }
          // Also run STEP 93 (regulatory change history)
          const ch3HeaderRegex = /-- ={10,}\n-- STEP 93:\s*.+\n-- ={10,}/g;
          const ch3Match = ch3HeaderRegex.exec(fullSql);
          if (ch3Match) {
            const ch3SectionStart = ch3HeaderRegex.lastIndex;
            // Extract ONLY the vaccine_protocol_changes INSERT (stop after its ON CONFLICT clause).
            // The STEP 93 section may contain additional inserts (weight history, medical records)
            // that could fail with FK violations and roll back the vaccine_protocol_changes rows.
            const ch3Raw = fullSql.substring(ch3SectionStart).trim();
            const onConflictMatch = /ON CONFLICT \(id\) DO NOTHING;/.exec(ch3Raw);
            const ch3Sql = onConflictMatch
              ? ch3Raw.substring(0, onConflictMatch.index + onConflictMatch[0].length).trim()
              : ch3Raw;
            try { await database.query(ch3Sql); logger.info('Seed: ✓ VACCINE PROTOCOL CHANGES (STEP 93)'); }
            catch (e: any) { logger.warn('Seed: ⚠ VACCINE PROTOCOL CHANGES: ' + e.message.substring(0, 200)); }
          }
        }
      }
    } catch (vpErr: any) {
      logger.warn('Vaccine protocol seed check failed: ' + vpErr.message);
    }

    // 2b. Seed dog/cat protocols independently (regardless of whether livestock protocols exist)
    //     These were added after initial deployment so they may be missing on existing DBs.
    try {
      const { rows: dogRows } = await database.query(
        `SELECT COUNT(*)::int AS cnt FROM vaccine_protocols WHERE LOWER($1) = ANY(SELECT LOWER(s) FROM unnest(species) s)`,
        ['dog']
      );
      if (dogRows[0].cnt === 0) {
        logger.info('Dog/cat vaccine protocols missing — seeding now...');
        await database.query(`
INSERT INTO vaccine_protocols (id, name, disease, species, applicable_gender, min_age_weeks, max_age_weeks, vaccine_category, is_zoonotic, initial_dose_age_weeks, booster_interval_days, series_dose_count, series_interval_days, route, dosage_ml, site, regulatory_body, regulatory_standard, seasonal_window, country, notes) VALUES
('a9000000-0000-0000-0000-000000000020','Rabies (Canine)','Rabies',ARRAY['dog'],'all',12,NULL,'mandatory_govt',true,12,365,1,0,'subcutaneous','1 ml','Right rear leg','WSAVA / BVA','WSAVA Vaccination Guidelines 2022, Local Rabies Control Act','Any season','ALL','Core vaccine. Legally mandatory in most countries. First dose at 12 weeks, booster at 1 year, then annually or every 3 years depending on vaccine label and local law.'),
('a9000000-0000-0000-0000-000000000021','DHPP (Distemper, Hepatitis, Parvo, Para-Influenza)','Canine Distemper / Hepatitis / Parvovirus / Parainfluenza',ARRAY['dog'],'all',6,NULL,'core',false,6,1095,3,21,'subcutaneous','1 ml','Right shoulder','WSAVA / AAHA','WSAVA Vaccination Guidelines 2022, AAHA Canine Vaccination Guidelines 2022','Any season','ALL','Core. Puppy series: 6, 9, 12 weeks then booster at 1 year, then every 3 years. Do not skip - parvovirus is highly fatal in unvaccinated puppies.'),
('a9000000-0000-0000-0000-000000000022','Bordetella bronchiseptica (Kennel Cough)','Infectious Tracheobronchitis',ARRAY['dog'],'all',8,NULL,'non_core',false,8,365,1,0,'intranasal','1 ml','Intranasal','WSAVA / AAHA','WSAVA Vaccination Guidelines 2022','Any season — required before boarding/kenneling','ALL','Non-core but recommended for all social dogs. Required by most boarding facilities and dog parks.'),
('a9000000-0000-0000-0000-000000000023','Leptospirosis (L4)','Leptospirosis',ARRAY['dog'],'all',8,NULL,'non_core',true,8,365,2,21,'subcutaneous','1 ml','Left shoulder','WSAVA / AAHA','WSAVA Vaccination Guidelines 2022','Any season — higher risk in monsoon/wet season','ALL','Zoonotic. Non-core but strongly recommended in endemic areas. Annual boosters required for maintained immunity.'),
('a9000000-0000-0000-0000-000000000024','Canine Influenza (H3N2/H3N8)','Canine Influenza',ARRAY['dog'],'all',6,NULL,'non_core',false,6,182,2,21,'subcutaneous','1 ml','Right shoulder','AAHA','AAHA Canine Vaccination Guidelines 2022','Any season','ALL','Non-core. Recommended for dogs with frequent exposure (shows, boarding, shelters).'),
('a9000000-0000-0000-0000-000000000025','Rabies (Feline)','Rabies',ARRAY['cat'],'all',12,NULL,'mandatory_govt',true,12,365,1,0,'subcutaneous','1 ml','Right rear leg','WSAVA / ABCD','WSAVA Vaccination Guidelines 2022, ABCD Guidelines 2023','Any season','ALL','Core. Legally mandatory in most jurisdictions. Annual or 3-year vaccine depending on product label.'),
('a9000000-0000-0000-0000-000000000026','FVRCP (Feline Panleukopenia, Herpesvirus, Calicivirus)','Feline Panleukopenia / Herpesvirus / Calicivirus',ARRAY['cat'],'all',6,NULL,'core',false,6,1095,3,21,'subcutaneous','1 ml','Right shoulder','WSAVA / ABCD','WSAVA Vaccination Guidelines 2022','Any season','ALL','Core. Kitten series at 6, 9, 12 weeks. Booster at 1 year then every 3 years.'),
('a9000000-0000-0000-0000-000000000027','FeLV (Feline Leukemia Virus)','Feline Leukemia',ARRAY['cat'],'all',8,NULL,'non_core',false,8,365,2,21,'subcutaneous','1 ml','Left rear leg','WSAVA / ABCD','WSAVA Vaccination Guidelines 2022, ABCD Guidelines 2023','Any season','ALL','Non-core but recommended for outdoor or multi-cat household cats.')
ON CONFLICT (id) DO NOTHING;
        `);
        logger.info('Seed: ✓ DOG + CAT VACCINE PROTOCOLS (8 protocols)');
      }
    } catch (dcErr: any) {
      logger.warn('Dog/cat vaccine protocol seed failed: ' + dcErr.message.substring(0, 200));
    }

    if (vpRows[0].cnt >= 3 && cRows[0].cnt > 0) return; // Full seed data already exists

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

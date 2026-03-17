import bcrypt from 'bcryptjs';
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
    let fixed = 0;
    let created = 0;
    for (const u of DEMO_USERS) {
      // Check if user exists
      const { rows } = await database.query(
        'SELECT id, password_hash FROM users WHERE email = $1', [u.email]
      );

      if (rows.length === 0) {
        // User doesn't exist — create it with correct hash
        const hash = await bcrypt.hash(u.password, 10);
        await database.query(
          `INSERT INTO users (id, email, first_name, last_name, role, phone, password_hash, is_active, unique_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
           ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash, email = EXCLUDED.email`,
          [u.id, u.email, u.firstName, u.lastName, u.role, u.phone, hash, u.uniqueId]
        );
        created++;
        logger.info(`Created demo user: ${u.email} (${u.role})`);
        continue;
      }

      // User exists — verify hash
      const currentHash = rows[0].password_hash;
      const alreadyCorrect = await bcrypt.compare(u.password, currentHash);
      if (alreadyCorrect) continue;

      // Hash is wrong — fix it
      const newHash = await bcrypt.hash(u.password, 10);
      await database.query(
        'UPDATE users SET password_hash = $1 WHERE email = $2', [newHash, u.email]
      );
      fixed++;
      logger.info(`Fixed password for: ${u.email}`);
    }
    if (fixed > 0 || created > 0) {
      logger.info(`Demo users: ${created} created, ${fixed} passwords fixed`);
    }
  } catch (err: any) {
    logger.error('Demo password fix failed: ' + (err.message || err));
  }
}

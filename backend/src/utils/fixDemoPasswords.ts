import bcrypt from 'bcryptjs';
import database from './database';
import logger from './logger';

const DEMO_USERS = [
  { email: 'admin@vetcare.com', password: 'Admin@123' },
  { email: 'dr.james.carter@vetcare.com', password: 'Doctor@123' },
  { email: 'dr.sarah.bennett@vetcare.com', password: 'Doctor@123' },
  { email: 'dr.michael.reyes@vetcare.com', password: 'Doctor@123' },
  { email: 'dr.priya.sharma@vetcare.com', password: 'Doctor@123' },
  { email: 'emily.davis@email.com', password: 'Owner@123' },
  { email: 'robert.chen@email.com', password: 'Owner@123' },
  { email: 'sarah.kim@email.com', password: 'Owner@123' },
  { email: 'michael.torres@email.com', password: 'Owner@123' },
  { email: 'john.miller@greenpastures.com', password: 'Farmer@123' },
  { email: 'maria.garcia@sunrisefarm.com', password: 'Farmer@123' },
  { email: 'thomas.green@greenmeadows.com', password: 'Farmer@123' },
];

export async function fixDemoPasswords(): Promise<void> {
  try {
    let fixed = 0;
    for (const u of DEMO_USERS) {
      // Check if user exists first
      const { rows } = await database.query(
        'SELECT password_hash FROM users WHERE email = $1', [u.email]
      );
      if (rows.length === 0) continue;

      // Verify if current hash already matches
      const currentHash = rows[0].password_hash;
      const alreadyCorrect = await bcrypt.compare(u.password, currentHash);
      if (alreadyCorrect) continue;

      // Hash is wrong — fix it
      const newHash = await bcrypt.hash(u.password, 10);
      await database.query(
        'UPDATE users SET password_hash = $1 WHERE email = $2', [newHash, u.email]
      );
      fixed++;
    }
    if (fixed > 0) {
      logger.info(`Fixed ${fixed} demo user password(s)`);
    }
  } catch (err: any) {
    logger.warn('Demo password fix skipped: ' + (err.message || err));
  }
}

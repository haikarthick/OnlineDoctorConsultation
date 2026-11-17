import database from '../utils/database';
import { normalizePhone, looksLikePhone } from './sms/phone';

export const PHONE_TAKEN_MESSAGE = 'That mobile number is already registered. Sign in with it, or use a different number.';
import { v4 as uuidv4 } from 'uuid';
import { User, UserCreateDTO } from '../models/types';
import SecurityUtils from '../utils/security';
import { DatabaseError, ConflictError, AppError, ValidationError } from '../utils/errors';
import logger from '../utils/logger';

export class UserService {
  async createUser(userData: UserCreateDTO & {
    licenseNumber?: string;
    yearsOfExperience?: number;
    specializations?: string[];
    qualifications?: string[];
    clinicName?: string;
    consultationFee?: number;
  }): Promise<User> {
    try {
      const userId = uuidv4();
      const passwordHash = await SecurityUtils.hashPassword(userData.password);

      // Roles that require admin approval before they can access the platform
      const pendingRoles = ['veterinarian', 'corporate_admin'];
      const accountStatus = pendingRoles.includes(userData.role) ? 'pending_approval' : 'active';
      const isActive = accountStatus === 'active';

      // The same mobile number cannot belong to two accounts (it is a login identifier).
      const phoneE164 = await this.phoneForStorage(userData.phone);
      const result = await database.query(
        `INSERT INTO users (id, email, first_name, last_name, role, phone, password_hash, is_active, account_status, phone_e164, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
         RETURNING id, email, first_name as "firstName", last_name as "lastName", role, phone,
                   is_active as "isActive", account_status as "accountStatus",
                   created_at as "createdAt", updated_at as "updatedAt"`,
        [userId, userData.email, userData.firstName, userData.lastName,
         userData.role, userData.phone, passwordHash, isActive, accountStatus, phoneE164]
      );

      if (result.rows.length === 0) {
        throw new DatabaseError('Failed to create user');
      }

      // For vets: create vet_profile immediately so admin can review license details
      if (userData.role === 'veterinarian' && userData.licenseNumber) {
        await database.query(
          `INSERT INTO vet_profiles (user_id, license_number, years_of_experience, specializations, qualifications, clinic_name, consultation_fee, is_verified, is_available)
           VALUES ($1, $2, $3, $4, $5, $6, $7, false, false)
           ON CONFLICT (user_id) DO NOTHING`,
          [
            userId,
            userData.licenseNumber,
            userData.yearsOfExperience || 0,
            userData.specializations || [],
            userData.qualifications || [],
            userData.clinicName || '',
            userData.consultationFee || 0,
          ]
        ).catch((e: any) => logger.warn('vet_profile create failed (non-fatal)', { error: e.message }));
      }

      logger.info('User created', { userId, email: userData.email, role: userData.role, accountStatus });
      return result.rows[0];
    } catch (error: any) {
      if (error.code === '23505') {
        if (String(error.constraint || error.message || '').includes('phone_e164')) throw new ConflictError(PHONE_TAKEN_MESSAGE);
        throw new ConflictError('Email already exists');
      }
      if (error instanceof ConflictError) throw error;
      throw new DatabaseError('Error creating user', { originalError: error.message });
    }
  }

  async getUserById(userId: string): Promise<User | null> {
    try {
      const result = await database.query(
        `SELECT id, email, first_name as "firstName", last_name as "lastName", role, phone,
                is_active as "isActive", account_status as "accountStatus",
                created_at as "createdAt", updated_at as "updatedAt"
         FROM users WHERE id = $1`,
        [userId]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw new DatabaseError('Error fetching user', { originalError: error });
    }
  }

  /**
   * The mobile number in its one stored form, or null when none was given. Throws a plain sentence when
   * it is not a usable mobile number or already belongs to another account.
   */
  async phoneForStorage(phone: string | null | undefined, exceptUserId?: string): Promise<string | null> {
    if (phone === undefined || phone === null || String(phone).trim() === '') return null;
    const e164 = normalizePhone(phone);
    if (!e164) throw new ValidationError('Please enter a valid mobile number, for example 98765 43210.');
    const owner = await database.query(`SELECT id FROM users WHERE phone_e164 = $1 LIMIT 1`, [e164]);
    if (owner.rows.length && owner.rows[0].id !== exceptUserId) throw new ConflictError(PHONE_TAKEN_MESSAGE);
    return e164;
  }

  /** Sign-in: the person may type their email or their mobile number. */
  async getUserByIdentifier(identifier: string): Promise<User | null> {
    if (looksLikePhone(identifier)) {
      const e164 = normalizePhone(identifier);
      if (!e164) return null;
      const result = await database.query(
        `SELECT id, email, first_name as "firstName", last_name as "lastName", role, phone,
                password_hash as "passwordHash", is_active as "isActive", account_status as "accountStatus",
                created_at as "createdAt", updated_at as "updatedAt"
           FROM users WHERE phone_e164 = $1`, [e164]);
      return result.rows[0] || null;
    }
    return this.getUserByEmail(identifier);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const query = `
        SELECT id, email, first_name as "firstName", last_name as "lastName", role, phone,
               password_hash as "passwordHash", is_active as "isActive",
               account_status as "accountStatus",
               created_at as "createdAt", updated_at as "updatedAt"
        FROM users WHERE email = $1
      `;

      const result = await database.query(query, [email]);
      return result.rows[0] || null;
    } catch (error: any) {
      // Log the actual DB error so it appears in Render logs for diagnosis
      const pgCode = error.code || 'unknown';
      const pgMsg = error.message || String(error);
      logger.error('getUserByEmail DB error', { email, pgCode, pgMsg });
      throw new DatabaseError('Error fetching user by email', { originalError: pgMsg, pgCode });
    }
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    try {
      const { passwordHash, ...dataToUpdate } = updates;
      // A changed phone number keeps its normalised copy (the login identifier) in step.
      if ((dataToUpdate as any).phone !== undefined) {
        (dataToUpdate as any).phoneE164 = await this.phoneForStorage((dataToUpdate as any).phone, userId);
      }
      const fields = Object.keys(dataToUpdate).map((key, idx) => {
        const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        return `${snakeKey} = $${idx + 2}`;
      });

      const values = Object.values(dataToUpdate);
      const query = `
        UPDATE users SET ${fields.join(', ')}, updated_at = NOW()
        WHERE id = $1
        RETURNING id, email, first_name as "firstName", last_name as "lastName", role, phone, 
                  is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
      `;

      const result = await database.query(query, [userId, ...values]);
      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      logger.info('User updated', { userId });
      return result.rows[0];
    } catch (error) {
      if (error instanceof ConflictError) throw error;
      throw new DatabaseError('Error updating user', { originalError: error });
    }
  }

  async listUsers(role?: string, limit: number = 10, offset: number = 0): Promise<{ users: User[]; total: number }> {
    try {
      let query = 'SELECT id, email, first_name as "firstName", last_name as "lastName", role, phone, is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt" FROM users';
      const params: any[] = [];

      if (role) {
        query += ' WHERE role = $1';
        params.push(role);
      }

      query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const countQuery = `SELECT COUNT(*) as count FROM users${role ? ' WHERE role = $1' : ''}`;
      const countParams = role ? [role] : [];

      const [usersResult, countResult] = await Promise.all([
        database.query(query, params),
        database.query(countQuery, countParams)
      ]);

      return {
        users: usersResult.rows,
        total: parseInt(countResult.rows[0].count, 10)
      };
    } catch (error) {
      throw new DatabaseError('Error listing users', { originalError: error });
    }
  }
}

export default new UserService();

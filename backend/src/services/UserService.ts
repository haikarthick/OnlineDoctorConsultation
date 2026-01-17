import database from '../utils/database';
import { v4 as uuidv4 } from 'uuid';
import { User, UserCreateDTO } from '../models/types';
import SecurityUtils from '../utils/security';
import { DatabaseError, ConflictError } from '../utils/errors';
import logger from '../utils/logger';

export class UserService {
  async createUser(userData: UserCreateDTO): Promise<User> {
    try {
      const userId = uuidv4();
      const passwordHash = await SecurityUtils.hashPassword(userData.password);

      const query = `
        INSERT INTO users (id, email, first_name, last_name, role, phone, password_hash, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING id, email, first_name as "firstName", last_name as "lastName", role, phone, is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
      `;

      const result = await database.query(query, [
        userId,
        userData.email,
        userData.firstName,
        userData.lastName,
        userData.role,
        userData.phone,
        passwordHash,
        true
      ]);

      if (result.rows.length === 0) {
        throw new DatabaseError('Failed to create user');
      }

      logger.info('User created successfully', { userId, email: userData.email });
      return result.rows[0];
    } catch (error: any) {
      if (error.code === '23505') {
        throw new ConflictError('Email already exists');
      }
      throw new DatabaseError('Error creating user', { originalError: error.message });
    }
  }

  async getUserById(userId: string): Promise<User | null> {
    try {
      const query = `
        SELECT id, email, first_name as "firstName", last_name as "lastName", role, phone, 
               is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
        FROM users WHERE id = $1
      `;

      const result = await database.query(query, [userId]);
      return result.rows[0] || null;
    } catch (error) {
      throw new DatabaseError('Error fetching user', { originalError: error });
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const query = `
        SELECT id, email, first_name as "firstName", last_name as "lastName", role, phone, 
               password_hash as "passwordHash", is_active as "isActive", 
               created_at as "createdAt", updated_at as "updatedAt"
        FROM users WHERE email = $1
      `;

      const result = await database.query(query, [email]);
      return result.rows[0] || null;
    } catch (error) {
      throw new DatabaseError('Error fetching user by email', { originalError: error });
    }
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    try {
      const { passwordHash, ...dataToUpdate } = updates;
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

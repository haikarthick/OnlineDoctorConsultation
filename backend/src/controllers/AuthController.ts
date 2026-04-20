import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import UserService from '../services/UserService';
import RefreshTokenService from '../services/RefreshTokenService';
import SecurityUtils from '../utils/security';
import { ValidationError, UnauthorizedError, DatabaseError } from '../utils/errors';
import logger from '../utils/logger';
import database from '../utils/database';
import { fixDemoPasswords } from '../utils/fixDemoPasswords';

export class AuthController {
  async register(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { email, firstName, lastName, phone, password, role } = req.body;

      if (!email || !password || !firstName || !lastName || !phone) {
        throw new ValidationError('Missing required fields');
      }

      // Self-heal: if DB query fails (missing table), repair schema then retry
      let existingUser;
      try {
        existingUser = await UserService.getUserByEmail(email);
      } catch (dbErr: any) {
        logger.error('Register: getUserByEmail failed — triggering self-heal', { error: dbErr.message });
        try {
          await database.ensureSchemaPublic();
          await fixDemoPasswords();
          existingUser = await UserService.getUserByEmail(email);
        } catch (healErr: any) {
          logger.error('Register: self-heal also failed', { error: healErr.message });
          throw new DatabaseError('Database is not ready yet. Please retry in a few seconds.');
        }
      }

      if (existingUser) {
        throw new ValidationError('Email already registered');
      }

      const user = await UserService.createUser({
        email,
        firstName,
        lastName,
        phone,
        password,
        role: role || 'pet_owner'
      });

      const accessToken = SecurityUtils.generateToken({
        userId: user.id,
        email: user.email,
        role: user.role
      });

      const { rawToken: refreshToken } = await RefreshTokenService.createToken(user.id, undefined, {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      });

      res.status(201).json({
        success: true,
        data: {
          user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
          token: accessToken,
          refreshToken
        }
      });
    } catch (error) {
      throw error;
    }
  }

  async login(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        throw new ValidationError('Email and password are required');
      }

      // Retry login query up to 4 times with escalating delays.
      // Neon free-tier + Render free-tier both spin down on inactivity;
      // the first request after wake-up can hit a cold-start window where
      // the pool hasn't established a connection yet.
      let user;
      let loginAttemptError: any;
      for (let attempt = 1; attempt <= 4; attempt++) {
        try {
          user = await UserService.getUserByEmail(email);
          loginAttemptError = null;
          break; // success — exit retry loop
        } catch (dbErr: any) {
          loginAttemptError = dbErr;
          logger.warn(`Login: getUserByEmail attempt ${attempt}/4 failed`, { error: dbErr.message });
          if (attempt < 4) {
            // On first failure trigger schema + demo user repair so tables exist on retry
            if (attempt === 1) {
              try {
                await database.ensureSchemaPublic();
                await fixDemoPasswords();
              } catch (healErr: any) {
                logger.warn('Login: self-heal step failed — will retry query anyway', { error: healErr.message });
              }
            }
            // Wait before retrying (3s, 6s, 9s) to give Neon time to fully wake
            await new Promise(r => setTimeout(r, 3000 * attempt));
          }
        }
      }
      if (loginAttemptError) {
        logger.error('Login: all 4 attempts failed', { error: loginAttemptError.message });
        throw new DatabaseError('Database is not ready yet. Please retry in a few seconds.');
      }

      if (!user || !user.passwordHash) {
        throw new UnauthorizedError('Invalid email or password');
      }

      const isPasswordValid = await SecurityUtils.comparePassword(password, user.passwordHash);
      if (!isPasswordValid) {
        throw new UnauthorizedError('Invalid email or password');
      }

      const accessToken = SecurityUtils.generateToken({
        userId: user.id,
        email: user.email,
        role: user.role
      });

      const { rawToken: refreshToken } = await RefreshTokenService.createToken(user.id, undefined, {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      });

      // Fetch all roles for the user (P4-HIGH1)
      let userRoles: string[] = [user.role];
      try {
        const rolesRes = await database.query(`SELECT role FROM user_roles WHERE user_id = $1`, [user.id]);
        if (rolesRes.rows.length > 0) {
          userRoles = rolesRes.rows.map((r: any) => r.role);
        } else {
          // Backfill primary role if user_roles table is empty for this user
          await database.query(
            `INSERT INTO user_roles (user_id, role, is_primary) VALUES ($1, $2, true) ON CONFLICT (user_id, role) DO NOTHING`,
            [user.id, user.role]
          ).catch(() => {});
        }
      } catch { /* fall back to primary role only */ }

      logger.info('User logged in', { userId: user.id, email: user.email });

      res.json({
        success: true,
        data: {
          user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, roles: userRoles },
          token: accessToken,
          refreshToken
        }
      });
    } catch (error) {
      throw error;
    }
  }

  /** Exchange a valid refresh token for a new access + refresh token pair */
  async refreshToken(req: AuthRequest, res: Response): Promise<void> {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      throw new ValidationError('refreshToken is required');
    }

    const result = await RefreshTokenService.rotateToken(refreshToken, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    if (!result) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const user = await UserService.getUserById(result.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedError('User account is inactive');
    }

    const accessToken = SecurityUtils.generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    res.json({
      success: true,
      data: {
        token: accessToken,
        refreshToken: result.newRawToken,
      },
    });
  }

  /** Revoke a refresh token (logout current device) */
  async logout(req: AuthRequest, res: Response): Promise<void> {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const validation = await RefreshTokenService.validateToken(refreshToken);
      if (validation) {
        await RefreshTokenService.revokeToken(validation.tokenId);
      }
    }
    res.json({ success: true, message: 'Logged out successfully' });
  }

  /** Revoke all refresh tokens for the current user (logout all devices) */
  async logoutAll(req: AuthRequest, res: Response): Promise<void> {
    const count = await RefreshTokenService.revokeAllForUser(req.userId!);
    logger.info('User logged out from all devices', { userId: req.userId, revokedCount: count });
    res.json({ success: true, message: `Revoked ${count} session(s)` });
  }

  async getProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const user = await UserService.getUserById(req.userId!);
      if (!user) {
        throw new UnauthorizedError('User not found');
      }

      // Never expose password hash
      const { passwordHash, ...safeUser } = user;

      res.json({
        success: true,
        data: safeUser
      });
    } catch (error) {
      throw error;
    }
  }
}

export default new AuthController();

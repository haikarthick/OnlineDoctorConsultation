import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import UserService from '../services/UserService';
import RefreshTokenService from '../services/RefreshTokenService';
import SecurityUtils from '../utils/security';
import { ValidationError, UnauthorizedError, DatabaseError } from '../utils/errors';
import logger from '../utils/logger';
import database from '../utils/database';
import { fixDemoPasswords } from '../utils/fixDemoPasswords';

// Polite legal-tone messages for each blocked account state
const ACCOUNT_STATUS_MESSAGES: Record<string, string> = {
  pending_approval:
    'Your registration is currently under review by our platform team. ' +
    'You will be notified by email once your credentials have been verified. ' +
    'Thank you for your patience.',
  frozen:
    'Your account has been temporarily restricted pending further review by our platform team. ' +
    'This measure has been taken to ensure the safety and integrity of the platform. ' +
    'If you believe this is an error or would like clarification, please contact us at ' +
    'support@vetcare.com — we will be happy to assist you and aim to resolve this at the earliest. ' +
    'Please quote your registered email address when contacting support.',
  suspended:
    'Your account has been deactivated. Please contact support@vetcare.com for further information.',
};

async function runDemoSeedIfEnabled(): Promise<void> {
  if (process.env.NODE_ENV !== 'production' && process.env.DEMO_SEED_ENABLED === 'true') {
    await fixDemoPasswords();
  }
}

export class AuthController {
  async register(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        email, firstName, lastName, phone, password, role,
        licenseNumber, yearsOfExperience, specializations,
        qualifications, clinicName, consultationFee,
      } = req.body;

      if (!email || !password || !firstName || !lastName || !phone) {
        throw new ValidationError('Missing required fields');
      }

      if (role === 'veterinarian' && !licenseNumber) {
        throw new ValidationError('License number is required for veterinarian registration');
      }

      // Self-heal: if DB query fails (missing table), repair schema then retry
      let existingUser;
      try {
        existingUser = await UserService.getUserByEmail(email);
      } catch (dbErr: any) {
        logger.error('Register: getUserByEmail failed — triggering self-heal', { error: dbErr.message });
        try {
          await database.ensureSchemaPublic();
          await runDemoSeedIfEnabled();
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
        role: role || 'pet_owner',
        licenseNumber,
        yearsOfExperience: yearsOfExperience ? Number(yearsOfExperience) : undefined,
        specializations: Array.isArray(specializations)
          ? specializations
          : specializations ? [specializations] : [],
        qualifications: Array.isArray(qualifications)
          ? qualifications
          : qualifications ? [qualifications] : [],
        clinicName,
        consultationFee: consultationFee ? Number(consultationFee) : undefined,
      });

      const isPending = (user as any).accountStatus === 'pending_approval';

      // Pending users: do NOT issue tokens — they cannot use the app until approved
      if (isPending) {
        res.status(201).json({
          success: true,
          pending: true,
          message: ACCOUNT_STATUS_MESSAGES.pending_approval,
        });
        return;
      }

      const accessToken = SecurityUtils.generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
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
          refreshToken,
        },
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

      // Retry login query up to 6 times with escalating delays.
      // Neon free-tier + Render free-tier both spin down on inactivity;
      // the first request after wake-up can hit a cold-start window where
      // the pool hasn't established a connection yet.
      let user;
      let loginAttemptError: any;
      for (let attempt = 1; attempt <= 6; attempt++) {
        try {
          user = await UserService.getUserByEmail(email);
          loginAttemptError = null;
          break;
        } catch (dbErr: any) {
          loginAttemptError = dbErr;
          logger.warn(`Login: getUserByEmail attempt ${attempt}/6 failed`, { error: dbErr.message });
          if (attempt < 6) {
            if (attempt === 1) {
              try {
                await database.ensureSchemaPublic();
                await runDemoSeedIfEnabled();
              } catch (healErr: any) {
                logger.warn('Login: self-heal step failed — will retry query anyway', { error: healErr.message });
              }
            }
            await new Promise(r => setTimeout(r, 5000 * attempt));
          }
        }
      }
      if (loginAttemptError) {
        logger.error('Login: all 6 attempts failed', { error: loginAttemptError.message });
        throw new DatabaseError('Database is not ready yet. Please retry in a few seconds.');
      }

      if (!user || !user.passwordHash) {
        throw new UnauthorizedError('Invalid email or password');
      }

      const isPasswordValid = await SecurityUtils.comparePassword(password, user.passwordHash);
      if (!isPasswordValid) {
        throw new UnauthorizedError('Invalid email or password');
      }

      // Account status gate — checked AFTER password so we don't reveal account existence
      const accountStatus = (user as any).accountStatus || 'active';
      if (accountStatus !== 'active') {
        const msg = ACCOUNT_STATUS_MESSAGES[accountStatus] || 'Your account is currently unavailable.';
        res.status(403).json({ success: false, accountStatus, message: msg });
        return;
      }

      const accessToken = SecurityUtils.generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
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
          refreshToken,
        },
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
    const accountStatus = (user as any)?.accountStatus || 'active';
    if (!user || accountStatus !== 'active') {
      throw new UnauthorizedError('User account is not active');
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
      const { passwordHash, ...safeUser } = user as any;
      res.json({ success: true, data: safeUser });
    } catch (error) {
      throw error;
    }
  }
}

export default new AuthController();

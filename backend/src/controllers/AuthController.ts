import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import UserService from '../services/UserService';
import RefreshTokenService from '../services/RefreshTokenService';
import SecurityUtils from '../utils/security';
import { ValidationError, UnauthorizedError } from '../utils/errors';
import logger from '../utils/logger';

export class AuthController {
  async register(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { email, firstName, lastName, phone, password, role } = req.body;

      if (!email || !password || !firstName || !lastName || !phone) {
        throw new ValidationError('Missing required fields');
      }

      const existingUser = await UserService.getUserByEmail(email);
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

      const user = await UserService.getUserByEmail(email);
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

      logger.info('User logged in', { userId: user.id, email: user.email });

      res.json({
        success: true,
        data: {
          user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
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

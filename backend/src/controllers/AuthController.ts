import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import UserService from '../services/UserService';
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

      const token = SecurityUtils.generateToken({
        userId: user.id,
        email: user.email,
        role: user.role
      });

      res.status(201).json({
        success: true,
        data: {
          user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
          token
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

      const token = SecurityUtils.generateToken({
        userId: user.id,
        email: user.email,
        role: user.role
      });

      logger.info('User logged in', { userId: user.id, email: user.email });

      res.json({
        success: true,
        data: {
          user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
          token
        }
      });
    } catch (error) {
      throw error;
    }
  }

  async getProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const user = await UserService.getUserById(req.userId!);
      if (!user) {
        throw new UnauthorizedError('User not found');
      }

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      throw error;
    }
  }
}

export default new AuthController();

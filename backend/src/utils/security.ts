import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../config';

export class SecurityUtils {
  static async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static generateToken(payload: Record<string, any>, expiresIn?: string): string {
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: expiresIn || config.jwt.expiresIn
    });
  }

  static verifyToken(token: string): Record<string, any> {
    return jwt.verify(token, config.jwt.secret) as Record<string, any>;
  }

  static generateRefreshToken(userId: string): string {
    return jwt.sign({ userId }, config.jwt.secret, { expiresIn: '7d' });
  }
}

export default SecurityUtils;

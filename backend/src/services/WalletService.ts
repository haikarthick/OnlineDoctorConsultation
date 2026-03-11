import { v4 as uuidv4 } from 'uuid';
import database from '../utils/database';
import { Wallet, WalletTransaction, WalletTransactionType } from '../models/types';
import { DatabaseError, NotFoundError } from '../utils/errors';
import logger from '../utils/logger';

export class WalletService {
  /** Get or create a wallet for a user */
  async getOrCreateWallet(userId: string): Promise<Wallet> {
    try {
      const existing = await database.query(
        `SELECT id, user_id as "userId", balance, bonus_credits as "bonusCredits",
                currency, created_at as "createdAt", updated_at as "updatedAt"
         FROM wallets WHERE user_id = $1`,
        [userId]
      );
      if (existing.rows.length > 0) return existing.rows[0];

      const id = uuidv4();
      const result = await database.query(
        `INSERT INTO wallets (id, user_id, balance, bonus_credits, currency, created_at, updated_at)
         VALUES ($1, $2, 0, 0, 'USD', NOW(), NOW())
         ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
         RETURNING id, user_id as "userId", balance, bonus_credits as "bonusCredits",
                   currency, created_at as "createdAt", updated_at as "updatedAt"`,
        [id, userId]
      );
      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Error getting/creating wallet', { originalError: error });
    }
  }

  /** Credit (add money) to a wallet */
  async credit(userId: string, amount: number, description: string, referenceId?: string, referenceType?: string): Promise<WalletTransaction> {
    const wallet = await this.getOrCreateWallet(userId);
    return this.addTransaction(wallet.id, 'credit', amount, description, referenceId, referenceType);
  }

  /** Add refund to wallet */
  async refund(userId: string, amount: number, description: string, referenceId?: string, referenceType?: string): Promise<WalletTransaction> {
    const wallet = await this.getOrCreateWallet(userId);
    return this.addTransaction(wallet.id, 'refund', amount, description, referenceId, referenceType);
  }

  /** Add bonus credits to wallet */
  async addBonus(userId: string, amount: number, description: string, referenceId?: string, referenceType?: string): Promise<WalletTransaction> {
    const wallet = await this.getOrCreateWallet(userId);

    // Update bonus_credits column specifically
    await database.query(
      `UPDATE wallets SET bonus_credits = bonus_credits + $1, updated_at = NOW() WHERE id = $2`,
      [amount, wallet.id]
    );

    return this.recordTransaction(wallet.id, 'bonus', amount, description, referenceId, referenceType);
  }

  /** Debit (spend) from wallet */
  async debit(userId: string, amount: number, description: string, referenceId?: string, referenceType?: string): Promise<WalletTransaction> {
    const wallet = await this.getOrCreateWallet(userId);
    const totalAvailable = parseFloat(String(wallet.balance)) + parseFloat(String(wallet.bonusCredits));
    if (totalAvailable < amount) {
      throw new DatabaseError('Insufficient wallet balance');
    }
    return this.addTransaction(wallet.id, 'debit', amount, description, referenceId, referenceType);
  }

  /** List transactions for a user's wallet */
  async listTransactions(userId: string, limit: number = 20, offset: number = 0): Promise<{ transactions: WalletTransaction[]; total: number }> {
    try {
      const wallet = await this.getOrCreateWallet(userId);
      const countResult = await database.query(
        `SELECT COUNT(*) as count FROM wallet_transactions WHERE wallet_id = $1`,
        [wallet.id]
      );
      const result = await database.query(
        `SELECT id, wallet_id as "walletId", type, amount, description,
                reference_id as "referenceId", reference_type as "referenceType",
                created_at as "createdAt"
         FROM wallet_transactions WHERE wallet_id = $1
         ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [wallet.id, limit, offset]
      );
      return {
        transactions: result.rows,
        total: parseInt(countResult.rows[0]?.count || '0', 10),
      };
    } catch (error) {
      throw new DatabaseError('Error listing wallet transactions', { originalError: error });
    }
  }

  /** Internal: add transaction and update balance */
  private async addTransaction(walletId: string, type: WalletTransactionType, amount: number, description: string, referenceId?: string, referenceType?: string): Promise<WalletTransaction> {
    const balanceChange = (type === 'debit' || type === 'withdrawal') ? -amount : amount;
    await database.query(
      `UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE id = $2`,
      [balanceChange, walletId]
    );
    return this.recordTransaction(walletId, type, amount, description, referenceId, referenceType);
  }

  /** Internal: record transaction without balance update (used for bonus) */
  private async recordTransaction(walletId: string, type: WalletTransactionType, amount: number, description: string, referenceId?: string, referenceType?: string): Promise<WalletTransaction> {
    try {
      const id = uuidv4();
      const result = await database.query(
        `INSERT INTO wallet_transactions (id, wallet_id, type, amount, description, reference_id, reference_type, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         RETURNING id, wallet_id as "walletId", type, amount, description,
                   reference_id as "referenceId", reference_type as "referenceType",
                   created_at as "createdAt"`,
        [id, walletId, type, amount, description, referenceId || null, referenceType || null]
      );
      logger.info('Wallet transaction recorded', { id, walletId, type, amount });
      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Error recording wallet transaction', { originalError: error });
    }
  }
}

export default new WalletService();

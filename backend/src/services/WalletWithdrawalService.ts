import database from '../utils/database';
import logger from '../utils/logger';
import { NotFoundError, ValidationError } from '../utils/errors';
import NotificationService from './NotificationService';

/**
 * Customer wallet withdrawals — the wallet's exit door (migration 038).
 *
 * Refunds used to land in the in-house wallet with no way out: withdrawal_requests is
 * veterinarian-only and the wallet API was read-only. A customer whose booking was cancelled
 * effectively received permanent store credit instead of a refund.
 *
 * Money model, mirroring how doctor withdrawals lock earnings: the wallet is DEBITED when the
 * request is made, so the customer cannot spend money that is already on its way to their bank,
 * and it is CREDITED BACK in full if the request is rejected or cancelled. The wallet balance
 * is therefore always the truthfully spendable amount.
 *
 * Only `balance` is withdrawable. `bonus_credits` is promotional (goodwill for a provider
 * cancellation) and is deliberately excluded — otherwise the platform would be handing out cash.
 */

const MIN_WITHDRAWAL_KEY = 'wallet.withdrawal.minAmount';
const DEFAULT_MIN = 100;

const SELECT = `
  id, user_id as "userId", amount, currency, status, method,
  account_name as "accountName", account_number as "accountNumber", ifsc, upi_id as "upiId",
  utr_reference as "utrReference", admin_note as "adminNote", rejection_reason as "rejectionReason",
  reviewed_at as "reviewedAt", settled_at as "settledAt", created_at as "createdAt"
`;

class WalletWithdrawalService {
  private async getMinAmount(): Promise<number> {
    try {
      const r = await database.query(`SELECT value FROM system_settings WHERE key = $1`, [MIN_WITHDRAWAL_KEY]);
      const n = parseFloat(r.rows[0]?.value);
      return Number.isFinite(n) && n > 0 ? n : DEFAULT_MIN;
    } catch {
      return DEFAULT_MIN;
    }
  }

  /**
   * Customer requests a payout. Debits the wallet inside the same transaction that creates the
   * request, under a row lock, so two concurrent requests cannot both pass the balance check and
   * withdraw the same money twice.
   */
  async requestWithdrawal(userId: string, data: {
    amount: number; method?: 'bank_transfer' | 'upi';
    accountName?: string; accountNumber?: string; ifsc?: string; upiId?: string;
  }): Promise<any> {
    const amount = +(Number(data.amount) || 0).toFixed(2);
    if (!(amount > 0)) throw new ValidationError('Enter an amount greater than zero.');

    const min = await this.getMinAmount();
    if (amount < min) throw new ValidationError(`The minimum withdrawal is ${min}.`);

    const method = data.method || 'bank_transfer';
    if (method === 'upi') {
      if (!data.upiId?.trim()) throw new ValidationError('A UPI ID is required for a UPI payout.');
    } else {
      if (!data.accountName?.trim() || !data.accountNumber?.trim() || !data.ifsc?.trim())
        throw new ValidationError('Account name, account number and IFSC are required for a bank transfer.');
    }

    return database.transaction(async (client: any) => {
      const w = await client.query(
        `SELECT id, balance, currency FROM wallets WHERE user_id = $1 FOR UPDATE`, [userId]);
      if (w.rows.length === 0) throw new ValidationError('You do not have a wallet balance to withdraw.');
      const wallet = w.rows[0];
      const balance = Number(wallet.balance) || 0;
      if (amount > balance)
        throw new ValidationError(`You can withdraw at most ${balance.toFixed(2)}. Bonus credits cannot be withdrawn.`);

      await client.query(
        `UPDATE wallets SET balance = balance - $1, updated_at = NOW() WHERE id = $2`, [amount, wallet.id]);

      const r = await client.query(
        `INSERT INTO wallet_withdrawal_requests
           (user_id, wallet_id, amount, currency, method, account_name, account_number, ifsc, upi_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING ${SELECT}`,
        [userId, wallet.id, amount, wallet.currency || 'INR', method,
         data.accountName?.trim() || null, data.accountNumber?.trim() || null,
         data.ifsc?.trim() || null, data.upiId?.trim() || null]);
      const request = r.rows[0];

      await client.query(
        `INSERT INTO wallet_transactions (wallet_id, type, amount, description, reference_id, reference_type)
         VALUES ($1,'withdrawal',$2,'Withdrawal requested — pending payout',$3,'wallet_withdrawal')`,
        [wallet.id, amount, request.id]);

      logger.info('Wallet withdrawal requested', { userId, amount, requestId: request.id });
      return request;
    });
  }

  async listMine(userId: string): Promise<any[]> {
    const r = await database.query(
      `SELECT ${SELECT} FROM wallet_withdrawal_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [userId]);
    return r.rows;
  }

  /** Customer withdraws their own request while it is still untouched — money goes straight back. */
  async cancelMine(userId: string, id: string): Promise<void> {
    await database.transaction(async (client: any) => {
      const r = await client.query(
        `SELECT id, wallet_id, amount, status FROM wallet_withdrawal_requests
         WHERE id = $1 AND user_id = $2 FOR UPDATE`, [id, userId]);
      if (r.rows.length === 0) throw new NotFoundError('WalletWithdrawalRequest', id);
      const req = r.rows[0];
      if (req.status !== 'requested')
        throw new ValidationError('Only a request that has not been reviewed yet can be cancelled.');
      await this.returnToWallet(client, req, 'Withdrawal cancelled — amount returned');
      await client.query(
        `UPDATE wallet_withdrawal_requests SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, [id]);
    });
  }

  /** Shared un-debit used by cancel and reject, so the two can never drift apart. */
  private async returnToWallet(client: any, req: any, description: string): Promise<void> {
    await client.query(
      `UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE id = $2`,
      [req.amount, req.wallet_id]);
    await client.query(
      `INSERT INTO wallet_transactions (wallet_id, type, amount, description, reference_id, reference_type)
       VALUES ($1,'refund',$2,$3,$4,'wallet_withdrawal')`,
      [req.wallet_id, req.amount, description, req.id]);
  }

  // ── Admin ─────────────────────────────────────────────────────
  async adminList(status?: string): Promise<any[]> {
    const params: any[] = [];
    let where = '';
    if (status) { params.push(status); where = `WHERE w.status = $1`; }
    const r = await database.query(
      `SELECT w.id, w.user_id as "userId", w.amount, w.currency, w.status, w.method,
              w.account_name as "accountName", w.account_number as "accountNumber", w.ifsc,
              w.upi_id as "upiId", w.utr_reference as "utrReference",
              w.admin_note as "adminNote", w.rejection_reason as "rejectionReason",
              w.reviewed_at as "reviewedAt", w.settled_at as "settledAt", w.created_at as "createdAt",
              CONCAT(u.first_name, ' ', u.last_name) as "customerName", u.email as "customerEmail",
              EXTRACT(DAY FROM NOW() - w.created_at)::int as "ageDays"
       FROM wallet_withdrawal_requests w
       JOIN users u ON u.id = w.user_id
       ${where}
       ORDER BY CASE WHEN w.status IN ('requested','approved') THEN 0 ELSE 1 END, w.created_at ASC
       LIMIT 500`, params);
    return r.rows;
  }

  async adminApprove(id: string, adminId: string, note?: string): Promise<void> {
    const r = await database.query(
      `UPDATE wallet_withdrawal_requests SET status = 'approved', reviewed_by = $1, reviewed_at = NOW(),
              admin_note = COALESCE($2, admin_note), updated_at = NOW()
       WHERE id = $3 AND status = 'requested' RETURNING user_id, amount`,
      [adminId, note || null, id]);
    if (r.rows.length === 0) throw new ValidationError('Only a pending request can be approved.');
    await this.notify(r.rows[0].user_id, 'Withdrawal approved',
      `Your withdrawal of ${Number(r.rows[0].amount).toFixed(2)} has been approved and will be paid shortly.`);
  }

  async adminReject(id: string, adminId: string, reason: string): Promise<void> {
    if (!reason?.trim()) throw new ValidationError('A rejection reason is required.');
    await database.transaction(async (client: any) => {
      const r = await client.query(
        `SELECT id, wallet_id, amount, user_id, status FROM wallet_withdrawal_requests
         WHERE id = $1 FOR UPDATE`, [id]);
      if (r.rows.length === 0) throw new NotFoundError('WalletWithdrawalRequest', id);
      const req = r.rows[0];
      if (!['requested', 'approved'].includes(req.status))
        throw new ValidationError('Only a pending or approved request can be rejected.');

      // The money was debited at request time, so rejecting MUST put it back or the customer
      // silently loses it.
      await this.returnToWallet(client, req, `Withdrawal rejected — amount returned (${reason.trim()})`);
      await client.query(
        `UPDATE wallet_withdrawal_requests SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(),
                rejection_reason = $2, updated_at = NOW() WHERE id = $3`, [adminId, reason.trim(), id]);

      await this.notify(req.user_id, 'Withdrawal not approved',
        `Your withdrawal request was not approved: ${reason.trim()}. `
        + `The full amount is back in your wallet balance.`);
    });
  }

  /** Payout made outside the app (bank/UPI); the reference is recorded here as evidence. */
  async adminSettle(id: string, adminId: string, utrReference: string, note?: string): Promise<void> {
    if (!utrReference?.trim())
      throw new ValidationError('A payment reference (UTR) is required so the customer has evidence.');
    const r = await database.query(
      `UPDATE wallet_withdrawal_requests SET status = 'settled', settled_by = $1, settled_at = NOW(),
              utr_reference = $2, admin_note = COALESCE($3, admin_note), updated_at = NOW()
       WHERE id = $4 AND status IN ('requested', 'approved') RETURNING user_id, amount, method`,
      [adminId, utrReference.trim(), note || null, id]);
    if (r.rows.length === 0) throw new ValidationError('Only a pending or approved request can be settled.');
    const row = r.rows[0];
    // No wallet write here: the balance was already debited at request time. Crediting or
    // debiting again would double-count the payout.
    await this.notify(row.user_id, 'Withdrawal paid',
      `${Number(row.amount).toFixed(2)} has been sent to your ${row.method === 'upi' ? 'UPI ID' : 'bank account'}. `
      + `Reference: ${utrReference.trim()}. It can take a few hours to appear.`);
    logger.info('Wallet withdrawal settled', { id, adminId, utrReference: utrReference.trim() });
  }

  private async notify(userId: string, title: string, message: string): Promise<void> {
    try {
      await NotificationService.createNotification(userId, 'payment', title, message, 'all', {});
    } catch { /* non-blocking */ }
  }
}

export default new WalletWithdrawalService();

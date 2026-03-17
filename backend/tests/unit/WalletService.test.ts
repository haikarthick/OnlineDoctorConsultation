import database from '../../src/utils/database';
import walletService from '../../src/services/WalletService';

jest.mock('../../src/utils/database');

describe('WalletService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getOrCreateWallet', () => {
    it('should return existing wallet', async () => {
      const wallet = { id: 'w1', user_id: 'u1', balance: '100.00', bonus_credits: '10.00' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [wallet] });
      const result = await walletService.getOrCreateWallet('u1');
      expect(result).toEqual(wallet);
    });

    it('should create wallet if not found', async () => {
      const wallet = { id: 'w1', user_id: 'u1', balance: '0.00', bonus_credits: '0.00' };
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [wallet] });
      const result = await walletService.getOrCreateWallet('u1');
      expect(result).toBeDefined();
    });
  });

  describe('credit', () => {
    it('should credit amount to wallet', async () => {
      const wallet = { id: 'w1', user_id: 'u1', balance: '100.00' };
      const tx = { id: 'tx1', wallet_id: 'w1', type: 'credit', amount: '50.00' };
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [wallet] })
        .mockResolvedValueOnce({ rows: [{ ...wallet, balance: '150.00' }] })
        .mockResolvedValueOnce({ rows: [tx] });
      const result = await walletService.credit('u1', 50, 'Payment received');
      expect(result).toBeDefined();
    });
  });

  describe('debit', () => {
    it('should debit amount from wallet', async () => {
      const wallet = { id: 'w1', user_id: 'u1', balance: '100.00', bonus_credits: '0.00' };
      const tx = { id: 'tx1', wallet_id: 'w1', type: 'debit', amount: '30.00' };
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [wallet] })
        .mockResolvedValueOnce({ rows: [{ ...wallet, balance: '70.00' }] })
        .mockResolvedValueOnce({ rows: [tx] });
      const result = await walletService.debit('u1', 30, 'Service payment');
      expect(result).toBeDefined();
    });

    it('should throw if insufficient balance', async () => {
      const wallet = { id: 'w1', userId: 'u1', balance: '10.00', bonusCredits: '0.00' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [wallet] });
      await expect(walletService.debit('u1', 50, 'Too much')).rejects.toThrow();
    });
  });

  describe('refund', () => {
    it('should refund amount to wallet', async () => {
      const wallet = { id: 'w1', user_id: 'u1', balance: '100.00' };
      const tx = { id: 'tx1', wallet_id: 'w1', type: 'refund', amount: '25.00' };
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [wallet] })
        .mockResolvedValueOnce({ rows: [{ ...wallet, balance: '125.00' }] })
        .mockResolvedValueOnce({ rows: [tx] });
      const result = await walletService.refund('u1', 25, 'Cancelled booking');
      expect(result).toBeDefined();
    });
  });

  describe('addBonus', () => {
    it('should add bonus credits', async () => {
      const wallet = { id: 'w1', user_id: 'u1', balance: '100.00', bonus_credits: '0.00' };
      const tx = { id: 'tx1', wallet_id: 'w1', type: 'bonus', amount: '10.00' };
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [wallet] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [tx] });
      const result = await walletService.addBonus('u1', 10, 'Welcome bonus');
      expect(result).toBeDefined();
    });
  });

  describe('listTransactions', () => {
    it('should list wallet transactions', async () => {
      const wallet = { id: 'w1', userId: 'u1', balance: '100.00' };
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [wallet] })            // getOrCreateWallet
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })    // COUNT
        .mockResolvedValueOnce({ rows: [{ id: 'tx1' }] });    // SELECT
      const result = await walletService.listTransactions('u1');
      expect(result.transactions).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });
});

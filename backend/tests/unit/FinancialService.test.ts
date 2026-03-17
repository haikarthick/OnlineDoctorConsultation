import database from '../../src/utils/database';
import financialService from '../../src/services/FinancialService';

jest.mock('../../src/utils/database');

describe('FinancialService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('should create a financial record', async () => {
      const record = { id: 'f1', enterprise_id: 'e1', record_type: 'income', category: 'milk_sales', amount: '500.00', transaction_date: '2024-06-01' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [record] });
      const result = await financialService.create({ enterprise_id: 'e1', record_type: 'income', category: 'milk_sales', amount: 500 });
      expect(result).toEqual(expect.objectContaining({ id: 'f1', recordType: 'income', amount: 500 }));
    });
  });

  describe('update', () => {
    it('should update a financial record', async () => {
      const updated = { id: 'f1', amount: '750.00' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [updated] });
      const result = await financialService.update('f1', { amount: 750 });
      expect(result).toEqual(expect.objectContaining({ id: 'f1', amount: 750 }));
    });
  });

  describe('list', () => {
    it('should list financial records for an enterprise', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'f1' }, { id: 'f2' }] });
      const result = await financialService.list('e1');
      expect(result.items).toHaveLength(2);
    });

    it('should filter by recordType', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      await financialService.list('e1', { recordType: 'expense' });
      expect(database.query).toHaveBeenCalled();
    });

    it('should filter by category', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      await financialService.list('e1', { category: 'feed' });
      expect(database.query).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete a financial record', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      await financialService.delete('f1');
      expect(database.query).toHaveBeenCalledWith(expect.stringContaining('DELETE'), ['f1']);
    });
  });

  describe('getFinancialDashboard', () => {
    it('should return financial dashboard with default months', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total_income: '1000', total_expense: '500' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });
      const result = await financialService.getFinancialDashboard('e1');
      expect(result).toBeDefined();
    });

    it('should accept custom months parameter', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total_income: '0', total_expense: '0' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });
      const result = await financialService.getFinancialDashboard('e1', 6);
      expect(result).toBeDefined();
    });
  });
});

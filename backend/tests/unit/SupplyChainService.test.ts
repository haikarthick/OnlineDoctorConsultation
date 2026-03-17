import database from '../../src/utils/database';
import supplyChainService from '../../src/services/SupplyChainService';

jest.mock('../../src/utils/database');

describe('SupplyChainService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('createBatch', () => {
    it('should create a batch', async () => {
      const batch = { id: 'b1', enterprise_id: 'e1', product_name: 'Milk', status: 'active' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [batch] });
      const result = await supplyChainService.createBatch({ enterprise_id: 'e1', product_name: 'Milk' });
      expect(result).toEqual(batch);
    });
  });

  describe('listBatches', () => {
    it('should list batches for an enterprise', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'b1' }], rowCount: 1 });
      const result = await supplyChainService.listBatches('e1');
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by status', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 0 });
      await supplyChainService.listBatches('e1', { status: 'active' });
      expect(database.query).toHaveBeenCalled();
    });
  });

  describe('updateBatch', () => {
    it('should update a batch', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'b1', status: 'completed' }] });
      const result = await supplyChainService.updateBatch('b1', { status: 'completed' });
      expect(result).toBeDefined();
    });
  });

  describe('createEvent', () => {
    it('should create a traceability event', async () => {
      const event = { id: 'ev1', batch_id: 'b1', event_type: 'quality_check' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [event] });
      const result = await supplyChainService.createEvent({ enterprise_id: 'e1', batch_id: 'b1', event_type: 'quality_check', description: 'Passed' });
      expect(result).toBeDefined();
    });
  });

  describe('listEvents', () => {
    it('should list traceability events', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'ev1' }], rowCount: 1 });
      const result = await supplyChainService.listEvents('e1');
      expect(result.items).toHaveLength(1);
    });

    it('should filter by batchId', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 0 });
      await supplyChainService.listEvents('e1', { batchId: 'b1' });
      expect(database.query).toHaveBeenCalled();
    });
  });

  describe('verifyEvent', () => {
    it('should verify a traceability event', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'ev1', verified: true }] });
      const result = await supplyChainService.verifyEvent('ev1', 'u1');
      expect(result).toBeDefined();
    });
  });

  describe('generateQRCode', () => {
    it('should generate a QR code', async () => {
      const qr = { id: 'qr1', batch_id: 'b1' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [qr] });
      const result = await supplyChainService.generateQRCode({ enterprise_id: 'e1', batch_id: 'b1' });
      expect(result).toEqual(qr);
    });
  });

  describe('listQRCodes', () => {
    it('should list QR codes', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'qr1' }] });
      const result = await supplyChainService.listQRCodes('e1');
      expect(result.items).toHaveLength(1);
    });
  });

  describe('incrementScan', () => {
    it('should increment scan count', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      await supplyChainService.incrementScan('qr1');
      expect(database.query).toHaveBeenCalled();
    });
  });

  describe('getBatchTraceability', () => {
    it('should return batch traceability', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'b1' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });
      const result = await supplyChainService.getBatchTraceability('b1');
      expect(result).toBeDefined();
      expect(result).toHaveProperty('batch');
    });
  });

  describe('getSupplyChainDashboard', () => {
    it('should return supply chain dashboard', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: '5' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });
      const result = await supplyChainService.getSupplyChainDashboard('e1');
      expect(result).toBeDefined();
    });
  });
});

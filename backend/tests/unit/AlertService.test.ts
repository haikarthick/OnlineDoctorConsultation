import database from '../../src/utils/database';
import alertService from '../../src/services/AlertService';

jest.mock('../../src/utils/database');

describe('AlertService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('createRule', () => {
    it('should create an alert rule', async () => {
      const rule = { id: 'r1', enterprise_id: 'e1', name: 'High Temp', alert_type: 'health', severity: 'warning', is_enabled: true };
      (database.query as jest.Mock).mockResolvedValue({ rows: [rule] });
      const result = await alertService.createRule({ enterprise_id: 'e1', name: 'High Temp', alert_type: 'health', severity: 'warning' });
      expect(result).toEqual(expect.objectContaining({ id: 'r1', name: 'High Temp', alertType: 'health', isEnabled: true }));
    });
  });

  describe('updateRule', () => {
    it('should update an alert rule', async () => {
      const updated = { id: 'r1', name: 'Updated Rule', severity: 'critical' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [updated] });
      const result = await alertService.updateRule('r1', { name: 'Updated Rule', severity: 'critical' });
      expect(result).toEqual(expect.objectContaining({ id: 'r1', name: 'Updated Rule' }));
    });
  });

  describe('listRules', () => {
    it('should list alert rules for an enterprise', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'r1' }, { id: 'r2' }] });
      const result = await alertService.listRules('e1');
      expect(result.items).toHaveLength(2);
    });
  });

  describe('deleteRule', () => {
    it('should delete an alert rule', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      await alertService.deleteRule('r1');
      expect(database.query).toHaveBeenCalledWith(expect.stringContaining('DELETE'), ['r1']);
    });
  });

  describe('toggleRule', () => {
    it('should toggle a rule enabled state', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      await alertService.toggleRule('r1', false);
      expect(database.query).toHaveBeenCalled();
    });
  });

  describe('createEvent', () => {
    it('should create an alert event', async () => {
      const event = { id: 'e1', enterprise_id: 'ent1', rule_id: 'r1', alert_type: 'health', severity: 'warning', title: 'Alert', message: 'Temp high' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [event] });
      const result = await alertService.createEvent({ enterprise_id: 'ent1', rule_id: 'r1', alert_type: 'health', severity: 'warning', title: 'Alert', message: 'Temp high' });
      expect(result).toEqual(expect.objectContaining({ id: 'e1', alertType: 'health' }));
    });
  });

  describe('listEvents', () => {
    it('should list alert events for an enterprise', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'ev1' }] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });
      const result = await alertService.listEvents('e1');
      expect(result.items).toHaveLength(1);
      expect(result).toHaveProperty('unreadCount');
    });

    it('should filter by severity', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });
      await alertService.listEvents('e1', { severity: 'critical' });
      expect(database.query).toHaveBeenCalled();
    });
  });

  describe('markRead', () => {
    it('should mark an event as read', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      await alertService.markRead('ev1');
      expect(database.query).toHaveBeenCalled();
    });
  });

  describe('markAllRead', () => {
    it('should mark all events as read', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      await alertService.markAllRead('e1');
      expect(database.query).toHaveBeenCalled();
    });
  });

  describe('acknowledge', () => {
    it('should acknowledge an alert event', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      await alertService.acknowledge('ev1', 'user1');
      expect(database.query).toHaveBeenCalled();
    });
  });

  describe('runAlertChecks', () => {
    it('should run alert checks and return count', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'r1', alert_type: 'health', conditions: {}, enterprise_id: 'e1', severity: 'warning', name: 'Rule1' }] })
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'ev1' }] });
      const result = await alertService.runAlertChecks('e1');
      expect(typeof result).toBe('number');
    });

    it('should return 0 when no rules exist', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      const result = await alertService.runAlertChecks('e1');
      expect(result).toBe(0);
    });
  });
});

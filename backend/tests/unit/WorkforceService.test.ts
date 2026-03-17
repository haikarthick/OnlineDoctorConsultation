import database from '../../src/utils/database';
import workforceService from '../../src/services/WorkforceService';

jest.mock('../../src/utils/database');

describe('WorkforceService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('createTask', () => {
    it('should create a task', async () => {
      const task = { id: 't1', enterprise_id: 'e1', title: 'Feed cows', status: 'pending' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [task] });
      const result = await workforceService.createTask({ enterprise_id: 'e1', title: 'Feed cows' });
      expect(result).toEqual(task);
    });
  });

  describe('listTasks', () => {
    it('should list tasks for an enterprise', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ id: 't1' }, { id: 't2' }], rowCount: 2 });
      const result = await workforceService.listTasks('e1');
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by status', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 0 });
      await workforceService.listTasks('e1', { status: 'completed' });
      expect(database.query).toHaveBeenCalled();
    });

    it('should filter by assignedTo', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 0 });
      await workforceService.listTasks('e1', { assignedTo: 'u1' });
      expect(database.query).toHaveBeenCalled();
    });
  });

  describe('updateTask', () => {
    it('should update a task', async () => {
      const updated = { id: 't1', status: 'in_progress' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [updated] });
      const result = await workforceService.updateTask('t1', { status: 'in_progress' });
      expect(result).toBeDefined();
    });
  });

  describe('deleteTask', () => {
    it('should delete a task', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      await workforceService.deleteTask('t1');
      expect(database.query).toHaveBeenCalledWith(expect.stringContaining('DELETE'), ['t1']);
    });
  });

  describe('createShift', () => {
    it('should create a shift', async () => {
      const shift = { id: 's1', enterprise_id: 'e1', user_id: 'u1' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [shift] });
      const result = await workforceService.createShift({ enterprise_id: 'e1', user_id: 'u1' });
      expect(result).toEqual(shift);
    });
  });

  describe('listShifts', () => {
    it('should list shifts for an enterprise', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ id: 's1' }], rowCount: 1 });
      const result = await workforceService.listShifts('e1');
      expect(result.items).toHaveLength(1);
    });

    it('should filter by userId', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 0 });
      await workforceService.listShifts('e1', { userId: 'u1' });
      expect(database.query).toHaveBeenCalled();
    });
  });

  describe('updateShift', () => {
    it('should update a shift', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ id: 's1' }] });
      const result = await workforceService.updateShift('s1', { status: 'completed' });
      expect(result).toBeDefined();
    });
  });

  describe('checkIn', () => {
    it('should check in', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      await workforceService.checkIn('s1');
      expect(database.query).toHaveBeenCalled();
    });
  });

  describe('checkOut', () => {
    it('should check out', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      await workforceService.checkOut('s1');
      expect(database.query).toHaveBeenCalled();
    });
  });

  describe('deleteShift', () => {
    it('should delete a shift', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      await workforceService.deleteShift('s1');
      expect(database.query).toHaveBeenCalledWith(expect.stringContaining('DELETE'), ['s1']);
    });
  });

  describe('getWorkforceDashboard', () => {
    it('should return workforce dashboard', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: '10', completed: '5' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });
      const result = await workforceService.getWorkforceDashboard('e1');
      expect(result).toBeDefined();
    });
  });
});

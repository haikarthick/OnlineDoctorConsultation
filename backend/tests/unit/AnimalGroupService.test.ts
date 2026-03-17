import database from '../../src/utils/database';
import animalGroupService from '../../src/services/AnimalGroupService';

jest.mock('../../src/utils/database');
jest.mock('uuid', () => ({ v4: () => 'mock-uuid' }));

describe('AnimalGroupService', () => {
  beforeEach(() => jest.resetAllMocks());

  const snakeGroup = {
    id: 'g1', enterprise_id: 'e1', name: 'Dairy Herd A', group_type: 'herd',
    species: null, breed: null, purpose: null, target_count: '0', current_count: '0',
    description: null, color_code: null, is_active: true, metadata: null,
    created_at: '2024-01-01', updated_at: '2024-01-01',
    enterprise_name: 'Farm Co', actual_count: '5'
  };

  describe('createGroup', () => {
    it('should create an animal group', async () => {
      const group = { id: 'mock-uuid', enterprise_id: 'e1', name: 'Dairy Herd A', group_type: 'herd', current_count: '0' };
      (database.query as jest.Mock).mockResolvedValueOnce({ rows: [group] });
      const result = await animalGroupService.createGroup({ enterpriseId: 'e1', name: 'Dairy Herd A', groupType: 'herd' });
      expect(result).toEqual(expect.objectContaining({ id: 'mock-uuid', name: 'Dairy Herd A' }));
      expect(database.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO animal_groups'), expect.any(Array));
    });
  });

  describe('getGroup', () => {
    it('should return a group by id', async () => {
      (database.query as jest.Mock).mockResolvedValueOnce({ rows: [snakeGroup] });
      const result = await animalGroupService.getGroup('g1');
      expect(result).toEqual(expect.objectContaining({ id: 'g1', name: 'Dairy Herd A', enterpriseId: 'e1' }));
    });

    it('should throw NotFoundError if not found', async () => {
      (database.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      await expect(animalGroupService.getGroup('nonexistent')).rejects.toThrow();
    });
  });

  describe('listByEnterprise', () => {
    it('should list groups for an enterprise', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: '2' }] })   // COUNT
        .mockResolvedValueOnce({ rows: [snakeGroup, { ...snakeGroup, id: 'g2' }] }); // SELECT
      const result = await animalGroupService.listByEnterprise('e1');
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should respect limit and offset', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: '10' }] })
        .mockResolvedValueOnce({ rows: [snakeGroup] });
      const result = await animalGroupService.listByEnterprise('e1', 1, 5);
      expect(result.items).toHaveLength(1);
    });
  });

  describe('updateGroup', () => {
    it('should update a group', async () => {
      const updated = { ...snakeGroup, name: 'Updated Herd' };
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })               // UPDATE query
        .mockResolvedValueOnce({ rows: [updated] });       // getGroup SELECT
      const result = await animalGroupService.updateGroup('g1', { name: 'Updated Herd' });
      expect(result).toEqual(expect.objectContaining({ id: 'g1', name: 'Updated Herd' }));
    });

    it('should throw NotFoundError if group not found', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })    // UPDATE
        .mockResolvedValueOnce({ rows: [] });   // getGroup → empty
      await expect(animalGroupService.updateGroup('nonexistent', { name: 'Test' })).rejects.toThrow();
    });
  });

  describe('deleteGroup', () => {
    it('should delete a group', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })    // UPDATE animals unlink
        .mockResolvedValueOnce({ rows: [] });   // UPDATE groups soft delete
      await animalGroupService.deleteGroup('g1');
      expect(database.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE'), expect.any(Array));
    });
  });

  describe('assignAnimal', () => {
    it('should assign an animal to a group', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [snakeGroup] })  // getGroup
        .mockResolvedValueOnce({ rows: [] })             // UPDATE animal
        .mockResolvedValueOnce({ rows: [] });            // updateGroupCount
      await animalGroupService.assignAnimal('g1', 'a1');
      expect(database.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        expect.arrayContaining(['g1', 'a1'])
      );
    });
  });

  describe('removeAnimal', () => {
    it('should remove an animal from a group', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })     // UPDATE animal unlink
        .mockResolvedValueOnce({ rows: [] });    // updateGroupCount
      await animalGroupService.removeAnimal('g1', 'a1');
      expect(database.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        expect.arrayContaining(['a1', 'g1'])
      );
    });
  });
});

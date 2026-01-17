import UserService from '../../src/services/UserService';
import database from '../../src/utils/database';
import { ConflictError, DatabaseError } from '../../src/utils/errors';

jest.mock('../../src/utils/database');

describe('UserService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createUser', () => {
    it('should create a new user successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'pet_owner',
        phone: '+919876543210',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (database.query as jest.Mock).mockResolvedValue({ rows: [mockUser] });

      const result = await UserService.createUser({
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+919876543210',
        password: 'password123',
        role: 'pet_owner'
      });

      expect(result).toBeDefined();
      expect(result.email).toEqual('test@example.com');
      expect(database.query).toHaveBeenCalled();
    });

    it('should throw ConflictError if email already exists', async () => {
      const error = new Error('Duplicate key');
      (error as any).code = '23505';
      (database.query as jest.Mock).mockRejectedValue(error);

      await expect(
        UserService.createUser({
          email: 'existing@example.com',
          firstName: 'John',
          lastName: 'Doe',
          phone: '+919876543210',
          password: 'password123',
          role: 'pet_owner'
        })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('getUserById', () => {
    it('should retrieve user by id', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'pet_owner',
        phone: '+919876543210',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (database.query as jest.Mock).mockResolvedValue({ rows: [mockUser] });

      const result = await UserService.getUserById('user-123');

      expect(result).toEqual(mockUser);
      expect(database.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM users WHERE id'),
        ['user-123']
      );
    });

    it('should return null if user not found', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });

      const result = await UserService.getUserById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('listUsers', () => {
    it('should list users with pagination', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          firstName: 'User',
          lastName: 'One',
          role: 'pet_owner',
          phone: '+919876543210',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: mockUsers })
        .mockResolvedValueOnce({ rows: [{ count: '100' }] });

      const result = await UserService.listUsers(undefined, 10, 0);

      expect(result.users).toHaveLength(1);
      expect(result.total).toEqual(100);
    });

    it('should filter users by role', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await UserService.listUsers('veterinarian', 10, 0);

      expect(database.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE role = $1'),
        expect.arrayContaining(['veterinarian'])
      );
    });
  });
});

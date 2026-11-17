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

      // first query: is the mobile number already on another account? (no)   second: the insert
      (database.query as jest.Mock).mockResolvedValueOnce({ rows: [] }).mockResolvedValue({ rows: [mockUser] });

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

describe('UserService - mobile number as a login identifier', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('signs in by mobile number however it is typed (looked up by the normalised form)', async () => {
    (database.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'u1', email: 'a@b.c' }] });
    for (const typed of ['98765 43210', '+91 98765-43210', '09876543210']) {
      await UserService.getUserByIdentifier(typed);
      const [sql, params] = (database.query as jest.Mock).mock.calls.pop();
      expect(sql).toMatch(/phone_e164 = \$1/);
      expect(params).toEqual(['+919876543210']);
    }
  });

  it('signs in by email as before', async () => {
    (database.query as jest.Mock).mockResolvedValue({ rows: [] });
    await UserService.getUserByIdentifier('tom@farm.com');
    const [sql, params] = (database.query as jest.Mock).mock.calls.pop();
    expect(sql).toMatch(/FROM users WHERE email = \$1/);
    expect(params).toEqual(['tom@farm.com']);
  });

  it('a long number that cannot be a mobile finds nobody, without touching the database', async () => {
    expect(await UserService.getUserByIdentifier('5876543210')).toBeNull();
    expect(database.query).not.toHaveBeenCalled();
  });

  it('a number already on another account is refused in words; the same account may keep its own', async () => {
    (database.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'other' }] });
    await expect(UserService.phoneForStorage('98765 43210')).rejects.toThrow(/already registered/);
    await expect(UserService.phoneForStorage('98765 43210', 'other')).resolves.toBe('+919876543210');
  });

  it('a blank number is simply none; an impossible one is a plain validation message', async () => {
    expect(await UserService.phoneForStorage('')).toBeNull();
    expect(await UserService.phoneForStorage(undefined)).toBeNull();
    await expect(UserService.phoneForStorage('abc')).rejects.toThrow(/valid mobile number/);
  });
});

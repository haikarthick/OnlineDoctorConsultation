// Setup file for Jest tests
import cacheManager from '../src/utils/cacheManager';
import database from '../src/utils/database';

// Mock database connection in tests
jest.mock('../src/utils/database', () => ({
  query: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  transaction: jest.fn(),
  getPool: jest.fn()
}));

// Mock cache manager
jest.mock('../src/utils/cacheManager', () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  clear: jest.fn(),
  disconnect: jest.fn(),
  getClient: jest.fn()
}));

beforeAll(async () => {
  // Setup before all tests
  process.env.NODE_ENV = 'test';
});

afterEach(async () => {
  // Clear mocks after each test
  jest.clearAllMocks();
});

afterAll(async () => {
  // Cleanup after all tests
  jest.restoreAllMocks();
});

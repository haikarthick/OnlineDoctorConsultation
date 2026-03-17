import database from '../../src/utils/database';

// Mock OpenAI before importing the service to prevent real API calls
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: jest.fn().mockRejectedValue(new Error('mocked')) } }
  }));
});

import aiCopilotService from '../../src/services/AiCopilotService';

jest.mock('../../src/utils/database');
const pool = database;

describe('AiCopilotService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('listSessions', () => {
    it('should list sessions for a user', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [{ id: 's1', user_id: 'u1' }] });
      const result = await aiCopilotService.listSessions('u1');
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by sessionType', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [] });
      await aiCopilotService.listSessions('u1', { sessionType: 'general' });
      expect(pool.query).toHaveBeenCalled();
    });
  });

  describe('createSession', () => {
    it('should create a new session', async () => {
      const session = { id: 's1', user_id: 'u1', title: 'Test' };
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 's1' }] })
        .mockResolvedValueOnce({ rows: [session] });
      const result = await aiCopilotService.createSession({ userId: 'u1', title: 'Test' });
      expect(result).toBeDefined();
    });
  });

  describe('getSession', () => {
    it('should get a session by id', async () => {
      const session = { id: 's1', user_id: 'u1', title: 'Test' };
      (pool.query as jest.Mock).mockResolvedValue({ rows: [session] });
      const result = await aiCopilotService.getSession('s1');
      expect(result).toEqual(session);
    });

    it('should return null if session not found', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [] });
      const result = await aiCopilotService.getSession('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('deleteSession', () => {
    it('should delete a session', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [] });
      await aiCopilotService.deleteSession('s1');
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('DELETE'), ['s1']);
    });
  });

  describe('listMessages', () => {
    it('should list messages for a session', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'm1', role: 'user', content: 'Hello' }] });
      const result = await aiCopilotService.listMessages('s1');
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('content', 'Hello');
    });
  });

  describe('sendMessage', () => {
    it('should send a message and get AI response', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 's1', session_type: 'general' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'm1', role: 'user', content: 'Hello' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'm2', role: 'assistant', content: 'Hi there!' }] })
        .mockResolvedValueOnce({ rows: [] });
      const result = await aiCopilotService.sendMessage('s1', 'u1', 'Hello');
      expect(result).toBeDefined();
      expect(result).toHaveProperty('userMessage');
      expect(result).toHaveProperty('aiMessage');
    });
  });

  describe('checkDrugInteractions', () => {
    it('should check drug interactions', async () => {
      const result = await aiCopilotService.checkDrugInteractions(['Amoxicillin', 'Metronidazole']);
      expect(result).toBeDefined();
      expect(result).toHaveProperty('drugs');
      expect(result.drugs).toHaveLength(2);
    });
  });

  describe('analyzeSymptoms', () => {
    it('should analyze symptoms', async () => {
      const result = await aiCopilotService.analyzeSymptoms(['lethargy', 'vomiting'], 'dog');
      expect(result).toBeDefined();
      expect(result).toHaveProperty('symptoms');
      expect(result).toHaveProperty('overallUrgency');
    });
  });
});

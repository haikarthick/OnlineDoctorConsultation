import database from '../../src/utils/database';
import videoSessionService from '../../src/services/VideoSessionService';

jest.mock('../../src/utils/database');

describe('VideoSessionService', () => {
  beforeEach(() => { jest.clearAllMocks(); (database.query as jest.Mock).mockReset(); });

  describe('createSession', () => {
    it('should create a video session', async () => {
      const session = { id: 'vs1', host_user_id: 'u1', room_id: 'room1', status: 'waiting' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [session] });
      const result = await videoSessionService.createSession('u1', { consultationId: 'c1', participantUserId: 'u2' });
      expect(result).toBeDefined();
      expect(result).toHaveProperty('id');
    });
  });

  describe('getSession', () => {
    it('should get a session by id', async () => {
      const session = { id: 'vs1', status: 'waiting' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [session] });
      const result = await videoSessionService.getSession('vs1');
      expect(result).toEqual(session);
    });

    it('should throw if session not found', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      await expect(videoSessionService.getSession('nonexistent')).rejects.toThrow();
    });
  });

  describe('getSessionByConsultation', () => {
    it('should get session by consultation id', async () => {
      const session = { id: 'vs1', consultation_id: 'c1' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [session] });
      const result = await videoSessionService.getSessionByConsultation('c1');
      expect(result).toEqual(session);
    });

    it('should return null if not found', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      const result = await videoSessionService.getSessionByConsultation('c1');
      expect(result).toBeNull();
    });
  });

  describe('getSessionByRoom', () => {
    it('should get session by room id', async () => {
      const session = { id: 'vs1', room_id: 'room1' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [session] });
      const result = await videoSessionService.getSessionByRoom('room1');
      expect(result).toEqual(session);
    });
  });

  describe('startSession', () => {
    it('should start a session', async () => {
      const session = { id: 'vs1', status: 'active', consultation_id: 'c1' };
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [session] })
        .mockResolvedValueOnce({ rows: [] });
      const result = await videoSessionService.startSession('vs1');
      expect(result).toBeDefined();
    });
  });

  describe('endSession', () => {
    it('should end a session', async () => {
      const session = { id: 'vs1', status: 'ended', consultation_id: 'c1' };
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [session] })
        .mockResolvedValueOnce({ rows: [] });
      const result = await videoSessionService.endSession('vs1');
      expect(result).toBeDefined();
    });
  });

  describe('addChatMessage', () => {
    it('should add a chat message', async () => {
      const msg = { id: 'm1', session_id: 'vs1', sender_id: 'u1', message: 'Hello' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [msg] });
      const result = await videoSessionService.addChatMessage('vs1', 'u1', 'Dr. Smith', 'Hello');
      expect(result).toEqual(msg);
    });
  });

  describe('getChatMessages', () => {
    it('should get chat messages for a session', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'm1', message: 'Hello' }] });
      const result = await videoSessionService.getChatMessages('vs1');
      expect(result).toHaveLength(1);
    });
  });

  describe('listActiveSessions', () => {
    it('should list active sessions', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'vs1', status: 'active' }] });
      const result = await videoSessionService.listActiveSessions();
      expect(result).toHaveLength(1);
    });
  });

  describe('sendSignal', () => {
    it('should send a signal', () => {
      videoSessionService.sendSignal('vs1', 'u1', 'offer', '{"sdp":"test"}');
      const signals = videoSessionService.getSignals('vs1', 'u1');
      expect(Array.isArray(signals)).toBe(true);
    });
  });

  describe('clearSignals', () => {
    it('should clear signals for a session', () => {
      videoSessionService.sendSignal('vs1', 'u1', 'offer', '{"sdp":"test"}');
      videoSessionService.clearSignals('vs1');
      const signals = videoSessionService.getSignals('vs1', 'u1');
      expect(signals).toHaveLength(0);
    });
  });
});

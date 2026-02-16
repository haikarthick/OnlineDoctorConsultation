import { v4 as uuidv4 } from 'uuid';
import database from '../utils/database';
import { VideoSession, ChatMessage, CreateVideoSessionDTO, VideoSessionStatus } from '../models/types';
import { NotFoundError, ValidationError } from '../utils/errors';
import logger from '../utils/logger';

class VideoSessionService {
  async createSession(hostUserId: string, data: CreateVideoSessionDTO): Promise<VideoSession> {
    const id = uuidv4();
    const roomId = `room_${uuidv4().replace(/-/g, '').substring(0, 12)}`;
    const now = new Date();

    const result = await database.query(
      `INSERT INTO video_sessions (id, consultation_id, room_id, host_user_id, participant_user_id,
       status, quality, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, consultation_id as "consultationId", room_id as "roomId",
       host_user_id as "hostUserId", participant_user_id as "participantUserId",
       status, quality, created_at as "createdAt", updated_at as "updatedAt"`,
      [id, data.consultationId, roomId, hostUserId, data.participantUserId,
       'waiting', 'high', now, now]
    );

    logger.info('Video session created', { sessionId: id, roomId, consultationId: data.consultationId });
    return result.rows[0];
  }

  async getSession(id: string): Promise<VideoSession> {
    const result = await database.query(
      `SELECT id, consultation_id as "consultationId", room_id as "roomId",
       host_user_id as "hostUserId", participant_user_id as "participantUserId",
       status, started_at as "startedAt", ended_at as "endedAt", duration,
       recording_url as "recordingUrl", quality,
       created_at as "createdAt", updated_at as "updatedAt"
       FROM video_sessions WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Video Session', id);
    }
    return result.rows[0];
  }

  async getSessionByConsultation(consultationId: string): Promise<VideoSession | null> {
    // Prefer active/waiting sessions over ended ones
    const result = await database.query(
      `SELECT id, consultation_id as "consultationId", room_id as "roomId",
       host_user_id as "hostUserId", participant_user_id as "participantUserId",
       status, started_at as "startedAt", ended_at as "endedAt", duration,
       quality, created_at as "createdAt", updated_at as "updatedAt"
       FROM video_sessions WHERE consultation_id = $1
       ORDER BY CASE WHEN status = 'active' THEN 0 WHEN status = 'waiting' THEN 1 ELSE 2 END, created_at DESC`,
      [consultationId]
    );
    return result.rows[0] || null;
  }

  async getSessionByRoom(roomId: string): Promise<VideoSession | null> {
    const result = await database.query(
      `SELECT id, consultation_id as "consultationId", room_id as "roomId",
       host_user_id as "hostUserId", participant_user_id as "participantUserId",
       status, started_at as "startedAt", ended_at as "endedAt", duration,
       quality, created_at as "createdAt", updated_at as "updatedAt"
       FROM video_sessions WHERE room_id = $1`,
      [roomId]
    );
    return result.rows[0] || null;
  }

  async startSession(id: string): Promise<VideoSession> {
    // If already active, just return the existing session (idempotent)
    const existing = await this.getSession(id);
    if (existing.status === 'active') {
      return existing;
    }

    const now = new Date();
    const result = await database.query(
      `UPDATE video_sessions SET status = $1, started_at = $2, updated_at = $3 WHERE id = $4
       RETURNING id, consultation_id as "consultationId", room_id as "roomId",
       host_user_id as "hostUserId", participant_user_id as "participantUserId",
       status, started_at as "startedAt", created_at as "createdAt", updated_at as "updatedAt"`,
      ['active', now, now, id]
    );

    if (result.rows.length === 0) throw new NotFoundError('Video Session', id);

    // Update consultation status to in_progress
    const session = result.rows[0];
    if (session.consultationId) {
      try {
        await database.query(
          `UPDATE consultations SET status = 'in_progress', started_at = $1, updated_at = $2 WHERE id = $3 AND status IN ('scheduled', 'confirmed', 'pending')`,
          [now, now, session.consultationId]
        );
        logger.info('Consultation status updated to in_progress', { consultationId: session.consultationId });
      } catch (err) {
        logger.warn('Failed to update consultation status on session start', { error: err });
      }
    }

    logger.info('Video session started', { sessionId: id });
    return session;
  }

  async endSession(id: string, recordingUrl?: string): Promise<VideoSession> {
    const session = await this.getSession(id);
    // If already ended, just return (idempotent)
    if (session.status === 'ended') {
      return session;
    }
    const now = new Date();
    const duration = session.startedAt
      ? Math.round((now.getTime() - new Date(session.startedAt).getTime()) / 1000)
      : 0;

    const recUrl = recordingUrl || null;
    const result = await database.query(
      `UPDATE video_sessions SET status = $1, ended_at = $2, duration = $3, recording_url = $4, updated_at = $5 WHERE id = $6
       RETURNING id, consultation_id as "consultationId", room_id as "roomId",
       status, started_at as "startedAt", ended_at as "endedAt", duration,
       recording_url as "recordingUrl",
       created_at as "createdAt", updated_at as "updatedAt"`,
      ['ended', now, duration, recUrl, now, id]
    );

    // Update consultation status to completed
    if (session.consultationId) {
      try {
        await database.query(
          `UPDATE consultations SET status = 'completed', completed_at = $1, duration = $2, updated_at = $3 WHERE id = $4 AND status IN ('in_progress', 'scheduled', 'confirmed', 'pending')`,
          [now, Math.round(duration / 60), now, session.consultationId]
        );
        logger.info('Consultation status updated to completed', { consultationId: session.consultationId, duration });
      } catch (err) {
        logger.warn('Failed to update consultation status on session end', { error: err });
      }
    }

    logger.info('Video session ended', { sessionId: id, duration, recordingUrl: recUrl });
    return result.rows[0];
  }

  async addChatMessage(sessionId: string, senderId: string, senderName: string, message: string, messageType: string = 'text'): Promise<ChatMessage> {
    const id = uuidv4();
    const now = new Date();

    const result = await database.query(
      `INSERT INTO chat_messages (id, session_id, sender_id, sender_name, message, message_type, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, session_id as "sessionId", sender_id as "senderId",
       sender_name as "senderName", message, message_type as "messageType", timestamp`,
      [id, sessionId, senderId, senderName, message, messageType, now]
    );

    return result.rows[0];
  }

  async getChatMessages(sessionId: string): Promise<ChatMessage[]> {
    const result = await database.query(
      `SELECT id, session_id as "sessionId", sender_id as "senderId",
       sender_name as "senderName", message, message_type as "messageType", timestamp
       FROM chat_messages WHERE session_id = $1 ORDER BY timestamp ASC`,
      [sessionId]
    );
    return result.rows;
  }

  async listActiveSessions(): Promise<VideoSession[]> {
    const result = await database.query(
      `SELECT id, consultation_id as "consultationId", room_id as "roomId",
       host_user_id as "hostUserId", participant_user_id as "participantUserId",
       status, started_at as "startedAt", quality,
       created_at as "createdAt", updated_at as "updatedAt"
       FROM video_sessions WHERE status IN ('waiting', 'active') ORDER BY created_at DESC`,
      []
    );
    return result.rows;
  }
}

export default new VideoSessionService();

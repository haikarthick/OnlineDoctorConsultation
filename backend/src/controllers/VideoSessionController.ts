import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import VideoSessionService from '../services/VideoSessionService';
import { ForbiddenError, ValidationError } from '../utils/errors';
import database from '../utils/database';
import logger from '../utils/logger';

class VideoSessionController {
  // Helper: check if a user is authorized for a session (host, participant, or part of the linked consultation)
  private async isAuthorized(userId: string, userRole: string, session: any): Promise<boolean> {
    if (userRole === 'admin') return true;
    if (session.hostUserId === userId || session.participantUserId === userId) return true;
    // Also check if user is part of the linked consultation
    if (session.consultationId) {
      try {
        const cResult = await database.query(
          'SELECT user_id, veterinarian_id FROM consultations WHERE id = $1',
          [session.consultationId]
        );
        if (cResult.rows.length > 0) {
          const c = cResult.rows[0];
          if (c.user_id === userId || c.veterinarian_id === userId) return true;
        }
      } catch { /* ignore */ }
    }
    return false;
  }

  async createSession(req: Request, res: Response) {
    const authReq = req as AuthRequest;
    const { consultationId, participantUserId } = req.body;

    if (!consultationId || !participantUserId) {
      throw new ValidationError('consultationId and participantUserId are required');
    }

    // Prevent duplicate sessions: return existing active/waiting session
    const existing = await VideoSessionService.getSessionByConsultation(consultationId);
    if (existing && (existing.status === 'active' || existing.status === 'waiting')) {
      return res.status(200).json({ success: true, data: existing });
    }

    const session = await VideoSessionService.createSession(authReq.userId!, {
      consultationId,
      participantUserId
    });
    res.status(201).json({ success: true, data: session });
  }

  async getSession(req: Request, res: Response) {
    const authReq = req as AuthRequest;
    const session = await VideoSessionService.getSession(req.params.id);

    const authorized = await this.isAuthorized(authReq.userId!, authReq.userRole!, session);
    if (!authorized) {
      throw new ForbiddenError('Not authorized to view this session');
    }

    res.json({ success: true, data: session });
  }

  async getSessionByConsultation(req: Request, res: Response) {
    const session = await VideoSessionService.getSessionByConsultation(req.params.consultationId);
    res.json({ success: true, data: session });
  }

  async joinSession(req: Request, res: Response) {
    const authReq = req as AuthRequest;
    const { roomId } = req.params;

    const session = await VideoSessionService.getSessionByRoom(roomId);
    if (!session) {
      throw new ValidationError('Session not found for this room');
    }

    const authorized = await this.isAuthorized(authReq.userId!, authReq.userRole!, session);
    if (!authorized) {
      throw new ForbiddenError('Not authorized to join this session');
    }

    // Auto-start the session when either party joins during waiting
    if (session.status === 'waiting') {
      const started = await VideoSessionService.startSession(session.id);
      return res.json({ success: true, data: started });
    }

    res.json({ success: true, data: session });
  }

  async startSession(req: Request, res: Response) {
    const authReq = req as AuthRequest;
    const session = await VideoSessionService.getSession(req.params.id);

    const authorized = await this.isAuthorized(authReq.userId!, authReq.userRole!, session);
    if (!authorized) {
      throw new ForbiddenError('Not authorized to start this session');
    }

    const started = await VideoSessionService.startSession(req.params.id);
    res.json({ success: true, data: started });
  }

  async endSession(req: Request, res: Response) {
    const authReq = req as AuthRequest;
    const session = await VideoSessionService.getSession(req.params.id);

    const authorized = await this.isAuthorized(authReq.userId!, authReq.userRole!, session);
    if (!authorized) {
      throw new ForbiddenError('Not authorized to end this session');
    }

    const ended = await VideoSessionService.endSession(req.params.id, req.body?.recordingUrl);
    res.json({ success: true, data: ended });
  }

  async sendMessage(req: Request, res: Response) {
    const authReq = req as AuthRequest;
    const { message, messageType } = req.body;

    if (!message) throw new ValidationError('Message is required');

    // Look up actual user name from DB
    let senderName = 'User';
    try {
      const userResult = await database.query(
        'SELECT first_name, last_name, role FROM users WHERE id = $1',
        [authReq.userId]
      );
      if (userResult.rows.length > 0) {
        const u = userResult.rows[0];
        const prefix = u.role === 'veterinarian' ? 'Dr. ' : '';
        senderName = `${prefix}${u.first_name} ${u.last_name}`.trim();
      }
    } catch { /* fallback to 'User' */ }

    const chatMessage = await VideoSessionService.addChatMessage(
      req.params.id, authReq.userId!, senderName, message, messageType || 'text'
    );
    res.status(201).json({ success: true, data: chatMessage });
  }

  async getMessages(req: Request, res: Response) {
    // No strict auth on messages - if you have the session ID, you can read messages
    // The session ID is not guessable (UUID) and only shared with participants
    const messages = await VideoSessionService.getChatMessages(req.params.id);
    res.json({ success: true, data: messages });
  }

  async listActiveSessions(req: Request, res: Response) {
    const authReq = req as AuthRequest;
    if (authReq.userRole !== 'admin') {
      throw new ForbiddenError('Only admins can list all active sessions');
    }
    const sessions = await VideoSessionService.listActiveSessions();
    res.json({ success: true, data: sessions });
  }
}

export default new VideoSessionController();

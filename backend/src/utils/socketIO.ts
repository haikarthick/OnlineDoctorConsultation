/**
 * Socket.io server setup — real-time events for the VetCare platform.
 *
 * Events emitted by the server:
 *   - notification          → new notification for a user
 *   - consultation:update   → status change on a consultation
 *   - chat:message          → new chat message in a video session
 *   - booking:update        → booking status change
 *
 * Events received from clients:
 *   - authenticate          → client sends JWT to join their user room
 *   - join:consultation     → join a consultation-specific room
 *   - leave:consultation    → leave a consultation room
 *   - chat:send             → send a message to a consultation room
 */

import { Server as HTTPServer } from 'http'
import { Server, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'
import config from '../config'
import logger from '../utils/logger'
import database from './database'

let io: Server | null = null

export function initSocketIO(httpServer: HTTPServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: config.cors.origin,
      credentials: true,
    },
    path: '/ws',
    transports: ['websocket', 'polling'],
  })

  io.on('connection', (socket: Socket) => {
    logger.info('Socket connected', { socketId: socket.id })

    // ── Authenticate: client must send a JWT to join their user room ──
    socket.on('authenticate', (token: string) => {
      try {
        const decoded = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] }) as any
        const userId = decoded.userId
        socket.join(`user:${userId}`)
        socket.join(`role:${decoded.role}`)
        socket.data.userId = userId
        socket.data.role = decoded.role
        socket.emit('authenticated', { userId })
        logger.info('Socket authenticated', { socketId: socket.id, userId })
      } catch {
        socket.emit('auth_error', { message: 'Invalid token' })
      }
    })

    // ── Join a consultation-specific room ────────────────────────────
    socket.on('join:consultation', async (consultationId: string) => {
      if (!socket.data.userId) {
        socket.emit('auth_error', { message: 'Authenticate first' })
        return
      }
      // Verify the socket user is a participant in this consultation (or admin)
      if (socket.data.role !== 'admin') {
        try {
          const check = await database.query(
            `SELECT 1 FROM consultations
             WHERE id = $1 AND (pet_owner_id = $2 OR veterinarian_id = $2)`,
            [consultationId, socket.data.userId]
          )
          if (!check.rows[0]) {
            socket.emit('auth_error', { message: 'You are not a participant in this consultation' })
            return
          }
        } catch {
          socket.emit('auth_error', { message: 'Unable to verify consultation access' })
          return
        }
      }
      socket.join(`consultation:${consultationId}`)
      logger.info('Socket joined consultation', { socketId: socket.id, consultationId })
    })

    socket.on('leave:consultation', (consultationId: string) => {
      socket.leave(`consultation:${consultationId}`)
    })

    // ── Real-time chat within a consultation ─────────────────────────
    socket.on('chat:send', (data: { consultationId: string; message: string; messageType?: string }) => {
      if (!socket.data.userId) {
        socket.emit('auth_error', { message: 'Authenticate first' })
        return
      }
      const payload = {
        senderId: socket.data.userId,
        message: data.message,
        messageType: data.messageType || 'text',
        timestamp: new Date().toISOString(),
      }
      io?.to(`consultation:${data.consultationId}`).emit('chat:message', payload)
    })

    socket.on('disconnect', (reason) => {
      logger.info('Socket disconnected', { socketId: socket.id, reason })
    })
  })

  logger.info('Socket.IO initialised', { path: '/ws' })
  return io
}

/** Get the singleton Server instance (useful from services that want to emit) */
export function getIO(): Server | null {
  return io
}

/** Emit a notification to a specific user */
export function emitToUser(userId: string, event: string, data: unknown): void {
  io?.to(`user:${userId}`).emit(event, data)
}

/** Emit to a consultation room */
export function emitToConsultation(consultationId: string, event: string, data: unknown): void {
  io?.to(`consultation:${consultationId}`).emit(event, data)
}

/** Emit a data:refresh event to a specific user */
export function emitDataRefresh(userId: string, type: string): void {
  io?.to(`user:${userId}`).emit('data:refresh', { type })
}

/** Emit a data:refresh event to all users with a specific role */
export function emitRoleRefresh(role: string, type: string): void {
  io?.to(`role:${role}`).emit('data:refresh', { type })
}

/** Emit a data:refresh event to all connected users (broadcast) */
export function emitBroadcastRefresh(type: string): void {
  io?.emit('data:refresh', { type })
}

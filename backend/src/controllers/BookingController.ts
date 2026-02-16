import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import BookingService from '../services/BookingService';
import { ForbiddenError, ValidationError } from '../utils/errors';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import database from '../utils/database';

// Helper: always log booking actions (not gated by feature flag)
async function logBookingAction(
  userId: string,
  userRole: string,
  action: string,
  bookingId: string,
  details?: Record<string, any>
): Promise<void> {
  try {
    const id = uuidv4();
    await database.query(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, created_at)
       VALUES ($1, $2, $3, 'booking', $4, $5, NOW())`,
      [id, userId, action, bookingId, details ? JSON.stringify({ ...details, role: userRole }) : JSON.stringify({ role: userRole })]
    );
  } catch (err) {
    logger.error('Action log failed', { err, action, bookingId });
  }
}

class BookingController {
  async createBooking(req: Request, res: Response) {
    const authReq = req as AuthRequest;
    const petOwnerId = authReq.userId!;

    const booking = await BookingService.createBooking(petOwnerId, req.body);

    await logBookingAction(petOwnerId, authReq.userRole || 'pet_owner', 'BOOKING_CREATED', booking.id, {
      scheduledDate: req.body.scheduledDate,
      timeSlotStart: req.body.timeSlotStart,
      timeSlotEnd: req.body.timeSlotEnd,
      veterinarianId: req.body.veterinarianId
    });

    res.status(201).json({ success: true, data: booking });
  }

  async getBooking(req: Request, res: Response) {
    const authReq = req as AuthRequest;
    const booking = await BookingService.getBooking(req.params.id);

    // Only allow access to own bookings or admin
    if (booking.petOwnerId !== authReq.userId && 
        booking.veterinarianId !== authReq.userId && 
        authReq.userRole !== 'admin') {
      throw new ForbiddenError('Not authorized to view this booking');
    }

    res.json({ success: true, data: booking });
  }

  async listBookings(req: Request, res: Response) {
    const authReq = req as AuthRequest;
    const params = {
      limit: parseInt(req.query.limit as string) || 10,
      offset: parseInt(req.query.offset as string) || 0,
      status: req.query.status as string
    };

    const result = await BookingService.listBookings(authReq.userId!, authReq.userRole!, params);
    res.json({ success: true, data: result });
  }

  async confirmBooking(req: Request, res: Response) {
    const authReq = req as AuthRequest;
    const booking = await BookingService.getBooking(req.params.id);

    // Only vet or admin can confirm
    if (booking.veterinarianId !== authReq.userId && authReq.userRole !== 'admin') {
      throw new ForbiddenError('Only the veterinarian or admin can confirm bookings');
    }

    const updated = await BookingService.confirmBooking(req.params.id);

    await logBookingAction(authReq.userId!, authReq.userRole || 'veterinarian', 'BOOKING_CONFIRMED', req.params.id, {
      confirmedBy: authReq.userId
    });

    res.json({ success: true, data: updated });
  }

  async cancelBooking(req: Request, res: Response) {
    const authReq = req as AuthRequest;
    const booking = await BookingService.getBooking(req.params.id);

    if (booking.petOwnerId !== authReq.userId && 
        booking.veterinarianId !== authReq.userId && 
        authReq.userRole !== 'admin') {
      throw new ForbiddenError('Not authorized to cancel this booking');
    }

    const reason = req.body.reason || 'No reason provided';
    const updated = await BookingService.cancelBooking(req.params.id, reason);

    await logBookingAction(authReq.userId!, authReq.userRole || 'unknown', 'BOOKING_CANCELLED', req.params.id, {
      reason,
      cancelledBy: authReq.userId
    });

    res.json({ success: true, data: updated });
  }

  async rescheduleBooking(req: Request, res: Response) {
    const authReq = req as AuthRequest;
    const booking = await BookingService.getBooking(req.params.id);

    if (booking.petOwnerId !== authReq.userId && 
        booking.veterinarianId !== authReq.userId && 
        authReq.userRole !== 'admin') {
      throw new ForbiddenError('Not authorized to reschedule this booking');
    }

    const { scheduledDate, timeSlotStart, timeSlotEnd } = req.body;
    if (!scheduledDate || !timeSlotStart || !timeSlotEnd) {
      throw new ValidationError('scheduledDate, timeSlotStart, and timeSlotEnd are required');
    }

    const updated = await BookingService.rescheduleBooking(req.params.id, scheduledDate, timeSlotStart, timeSlotEnd, authReq.userRole);

    await logBookingAction(authReq.userId!, authReq.userRole || 'unknown', 'BOOKING_RESCHEDULED', updated.id, {
      oldBookingId: req.params.id,
      newDate: scheduledDate,
      newTimeSlotStart: timeSlotStart,
      newTimeSlotEnd: timeSlotEnd,
      newStatus: updated.status,
      rescheduledBy: authReq.userId
    });

    res.json({ success: true, data: updated });
  }

  async getBookingActionLogs(req: Request, res: Response) {
    const authReq = req as AuthRequest;
    const bookingId = req.params.id;

    // Verify access: only participant or admin
    const booking = await BookingService.getBooking(bookingId);
    if (booking.petOwnerId !== authReq.userId &&
        booking.veterinarianId !== authReq.userId &&
        authReq.userRole !== 'admin') {
      throw new ForbiddenError('Not authorized to view action logs for this booking');
    }

    // Get all audit logs for this booking AND any linked rescheduled bookings
    const result = await database.query(
      `SELECT al.id, al.user_id as "userId", al.action, al.details, al.created_at as "createdAt",
              CONCAT(u.first_name, ' ', u.last_name) as "userName", u.role as "userRole"
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       WHERE al.entity_type = 'booking' AND al.entity_id = $1
       ORDER BY al.created_at ASC`,
      [bookingId]
    );

    res.json({ success: true, data: result.rows });
  }

  async getMyActionLogs(req: Request, res: Response) {
    const authReq = req as AuthRequest;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await database.query(
      `SELECT al.id, al.user_id as "userId", al.action, al.entity_id as "entityId",
              al.details, al.created_at as "createdAt",
              CONCAT(u.first_name, ' ', u.last_name) as "userName", u.role as "userRole"
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       WHERE al.entity_type = 'booking'
         AND al.entity_id IN (
           SELECT id FROM bookings WHERE pet_owner_id = $1 OR veterinarian_id = $1
         )
       ORDER BY al.created_at DESC
       LIMIT $2 OFFSET $3`,
      [authReq.userId, limit, offset]
    );

    res.json({ success: true, data: result.rows });
  }
}

export default new BookingController();

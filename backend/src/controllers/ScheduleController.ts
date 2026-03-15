import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import ScheduleService from '../services/ScheduleService';
import { ForbiddenError, ValidationError } from '../utils/errors';

class ScheduleController {
  async createSchedule(req: Request, res: Response) {
    const authReq = req as AuthRequest;
    if (authReq.userRole !== 'veterinarian' && authReq.userRole !== 'admin') {
      throw new ForbiddenError('Only veterinarians can manage schedules');
    }

    const vetId = req.body.veterinarianId || authReq.userId!;
    const schedule = await ScheduleService.createSchedule(vetId, req.body);
    res.status(201).json({ success: true, data: schedule });
  }

  async getSchedules(req: Request, res: Response) {
    const vetId = req.params.vetId || (req as AuthRequest).userId!;
    const schedules = await ScheduleService.getSchedules(vetId);
    res.json({ success: true, data: schedules });
  }

  async updateSchedule(req: Request, res: Response) {
    const authReq = req as AuthRequest;
    if (authReq.userRole !== 'veterinarian' && authReq.userRole !== 'admin') {
      throw new ForbiddenError('Only veterinarians can manage schedules');
    }

    const schedule = await ScheduleService.updateSchedule(req.params.id, authReq.userId!, req.body);
    res.json({ success: true, data: schedule });
  }

  async deleteSchedule(req: Request, res: Response) {
    const authReq = req as AuthRequest;
    if (authReq.userRole !== 'veterinarian' && authReq.userRole !== 'admin') {
      throw new ForbiddenError('Only veterinarians can manage schedules');
    }

    await ScheduleService.deleteSchedule(req.params.id, authReq.userId!);
    res.json({ success: true, message: 'Schedule deleted' });
  }

  async getAvailability(req: Request, res: Response) {
    const { vetId, date } = req.params;
    if (!date) throw new ValidationError('Date parameter is required (YYYY-MM-DD)');
    
    const availability = await ScheduleService.getAvailability(vetId, date);
    res.json({ success: true, data: availability });
  }

  // ── Date Overrides ────────────────────────────────────────
  async createDateOverride(req: Request, res: Response) {
    const authReq = req as AuthRequest;
    if (authReq.userRole !== 'veterinarian' && authReq.userRole !== 'admin') {
      throw new ForbiddenError('Only veterinarians can manage availability');
    }
    const vetId = req.body.veterinarianId || authReq.userId!;
    const override = await ScheduleService.createDateOverride(vetId, req.body, authReq.userId!);
    res.status(201).json({ success: true, data: override });
  }

  async bulkCreateDateOverrides(req: Request, res: Response) {
    const authReq = req as AuthRequest;
    if (authReq.userRole !== 'veterinarian' && authReq.userRole !== 'admin') {
      throw new ForbiddenError('Only veterinarians can manage availability');
    }
    const vetId = req.body.veterinarianId || authReq.userId!;
    const { dates, overrideType, startTime, endTime, slotDuration, reason } = req.body;
    const overrides = await ScheduleService.bulkCreateDateOverrides(
      vetId, dates, overrideType, { startTime, endTime, slotDuration, reason }, authReq.userId!);
    res.status(201).json({ success: true, data: overrides });
  }

  async listDateOverrides(req: Request, res: Response) {
    const authReq = req as AuthRequest;
    const vetId = req.params.vetId || authReq.userId!;
    const { fromDate, toDate } = req.query as any;
    const overrides = await ScheduleService.listDateOverrides(vetId, fromDate, toDate);
    res.json({ success: true, data: overrides });
  }

  async deleteDateOverride(req: Request, res: Response) {
    const authReq = req as AuthRequest;
    if (authReq.userRole !== 'veterinarian' && authReq.userRole !== 'admin') {
      throw new ForbiddenError('Only veterinarians can manage availability');
    }
    await ScheduleService.deleteDateOverride(req.params.id, authReq.userId!);
    res.json({ success: true, message: 'Date override deleted' });
  }

  // ── Blocked Slots ─────────────────────────────────────────
  async createBlockedSlot(req: Request, res: Response) {
    const authReq = req as AuthRequest;
    if (authReq.userRole !== 'veterinarian' && authReq.userRole !== 'admin') {
      throw new ForbiddenError('Only veterinarians can manage time blocks');
    }
    const vetId = req.body.veterinarianId || authReq.userId!;
    const block = await ScheduleService.createBlockedSlot(vetId, req.body);
    res.status(201).json({ success: true, data: block });
  }

  async listBlockedSlots(req: Request, res: Response) {
    const authReq = req as AuthRequest;
    const vetId = req.params.vetId || authReq.userId!;
    const blocks = await ScheduleService.listBlockedSlots(vetId);
    res.json({ success: true, data: blocks });
  }

  async deleteBlockedSlot(req: Request, res: Response) {
    const authReq = req as AuthRequest;
    if (authReq.userRole !== 'veterinarian' && authReq.userRole !== 'admin') {
      throw new ForbiddenError('Only veterinarians can manage time blocks');
    }
    await ScheduleService.deleteBlockedSlot(req.params.id, authReq.userId!);
    res.json({ success: true, message: 'Blocked slot deleted' });
  }

  // ── Hospital Holidays ─────────────────────────────────────
  async createHoliday(req: Request, res: Response) {
    const authReq = req as AuthRequest;
    if (authReq.userRole !== 'admin' && authReq.userRole !== 'veterinarian') {
      throw new ForbiddenError('Only admins can manage holidays');
    }
    const holiday = await ScheduleService.createHoliday(req.body, authReq.userId!);
    res.status(201).json({ success: true, data: holiday });
  }

  async listHolidays(req: Request, res: Response) {
    const { hospitalId, fromDate, toDate, year } = req.query as any;
    const holidays = await ScheduleService.listHolidays({
      hospitalId, fromDate, toDate, year: year ? Number(year) : undefined
    });
    res.json({ success: true, data: holidays });
  }

  async deleteHoliday(req: Request, res: Response) {
    const authReq = req as AuthRequest;
    if (authReq.userRole !== 'admin') {
      throw new ForbiddenError('Only admins can manage holidays');
    }
    await ScheduleService.deleteHoliday(req.params.id);
    res.json({ success: true, message: 'Holiday deleted' });
  }

  // ── Monthly Calendar Summary ──────────────────────────────
  async getMonthlyAvailability(req: Request, res: Response) {
    const vetId = req.params.vetId || (req as AuthRequest).userId!;
    const year = Number(req.query.year);
    const month = Number(req.query.month);
    if (!year || !month) throw new ValidationError('year and month query params are required');
    const summary = await ScheduleService.getMonthlyAvailabilitySummary(vetId, year, month);
    res.json({ success: true, data: summary });
  }
}

export default new ScheduleController();

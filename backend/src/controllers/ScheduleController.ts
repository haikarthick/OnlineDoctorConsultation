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
}

export default new ScheduleController();

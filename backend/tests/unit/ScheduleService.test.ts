import ScheduleService from '../../src/services/ScheduleService';
import database from '../../src/utils/database';
import { NotFoundError, ConflictError } from '../../src/utils/errors';

jest.mock('../../src/utils/database');

const mockSchedule = {
  id: 'sched-1',
  veterinarianId: 'vet-1',
  dayOfWeek: 'monday',
  startTime: '09:00',
  endTime: '17:00',
  slotDuration: 30,
  maxAppointments: 16,
  isAvailable: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockOverride = {
  id: 'ovr-1',
  veterinarianId: 'vet-1',
  overrideDate: '2099-06-15',
  overrideType: 'unavailable' as const,
  startTime: null,
  endTime: null,
  slotDuration: null,
  reason: 'Personal day',
  createdBy: 'vet-1',
  createdAt: new Date(),
};

const mockBlockedSlot = {
  id: 'block-1',
  veterinarianId: 'vet-1',
  blockDate: '2099-06-15',
  startTime: '12:00',
  endTime: '13:00',
  reason: 'Lunch break',
  isRecurring: false,
  recurringDay: null,
  createdAt: new Date(),
};

const mockHoliday = {
  id: 'hol-1',
  hospitalId: null,
  holidayDate: '2099-12-25',
  name: 'Christmas',
  holidayType: 'public',
  isFullDay: true,
  createdBy: 'admin-1',
  createdAt: new Date(),
};

describe('ScheduleService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Schedule CRUD ─────────────────────
  describe('createSchedule', () => {
    it('should create a schedule', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })              // check existing (no conflict)
        .mockResolvedValueOnce({ rows: [mockSchedule] }); // INSERT RETURNING

      const result = await ScheduleService.createSchedule('vet-1', {
        dayOfWeek: 'monday',
        startTime: '09:00',
        endTime: '17:00',
        slotDuration: 30,
      });

      expect(result).toBeDefined();
      expect(result.dayOfWeek).toBe('monday');
      expect(result.startTime).toBe('09:00');
    });
  });

  describe('getSchedules', () => {
    it('should return schedules for vet', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [mockSchedule] });

      const result = await ScheduleService.getSchedules('vet-1');
      expect(result).toHaveLength(1);
      expect(result[0].veterinarianId).toBe('vet-1');
    });

    it('should return empty array if no schedules', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });

      const result = await ScheduleService.getSchedules('vet-999');
      expect(result).toHaveLength(0);
    });
  });

  describe('updateSchedule', () => {
    it('should update schedule', async () => {
      const updated = { ...mockSchedule, startTime: '08:00' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [updated] });

      const result = await ScheduleService.updateSchedule('sched-1', 'vet-1', { startTime: '08:00' });
      expect(result.startTime).toBe('08:00');
    });

    it('should throw NotFoundError if schedule not found', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });

      await expect(
        ScheduleService.updateSchedule('non-existent', 'vet-1', { startTime: '08:00' })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('deleteSchedule', () => {
    it('should delete schedule', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'sched-1' }] });

      await expect(ScheduleService.deleteSchedule('sched-1', 'vet-1')).resolves.not.toThrow();
    });
  });

  // ─── Availability ─────────────────────
  describe('getAvailability', () => {
    it('should return availability for a date', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })                     // 1. holiday check
        .mockResolvedValueOnce({ rows: [] })                     // 2. override check
        .mockResolvedValueOnce({ rows: [{ startTime: '09:00', endTime: '17:00', slotDuration: 30 }] })  // 3. schedule
        .mockResolvedValueOnce({ rows: [] })                     // 4. blocked slots
        .mockResolvedValueOnce({ rows: [] })                     // 5. partial holidays
        .mockResolvedValueOnce({ rows: [] });                    // 6. existing bookings

      const result = await ScheduleService.getAvailability('vet-1', '2099-06-16'); // a Monday
      expect(result).toBeDefined();
    });
  });

  // ─── Date Overrides ─────────────────────
  describe('createDateOverride', () => {
    it('should create a date override', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockOverride] });

      const result = await ScheduleService.createDateOverride('vet-1', {
        overrideDate: '2099-06-15',
        overrideType: 'unavailable',
        reason: 'Personal day',
      }, 'vet-1');

      expect(result).toBeDefined();
      expect(result.overrideType).toBe('unavailable');
    });
  });

  describe('bulkCreateDateOverrides', () => {
    it('should create multiple date overrides', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ ...mockOverride, overrideDate: '2099-06-15' }] })
        .mockResolvedValueOnce({ rows: [{ ...mockOverride, id: 'ovr-2', overrideDate: '2099-06-16' }] });

      const result = await ScheduleService.bulkCreateDateOverrides(
        'vet-1', ['2099-06-15', '2099-06-16'], 'unavailable', {}, 'vet-1'
      );

      expect(result).toHaveLength(2);
    });
  });

  describe('listDateOverrides', () => {
    it('should list date overrides', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockOverride] });

      const result = await ScheduleService.listDateOverrides('vet-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('deleteDateOverride', () => {
    it('should delete date override', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'ovr-1' }] });

      await expect(ScheduleService.deleteDateOverride('ovr-1', 'vet-1')).resolves.not.toThrow();
    });
  });

  // ─── Blocked Slots ─────────────────────
  describe('createBlockedSlot', () => {
    it('should create a blocked slot', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockBlockedSlot] });

      const result = await ScheduleService.createBlockedSlot('vet-1', {
        blockDate: '2099-06-15',
        startTime: '12:00',
        endTime: '13:00',
        reason: 'Lunch break',
      });

      expect(result.reason).toBe('Lunch break');
    });
  });

  describe('listBlockedSlots', () => {
    it('should list blocked slots', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [mockBlockedSlot] });

      const result = await ScheduleService.listBlockedSlots('vet-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('deleteBlockedSlot', () => {
    it('should delete blocked slot', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'block-1' }] });

      await expect(ScheduleService.deleteBlockedSlot('block-1', 'vet-1')).resolves.not.toThrow();
    });
  });

  // ─── Holidays ─────────────────────
  describe('createHoliday', () => {
    it('should create a holiday', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [mockHoliday] });

      const result = await ScheduleService.createHoliday({
        holidayDate: '2099-12-25',
        name: 'Christmas',
        holidayType: 'public',
        isFullDay: true,
      }, 'admin-1');

      expect(result.name).toBe('Christmas');
    });
  });

  describe('listHolidays', () => {
    it('should list holidays', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [mockHoliday] });

      const result = await ScheduleService.listHolidays();
      expect(result).toHaveLength(1);
    });

    it('should filter by year', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [mockHoliday] });

      await ScheduleService.listHolidays({ year: 2099 });
      expect(database.query).toHaveBeenCalled();
    });
  });

  describe('deleteHoliday', () => {
    it('should delete a holiday', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'hol-1' }] });

      await expect(ScheduleService.deleteHoliday('hol-1')).resolves.not.toThrow();
    });
  });

  // ─── Monthly Summary ─────────────────────
  describe('getMonthlyAvailabilitySummary', () => {
    it('should return monthly availability summary', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })                     // listDateOverrides
        .mockResolvedValueOnce({ rows: [] })                     // listHolidays
        .mockResolvedValueOnce({ rows: [mockSchedule] });        // getSchedules

      const result = await ScheduleService.getMonthlyAvailabilitySummary('vet-1', 2099, 6);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});

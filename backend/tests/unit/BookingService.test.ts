import database from '../../src/utils/database';
import bookingService from '../../src/services/BookingService';

jest.mock('../../src/utils/database');
jest.mock('../../src/services/PaymentService', () => ({
  __esModule: true,
  default: { createPayment: jest.fn().mockResolvedValue({ id: 'pay1' }), getPaymentByBooking: jest.fn().mockResolvedValue(null), processRefund: jest.fn().mockResolvedValue({}) }
}));
jest.mock('../../src/services/WalletService', () => ({
  __esModule: true,
  default: { refund: jest.fn().mockResolvedValue({}) }
}));
jest.mock('../../src/services/NotificationService', () => ({
  __esModule: true,
  default: { createNotification: jest.fn().mockResolvedValue({}) }
}));

describe('BookingService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('createBooking', () => {
    it('should create a booking', async () => {
      const booking = { id: 'b1', petOwnerId: 'u1', veterinarianId: 'v1', status: 'pending' };
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })         // conflict check
        .mockResolvedValueOnce({ rows: [booking] }); // INSERT RETURNING
      const result = await bookingService.createBooking('u1', {
        veterinarianId: 'v1',
        animalId: 'a1',
        scheduledDate: '2099-01-15',
        timeSlotStart: '10:00',
        timeSlotEnd: '10:30',
        bookingType: 'video_call',
        reasonForVisit: 'Checkup'
      });
      expect(result).toBeDefined();
      expect(result).toHaveProperty('id');
    });
  });

  describe('getBooking', () => {
    it('should get a booking by id', async () => {
      const booking = { id: 'b1', status: 'pending' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [booking] });
      const result = await bookingService.getBooking('b1');
      expect(result).toEqual(booking);
    });

    it('should throw if booking not found', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      await expect(bookingService.getBooking('nonexistent')).rejects.toThrow();
    });
  });

  describe('listBookings', () => {
    it('should list bookings for a pet owner', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })   // markMissedBookings confirmed
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })   // markMissedBookings pending
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })  // COUNT
        .mockResolvedValueOnce({ rows: [{ id: 'b1' }] });   // SELECT
      const result = await bookingService.listBookings('u1', 'pet_owner', { limit: 20, offset: 0 });
      expect(result.items).toBeDefined();
      expect(result.total).toBeDefined();
    });

    it('should list bookings for a veterinarian', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })   // markMissedBookings confirmed
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })   // markMissedBookings pending
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })  // COUNT
        .mockResolvedValueOnce({ rows: [{ id: 'b1' }] });   // SELECT
      const result = await bookingService.listBookings('v1', 'veterinarian', { limit: 20, offset: 0 });
      expect(result.items).toBeDefined();
    });
  });

  describe('updateBookingStatus', () => {
    it('should update booking status', async () => {
      const updated = { id: 'b1', status: 'confirmed' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [updated] });
      const result = await bookingService.updateBookingStatus('b1', 'confirmed' as any);
      expect(result).toEqual(updated);
    });
  });

  describe('confirmBooking', () => {
    it('should confirm a booking', async () => {
      const futureBooking = { id: 'b1', status: 'pending', scheduledDate: '2099-12-31', timeSlotEnd: '23:59' };
      const confirmed = { id: 'b1', status: 'confirmed' };
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [futureBooking] })  // getBooking
        .mockResolvedValueOnce({ rows: [confirmed] });     // updateBookingStatus UPDATE
      const result = await bookingService.confirmBooking('b1');
      expect(result).toBeDefined();
    });
  });

  describe('cancelBooking', () => {
    it('should cancel a booking', async () => {
      const booking = { id: 'b1', status: 'pending', petOwnerId: 'u1', veterinarianId: 'v1' };
      const cancelled = { id: 'b1', status: 'cancelled', petOwnerId: 'u1', veterinarianId: 'v1' };
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [booking] })      // getBooking
        .mockResolvedValueOnce({ rows: [cancelled] });    // UPDATE
      const result = await bookingService.cancelBooking('b1', 'Changed plans', 'u1', 'pet_owner');
      expect(result).toBeDefined();
    });
  });

  describe('markMissedBookings', () => {
    it('should mark missed bookings', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 2 });
      const result = await bookingService.markMissedBookings();
      expect(typeof result).toBe('number');
    });
  });

  describe('listHospitalBookings', () => {
    it('should list bookings for a hospital', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })   // markMissedBookings confirmed
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })   // markMissedBookings pending
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })  // COUNT
        .mockResolvedValueOnce({ rows: [{ id: 'b1' }] });   // SELECT
      const result = await bookingService.listHospitalBookings('h1', { limit: 20, offset: 0 });
      expect(result.items).toBeDefined();
      expect(result.total).toBe(1);
    });
  });

  describe('getDoctorCancellationStats', () => {
    it('should return cancellation statistics', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })   // total cancellations
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })   // month cancellations
        .mockResolvedValueOnce({ rows: [{ count: '20' }] })  // total bookings
        .mockResolvedValueOnce({ rows: [{ value: '3' }] });  // getSetting maxCancellations
      const result = await bookingService.getDoctorCancellationStats('v1');
      expect(result).toBeDefined();
      expect(result).toHaveProperty('totalCancellations');
      expect(result).toHaveProperty('reliabilityScore');
    });
  });
});

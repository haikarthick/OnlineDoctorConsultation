import emailService from '../../src/services/EmailService';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
    verify: jest.fn().mockResolvedValue(true)
  }),
  createTestAccount: jest.fn().mockResolvedValue({
    user: 'test@ethereal.email',
    pass: 'testpass',
    smtp: { host: 'smtp.ethereal.email', port: 587, secure: false }
  }),
  getTestMessageUrl: jest.fn().mockReturnValue('https://ethereal.email/message/test')
}));

describe('EmailService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('send', () => {
    it('should send an email', async () => {
      const result = await emailService.send({
        to: 'user@example.com',
        subject: 'Test Email',
        html: '<p>Hello</p>'
      });
      expect(result).toBeDefined();
      expect(result.messageId).toBeDefined();
    });
  });

  describe('sendWelcome', () => {
    it('should send a welcome email', async () => {
      await emailService.sendWelcome('user@example.com', {
        firstName: 'John',
        email: 'user@example.com',
        role: 'pet_owner'
      });
      // Should not throw
    });
  });

  describe('sendConsultationBooked', () => {
    it('should send consultation booked email', async () => {
      await emailService.sendConsultationBooked('user@example.com', {
        petOwnerName: 'John',
        vetName: 'Dr. Smith',
        date: '2024-06-15',
        time: '10:00 AM'
      });
    });
  });

  describe('sendConsultationCompleted', () => {
    it('should send consultation completed email', async () => {
      await emailService.sendConsultationCompleted('user@example.com', {
        petOwnerName: 'John',
        vetName: 'Dr. Smith',
        diagnosis: 'Healthy',
        date: '2024-06-15'
      });
    });
  });

  describe('sendPasswordReset', () => {
    it('should send password reset email', async () => {
      await emailService.sendPasswordReset('user@example.com', {
        firstName: 'John',
        resetUrl: 'https://example.com/reset/token123'
      });
    });
  });

  describe('sendPaymentReceipt', () => {
    it('should send payment receipt email', async () => {
      await emailService.sendPaymentReceipt('user@example.com', {
        ownerName: 'John',
        amount: 50.00,
        currency: 'USD',
        description: 'Consultation fee',
        date: '2024-06-15'
      });
    });
  });
});

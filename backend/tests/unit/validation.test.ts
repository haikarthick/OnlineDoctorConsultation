/**
 * Joi validation schema tests — pure unit tests, no mocks required.
 */
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  logoutSchema,
  createConsultationSchema,
  updateConsultationSchema,
  createBookingSchema,
  rescheduleBookingSchema,
  createAnimalSchema,
  createPrescriptionSchema,
  createReviewSchema,
} from '../../src/middleware/validation'

describe('Validation Schemas', () => {
  // ─── Register ─────────────────────────────────────────────
  describe('registerSchema', () => {
    const valid = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '+919876543210',
      password: 'Passw0rd',
      role: 'pet_owner',
    }

    it('accepts valid data', () => {
      const { error } = registerSchema.validate(valid)
      expect(error).toBeUndefined()
    })

    it('rejects missing email', () => {
      const { error } = registerSchema.validate({ ...valid, email: undefined })
      expect(error).toBeDefined()
    })

    it('rejects password without digit', () => {
      const { error } = registerSchema.validate({ ...valid, password: 'NoDigits' })
      expect(error).toBeDefined()
    })

    it('rejects password shorter than 8 characters', () => {
      const { error } = registerSchema.validate({ ...valid, password: 'Ab1' })
      expect(error).toBeDefined()
    })

    it('rejects invalid role', () => {
      const { error } = registerSchema.validate({ ...valid, role: 'hacker' })
      expect(error).toBeDefined()
    })

    it('accepts email with valid format', () => {
      const { error } = registerSchema.validate({ ...valid, email: 'valid@domain.co' })
      expect(error).toBeUndefined()
    })
  })

  // ─── Login ────────────────────────────────────────────────
  describe('loginSchema', () => {
    it('accepts valid credentials', () => {
      const { error } = loginSchema.validate({ email: 'a@b.com', password: 'secret123' })
      expect(error).toBeUndefined()
    })

    it('rejects missing password', () => {
      const { error } = loginSchema.validate({ email: 'a@b.com' })
      expect(error).toBeDefined()
    })
  })

  // ─── Refresh / Logout tokens ──────────────────────────────
  describe('refreshTokenSchema', () => {
    it('requires refreshToken string', () => {
      const { error } = refreshTokenSchema.validate({})
      expect(error).toBeDefined()
    })

    it('accepts valid token', () => {
      const { error } = refreshTokenSchema.validate({ refreshToken: 'abc123' })
      expect(error).toBeUndefined()
    })
  })

  describe('logoutSchema', () => {
    it('requires refreshToken', () => {
      const { error } = logoutSchema.validate({})
      expect(error).toBeDefined()
    })
  })

  // ─── Consultation ─────────────────────────────────────────
  describe('createConsultationSchema', () => {
    const valid = {
      veterinarianId: '550e8400-e29b-41d4-a716-446655440000',
      animalType: 'Dog',
      symptomDescription: 'My dog has been limping for three days.',
    }

    it('accepts valid consultation', () => {
      const { error } = createConsultationSchema.validate(valid)
      expect(error).toBeUndefined()
    })

    it('rejects non-uuid veterinarianId', () => {
      const { error } = createConsultationSchema.validate({ ...valid, veterinarianId: 'not-a-uuid' })
      expect(error).toBeDefined()
    })

    it('rejects short symptom description', () => {
      const { error } = createConsultationSchema.validate({ ...valid, symptomDescription: 'short' })
      expect(error).toBeDefined()
    })
  })

  describe('updateConsultationSchema', () => {
    it('requires at least one field', () => {
      const { error } = updateConsultationSchema.validate({})
      expect(error).toBeDefined()
    })

    it('accepts valid status', () => {
      const { error } = updateConsultationSchema.validate({ status: 'completed' })
      expect(error).toBeUndefined()
    })

    it('rejects invalid status enum', () => {
      const { error } = updateConsultationSchema.validate({ status: 'invalid_status' })
      expect(error).toBeDefined()
    })
  })

  // ─── Booking ──────────────────────────────────────────────
  describe('createBookingSchema', () => {
    const valid = {
      veterinarianId: '550e8400-e29b-41d4-a716-446655440000',
      scheduledDate: '2025-12-01',
      timeSlotStart: '09:00',
      timeSlotEnd: '09:30',
      bookingType: 'video_call',
      reasonForVisit: 'Annual checkup',
    }

    it('accepts valid booking', () => {
      const { error } = createBookingSchema.validate(valid)
      expect(error).toBeUndefined()
    })

    it('rejects missing scheduledDate', () => {
      const { error } = createBookingSchema.validate({ ...valid, scheduledDate: undefined })
      expect(error).toBeDefined()
    })
  })

  describe('rescheduleBookingSchema', () => {
    it('accepts valid reschedule', () => {
      const { error } = rescheduleBookingSchema.validate({ scheduledDate: '2025-12-01', timeSlotStart: '10:00', timeSlotEnd: '10:30' })
      expect(error).toBeUndefined()
    })
  })

  // ─── Animal ───────────────────────────────────────────────
  describe('createAnimalSchema', () => {
    it('accepts minimal animal data', () => {
      const { error } = createAnimalSchema.validate({ name: 'Buddy', species: 'Dog' })
      expect(error).toBeUndefined()
    })

    it('rejects missing name', () => {
      const { error } = createAnimalSchema.validate({ species: 'Cat' })
      expect(error).toBeDefined()
    })

    it('rejects missing species', () => {
      const { error } = createAnimalSchema.validate({ name: 'Luna' })
      expect(error).toBeDefined()
    })
  })

  // ─── Prescription ─────────────────────────────────────────
  describe('createPrescriptionSchema', () => {
    const valid = {
      consultationId: '550e8400-e29b-41d4-a716-446655440000',
      medications: [{ name: 'Amoxicillin', dosage: '250mg', frequency: 'Twice daily', duration: '7 days' }],
      instructions: 'Take with food',
    }

    it('accepts valid prescription', () => {
      const { error } = createPrescriptionSchema.validate(valid)
      expect(error).toBeUndefined()
    })

    it('rejects empty medications array', () => {
      const { error } = createPrescriptionSchema.validate({ ...valid, medications: [] })
      expect(error).toBeDefined()
    })
  })

  // ─── Review ───────────────────────────────────────────────
  describe('createReviewSchema', () => {
    const valid = {
      consultationId: '550e8400-e29b-41d4-a716-446655440000',
      veterinarianId: '550e8400-e29b-41d4-a716-446655440001',
      rating: 5,
    }

    it('accepts valid review', () => {
      const { error } = createReviewSchema.validate(valid)
      expect(error).toBeUndefined()
    })

    it('rejects rating below 1', () => {
      const { error } = createReviewSchema.validate({ ...valid, rating: 0 })
      expect(error).toBeDefined()
    })

    it('rejects rating above 5', () => {
      const { error } = createReviewSchema.validate({ ...valid, rating: 6 })
      expect(error).toBeDefined()
    })
  })
})

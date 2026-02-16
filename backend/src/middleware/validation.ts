import Joi from 'joi';

export const registerSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .max(255)
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
  firstName: Joi.string()
    .min(2)
    .max(100)
    .required()
    .pattern(/^[a-zA-Z\s'-]+$/)
    .messages({
      'string.min': 'First name must be at least 2 characters',
      'string.pattern.base': 'First name can only contain letters, spaces, hyphens, and apostrophes',
      'any.required': 'First name is required',
    }),
  lastName: Joi.string()
    .min(2)
    .max(100)
    .required()
    .pattern(/^[a-zA-Z\s'-]+$/)
    .messages({
      'string.min': 'Last name must be at least 2 characters',
      'any.required': 'Last name is required',
    }),
  phone: Joi.string()
    .required()
    .pattern(/^\+?[\d\s()-]{7,20}$/)
    .messages({
      'string.pattern.base': 'Please provide a valid phone number',
      'any.required': 'Phone number is required',
    }),
  password: Joi.string()
    .min(8)
    .max(128)
    .required()
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .messages({
      'string.min': 'Password must be at least 8 characters',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
      'any.required': 'Password is required',
    }),
  role: Joi.string()
    .valid('pet_owner', 'farmer', 'veterinarian')
    .default('pet_owner')
    .messages({
      'any.only': 'Role must be one of: pet_owner, farmer, veterinarian',
    }),
  confirmPassword: Joi.string().optional().strip(),
});

export const loginSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Password is required',
    }),
});

export const createConsultationSchema = Joi.object({
  veterinarianId: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Veterinarian ID must be a valid UUID',
      'any.required': 'Veterinarian ID is required',
    }),
  animalType: Joi.string()
    .min(2)
    .max(100)
    .required()
    .messages({
      'any.required': 'Animal type is required',
    }),
  symptomDescription: Joi.string()
    .min(10)
    .max(2000)
    .required()
    .messages({
      'string.min': 'Symptom description must be at least 10 characters',
      'any.required': 'Symptom description is required',
    }),
  scheduledAt: Joi.date()
    .iso()
    .min('now')
    .optional()
    .messages({
      'date.min': 'Scheduled date must be in the future',
    }),
  animalId: Joi.string().uuid().optional().allow(null),
  bookingId: Joi.string().uuid().optional().allow(null),
  petOwnerId: Joi.string().uuid().optional().allow(null),
});

export const updateConsultationSchema = Joi.object({
  status: Joi.string()
    .valid('scheduled', 'in_progress', 'completed', 'cancelled')
    .optional(),
  diagnosis: Joi.string()
    .max(5000)
    .allow('', null)
    .optional(),
  prescription: Joi.string()
    .max(5000)
    .optional(),
  notes: Joi.string()
    .max(10000)
    .allow('', null)
    .optional(),
  duration: Joi.number()
    .integer()
    .min(0)
    .optional(),
  animalId: Joi.string()
    .uuid()
    .allow(null)
    .optional(),
  startedAt: Joi.date()
    .iso()
    .optional(),
  completedAt: Joi.date()
    .iso()
    .optional(),
}).min(1).messages({
  'object.min': 'At least one field must be provided for update',
});

export const paginationSchema = Joi.object({
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(10),
  offset: Joi.number()
    .integer()
    .min(0)
    .default(0),
});

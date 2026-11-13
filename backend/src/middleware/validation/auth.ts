import Joi from 'joi';

// ─── Auth ────────────────────────────────────────────────────
export const registerSchema = Joi.object({
  email: Joi.string().email().required().max(255).messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  }),
  firstName: Joi.string().min(2).max(100).required().pattern(/^[a-zA-Z\s'-]+$/).messages({
    'string.min': 'First name must be at least 2 characters',
    'string.pattern.base': 'First name can only contain letters, spaces, hyphens, and apostrophes',
    'any.required': 'First name is required',
  }),
  lastName: Joi.string().min(2).max(100).required().pattern(/^[a-zA-Z\s'-]+$/).messages({
    'string.min': 'Last name must be at least 2 characters',
    'any.required': 'Last name is required',
  }),
  phone: Joi.string().required().pattern(/^\+?[\d\s()-]{7,20}$/).messages({
    'string.pattern.base': 'Please provide a valid phone number',
    'any.required': 'Phone number is required',
  }),
  password: Joi.string().min(8).max(128).required().pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).messages({
    'string.min': 'Password must be at least 8 characters',
    'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
    'any.required': 'Password is required',
  }),
  role: Joi.string().valid('pet_owner', 'farmer', 'veterinarian', 'corporate_admin', 'groomer').default('pet_owner').messages({
    'any.only': 'Role must be one of: pet_owner, farmer, veterinarian, corporate_admin, groomer',
  }),
  confirmPassword: Joi.string().optional().strip(),
  // Veterinarian-specific fields (required when role = 'veterinarian')
  licenseNumber: Joi.when('role', {
    is: 'veterinarian',
    then: Joi.string().min(3).max(100).required().messages({
      'any.required': 'License number is required for veterinarian registration',
      'string.min': 'License number must be at least 3 characters',
    }),
    otherwise: Joi.string().optional().allow('').strip(),
  }),
  yearsOfExperience: Joi.when('role', {
    is: 'veterinarian',
    then: Joi.number().integer().min(0).max(60).optional(),
    otherwise: Joi.any().strip(),
  }),
  specializations: Joi.when('role', {
    is: 'veterinarian',
    then: Joi.array().items(Joi.string().max(100)).max(10).optional().default([]),
    otherwise: Joi.any().strip(),
  }),
  qualifications: Joi.when('role', {
    is: 'veterinarian',
    then: Joi.array().items(Joi.string().max(100)).max(10).optional().default([]),
    otherwise: Joi.any().strip(),
  }),
  clinicName: Joi.when('role', {
    is: 'veterinarian',
    then: Joi.string().max(255).optional().allow(''),
    otherwise: Joi.any().strip(),
  }),
  consultationFee: Joi.when('role', {
    is: 'veterinarian',
    then: Joi.number().min(0).optional().default(0),
    otherwise: Joi.any().strip(),
  }),
  // §17.2: registration is blocked until policies are acknowledged
  acceptTerms: Joi.boolean().valid(true).required().messages({
    'any.only': 'You must accept the Terms of Service and Privacy Policy to register',
    'any.required': 'You must accept the Terms of Service and Privacy Policy to register',
  }),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  }),
  password: Joi.string().required().messages({ 'any.required': 'Password is required' }),
});

export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().messages({ 'any.required': 'Refresh token is required' }),
});

export const logoutSchema = Joi.object({
  refreshToken: Joi.string().required().messages({ 'any.required': 'Refresh token is required' }),
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required().max(255).lowercase().trim().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  }),
});

export const resetPasswordSchema = Joi.object({
  token: Joi.string().length(64).hex().required().messages({
    'string.length': 'Invalid or malformed reset token',
    'string.hex': 'Invalid or malformed reset token',
    'any.required': 'Reset token is required',
  }),
  newPassword: Joi.string().min(8).max(128).required()
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .messages({
      'string.min': 'Password must be at least 8 characters',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
      'any.required': 'New password is required',
    }),
});


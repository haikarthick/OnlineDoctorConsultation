import Joi from 'joi';
import { shortText, positiveInt, positiveNumber } from './core';

// ─── Admin ───────────────────────────────────────────────────
export const toggleUserStatusSchema = Joi.object({
  isActive: Joi.boolean().required(),
});

// Vet details captured when a user takes the veterinarian role - used both by the self-serve
// role-change request (licenseNumber required there) and the admin direct role change
// (licenseNumber optional there). Provisions/updates the vet_profiles satellite row.
export const roleChangeVetProfileSchema = Joi.object({
  licenseNumber: shortText(100).required(),
  specializations: Joi.array().items(Joi.string().max(100)).optional(),
  qualifications: Joi.array().items(Joi.string().max(200)).optional(),
  yearsOfExperience: positiveInt.max(80).optional(),
  consultationFee: positiveNumber.max(100000).optional(),
  clinicName: shortText().optional().allow('', null),
});

export const changeUserRoleSchema = Joi.object({
  role: Joi.string().valid('pet_owner', 'farmer', 'veterinarian', 'admin', 'corporate_admin', 'groomer', 'support').required(),
  // Optional vet details when an admin directly assigns the veterinarian role. If a license
  // is supplied the resulting vet_profiles row is marked verified; otherwise it is provisioned
  // unverified-but-visible so the vet can complete their license later. Stripped for non-vet roles.
  profile: Joi.when('role', {
    is: 'veterinarian',
    then: roleChangeVetProfileSchema.fork(['licenseNumber'], (s) => s.optional()).optional(),
    otherwise: Joi.object().strip(),
  }),
});

export const processRefundSchema = Joi.object({
  amount: Joi.number().positive().required(),
  reason: shortText(500).required(),
});

export const moderateReviewSchema = Joi.object({
  action: Joi.string().valid('approve', 'hide', 'remove', 'flag', 'unflag').required(),
});

export const updateSystemSettingSchema = Joi.object({
  key: Joi.string().max(100).required(),
  value: Joi.any().required(),
});

export const updatePermissionSchema = Joi.object({
  role: Joi.string().required(),
  permission: Joi.string().required(),
  isEnabled: Joi.boolean().required(),
});

export const bulkUpdatePermissionsSchema = Joi.object({
  role: Joi.string().required(),
  permissions: Joi.object().required(),
});

export const resetPermissionsSchema = Joi.object({
  role: Joi.string().required(),
});

export const updateNetworkRolePermissionSchema = Joi.object({
  networkId: Joi.string().uuid().required(),
  networkRole: Joi.string().required(),
  action: Joi.string().required(),
  isEnabled: Joi.boolean().required(),
});

export const resetNetworkRolePermissionsSchema = Joi.object({
  networkId: Joi.string().uuid().required(),
  networkRole: Joi.string().optional(),
});


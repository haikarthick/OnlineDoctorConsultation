// Barrel: every existing `import { xSchema } from '../middleware/validation'` keeps working
// unchanged. The schemas live in validation/<module>.ts now (split 2026-11-13 - this was a
// single ~2,100-line file, unmanageable for a small addition). Add a new schema to the module
// file matching the route it validates; add a new module file (and export it here) for a
// genuinely new module rather than growing an existing file.
export * from './validation/core';
export * from './validation/auth';
export * from './validation/consultations';
export * from './validation/medicalRecords';
export * from './validation/payments';
export * from './validation/admin';
export * from './validation/enterprise';
export * from './validation/tier3';
export * from './validation/automation';
export * from './validation/marketplace';
export * from './validation/clientPortal';
export * from './validation/hospital';
export * from './validation/hospitalNetwork';
export * from './validation/masterData';
export * from './validation/grooming';

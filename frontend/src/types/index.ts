// Barrel: every existing `import { X } from '../types'` (or '../../types', etc.) keeps working
// unchanged. The types themselves live in these per-module files now (split 2026-11-13 - this
// was a single ~1,900-line file, unmanageable for a small addition). Add a new type to the
// module file it belongs with; add a new module file (and export it here) for a genuinely new
// module rather than growing an existing file.
export * from './core'
export * from './consultations'
export * from './medicalRecords'
export * from './vetProfile'
export * from './animals'
export * from './enterprise'
export * from './common'
export * from './analytics'
export * from './automation'
export * from './marketplace'
export * from './clientPortal'
export * from './hospital'

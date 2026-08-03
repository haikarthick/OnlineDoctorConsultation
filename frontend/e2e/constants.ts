/**
 * VetCare E2E - Test constants & demo credentials
 *
 * ⚠ SOURCE OF TRUTH: `backend/src/utils/fixDemoPasswords.ts` - but only because of WHEN it runs.
 *
 * Seeding a database is a two-step story and the order is what matters:
 *   1. fixDemoPasswords ensures the demo users exist, then applies docker/seed-demo-data.sql,
 *      whose INSERTs carry their OWN bcrypt hashes (Doctor@123 / Owner@123 / Farmer@123).
 *   2. When the seed finishes it re-hashes every demo user back to the passwords listed in
 *      fixDemoPasswords.ts (fixDemoPasswords.ts:308-312, "Fix passwords again after seed").
 *
 * So mid-seed the seed's own passwords work, and once seeding COMPLETES `Demo@123` wins. The
 * settled state is the one that matters - and it is `Demo@123` for everyone except admin.
 * Reading only the SQL hashes gives the wrong answer; that mid-seed race cost a diagnostic
 * cycle here. To change a demo password, change fixDemoPasswords.ts.
 *
 * Three EMAILS here were also wrong - these accounts have never existed at all:
 *     dr.sarah.bennett@vetcare.com   → really sarah.johnson@example.com
 *     emily.davis@email.com          → really emily.davis@example.com
 *     john.miller@greenpastures.com  → really tom.wilson@example.com
 * Every fixture built on them failed to log in, so those specs failed on a login timeout rather
 * than on anything they meant to test.
 *
 * Now guarded by PHASE 6b of the runtime gate, which waits for seeding to COMPLETE and then logs
 * in as every account listed here - so this file cannot silently drift again.
 */

export const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173'

// ── Demo Credentials (post-seed settled state; see header) ────
export const USERS = {
  admin: { email: 'admin@vetcare.com', password: 'Admin@123', role: 'admin' as const },
  vet1:  { email: 'dr.james.carter@vetcare.com', password: 'Demo@123', role: 'veterinarian' as const },
  vet2:  { email: 'sarah.johnson@example.com', password: 'Demo@123', role: 'veterinarian' as const },
  vet3:  { email: 'dr.michael.reyes@vetcare.com', password: 'Demo@123', role: 'veterinarian' as const },
  petOwner1: { email: 'emily.davis@example.com', password: 'Demo@123', role: 'pet_owner' as const },
  petOwner2: { email: 'robert.chen@email.com', password: 'Demo@123', role: 'pet_owner' as const },
  farmer1: { email: 'tom.wilson@example.com', password: 'Demo@123', role: 'farmer' as const },
  farmer2: { email: 'maria.garcia@sunrisefarm.com', password: 'Demo@123', role: 'farmer' as const },
} as const

export type UserKey = keyof typeof USERS
export type UserRole = 'admin' | 'veterinarian' | 'pet_owner' | 'farmer'

// ── Storage state file paths (written by global-setup) ──────
export const AUTH_STATE_DIR = 'e2e/.auth'
export function authStatePath(userKey: UserKey): string {
  return `${AUTH_STATE_DIR}/${userKey}.json`
}

// ── Route → Allowed Roles mapping (derived from App.tsx) ────
export const ROUTE_ROLES: Record<string, UserRole[]> = {
  '/dashboard':               ['admin', 'veterinarian', 'pet_owner', 'farmer'],
  '/consultations':           ['admin', 'veterinarian', 'pet_owner', 'farmer'],
  '/medical-records':         ['admin', 'veterinarian', 'pet_owner', 'farmer'],
  '/animals':                 ['pet_owner', 'farmer'],
  '/animal-timeline':         ['pet_owner', 'farmer', 'veterinarian', 'admin'],
  '/settings':                ['veterinarian', 'pet_owner', 'farmer'],
  '/find-doctor':             ['pet_owner', 'farmer'],
  '/book-consultation':       ['pet_owner', 'farmer'],
  '/write-review':            ['pet_owner', 'farmer'],
  '/prescriptions':           ['pet_owner', 'farmer'],
  '/doctor/manage-schedule':  ['veterinarian'],
  '/doctor/prescriptions':    ['veterinarian'],
  '/doctor/reviews':          ['veterinarian'],
  '/enterprises':             ['farmer', 'admin'],
  '/animal-groups':           ['farmer', 'admin'],
  '/locations':               ['farmer', 'admin'],
  '/movement-log':            ['farmer', 'admin'],
  '/campaigns':               ['farmer', 'admin', 'veterinarian'],
  '/herd-medical':            ['farmer', 'admin', 'veterinarian'],
  '/health-analytics':        ['farmer', 'admin', 'veterinarian'],
  '/breeding':                ['farmer', 'admin'],
  '/feed-inventory':          ['farmer', 'admin'],
  '/compliance':              ['farmer', 'admin'],
  '/financial':               ['farmer', 'admin'],
  '/alerts':                  ['farmer', 'admin', 'veterinarian'],
  '/disease-prediction':      ['farmer', 'admin', 'veterinarian'],
  '/genomic-lineage':         ['farmer', 'admin'],
  '/iot-sensors':             ['farmer', 'admin'],
  '/supply-chain':            ['farmer', 'admin'],
  '/workforce':               ['farmer', 'admin'],
  '/report-builder':          ['farmer', 'admin', 'veterinarian'],
  '/ai-copilot':              ['admin', 'veterinarian', 'pet_owner', 'farmer'],
  '/digital-twin':            ['farmer', 'admin'],
  '/marketplace':             ['admin', 'veterinarian', 'pet_owner', 'farmer'],
  '/sustainability':          ['farmer', 'admin'],
  '/wellness':                ['admin', 'veterinarian', 'pet_owner', 'farmer'],
  '/geospatial':              ['farmer', 'admin'],
  '/vet-hospitals':           ['admin', 'veterinarian', 'pet_owner', 'farmer'],
  '/vet-hospitals/manage':    ['veterinarian'],
  '/hospital-workflow':       ['veterinarian', 'admin'],
  '/inpatient':               ['veterinarian', 'admin'],
  '/wallet':                  ['admin', 'veterinarian', 'pet_owner', 'farmer'],
  '/admin/dashboard':         ['admin'],
  '/admin/users':             ['admin'],
  '/admin/consultations':     ['admin'],
  '/admin/payments':          ['admin'],
  '/admin/reviews':           ['admin'],
  '/admin/settings':          ['admin'],
  '/admin/audit-logs':        ['admin'],
  '/admin/permissions':       ['admin'],
  '/admin/medical-records':   ['admin'],
  '/admin/vet-hospitals':     ['admin'],
  '/admin/compliance':        ['admin'],
  '/admin/staff-settings':    ['admin'],
  '/admin/cancellation-dashboard': ['admin'],
  '/admin/holidays':          ['admin', 'veterinarian'],
}

// ── Navigation Menu Items (from Navigation.tsx) ─────────────
export interface NavItem {
  id: string
  path: string
  roles: UserRole[]
  section: string
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', path: '/dashboard', roles: ['veterinarian', 'pet_owner', 'farmer', 'admin'], section: 'Main' },
  { id: 'consultations', path: '/consultations', roles: ['veterinarian', 'pet_owner', 'farmer', 'admin'], section: 'Consultations' },
  { id: 'find-doctor', path: '/find-doctor', roles: ['pet_owner', 'farmer'], section: 'Consultations' },
  { id: 'book-consultation', path: '/book-consultation', roles: ['pet_owner', 'farmer'], section: 'Consultations' },
  { id: 'manage-schedule', path: '/doctor/manage-schedule', roles: ['veterinarian'], section: 'Consultations' },
  { id: 'animals', path: '/animals', roles: ['pet_owner', 'farmer'], section: 'Animals & Health' },
  { id: 'medical', path: '/medical-records', roles: ['veterinarian', 'pet_owner', 'farmer'], section: 'Animals & Health' },
  { id: 'write-review', path: '/write-review', roles: ['pet_owner', 'farmer'], section: 'Animals & Health' },
  { id: 'my-reviews', path: '/doctor/reviews', roles: ['veterinarian'], section: 'Animals & Health' },
  { id: 'enterprises', path: '/enterprises', roles: ['farmer', 'admin'], section: 'Farm Management' },
  { id: 'animal-groups', path: '/animal-groups', roles: ['farmer', 'admin'], section: 'Farm Management' },
  { id: 'herd-medical', path: '/herd-medical', roles: ['farmer', 'admin', 'veterinarian'], section: 'Farm Management' },
  { id: 'locations', path: '/locations', roles: ['farmer', 'admin'], section: 'Farm Management' },
  { id: 'movement-log', path: '/movement-log', roles: ['farmer', 'admin'], section: 'Farm Management' },
  { id: 'campaigns', path: '/campaigns', roles: ['farmer', 'admin', 'veterinarian'], section: 'Farm Management' },
  { id: 'health-analytics', path: '/health-analytics', roles: ['farmer', 'admin', 'veterinarian'], section: 'Analytics & Tools' },
  { id: 'breeding', path: '/breeding', roles: ['farmer', 'admin'], section: 'Analytics & Tools' },
  { id: 'feed-inventory', path: '/feed-inventory', roles: ['farmer', 'admin'], section: 'Analytics & Tools' },
  { id: 'compliance', path: '/compliance', roles: ['farmer', 'admin'], section: 'Analytics & Tools' },
  { id: 'financial', path: '/financial', roles: ['farmer', 'admin'], section: 'Analytics & Tools' },
  { id: 'alerts', path: '/alerts', roles: ['farmer', 'admin', 'veterinarian'], section: 'Analytics & Tools' },
  { id: 'disease-prediction', path: '/disease-prediction', roles: ['farmer', 'admin', 'veterinarian'], section: 'Innovation' },
  { id: 'genomic-lineage', path: '/genomic-lineage', roles: ['farmer', 'admin'], section: 'Innovation' },
  { id: 'iot-sensors', path: '/iot-sensors', roles: ['farmer', 'admin'], section: 'Innovation' },
  { id: 'supply-chain', path: '/supply-chain', roles: ['farmer', 'admin'], section: 'Innovation' },
  { id: 'workforce', path: '/workforce', roles: ['farmer', 'admin'], section: 'Innovation' },
  { id: 'report-builder', path: '/report-builder', roles: ['farmer', 'admin', 'veterinarian'], section: 'Innovation' },
  { id: 'ai-copilot', path: '/ai-copilot', roles: ['veterinarian', 'farmer', 'admin', 'pet_owner'], section: 'Intelligence' },
  { id: 'digital-twin', path: '/digital-twin', roles: ['farmer', 'admin'], section: 'Intelligence' },
  { id: 'marketplace', path: '/marketplace', roles: ['farmer', 'admin', 'pet_owner', 'veterinarian'], section: 'Intelligence' },
  { id: 'sustainability', path: '/sustainability', roles: ['farmer', 'admin'], section: 'Intelligence' },
  { id: 'wellness', path: '/wellness', roles: ['pet_owner', 'farmer', 'admin', 'veterinarian'], section: 'Intelligence' },
  { id: 'geospatial', path: '/geospatial', roles: ['farmer', 'admin'], section: 'Intelligence' },
  { id: 'vet-hospitals', path: '/vet-hospitals', roles: ['pet_owner', 'farmer', 'veterinarian', 'admin'], section: 'Vet Network' },
  { id: 'vet-hospitals-manage', path: '/vet-hospitals/manage', roles: ['veterinarian'], section: 'Vet Network' },
  { id: 'hospital-workflow', path: '/hospital-workflow', roles: ['veterinarian', 'admin'], section: 'Vet Network' },
  { id: 'inpatient', path: '/inpatient', roles: ['veterinarian', 'admin'], section: 'Vet Network' },
  { id: 'wallet', path: '/wallet', roles: ['pet_owner', 'farmer', 'veterinarian', 'admin'], section: 'Account' },
  { id: 'admin-dashboard', path: '/admin/dashboard', roles: ['admin'], section: 'Administration' },
  { id: 'admin-users', path: '/admin/users', roles: ['admin'], section: 'Administration' },
  { id: 'admin-consultations', path: '/admin/consultations', roles: ['admin'], section: 'Administration' },
  { id: 'admin-payments', path: '/admin/payments', roles: ['admin'], section: 'Administration' },
  { id: 'admin-reviews', path: '/admin/reviews', roles: ['admin'], section: 'Administration' },
  { id: 'admin-settings', path: '/admin/settings', roles: ['admin'], section: 'Administration' },
  { id: 'admin-permissions', path: '/admin/permissions', roles: ['admin'], section: 'Administration' },
  { id: 'admin-medical-records', path: '/admin/medical-records', roles: ['admin'], section: 'Administration' },
  { id: 'admin-hospitals', path: '/admin/vet-hospitals', roles: ['admin'], section: 'Administration' },
  { id: 'admin-audit', path: '/admin/audit-logs', roles: ['admin'], section: 'Administration' },
  { id: 'admin-compliance', path: '/admin/compliance', roles: ['admin'], section: 'Administration' },
  { id: 'admin-staff-settings', path: '/admin/staff-settings', roles: ['admin'], section: 'Administration' },
  { id: 'admin-cancellation-dashboard', path: '/admin/cancellation-dashboard', roles: ['admin'], section: 'Administration' },
  { id: 'admin-holidays', path: '/admin/holidays', roles: ['admin', 'veterinarian'], section: 'Administration' },
  { id: 'settings', path: '/settings', roles: ['veterinarian', 'pet_owner', 'farmer'], section: 'Preferences' },
]

// Barrel: assembles the single `apiService` object every page imports, from the module files
// under services/api/. Split 2026-11-13 - this used to be one ~3,560-line class, unmanageable
// for a small addition. Every existing `import apiService from '../services/api'` (or named
// `{ apiService }`) keeps working unchanged: this file still exports the same default + named
// `apiService`, plus `sharedClient`, `fetchCsrfToken`, `extractArrayFromResponse` and
// `extractTotalFromResponse`, which services/api/client.ts and other callers depend on by name.
//
// Add a new method to the module file it belongs with; add a new module file (and merge it
// below) for a genuinely new module rather than growing an existing file. Method names must be
// unique across all module files - there is no namespacing, so a duplicate silently shadows the
// other (this was verified zero at split time; keep it that way).
import { sharedClient, fetchCsrfToken } from './api/core'
import { authApi } from './api/modules/auth'
import { consultationsApi } from './api/modules/consultations'
import { scheduleApi2 } from './api/modules/schedule'
import { medicalRecordsApi } from './api/modules/medicalRecords'
import { paymentsApi } from './api/modules/payments'
import { adminApi } from './api/modules/admin'
import { enterpriseApi } from './api/modules/enterprise'
import { analyticsApi } from './api/modules/analytics'
import { automationApi } from './api/modules/automation'
import { marketplaceApi } from './api/modules/marketplace'
import { clientPortalApi } from './api/modules/clientPortal'
import { hospitalApi } from './api/modules/hospital'
import { patientConsentRolesApi } from './api/modules/patientConsentRoles'
import { groomingApi } from './api/modules/grooming'
import { networkSubscriptionsApi } from './api/modules/networkSubscriptions'
import { networkReferralsAdminApi } from './api/modules/networkReferralsAdmin'

export { sharedClient, fetchCsrfToken }
export { extractArrayFromResponse, extractTotalFromResponse } from './api/utils'

export const apiService = {
  ...authApi,
  ...consultationsApi,
  ...scheduleApi2,
  ...medicalRecordsApi,
  ...paymentsApi,
  ...adminApi,
  ...enterpriseApi,
  ...analyticsApi,
  ...automationApi,
  ...marketplaceApi,
  ...clientPortalApi,
  ...hospitalApi,
  ...patientConsentRolesApi,
  ...groomingApi,
  ...networkSubscriptionsApi,
  ...networkReferralsAdminApi,
}
export default apiService

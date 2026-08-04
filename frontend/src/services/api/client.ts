// This used to be a second, independently-maintained Axios instance with
// its own copy of the auth-refresh/CSRF-retry interceptor logic - subtly
// different from services/api.ts's copy (a weaker 403/CSRF error-shape
// check), and with its own CSRF token cache that never synced with the
// other one. Both are now the same underlying client: there is exactly one
// Axios instance, one interceptor stack, and one CSRF token cache for the
// whole app. See services/api.ts for the actual implementation.
import { sharedClient, fetchCsrfToken } from '../api'

export const client = sharedClient
export { fetchCsrfToken }
export default sharedClient

/**
 * Unified API Service — barrel file.
 *
 * All domain modules are re-exported as a single flat object so that every
 * existing `import apiService from '../services/api'` keeps working unchanged.
 */

import { fetchCsrfToken } from './client'
import * as auth from './authApi'
import * as consultation from './consultationApi'
import * as booking from './bookingApi'
import * as video from './videoApi'
import * as schedule from './scheduleApi'
import * as prescription from './prescriptionApi'
import * as animal from './animalApi'
import * as vetProfile from './vetProfileApi'
import * as medical from './medicalApi'
import * as notification from './notificationApi'
import * as payment from './paymentApi'
import * as review from './reviewApi'
import * as admin from './adminApi'
import * as enterprise from './enterpriseApi'
import * as tier2 from './tier2Api'
import * as tier3 from './tier3Api'
import * as tier4 from './tier4Api'

const apiService = {
  fetchCsrfToken,

  // Auth
  ...auth,

  // Consultations
  ...consultation,

  // Bookings
  ...booking,

  // Video Sessions
  ...video,

  // Schedule & Availability
  ...schedule,

  // Prescriptions
  ...prescription,

  // Animals
  ...animal,

  // Vet Profiles
  ...vetProfile,

  // Medical Records, Vaccinations, Weight, Allergies, Lab Results, Timeline
  ...medical,

  // Notifications
  ...notification,

  // Payments
  ...payment,

  // Reviews
  ...review,

  // Admin, Feature Flags, Permissions, Health Check
  ...admin,

  // Enterprise / Farm Management
  ...enterprise,

  // Tier 2 — Health Analytics, Breeding, Feed, Compliance, Financial, Alerts
  ...tier2,

  // Tier 3 — AI Disease Prediction, Genomic, IoT, Supply Chain, Workforce, Reports
  ...tier3,

  // Tier 4 — AI Copilot, Digital Twin, Marketplace, Sustainability, Wellness, Geospatial
  ...tier4,
}

export { apiService }
export default apiService

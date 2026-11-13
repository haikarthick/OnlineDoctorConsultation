export type {
  HospitalNetwork,
  HospitalNetworkCreateDTO,
  NetworkMember,
  NetworkDashboard,
  AccessLogEntry,
  PatientConsent,
  PatientConsentDTO,
  EnrollmentRequest,
  WalkInInviteDTO,
} from './hospitalNetwork/types';

import {
  createNetwork,
  listNetworks,
  getNetworkById,
  updateNetwork,
  approveNetwork,
} from './hospitalNetwork/networkCrud';

import {
  addNetworkMember,
  getNetworkMember,
  getMyNetworkAccess,
  listNetworkMembers,
  removeNetworkMember,
  logAudit,
  assignHospitalToNetwork,
  listNetworkHospitals,
} from './hospitalNetwork/members';

import {
  getNetworkDashboard,
  getHospitalStaffDashboard,
  getAuditLogs,
  logAccess,
} from './hospitalNetwork/dashboard';

import {
  createConsent,
  listConsents,
  revokeConsent,
  generateNetworkPatientId,
} from './hospitalNetwork/consentAndPatientId';

import {
  enrollAnimal,
  getNetworkPatients,
  acceptEnrollment,
  declineEnrollment,
  getMyEnrollments,
  inviteWalkInPatient,
  acceptWalkInInvite,
  registerWalkInPatientDirect,
  getPendingEnrollments,
} from './hospitalNetwork/enrollment';

import {
  deactivateNetwork,
  mapNetworkRow,
  mapMemberRow,
  mapConsentRow,
} from './hospitalNetwork/rowMappersAndDeactivate';

import {
  createNetworkReferral,
  updateNetworkReferralStatus,
  listNetworkReferrals,
  getCorporateDashboardStats,
  createBranchHospital,
} from './hospitalNetwork/referralsAndBranch';

import { getNetworkFinancialSummary } from './hospitalNetwork/financialSummary';

import {
  createLeaveRequest,
  listLeaveRequests,
  updateLeaveRequestStatus,
  createPatientTransfer,
} from './hospitalNetwork/leaveAndTransfer';

import {
  getNetworkAnalytics,
  getPatientEnrollmentTrend,
  searchNetworkPatients,
  generateComplianceReport,
  completePatientTransfer,
} from './hospitalNetwork/analyticsAndCompliance';

export {
  updateBranchHospital,
  deleteBranchHospital,
  addApprovalEvent,
  getApprovalHistory,
  updateNetworkBranding,
  getNotificationPreferences,
  updateNotificationPreferences,
} from './hospitalNetwork/standaloneExports';

class HospitalNetworkService {
  createNetwork = createNetwork;
  listNetworks = listNetworks;
  getNetworkById = getNetworkById;
  updateNetwork = updateNetwork;
  approveNetwork = approveNetwork;

  addNetworkMember = addNetworkMember;
  getNetworkMember = getNetworkMember;
  getMyNetworkAccess = getMyNetworkAccess;
  listNetworkMembers = listNetworkMembers;
  removeNetworkMember = removeNetworkMember;
  logAudit = logAudit;
  assignHospitalToNetwork = assignHospitalToNetwork;
  listNetworkHospitals = listNetworkHospitals;

  getNetworkDashboard = getNetworkDashboard;
  getHospitalStaffDashboard = getHospitalStaffDashboard;
  getAuditLogs = getAuditLogs;
  logAccess = logAccess;

  createConsent = createConsent;
  listConsents = listConsents;
  revokeConsent = revokeConsent;
  generateNetworkPatientId = generateNetworkPatientId;

  enrollAnimal = enrollAnimal;
  getNetworkPatients = getNetworkPatients;
  acceptEnrollment = acceptEnrollment;
  declineEnrollment = declineEnrollment;
  getMyEnrollments = getMyEnrollments;
  inviteWalkInPatient = inviteWalkInPatient;
  acceptWalkInInvite = acceptWalkInInvite;
  registerWalkInPatientDirect = registerWalkInPatientDirect;
  getPendingEnrollments = getPendingEnrollments;

  deactivateNetwork = deactivateNetwork;
  mapNetworkRow = mapNetworkRow;
  mapMemberRow = mapMemberRow;
  mapConsentRow = mapConsentRow;

  createNetworkReferral = createNetworkReferral;
  updateNetworkReferralStatus = updateNetworkReferralStatus;
  listNetworkReferrals = listNetworkReferrals;
  getCorporateDashboardStats = getCorporateDashboardStats;
  createBranchHospital = createBranchHospital;

  getNetworkFinancialSummary = getNetworkFinancialSummary;

  createLeaveRequest = createLeaveRequest;
  listLeaveRequests = listLeaveRequests;
  updateLeaveRequestStatus = updateLeaveRequestStatus;
  createPatientTransfer = createPatientTransfer;

  getNetworkAnalytics = getNetworkAnalytics;
  getPatientEnrollmentTrend = getPatientEnrollmentTrend;
  searchNetworkPatients = searchNetworkPatients;
  generateComplianceReport = generateComplianceReport;
  completePatientTransfer = completePatientTransfer;
}

export default new HospitalNetworkService();

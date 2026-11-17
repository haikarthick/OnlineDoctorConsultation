import { Router, Request, Response } from 'express';
import { authMiddleware, roleMiddleware, validateBody, AuthRequest } from '../middleware/auth';
import { requireNetworkAccess, resolveNetworkAccess } from '../middleware/networkAccess';
import { requireAnimalAccess, requireEnterpriseAccess } from '../middleware/hospitalDataIsolation';
import { asyncHandler } from '../utils/errorHandler';
import database from '../utils/database';
import { emitRoleRefresh } from '../utils/socketIO';
import { uploadAny } from '../middleware/upload';
import NetworkRolePermissionService from '../services/NetworkRolePermissionService';
import MedicalRecordController from '../controllers/MedicalRecordController';
import StaffWorkflowController from '../controllers/StaffWorkflowController';
import Tier2Controller from '../controllers/Tier2Controller';
import Tier3Controller from '../controllers/Tier3Controller';
import Tier4Controller from '../controllers/Tier4Controller';
import {
  updateNetworkRolePermissionSchema, resetNetworkRolePermissionsSchema,
  createObservationSchema, resolveObservationSchema,
  createBreedingRecordSchema, updateBreedingRecordSchema,
  createFeedSchema, updateFeedSchema, restockFeedSchema, logFeedConsumptionSchema,
  createComplianceDocSchema, updateComplianceDocSchema,
  createFinancialRecordSchema, updateFinancialRecordSchema,
  createAlertRuleSchema, updateAlertRuleSchema, toggleAlertRuleSchema,
  createPredictionSchema, resolvePredictionSchema, createOutbreakZoneSchema,
  createGeneticProfileSchema, updateGeneticProfileSchema, createPairRecommendationSchema,
  createSensorSchema, updateSensorSchema, recordSensorReadingSchema,
  createBatchSchema, updateBatchSchema, createTraceabilityEventSchema, generateQRCodeSchema,
  createTaskSchema, updateTaskSchema, createShiftSchema, updateShiftSchema,
  createReportTemplateSchema, updateReportTemplateSchema, generateReportSchema,
  createChatSessionSchema, sendChatMessageSchema, checkDrugInteractionsSchema, analyzeSymptomsSchema,
  createDigitalTwinSchema, updateDigitalTwinSchema, runSimulationSchema,
} from '../middleware/validation';

const router = Router();

// ─── Network Role Permissions (admin-configurable, per-network) ───────────────
router.get('/admin/network-role-permissions', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const { networkId } = req.query;
  if (!networkId || typeof networkId !== 'string') {
    return res.status(400).json({ success: false, error: 'networkId query parameter is required' });
  }
  const matrix = await NetworkRolePermissionService.getMatrix(networkId);
  const metadata = NetworkRolePermissionService.getMetadata();
  res.json({ success: true, data: { matrix, metadata } });
}));

router.put('/admin/network-role-permissions', authMiddleware, roleMiddleware(['admin']), validateBody(updateNetworkRolePermissionSchema), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { networkId, networkRole, action, isEnabled } = req.body;
  await NetworkRolePermissionService.updatePermission(networkId, networkRole, action, isEnabled, authReq.userId!);
  res.json({ success: true, message: `Network permission '${action}' for '${networkRole}' set to ${isEnabled}` });
}));

router.post('/admin/network-role-permissions/reset', authMiddleware, roleMiddleware(['admin']), validateBody(resetNetworkRolePermissionsSchema), asyncHandler(async (req: Request, res: Response) => {
  const { networkId, networkRole } = req.body;
  await NetworkRolePermissionService.resetToDefaults(networkId, networkRole);
  const matrix = await NetworkRolePermissionService.getMatrix(networkId);
  res.json({ success: true, data: { matrix }, message: networkRole ? `Network permissions reset for ${networkRole}` : 'All network role permissions reset to defaults' });
}));

// ─── Network Custom Roles CRUD ─────────────────────────────────────────────────

// viewNetworkDetails is held by all five network roles, so this preserves the
// previous "any active member" behaviour exactly while picking up the expiry
// check, the admin-configurable matrix and the 404-for-non-members that the
// hand-rolled query did not have.
router.get('/hospital-networks/:id/roles', authMiddleware, requireNetworkAccess('viewNetworkDetails'), asyncHandler(async (req: Request, res: Response) => {
  try {
    const roles = await NetworkRolePermissionService.getNetworkRoles(req.params.id);
    res.json({ success: true, data: roles });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}));

// BEHAVIOUR CHANGE: the hand-rolled check admitted hospital_director, but the
// permission matrix sets manageRolePermissions=false for that role. Creating a
// custom role IS managing role permissions, so the inline list was granting a
// capability the declared matrix denies. Deferring to the matrix removes that
// escalation; a network that genuinely wants directors to manage roles can now
// grant it there, which the hardcoded list never allowed.
router.post('/hospital-networks/:id/roles', authMiddleware, requireNetworkAccess('manageRolePermissions'), asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { roleKey, displayName, description, baseTemplate, icon } = req.body;
    if (!roleKey || !displayName || !baseTemplate) {
      res.status(400).json({ success: false, error: 'roleKey, displayName, and baseTemplate are required' }); return;
    }
    const result = await NetworkRolePermissionService.createCustomRole(req.params.id, {
      roleKey, displayName, description, baseTemplate, icon, createdBy: userId,
    });
    res.status(201).json({ success: true, data: result });
  } catch (err: any) {
    res.status(err.message.includes('reserved') || err.message.includes('unique') ? 400 : 500)
       .json({ success: false, error: err.message });
  }
}));

// Same matrix deferral as the create route above - see the note there.
router.put('/hospital-networks/:id/roles/:roleKey', authMiddleware, requireNetworkAccess('manageRolePermissions'), asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { displayName, description, baseTemplate, icon } = req.body;
    await NetworkRolePermissionService.updateCustomRole(req.params.id, req.params.roleKey, {
      displayName, description, baseTemplate, icon, updatedBy: userId,
    });
    res.json({ success: true, message: 'Custom role updated' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}));

// corporate_admin is the only role with manageRolePermissions, so this matches
// the previous hardcoded list exactly.
router.delete('/hospital-networks/:id/roles/:roleKey', authMiddleware, requireNetworkAccess('manageRolePermissions'), asyncHandler(async (req: Request, res: Response) => {
  try {
    await NetworkRolePermissionService.deactivateCustomRole(req.params.id, req.params.roleKey);
    res.json({ success: true, message: 'Custom role deactivated' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}));

// ═══════════════════════════════════════════════════════════════
// ─── Health Analytics ────────────────────────────────
router.get('/enterprises/:enterpriseId/health/dashboard', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.getHealthDashboard(req, res)));
router.get('/enterprises/:enterpriseId/health/observations', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.listObservations(req, res)));
router.post('/enterprises/:enterpriseId/health/observations', authMiddleware, validateBody(createObservationSchema), asyncHandler((req: Request, res: Response) => Tier2Controller.createObservation(req, res)));
router.patch('/health/observations/:id/resolve', authMiddleware, validateBody(resolveObservationSchema), asyncHandler((req: Request, res: Response) => Tier2Controller.resolveObservation(req, res)));

// ─── Enterprise / Herd Medical Management ────────────
// CRITICAL FIX: Added requireEnterpriseAccess to prevent data exposure by arbitrary enterpriseId
router.get('/enterprises/:enterpriseId/medical-records', authMiddleware, requireEnterpriseAccess(), asyncHandler((req: Request, res: Response) => MedicalRecordController.listEnterpriseRecords(req, res)));
router.get('/enterprises/:enterpriseId/medical-records/stats', authMiddleware, requireEnterpriseAccess(), asyncHandler((req: Request, res: Response) => MedicalRecordController.getEnterpriseMedicalStats(req, res)));
router.get('/enterprises/:enterpriseId/vaccinations', authMiddleware, requireEnterpriseAccess(), asyncHandler((req: Request, res: Response) => MedicalRecordController.listEnterpriseVaccinations(req, res)));

// ─── Breeding & Genetics ────────────────────────────
router.get('/enterprises/:enterpriseId/breeding', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.listBreedingRecords(req, res)));
router.post('/enterprises/:enterpriseId/breeding', authMiddleware, validateBody(createBreedingRecordSchema), asyncHandler((req: Request, res: Response) => Tier2Controller.createBreedingRecord(req, res)));
router.put('/breeding/:id', authMiddleware, validateBody(updateBreedingRecordSchema), asyncHandler((req: Request, res: Response) => Tier2Controller.updateBreedingRecord(req, res)));
router.get('/enterprises/:enterpriseId/breeding/upcoming-due', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.getUpcomingDueDates(req, res)));
router.get('/enterprises/:enterpriseId/breeding/stats', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.getBreedingStats(req, res)));

// ─── Feed & Inventory ───────────────────────────────
router.get('/enterprises/:enterpriseId/feed', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.listFeeds(req, res)));
router.post('/enterprises/:enterpriseId/feed', authMiddleware, validateBody(createFeedSchema), asyncHandler((req: Request, res: Response) => Tier2Controller.createFeed(req, res)));
router.put('/feed/:id', authMiddleware, validateBody(updateFeedSchema), asyncHandler((req: Request, res: Response) => Tier2Controller.updateFeed(req, res)));
router.post('/feed/:id/restock', authMiddleware, validateBody(restockFeedSchema), asyncHandler((req: Request, res: Response) => Tier2Controller.restockFeed(req, res)));
router.delete('/feed/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.deleteFeed(req, res)));
router.post('/enterprises/:enterpriseId/feed/consumption', authMiddleware, validateBody(logFeedConsumptionSchema), asyncHandler((req: Request, res: Response) => Tier2Controller.logFeedConsumption(req, res)));
router.get('/enterprises/:enterpriseId/feed/consumption', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.listConsumptionLogs(req, res)));
router.get('/enterprises/:enterpriseId/feed/analytics', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.getFeedAnalytics(req, res)));

// ─── Compliance & Regulatory ────────────────────────
router.get('/enterprises/:enterpriseId/compliance', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.listComplianceDocs(req, res)));
router.post('/enterprises/:enterpriseId/compliance', authMiddleware, validateBody(createComplianceDocSchema), asyncHandler((req: Request, res: Response) => Tier2Controller.createComplianceDoc(req, res)));
router.put('/compliance/:id', authMiddleware, validateBody(updateComplianceDocSchema), asyncHandler((req: Request, res: Response) => Tier2Controller.updateComplianceDoc(req, res)));
router.patch('/compliance/:id/verify', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.verifyComplianceDoc(req, res)));
router.delete('/compliance/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.deleteComplianceDoc(req, res)));
router.get('/enterprises/:enterpriseId/compliance/summary', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.getComplianceSummary(req, res)));

// ─── Financial Analytics ────────────────────────────
router.get('/enterprises/:enterpriseId/financial', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.listFinancialRecords(req, res)));
router.post('/enterprises/:enterpriseId/financial', authMiddleware, validateBody(createFinancialRecordSchema), asyncHandler((req: Request, res: Response) => Tier2Controller.createFinancialRecord(req, res)));
router.put('/financial/:id', authMiddleware, validateBody(updateFinancialRecordSchema), asyncHandler((req: Request, res: Response) => Tier2Controller.updateFinancialRecord(req, res)));
router.delete('/financial/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.deleteFinancialRecord(req, res)));
router.get('/enterprises/:enterpriseId/financial/dashboard', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.getFinancialDashboard(req, res)));

// ─── Smart Alerts ───────────────────────────────────
router.get('/enterprises/:enterpriseId/alerts/rules', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.listAlertRules(req, res)));
router.post('/enterprises/:enterpriseId/alerts/rules', authMiddleware, validateBody(createAlertRuleSchema), asyncHandler((req: Request, res: Response) => Tier2Controller.createAlertRule(req, res)));
router.put('/alerts/rules/:id', authMiddleware, validateBody(updateAlertRuleSchema), asyncHandler((req: Request, res: Response) => Tier2Controller.updateAlertRule(req, res)));
router.delete('/alerts/rules/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.deleteAlertRule(req, res)));
router.patch('/alerts/rules/:id/toggle', authMiddleware, validateBody(toggleAlertRuleSchema), asyncHandler((req: Request, res: Response) => Tier2Controller.toggleAlertRule(req, res)));
router.get('/enterprises/:enterpriseId/alerts/events', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.listAlertEvents(req, res)));
router.patch('/alerts/events/:id/read', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.markAlertRead(req, res)));
router.patch('/enterprises/:enterpriseId/alerts/events/read-all', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.markAllAlertsRead(req, res)));
router.patch('/alerts/events/:id/acknowledge', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.acknowledgeAlert(req, res)));
router.post('/enterprises/:enterpriseId/alerts/run-checks', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.runAlertChecks(req, res)));

// ═══════════════════════════════════════════════════════════════

// ─── AI Disease Prediction & Outbreak Mapping ────────
router.get('/enterprises/:enterpriseId/disease-predictions/dashboard', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.getRiskDashboard(req, res)));
router.get('/enterprises/:enterpriseId/disease-predictions', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.listPredictions(req, res)));
router.post('/enterprises/:enterpriseId/disease-predictions', authMiddleware, validateBody(createPredictionSchema), asyncHandler((req: Request, res: Response) => Tier3Controller.createPrediction(req, res)));
router.patch('/disease-predictions/:id/resolve', authMiddleware, validateBody(resolvePredictionSchema), asyncHandler((req: Request, res: Response) => Tier3Controller.resolvePrediction(req, res)));
router.get('/enterprises/:enterpriseId/outbreak-zones', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.listOutbreakZones(req, res)));
router.post('/enterprises/:enterpriseId/outbreak-zones', authMiddleware, validateBody(createOutbreakZoneSchema), asyncHandler((req: Request, res: Response) => Tier3Controller.createOutbreakZone(req, res)));
router.patch('/outbreak-zones/:id/resolve', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.resolveOutbreakZone(req, res)));

// ─── Genomic Lineage & Genetic Diversity ────────────
router.get('/enterprises/:enterpriseId/genetic-profiles', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.listGeneticProfiles(req, res)));
router.post('/enterprises/:enterpriseId/genetic-profiles', authMiddleware, validateBody(createGeneticProfileSchema), asyncHandler((req: Request, res: Response) => Tier3Controller.createGeneticProfile(req, res)));
router.put('/genetic-profiles/:id', authMiddleware, validateBody(updateGeneticProfileSchema), asyncHandler((req: Request, res: Response) => Tier3Controller.updateGeneticProfile(req, res)));
router.get('/genetic-profiles/:animalId/lineage-tree', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.getLineageTree(req, res)));
router.get('/enterprises/:enterpriseId/lineage-pairs', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.listPairRecommendations(req, res)));
router.post('/enterprises/:enterpriseId/lineage-pairs', authMiddleware, validateBody(createPairRecommendationSchema), asyncHandler((req: Request, res: Response) => Tier3Controller.createPairRecommendation(req, res)));
router.get('/enterprises/:enterpriseId/genetic-dashboard', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.getGeneticDashboard(req, res)));

// ─── IoT Sensor Integration ─────────────────────────
router.get('/enterprises/:enterpriseId/iot/dashboard', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.getSensorDashboard(req, res)));
router.get('/enterprises/:enterpriseId/iot/sensors', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.listSensors(req, res)));
router.post('/enterprises/:enterpriseId/iot/sensors', authMiddleware, validateBody(createSensorSchema), asyncHandler((req: Request, res: Response) => Tier3Controller.createSensor(req, res)));
router.put('/iot/sensors/:id', authMiddleware, validateBody(updateSensorSchema), asyncHandler((req: Request, res: Response) => Tier3Controller.updateSensor(req, res)));
router.delete('/iot/sensors/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.deleteSensor(req, res)));
router.post('/enterprises/:enterpriseId/iot/readings', authMiddleware, validateBody(recordSensorReadingSchema), asyncHandler((req: Request, res: Response) => Tier3Controller.recordSensorReading(req, res)));
router.get('/iot/sensors/:sensorId/readings', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.listSensorReadings(req, res)));

// ─── Supply Chain & Traceability ─────────────────────
router.get('/enterprises/:enterpriseId/supply-chain/dashboard', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.getSupplyChainDashboard(req, res)));
router.get('/enterprises/:enterpriseId/supply-chain/batches', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.listBatches(req, res)));
router.post('/enterprises/:enterpriseId/supply-chain/batches', authMiddleware, validateBody(createBatchSchema), asyncHandler((req: Request, res: Response) => Tier3Controller.createBatch(req, res)));
router.put('/supply-chain/batches/:id', authMiddleware, validateBody(updateBatchSchema), asyncHandler((req: Request, res: Response) => Tier3Controller.updateBatch(req, res)));
router.get('/enterprises/:enterpriseId/supply-chain/events', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.listTraceabilityEvents(req, res)));
router.post('/enterprises/:enterpriseId/supply-chain/events', authMiddleware, validateBody(createTraceabilityEventSchema), asyncHandler((req: Request, res: Response) => Tier3Controller.createTraceabilityEvent(req, res)));
router.patch('/supply-chain/events/:id/verify', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.verifyTraceabilityEvent(req, res)));
router.get('/supply-chain/batches/:batchId/traceability', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.getBatchTraceability(req, res)));
router.post('/enterprises/:enterpriseId/supply-chain/qr-codes', authMiddleware, validateBody(generateQRCodeSchema), asyncHandler((req: Request, res: Response) => Tier3Controller.generateQRCode(req, res)));
router.get('/enterprises/:enterpriseId/supply-chain/qr-codes', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.listQRCodes(req, res)));

// ─── Workforce & Task Management ─────────────────────
router.get('/enterprises/:enterpriseId/workforce/dashboard', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.getWorkforceDashboard(req, res)));
router.get('/enterprises/:enterpriseId/workforce/tasks', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.listTasks(req, res)));
router.post('/enterprises/:enterpriseId/workforce/tasks', authMiddleware, validateBody(createTaskSchema), asyncHandler((req: Request, res: Response) => Tier3Controller.createTask(req, res)));
router.put('/workforce/tasks/:id', authMiddleware, validateBody(updateTaskSchema), asyncHandler((req: Request, res: Response) => Tier3Controller.updateTask(req, res)));
router.delete('/workforce/tasks/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.deleteTask(req, res)));
router.get('/enterprises/:enterpriseId/workforce/shifts', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.listShifts(req, res)));
router.post('/enterprises/:enterpriseId/workforce/shifts', authMiddleware, validateBody(createShiftSchema), asyncHandler((req: Request, res: Response) => Tier3Controller.createShift(req, res)));
router.put('/workforce/shifts/:id', authMiddleware, validateBody(updateShiftSchema), asyncHandler((req: Request, res: Response) => Tier3Controller.updateShift(req, res)));
router.patch('/workforce/shifts/:id/check-in', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.checkInShift(req, res)));
router.patch('/workforce/shifts/:id/check-out', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.checkOutShift(req, res)));
router.delete('/workforce/shifts/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.deleteShift(req, res)));

// ─── Staff & Workflow Management ─────────────────────
// Animal Search & Medical Summary (for workflow integration)
router.get('/workflow/animals/search', authMiddleware, asyncHandler((req: Request, res: Response) => StaffWorkflowController.searchAnimals(req, res)));
router.get('/workflow/animals/:animalId/medical-summary', authMiddleware, asyncHandler((req: Request, res: Response) => StaffWorkflowController.getAnimalMedicalSummary(req, res)));
// Staff Positions
router.get('/hospitals/:hospitalId/staff', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await checkInpatientNetworkAccess(req, res)) return;
  return StaffWorkflowController.listStaffPositions(req, res);
}));
router.post('/hospitals/:hospitalId/staff', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await checkInpatientNetworkAccess(req, res)) return;
  return StaffWorkflowController.addStaffPosition(req, res);
}));
router.put('/staff-positions/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await checkResourceNetworkAccess(req, res, 'staff_positions')) return;
  return StaffWorkflowController.updateStaffPosition(req, res);
}));
router.delete('/staff-positions/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await checkResourceNetworkAccess(req, res, 'staff_positions')) return;
  return StaffWorkflowController.removeStaffPosition(req, res);
}));
// Appointment Queue
router.get('/hospitals/:hospitalId/queue', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await checkInpatientNetworkAccess(req, res)) return;
  return StaffWorkflowController.getQueue(req, res);
}));
router.post('/hospitals/:hospitalId/queue/check-in', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await checkInpatientNetworkAccess(req, res)) return;
  return StaffWorkflowController.checkInToQueue(req, res);
}));
router.patch('/queue/:id/triage', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await checkResourceNetworkAccess(req, res, 'appointment_queue')) return;
  return StaffWorkflowController.triagePatient(req, res);
}));
router.patch('/queue/:id/status', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await checkResourceNetworkAccess(req, res, 'appointment_queue')) return;
  return StaffWorkflowController.updateQueueStatus(req, res);
}));
router.get('/hospitals/:hospitalId/queue/stats', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await checkInpatientNetworkAccess(req, res)) return;
  return StaffWorkflowController.getQueueStats(req, res);
}));
// Clinical Workflow
router.get('/hospitals/:hospitalId/workflow/dashboard', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await checkInpatientNetworkAccess(req, res)) return;
  return StaffWorkflowController.getWorkflowDashboard(req, res);
}));
router.get('/hospitals/:hospitalId/workflow/cases', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await checkInpatientNetworkAccess(req, res)) return;
  return StaffWorkflowController.listWorkflowCases(req, res);
}));
router.post('/hospitals/:hospitalId/workflow/cases', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await checkInpatientNetworkAccess(req, res)) return;
  return StaffWorkflowController.createWorkflowCase(req, res);
}));
router.get('/workflow/cases/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await checkResourceNetworkAccess(req, res, 'workflow_cases')) return;
  return StaffWorkflowController.getWorkflowCaseDetail(req, res);
}));
router.put('/workflow/cases/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await checkResourceNetworkAccess(req, res, 'workflow_cases')) return;
  return StaffWorkflowController.updateWorkflowCase(req, res);
}));
router.patch('/workflow/cases/:id/transition', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await checkResourceNetworkAccess(req, res, 'workflow_cases')) return;
  return StaffWorkflowController.transitionWorkflowStage(req, res);
}));
// Referrals
router.get('/vets/search', authMiddleware, asyncHandler((req: Request, res: Response) => StaffWorkflowController.searchVets(req, res)));
router.get('/hospitals/:hospitalId/referrals', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await checkInpatientNetworkAccess(req, res)) return;
  return StaffWorkflowController.listReferrals(req, res);
}));
router.post('/hospitals/:hospitalId/referrals', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await checkInpatientNetworkAccess(req, res)) return;
  return StaffWorkflowController.createReferral(req, res);
}));
router.patch('/referrals/:id/status', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await checkResourceNetworkAccess(req, res, 'referrals')) return;
  return StaffWorkflowController.updateReferralStatus(req, res);
}));
// Inpatient / Boarding
// Network-aware inpatient access helper - membership check delegated to the same
// resolveNetworkAccess() core used by requireNetworkAccess/ensureNetworkAccess (see
// [[feedback-network-hospital-change-approval]]); only the hospital→network resolution
// is specific to this helper. Non-membership responds 404 (not 403) - anti-enumeration,
// consistent with VetHospitalService's getHospital/listDoctors pattern.
async function checkInpatientNetworkAccess(req: Request, res: Response): Promise<boolean> {
  const userId = (req as any).userId;
  const userRole = (req as any).userRole;
  if (userRole === 'admin') return true;
  const hospitalId = req.params.hospitalId;
  const hospitalRes = await database.query(`SELECT branch_network_id FROM vet_hospitals WHERE id = $1`, [hospitalId]);
  const networkId = hospitalRes.rows[0]?.branch_network_id;
  if (!networkId) return true; // standalone hospital - no network check needed
  const result = await resolveNetworkAccess(networkId, userId, userRole);
  if (!result.allowed) {
    res.status(404).json({ success: false, error: 'Hospital not found' });
    return false;
  }
  return true;
}

/**
 * Same network-membership check as checkInpatientNetworkAccess, but for
 * routes keyed by a resource id (queue entry, workflow case, referral,
 * staff position, inpatient admission) rather than :hospitalId directly -
 * resolves the resource's hospital_id first, then checks membership if that
 * hospital is a network branch. Prevents a staffer from one network reading
 * or mutating another network's operational data by id.
 */
async function checkResourceNetworkAccess(req: Request, res: Response, table: string, idParam: string = 'id'): Promise<boolean> {
  const userRole = (req as any).userRole;
  if (userRole === 'admin') return true;
  const userId = (req as any).userId;
  const resourceId = req.params[idParam];
  const resourceRes = await database.query(`SELECT hospital_id FROM ${table} WHERE id = $1`, [resourceId]);
  const hospitalId = resourceRes.rows[0]?.hospital_id;
  if (!hospitalId) return true; // not found here - let the controller 404 normally
  const hospitalRes = await database.query(`SELECT branch_network_id FROM vet_hospitals WHERE id = $1`, [hospitalId]);
  const networkId = hospitalRes.rows[0]?.branch_network_id;
  if (!networkId) return true; // standalone hospital - no network check needed
  const result = await resolveNetworkAccess(networkId, userId, userRole);
  if (!result.allowed) {
    res.status(404).json({ success: false, error: 'Resource not found' });
    return false;
  }
  return true;
}

router.get('/hospitals/:hospitalId/inpatient/dashboard', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await checkInpatientNetworkAccess(req, res)) return;
  return StaffWorkflowController.getInpatientDashboard(req, res);
}));
router.get('/hospitals/:hospitalId/inpatient', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await checkInpatientNetworkAccess(req, res)) return;
  return StaffWorkflowController.listInpatients(req, res);
}));
router.post('/hospitals/:hospitalId/inpatient/admit', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  res.on('finish', () => { if (res.statusCode < 300) { emitRoleRefresh('veterinarian', 'inpatients'); emitRoleRefresh('hospital_staff', 'inpatients') } })
  if (!await checkInpatientNetworkAccess(req, res)) return;
  return StaffWorkflowController.admitPatient(req, res);
}));
router.patch('/inpatient/:id/status', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  res.on('finish', () => { if (res.statusCode < 300) { emitRoleRefresh('veterinarian', 'inpatients'); emitRoleRefresh('hospital_staff', 'inpatients') } })
  if (!await checkResourceNetworkAccess(req, res, 'inpatient_admissions')) return;
  return StaffWorkflowController.updateInpatientStatus(req, res)
}));
router.post('/inpatient/:id/vitals', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await checkResourceNetworkAccess(req, res, 'inpatient_admissions')) return;
  return StaffWorkflowController.addVitalsLog(req, res);
}));
router.put('/inpatient/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  res.on('finish', () => { if (res.statusCode < 300) { emitRoleRefresh('veterinarian', 'inpatients'); emitRoleRefresh('hospital_staff', 'inpatients') } })
  if (!await checkResourceNetworkAccess(req, res, 'inpatient_admissions')) return;
  await StaffWorkflowController.updateInpatientDetails(req, res)
}));
router.get('/animals/:animalId/hospital-visits', authMiddleware, requireAnimalAccess('params:animalId', 'hospital_visits'), asyncHandler((req: Request, res: Response) => StaffWorkflowController.getAnimalHospitalVisits(req, res)));

// ─── Report Builder & Export Center ──────────────────
router.get('/enterprises/:enterpriseId/reports/templates', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.listReportTemplates(req, res)));
router.post('/enterprises/:enterpriseId/reports/templates', authMiddleware, validateBody(createReportTemplateSchema), asyncHandler((req: Request, res: Response) => Tier3Controller.createReportTemplate(req, res)));
router.put('/reports/templates/:id', authMiddleware, validateBody(updateReportTemplateSchema), asyncHandler((req: Request, res: Response) => Tier3Controller.updateReportTemplate(req, res)));
router.delete('/reports/templates/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.deleteReportTemplate(req, res)));
router.post('/enterprises/:enterpriseId/reports/generate', authMiddleware, validateBody(generateReportSchema), asyncHandler((req: Request, res: Response) => Tier3Controller.generateReport(req, res)));
router.get('/enterprises/:enterpriseId/reports/generated', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.listGeneratedReports(req, res)));
router.get('/reports/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.getReport(req, res)));
router.delete('/reports/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.deleteReport(req, res)));

// ═══════════════════════════════════════════════════════════════

// ─── AI Veterinary Copilot ──────────────────────────
router.get('/ai-copilot/sessions', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.listChatSessions(req, res)));
router.post('/ai-copilot/sessions', authMiddleware, validateBody(createChatSessionSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.createChatSession(req, res)));
router.get('/ai-copilot/sessions/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.getChatSession(req, res)));
router.delete('/ai-copilot/sessions/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.deleteChatSession(req, res)));
router.get('/ai-copilot/sessions/:sessionId/messages', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.listChatMessages(req, res)));
router.post('/ai-copilot/sessions/:sessionId/messages', authMiddleware, validateBody(sendChatMessageSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.sendChatMessage(req, res)));
router.post('/ai-copilot/drug-interactions', authMiddleware, validateBody(checkDrugInteractionsSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.checkDrugInteractions(req, res)));
router.post('/ai-copilot/symptom-analysis', authMiddleware, validateBody(analyzeSymptomsSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.analyzeSymptoms(req, res)));
router.post('/ai-copilot/analyze-scan', authMiddleware, uploadAny.single('image'), asyncHandler((req: Request, res: Response) => Tier4Controller.analyzeScan(req, res)));

// ─── Digital Twin & Scenario Simulator ──────────────
router.get('/enterprises/:enterpriseId/digital-twins/dashboard', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.getDigitalTwinDashboard(req, res)));
router.get('/enterprises/:enterpriseId/digital-twins', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.listDigitalTwins(req, res)));
router.post('/enterprises/:enterpriseId/digital-twins', authMiddleware, validateBody(createDigitalTwinSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.createDigitalTwin(req, res)));
router.put('/digital-twins/:id', authMiddleware, validateBody(updateDigitalTwinSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.updateDigitalTwin(req, res)));
router.delete('/digital-twins/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.deleteDigitalTwin(req, res)));
router.get('/enterprises/:enterpriseId/simulations', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.listSimulations(req, res)));
router.post('/enterprises/:enterpriseId/simulations', authMiddleware, validateBody(runSimulationSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.runSimulation(req, res)));
router.get('/simulations/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.getSimulation(req, res)));
router.delete('/simulations/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.deleteSimulation(req, res)));


export default router;

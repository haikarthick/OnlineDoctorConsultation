import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, roleMiddleware, validateBody } from '../middleware/auth';
import {
  nutritionFactsSchema, nutritionMeasurementSchema, nutritionPlanSchema, nutritionPlanReviewSchema,
  nutritionFeedingSchema, nutritionFoodSchema, nutritionFlagStatusSchema, nutritionSpeciesModelSchema,
  nutritionEnergyFactorSchema, nutritionAdminFoodSchema, nutritionUnsafeFoodSchema, nutritionRequirementSetSchema,
  nutritionRationSchema, nutritionCurveSchema, nutritionPrescribeSchema, nutritionExplainSchema,
} from '../middleware/validation';
import NutritionExplainService from '../services/nutrition/NutritionExplainService';
import FarmRationService from '../services/nutrition/FarmRationService';
import GroupFeedingService from '../services/nutrition/GroupFeedingService';
import { asyncHandler } from '../utils/errorHandler';
import { isNutritionEnabled } from '../services/nutrition/NutritionConfig';
import NutritionService from '../services/nutrition/NutritionService';
import NutritionAdminService from '../services/nutrition/NutritionAdminService';

// ═══════════════════════════════════════════════════════════════════
// Animal nutrition (docs/NUTRITION_PLAN.md, migration 056).
// Dark-launched behind system setting nutrition.enabled: while it is off every route except
// GET /nutrition/enabled answers 404, as if the module did not exist.
//
// Who may see / change an animal's nutrition is decided in ONE place, NutritionAccess (owner, farm team,
// a vet with an appointment, admin). No route here trusts an id it was handed.
// ═══════════════════════════════════════════════════════════════════

const router = Router();
const caller = (req: Request) => ({
  userId: (req as any).userId as string,
  role: (req as any).userRole as string | undefined,
  roles: (req as any).userRoles as string[] | undefined,
});
const adminOnly = roleMiddleware(['admin']);

async function nutritionEnabled(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try { if (await isNutritionEnabled()) return next(); } catch { /* fall through to 404 */ }
  res.status(404).json({ success: false, message: 'Not found' });
}

// The client asks this first so it can hide every nutrition entry point while the module is dark.
router.get('/nutrition/enabled', authMiddleware, asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: { enabled: await isNutritionEnabled() } });
}));

const gate = [authMiddleware, nutritionEnabled];

// ─── Animals ───
router.get('/nutrition/animals', ...gate, asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, string | undefined>;
  res.json({ success: true, data: await NutritionService.listAnimals(caller(req), { search: q.search, filter: q.filter, limit: Number(q.limit), offset: Number(q.offset) }) });
}));

router.get('/nutrition/animals/:animalId', ...gate, asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await NutritionService.overview(req.params.animalId, caller(req)) });
}));

router.patch('/nutrition/animals/:animalId/facts', ...gate, validateBody(nutritionFactsSchema), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await NutritionService.saveFacts(req.params.animalId, req.body, caller(req)) });
}));

router.post('/nutrition/animals/:animalId/measurements', ...gate, validateBody(nutritionMeasurementSchema), asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ success: true, data: await NutritionService.addMeasurement(req.params.animalId, req.body, caller(req)) });
}));

// ─── Plans ───
router.post('/nutrition/animals/:animalId/plan/preview', ...gate, validateBody(nutritionPlanSchema), asyncHandler(async (req: Request, res: Response) => {
  const c = await NutritionService.preview(req.params.animalId, req.body, caller(req));
  res.json({ success: true, data: { energy: c.energy, portions: c.portions, unsafe: c.unsafe, mealsPerDay: c.mealsPerDay } });
}));

router.post('/nutrition/animals/:animalId/plan', ...gate, validateBody(nutritionPlanSchema), asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ success: true, data: await NutritionService.savePlan(req.params.animalId, req.body, caller(req)) });
}));

// ─── Farm rations (cattle, buffalo, goats, sheep, camels - 057; horses, donkeys - 060) ───
router.post('/nutrition/animals/:animalId/ration/preview', ...gate, validateBody(nutritionRationSchema), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await FarmRationService.preview(req.params.animalId, req.body, caller(req)) });
}));

router.post('/nutrition/animals/:animalId/ration', ...gate, validateBody(nutritionRationSchema), asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ success: true, data: await FarmRationService.save(req.params.animalId, req.body, caller(req)) });
}));

// ─── Herd rations: one least-cost solve for a cattle / buffalo / goat / sheep / horse group (migration 060).
// Gate: AnimalAccessService.checkGroup in FarmRationService.groupSubject (farm team, vet with an appointment, admin).
router.get('/nutrition/groups/:groupId/ration', ...gate, asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await FarmRationService.groupOverview(req.params.groupId, caller(req)) });
}));

router.post('/nutrition/groups/:groupId/ration/preview', ...gate, validateBody(nutritionRationSchema), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await FarmRationService.groupPreview(req.params.groupId, req.body, caller(req)) });
}));

router.post('/nutrition/groups/:groupId/ration', ...gate, validateBody(nutritionRationSchema), asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ success: true, data: await FarmRationService.groupSave(req.params.groupId, req.body, caller(req)) });
}));

// ─── Group feeding: flocks, pig batches, ponds (migration 059). Gate: AnimalAccessService.checkGroup in the service.
router.get('/nutrition/groups/:groupId/feeding', ...gate, asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, string | undefined>;
  const n = (v?: string) => (v === undefined || v === '' ? null : Number(v));
  res.json({ success: true, data: await GroupFeedingService.forGroup(req.params.groupId, caller(req), {
    avgWeightG: n(q.avgWeightG), waterTempC: n(q.waterTempC),
  }) });
}));

router.post('/nutrition/plans/:planId/review', ...gate, validateBody(nutritionPlanReviewSchema), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await NutritionService.reviewPlan(req.params.planId, req.body, caller(req)) });
}));

// A vet turns a plan into a prescribed diet (Phase 3). Gate: the plan's own animal / herd (NutritionAccess 'review'
// or AnimalAccessService.checkGroup + vet), then PrescriptionService's own who-may-prescribe rule.
router.post('/nutrition/plans/:planId/prescribe', ...gate, validateBody(nutritionPrescribeSchema), asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ success: true, data: await NutritionService.prescribePlan(req.params.planId, req.body, caller(req)) });
}));

// Plain-language explanation (AI, animal facts only, numbers checked). Gate: the plan's own animal / herd, read.
router.post('/nutrition/plans/:planId/explain', ...gate, validateBody(nutritionExplainSchema), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await NutritionExplainService.explain(req.params.planId, req.body.language || 'en', caller(req)) });
}));

// ─── Feeding log ───
router.get('/nutrition/animals/:animalId/feeding', ...gate, asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: { items: await NutritionService.listFeeding(req.params.animalId, Number(req.query.days) || 7, caller(req)) } });
}));

router.post('/nutrition/animals/:animalId/feeding', ...gate, validateBody(nutritionFeedingSchema), asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ success: true, data: await NutritionService.logFeeding(req.params.animalId, req.body, caller(req)) });
}));

router.delete('/nutrition/feeding/:id', ...gate, asyncHandler(async (req: Request, res: Response) => {
  await NutritionService.deleteFeeding(req.params.id, caller(req));
  res.json({ success: true });
}));

// ─── Foods ───
router.get('/nutrition/foods', ...gate, asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, string | undefined>;
  res.json({ success: true, data: { items: await NutritionService.foods({ animalId: q.animalId, groupId: q.groupId, search: q.search, kind: q.kind }, caller(req)) } });
}));

router.post('/nutrition/foods', ...gate, validateBody(nutritionFoodSchema), asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ success: true, data: await NutritionService.createFood(req.body, caller(req)) });
}));

// ─── Risk flags ───
router.patch('/nutrition/flags/:id', ...gate, validateBody(nutritionFlagStatusSchema), asyncHandler(async (req: Request, res: Response) => {
  await NutritionService.setFlagStatus(req.params.id, req.body.status, caller(req));
  res.json({ success: true });
}));

// ─── Admin master data ───
const admin = [...gate, adminOnly];

router.get('/nutrition/admin/species', ...admin, asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: { items: await NutritionAdminService.listSpecies() } });
}));
router.put('/nutrition/admin/species/:code', ...admin, validateBody(nutritionSpeciesModelSchema), asyncHandler(async (req: Request, res: Response) => {
  await NutritionAdminService.setSpeciesModel(req.params.code, req.body.nutritionModel);
  res.json({ success: true });
}));

router.get('/nutrition/admin/energy-factors', ...admin, asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: { items: await NutritionAdminService.listEnergyFactors() } });
}));
router.post('/nutrition/admin/energy-factors', ...admin, validateBody(nutritionEnergyFactorSchema), asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ success: true, data: { items: await NutritionAdminService.createEnergyFactor(req.body, caller(req).userId) } });
}));
router.put('/nutrition/admin/energy-factors/:id', ...admin, validateBody(nutritionEnergyFactorSchema), asyncHandler(async (req: Request, res: Response) => {
  await NutritionAdminService.updateEnergyFactor(req.params.id, req.body, caller(req).userId);
  res.json({ success: true });
}));

router.get('/nutrition/admin/foods', ...admin, asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, string | undefined>;
  res.json({ success: true, data: await NutritionAdminService.listFoods({ search: q.search, kind: q.kind, limit: Number(q.limit), offset: Number(q.offset) }) });
}));
router.post('/nutrition/admin/foods', ...admin, validateBody(nutritionAdminFoodSchema), asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ success: true, data: await NutritionAdminService.createFood(req.body, caller(req).userId) });
}));
router.put('/nutrition/admin/foods/:id', ...admin, validateBody(nutritionAdminFoodSchema), asyncHandler(async (req: Request, res: Response) => {
  await NutritionAdminService.updateFood(req.params.id, req.body);
  res.json({ success: true });
}));

router.get('/nutrition/admin/unsafe-foods', ...admin, asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: { items: await NutritionAdminService.listUnsafe() } });
}));
router.post('/nutrition/admin/unsafe-foods', ...admin, validateBody(nutritionUnsafeFoodSchema), asyncHandler(async (req: Request, res: Response) => {
  await NutritionAdminService.createUnsafe(req.body);
  res.status(201).json({ success: true });
}));
router.put('/nutrition/admin/unsafe-foods/:id', ...admin, validateBody(nutritionUnsafeFoodSchema), asyncHandler(async (req: Request, res: Response) => {
  await NutritionAdminService.updateUnsafe(req.params.id, req.body);
  res.json({ success: true });
}));

router.get('/nutrition/admin/requirement-sets', ...admin, asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: { items: await NutritionAdminService.listRequirementSets() } });
}));
router.get('/nutrition/admin/requirement-sets/:id', ...admin, asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await NutritionAdminService.getRequirementSet(req.params.id) });
}));
router.post('/nutrition/admin/requirement-sets', ...admin, validateBody(nutritionRequirementSetSchema), asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ success: true, data: await NutritionAdminService.saveRequirementSet(null, req.body, caller(req).userId) });
}));
router.put('/nutrition/admin/requirement-sets/:id', ...admin, validateBody(nutritionRequirementSetSchema), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await NutritionAdminService.saveRequirementSet(req.params.id, req.body, caller(req).userId) });
}));

router.get('/nutrition/admin/curves', ...admin, asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: { items: await NutritionAdminService.listCurves() } });
}));
router.put('/nutrition/admin/curves/:id', ...admin, validateBody(nutritionCurveSchema), asyncHandler(async (req: Request, res: Response) => {
  await NutritionAdminService.updateCurve(req.params.id, req.body);
  res.json({ success: true });
}));
router.post('/nutrition/admin/approve-pending', ...admin, asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await NutritionAdminService.approveAllPending() });
}));

router.get('/nutrition/admin/usage', ...admin, asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await NutritionAdminService.usage(Number(req.query.days) || 30) });
}));

export default router;

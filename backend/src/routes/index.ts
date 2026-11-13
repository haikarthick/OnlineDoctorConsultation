import { Router } from 'express';
import coreClinicalRoutes from './core-clinical.routes';
import enterpriseFarmRoutes from './enterprise-farm.routes';
import hospitalNetworkRoutes from './hospital-network.routes';
import medicalRecordsRoutes from './medical-records.routes';
import paymentsAndReviewsRoutes from './payments-and-reviews.routes';
import adminAndPermissionsRoutes from './admin-and-permissions.routes';
import networkPermissionsAndWorkflowRoutes from './network-permissions-and-workflow.routes';
import marketplaceRoutes from './marketplace.routes';
import catalogAndRolesRoutes from './catalog-and-roles.routes';
import networkSubscriptionsRoutes from './network-subscriptions.routes';
import pricingVisibilityRoutes from './pricing-visibility.routes';
import hospitalStaffInvitesRoutes from './hospital-staff-invites.routes';
import networkFinancialSummaryRoutes from './network-financial-summary.routes';
import pharmacyRoutes from './pharmacy.routes';
import groomingRoutes from './grooming.routes';

const router = Router();

router.use(coreClinicalRoutes);
router.use(enterpriseFarmRoutes);
router.use(hospitalNetworkRoutes);
router.use(medicalRecordsRoutes);
router.use(paymentsAndReviewsRoutes);
router.use(adminAndPermissionsRoutes);
router.use(networkPermissionsAndWorkflowRoutes);
router.use(marketplaceRoutes);
router.use(catalogAndRolesRoutes);
router.use(networkSubscriptionsRoutes);
router.use(pricingVisibilityRoutes);
router.use(hospitalStaffInvitesRoutes);
router.use(networkFinancialSummaryRoutes);
router.use(pharmacyRoutes);
router.use(groomingRoutes);

export default router;

import express from "express";
import { authenticate, authorize } from "../../middleware/auth.ts";
import profileRoutes from "./profileRoutes.ts";
import testRoutes from "./testRoutes.ts";
import recommendationRoutes from "./recommendationRoutes.ts";
import candidateAndNotificationRoutes from "./candidateAndNotificationRoutes.ts";
import hrAndAuditRoutes from "./hrAndAuditRoutes.ts";
import settingsRoutes from "./settingsRoutes.ts";

const router = express.Router();
router.use(authenticate, authorize(["COMPANY", "ADMIN", "SUPER_ADMIN"]));
router.use(profileRoutes);
router.use(testRoutes);
router.use(recommendationRoutes);
router.use(candidateAndNotificationRoutes);
router.use(hrAndAuditRoutes);
router.use(settingsRoutes);
export default router;

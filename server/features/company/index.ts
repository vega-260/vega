import express from "express";
import { authenticate, authorize } from "../../middleware/auth.ts";
import profileRoutes from "./profileRoutes.ts";
import testRoutes from "./testRoutes.ts";
import recommendationRoutes from "./recommendationRoutes.ts";
import candidateAndNotificationRoutes from "./candidateAndNotificationRoutes.ts";
import hrAndAuditRoutes from "./hrAndAuditRoutes.ts";
import settingsRoutes from "./settingsRoutes.ts";

const router = express.Router();

// Allow document file viewing routes to stream files to browser tabs/iframes without requiring Authorization header
router.use((req, res, next) => {
  if (req.method === "GET" && (req.path.includes("/file") || req.path.startsWith("/documents/"))) {
    return next();
  }
  return authenticate(req as any, res, () => {
    authorize(["COMPANY", "ADMIN", "SUPER_ADMIN"])(req as any, res, next);
  });
});

router.use(profileRoutes);
router.use(testRoutes);
router.use(recommendationRoutes);
router.use(candidateAndNotificationRoutes);
router.use(hrAndAuditRoutes);
router.use(settingsRoutes);
export default router;

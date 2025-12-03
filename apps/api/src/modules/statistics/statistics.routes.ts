import { Hono } from "hono";
import { requireAuth, requireOrganization, requireRole } from "../../middleware/auth-middleware";
import {
  getDashboardStats,
  getAttendanceReport,
  getCostAnalysis,
  getLocationComparison,
  getTrendsAnalysis,
  getUserStatistics
} from "./statistics.controller";

const statisticsRouter = new Hono();

// All routes require:
// 1. Authentication
// 2. Organization context
// 3. Admin or Owner role
statisticsRouter.use("*", requireAuth, requireOrganization, requireRole(["admin", "owner"]));

statisticsRouter.get("/dashboard", getDashboardStats);
statisticsRouter.get("/attendance", getAttendanceReport);
statisticsRouter.get("/costs", getCostAnalysis);
statisticsRouter.get("/locations", getLocationComparison);
statisticsRouter.get("/trends", getTrendsAnalysis);
statisticsRouter.get("/user/:userId", getUserStatistics);
statisticsRouter.get("/user/by-email", getUserStatistics);

// Alias for report endpoint to support different client query structures if needed
statisticsRouter.get("/report", getAttendanceReport);

export default statisticsRouter;


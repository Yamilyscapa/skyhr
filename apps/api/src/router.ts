import { Hono } from "hono";
import healthRouter from "./modules/health/health.routes";
import authRouter from "./modules/auth/auth.routes";
import storageRouter from "./modules/storage/storage.routes";
import biometricsRouter from "./modules/biometrics/biometrics.routes";
import organizationsRouter from "./modules/organizations/organizations.routes";
import attendanceRouter from "./modules/attendance/attendance.routes";
import geofenceRouter from "./modules/geofence/geofence.routes";
import userGeofenceRouter from "./modules/geofence/user-geofence.routes";
import schedulesRouter from "./modules/schedules/schedules.routes";
import announcementsRouter from "./modules/announcements/announcements.routes";
import visitorsRouter from "./modules/visitors/visitors.routes";
import permissionsRouter from "./modules/permissions/permissions.routes";
import payroleRouter from "./modules/payrole/payroll.routes";
import statisticsRouter from "./modules/statistics/statistics.routes";

const router = new Hono();

router.route("/health", healthRouter);
router.route("/auth", authRouter);
router.route("/storage", storageRouter);
router.route("/biometrics", biometricsRouter);
router.route("/organizations", organizationsRouter);
router.route("/attendance", attendanceRouter);
router.route("/geofence", geofenceRouter);
router.route("/user-geofence", userGeofenceRouter);
router.route("/schedules", schedulesRouter);
router.route("/announcements", announcementsRouter);
router.route("/visitors", visitorsRouter);
router.route("/permissions", permissionsRouter);
router.route("/payroll", payroleRouter);
router.route("/statistics", statisticsRouter);

export default router;

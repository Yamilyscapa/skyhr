import { Hono } from "hono";
import { requireAuth, requireOrganization } from "../../middleware/auth-middleware";
import {
  checkIn,
  validateQr,
  checkOut,
  markAbsences,
  updateAttendanceStatusController,
  getAttendanceReport,
  getAttendanceEvents,
  getTodayAttendance,
  watchModeCheckIn,
} from "./attendance.controller";

const attendanceRouter = new Hono();

// QR validation
attendanceRouter.post("/qr/validate", requireAuth, requireOrganization, validateQr);

// Check-in and check-out
attendanceRouter.post("/check-in", requireAuth, requireOrganization, checkIn);
attendanceRouter.post("/watch-mode/check-in", requireAuth, requireOrganization, watchModeCheckIn);
attendanceRouter.post("/check-out", requireAuth, requireOrganization, checkOut);

// Admin endpoints (ideally would use requireRole(['admin', 'owner']) but not fully implemented)
attendanceRouter.post("/admin/mark-absences", requireAuth, requireOrganization, markAbsences);
attendanceRouter.put("/admin/update-status/:eventId", requireAuth, requireOrganization, updateAttendanceStatusController);

// Get attendance events (supports filtering)
attendanceRouter.get("/events", requireAuth, requireOrganization, getAttendanceEvents);
attendanceRouter.get("/today/:userId", requireAuth, requireOrganization, getTodayAttendance);

// Reports
attendanceRouter.get("/report", requireAuth, requireOrganization, getAttendanceReport);

export default attendanceRouter;


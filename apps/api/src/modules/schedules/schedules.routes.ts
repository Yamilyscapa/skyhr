import { Hono } from "hono";
import { requireAuth, requireOrganization } from "../../middleware/auth-middleware";
import {
  createShift,
  getShifts,
  updateShift,
  assignShiftToUser,
  getUserScheduleController,
} from "./schedules.controller";

const schedulesRouter = new Hono();

// Shift management (admin only - role check would be ideal but not implemented in all middleware yet)
schedulesRouter.post("/shifts/create", requireAuth, requireOrganization, createShift);
schedulesRouter.get("/shifts", requireAuth, requireOrganization, getShifts);
schedulesRouter.put("/shifts/:id", requireAuth, requireOrganization, updateShift);

// Shift assignment (admin only)
schedulesRouter.post("/assign", requireAuth, requireOrganization, assignShiftToUser);

// Get user schedule
schedulesRouter.get("/user/:userId", requireAuth, requireOrganization, getUserScheduleController);

export default schedulesRouter;


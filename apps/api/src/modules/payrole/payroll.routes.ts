import { Hono } from "hono";
import {
  requireAuth,
  requireOrganization,
} from "../../middleware/auth-middleware";
import { updateUserPayroll, getUserPayroll, allowOvertime, getOvertime } from "./payroll.controller";

const payroleRouter = new Hono();

payroleRouter.put("/", requireAuth, requireOrganization, updateUserPayroll);
payroleRouter.get("/:userId", requireAuth, requireOrganization, getUserPayroll);
payroleRouter.put("/overtime/:userId", requireAuth, requireOrganization, allowOvertime);
payroleRouter.get("/overtime/:userId", requireAuth, requireOrganization, getOvertime);

export default payroleRouter;

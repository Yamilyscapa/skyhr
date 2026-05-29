import { Hono } from "hono";
import {
  requireAuth,
  requireOrganization,
  requireRole,
} from "../../middleware/auth-middleware";
import { getActivityFeed } from "./activity.controller";

const activityRouter = new Hono();

activityRouter.get(
  "/",
  requireAuth,
  requireOrganization,
  requireRole(["owner", "admin"]),
  getActivityFeed,
);

export default activityRouter;

import { Hono } from "hono";
import {
  requireAuth,
  requireOrganization,
  requireRole,
} from "../../middleware/auth-middleware";
import {
  deleteAccount,
  getMe,
  getMember,
  listMembers,
  updateMember,
} from "./users.controller";

const usersRouter = new Hono();

usersRouter.get("/me", requireAuth, requireOrganization, getMe);
usersRouter.delete("/me", requireAuth, deleteAccount);

usersRouter.get(
  "/",
  requireAuth,
  requireOrganization,
  requireRole(["owner", "admin"]),
  listMembers,
);

usersRouter.get(
  "/:id",
  requireAuth,
  requireOrganization,
  requireRole(["owner", "admin"]),
  getMember,
);

usersRouter.patch(
  "/:id",
  requireAuth,
  requireOrganization,
  requireRole(["owner", "admin"]),
  updateMember,
);

export default usersRouter;

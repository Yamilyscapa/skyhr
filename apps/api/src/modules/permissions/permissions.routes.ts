import { Hono } from "hono";
import { requireAuth, requireOrganization, requireRole } from "../../middleware/auth-middleware";
import {
  createPermission,
  getPermissions,
  getPendingRequests,
  getPermissionById,
  updatePermission,
  cancelPermission,
  approvePermission,
  rejectPermission,
  uploadDocuments,
} from "./permissions.controller";

const permissionsRouter = new Hono();
const ADMIN_ROLES = ["owner", "admin"];

permissionsRouter.post(
  "/",
  requireAuth,
  requireOrganization,
  createPermission
);

permissionsRouter.get(
  "/",
  requireAuth,
  requireOrganization,
  getPermissions
);

permissionsRouter.get(
  "/pending",
  requireAuth,
  requireOrganization,
  requireRole(ADMIN_ROLES),
  getPendingRequests
);

permissionsRouter.get(
  "/:id",
  requireAuth,
  requireOrganization,
  getPermissionById
);

permissionsRouter.put(
  "/:id",
  requireAuth,
  requireOrganization,
  updatePermission
);

permissionsRouter.delete(
  "/:id",
  requireAuth,
  requireOrganization,
  cancelPermission
);

permissionsRouter.post(
  "/:id/approve",
  requireAuth,
  requireOrganization,
  requireRole(ADMIN_ROLES),
  approvePermission
);

permissionsRouter.post(
  "/:id/reject",
  requireAuth,
  requireOrganization,
  requireRole(ADMIN_ROLES),
  rejectPermission
);

permissionsRouter.post(
  "/:id/documents",
  requireAuth,
  requireOrganization,
  uploadDocuments
);

export default permissionsRouter;




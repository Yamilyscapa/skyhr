import { Hono } from "hono";
import { requireAuth, requireOrganization, requireRole } from "../../middleware/auth-middleware";
import {
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncementById,
  getAnnouncements,
  updateAnnouncement,
} from "./announcements.controller";

const announcementsRouter = new Hono();
const ADMIN_ROLES = ["owner", "admin"];

announcementsRouter.post(
  "/",
  requireAuth,
  requireOrganization,
  requireRole(ADMIN_ROLES),
  createAnnouncement
);

announcementsRouter.get(
  "/",
  requireAuth,
  requireOrganization,
  getAnnouncements
);

announcementsRouter.get(
  "/:id",
  requireAuth,
  requireOrganization,
  getAnnouncementById
);

announcementsRouter.put(
  "/:id",
  requireAuth,
  requireOrganization,
  requireRole(ADMIN_ROLES),
  updateAnnouncement
);

announcementsRouter.delete(
  "/:id",
  requireAuth,
  requireOrganization,
  requireRole(ADMIN_ROLES),
  deleteAnnouncement
);

export default announcementsRouter;

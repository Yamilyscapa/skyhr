import { Hono } from "hono";
import {
  requireAuth,
  requireOrganization,
} from "../../middleware/auth-middleware";
import {
  assignGeofencesToUser,
  removeGeofenceFromUserController,
  removeAllGeofencesFromUserController,
  getUserGeofencesController,
  getGeofenceUsersController,
  checkUserGeofenceAccessController,
} from "./user-geofence.controller";

export const userGeofenceRoutes = new Hono();

// Assign geofences to a user (supports single, multiple, or all)
userGeofenceRoutes.post(
  "/assign",
  requireAuth,
  requireOrganization,
  assignGeofencesToUser
);

// Remove a specific geofence from a user
userGeofenceRoutes.post(
  "/remove",
  requireAuth,
  requireOrganization,
  removeGeofenceFromUserController
);

// Remove all geofences from a user
userGeofenceRoutes.post(
  "/remove-all",
  requireAuth,
  requireOrganization,
  removeAllGeofencesFromUserController
);

// Get all geofences assigned to a user
userGeofenceRoutes.get(
  "/user-geofences",
  requireAuth,
  requireOrganization,
  getUserGeofencesController
);

// Get all users assigned to a geofence
userGeofenceRoutes.get(
  "/geofence-users",
  requireAuth,
  requireOrganization,
  getGeofenceUsersController
);

// Check if a user has access to a specific geofence
userGeofenceRoutes.post(
  "/check-access",
  requireAuth,
  requireOrganization,
  checkUserGeofenceAccessController
);

export default userGeofenceRoutes;


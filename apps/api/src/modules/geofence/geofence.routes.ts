import { Hono } from "hono";
import { requireAuth, requireOrganization } from "../../middleware/auth-middleware";
import { createGeofence, getGeofence, getGeofencesByOrganization, isInGeofence } from "./geofence.controller";
import type { Context } from "hono";

export const geofenceRoutes = new Hono()

geofenceRoutes.post("/create", requireAuth, requireOrganization, createGeofence);
geofenceRoutes.post("/get", requireAuth, requireOrganization, getGeofence);
geofenceRoutes.post("/is-in", requireAuth, requireOrganization, isInGeofence);
geofenceRoutes.get("/get-by-organization", requireAuth, requireOrganization, getGeofencesByOrganization);

export default geofenceRoutes;
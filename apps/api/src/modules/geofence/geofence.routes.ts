import { Hono } from "hono";
import { requireAuth, requireOrganization } from "../../middleware/auth-middleware";
import { createGeofence, getGeofence, getGeofencesByOrganization, isInGeofence, listLocations } from "./geofence.controller";

export const geofenceRoutes = new Hono()

geofenceRoutes.post("/create", requireAuth, requireOrganization, createGeofence);
geofenceRoutes.post("/get", requireAuth, requireOrganization, getGeofence);
geofenceRoutes.post("/is-in", requireAuth, requireOrganization, isInGeofence);
geofenceRoutes.get("/locations", requireAuth, requireOrganization, listLocations);
geofenceRoutes.get("/get-by-organization", requireAuth, requireOrganization, getGeofencesByOrganization);

export default geofenceRoutes;

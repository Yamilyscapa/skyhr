import type { Context } from "hono";
import { ErrorCodes, errorResponse, successResponse } from "../../core/http";
import { geofence } from "../../db/schema";
import { db } from "../../db";
import { and, count, desc, eq } from "drizzle-orm";
import { createObfuscatedQrCode } from "../../utils/qr-generation";
import {
  buildPaginationMetadata,
  PaginationError,
  parsePaginationParams,
} from "../../utils/pagination";

interface GeofenceBody {
    name: string;
    type: "circular" | "polygon";
    center_latitude: number;
    center_longitude: number;
    radius: number;
    organization_id: string;
}

function validateGeofenceBody(body: any): GeofenceBody {
    if (!body || !body.name || !body.center_latitude || !body.center_longitude || !body.radius || !body.organization_id) {
        throw new Error("Invalid body: name, center_latitude, center_longitude, radius and organization_id are required");
    }

    const center_latitude = Number(body.center_latitude);
    const center_longitude = Number(body.center_longitude);
    const radius = Number(body.radius);
    if (!Number.isFinite(center_latitude) || !Number.isFinite(center_longitude) || !Number.isFinite(radius)) {
        throw new Error("center_latitude, center_longitude and radius must be numbers");
    }

    const gf: GeofenceBody = {
        name: body.name,
        type: "circular", // ! Only circular geofences are supported for now
        center_latitude,
        center_longitude,
        radius,
        organization_id: body.organization_id,
    }

    return gf;
}

export async function createGeofence(c: Context): Promise<Response> {
    const body = await c.req.json();

    try {
        const gf = validateGeofenceBody(body);
        if (!gf) return errorResponse(c, "Invalid body: name, center_latitude, center_longitude, radius and organization_id are required", ErrorCodes.BAD_REQUEST);

        const newGeofence = await db.insert(geofence).values(gf).returning();

        if (!newGeofence || newGeofence.length === 0) return errorResponse(c, "Failed to create geofence", ErrorCodes.INTERNAL_SERVER_ERROR);

        const url = await createObfuscatedQrCode(newGeofence[0]?.organization_id as string, newGeofence[0]?.id as string);

        if (!url) return errorResponse(c, "Failed to create obfuscated QR code", ErrorCodes.INTERNAL_SERVER_ERROR);

        const updatedGeofence = await db.update(geofence)
            .set({ qr_code_url: typeof url === "string" ? url : String(url) })
            .where(eq(geofence.id, newGeofence[0]?.id as string))
            .returning();

        if (!updatedGeofence || updatedGeofence.length === 0) return errorResponse(c, "Failed to update geofence", ErrorCodes.INTERNAL_SERVER_ERROR);

        return successResponse(c, {
            message: "Geofence created successfully",
            data: updatedGeofence[0],
        });
    } catch (error) {
        return errorResponse(c, "Failed to create geofence", ErrorCodes.INTERNAL_SERVER_ERROR);
    }
}

export async function getGeofence(c: Context): Promise<Response> {
    const { id } = await c.req.json();

    if (!id) return errorResponse(c, "Geofence ID is required", ErrorCodes.BAD_REQUEST);

    try {
        const gf = await db.select().from(geofence).where(eq(geofence.id, id as string));
        if (!gf || gf.length === 0) return errorResponse(c, "Geofence not found", ErrorCodes.NOT_FOUND);

        return successResponse(c, {
            message: "Geofence found",
            data: gf[0],
        });
    } catch (error) {
        return errorResponse(c, "Failed to get geofence", ErrorCodes.INTERNAL_SERVER_ERROR);
    }
}

export async function listLocations(c: Context): Promise<Response> {
    try {
        const organization = c.get("organization");
        if (!organization) {
            return errorResponse(c, "Organization context required", ErrorCodes.FORBIDDEN);
        }

        const pagination = parsePaginationParams(c.req.query("page"), c.req.query("pageSize"));
        const whereClause = and(
            eq(geofence.organization_id, organization.id),
            eq(geofence.active, true),
        );

        const totalResult = await db
            .select({ value: count() })
            .from(geofence)
            .where(whereClause);

        const total = Number(totalResult[0]?.value ?? 0);

        const rows = await db
            .select({
                id: geofence.id,
                name: geofence.name,
                type: geofence.type,
                center_latitude: geofence.center_latitude,
                center_longitude: geofence.center_longitude,
                radius: geofence.radius,
                qr_code_url: geofence.qr_code_url,
                active: geofence.active,
                created_at: geofence.created_at,
            })
            .from(geofence)
            .where(whereClause)
            .orderBy(desc(geofence.created_at))
            .limit(pagination.limit)
            .offset(pagination.offset);

        return successResponse(c, {
            data: rows,
            pagination: buildPaginationMetadata(pagination, total),
        });
    } catch (error) {
        if (error instanceof PaginationError) {
            return errorResponse(c, error.message, ErrorCodes.BAD_REQUEST);
        }
        console.error("listLocations error:", error);
        return errorResponse(c, "Failed to list locations", ErrorCodes.INTERNAL_SERVER_ERROR);
    }
}

export async function getGeofencesByOrganization(c: Context): Promise<Response> {
    try {
        const organization_id = c.req.query("id");

        if (!organization_id) return errorResponse(c, "Organization ID is required", ErrorCodes.BAD_REQUEST);

        const pagination = parsePaginationParams(c.req.query("page"), c.req.query("pageSize"));

        const whereClause = eq(geofence.organization_id, organization_id as string);

        const totalResult = await db
            .select({ value: count() })
            .from(geofence)
            .where(whereClause);

        const total = Number(totalResult[0]?.value ?? 0);

        if (total === 0) return errorResponse(c, "Geofences not found", ErrorCodes.NOT_FOUND);

        const baseQuery = db
            .select()
            .from(geofence)
            .where(whereClause)
            .orderBy(desc(geofence.created_at));

        const gfs = await baseQuery
            .limit(pagination.limit)
            .offset(pagination.offset);

        return successResponse(c, {
            message: "Geofences found",
            data: gfs,
            pagination: buildPaginationMetadata(pagination, total),
        });
    } catch (error) {
        if (error instanceof PaginationError) {
            return errorResponse(c, error.message, ErrorCodes.BAD_REQUEST);
        }
        return errorResponse(c, "Failed to get geofences by organization", ErrorCodes.INTERNAL_SERVER_ERROR);
    }
}

/**
 * Calculates the great-circle distance between two points on Earth using the Haversine formula
 * @param lat1 - Latitude of point 1 in degrees
 * @param lon1 - Longitude of point 1 in degrees
 * @param lat2 - Latitude of point 2 in degrees
 * @param lon2 - Longitude of point 2 in degrees
 * @returns Distance in meters
 */
function calculateHaversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const EARTH_RADIUS_METERS = 6371000; // Earth's mean radius in meters

    // Convert degrees to radians
    const toRadians = (degrees: number): number => degrees * (Math.PI / 180);

    const lat1Radians = toRadians(lat1);
    const lat2Radians = toRadians(lat2);
    const latDifferenceRadians = toRadians(lat2 - lat1);
    const lonDifferenceRadians = toRadians(lon2 - lon1);

    // Haversine formula
    const a = Math.sin(latDifferenceRadians / 2) * Math.sin(latDifferenceRadians / 2) +
        Math.cos(lat1Radians) * Math.cos(lat2Radians) *
        Math.sin(lonDifferenceRadians / 2) * Math.sin(lonDifferenceRadians / 2);

    const angularDistance = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS_METERS * angularDistance;
}

export async function isInGeofence(c: Context): Promise<Response> {
    try {
        const { latitude, longitude, geofence_id } = await c.req.json();

        if (!latitude || !longitude || !geofence_id) return errorResponse(c, "Latitude, longitude and geofence_id are required", ErrorCodes.BAD_REQUEST);

        const gf = await db.select().from(geofence).where(eq(geofence.id, geofence_id as string));
        if (!gf || gf.length === 0) return errorResponse(c, "Geofence not found", ErrorCodes.NOT_FOUND);

        const gfRow = gf[0];

        if (gfRow?.center_latitude == null || gfRow?.center_longitude == null) {
            return errorResponse(c, "Invalid geofence center coordinates", ErrorCodes.BAD_REQUEST);
        }

        const centerLat = gfRow.center_latitude;
        const centerLon = gfRow.center_longitude;

        if (isNaN(Number(latitude)) || isNaN(Number(longitude))) {
            return errorResponse(c, "Invalid user coordinates", ErrorCodes.BAD_REQUEST);
        }

        const distance = calculateHaversineDistance(
            Number(latitude),
            Number(longitude),
            centerLat,
            centerLon
        );

        return successResponse(c, {
            message: "User is in geofence",
            data: { isInGeofence: distance <= (gfRow.radius ?? 0) },
        });
    } catch (error) {
        return errorResponse(c, "Failed to check if user is in geofence", ErrorCodes.INTERNAL_SERVER_ERROR);
    }
}

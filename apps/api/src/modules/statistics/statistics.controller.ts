import type { Context } from "hono";
import { successResponse, errorResponse, ErrorCodes } from "../../core/http";
import {
  calculateAttendanceMetrics,
  calculateCostMetrics,
  getGeofenceStats,
  getTrends,
  calculateUserAttendanceStats
} from "./statistics.service";
import type { Period, DateRange } from "./types";

function getDateRange(period: Period, start?: string, end?: string): DateRange {
  let startDate: Date;
  let endDate: Date;

  if (start && end) {
    startDate = new Date(start);
    endDate = new Date(end);
    // Set end date to end of day
    endDate.setHours(23, 59, 59, 999);
  } else {
    const now = new Date();
    endDate = new Date(now);
    
    // Default ranges based on period
    if (period === 'daily') {
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'weekly') {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
    } else if (period === 'monthly') {
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 1);
    } else if (period === 'quarterly') {
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 3);
    } else {
      // Default to monthly
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 1);
    }
  }

  return { startDate, endDate };
}

export async function getDashboardStats(c: Context): Promise<Response> {
  try {
    const organization = c.get("organization");
    if (!organization) return errorResponse(c, "Organization required", ErrorCodes.UNAUTHORIZED);

    const period = (c.req.query("period") as Period) || "monthly";
    const startDate = c.req.query("start_date");
    const endDate = c.req.query("end_date");
    const locationId = c.req.query("location_id");
    const range = getDateRange(period, startDate, endDate);
    
    const metrics = await calculateAttendanceMetrics(organization.id, range, locationId);
    
    // Traffic light logic
    let trafficLight: 'green' | 'yellow' | 'red' = 'green';
    if (metrics.attendanceRate < 90) trafficLight = 'red';
    else if (metrics.attendanceRate < 95) trafficLight = 'yellow';
    
    // Alerts logic
    const alerts = [];
    if (metrics.attendanceRate < 90) {
      alerts.push({
        type: 'attendance',
        severity: 'critical',
        message: `Tasa de asistencia crítica: ${metrics.attendanceRate.toFixed(1)}%`
      });
    }
    if (metrics.unjustifiedAbsenteeism > 5) {
      alerts.push({
        type: 'pattern',
        severity: 'warning',
        message: `Alta tasa de ausentismo: ${metrics.unjustifiedAbsenteeism.toFixed(1)}%`
      });
    }

    return successResponse(c, {
      message: "Estadísticas del dashboard recuperadas",
      data: {
        organization_id: organization.id,
        period,
        metrics,
        traffic_light: trafficLight,
        alerts
      }
    });
  } catch (e) {
    console.error("Dashboard stats error:", e);
    return errorResponse(c, "Failed to retrieve dashboard stats", ErrorCodes.INTERNAL_SERVER_ERROR);
  }
}

export async function getAttendanceReport(c: Context): Promise<Response> {
  try {
    const organization = c.get("organization");
    if (!organization) return errorResponse(c, "Organization required", ErrorCodes.UNAUTHORIZED);

    const period = (c.req.query("period") as Period) || "monthly";
    const startDate = c.req.query("start_date");
    const endDate = c.req.query("end_date");
    const locationId = c.req.query("location_id");
    
    const range = getDateRange(period, startDate, endDate);
    
    const metrics = await calculateAttendanceMetrics(organization.id, range, locationId);

    return successResponse(c, {
      message: "Reporte de asistencia recuperado",
      data: {
        period,
        range: { start: range.startDate, end: range.endDate },
        metrics
      }
    });
  } catch (e) {
    console.error("Attendance report error:", e);
    return errorResponse(c, "Failed to retrieve attendance report", ErrorCodes.INTERNAL_SERVER_ERROR);
  }
}

export async function getCostAnalysis(c: Context): Promise<Response> {
  try {
    const organization = c.get("organization");
    if (!organization) return errorResponse(c, "Organization required", ErrorCodes.UNAUTHORIZED);

    const period = (c.req.query("period") as Period) || "monthly";
    const startDate = c.req.query("start_date");
    const endDate = c.req.query("end_date");
    
    const range = getDateRange(period, startDate, endDate);
    
    const costs = await calculateCostMetrics(organization.id, range);

    return successResponse(c, {
      message: "Análisis de costos recuperado",
      data: costs
    });
  } catch (e) {
    console.error("Cost analysis error:", e);
    return errorResponse(c, "Failed to retrieve cost analysis", ErrorCodes.INTERNAL_SERVER_ERROR);
  }
}

export async function getLocationComparison(c: Context): Promise<Response> {
  try {
    const organization = c.get("organization");
    if (!organization) return errorResponse(c, "Organization required", ErrorCodes.UNAUTHORIZED);

    const period = (c.req.query("period") as Period) || "monthly";
    const range = getDateRange(period);
    
    const stats = await getGeofenceStats(organization.id, range);

    return successResponse(c, {
      message: "Comparación de ubicaciones recuperada",
      data: {
        rankings: stats.rankings,
        heatmap: stats.heatmap,
        best_performer: stats.rankings[0] || null,
        needs_attention: stats.rankings.filter(r => r.attendanceRate < 90)
      }
    });
  } catch (e) {
    console.error("Location comparison error:", e);
    return errorResponse(c, "Failed to retrieve location comparison", ErrorCodes.INTERNAL_SERVER_ERROR);
  }
}

export async function getTrendsAnalysis(c: Context): Promise<Response> {
  try {
    const organization = c.get("organization");
    if (!organization) return errorResponse(c, "Organization required", ErrorCodes.UNAUTHORIZED);
    
    const trends = await getTrends(organization.id);

    return successResponse(c, {
      message: "Análisis de tendencias recuperado",
      data: trends
    });
  } catch (e) {
    console.error("Trends analysis error:", e);
    return errorResponse(c, "Failed to retrieve trends analysis", ErrorCodes.INTERNAL_SERVER_ERROR);
  }
}

export async function getUserStatistics(c: Context): Promise<Response> {
  try {
    const organization = c.get("organization");
    if (!organization) return errorResponse(c, "Organization required", ErrorCodes.UNAUTHORIZED);

    const userIdParam = c.req.param("userId");
    const emailQuery = c.req.query("email");
    
    // Determine identifier: either path param or query param
    let identifier = userIdParam;
    if (!identifier && emailQuery) {
      identifier = emailQuery;
    } else if (identifier && emailQuery) {
        // If both, prioritize path param but technically this case is routed via /user/:userId
        // If calling /user/by-email, userIdParam is undefined
    }
    
    if (!identifier) {
        return errorResponse(c, "User ID or Email is required", ErrorCodes.BAD_REQUEST);
    }

    const period = (c.req.query("period") as Period) || "monthly";
    const startDate = c.req.query("start_date");
    const endDate = c.req.query("end_date");
    
    const range = getDateRange(period, startDate, endDate);
    
    const stats = await calculateUserAttendanceStats(identifier, organization.id, range, period);
    
    if (!stats) {
        return errorResponse(c, "User not found or not in organization", ErrorCodes.NOT_FOUND);
    }

    return successResponse(c, {
      message: "Estadísticas del usuario recuperadas",
      data: stats
    });
  } catch (e) {
    console.error("User statistics error:", e);
    return errorResponse(c, "Failed to retrieve user statistics", ErrorCodes.INTERNAL_SERVER_ERROR);
  }
}

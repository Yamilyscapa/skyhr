import type { Context } from "hono";
import { successResponse, errorResponse } from "../../core/http";
import {
  listVisitors,
  getVisitorById,
  createVisitor,
  updateVisitor,
  approveVisitor,
  rejectVisitor,
  cancelVisitor,
} from "./visitors.service";
import { validateVisitorQrPayload } from "./visitors.qr";

function getOrgId(c: Context) {
  const org = c.get("organization");
  return (org?.id as string | undefined) || c.req.header("x-organization-id") || undefined;
}

export const list = async (c: Context) => {
  try {
    const orgId = getOrgId(c);
    if (!orgId) return errorResponse(c, "organizationId is required", 400);

    const url = new URL(c.req.url);
    const status = (url.searchParams.get("status") || undefined) as any;
    const q = url.searchParams.get("q") || undefined;
    const page = Number(url.searchParams.get("page") || 1);
    const pageSize = Math.min(50, Number(url.searchParams.get("pageSize") || 20));

    const { rows, meta } = await listVisitors({ organizationId: orgId, status, q, page, pageSize });
    return successResponse(c, { message: "Visitors retrieved", data: rows, meta });
  } catch (e: any) {
    return errorResponse(c, e.message ?? "Internal error", 500);
  }
};

export const getOne = async (c: Context) => {
  try {
    const orgId = getOrgId(c);
    if (!orgId) return errorResponse(c, "organizationId is required", 400);
    const id = c.req.param("id");
    const row = await getVisitorById(orgId, id);
    if (!row) return errorResponse(c, "Not found", 404);
    return successResponse(c, { message: "Visitor retrieved", data: row });
  } catch (e: any) {
    return errorResponse(c, e.message ?? "Internal error", 500);
  }
};

export const create = async (c: Context) => {
  try {
    const orgId = getOrgId(c);
    if (!orgId) return errorResponse(c, "organizationId is required", 400);
    const user = c.get("user");
    const role = c.get("role");
    const body = await c.req.json();
    let { accessAreas }: { accessAreas?: string[] } = body;

    if (accessAreas && accessAreas.length > 0) {
      const normalizedAccessAreas = (accessAreas.map((area: string) => (area.toLowerCase()).trim()));
      
      // Normalize access areas to lowercase and trim whitespace
      accessAreas = normalizedAccessAreas;
    } else {
      accessAreas = [];
      return errorResponse(c, "accessAreas is required", 400);
    }

    const inserted = await createVisitor({
      organizationId: orgId,
      userId: user.id,
      name: String(body.name),
      accessAreas: accessAreas,
      entryDate: new Date(body.entryDate),
      exitDate: new Date(body.exitDate),
      approveNow: Boolean(body.approveNow),
      isPrivileged: role === "owner" || role === "admin",
    });

    return successResponse(c, { message: "Visitor created", data: inserted });
  } catch (e: any) {
    const msg = e.message ?? "Internal error";
    const code = msg.includes("Forbidden") ? 403 : msg.includes("entryDate") ? 400 : 500;
    return errorResponse(c, msg, code);
  }
};

export const update = async (c: Context) => {
  try {
    const orgId = getOrgId(c);
    if (!orgId) return errorResponse(c, "organizationId is required", 400);
    const user = c.get("user");
    const role = c.get("role");
    const id = c.req.param("id");
    const body = await c.req.json();
    let { accessAreas } = body;

    if (accessAreas && accessAreas.length > 0) {
      const normalizedAccessAreas = (accessAreas.map((area: string) => (area.toLowerCase()).trim()));
      // Check if any area is duplicated
      if (normalizedAccessAreas.some((area: string) => normalizedAccessAreas.includes(area))) {
        return errorResponse(c, "accessAreas must be a unique array", 400);
      }
      // Normalize access areas to lowercase and trim whitespace
      accessAreas = normalizedAccessAreas;
    } else {
      accessAreas = [];
      return errorResponse(c, "accessAreas is required", 400);
    }

    const updated = await updateVisitor({
      organizationId: orgId,
      id,
      userId: user.id,
      isPrivileged: role === "owner" || role === "admin",
      patch: {
        name: body.name,
        accessAreas: accessAreas,
        entryDate: body.entryDate ? new Date(body.entryDate) : undefined,
        exitDate: body.exitDate ? new Date(body.exitDate) : undefined,
      },
    });

    if (!updated) return errorResponse(c, "Not found", 404);
    return successResponse(c, { message: "Visitor updated", data: updated });
  } catch (e: any) {
    const msg = e.message ?? "Internal error";
    const code = msg.includes("Forbidden") ? 403 : msg.includes("entryDate") ? 400 : 500;
    return errorResponse(c, msg, code);
  }
};

export const approve = async (c: Context) => {
  try {
    const orgId = getOrgId(c);
    if (!orgId) return errorResponse(c, "organizationId is required", 400);
    const user = c.get("user");
    const id = c.req.param("id");
    const updated = await approveVisitor(orgId, id, user.id);
    if (!updated) return errorResponse(c, "Not found", 404);
    return successResponse(c, { message: "Visitor approved", data: updated });
  } catch (e: any) {
    return errorResponse(c, e.message ?? "Internal error", 500);
  }
};

export const reject = async (c: Context) => {
  try {
    const orgId = getOrgId(c);
    if (!orgId) return errorResponse(c, "organizationId is required", 400);
    const id = c.req.param("id");
    const updated = await rejectVisitor(orgId, id);
    if (!updated) return errorResponse(c, "Not found", 404);
    return successResponse(c, { message: "Visitor rejected", data: updated });
  } catch (e: any) {
    return errorResponse(c, e.message ?? "Internal error", 500);
  }
};

export const cancel = async (c: Context) => {
  try {
    const orgId = getOrgId(c);
    if (!orgId) return errorResponse(c, "organizationId is required", 400);
    const user = c.get("user");
    const role = c.get("role");
    const id = c.req.param("id");
    const updated = await cancelVisitor(orgId, id, user.id, role === "owner" || role === "admin");
    if (!updated) return errorResponse(c, "Not found", 404);
    return successResponse(c, { message: "Visitor cancelled", data: updated });
  } catch (e: any) {
    const msg = e.message ?? "Internal error";
    const code = msg.includes("Forbidden") ? 403 : 500;
    return errorResponse(c, msg, code);
  }
};

export const validateQr = async (c: Context) => {
    try {
        const body = await c.req.json();
        const { qr_data } = body;

        if (!qr_data) return errorResponse(c, "qr_data is required", 400);

        // Decode payload
        let payload;
        try {
            payload = validateVisitorQrPayload(qr_data);
        } catch (e) {
            return errorResponse(c, "Invalid QR code", 400);
        }

        // Verify it belongs to the active organization (security check)
        const orgId = getOrgId(c);
        if (!orgId) return errorResponse(c, "organizationId is required", 400);

        if (payload.organizationId !== orgId) {
            return errorResponse(c, "Visitor does not belong to this organization", 403);
        }

        // Fetch fresh visitor data from DB to ensure status is current
        const visitor = await getVisitorById(orgId, payload.id);
        if (!visitor) {
            return errorResponse(c, "Visitor not found", 404);
        }

        return successResponse(c, { message: "QR valid", data: visitor });
    } catch (e: any) {
        return errorResponse(c, e.message ?? "Internal error", 500);
    }
};

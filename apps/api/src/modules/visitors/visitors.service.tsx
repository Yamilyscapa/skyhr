import { randomUUID } from "crypto";
import { db } from "../../db";
import { visitors, users } from "../../db/schema";
import { aliasedTable, and, between, eq, ilike, or, sql, asc } from "drizzle-orm";
import { generateAndStoreVisitorQr } from "./visitors.qr";

// Aliased users tables for resolving creator/approver display names via LEFT JOIN.
const creator = aliasedTable(users, "creator");
const approver = aliasedTable(users, "approver");

// Shapes a joined visitor row into the snake_case VisitorRow response, adding
// human-readable created_by_name / approved_by_name fields.
function mapVisitorRow(row: {
  visitor: typeof visitors.$inferSelect;
  created_by_name: string | null;
  approved_by_name: string | null;
}) {
  return {
    ...row.visitor,
    created_by_name: row.created_by_name ?? null,
    approved_by_name: row.approved_by_name ?? null,
  };
}

export type ListParams = {
  organizationId: string;
  status?: "pending" | "approved" | "rejected" | "cancelled";
  q?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
};

export async function listVisitors(params: ListParams) {
  const { organizationId, status, q, from, to, page = 1, pageSize = 20 } = params;

  const predicates = [eq(visitors.organization_id, organizationId)] as any[];
  if (status) predicates.push(eq(visitors.status, status));
  if (q) predicates.push(or(ilike(visitors.name, `%${q}%`), ilike(visitors.access_areas, `%${q}%`)));
  if (from && to) predicates.push(between(visitors.entry_date, from, to));

  const offset = (page - 1) * pageSize;

  // Build optional where expression once
  const whereExpr = predicates.length ? and(...predicates) : undefined;

  const selection = {
    visitor: visitors,
    created_by_name: creator.name,
    approved_by_name: approver.name,
  };

  const rowsQuery = whereExpr
    ? db
      .select(selection)
      .from(visitors)
      .leftJoin(creator, eq(creator.id, visitors.created_by_user_id))
      .leftJoin(approver, eq(approver.id, visitors.approved_by_user_id))
      .where(whereExpr)
      .orderBy(asc(visitors.entry_date))
      .limit(pageSize)
      .offset(offset)
    : db
      .select(selection)
      .from(visitors)
      .leftJoin(creator, eq(creator.id, visitors.created_by_user_id))
      .leftJoin(approver, eq(approver.id, visitors.approved_by_user_id))
      .orderBy(asc(visitors.entry_date))
      .limit(pageSize)
      .offset(offset);

  const countQuery = whereExpr
    ? db
      .select({ count: sql<number>`count(*)` })
      .from(visitors)
      .where(whereExpr)
    : db.select({ count: sql<number>`count(*)` }).from(visitors);

  const [rows, countRows] = await Promise.all([rowsQuery, countQuery]);

  const total = Number(countRows?.[0]?.count ?? 0);

  return { rows: rows.map(mapVisitorRow), meta: { page, pageSize, total } };
}

export async function getVisitorById(organizationId: string, id: string) {
  const rows = await db
    .select({
      visitor: visitors,
      created_by_name: creator.name,
      approved_by_name: approver.name,
    })
    .from(visitors)
    .leftJoin(creator, eq(creator.id, visitors.created_by_user_id))
    .leftJoin(approver, eq(approver.id, visitors.approved_by_user_id))
    .where(and(eq(visitors.id, id), eq(visitors.organization_id, organizationId)))
    .limit(1);
  const row = rows[0];
  return row ? mapVisitorRow(row) : null;
}

export type CreateInput = {
  organizationId: string;
  userId: string;
  name: string;
  accessAreas: string[];
  entryDate: Date;
  exitDate: Date;
  approveNow?: boolean;
  isPrivileged?: boolean;
};

export async function createVisitor(input: CreateInput) {
  const { organizationId, userId, name, accessAreas, entryDate, exitDate, approveNow, isPrivileged } = input;

  if (entryDate > exitDate) throw new Error("entryDate must be before or equal to exitDate");

  let status: "pending" | "approved" = "pending";
  let approvedByUserId: string | null = null;
  let approvedAt: Date | null = null;

  if (approveNow && isPrivileged) {
    status = "approved";
    approvedByUserId = userId;
    approvedAt = new Date();
  }

  const [inserted] = await db
    .insert(visitors)
    .values({
      organization_id: String(organizationId),
      created_by_user_id: String(userId),
      // Generar un token único temporal mientras se conecta el flujo real de QR
      qr_token: randomUUID(), // ! DEPRECATED: Will be replaced with the real QR token
      name: String(name),
      access_areas: accessAreas,
      entry_date: new Date(entryDate),
      exit_date: new Date(exitDate),
      status,
      approved_by_user_id: approvedByUserId,
      approved_at: approvedAt,
    })
    .returning();

  if (!inserted) {
    throw new Error("Failed to create visitor");
  }

  // Generate and store QR code
  // We don't await this to block the response, but we do want to update the record if successful.
  // Actually, for consistency, let's await it but catch errors so we don't fail the request.
  try {
    const qrUrl = await generateAndStoreVisitorQr({
      id: inserted.id,
      organizationId: inserted.organization_id,
      name: inserted.name,
      entryDate: inserted.entry_date,
      exitDate: inserted.exit_date,
      accessAreas: inserted.access_areas,
    });

    if (qrUrl) {
      await db
        .update(visitors)
        .set({ qr_url: qrUrl })
        .where(eq(visitors.id, inserted.id));

      inserted.qr_url = qrUrl;
    }
  } catch (error) {
    console.error(`Failed to generate QR for visitor ${inserted.id}:`, error);
    // Continue without failing
  }

  return inserted;
}

export async function regenerateVisitorQr(organizationId: string, visitorId: string) {
  const visitor = await getVisitorById(organizationId, visitorId);
  if (!visitor) throw new Error("Visitor not found");

  const qrUrl = await generateAndStoreVisitorQr({
    id: visitor.id,
    organizationId: visitor.organization_id,
    name: visitor.name,
    entryDate: visitor.entry_date,
    exitDate: visitor.exit_date,
    accessAreas: visitor.access_areas,
  });

  if (qrUrl) {
    const [updated] = await db
      .update(visitors)
      .set({ qr_url: qrUrl, updated_at: new Date() })
      .where(eq(visitors.id, visitorId))
      .returning();
    return updated;
  }

  return visitor;
}

export type UpdateInput = {
  organizationId: string;
  id: string;
  userId: string;
  patch: Partial<{ name: string; accessAreas: string; entryDate: Date; exitDate: Date }>;
  isPrivileged: boolean;
};

export async function updateVisitor(input: UpdateInput) {
  const { organizationId, id, userId, patch, isPrivileged } = input;
  const row = await getVisitorById(organizationId, id);
  if (!row) return null;
  if (row.status === "cancelled") throw new Error("Cannot edit cancelled visitor");

  const isOwner = row.created_by_user_id === userId || isPrivileged;
  if (!isOwner) throw new Error("Forbidden");

  const next: any = { updated_at: new Date() };
  if (patch.name !== undefined) next.name = patch.name;
  if (patch.accessAreas !== undefined) next.access_areas = patch.accessAreas;
  if (patch.entryDate !== undefined) next.entry_date = patch.entryDate;
  if (patch.exitDate !== undefined) next.exit_date = patch.exitDate;

  if (next.entry_date && next.exit_date && next.entry_date > next.exit_date)
    throw new Error("entryDate must be before or equal to exitDate");

  const [updated] = await db
    .update(visitors)
    .set(next)
    .where(and(eq(visitors.id, id), eq(visitors.organization_id, organizationId)))
    .returning();

  return updated;
}

export async function approveVisitor(organizationId: string, id: string, userId: string) {
  const row = await getVisitorById(organizationId, id);
  if (!row) return null;
  if (row.status === "approved") return row;

  const [updated] = await db
    .update(visitors)
    .set({ status: "approved", approved_by_user_id: userId, approved_at: new Date(), updated_at: new Date() })
    .where(and(eq(visitors.id, id), eq(visitors.organization_id, organizationId)))
    .returning();

  return updated;
}

export async function rejectVisitor(organizationId: string, id: string) {
  const row = await getVisitorById(organizationId, id);
  if (!row) return null;

  const [updated] = await db
    .update(visitors)
    .set({ status: "rejected", approved_by_user_id: null, approved_at: null, updated_at: new Date() })
    .where(and(eq(visitors.id, id), eq(visitors.organization_id, organizationId)))
    .returning();

  return updated;
}

export async function cancelVisitor(organizationId: string, id: string, userId: string, isPrivileged: boolean) {
  const row = await getVisitorById(organizationId, id);
  if (!row) return null;

  const isOwner = row.created_by_user_id === userId || isPrivileged;
  if (!isOwner) throw new Error("Forbidden");
  if (row.status === "cancelled") return row;

  const [updated] = await db
    .update(visitors)
    .set({ status: "cancelled", updated_at: new Date() })
    .where(and(eq(visitors.id, id), eq(visitors.organization_id, organizationId)))
    .returning();

  return updated;
}

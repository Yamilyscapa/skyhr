import { and, count, desc, eq, gt, isNull, lte, or } from "drizzle-orm";
import { db } from "../../db";
import { announcement, users } from "../../db/schema";
import type { PaginationParams } from "../../utils/pagination";

export const ANNOUNCEMENT_PRIORITIES = ["normal", "important", "urgent"] as const;

export type AnnouncementPriority = (typeof ANNOUNCEMENT_PRIORITIES)[number];
export type AnnouncementRecord = typeof announcement.$inferSelect;
export type AnnouncementInsert = typeof announcement.$inferInsert;

export interface AnnouncementFilters {
  includeExpired?: boolean;
  includeFuture?: boolean;
}

export interface CreateAnnouncementData {
  organizationId: string;
  title: string;
  content: string;
  priority: AnnouncementPriority;
  publishedAt: Date;
  expiresAt?: Date | null;
  createdByUserId?: string | null;
}

export interface AnnouncementWithAuthor extends AnnouncementRecord {
  author_name?: string | null;
}

export interface UpdateAnnouncementData {
  title?: string;
  content?: string;
  priority?: AnnouncementPriority;
  publishedAt?: Date;
  expiresAt?: Date | null;
}

export function mapAnnouncement(row: AnnouncementWithAuthor) {
  return {
    id: row.id,
    organizationId: row.organization_id ?? null,
    title: row.title,
    content: row.content,
    priority: row.priority,
    publishedAt: row.published_at,
    expiresAt: row.expires_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: row.author_name ?? null,
    authorId: row.created_by_user_id ?? null,
  };
}

export function isAnnouncementActive(row: AnnouncementRecord, reference = new Date()) {
  if (row.deleted_at) return false;
  if (row.published_at > reference) return false;
  if (row.expires_at && row.expires_at <= reference) return false;
  return true;
}

export async function createAnnouncement(data: CreateAnnouncementData) {
  const inserted = await db
    .insert(announcement)
    .values({
      organization_id: data.organizationId,
      title: data.title,
      content: data.content,
      priority: data.priority,
      published_at: data.publishedAt,
      expires_at: data.expiresAt ?? null,
      created_by_user_id: data.createdByUserId ?? null,
      updated_at: new Date(),
    } satisfies AnnouncementInsert)
    .returning();

  if (!inserted.length) return null;
  return mapAnnouncement(await hydrateAuthor(inserted[0]!));
}

async function hydrateAuthor(row: AnnouncementRecord): Promise<AnnouncementWithAuthor> {
  if (!row.created_by_user_id) return { ...row, author_name: null };
  const author = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, row.created_by_user_id))
    .limit(1);
  return { ...row, author_name: author[0]?.name ?? null };
}

export async function listAnnouncements(
  organizationId: string,
  filters: AnnouncementFilters = {},
  pagination?: PaginationParams
) {
  const now = new Date();
  let whereClause = and(
    eq(announcement.organization_id, organizationId),
    isNull(announcement.deleted_at)
  );

  if (!filters.includeExpired) {
    whereClause = and(
      whereClause,
      or(isNull(announcement.expires_at), gt(announcement.expires_at, now))
    );
  }

  if (!filters.includeFuture) {
    whereClause = and(whereClause, lte(announcement.published_at, now));
  }

  const totalResult = await db
    .select({ value: count() })
    .from(announcement)
    .where(whereClause);

  const baseQuery = db
    .select({
      row: announcement,
      author_name: users.name,
    })
    .from(announcement)
    .leftJoin(users, eq(users.id, announcement.created_by_user_id))
    .where(whereClause)
    .orderBy(desc(announcement.published_at));

  const rows = await (pagination
    ? baseQuery.limit(pagination.limit).offset(pagination.offset)
    : baseQuery);

  return {
    data: rows.map((r) =>
      mapAnnouncement({ ...r.row, author_name: r.author_name ?? null }),
    ),
    total: Number(totalResult[0]?.value ?? 0),
  };
}

export async function getAnnouncement(
  announcementId: string,
  organizationId: string,
): Promise<AnnouncementWithAuthor | null> {
  const rows = await db
    .select({ row: announcement, author_name: users.name })
    .from(announcement)
    .leftJoin(users, eq(users.id, announcement.created_by_user_id))
    .where(
      and(
        eq(announcement.id, announcementId),
        eq(announcement.organization_id, organizationId),
        isNull(announcement.deleted_at)
      )
    )
    .limit(1);

  if (!rows.length) return null;
  return { ...rows[0]!.row, author_name: rows[0]!.author_name ?? null };
}

export async function updateAnnouncement(announcementId: string, organizationId: string, data: UpdateAnnouncementData) {
  const updates: Partial<AnnouncementInsert> = {
    updated_at: new Date(),
  };

  if (data.title !== undefined) updates.title = data.title;
  if (data.content !== undefined) updates.content = data.content;
  if (data.priority !== undefined) updates.priority = data.priority;
  if (data.publishedAt !== undefined) updates.published_at = data.publishedAt;
  if (data.expiresAt !== undefined) updates.expires_at = data.expiresAt;

  const updated = await db
    .update(announcement)
    .set(updates)
    .where(
      and(
        eq(announcement.id, announcementId),
        eq(announcement.organization_id, organizationId),
        isNull(announcement.deleted_at)
      )
    )
    .returning();

  if (!updated.length) return null;
  return mapAnnouncement(await hydrateAuthor(updated[0]!));
}

export async function deleteAnnouncement(announcementId: string, organizationId: string) {
  const deleted = await db
    .update(announcement)
    .set({
      deleted_at: new Date(),
      updated_at: new Date(),
    })
    .where(
      and(
        eq(announcement.id, announcementId),
        eq(announcement.organization_id, organizationId),
        isNull(announcement.deleted_at)
      )
    )
    .returning();

  if (!deleted.length) return null;
  return mapAnnouncement(await hydrateAuthor(deleted[0]!));
}

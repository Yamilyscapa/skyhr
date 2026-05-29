import { and, count, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { db } from "../../db";
import {
  accounts,
  invitation,
  member,
  organization,
  sessions,
  shift,
  teamMember,
  user_geofence,
  user_payroll,
  user_schedule,
  users,
  geofence,
} from "../../db/schema";
import { deleteFacesByExternalImageId } from "../biometrics/biometrics.service";

export interface ListMembersParams {
  organizationId: string;
  search?: string;
  role?: string;
  limit: number;
  offset: number;
}

export interface MemberRow {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
  department: string | null;
  position: string | null;
  hourlyRate: number | null;
  faceRegistered: boolean;
  emailVerified: boolean;
  banned: boolean;
  createdAt: Date;
  joinedAt: Date;
  shift: {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
    color: string | null;
    daysOfWeek: string[];
  } | null;
  locations: Array<{
    id: string;
    name: string;
  }>;
}

export async function listOrganizationMembers(
  params: ListMembersParams,
): Promise<{ rows: MemberRow[]; total: number }> {
  const { organizationId, search, role, limit, offset } = params;

  const filters = [eq(member.organizationId, organizationId)];
  if (role) filters.push(eq(member.role, role));
  if (search) {
    const like = `%${search}%`;
    const searchFilter = or(ilike(users.name, like), ilike(users.email, like));
    if (searchFilter) filters.push(searchFilter);
  }

  const where = and(...filters);

  const totalResult = await db
    .select({ value: count() })
    .from(member)
    .innerJoin(users, eq(users.id, member.userId))
    .where(where);

  const total = Number(totalResult[0]?.value ?? 0);

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      role: member.role,
      department: users.department,
      position: users.position,
      hourlyRate: users.hourlyRate,
      face_url: users.user_face_url,
      emailVerified: users.emailVerified,
      banned: users.banned,
      createdAt: users.createdAt,
      joinedAt: member.createdAt,
    })
    .from(member)
    .innerJoin(users, eq(users.id, member.userId))
    .where(where)
    .orderBy(desc(member.createdAt))
    .limit(limit)
    .offset(offset);

  const userIds = rows.map((r) => r.id);

  const shiftByUser = new Map<string, MemberRow["shift"]>();
  const locByUser = new Map<string, MemberRow["locations"]>();

  if (userIds.length > 0) {
    const scheduleRows = await db
      .select({
        user_id: user_schedule.user_id,
        shift_id: shift.id,
        shift_name: shift.name,
        start_time: shift.start_time,
        end_time: shift.end_time,
        color: shift.color,
        days_of_week: shift.days_of_week,
      })
      .from(user_schedule)
      .innerJoin(shift, eq(shift.id, user_schedule.shift_id))
      .where(
        and(
          inArray(user_schedule.user_id, userIds),
          eq(user_schedule.organization_id, organizationId),
        ),
      )
      .orderBy(desc(user_schedule.effective_from));

    // Rows are ordered by effective_from desc, so the first row seen per user
    // is their most recent (active) schedule.
    for (const s of scheduleRows) {
      if (shiftByUser.has(s.user_id)) continue;
      shiftByUser.set(s.user_id, {
        id: s.shift_id,
        name: s.shift_name,
        startTime: s.start_time,
        endTime: s.end_time,
        color: s.color,
        daysOfWeek: s.days_of_week,
      });
    }

    const locationRows = await db
      .select({
        user_id: user_geofence.user_id,
        id: geofence.id,
        name: geofence.name,
      })
      .from(user_geofence)
      .innerJoin(geofence, eq(geofence.id, user_geofence.geofence_id))
      .where(
        and(
          inArray(user_geofence.user_id, userIds),
          eq(user_geofence.organization_id, organizationId),
        ),
      );

    for (const l of locationRows) {
      const list = locByUser.get(l.user_id);
      if (list) list.push({ id: l.id, name: l.name });
      else locByUser.set(l.user_id, [{ id: l.id, name: l.name }]);
    }
  }

  const mapped: MemberRow[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    image: r.image,
    role: r.role,
    department: r.department,
    position: r.position,
    hourlyRate: r.hourlyRate,
    faceRegistered: Array.isArray(r.face_url) && r.face_url.length > 0,
    emailVerified: r.emailVerified,
    banned: r.banned ?? false,
    createdAt: r.createdAt,
    joinedAt: r.joinedAt,
    shift: shiftByUser.get(r.id) ?? null,
    locations: locByUser.get(r.id) ?? [],
  }));

  return { rows: mapped, total };
}

export type UserDetail = MemberRow;

export async function getOrganizationMember(
  organizationId: string,
  userId: string,
): Promise<UserDetail | null> {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      role: member.role,
      department: users.department,
      position: users.position,
      hourlyRate: users.hourlyRate,
      face_url: users.user_face_url,
      emailVerified: users.emailVerified,
      banned: users.banned,
      createdAt: users.createdAt,
      joinedAt: member.createdAt,
    })
    .from(member)
    .innerJoin(users, eq(users.id, member.userId))
    .where(
      and(eq(member.organizationId, organizationId), eq(users.id, userId)),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const scheduleRows = await db
    .select({
      shift_id: shift.id,
      shift_name: shift.name,
      start_time: shift.start_time,
      end_time: shift.end_time,
      color: shift.color,
      days_of_week: shift.days_of_week,
    })
    .from(user_schedule)
    .innerJoin(shift, eq(shift.id, user_schedule.shift_id))
    .where(
      and(
        eq(user_schedule.user_id, userId),
        eq(user_schedule.organization_id, organizationId),
      ),
    )
    .orderBy(desc(user_schedule.effective_from))
    .limit(1);

  const activeSchedule = scheduleRows[0];

  const locationRows = await db
    .select({
      id: geofence.id,
      name: geofence.name,
    })
    .from(user_geofence)
    .innerJoin(geofence, eq(geofence.id, user_geofence.geofence_id))
    .where(
      and(
        eq(user_geofence.user_id, userId),
        eq(user_geofence.organization_id, organizationId),
      ),
    );

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    image: row.image,
    role: row.role,
    department: row.department,
    position: row.position,
    hourlyRate: row.hourlyRate,
    faceRegistered:
      Array.isArray(row.face_url) && row.face_url.length > 0,
    emailVerified: row.emailVerified,
    banned: row.banned ?? false,
    createdAt: row.createdAt,
    joinedAt: row.joinedAt,
    shift: activeSchedule
      ? {
          id: activeSchedule.shift_id,
          name: activeSchedule.shift_name,
          startTime: activeSchedule.start_time,
          endTime: activeSchedule.end_time,
          color: activeSchedule.color,
          daysOfWeek: activeSchedule.days_of_week,
        }
      : null,
    locations: locationRows,
  };
}

export interface UpdateMemberInput {
  name?: string;
  department?: string | null;
  position?: string | null;
  hourlyRate?: number | null;
  role?: string;
}

export async function updateOrganizationMember(
  organizationId: string,
  userId: string,
  input: UpdateMemberInput,
) {
  const exists = await db
    .select({ id: member.id })
    .from(member)
    .where(
      and(
        eq(member.organizationId, organizationId),
        eq(member.userId, userId),
      ),
    )
    .limit(1);

  if (exists.length === 0) return null;

  const userPatch: Record<string, unknown> = {};
  if (input.name !== undefined) userPatch.name = input.name;
  if (input.department !== undefined) userPatch.department = input.department;
  if (input.position !== undefined) userPatch.position = input.position;
  if (input.hourlyRate !== undefined) userPatch.hourlyRate = input.hourlyRate;

  if (Object.keys(userPatch).length > 0) {
    userPatch.updatedAt = new Date();
    await db.update(users).set(userPatch).where(eq(users.id, userId));
  }

  if (input.role !== undefined) {
    await db
      .update(member)
      .set({ role: input.role })
      .where(
        and(
          eq(member.organizationId, organizationId),
          eq(member.userId, userId),
        ),
      );
  }

  return getOrganizationMember(organizationId, userId);
}

export async function deleteUserAccount(userId: string) {
  const now = new Date();
  const deletedEmail = `deleted_${userId}@skyhr.invalid`;

  // Collect Rekognition collection IDs for every org the user belongs to BEFORE deleting
  // member rows, so we can purge their indexed faces. Right-to-erasure + prevent
  // deleted users matching on future check-ins.
  const memberships = await db
    .select({ collectionId: organization.rekognition_collection_id })
    .from(member)
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .where(eq(member.userId, userId));

  const collectionIds = memberships
    .map((m) => m.collectionId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  // Purge faces outside the DB transaction (AWS calls aren't transactional).
  // Failure here aborts the deletion so we don't end up with orphaned faces in AWS.
  for (const collectionId of collectionIds) {
    await deleteFacesByExternalImageId(collectionId, userId);
  }

  return await db.transaction(async (tx) => {
    await tx.delete(sessions).where(eq(sessions.userId, userId));
    await tx.delete(accounts).where(eq(accounts.userId, userId));
    await tx.delete(member).where(eq(member.userId, userId));
    await tx.delete(teamMember).where(eq(teamMember.userId, userId));
    await tx.delete(user_geofence).where(eq(user_geofence.user_id, userId));
    await tx.delete(user_schedule).where(eq(user_schedule.user_id, userId));
    await tx.delete(user_payroll).where(eq(user_payroll.user_id, userId));
    await tx.delete(invitation).where(eq(invitation.inviterId, userId));

    const updated = await tx
      .update(users)
      .set({
        name: "Usuario eliminado",
        email: deletedEmail,
        image: null,
        user_face_url: [],
        deleted_at: now,
        updatedAt: now,
      })
      .where(eq(users.id, userId))
      .returning();

    return updated[0] ?? null;
  });
}

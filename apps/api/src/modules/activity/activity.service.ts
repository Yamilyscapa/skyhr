import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "../../db";
import {
  announcement,
  attendance_event,
  permissions,
  users,
} from "../../db/schema";

export type ActivityTone = "neutral" | "success" | "warning" | "danger" | "info";

export interface ActivityItem {
  id: string;
  who: string;
  action: string;
  when: Date;
  tone: ActivityTone;
  kind: "attendance" | "permission" | "announcement";
  meta?: Record<string, unknown>;
}

function attendanceTone(status: string): ActivityTone {
  switch (status) {
    case "on_time":
      return "success";
    case "late":
      return "warning";
    case "early":
      return "info";
    case "absent":
    case "out_of_bounds":
      return "danger";
    default:
      return "neutral";
  }
}

function permissionTone(status: string): ActivityTone {
  switch (status) {
    case "approved":
      return "success";
    case "rejected":
      return "danger";
    default:
      return "info";
  }
}

export async function listRecentActivity(
  organizationId: string,
  limit: number,
): Promise<ActivityItem[]> {
  const attendanceRows = await db
    .select({
      id: attendance_event.id,
      created_at: attendance_event.created_at,
      check_in: attendance_event.check_in,
      check_out: attendance_event.check_out,
      status: attendance_event.status,
      user_name: users.name,
    })
    .from(attendance_event)
    .leftJoin(users, eq(users.id, attendance_event.user_id))
    .where(
      and(
        eq(attendance_event.organization_id, organizationId),
        isNull(attendance_event.deleted_at),
      ),
    )
    .orderBy(desc(attendance_event.created_at))
    .limit(limit);

  const permissionRows = await db
    .select({
      id: permissions.id,
      created_at: permissions.created_at,
      updated_at: permissions.updated_at,
      status: permissions.status,
      user_name: users.name,
    })
    .from(permissions)
    .leftJoin(users, eq(users.id, permissions.user_id))
    .where(
      and(
        eq(permissions.organization_id, organizationId),
        isNull(permissions.deleted_at),
      ),
    )
    .orderBy(desc(permissions.updated_at))
    .limit(limit);

  const announcementRows = await db
    .select({
      id: announcement.id,
      created_at: announcement.created_at,
      title: announcement.title,
      priority: announcement.priority,
    })
    .from(announcement)
    .where(
      and(
        eq(announcement.organization_id, organizationId),
        isNull(announcement.deleted_at),
      ),
    )
    .orderBy(desc(announcement.created_at))
    .limit(limit);

  const items: ActivityItem[] = [];

  for (const a of attendanceRows) {
    const isCheckout = a.check_out !== null;
    items.push({
      id: `attendance:${a.id}:${isCheckout ? "out" : "in"}`,
      who: a.user_name ?? "Usuario",
      action: isCheckout ? "Salida registrada" : "Entrada registrada",
      when: isCheckout ? (a.check_out as Date) : a.check_in,
      tone: attendanceTone(a.status),
      kind: "attendance",
      meta: { status: a.status },
    });
  }

  for (const p of permissionRows) {
    items.push({
      id: `permission:${p.id}`,
      who: p.user_name ?? "Usuario",
      action:
        p.status === "approved"
          ? "Permiso aprobado"
          : p.status === "rejected"
            ? "Permiso rechazado"
            : "Permiso solicitado",
      when: p.updated_at ?? p.created_at,
      tone: permissionTone(p.status),
      kind: "permission",
      meta: { status: p.status },
    });
  }

  for (const a of announcementRows) {
    items.push({
      id: `announcement:${a.id}`,
      who: "Sistema",
      action: `Anuncio publicado: ${a.title}`,
      when: a.created_at,
      tone: a.priority === "urgent" ? "danger" : a.priority === "important" ? "warning" : "info",
      kind: "announcement",
      meta: { priority: a.priority },
    });
  }

  items.sort((a, b) => b.when.getTime() - a.when.getTime());
  return items.slice(0, limit);
}

import { eq } from "drizzle-orm";
import { db } from "../../db";
import {
  accounts,
  invitation,
  member,
  sessions,
  teamMember,
  user_geofence,
  user_payroll,
  user_schedule,
  users,
} from "../../db/schema";

export async function deleteUserAccount(userId: string) {
  const now = new Date();
  const deletedEmail = `deleted_${userId}@skyhr.invalid`;

  await db.delete(sessions).where(eq(sessions.userId, userId));
  await db.delete(accounts).where(eq(accounts.userId, userId));
  await db.delete(member).where(eq(member.userId, userId));
  await db.delete(teamMember).where(eq(teamMember.userId, userId));
  await db.delete(user_geofence).where(eq(user_geofence.user_id, userId));
  await db.delete(user_schedule).where(eq(user_schedule.user_id, userId));
  await db.delete(user_payroll).where(eq(user_payroll.user_id, userId));
  await db.delete(invitation).where(eq(invitation.inviterId, userId));

  const updated = await db
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
}

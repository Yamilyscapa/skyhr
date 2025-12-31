import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import { push_tokens } from "../../db/schema";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export type DeviceType = "ios" | "android" | "unknown";

interface RegisterPushTokenInput {
  userId: string;
  organizationId: string;
  token: string;
  deviceType?: DeviceType;
}

interface PushMessageInput {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  priority?: "default" | "high";
}

export async function registerPushToken({
  userId,
  organizationId,
  token,
  deviceType = "unknown",
}: RegisterPushTokenInput) {
  const existing = await db
    .select({ id: push_tokens.id })
    .from(push_tokens)
    .where(eq(push_tokens.token, token))
    .limit(1);

  if (existing.length) {
    await db
      .update(push_tokens)
      .set({
        user_id: userId,
        organization_id: organizationId,
        device_type: deviceType,
        updated_at: new Date(),
      })
      .where(eq(push_tokens.id, existing[0]!.id));
    return existing[0]!.id;
  }

  const inserted = await db
    .insert(push_tokens)
    .values({
      user_id: userId,
      organization_id: organizationId,
      token,
      device_type: deviceType,
    })
    .returning({ id: push_tokens.id });

  return inserted[0]?.id ?? null;
}

export async function removePushToken(userId: string, token: string) {
  await db
    .delete(push_tokens)
    .where(and(eq(push_tokens.user_id, userId), eq(push_tokens.token, token)));
}

export async function getOrganizationPushTokens(organizationId: string) {
  const rows = await db
    .select({ token: push_tokens.token })
    .from(push_tokens)
    .where(eq(push_tokens.organization_id, organizationId));

  return rows.map((row) => row.token).filter(Boolean);
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function filterExpoTokens(tokens: string[]) {
  const expoTokenPattern = /^(Expo|Exponent)PushToken/;
  return tokens.filter((token) => expoTokenPattern.test(token));
}

export async function sendPushNotifications(tokens: string[], message: PushMessageInput) {
  const validTokens = filterExpoTokens(tokens);
  if (!validTokens.length) {
    return { sent: 0, skipped: "No valid Expo push tokens" };
  }

  const payloads = validTokens.map((token) => ({
    to: token,
    sound: "default",
    title: message.title,
    body: message.body,
    data: message.data ?? {},
    priority: message.priority ?? "default",
  }));

  const chunks = chunkArray(payloads, 90); // Expo recommends batches under 100
  let sent = 0;
  const errors: Array<{ token: string; error: unknown }> = [];

  for (const chunk of chunks) {
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunk),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error("Expo push response not ok:", text);
        chunk.forEach((item) => errors.push({ token: item.to, error: text }));
        continue;
      }

      const result = await response.json();
      const tickets = Array.isArray(result?.data) ? result.data : [];
      tickets.forEach((ticket: any, index: number) => {
        const target = chunk[index];
        if (ticket?.status === "ok") {
          sent += 1;
        } else {
          errors.push({ token: target.to, error: ticket });
        }
      });
    } catch (error) {
      console.error("Failed to send push chunk:", error);
      chunk.forEach((item) => errors.push({ token: item.to, error }));
    }
  }

  return { sent, errors };
}

export async function sendAnnouncementNotification(
  organizationId: string,
  announcement: {
    id: string;
    title: string;
    content: string;
    priority: string;
  }
) {
  const tokens = await getOrganizationPushTokens(organizationId);
  if (!tokens.length) {
    return { sent: 0, skipped: "No tokens for organization" };
  }

  const priority = announcement.priority === "urgent" ? "high" : "default";
  return sendPushNotifications(tokens, {
    title: announcement.priority === "urgent" ? "Aviso urgente" : "Nuevo aviso",
    body: announcement.title,
    data: {
      announcementId: announcement.id,
      priority: announcement.priority,
    },
    priority,
  });
}






import Stripe from "stripe";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  member,
  organization,
  organization_billing,
  stripe_webhook_event,
} from "../../db/schema";
import {
  getAppUrl,
  getBillingTiers,
  getOveragePerUserMxn,
  getOveragePriceId,
} from "./billing.config";
import type { BillingTierKey } from "./billing.config";
import { getStripeClient, getStripeWebhookSecret } from "./stripe.client";

type OrganizationMembership = {
  organizationId: string;
  role: string;
};

type OrganizationRecord = {
  id: string;
  slug: string | null;
  name: string;
};

type BillingComputation = {
  tier: {
    key: BillingTierKey;
    label: string;
    minUsers: number;
    maxUsers: number | null;
    baseAmountMxn: number;
    stripePriceId: string | null;
  };
  seatCount: number;
  overageQuantity: number;
  overagePerUserMxn: number;
  monthlyAmountMxn: number;
};

export type BillingSummary = {
  organizationId: string;
  seatCount: number;
  ownerCountsAsSeat: boolean;
  isOwner: boolean;
  currency: string;
  monthlyEstimateMxn: number;
  overagePerUserMxn: number;
  tier: {
    key: BillingTierKey;
    label: string;
    minUsers: number;
    maxUsers: number | null;
    baseAmountMxn: number;
    overageQuantity: number;
  };
  billing: {
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    status: string;
    cancelAtPeriodEnd: boolean;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
    lastSyncedAt: Date | null;
  };
};

export type BillingPlan = {
  key: BillingTierKey;
  label: string;
  minUsers: number;
  maxUsers: number | null;
  monthlyAmountMxn: number;
  notes: string;
};

export class BillingError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "BillingError";
    this.status = status;
  }
}

function unixToDate(value?: number | null): Date | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return new Date(value * 1000);
}

async function getOrganizationById(
  organizationId: string,
): Promise<OrganizationRecord> {
  const [organizationRow] = await db
    .select({
      id: organization.id,
      slug: organization.slug,
      name: organization.name,
    })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);

  if (!organizationRow) {
    throw new BillingError("Organization not found", 404);
  }

  return organizationRow;
}

async function getMembershipForUser(
  userId: string,
  organizationId: string,
): Promise<OrganizationMembership> {
  const [membership] = await db
    .select({
      organizationId: member.organizationId,
      role: member.role,
    })
    .from(member)
    .where(
      and(eq(member.userId, userId), eq(member.organizationId, organizationId)),
    )
    .limit(1);

  if (!membership) {
    throw new BillingError("You do not belong to this organization", 403);
  }

  return membership;
}

function normalizeSeatCount(seatCount: number): number {
  if (!Number.isFinite(seatCount) || seatCount < 1) {
    return 1;
  }
  return Math.round(seatCount);
}

function computeBillingBySeatCount(rawSeatCount: number): BillingComputation {
  const seatCount = normalizeSeatCount(rawSeatCount);
  const overagePerUserMxn = getOveragePerUserMxn();
  const tiers = getBillingTiers();

  const tier =
    tiers.find((item) => {
      if (seatCount < item.minUsers) {
        return false;
      }
      if (item.maxUsers === null) {
        return true;
      }
      return seatCount <= item.maxUsers;
    }) ?? tiers[0];

  if (!tier) {
    throw new BillingError("Billing tier configuration is invalid", 500);
  }

  const overageQuantity = seatCount > 100 ? seatCount - 100 : 0;
  const monthlyAmountMxn =
    tier.baseAmountMxn + overageQuantity * overagePerUserMxn;

  return {
    tier,
    seatCount,
    overageQuantity,
    overagePerUserMxn,
    monthlyAmountMxn,
  };
}

async function getOrganizationSeatCount(
  organizationId: string,
): Promise<number> {
  const [result] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(member)
    .where(eq(member.organizationId, organizationId));

  return normalizeSeatCount(result?.count ?? 1);
}

async function getOrganizationBillingState(organizationId: string) {
  const [row] = await db
    .select()
    .from(organization_billing)
    .where(eq(organization_billing.organization_id, organizationId))
    .limit(1);
  return row ?? null;
}

async function saveBillingSnapshot(
  organizationId: string,
  computation: BillingComputation,
) {
  const [row] = await db
    .insert(organization_billing)
    .values({
      organization_id: organizationId,
      seat_count: computation.seatCount,
      overage_quantity: computation.overageQuantity,
      current_tier_key: computation.tier.key,
      monthly_amount_mxn: computation.monthlyAmountMxn,
      currency: "mxn",
      updated_at: new Date(),
      last_synced_at: new Date(),
    })
    .onConflictDoUpdate({
      target: organization_billing.organization_id,
      set: {
        seat_count: computation.seatCount,
        overage_quantity: computation.overageQuantity,
        current_tier_key: computation.tier.key,
        monthly_amount_mxn: computation.monthlyAmountMxn,
        currency: "mxn",
        updated_at: new Date(),
        last_synced_at: new Date(),
      },
    })
    .returning();

  return row ?? null;
}

function buildBillingPath(org: OrganizationRecord) {
  if (!org.slug) {
    return "/getting-started";
  }
  return `/${org.slug}/billing`;
}

function buildCheckoutLineItems(
  computation: BillingComputation,
): Stripe.Checkout.SessionCreateParams.LineItem[] {
  const basePriceId = computation.tier.stripePriceId;
  if (!basePriceId) {
    throw new BillingError("Missing Stripe price ID for selected tier", 500);
  }

  if (computation.seatCount > 100) {
    return [
      {
        price: basePriceId,
        quantity: 1,
      },
      {
        price: getOveragePriceId(),
        quantity: computation.overageQuantity,
      },
    ];
  }

  return [
    {
      price: basePriceId,
      quantity: 1,
    },
  ];
}

function getBasePriceIds() {
  const tiers = getBillingTiers();
  const basePriceIds = new Set<string>();

  for (const item of tiers) {
    if (item.key === "tier_101_plus") {
      continue;
    }
    if (item.stripePriceId) {
      basePriceIds.add(item.stripePriceId);
    }
  }

  return basePriceIds;
}

async function persistFromStripeSubscription(
  organizationId: string,
  subscription: Stripe.Subscription,
): Promise<void> {
  const seatCount = await getOrganizationSeatCount(organizationId);
  const computation = computeBillingBySeatCount(seatCount);
  const overagePriceId = getOveragePriceId();

  const baseItem =
    subscription.items.data.find(
      (item: Stripe.SubscriptionItem) =>
        item.price?.id === computation.tier.stripePriceId,
    ) ??
    subscription.items.data.find((item: Stripe.SubscriptionItem) =>
      getBasePriceIds().has(item.price?.id ?? ""),
    ) ??
    subscription.items.data[0] ??
    null;
  const overageItem =
    subscription.items.data.find(
      (item: Stripe.SubscriptionItem) => item.price?.id === overagePriceId,
    ) ?? null;

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : (subscription.customer?.id ?? null);

  await db
    .insert(organization_billing)
    .values({
      organization_id: organizationId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      stripe_subscription_status: subscription.status,
      stripe_base_price_id:
        baseItem?.price?.id ?? computation.tier.stripePriceId,
      stripe_overage_price_id:
        overageItem?.price?.id ??
        (computation.overageQuantity > 0 ? overagePriceId : null),
      stripe_base_subscription_item_id: baseItem?.id ?? null,
      stripe_overage_subscription_item_id: overageItem?.id ?? null,
      seat_count: computation.seatCount,
      overage_quantity: computation.overageQuantity,
      current_tier_key: computation.tier.key,
      monthly_amount_mxn: computation.monthlyAmountMxn,
      currency: "mxn",
      current_period_start: unixToDate(baseItem?.current_period_start ?? null),
      current_period_end: unixToDate(baseItem?.current_period_end ?? null),
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date(),
      last_synced_at: new Date(),
    })
    .onConflictDoUpdate({
      target: organization_billing.organization_id,
      set: {
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        stripe_subscription_status: subscription.status,
        stripe_base_price_id:
          baseItem?.price?.id ?? computation.tier.stripePriceId,
        stripe_overage_price_id:
          overageItem?.price?.id ??
          (computation.overageQuantity > 0 ? overagePriceId : null),
        stripe_base_subscription_item_id: baseItem?.id ?? null,
        stripe_overage_subscription_item_id: overageItem?.id ?? null,
        seat_count: computation.seatCount,
        overage_quantity: computation.overageQuantity,
        current_tier_key: computation.tier.key,
        monthly_amount_mxn: computation.monthlyAmountMxn,
        currency: "mxn",
        current_period_start: unixToDate(
          baseItem?.current_period_start ?? null,
        ),
        current_period_end: unixToDate(baseItem?.current_period_end ?? null),
        cancel_at_period_end: subscription.cancel_at_period_end,
        updated_at: new Date(),
        last_synced_at: new Date(),
      },
    });
}

async function findOrganizationIdBySubscriptionId(
  subscriptionId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ organizationId: organization_billing.organization_id })
    .from(organization_billing)
    .where(eq(organization_billing.stripe_subscription_id, subscriptionId))
    .limit(1);

  return row?.organizationId ?? null;
}

async function hasProcessedStripeEvent(eventId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: stripe_webhook_event.id })
    .from(stripe_webhook_event)
    .where(eq(stripe_webhook_event.stripe_event_id, eventId))
    .limit(1);

  return Boolean(row);
}

async function recordProcessedStripeEvent(
  event: Stripe.Event,
  organizationId: string | null,
  rawPayload: string,
) {
  await db.insert(stripe_webhook_event).values({
    stripe_event_id: event.id,
    type: event.type,
    organization_id: organizationId,
    payload: rawPayload,
    processed_at: new Date(),
  });
}

async function processStripeEvent(
  stripe: Stripe,
  event: Stripe.Event,
): Promise<string | null> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orgId =
        session.metadata?.organizationId ?? session.client_reference_id ?? null;
      if (!orgId) {
        return null;
      }

      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : (session.subscription?.id ?? null);
      const customerId =
        typeof session.customer === "string"
          ? session.customer
          : (session.customer?.id ?? null);

      const seatCount = await getOrganizationSeatCount(orgId);
      const computation = computeBillingBySeatCount(seatCount);

      await db
        .insert(organization_billing)
        .values({
          organization_id: orgId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          stripe_subscription_status: subscriptionId
            ? "incomplete"
            : "inactive",
          seat_count: computation.seatCount,
          overage_quantity: computation.overageQuantity,
          current_tier_key: computation.tier.key,
          monthly_amount_mxn: computation.monthlyAmountMxn,
          currency: "mxn",
          updated_at: new Date(),
          last_synced_at: new Date(),
        })
        .onConflictDoUpdate({
          target: organization_billing.organization_id,
          set: {
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            stripe_subscription_status: subscriptionId
              ? "incomplete"
              : "inactive",
            seat_count: computation.seatCount,
            overage_quantity: computation.overageQuantity,
            current_tier_key: computation.tier.key,
            monthly_amount_mxn: computation.monthlyAmountMxn,
            currency: "mxn",
            updated_at: new Date(),
            last_synced_at: new Date(),
          },
        });

      if (subscriptionId) {
        const subscription =
          await stripe.subscriptions.retrieve(subscriptionId);
        await persistFromStripeSubscription(orgId, subscription);
      }

      return orgId;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const orgIdFromMetadata = subscription.metadata?.organizationId ?? null;
      const organizationId =
        orgIdFromMetadata ??
        (await findOrganizationIdBySubscriptionId(subscription.id));

      if (!organizationId) {
        return null;
      }

      await persistFromStripeSubscription(organizationId, subscription);
      return organizationId;
    }
    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const invoiceSubscription =
        invoice.parent?.subscription_details?.subscription ?? null;
      const subscriptionId =
        typeof invoiceSubscription === "string"
          ? invoiceSubscription
          : (invoiceSubscription?.id ?? null);

      if (!subscriptionId) {
        return null;
      }

      const organizationId =
        await findOrganizationIdBySubscriptionId(subscriptionId);
      if (!organizationId) {
        return null;
      }

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await persistFromStripeSubscription(organizationId, subscription);
      return organizationId;
    }
    default:
      return null;
  }
}

export async function listBillingPlans(): Promise<BillingPlan[]> {
  const tiers = getBillingTiers();
  const overagePerUserMxn = getOveragePerUserMxn();

  return tiers.map((tier) => {
    if (tier.key === "tier_101_plus") {
      return {
        key: tier.key,
        label: tier.label,
        minUsers: tier.minUsers,
        maxUsers: tier.maxUsers,
        monthlyAmountMxn: tier.baseAmountMxn,
        notes: `Base de ${tier.baseAmountMxn} MXN + ${overagePerUserMxn} MXN por usuario adicional arriba de 100.`,
      };
    }

    return {
      key: tier.key,
      label: tier.label,
      minUsers: tier.minUsers,
      maxUsers: tier.maxUsers,
      monthlyAmountMxn: tier.baseAmountMxn,
      notes: `${tier.baseAmountMxn} MXN mensuales para este rango de usuarios.`,
    };
  });
}

export async function initializeOrganizationBilling(organizationId: string) {
  const seatCount = await getOrganizationSeatCount(organizationId);
  const computation = computeBillingBySeatCount(seatCount);
  await saveBillingSnapshot(organizationId, computation);
}

export async function syncOrganizationBillingSeats(organizationId: string) {
  const seatCount = await getOrganizationSeatCount(organizationId);
  const computation = computeBillingBySeatCount(seatCount);
  const snapshot = await saveBillingSnapshot(organizationId, computation);

  if (!snapshot?.stripe_subscription_id) {
    return snapshot;
  }

  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(
    snapshot.stripe_subscription_id,
  );

  if (
    subscription.status === "canceled" ||
    subscription.status === "incomplete_expired" ||
    subscription.status === "unpaid"
  ) {
    await persistFromStripeSubscription(organizationId, subscription);
    return snapshot;
  }

  const overagePriceId = getOveragePriceId();
  const items = subscription.items.data;

  if (items.length === 0) {
    throw new BillingError("Stripe subscription has no line items", 500);
  }

  const basePriceIds = getBasePriceIds();
  const baseItem =
    items.find(
      (item: Stripe.SubscriptionItem) =>
        item.price?.id === computation.tier.stripePriceId,
    ) ??
    items.find((item: Stripe.SubscriptionItem) =>
      basePriceIds.has(item.price?.id ?? ""),
    ) ??
    items[0] ??
    null;

  if (!baseItem) {
    throw new BillingError("Stripe base subscription item not found", 500);
  }

  const overageItem =
    items.find(
      (item: Stripe.SubscriptionItem) => item.price?.id === overagePriceId,
    ) ?? null;
  const targetBasePriceId = computation.tier.stripePriceId;

  if (!targetBasePriceId) {
    throw new BillingError("Missing Stripe price ID for selected tier", 500);
  }

  const baseItemPriceId = baseItem.price?.id ?? null;
  const basePriceMismatch = baseItemPriceId !== targetBasePriceId;
  const expectedOverageQuantity = computation.overageQuantity;
  const currentOverageQuantity = overageItem?.quantity ?? 0;
  const overagePriceMismatch =
    expectedOverageQuantity > 0 &&
    (!overageItem || overageItem.price?.id !== overagePriceId);
  const overageQuantityMismatch =
    expectedOverageQuantity > 0 &&
    currentOverageQuantity !== expectedOverageQuantity;
  const shouldDeleteOverageItem =
    expectedOverageQuantity === 0 && Boolean(overageItem);

  const requiresStripeUpdate =
    basePriceMismatch ||
    overagePriceMismatch ||
    overageQuantityMismatch ||
    shouldDeleteOverageItem;

  if (!requiresStripeUpdate) {
    await persistFromStripeSubscription(organizationId, subscription);
    return subscription;
  }

  const updateItems: Stripe.SubscriptionUpdateParams.Item[] = [
    {
      id: baseItem.id,
      price: targetBasePriceId,
      quantity: 1,
    },
  ];

  if (computation.overageQuantity > 0) {
    if (overageItem) {
      updateItems.push({
        id: overageItem.id,
        price: overagePriceId,
        quantity: computation.overageQuantity,
      });
    } else {
      updateItems.push({
        price: overagePriceId,
        quantity: computation.overageQuantity,
      });
    }
  } else if (overageItem) {
    updateItems.push({
      id: overageItem.id,
      deleted: true,
    });
  }

  const updated = await stripe.subscriptions.update(
    snapshot.stripe_subscription_id,
    {
      items: updateItems,
      proration_behavior: "create_prorations",
      metadata: {
        organizationId,
        seatCount: String(computation.seatCount),
        tierKey: computation.tier.key,
      },
    },
  );

  await persistFromStripeSubscription(organizationId, updated);
  return updated;
}

export async function getOrganizationBillingSummary(
  userId: string,
  organizationId: string,
): Promise<BillingSummary> {
  await getOrganizationById(organizationId);
  const membership = await getMembershipForUser(userId, organizationId);
  const seatCount = await getOrganizationSeatCount(organizationId);
  const computation = computeBillingBySeatCount(seatCount);

  let snapshot = await saveBillingSnapshot(organizationId, computation);

  if (
    membership.role === "owner" &&
    snapshot?.stripe_subscription_id &&
    ["trialing", "active", "past_due", "unpaid", "incomplete"].includes(
      snapshot.stripe_subscription_status,
    )
  ) {
    try {
      await syncOrganizationBillingSeats(organizationId);
      snapshot = await getOrganizationBillingState(organizationId);
    } catch (error) {
      console.warn(
        `[billing] Failed to sync seats while reading summary for organization ${organizationId}`,
        error,
      );
    }
  }

  return {
    organizationId,
    seatCount: computation.seatCount,
    ownerCountsAsSeat: true,
    isOwner: membership.role === "owner",
    currency: "mxn",
    monthlyEstimateMxn: computation.monthlyAmountMxn,
    overagePerUserMxn: computation.overagePerUserMxn,
    tier: {
      key: computation.tier.key,
      label: computation.tier.label,
      minUsers: computation.tier.minUsers,
      maxUsers: computation.tier.maxUsers,
      baseAmountMxn: computation.tier.baseAmountMxn,
      overageQuantity: computation.overageQuantity,
    },
    billing: {
      stripeCustomerId: snapshot?.stripe_customer_id ?? null,
      stripeSubscriptionId: snapshot?.stripe_subscription_id ?? null,
      status: snapshot?.stripe_subscription_status ?? "inactive",
      cancelAtPeriodEnd: snapshot?.cancel_at_period_end ?? false,
      currentPeriodStart: snapshot?.current_period_start ?? null,
      currentPeriodEnd: snapshot?.current_period_end ?? null,
      lastSyncedAt: snapshot?.last_synced_at ?? null,
    },
  };
}

export async function createCheckoutSessionForOrganization(options: {
  userId: string;
  userEmail: string;
  organizationId: string;
}) {
  const { userId, userEmail, organizationId } = options;
  const org = await getOrganizationById(organizationId);
  const membership = await getMembershipForUser(userId, organizationId);

  if (membership.role !== "owner") {
    throw new BillingError("Only organization owners can start checkout", 403);
  }

  const seatCount = await getOrganizationSeatCount(organizationId);
  const computation = computeBillingBySeatCount(seatCount);
  const snapshot = await saveBillingSnapshot(organizationId, computation);

  if (
    snapshot?.stripe_subscription_id &&
    ["trialing", "active", "past_due", "unpaid", "incomplete"].includes(
      snapshot.stripe_subscription_status,
    )
  ) {
    throw new BillingError(
      "Organization already has an active Stripe subscription",
      409,
    );
  }

  const billingPath = buildBillingPath(org);
  const appUrl = getAppUrl();
  const stripe = getStripeClient();

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    success_url: `${appUrl}${billingPath}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}${billingPath}?checkout=cancelled`,
    line_items: buildCheckoutLineItems(computation),
    allow_promotion_codes: true,
    client_reference_id: organizationId,
    metadata: {
      organizationId,
      seatCount: String(computation.seatCount),
      tierKey: computation.tier.key,
    },
    subscription_data: {
      metadata: {
        organizationId,
        seatCount: String(computation.seatCount),
        tierKey: computation.tier.key,
      },
    },
  };

  if (snapshot?.stripe_customer_id) {
    params.customer = snapshot.stripe_customer_id;
  } else {
    params.customer_email = userEmail;
  }

  const session = await stripe.checkout.sessions.create(params);

  if (!session.url) {
    throw new BillingError("Stripe did not return a checkout URL", 500);
  }

  return {
    checkoutUrl: session.url,
    sessionId: session.id,
    seatCount: computation.seatCount,
    monthlyEstimateMxn: computation.monthlyAmountMxn,
  };
}

export async function createBillingPortalSessionForOrganization(options: {
  userId: string;
  organizationId: string;
}) {
  const { userId, organizationId } = options;
  const org = await getOrganizationById(organizationId);
  const membership = await getMembershipForUser(userId, organizationId);

  if (membership.role !== "owner") {
    throw new BillingError(
      "Only organization owners can access billing portal",
      403,
    );
  }

  const snapshot = await getOrganizationBillingState(organizationId);

  if (!snapshot?.stripe_customer_id) {
    throw new BillingError(
      "No Stripe customer found for this organization",
      400,
    );
  }

  const stripe = getStripeClient();
  const appUrl = getAppUrl();
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: snapshot.stripe_customer_id,
    return_url: `${appUrl}${buildBillingPath(org)}`,
  });

  if (!portalSession.url) {
    throw new BillingError("Stripe did not return a portal URL", 500);
  }

  return {
    portalUrl: portalSession.url,
  };
}

export async function processStripeWebhook(payload: string, signature: string) {
  const stripe = getStripeClient();
  const webhookSecret = getStripeWebhookSecret();
  const event = stripe.webhooks.constructEvent(
    payload,
    signature,
    webhookSecret,
  );

  const alreadyProcessed = await hasProcessedStripeEvent(event.id);
  if (alreadyProcessed) {
    return {
      duplicate: true,
      eventId: event.id,
      type: event.type,
    };
  }

  const organizationId = await processStripeEvent(stripe, event);
  await recordProcessedStripeEvent(event, organizationId, payload);

  return {
    duplicate: false,
    eventId: event.id,
    type: event.type,
    organizationId,
  };
}

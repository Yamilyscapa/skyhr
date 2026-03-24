import type { Context } from "hono";
import {
  ErrorCodes,
  SuccessCodes,
  errorResponse,
  successResponse,
} from "../../core/http";
import {
  BillingError,
  createBillingPortalSessionForOrganization,
  createCheckoutSessionForOrganization,
  getOrganizationBillingSummary,
  listBillingPlans,
  processStripeWebhook,
} from "./billing.service";

function resolveUserFromContext(c: Context): { id: string; email: string } {
  const user = c.get("user") as { id?: string; email?: string } | undefined;

  if (!user?.id || !user?.email) {
    throw new BillingError("Authenticated user context is required", 401);
  }

  return {
    id: user.id,
    email: user.email,
  };
}

function resolveError(c: Context, error: unknown) {
  if (error instanceof BillingError) {
    const statusCode =
      error.status === 401
        ? ErrorCodes.UNAUTHORIZED
        : error.status === 403
          ? ErrorCodes.FORBIDDEN
          : error.status === 404
            ? ErrorCodes.NOT_FOUND
            : error.status === 409
              ? ErrorCodes.CONFLICT
              : ErrorCodes.BAD_REQUEST;
    return errorResponse(c, error.message, statusCode);
  }

  const message =
    error instanceof Error ? error.message : "Internal server error";
  return errorResponse(c, message, ErrorCodes.INTERNAL_SERVER_ERROR);
}

export async function getPlans(c: Context): Promise<Response> {
  try {
    const plans = await listBillingPlans();
    return successResponse(
      c,
      {
        message: "Billing plans retrieved successfully",
        data: plans,
      },
      SuccessCodes.OK,
    );
  } catch (error) {
    return resolveError(c, error);
  }
}

export async function getSummary(c: Context): Promise<Response> {
  try {
    const { id: userId } = resolveUserFromContext(c);
    const organizationId = c.req.param("organizationId");

    if (!organizationId) {
      return errorResponse(
        c,
        "Organization ID is required",
        ErrorCodes.BAD_REQUEST,
      );
    }

    const summary = await getOrganizationBillingSummary(userId, organizationId);

    return successResponse(
      c,
      {
        message: "Billing summary retrieved successfully",
        data: summary,
      },
      SuccessCodes.OK,
    );
  } catch (error) {
    return resolveError(c, error);
  }
}

export async function createCheckoutSession(c: Context): Promise<Response> {
  try {
    const user = resolveUserFromContext(c);
    const organizationId = c.req.param("organizationId");

    if (!organizationId) {
      return errorResponse(
        c,
        "Organization ID is required",
        ErrorCodes.BAD_REQUEST,
      );
    }

    const result = await createCheckoutSessionForOrganization({
      userId: user.id,
      userEmail: user.email,
      organizationId,
    });

    return successResponse(
      c,
      {
        message: "Checkout session created successfully",
        data: result,
      },
      SuccessCodes.CREATED,
    );
  } catch (error) {
    return resolveError(c, error);
  }
}

export async function createPortalSession(c: Context): Promise<Response> {
  try {
    const { id: userId } = resolveUserFromContext(c);
    const organizationId = c.req.param("organizationId");

    if (!organizationId) {
      return errorResponse(
        c,
        "Organization ID is required",
        ErrorCodes.BAD_REQUEST,
      );
    }

    const result = await createBillingPortalSessionForOrganization({
      userId,
      organizationId,
    });

    return successResponse(
      c,
      {
        message: "Billing portal session created successfully",
        data: result,
      },
      SuccessCodes.CREATED,
    );
  } catch (error) {
    return resolveError(c, error);
  }
}

export async function stripeWebhook(c: Context): Promise<Response> {
  try {
    const signature = c.req.header("stripe-signature");
    if (!signature) {
      return errorResponse(
        c,
        "Stripe signature header is missing",
        ErrorCodes.BAD_REQUEST,
      );
    }

    const payload = await c.req.text();
    const result = await processStripeWebhook(payload, signature);

    return successResponse(
      c,
      {
        message: result.duplicate
          ? "Stripe webhook already processed"
          : "Stripe webhook processed",
        data: result,
      },
      SuccessCodes.OK,
    );
  } catch (error) {
    return resolveError(c, error);
  }
}

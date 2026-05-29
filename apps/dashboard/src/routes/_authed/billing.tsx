import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { CreditCard, ExternalLink, Check, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/status-badge";
import { useActiveOrganization } from "@/lib/auth/client";
import { api } from "@/lib/api";
import type { BillingPlan, BillingSummary } from "@/lib/api";
import { cn } from "@/lib/utils";

type CheckoutResult = "success" | "cancelled";

export const Route = createFileRoute("/_authed/billing")({
  component: BillingPage,
  validateSearch: (search): { checkout?: CheckoutResult } => ({
    checkout:
      search.checkout === "success" || search.checkout === "cancelled"
        ? search.checkout
        : undefined,
  }),
});

const mxn = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

const STATUS_TONE: Record<
  string,
  { tone: "success" | "warning" | "danger" | "info" | "neutral"; label: string }
> = {
  active: { tone: "success", label: "Activa" },
  trialing: { tone: "info", label: "Prueba" },
  past_due: { tone: "warning", label: "Pago vencido" },
  unpaid: { tone: "danger", label: "Sin pagar" },
  incomplete: { tone: "warning", label: "Incompleta" },
  canceled: { tone: "neutral", label: "Cancelada" },
  inactive: { tone: "neutral", label: "Sin suscripción" },
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

function statusMeta(status: string) {
  return STATUS_TONE[status] ?? { tone: "neutral" as const, label: status };
}

const ACTIVE_STATUSES = ["active", "trialing", "past_due", "unpaid", "incomplete"];

function BillingPage() {
  const { data: activeOrg } = useActiveOrganization();
  const { checkout } = useSearch({ from: "/_authed/billing" });
  const orgId = activeOrg?.id ?? null;

  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<"checkout" | "portal" | null>(null);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const [s, p] = await Promise.all([
        api.billing.summary(orgId),
        api.billing.plans(),
      ]);
      setSummary(s.data);
      setPlans(p.data);
    } catch (err) {
      setError((err as Error).message ?? "Error al cargar facturación");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function startCheckout() {
    if (!orgId) return;
    setAction("checkout");
    setError(null);
    try {
      const res = await api.billing.checkout(orgId);
      window.location.href = res.data.checkoutUrl;
    } catch (err) {
      setError((err as Error).message ?? "No se pudo iniciar el checkout");
      setAction(null);
    }
  }

  async function openPortal() {
    if (!orgId) return;
    setAction("portal");
    setError(null);
    try {
      const res = await api.billing.portal(orgId);
      window.location.href = res.data.portalUrl;
    } catch (err) {
      setError((err as Error).message ?? "No se pudo abrir el portal");
      setAction(null);
    }
  }

  const status = summary?.billing.status ?? "inactive";
  const meta = statusMeta(status);
  const hasSubscription = ACTIVE_STATUSES.includes(status);
  const isOwner = summary?.isOwner ?? false;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Cuenta"
        title="Facturación"
        description="Administra la suscripción y los asientos de tu organización."
        actions={
          isOwner && hasSubscription ? (
            <Button
              variant="secondary"
              onClick={openPortal}
              disabled={action !== null}
            >
              <ExternalLink /> Portal de Stripe
            </Button>
          ) : isOwner ? (
            <Button onClick={startCheckout} disabled={action !== null}>
              <CreditCard />
              {action === "checkout" ? "Redirigiendo…" : "Activar suscripción"}
            </Button>
          ) : undefined
        }
      />

      {checkout === "success" && (
        <Card className="flex items-center gap-2 border-success/40 bg-success/10 p-4 text-sm text-success">
          <Check className="size-4" /> Pago completado. La suscripción se activará
          en unos momentos.
        </Card>
      )}
      {checkout === "cancelled" && (
        <Card className="flex items-center gap-2 border-warning/40 bg-warning/10 p-4 text-sm text-warning">
          <AlertCircle className="size-4" /> Checkout cancelado. No se realizó
          ningún cargo.
        </Card>
      )}
      {error && (
        <Card className="flex items-center gap-2 border-danger/40 bg-danger/10 p-4 text-sm text-danger">
          <AlertCircle className="size-4" /> {error}
        </Card>
      )}

      {loading ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          Cargando facturación…
        </Card>
      ) : (
        <>
          {summary && (
            <Card className="sky-rise p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold">
                      Plan {summary.tier.label}
                    </h3>
                    <Pill tone={meta.tone} label={meta.label} size="sm" />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {summary.seatCount} asiento
                    {summary.seatCount === 1 ? "" : "s"} en uso
                    {summary.tier.overageQuantity > 0 &&
                      ` · ${summary.tier.overageQuantity} sobre el límite`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold tabular-nums">
                    {mxn.format(summary.monthlyEstimateMxn)}
                  </p>
                  <p className="text-xs text-muted-foreground">estimado / mes</p>
                </div>
              </div>

              {hasSubscription && (
                <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4 text-sm sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Periodo actual</p>
                    <p className="font-medium">
                      {formatDate(summary.billing.currentPeriodStart)} —{" "}
                      {formatDate(summary.billing.currentPeriodEnd)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Renovación</p>
                    <p className="font-medium">
                      {summary.billing.cancelAtPeriodEnd
                        ? "Se cancela al final del periodo"
                        : "Automática"}
                    </p>
                  </div>
                </div>
              )}

              {!isOwner && (
                <p className="mt-4 text-xs text-muted-foreground">
                  Solo el propietario de la organización puede modificar la
                  suscripción.
                </p>
              )}
            </Card>
          )}

          <div>
            <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
              Planes disponibles
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {plans.map((plan) => {
                const current = summary?.tier.key === plan.key;
                return (
                  <Card
                    key={plan.key}
                    className={cn(
                      "flex flex-col gap-2 p-5",
                      current && "ring-2 ring-primary",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">{plan.label}</h4>
                      {current && (
                        <Pill tone="info" label="Actual" size="sm" />
                      )}
                    </div>
                    <p className="text-xl font-bold tabular-nums">
                      {mxn.format(plan.monthlyAmountMxn)}
                      <span className="text-xs font-normal text-muted-foreground">
                        {" "}
                        / mes
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {plan.maxUsers === null
                        ? `${plan.minUsers}+ usuarios`
                        : `${plan.minUsers}–${plan.maxUsers} usuarios`}
                    </p>
                    <p className="mt-auto text-xs text-muted-foreground">
                      {plan.notes}
                    </p>
                  </Card>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

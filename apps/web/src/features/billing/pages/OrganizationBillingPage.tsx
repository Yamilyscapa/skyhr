import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CreditCard, Loader2, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import API, { type BillingPlan, type OrganizationBillingSummary } from "@/api";
import {
  useOrganizationRole,
  useOrganizationStore,
} from "@/store/organization-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

const mxnFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

const statusLabels: Record<string, string> = {
  active: "Activa",
  trialing: "Periodo de prueba",
  past_due: "Pago pendiente",
  canceled: "Cancelada",
  incomplete: "Pendiente de completar",
  incomplete_expired: "Expirada",
  unpaid: "Sin pagar",
  inactive: "Sin suscripcion",
};

export function OrganizationBillingPage() {
  const organization = useOrganizationStore((state) => state.organization);
  const role = useOrganizationRole();
  const [summary, setSummary] = useState<OrganizationBillingSummary | null>(
    null,
  );
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManageBilling = role === "owner";

  const currentStatusLabel = useMemo(() => {
    const status = summary?.billing.status ?? "inactive";
    return statusLabels[status] ?? status;
  }, [summary?.billing.status]);

  const loadBilling = async () => {
    if (!organization?.id) {
      setSummary(null);
      setPlans([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [summaryResponse, plansResponse] = await Promise.all([
        API.getOrganizationBillingSummary(organization.id),
        API.getBillingPlans(),
      ]);

      setSummary(summaryResponse?.data ?? null);
      setPlans(plansResponse?.data ?? []);
    } catch (loadError) {
      console.error("Failed to load billing data", loadError);
      const message =
        loadError instanceof Error
          ? loadError.message
          : "No se pudo cargar la informacion de facturacion.";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadBilling();
  }, [organization?.id]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const checkoutState = params.get("checkout");

    if (checkoutState === "success") {
      toast.success(
        "Pago completado en Stripe. Actualizamos tu estado de facturacion.",
      );
      void loadBilling();
      return;
    }

    if (checkoutState === "cancelled") {
      toast.message(
        "El checkout fue cancelado. Puedes retomarlo cuando quieras.",
      );
    }
  }, []);

  const handleStartCheckout = async () => {
    if (!organization?.id) {
      return;
    }

    setIsRedirecting(true);
    try {
      const response = await API.createStripeCheckoutSession(organization.id);
      const checkoutUrl = response?.data?.checkoutUrl;

      if (!checkoutUrl) {
        throw new Error("Stripe no devolvio una URL de checkout valida.");
      }

      window.location.assign(checkoutUrl);
    } catch (checkoutError) {
      console.error("Failed to create Stripe checkout session", checkoutError);
      const message =
        checkoutError instanceof Error
          ? checkoutError.message
          : "No se pudo iniciar el checkout de Stripe.";
      toast.error(message);
      setIsRedirecting(false);
    }
  };

  const handleOpenPortal = async () => {
    if (!organization?.id) {
      return;
    }

    setIsRedirecting(true);
    try {
      const response = await API.createStripePortalSession(organization.id);
      const portalUrl = response?.data?.portalUrl;

      if (!portalUrl) {
        throw new Error("Stripe no devolvio una URL de portal valida.");
      }

      window.location.assign(portalUrl);
    } catch (portalError) {
      console.error(
        "Failed to create Stripe billing portal session",
        portalError,
      );
      const message =
        portalError instanceof Error
          ? portalError.message
          : "No se pudo abrir el portal de Stripe.";
      toast.error(message);
      setIsRedirecting(false);
    }
  };

  if (!organization) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Sin organizacion activa</CardTitle>
            <CardDescription>
              Activa una organizacion para gestionar la facturacion.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Facturacion</h1>
        <p className="text-sm text-muted-foreground">
          Tu pago se procesa en Stripe con redireccion segura.
        </p>
      </div>

      {!canManageBilling ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Solo el owner puede pagar</AlertTitle>
          <AlertDescription>
            Puedes revisar el estado de la suscripcion, pero solo el owner de la
            organizacion puede abrir checkout o portal.
          </AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error cargando facturacion</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Resumen actual</CardTitle>
          <CardDescription>
            El owner cuenta como un usuario facturable.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-5 w-56" />
              <Skeleton className="h-5 w-64" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Estado: {currentStatusLabel}</Badge>
                <Badge variant="outline">
                  Asientos: {summary?.seatCount ?? 1}
                </Badge>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Plan aplicado</p>
                  <p className="text-sm font-medium">
                    {summary?.tier.label ?? "-"}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">
                    Estimado mensual
                  </p>
                  <p className="text-sm font-medium">
                    {mxnFormatter.format(summary?.monthlyEstimateMxn ?? 0)}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">
                    Usuarios extra (+100)
                  </p>
                  <p className="text-sm font-medium">
                    {summary?.tier.overageQuantity ?? 0}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handleStartCheckout}
                  disabled={!canManageBilling || isRedirecting}
                  className="gap-2"
                >
                  {isRedirecting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CreditCard className="size-4" />
                  )}
                  Suscribirme con Stripe
                </Button>

                <Button
                  variant="outline"
                  onClick={handleOpenPortal}
                  disabled={
                    !canManageBilling ||
                    isRedirecting ||
                    !summary?.billing.stripeCustomerId
                  }
                  className="gap-2"
                >
                  {isRedirecting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RefreshCcw className="size-4" />
                  )}
                  Gestionar en Stripe
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tabla de precios</CardTitle>
          <CardDescription>
            Rango por usuarios activos en la organizacion.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {plans.map((plan) => (
            <div key={plan.key} className="rounded-lg border p-4 space-y-1">
              <p className="text-sm font-semibold">{plan.label}</p>
              <p className="text-sm">
                {mxnFormatter.format(plan.monthlyAmountMxn)} / mes
              </p>
              <p className="text-xs text-muted-foreground">{plan.notes}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

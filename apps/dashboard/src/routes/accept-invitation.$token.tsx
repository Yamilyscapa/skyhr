import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient, useSession } from "@/lib/auth/client";

export const Route = createFileRoute("/accept-invitation/$token")({
  component: AcceptInvitationPage,
});

type Status = "checking" | "needs-auth" | "ready" | "accepting" | "done" | "error";

function AcceptInvitationPage() {
  const { token } = useParams({ from: "/accept-invitation/$token" });
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("checking");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isPending) return;
    if (!session) {
      setStatus("needs-auth");
      return;
    }
    setStatus("ready");
  }, [isPending, session]);

  async function accept() {
    setStatus("accepting");
    setMessage(null);
    try {
      const res = await authClient.organization.acceptInvitation({
        invitationId: token,
      });
      if (res.error) {
        setStatus("error");
        setMessage(res.error.message ?? "No se pudo aceptar la invitación");
        return;
      }
      const orgId = res.data?.invitation?.organizationId;
      if (orgId) {
        await authClient.organization.setActive({ organizationId: orgId });
      }
      setStatus("done");
      navigate({ to: "/overview" });
    } catch (err) {
      setStatus("error");
      setMessage((err as Error).message ?? "Error inesperado");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex flex-col gap-2">
          <img src="/skyhr-logo.png" alt="SkyHR" className="size-12 rounded-lg" />
          <h1 className="text-xl font-bold">Invitación a organización</h1>
        </div>

        {status === "checking" && (
          <p className="text-sm text-muted-foreground">Verificando…</p>
        )}

        {status === "needs-auth" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Inicia sesión o crea una cuenta para aceptar la invitación.
            </p>
            <Button onClick={() => navigate({ to: "/login" })}>Iniciar sesión</Button>
            <Button variant="secondary" onClick={() => navigate({ to: "/signup" })}>
              Crear cuenta
            </Button>
          </div>
        )}

        {status === "ready" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Confirma para unirte a la organización.
            </p>
            <Button onClick={accept}>Aceptar invitación</Button>
          </div>
        )}

        {status === "accepting" && (
          <p className="text-sm text-muted-foreground">Procesando…</p>
        )}

        {status === "done" && (
          <p className="text-sm text-success">Listo. Redirigiendo…</p>
        )}

        {status === "error" && message && (
          <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

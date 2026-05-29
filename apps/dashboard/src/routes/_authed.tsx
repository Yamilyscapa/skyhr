import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useActiveOrganization, useSession } from "@/lib/auth/client";

export const Route = createFileRoute("/_authed")({
  component: AuthedLayout,
});

function FullPageLoader({ label = "Cargando…" }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function AuthedLayout() {
  const { data: session, isPending: sessionPending } = useSession();
  const { data: activeOrg, isPending: orgPending } = useActiveOrganization();
  const navigate = useNavigate();

  useEffect(() => {
    if (sessionPending) return;
    if (!session) {
      navigate({ to: "/login" });
      return;
    }
    if (!orgPending && !activeOrg) {
      navigate({ to: "/onboarding" });
    }
  }, [sessionPending, session, orgPending, activeOrg, navigate]);

  if (sessionPending) return <FullPageLoader />;
  if (!session) return <FullPageLoader label="Redirigiendo…" />;
  if (orgPending) return <FullPageLoader />;
  if (!activeOrg) return <FullPageLoader label="Configurando organización…" />;

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

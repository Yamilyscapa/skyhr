import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, useSession } from "@/lib/auth/client";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function OnboardingPage() {
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPending && !session) navigate({ to: "/login" });
  }, [isPending, session, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const finalSlug = slug.trim() || slugify(name);
      const res = await authClient.organization.create({
        name: name.trim(),
        slug: finalSlug,
      });
      if (res.error) {
        setError(res.error.message ?? "No se pudo crear la organización");
        return;
      }
      const orgId = res.data?.id;
      if (orgId) {
        await authClient.organization.setActive({ organizationId: orgId });
      }
      navigate({ to: "/overview" });
    } catch (err) {
      setError((err as Error).message ?? "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex flex-col gap-2">
          <img src="/skyhr-logo.png" alt="SkyHR" className="size-12 rounded-lg" />
          <h1 className="text-xl font-bold">Crea tu organización</h1>
          <p className="text-sm text-muted-foreground">
            Configura el espacio para tu equipo en SkyHR.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="org-name">Nombre</Label>
            <Input
              id="org-name"
              required
              placeholder="Grupo Aurora"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slug) setSlug(slugify(e.target.value));
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="org-slug">Identificador</Label>
            <Input
              id="org-slug"
              required
              placeholder="grupo-aurora"
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Único, en minúsculas, sin espacios.
            </p>
          </div>

          {error && (
            <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading}>
            {loading ? "Creando…" : "Crear organización"}
          </Button>
        </form>
      </div>
    </div>
  );
}

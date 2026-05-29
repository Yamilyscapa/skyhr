import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await authClient.signUp.email({ email, password, name });
      if (res.error) {
        setError(res.error.message ?? "No fue posible crear cuenta");
        return;
      }
      navigate({ to: "/onboarding" });
    } catch (err) {
      setError((err as Error).message ?? "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <img src="/skyhr-logo.png" alt="SkyHR" className="size-12 rounded-lg" />
          <h1 className="text-xl font-bold">Crear cuenta</h1>
          <p className="text-sm text-muted-foreground">Empieza a usar SkyHR</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Correo</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading}>
            {loading ? "Creando…" : "Crear cuenta"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" className="font-semibold text-primary">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}

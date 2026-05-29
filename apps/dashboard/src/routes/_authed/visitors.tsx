import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  Check,
  DoorOpen,
  Plus,
  X,
  Ban,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Pill } from "@/components/status-badge";
import { api } from "@/lib/api";
import { queries, invalidate } from "@/lib/api/queries";
import type { VisitorStatus } from "@/lib/api";

export const Route = createFileRoute("/_authed/visitors")({
  component: VisitorsPage,
  loader: async ({ context: { queryClient } }) => {
    await Promise.all([
      queryClient.ensureQueryData(queries.visitors({ pageSize: 50 })),
    ]);
  },
});

const STATUS_META: Record<
  VisitorStatus,
  { tone: "success" | "warning" | "danger" | "neutral"; label: string }
> = {
  pending: { tone: "warning", label: "Pendiente" },
  approved: { tone: "success", label: "Aprobado" },
  rejected: { tone: "danger", label: "Rechazado" },
  cancelled: { tone: "neutral", label: "Cancelado" },
};

const tabs: Array<{ value: VisitorStatus | "all"; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendientes" },
  { value: "approved", label: "Aprobados" },
  { value: "rejected", label: "Rechazados" },
  { value: "cancelled", label: "Cancelados" },
];

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function VisitorsPage() {
  const queryClient = useQueryClient();
  const { data: visitorsRes } = useQuery(queries.visitors({ pageSize: 50 }));
  const [tab, setTab] = useState<VisitorStatus | "all">("all");
  const [busy, setBusy] = useState<string | null>(null);

  const visitors = useMemo(() => visitorsRes?.data ?? [], [visitorsRes]);

  const rows = useMemo(
    () => visitors.filter((v) => tab === "all" || v.status === tab),
    [visitors, tab],
  );

  async function act(
    id: string,
    fn: (id: string) => Promise<unknown>,
  ) {
    setBusy(id);
    try {
      await fn(id);
      void queryClient.invalidateQueries({ queryKey: invalidate.visitors });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Accesos"
        title="Visitantes"
        description="Registra visitas, aprueba accesos y controla las áreas permitidas."
        actions={<VisitorDialog />}
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as VisitorStatus | "all")}>
        <TabsList className="flex-wrap">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-col gap-4">
        {rows.map((v) => {
          const meta = STATUS_META[v.status];
          return (
            <Card key={v.id} className="sky-rise p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex gap-4">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                    <DoorOpen className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold">{v.name}</h3>
                      <Pill tone={meta.tone} label={meta.label} size="sm" />
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarClock className="size-3.5" />
                        {formatDateTime(v.entry_date)} — {formatDateTime(v.exit_date)}
                      </span>
                      {v.created_by_name && (
                        <span>Registró: {v.created_by_name}</span>
                      )}
                      {v.status === "approved" && v.approved_by_name && (
                        <span>Aprobó: {v.approved_by_name}</span>
                      )}
                    </div>
                    {v.access_areas.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {v.access_areas.map((a) => (
                          <span
                            key={a}
                            className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium capitalize text-muted-foreground"
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {v.status === "pending" && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy === v.id}
                      onClick={() => act(v.id, api.visitors.reject)}
                    >
                      <X /> Rechazar
                    </Button>
                    <Button
                      size="sm"
                      disabled={busy === v.id}
                      onClick={() => act(v.id, api.visitors.approve)}
                    >
                      <Check /> Aprobar
                    </Button>
                  </div>
                )}
                {v.status === "approved" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy === v.id}
                    onClick={() => act(v.id, api.visitors.cancel)}
                  >
                    <Ban /> Cancelar
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
        {rows.length === 0 && (
          <Card className="p-12 text-center text-sm text-muted-foreground">
            No hay visitantes en esta categoría.
          </Card>
        )}
      </div>
    </div>
  );
}

function VisitorDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [areas, setAreas] = useState("");
  const [entry, setEntry] = useState("");
  const [exit, setExit] = useState("");
  const [approveNow, setApproveNow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const accessAreas = areas
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);
    if (accessAreas.length === 0) {
      setError("Indica al menos un área de acceso");
      return;
    }
    setLoading(true);
    try {
      await api.visitors.create({
        name: name.trim(),
        accessAreas,
        entryDate: new Date(entry).toISOString(),
        exitDate: new Date(exit).toISOString(),
        approveNow,
      });
      setOpen(false);
      setName("");
      setAreas("");
      setEntry("");
      setExit("");
      setApproveNow(false);
      void queryClient.invalidateQueries({ queryKey: invalidate.visitors });
    } catch (err) {
      setError((err as Error).message ?? "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Nuevo visitante
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo visitante</DialogTitle>
          <DialogDescription>
            Registra una visita y las áreas a las que tendrá acceso.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="v-name">Nombre</Label>
            <Input
              id="v-name"
              required
              placeholder="Ej. Juan Pérez"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="v-areas">Áreas de acceso</Label>
            <Input
              id="v-areas"
              required
              placeholder="recepción, almacén, oficinas"
              value={areas}
              onChange={(e) => setAreas(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Separa las áreas con comas.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="v-entry">Entrada</Label>
              <Input
                id="v-entry"
                type="datetime-local"
                required
                value={entry}
                onChange={(e) => setEntry(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="v-exit">Salida</Label>
              <Input
                id="v-exit"
                type="datetime-local"
                required
                value={exit}
                onChange={(e) => setExit(e.target.value)}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={approveNow}
              onChange={(e) => setApproveNow(e.target.checked)}
              className="size-4 rounded border-border"
            />
            Aprobar de inmediato
          </label>

          {error && (
            <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
              {error}
            </p>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando…" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarRange, Check, FileText, X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PermissionBadge } from "@/components/status-badge";
import { api } from "@/lib/api";
import type { Permission, PermissionStatus } from "@/data/types";

export const Route = createFileRoute("/permissions")({
  component: PermissionsPage,
  loader: async (): Promise<Permission[]> => {
    const res = await api.permissions.list({ pageSize: 100 });
    return res.data.map((p): Permission => ({
      id: p.id,
      employeeName: p.employeeName ?? "—",
      employeeRole: p.employeeRole ?? "—",
      message: p.message,
      startingDate: p.startingDate,
      endDate: p.endDate,
      status: p.status,
      documentsCount: p.documentsUrl.length,
      approvedBy: p.approvedByName ?? null,
      supervisorComment: p.supervisorComment,
      createdAt: p.createdAt,
    }));
  },
});

function formatRange(start: string, end: string): string {
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" }).format(
      new Date(iso),
    );
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
}

const tabs: Array<{ value: PermissionStatus | "all"; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "pending", label: "Pendientes" },
  { value: "approved", label: "Aprobadas" },
  { value: "rejected", label: "Rechazadas" },
];

function PermissionsPage() {
  const initial = Route.useLoaderData();
  const [list, setList] = useState<Permission[]>(initial);
  const [tab, setTab] = useState<PermissionStatus | "all">("pending");

  const rows = useMemo(
    () => list.filter((p) => tab === "all" || p.status === tab),
    [list, tab],
  );

  const pendingCount = list.filter((p) => p.status === "pending").length;

  async function resolve(id: string, status: PermissionStatus) {
    const comment = status === "approved" ? "Aprobado." : "Rechazado.";
    try {
      const res =
        status === "approved"
          ? await api.permissions.approve(id, comment)
          : await api.permissions.reject(id, comment);
      const updated = res.data;
      setList((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                status: updated.status,
                approvedBy: updated.approvedByName ?? null,
                supervisorComment: updated.supervisorComment,
              }
            : p,
        ),
      );
    } catch (err) {
      console.error("permission resolve failed", err);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Solicitudes"
        title="Permisos"
        description={
          pendingCount > 0
            ? `${pendingCount} ${pendingCount === 1 ? "solicitud" : "solicitudes"} esperan tu aprobación.`
            : "No hay solicitudes pendientes."
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as PermissionStatus | "all")}>
        <TabsList className="flex-wrap">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {rows.map((p) => (
          <Card key={p.id} className="sky-rise flex flex-col gap-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar name={p.employeeName} />
                <div>
                  <p className="font-semibold leading-tight">{p.employeeName}</p>
                  <p className="text-xs text-muted-foreground">{p.employeeRole}</p>
                </div>
              </div>
              <PermissionBadge status={p.status} />
            </div>

            <p className="text-sm text-muted-foreground">{p.message}</p>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarRange className="size-3.5" />
                {formatRange(p.startingDate, p.endDate)}
              </span>
              {p.documentsCount > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <FileText className="size-3.5" />
                  {p.documentsCount}{" "}
                  {p.documentsCount === 1 ? "documento" : "documentos"}
                </span>
              )}
            </div>

            {p.status === "pending" ? (
              <div className="flex gap-2 border-t border-border pt-4">
                <Button
                  variant="success"
                  size="sm"
                  className="flex-1"
                  onClick={() => resolve(p.id, "approved")}
                >
                  <Check /> Aprobar
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1 text-danger"
                  onClick={() => resolve(p.id, "rejected")}
                >
                  <X /> Rechazar
                </Button>
              </div>
            ) : (
              p.supervisorComment && (
                <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs">
                  <span className="font-medium">{p.approvedBy}: </span>
                  <span className="text-muted-foreground">
                    {p.supervisorComment}
                  </span>
                </div>
              )
            )}
          </Card>
        ))}
        {rows.length === 0 && (
          <Card className="col-span-full p-12 text-center text-sm text-muted-foreground">
            No hay solicitudes en esta categoría.
          </Card>
        )}
      </div>
    </div>
  );
}

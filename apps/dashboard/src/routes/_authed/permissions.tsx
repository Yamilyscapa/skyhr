import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarRange, Check, Eye, FileText, X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PermissionBadge } from "@/components/status-badge";
import { api } from "@/lib/api";
import { queries, invalidate } from "@/lib/api/queries";
import { formatDateLong } from "@/lib/utils";
import type { Permission, PermissionStatus } from "@/data/types";

type PermissionRow = Permission & { documentsUrl: string[] };

export const Route = createFileRoute("/_authed/permissions")({
  component: PermissionsPage,
  loader: async ({ context: { queryClient } }) => {
    await Promise.all([
      queryClient.ensureQueryData(queries.permissions({ pageSize: 100 })),
    ]);
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
  const queryClient = useQueryClient();
  const { data: permissionsRes } = useQuery(
    queries.permissions({ pageSize: 100 }),
  );
  const [tab, setTab] = useState<PermissionStatus | "all">("pending");
  const [detail, setDetail] = useState<PermissionRow | null>(null);

  const list = useMemo<PermissionRow[]>(
    () =>
      (permissionsRes?.data ?? []).map((p): PermissionRow => ({
        id: p.id,
        employeeName: p.employeeName ?? "—",
        employeeRole: p.employeeRole ?? "—",
        message: p.message,
        startingDate: p.startingDate,
        endDate: p.endDate,
        status: p.status,
        documentsCount: p.documentsUrl.length,
        documentsUrl: p.documentsUrl,
        approvedBy: p.approvedByName ?? null,
        supervisorComment: p.supervisorComment,
        createdAt: p.createdAt,
      })),
    [permissionsRes],
  );

  const rows = useMemo(
    () => list.filter((p) => tab === "all" || p.status === tab),
    [list, tab],
  );

  const pendingCount = list.filter((p) => p.status === "pending").length;

  async function resolve(id: string, status: PermissionStatus, comment?: string) {
    const finalComment =
      comment?.trim() || (status === "approved" ? "Aprobado." : "Rechazado.");
    if (status === "approved") {
      await api.permissions.approve(id, finalComment);
    } else {
      await api.permissions.reject(id, finalComment);
    }
    void queryClient.invalidateQueries({ queryKey: invalidate.permissions });
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
              <div className="flex items-center gap-1.5">
                <PermissionBadge status={p.status} />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Ver detalle"
                  onClick={() => setDetail(p)}
                >
                  <Eye />
                </Button>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">{p.message}</p>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarRange className="size-3.5" />
                {formatRange(p.startingDate, p.endDate)}
              </span>
              {p.documentsCount > 0 && (
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  <FileText className="size-3.5" />
                  {p.documentsUrl.map((url, i) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline-offset-2 hover:text-foreground hover:underline"
                    >
                      Documento {i + 1}
                    </a>
                  ))}
                </span>
              )}
            </div>

            {p.status === "pending" ? (
              <div className="flex gap-2 border-t border-border pt-4">
                <Button
                  variant="success"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    void resolve(p.id, "approved").catch((err) =>
                      console.error("permission resolve failed", err),
                    );
                  }}
                >
                  <Check /> Aprobar
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1 text-danger"
                  onClick={() => {
                    void resolve(p.id, "rejected").catch((err) =>
                      console.error("permission resolve failed", err),
                    );
                  }}
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

      <DetailDialog
        permission={detail}
        onOpenChange={(open) => !open && setDetail(null)}
        onResolve={resolve}
      />
    </div>
  );
}

function DetailDialog({
  permission,
  onOpenChange,
  onResolve,
}: {
  permission: PermissionRow | null;
  onOpenChange: (open: boolean) => void;
  onResolve: (
    id: string,
    status: PermissionStatus,
    comment?: string,
  ) => Promise<void>;
}) {
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState<PermissionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setComment("");
    setError(null);
    setLoading(null);
  }, [permission]);

  async function act(status: PermissionStatus) {
    if (!permission) return;
    setLoading(status);
    setError(null);
    try {
      await onResolve(permission.id, status, comment);
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message ?? "Error inesperado");
    } finally {
      setLoading(null);
    }
  }

  return (
    <Dialog open={permission !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Detalle de solicitud</DialogTitle>
          <DialogDescription>
            {permission?.employeeName} · {permission?.employeeRole}
          </DialogDescription>
        </DialogHeader>

        {permission && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <PermissionBadge status={permission.status} />
              <span className="text-xs text-muted-foreground">
                Solicitado {formatDateLong(permission.createdAt)}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <Label>Periodo</Label>
              <p className="text-sm">
                {formatDateLong(permission.startingDate)} —{" "}
                {formatDateLong(permission.endDate)}
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <Label>Mensaje</Label>
              <p className="text-sm text-muted-foreground">
                {permission.message}
              </p>
            </div>

            {permission.documentsUrl.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <Label>Documentos</Label>
                <div className="flex flex-col gap-1">
                  {permission.documentsUrl.map((url, i) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-primary underline-offset-2 hover:underline"
                    >
                      <FileText className="size-3.5" /> Documento {i + 1}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {permission.status === "pending" ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="comment">Comentario (opcional)</Label>
                <Textarea
                  id="comment"
                  placeholder="Agrega una nota para el empleado…"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </div>
            ) : (
              permission.supervisorComment && (
                <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs">
                  <span className="font-medium">{permission.approvedBy}: </span>
                  <span className="text-muted-foreground">
                    {permission.supervisorComment}
                  </span>
                </div>
              )
            )}

            {error && (
              <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
                {error}
              </p>
            )}
          </div>
        )}

        {permission?.status === "pending" && (
          <DialogFooter>
            <Button
              variant="secondary"
              className="text-danger"
              onClick={() => act("rejected")}
              disabled={loading !== null}
            >
              <X /> {loading === "rejected" ? "Rechazando…" : "Rechazar"}
            </Button>
            <Button
              variant="success"
              onClick={() => act("approved")}
              disabled={loading !== null}
            >
              <Check /> {loading === "approved" ? "Aprobando…" : "Aprobar"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

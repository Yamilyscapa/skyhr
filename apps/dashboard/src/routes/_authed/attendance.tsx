import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  MapPin,
  Pencil,
  UserX,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AttendanceBadge } from "@/components/status-badge";
import { api } from "@/lib/api";
import { queries, invalidate } from "@/lib/api/queries";
import { formatDateShort } from "@/lib/utils";
import type { AttendanceEvent, AttendanceStatus } from "@/data/types";

const STATUS_OPTIONS: Array<{ value: AttendanceStatus; label: string }> = [
  { value: "on_time", label: "A tiempo" },
  { value: "late", label: "Tarde" },
  { value: "early", label: "Anticipado" },
  { value: "absent", label: "Ausente" },
  { value: "out_of_bounds", label: "Fuera de zona" },
];

const STATUS_FILTERS = ["on_time", "late", "early", "absent", "out_of_bounds"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number] | "all";

interface AttendanceSearch {
  status: StatusFilter;
}

function isStatusFilter(value: unknown): value is StatusFilter {
  return value === "all" || STATUS_FILTERS.includes(value as (typeof STATUS_FILTERS)[number]);
}

function fmtTime(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Build the list query param identically in loader + component so the query key
// matches. Omit `status` entirely for the "all" filter.
function listParams(status: StatusFilter) {
  return {
    pageSize: 100,
    ...(status !== "all" ? { status } : {}),
  };
}

export const Route = createFileRoute("/_authed/attendance")({
  component: AttendancePage,
  validateSearch: (search: Record<string, unknown>): AttendanceSearch => ({
    status: isStatusFilter(search.status) ? search.status : "all",
  }),
  loaderDeps: ({ search }) => ({ status: search.status }),
  loader: async ({ deps, context: { queryClient } }) => {
    const day = todayStr();
    await Promise.all([
      queryClient.ensureQueryData(
        queries.attendanceEvents(listParams(deps.status)),
      ),
      queryClient.ensureQueryData(
        queries.attendanceEvents({
          start_date: day,
          end_date: day,
          pageSize: 200,
        }),
      ),
    ]);
  },
});

function formatHours(minutes: number): string {
  if (minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

const filters: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "on_time", label: "A tiempo" },
  { value: "late", label: "Tarde" },
  { value: "absent", label: "Ausente" },
  { value: "out_of_bounds", label: "Fuera de zona" },
];

function exportCsv(events: AttendanceEvent[]) {
  const headers = ["Empleado", "Ubicación", "Fecha", "Entrada", "Salida", "Minutos", "Estado", "En geocerca"];
  const rows = events.map((e) => [
    e.employeeName,
    e.location,
    e.date,
    e.checkIn ?? "",
    e.checkOut ?? "",
    String(e.workMinutes),
    e.status,
    e.isWithinGeofence ? "sí" : "no",
  ]);
  const csv = [headers, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `attendance_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function AttendancePage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  const [editEvent, setEditEvent] = useState<AttendanceEvent | null>(null);
  const [markingAbsences, setMarkingAbsences] = useState(false);

  const day = todayStr();
  const { data: filteredRes } = useQuery(
    queries.attendanceEvents(listParams(search.status)),
  );
  const { data: todayRes } = useQuery(
    queries.attendanceEvents({ start_date: day, end_date: day, pageSize: 200 }),
  );

  const events = useMemo<AttendanceEvent[]>(
    () =>
      (filteredRes?.data ?? []).map((e): AttendanceEvent => {
        const checkIn = new Date(e.check_in);
        const checkOut = e.check_out ? new Date(e.check_out) : null;
        const workMinutes = checkOut
          ? Math.max(
              0,
              Math.round((checkOut.getTime() - checkIn.getTime()) / 60000),
            )
          : 0;
        return {
          id: e.id,
          employeeName: e.employee_name ?? "—",
          employeeId: e.user_id ?? "",
          location: e.location_name ?? "—",
          date: checkIn.toISOString().slice(0, 10),
          checkIn: fmtTime(checkIn),
          checkOut: checkOut ? fmtTime(checkOut) : null,
          status: (e.status as AttendanceStatus) ?? "on_time",
          isWithinGeofence: e.is_within_geofence,
          workMinutes,
        };
      }),
    [filteredRes],
  );

  const summary = useMemo(() => {
    const data = todayRes?.data ?? [];
    return {
      onTime: data.filter(
        (e) => e.status === "on_time" || e.status === "early",
      ).length,
      late: data.filter((e) => e.status === "late").length,
      absent: data.filter((e) => e.status === "absent").length,
      flagged: data.filter((e) => e.status === "out_of_bounds").length,
    };
  }, [todayRes]);

  const monthLabel = useMemo(() => {
    return new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(new Date());
  }, []);

  async function markAbsences() {
    setMarkingAbsences(true);
    try {
      await api.attendance.markAbsences();
      void queryClient.invalidateQueries({ queryKey: invalidate.attendance });
    } finally {
      setMarkingAbsences(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Reportes"
        title="Asistencia"
        description="Registros de entrada y salida con verificación de geocerca."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={markAbsences}
              disabled={markingAbsences}
            >
              <UserX /> {markingAbsences ? "Marcando…" : "Marcar ausencias"}
            </Button>
            <Button variant="secondary" onClick={() => exportCsv(events)}>
              <Download /> Exportar CSV
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryTile label="A tiempo" value={summary.onTime} tone="success" />
        <SummaryTile label="Con retardo" value={summary.late} tone="warning" />
        <SummaryTile label="Ausencias" value={summary.absent} tone="danger" />
        <SummaryTile label="Fuera de zona" value={summary.flagged} tone="danger" />
      </div>

      <Card className="sky-rise overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="icon" aria-label="Mes anterior" disabled>
              <ChevronLeft />
            </Button>
            <span className="min-w-36 text-center text-sm font-semibold capitalize">
              {monthLabel}
            </span>
            <Button variant="secondary" size="icon" aria-label="Mes siguiente" disabled>
              <ChevronRight />
            </Button>
          </div>

          <Tabs
            value={search.status}
            onValueChange={(v) =>
              navigate({ search: { status: v as StatusFilter } })
            }
          >
            <TabsList className="flex-wrap">
              {filters.map((f) => (
                <TabsTrigger key={f.value} value={f.value}>
                  {f.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Empleado</TableHead>
              <TableHead>Ubicación</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead data-numeric>Entrada</TableHead>
              <TableHead data-numeric>Salida</TableHead>
              <TableHead data-numeric>Horas</TableHead>
              <TableHead className="text-right">Estado</TableHead>
              <TableHead className="w-10" aria-label="Acciones" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((e) => (
              <TableRow key={e.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar name={e.employeeName} size={32} />
                    <span className="font-semibold">{e.employeeName}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin
                      className={
                        e.isWithinGeofence
                          ? "size-4 text-success"
                          : "size-4 text-danger"
                      }
                    />
                    {e.location}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDateShort(e.date)}
                </TableCell>
                <TableCell data-numeric>{e.checkIn ?? "—"}</TableCell>
                <TableCell data-numeric>{e.checkOut ?? "—"}</TableCell>
                <TableCell data-numeric className="font-semibold">
                  {formatHours(e.workMinutes)}
                </TableCell>
                <TableCell className="text-right">
                  <AttendanceBadge
                    status={e.status}
                    className="w-36 justify-center"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Editar estado"
                    onClick={() => setEditEvent(e)}
                  >
                    <Pencil />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {events.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                  Sin registros para este filtro.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <EditStatusDialog
        event={editEvent}
        onOpenChange={(open) => !open && setEditEvent(null)}
      />
    </div>
  );
}

function EditStatusDialog({
  event,
  onOpenChange,
}: {
  event: AttendanceEvent | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AttendanceStatus>("on_time");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync local state when a new event is opened.
  useEffect(() => {
    if (event) {
      setStatus(event.status);
      setNotes("");
      setError(null);
    }
  }, [event]);

  async function handleSave() {
    if (!event) return;
    setLoading(true);
    setError(null);
    try {
      await api.attendance.updateStatus(event.id, status, notes || undefined);
      onOpenChange(false);
      void queryClient.invalidateQueries({ queryKey: invalidate.attendance });
    } catch (err) {
      setError((err as Error).message ?? "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={event !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar estado</DialogTitle>
          <DialogDescription>
            {event?.employeeName} · {event ? formatDateShort(event.date) : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Estado</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as AttendanceStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Input
              id="notes"
              placeholder="Motivo del ajuste…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {error && (
            <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "danger";
}) {
  const color = {
    success: "var(--success)",
    warning: "var(--warning)",
    danger: "var(--danger)",
  }[tone];
  return (
    <Card className="sky-rise p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums" style={{ color }}>
        {value}
      </p>
    </Card>
  );
}

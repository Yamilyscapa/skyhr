import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Download, MapPin } from "lucide-react";
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
import { AttendanceBadge } from "@/components/status-badge";
import { api } from "@/lib/api";
import type { AttendanceEvent, AttendanceStatus } from "@/data/types";

export const Route = createFileRoute("/attendance")({
  component: AttendancePage,
  loader: async (): Promise<AttendanceEvent[]> => {
    const res = await api.attendance.events({ pageSize: 100 });
    return res.data.map((e): AttendanceEvent => {
      const checkIn = new Date(e.check_in);
      const checkOut = e.check_out ? new Date(e.check_out) : null;
      const workMinutes = checkOut
        ? Math.max(0, Math.round((checkOut.getTime() - checkIn.getTime()) / 60000))
        : 0;
      const fmtTime = (d: Date) =>
        `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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
    });
  },
});

function formatHours(minutes: number): string {
  if (minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

const filters: Array<{ value: AttendanceStatus | "all"; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "on_time", label: "A tiempo" },
  { value: "late", label: "Tarde" },
  { value: "absent", label: "Ausente" },
  { value: "out_of_bounds", label: "Fuera de zona" },
];

function AttendancePage() {
  const attendanceEvents = Route.useLoaderData();
  const [filter, setFilter] = useState<AttendanceStatus | "all">("all");

  const rows = useMemo(
    () =>
      attendanceEvents.filter((e) => filter === "all" || e.status === filter),
    [attendanceEvents, filter],
  );

  const summary = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const today = attendanceEvents.filter((e) => e.date === todayStr);
    return {
      onTime: today.filter((e) => e.status === "on_time" || e.status === "early").length,
      late: today.filter((e) => e.status === "late").length,
      absent: today.filter((e) => e.status === "absent").length,
      flagged: today.filter((e) => e.status === "out_of_bounds").length,
    };
  }, [attendanceEvents]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Reportes"
        title="Asistencia"
        description="Registros de entrada y salida con verificación de geocerca."
        actions={
          <Button variant="secondary">
            <Download /> Exportar CSV
          </Button>
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
            <Button variant="secondary" size="icon" aria-label="Mes anterior">
              <ChevronLeft />
            </Button>
            <span className="min-w-36 text-center text-sm font-semibold">
              Mayo 2026
            </span>
            <Button variant="secondary" size="icon" aria-label="Mes siguiente">
              <ChevronRight />
            </Button>
          </div>

          <Tabs value={filter} onValueChange={(v) => setFilter(v as AttendanceStatus | "all")}>
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((e) => (
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
                  {formatDate(e.date)}
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
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

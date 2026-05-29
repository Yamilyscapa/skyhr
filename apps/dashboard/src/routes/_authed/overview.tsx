import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  CalendarCheck,
  FileClock,
  Target,
  TrendingDown,
  Clock,
  DollarSign,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/stat-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/status-badge";
import {
  AttendanceTrendChart,
  HoursByDeptChart,
  StatusDonut,
  type AttendanceTrendPoint,
  type HoursByDeptPoint,
  type StatusDistributionPoint,
} from "@/components/charts";
import { queries } from "@/lib/api/queries";
import { cn, formatCurrency, formatRelativeTime } from "@/lib/utils";

const kpiIcons = [Users, CalendarCheck, FileClock, Target];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const toneDot: Record<string, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  neutral: "bg-muted-foreground",
};

export const Route = createFileRoute("/_authed/overview")({
  component: DashboardPage,
  loader: async ({ context: { queryClient } }) => {
    const day = todayStr();
    await Promise.all([
      queryClient.ensureQueryData(queries.currentUser()).catch(() => undefined),
      queryClient.ensureQueryData(queries.statsDashboard()).catch(() => undefined),
      queryClient.ensureQueryData(queries.statsTrends()).catch(() => undefined),
      queryClient
        .ensureQueryData(queries.statsHoursByDepartment({ period: "weekly" }))
        .catch(() => undefined),
      queryClient
        .ensureQueryData(queries.activity({ limit: 8 }))
        .catch(() => undefined),
      queryClient
        .ensureQueryData(
          queries.attendanceEvents({
            start_date: day,
            end_date: day,
            pageSize: 200,
          }),
        )
        .catch(() => undefined),
      queryClient
        .ensureQueryData(queries.statsCosts({ period: "monthly" }))
        .catch(() => undefined),
      queryClient
        .ensureQueryData(queries.statsLocations({ period: "monthly" }))
        .catch(() => undefined),
    ]);
  },
});

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function DashboardPage() {
  const day = todayStr();
  const { data: me } = useQuery(queries.currentUser());
  const { data: stats } = useQuery(queries.statsDashboard());
  const { data: trends } = useQuery(queries.statsTrends());
  const { data: hours } = useQuery(
    queries.statsHoursByDepartment({ period: "weekly" }),
  );
  const { data: activityRes } = useQuery(queries.activity({ limit: 8 }));
  const { data: todayEvents } = useQuery(
    queries.attendanceEvents({ start_date: day, end_date: day, pageSize: 200 }),
  );
  const { data: costsRes } = useQuery(queries.statsCosts({ period: "monthly" }));
  const { data: locationsRes } = useQuery(
    queries.statsLocations({ period: "monthly" }),
  );

  const greeting = useMemo(
    () => me?.name?.split(" ")[0] ?? "Admin",
    [me],
  );

  const kpis = useMemo(() => {
    const metrics: { attendanceRate?: number; unjustifiedAbsenteeism?: number } =
      stats?.data?.metrics ?? {};
    return [
      {
        key: "attendance",
        label: "Tasa de asistencia",
        value: `${Math.round(metrics.attendanceRate ?? 0)}%`,
        delta: 0,
        hint: "del periodo actual",
      },
      {
        key: "absenteeism",
        label: "Ausentismo injustificado",
        value: `${Math.round(metrics.unjustifiedAbsenteeism ?? 0)}%`,
        delta: 0,
        hint: "promedio del mes",
      },
      {
        key: "alerts",
        label: "Alertas activas",
        value: String(stats?.data?.alerts?.length ?? 0),
        delta: 0,
        hint: "requieren revisión",
      },
      {
        key: "today",
        label: "Registros hoy",
        value: String(todayEvents?.data?.length ?? 0),
        delta: 0,
        hint: "entradas y salidas",
      },
    ];
  }, [stats, todayEvents]);

  const trend = useMemo<AttendanceTrendPoint[]>(() => {
    const trendByDate = new Map<
      string,
      { onTime: number; late: number; absent: number }
    >();
    for (const p of trends?.data?.attendance ?? []) {
      trendByDate.set(p.date, { onTime: p.value, late: 0, absent: 0 });
    }
    for (const p of trends?.data?.punctuality ?? []) {
      const entry = trendByDate.get(p.date) ?? { onTime: 0, late: 0, absent: 0 };
      // punctuality is % of worked days on time; complement = late.
      // when no one worked (onTime 0), punctuality 0 means "no data", not "all late".
      entry.late = entry.onTime > 0 ? Math.max(0, 100 - p.value) : 0;
      trendByDate.set(p.date, entry);
    }
    for (const p of trends?.data?.absenteeism ?? []) {
      const entry = trendByDate.get(p.date) ?? { onTime: 0, late: 0, absent: 0 };
      entry.absent = p.value;
      trendByDate.set(p.date, entry);
    }
    return Array.from(trendByDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        onTime: Math.round(v.onTime),
        late: Math.round(v.late),
        absent: Math.round(v.absent),
      }));
  }, [trends]);

  const statusDistribution = useMemo<StatusDistributionPoint[]>(() => {
    const statusColors: Record<string, string> = {
      on_time: "var(--chart-1)",
      late: "var(--chart-3)",
      early: "var(--chart-2)",
      absent: "var(--chart-4)",
      out_of_bounds: "var(--chart-5)",
    };
    const statusLabels: Record<string, string> = {
      on_time: "A tiempo",
      late: "Tarde",
      early: "Temprano",
      absent: "Ausente",
      out_of_bounds: "Fuera de zona",
    };
    const bucket = new Map<string, number>();
    for (const e of todayEvents?.data ?? []) {
      bucket.set(e.status, (bucket.get(e.status) ?? 0) + 1);
    }
    return Array.from(bucket.entries()).map(([status, value]) => ({
      name: statusLabels[status] ?? status,
      value,
      color: statusColors[status] ?? "var(--muted-foreground)",
    }));
  }, [todayEvents]);

  const hoursByDept = useMemo<HoursByDeptPoint[]>(
    () =>
      hours?.data?.map((h) => ({ department: h.department, hours: h.hours })) ??
      [],
    [hours],
  );

  const activity = useMemo(
    () =>
      activityRes?.data?.map((a) => ({
        id: a.id,
        who: a.who,
        action: a.action,
        when: formatRelativeTime(a.when),
        tone: a.tone,
      })) ?? [],
    [activityRes],
  );

  const costs = useMemo(() => costsRes?.data ?? null, [costsRes]);
  const locationRankings = useMemo(
    () => locationsRes?.data?.rankings ?? [],
    [locationsRes],
  );

  const data = {
    greeting,
    kpis,
    trend,
    statusDistribution,
    hoursByDept,
    activity,
    costs,
    locationRankings,
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Panel general"
        title={`Hola, ${data.greeting}`}
        description="Resumen de asistencia y actividad de tu organización en tiempo real."
        actions={<Button>Exportar reporte</Button>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.kpis.map((k, i) => (
          <StatCard
            key={k.key}
            label={k.label}
            value={k.value}
            delta={k.delta}
            hint={k.hint}
            icon={kpiIcons[i] ?? Users}
            index={i}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="sky-rise lg:col-span-2" style={{ animationDelay: "120ms" }}>
          <CardHeader className="flex-row items-start justify-between gap-2">
            <div className="flex flex-col gap-1.5">
              <CardTitle>Tendencia de asistencia</CardTitle>
              <CardDescription>Últimos meses · tasa de asistencia</CardDescription>
            </div>
            <Link
              to="/attendance"
              search={{ status: "all" }}
              className="shrink-0 text-xs font-medium text-primary hover:underline"
            >
              Ver asistencia →
            </Link>
          </CardHeader>
          <CardContent>
            <AttendanceTrendChart data={data.trend} />
          </CardContent>
        </Card>

        <Card className="sky-rise" style={{ animationDelay: "180ms" }}>
          <CardHeader>
            <CardTitle>Distribución de hoy</CardTitle>
            <CardDescription>Estado de los registros</CardDescription>
          </CardHeader>
          <CardContent>
            <StatusDonut data={data.statusDistribution} />
            <div className="mt-4 flex flex-col gap-2">
              {data.statusDistribution.map((s) => (
                <div key={s.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    {s.name}
                  </span>
                  <span className="font-semibold tabular-nums">{s.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="sky-rise lg:col-span-2" style={{ animationDelay: "220ms" }}>
          <CardHeader>
            <CardTitle>Horas trabajadas por área</CardTitle>
            <CardDescription>Promedio semanal en horas</CardDescription>
          </CardHeader>
          <CardContent>
            <HoursByDeptChart data={data.hoursByDept} />
          </CardContent>
        </Card>

        <Card className="sky-rise" style={{ animationDelay: "260ms" }}>
          <CardHeader>
            <CardTitle>Actividad reciente</CardTitle>
            <CardDescription>Eventos del equipo</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {data.activity.map((a) => (
              <div key={a.id} className="flex gap-3">
                <span
                  className={cn(
                    "mt-1.5 size-2.5 shrink-0 rounded-full",
                    toneDot[a.tone] ?? "bg-muted-foreground",
                  )}
                />
                <div className="min-w-0">
                  <p className="text-sm leading-snug">
                    <span className="font-semibold">{a.who}</span> {a.action}
                  </p>
                  <p className="text-xs text-muted-foreground">{a.when}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {(data.costs || data.locationRankings.length > 0) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="sky-rise" style={{ animationDelay: "300ms" }}>
            <CardHeader>
              <CardTitle>Impacto económico</CardTitle>
              <CardDescription>Costos del mes actual</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <CostRow
                label="Ausentismo"
                icon={TrendingDown}
                tone="var(--danger)"
                value={data.costs ? formatCurrency(data.costs.absenteeismCost) : "—"}
              />
              <CostRow
                label="Horas extra"
                icon={Clock}
                tone="var(--warning)"
                value={data.costs ? formatCurrency(data.costs.overtimeCost) : "—"}
              />
              <CostRow
                label="Total"
                icon={DollarSign}
                tone="var(--info)"
                value={data.costs ? formatCurrency(data.costs.totalCostImpact) : "—"}
                emphasize
              />
            </CardContent>
          </Card>

          <Card className="sky-rise lg:col-span-2" style={{ animationDelay: "340ms" }}>
            <CardHeader className="flex-row items-start justify-between gap-2">
              <div className="flex flex-col gap-1.5">
                <CardTitle>Ranking por ubicación</CardTitle>
                <CardDescription>Asistencia y puntualidad por geocerca</CardDescription>
              </div>
              <Link
                to="/locations"
                className="shrink-0 text-xs font-medium text-primary hover:underline"
              >
                Ver geocercas →
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10" data-numeric>
                      #
                    </TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead data-numeric>Asistencia</TableHead>
                    <TableHead data-numeric>Puntualidad</TableHead>
                    <TableHead className="text-right">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.locationRankings.map((r) => (
                    <TableRow key={r.locationId}>
                      <TableCell data-numeric className="font-semibold">
                        {r.rank}
                      </TableCell>
                      <TableCell className="font-medium">{r.locationName}</TableCell>
                      <TableCell data-numeric>{pct(r.attendanceRate)}</TableCell>
                      <TableCell data-numeric>{pct(r.punctualityIndex)}</TableCell>
                      <TableCell className="text-right">
                        <Pill
                          tone={r.attendanceRate >= 90 ? "success" : "warning"}
                          label={r.attendanceRate >= 90 ? "Saludable" : "Atención"}
                          size="sm"
                          className="w-28 justify-center"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {data.locationRankings.length === 0 && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell
                        colSpan={5}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        Sin datos de ubicaciones.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function CostRow({
  label,
  icon: Icon,
  tone,
  value,
  emphasize,
}: {
  label: string;
  icon: typeof DollarSign;
  tone: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between",
        emphasize && "border-t border-border pt-3",
      )}
    >
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" style={{ color: tone }} />
        {label}
      </span>
      <span
        className={cn("tabular-nums", emphasize ? "text-lg font-bold" : "font-semibold")}
        style={{ color: tone }}
      >
        {value}
      </span>
    </div>
  );
}

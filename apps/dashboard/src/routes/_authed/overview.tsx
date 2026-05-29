import { createFileRoute } from "@tanstack/react-router";
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
import { api } from "@/lib/api";
import type { CostAnalysis, LocationRanking } from "@/lib/api";
import { cn, formatCurrency } from "@/lib/utils";

const kpiIcons = [Users, CalendarCheck, FileClock, Target];

const toneDot: Record<string, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  neutral: "bg-muted-foreground",
};

interface OverviewData {
  greeting: string;
  kpis: Array<{ key: string; label: string; value: string; delta: number; hint: string }>;
  trend: AttendanceTrendPoint[];
  statusDistribution: StatusDistributionPoint[];
  hoursByDept: HoursByDeptPoint[];
  activity: Array<{ id: string; who: string; action: string; when: string; tone: string }>;
  costs: CostAnalysis | null;
  locationRankings: LocationRanking[];
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (sameDay) return `Hoy · ${time}`;
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Ayer · ${time}`;
  return `${d.getDate()}/${d.getMonth() + 1} · ${time}`;
}

export const Route = createFileRoute("/_authed/overview")({
  component: DashboardPage,
  loader: async (): Promise<OverviewData> => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const [me, stats, trends, hours, activity, todayEvents, costs, locations] =
      await Promise.all([
        api.users.me().catch(() => null),
        api.statistics.dashboard().catch(() => null),
        api.statistics.trends().catch(() => null),
        api.statistics.hoursByDepartment({ period: "weekly" }).catch(() => null),
        api.activity.list({ limit: 8 }).catch(() => null),
        api.attendance
          .events({ start_date: todayStr, end_date: todayStr, pageSize: 200 })
          .catch(() => null),
        api.statistics.costs({ period: "monthly" }).catch(() => null),
        api.statistics.locations({ period: "monthly" }).catch(() => null),
      ]);

    const metrics: { attendanceRate?: number; unjustifiedAbsenteeism?: number } =
      stats?.data?.metrics ?? {};

    const trendByDate = new Map<
      string,
      { onTime: number; late: number; absent: number }
    >();
    for (const p of trends?.data?.attendance ?? []) {
      trendByDate.set(p.date, { onTime: p.value, late: 0, absent: 0 });
    }
    for (const p of trends?.data?.punctuality ?? []) {
      const entry = trendByDate.get(p.date) ?? { onTime: 0, late: 0, absent: 0 };
      entry.late = Math.max(0, 1 - p.value);
      trendByDate.set(p.date, entry);
    }
    for (const p of trends?.data?.absenteeism ?? []) {
      const entry = trendByDate.get(p.date) ?? { onTime: 0, late: 0, absent: 0 };
      entry.absent = p.value;
      trendByDate.set(p.date, entry);
    }
    const trendPoints: AttendanceTrendPoint[] = Array.from(trendByDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        onTime: Math.round(v.onTime * 100),
        late: Math.round(v.late * 100),
        absent: Math.round(v.absent * 100),
      }));

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
    const statusDistribution: StatusDistributionPoint[] = Array.from(
      bucket.entries(),
    ).map(([status, value]) => ({
      name: statusLabels[status] ?? status,
      value,
      color: statusColors[status] ?? "var(--muted-foreground)",
    }));

    return {
      greeting: me?.name?.split(" ")[0] ?? "Admin",
      kpis: [
        {
          key: "attendance",
          label: "Tasa de asistencia",
          value: `${Math.round((metrics.attendanceRate ?? 0) * 100)}%`,
          delta: 0,
          hint: "del periodo actual",
        },
        {
          key: "absenteeism",
          label: "Ausentismo injustificado",
          value: `${Math.round((metrics.unjustifiedAbsenteeism ?? 0) * 100)}%`,
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
      ],
      trend: trendPoints,
      statusDistribution,
      hoursByDept:
        hours?.data?.map((h) => ({ department: h.department, hours: h.hours })) ?? [],
      activity:
        activity?.data?.map((a) => ({
          id: a.id,
          who: a.who,
          action: a.action,
          when: formatWhen(a.when),
          tone: a.tone,
        })) ?? [],
      costs: costs?.data ?? null,
      locationRankings: locations?.data?.rankings ?? [],
    };
  },
});

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function DashboardPage() {
  const data = Route.useLoaderData();

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
          <CardHeader>
            <CardTitle>Tendencia de asistencia</CardTitle>
            <CardDescription>Últimos meses · tasa de asistencia</CardDescription>
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
            <CardHeader>
              <CardTitle>Ranking por ubicación</CardTitle>
              <CardDescription>Asistencia y puntualidad por geocerca</CardDescription>
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

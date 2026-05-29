import { createFileRoute } from "@tanstack/react-router";
import { Users, CalendarCheck, FileClock, Target } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/stat-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AttendanceTrendChart,
  HoursByDeptChart,
  StatusDonut,
  type AttendanceTrendPoint,
  type HoursByDeptPoint,
  type StatusDistributionPoint,
} from "@/components/charts";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

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
    const [me, stats, trends, hours, activity] = await Promise.all([
      api.users.me().catch(() => null),
      api.statistics.dashboard().catch(() => null),
      api.statistics.trends().catch(() => null),
      api.statistics.hoursByDepartment({ period: "weekly" }).catch(() => null),
      api.activity.list({ limit: 8 }).catch(() => null),
    ]);

    const metrics: { attendanceRate?: number; unjustifiedAbsenteeism?: number } =
      stats?.data?.metrics ?? {};
    const trendPoints: AttendanceTrendPoint[] =
      trends?.data?.attendance?.map((p) => ({
        date: p.date,
        onTime: p.value,
        late: 0,
        absent: 0,
      })) ?? [];

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
          key: "trafficLight",
          label: "Semáforo",
          value: stats?.data?.trafficLight ?? "—",
          delta: 0,
          hint: "estado general",
        },
      ],
      trend: trendPoints,
      statusDistribution: [],
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
    };
  },
});

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
    </div>
  );
}

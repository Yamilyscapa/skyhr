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
} from "@/components/charts";
import { kpis, recentActivity } from "@/data/stats";
import { statusDistribution } from "@/data/attendance";
import { currentAdmin } from "@/data/org";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: DashboardPage,
});

const kpiIcons = [Users, CalendarCheck, FileClock, Target];

const toneDot: Record<string, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
};

function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Panel general"
        title={`Hola, ${currentAdmin.name.split(" ")[0]}`}
        description="Resumen de asistencia y actividad de tu organización en tiempo real."
        actions={<Button>Exportar reporte</Button>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k, i) => (
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
            <CardDescription>Últimos 14 días · registros por estado</CardDescription>
          </CardHeader>
          <CardContent>
            <AttendanceTrendChart />
          </CardContent>
        </Card>

        <Card className="sky-rise" style={{ animationDelay: "180ms" }}>
          <CardHeader>
            <CardTitle>Distribución de hoy</CardTitle>
            <CardDescription>Estado de los registros</CardDescription>
          </CardHeader>
          <CardContent>
            <StatusDonut />
            <div className="mt-4 flex flex-col gap-2">
              {statusDistribution.map((s) => (
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
            <HoursByDeptChart />
          </CardContent>
        </Card>

        <Card className="sky-rise" style={{ animationDelay: "260ms" }}>
          <CardHeader>
            <CardTitle>Actividad reciente</CardTitle>
            <CardDescription>Eventos del equipo</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {recentActivity.map((a) => (
              <div key={a.id} className="flex gap-3">
                <span
                  className={cn(
                    "mt-1.5 size-2.5 shrink-0 rounded-full",
                    toneDot[a.tone],
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

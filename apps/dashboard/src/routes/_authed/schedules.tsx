import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  Coffee,
  Pencil,
  Plus,
  UserPlus,
  Users,
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
import { cn } from "@/lib/utils";
import { employees } from "@/data/employees";
import {
  coverageByDay,
  shiftById,
  shifts,
  totalWeeklyHours,
  weekdays,
  weeklyAssignments,
} from "@/data/schedules";
import type { Shift, Weekday } from "@/data/types";
import { AssignScheduleDialog } from "@/components/assign-schedule-dialog";

export const Route = createFileRoute("/_authed/schedules")({
  component: SchedulesPage,
});

function SchedulesPage() {
  const [view, setView] = useState<"week" | "shifts">("week");
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<string | undefined>(undefined);

  function openAssign(employeeId?: string) {
    setAssignTarget(employeeId);
    setAssignOpen(true);
  }

  const employeeById = useMemo(
    () => new Map(employees.map((e) => [e.id, e])),
    [],
  );
  const coverage = useMemo(coverageByDay, []);

  const totals = useMemo(() => {
    const assignedIds = new Set(weeklyAssignments.map((a) => a.employeeId));
    const uncovered = employees.filter(
      (e) => e.status === "active" && !assignedIds.has(e.id),
    ).length;
    const peakDay = (Object.keys(coverage) as Weekday[]).reduce((a, b) =>
      coverage[a] >= coverage[b] ? a : b,
    );
    return {
      shiftsActive: shifts.filter((s) => s.headcount > 0).length,
      assigned: assignedIds.size,
      uncovered,
      peakDay,
      peakCount: coverage[peakDay],
    };
  }, [coverage]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Planificación"
        title="Horarios"
        description="Plantillas de turno, asignaciones semanales y cobertura por día."
        actions={
          <>
            <Button variant="secondary" size="icon" aria-label="Semana anterior">
              <ChevronLeft />
            </Button>
            <Button variant="secondary" size="icon" aria-label="Semana siguiente">
              <ChevronRight />
            </Button>
            <Button variant="secondary">
              <Plus /> Nuevo turno
            </Button>
            <Button onClick={() => openAssign()}>
              <UserPlus /> Asignar empleado
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryTile label="Plantillas activas" value={totals.shiftsActive} />
        <SummaryTile label="Empleados asignados" value={totals.assigned} />
        <SummaryTile
          label="Sin horario"
          value={totals.uncovered}
          tone={totals.uncovered > 0 ? "warning" : undefined}
        />
        <SummaryTile
          label={`Pico (${
            weekdays.find((w) => w.key === totals.peakDay)?.short ?? ""
          })`}
          value={totals.peakCount}
        />
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
        <TabsList>
          <TabsTrigger value="week">Vista semanal</TabsTrigger>
          <TabsTrigger value="shifts">Plantillas</TabsTrigger>
        </TabsList>
      </Tabs>

      {view === "shifts" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shifts.map((s, i) => (
            <ShiftCard key={s.id} shift={s} index={i} />
          ))}
        </div>
      ) : (
        <Card className="sky-rise overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-border p-4 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Leyenda:</span>
            {shifts.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ring-1 ring-inset"
                style={{
                  color: s.color,
                  backgroundColor: `color-mix(in oklch, ${s.color} 14%, transparent)`,
                  boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${s.color} 28%, transparent)`,
                }}
              >
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                {s.name}
              </span>
            ))}
          </div>

          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="min-w-56">Empleado</TableHead>
                {weekdays.map((d) => (
                  <TableHead key={d.key} className="text-center">
                    {d.short}
                  </TableHead>
                ))}
                <TableHead data-numeric>Horas</TableHead>
                <TableHead className="w-10" aria-label="Acciones" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {weeklyAssignments.map((a) => {
                const emp = employeeById.get(a.employeeId);
                if (!emp) return null;
                return (
                  <TableRow key={a.employeeId}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar name={emp.name} size={32} />
                        <div className="min-w-0">
                          <p className="font-semibold leading-tight">{emp.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {emp.role}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    {weekdays.map((d) => (
                      <TableCell key={d.key} className="text-center">
                        <ShiftChip shift={shiftById(a.days[d.key])} />
                      </TableCell>
                    ))}
                    <TableCell data-numeric className="font-semibold">
                      {totalWeeklyHours(a)}h
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Editar horario"
                        onClick={() => openAssign(a.employeeId)}
                      >
                        <Pencil />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <AssignScheduleDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        lockedEmployeeId={assignTarget}
      />
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "warning";
}) {
  return (
    <Card className="sky-rise p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-bold tabular-nums",
          tone === "warning" && "text-warning",
        )}
      >
        {value}
      </p>
    </Card>
  );
}

function ShiftChip({ shift }: { shift: Shift | null }) {
  if (!shift) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <span
      className="inline-flex w-full max-w-24 items-center justify-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset"
      style={{
        color: shift.color,
        backgroundColor: `color-mix(in oklch, ${shift.color} 14%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${shift.color} 30%, transparent)`,
      }}
      title={`${shift.name} · ${shift.startTime}–${shift.endTime}`}
    >
      {shift.startTime}
    </span>
  );
}

function ShiftCard({ shift, index }: { shift: Shift; index: number }) {
  return (
    <Card
      className="sky-rise relative overflow-hidden p-5"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <span
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: shift.color }}
        aria-hidden
      />
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold leading-tight">{shift.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
            {shift.startTime} – {shift.endTime}
          </p>
        </div>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
          style={{
            color: shift.color,
            backgroundColor: `color-mix(in oklch, ${shift.color} 14%, transparent)`,
            boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${shift.color} 28%, transparent)`,
          }}
        >
          <Users className="size-3.5" /> {shift.headcount}
        </span>
      </div>

      <div className="mt-4 flex gap-1">
        {weekdays.map((d) => {
          const on = shift.days.includes(d.key);
          return (
            <span
              key={d.key}
              className={cn(
                "flex size-7 items-center justify-center rounded-md text-[10px] font-semibold",
                on
                  ? "text-white"
                  : "bg-muted text-muted-foreground",
              )}
              style={on ? { backgroundColor: shift.color } : undefined}
            >
              {d.short.slice(0, 1)}
            </span>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Coffee className="size-3.5" /> {shift.breakMinutes} min descanso
        </span>
      </div>
    </Card>
  );
}

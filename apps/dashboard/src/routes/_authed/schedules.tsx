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
import { api } from "@/lib/api";
import { weekdays } from "@/data/schedules";
import type {
  Employee,
  Shift,
  Weekday,
  WeeklyAssignment,
} from "@/data/types";
import { AssignScheduleDialog } from "@/components/assign-schedule-dialog";

const DOW_MAP: Record<string, Weekday> = {
  monday: "mon",
  tuesday: "tue",
  wednesday: "wed",
  thursday: "thu",
  friday: "fri",
  saturday: "sat",
  sunday: "sun",
};

const FALLBACK_COLOR = "#7c93ff";

function fmtTime(t: string): string {
  // server "HH:MM:SS" -> "HH:MM"
  return t.slice(0, 5);
}

function emptyDays(): Record<Weekday, string | null> {
  return { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null };
}

interface LoaderData {
  employees: Employee[];
  shifts: Shift[];
  assignments: WeeklyAssignment[];
}

export const Route = createFileRoute("/_authed/schedules")({
  component: SchedulesPage,
  loader: async (): Promise<LoaderData> => {
    const [usersRes, shiftsRes, assignRes] = await Promise.all([
      api.users.list({ pageSize: 200 }),
      api.schedules.shifts(),
      api.schedules.assignments(),
    ]);

    const employees: Employee[] = usersRes.data.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      role: m.position ?? m.role,
      department: m.department ?? "Sin área",
      status: m.banned ? "pending" : "active",
      hourlyRate: m.hourlyRate ?? 0,
      faceRegistered: m.faceRegistered,
      shift: { name: "—", color: "#888888" },
      location: "—",
      todayStatus: "off",
    }));

    const headcount = new Map<string, number>();
    for (const a of assignRes.data) {
      headcount.set(a.shiftId, (headcount.get(a.shiftId) ?? 0) + 1);
    }

    const shifts: Shift[] = shiftsRes.data.map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color ?? FALLBACK_COLOR,
      startTime: fmtTime(s.start_time),
      endTime: fmtTime(s.end_time),
      breakMinutes: s.break_minutes,
      days: s.days_of_week
        .map((d) => DOW_MAP[d.toLowerCase()])
        .filter((d): d is Weekday => Boolean(d)),
      headcount: headcount.get(s.id) ?? 0,
    }));

    const byEmployee = new Map<string, Record<Weekday, string | null>>();
    for (const a of assignRes.data) {
      const days = byEmployee.get(a.userId) ?? emptyDays();
      for (const d of a.daysOfWeek) {
        const wd = DOW_MAP[d.toLowerCase()];
        if (wd) days[wd] = a.shiftId;
      }
      byEmployee.set(a.userId, days);
    }
    const assignments: WeeklyAssignment[] = Array.from(byEmployee.entries()).map(
      ([employeeId, days]) => ({ employeeId, days }),
    );

    return { employees, shifts, assignments };
  },
});

function shiftMinutes(s: Shift): number {
  const [sh, sm] = s.startTime.split(":").map(Number) as [number, number];
  const [eh, em] = s.endTime.split(":").map(Number) as [number, number];
  let span = eh * 60 + em - (sh * 60 + sm);
  if (span <= 0) span += 24 * 60;
  return span - s.breakMinutes;
}

function totalWeeklyHours(a: WeeklyAssignment, shiftsById: Map<string, Shift>): number {
  let mins = 0;
  for (const k of Object.keys(a.days) as Weekday[]) {
    const id = a.days[k];
    const s = id ? shiftsById.get(id) : null;
    if (!s) continue;
    mins += shiftMinutes(s);
  }
  return Math.round((mins / 60) * 10) / 10;
}

function coverageByDay(assignments: WeeklyAssignment[]): Record<Weekday, number> {
  const c: Record<Weekday, number> = { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 };
  for (const a of assignments) {
    for (const k of Object.keys(c) as Weekday[]) {
      if (a.days[k]) c[k] += 1;
    }
  }
  return c;
}

function SchedulesPage() {
  const { employees, shifts, assignments } = Route.useLoaderData();
  const [view, setView] = useState<"week" | "shifts">("week");
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<string | undefined>(undefined);

  function openAssign(employeeId?: string) {
    setAssignTarget(employeeId);
    setAssignOpen(true);
  }

  const employeeById = useMemo(
    () => new Map(employees.map((e) => [e.id, e])),
    [employees],
  );
  const shiftsById = useMemo(
    () => new Map(shifts.map((s) => [s.id, s])),
    [shifts],
  );
  const coverage = useMemo(() => coverageByDay(assignments), [assignments]);

  const totals = useMemo(() => {
    const assignedIds = new Set(assignments.map((a) => a.employeeId));
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
  }, [assignments, employees, shifts, coverage]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Planificación"
        title="Horarios"
        description="Plantillas de turno, asignaciones semanales y cobertura por día."
        actions={
          <>
            <Button variant="secondary" size="icon" aria-label="Semana anterior" disabled>
              <ChevronLeft />
            </Button>
            <Button variant="secondary" size="icon" aria-label="Semana siguiente" disabled>
              <ChevronRight />
            </Button>
            <Button variant="secondary" disabled>
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
          {shifts.length === 0 && (
            <Card className="col-span-full p-12 text-center text-sm text-muted-foreground">
              Aún no has creado plantillas de turno.
            </Card>
          )}
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
              {assignments.map((a) => {
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
                        <ShiftChip shift={shiftsById.get(a.days[d.key] ?? "") ?? null} />
                      </TableCell>
                    ))}
                    <TableCell data-numeric className="font-semibold">
                      {totalWeeklyHours(a, shiftsById)}h
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
              {assignments.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={weekdays.length + 3} className="py-12 text-center text-sm text-muted-foreground">
                    Sin asignaciones. Usa “Asignar empleado” para empezar.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      <AssignScheduleDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        lockedEmployeeId={assignTarget}
        employees={employees}
        shifts={shifts}
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

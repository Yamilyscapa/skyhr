import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
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
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { weekdays } from "@/data/schedules";
import type { Employee, Shift, Weekday } from "@/data/types";
import { api } from "@/lib/api";

const OFF = "__off";

type DayMap = Record<Weekday, string | null>;

const emptyDays: DayMap = {
  mon: null,
  tue: null,
  wed: null,
  thu: null,
  fri: null,
  sat: null,
  sun: null,
};

export function AssignScheduleDialog({
  open,
  onOpenChange,
  lockedEmployeeId,
  initialDays,
  employees,
  shifts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lockedEmployeeId?: string;
  initialDays?: DayMap;
  employees: Employee[];
  shifts: Shift[];
}) {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState<string>(
    lockedEmployeeId ?? employees[0]?.id ?? "",
  );
  const [days, setDays] = useState<DayMap>(initialDays ?? emptyDays);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const target = lockedEmployeeId ?? employees[0]?.id ?? "";
    setEmployeeId(target);
    setDays(initialDays ?? emptyDays);
    setError(null);
  }, [open, lockedEmployeeId, initialDays, employees]);

  const employee = employees.find((e) => e.id === employeeId);

  async function handleSave() {
    if (!employeeId) return;
    setError(null);
    setLoading(true);
    try {
      const uniqueShifts = new Set(
        Object.values(days).filter((v): v is string => Boolean(v)),
      );
      if (uniqueShifts.size === 0) {
        setError("Selecciona al menos un turno");
        return;
      }
      const nowIso = new Date().toISOString();
      for (const shiftId of uniqueShifts) {
        await api.schedules.assign({
          user_id: employeeId,
          shift_id: shiftId,
          effective_from: nowIso,
        });
      }
      onOpenChange(false);
      router.invalidate();
    } catch (err) {
      setError((err as Error).message ?? "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Asignar horario semanal</DialogTitle>
          <DialogDescription>
            Los días disponibles de cada turno se aplican automáticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              Empleado
            </label>
            {lockedEmployeeId && employee ? (
              <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2.5">
                <Avatar name={employee.name} size={32} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight">
                    {employee.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {employee.role}
                  </p>
                </div>
              </div>
            ) : (
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un empleado" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name} · {e.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {shifts.length === 0 ? (
            <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
              No hay turnos creados. Crea un turno antes de asignar.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {weekdays.map((d) => {
                const value = days[d.key] ?? OFF;
                return (
                  <div key={d.key} className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">
                      {d.label}
                    </label>
                    <Select
                      value={value}
                      onValueChange={(v) =>
                        setDays((prev) => ({
                          ...prev,
                          [d.key]: v === OFF ? null : v,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={OFF}>Día libre</SelectItem>
                        {shifts.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            <span className="flex items-center gap-2">
                              <span
                                className="size-2.5 rounded-full"
                                style={{ backgroundColor: s.color }}
                              />
                              {s.name} · {s.startTime}–{s.endTime}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          )}

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
          <Button
            onClick={handleSave}
            disabled={!employeeId || loading || shifts.length === 0}
          >
            {loading ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

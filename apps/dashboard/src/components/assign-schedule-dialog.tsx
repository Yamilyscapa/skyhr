import { useEffect, useState } from "react";
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
import { employees } from "@/data/employees";
import { shifts, weekdays, weeklyAssignments } from "@/data/schedules";
import type { Weekday } from "@/data/types";

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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lockedEmployeeId?: string;
  initialDays?: DayMap;
}) {
  const [employeeId, setEmployeeId] = useState<string>(
    lockedEmployeeId ?? employees[0]?.id ?? "",
  );
  const [days, setDays] = useState<DayMap>(initialDays ?? emptyDays);

  useEffect(() => {
    if (!open) return;
    const target = lockedEmployeeId ?? employees[0]?.id ?? "";
    setEmployeeId(target);
    const existing = weeklyAssignments.find((a) => a.employeeId === target);
    setDays(initialDays ?? existing?.days ?? emptyDays);
  }, [open, lockedEmployeeId, initialDays]);

  const employee = employees.find((e) => e.id === employeeId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Asignar horario semanal</DialogTitle>
          <DialogDescription>
            Selecciona un turno para cada día. Deja "Día libre" para descansos.
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
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              // TODO: persist via API once wired
              onOpenChange(false);
            }}
            disabled={!employeeId}
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

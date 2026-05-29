import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { weekdays, DEFAULT_DAYS } from "@/data/schedules";
import type { Shift, Weekday } from "@/data/types";
import { api } from "@/lib/api";
import { invalidate } from "@/lib/api/queries";

const DOW_FULL: Record<Weekday, string> = {
  mon: "monday",
  tue: "tuesday",
  wed: "wednesday",
  thu: "thursday",
  fri: "friday",
  sat: "saturday",
  sun: "sunday",
};

const COLORS = [
  "#7c93ff",
  "#34d399",
  "#fbbf24",
  "#f87171",
  "#a78bfa",
  "#22d3ee",
  "#fb923c",
  "#f472b6",
];

export function ShiftDialog({
  open,
  onOpenChange,
  shift,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shift?: Shift | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(shift);

  const [name, setName] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [breakMinutes, setBreakMinutes] = useState("60");
  const [days, setDays] = useState<Weekday[]>(DEFAULT_DAYS);
  const [color, setColor] = useState(COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (shift) {
      setName(shift.name);
      setStartTime(shift.startTime);
      setEndTime(shift.endTime);
      setBreakMinutes(String(shift.breakMinutes));
      setDays(shift.days);
      setColor(shift.color);
    } else {
      setName("");
      setStartTime("09:00");
      setEndTime("18:00");
      setBreakMinutes("60");
      setDays(DEFAULT_DAYS);
      setColor(COLORS[0]);
    }
  }, [open, shift]);

  function toggleDay(d: Weekday) {
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    );
  }

  async function handleSave() {
    setError(null);
    if (!name.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    if (days.length === 0) {
      setError("Selecciona al menos un día");
      return;
    }
    setLoading(true);
    try {
      const body = {
        name: name.trim(),
        start_time: startTime,
        end_time: endTime,
        break_minutes: Number(breakMinutes) || 0,
        days_of_week: days.map((d) => DOW_FULL[d]),
        color,
      };
      if (shift) {
        await api.schedules.updateShift(shift.id, body);
      } else {
        await api.schedules.createShift(body);
      }
      onOpenChange(false);
      void queryClient.invalidateQueries({ queryKey: invalidate.schedules });
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
          <DialogTitle>
            {isEdit ? "Editar turno" : "Nuevo turno"}
          </DialogTitle>
          <DialogDescription>
            Define el horario, descanso y días de la plantilla de turno.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="shift-name">Nombre</Label>
            <Input
              id="shift-name"
              required
              placeholder="Ej. Turno matutino"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="start">Entrada</Label>
              <Input
                id="start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="end">Salida</Label>
              <Input
                id="end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="break">Descanso (min)</Label>
              <Input
                id="break"
                type="number"
                min={0}
                value={breakMinutes}
                onChange={(e) => setBreakMinutes(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Días</Label>
            <div className="flex gap-1.5">
              {weekdays.map((d) => {
                const on = days.includes(d.key);
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => toggleDay(d.key)}
                    className={cn(
                      "flex size-9 items-center justify-center rounded-lg text-xs font-semibold transition-colors",
                      on
                        ? "text-white"
                        : "bg-muted text-muted-foreground hover:bg-muted/70",
                    )}
                    style={on ? { backgroundColor: color } : undefined}
                  >
                    {d.short.slice(0, 1)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Color</Label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  onClick={() => setColor(c)}
                  className={cn(
                    "size-7 rounded-full ring-2 ring-offset-2 ring-offset-background transition-all",
                    color === c ? "ring-foreground" : "ring-transparent",
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
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
            {loading ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear turno"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

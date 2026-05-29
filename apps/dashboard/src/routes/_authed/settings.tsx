import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActiveOrganization } from "@/lib/auth/client";
import { api } from "@/lib/api";
import { queries, invalidate } from "@/lib/api/queries";

export const Route = createFileRoute("/_authed/settings")({
  component: SettingsPage,
});

const TIMEZONES = [
  "America/Mexico_City",
  "America/Tijuana",
  "America/Cancun",
  "America/Monterrey",
  "America/Hermosillo",
  "America/Bogota",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "UTC",
];

function SettingsPage() {
  const { data: activeOrg } = useActiveOrganization();
  const orgId = activeOrg?.id ?? null;
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    ...queries.orgSettings(orgId ?? ""),
    enabled: !!orgId,
  });
  const settings = settingsQuery.data ?? null;

  const [grace, setGrace] = useState("");
  const [extraHour, setExtraHour] = useState("");
  const [timezone, setTimezone] = useState("America/Mexico_City");
  const [hoursPerDay, setHoursPerDay] = useState("");
  const [daysPerMonth, setDaysPerMonth] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const loading = !orgId || settingsQuery.isPending;

  // Sync the editable form fields whenever the cached settings change.
  useEffect(() => {
    if (!settings) return;
    setGrace(String(settings.grace_period_minutes));
    setExtraHour(String(settings.extra_hour_cost));
    setTimezone(settings.timezone);
    setHoursPerDay(String(settings.work_hours_per_day));
    setDaysPerMonth(String(settings.work_days_per_month));
  }, [settings]);

  useEffect(() => {
    if (settingsQuery.error instanceof Error) {
      setError(settingsQuery.error.message);
    }
  }, [settingsQuery.error]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await api.organizations.updateSettings(orgId, {
        grace_period_minutes: Number(grace),
        extra_hour_cost: Number(extraHour),
        timezone,
        work_hours_per_day: Number(hoursPerDay),
        work_days_per_month: Number(daysPerMonth),
      });
      await queryClient.invalidateQueries({ queryKey: invalidate.orgSettings });
      setSaved(true);
    } catch (err) {
      setError((err as Error).message ?? "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  const dirty =
    settings !== null &&
    (Number(grace) !== settings.grace_period_minutes ||
      Number(extraHour) !== settings.extra_hour_cost ||
      timezone !== settings.timezone ||
      Number(hoursPerDay) !== settings.work_hours_per_day ||
      Number(daysPerMonth) !== settings.work_days_per_month);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Cuenta"
        title="Configuración"
        description="Ajustes de asistencia y zona horaria de tu organización."
      />

      {error && (
        <Card className="flex items-center gap-2 border-danger/40 bg-danger/10 p-4 text-sm text-danger">
          <AlertCircle className="size-4" /> {error}
        </Card>
      )}
      {saved && !dirty && (
        <Card className="flex items-center gap-2 border-success/40 bg-success/10 p-4 text-sm text-success">
          <Check className="size-4" /> Configuración guardada.
        </Card>
      )}

      {loading ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          Cargando configuración…
        </Card>
      ) : (
        <Card className="sky-rise max-w-2xl p-6">
          <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="grace">Periodo de tolerancia (minutos)</Label>
              <Input
                id="grace"
                type="number"
                min={0}
                max={60}
                required
                value={grace}
                onChange={(e) => setGrace(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Minutos de gracia antes de marcar un retardo (0–60).
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="extraHour">Costo de hora extra (MXN)</Label>
              <Input
                id="extraHour"
                type="number"
                min={0}
                step="0.01"
                required
                value={extraHour}
                onChange={(e) => setExtraHour(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Tarifa aplicada a las horas trabajadas fuera del turno.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="hoursPerDay">Horas laborales por día</Label>
                <Input
                  id="hoursPerDay"
                  type="number"
                  min={1}
                  max={24}
                  step="0.5"
                  required
                  value={hoursPerDay}
                  onChange={(e) => setHoursPerDay(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="daysPerMonth">Días laborales por mes</Label>
                <Input
                  id="daysPerMonth"
                  type="number"
                  min={1}
                  max={31}
                  required
                  value={daysPerMonth}
                  onChange={(e) => setDaysPerMonth(e.target.value)}
                />
              </div>
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              Base para estimar la nómina mensual.
            </p>

            <div className="flex flex-col gap-2">
              <Label>Zona horaria</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button type="submit" disabled={saving || !dirty}>
                {saving ? "Guardando…" : "Guardar cambios"}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}

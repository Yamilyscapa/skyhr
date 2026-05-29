import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { MapPin, Plus, Users, X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar } from "@/components/ui/avatar";
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
import { useActiveOrganization } from "@/lib/auth/client";
import { api } from "@/lib/api";
import type { GeofenceUser, LocationRow, MemberRow } from "@/lib/api";
import type { MapLocation } from "@/components/geofence-map";

const GeofenceMap = lazy(() => import("@/components/geofence-map"));

const DEFAULT_CENTER: [number, number] = [19.4326, -99.1332];

interface LoaderData {
  locations: LocationRow[];
  employees: MemberRow[];
}

export const Route = createFileRoute("/_authed/locations")({
  component: LocationsPage,
  loader: async (): Promise<LoaderData> => {
    const [locRes, usersRes] = await Promise.all([
      api.geofence.locations({ pageSize: 100 }),
      api.users.list({ pageSize: 200 }),
    ]);
    return { locations: locRes.data, employees: usersRes.data };
  },
});

function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

function LocationsPage() {
  const { locations, employees } = Route.useLoaderData();
  const router = useRouter();
  const { data: activeOrg } = useActiveOrganization();
  const mounted = useMounted();

  const [createOpen, setCreateOpen] = useState(false);
  const [accessTarget, setAccessTarget] = useState<LocationRow | null>(null);

  const mapLocations = useMemo<MapLocation[]>(
    () =>
      locations
        .filter(
          (l) => l.center_latitude != null && l.center_longitude != null,
        )
        .map((l) => ({
          id: l.id,
          name: l.name,
          lat: l.center_latitude as number,
          lng: l.center_longitude as number,
          radius: l.radius ?? 50,
        })),
    [locations],
  );

  const center = mapLocations[0]
    ? ([mapLocations[0].lat, mapLocations[0].lng] as [number, number])
    : DEFAULT_CENTER;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Ubicaciones"
        title="Geocercas"
        description="Zonas autorizadas para registrar asistencia y controlar accesos."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus /> Nueva geocerca
          </Button>
        }
      />

      <Card className="sky-rise overflow-hidden p-0">
        <div className="h-80 w-full">
          {mounted ? (
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Cargando mapa…
                </div>
              }
            >
              <GeofenceMap locations={mapLocations} center={center} />
            </Suspense>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Cargando mapa…
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {locations.map((l) => (
          <Card key={l.id} className="sky-rise flex flex-col gap-3 p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <MapPin className="size-4.5" />
                </span>
                <div>
                  <p className="font-semibold leading-tight">{l.name}</p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {l.type}
                  </p>
                </div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground tabular-nums">
              {l.center_latitude?.toFixed(5)}, {l.center_longitude?.toFixed(5)} ·{" "}
              {l.radius ?? 0} m
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="mt-auto"
              onClick={() => setAccessTarget(l)}
            >
              <Users /> Gestionar acceso
            </Button>
          </Card>
        ))}
        {locations.length === 0 && (
          <Card className="col-span-full p-12 text-center text-sm text-muted-foreground">
            Aún no has creado geocercas.
          </Card>
        )}
      </div>

      <CreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        organizationId={activeOrg?.id ?? null}
        mapLocations={mapLocations}
        center={center}
        mounted={mounted}
        onCreated={() => router.invalidate()}
      />

      <AccessDialog
        location={accessTarget}
        onOpenChange={(open) => !open && setAccessTarget(null)}
        employees={employees}
      />
    </div>
  );
}

function CreateDialog({
  open,
  onOpenChange,
  organizationId,
  mapLocations,
  center,
  mounted,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string | null;
  mapLocations: MapLocation[];
  center: [number, number];
  mounted: boolean;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [radius, setRadius] = useState("100");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setLat("");
      setLng("");
      setRadius("100");
      setError(null);
    }
  }, [open]);

  const draft =
    lat && lng
      ? { lat: Number(lat), lng: Number(lng), radius: Number(radius) || 0 }
      : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!organizationId) {
      setError("No hay organización activa");
      return;
    }
    const latN = Number(lat);
    const lngN = Number(lng);
    const radiusN = Number(radius);
    if (!Number.isFinite(latN) || !Number.isFinite(lngN) || !radiusN) {
      setError("Coloca un punto en el mapa y define un radio");
      return;
    }
    setLoading(true);
    try {
      await api.geofence.create({
        name: name.trim(),
        center_latitude: latN,
        center_longitude: lngN,
        radius: radiusN,
        organization_id: organizationId,
      });
      onOpenChange(false);
      onCreated();
    } catch (err) {
      setError((err as Error).message ?? "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nueva geocerca</DialogTitle>
          <DialogDescription>
            Haz clic en el mapa para colocar el centro de la zona.
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="h-64 overflow-hidden rounded-xl border border-border">
            {open && mounted ? (
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Cargando mapa…
                  </div>
                }
              >
                <GeofenceMap
                  locations={mapLocations}
                  center={center}
                  draft={draft}
                  onMapClick={(la, ln) => {
                    setLat(String(la.toFixed(6)));
                    setLng(String(ln.toFixed(6)));
                  }}
                />
              </Suspense>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="gf-name">Nombre</Label>
            <Input
              id="gf-name"
              required
              placeholder="Ej. Oficina central"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="gf-lat">Latitud</Label>
              <Input
                id="gf-lat"
                required
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="Clic en mapa"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="gf-lng">Longitud</Label>
              <Input
                id="gf-lng"
                required
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="Clic en mapa"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="gf-radius">Radio (m)</Label>
              <Input
                id="gf-radius"
                type="number"
                min={1}
                required
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creando…" : "Crear geocerca"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AccessDialog({
  location,
  onOpenChange,
  employees,
}: {
  location: LocationRow | null;
  onOpenChange: (open: boolean) => void;
  employees: MemberRow[];
}) {
  const [assigned, setAssigned] = useState<GeofenceUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload(geofenceId: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await api.userGeofence.users(geofenceId);
      setAssigned(res.data);
    } catch (err) {
      setError((err as Error).message ?? "Error al cargar accesos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setPick("");
    setAssigned([]);
    setError(null);
    if (location) void reload(location.id);
  }, [location]);

  const assignedIds = new Set(assigned.map((a) => a.user_id));
  const available = employees.filter((e) => !assignedIds.has(e.id));

  async function add() {
    if (!location || !pick) return;
    setBusy(true);
    setError(null);
    try {
      await api.userGeofence.assign({
        user_id: pick,
        geofence_ids: [location.id],
      });
      setPick("");
      await reload(location.id);
    } catch (err) {
      setError((err as Error).message ?? "No se pudo asignar");
    } finally {
      setBusy(false);
    }
  }

  async function remove(userId: string) {
    if (!location) return;
    setBusy(true);
    setError(null);
    try {
      await api.userGeofence.remove({
        user_id: userId,
        geofence_id: location.id,
      });
      await reload(location.id);
    } catch (err) {
      setError((err as Error).message ?? "No se pudo quitar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={location !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Acceso a {location?.name}</DialogTitle>
          <DialogDescription>
            Empleados autorizados a registrar asistencia en esta geocerca.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Select value={pick} onValueChange={setPick}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecciona un empleado" />
              </SelectTrigger>
              <SelectContent>
                {available.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} · {e.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={add} disabled={!pick || busy}>
              Asignar
            </Button>
          </div>

          {error && (
            <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2">
            {loading ? (
              <p className="text-sm text-muted-foreground">Cargando…</p>
            ) : assigned.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sin empleados asignados.
              </p>
            ) : (
              assigned.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-xl border border-border px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={a.user?.name ?? "?"} size={32} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-tight">
                        {a.user?.name ?? "—"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {a.user?.email ?? ""}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Quitar acceso"
                    disabled={busy}
                    onClick={() => remove(a.user_id)}
                  >
                    <X />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

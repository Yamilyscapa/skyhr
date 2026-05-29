import { useMemo, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { CalendarClock, Pencil, ScanFace, Search, UserPlus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AttendanceBadge,
  EmployeeStatusBadge,
} from "@/components/status-badge";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth/client";
import type { Employee } from "@/data/types";
import { AssignScheduleDialog } from "@/components/assign-schedule-dialog";

export const Route = createFileRoute("/_authed/employees")({
  component: EmployeesPage,
  loader: async (): Promise<Employee[]> => {
    const res = await api.users.list({ pageSize: 100 });
    return res.data.map(
      (m): Employee => ({
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
      }),
    );
  },
});

function EmployeesPage() {
  const employees = Route.useLoaderData();
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState("all");
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<string | undefined>(undefined);

  const departments = useMemo(
    () => Array.from(new Set(employees.map((e) => e.department))).sort(),
    [employees],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter((e) => {
      const matchesQuery =
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.role.toLowerCase().includes(q);
      const matchesDept = dept === "all" || e.department === dept;
      return matchesQuery && matchesDept;
    });
  }, [employees, query, dept]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Personal"
        title="Empleados"
        description={`${employees.length} colaboradores registrados en tu organización.`}
        actions={<InviteEmployeeDialog />}
      />

      <Card className="sky-rise overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, correo o puesto…"
              className="h-10 w-full rounded-xl border border-input bg-card pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </div>
          <div className="sm:w-56">
            <Select value={dept} onValueChange={setDept}>
              <SelectTrigger>
                <SelectValue placeholder="Área" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las áreas</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Empleado</TableHead>
              <TableHead>Puesto</TableHead>
              <TableHead>Turno</TableHead>
              <TableHead data-numeric>Tarifa/h</TableHead>
              <TableHead>Biometría</TableHead>
              <TableHead className="text-right">Hoy</TableHead>
              <TableHead className="text-right">Estado</TableHead>
              <TableHead className="w-10" aria-label="Acciones" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((e) => (
              <TableRow key={e.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar name={e.name} />
                    <div className="min-w-0">
                      <p className="font-semibold leading-tight">{e.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {e.email}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <p className="text-sm">{e.role}</p>
                  <p className="text-xs text-muted-foreground">{e.department}</p>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: e.shift.color }}
                    />
                    {e.shift.name}
                  </span>
                </TableCell>
                <TableCell data-numeric>
                  {e.hourlyRate > 0 ? formatCurrency(e.hourlyRate) : "—"}
                </TableCell>
                <TableCell>
                  {e.faceRegistered ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
                      <ScanFace className="size-4" /> Registrada
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <ScanFace className="size-4" /> Pendiente
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <AttendanceBadge
                    status={e.todayStatus}
                    className="w-36 justify-center"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <EmployeeStatusBadge
                    status={e.status}
                    className="w-28 justify-center"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <EditEmployeeDialog employee={e} />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Editar horario"
                      onClick={() => {
                        setAssignTarget(e.id);
                        setAssignOpen(true);
                      }}
                    >
                      <CalendarClock />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                  No se encontraron empleados con esos criterios.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <AssignScheduleDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        lockedEmployeeId={assignTarget}
      />
    </div>
  );
}

function InviteEmployeeDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const res = await authClient.organization.inviteMember({
        email: email.trim(),
        role: role as "admin" | "member" | "owner",
      });
      if (res.error) {
        setError(res.error.message ?? "No se pudo enviar la invitación");
        return;
      }
      setSuccess(`Invitación enviada a ${email}`);
      setEmail("");
    } catch (err) {
      setError((err as Error).message ?? "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus /> Invitar empleado
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invitar empleado</DialogTitle>
          <DialogDescription>
            Envía una invitación por correo para unirse a tu organización.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleInvite} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-email">Correo</Label>
            <Input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Rol</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Miembro</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
              {error}
            </p>
          )}
          {success && (
            <p className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-xs text-success">
              {success}
            </p>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cerrar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={loading}>
              {loading ? "Enviando…" : "Enviar invitación"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditEmployeeDialog({ employee }: { employee: Employee }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(employee.name);
  const [position, setPosition] = useState(employee.role);
  const [department, setDepartment] = useState(employee.department);
  const [hourlyRate, setHourlyRate] = useState(String(employee.hourlyRate ?? 0));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const rate = Number(hourlyRate);
      await api.users.update(employee.id, {
        name: name.trim(),
        position: position.trim() || null,
        department: department.trim() || null,
        hourlyRate: Number.isFinite(rate) ? rate : null,
      });
      setOpen(false);
      router.invalidate();
    } catch (err) {
      setError((err as Error).message ?? "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Editar empleado">
          <Pencil />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar empleado</DialogTitle>
          <DialogDescription>{employee.email}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="emp-name">Nombre</Label>
            <Input
              id="emp-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="emp-position">Puesto</Label>
              <Input
                id="emp-position"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="emp-dept">Área</Label>
              <Input
                id="emp-dept"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="emp-rate">Tarifa por hora</Label>
            <Input
              id="emp-rate"
              type="number"
              step="0.01"
              min="0"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
            />
          </div>

          {error && (
            <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
              {error}
            </p>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

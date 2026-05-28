import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ScanFace, Search, UserPlus } from "lucide-react";
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
import { formatCurrency } from "@/lib/utils";
import { employees } from "@/data/employees";

export const Route = createFileRoute("/employees")({
  component: EmployeesPage,
});

function EmployeesPage() {
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState("all");

  const departments = useMemo(
    () => Array.from(new Set(employees.map((e) => e.department))).sort(),
    [],
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
  }, [query, dept]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Personal"
        title="Empleados"
        description={`${employees.length} colaboradores registrados en tu organización.`}
        actions={
          <Button>
            <UserPlus /> Invitar empleado
          </Button>
        }
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
              <TableHead>Tarifa/h</TableHead>
              <TableHead>Biometría</TableHead>
              <TableHead>Hoy</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((e) => (
              <TableRow key={e.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar name={e.name} />
                    <div className="min-w-0">
                      <p className="font-medium leading-tight">{e.name}</p>
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
                  <span className="inline-flex items-center gap-2 text-sm">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: e.shift.color }}
                    />
                    {e.shift.name}
                  </span>
                </TableCell>
                <TableCell className="tabular-nums">
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
                <TableCell>
                  <AttendanceBadge status={e.todayStatus} />
                </TableCell>
                <TableCell>
                  <EmployeeStatusBadge status={e.status} />
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                  No se encontraron empleados con esos criterios.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

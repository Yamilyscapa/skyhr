import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pill } from "@/components/status-badge";
import { cn, formatCurrency } from "@/lib/utils";
import { api } from "@/lib/api";
import type { MemberRow } from "@/lib/api";

interface PayrollRow {
  id: string;
  name: string;
  email: string;
  role: string;
  hourlyRate: number;
  overtimeAllowed: boolean;
}

export const Route = createFileRoute("/_authed/payroll")({
  component: PayrollPage,
  loader: async (): Promise<PayrollRow[]> => {
    const res = await api.users.list({ pageSize: 200 });
    const rows = await Promise.all(
      res.data.map(async (m: MemberRow): Promise<PayrollRow> => {
        let overtimeAllowed = false;
        try {
          const ot = await api.payroll.overtime(m.id);
          overtimeAllowed = Boolean(ot.data.overtime_allowed);
        } catch {
          overtimeAllowed = false;
        }
        return {
          id: m.id,
          name: m.name,
          email: m.email,
          role: m.position ?? m.role,
          hourlyRate: m.hourlyRate ?? 0,
          overtimeAllowed,
        };
      }),
    );
    return rows;
  },
});

function PayrollPage() {
  const initial = Route.useLoaderData();
  const [rows, setRows] = useState<PayrollRow[]>(initial);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q),
    );
  }, [rows, query]);

  async function toggleOvertime(row: PayrollRow) {
    setBusy(row.id);
    const next = !row.overtimeAllowed;
    try {
      await api.payroll.setOvertime(row.id, next);
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id ? { ...r, overtimeAllowed: next } : r,
        ),
      );
    } finally {
      setBusy(null);
    }
  }

  const monthlyEstimate = useMemo(
    () =>
      // Rough monthly cost estimate: rate × 8h × 22 working days.
      rows.reduce((sum, r) => sum + r.hourlyRate * 8 * 22, 0),
    [rows],
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Nómina"
        title="Nómina y horas extra"
        description="Tarifas por hora y autorización de tiempo extra por empleado."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <SummaryTile label="Empleados" value={String(rows.length)} />
        <SummaryTile
          label="Con horas extra"
          value={String(rows.filter((r) => r.overtimeAllowed).length)}
        />
        <SummaryTile
          label="Costo mensual estimado"
          value={formatCurrency(monthlyEstimate)}
        />
      </div>

      <Card className="sky-rise overflow-hidden">
        <div className="border-b border-border p-4">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar empleado…"
              className="h-10 w-full rounded-xl border border-input bg-card pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Empleado</TableHead>
              <TableHead data-numeric>Tarifa/h</TableHead>
              <TableHead className="text-right">Horas extra</TableHead>
              <TableHead className="w-40 text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar name={r.name} size={32} />
                    <div className="min-w-0">
                      <p className="font-semibold leading-tight">{r.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.role}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell data-numeric>
                  <RateEditor
                    userId={r.id}
                    rate={r.hourlyRate}
                    onSaved={(rate) =>
                      setRows((prev) =>
                        prev.map((x) =>
                          x.id === r.id ? { ...x, hourlyRate: rate } : x,
                        ),
                      )
                    }
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Pill
                    tone={r.overtimeAllowed ? "success" : "neutral"}
                    label={r.overtimeAllowed ? "Permitidas" : "No permitidas"}
                    size="sm"
                    className="w-32 justify-center"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant={r.overtimeAllowed ? "secondary" : "default"}
                    size="sm"
                    disabled={busy === r.id}
                    onClick={() => toggleOvertime(r)}
                  >
                    {r.overtimeAllowed ? "Deshabilitar" : "Habilitar"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={4}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  No se encontraron empleados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function RateEditor({
  userId,
  rate,
  onSaved,
}: {
  userId: string;
  rate: number;
  onSaved: (rate: number) => void;
}) {
  const [value, setValue] = useState(String(rate));
  const [saving, setSaving] = useState(false);

  const dirty = Number(value) !== rate && value !== "";

  async function save() {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    setSaving(true);
    try {
      await api.payroll.updateRate(userId, n);
      onSaved(n);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Input
        type="number"
        min={0}
        step="0.01"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 w-24 text-right tabular-nums"
      />
      <Button
        variant="ghost"
        size="icon"
        aria-label="Guardar tarifa"
        className={cn("size-8", !dirty && "invisible")}
        disabled={saving}
        onClick={save}
      >
        <Check />
      </Button>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="sky-rise p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </Card>
  );
}

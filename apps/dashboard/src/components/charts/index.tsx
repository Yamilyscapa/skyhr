import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  attendanceTrend as fallbackAttendanceTrend,
  hoursByDepartment as fallbackHoursByDept,
  statusDistribution as fallbackStatusDistribution,
} from "@/data/attendance";

export type AttendanceTrendPoint = { date: string; onTime: number; late: number; absent: number };
export type StatusDistributionPoint = { name: string; value: number; color: string };
export type HoursByDeptPoint = { department: string; hours: number };

/** Recharts needs the DOM; render nothing until mounted to avoid SSR width=0. */
function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

const axisProps = {
  stroke: "var(--muted-foreground)",
  fontSize: 12,
  tickLine: false,
  axisLine: false,
} as const;

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      {label && <p className="mb-1 font-semibold">{label}</p>}
      {payload.map((p: any) => (
        <p key={p.dataKey ?? p.name} className="flex items-center gap-2">
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: p.color ?? p.payload?.color }}
          />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold tabular-nums">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

export function AttendanceTrendChart({ data }: { data?: AttendanceTrendPoint[] }) {
  const mounted = useMounted();
  const series = data && data.length > 0 ? data : fallbackAttendanceTrend;
  if (!mounted) return <div className="h-64 w-full animate-pulse rounded-xl bg-muted" />;
  return (
    <ResponsiveContainer width="100%" height={256}>
      <AreaChart data={series} margin={{ left: -20, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="gOnTime" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="date" {...axisProps} interval={1} />
        <YAxis {...axisProps} width={36} />
        <Tooltip content={<ChartTooltip />} />
        <Area
          type="monotone"
          dataKey="onTime"
          name="A tiempo"
          stroke="var(--chart-1)"
          strokeWidth={2.5}
          fill="url(#gOnTime)"
        />
        <Area
          type="monotone"
          dataKey="late"
          name="Tarde"
          stroke="var(--chart-3)"
          strokeWidth={2}
          fill="transparent"
        />
        <Area
          type="monotone"
          dataKey="absent"
          name="Ausente"
          stroke="var(--chart-4)"
          strokeWidth={2}
          fill="transparent"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function StatusDonut({ data }: { data?: StatusDistributionPoint[] }) {
  const mounted = useMounted();
  const series = data && data.length > 0 ? data : fallbackStatusDistribution;
  const total = series.reduce((s, d) => s + d.value, 0);
  if (!mounted) return <div className="h-64 w-full animate-pulse rounded-xl bg-muted" />;
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={256}>
        <PieChart>
          <Tooltip content={<ChartTooltip />} />
          <Pie
            data={series}
            dataKey="value"
            nameKey="name"
            innerRadius={64}
            outerRadius={92}
            paddingAngle={3}
            stroke="none"
          >
            {series.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tabular-nums">{total}</span>
        <span className="text-xs text-muted-foreground">registros hoy</span>
      </div>
    </div>
  );
}

export function HoursByDeptChart({ data }: { data?: HoursByDeptPoint[] }) {
  const mounted = useMounted();
  const series = data && data.length > 0 ? data : fallbackHoursByDept;
  if (!mounted) return <div className="h-64 w-full animate-pulse rounded-xl bg-muted" />;
  return (
    <ResponsiveContainer width="100%" height={256}>
      <BarChart data={series} margin={{ left: -20, right: 8, top: 8 }}>
        <XAxis dataKey="department" {...axisProps} interval={0} angle={-12} textAnchor="end" height={48} />
        <YAxis {...axisProps} width={36} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--accent)" }} />
        <Bar dataKey="hours" name="Horas" radius={[8, 8, 0, 0]} fill="var(--chart-1)" maxBarSize={42} />
      </BarChart>
    </ResponsiveContainer>
  );
}

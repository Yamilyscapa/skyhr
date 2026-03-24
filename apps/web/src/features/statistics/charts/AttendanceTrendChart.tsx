import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendPoint } from "@/api";
import {
  formatMonthShort,
  formatPercent,
  STAT_COLORS,
  STAT_THRESHOLDS,
} from "@/features/statistics/charts/config";

type AttendanceTrendChartProps = {
  points: TrendPoint[];
};

export function AttendanceTrendChart({ points }: AttendanceTrendChartProps) {
  if (points.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Aun no hay datos para visualizar tendencia.
      </div>
    );
  }

  const data = points.map((point) => ({
    ...point,
    label: formatMonthShort(point.date),
  }));

  const values = points.map((point) => point.value);
  const minValue = Math.max(
    0,
    Math.floor(Math.min(...values, STAT_THRESHOLDS.attendanceGoal) / 5) * 5 - 5,
  );
  const maxValue = Math.min(
    100,
    Math.ceil(Math.max(...values, STAT_THRESHOLDS.attendanceGoal) / 5) * 5 + 5,
  );

  return (
    <div className="h-60 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 10, right: 16, left: -8, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            fontSize={12}
          />
          <YAxis
            domain={[minValue, maxValue]}
            tickFormatter={(value) => `${value}%`}
            tickLine={false}
            axisLine={false}
            width={44}
            fontSize={12}
          />
          <Tooltip
            formatter={(value) => formatPercent(Number(value))}
            labelFormatter={(label) => `Mes: ${label}`}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid hsl(var(--border))",
            }}
          />
          <ReferenceLine
            y={STAT_THRESHOLDS.attendanceGoal}
            stroke={STAT_COLORS.excellent}
            strokeDasharray="4 4"
            strokeOpacity={0.7}
            ifOverflow="extendDomain"
          />
          <Line
            type="monotone"
            dataKey="value"
            name="Asistencia"
            stroke={STAT_COLORS.attendance}
            strokeWidth={2.5}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

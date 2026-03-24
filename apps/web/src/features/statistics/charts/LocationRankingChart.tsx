import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { LocationStats } from "@/features/statistics/utils";
import {
  formatPercent,
  STAT_COLORS,
} from "@/features/statistics/charts/config";

type LocationRankingChartProps = {
  locations: LocationStats[];
  limit?: number;
};

export function LocationRankingChart({
  locations,
  limit = 8,
}: LocationRankingChartProps) {
  if (locations.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Sin datos de sucursales para visualizar ranking.
      </div>
    );
  }

  const data = [...locations]
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map((location) => ({
      ...location,
      label:
        location.locationName.length > 18
          ? `${location.locationName.slice(0, 18)}...`
          : location.locationName,
      color:
        location.status === "excellent"
          ? STAT_COLORS.excellent
          : location.status === "acceptable"
            ? STAT_COLORS.acceptable
            : STAT_COLORS.critical,
    }))
    .reverse();

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 16, left: 12, bottom: 8 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            strokeOpacity={0.15}
            horizontal={false}
          />
          <XAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
            tickLine={false}
            axisLine={false}
            fontSize={12}
          />
          <YAxis
            type="category"
            dataKey="label"
            tickLine={false}
            axisLine={false}
            width={130}
            fontSize={12}
          />
          <Tooltip
            formatter={(value, name) =>
              name === "attendanceRate"
                ? formatPercent(Number(value))
                : Number(value).toFixed(1)
            }
            labelFormatter={(_, payload) => payload?.[0]?.payload?.locationName}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid hsl(var(--border))",
            }}
          />
          <Bar dataKey="attendanceRate" radius={[0, 4, 4, 0]}>
            {data.map((entry) => (
              <Cell key={entry.locationId} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

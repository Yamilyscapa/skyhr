import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  formatPercent,
  STAT_COLORS,
} from "@/features/statistics/charts/config";

type LocationStatusDistributionChartProps = {
  counts: {
    excellent: number;
    acceptable: number;
    critical: number;
  };
  total: number;
};

export function LocationStatusDistributionChart({
  counts,
  total,
}: LocationStatusDistributionChartProps) {
  if (total === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Sin sucursales con datos para mostrar distribucion.
      </div>
    );
  }

  const segments = [
    {
      key: "Excelente",
      count: counts.excellent,
      percent: (counts.excellent / total) * 100,
      color: STAT_COLORS.excellent,
    },
    {
      key: "Aceptable",
      count: counts.acceptable,
      percent: (counts.acceptable / total) * 100,
      color: STAT_COLORS.acceptable,
    },
    {
      key: "Critico",
      count: counts.critical,
      percent: (counts.critical / total) * 100,
      color: STAT_COLORS.critical,
    },
  ] as const;

  const visibleSegments = segments.filter((segment) => segment.count > 0);

  if (visibleSegments.length === 1) {
    const onlySegment = visibleSegments[0];

    return (
      <div className="space-y-4">
        <div className="rounded-lg border bg-muted/20 p-4">
          <p className="text-sm font-medium text-foreground">
            Distribucion uniforme
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            100% de las sucursales estan en nivel{" "}
            {onlySegment.key.toLowerCase()} ({onlySegment.count} de {total}).
          </p>
          <div className="mt-3 h-2 w-full rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{ backgroundColor: onlySegment.color, width: "100%" }}
            />
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3 text-xs text-muted-foreground">
          <div className="rounded-md border p-2">
            Excelente:{" "}
            <span className="font-semibold text-foreground">
              {counts.excellent}
            </span>
          </div>
          <div className="rounded-md border p-2">
            Aceptable:{" "}
            <span className="font-semibold text-foreground">
              {counts.acceptable}
            </span>
          </div>
          <div className="rounded-md border p-2">
            Critico:{" "}
            <span className="font-semibold text-foreground">
              {counts.critical}
            </span>
          </div>
        </div>
      </div>
    );
  }

  const data = [
    {
      name: "Sucursales",
      Excelente: (counts.excellent / total) * 100,
      Aceptable: (counts.acceptable / total) * 100,
      Critico: (counts.critical / total) * 100,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
          >
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
              dataKey="name"
              tickLine={false}
              axisLine={false}
              width={70}
              fontSize={12}
            />
            <Tooltip
              formatter={(value) => formatPercent(Number(value))}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid hsl(var(--border))",
              }}
            />
            <Bar
              dataKey="Excelente"
              stackId="a"
              fill={STAT_COLORS.excellent}
              radius={[4, 0, 0, 4]}
            />
            <Bar
              dataKey="Aceptable"
              stackId="a"
              fill={STAT_COLORS.acceptable}
            />
            <Bar
              dataKey="Critico"
              stackId="a"
              fill={STAT_COLORS.critical}
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {visibleSegments.map((segment) => (
          <div
            key={segment.key}
            className="inline-flex items-center gap-2 rounded-md border px-2 py-1"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: segment.color }}
            />
            <span>
              {segment.key}: {segment.count} ({formatPercent(segment.percent)})
            </span>
          </div>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-3 text-xs text-muted-foreground">
        <div className="rounded-md border p-2">
          Excelente:{" "}
          <span className="font-semibold text-foreground">
            {counts.excellent}
          </span>
        </div>
        <div className="rounded-md border p-2">
          Aceptable:{" "}
          <span className="font-semibold text-foreground">
            {counts.acceptable}
          </span>
        </div>
        <div className="rounded-md border p-2">
          Critico:{" "}
          <span className="font-semibold text-foreground">
            {counts.critical}
          </span>
        </div>
      </div>
    </div>
  );
}

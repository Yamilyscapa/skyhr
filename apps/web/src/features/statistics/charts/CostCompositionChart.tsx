import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { CostAnalysisData } from "@/api";
import {
  formatCurrencyCompact,
  STAT_COLORS,
} from "@/features/statistics/charts/config";

type CostCompositionChartProps = {
  costs: CostAnalysisData;
};

export function CostCompositionChart({ costs }: CostCompositionChartProps) {
  const data = [
    {
      name: "Ausentismo",
      value: costs.absenteeismCost,
      color: STAT_COLORS.absenteeismCost,
    },
    {
      name: "Horas extra",
      value: costs.overtimeCost,
      color: STAT_COLORS.overtimeCost,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={60}
              outerRadius={95}
              paddingAngle={4}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) =>
                formatCurrencyCompact(Number(value), costs.currency || "MXN")
              }
              contentStyle={{
                borderRadius: 8,
                border: "1px solid hsl(var(--border))",
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-lg border bg-muted/20 p-3 text-sm">
        <p className="text-muted-foreground">Impacto total del periodo</p>
        <p className="text-xl font-semibold">
          {formatCurrencyCompact(
            costs.totalCostImpact,
            costs.currency || "MXN",
          )}
        </p>
      </div>
    </div>
  );
}

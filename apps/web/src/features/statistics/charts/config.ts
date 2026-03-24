export const STAT_COLORS = {
  excellent: "#22c55e",
  acceptable: "#f59e0b",
  critical: "#ef4444",
  attendance: "#2563eb",
  absenteeismCost: "#ef4444",
  overtimeCost: "#3b82f6",
} as const;

export const STAT_THRESHOLDS = {
  attendanceGoal: 95,
} as const;

export function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

export function formatCurrencyCompact(value: number, currency = "MXN") {
  return value.toLocaleString("es-MX", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
    notation: "compact",
    compactDisplay: "short",
  });
}

export function formatMonthShort(value: string) {
  let dateValue = value;
  if (/^\d{4}-\d{2}$/.test(value)) {
    dateValue = `${value}-01`;
  }

  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-MX", {
    month: "short",
  }).format(parsed);
}

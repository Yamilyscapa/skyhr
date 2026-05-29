import type { Weekday } from "./types";

export const weekdays: Array<{ key: Weekday; label: string; short: string }> = [
  { key: "mon", label: "Lunes", short: "Lun" },
  { key: "tue", label: "Martes", short: "Mar" },
  { key: "wed", label: "Miércoles", short: "Mié" },
  { key: "thu", label: "Jueves", short: "Jue" },
  { key: "fri", label: "Viernes", short: "Vie" },
  { key: "sat", label: "Sábado", short: "Sáb" },
  { key: "sun", label: "Domingo", short: "Dom" },
];

// Default working week (Mon–Fri) for new shift templates.
export const DEFAULT_DAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri"];

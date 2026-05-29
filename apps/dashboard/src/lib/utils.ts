import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as MXN-style currency (placeholder data). */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Format a count with a localized thousands separator. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-MX").format(value);
}

/** Short date, e.g. "5 may". */
export function formatDateShort(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

/** Long date with year, e.g. "5 de mayo de 2026". */
export function formatDateLong(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

/** Relative day + time, e.g. "Hoy · 14:30", "Ayer · 09:05", "5/3 · 16:00". */
export function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (sameDay) return `Hoy · ${time}`;
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Ayer · ${time}`;
  return `${d.getDate()}/${d.getMonth() + 1} · ${time}`;
}

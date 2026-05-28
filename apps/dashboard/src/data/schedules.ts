import type { Shift, Weekday, WeeklyAssignment } from "./types";

export const weekdays: Array<{ key: Weekday; label: string; short: string }> = [
  { key: "mon", label: "Lunes", short: "Lun" },
  { key: "tue", label: "Martes", short: "Mar" },
  { key: "wed", label: "Miércoles", short: "Mié" },
  { key: "thu", label: "Jueves", short: "Jue" },
  { key: "fri", label: "Viernes", short: "Vie" },
  { key: "sat", label: "Sábado", short: "Sáb" },
  { key: "sun", label: "Domingo", short: "Dom" },
];

export const shifts: Shift[] = [
  {
    id: "sft_morning",
    name: "Matutino",
    color: "#0051fe",
    startTime: "07:00",
    endTime: "15:00",
    breakMinutes: 30,
    days: ["mon", "tue", "wed", "thu", "fri"],
    headcount: 6,
  },
  {
    id: "sft_evening",
    name: "Vespertino",
    color: "#b45309",
    startTime: "14:00",
    endTime: "22:00",
    breakMinutes: 30,
    days: ["mon", "tue", "wed", "thu", "fri"],
    headcount: 2,
  },
  {
    id: "sft_night",
    name: "Nocturno",
    color: "#0f9d58",
    startTime: "22:00",
    endTime: "06:00",
    breakMinutes: 45,
    days: ["mon", "tue", "wed", "thu", "fri", "sat"],
    headcount: 1,
  },
  {
    id: "sft_flex",
    name: "Flexible",
    color: "#7c93ff",
    startTime: "10:00",
    endTime: "18:00",
    breakMinutes: 60,
    days: ["mon", "tue", "wed", "thu", "fri"],
    headcount: 3,
  },
  {
    id: "sft_weekend",
    name: "Fin de semana",
    color: "#ed474a",
    startTime: "09:00",
    endTime: "17:00",
    breakMinutes: 45,
    days: ["sat", "sun"],
    headcount: 0,
  },
];

const m = "sft_morning";
const e = "sft_evening";
const n = "sft_night";
const f = "sft_flex";

export const weeklyAssignments: WeeklyAssignment[] = [
  {
    employeeId: "emp_01",
    days: { mon: m, tue: m, wed: m, thu: m, fri: m, sat: null, sun: null },
  },
  {
    employeeId: "emp_02",
    days: { mon: m, tue: m, wed: m, thu: m, fri: m, sat: m, sun: null },
  },
  {
    employeeId: "emp_03",
    days: { mon: f, tue: f, wed: f, thu: f, fri: f, sat: null, sun: null },
  },
  {
    employeeId: "emp_04",
    days: { mon: e, tue: e, wed: e, thu: e, fri: e, sat: null, sun: null },
  },
  {
    employeeId: "emp_05",
    days: { mon: m, tue: m, wed: m, thu: m, fri: m, sat: null, sun: null },
  },
  {
    employeeId: "emp_06",
    days: { mon: n, tue: n, wed: n, thu: n, fri: n, sat: n, sun: null },
  },
  {
    employeeId: "emp_07",
    days: { mon: f, tue: f, wed: null, thu: f, fri: f, sat: null, sun: null },
  },
  {
    employeeId: "emp_08",
    days: { mon: m, tue: m, wed: m, thu: m, fri: m, sat: null, sun: null },
  },
  {
    employeeId: "emp_09",
    days: { mon: m, tue: m, wed: m, thu: m, fri: m, sat: null, sun: null },
  },
  {
    employeeId: "emp_10",
    days: { mon: e, tue: e, wed: e, thu: e, fri: e, sat: null, sun: null },
  },
  {
    employeeId: "emp_11",
    days: { mon: m, tue: m, wed: m, thu: m, fri: m, sat: null, sun: null },
  },
  {
    employeeId: "emp_12",
    days: { mon: f, tue: f, wed: f, thu: f, fri: null, sat: null, sun: null },
  },
];

export function shiftById(id: string | null): Shift | null {
  if (!id) return null;
  return shifts.find((s) => s.id === id) ?? null;
}

export function totalWeeklyHours(a: WeeklyAssignment): number {
  let mins = 0;
  for (const k of Object.keys(a.days) as Weekday[]) {
    const s = shiftById(a.days[k]);
    if (!s) continue;
    const [sh, sm] = s.startTime.split(":").map(Number);
    const [eh, em] = s.endTime.split(":").map(Number);
    let span = eh * 60 + em - (sh * 60 + sm);
    if (span <= 0) span += 24 * 60; // overnight
    mins += span - s.breakMinutes;
  }
  return Math.round((mins / 60) * 10) / 10;
}

export function coverageByDay(): Record<Weekday, number> {
  const c: Record<Weekday, number> = {
    mon: 0,
    tue: 0,
    wed: 0,
    thu: 0,
    fri: 0,
    sat: 0,
    sun: 0,
  };
  for (const a of weeklyAssignments) {
    for (const k of Object.keys(c) as Weekday[]) {
      if (a.days[k]) c[k] += 1;
    }
  }
  return c;
}

export type Kpi = {
  key: string;
  label: string;
  value: string;
  delta: number; // percentage change vs last period
  hint: string;
};

export const kpis: Kpi[] = [
  {
    key: "active",
    label: "Empleados activos",
    value: "48",
    delta: 4.2,
    hint: "de 60 asientos",
  },
  {
    key: "today",
    label: "Asistencias hoy",
    value: "45",
    delta: 2.1,
    hint: "93% del personal activo",
  },
  {
    key: "pending",
    label: "Permisos pendientes",
    value: "3",
    delta: -1,
    hint: "requieren aprobación",
  },
  {
    key: "punctuality",
    label: "Tasa de puntualidad",
    value: "86%",
    delta: 3.4,
    hint: "promedio de 14 días",
  },
];

export type ActivityItem = {
  id: string;
  who: string;
  action: string;
  when: string;
  tone: "success" | "warning" | "danger" | "info";
};

export const recentActivity: ActivityItem[] = [
  {
    id: "act_01",
    who: "Mariana López",
    action: "registró asistencia en Oficina Central",
    when: "Hoy · 08:56",
    tone: "success",
  },
  {
    id: "act_02",
    who: "Carlos Hernández",
    action: "registró asistencia con retardo en Planta Norte",
    when: "Hoy · 09:34",
    tone: "warning",
  },
  {
    id: "act_03",
    who: "Camila Ortiz",
    action: "solicitó un permiso de 3 días",
    when: "Hoy · 09:05",
    tone: "info",
  },
  {
    id: "act_04",
    who: "Roberto Castro",
    action: "registró asistencia fuera del perímetro",
    when: "Hoy · 07:58",
    tone: "danger",
  },
  {
    id: "act_05",
    who: "Andrés Gómez",
    action: "permiso por incapacidad aprobado",
    when: "Ayer · 10:12",
    tone: "success",
  },
];

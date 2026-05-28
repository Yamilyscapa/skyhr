import type { Announcement } from "./types";

export const announcements: Announcement[] = [
  {
    id: "ann_01",
    title: "Mantenimiento de checadores en Planta Norte",
    content:
      "El sistema de registro facial en Planta Norte estará en mantenimiento el sábado 31 de mayo de 07:00 a 09:00. Usa el registro por QR durante ese periodo.",
    priority: "urgent",
    publishedAt: "2026-05-28T08:00:00Z",
    expiresAt: "2026-05-31T23:59:00Z",
    status: "active",
    author: "Daniela Reyes",
  },
  {
    id: "ann_02",
    title: "Nueva política de home office",
    content:
      "A partir de junio, los equipos administrativos podrán trabajar de forma remota los viernes. Revisa los lineamientos en el portal de RH.",
    priority: "important",
    publishedAt: "2026-05-26T15:30:00Z",
    expiresAt: "2026-06-30T23:59:00Z",
    status: "active",
    author: "Sofía Martínez",
  },
  {
    id: "ann_03",
    title: "Recordatorio: registra tu rostro",
    content:
      "Si aún no has registrado tu rostro en la app, hazlo antes del 5 de junio para agilizar tu registro de asistencia.",
    priority: "normal",
    publishedAt: "2026-05-24T12:00:00Z",
    expiresAt: "2026-06-05T23:59:00Z",
    status: "active",
    author: "Daniela Reyes",
  },
  {
    id: "ann_04",
    title: "Junta general de resultados Q2",
    content:
      "La junta trimestral se llevará a cabo el 12 de junio en el auditorio de Oficina Central. Asistencia obligatoria para líderes de área.",
    priority: "important",
    publishedAt: "2026-06-01T09:00:00Z",
    expiresAt: "2026-06-12T23:59:00Z",
    status: "future",
    author: "Daniela Reyes",
  },
  {
    id: "ann_05",
    title: "Cierre administrativo de abril",
    content:
      "El periodo de aclaraciones de nómina de abril ha finalizado. Gracias por su colaboración.",
    priority: "normal",
    publishedAt: "2026-04-30T18:00:00Z",
    expiresAt: "2026-05-10T23:59:00Z",
    status: "expired",
    author: "Lucía Fernández",
  },
];

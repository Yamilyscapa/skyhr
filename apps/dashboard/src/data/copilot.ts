/**
 * Static "AI" copilot fixtures. No model is called — prompts are matched to
 * pre-authored responses so the interface feels alive without a backend.
 */

export type Block =
  | { type: "text"; value: string }
  | { type: "metrics"; items: Array<{ label: string; value: string; tone?: Tone }> }
  | { type: "table"; columns: string[]; rows: string[][] }
  | { type: "bars"; unit?: string; items: Array<{ label: string; value: number }> }
  | { type: "draft"; title: string; body: string }
  | {
      type: "alerts";
      items: Array<{
        tone: Tone;
        title: string;
        detail: string;
        actions: string[];
      }>;
    };

export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

export type Action = { label: string; variant?: "default" | "secondary" | "success" };

export type CopilotResponse = {
  summary: string;
  /** Trust caption shown in the answer footer, e.g. "Datos de asistencia · hoy". */
  source?: string;
  blocks: Block[];
  actions?: Action[];
  /** Context-aware next-step prompts shown as chips under the answer. */
  followups?: string[];
};

export type Suggestion = { id: string; label: string; prompt: string };

export const suggestions: Suggestion[] = [
  { id: "late", label: "¿Quién llegó tarde?", prompt: "¿Quién llegó tarde esta semana?" },
  { id: "payroll", label: "Resumen de nómina", prompt: "Dame un resumen de nómina de la quincena" },
  { id: "absences", label: "Ausencias Planta Norte", prompt: "¿Cómo va el ausentismo en Planta Norte?" },
  { id: "draft", label: "Redactar aviso", prompt: "Redacta un aviso sobre el mantenimiento de checadores" },
];

const responses: Record<string, CopilotResponse> = {
  late: {
    summary:
      "Encontré **6 registros con retardo** esta semana. Carlos Hernández acumula 2 retardos, el resto uno cada uno.",
    blocks: [
      {
        type: "table",
        columns: ["Empleado", "Día", "Entrada", "Ubicación"],
        rows: [
          ["Carlos Hernández", "Mié 28", "09:34", "Planta Norte"],
          ["Camila Ortiz", "Mié 28", "09:21", "Sucursal Polanco"],
          ["Paola Jiménez", "Mar 27", "10:02", "Oficina Central"],
          ["Carlos Hernández", "Lun 26", "09:18", "Planta Norte"],
        ],
      },
      {
        type: "bars",
        unit: "retardos",
        items: [
          { label: "Lun", value: 2 },
          { label: "Mar", value: 1 },
          { label: "Mié", value: 2 },
          { label: "Jue", value: 0 },
          { label: "Vie", value: 1 },
        ],
      },
    ],
    actions: [
      { label: "Enviar recordatorio", variant: "default" },
      { label: "Ver todos", variant: "secondary" },
    ],
    source: "Datos de asistencia · esta semana",
    followups: ["Desglosar por ubicación", "¿Quién tiene más retardos?", "Comparar con la semana pasada"],
  },
  payroll: {
    summary:
      "Resumen estimado de la quincena (1–15 may). Basado en horas registradas y tarifas por hora.",
    blocks: [
      {
        type: "metrics",
        items: [
          { label: "Costo estimado", value: "$486,200", tone: "info" },
          { label: "Horas trabajadas", value: "3,914 h", tone: "neutral" },
          { label: "Horas extra", value: "212 h", tone: "warning" },
          { label: "Ausencias", value: "14", tone: "danger" },
        ],
      },
      {
        type: "bars",
        unit: "horas",
        items: [
          { label: "Producción", value: 1280 },
          { label: "Operaciones", value: 920 },
          { label: "Logística", value: 760 },
          { label: "Ventas", value: 540 },
          { label: "Finanzas", value: 414 },
        ],
      },
    ],
    actions: [
      { label: "Generar reporte", variant: "default" },
      { label: "Exportar a nómina", variant: "secondary" },
    ],
    source: "Nómina estimada · 1–15 may",
    followups: ["Detalle de horas extra", "Costo por ubicación", "Proyección de quincena"],
  },
  absences: {
    summary:
      "El ausentismo en **Planta Norte** subió **12%** en los últimos 7 días, por encima del promedio de la organización (4%).",
    blocks: [
      {
        type: "metrics",
        items: [
          { label: "Ausentismo (7d)", value: "12%", tone: "danger" },
          { label: "Promedio org.", value: "4%", tone: "neutral" },
          { label: "Empleados afectados", value: "5", tone: "warning" },
        ],
      },
      {
        type: "table",
        columns: ["Empleado", "Faltas (7d)", "Última asistencia"],
        rows: [
          ["Diego Ramírez", "3", "24 may"],
          ["Javier Morales", "2", "25 may"],
          ["Roberto Castro", "1", "27 may"],
        ],
      },
    ],
    actions: [
      { label: "Crear aviso", variant: "default" },
      { label: "Ver análisis", variant: "secondary" },
    ],
    source: "Datos de asistencia · últimos 7 días",
    followups: ["¿Qué empleados faltaron?", "Comparar ubicaciones", "Redactar aviso"],
  },
  draft: {
    summary: "Listo. Redacté un borrador con prioridad **urgente**. Revísalo y publícalo cuando quieras.",
    blocks: [
      {
        type: "draft",
        title: "Mantenimiento de checadores en Planta Norte",
        body:
          "El sistema de registro facial en Planta Norte estará en mantenimiento el sábado 31 de mayo de 07:00 a 09:00 h. Durante ese periodo, registra tu asistencia mediante el código QR de tu ubicación. Agradecemos tu comprensión.",
      },
    ],
    actions: [
      { label: "Publicar aviso", variant: "success" },
      { label: "Editar", variant: "secondary" },
    ],
    source: "Borrador generado por SkyHR",
    followups: ["Hazlo más breve", "Cambiar a prioridad normal", "Programar para mañana"],
  },
};

const fallback: CopilotResponse = {
  summary:
    "Puedo ayudarte con asistencia, permisos, nómina y comunicados. Aquí tienes el pulso de hoy mientras tanto.",
  blocks: [
    {
      type: "metrics",
      items: [
        { label: "Asistencias hoy", value: "45", tone: "success" },
        { label: "Retardos", value: "6", tone: "warning" },
        { label: "Permisos pendientes", value: "3", tone: "info" },
      ],
    },
    { type: "text", value: "Prueba con una de las sugerencias para ver una respuesta detallada." },
  ],
  followups: ["¿Quién llegó tarde esta semana?", "Resumen de nómina", "¿Cómo va el ausentismo?"],
};

/** Proactive brief shown when the copilot first loads — copilot speaks first. */
export const dailyBrief: CopilotResponse = {
  summary: "Buenos días, Daniela. Detecté **3 cosas** que vale la pena revisar hoy.",
  blocks: [
    {
      type: "alerts",
      items: [
        {
          tone: "danger",
          title: "3 empleados fuera de geocerca",
          detail: "Almacén Sur · registro de hace unos minutos",
          actions: ["Revisar", "Ignorar"],
        },
        {
          tone: "warning",
          title: "Ausentismo +12% en Planta Norte",
          detail: "Últimos 7 días, por encima del promedio (4%)",
          actions: ["Ver análisis", "Crear aviso"],
        },
        {
          tone: "info",
          title: "3 permisos esperan aprobación",
          detail: "El más antiguo lleva 1 día sin respuesta",
          actions: ["Revisar cola"],
        },
      ],
    },
  ],
  source: "Resumen del día · hace un momento",
  followups: ["¿Quién llegó tarde esta semana?", "Resumen de nómina", "Redactar aviso"],
};

/** Match a free-text prompt to a canned response via simple keyword rules. */
export function resolveResponse(prompt: string): CopilotResponse {
  const p = prompt.toLowerCase();
  if (/(tarde|retardo|retraso|puntual)/.test(p)) return responses.late;
  if (/(n[oó]mina|pago|sueldo|salario|costo)/.test(p)) return responses.payroll;
  if (/(ausen|falta|planta norte|asisten)/.test(p)) return responses.absences;
  if (/(redacta|aviso|anuncio|comunicado|escribe|borrador)/.test(p)) return responses.draft;
  return fallback;
}

export function responseFor(suggestionId: string): CopilotResponse {
  return responses[suggestionId] ?? fallback;
}

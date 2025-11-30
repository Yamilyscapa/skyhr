import { CheckCircle2, AlertCircle, XCircle, LucideIcon } from "lucide-react";
import { 
  AttendanceReportData, 
  CostAnalysisData, 
  DashboardStatistics, 
  LocationComparisonData, 
  TrendsAnalysisData 
} from "@/api";

// ============================================================================
// UTILITIES FOR STATISTICS
// ============================================================================

export interface LocationStats {
  locationId: string;
  locationName: string;
  attendanceRate: number;
  absenteeismRate: number;
  punctualityIndex: number;
  rank: number;
  status: "excellent" | "acceptable" | "critical";
}

export function getAttendanceStatus(percentage: number): "excellent" | "acceptable" | "critical" {
  if (percentage >= 95) return "excellent";
  if (percentage >= 90) return "acceptable";
  return "critical";
}

export function getTrafficLightFromAttendance(percentage: number): "green" | "yellow" | "red" {
  if (percentage >= 95) return "green";
  if (percentage >= 90) return "yellow";
  return "red";
}

export function formatCurrencyMXN(value?: number) {
  if (typeof value !== "number") {
    return "$0";
  }
  return value.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  });
}

export interface StatusConfig {
  color: string;
  text: string;
  icon: LucideIcon;
  badge: "default" | "secondary" | "destructive" | "outline";
}

export function getStatusConfig(status: string): StatusConfig {
  switch (status) {
    case "excellent":
      return {
        color: "bg-green-500",
        text: "Excelente",
        icon: CheckCircle2,
        badge: "default",
      };
    case "acceptable":
      return {
        color: "bg-yellow-500",
        text: "Aceptable",
        icon: AlertCircle,
        badge: "secondary",
      };
    case "critical":
      return {
        color: "bg-red-500",
        text: "Crítico",
        icon: XCircle,
        badge: "destructive",
      };
    default:
      return {
        color: "bg-gray-500",
        text: "Desconocido",
        icon: AlertCircle,
        badge: "outline",
      };
  }
}

interface CsvExportData {
  monthLabel: string;
  startDate: string;
  endDate: string;
  globalAttendance: number;
  globalAbsenteeism: number;
  punctualityIndex: number;
  coverageRate: number;
  reportCompliance: number;
  trafficLight: string;
  locationStats: LocationStats[];
  costsResponse?: CostAnalysisData;
  attendanceTrends: { date: string; value: number }[];
  punctualityTrends: { date: string; value: number }[];
  absenteeismTrends: { date: string; value: number }[];
}

export function generateStatisticsCsv(data: CsvExportData): string {
  const {
    monthLabel,
    startDate,
    endDate,
    globalAttendance,
    globalAbsenteeism,
    punctualityIndex,
    coverageRate,
    reportCompliance,
    trafficLight,
    locationStats,
    costsResponse,
    attendanceTrends,
    punctualityTrends,
    absenteeismTrends,
  } = data;

  const csvRows: string[] = [];

  // Helper to escape CSV values
  const escapeCsv = (value: any): string => {
    if (value === null || value === undefined) return "";
    const str = String(value);
    return `"${str.replace(/"/g, '""')}"`;
  };

  // Header
  csvRows.push("ESTADÍSTICAS GENERALES - SKYHR");
  csvRows.push(`Mes: ${monthLabel}`);
  csvRows.push(`Fecha de exportación: ${new Date().toLocaleString("es-ES")}`);
  csvRows.push(`Periodo: ${startDate} a ${endDate}`);
  csvRows.push("");

  // Section 1: General Summary
  csvRows.push("=== RESUMEN GENERAL ===");
  csvRows.push("Métrica,Valor");
  csvRows.push(`Asistencia Global,${globalAttendance.toFixed(1)}%`);
  csvRows.push(`Ausentismo Promedio,${globalAbsenteeism.toFixed(1)}%`);
  csvRows.push(`Puntualidad,${punctualityIndex.toFixed(1)}%`);
  csvRows.push(`Cobertura,${coverageRate.toFixed(1)}%`);
  csvRows.push(`Cumplimiento de reportes,${reportCompliance.toFixed(1)}%`);
  csvRows.push(`Semáforo,${trafficLight}`);
  csvRows.push("");

  // Section 2: Location Statistics
  if (locationStats.length > 0) {
    csvRows.push("=== ESTADÍSTICAS POR UBICACIÓN ===");
    csvRows.push("Ubicación,Asistencia (%),Ausentismo (%),Puntualidad (%),Ranking,Estado");
    locationStats.forEach((location) => {
      csvRows.push(
        [
          escapeCsv(location.locationName),
          location.attendanceRate.toFixed(1),
          location.absenteeismRate.toFixed(1),
          location.punctualityIndex.toFixed(1),
          location.rank,
          location.status === "excellent"
            ? "Excelente"
            : location.status === "acceptable"
              ? "Aceptable"
              : "Crítico",
        ].join(","),
      );
    });
    csvRows.push("");
  }

  // Section 3: Cost Analysis
  if (costsResponse) {
    csvRows.push("=== ANÁLISIS DE COSTOS ===");
    csvRows.push("Métrica,Valor");
    csvRows.push(`Costo por ausentismo,${costsResponse.absenteeismCost}`);
    csvRows.push(`Costo por horas extra,${costsResponse.overtimeCost}`);
    csvRows.push(`Impacto total,${costsResponse.totalCostImpact}`);
    csvRows.push(`Moneda,${costsResponse.currency}`);
    csvRows.push("");
  }

  // Section 4: Quarterly Trends
  if (attendanceTrends.length > 0) {
    csvRows.push("=== TENDENCIAS (ASISTENCIA) ===");
    csvRows.push("Mes,Asistencia (%)");
    attendanceTrends.forEach((point) => {
      csvRows.push([escapeCsv(point.date), point.value].join(","));
    });
    csvRows.push("");
  }
  if (punctualityTrends.length > 0) {
    csvRows.push("=== TENDENCIAS (PUNTUALIDAD) ===");
    csvRows.push("Mes,Puntualidad (%)");
    punctualityTrends.forEach((point) => {
      csvRows.push([escapeCsv(point.date), point.value].join(","));
    });
    csvRows.push("");
  }
  if (absenteeismTrends.length > 0) {
    csvRows.push("=== TENDENCIAS (AUSENTISMO) ===");
    csvRows.push("Mes,Ausentismo (%)");
    absenteeismTrends.forEach((point) => {
      csvRows.push([escapeCsv(point.date), point.value].join(","));
    });
    csvRows.push("");
  }

  return csvRows.join("\n");
}

export function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}


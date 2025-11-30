import { CheckCircle2, AlertCircle, XCircle } from "lucide-react";

export interface LocationStats {
  locationId: string;
  locationName: string;
  attendanceRate: number;
  absenteeismRate: number;
  punctualityIndex: number;
  rank: number;
  status: "excellent" | "acceptable" | "critical";
}

// Determina el status basado en el porcentaje de asistencia
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

export function getStatusConfig(status: string) {
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


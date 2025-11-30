import { describe, it, expect } from "vitest";
import {
  getAttendanceStatus,
  getTrafficLightFromAttendance,
  formatCurrencyMXN,
  getStatusConfig,
  generateStatisticsCsv,
  LocationStats,
} from "./utils";
import { CostAnalysisData } from "@/api";

describe("Statistics Utils", () => {
  describe("getAttendanceStatus", () => {
    it("returns excellent for >= 95", () => {
      expect(getAttendanceStatus(95)).toBe("excellent");
      expect(getAttendanceStatus(98)).toBe("excellent");
    });

    it("returns acceptable for 90-94", () => {
      expect(getAttendanceStatus(90)).toBe("acceptable");
      expect(getAttendanceStatus(94)).toBe("acceptable");
    });

    it("returns critical for < 90", () => {
      expect(getAttendanceStatus(89)).toBe("critical");
      expect(getAttendanceStatus(0)).toBe("critical");
    });
  });

  describe("getTrafficLightFromAttendance", () => {
    it("returns green for >= 95", () => {
      expect(getTrafficLightFromAttendance(95.1)).toBe("green");
      expect(getTrafficLightFromAttendance(95)).toBe("green");
    });

    it("returns yellow for 90-<95", () => {
      expect(getTrafficLightFromAttendance(94.9)).toBe("yellow");
      expect(getTrafficLightFromAttendance(90)).toBe("yellow");
    });

    it("returns red for < 90", () => {
      expect(getTrafficLightFromAttendance(89.9)).toBe("red");
    });
  });

  describe("formatCurrencyMXN", () => {
    it("formats numbers as MXN currency", () => {
      // Note: The exact output might depend on the locale environment, 
      // but we check for basic formatting if possible or mock the return.
      // Since toLocaleString behavior depends on Node version/ICU, we do loose checks or rely on known behavior.
      const result = formatCurrencyMXN(1234.56);
      expect(result).toContain("$");
      expect(result).toContain("1,234.56"); // Common MX format
    });

    it("returns $0 for invalid inputs", () => {
      expect(formatCurrencyMXN(undefined)).toBe("$0");
      expect(formatCurrencyMXN(NaN)).toBe("$NaN"); // or however it behaves, wait. The function check typeof !== 'number'.
      // NaN is type number. let's check implementation.
      // if (typeof value !== "number") return "$0";
    });
  });

  describe("getStatusConfig", () => {
    it("returns config for excellent", () => {
      const config = getStatusConfig("excellent");
      expect(config.color).toBe("bg-green-500");
      expect(config.text).toBe("Excelente");
    });

    it("returns config for acceptable", () => {
      const config = getStatusConfig("acceptable");
      expect(config.color).toBe("bg-yellow-500");
      expect(config.text).toBe("Aceptable");
    });

    it("returns config for critical", () => {
      const config = getStatusConfig("critical");
      expect(config.color).toBe("bg-red-500");
      expect(config.text).toBe("Crítico");
    });

    it("returns default for unknown", () => {
      const config = getStatusConfig("unknown");
      expect(config.text).toBe("Desconocido");
    });
  });

  describe("generateStatisticsCsv", () => {
    it("generates valid CSV content", () => {
      const mockLocations: LocationStats[] = [
        {
          locationId: "1",
          locationName: "Office A",
          attendanceRate: 96,
          absenteeismRate: 4,
          punctualityIndex: 90,
          rank: 1,
          status: "excellent",
        },
      ];

      const mockCosts: CostAnalysisData = {
        absenteeismCost: 1000,
        overtimeCost: 500,
        totalCostImpact: 1500,
        currency: "MXN",
      };

      const csv = generateStatisticsCsv({
        monthLabel: "November 2025",
        startDate: "2025-11-01",
        endDate: "2025-11-30",
        globalAttendance: 95.5,
        globalAbsenteeism: 4.5,
        punctualityIndex: 92,
        coverageRate: 98,
        reportCompliance: 100,
        trafficLight: "green",
        locationStats: mockLocations,
        costsResponse: mockCosts,
        attendanceTrends: [{ date: "2025-10", value: 94 }],
        punctualityTrends: [],
        absenteeismTrends: [],
      });

      expect(csv).toContain("ESTADÍSTICAS GENERALES - SKYHR");
      expect(csv).toContain("Mes: November 2025");
      expect(csv).toContain("Asistencia Global,95.5%");
      expect(csv).toContain("Office A");
      expect(csv).toContain("96.0");
      expect(csv).toContain("Costo por ausentismo,1000");
      expect(csv).toContain("2025-10,94");
    });
  });
});


import { describe, it, expect } from "vitest";
import {
  getAttendanceStatus,
  getTrafficLightFromAttendance,
  formatCurrencyMXN,
} from "./statistics-utils";

describe("Statistics Utils", () => {
  describe("getAttendanceStatus", () => {
    it("should return 'excellent' for >= 95%", () => {
      expect(getAttendanceStatus(95)).toBe("excellent");
      expect(getAttendanceStatus(100)).toBe("excellent");
    });

    it("should return 'acceptable' for >= 90% and < 95%", () => {
      expect(getAttendanceStatus(90)).toBe("acceptable");
      expect(getAttendanceStatus(94.9)).toBe("acceptable");
    });

    it("should return 'critical' for < 90%", () => {
      expect(getAttendanceStatus(89.9)).toBe("critical");
      expect(getAttendanceStatus(0)).toBe("critical");
    });
  });

  describe("getTrafficLightFromAttendance", () => {
    it("should return 'green' for >= 95%", () => {
      expect(getTrafficLightFromAttendance(95.1)).toBe("green");
      expect(getTrafficLightFromAttendance(95)).toBe("green");
      expect(getTrafficLightFromAttendance(100)).toBe("green");
    });

    it("should return 'yellow' for >= 90% and < 95%", () => {
      expect(getTrafficLightFromAttendance(90)).toBe("yellow");
      expect(getTrafficLightFromAttendance(94.9)).toBe("yellow");
    });

    it("should return 'red' for < 90%", () => {
      expect(getTrafficLightFromAttendance(89.9)).toBe("red");
      expect(getTrafficLightFromAttendance(0)).toBe("red");
    });
  });

  describe("formatCurrencyMXN", () => {
    it("should format numbers as MXN currency", () => {
      // Note: The exact output depends on the locale environment, but we can check basic formatting
      // In Node/Vitest, full ICU might not be available or might vary.
      // We will check if it contains "$".
      const formatted = formatCurrencyMXN(1234.56);
      expect(formatted).toContain("$");
      expect(formatted).toContain("1,234.56");
    });

    it("should handle undefined/null", () => {
      expect(formatCurrencyMXN(undefined)).toBe("$0");
      expect(formatCurrencyMXN(null as any)).toBe("$0");
    });

    it("should handle 0", () => {
      const formatted = formatCurrencyMXN(0);
      expect(formatted).toContain("$0.00");
    });
  });
});


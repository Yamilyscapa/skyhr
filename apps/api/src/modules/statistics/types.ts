
export type Period = 'daily' | 'weekly' | 'monthly' | 'quarterly';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface AttendanceMetrics {
  attendanceRate: number;        // (Days worked / Days scheduled) * 100
  punctualityIndex: number;      // (On-time entries / Total entries) * 100
  unjustifiedAbsenteeism: number;// (Unjustified absences / Total staff) * 100
  operationalRotation: number;   // (Departures / Avg employees) * 100
  averageDelays: number;         // Total delays / Total employees
  coverageRate: number;          // (Covered shifts / Scheduled shifts) * 100
  reportCompliance: number;      // (Valid records / Expected records) * 100
}

export interface CostMetrics {
  absenteeismCost: number;       // Lost hours * average hourly rate
  overtimeCost: number;          // Overtime hours * overtime rate
  totalCostImpact: number;
  currency: string;
}

export interface LocationRanking {
  locationId: string;
  locationName: string;
  attendanceRate: number;
  absenteeismRate: number;
  punctualityIndex: number;
  rank: number;
}

export interface LocationHeatmapPoint {
  locationId: string;
  locationName: string;
  latitude: number;
  longitude: number;
  incidentCount: number; // Late arrivals, absences, etc.
  severity: 'low' | 'medium' | 'high';
}

export interface Alert {
  type: 'attendance' | 'cost' | 'pattern';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  entityId?: string; // location_id or user_id
}

export interface DashboardStats {
  organizationId: string;
  period: Period;
  metrics: AttendanceMetrics;
  trafficLight: 'green' | 'yellow' | 'red';
  alerts: Alert[];
}

export interface StatisticsQuery {
  period?: Period;
  startDate?: string;
  endDate?: string;
  locationId?: string;
  reportType?: 'basic' | 'premium';
}

export interface TrendPoint {
  date: string; // ISO date or month name
  value: number;
}

export interface TrendsData {
  attendance: TrendPoint[];
  punctuality: TrendPoint[];
  absenteeism: TrendPoint[];
}

export interface UserAttendanceRecord {
  id: string;
  checkIn: Date;
  checkOut: Date | null;
  status: string;
  locationName: string;
  hoursWorked: number | null;
  isLate: boolean;
}

export interface UserAttendanceStats {
  userId: string;
  userName: string;
  userEmail: string;
  period: Period;
  dateRange: DateRange;
  metrics: {
    attendanceRate: number;          // Personal attendance vs scheduled
    punctualityRate: number;          // On-time check-ins percentage
    totalWorkHours: number;           // Total hours worked in period
    overtimeHours: number;            // Hours beyond scheduled
    lateArrivals: number;             // Count of late check-ins
    absences: number;                 // Days absent
    onTimeCheckIns: number;           // Count of on-time arrivals
    totalCheckIns: number;            // Total check-ins in period
  };
  costImpact?: {                      // Optional: if payroll data exists
    regularPay: number;
    overtimePay: number;
    totalPay: number;
    currency: string;
  };
  recentActivity: UserAttendanceRecord[]; // Last N check-ins
}

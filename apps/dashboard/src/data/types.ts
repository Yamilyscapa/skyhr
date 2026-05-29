/**
 * Entity shapes mirror the real product types from the API / mobile app.
 * All data in this app is static placeholder data — no API is called.
 */

export type Org = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  seatsUsed: number;
  seatsTotal: number;
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export type EmployeeStatus = "active" | "pending";

export type Employee = {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  status: EmployeeStatus;
  hourlyRate: number;
  faceRegistered: boolean;
  shift: { name: string; color: string };
  location: string;
  todayStatus: AttendanceStatus | "off" | "scheduled";
};

export type AttendanceStatus =
  | "on_time"
  | "late"
  | "early"
  | "absent"
  | "out_of_bounds";

export type AttendanceEvent = {
  id: string;
  employeeName: string;
  employeeId: string;
  location: string;
  date: string; // ISO date
  checkIn: string | null; // "HH:mm" or null
  checkOut: string | null;
  status: AttendanceStatus;
  isWithinGeofence: boolean;
  workMinutes: number;
};

export type AnnouncementPriority = "normal" | "important" | "urgent";
export type AnnouncementStatus = "active" | "future" | "expired";

export type Announcement = {
  id: string;
  title: string;
  content: string;
  priority: AnnouncementPriority;
  publishedAt: string; // ISO
  expiresAt: string | null;
  status: AnnouncementStatus;
  author: string;
};

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type Shift = {
  id: string;
  name: string;
  color: string;
  startTime: string; // "HH:mm"
  endTime: string;
  breakMinutes: number;
  days: Weekday[];
  headcount: number;
};

export type WeeklyAssignment = {
  employeeId: string;
  /** shift id per weekday, or null when day off */
  days: Record<Weekday, string | null>;
};

export type PermissionStatus = "pending" | "approved" | "rejected";

export type Permission = {
  id: string;
  employeeName: string;
  employeeRole: string;
  message: string;
  startingDate: string; // ISO date
  endDate: string; // ISO date
  status: PermissionStatus;
  documentsCount: number;
  approvedBy: string | null;
  supervisorComment: string | null;
  createdAt: string; // ISO
};

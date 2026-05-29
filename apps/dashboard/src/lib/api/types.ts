// Response shapes for SkyHR API. Mirror server-side mappers, not raw DB rows.

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  pagination: Pagination;
}

export interface OrganizationOverview {
  id: string;
  name: string;
  slug: string | null;
  logo: string | null;
  plan: string;
  seatsUsed: number;
  seatsTotal: number;
  isActive: boolean;
  createdAt: string;
}

export interface MemberRow {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
  department: string | null;
  position: string | null;
  hourlyRate: number | null;
  faceRegistered: boolean;
  emailVerified: boolean;
  banned: boolean;
  createdAt: string;
  joinedAt: string;
}

export interface UserDetail extends MemberRow {
  shift: {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
    color: string | null;
    daysOfWeek: string[];
  } | null;
  locations: Array<{ id: string; name: string }>;
}

export interface AttendanceEvent {
  id: string;
  user_id: string | null;
  employee_name: string | null;
  employee_email: string | null;
  employee_department: string | null;
  organization_id: string | null;
  location_id: string | null;
  location_name: string | null;
  check_in: string;
  check_out: string | null;
  status: string;
  is_verified: boolean;
  is_within_geofence: boolean;
  distance_to_geofence_m: number | null;
  latitude: string | null;
  longitude: string | null;
  source: string;
  face_confidence: string | null;
  liveness_score: string | null;
  spoof_flag: boolean;
  shift_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PermissionRow {
  id: string;
  userId: string | null;
  organizationId: string | null;
  message: string;
  documentsUrl: string[];
  startingDate: string;
  endDate: string;
  status: "pending" | "approved" | "rejected";
  approvedBy: string | null;
  approvedByName: string | null;
  supervisorComment: string | null;
  createdAt: string;
  updatedAt: string;
  employeeName: string | null;
  employeeEmail: string | null;
  employeeRole: string | null;
}

export interface AnnouncementRow {
  id: string;
  organizationId: string | null;
  title: string;
  content: string;
  priority: "normal" | "important" | "urgent";
  publishedAt: string;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  author: string | null;
  authorId: string | null;
}

export interface ShiftRow {
  id: string;
  organization_id: string;
  name: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  days_of_week: string[];
  color: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AssignmentRow {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  shiftId: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  daysOfWeek: string[];
  color: string | null;
  effectiveFrom: string;
  effectiveUntil: string | null;
}

export interface LocationRow {
  id: string;
  name: string;
  type: string;
  center_latitude: string | null;
  center_longitude: string | null;
  radius: number | null;
  qr_code_url: string | null;
  active: boolean;
  created_at: string;
}

export interface ActivityItem {
  id: string;
  who: string;
  action: string;
  when: string;
  tone: "neutral" | "success" | "warning" | "danger" | "info";
  kind: "attendance" | "permission" | "announcement";
  meta?: Record<string, unknown>;
}

export interface DashboardStats {
  metrics: {
    attendanceRate: number;
    unjustifiedAbsenteeism: number;
    [key: string]: number;
  };
  trafficLight?: string;
  alerts?: unknown[];
}

export interface TrendPoint {
  date: string;
  value: number;
}

export interface TrendsResponse {
  attendance: TrendPoint[];
  punctuality: TrendPoint[];
  absenteeism: TrendPoint[];
}

export interface HoursByDepartmentRow {
  department: string;
  hours: number;
  employees: number;
}

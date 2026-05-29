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
  latitude: number | null;
  longitude: number | null;
  source: string;
  face_confidence: number | null;
  liveness_score: number | null;
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
  center_latitude: number | null;
  center_longitude: number | null;
  radius: number | null;
  qr_code_url: string | null;
  active: boolean;
  created_at: string;
}

export interface UserGeofenceAssignment {
  id: string;
  geofence_id: string;
  created_at: string;
  geofence: {
    id: string;
    name: string;
    type: string;
    center_latitude: number | null;
    center_longitude: number | null;
    radius: number | null;
    qr_code_url: string | null;
    active: boolean;
  } | null;
}

export interface GeofenceUser {
  id: string;
  user_id: string;
  created_at: string;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  } | null;
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

export interface CostAnalysis {
  absenteeismCost: number;
  overtimeCost: number;
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

export interface LocationComparison {
  rankings: LocationRanking[];
  heatmap: unknown[];
  best_performer: LocationRanking | null;
  needs_attention: LocationRanking[];
}

export type VisitorStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface VisitorRow {
  id: string;
  organization_id: string;
  name: string;
  access_areas: string[];
  entry_date: string;
  exit_date: string;
  status: VisitorStatus;
  approved_by_user_id: string | null;
  approved_at: string | null;
  created_by_user_id: string;
  qr_token: string;
  qr_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationSettings {
  id: string;
  organization_id: string;
  grace_period_minutes: number;
  extra_hour_cost: number;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export type BillingTierKey =
  | "tier_1_10"
  | "tier_11_50"
  | "tier_51_100"
  | "tier_101_plus";

export interface BillingPlan {
  key: BillingTierKey;
  label: string;
  minUsers: number;
  maxUsers: number | null;
  monthlyAmountMxn: number;
  notes: string;
}

export interface BillingSummary {
  organizationId: string;
  seatCount: number;
  ownerCountsAsSeat: boolean;
  isOwner: boolean;
  currency: string;
  monthlyEstimateMxn: number;
  overagePerUserMxn: number;
  tier: {
    key: BillingTierKey;
    label: string;
    minUsers: number;
    maxUsers: number | null;
    baseAmountMxn: number;
    overageQuantity: number;
  };
  billing: {
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    status: string;
    cancelAtPeriodEnd: boolean;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    lastSyncedAt: string | null;
  };
}

import type {
  ActivityItem,
  AnnouncementRow,
  AssignmentRow,
  AttendanceEvent,
  BillingPlan,
  BillingSummary,
  CostAnalysis,
  DashboardStats,
  HoursByDepartmentRow,
  LocationComparison,
  LocationRow,
  MemberRow,
  OrganizationOverview,
  OrganizationSettings,
  Paginated,
  PermissionRow,
  ShiftRow,
  TrendsResponse,
  UserDetail,
  UserGeofenceAssignment,
  GeofenceUser,
  VisitorRow,
  VisitorStatus,
} from "./types";

export interface ApiClientOptions {
  baseURL: string;
  fetch?: typeof fetch;
}

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
    this.name = "ApiError";
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

function buildQuery(q?: Query): string {
  if (!q) return "";
  const parts: string[] = [];
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null || v === "") continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

class Http {
  baseURL: string;
  fetchImpl: typeof fetch;

  constructor(opts: ApiClientOptions) {
    this.baseURL = opts.baseURL.replace(/\/$/, "");
    this.fetchImpl = opts.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    query?: Query,
  ): Promise<T> {
    const url = `${this.baseURL}${path}${buildQuery(query)}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // On the server (SSR), `credentials: "include"` is meaningless — there is no
    // browser cookie jar. Forward the incoming request's Cookie header so the API
    // sees the user's session. Dynamic import keeps the server-only module out of
    // the client bundle.
    if (typeof window === "undefined") {
      try {
        const { getRequestHeader } = await import("@tanstack/react-start/server");
        const cookie = getRequestHeader("cookie");
        if (cookie) headers.cookie = cookie;
      } catch {
        // Not inside a request context (e.g. build-time) — nothing to forward.
      }
    }

    const init: RequestInit = {
      method,
      credentials: "include",
      headers,
    };
    if (body !== undefined) init.body = JSON.stringify(body);

    const res = await this.fetchImpl(url, init);
    const text = await res.text();
    const json = text ? safeParse(text) : null;

    if (!res.ok) {
      const message =
        (json && typeof json === "object" && "error" in json
          ? String((json as { error: unknown }).error)
          : null) ?? res.statusText;
      throw new ApiError(res.status, message, json);
    }
    return json as T;
  }

  get<T>(path: string, query?: Query) {
    return this.request<T>("GET", path, undefined, query);
  }
  post<T>(path: string, body?: unknown, query?: Query) {
    return this.request<T>("POST", path, body, query);
  }
  patch<T>(path: string, body?: unknown, query?: Query) {
    return this.request<T>("PATCH", path, body, query);
  }
  put<T>(path: string, body?: unknown, query?: Query) {
    return this.request<T>("PUT", path, body, query);
  }
  delete<T>(path: string, query?: Query) {
    return this.request<T>("DELETE", path, undefined, query);
  }
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

interface Envelope<T> {
  data: T;
  message?: string;
}

export function createApiClient(opts: ApiClientOptions) {
  const http = new Http(opts);

  const users = {
    me: () =>
      http.get<Envelope<UserDetail>>("/users/me").then((r) => r.data),
    list: (params?: {
      page?: number;
      pageSize?: number;
      search?: string;
      role?: string;
    }) =>
      http
        .get<Paginated<MemberRow> & { message?: string }>("/users", params)
        .then((r) => r),
    get: (id: string) =>
      http.get<Envelope<UserDetail>>(`/users/${id}`).then((r) => r.data),
    update: (
      id: string,
      patch: Partial<{
        name: string;
        department: string | null;
        position: string | null;
        hourlyRate: number | null;
        role: string;
      }>,
    ) =>
      http.patch<Envelope<UserDetail>>(`/users/${id}`, patch).then((r) => r.data),
  };

  const organizations = {
    me: () =>
      http
        .get<Envelope<OrganizationOverview>>("/organizations/me")
        .then((r) => r.data),
    settings: (organizationId: string) =>
      http
        .get<Envelope<OrganizationSettings>>(
          `/organizations/${organizationId}/settings`,
        )
        .then((r) => r.data),
    updateSettings: (
      organizationId: string,
      patch: Partial<{
        grace_period_minutes: number;
        extra_hour_cost: number;
        timezone: string;
        work_hours_per_day: number;
        work_days_per_month: number;
      }>,
    ) =>
      http
        .put<Envelope<OrganizationSettings>>(
          `/organizations/${organizationId}/settings`,
          patch,
        )
        .then((r) => r.data),
  };

  const attendance = {
    events: (params?: {
      page?: number;
      pageSize?: number;
      user_id?: string;
      start_date?: string;
      end_date?: string;
      status?: string;
    }) =>
      http.get<
        Paginated<AttendanceEvent> & { message?: string }
      >("/attendance/events", params),
    today: (userId: string) =>
      http.get<Envelope<AttendanceEvent | null>>(`/attendance/today/${userId}`),
    report: (params?: { start_date?: string; end_date?: string }) =>
      http.get<Envelope<unknown>>("/attendance/report", params),
    markAbsences: () =>
      http.post<Envelope<{ count: number }>>("/attendance/admin/mark-absences"),
    updateStatus: (eventId: string, status: string, notes?: string) =>
      http.put<Envelope<{ id: string; status: string; notes: string | null }>>(
        `/attendance/admin/update-status/${eventId}`,
        { status, notes },
      ),
  };

  const permissions = {
    list: (params?: {
      page?: number;
      pageSize?: number;
      status?: string;
      userId?: string;
    }) =>
      http.get<{ data: PermissionRow[]; pagination: Paginated<PermissionRow>["pagination"]; message?: string }>(
        "/permissions",
        params,
      ),
    pending: (params?: { page?: number; pageSize?: number }) =>
      http.get<{ data: PermissionRow[]; pagination: Paginated<PermissionRow>["pagination"]; message?: string }>(
        "/permissions/pending",
        params,
      ),
    approve: (id: string, comment?: string) =>
      http.post<Envelope<PermissionRow>>(`/permissions/${id}/approve`, { comment }),
    reject: (id: string, comment: string) =>
      http.post<Envelope<PermissionRow>>(`/permissions/${id}/reject`, { comment }),
  };

  const announcements = {
    list: (params?: {
      page?: number;
      pageSize?: number;
      include_expired?: boolean;
      include_future?: boolean;
    }) =>
      http.get<{ data: AnnouncementRow[]; pagination?: Paginated<AnnouncementRow>["pagination"]; message?: string }>(
        "/announcements",
        params,
      ),
    create: (body: {
      title: string;
      content: string;
      priority?: "normal" | "important" | "urgent";
      published_at?: string;
      expires_at?: string | null;
    }) =>
      http.post<Envelope<AnnouncementRow>>("/announcements", body),
    update: (
      id: string,
      body: Partial<{
        title: string;
        content: string;
        priority: "normal" | "important" | "urgent";
        published_at: string;
        expires_at: string | null;
      }>,
    ) => http.put<Envelope<AnnouncementRow>>(`/announcements/${id}`, body),
    delete: (id: string) =>
      http.delete<Envelope<AnnouncementRow>>(`/announcements/${id}`),
  };

  const schedules = {
    shifts: () =>
      http.get<Envelope<ShiftRow[]>>("/schedules/shifts"),
    createShift: (body: {
      name: string;
      start_time: string;
      end_time: string;
      break_minutes: number;
      days_of_week: string[];
      color?: string;
    }) => http.post<Envelope<ShiftRow>>("/schedules/shifts/create", body),
    updateShift: (
      id: string,
      body: Partial<{
        name: string;
        start_time: string;
        end_time: string;
        break_minutes: number;
        days_of_week: string[];
        color: string;
        active: boolean;
      }>,
    ) => http.put<Envelope<ShiftRow>>(`/schedules/shifts/${id}`, body),
    assign: (body: {
      user_id: string;
      shift_id: string;
      effective_from: string;
      effective_until?: string | null;
    }) => http.post<Envelope<unknown>>("/schedules/assign", body),
    assignments: () =>
      http.get<Envelope<AssignmentRow[]>>("/schedules/assignments"),
    userSchedule: (userId: string) =>
      http.get<Envelope<unknown>>(`/schedules/user/${userId}`),
  };

  const geofence = {
    locations: (params?: { page?: number; pageSize?: number }) =>
      http.get<{ data: LocationRow[]; pagination: Paginated<LocationRow>["pagination"] }>(
        "/geofence/locations",
        params,
      ),
    create: (body: {
      name: string;
      center_latitude: number;
      center_longitude: number;
      radius: number;
      organization_id: string;
      type?: "circular" | "polygon";
    }) => http.post<Envelope<LocationRow>>("/geofence/create", body).then((r) => r.data),
  };

  const userGeofence = {
    list: (userId: string) =>
      http.get<{ data: UserGeofenceAssignment[]; message?: string }>(
        "/user-geofence/user-geofences",
        { user_id: userId },
      ),
    users: (geofenceId: string) =>
      http.get<{ data: GeofenceUser[]; message?: string }>(
        "/user-geofence/geofence-users",
        { geofence_id: geofenceId },
      ),
    assign: (body: {
      user_id: string;
      geofence_ids?: string[];
      assign_all?: boolean;
    }) => http.post<Envelope<unknown>>("/user-geofence/assign", body),
    remove: (body: { user_id: string; geofence_id: string }) =>
      http.post<Envelope<unknown>>("/user-geofence/remove", body),
    removeAll: (userId: string) =>
      http.post<Envelope<unknown>>("/user-geofence/remove-all", {
        user_id: userId,
      }),
  };

  const statistics = {
    dashboard: () =>
      http.get<Envelope<DashboardStats>>("/statistics/dashboard"),
    trends: () =>
      http.get<Envelope<TrendsResponse>>("/statistics/trends"),
    hoursByDepartment: (params?: {
      period?: "daily" | "weekly" | "monthly" | "quarterly";
      start_date?: string;
      end_date?: string;
    }) =>
      http.get<Envelope<HoursByDepartmentRow[]>>(
        "/statistics/hours-by-department",
        params,
      ),
    user: (userId: string) =>
      http.get<Envelope<unknown>>(`/statistics/user/${userId}`),
    costs: (params?: {
      period?: "daily" | "weekly" | "monthly" | "quarterly";
      start_date?: string;
      end_date?: string;
    }) => http.get<Envelope<CostAnalysis>>("/statistics/costs", params),
    locations: (params?: {
      period?: "daily" | "weekly" | "monthly" | "quarterly";
    }) => http.get<Envelope<LocationComparison>>("/statistics/locations", params),
  };

  const activity = {
    list: (params?: { limit?: number }) =>
      http.get<Envelope<ActivityItem[]>>("/activity", params),
  };

  const payroll = {
    updateRate: (userId: string, hourlyRate: number) =>
      http.put<Envelope<{ user_id: string; hourly_rate: number }>>("/payroll", {
        user_id: userId,
        hourly_rate: hourlyRate,
      }),
    overtime: (userId: string) =>
      http.get<Envelope<{ user_id: string; overtime_allowed: boolean }>>(
        `/payroll/overtime/${userId}`,
      ),
    setOvertime: (userId: string, overtimeAllowed: boolean) =>
      http.put<Envelope<{ user_id: string; overtime_allowed: boolean }>>(
        `/payroll/overtime/${userId}`,
        { overtime_allowed: overtimeAllowed },
      ),
  };

  const billing = {
    plans: () => http.get<Envelope<BillingPlan[]>>("/billing/plans"),
    summary: (organizationId: string) =>
      http.get<Envelope<BillingSummary>>(`/billing/${organizationId}/summary`),
    checkout: (organizationId: string) =>
      http.post<
        Envelope<{
          checkoutUrl: string;
          sessionId: string;
          seatCount: number;
          monthlyEstimateMxn: number;
        }>
      >(`/billing/${organizationId}/checkout-session`),
    portal: (organizationId: string) =>
      http.post<Envelope<{ portalUrl: string }>>(
        `/billing/${organizationId}/portal-session`,
      ),
  };

  const visitors = {
    list: (params?: {
      page?: number;
      pageSize?: number;
      status?: VisitorStatus;
      q?: string;
    }) =>
      http.get<{
        data: VisitorRow[];
        meta: { page: number; pageSize: number; total: number };
        message?: string;
      }>("/visitors", params),
    get: (id: string) =>
      http.get<Envelope<VisitorRow>>(`/visitors/${id}`).then((r) => r.data),
    create: (body: {
      name: string;
      accessAreas: string[];
      entryDate: string;
      exitDate: string;
      approveNow?: boolean;
    }) => http.post<Envelope<VisitorRow>>("/visitors", body).then((r) => r.data),
    update: (
      id: string,
      body: {
        name?: string;
        accessAreas: string[];
        entryDate?: string;
        exitDate?: string;
      },
    ) =>
      http.put<Envelope<VisitorRow>>(`/visitors/${id}`, body).then((r) => r.data),
    approve: (id: string) =>
      http
        .post<Envelope<VisitorRow>>(`/visitors/${id}/approve`)
        .then((r) => r.data),
    reject: (id: string) =>
      http
        .post<Envelope<VisitorRow>>(`/visitors/${id}/reject`)
        .then((r) => r.data),
    cancel: (id: string) =>
      http
        .post<Envelope<VisitorRow>>(`/visitors/${id}/cancel`)
        .then((r) => r.data),
  };

  return {
    http,
    users,
    organizations,
    attendance,
    permissions,
    announcements,
    schedules,
    geofence,
    statistics,
    activity,
    payroll,
    billing,
    visitors,
    userGeofence,
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

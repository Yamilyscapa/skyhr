import type {
  ActivityItem,
  AnnouncementRow,
  AttendanceEvent,
  DashboardStats,
  HoursByDepartmentRow,
  LocationRow,
  MemberRow,
  OrganizationOverview,
  Paginated,
  PermissionRow,
  ShiftRow,
  TrendsResponse,
  UserDetail,
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
    const init: RequestInit = {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
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
    assign: (body: {
      user_id: string;
      shift_id: string;
      effective_from: string;
      effective_until?: string | null;
    }) => http.post<Envelope<unknown>>("/schedules/assign", body),
    userSchedule: (userId: string) =>
      http.get<Envelope<unknown>>(`/schedules/user/${userId}`),
  };

  const geofence = {
    locations: (params?: { page?: number; pageSize?: number }) =>
      http.get<{ data: LocationRow[]; pagination: Paginated<LocationRow>["pagination"] }>(
        "/geofence/locations",
        params,
      ),
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
  };

  const activity = {
    list: (params?: { limit?: number }) =>
      http.get<Envelope<ActivityItem[]>>("/activity", params),
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
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

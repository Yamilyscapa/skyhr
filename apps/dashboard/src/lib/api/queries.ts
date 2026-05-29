import { queryOptions } from "@tanstack/react-query";
import { api } from "./index";
import type { VisitorStatus } from "./types";

// Centralized query keys + options for every API resource. Routes prefetch via
// `queryClient.ensureQueryData(...)` in their loader and read via `useQuery(...)`
// in the component, so navigation serves cached data and refetches in the
// background. Mutations invalidate the relevant key(s) instead of
// `router.invalidate()`.

type Page = { page?: number; pageSize?: number };

export const queries = {
  currentUser: () =>
    queryOptions({
      queryKey: ["currentUser"],
      queryFn: () => api.users.me(),
    }),

  currentOrg: () =>
    queryOptions({
      queryKey: ["currentOrg"],
      queryFn: () => api.organizations.me(),
    }),

  orgSettings: (orgId: string) =>
    queryOptions({
      queryKey: ["orgSettings", orgId],
      queryFn: () => api.organizations.settings(orgId),
    }),

  users: (params?: Page & { search?: string; role?: string }) =>
    queryOptions({
      queryKey: ["users", "list", params ?? {}],
      queryFn: () => api.users.list(params),
    }),

  user: (id: string) =>
    queryOptions({
      queryKey: ["users", "detail", id],
      queryFn: () => api.users.get(id),
    }),

  shifts: () =>
    queryOptions({
      queryKey: ["schedules", "shifts"],
      queryFn: () => api.schedules.shifts(),
    }),

  assignments: () =>
    queryOptions({
      queryKey: ["schedules", "assignments"],
      queryFn: () => api.schedules.assignments(),
    }),

  attendanceEvents: (params?: {
    page?: number;
    pageSize?: number;
    user_id?: string;
    start_date?: string;
    end_date?: string;
    status?: string;
  }) =>
    queryOptions({
      queryKey: ["attendance", "events", params ?? {}],
      queryFn: () => api.attendance.events(params),
    }),

  permissions: (params?: Page & { status?: string; userId?: string }) =>
    queryOptions({
      queryKey: ["permissions", "list", params ?? {}],
      queryFn: () => api.permissions.list(params),
    }),

  announcements: (params?: Page & {
    include_expired?: boolean;
    include_future?: boolean;
  }) =>
    queryOptions({
      queryKey: ["announcements", "list", params ?? {}],
      queryFn: () => api.announcements.list(params),
    }),

  locations: (params?: Page) =>
    queryOptions({
      queryKey: ["geofence", "locations", params ?? {}],
      queryFn: () => api.geofence.locations(params),
    }),

  geofenceUsers: (geofenceId: string) =>
    queryOptions({
      queryKey: ["geofence", "users", geofenceId],
      queryFn: () => api.userGeofence.users(geofenceId),
    }),

  statsDashboard: () =>
    queryOptions({
      queryKey: ["statistics", "dashboard"],
      queryFn: () => api.statistics.dashboard(),
    }),

  statsTrends: () =>
    queryOptions({
      queryKey: ["statistics", "trends"],
      queryFn: () => api.statistics.trends(),
    }),

  statsHoursByDepartment: (params?: {
    period?: "daily" | "weekly" | "monthly" | "quarterly";
    start_date?: string;
    end_date?: string;
  }) =>
    queryOptions({
      queryKey: ["statistics", "hoursByDepartment", params ?? {}],
      queryFn: () => api.statistics.hoursByDepartment(params),
    }),

  statsCosts: (params?: {
    period?: "daily" | "weekly" | "monthly" | "quarterly";
    start_date?: string;
    end_date?: string;
  }) =>
    queryOptions({
      queryKey: ["statistics", "costs", params ?? {}],
      queryFn: () => api.statistics.costs(params),
    }),

  statsLocations: (params?: {
    period?: "daily" | "weekly" | "monthly" | "quarterly";
  }) =>
    queryOptions({
      queryKey: ["statistics", "locations", params ?? {}],
      queryFn: () => api.statistics.locations(params),
    }),

  activity: (params?: { limit?: number }) =>
    queryOptions({
      queryKey: ["activity", params ?? {}],
      queryFn: () => api.activity.list(params),
    }),

  overtime: (userId: string) =>
    queryOptions({
      queryKey: ["payroll", "overtime", userId],
      queryFn: () => api.payroll.overtime(userId),
    }),

  billingSummary: (orgId: string) =>
    queryOptions({
      queryKey: ["billing", "summary", orgId],
      queryFn: () => api.billing.summary(orgId),
    }),

  billingPlans: () =>
    queryOptions({
      queryKey: ["billing", "plans"],
      queryFn: () => api.billing.plans(),
    }),

  visitors: (params?: Page & { status?: VisitorStatus; q?: string }) =>
    queryOptions({
      queryKey: ["visitors", "list", params ?? {}],
      queryFn: () => api.visitors.list(params),
    }),
};

// Coarse invalidation helpers — invalidate by domain prefix after a mutation.
export const invalidate = {
  users: ["users"] as const,
  schedules: ["schedules"] as const,
  attendance: ["attendance"] as const,
  permissions: ["permissions"] as const,
  announcements: ["announcements"] as const,
  geofence: ["geofence"] as const,
  visitors: ["visitors"] as const,
  payroll: ["payroll"] as const,
  billing: ["billing"] as const,
  orgSettings: ["orgSettings"] as const,
};

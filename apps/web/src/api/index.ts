export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type PaginatedListResponse<T = any> = {
  message?: string;
  data?: T[] | { events?: T[] };
  pagination?: PaginationMeta;
  [key: string]: any;
};

export type SingleRecordResponse<T = any> = {
  message?: string;
  data?: T;
  [key: string]: any;
};

export type AnnouncementPriority = "normal" | "important" | "urgent";

export type AnnouncementPayload = {
  title: string;
  content: string;
  priority: AnnouncementPriority;
  published_at: string;
  expires_at: string | null;
};

export type ApiAnnouncement = {
  id: string;
  organizationId: string | null;
  title: string;
  content: string;
  priority: AnnouncementPriority;
  publishedAt: string;
  expiresAt: string | null;
  createdAt: string;
  updatedAt?: string;
};

export type PermissionStatus = "pending" | "approved" | "rejected";

export type ApiPermission = {
  id: string;
  userId: string;
  organizationId: string;
  message: string;
  documentsUrl: string[];
  startingDate: string;
  endDate: string;
  status: PermissionStatus;
  approvedBy: string | null;
  supervisorComment: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VisitorStatus = "pending" | "approved" | "rejected" | "cancelled";

export type ApiVisitor = {
  id: string;
  name: string;
  accessAreas: string[];
  entryDate: string;
  exitDate: string;
  status: VisitorStatus;
  approvedByUserId?: string | null;
  approvedAt?: string | null;
  qrUrl?: string | null;
};

export type VisitorPayload = {
  name: string;
  accessAreas: string[];
  entryDate: string;
  exitDate: string;
  approveNow?: boolean;
};

// Statistics module types
export type StatisticsPeriod = "daily" | "weekly" | "monthly" | "quarterly";

export type StatisticsMetrics = {
  attendanceRate: number;
  punctualityIndex: number;
  unjustifiedAbsenteeism: number;
  operationalRotation: number;
  averageDelays: number;
  coverageRate: number;
  reportCompliance: number;
};

export type StatisticsDashboardAlert = {
  type: string;
  severity: "critical" | "warning" | "info" | string;
  message: string;
};

export type DashboardStatistics = {
  organization_id: string;
  period: StatisticsPeriod;
  metrics: StatisticsMetrics;
  traffic_light: "green" | "yellow" | "red";
  alerts: StatisticsDashboardAlert[];
};

export type AttendanceReportRange = {
  start: string;
  end: string;
};

export type AttendanceReportData = {
  period: StatisticsPeriod;
  range: AttendanceReportRange;
  metrics: StatisticsMetrics;
};

export type CostAnalysisData = {
  absenteeismCost: number;
  overtimeCost: number;
  totalCostImpact: number;
  currency: string;
};

export type LocationRanking = {
  locationId: string;
  locationName: string;
  attendanceRate: number;
  absenteeismRate: number;
  punctualityIndex: number;
  rank: number;
};

export type LocationHeatmapEntry = {
  locationId: string;
  locationName: string;
  latitude: number;
  longitude: number;
  incidentCount: number;
  severity: "low" | "medium" | "high";
};

export type LocationComparisonData = {
  rankings: LocationRanking[];
  heatmap: LocationHeatmapEntry[];
  best_performer?: LocationRanking;
  needs_attention?: Array<Pick<LocationRanking, "locationId" | "locationName" | "attendanceRate" | "rank">>;
};

export type TrendPoint = {
  date: string;
  value: number;
};

export type TrendsAnalysisData = {
  attendance: TrendPoint[];
  punctuality: TrendPoint[];
  absenteeism: TrendPoint[];
};

export type OrganizationSettings = {
  id: string;
  organization_id: string;
  grace_period_minutes: number;
  extra_hour_cost: number;
  timezone: string;
  created_at: string;
  updated_at: string;
};

export type UserStatisticsMetrics = {
  attendanceRate: number;
  punctualityRate: number;
  totalWorkHours: number;
  overtimeHours: number;
  lateArrivals: number;
  absences: number;
  onTimeCheckIns: number;
  totalCheckIns: number;
};

export type UserCostImpact = {
  regularPay: number;
  overtimePay: number;
  totalPay: number;
  currency: string;
};

export type UserRecentActivity = {
  id: string;
  checkIn: string;
  checkOut: string;
  status: string;
  locationName: string;
  hoursWorked: number;
  isLate: boolean;
};

export type UserStatisticsData = {
  userId: string;
  userName: string;
  userEmail: string;
  period: StatisticsPeriod;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  metrics: UserStatisticsMetrics;
  costImpact: UserCostImpact;
  recentActivity: UserRecentActivity[];
};

export function extractListData<T = any>(
  response?: PaginatedListResponse<T> | any,
): T[] {
  if (!response) {
    return [];
  }

  if (Array.isArray(response)) {
    return response as T[];
  }

  const data = response.data;
  if (Array.isArray(data)) {
    return data as T[];
  }

  if (data && Array.isArray((data as { events?: T[] }).events)) {
    return (data as { events?: T[] }).events || [];
  }

  return [];
}

export class ApiClientError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.details = details;
  }
}

export class API {
  private baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

    console.log(this.baseUrl);
  }

  // Helper method to handle responses
  private async handleResponse<T = any>(response: Response): Promise<T> {
    if (!response.ok) {
      const text = await response.text();
      console.error(`HTTP error! status: ${response.status}`, text);

      let errorMessage = `HTTP error! status: ${response.status}`;
      let parsedBody: unknown;
      try {
        parsedBody = JSON.parse(text);
        const maybeMessage = (parsedBody as { message?: string })?.message;
        if (maybeMessage) {
          errorMessage = maybeMessage;
        }
      } catch {
        // Not JSON, use default error message
      }

      throw new ApiClientError(errorMessage, response.status, parsedBody);
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      if (text) {
        console.error("Expected JSON but got:", text);
      }
      // For successful responses without JSON, return undefined
      return undefined as T;
    }

    return await response.json();
  }

  private buildQueryString(params?: Record<string, string | number | boolean | null | undefined>) {
    const searchParams = new URLSearchParams();

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null) {
          return;
        }
        searchParams.append(key, String(value));
      });
    }

    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : "";
  }

  // Generic API methods
  public async get(url: string, headers?: Record<string, string>) {
    const fetchHeaders: Record<string, string> = {};
    if (headers) {
      Object.assign(fetchHeaders, headers);
    }
    return await fetch(`${this.baseUrl}${url}`, {
      method: "GET",
      credentials: "include",
      headers: Object.keys(fetchHeaders).length > 0 ? fetchHeaders : undefined,
    });
  }

  public async post(url: string, data: any, headers?: Record<string, string>) {
    const fetchHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (headers) {
      Object.assign(fetchHeaders, headers);
    }
    return await fetch(`${this.baseUrl}${url}`, {
      method: "POST",
      headers: fetchHeaders,
      credentials: "include",
      body: JSON.stringify(data),
    });
  }

  public async put(url: string, data: any, headers?: Record<string, string>) {
    const fetchHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (headers) {
      Object.assign(fetchHeaders, headers);
    }
    return await fetch(`${this.baseUrl}${url}`, {
      method: "PUT",
      headers: fetchHeaders,
      credentials: "include",
      body: JSON.stringify(data),
    });
  }

  public async delete(url: string, headers?: Record<string, string>) {
    const fetchHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (headers) {
      Object.assign(fetchHeaders, headers);
    }
    return await fetch(`${this.baseUrl}${url}`, {
      method: "DELETE",
      headers: Object.keys(fetchHeaders).length > 0 ? fetchHeaders : undefined,
      credentials: "include",
    });
  }

  public async getOrganizationSettings(organizationId: string) {
    const response = await this.get(`/organizations/${organizationId}/settings`);
    return await this.handleResponse<SingleRecordResponse<OrganizationSettings>>(response);
  }

  public async updateOrganizationSettings(
    organizationId: string,
    payload: {
      grace_period_minutes?: number;
      extra_hour_cost?: number;
      timezone?: string;
    },
  ) {
    const response = await this.put(`/organizations/${organizationId}/settings`, payload);
    return await this.handleResponse<SingleRecordResponse<OrganizationSettings>>(response);
  }

  // Statistics API methods
  public async getStatisticsDashboard(params?: { period?: StatisticsPeriod }) {
    const query = this.buildQueryString({
      period: params?.period,
    });
    const response = await this.get(`/statistics/dashboard${query}`);
    return await this.handleResponse<SingleRecordResponse<DashboardStatistics>>(response);
  }

  public async getStatisticsAttendance(params?: {
    period?: StatisticsPeriod;
    start_date?: string;
    end_date?: string;
    location_id?: string;
  }) {
    const query = this.buildQueryString({
      period: params?.period,
      start_date: params?.start_date,
      end_date: params?.end_date,
      location_id: params?.location_id,
    });
    const response = await this.get(`/statistics/attendance${query}`);
    return await this.handleResponse<SingleRecordResponse<AttendanceReportData>>(response);
  }

  public async getStatisticsCosts(params?: {
    period?: StatisticsPeriod;
    start_date?: string;
    end_date?: string;
  }) {
    const query = this.buildQueryString({
      period: params?.period,
      start_date: params?.start_date,
      end_date: params?.end_date,
    });
    const response = await this.get(`/statistics/costs${query}`);
    return await this.handleResponse<SingleRecordResponse<CostAnalysisData>>(response);
  }

  public async getStatisticsLocations(params?: { period?: StatisticsPeriod }) {
    const query = this.buildQueryString({
      period: params?.period,
    });
    const response = await this.get(`/statistics/locations${query}`);
    return await this.handleResponse<SingleRecordResponse<LocationComparisonData>>(response);
  }

  public async getStatisticsTrends() {
    const response = await this.get(`/statistics/trends`);
    return await this.handleResponse<SingleRecordResponse<TrendsAnalysisData>>(response);
  }

  public async getUserStatistics(userId: string, params?: {
    period?: StatisticsPeriod;
    start_date?: string;
    end_date?: string;
  }) {
    const query = this.buildQueryString({
      period: params?.period,
      start_date: params?.start_date,
      end_date: params?.end_date,
    });
    const response = await this.get(`/statistics/user/${userId}${query}`);
    return await this.handleResponse<SingleRecordResponse<UserStatisticsData>>(response);
  }

  public async getUserStatisticsByEmail(params: {
    email: string;
    period?: StatisticsPeriod;
    start_date?: string;
    end_date?: string;
  }) {
    const query = this.buildQueryString({
      email: params.email,
      period: params.period,
      start_date: params.start_date,
      end_date: params.end_date,
    });
    const response = await this.get(`/statistics/user/by-email${query}`);
    return await this.handleResponse<SingleRecordResponse<UserStatisticsData>>(response);
  }

  // Announcement API methods
  public async getAnnouncements(params?: {
    includeExpired?: boolean;
    includeFuture?: boolean;
    page?: number;
    pageSize?: number;
  }) {
    const searchParams = new URLSearchParams();
    const finalParams = {
      includeExpired: params?.includeExpired ? "true" : undefined,
      includeFuture: params?.includeFuture ? "true" : undefined,
      page: params?.page,
      pageSize: params?.pageSize,
    };

    Object.entries(finalParams).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }
      searchParams.append(key, String(value));
    });

    const queryString = searchParams.toString();
    const url = `/announcements${queryString ? `?${queryString}` : ""}`;
    const response = await this.get(url);
    return await this.handleResponse<PaginatedListResponse<ApiAnnouncement>>(response);
  }

  public async getAnnouncement(id: string) {
    const response = await this.get(`/announcements/${id}`);
    return await this.handleResponse<SingleRecordResponse<ApiAnnouncement>>(response);
  }

  public async createAnnouncement(data: AnnouncementPayload) {
    const response = await this.post(`/announcements`, data);

    return await this.handleResponse<SingleRecordResponse<ApiAnnouncement>>(response);
  }

  public async updateAnnouncement(id: string, data: AnnouncementPayload) {
    const response = await this.put(`/announcements/${id}`, data);
    return await this.handleResponse<SingleRecordResponse<ApiAnnouncement>>(response);
  }

  public async deleteAnnouncement(id: string) {
    const response = await this.delete(`/announcements/${id}`);
    return await this.handleResponse<SingleRecordResponse<{ id: string }>>(response);
  }

  // Geofence API methods
  public async createGeofence(
    name: string,
    center_latitude: string,
    center_longitude: string,
    radius: number,
    organization_id: string,
  ) {
    return await this.post("/geofence/create", {
      name,
      center_latitude,
      center_longitude,
      radius,
      organization_id,
    });
  }

  // Schedules/Shifts API methods
  public async createShift(data: {
    name: string;
    start_time: string;
    end_time: string;
    break_minutes: number;
    days_of_week: string[];
    color: string;
  }) {
    return await this.post("/schedules/shifts/create", data);
  }

  public async getShifts() {
    return await this.get("/schedules/shifts");
  }

  public async updateShift(id: string, data: Partial<{
    name: string;
    start_time: string;
    end_time: string;
    break_minutes: number;
    days_of_week: string[];
    color: string;
  }>) {
    return await fetch(`${this.baseUrl}/schedules/shifts/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(data),
    });
  }

  public async assignShift(data: {
    user_id: string;
    shift_id: string;
    effective_from: string;
    effective_until?: string;
  }) {
    return await this.post("/schedules/assign", data);
  }


  public async getUserSchedule(userId: string) {
    return await this.get(`/schedules/user/${userId}`);
  }
  // User-Geofence API methods
  public async assignGeofencesToUser(data: {
    user_id: string;
    geofence_ids?: string[];
    assign_all?: boolean;
  }) {
    return await this.post("/user-geofence/assign", data);
  }

  public async removeGeofenceFromUser(data: {
    user_id: string;
    geofence_id: string;
  }) {
    return await this.post("/user-geofence/remove", data);
  }

  public async removeAllGeofencesFromUser(data: { user_id: string }) {
    return await this.post("/user-geofence/remove-all", data);
  }

  public async getUserGeofences(userId: string) {
    return await this.get(`/user-geofence/user-geofences?user_id=${userId}`);
  }

  public async getGeofenceUsers(geofenceId: string) {
    return await this.get(`/user-geofence/geofence-users?geofence_id=${geofenceId}`);
  }

  public async checkUserGeofenceAccess(data: {
    user_id: string;
    geofence_id: string;
  }) {
    return await this.post("/user-geofence/check-access", data);
  }

  public async getGeofencesByOrganization(organizationId: string, params?: {
    page?: number;
    pageSize?: number;
  }) {
    const searchParams = new URLSearchParams();
    const finalParams = {
      id: organizationId,
      page: params?.page,
      pageSize: params?.pageSize,
    };

    Object.entries(finalParams).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }
      searchParams.append(key, String(value));
    });

    const queryString = searchParams.toString();
    const url = `/geofence/get-by-organization${queryString ? `?${queryString}` : ""}`;
    const response = await this.get(url);
    return await this.handleResponse<PaginatedListResponse>(response);
  }

  // Attendance API methods
  public async getAttendanceEvents(params?: {
    user_id?: string;
    start_date?: string;
    end_date?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }) {
    const searchParams = new URLSearchParams();
    const finalParams = {
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 20,
      user_id: params?.user_id,
      start_date: params?.start_date,
      end_date: params?.end_date,
      status: params?.status,
    };

    Object.entries(finalParams).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }
      searchParams.append(key, String(value));
    });

    const queryString = searchParams.toString();
    const url = `/attendance/events${queryString ? `?${queryString}` : ""}`;
    const response = await this.get(url);
    return await this.handleResponse<PaginatedListResponse>(response);
  }

  public async getAttendanceReport() {
    const response = await this.get("/attendance/report");
    return await this.handleResponse(response);
  }

  public async validateQR(qr_data: string) {
    const response = await this.post("/attendance/qr/validate", { qr_data });
    return await this.handleResponse(response);
  }

  public async checkIn(formData: FormData) {
    const response = await fetch(`${this.baseUrl}/attendance/check-in`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    return await this.handleResponse(response);
  }

  public async checkOut(formData: FormData) {
    const response = await fetch(`${this.baseUrl}/attendance/check-out`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    return await this.handleResponse(response);
  }

  public async updateAttendanceStatus(eventId: string, data: {
    status: "on_time" | "late" | "early" | "absent" | "out_of_bounds";
    notes?: string;
  }) {
    const response = await this.put(`/attendance/admin/update-status/${eventId}`, data);
    return await this.handleResponse(response);
  }

  public async markAbsences(data?: {
    user_ids?: string[];
    date?: string; // YYYY-MM-DD format
    notes?: string;
  }) {
    const response = await this.post("/attendance/admin/mark-absences", data || {});
    return await this.handleResponse(response);
  }

  // Permissions API methods
  public async getPermissions(params?: {
    status?: PermissionStatus;
    userId?: string;
    page?: number;
    pageSize?: number;
  }) {
    const searchParams = new URLSearchParams();
    const finalParams = {
      status: params?.status,
      userId: params?.userId,
      page: params?.page,
      pageSize: params?.pageSize,
    };

    Object.entries(finalParams).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }
      searchParams.append(key, String(value));
    });

    const queryString = searchParams.toString();
    const url = `/permissions${queryString ? `?${queryString}` : ""}`;
    const response = await this.get(url);
    return await this.handleResponse<PaginatedListResponse<ApiPermission>>(response);
  }

  public async getPendingPermissions(params?: {
    userId?: string;
    page?: number;
    pageSize?: number;
  }) {
    const searchParams = new URLSearchParams();
    const finalParams = {
      userId: params?.userId,
      page: params?.page,
      pageSize: params?.pageSize,
    };

    Object.entries(finalParams).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }
      searchParams.append(key, String(value));
    });

    const queryString = searchParams.toString();
    const url = `/permissions/pending${queryString ? `?${queryString}` : ""}`;
    const response = await this.get(url);
    return await this.handleResponse<PaginatedListResponse<ApiPermission>>(response);
  }

  public async getPermission(id: string) {
    const response = await this.get(`/permissions/${id}`);
    return await this.handleResponse<SingleRecordResponse<ApiPermission>>(response);
  }

  public async approvePermission(id: string, comment?: string) {
    const response = await this.post(`/permissions/${id}/approve`, {
      comment: comment || undefined,
    });
    return await this.handleResponse<SingleRecordResponse<ApiPermission>>(response);
  }

  public async rejectPermission(id: string, comment: string) {
    const response = await this.post(`/permissions/${id}/reject`, {
      comment,
    });
    return await this.handleResponse<SingleRecordResponse<ApiPermission>>(response);
  }

  public async addPermissionDocuments(id: string, files: File[]) {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("documents", file);
    });

    const response = await fetch(`${this.baseUrl}/permissions/${id}/documents`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    return await this.handleResponse<SingleRecordResponse<ApiPermission>>(response);
  }

  public async createPermission(data: {
    message: string;
    startingDate: string;
    endDate: string;
    userId?: string;
    documents?: File[];
  }) {
    const formData = new FormData();
    formData.append("message", data.message);
    formData.append("starting_date", data.startingDate);
    formData.append("end_date", data.endDate);
    
    if (data.userId) {
      formData.append("user_id", data.userId);
    }
    
    if (data.documents && data.documents.length > 0) {
      data.documents.forEach((file) => {
        formData.append("documents", file);
      });
    }

    const response = await fetch(`${this.baseUrl}/permissions`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    return await this.handleResponse<SingleRecordResponse<ApiPermission>>(response);
  }

  // Visitors API methods
  public async getVisitors(params?: {
    status?: VisitorStatus | "all";
    q?: string;
    page?: number;
    pageSize?: number;
    organizationId?: string;
  }) {
    const searchParams = new URLSearchParams();
    const finalParams = {
      status: params?.status && params.status !== "all" ? params.status : undefined,
      q: params?.q,
      page: params?.page,
      pageSize: params?.pageSize,
    };

    Object.entries(finalParams).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }
      searchParams.append(key, String(value));
    });

    const queryString = searchParams.toString();
    const url = `/visitors${queryString ? `?${queryString}` : ""}`;

    const headers: Record<string, string> = {};
    if (params?.organizationId) {
      headers["x-organization-id"] = params.organizationId;
    }

    const response = await this.get(url, Object.keys(headers).length > 0 ? headers : undefined);
    return await this.handleResponse<PaginatedListResponse<ApiVisitor>>(response);
  }

  public async getVisitor(id: string, organizationId?: string) {
    const headers: Record<string, string> = {};
    if (organizationId) {
      headers["x-organization-id"] = organizationId;
    }
    const response = await this.get(`/visitors/${id}`, Object.keys(headers).length > 0 ? headers : undefined);
    return await this.handleResponse<SingleRecordResponse<ApiVisitor>>(response);
  }

  public async createVisitor(data: VisitorPayload, organizationId?: string) {
    const headers: Record<string, string> = {};
    if (organizationId) {
      headers["x-organization-id"] = organizationId;
    }
    const response = await this.post(`/visitors`, data, Object.keys(headers).length > 0 ? headers : undefined);
    return await this.handleResponse<SingleRecordResponse<ApiVisitor>>(response);
  }

  public async approveVisitor(id: string, organizationId?: string) {
    const headers: Record<string, string> = {};
    if (organizationId) {
      headers["x-organization-id"] = organizationId;
    }
    const response = await this.post(`/visitors/${id}/approve`, {}, Object.keys(headers).length > 0 ? headers : undefined);
    return await this.handleResponse<SingleRecordResponse<ApiVisitor>>(response);
  }

  public async rejectVisitor(id: string, organizationId?: string) {
    const headers: Record<string, string> = {};
    if (organizationId) {
      headers["x-organization-id"] = organizationId;
    }
    const response = await this.post(`/visitors/${id}/reject`, {}, Object.keys(headers).length > 0 ? headers : undefined);
    return await this.handleResponse<SingleRecordResponse<ApiVisitor>>(response);
  }

  public async cancelVisitor(id: string, organizationId?: string) {
    const headers: Record<string, string> = {};
    if (organizationId) {
      headers["x-organization-id"] = organizationId;
    }
    const response = await this.post(`/visitors/${id}/cancel`, {}, Object.keys(headers).length > 0 ? headers : undefined);
    return await this.handleResponse<SingleRecordResponse<ApiVisitor>>(response);
  }

  // Hourly Rate API methods
  public async getHourlyRate(userId: string) {
    const response = await this.get(`/payroll/${userId}`);
    return response;
  }

  public async getOvertime(userId: string) {
    const response = await this.get(`/payroll/overtime/${userId}`);
    return response;
  }
  
  public async updateHourlyRate(userId: string, hourlyRate: number) {
    const response = await this.put(`/payroll`, { user_id: userId, hourly_rate: hourlyRate });
    
    return response;
  }

  public async updateOvertime(userId: string, overtimeAllowed: boolean) {
    const response = await this.put(`/payroll/overtime/${userId}`, {
      overtime_allowed: overtimeAllowed,
    });

    return response;
  }

  // Storage presigned URL methods
  public async getQrPresignedUrl(key: string): Promise<{ url: string; expiresIn: number }> {
    const response = await this.get(`/storage/presign/qr/${encodeURIComponent(key)}`);
    return await this.handleResponse(response);
  }

  public async getDocumentPresignedUrl(key: string): Promise<{ url: string; expiresIn: number }> {
    const response = await this.get(`/storage/presign/document/${encodeURIComponent(key)}`);
    return await this.handleResponse(response);
  }
}

export default new API();

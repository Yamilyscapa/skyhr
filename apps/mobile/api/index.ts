/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
    constructor(
        message: string,
        public statusCode?: number,
        public originalError?: unknown
    ) {
        super(message);
        this.name = 'ApiError';
        Object.setPrototypeOf(this, ApiError.prototype);
    }
}

/**
 * Network error class for connection issues
 */
export class NetworkError extends Error {
    constructor(message: string, public originalError?: unknown) {
        super(message);
        this.name = 'NetworkError';
        Object.setPrototypeOf(this, NetworkError.prototype);
    }
}

class Api {
    private baseUrl: string;
    private readonly REQUEST_TIMEOUT_MS = 30000; // 30 seconds

    constructor() {
        this.baseUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

        if (!this.baseUrl) {
            throw new Error('API URL is not set');
        }
    }

    private async getAuthHeaders(): Promise<HeadersInit> {
        try {
            const headers: HeadersInit = {
                'Content-Type': 'application/json',
            };

            const { authClient } = await import('@/lib/auth-client');
            const cookies = authClient.getCookie();

            if (cookies) {
                headers['Cookie'] = cookies;
            }

            return headers;
        } catch (error) {
            console.error('Error getting auth headers:', error);
            // Return basic headers even if auth fails
            return {
                'Content-Type': 'application/json',
            };
        }
    }

    /**
     * Creates a fetch request with timeout
     */
    private async fetchWithTimeout(
        url: string,
        options: RequestInit,
        timeoutMs: number = this.REQUEST_TIMEOUT_MS
    ): Promise<Response> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === 'AbortError') {
                throw new NetworkError('La solicitud tardó demasiado. Verifica tu conexión a internet.', error);
            }
            if (error instanceof Error) {
                throw new NetworkError(`Error de conexión: ${error.message}`, error);
            }
            throw new NetworkError('Error de conexión desconocido', error);
        }
    }

    /**
     * Handles response errors and throws appropriate error types
     */
    private async handleResponse(response: Response): Promise<any> {
        if (!response.ok) {
            let errorMessage = `Error HTTP ${response.status}`;
            try {
                const text = await response.text();
                if (text) {
                    try {
                        const json = JSON.parse(text);
                        errorMessage = json.message || json.error || text;
                    } catch {
                        errorMessage = text || errorMessage;
                    }
                }
            } catch (parseError) {
                console.error('Error parsing error response:', parseError);
            }

            throw new ApiError(errorMessage, response.status);
        }

        try {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }
            // If not JSON, return text
            const text = await response.text();
            return text ? JSON.parse(text) : {};
        } catch (parseError) {
            console.error('Error parsing response JSON:', parseError);
            throw new ApiError('Error al procesar la respuesta del servidor', response.status, parseError);
        }
    }

    public async get(url: string) {
        try {
            const headers = await this.getAuthHeaders();
            const response = await this.fetchWithTimeout(`${this.baseUrl}/${url}`, {
                headers,
                credentials: "omit"
            });
            return await this.handleResponse(response);
        } catch (error) {
            if (error instanceof ApiError || error instanceof NetworkError) {
                throw error;
            }
            throw new NetworkError('Error al realizar la solicitud', error);
        }
    }

    public async post(url: string, data: any) {
        try {
            const headers = await this.getAuthHeaders();
            const response = await this.fetchWithTimeout(`${this.baseUrl}/${url}`, {
                method: 'POST',
                headers,
                credentials: "omit",
                body: JSON.stringify(data),
            });
            return await this.handleResponse(response);
        } catch (error) {
            if (error instanceof ApiError || error instanceof NetworkError) {
                throw error;
            }
            throw new NetworkError('Error al realizar la solicitud', error);
        }
    }

    public async put(url: string, data: any) {
        try {
            const headers = await this.getAuthHeaders();
            const response = await this.fetchWithTimeout(`${this.baseUrl}/${url}`, {
                method: 'PUT',
                headers,
                credentials: "omit",
                body: JSON.stringify(data),
            });
            return await this.handleResponse(response);
        } catch (error) {
            if (error instanceof ApiError || error instanceof NetworkError) {
                throw error;
            }
            throw new NetworkError('Error al realizar la solicitud', error);
        }
    }

    public async postFormData(url: string, formData: FormData) {
        try {
            const { authClient } = await import('@/lib/auth-client');
            const cookies = authClient.getCookie();

            const headers: HeadersInit = {};
            if (cookies) {
                headers['Cookie'] = cookies;
            }

            const response = await this.fetchWithTimeout(`${this.baseUrl}/${url}`, {
                method: 'POST',
                headers,
                credentials: "omit",
                body: formData,
            });
            return await this.handleResponse(response);
        } catch (error) {
            if (error instanceof ApiError || error instanceof NetworkError) {
                throw error;
            }
            throw new NetworkError('Error al realizar la solicitud', error);
        }
    }

    public async validateQR(qrData: string) {
        return this.post('attendance/qr/validate', { qr_data: qrData }) as Promise<{ data: { location_id: string, organization_id: string } }>;
    }

    public async validateVisitorQR(qrData: string) {
        const response = await this.post('visitors/qr/validate', { qr_data: qrData }) as { data: any; message: string };
        const visitorData = response.data;
        
        // Map snake_case to camelCase if needed
        const mappedData = {
            id: visitorData.id,
            organizationId: visitorData.organization_id || visitorData.organizationId,
            name: visitorData.name,
            accessAreas: visitorData.access_areas || visitorData.accessAreas || [],
            entryDate: visitorData.entry_date || visitorData.entryDate,
            exitDate: visitorData.exit_date || visitorData.exitDate,
            status: visitorData.status,
            approvedByUserId: visitorData.approved_by_user_id || visitorData.approvedByUserId,
            approvedAt: visitorData.approved_at || visitorData.approvedAt,
            createdByUserId: visitorData.created_by_user_id || visitorData.createdByUserId,
            qrToken: visitorData.qr_token || visitorData.qrToken,
            qrUrl: visitorData.qr_url || visitorData.qrUrl,
            createdAt: visitorData.created_at || visitorData.createdAt,
            updatedAt: visitorData.updated_at || visitorData.updatedAt,
        };

        return {
            data: mappedData,
            message: response.message
        } as {
            data: {
                id: string;
                organizationId: string;
                name: string;
                accessAreas: string[];
                entryDate: string;
                exitDate: string;
                status: 'pending' | 'approved' | 'rejected' | 'cancelled';
                approvedByUserId?: string | null;
                approvedAt?: string | null;
                createdByUserId: string;
                qrToken: string;
                qrUrl?: string | null;
                createdAt: string;
                updatedAt: string;
            };
            message: string;
        };
    }

    public async getVisitor(id: string) {
        const response = await this.get(`visitors/${id}`) as { data: any; message: string };
        const visitorData = response.data;
        
        console.log('getVisitor raw data:', JSON.stringify(visitorData, null, 2));

        // Map snake_case to camelCase if needed
        const mappedData = {
            id: visitorData.id,
            organizationId: visitorData.organization_id || visitorData.organizationId,
            name: visitorData.name,
            accessAreas: visitorData.access_areas || visitorData.accessAreas || [],
            entryDate: visitorData.entry_date || visitorData.entryDate,
            exitDate: visitorData.exit_date || visitorData.exitDate,
            status: visitorData.status,
            approvedByUserId: visitorData.approved_by_user_id || visitorData.approvedByUserId,
            approvedAt: visitorData.approved_at || visitorData.approvedAt,
            createdByUserId: visitorData.created_by_user_id || visitorData.createdByUserId,
            qrToken: visitorData.qr_token || visitorData.qrToken,
            qrUrl: visitorData.qr_url || visitorData.qrUrl,
            createdAt: visitorData.created_at || visitorData.createdAt,
            updatedAt: visitorData.updated_at || visitorData.updatedAt,
        };

        return {
            data: mappedData,
            message: response.message
        } as {
            data: {
                id: string;
                organizationId: string;
                name: string;
                accessAreas: string[];
                entryDate: string;
                exitDate: string;
                status: 'pending' | 'approved' | 'rejected' | 'cancelled';
                approvedByUserId?: string | null;
                approvedAt?: string | null;
                createdByUserId: string;
                qrToken: string;
                qrUrl?: string | null;
                createdAt: string;
                updatedAt: string;
            };
            message: string;
        };
    }

    /**
     * Record attendance check-in with multi-factor verification
     * @param data - Check-in data including organization, location, face image, and GPS coordinates
     * @returns Attendance event with verification results including liveness detection
     */
    public async checkIn(data: {
        organization_id: string;
        location_id: string;
        image: string; // base64 encoded image
        latitude: string;
        longitude: string;
    }) {
        return this.post('attendance/check-in', data) as Promise<{
            message: string;
            data: {
                id: string;
                check_in: string;
                user_id: string;
                organization_id: string;
                location_id: string;
                status: string;
                face_confidence: string;
                liveness_score: string | null; // Liveness score (0-100), null if not available
                spoof_flag: boolean; // True if potential spoof detected
                is_verified: boolean;
                is_within_geofence: boolean;
                [key: string]: any; // Allow other fields
            };
        }>;
    }

    public async watchModeCheckIn(data: {
        organization_id: string;
        location_id: string;
        image: string;
        latitude: string;
        longitude: string;
    }) {
        return this.post('attendance/watch-mode/check-in', data) as Promise<WatchModeCheckInResponse>;
    }

    /**
     * Record attendance check-out
     * @param data - Check-out data including optional event ID, face image, and GPS coordinates
     * @returns Updated attendance event with check-out time
     */
    public async checkOut(data?: {
        attendanceEventId?: string;
        image?: File | Blob;
        latitude?: string;
        longitude?: string;
    }) {
        const formData = new FormData();
        if (data?.attendanceEventId) {
            formData.append('attendance_event_id', data.attendanceEventId);
        }
        if (data?.image) {
            formData.append('image', data.image);
        }
        if (data?.latitude) {
            formData.append('latitude', data.latitude);
        }
        if (data?.longitude) {
            formData.append('longitude', data.longitude);
        }
        return this.postFormData('attendance/check-out', formData)
    }

    public async getOrganizationGeofences(
        organizationId: string,
        params?: { page?: number; pageSize?: number }
    ) {
        if (!organizationId) {
            throw new Error('organizationId is required');
        }

        const searchParams = new URLSearchParams({ id: organizationId });
        if (params?.page) {
            searchParams.set('page', params.page.toString());
        }
        if (params?.pageSize) {
            searchParams.set('pageSize', params.pageSize.toString());
        }

        return this.get(`geofence/get-by-organization?${searchParams.toString()}`) as Promise<{
            message: string;
            data: OrganizationGeofence[];
            pagination?: PaginationMetadata;
        }>;
    }

    /**
     * Register the user's biometric face data for future verification
     * @param imageUri - Local URI of the captured face image
     * @returns API response with registration status
     */
    public async registerFace(imageUri: string) {
        if (!imageUri) {
            throw new Error('No se recibió una imagen válida para registrar.');
        }

        const formData = new FormData();
        const fileName = this.getFileNameFromUri(imageUri);
        const mimeType = this.getMimeTypeFromFileName(fileName);

        formData.append('image', {
            uri: imageUri,
            name: fileName,
            type: mimeType,
        } as unknown as Blob);

        return this.postFormData('biometrics/register', formData);
    }

    /**
     * Fetch an invitation by organization and email to let users confirm it was sent
     * @param organizationId - ID provided by the manager
     * @param email - Email address tied to the current session
     */
    public async getInvitationStatus(organizationId: string, email: string) {
        if (!organizationId || !email) {
            throw new Error('Se requieren el ID de la organización y el correo para consultar la invitación.');
        }
        const query = new URLSearchParams({ email });
        return this.get(`organizations/${organizationId}/invitations/by-email?${query.toString()}`);
    }

    /**
     * Public invitation lookup that only needs the email, used before joining an organization
     * @param email - Email tied to the pending invitation
     */
    public async getPublicInvitationStatus(email: string) {
        if (!email) {
            throw new Error('Ingresa un correo válido para consultar la invitación.');
        }
        const query = new URLSearchParams({ email });
        return this.get(`organizations/invitations/status?${query.toString()}`);
    }

    private getFileNameFromUri(uri: string) {
        const segments = uri.split('/');
        const lastSegment = segments[segments.length - 1];
        if (lastSegment && lastSegment.includes('.')) {
            return lastSegment.split('?')[0];
        }
        return `face-${Date.now()}.jpg`;
    }

    private getMimeTypeFromFileName(fileName: string) {
        const extension = fileName.split('.').pop()?.toLowerCase();
        switch (extension) {
            case 'png':
                return 'image/png';
            case 'webp':
                return 'image/webp';
            case 'heic':
                return 'image/heic';
            case 'heif':
                return 'image/heif';
            case 'gif':
                return 'image/gif';
            case 'jpg':
            case 'jpeg':
            default:
                return 'image/jpeg';
        }
    }

    /**
     * Mark users as absent (Admin only)
     * @param data - User IDs, date, and optional notes
     * @returns Count of marked absences and created events
     */
    public async markAbsences(data: {
        userIds: string[];
        date: string;
        notes?: string;
    }) {
        return this.post('attendance/admin/mark-absences', {
            user_ids: data.userIds,
            date: data.date,
            notes: data.notes,
        });
    }

    /**
     * Update attendance event status (Admin only)
     * @param eventId - Attendance event ID
     * @param data - Status and optional notes
     * @returns Updated attendance event
     */
    public async updateAttendanceStatus(
        eventId: string,
        data: {
            status: 'on_time' | 'late' | 'early' | 'absent' | 'out_of_bounds';
            notes?: string;
        }
    ) {
        return this.put(`attendance/admin/update-status/${eventId}`, data);
    }

    /**
     * Generate attendance report
     * @param params - Optional filters for date range, user, and status
     * @returns Attendance report with events and summary statistics
     */
    public async getAttendanceReport(params?: {
        startDate?: string;
        endDate?: string;
        userId?: string;
        status?: string;
    }) {
        const queryParams = new URLSearchParams();
        if (params?.startDate) {
            queryParams.append('start_date', params.startDate);
        }
        if (params?.endDate) {
            queryParams.append('end_date', params.endDate);
        }
        if (params?.userId) {
            queryParams.append('user_id', params.userId);
        }
        if (params?.status) {
            queryParams.append('status', params.status);
        }
        const queryString = queryParams.toString();
        const url = queryString ? `attendance/report?${queryString}` : 'attendance/report';
        return this.get(url);
    }

    /**
     * Get today's attendance event for a user
     * Organization is automatically determined from the authenticated session context
     * @param userId - User ID to get attendance for
     * @returns Response object with status and data. Status 404 is valid (no event today).
     */
    public async getTodayAttendanceEvent(userId: string): Promise<{ status: number; data: any }> {
        try {
            const headers = await this.getAuthHeaders();
            const response = await this.fetchWithTimeout(`${this.baseUrl}/attendance/today/${userId}`, {
                headers,
                credentials: "omit",
            });
            
            // 404 is a valid state (no attendance event today)
            if (response.status === 404) {
                return { status: 404, data: null };
            }
            
            // For other non-ok responses, throw an error
            if (!response.ok) {
                const text = await response.text();
                throw new ApiError(`HTTP ${response.status}: ${text}`, response.status);
            }
            
            const data = await response.json();
            return { status: response.status, data };
        } catch (error) {
            if (error instanceof ApiError || error instanceof NetworkError) {
                throw error;
            }
            throw new NetworkError('Error al obtener el evento de asistencia', error);
        }
    }

    /**
     * Get announcements for the current user's organization
     * Organization is automatically determined from the authenticated session context
     * @returns List of announcements with pagination
     */
    public async getAnnouncements() {
        return this.get('announcements') as Promise<{
            data: Array<{
                id: string;
                title: string;
                content: string;
                priority: 'normal' | 'important' | 'urgent';
                createdAt: string;
                publishedAt: string | null;
                expiresAt: string | null;
                updatedAt: string;
                organizationId: string;
            }>;
            message: string;
            pagination: {
                page: number;
                pageSize: number;
                total: number;
                totalPages: number;
            };
        }>;
    }

    /**
     * Get permissions (leave/vacation requests) for the current user's organization
     * Organization is automatically determined from the authenticated session context
     * @param filters - Optional filters for status and userId
     * @returns List of permissions with pagination
     */
    public async getPermissions(filters?: { status?: string; userId?: string; page?: number; pageSize?: number }) {
        const queryParams = new URLSearchParams();
        if (filters?.status) {
            queryParams.append('status', filters.status);
        }
        if (filters?.userId) {
            queryParams.append('userId', filters.userId);
        }
        if (filters?.page) {
            queryParams.append('page', filters.page.toString());
        }
        if (filters?.pageSize) {
            queryParams.append('pageSize', filters.pageSize.toString());
        }
        const queryString = queryParams.toString();
        const url = queryString ? `permissions?${queryString}` : 'permissions';
        return this.get(url) as Promise<{
            data: Array<{
                id: string;
                userId: string;
                organizationId: string;
                message: string;
                documentsUrl: string[];
                startingDate: string;
                endDate: string;
                status: 'pending' | 'approved' | 'rejected';
                approvedBy: string | null;
                supervisorComment: string | null;
                createdAt: string;
                updatedAt: string;
            }>;
            message: string;
            pagination: {
                page: number;
                pageSize: number;
                total: number;
                totalPages: number;
            };
        }>;
    }

    /**
     * Get pending permissions (Admin/Owner only)
     * @param filters - Optional filters
     * @returns List of pending permissions
     */
    public async getPendingPermissions(filters?: { page?: number; pageSize?: number }) {
        const queryParams = new URLSearchParams();
        if (filters?.page) {
            queryParams.append('page', filters.page.toString());
        }
        if (filters?.pageSize) {
            queryParams.append('pageSize', filters.pageSize.toString());
        }
        const queryString = queryParams.toString();
        const url = queryString ? `permissions/pending?${queryString}` : 'permissions/pending';
        return this.get(url) as Promise<{
            data: Array<{
                id: string;
                userId: string;
                organizationId: string;
                message: string;
                documentsUrl: string[];
                startingDate: string;
                endDate: string;
                status: 'pending';
                approvedBy: string | null;
                supervisorComment: string | null;
                createdAt: string;
                updatedAt: string;
            }>;
            message: string;
            pagination: {
                page: number;
                pageSize: number;
                total: number;
                totalPages: number;
            };
        }>;
    }

    /**
     * Get a specific permission by ID
     * @param id - Permission ID
     * @returns Permission object
     */
    public async getPermission(id: string) {
        return this.get(`permissions/${id}`) as Promise<{
            data: {
                id: string;
                userId: string;
                organizationId: string;
                message: string;
                documentsUrl: string[];
                startingDate: string;
                endDate: string;
                status: 'pending' | 'approved' | 'rejected';
                approvedBy: string | null;
                supervisorComment: string | null;
                createdAt: string;
                updatedAt: string;
            };
            message: string;
        }>;
    }

    /**
     * Create a new permission request
     * @param data - Permission request data
     * @param document - Optional document file
     * @returns Created permission
     */
    public async createPermission(data: {
        starting_date: string;
        end_date: string;
        message: string;
    }, document?: { uri: string; name: string; type: string }) {
        const formData = new FormData();
        formData.append('starting_date', data.starting_date);
        formData.append('end_date', data.end_date);
        formData.append('message', data.message);
        
        if (document) {
            formData.append('document', {
                uri: document.uri,
                name: document.name,
                type: document.type,
            } as unknown as Blob);
        }

        return this.postFormData('permissions', formData) as Promise<{
            data: {
                id: string;
                userId: string;
                organizationId: string;
                message: string;
                documentsUrl: string[];
                startingDate: string;
                endDate: string;
                status: 'pending';
                approvedBy: string | null;
                supervisorComment: string | null;
                createdAt: string;
                updatedAt: string;
            };
            message: string;
        }>;
    }

    /**
     * Update own pending permission
     * @param id - Permission ID
     * @param data - Updated permission data
     * @returns Updated permission
     */
    public async updatePermission(id: string, data: {
        message?: string;
        starting_date?: string;
        end_date?: string;
    }) {
        return this.put(`permissions/${id}`, data) as Promise<{
            data: {
                id: string;
                userId: string;
                organizationId: string;
                message: string;
                documentsUrl: string[];
                startingDate: string;
                endDate: string;
                status: 'pending' | 'approved' | 'rejected';
                approvedBy: string | null;
                supervisorComment: string | null;
                createdAt: string;
                updatedAt: string;
            };
            message: string;
        }>;
    }

    /**
     * Cancel (delete) own pending permission
     * @param id - Permission ID
     * @returns Cancelled permission
     */
    public async cancelPermission(id: string) {
        const headers = await this.getAuthHeaders();
        const response = await this.fetchWithTimeout(`${this.baseUrl}/permissions/${id}`, {
            method: 'DELETE',
            headers,
            credentials: "omit",
        });
        return await this.handleResponse(response) as Promise<{
            data: {
                id: string;
                userId: string;
                organizationId: string;
                message: string;
                documentsUrl: string[];
                startingDate: string;
                endDate: string;
                status: 'pending';
                approvedBy: string | null;
                supervisorComment: string | null;
                createdAt: string;
                updatedAt: string;
            };
            message: string;
        }>;
    }

    /**
     * Approve a permission request (Admin/Owner only)
     * @param id - Permission ID
     * @param comment - Optional comment
     * @returns Approved permission
     */
    public async approvePermission(id: string, comment?: string) {
        return this.post(`permissions/${id}/approve`, { comment }) as Promise<{
            data: {
                id: string;
                userId: string;
                organizationId: string;
                message: string;
                documentsUrl: string[];
                startingDate: string;
                endDate: string;
                status: 'approved';
                approvedBy: string;
                supervisorComment: string | null;
                createdAt: string;
                updatedAt: string;
            };
            message: string;
        }>;
    }

    /**
     * Reject a permission request (Admin/Owner only)
     * @param id - Permission ID
     * @param comment - Required comment explaining rejection
     * @returns Rejected permission
     */
    public async rejectPermission(id: string, comment: string) {
        return this.post(`permissions/${id}/reject`, { comment }) as Promise<{
            data: {
                id: string;
                userId: string;
                organizationId: string;
                message: string;
                documentsUrl: string[];
                startingDate: string;
                endDate: string;
                status: 'rejected';
                approvedBy: string;
                supervisorComment: string;
                createdAt: string;
                updatedAt: string;
            };
            message: string;
        }>;
    }

    /**
     * Upload additional documents to existing permission
     * @param id - Permission ID
     * @param documents - Array of document files
     * @returns Updated permission with new documents
     */
    public async uploadPermissionDocuments(id: string, documents: Array<{ uri: string; name: string; type: string }>) {
        const formData = new FormData();
        documents.forEach((doc) => {
            formData.append('documents', {
                uri: doc.uri,
                name: doc.name,
                type: doc.type,
            } as unknown as Blob);
        });

        return this.postFormData(`permissions/${id}/documents`, formData) as Promise<{
            data: {
                id: string;
                userId: string;
                organizationId: string;
                message: string;
                documentsUrl: string[];
                startingDate: string;
                endDate: string;
                status: 'pending' | 'approved' | 'rejected';
                approvedBy: string | null;
                supervisorComment: string | null;
                createdAt: string;
                updatedAt: string;
            };
            message: string;
        }>;
    }
}

export interface PaginationMetadata {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
}

export interface OrganizationGeofence {
    id: string;
    name: string;
    type: string;
    center_latitude?: string | null;
    center_longitude?: string | null;
    radius?: number | null;
    qr_code_url?: string | null;
    active: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface WatchModeCheckInResponse {
    message: string;
    data: {
        event: {
            id: string;
            check_in: string;
            user_id: string;
            organization_id: string;
            location_id: string | null;
            shift_id: string | null;
            status: string;
            is_within_geofence: boolean;
            distance_to_geofence_m: number | null;
            face_confidence: string | null;
            liveness_score: string | null;
            spoof_flag: boolean;
            source: string;
        };
        user: {
            id: string;
            name: string;
            email: string;
            image?: string | null;
        };
        similarity: number | null;
        liveness: {
            isLive: boolean;
            livenessScore: number;
            spoofFlag: boolean;
            quality?: {
                brightness?: number;
                sharpness?: number;
            };
            reasons?: string[];
        };
    };
}

// Create and export a singleton instance
const apiClient = new Api();

export default apiClient;
export { Api };

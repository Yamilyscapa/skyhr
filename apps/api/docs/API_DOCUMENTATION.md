# SkyHR API Documentation

## Overview
The SkyHR API is built on Hono (Bun runtime). It exposes modules for health checks, authentication (via Better Auth), storage, biometrics (AWS Rekognition), organizations, geofence, QR workflows, attendance, schedules, announcements, permissions, and visitors. Base app mounts all routes at `/`.

**Architecture**: Follows Functional Programming principles with separation between controllers (HTTP handlers) and services (business logic).

- Base URL: `${BETTER_AUTH_URL || http://localhost:8080}`
- CORS: Restricted to `TRUSTED_ORIGINS` (comma-separated). Credentials enabled.
- Static files (development): `/upload/*` serves files from local `upload/` directory.

## Authentication
Authentication is handled by Better Auth with Drizzle (Postgres). The auth system mounts at `/auth/*` and includes organizations and teams.

- Session cookie: `httpOnly`, `SameSite=None`, `secure=true` (requires HTTPS in production)
- Session lifetime: 7 days, daily rolling update
- Trusted origins: from `TRUSTED_ORIGINS` or defaults for local dev
- Additional user field: `user_face_url: string[] | null`

Protected endpoints use middleware:
- `requireAuth`: Validates session and injects `user` and `session` into context
- `requireOrganization`: Validates membership and loads `member` and `organization` into context
- `requireRole(roles[])`: Enforces org role membership
- `requireEmailVerified`: Enforces verified email

Note: The `/auth/*` endpoints are provided by Better Auth’s handler and are not listed individually here.

## HTTP Conventions
- Success: JSON bodies with `message?`, `data?`. Standard HTTP codes via `successResponse`.
- Error: JSON bodies `{ error, details? }` with proper HTTP codes via `errorResponse`.

## Modules and Endpoints

### Health
Base path: `/health`

- GET `/health/`
  - Public
  - Response 200:
    ```json
    { "status": "OK", "timestamp": "ISO-8601", "version": "1.0.0", "environment": "..." }
    ```

### Auth (Better Auth)
Base path: `/auth/*`

- All methods proxy to Better Auth handler. Examples include sign-in, sign-out, organizations, invitations, sessions, etc. Refer to Better Auth docs. Base path is configured as `/auth` (not `/api/auth`).

### Storage
Base path: `/storage`

- POST `/storage/register-biometric`
  - Public in current code path (no auth middleware in router)
  - FormData fields:
    - `file`: File (image/video, validated by adapter)
  - Behavior: Uploads user face file. Uses a placeholder user `id=123`. File name: `${userId}-${faceIndex}-user-face.<ext>`
  - Responses:
    - 200: `{ message, url, fileName }`
    - 400: `No file provided` or `Maximum number of images exceeded`
    - 500: `File upload failed`
  - Notes: In production you should secure this endpoint and use actual authenticated user context.

- POST `/storage/upload-qr`
  - Public in current code path
  - FormData fields:
    - `file`: File (image)
    - `location_id`: string
  - Behavior: Uploads QR image; file name `${location_id}-0-qr-code.<ext>`
  - Responses: same shape as above

Storage backends:
- Development (default): local disk via multer adapter; file URL: `${BASE_URL}/upload/<file>`
- Production: AWS S3; requires `S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- Max upload size (multer config): 50MB; Allowed types: images (jpeg/jpg/png/gif/webp) and videos (mp4/mpeg/quicktime/avi)

### Biometrics
Base path: `/biometrics`

Public utilities:
- POST `/biometrics/compare-faces`
  - FormData: `sourceImage` File, `targetImage` File
  - Response: `{ message, data: { isMatch, similarity, confidence } }`

- POST `/biometrics/detect-faces`
  - FormData: `image` File
  - Response: `{ message, data: { faceCount, faces: [...] } }`

- GET `/biometrics/test-connection`
  - Response: `{ message, data: { connected: boolean } }`

Admin/system (auth required):
- POST `/biometrics/index-face`
  - Auth: `requireAuth`
  - FormData: `image` File, `externalImageId` string
  - Response: `{ message, data: { faceId, faceRecords, success } }`

- POST `/biometrics/search-faces`
  - Auth: `requireAuth`
  - FormData: `image` File
  - Response: `{ message, data: FaceMatches[] }`

Organization specific (auth required; org id supplied manually):
- POST `/biometrics/organization/index-face`
  - Auth: `requireAuth`
  - FormData: `image` File, `externalImageId` string, `organizationId` string
  - Response: `{ message, data: { faceId, success } }`

- POST `/biometrics/organization/search-faces`
  - Auth: `requireAuth`
  - FormData: `image` File, `organizationId` string
  - Response: `{ message, data: FaceMatches[] }`

User-level (auth + active organization context):
- POST `/biometrics/register`
  - Auth: `requireAuth`, `requireOrganization`
  - FormData: `image` File
  - Behavior: Indexes the face into the user's organization collection (ensuring collection exists) with `externalImageId = user.id`.
  - Response: `{ message, data: { success, faceId, collectionId } }`

- POST `/biometrics/search`
  - Auth: `requireAuth`, `requireOrganization`
  - FormData: `image` File
  - Behavior: Searches within the user's organization collection.
  - Response: `{ message, data: { matches: FaceMatches[] } }`

Rekognition configuration:
- `similarityThreshold`: 80
- `faceDetectionConfidence`: 90
- `maxFaces`: 10
- `qualityFilter`: AUTO
- Default `collectionId`: `REKOGNITION_COLLECTION_ID` or `skyhr-faces`
- Required env: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`

### Organizations
Base path: `/organizations`

- POST `/organizations/webhook/created`
  - Public webhook
  - JSON: `{ organizationId }`
  - Behavior: Creates Rekognition collection for organization and persists `rekognition_collection_id`.

- POST `/organizations/webhook/deleted`
  - Public webhook
  - JSON: `{ organizationId }`
  - Behavior: Deletes Rekognition collection and clears it from DB.

- GET `/organizations/:organizationId`
  - Public in current code path (no auth middleware)
  - Response: `{ message, data: OrganizationWithCollection | null }`

- POST `/organizations/:organizationId/ensure-collection`
  - Public in current code path
  - Behavior: Ensures Rekognition collection exists (creates if missing) and persists id in DB.

- GET `/organizations/:organizationId/settings`
  - Auth: `requireAuth`, `requireOrganization`
  - Response: `{ message, data: OrganizationSettings }`
  - Behavior: Retrieves organization settings (grace_period_minutes, extra_hour_cost, timezone). Creates default settings if they don't exist.

- PUT `/organizations/:organizationId/settings`
  - Auth: `requireAuth`, `requireOrganization`
  - JSON: `{ grace_period_minutes?: number (0-60), extra_hour_cost?: number (>= 0), timezone?: string }`
  - Response: `{ message, data: OrganizationSettings }`
  - Behavior: Updates organization settings. Validates grace_period_minutes is between 0 and 60 and extra_hour_cost is >= 0.

Notes: In production, consider securing organization endpoints and authenticating webhook origin.

### Geofence
Base path: `/geofence`

The Geofence module manages location-based attendance zones for organizations. Each geofence is associated with an organization and can have QR codes for check-in.

- POST `/geofence/create`
  - Auth: `requireAuth`, `requireOrganization`
  - JSON: `{ name: string, center_latitude: string, center_longitude: string, radius: number, organization_id: string }`
  - Behavior:
    - Creates a circular geofence location
    - Automatically generates an obfuscated QR code for the location
    - Uploads QR code image to storage
    - Returns geofence with `qr_code_url`
  - Response 200: `{ message: "Geofence created successfully", data: GeofenceObject }`
  - Note: Only circular geofences are currently supported

- POST `/geofence/get`
  - Auth: `requireAuth`, `requireOrganization`
  - JSON: `{ id: string }`
  - Response 200: `{ message: "Geofence found", data: GeofenceObject }`

- GET `/geofence/get-by-organization`
  - Auth: `requireAuth`, `requireOrganization`
  - Query: `?id=<organization_id>`
  - Response 200: `{ message: "Geofences found", data: GeofenceObject[] }`

- POST `/geofence/is-in`
  - Auth: `requireAuth`, `requireOrganization`
  - JSON: `{ latitude: string, longitude: string, geofence_id: string }`
  - Behavior: Calculates distance using Haversine formula to determine if user is within geofence radius
  - Response 200: `{ message: "User is in geofence", data: { isInGeofence: boolean } }`

Geofence Object:
```json
{
  "id": "uuid",
  "name": "string",
  "type": "circular",
  "center_latitude": "string",
  "center_longitude": "string",
  "radius": "number (meters)",
  "organization_id": "string",
  "qr_code_url": "string | null",
  "active": "boolean",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

QR Code Integration:
- QR codes are automatically generated during geofence creation using the `createObfuscatedQrCode` utility
- QR payload contains: `{ organization_id, location_id }`
- QR codes are obfuscated using hex encoding with secret suffix
- `QR_SECRET` base64-encoded preferred. Fallback: literal value. Default: `skyhr-secret-2024`
- File naming pattern: `${location_id}-0-location.png`

### User-Geofence Management
Base path: `/user-geofence`

The User-Geofence module manages assignments between users and geofences, allowing organizations to control which users can check in at specific locations.

- POST `/user-geofence/assign`
  - Auth: `requireAuth`, `requireOrganization`
  - JSON: 
    ```json
    {
      "user_id": "string (required)",
      "geofence_ids": "string[] (optional if assign_all is true)",
      "assign_all": "boolean (optional)"
    }
    ```
  - Behavior:
    - If `assign_all: true`, assigns user to all geofences in the organization
    - Otherwise, assigns user to specified geofence_ids
    - Skips if assignment already exists
  - Response 200:
    ```json
    {
      "message": "User assigned to geofences",
      "data": {
        "new_assignments": "number",
        "existing_assignments": "number",
        "total_geofences": "number"
      }
    }
    ```

- POST `/user-geofence/remove`
  - Auth: `requireAuth`, `requireOrganization`
  - JSON: `{ user_id: string, geofence_id: string }`
  - Response 200: `{ message: "Geofence removed from user", data: { removed: boolean } }`

- POST `/user-geofence/remove-all`
  - Auth: `requireAuth`, `requireOrganization`
  - JSON: `{ user_id: string }`
  - Response 200: `{ message: "All geofences removed from user", data: { removed_count: number } }`

- GET `/user-geofence/user-geofences`
  - Auth: `requireAuth`, `requireOrganization`
  - Query: `?user_id=<user_id>`
  - Response 200: `{ message: "Geofences found", data: GeofenceObject[] }`

- GET `/user-geofence/geofence-users`
  - Auth: `requireAuth`, `requireOrganization`
  - Query: `?geofence_id=<geofence_id>`
  - Response 200: `{ message: "Users found", data: UserObject[] }`

- POST `/user-geofence/check-access`
  - Auth: `requireAuth`, `requireOrganization`
  - JSON: `{ user_id: string, geofence_id: string }`
  - Response 200: `{ message: "Access check complete", data: { has_access: boolean } }`

### Schedules
Base path: `/schedules`

The Schedules module manages shift definitions and user shift assignments for organizations.

**Shift Management** (Admin operations):
- POST `/schedules/shifts/create`
  - Auth: `requireAuth`, `requireOrganization`
  - JSON:
    ```json
    {
      "name": "string (required)",
      "start_time": "string (required, HH:MM:SS or HH:MM)",
      "end_time": "string (required, HH:MM:SS or HH:MM)",
      "days_of_week": "string[] (required, e.g. ['monday', 'tuesday'])",
      "break_minutes": "number (optional, default: 0)",
      "color": "string (optional, hex color)",
      "active": "boolean (optional, default: true)"
    }
    ```
  - Response 200: `{ message: "Shift created", data: ShiftObject }`
  - Response 400: Invalid time format or missing required fields

- GET `/schedules/shifts`
  - Auth: `requireAuth`, `requireOrganization`
  - Response 200: `{ message: "Shifts found", data: ShiftObject[] }`

- PUT `/schedules/shifts/:id`
  - Auth: `requireAuth`, `requireOrganization`
  - JSON: Same fields as create (all optional except those being updated)
  - Response 200: `{ message: "Shift updated", data: ShiftObject }`
  - Response 404: Shift not found

**Shift Assignment**:
- POST `/schedules/assign`
  - Auth: `requireAuth`, `requireOrganization`
  - JSON:
    ```json
    {
      "user_id": "string (required)",
      "shift_id": "string (required, uuid)",
      "effective_from": "string (required, ISO timestamp)",
      "effective_until": "string (optional, ISO timestamp, null = indefinite)"
    }
    ```
  - Response 200: `{ message: "Shift assigned", data: UserScheduleObject }`
  - Response 400: Invalid dates or shift not found

**User Schedule Retrieval**:
- GET `/schedules/user/:userId`
  - Auth: `requireAuth`, `requireOrganization`
  - Query Parameters:
    - `start_date`: string (optional) - Filter from date
    - `end_date`: string (optional) - Filter to date
  - Response 200:
    ```json
    {
      "message": "Schedule found",
      "data": {
        "user_id": "string",
        "schedules": "UserScheduleObject[]",
        "current_shift": "ShiftObject | null"
      }
    }
    ```

Shift Object:
```json
{
  "id": "uuid",
  "name": "string",
  "start_time": "string (HH:MM:SS)",
  "end_time": "string (HH:MM:SS)",
  "break_minutes": "number",
  "days_of_week": "string[]",
  "color": "string | null",
  "active": "boolean",
  "organization_id": "string",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

User Schedule Object:
```json
{
  "id": "uuid",
  "user_id": "string",
  "shift_id": "string (uuid)",
  "organization_id": "string",
  "effective_from": "timestamp",
  "effective_until": "timestamp | null",
  "created_at": "timestamp",
  "shift": "ShiftObject"
}
```

### Statistics
Base path: `/statistics`

The Statistics module provides comprehensive attendance analytics and reporting capabilities. All endpoints require Admin or Owner role.

**Authentication**: All endpoints require `requireAuth`, `requireOrganization`, and `requireRole(['admin', 'owner'])`

**For detailed documentation, see**: [Statistics Module Documentation](./STATISTICS_MODULE.md)

**Quick Reference**:
- GET `/statistics/dashboard` - Real-time dashboard with key indicators
- GET `/statistics/attendance` - Detailed attendance metrics
- GET `/statistics/costs` - Cost analysis (absenteeism, overtime)
- GET `/statistics/locations` - Location comparison and rankings
- GET `/statistics/trends` - Historical trends (last 3 months)
- GET `/statistics/user/:userId` - Per-user statistics by ID
- GET `/statistics/user/by-email` - Per-user statistics by email

**Query Parameters** (common to most endpoints):
- `period`: `'daily' | 'weekly' | 'monthly' | 'quarterly'` (default: `'monthly'`)
- `start_date`: ISO date string (optional)
- `end_date`: ISO date string (optional)
- `location_id`: UUID (optional, for location-specific stats)

**Response Format**:
```json
{
  "message": "string",
  "data": {
    // Endpoint-specific data
  }
}
```

**Error Responses**:
- 401: Unauthorized (no session)
- 403: Forbidden (not admin/owner)
- 404: Not found (user/location not found)
- 400: Bad request (invalid parameters)

### Attendance
Base path: `/attendance`

The Attendance module manages employee check-in with multi-factor verification (QR code + biometric + optional geolocation).

**Architecture**: Separated into controller (HTTP handlers) and service (business logic) following functional programming patterns.

- POST `/attendance/qr/validate`
  - Auth: `requireAuth`, `requireOrganization`
  - JSON: `{ qr_data: string }`
  - Behavior: 
    - Deobfuscates QR payload using secret
    - Validates payload matches user's active organization
    - Verifies geofence exists and is active
  - Response 200: `{ message: "QR valid", data: { location_id, organization_id } }`
  - Response 400: Invalid or malformed QR
  - Response 403: QR doesn't belong to organization or location inactive

- POST `/attendance/check-in`
  - Auth: `requireAuth`, `requireOrganization`
  - FormData: 
    - `qr_data`: string (required) - Obfuscated QR code data
    - `image`: File (required) - User's face image for biometric verification
    - `latitude`: string (optional) - GPS latitude
    - `longitude`: string (optional) - GPS longitude
  - Behavior (3-step verification):
    1. **QR Validation**: Validates QR belongs to user's active organization and geofence is active
    2. **Biometric Verification**: Searches face in organization's AWS Rekognition collection, compares `ExternalImageId` against `user.id`
    3. **Record Creation**: Creates `attendance_event` with all metadata (timestamp, geolocation, face confidence, verification status)
  - Response 200: 
    ```json
    {
      "message": "Attendance recorded",
      "data": {
        "id": "uuid",
        "check_in": "timestamp",
        "user_id": "string",
        "organization_id": "string",
        "face_confidence": "string (similarity score)",
        "is_verified": "boolean"
      }
    }
    ```
  - Response 400: Missing qr_data or image
  - Response 403: QR mismatch, location inactive, or face doesn't match user
  - Response 500: Failed to create attendance record

- POST `/attendance/check-out`
  - Auth: `requireAuth`, `requireOrganization`
  - FormData:
    - `latitude`: string (required) - GPS latitude
    - `longitude`: string (required) - GPS longitude
  - Behavior:
    - Automatically finds the most recent attendance event without check-out for the user
    - Updates the attendance_event with check_out timestamp
    - Calculates work duration in minutes
  - Response 200:
    ```json
    {
      "message": "Check-out recorded",
      "data": {
        "id": "uuid",
        "check_in": "timestamp",
        "check_out": "timestamp",
        "user_id": "string",
        "organization_id": "string"
      }
    }
    ```
  - Response 400: No active check-in found
  - Response 404: Attendance event not found (if event_id provided)

- GET `/attendance/events`
  - Auth: `requireAuth`, `requireOrganization`
  - Query Parameters:
    - `user_id`: string (optional) - Filter by specific user. If omitted, returns all events for the organization
    - `start_date`: string (optional) - ISO date format (YYYY-MM-DD) - Filter events from this date
    - `end_date`: string (optional) - ISO date format (YYYY-MM-DD) - Filter events until this date
    - `status`: string (optional) - Filter by status: "on_time", "late", "early", "absent", "out_of_bounds"
  - Behavior: 
    - Retrieves all attendance events for the organization with optional filtering
    - Results are ordered by check-in time (most recent first)
    - Returns complete event details including biometric data, geolocation, and verification status
  - Response 200:
    ```json
    {
      "message": "Attendance events retrieved successfully",
      "data": {
        "total": "number",
        "events": [
          {
            "id": "uuid",
            "user_id": "string",
            "organization_id": "string",
            "check_in": "timestamp",
            "check_out": "timestamp | null",
            "status": "string",
            "is_verified": "boolean",
            "is_within_geofence": "boolean",
            "distance_to_geofence_m": "number | null",
            "latitude": "string | null",
            "longitude": "string | null",
            "source": "string",
            "face_confidence": "string | null",
            "liveness_score": "string | null",
            "spoof_flag": "boolean",
            "shift_id": "uuid | null",
            "notes": "string | null",
            "created_at": "timestamp",
            "updated_at": "timestamp"
          }
        ]
      }
    }
    ```
  - Response 401: Organization required
  - Response 500: Failed to retrieve attendance events

- POST `/attendance/admin/mark-absences`
  - Auth: `requireAuth`, `requireOrganization` (should also require admin role)
  - JSON:
    - `user_ids`: string[] (required) - Array of user IDs to mark as absent
    - `date`: string (required) - Date in ISO format (YYYY-MM-DD)
    - `notes`: string (optional) - Reason or notes for absence
  - Behavior: Creates attendance events with status "absent" for specified users on the given date
  - Response 200: `{ message, data: { marked_count, events: [...] } }`

- PUT `/attendance/admin/update-status/:eventId`
  - Auth: `requireAuth`, `requireOrganization` (should also require admin role)
  - JSON:
    - `status`: string (required) - New status: "on_time", "late", "early", "absent", "out_of_bounds"
    - `notes`: string (optional) - Admin notes
  - Response 200: `{ message, data: AttendanceEvent }`
  - Response 404: Event not found

- GET `/attendance/report`
  - Auth: `requireAuth`, `requireOrganization`
  - Query Parameters:
    - `start_date`: string (optional) - ISO date format
    - `end_date`: string (optional) - ISO date format
    - `user_id`: string (optional) - Filter by specific user
    - `status`: string (optional) - Filter by status
  - Response 200:
    ```json
    {
      "message": "Report generated",
      "data": {
        "total_records": "number",
        "events": "AttendanceEvent[]",
        "summary": {
          "on_time": "number",
          "late": "number",
          "absent": "number",
          "early": "number"
        }
      }
    }
    ```

Service Functions:
- `getQrSecret()`: Retrieves and decodes QR secret from environment
- `parseQrPayload(qrData)`: Deobfuscates QR data to extract organization and location IDs
- `findActiveGeofence(locationId, orgId)`: Queries for active geofence
- `createAttendanceEvent(args)`: Inserts attendance record with all metadata

### Permissions (Leave/Vacation Requests)
Base path: `/permissions`

The Permissions module manages employee leave and vacation requests with supervisor approval workflow. Employees can submit requests with dates, reason, and supporting documents. Admin/Owner roles can approve, reject, and add comments.

- POST `/permissions`
  - Auth: `requireAuth`, `requireOrganization`
  - FormData or JSON:
    - `starting_date`: string (required) - ISO timestamp for start of leave
    - `end_date`: string (required) - ISO timestamp for end of leave
    - `message`: string (required) - Reason/motive for the request
    - `document`: File (optional) - Single supporting document (PDF, JPEG, PNG, max 10MB)
  - Behavior:
    - Creates a new permission request with status "pending"
    - Validates that end_date > starting_date
    - If document provided, uploads it and links to permission
    - Automatically sets user_id and organization_id from context
  - Response 201:
    ```json
    {
      "message": "Permission created successfully",
      "data": {
        "id": "uuid",
        "userId": "string",
        "organizationId": "string",
        "message": "string",
        "documentsUrl": ["string"],
        "startingDate": "timestamp",
        "endDate": "timestamp",
        "status": "pending",
        "approvedBy": null,
        "supervisorComment": null,
        "createdAt": "timestamp",
        "updatedAt": "timestamp"
      }
    }
    ```
  - Response 400: Invalid dates, missing required fields, or invalid file type/size

- GET `/permissions`
  - Auth: `requireAuth`, `requireOrganization`
  - Query Parameters:
    - `status`: string (optional) - Filter by status: "pending", "approved", "rejected"
    - `userId`: string (optional) - Filter by user ID (admin/owner only)
    - `page`: number (optional) - Page number for pagination
    - `pageSize`: number (optional) - Items per page (max 100)
  - Behavior:
    - Employees see only their own permissions
    - Admin/Owner see all permissions in organization
    - Results ordered by creation date (newest first)
  - Response 200:
    ```json
    {
      "message": "Permissions retrieved successfully",
      "data": [
        {
          "id": "uuid",
          "userId": "string",
          "organizationId": "string",
          "message": "string",
          "documentsUrl": ["string"],
          "startingDate": "timestamp",
          "endDate": "timestamp",
          "status": "pending" | "approved" | "rejected",
          "approvedBy": "string | null",
          "supervisorComment": "string | null",
          "createdAt": "timestamp",
          "updatedAt": "timestamp"
        }
      ],
      "pagination": {
        "page": 1,
        "pageSize": 20,
        "total": 50,
        "totalPages": 3
      }
    }
    ```

- GET `/permissions/pending`
  - Auth: `requireAuth`, `requireOrganization`, `requireRole(["admin", "owner"])`
  - Query Parameters:
    - `page`: number (optional) - Page number for pagination
    - `pageSize`: number (optional) - Items per page (max 100)
  - Behavior: Returns all pending permission requests for the organization
  - Response 200: Same format as GET `/permissions` but filtered to status="pending"

- GET `/permissions/:id`
  - Auth: `requireAuth`, `requireOrganization`
  - Behavior:
    - Employees can view their own permissions
    - Admin/Owner can view any permission in organization
  - Response 200: Single permission object (same format as list item)
  - Response 404: Permission not found or access denied

- PUT `/permissions/:id`
  - Auth: `requireAuth`, `requireOrganization`
  - JSON:
    - `message`: string (optional) - Updated reason
    - `starting_date`: string (optional) - Updated start date
    - `end_date`: string (optional) - Updated end date
  - Behavior:
    - Only pending permissions can be modified
    - Only the owner of the permission or admin/owner can modify
    - Validates date constraints
  - Response 200: Updated permission object
  - Response 403: Cannot modify non-pending permission or not owner
  - Response 404: Permission not found

- DELETE `/permissions/:id`
  - Auth: `requireAuth`, `requireOrganization`
  - Behavior:
    - Soft deletes (sets deleted_at) the permission
    - Only pending permissions can be cancelled
    - Only the owner or admin/owner can cancel
  - Response 200: Cancelled permission object
  - Response 403: Cannot cancel non-pending permission
  - Response 404: Permission not found

- POST `/permissions/:id/approve`
  - Auth: `requireAuth`, `requireOrganization`, `requireRole(["admin", "owner"])`
  - JSON:
    - `comment`: string (optional) - Optional comment from supervisor
  - Behavior:
    - Changes status from "pending" to "approved"
    - Sets approved_by to current user
    - Only pending permissions can be approved
  - Response 200: Approved permission object
  - Response 400: Permission is not pending
  - Response 404: Permission not found

- POST `/permissions/:id/reject`
  - Auth: `requireAuth`, `requireOrganization`, `requireRole(["admin", "owner"])`
  - JSON:
    - `comment`: string (required) - Rejection reason/comment
  - Behavior:
    - Changes status from "pending" to "rejected"
    - Sets approved_by to current user
    - Sets supervisor_comment to provided comment
    - Only pending permissions can be rejected
  - Response 200: Rejected permission object
  - Response 400: Permission is not pending or comment missing
  - Response 404: Permission not found

- POST `/permissions/:id/documents`
  - Auth: `requireAuth`, `requireOrganization`
  - FormData:
    - `documents`: File[] (required) - One or more supporting documents (PDF, JPEG, PNG, max 10MB each)
  - Behavior:
    - Adds additional documents to existing permission
    - Only pending permissions can have documents added
    - Only the owner or admin/owner can add documents
  - Response 200: Updated permission object with new documents
  - Response 400: Invalid file type/size or permission not pending
  - Response 403: Cannot add documents to this permission
  - Response 404: Permission not found

**File Upload Constraints:**
- Allowed types: `application/pdf`, `image/png`, `image/jpeg`, `image/jpg`
- Max file size: 10MB per file
- Single document allowed during creation
- Multiple documents can be added later via `/documents` endpoint

**Status Workflow:**
- `pending` → Can be modified, cancelled, approved, or rejected
- `approved` → Final state, cannot be modified
- `rejected` → Final state, cannot be modified

**Authorization Rules:**
- Employees (member role): Can create, view own, modify own pending, cancel own pending
- Admin/Owner: Can view all, approve/reject any, add documents to any pending

### Visitors
Base path: `/visitors`

The Visitors module manages visitor access requests for organizations. Employees can create visitor requests with access areas and entry/exit dates. Admin/Owner roles can approve or reject visitor requests.

- POST `/visitors`
  - Auth: `requireAuth`, `requireOrganization`
  - JSON:
    ```json
    {
      "name": "string (required)",
      "accessAreas": "string[] (required, unique, non-empty)",
      "entryDate": "string (required, ISO timestamp)",
      "exitDate": "string (required, ISO timestamp)",
      "approveNow": "boolean (optional, default: false)"
    }
    ```
  - Behavior:
    - Creates a new visitor request with status "pending"
    - Validates that entryDate <= exitDate
    - If `approveNow` is true and user is admin/owner, automatically approves the visitor
    - Generates a unique QR token for the visitor
    - Normalizes accessAreas to lowercase and trims whitespace
    - Validates accessAreas array is unique (no duplicates)
  - Response 201:
    ```json
    {
      "message": "Visitor created",
      "data": {
        "id": "uuid",
        "organization_id": "string",
        "name": "string",
        "access_areas": ["string"],
        "entry_date": "timestamp",
        "exit_date": "timestamp",
        "status": "pending" | "approved",
        "approved_by_user_id": "string | null",
        "approved_at": "timestamp | null",
        "created_by_user_id": "string",
        "qr_token": "string",
        "created_at": "timestamp",
        "updated_at": "timestamp"
      }
    }
    ```
  - Response 400: Missing required fields, invalid dates, duplicate accessAreas, or entryDate > exitDate

- GET `/visitors`
  - Auth: `requireAuth`, `requireOrganization`
  - Query Parameters:
    - `status`: string (optional) - Filter by status: "pending", "approved", "rejected", "cancelled"
    - `q`: string (optional) - Search query (searches name and access_areas)
    - `page`: number (optional, default: 1) - Page number for pagination
    - `pageSize`: number (optional, default: 20, max: 50) - Items per page
  - Behavior:
    - Returns all visitors for the organization
    - Results ordered by entry_date ascending
    - Supports text search across name and access_areas fields
  - Response 200:
    ```json
    {
      "message": "Visitors retrieved",
      "data": [
        {
          "id": "uuid",
          "organization_id": "string",
          "name": "string",
          "access_areas": ["string"],
          "entry_date": "timestamp",
          "exit_date": "timestamp",
          "status": "pending" | "approved" | "rejected" | "cancelled",
          "approved_by_user_id": "string | null",
          "approved_at": "timestamp | null",
          "created_by_user_id": "string",
          "qr_token": "string",
          "created_at": "timestamp",
          "updated_at": "timestamp"
        }
      ],
      "meta": {
        "page": 1,
        "pageSize": 20,
        "total": 50
      }
    }
    ```

- GET `/visitors/:id`
  - Auth: `requireAuth`, `requireOrganization`
  - Response 200: Single visitor object (same format as list item)
  - Response 404: Visitor not found

- PUT `/visitors/:id`
  - Auth: `requireAuth`, `requireOrganization`
  - JSON:
    ```json
    {
      "name": "string (optional)",
      "accessAreas": "string[] (optional, unique, non-empty)",
      "entryDate": "string (optional, ISO timestamp)",
      "exitDate": "string (optional, ISO timestamp)"
    }
    ```
  - Behavior:
    - Only the creator or admin/owner can update
    - Cannot update cancelled visitors
    - Validates entryDate <= exitDate if both provided
    - Normalizes accessAreas to lowercase and trims whitespace
  - Response 200: Updated visitor object
  - Response 400: Invalid dates or duplicate accessAreas
  - Response 403: Not authorized to update this visitor
  - Response 404: Visitor not found

- POST `/visitors/:id/approve`
  - Auth: `requireAuth`, `requireOrganization`, `requireRole(["owner", "admin"])`
  - Behavior:
    - Changes status from "pending" to "approved"
    - Sets approved_by_user_id to current user
    - Sets approved_at to current timestamp
    - If already approved, returns existing record
  - Response 200: Approved visitor object
  - Response 404: Visitor not found

- POST `/visitors/:id/reject`
  - Auth: `requireAuth`, `requireOrganization`, `requireRole(["owner", "admin"])`
  - Behavior:
    - Changes status to "rejected"
    - Clears approved_by_user_id and approved_at
  - Response 200: Rejected visitor object
  - Response 404: Visitor not found

- POST `/visitors/:id/cancel`
  - Auth: `requireAuth`, `requireOrganization`
  - Behavior:
    - Only the creator or admin/owner can cancel
    - Changes status to "cancelled"
    - If already cancelled, returns existing record
  - Response 200: Cancelled visitor object
  - Response 403: Not authorized to cancel this visitor
  - Response 404: Visitor not found

Visitor Object:
```json
{
  "id": "uuid",
  "organization_id": "string",
  "name": "string",
  "access_areas": ["string"],
  "entry_date": "timestamp",
  "exit_date": "timestamp",
  "status": "pending" | "approved" | "rejected" | "cancelled",
  "approved_by_user_id": "string | null",
  "approved_at": "timestamp | null",
  "created_by_user_id": "string",
  "qr_token": "string (unique)",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

**Status Workflow:**
- `pending` → Can be modified, cancelled, approved, or rejected
- `approved` → Final state, cannot be modified
- `rejected` → Final state, cannot be modified
- `cancelled` → Final state, cannot be modified

**Authorization Rules:**
- Any authenticated member: Can create visitors, view all visitors in organization
- Creator or Admin/Owner: Can update pending visitors
- Admin/Owner: Can approve or reject any visitor
- Creator or Admin/Owner: Can cancel visitors

## Data Model Highlights

### Core Tables
- **`users`**: Better Auth users with custom fields
  - `user_face_url: text[]` - Array of stored face image URLs/keys
  - `deleted_at` - Soft delete timestamp

- **`sessions`**: Better Auth sessions with organization context
  - `activeOrganizationId` - Current active organization for multi-org users

- **`organization`**: Organizations with business and biometric features
  - `rekognition_collection_id: text` - AWS Rekognition collection ID (unique per org)
  - `subscription_id: uuid` - Links to subscription plan
  - `is_active: boolean` - Organization status

- **`subscription`**: Business subscription plans
  - `max_users: integer` - User limit for plan
  - `is_active: boolean` - Subscription status

- **`member`**: Organization membership (Better Auth)
  - `role: text` - "owner", "admin", or "member"
  - Cascade deletes with organization and user

- **`team`**: Sub-organization teams
  - `team_member` - Junction table for team membership

- **`geofence`**: Location-based zones for attendance
  - `type: text` - Currently only "circular" supported
  - `center_latitude/center_longitude: text` - Precise coordinates
  - `radius: integer` - Radius in meters
  - `qr_code_url: text` - Generated QR code image URL
  - `active: boolean` - Enable/disable without deleting
  - `organization_id` - Org-scoped

- **`attendance_event`**: Attendance check-in and check-out records
  - `check_in: timestamp` - Check-in time (required)
  - `check_out: timestamp` - Check-out time (nullable)
  - `is_verified: boolean` - Verification status
  - `status: text` - "on_time", "late", "early", "absent", "out_of_bounds"
  - `source: text` - "qr_face", "manual", "fingerprint", etc.
  - `shift_id: uuid` - Reference to assigned shift (nullable)
  - `is_within_geofence: boolean` - Whether check-in was within geofence
  - `latitude/longitude: text` - GPS coordinates (optional)
  - `face_confidence: text` - AWS Rekognition similarity score
  - `liveness_score: text` - Anti-spoofing score (not currently used)
  - `spoof_flag: boolean` - Potential spoof detection flag
  - `distance_to_geofence_m: integer` - Distance in meters (not currently calculated)
  - `notes: text` - Admin notes or auto-generated reason
  - `organization_id` - Organization context
  - `user_id` - User who checked in/out

- **`shift`**: Shift definitions for organizations
  - `name: text` - Shift name (e.g., "Morning Shift")
  - `start_time: text` - Start time in HH:MM:SS format
  - `end_time: text` - End time in HH:MM:SS format
  - `break_minutes: integer` - Total break allowance in minutes
  - `days_of_week: text[]` - Array of day names (monday, tuesday, etc.)
  - `color: text` - Hex color for UI representation
  - `active: boolean` - Whether shift is active
  - `organization_id` - Organization context

- **`user_schedule`**: User shift assignments
  - `user_id: text` - User assigned to shift
  - `shift_id: uuid` - Shift being assigned
  - `effective_from: timestamp` - When assignment starts
  - `effective_until: timestamp` - When assignment ends (null = indefinite)
  - `organization_id` - Organization context

- **`user_geofence`**: Junction table for user-geofence assignments
  - `user_id: text` - User assigned to geofence
  - `geofence_id: uuid` - Geofence being assigned
  - `organization_id` - Organization context (for data isolation)

- **`organization_settings`**: Organization-level settings
  - `grace_period_minutes: integer` - Grace period for late check-ins (default: 5)
  - `extra_hour_cost: double precision` - Reference hourly cost for overtime (default: 0)
  - `timezone: text` - Organization timezone (default: UTC)

- **`permissions`**: Leave/permission requests
  - `user_id: text` - User requesting permission
  - `organization_id: text` - Organization context
  - `message: text` - Reason/motive for the request
  - `documents_url: text[]` - Array of supporting document URLs
  - `starting_date: timestamp` - Start date of leave/vacation
  - `end_date: timestamp` - End date of leave/vacation
  - `status: permission_status` - Enum: "pending", "approved", "rejected"
  - `approved_by: text` - User ID of admin/owner who approved/rejected
  - `supervisor_comment: text` - Optional comment from supervisor
  - `created_at: timestamp` - Creation timestamp
  - `updated_at: timestamp` - Last update timestamp
  - `deleted_at: timestamp` - Soft delete timestamp

- **`visitors`**: Visitor access requests
  - `id: uuid` - Unique visitor identifier
  - `organization_id: text` - Organization context
  - `name: text` - Visitor's name
  - `access_areas: text[]` - Array of access area names (normalized to lowercase)
  - `entry_date: timestamp` - Scheduled entry date/time
  - `exit_date: timestamp` - Scheduled exit date/time
  - `status: visitor_status` - Enum: "pending", "approved", "rejected", "cancelled"
  - `approved_by_user_id: text` - User ID of admin/owner who approved
  - `approved_at: timestamp` - Approval timestamp
  - `created_by_user_id: text` - User who created the visitor request
  - `qr_token: text` - Unique QR token for visitor access
  - `created_at: timestamp` - Creation timestamp
  - `updated_at: timestamp` - Last update timestamp

- **`announcement`**: Organization announcements
  - `scope: text` - "all", "team", "department", "specific_users"
  - `category: text` - Announcement category
  - `announcement_teams` - Junction table for team-targeted announcements

### Soft Deletes
Tables with `deleted_at: timestamp` field support soft deletion:
- `users`, `geofence`, `attendance_event`, `permissions`, `announcement`

Note: `visitors` uses status-based cancellation instead of soft deletes.

## Capabilities & Features

### Authentication & Authorization
✅ **Better Auth Integration**
- Email/password authentication with session management
- Organization and team support with role-based access ("owner", "admin", "member")
- Multi-organization membership with active organization context
- Invitation system for organization onboarding
- Session lifetime: 7 days with daily rolling updates
- Secure cookies: `httpOnly`, `SameSite=None`, `Secure` (HTTPS required in production)

✅ **Middleware Protection**
- `requireAuth`: Validates session and injects user context
- `requireOrganization`: Validates org membership and loads organization
- `requireRole(roles[])`: Enforces specific roles (not fully implemented across all routes)
- `requireEmailVerified`: Email verification check (not fully implemented)

### File Storage
✅ **Dual Storage Adapters** (Strategy Pattern)
- **Development**: Local disk storage with Multer
  - Files served at `/upload/*`
  - URLs: `${BASE_URL}/upload/<filename>`
- **Production**: AWS S3 cloud storage
  - Requires: `S3_BUCKET`, `AWS_REGION`, credentials

✅ **Upload Policies**
- Max size: 50MB
- Allowed types: Images (jpeg, png, gif, webp), Videos (mp4, mpeg, quicktime, avi)
- Typed storage interface for adapter swapping

✅ **Upload Endpoints**
- User biometric face uploads (currently uses placeholder user)
- QR code image uploads for geofence locations

### Biometric Verification (AWS Rekognition)
✅ **Per-Organization Collections**
- Each organization gets unique Rekognition collection
- Collections created automatically via webhooks on org creation
- Collections deleted when organization is deleted

✅ **Face Recognition Features**
- **Compare Faces**: 1:1 face comparison with similarity score
- **Detect Faces**: Identify faces in images with confidence scores
- **Index Faces**: Add faces to collections with external IDs
- **Search Faces**: 1:N face search within collections

✅ **User-Level Integration**
- Users register their face linked to their user ID
- Face search scoped to user's organization
- Used for attendance verification

✅ **Configuration**
- Similarity threshold: 80%
- Face detection confidence: 90%
- Max faces per query: 10
- Quality filter: AUTO

### Geofence Management
✅ **Location-Based Zones**
- Create circular geofences with center point and radius
- Organization-scoped locations
- Active/inactive status without deletion
- Haversine formula for distance calculation

✅ **QR Code Generation**
- Automatic QR code creation for each geofence
- Obfuscated payload with organization and location IDs
- PNG format with error correction level M
- Stored via storage service

✅ **Geofence Validation**
- Check if user is within geofence radius
- Used for attendance location verification

### Attendance Tracking
✅ **Multi-Factor Check-In**
- **Step 1**: QR code validation (location + organization match)
- **Step 2**: Biometric verification (face recognition)
- **Step 3**: Optional GPS coordinates capture

✅ **Rich Metadata**
- Timestamp of check-in
- Verification status and source ("qr_face", etc.)
- Face confidence score from Rekognition
- GPS coordinates (latitude/longitude)
- Spoof detection flag (placeholder for future anti-spoofing)

✅ **Organization-Scoped**
- All attendance records linked to organization
- Face search only within organization collection
- QR codes validated against organization

### Organizations & Teams
✅ **Multi-Tenancy**
- Users can belong to multiple organizations
- Active organization concept in sessions
- Organization-level data isolation

✅ **Webhooks**
- Organization created → Auto-create Rekognition collection
- Organization deleted → Auto-delete Rekognition collection

✅ **Team Structure**
- Teams within organizations
- Team membership with roles
- Team-scoped announcements (schema exists, endpoints not implemented)

### Code Architecture
✅ **Functional Programming**
- Pure functions over classes
- Immutable data patterns
- Function composition
- Separated controllers (HTTP) from services (business logic)

✅ **Type Safety**
- TypeScript throughout
- Drizzle ORM with typed schema
- Interface-based storage adapters

## Limitations & Known Issues

### Security Gaps ⚠️

**1. Public Endpoints Without Auth**
- `/storage/*` - Should require auth and use real user context
  - Currently uses placeholder user `id=123`
  - No file upload quotas or rate limiting
- `/organizations/:id` - Organization details exposed publicly
- `/organizations/:id/ensure-collection` - Can manipulate org collections
- Better Auth webhooks - No signature verification
  - Risk: Attackers could trigger fake org creation/deletion

**Recommendations**:
- Add `requireAuth` and `requireOrganization` to storage endpoints
- Implement webhook signature verification (HMAC)
- Add `requireRole(["admin", "owner"])` to organization management

**2. QR Code Security**
- Obfuscation is NOT encryption (hex encoding + secret suffix)
- QR codes are reversible if secret is compromised
- No integrity check (HMAC) to detect tampering
- No expiration time on QR codes

**Recommendations**:
- Implement AES-GCM encryption for QR payloads
- Add HMAC for integrity verification
- Include expiration timestamp in QR payload
- Rotate QR_SECRET periodically

**3. Biometric Security**
- No liveness detection implemented (spoof_flag exists but not used)
- No anti-spoofing measures (photos, videos, masks)
- Face confidence threshold not enforced (relies on Rekognition default)
- No rate limiting on biometric endpoints

**Recommendations**:
- Implement AWS Rekognition Face Liveness
- Add challenge-response for liveness (random head movements)
- Enforce minimum similarity threshold (currently accepts any match)
- Add rate limiting to prevent brute-force face matching

**4. Authentication & Authorization**
- `requireEmailVerified` middleware exists but not used
- Role checks missing on sensitive endpoints
- No audit logging for privileged actions
- Session impersonation exists but not documented/secured

**Recommendations**:
- Enforce email verification on all protected routes
- Add comprehensive role-based access control
- Implement audit logging for admin actions
- Document and secure impersonation feature

### Functional Limitations 🔧

**1. Geofence Constraints**
- Only circular geofences supported (polygon schema exists but not implemented)
- No geofence overlap detection
- Distance calculation (Haversine) not used in attendance flow
- `distance_to_geofence_m` field exists but never populated
- No geofence schedules (time-based activation)

**2. Attendance Gaps**
- ✅ Check-out functionality implemented
- ✅ Shift management implemented
- Duplicate check-in prevention not implemented
- ✅ Attendance reports endpoint exists
- GPS coordinates optional but not validated against geofence
- Attendance status calculation (on_time, late, etc.) may need shift context

**3. Organization & Teams**
- ✅ Permission/leave request endpoints implemented
- Announcement endpoints not implemented (schema exists)
- No organization subscription enforcement (max_users not checked)
- Team functionality incomplete (no team-specific routes)

**4. Storage Limitations**
- 50MB upload limit (hardcoded in multer)
- No file cleanup or garbage collection
- No CDN integration
- Local storage not production-ready (no backup)
- S3 bucket must be public-read or pre-signed URLs needed

**5. Data Management**
- Soft delete implemented but no restore endpoints
- No data retention policies
- No GDPR compliance features (right to deletion, data export)
- No database migrations in production strategy documented

### Operational Concerns 🏭

**1. Scalability**
- No caching layer (Redis)
- No job queue for async tasks (org collection creation blocks request)
- Database connection pooling not configured
- No horizontal scaling considerations
- Rekognition API rate limits not handled

**2. Monitoring & Observability**
- No structured logging
- No error tracking (Sentry, etc.)
- No performance monitoring (APM)
- No health checks for dependencies (DB, S3, Rekognition)
- Console.log in production code

**3. Cost Management**
- AWS Rekognition costs uncapped (per-request pricing)
- S3 storage costs grow indefinitely
- No cleanup of unused collections
- No image optimization before upload

**4. Development Workflow**
- No automated tests
- No CI/CD pipeline documented
- No staging environment mentioned
- Environment variable management unclear
- No database seeding or fixtures

### Data Integrity Issues 🗃️

**1. Schema Inconsistencies**
- Lat/long stored as text instead of numeric types
- Face confidence as text instead of float
- JSON strings for polygon coordinates (should use PostGIS or json type)
- Mixed timestamp field names (createdAt vs created_at)

**2. Missing Constraints**
- No unique constraint on (user_id, organization_id, check_in_date) for attendance
- No check constraint on geofence radius (could be negative)
- No validation on coordinate ranges
- No foreign key on activeOrganizationId in sessions

**3. Missing Indexes**
- No index on attendance_event(user_id, check_in) for queries
- No index on geofence(organization_id, active)
- No composite indexes for common queries

### Browser & Client Concerns 🌐

**1. CORS Configuration**
- Credentials enabled with `SameSite=None` requires HTTPS
- `TRUSTED_ORIGINS` must be carefully configured
- No CORS error handling documentation

**2. File Uploads**
- No client-side validation guidance
- No upload progress tracking
- No chunked upload for large files
- Browser compatibility for File API not documented

### Error Handling 📋

**1. Generic Error Messages**
- Many endpoints return "Internal server error" without details
- Error codes not consistently used
- No error correlation IDs for debugging
- Sensitive data might leak in error logs (console.error with full objects)

**2. Missing Validation**
- Email format not validated
- Phone numbers not validated (if added)
- Weak password requirements (Better Auth defaults)
- No input sanitization documented

## Environment Variables
- Server: `PORT` (default 8080), `TRUSTED_ORIGINS`, `NODE_ENV`
- Auth: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`
- Storage (local): `BASE_URL` for building file URLs
- Storage (S3): `S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- Rekognition: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `REKOGNITION_COLLECTION_ID`
- QR: `QR_SECRET` (prefer base64-encoded)

## Response Codes
- Success: 200, 201, 202, 203, 207, 208, 226
- Errors: 400, 401, 403, 404, 405, 409, 422, 500

## Local Development Notes
- Start server on `PORT` (default 8080)
- Local uploads served at `/upload/*` when `NODE_ENV` is development or unset
- Base URL for local file links defaults to `http://localhost:3000` (configurable via `BASE_URL`)

## Recommended Next Steps 🚀

### High Priority (Security & Stability)
1. **Add authentication to storage endpoints** - Critical security gap
2. **Implement webhook signature verification** - Prevent fake org events
3. **Add role-based access control** to sensitive endpoints
4. **Implement liveness detection** for biometric verification
5. **Add rate limiting** across all endpoints
6. **Encrypt QR codes** with AES-GCM instead of obfuscation
7. **Add database indexes** for performance
8. **Implement proper error handling** with correlation IDs

### Medium Priority (Features & UX)
1. **Implement check-out functionality** for attendance
2. **Add duplicate check-in prevention** with time-based rules
3. **Implement polygon geofences** (schema ready)
4. **Add GPS validation** against geofence boundaries
5. **Build announcements API** (schema ready)
6. **Build permissions/leave API** (schema ready)
7. **Add attendance reports and analytics**
8. **Implement organization subscription enforcement**

### Low Priority (Operations & Quality)
1. **Add automated tests** (unit, integration, e2e)
2. **Implement structured logging** with log levels
3. **Add monitoring and alerting** (Sentry, DataDog, etc.)
4. **Set up CI/CD pipeline**
5. **Add database migration strategy**
6. **Implement data retention policies**
7. **Add GDPR compliance features**
8. **Optimize images before storage**
9. **Add CDN for static files**
10. **Document deployment process**

## Technology Stack Summary 📚

**Runtime & Framework**
- Bun - Fast JavaScript runtime
- Hono - Lightweight web framework
- TypeScript - Type safety

**Database & ORM**
- PostgreSQL - Primary database
- Drizzle ORM - Type-safe database access
- Migrations in `/drizzle` directory

**Authentication**
- Better Auth - Authentication system
- Organizations & Teams plugin
- Session-based auth with cookies

**Cloud Services**
- AWS Rekognition - Face recognition
- AWS S3 - File storage (production)
- Requires AWS credentials

**File Handling**
- Multer - Local file uploads (development)
- qrcode - QR code generation

**Utilities**
- drizzle-orm - Query builder
- Custom obfuscation module

## Changelog
- v1.6.0: Added Visitors module - Complete visitor access request system with access area management, entry/exit date scheduling, approval workflow (pending/approved/rejected/cancelled), QR token generation, and role-based access control
- v1.5.0: Added Permissions module - Complete leave/vacation request system with document uploads, supervisor approval workflow, status management (pending/approved/rejected), and role-based access control
- v1.4.1: Documentation updates - Fixed check-out endpoint documentation (removed non-existent optional parameters), added missing organization settings endpoints (GET/PUT `/organizations/:organizationId/settings`)
- v1.2.0: Added Schedules module (shift management), User-Geofence module, Check-out functionality, Attendance reports, comprehensive documentation update with all endpoints
- v1.1.0: Added Geofence module, refactored Attendance to controller/service pattern, comprehensive documentation update
- v1.0.0: Initial documented routes and modules based on current codebase

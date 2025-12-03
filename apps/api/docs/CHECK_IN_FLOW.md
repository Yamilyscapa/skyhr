# Check-In Flow Documentation

## Overview
This document explains the complete user flow for checking in to an attendance system, including all inputs, processing steps, and outputs.

---

## Endpoint
**POST** `/attendance/check-in`

**Authentication Required:** Yes (via `requireAuth` middleware)
**Organization Required:** Yes (via `requireOrganization` middleware)

---

## User Input (Request Body)

The user must send a JSON request with the following fields:

```json
{
  "organization_id": "string (required)",
  "location_id": "string (required) - UUID of the geofence/location",
  "image": "string (required) - Base64 encoded image of user's face",
  "latitude": "string (required) - User's current latitude",
  "longitude": "string (required) - User's current longitude"
}
```

### Field Details:
- **organization_id**: The ID of the organization the user is checking into
- **location_id**: The UUID of the geofence/location (typically obtained from scanning a QR code)
- **image**: Base64-encoded image string (can include or exclude `data:image/jpeg;base64,` prefix)
- **latitude**: User's GPS latitude as a string (e.g., "40.7128")
- **longitude**: User's GPS longitude as a string (e.g., "-74.0060")

---

## Backend Processing Flow

### Step 1: Input Validation
- Validates that all required fields are present
- Returns error if any required field is missing

### Step 2: User Authentication
- Extracts authenticated user from request context (set by `requireAuth` middleware)
- Returns error if user is not authenticated

### Step 3: Organization Membership Validation
- Verifies the user is a member of the specified organization
- Returns error if user doesn't belong to the organization

### Step 4: Organization Validation
- Verifies the organization exists in the database
- Returns error if organization not found

### Step 5: Location/Geofence Validation
- Finds and validates the geofence using `location_id` and `organization_id`
- Checks that the geofence is active
- Validates geofence has required properties (center coordinates, radius)
- Returns error if location is invalid or inactive

### Step 6: Geofence Boundary Validation
- Calculates distance between user's GPS coordinates and geofence center
- Determines if user is within the geofence radius
- Calculates exact distance in meters

### Step 7: Duplicate Check-In Prevention
- Checks if user already has an active check-in today (no check-out yet)
- Returns error if duplicate check-in detected

### Step 8: Biometric Face Verification
- Converts base64 image to Buffer
- Searches for matching face in AWS Rekognition collection (scoped to organization)
- Verifies the matched face belongs to the authenticated user
- Returns error if face doesn't match or no match found

### Step 9: Attendance Status Calculation
- Retrieves user's active shift for today
- Compares check-in time with shift start time
- Applies grace period from organization settings
- Calculates status: `"on_time"`, `"late"`, or `"early"`
- If user is outside geofence, overrides status to `"out_of_bounds"`

### Step 10: Create Attendance Event
- Creates attendance record in database with:
  - **user_id**: Authenticated user's ID
  - **organization_id**: From request
  - **location_id**: **Automatically set from validated geofence ID** (`gf.id`)
  - **shift_id**: User's active shift ID (if exists)
  - **check_in**: Current timestamp
  - **status**: Calculated status (`"on_time"`, `"late"`, `"early"`, or `"out_of_bounds"`)
  - **is_within_geofence**: Boolean from geofence validation
  - **distance_to_geofence_m**: Distance in meters
  - **latitude**: User's latitude
  - **longitude**: User's longitude
  - **face_confidence**: Similarity score from Rekognition
  - **is_verified**: `true` (face verification passed)
  - **source**: `"qr_face"`
  - **notes**: Status notes or geofence violation message

---

## Output (Success Response)

### HTTP Status: 200 OK

```json
{
  "success": true,
  "message": "Attendance recorded successfully" | "Attendance recorded but flagged as out of bounds",
  "data": {
    "id": "uuid - Attendance event ID",
    "check_in": "2024-01-15T09:30:00.000Z",
    "user_id": "user-id-string",
    "organization_id": "org-id-string",
    "location_id": "uuid - Geofence ID (automatically set)",
    "shift_id": "uuid | null - User's shift ID",
    "status": "on_time" | "late" | "early" | "out_of_bounds",
    "is_within_geofence": true | false,
    "distance_to_geofence_m": 15 | null,
    "face_confidence": "95.5",
    "is_verified": true,
    "notes": "string | null - Status notes or geofence violation message"
  }
}
```

### Response Field Details:
- **id**: Unique identifier for the attendance event
- **check_in**: ISO timestamp of check-in
- **user_id**: ID of the user who checked in
- **organization_id**: Organization ID
- **location_id**: **Automatically populated** from validated geofence (not from request)
- **shift_id**: User's shift ID if they have an active shift, otherwise `null`
- **status**: One of: `"on_time"`, `"late"`, `"early"`, `"out_of_bounds"`
- **is_within_geofence**: `true` if within geofence radius, `false` otherwise
- **distance_to_geofence_m**: Distance in meters (null if within bounds)
- **face_confidence**: Similarity score from face recognition (0-100)
- **is_verified**: Always `true` for successful check-ins
- **notes**: Additional information about status or violations

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": "organization_id, location_id, and image (base64) are required"
}
```

### 400 Bad Request (Missing Coordinates)
```json
{
  "success": false,
  "error": "latitude and longitude are required for geofence validation"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Unauthorized"
}
```

### 403 Forbidden (User Not in Organization)
```json
{
  "success": false,
  "error": "User does not belong to the specified organization"
}
```

### 403 Forbidden (Invalid Location)
```json
{
  "success": false,
  "error": "Location not allowed or inactive"
}
```

### 403 Forbidden (Face Mismatch)
```json
{
  "success": false,
  "error": "Face does not match the current user"
}
```

### 400 Bad Request (Duplicate Check-In)
```json
{
  "success": false,
  "error": "You already have an active check-in today. Please check out first."
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Attendance check-in failed"
}
```

---

## Key Points

1. **Automatic Location ID**: The `location_id` in the attendance event is **automatically set** from the validated geofence object (`gf.id`), not from the request body. This ensures data integrity.

2. **Face Verification**: The system uses AWS Rekognition to verify the user's face matches their registered face in the organization's collection.

3. **Geofence Validation**: Even if the user is outside the geofence, the check-in is recorded but marked as `"out_of_bounds"`.

4. **Shift-Based Status**: The system automatically calculates if the user is on time, late, or early based on their assigned shift and organization grace period.

5. **Duplicate Prevention**: Users cannot check in multiple times on the same day without checking out first.

---

## Example Flow

1. User scans QR code → Gets `location_id` and `organization_id`
2. User opens check-in screen → App captures face image and GPS coordinates
3. User taps "Check In" → Sends POST request with all data
4. Backend validates everything → Creates attendance event
5. User receives success response → Can see their check-in status

---

## Database Record Created

The attendance event is stored in the `attendance_event` table with:
- All metadata from the request
- **location_id automatically set** from validated geofence
- Timestamps (check_in, created_at, updated_at)
- Verification status and biometric data
- Geofence validation results


# Statistics Module Documentation

## Overview

The Statistics Module provides comprehensive attendance analytics and reporting capabilities for organizations. It enables administrators and owners to monitor attendance patterns, calculate costs, compare locations, and track individual employee performance.

**Base Path**: `/statistics`

**Authentication**: All endpoints require:
- Valid session authentication (`requireAuth`)
- Organization membership (`requireOrganization`)
- Admin or Owner role (`requireRole(['admin', 'owner'])`)

## Features

- **Dashboard Analytics**: Real-time overview with traffic light indicators
- **Attendance Metrics**: Detailed attendance, punctuality, and absenteeism reports
- **Cost Analysis**: Calculate absenteeism and overtime costs in MXN
- **Location Comparison**: Rank locations by performance with heatmap visualization
- **Trend Analysis**: Historical trends over the last 3 months
- **Per-User Statistics**: Individual employee performance tracking

## Endpoints

### 1. Dashboard Statistics

**Endpoint**: `GET /statistics/dashboard`

**Description**: Returns real-time dashboard with key indicators, traffic light status, and alerts.

**Query Parameters**:
- `period` (optional): `'daily' | 'weekly' | 'monthly' | 'quarterly'` (default: `'monthly'`)

**Response 200**:
```json
{
  "message": "Dashboard stats retrieved",
  "data": {
    "organization_id": "org-123",
    "period": "monthly",
    "metrics": {
      "attendanceRate": 95.5,
      "punctualityIndex": 90.0,
      "unjustifiedAbsenteeism": 2.5,
      "operationalRotation": 0,
      "averageDelays": 0.5,
      "coverageRate": 95.5,
      "reportCompliance": 100
    },
    "traffic_light": "green",
    "alerts": [
      {
        "type": "attendance",
        "severity": "critical",
        "message": "Attendance rate critical: 29.3%"
      }
    ]
  }
}
```

**Traffic Light Logic**:
- 🟢 **Green**: Attendance rate > 95%
- 🟡 **Yellow**: Attendance rate 90-94%
- 🔴 **Red**: Attendance rate < 90%

**Example Request**:
```bash
curl -X GET "http://localhost:8080/statistics/dashboard?period=monthly" \
  -H "Cookie: session_token=..."
```

---

### 2. Attendance Report

**Endpoint**: `GET /statistics/attendance`

**Description**: Detailed attendance metrics for a specific period with optional location filtering.

**Query Parameters**:
- `period` (optional): `'daily' | 'weekly' | 'monthly' | 'quarterly'` (default: `'monthly'`)
- `start_date` (optional): ISO date string (e.g., `"2025-10-01"`)
- `end_date` (optional): ISO date string (e.g., `"2025-10-31"`)
- `location_id` (optional): UUID of geofence location

**Response 200**:
```json
{
  "message": "Attendance report retrieved",
  "data": {
    "period": "monthly",
    "range": {
      "start": "2025-10-01T00:00:00.000Z",
      "end": "2025-10-31T23:59:59.999Z"
    },
    "metrics": {
      "attendanceRate": 95.5,
      "punctualityIndex": 90.0,
      "unjustifiedAbsenteeism": 2.5,
      "operationalRotation": 0,
      "averageDelays": 0.5,
      "coverageRate": 95.5,
      "reportCompliance": 100
    }
  }
}
```

**Metrics Explained**:
- **attendanceRate**: (Days worked / Days scheduled) × 100
- **punctualityIndex**: (On-time entries / Total entries) × 100
- **unjustifiedAbsenteeism**: (Unjustified absences / Total staff) × 100
- **averageDelays**: Total delays / Total employees
- **coverageRate**: (Covered shifts / Scheduled shifts) × 100

**Example Request**:
```bash
curl -X GET "http://localhost:8080/statistics/attendance?period=monthly&location_id=uuid-123" \
  -H "Cookie: session_token=..."
```

---

### 3. Cost Analysis

**Endpoint**: `GET /statistics/costs`

**Description**: Calculate absenteeism and overtime costs in MXN currency.

**Query Parameters**:
- `period` (optional): `'daily' | 'weekly' | 'monthly' | 'quarterly'` (default: `'monthly'`)
- `start_date` (optional): ISO date string
- `end_date` (optional): ISO date string

**Response 200**:
```json
{
  "message": "Cost analysis retrieved",
  "data": {
    "absenteeismCost": 185866.67,
    "overtimeCost": 0,
    "totalCostImpact": 185866.67,
    "currency": "MXN"
  }
}
```

**Cost Calculations**:
- **absenteeismCost**: Lost hours × average hourly rate
- **overtimeCost**: Overtime hours × hourly rate × 1.5
- **totalCostImpact**: Sum of all costs

**Example Request**:
```bash
curl -X GET "http://localhost:8080/statistics/costs?period=monthly" \
  -H "Cookie: session_token=..."
```

---

### 4. Location Comparison

**Endpoint**: `GET /statistics/locations`

**Description**: Compare performance across all locations with rankings and heatmap data.

**Query Parameters**:
- `period` (optional): `'daily' | 'weekly' | 'monthly' | 'quarterly'` (default: `'monthly'`)

**Response 200**:
```json
{
  "message": "Location comparison retrieved",
  "data": {
    "rankings": [
      {
        "locationId": "uuid-123",
        "locationName": "Main Office",
        "attendanceRate": 95.5,
        "absenteeismRate": 2.5,
        "punctualityIndex": 90.0,
        "rank": 1
      }
    ],
    "heatmap": [
      {
        "locationId": "uuid-123",
        "locationName": "Main Office",
        "latitude": 19.0479,
        "longitude": -98.2143,
        "incidentCount": 5,
        "severity": "medium"
      }
    ],
    "best_performer": {
      "locationId": "uuid-123",
      "locationName": "Main Office",
      "attendanceRate": 95.5,
      "rank": 1
    },
    "needs_attention": [
      {
        "locationId": "uuid-456",
        "locationName": "Branch Office",
        "attendanceRate": 85.0,
        "rank": 2
      }
    ]
  }
}
```

**Heatmap Severity**:
- **low**: 0-5 incidents
- **medium**: 6-10 incidents
- **high**: >10 incidents

**Example Request**:
```bash
curl -X GET "http://localhost:8080/statistics/locations?period=monthly" \
  -H "Cookie: session_token=..."
```

---

### 5. Trends Analysis

**Endpoint**: `GET /statistics/trends`

**Description**: Historical trends for the last 3 months showing attendance, punctuality, and absenteeism patterns.

**Response 200**:
```json
{
  "message": "Trends analysis retrieved",
  "data": {
    "attendance": [
      {
        "date": "2025-08",
        "value": 92.5
      },
      {
        "date": "2025-09",
        "value": 94.0
      },
      {
        "date": "2025-10",
        "value": 95.5
      }
    ],
    "punctuality": [
      {
        "date": "2025-08",
        "value": 88.0
      },
      {
        "date": "2025-09",
        "value": 89.5
      },
      {
        "date": "2025-10",
        "value": 90.0
      }
    ],
    "absenteeism": [
      {
        "date": "2025-08",
        "value": 3.5
      },
      {
        "date": "2025-09",
        "value": 3.0
      },
      {
        "date": "2025-10",
        "value": 2.5
      }
    ]
  }
}
```

**Example Request**:
```bash
curl -X GET "http://localhost:8080/statistics/trends" \
  -H "Cookie: session_token=..."
```

---

### 6. Per-User Statistics

**Endpoint**: `GET /statistics/user/:userId` or `GET /statistics/user/by-email`

**Description**: Detailed attendance statistics for a specific user including metrics, cost impact, and recent activity.

**Path Parameters** (for `/user/:userId`):
- `userId`: User ID (UUID or text)

**Query Parameters**:
- `email` (required for `/user/by-email`): User email address
- `period` (optional): `'daily' | 'weekly' | 'monthly' | 'quarterly'` (default: `'monthly'`)
- `start_date` (optional): ISO date string
- `end_date` (optional): ISO date string

**Response 200**:
```json
{
  "message": "User statistics retrieved",
  "data": {
    "userId": "user-123",
    "userName": "John Doe",
    "userEmail": "john@example.com",
    "period": "monthly",
    "dateRange": {
      "startDate": "2025-10-01T00:00:00.000Z",
      "endDate": "2025-10-31T23:59:59.999Z"
    },
    "metrics": {
      "attendanceRate": 95.5,
      "punctualityRate": 90.0,
      "totalWorkHours": 168.5,
      "overtimeHours": 8.5,
      "lateArrivals": 2,
      "absences": 1,
      "onTimeCheckIns": 18,
      "totalCheckIns": 20
    },
    "costImpact": {
      "regularPay": 16800,
      "overtimePay": 1275,
      "totalPay": 18075,
      "currency": "MXN"
    },
    "recentActivity": [
      {
        "id": "event-123",
        "checkIn": "2025-10-31T09:00:00.000Z",
        "checkOut": "2025-10-31T17:30:00.000Z",
        "status": "on_time",
        "locationName": "Main Office",
        "hoursWorked": 8.5,
        "isLate": false
      }
    ]
  }
}
```

**User Metrics Explained**:
- **attendanceRate**: (Total check-ins / Scheduled days) × 100
- **punctualityRate**: (On-time check-ins / Total check-ins) × 100
- **totalWorkHours**: Sum of all completed shift durations
- **overtimeHours**: Hours worked beyond scheduled hours
- **lateArrivals**: Count of check-ins with status "late"
- **absences**: Scheduled days without check-ins
- **onTimeCheckIns**: Count of check-ins with status "on_time"
- **totalCheckIns**: Total number of check-ins in period

**Example Requests**:
```bash
# By User ID
curl -X GET "http://localhost:8080/statistics/user/user-123?period=monthly" \
  -H "Cookie: session_token=..."

# By Email
curl -X GET "http://localhost:8080/statistics/user/by-email?email=john@example.com&period=monthly" \
  -H "Cookie: session_token=..."
```

---

## Error Responses

### 401 Unauthorized
```json
{
  "error": "No autorizado. Se requiere autenticación.",
  "code": "UNAUTHORIZED"
}
```

### 403 Forbidden
```json
{
  "error": "Acceso denegado. Se requiere uno de los siguientes roles: admin, owner",
  "code": "FORBIDDEN"
}
```

### 404 Not Found
```json
{
  "error": "User not found or not in organization",
  "code": "NOT_FOUND"
}
```

### 400 Bad Request
```json
{
  "error": "User ID or Email is required",
  "code": "BAD_REQUEST"
}
```

---

## Implementation Details

### Data Sources

The statistics module aggregates data from:
- `attendance_event`: Check-in/check-out records
- `user_schedule` + `shift`: Scheduled work days and hours
- `user_payroll`: Hourly rates for cost calculations
- `geofence`: Location information
- `member`: Organization membership validation

### Calculation Methods

**Attendance Rate**:
```
(Days worked / Days scheduled) × 100
```

**Punctuality Index**:
```
(On-time entries / Total entries) × 100
```

**Absenteeism Cost**:
```
Lost hours × average hourly rate
```

**Overtime Cost**:
```
Overtime hours × hourly rate × 1.5
```

### Period Calculations

- **Daily**: Current day (00:00:00 to 23:59:59)
- **Weekly**: Last 7 days from current date
- **Monthly**: Last 30 days from current date
- **Quarterly**: Last 90 days from current date

Custom date ranges can be specified using `start_date` and `end_date` query parameters.

---

## Best Practices

1. **Caching**: Consider caching dashboard and trends data for better performance
2. **Pagination**: For large datasets, implement pagination on user activity lists
3. **Real-time Updates**: Use WebSockets or polling for live dashboard updates
4. **Data Validation**: Always validate date ranges to prevent excessive queries
5. **Error Handling**: Implement retry logic for transient database errors

---

## Future Enhancements

- [ ] Export reports to PDF/Excel
- [ ] Email scheduled reports
- [ ] Custom date range presets
- [ ] Comparative analytics between users
- [ ] Predictive analytics for attendance patterns
- [ ] Integration with payroll systems
- [ ] Real-time alerts via webhooks

---

## Related Documentation

- [API Documentation](./API_DOCUMENTATION.md)
- [Check-in Flow](./CHECK_IN_FLOW.md)
- [Main README](../README.md)



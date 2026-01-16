# Verification Protocol Specification

**Status:** IMPLEMENTED
**Last Updated:** January 2025

---

## Overview

The GPS Verification Protocol establishes residency by requiring users to prove they're physically present in their claimed municipality over a 21-day period. This "Resident Gate" ensures only verified residents can vote on local issues.

## Identity Score Impact

| Verification Status | Points |
|---------------------|--------|
| Not started | 0 |
| In progress | 0 |
| Completed (verified) | +20 |
| Failed | 0 |

**Note:** GPS verification contributes 20 points to identity score, bringing max to 100 with all social proofs.

## Verification Rules

### Period Duration
- **Total period:** 21 days
- **Check-ins required:** 5-7 (randomly assigned)
- **Success threshold:** 80% completion rate
- **Window duration:** 30 minutes per check-in

### Check-in Windows
- Randomly distributed across the 21-day period
- Each window is 30 minutes long
- Windows only during waking hours: 8:00 AM - 10:00 PM
- User receives push notification when window opens

### GPS Requirements
- **Accuracy threshold:** ≤100 meters
- **Location:** Must be within municipality polygon bounds
- Uses ray-casting algorithm for point-in-polygon detection

## Verification Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Select    │────▶│    Start    │────▶│  Complete   │
│ Municipality│     │ Verification│     │  Check-ins  │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Schedule   │
                    │  Generated  │
                    │ (5-7 slots) │
                    └─────────────┘
```

### Step 1: Select Municipality

User must select their municipality before starting verification.

**Supported Municipalities (20):**
- Tel Aviv-Yafo, Jerusalem, Haifa, Rishon LeZion
- Petah Tikva, Ashdod, Netanya, Beer Sheva
- Bnei Brak, Holon, Ramat Gan, Ashkelon
- Rehovot, Bat Yam, Herzliya, Kfar Saba
- Modi'in, Nazareth, Ra'anana, Lod

### Step 2: Start Verification

`POST /api/verification/start`

**Prerequisites:**
- User authenticated
- Municipality selected
- No active verification in progress
- Not already verified

**Actions:**
1. Create `verification_run` record with status `active`
2. Generate 5-7 random check-in windows
3. Create `verification_schedule` items
4. Update user `verification_status` to `pending`
5. Return first check-in window time

### Step 3: Complete Check-ins

During each 30-minute window:

1. User receives push notification
2. Opens app and triggers GPS check-in
3. App sends coordinates to `POST /api/verification/check-in`
4. Backend verifies:
   - Current time within window
   - GPS accuracy ≤100m
   - Location within municipality bounds
5. Records attempt (pass/fail)
6. Updates progress counters

### Step 4: Verification Complete

After all check-ins attempted:
- If ≥80% passed → `verification_status: 'verified'`
- If <80% passed → `verification_status: 'failed'`
- Identity score updated (+20 if verified)

## API Endpoints

### POST /api/verification/start

Start a new 21-day verification period.

**Response (200):**
```json
{
  "success": true,
  "schedule": {
    "id": "run-uuid",
    "municipality": "tel-aviv",
    "periodStart": "2025-01-15T00:00:00.000Z",
    "periodEnd": "2025-02-05T00:00:00.000Z",
    "totalCheckIns": 6,
    "nextCheckIn": "2025-01-16T14:30:00.000Z"
  },
  "verificationStatus": {
    "phase": "in_progress",
    "completedCheckIns": 0,
    "totalCheckIns": 6
  }
}
```

**Errors:**
- `400` - No municipality selected
- `400` - Invalid municipality
- `400` - Verification already in progress
- `400` - Already verified

### POST /api/verification/check-in

Record a GPS check-in.

**Request:**
```json
{
  "latitude": 32.0853,
  "longitude": 34.7818,
  "accuracy": 25,
  "scheduleId": "optional-schedule-uuid"
}
```

**Response (200 - Success):**
```json
{
  "success": true,
  "verified": true,
  "checkIn": {
    "id": "attempt-uuid",
    "completedAt": "2025-01-16T14:35:00.000Z",
    "location": {
      "latitude": 32.0853,
      "longitude": 34.7818,
      "accuracy": 25,
      "timestamp": "2025-01-16T14:35:00.000Z"
    },
    "municipalityVerified": true,
    "distanceFromCenter": 1.2
  },
  "verificationStatus": {
    "phase": "in_progress",
    "completedCheckIns": 1,
    "totalCheckIns": 6
  },
  "progress": {
    "completedCheckIns": 1,
    "totalCheckIns": 6,
    "completionRate": 0.167
  }
}
```

**Response (400 - Failed):**
```json
{
  "success": false,
  "verified": false,
  "error": "Location is outside תל אביב-יפו",
  "details": {
    "inMunicipality": false,
    "accuracyAcceptable": true,
    "distanceFromCenter": 15.3
  }
}
```

**Errors:**
- `400 too_early` - Check-in window hasn't started
- `400 too_late` - Check-in window expired
- `400` - Invalid coordinates
- `400` - No verification in progress
- `400` - No pending check-in
- `429` - Rate limited (10 req/min)

### GET /api/verification/status

Get current verification status.

**Response (200 - In Progress):**
```json
{
  "verificationStatus": {
    "phase": "in_progress",
    "startedAt": "2025-01-15T00:00:00.000Z",
    "scheduleId": "run-uuid",
    "checkInsCompleted": 3,
    "checkInsTotal": 6,
    "nextCheckIn": "2025-01-20T10:00:00.000Z"
  },
  "progress": {
    "daysRemaining": 12,
    "daysElapsed": 9,
    "completedCheckIns": 3,
    "totalCheckIns": 6,
    "missedCheckIns": 1,
    "pendingCheckIns": 2,
    "completionRate": 0.5,
    "requiredCompletionRate": 0.8,
    "canStillPass": true
  },
  "municipality": "tel-aviv",
  "nextCheckIn": "2025-01-20T10:00:00.000Z"
}
```

**Phases:**
- `not_started` - User hasn't begun verification
- `in_progress` - Active 21-day period
- `completed` - Successfully verified
- `failed` - Did not meet 80% threshold

### GET /api/verification/schedule

Get the full check-in schedule.

**Response (200):**
```json
{
  "schedule": [
    {
      "id": "schedule-item-uuid",
      "windowStart": "2025-01-16T14:30:00.000Z",
      "windowEnd": "2025-01-16T15:00:00.000Z",
      "completed": true,
      "completedAt": "2025-01-16T14:35:00.000Z"
    },
    {
      "id": "schedule-item-uuid-2",
      "windowStart": "2025-01-20T10:00:00.000Z",
      "windowEnd": "2025-01-20T10:30:00.000Z",
      "completed": false,
      "completedAt": null
    }
  ],
  "runId": "run-uuid",
  "municipality": "tel-aviv"
}
```

## Municipality Bounds

Each municipality is defined by a polygon for point-in-polygon detection:

```typescript
interface MunicipalityBounds {
  name: string;       // English name
  nameHe: string;     // Hebrew name
  polygon: Array<{    // Clockwise polygon vertices
    lat: number;
    lng: number;
  }>;
  center: {           // Center point for distance calc
    lat: number;
    lng: number;
  };
}
```

### Point-in-Polygon Algorithm

Uses ray-casting algorithm to determine if GPS coordinates fall within municipality polygon:

```typescript
function isPointInPolygon(point, polygon): boolean {
  // Cast ray from point, count polygon edge intersections
  // Odd count = inside, Even count = outside
}
```

### Distance Calculation

Haversine formula for great-circle distance:
- Used to calculate distance from municipality center
- Returned in responses for debugging/UX

## Database Schema

### verification_runs
```sql
id UUID PRIMARY KEY
user_id UUID REFERENCES users(id)
municipality_id TEXT NOT NULL
status TEXT DEFAULT 'active' -- 'active', 'verified', 'failed', 'cancelled'
total_check_ins INTEGER NOT NULL
completed_check_ins INTEGER DEFAULT 0
failed_check_ins INTEGER DEFAULT 0
started_at TIMESTAMPTZ DEFAULT NOW()
completed_at TIMESTAMPTZ
```

### verification_schedule
```sql
id UUID PRIMARY KEY
run_id UUID REFERENCES verification_runs(id)
window_start TIMESTAMPTZ NOT NULL
window_end TIMESTAMPTZ NOT NULL
completed BOOLEAN DEFAULT false
```

### verification_attempts
```sql
id UUID PRIMARY KEY
schedule_id UUID REFERENCES verification_schedule(id)
user_id UUID REFERENCES users(id)
latitude DECIMAL NOT NULL
longitude DECIMAL NOT NULL
accuracy DECIMAL
passed BOOLEAN NOT NULL
fail_reason TEXT -- 'too_early', 'too_late', 'outside_bounds', 'low_accuracy'
timestamp TIMESTAMPTZ DEFAULT NOW()
```

## Push Notifications

Check-in windows trigger push notifications via `specs/push-notifications.md`:

**Notification Payload:**
```json
{
  "title": "זמן לצ'ק-אין! 📍",
  "body": "יש לך 30 דקות לאמת את המיקום שלך",
  "data": {
    "type": "verification_checkin",
    "scheduleId": "uuid",
    "windowEnd": "2025-01-16T15:00:00.000Z"
  }
}
```

## Rate Limiting

- **Check-in endpoint:** 10 requests per minute per user
- Prevents GPS spoofing attempts through rapid retries
- Returns `429` with retry-after header

## Security Considerations

### GPS Spoofing Prevention
- Rate limiting on check-ins
- Accuracy threshold (≤100m)
- Random window times (unpredictable)
- Multiple check-ins over 21 days

### Privacy
- GPS coordinates stored only for verification attempts
- Polygon bounds are simplified (not exact municipal boundaries)
- Distance from center provided, not exact location

## Error Codes

| Error | HTTP | Description |
|-------|------|-------------|
| `too_early` | 400 | Check-in before window start |
| `too_late` | 400 | Check-in after window end |
| `outside_bounds` | 400 | GPS outside municipality |
| `low_accuracy` | 400 | GPS accuracy >100m |
| `no_verification` | 400 | No active verification |
| `no_pending` | 400 | No pending check-in slot |
| `already_verified` | 400 | User already verified |
| `already_active` | 400 | Verification already in progress |

---

## Mobile Implementation Notes

- Use `expo-location` with `Accuracy.High`
- Request foreground location permission
- Schedule local notifications as backup to push
- Show countdown timer during check-in window
- Provide "Try Again" if check-in fails

# Authentication Flow Specification

**Status:** IMPLEMENTED
**Last Updated:** January 2025

---

## Overview

Taru uses Google OAuth as the primary authentication method, with Facebook and Instagram as secondary social proof providers. Authentication creates a DID (Decentralized Identifier) for each user and manages JWT-based sessions.

## Identity Score System

Users earn identity points from connected social accounts:

| Provider | Points | Purpose |
|----------|--------|---------|
| Google | 40 | Primary auth (required) |
| Facebook | 20 | Social proof |
| Instagram | 20 | Social proof |
| GPS Verification | 20 | Location proof |
| **Maximum** | **100** | Full verification |

## Authentication Flow

### 1. Google OAuth (Primary)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│   Google    │────▶│   Backend   │
│  (Mobile/   │     │   OAuth     │     │   Callback  │
│    Web)     │◀────│   Server    │◀────│   /api/auth │
└─────────────┘     └─────────────┘     └─────────────┘
```

**Step 1: Initiate OAuth**
- Client calls `buildGoogleAuthUrl()` with CSRF state
- State stored in sessionStorage
- Redirect to Google consent screen

**Step 2: Google Callback**
- User grants permission
- Google redirects with `code` and `state`
- Client verifies state matches stored value

**Step 3: Token Exchange**
- `POST /api/auth/callback` with authorization code
- Backend exchanges code for tokens via Google Token URL
- Backend fetches user info from Google UserInfo API

**Step 4: User Creation/Login**
- Check if user exists by `google_id`
- If new user:
  - Generate encrypted DID
  - Create user with `identity_score: 40`
  - Create Google social proof record
- If existing user:
  - Update `updated_at` timestamp

**Step 5: Session Creation**
- Create JWT session token (7 day expiry)
- Create refresh token
- Set HTTP-only cookies
- Return user data + tokens

### 2. Social Connect (Facebook/Instagram)

For additional identity verification (not primary auth):

```
POST /api/social/connect/facebook
POST /api/social/connect/instagram
```

**Flow:**
1. User already authenticated via Google
2. Initiate OAuth with Facebook/Instagram
3. Callback creates `social_proof` record
4. Identity score increases by 20 points

**Callback Routes:**
```
POST /api/social/callback/facebook
POST /api/social/callback/instagram
```

## API Endpoints

### POST /api/auth/callback

Exchange Google OAuth code for session.

**Request:**
```json
{
  "code": "4/0AY0e-g5..."
}
```

**Response (200):**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "did": "did:sync:...",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "identityScore": 40,
    "verificationStatus": "none",
    "avatarUrl": "https://...",
    "municipality": null
  },
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "isNewUser": true
}
```

**Errors:**
- `400 MISSING_CODE` - No authorization code provided
- `500 CONFIG_ERROR` - Missing GOOGLE_CLIENT_SECRET
- `500 AUTH_FAILED` - Token exchange or user creation failed

### POST /api/auth/session

Validate current session.

**Request:** (uses cookies, no body needed)

**Response (200):**
```json
{
  "valid": true,
  "user": {
    "id": "uuid",
    "did": "did:sync:...",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "avatarUrl": "https://...",
    "identityScore": 60,
    "verificationStatus": "in_progress",
    "municipality": "kiryat-tivon",
    "socialProofs": ["google", "facebook"]
  },
  "session": {
    "userId": "uuid",
    "did": "did:sync:...",
    "expiresAt": "2025-01-22T00:00:00.000Z"
  }
}
```

**Errors:**
- `401 INVALID_SESSION` - No valid session token
- `404 USER_NOT_FOUND` - Session valid but user deleted

### DELETE /api/auth/session

Sign out and clear session.

**Response (200):**
```json
{
  "success": true,
  "message": "Signed out successfully"
}
```

### POST /api/auth/session/refresh

Refresh expired session using refresh token.

**Request:** (uses refresh token from cookies)

**Response (200):**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": { ... },
  "expiresAt": "2025-01-22T00:00:00.000Z"
}
```

**Errors:**
- `401 NO_REFRESH_TOKEN` - No refresh token in cookies
- `401 INVALID_REFRESH_TOKEN` - Token expired or invalid
- `404 USER_NOT_FOUND` - User no longer exists

### GET /api/social/proofs

Get user's connected social accounts.

**Response (200):**
```json
{
  "proofs": [
    {
      "provider": "google",
      "providerId": "123456789",
      "providerEmail": "user@gmail.com",
      "providerName": "John Doe",
      "providerAvatar": "https://...",
      "connectedAt": "2025-01-15T00:00:00.000Z"
    },
    {
      "provider": "facebook",
      "providerId": "987654321",
      "providerName": "John Doe",
      "connectedAt": "2025-01-16T00:00:00.000Z"
    }
  ]
}
```

## JWT Token Structure

### Session Token

```json
{
  "userId": "uuid",
  "googleId": "google-sub-id",
  "did": "did:sync:...",
  "email": "user@example.com",
  "iat": 1705276800,
  "exp": 1705881600
}
```

- **Expiry:** 7 days
- **Secret:** `JWT_SECRET` env var
- **Storage:** HTTP-only cookie `session_token`

### Refresh Token

```json
{
  "userId": "uuid",
  "type": "refresh",
  "iat": 1705276800,
  "exp": 1707868800
}
```

- **Expiry:** 30 days
- **Secret:** `JWT_SECRET` env var
- **Storage:** HTTP-only cookie `refresh_token`
- **Rotation:** New refresh token issued on each refresh

## DID Generation

New users receive a Decentralized Identifier:

```typescript
const didData = await generateEncryptedDID(googleAccessToken);
// Returns:
// {
//   did: "did:sync:abc123...",
//   publicKey: { ... },
//   encryptedPrivateKey: "encrypted..."
// }
```

- DID derived from Google access token
- Private key encrypted before storage
- Public key stored as JSON string
- Used for blockchain vote signing

## Security Measures

### CSRF Protection
- Random state parameter generated per OAuth request
- State stored in sessionStorage
- State verified on callback before token exchange

### Cookie Security
- `httpOnly: true` - No JS access
- `secure: true` - HTTPS only (production)
- `sameSite: 'lax'` - CSRF protection
- `path: '/'` - Available site-wide

### Token Rotation
- Refresh tokens rotated on each use
- Prevents token reuse after theft

## Database Schema

### users table
```sql
id UUID PRIMARY KEY
email TEXT NOT NULL
first_name TEXT
last_name TEXT
google_id TEXT UNIQUE
avatar_url TEXT
did TEXT
did_public_key TEXT
did_encrypted_private_key TEXT
identity_score INTEGER DEFAULT 0
verification_status TEXT DEFAULT 'none'
municipality_id TEXT
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

### social_proofs table
```sql
id UUID PRIMARY KEY
user_id UUID REFERENCES users(id)
provider TEXT NOT NULL -- 'google', 'facebook', 'instagram'
provider_id TEXT NOT NULL
provider_email TEXT
provider_name TEXT
provider_avatar TEXT
created_at TIMESTAMPTZ
UNIQUE(user_id, provider)
```

## Environment Variables

```env
# Google OAuth
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx

# JWT
JWT_SECRET=random-32-byte-hex
JWT_EXPIRY=7d

# App URL (for OAuth redirect)
NEXT_PUBLIC_APP_URL=https://sync.co.il
```

## Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `MISSING_CODE` | 400 | OAuth code not provided |
| `CONFIG_ERROR` | 500 | Missing server configuration |
| `AUTH_FAILED` | 500 | OAuth flow failed |
| `INVALID_SESSION` | 401 | Session token invalid/expired |
| `NO_REFRESH_TOKEN` | 401 | No refresh token in cookies |
| `INVALID_REFRESH_TOKEN` | 401 | Refresh token invalid/expired |
| `USER_NOT_FOUND` | 404 | User doesn't exist |
| `VALIDATION_FAILED` | 500 | Session validation error |
| `SIGNOUT_FAILED` | 500 | Sign out error |
| `REFRESH_FAILED` | 500 | Token refresh error |

---

## Mobile Implementation Notes

Mobile app uses the same OAuth flow but with:
- `expo-auth-session` for OAuth handling
- `expo-secure-store` for token storage
- Deep link callback: `sync://auth/callback`

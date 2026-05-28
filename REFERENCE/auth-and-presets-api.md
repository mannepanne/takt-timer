# Auth, Presets, and Sessions API Reference

HTTP contract for the Phase 4 `/api/auth/*`, `/api/presets/*`, and `/api/sessions` endpoints.

All endpoints require the `Origin` header to match the configured `WEBAUTHN_ORIGIN` (or have no `Origin` at all, which integration tests rely on). Requests with a disallowed `Origin` receive `403 Forbidden`.

---

## Auth

### POST /api/auth/registration/options

Generates WebAuthn registration options and a short-lived challenge token.

**Response `200`**

```json
{
  "challenge": "base64url",
  "_token": "uuid",
  "rp": { "id": "...", "name": "Takt" },
  "user": { "id": "base64url", "name": "takt-user", "displayName": "Takt User" },
  "pubKeyCredParams": [...],
  "authenticatorSelection": { "residentKey": "required", "userVerification": "preferred" }
}
```

The `_token` references the KV challenge entry (TTL: 5 min). It must be passed back to `/registration/verify`.

---

### POST /api/auth/registration/verify

Verifies the authenticator's registration response and creates the user account.

**Request body**

```json
{
  "token": "uuid",
  "credential": {
    /* RegistrationResponseJSON */
  }
}
```

**Response `200`** — session cookie is set

```json
{ "userHandle": "aabb...(32 hex chars)", "isAdmin": false }
```

**Error responses**

| Status | `error` field         | Meaning                                          |
| ------ | --------------------- | ------------------------------------------------ |
| 400    | `invalid-request`     | Body failed Zod parse                            |
| 400    | `challenge-expired`   | `_token` not found in KV (>5 min)                |
| 400    | `verification-failed` | SimpleWebAuthn rejected the response             |
| 409    | `handle-collision`    | Duplicate `userHandle` (astronomically unlikely) |

---

### POST /api/auth/signin/options

Generates WebAuthn authentication options and a short-lived challenge token.

**Response `200`**

```json
{
  "challenge": "base64url",
  "_token": "uuid",
  "rpId": "...",
  "userVerification": "preferred",
  "allowCredentials": []
}
```

---

### POST /api/auth/signin/verify

Verifies the authenticator's assertion and signs the user in.

**Request body**

```json
{
  "token": "uuid",
  "credential": {
    /* AuthenticationResponseJSON */
  },
  "userHandle": "aabb...(32 hex chars)"
}
```

The `userHandle` is the browser-returned Base64URL value decoded to hex — see `src/lib/auth/client.ts` for the conversion.

**Response `200`** — session cookie is set

```json
{ "userHandle": "aabb...(32 hex chars)", "isAdmin": false }
```

**Error responses**

| Status | `error` field         | Meaning                                                   |
| ------ | --------------------- | --------------------------------------------------------- |
| 400    | `invalid-request`     | Body failed Zod parse                                     |
| 400    | `challenge-expired`   | Token not in KV                                           |
| 400    | `verification-failed` | SimpleWebAuthn rejected assertion                         |
| 403    | `counter-regression`  | Non-synced credential counter went backwards (cloned key) |
| 404    | `user-not-found`      | No D1 row for the given `userHandle`                      |

---

### POST /api/auth/signout

Invalidates the session. Deletes the KV entry and clears the session cookie.

**Response `200`** `{ "ok": true }`

---

### GET /api/auth/me

Returns the currently authenticated user, or `401` if the session is missing or invalid.

**Response `200`**

```json
{ "userHandle": "aabb...", "isAdmin": false }
```

**Response `401`** `{ "error": "unauthenticated" }`

---

### DELETE /api/auth/delete

Deletes the authenticated user's account, all their presets, and all their session history from D1. Invalidates the session.

**Response `200`** `{ "ok": true }`

**Response `401`** `{ "error": "unauthenticated" }`

---

## Presets

All preset endpoints require authentication. `401` is returned when no valid session cookie is present.

### GET /api/presets

Returns all presets for the authenticated user, ordered by `pinned DESC, order_index ASC`.

**Response `200`** — array of preset objects

```json
[
  {
    "id": "uuid",
    "user_handle": "aabb...",
    "name": "Legs",
    "sets": 3,
    "work_sec": 60,
    "rest_sec": 30,
    "pinned": 0,
    "order_index": 0,
    "created_at": 1716700000000
  }
]
```

---

### POST /api/presets

Creates a new preset.

**Request body**

```json
{ "name": "Legs", "sets": 3, "work_sec": 60, "rest_sec": 30 }
```

**Response `201`** — the created preset object (same shape as above)

---

### PATCH /api/presets/:id

Updates a specific preset. Only the fields provided in the body are updated.

**Request body** (all fields optional)

```json
{ "name": "Legs v2", "sets": 4, "work_sec": 45, "rest_sec": 15, "pinned": 1 }
```

**Response `200`** — the updated preset object

**Response `404`** if the preset does not belong to the authenticated user.

---

### DELETE /api/presets/:id

Deletes a specific preset.

**Response `200`** `{ "ok": true }`

**Response `404`** if not found or not owned by the user.

---

### PATCH /api/presets/reorder

Updates the `order_index` of all presets in a single batch.

**Request body**

```json
{ "ids": ["uuid-b", "uuid-a", "uuid-c"] }
```

The array must contain every preset ID for the user. The server writes `order_index = arrayPosition` for each.

**Response `200`** `{ "ok": true }`

**Response `400`** `{ "error": "invalid-request" }` if `ids` is missing or not an array.

---

## Sessions

### GET /api/sessions

Returns the session history for the authenticated user.

**Query parameters**

- `latest=1` — return only the most recent session (as a single object, not an array)

**Response `200`** — array of session rows (or a single object when `latest=1`)

```json
[
  {
    "id": "uuid",
    "completed_at": 1716700000000,
    "total_sec": 300,
    "sets": 3,
    "work_sec": 60,
    "rest_sec": 30
  }
]
```

`null` is returned for `latest=1` when the user has no sessions.

---

### POST /api/sessions

Appends one or more sessions to the server. Used by `importLocalHistory` (batch import at registration) and `pushSession` (single append after each completed session).

**Request body**

```json
{
  "sessions": [
    {
      "id": "uuid",
      "completed_at": 1716700000000,
      "total_sec": 300,
      "sets": 3,
      "work_sec": 60,
      "rest_sec": 30
    }
  ]
}
```

IDs are client-generated UUIDs. `INSERT OR IGNORE` on the server makes repeated calls idempotent.

**Response `200`** `{ "imported": 3 }` — count of rows actually inserted (ignoring duplicates)

---

## Session cookie

All authenticated endpoints set or depend on a `takt_session` cookie:

```
Set-Cookie: takt_session=<signedToken>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000
```

- **30-day TTL** — both the KV entry and the cookie `Max-Age`.
- **Signed** — HMAC-SHA256 with `SESSION_COOKIE_SECRET`. Signature failure → `401`.
- **No expiry clock on the server** — the KV entry's TTL is the authoritative expiry.

---

## User settings

### GET /api/me/settings

Returns the authenticated user's persisted settings.

**Auth:** Session cookie required (`401` if missing or invalid).

**Response `200`**

```json
{ "language": "en", "accent_colour": "lichen", "sound_on": 1 }
```

**Response `404`** — user row not found (session for a deleted account).

---

### PUT /api/me/settings

Replaces all three settings atomically.

**Auth:** Session cookie required (`401` if missing or invalid).

**Request body**

```json
{ "language": "sv", "accent_colour": "iris", "sound_on": 0 }
```

**Validation**

| Field           | Rule                                         | Error code              |
| --------------- | -------------------------------------------- | ----------------------- |
| `language`      | `"en"` or `"sv"`                             | `invalid_language`      |
| `accent_colour` | One of `lichen coral ocean amber iris slate` | `invalid_accent_colour` |
| `sound_on`      | `0` or `1`                                   | `invalid_sound_on`      |

All fields are required. Missing or invalid fields return `400` with `{ "error": "<code>" }`.

**Response `200`** — `{ "ok": true }`

**Response `404`** — user row not found (session for a deleted account, `meta.changes === 0`).

---

## `isAllowedOrigin` guard

All `/api/*` routes (auth, presets, sessions, me) enforce `isAllowedOrigin(request)`. The rule:

- No `Origin` header → **allow** (integration tests, curl, Wrangler local dev)
- `Origin` matches `WEBAUTHN_ORIGIN` → **allow**
- Any other `Origin` → **403 Forbidden**

The guard prevents cross-origin write abuse. It is not a full CORS implementation — `OPTIONS` preflight is not handled (not required for same-origin PWA calls).

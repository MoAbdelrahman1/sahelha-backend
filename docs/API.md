# API Contract

Confirmed against the official Swagger for the real backend (2026-07-13,
extended same day with the readiness-check and document-analyze endpoints).
This is authoritative — if any other doc or code comment in this repo
disagrees with what's written here, this file wins.

## Auth endpoints

Implemented in `src/features/auth/api.ts`.

All three endpoints ARE mounted with an `/api` prefix. (An earlier audit,
`docs/PROJECT_STATUS.md` §8, claimed the real backend has no `/api` prefix
and that every call in this codebase would 404 — that claim is superseded by
this Swagger and is now known to be wrong. Do not act on it.)

## POST /api/auth/register

Auth required: no.

Request body (`application/json`):
```json
{
  "email": "string",
  "password": "string",
  "full_name": "string",
  "phone": "string"
}
```

Response `200` (`application/json`):
```json
{
  "access_token": "string",
  "refresh_token": "string",
  "token_type": "bearer",
  "user": {
    "id": 0,
    "email": "string",
    "full_name": "string",
    "phone": "string",
    "created_at": "string"
  }
}
```

Response `422` (validation error):
```json
{
  "detail": [
    { "loc": ["body", "email"], "msg": "string", "type": "string" }
  ]
}
```

## POST /api/auth/login

Auth required: no.

Request body (`application/json`):
```json
{
  "email": "string",
  "password": "string"
}
```

Response `200`: identical shape to register's `200` above.

Response `422`: identical shape to register's `422` above.

## GET /api/auth/me

Auth required: yes — `Authorization: Bearer <access_token>`. Attached
automatically by the request interceptor in `src/lib/api/client.ts`; callers
don't need to set it themselves.

Parameters: none.

Response `200` (`application/json`) — the bare user object, **not** wrapped
in a `user` key:
```json
{
  "id": 0,
  "email": "string",
  "full_name": "string",
  "phone": "string",
  "created_at": "string"
}
```

No `422` is documented for this endpoint (no request body to validate).

## Error handling

- `422` → `src/lib/api/errors.ts`'s `toApiError` reads `response.data.detail`
  (the array above), maps each entry's `loc` field name to its existing
  Arabic label (email/password/full_name/phone/file), and returns an
  `ApiError` naming the offending field(s) — e.g.
  `"يرجى التحقق من: البريد الإلكتروني"`. Falls back to a generic Arabic
  message if `detail` is missing, empty, or names no recognized field.
- `401` → `"البريد الإلكتروني أو كلمة المرور غير صحيحة."` (login/register), or
  triggers the refresh-and-replay flow for any other authenticated request
  (see UNCONFIRMED section below).
- Network error / timeout / `5xx` → generic Arabic network/server message,
  retried automatically with backoff (see `src/lib/api/resilience.ts`).

## GET /api/ready

Implemented in `src/features/home/api.ts` (`checkBackendReady`), used by
`src/features/home/components/StatusPill.tsx`.

Auth required: no.

Parameters: none.

Response `200` (`application/json`): an arbitrary, undocumented object (e.g.
`{ "additionalProp1": {} }`). **Do not parse the body.** The entire contract
is the HTTP status: `200` means the backend is reachable; any other status,
or a network error/timeout, means it isn't.

No other response codes are documented.

## POST /api/document/analyze

Implemented in `src/features/scan/api.ts` (`analyzeDocument`), used by
`src/app/(tabs)/scan.tsx`.

Auth required: no (no Authorization header is required by this endpoint; the
shared `apiClient` request interceptor attaches one anyway if a token happens
to be stored, which is harmless and ignored by the backend).

Request body: `multipart/form-data` with these parts:
- `file` — the captured photo (the only part this app sends)
- `text` — optional, omitted
- `session_id` — optional, omitted

Response `200` (`application/json`):
```json
{
  "document_type": "string",
  "summary_arabic": "string",
  "fields": [ { "additionalProp1": "string" } ],
  "next_steps": ["string"],
  "document_id": 0
}
```
`fields` is an **array of objects with backend-chosen keys** — the Swagger's
`additionalProp1/2/3` placeholders mean "arbitrary key names", not literal
ones. See `src/features/scan/fields.ts` (flattening) and
`src/features/scan/rowMapping.ts` (the single edit point for mapping real
backend keys onto this app's 7 fixed rows) for how this app handles that.

Response `422` (validation error): identical `detail` array shape to the
auth endpoints above.

**`/api/documents/upload` also exists but is deliberately NOT used here** —
it only returns `{doc_id, status, message}` with no analysis, so calling it
from the scan screen would upload the same image twice for no benefit. The
scan screen calls `/api/document/analyze` only.

## UNCONFIRMED / MISSING

- **No refresh-token endpoint exists in this Swagger.** Only `register`,
  `login`, and `me` are documented. `src/lib/api/resilience.ts` (lines
  ~27–40) still calls `POST /api/auth/refresh` on every 401 from a
  non-auth endpoint, assuming it returns the same
  `{access_token, refresh_token, token_type, user}` shape as login/register.
  This was deliberately left untouched this session per instruction — it is
  unverified against the real backend and may 404. Until a real refresh
  contract is confirmed, **any 401 on an authenticated request will cause an
  immediate logout** (the refresh call fails, tokens are cleared, and the
  user is bounced to `/login`) rather than a silent, transparent refresh.
  This needs a real answer from the backend team before it can be trusted.

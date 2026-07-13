# Handoff — سهّلها (Sahelha)

Rewritten from scratch on 2026-07-13 (second rewrite same day — see below).
For overall project status, read `docs/PROJECT_STATUS.md`. For
folder-placement rules, read `docs/ARCHITECTURE.md` (still accurate,
untouched across both of today's sessions). For the confirmed API contract
(auth + readiness + document analyze), read `docs/API.md`.

## What this session changed

Task: wire the Home screen's status pill to a real backend readiness check,
and wire the Scan screen's capture → confirm → analyze flow against an
official Swagger (authoritative over any prior assumption in this repo).
Auth/login/register/landing/chat/services were explicitly out of scope and
untouched. No voice/audio/TTS was built this round — every speaker button is
intentionally inert.

- **`expo-image-picker` installed** via `npx expo install expo-image-picker`
  (resolved to `~57.0.2`, matching SDK 57). No other dependency was added.
- **`app.json`** — added an `expo-image-picker` plugin entry: `cameraPermission`
  (sets `NSCameraUsageDescription` on iOS; Android's `CAMERA` permission
  comes from the library's own manifest and needed no separate entry),
  `photosPermission: false` and `microphonePermission: false` to block the
  photo-library and audio-recording permissions this app never asks for
  (this screen only ever calls `launchCameraAsync`, never the image
  library or video capture).
- **`src/features/home/api.ts`** — new. `checkBackendReady()` calls
  `GET /api/ready` and returns `true` only on HTTP 200; the response body is
  never parsed (Swagger documents no fixed shape for it).
- **`src/features/home/components/StatusPill.tsx`** — rewritten. Was a
  static, always-green, always-"صوت والموقع يعملان" claim connected to
  nothing. Now: three real states (loading/ready/unavailable) driven by
  `checkBackendReady()`, checked on Home mount and re-checked on tap
  (`Pressable`, `accessibilityRole="button"`). State is carried in the
  visible Arabic text and the `accessibilityLabel` — never colour alone, per
  the accessibility hard constraint (colour is decorative-only and marked
  `accessibilityElementsHidden`). The ready text now only claims the server
  is reachable — the old false "voice and location work" claim is gone,
  since nothing checks either this round.
- **`src/features/scan/api.ts`** — new. `analyzeDocument(photoUri)` posts a
  `multipart/form-data` body (one `file` part) to
  `POST /api/document/analyze`.
- **`src/features/scan/fields.ts`** — new. `flattenAnalyzeFields()`, a pure
  helper that walks the response's `fields` (array of objects with
  backend-chosen keys) into a flat, ordered `{label, value}` list. Never
  throws; skips non-object entries and null/undefined values; coerces every
  value with `String()`.
- **`src/features/scan/rowMapping.ts`** — new. `SCAN_ROW_KEY_MAP`, the single
  lookup mapping guessed backend field keys onto this app's 7 fixed row ids.
  This is the one place to edit once a real response is seen.
- **`src/features/scan/resultRows.ts`** — new. `buildScanResultRows()`
  assembles the full row list: a new pinned "جميع المعلومات" summary row
  (from `summary_arabic`), the 7 existing hardcoded rows (populated from
  matched fields, or "—" if unmatched), then any leftover backend fields
  that didn't match a known row — nothing from the backend is ever silently
  dropped.
- **`src/features/scan/components/ExtractRow.tsx`** — now takes `label` AND
  `value` (was label-only), plus a per-row speaker button (`Pressable`,
  56×56pt, distinct Arabic `accessibilityLabel` naming the row, `onPress` is
  an empty `// TODO` — no audio this round). The row itself is a plain
  `View`, not a `Pressable`, so there's no touch-conflict between "the row"
  and "the speaker button" — only the speaker button is interactive.
- **`src/features/scan/components/CameraPreviewPlaceholder.tsx`** — now
  accepts an optional `photoUri`; shows the captured photo in the same box
  when present, the original camera-icon empty state otherwise. No live
  viewfinder was built — see next bullet for why.
- **`src/app/(tabs)/scan.tsx`** — rewritten. Full flow: empty state → tap
  "صوّر المستند" → request camera permission → `expo-image-picker`'s
  `launchCameraAsync` (the **system** camera — deliberately not
  `expo-camera`/a live preview, since a live viewfinder is useless to a
  blind user and the system camera already ships with Android's own
  accessibility support) → captured state shows the photo plus "أعد
  التصوير"/"تأكيد وتحليل" → confirm calls `analyzeDocument()`, announces
  loading via `AccessibilityInfo.announceForAccessibility`, and on
  success/failure returns to the captured state with either populated rows
  or a readable Arabic error (via the existing `errors.ts`/`ApiError` path,
  including 422 field-naming). Permission-denied shows a retry-capable
  Arabic message; permanently-denied shows a "فتح الإعدادات" button that
  calls `Linking.openSettings()`.

**Not changed:** `src/lib/api/resilience.ts`, `src/lib/api/client.ts`,
`src/lib/api/tokenStore.ts`, `src/lib/config.ts`, all auth files, the landing
page, `chat.tsx`/`services/*`, any Babel/Metro/Tailwind config.

## Confirmed contract this session added (see docs/API.md for full detail)

| Endpoint | Method | Auth | Notes |
|---|---|---|---|
| `/api/ready` | GET | no | body is arbitrary/undocumented — only the HTTP status matters |
| `/api/document/analyze` | POST | no | `multipart/form-data`, `file` part only; returns `document_type`, `summary_arabic`, `fields[]`, `next_steps[]`, `document_id` |

`/api/documents/upload` also exists but is deliberately unused (see
`docs/API.md`) — it returns no analysis, so calling it here would upload the
image twice for nothing.

`document_type` and `next_steps` are presented via the dedicated typed
fields on the response (not guessed from `fields`), since they're more
reliable than a key-name guess: `document_type` fills the "نوع المستند" row
directly, and `next_steps` (an array) is joined with newlines into the
"الخطوة التالية" row, one step per line. `document_id` is kept in component
state (the whole analyze response is stored) for later features — nothing
displays it yet.

## Still stubbed / open questions

- **Every speaker button is inert.** All 8 result rows (summary + 7) have a
  real, accessible, distinctly-labelled `Pressable` speaker button, but
  `onPress` is an empty function tagged `// TODO: wire TTS in the next
  prompt`. No audio/TTS/STT package was installed or called this round.
- **The backend's real `fields` key names are unknown.** `SCAN_ROW_KEY_MAP`
  in `src/features/scan/rowMapping.ts` contains best-guess key names. Until
  a real response is seen, most/all fields will likely land in the
  "leftover" rows below the 7 rather than matching directly — check a real
  response and update that one file.
- **No refresh-token endpoint exists in the auth Swagger** (carried over
  from the previous session, still unresolved — see `docs/API.md`'s
  UNCONFIRMED section). `src/lib/api/resilience.ts` still assumes
  `POST /api/auth/refresh` exists.
- **`EXPO_PUBLIC_API_BASE_URL` is still the placeholder `https://REPLACE_ME`**
  — no `.env` file exists. Nothing this session could make a real network
  call. The backend also runs on Render's free tier with a 30–60s cold-start
  — the existing `API_TIMEOUT_MS`/`API_MAX_RETRIES` config
  (`src/lib/config.ts`) was deliberately left unchanged per instruction, but
  it's worth checking whether the default timeout/retry budget comfortably
  covers a cold start once real testing starts, especially for `/api/ready`.
- The other 5 not-yet-built feature screens (voice assistant, document
  read/simplify, archive + expiry alerts, in-office navigation, document
  shortcuts/sharing) are untouched — see `docs/PROJECT_STATUS.md` §5.
- The landing page's placeholder English/SaaS-template copy is untouched —
  see `docs/PROJECT_STATUS.md` §10.
- No route guard exists preventing an unauthenticated user from reaching
  `/(tabs)` directly — noted in the previous handoff, still true, still not
  built (out of scope both sessions).

## Verification performed / not performed

- `npx tsc --noEmit` — passes, no errors, after all of this session's edits.
- `npx expo export --platform web` — bundles successfully (996 modules,
  including the new `expo-image-picker` import), confirming Metro resolves
  everything. Output goes to the gitignored `dist/`.
- **Not verified:** no real network call was made against `/api/ready` or
  `/api/document/analyze` (base URL is still the placeholder). Nothing was
  run on an Android device/emulator. No screen-reader (TalkBack/VoiceOver)
  test was performed. No test with the system font size scaled up was
  performed. The camera capture flow itself has never been exercised on a
  real device.

## Next steps

1. Get a real `EXPO_PUBLIC_API_BASE_URL` into a local `.env`, then run the
   scan flow against a real backend once to see one real
   `/api/document/analyze` response — update `SCAN_ROW_KEY_MAP` in
   `src/features/scan/rowMapping.ts` to match the real keys.
2. Build the actual TTS/voice wiring behind the 8 stubbed speaker buttons —
   explicitly deferred to "the next prompt" per this session's scope.
3. Resolve the refresh-token question with the backend team (carried over,
   see `docs/API.md`).
4. Run this on an actual Android device/emulator at least once — camera
   permission flow, captured-photo rendering, and the analyze call have
   only been type-checked and bundle-checked, never executed.
5. Everything in `docs/PROJECT_STATUS.md` §11 (landing page rewrite, first
   full accessibility pass with TalkBack + scaled fonts) remains open.

# Handoff — سهّلها (Sahelha)

Rewritten from scratch on 2026-07-13 (second rewrite same day — see below).
Extended 2026-07-15 with TTS/voice wiring (see below). For overall project
status, read `docs/PROJECT_STATUS.md`. For folder-placement rules, read
`docs/ARCHITECTURE.md` (still accurate, untouched). For the confirmed API
contract (auth + readiness + document analyze + voice TTS), read
`docs/API.md`.

## What the 2026-07-15 session changed

Task: wire the Scan screen's 8 previously-stubbed speaker buttons to real
backend text-to-speech, and gate the result rows on a successful analyze
response instead of always rendering placeholder "—" rows. Auth/register/
landing/chat/services were out of scope and untouched except for removing
three temporary diagnostic `console.log` calls (see below).

- **`expo-audio` installed** via `npx expo install expo-audio` (resolved to
  `~57.0.0`, matching SDK 57). No other dependency was added. `app.json`
  got an auto-added `"expo-audio"` plugin entry (no options needed — this
  app only plays audio, never records, so none of expo-audio's recording
  permissions apply).
- **`src/features/scan/api.ts`** — added `speakText(text)`, which posts
  `{ text, language: "ar" }` to `POST /api/voice/tts` through the shared
  `apiClient` (so the bearer token is attached automatically) and returns
  `{ audio_url }`.
- **`src/features/scan/audioUrl.ts`** — new. `resolveTtsAudioUrl()`, a pure
  helper that turns whatever shape `audio_url` comes back as (absolute URL /
  root-relative path / bare cache key) into a playable URL. See
  `docs/API.md` for the three cases.
- **`src/features/scan/useTtsPlayer.ts`** — new hook. Owns a single
  `expo-audio` `AudioPlayer` instance: `speak(text, rowId)` stops/unloads
  any currently-playing clip first (only one clip plays at a time), fetches
  TTS, resolves the URL, `seekTo(0)` (expo-audio does not reset position on
  its own after a clip finishes) then `play()`s. Never called except from an
  explicit mic tap — no auto-play anywhere. Failures resolve through the
  existing `ApiError`/`errors.ts` path and are reported via an `onError`
  callback rather than thrown, so a failed TTS call can never crash the
  screen. Marked as a promotion candidate to `src/lib/` if a future feature
  besides Scan needs backend TTS.
- **`src/features/scan/useScreenReaderEnabled.ts`** — new hook wrapping
  `AccessibilityInfo.isScreenReaderEnabled()` + the `screenReaderChanged`
  subscription.
- **`src/app/(tabs)/scan.tsx`** — the 8 speaker buttons' `onPress` (summary
  row + 7 field rows) now call `speak(row.value, row.id)` instead of an
  empty TODO. Screen-reader coordination: the mic handler deliberately never
  calls `AccessibilityInfo.announceForAccessibility` with a row's text,
  since TTS audio is about to speak that exact content and doubling it with
  an announcement would produce two overlapping voices — see the comment at
  the mic handler. The existing "جارٍ تحليل المستند" loading announcement
  is unchanged. A TTS failure surfaces through the existing red error banner
  (`errorMessage` state, already used for capture/analyze errors) and, only
  when a screen reader is active, is also announced — safe because that's
  error copy, never the row text, and only fires when TTS never started
  playing.
- **Result-row gating** — `src/features/scan/resultRows.ts`'s
  `buildScanResultRows()` now takes a non-null `AnalyzeDocumentResponse`
  (was nullable) and no longer has a "no result yet" branch. `scan.tsx` only
  calls it when `analyzeResult` is set, and only renders the "يستخرج
  تلقائياً" section when there's at least one row — so no result rows (not
  even placeholder "—" ones) render during idle/captured/analyzing/error
  states, only after `analyzeDocument()` has actually resolved successfully.
  Per-field "—" placeholders for fields a real, successful response didn't
  populate are unchanged.
- **`src/features/scan/components/ExtractRow.tsx`** — added an optional
  `isSpeaking` prop that swaps the speaker icon (`volume-high-outline` →
  `stop-circle`) so "this row is currently loading/playing" has a visible
  signal beyond color, per the accessibility hard constraint.
- **Summary row label** changed from "جميع المعلومات" to the placeholder
  "ملخص" per this session's brief; still marked `// TODO(asma): final copy`.
- **Removed 3 temporary diagnostic `console.log` calls** (their debugging
  purpose was done): `src/lib/api/client.ts` (the request interceptor,
  2 calls), `src/features/auth/api.ts` (`login`'s catch block),
  `src/app/login.tsx` (the submit handler's catch block).

### Divergence flagged, not silently resolved

`src/lib/config.ts` (line 11) still has its own un-requested diagnostic
`console.log('API_BASE_URL =>', ...)`. This session's instructions named
exactly three files to clean up (`client.ts`, `api.ts`, `login.tsx`) and
this file wasn't one of them, so it was deliberately left as-is rather than
assumed to be in scope. Flagging here so it isn't lost — remove it in a
future session if it's actually meant to go.

## What the 2026-07-13 session changed

Task: wire the Home screen's status pill to a real backend readiness check,
and wire the Scan screen's capture → confirm → analyze flow against an
official Swagger (authoritative over any prior assumption in this repo).
Auth/login/register/landing/chat/services were explicitly out of scope and
untouched. No voice/audio/TTS was built that round — every speaker button
was intentionally inert (now wired, see above).

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

## Confirmed contract added 2026-07-15 (see docs/API.md for full detail)

| Endpoint | Method | Auth | Notes |
|---|---|---|---|
| `/api/voice/tts` | POST | **yes** (bearer) | `{text, language}` in, `{audio_url}` out; see `docs/API.md` for the 3-case URL resolution |

`/api/ai/ask` and `/api/audio/{cache_key}` also exist in the Swagger but
aren't integrated yet — see `docs/API.md`'s "Available in backend, not yet
integrated" section.

## Still stubbed / open questions

- **All 8 speaker buttons are now wired to real TTS** (as of 2026-07-15),
  but this has never been exercised against a live backend — `/api/voice/tts`
  has only been type-checked, never called against a real server (see
  Verification below).
- **⚠️ Flagged, not fixed: a signed-out mic tap can silently bounce the user
  out of Scan to `/login`.** `/api/document/analyze` requires no auth, so
  Scan works for a signed-out user — but `/api/voice/tts` does. Trace the
  consequence: a signed-out user taps a mic → `/api/voice/tts` 401s →
  `src/lib/api/resilience.ts`'s response interceptor treats *any* 401 from a
  non-auth endpoint the same way, regardless of which endpoint or how
  important the call is: it tries a token refresh, finds no refresh token
  stored, and calls `router.replace("/login")` — silently discarding
  whatever photo/analysis was on screen. This isn't a bug introduced this
  session (the blanket 401-handling policy in `resilience.ts` predates it
  and was explicitly out of scope to change), but wiring real auth-required
  calls into a screen that's otherwise auth-optional exposes it for the
  first time. This needs a product decision, not a silent code fix:
  either (a) require login before reaching Scan, or (b) special-case
  `resilience.ts` so a 401 on a "nice-to-have" call like TTS shows an error
  instead of redirecting. Left unresolved on purpose.
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

- `npx tsc --noEmit` — passes, no errors, after both the 2026-07-13 and
  2026-07-15 edits.
- `npx expo export --platform web` — bundled successfully as of 2026-07-13
  (996 modules, including `expo-image-picker`), confirming Metro resolves
  everything; not re-run on 2026-07-15 after adding `expo-audio`.
- **Not verified (2026-07-15):** no real network call was made against
  `/api/voice/tts` (base URL is still the placeholder — see below). No
  Android/iOS device or emulator run, so `expo-audio` playback itself
  (`createAudioPlayer`, `seekTo`, the `playbackStatusUpdate` listener) has
  never actually played a sound. No TalkBack/VoiceOver test of the
  anti-clash behavior (mic tap + no duplicate announcement). No test with
  the system font size scaled to 200%.
- **Not verified (carried over from 2026-07-13):** no real network call was
  made against `/api/ready` or `/api/document/analyze` either. The camera
  capture flow has never been exercised on a real device.

## Next steps

1. Get a real `EXPO_PUBLIC_API_BASE_URL` into a local `.env`, then run the
   full scan → analyze → mic → TTS chain against a real backend once:
   - Update `SCAN_ROW_KEY_MAP` in `src/features/scan/rowMapping.ts` to match
     the real `/api/document/analyze` field keys.
   - Confirm the real `/api/voice/tts` `audio_url` shape and that
     `resolveTtsAudioUrl()` (`src/features/scan/audioUrl.ts`) handles it —
     the three cases it covers are a defensive guess, not confirmed against
     a real response yet.
   - Decide what should happen when a signed-out user taps a mic (today:
     `/api/voice/tts` 401s and the friendly error banner shows, since scan
     itself doesn't require auth but TTS does).
2. Resolve the refresh-token question with the backend team (carried over,
   see `docs/API.md`).
3. Run this on an actual Android/iOS device or emulator at least once —
   camera capture, the analyze call, and now TTS audio playback have only
   been type-checked, never executed.
4. Everything in `docs/PROJECT_STATUS.md` §11 (landing page rewrite, first
   full accessibility pass with TalkBack + scaled fonts) remains open.

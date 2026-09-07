# 7-Day Frontend Sprint Plan — Sahelha Alya Demo

4 engineers, 10 hours/day, 7 consecutive days (70h/person, 280h total),
ending in a live demo. This is a crunch plan — it assumes full-time focus and
daily integration, not independent siloed work merged at the end.

This plan is grounded in three documents already in this repo — read them
before Day 1, not during it:
- [`docs/PROJECT_STATUS.md`](PROJECT_STATUS.md) — honest current-state audit of `SahelhaApp/`.
- [`docs/API.md`](API.md) — the confirmed backend contract this app currently uses.
- [`docs/HANDOFF.md`](HANDOFF.md) — what the last few sessions actually built.
- [`../../API_DOCUMENTATION.md`](../../API_DOCUMENTATION.md) — full backend reference (every endpoint, verified against the live source).
- [`../../SAHELHA_DESIGN_BRIEF.md`](../../SAHELHA_DESIGN_BRIEF.md) — brand + accessibility spec.

---

## 0. Where we're actually starting from

Be honest about this on Day 1 — it changes the plan:

- **The app has never been run on a device or emulator.** Every prior
  "verified" claim is a `tsc` type-check or a static bundle export. Getting
  it running on real hardware is a Day-1 task, not a Day-6 task.
- **Only 1 of 7 advertised features has a built screen** (document scan), and
  it currently calls the wrong backend endpoint for what this app actually
  needs (see §1.2).
- **The landing page is still the original English SaaS template** — fake
  founder, fake testimonials, fake logos, a features list that doesn't match
  the real product. This is a credibility risk in front of judges and must
  be rewritten.
- **Accessibility has never been tested with a screen reader or scaled
  font**, despite being this product's entire reason to exist. Every claim
  in the code about accessibility is unverified in practice.
- Two engineering assumptions baked into the current code are **confirmed
  wrong** against the real backend (§1.1) and must be fixed before anything
  else is built on top of them.

Given 7 days, **we are not attempting all 7 advertised features.** We are
building a smaller set of real, working, accessible, demoable features
end-to-end, and explicitly cutting the rest (see §6).

### 1.1 Two fixes required before any other frontend work starts

1. **Remove the token-refresh assumption.** `src/lib/api/resilience.ts` calls
   `POST /api/auth/refresh` on every 401 — **this endpoint does not exist on
   the backend** (confirmed directly against the backend source; only
   `register`/`login`/`me`/`fcm-token` exist under `/api/auth`). Replace this
   with: on any 401, clear tokens and redirect to `/login`, no refresh
   attempt. The access token lasts 24h, which is enough for a demo.
2. **`EXPO_PUBLIC_API_BASE_URL` must point at a real, running backend** before
   Day 1 ends. No `.env` exists today; the app is currently pointed at the
   literal placeholder `https://REPLACE_ME`. Get the real deployed backend
   URL (or a stable tunnel to a locally-run instance) and put it in a
   checked-in `.env` (or share it in the team channel) on Day 1 morning —
   nothing else in this plan can be verified without it.

Two things the existing docs got wrong that you do **not** need to fix
(already confirmed correct against the live backend, see
`docs/API.md`): the `/api` prefix is correct as-is, and `register`/`login`
**do** return a `user` object — no contract change needed there.

### 1.2 The single biggest architecture decision this sprint

The current Scan screen calls `POST /api/document/analyze` — a legacy,
**unauthenticated**, synchronous endpoint that does not attach the result to
a user account. That's fine for a quick demo of OCR, but it means: no
archive, no reminders, no "ask a question about this document" (the AI
assistant requires a `document_id` the caller owns), no document list, no
delete. **Every other feature this sprint depends on migrating Scan to the
real, authenticated pipeline**:

- `POST /api/documents/upload` (auth required, multipart, returns instantly
  with `{doc_id, status: "processing"}`)
- then poll `GET /api/documents/{doc_id}` every ~2–3s until `status` is
  `"done"` or `"failed"`.

This is also a **UX improvement**, not just a requirement: today's single
60-second POST either finishes or times out with nothing in between; polling
a fast, instant-returning upload plus short GETs degrades far more
gracefully against a slow/cold-starting backend (Render free tier).

**This migration is also the fix for "archive only stores the LLM result, not
the document."** Today's `/api/document/analyze` call processes the photo
from a temp file and deletes it — nothing is kept but OCR text and the AI
summary/fields, and it's not tied to a user at all. The real pipeline
(`/api/documents/upload`) persists the actual image to disk and serves it
back as `image_url` alongside the OCR text and AI analysis, scoped to the
uploading user, until they explicitly delete it. There is no separate task
for this — it falls out of the migration below.

This migration is Day 1's highest-priority engineering task (§3, Engineer B).

---

## 2. Sprint goal

By Day 7, on at least two physical Android devices, an unaided run-through
of this exact journey works, with a screen reader on, at 150%+ system font
scale, with no crash:

**Register/login → scan a real document with the camera → watch it process
→ see the Arabic summary and extracted fields, each speakable → ask a
spoken question about that document and hear a spoken answer → see it
appear in the archive and find it again by search → see a reminder was
auto-created if it has an expiry date → share it via QR → adjust an
accessibility setting.**

Everything in this plan is organized around making that one journey real,
not around building the maximum number of screens.

---

## 3. Team & ownership

Swap in real names — roles are assigned by what needs the most continuity of
ownership, not seniority.

| | Owns | Primary backend endpoints |
|---|---|---|
| **Engineer A** — Core/Infra lead | API client fixes, auth, session/route guards, Settings + accessibility toggles, Nearby Offices screen, native build (Day 6), demo device wrangling | `/api/auth/*`, `/api/offices/nearby` |
| **Engineer B** — Document pipeline lead | Scan → upload → poll migration, Document Detail screen, Home document list, Archive/Search | `/api/documents/*`, `/api/archive/*` |
| **Engineer C** — AI & Voice lead | Recording UI, the real AI Assistant screen (replaces `chat.tsx`), TTS playback, conversation/session handling | `/api/ai/ask`, `/api/voice/*` |
| **Engineer D** — Reminders, content & accessibility lead | Reminders screen, Share/QR screen, FCM permission copy, landing-page rewrite, cross-app accessibility audit, demo content prep | `/api/reminders/*`, `/api/archive/share/*` |

**Ground rules:**
- **Daily 15-min standup** at the start of the day, **30-min integration
  sync** at the end — with a 7-day, 10h/day pace, undiscovered integration
  problems compound fast. Don't skip these to "save time."
- One shared branch strategy: short-lived feature branches, merged into a
  single `sprint` branch **at least once a day** (end of the integration
  sync) — never let 4 people's work diverge for more than a day.
- **Definition of done for any screen:** wired to the real backend (no mock
  data), has a loading/empty/error state, has correct `accessibilityLabel`s,
  works at 150%+ font scale, tested on a real device by someone other than
  who built it.
- Every engineer needs the app running on their own physical Android device
  by end of Day 1 — this is non-negotiable given it's never happened before.

---

## 4. Day-by-day plan

### Day 1 — Unblock everyone, fix the two landmines

**All 4, first 90 minutes together:**
- Walk through `API_DOCUMENTATION.md` and `SAHELHA_DESIGN_BRIEF.md`.
- Agree on the navigation restructure (§5) so nobody builds against the old
  IA.
- Get the real backend URL into a shared `.env`.
- Each person runs `expo start` and loads the app on their **own physical
  Android phone** — surface and triage any environment problems immediately
  as a group, since this blocks all 4 people equally.

**Then split:**
- **A:** Fix `resilience.ts` (remove the fake refresh flow, §1.1). Add a
  route guard so `/(tabs)/*` redirects to `/login` when signed out. Confirm
  register → login → `GET /api/auth/me` round-trips against the real backend
  on-device.
- **B:** Start the Scan migration (§1.2): replace `analyzeDocument()`'s call
  to `/api/document/analyze` with `uploadDocument()` → `/api/documents/upload`,
  plus a `pollDocument()` helper hitting `GET /api/documents/{doc_id}` every
  2–3s (cap ~45s, then show a "still working — check back" state rather than
  a hard failure, since Render's cold start can be slow). Update the result
  mapping to the **real, confirmed** response fields: `doc_type`,
  `ai_summary`, `ocr_text`, `entities.{name,address,governorate}`, `dates`,
  `amounts`, `expiry_date`, `tags`, `image_url` — delete the old guessed
  `SCAN_ROW_KEY_MAP`, it's no longer needed now that the real shape is known.
- **C:** Add microphone recording (check whether `expo-audio`'s recorder API
  is sufficient on SDK 57, or add `expo-av`'s `Audio.Recording` if not).
  Scaffold the new AI Assistant screen (chat-bubble layout per the design
  brief) to replace `chat.tsx`. Stub it against a hardcoded `document_id` for
  now so UI work isn't blocked on B's migration finishing.
- **D:** Turn `src/styles/theme.ts` from dead code into the actual source of
  truth for colors/type scale, using the accessible palette from
  `SAHELHA_DESIGN_BRIEF.md` §3 (7:1-contrast derived tokens, not the raw deck
  colors). Wire Home's document list to real data:
  `GET /api/documents/`, with loading/empty states.

**Exit criterion:** at least one device shows login → Home with a real
(possibly empty) document list, and B's upload call successfully returns a
`doc_id`.

### Day 2 — First real end-to-end slice

- **A:** Build the real Settings screen: font-size control, high-contrast
  and dark-mode toggles wired to D's new theme tokens, FCM permission
  request + `PUT /api/auth/fcm-token`, logout. Wire it to Home's
  (currently no-op) settings icon.
- **B:** Finish the upload→poll migration; build the missing **Document
  Detail screen** (there isn't one today) — auto-playing summary, per-field
  speak buttons (reuse the existing `ExtractRow` speaker pattern), delete
  action with a spoken confirm step.
- **C:** Wire the AI Assistant screen for real: `POST /api/ai/ask`
  (multipart: `document_id`, `session_id`, `question` or `audio`); auto-play
  `answer_audio_url`; persist `session_id` per document locally so the
  thread continues on return visits. Press-and-hold record button with
  audio+haptic start/stop cues.
- **D:** Rewrite the landing page copy completely — real Arabic content
  about this product, this team, and the real 7-feature list (marking
  unbuilt ones "قريبًا" / coming soon per the design brief), removing every
  fake founder/testimonial/logo/generic-FAQ. Start the Archive screen shell
  (search field + tag chips, UI only).

**Exit criterion:** someone can scan a document, wait for it to process, and
ask a real spoken question about it, and hear a real spoken answer — the
product's core "wow" moment works once, even roughly.

### Day 3 — Archive, reminders, sharing

- **A:** Global error boundary + slow-network/cold-start messaging polish
  (loading copy that explains *why* it's slow, not a spinner that looks
  broken). Trim Home's 7 feature cards down to what's real this sprint (§6),
  labeling deferred ones clearly. **Add the Nearby Offices screen**: request
  location permission (`expo-location` — new dependency), call
  `GET /api/offices/nearby?lat=&lng=`, render a simple distance-sorted list
  (name, address, hours, phone, distance). No auth, no polling — this is the
  cheapest real feature in the whole sprint, and demos well (it's literally
  driven by whatever GPS coordinates the demo device reports).
- **B:** Wire Archive to `GET /api/archive/search?q=&tags=`; reuse the
  document-list item component from Home so it's one component, not two.
- **C:** Build the Reminders screen: list (`GET /api/reminders/`), manual
  create (`POST /api/reminders/` — prefer a clearly labeled date picker over
  voice-to-date parsing this week; that's a real speech-parsing problem,
  not worth the risk in a 7-day sprint), delete. Visually/verbally
  distinguish auto-created (expiry-based) vs. manual reminders.
- **D:** Build the Share screen: render the QR from
  `GET /api/archive/share/{doc_id}`'s base64 image **plus** the plain
  `share_url` as selectable/copyable text (never QR-only, per the design
  brief — a QR code is a visual-only mechanism). Continue the accessibility
  pass on the still-untouched screens (old `chat.tsx`/`services/*` remnants,
  `+not-found.tsx`).

**Exit criterion:** every screen in the sprint-goal journey (§2) exists and
is individually wired to the real backend — nothing is polished or
integrated yet, but nothing is a placeholder either.

### Day 4 — Integration day

- **All 4, together, most of the day.** Merge everything into `sprint`.
  Walk the full journey from §2 on a real device, as a group, start to
  finish, more than once.
- Fix what breaks — expect this to be the buggiest day; that's the point of
  doing it now and not on Day 6.
- Explicitly resolve the previously-flagged "signed-out user hits an
  auth-required call and gets silently bounced" issue: since Scan now
  requires login (it calls the authenticated upload endpoint), this mostly
  resolves itself — confirm the route guard from Day 1 actually prevents a
  signed-out user from reaching Scan at all, rather than letting them in and
  failing later.

**Exit criterion:** one person, unaided, completes the full §2 journey on a
real device without a crash. If this doesn't happen today, Day 5's
accessibility work is at risk — treat slipping this as the loudest possible
alarm bell for the week.

### Day 5 — Accessibility hardening

Pair up (A+B, C+D), then swap in the afternoon so every screen gets two
independent passes:

- **Screen-reader pass:** TalkBack on, walk every real screen. Fix missing
  or wrong `accessibilityLabel`s, check focus order (should match RTL
  reading order), confirm async state changes (processing → done, an AI
  answer arriving) are actually announced, not just visually updated.
- **Font-scaling pass:** system font size at 200%, same screens. Fix any
  clipping, overlap, or truncation; confirm nothing sets
  `allowFontScaling={false}`.
- **Contrast pass:** verify the derived palette from Day 1 actually hits the
  7:1/4.5:1 targets from the design brief in both light, dark, and
  high-contrast modes — don't eyeball it, check real computed values.
- Clean up dead weight while you're in each file: unused dependencies
  (`react-native-reanimated`, `react-native-worklets`, `expo-constants`,
  `expo-linking` if still unused), stray `console.log`s, the superseded
  `SCAN_ROW_KEY_MAP`.

**Exit criterion:** every screen in the sprint-goal journey has been
TalkBack-tested and scaled-font-tested by someone, with issues found fixed,
not just logged.

### Day 6 — Native build & content polish

- **A:** Produce a real, installable Android build (`eas build` or a local
  `expo prebuild` + Gradle build) — this is the literal deliverable and has
  never been attempted. Budget real time for first-build native-config
  issues (permissions in `app.json`, signing).
- **B:** Stress-test the upload/poll flow specifically against a cold-started
  backend; tune polling interval/timeout copy so it never reads as "stuck."
- **C:** Polish the AI assistant's perceived latency (a clear
  "جارٍ التفكير…" state) and confirm multi-turn memory survives the app
  being backgrounded and reopened.
- **D:** Final full-app Arabic copy pass — zero leftover English or
  placeholder text anywhere, including error states and empty states. Shoot
  and prepare 2–3 realistic demo document photos (ID-card-shaped,
  utility-bill-shaped, one with a clear expiry date) with known expected
  output — a scripted demo beats live-improvising OCR quality.

**Exit criterion:** an installed APK, on at least two physical devices,
completes the full journey twice each without a crash.

### Day 7 — Demo day

- **Morning, all 4:** final smoke test on the actual demo device(s) and — if
  knowable — the actual demo network. **Code freeze**: release-blocking bug
  fixes only, no new work.
- **Prepare a fallback:** a pre-recorded screen capture of the full journey,
  and a pre-seeded demo account with 2–3 already-processed documents, so the
  demo isn't hostage to live OCR/AI latency for every single beat.
- **Assign demo roles** explicitly: who holds/drives the device, who
  narrates, who is silently on standby to recover if something stalls.
  Script the highest-value, highest-risk beat (the live voice Q&A) exactly —
  which document, the precise question to ask, the expected answer, and what
  to do if the mic mishears it.
- **Rehearse twice, timed**, before the actual demo slot.

---

## 5. Navigation decision (confirm before Day 1 work starts)

Replace the current 4-tab bar (`Home | المساعد (placeholder) | تصوير مستند |
الخدمات (placeholder)`) with:

**Bottom tabs: الرئيسية (Home) · تصوير (Scan) · الأرشيف (Archive) ·
التذكيرات (Reminders)**

- The AI Assistant is **not** a standalone tab — the backend's `/api/ai/ask`
  is scoped to a specific document (`document_id` is required), so it's
  reached from a document's Detail screen via a prominent "اسأل عن هذا
  المستند" button, matching the real API shape instead of fighting it.
- The old `services/*` placeholder tab (a static, unrelated 3-item list) is
  removed from the tab bar for this sprint — it doesn't correspond to any of
  the features being built and would only confuse a demo. It can return
  later as the design brief's §6.11 "nearby offices" roadmap item.
- Settings is reached from Home's header icon (already present, currently a
  no-op) rather than a fifth tab, to keep the tab bar small and unambiguous
  for a low-vision user.

---

## 6. Scope: what we are and aren't building this sprint

**Building (the sprint-goal journey, §2):** auth, document scan → upload →
process → detail, AI voice Q&A on a document, archive/search, reminders
(auto + manual), share/QR, accessibility settings, a rewritten landing page.

**Building, in addition to §2's journey:** locating nearby government
offices (`GET /api/offices/nearby` — real, already works, cheap to wire; see
Day 3).

**Explicitly cut this sprint** (label as "قريبًا" / coming soon in the UI,
per the design brief, rather than building a broken version):
- Voice-driven form filling.
- Document reading/language-simplification as a separate feature (the
  document-detail screen's spoken summary already covers the core of this).
- **In-office navigation guidance** (indoor wayfinding once you're inside a
  building) — do not confuse this with "locating nearby offices" above,
  which *is* in scope. The frontend's own `HOME_FEATURES` data currently
  labels one card "إرشادك داخل المصالح الحكومية" (guide me inside the
  building), which conflates the two — split it into two cards, ship the
  "find a nearby office" one, mark the indoor-guidance one "قريبًا". There is
  no backend support at all for indoor wayfinding (no indoor maps, nothing
  built) — this is a hard cut, not a time-permitting one.
- One-gesture document shortcuts.
- A backend refresh-token flow (not possible this sprint since the backend
  doesn't have the endpoint — flag it to whoever owns the backend as a
  post-sprint follow-up, not something the frontend can solve alone).

**If Day 4's integration exit criterion slips**, cut in this order to
protect the demo: manual reminder creation (keep auto-created only) → Share
screen → Archive tag filtering (keep free-text search only) → Settings'
dark-mode toggle (keep high-contrast + font-size only). Do **not** cut the
accessibility pass (Day 5) or the native build (Day 6) to make up time —
those two are the actual deliverable and the actual audience.

---

## 7. Top risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| App has never run on real hardware | Could surface fundamental native-config problems late | Forced onto Day 1 for all 4 people, not deferred |
| Render free-tier cold start (30–60s) | Could make every demo action look broken | Upload-then-poll (§1.2) instead of one long request; explicit "waking up" loading copy |
| Voice recording API surface unproven in this Expo SDK | Blocks the core AI-assistant feature | Time-boxed spike first thing Day 1 (Engineer C); fallback to typed questions if recording proves unworkable in time |
| No backend refresh-token endpoint | 401s log the user out mid-demo | Session lasts 24h; make sure the demo account logs in fresh each day and isn't left running for 24h+ |
| Accessibility work compressed into one day | It's the product's actual value proposition | Days 1–3 already bake in labels/contrast/scaling as part of "definition of done," so Day 5 is hardening, not starting from zero |
| Live demo network/device failure | Total demo loss | Pre-recorded fallback video + pre-seeded account (Day 7) |

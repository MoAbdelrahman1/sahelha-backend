# Project Status Audit — Sahelha Alya (سهّلها)

Written for someone with zero prior context, picking this project up cold.
Every claim below was checked by opening the actual file — file paths and
line numbers are included so you can verify anything here yourself. Where a
fact was not directly checkable (e.g. "has this ever run on a phone"), it is
marked **unverified** rather than guessed at.

Audit date: this reflects the code in `SahelhaApp/` at the time this file was
written. Nothing was changed to produce it — this is read-only documentation.

---

## 1. What this app is

Sahelha Alya (Arabic: سهّلها / "سهلها عليا" in-app) is an Arabic-language,
accessibility-first mobile app for people with visual impairments who need
help dealing with government paperwork and services (Tunisia/Arabic-speaking
context, based on the in-app copy — "المصالح الحكومية" = "government
offices/agencies"). It is built with Expo + React Native + Expo Router,
styled with NativeWind (Tailwind for React Native), and is entirely
right-to-left, Arabic-text, large-bold-high-contrast UI by design. The app
advertises 7 core features on its Home screen — document scanning +
summarization, a voice assistant with voice-driven form filling, document
reading/language-simplification, a document archive with expiry alerts,
in-person navigation guidance inside government offices, one-gesture
shortcuts to important documents, and easy document sharing — reachable
after logging in or registering. The stated hackathon deliverable is an
Android APK; **the app has never been run on Android or any physical/emulated
device in this project's history** (see §10).

---

## 2. Tech stack & versions

Read directly from `package.json`.

| Package | Version |
|---|---|
| `expo` | `~57.0.4` (**Expo SDK 57**) |
| `expo-router` | `~57.0.4` |
| `react` | `19.2.3` |
| `react-native` | `0.86.0` |
| `nativewind` | `^4.2.6` |
| `tailwindcss` | `^3.4.19` |
| `axios` | `^1.18.1` |
| `expo-secure-store` | `~57.0.0` |
| `@react-native-community/netinfo` | `12.0.1` |
| `@expo/vector-icons` | `^15.1.1` |
| `expo-status-bar` | `~57.0.0` |
| `expo-constants` | `~57.0.3` |
| `expo-linking` | `~57.0.2` |
| `react-native-safe-area-context` | `~5.7.0` |
| `react-native-screens` | `4.25.2` |
| `react-native-web` | `^0.21.2` |
| `react-native-reanimated` | `^4.5.0` |
| `react-native-worklets` | `^0.10.0` |
| `typescript` (dev) | `~6.0.3` |
| `babel-preset-expo` (dev) | `~57.0.2` |
| `babel-plugin-module-resolver` (dev) | `^5.0.3` |

`main` is `"expo-router/entry"`. No test runner, no linter config, and no
`expo-camera` / `expo-image-picker` / any camera or voice/speech package is
installed at all — confirmed by grepping `package.json` and `src/`.

---

## 3. File architecture

Expo Router resolves the routes directory at the project root `app/`, or
`src/app/` if that doesn't exist. This project uses `src/app/` — every file
under it is a route. The `@/*` TypeScript/Metro path alias points at `./src/*`
(configured in both `tsconfig.json` and `babel.config.js` — see
`docs/ARCHITECTURE.md` for why both are needed).

```
src/
├── app/                                    Expo Router routes
│   ├── _layout.tsx                         Root Stack; imports global.css; sets I18nManager RTL flags on load
│   ├── +not-found.tsx                      Generic 404 fallback (NOT restyled to match the rest of the app)
│   ├── index.tsx                           Landing screen — thin composition of src/features/landing/*. App's entry route ("/")
│   ├── login.tsx                           Login screen
│   ├── register.tsx                        Register screen
│   └── (tabs)/                             Bottom-tab group
│       ├── _layout.tsx                     Tab bar: index (Home), chat, scan, services
│       ├── index.tsx                       Home screen — header, status pill, voice button, 7 feature cards, footer hint
│       ├── chat.tsx                        Placeholder "المساعد" (voice assistant) screen — just a title + "قيد الإنشاء"
│       ├── scan.tsx                        Scan screen (Feature 1 UI) — header, camera placeholder, action button, extract list
│       └── services/
│           ├── _layout.tsx                 Nested Stack for the services sub-group
│           ├── index.tsx                   Placeholder "الخدمات" list — 3 hardcoded sample services
│           └── [serviceId].tsx             Placeholder service detail screen — shows the raw id, "قيد الإنشاء"
├── components/
│   └── ui/
│       └── Button.tsx                      Generic variant Button (primary/secondary/dark); only used by landing components today
├── features/
│   ├── auth/
│   │   ├── api.ts                          login/register/getMe calls; declares AuthUser/AuthResponse types
│   │   ├── validation.ts                   Pure validation + char-check functions (email/password/name/phone)
│   │   └── components/
│   │       ├── AuthScreenShell.tsx         Shared white-card-on-blue-background wrapper for login/register
│   │       └── ValidatedField.tsx          Shared 3-state (neutral/red/green) validated TextInput
│   ├── home/
│   │   ├── data.ts                         HOME_FEATURES array (7 entries) — only entry 1 ("scan-summarize") has a `route`
│   │   └── components/
│   │       ├── FeatureCard.tsx             Reusable feature-card row (icon tile, title/subtitle, chevron)
│   │       ├── HomeHeader.tsx              Greeting + app name + notification/settings icon buttons (both no-op)
│   │       ├── StatusPill.tsx              Static "النظام جاهز" bar — not driven by any real system check
│   │       └── VoiceButton.tsx             Full-width mic CTA; onPress is a no-op supplied by the Home screen
│   ├── landing/
│   │   └── components/                     13 files, one per landing-page section (see §10 — content is placeholder)
│   │       ├── primitives.tsx              Container/Section/Pill/Highlight layout helpers
│   │       ├── Header.tsx                  Top nav bar — "Features"/"FAQ" are inert text, not links
│   │       ├── Hero.tsx                    Hero headline + CTAs + decorative mock-UI graphic
│   │       ├── TrustedBy.tsx               Fake "Trusted by" logo strip
│   │       ├── FounderIntro.tsx            Fake founder bio card
│   │       ├── ProblemSolution.tsx         Generic problem/solution marketing copy
│   │       ├── Features.tsx                Generic 6-item feature grid — does NOT match the real 7 app features
│   │       ├── HowItWorks.tsx              Generic 3-step "How it works" cards
│   │       ├── FounderStory.tsx            More generic founder-story copy
│   │       ├── Reviews.tsx                 3 fake testimonials
│   │       ├── FAQ.tsx                     4 generic SaaS FAQ items, unrelated to this app
│   │       ├── Subscribe.tsx               Fake newsletter box — its Button has no onPress at all
│   │       ├── FinalCTA.tsx                Bottom "Get Started" banner, generic copy
│   │       └── Footer.tsx                  Footer — "Features/FAQ/Contact" are inert text
│   └── scan/
│       ├── data.ts                         SCAN_EXTRACT_ITEMS array (7 informational row labels)
│       └── components/
│           ├── CameraPreviewPlaceholder.tsx  Static camera-icon box; TODO marks where a real preview mounts
│           └── ExtractRow.tsx              One reusable bullet+label row
├── lib/
│   ├── config.ts                           Reads EXPO_PUBLIC_* env vars (base URL, timeout, retry count/delay), with fallbacks
│   └── api/
│       ├── client.ts                       Creates the shared `apiClient` + bare `rawClient` axios instances; attaches auth header
│       ├── resilience.ts                   Retry-with-backoff, single-flight 401→refresh→replay, fail-queue enqueue
│       ├── failQueue.ts                    Bounded (20) in-memory failed-request queue; manual + NetInfo auto-drain
│       ├── tokenStore.ts                   expo-secure-store wrapper (save/get/clear access+refresh tokens)
│       └── errors.ts                       ApiError class + classifier producing Arabic-language friendly messages
└── styles/
    └── theme.ts                            `colors`/`a11y` constants — NOT imported anywhere (dead code, verified by grep)
```

Root-level files: `app.json`, `babel.config.js` (NativeWind + `babel-plugin-module-resolver` for `@/`), `global.css` (`@tailwind` directives), `metro.config.js` (`withNativeWind`), `nativewind-env.d.ts`, `package.json`, `tailwind.config.js` (`content: ["./src/**/*..."]`, custom color tokens), `tsconfig.json` (`@/* -> ./src/*`), `.env.example` (documents the env var name; **no real `.env` file exists**), `README.md` (empty boilerplate — just the title, no content).

`docs/ARCHITECTURE.md` documents the folder-placement rules from a prior
reorganization and is accurate. `docs/HANDOFF.md` is **stale** — it describes
an earlier, entirely superseded state of the project (a flat `app/` directory,
`app/feature-one/`, no `src/` reorg, and a claim that this isn't a git
repository — see §10). Do not use it to understand current state.

---

## 4. Routes — what screens exist and how you reach them

| Route | File | Renders | How a user gets there |
|---|---|---|---|
| `/` | `src/app/index.tsx` | Landing/marketing screen | **App entry point** — first screen on cold start |
| `/login` | `src/app/login.tsx` | Login form | Landing Hero's "سجل الآن" button; Register screen's back-link |
| `/register` | `src/app/register.tsx` | Register form | Login screen's "إنشاء حساب جديد" link |
| `/(tabs)` (→ its `index` tab) | `src/app/(tabs)/index.tsx` | Home screen | Landing Header/FinalCTA "Get Started" buttons; `router.replace("/(tabs)")` after a successful login or register |
| `/chat` | `src/app/(tabs)/chat.tsx` | Placeholder "قيد الإنشاء" | Tab bar "المساعد" tab only — no card or button links here |
| `/scan` | `src/app/(tabs)/scan.tsx` | Scan screen (Feature 1) | Tab bar "تصوير مستند" tab, **or** Home's first feature card |
| `/services` | `src/app/(tabs)/services/index.tsx` | Placeholder list of 3 sample services | Tab bar "الخدمات" tab |
| `/services/[serviceId]` | `src/app/(tabs)/services/[serviceId].tsx` | Placeholder detail, shows raw id | Tapping a row on `/services` |
| (any unmatched URL) | `src/app/+not-found.tsx` | Generic 404 | Automatic |

**Entry point: `/` (the Landing screen), not the Home screen and not login.**
A first-time cold start always shows the landing page first.

---

## 5. Feature status table

Per the audit brief, statuses are one of **DONE / PARTIAL / UI-ONLY / NOT
STARTED** for each of the three status columns. A card that exists but
navigates nowhere (an empty `onPress`) is **NOT STARTED**, not PARTIAL.

| Feature | Screen built? | Navigable? | Wired to backend? | What's actually missing |
|---|---|---|---|---|
| Landing (marketing/entry) | DONE | DONE | NOT STARTED | Visually complete, but **every word of body copy is still the original English SaaS template placeholder** — fake founder, fake testimonials, fake company logos, generic English FAQ, and a "Features" section that doesn't match this app's real 7 features. Violates this project's own "Arabic + RTL throughout" rule. The Subscribe box's button has no `onPress` at all. |
| Auth (login + register) | DONE | DONE | PARTIAL | Full 3-state validation UI, secure-store token handling, retry/backoff, and single-flight 401 refresh logic all exist and call `login()`/`register()`. But: (a) the request paths include a `/api` prefix the real backend does not use (§8), so a real call would 404 today; (b) `EXPO_PUBLIC_API_BASE_URL` is still the `https://REPLACE_ME` placeholder (no `.env` file exists), so no call has anywhere real to go; (c) **no real network call to this backend has ever succeeded** — unverified, and currently believed broken per (a)/(b). |
| 1. تصوير المستندات وتلخيصها (scan + summarize) | DONE | DONE | NOT STARTED | Full screen UI exists (`src/app/(tabs)/scan.tsx` + `src/features/scan/`) and the Home card navigates to it. But `expo-camera` isn't even installed, there's no permissions flow, the capture button's `onPress` is an empty function with a TODO, and there is no results screen at all. |
| 2. المساعد الصوتي وملء الاستمارات (voice assistant + form filling) | NOT STARTED | NOT STARTED | NOT STARTED | No screen. The Home card has no `route` (empty `onPress` with a generic TODO). A `chat.tsx` placeholder tab exists but is not linked from this card and has no voice or form UI itself — just "قيد الإنشاء". |
| 3. قراءة المستندات وتبسيط لغتها (read documents aloud + simplify language) | NOT STARTED | NOT STARTED | NOT STARTED | No screen exists anywhere in the codebase for this. |
| 4. أرشيف مستنداتك وتنبيهات انتهاء الصلاحية (archive + expiry alerts) | NOT STARTED | NOT STARTED | NOT STARTED | No screen exists. (The unrelated `services/` placeholder tab lists 3 hardcoded government services — not a document archive — and isn't connected to this card.) |
| 5. إرشادك داخل المصالح الحكومية (in-office navigation guidance) | NOT STARTED | NOT STARTED | NOT STARTED | No screen exists. |
| 6. اختصارات لمستنداتك المهمة (one-gesture document shortcuts) | NOT STARTED | NOT STARTED | NOT STARTED | No screen exists. |
| 7. مشاركة مستنداتك بسهولة (share via QR/PDF) | NOT STARTED | NOT STARTED | NOT STARTED | No screen exists. |

**Bottom line: of the 7 advertised features, only 1 has a built screen, and
even that one has no camera, no upload, and no results. The other 6 are a
card that does nothing when tapped.**

---

## 6. What is fully working right now

Conservative list — only things a person could actually open and see today.

- `npx tsc --noEmit` passes with no errors (last checked when this file was
  written).
- `npx expo export --platform web` bundles successfully (Metro resolves
  every route, the `@/` alias, and all `src/features/*` imports with no
  errors), and the generated CSS contains this app's custom color classes —
  confirming NativeWind is picking up styles from `src/`.
- The Landing screen (`/`) renders and scrolls; its RTL-mirrored primary
  buttons work as links (`سجل الآن` → `/login`, header/final "Get Started" →
  `/(tabs)`).
- Login and Register screens render with live client-side validation: typed
  characters immediately reject invalid input where applicable, fields go
  green on blur when valid, a blocked submit flags only the empty required
  fields red, and both screens reset their fields when re-focused via
  `useFocusEffect`.
- The bottom tab bar renders with 4 tabs and correct Arabic labels/icons.
- The Home screen (`/(tabs)`) renders all 7 feature cards from one data array
  through one shared `FeatureCard` component; only the first is navigable.
- The Scan screen renders its full placeholder UI (header, camera-icon box,
  button, 7-row extract list) built from a data array through one shared
  `ExtractRow` component.
- The `chat`, `services`, and `services/[serviceId]` placeholder screens
  render (plain "قيد الإنشاء" text).

**Important caveat:** none of the above has been confirmed by actually
running the app on a device, simulator, or in a browser and looking at it or
tapping through it. Every check performed in this project's history was a
`tsc` type-check or a static Metro bundle export (`expo export`) — both
prove the code compiles and resolves, not that it looks or behaves correctly
on screen. Treat "renders" above as **unverified visually** even though it's
verified to compile/bundle.

---

## 7. What is not working / not built

**Every `TODO` in the codebase** (grepped `src/` for `TODO`, `FIXME`, `XXX`,
`HACK` — only `TODO` had matches):

| File | Line | Waiting on |
|---|---|---|
| `src/app/(tabs)/index.tsx` | 29 | Voice-assistant flow (VoiceButton's `onPress`) |
| `src/app/(tabs)/index.tsx` | 48 | A real screen + route for each of the 6 feature cards without one |
| `src/features/home/components/HomeHeader.tsx` | 38 | A notifications screen/panel |
| `src/features/home/components/HomeHeader.tsx` | 44 | A settings screen |
| `src/app/(tabs)/scan.tsx` | 48–49 | Camera capture + `POST /documents/upload`, pending backend contract |
| `src/features/scan/components/CameraPreviewPlaceholder.tsx` | 9–11 | Mounting a live `expo-camera` `<CameraView>` |

**Not marked with a TODO comment but also not wired:**
- `src/features/landing/components/Subscribe.tsx` — the "Subscribe" button
  has no `onPress` prop at all; tapping it silently does nothing.
- `src/features/landing/components/Header.tsx` / `Footer.tsx` — "Features",
  "FAQ", "Contact" are plain `<Text>`, not `Pressable`/`Link` — not
  interactive at all.

**Not built at all (no file, no stub):**
- A results screen for the scan flow (extracted document data).
- Any OCR / document-summarization backend call.
- The voice assistant, document reading/simplification, archive + expiry
  alerts, in-office navigation guidance, document shortcuts, and document
  sharing features — 6 of the 7 advertised Home-screen features have zero
  code.
- Any notifications or settings screen.
- Any automated tests (no test files exist anywhere in the project).

**Documented but explicitly deferred** (stated in the code's own comments,
not a bug): `src/app/(tabs)/scan.tsx`'s top comment says no camera
integration, no results screen, and no API calls were meant to exist yet —
this matches what's actually there.

---

## 8. Backend integration status

**The API client layer** (`src/lib/api/`):
- `client.ts` — creates the one shared `apiClient` axios instance (and a
  second, interceptor-free `rawClient` used only for the token-refresh call)
  with `baseURL`/`timeout` from `config.ts`. A request interceptor attaches
  `Authorization: Bearer <token>` from secure storage to every request.
- `resilience.ts` — a response interceptor doing three things: (1) retries
  network errors, timeouts, and 5xx responses up to `API_MAX_RETRIES` (default
  3) with exponential backoff; (2) on a 401 from any non-auth endpoint, does a
  **single-flight** token refresh (concurrent 401s share one in-flight
  refresh call) and replays the original request; if refresh fails, clears
  tokens and redirects to `/login`; (3) after retries are exhausted, pushes
  the failed request into the fail queue instead of dropping it.
- `failQueue.ts` — a bounded (max 20), in-memory-only queue of failed
  requests. Auto-drains when `@react-native-community/netinfo` reports
  connectivity restored; also exposes a manual drain function. Nothing is
  persisted across app restarts.
- `tokenStore.ts` — thin `expo-secure-store` wrapper: save/get/clear the
  access and refresh tokens.
- `errors.ts` — classifies any thrown error into an `ApiError` carrying a
  pre-written Arabic-language friendly message, and an `isRetryable` flag
  (network/timeout/5xx = retryable; 4xx = not).

**The base URL:** `EXPO_PUBLIC_API_BASE_URL`, read in `src/lib/config.ts`
with fallback `"https://REPLACE_ME"`. **No `.env` file exists in this
project** (only `.env.example` — `.env` is git-ignored and was never
created), so the app is currently running against the literal
`https://REPLACE_ME` placeholder. Any real network call today would fail at
DNS resolution.

**Endpoints coded against**, all in `src/features/auth/api.ts` and
`src/lib/api/resilience.ts`:
- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/me`
- `POST /api/auth/refresh` (assumed — see below)

**No real network call to any backend has ever succeeded** in this project's
history — unverified by design, since the base URL has never been set to a
real value.

**Known issues, stated explicitly as requested:**

1. **`/api` prefix mismatch.** The real backend mounts routes without an
   `/api` prefix (`/auth/login`, not `/api/auth/login`). This codebase's
   `auth.ts` and `resilience.ts` currently call `/api/auth/login`,
   `/api/auth/register`, `/api/auth/me`, and `/api/auth/refresh` — **all with
   the `/api` prefix, which does not match the stated real backend.** Every
   one of these calls would 404 against the real backend as it currently
   stands.

2. **No refresh-token endpoint exists on the real backend, but the
   interceptor assumes one does.** `resilience.ts` lines 32–37 contain an
   explicit code comment acknowledging this: *"the backend contract doesn't
   confirm a refresh route/payload shape yet — this assumes POST
   /api/auth/refresh."* Exactly what happens on a 401 today: the interceptor
   calls `POST /api/auth/refresh` on the bare `rawClient`; against the real
   backend this endpoint doesn't exist, so that call itself fails (almost
   certainly a 404); the `catch` block then runs `clearTokens()` and
   `router.replace("/login")` — i.e., **any 401 from the real backend today
   would immediately log the user out and bounce them to the login screen**,
   because the refresh attempt that's supposed to save that session can never
   succeed.

3. **Response shape mismatch.** The real `/auth/register` and `/auth/login`
   return only `{access_token, refresh_token, token_type}` — no `user`
   object. This codebase's `AuthResponse` type (`src/features/auth/api.ts`
   lines 16–21) declares a required `user: AuthUser` field. **Checked whether
   the code actually reads `.user` anywhere at runtime — it does not** (grepped
   the whole `src/` tree; the only references to `AuthUser`/`.user` are the
   type declarations themselves). So this mismatch is currently latent, not
   actively broken: nothing crashes because nothing consumes the `user`
   field yet. But the type is inaccurate, and the first code that tries to
   read `response.user.something` (e.g. to show a name on Home) will get
   `undefined` at runtime despite TypeScript claiming it's always present.

---

## 9. Accessibility implementation

**Actually implemented**, verified by reading the components:
- Arabic text throughout login, register, Home, and Scan screens, with
  `flex-row-reverse` container mirroring and `text-right` alignment
  (hand-mirrored per-component, not via a global `I18nManager` RTL flip for
  layout — though `src/app/_layout.tsx` does call
  `I18nManager.allowRTL(true)`/`forceRTL(true)` at module load, which affects
  native layout mirroring app-wide regardless).
- Bold weights and large sizes are the norm on the screens built after the
  accessibility pass (login, register, Home, Scan, and the landing page's
  own text, though the landing page's text is in the wrong language — see
  §10): body text is `text-lg`/`text-xl` (18–20px) and up, headings go up to
  `text-6xl`, everything using `text-ink` (near-black) rather than gray.
- Touch targets: `min-h-[56px]` (or larger) is used consistently on buttons,
  inputs, and interactive rows across auth, Home, and Scan.
- `accessibilityLabel`/`accessibilityRole="button"` are set on interactive
  elements in `ValidatedField.tsx`, `FeatureCard.tsx`, `HomeHeader.tsx`'s
  icon buttons, the Scan screen's back/capture buttons, and `FAQItem` (which
  also sets `accessibilityState={{ expanded }}`).
  `ValidatedField.tsx` additionally sets `aria-invalid` and computes a
  dynamic Arabic `accessibilityLabel` describing the current error/valid
  state, and marks its decorative check/error icon
  `accessibilityElementsHidden`/`importantForAccessibility="no-hide-descendants"`
  so it isn't announced twice.
- No component in `src/` sets `allowFontScaling={false}` (grepped to
  confirm) — the OS system font-scaling setting is never disabled anywhere.
- Every screen wraps its content in a `ScrollView`, and buttons/cards use
  `min-h-[...]` rather than fixed `h-[...]`, so (in principle) larger scaled
  text should reflow rather than clip or get cut off.

**Specified but NOT done / not verified:**
- **The app has never been tested with the system font-scaling setting
  turned up, and never been tested with a screen reader (VoiceOver/TalkBack)
  turned on.** This is stated directly per the audit brief's instruction —
  every accessibility claim above is a static-code-reading observation about
  what classes and props are present, not an observed, running behavior.
- `src/app/(tabs)/chat.tsx`, `src/app/(tabs)/services/index.tsx`, and
  `src/app/(tabs)/services/[serviceId].tsx` **were never touched by the
  accessibility work** — they still use `text-gray-900`/`text-gray-500`
  (gray-on-white) and ordinary `text-2xl`/`text-base` sizing, which is
  exactly the pattern the rest of the app deliberately avoids. Anyone
  auditing accessibility compliance should not assume it's uniform across
  the whole app.
- `src/app/+not-found.tsx` is similarly untouched — `text-gray-900`,
  `text-blue-600`, no accessibility props.
- The landing page's Header/Footer nav text ("Features", "FAQ", "Contact")
  and the fake testimonial/logo content have no accessibility issues raised
  against them specifically, but since they're plain, non-interactive
  `<Text>` a screen reader will read them as static content with no
  indication they look like nav links.
- No contrast measurements were computed in this audit; contrast claims made
  in earlier work (e.g. "brandBlueDeep passes AA for white text") were not
  re-verified here — they're mentioned in code comments (e.g.
  `Button.tsx`), not re-derived.

---

## 10. Known problems & landmines

**Leftover placeholder content from the original SaaS template**, all still
present in the landing page and in English (not Arabic — this directly
contradicts the "Arabic + RTL throughout" rule that governs the rest of the
app):

- **Fake founder**: "Alex Morgan, Founder & CEO" and an entire fabricated
  bio — `src/features/landing/components/FounderIntro.tsx` (lines 13–22) and
  `FounderStory.tsx` (whole file).
- **Fake testimonials**: "Maya Chen, Operations Lead", "Jordan Ellis,
  Founder", "Sam Rivera, Product Manager", with invented quotes —entirely
  `src/features/landing/components/Reviews.tsx`.
- **Fake company logos**: "Horizon", "Bolt", "Atlas", "Luma" — entirely
  `src/features/landing/components/TrustedBy.tsx`.
- **Generic FAQ copy**: 4 questions ("Who is this product for?", "Can I
  cancel anytime?", "Does it replace all of our tools?", "How quickly can we
  get started?") that describe a generic SaaS product, not this app —
  `src/features/landing/components/FAQ.tsx`.
- **Mismatched "Features" section**: `Features.tsx` and `HowItWorks.tsx`
  advertise 6 generic items ("Clear workflows", "Fast setup", "Focused
  dashboard", "Team visibility", "Flexible systems", "Less overhead") and a
  generic 3-step process — none of which describe this app's real 7
  features (compare against `src/features/home/data.ts`, which has the
  actual, correct feature list).
- **Generic "problem/solution" and final-CTA copy** unrelated to government
  paperwork — `ProblemSolution.tsx`, `FinalCTA.tsx`.

**The app has never been run on Android** — the stated hackathon demo
target. Everything verified in this project so far was `tsc --noEmit` and
`npx expo export --platform web` (a static bundle build), plus one `expo
start` process that was started and stopped without ever loading a screen.
There is no `android/` directory (native folders are git-ignored and were
never generated via `expo prebuild`), so there is no evidence the app has
ever been built or booted as a native Android app.

**Dependency fragility / dead weight:**
- `react-native-reanimated`, `react-native-worklets`, `expo-constants`, and
  `expo-linking` are installed dependencies with **zero imports anywhere in
  `src/`** (grepped to confirm) — likely leftover scaffold defaults, not
  actively used or maintained by this codebase.
- `expo-camera` (or any camera/OCR/speech package) is **not installed at
  all** — Feature 1 (scan) cannot be made functional without adding a
  dependency first.
- `src/styles/theme.ts` is dead code — exported but never imported anywhere.

**Documentation landmine:** `docs/HANDOFF.md` describes a state of the
project that no longer exists (flat `app/` directory instead of `src/app/`,
`app/feature-one/` screens that were later deleted, a Home screen with 11
cards instead of 7, and a claim that "the directory is not a git
repository"). A `.git` directory with real history (`COMMIT_EDITMSG`,
`packed-refs`, populated `objects/`) **does exist at the project root now** —
so that specific claim in `HANDOFF.md` is also out of date. Don't trust
`HANDOFF.md` for current state; use this file and `docs/ARCHITECTURE.md`
instead.

**Other things that would surprise someone picking this up:**
- No automated tests exist anywhere in the repository.
- `README.md` is empty boilerplate (`# SahelhaApp`, nothing else) — it will
  not help you get started.
- `tailwind.config.js` sets `darkMode: "class"`, but no dark-mode styling or
  toggle exists anywhere in the app — it's a no-op setting.
- The Home screen's status pill (`StatusPill.tsx`) always shows "النظام
  جاهز — الصوت والموقع يعملان" ("system ready, voice and location working")
  unconditionally — it is not connected to any real permission or system
  check, so it will claim things are working even when they aren't.

---

## 11. Next steps, ranked

1. **Resolve the backend contract mismatches (§8) before writing any more
   feature code.** Fix the `/api` prefix in `src/features/auth/api.ts` and
   `src/lib/api/resilience.ts`, decide what should actually happen on a 401
   given there's no refresh endpoint (remove the refresh attempt entirely,
   or get a real refresh endpoint from the backend team), and set a real
   `EXPO_PUBLIC_API_BASE_URL` in a local `.env`. Reason: every other backend
   integration task in this project will repeat the same mistakes if this
   isn't fixed first, and right now it's impossible to tell whether the auth
   flow works at all against the real server.
2. **Get the app running on an actual Android device or emulator once, end
   to end.** Reason: nothing in this project has ever been visually
   confirmed to work — every prior verification was a compile/bundle check.
   This is also the literal hackathon deliverable and the single biggest
   unknown-risk item; better to discover native-build problems now than at
   demo time.
3. **Rewrite the landing page content in Arabic, about this app.** Reason:
   it's the very first thing anyone sees, and right now it's a foreign-
   language SaaS template with fabricated people, companies, and features
   that don't match the product. This is a credibility risk for a hackathon
   demo specifically because judges will read it.
4. **Pick one of the 6 not-started features and build it end-to-end
   (screen + backend call), rather than adding more UI-only screens.**
   Reason: the project already has a pattern of screens that look finished
   but do nothing (6 of 7 feature cards); one fully working feature
   end-to-end is stronger evidence of feasibility than more placeholders.
   Given Feature 1 (scan) already has the most built (UI done, just needs
   `expo-camera` + an upload call), finishing it is the shortest path to a
   first fully real feature.
5. **Do an actual accessibility pass with a screen reader and system font
   scaling turned up**, since this has never been done and is the app's
   core value proposition. Also bring `chat.tsx`, `services/*`, and
   `+not-found.tsx` up to the same accessibility standard as the rest of the
   app (§9) — they were missed by earlier work.
6. **Decide what to do with the `services`/`chat` tabs** — they predate the
   current feature set, don't map to any of the 7 advertised features, and
   currently just sit there as inert placeholders. Either wire them into the
   real feature set or remove them so they don't confuse a demo.

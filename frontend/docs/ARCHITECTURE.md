# Architecture

How this codebase is organized, and the rule for where new code goes.

## Structure

```
SahelhaApp/
├── assets/                        # static files — app.json points at ./assets/*
├── docs/
│   ├── ARCHITECTURE.md            # this file
│   └── HANDOFF.md                 # older project notes (pre-dates this reorg)
├── src/
│   ├── app/                       # Expo Router — every file here is a route/screen
│   │   ├── _layout.tsx            # root Stack (RTL setup, global.css import)
│   │   ├── +not-found.tsx
│   │   ├── index.tsx              # "/" — landing screen (composes src/features/landing)
│   │   ├── login.tsx              # "/login"
│   │   ├── register.tsx           # "/register"
│   │   └── (tabs)/                # "/(tabs)" tab group — chat, scan, services
│   │       ├── _layout.tsx
│   │       ├── chat.tsx
│   │       ├── scan.tsx
│   │       └── services/
│   │           ├── _layout.tsx
│   │           ├── index.tsx
│   │           └── [serviceId].tsx
│   ├── components/
│   │   └── ui/                    # base design-system primitives
│   │       └── Button.tsx
│   ├── features/                  # feature modules — self-contained
│   │   ├── auth/
│   │   │   ├── components/        # auth-only UI
│   │   │   │   ├── AuthScreenShell.tsx
│   │   │   │   └── ValidatedField.tsx
│   │   │   ├── validation.ts      # auth field validation rules
│   │   │   └── api.ts             # login / register / me — calls src/lib/api/client
│   │   └── landing/
│   │       └── components/        # landing-page sections, one file per section
│   │           ├── primitives.tsx # Container, Section, Pill, Highlight
│   │           ├── Header.tsx
│   │           ├── Hero.tsx
│   │           ├── TrustedBy.tsx
│   │           ├── FounderIntro.tsx
│   │           ├── ProblemSolution.tsx
│   │           ├── Features.tsx
│   │           ├── HowItWorks.tsx
│   │           ├── FounderStory.tsx
│   │           ├── Reviews.tsx
│   │           ├── FAQ.tsx
│   │           ├── Subscribe.tsx
│   │           ├── FinalCTA.tsx
│   │           └── Footer.tsx
│   ├── lib/
│   │   ├── config.ts               # EXPO_PUBLIC_* env vars, one place
│   │   └── api/
│   │       ├── client.ts           # the one axios instance (baseURL, timeout)
│   │       ├── resilience.ts       # retry/backoff + single-flight 401 refresh
│   │       ├── failQueue.ts        # bounded in-memory failed-request queue
│   │       ├── tokenStore.ts       # expo-secure-store token read/write/clear
│   │       └── errors.ts           # ApiError + friendly-Arabic-message classifier
│   └── styles/
│       └── theme.ts                # color/a11y constants (currently unused by any screen)
├── app.json
├── babel.config.js                 # + module-resolver plugin for the "@/" alias
├── global.css                      # NativeWind entry (metro.config.js points at this)
├── metro.config.js
├── package.json
├── tailwind.config.js              # content: ["./src/**/*.{js,jsx,ts,tsx}"]
└── tsconfig.json                   # "@/*" -> "./src/*"
```

Folders that exist in the target design but aren't created yet, because nothing
belongs in them: `src/hooks/` (no global custom hooks exist), `src/types/` (no
cross-cutting interfaces exist yet — auth's types live next to auth's code in
`src/features/auth/api.ts`), `src/features/auth/hooks/` (the login/register
screens' form-reset state is still inline in the route files — extracting it
into a shared hook is a real refactor, not a file move, so it was left alone
here), `src/store/` (no Redux/Zustand — React state + secure-store is enough),
`src/components/common/`. Create any of these the moment something actually
needs to live there — don't pre-create empty folders.

## What belongs where

- **`src/app/`** — routes only. Expo Router treats every file in this folder as
  a screen/route by its file path (Expo Router resolves the routes directory
  at the project root `app/`, or `src/app/` if the root one doesn't exist —
  this project uses the `src/app/` form). A route file may contain simple
  screen markup directly, but if a piece of it is reusable or the file is
  getting large, pull that piece out into `components/` or `features/`.
- **`src/components/ui/`** — generic, content-agnostic design-system
  primitives (Button, Input, Card, …). No business logic, no feature-specific
  copy or validation rules. If it would make sense in a completely different
  app, it belongs here.
- **`src/components/common/`** — shared UI that isn't a base primitive but is
  still used by two or more features (e.g. an app-wide EmptyState or
  ErrorBanner). Empty right now.
- **`src/features/<name>/`** — everything a single feature needs:
  `components/` (feature-only UI), `hooks/` (feature-only hooks),
  and typically an `api.ts` for that feature's endpoint calls. A feature
  folder should be deletable without breaking any other feature.
- **`src/hooks/`** — custom hooks used by two or more features.
- **`src/lib/`** — third-party setup and app-wide infrastructure that isn't
  tied to any one feature's domain: the shared axios client, retry/backoff,
  the failed-request queue, the secure-store token helper, env-driven config.
- **`src/store/`** — global app state, if/when this app adopts a state
  library. Not used today.
- **`src/styles/`** — global theme/style constants shared across the app.
- **`src/types/`** — TypeScript interfaces used by two or more features. A
  type used by only one feature stays defined in that feature's own files
  (see `AuthUser`/`AuthResponse` in `src/features/auth/api.ts`).

## The placement rule

> Used by **one** feature → lives inside that feature's folder
> (`src/features/<name>/`). Used by **two or more** → moves out to the
> matching shared top-level folder (`src/components`, `src/hooks`, `src/lib`,
> `src/styles`, `src/types`).

"Used by" means used across features, not "used by two files inside the same
feature" — e.g. `Container`/`Section`/`Pill`/`Highlight` are imported by most
of the landing page's own section files, but only by the landing feature, so
they stay feature-local in `src/features/landing/components/primitives.tsx`
rather than being promoted to `src/components/`.

`Button` is the one exception applied here: it's currently only rendered by
the landing screen, but it's a generic, variant-driven, content-free
primitive with no landing-specific logic — exactly what `src/components/ui/`
is for — so it was promoted there on the assumption it'll be reused (e.g. by
future screens) rather than reinvented. Login/register's own submit buttons
were **not** switched over to it, since consolidating them wasn't part of
this move and would be a behavior-adjacent change.

The shared axios client + retry/backoff + fail queue + secure-store token
helper live in `src/lib/` because they know nothing about auth specifically —
they're generic HTTP/session infrastructure any feature could use. The actual
auth *endpoints* (`login`, `register`, `getMe`) live in
`src/features/auth/api.ts` and import the shared client from `src/lib/api/client`.
Auth's field-validation rules (`src/features/auth/validation.ts`) stayed
feature-local rather than moving to `src/lib/`, even though the old flat
`lib/` folder held them — they're auth-domain rules (email/password/name/phone
formats for this app's signup flow), not generic infrastructure.

## Worked example: adding a new module (e.g. "scan")

1. Route file: `src/app/scan.tsx` (or `src/app/(tabs)/scan.tsx` if it belongs
   in the tab bar — note a `scan.tsx` already exists there today as a
   placeholder).
2. Feature folder: `src/features/scan/` for anything scan-specific —
   `src/features/scan/components/` for its UI, `src/features/scan/hooks/` for
   any scan-only hooks, `src/features/scan/api.ts` for its endpoint calls
   (importing the shared client from `src/lib/api/client`).
3. Only promote something out of `src/features/scan/` if a *different*
   feature later needs the same piece — then it moves to `src/components/ui`,
   `src/components/common`, `src/hooks`, or `src/types` as appropriate.

## The `@/` alias

`@/*` resolves to `./src/*`. Configured in two places, because they solve two
different problems:

- **`tsconfig.json`** (`compilerOptions.paths`) — makes the editor/TypeScript
  understand the alias for autocomplete and type-checking.
- **`babel.config.js`** (`babel-plugin-module-resolver`, alias `@` → `./src`)
  — makes **Metro** actually resolve `@/...` imports at bundle/runtime.
  TypeScript accepting an alias is not the same as the bundler resolving it;
  both are required, and this was verified by running
  `npx expo export --platform web`, which bundles the whole module graph
  through Metro (a plain `tsc` pass would not have caught a Metro-side
  resolution failure).

Within a single feature folder, prefer relative imports for same-folder
siblings (e.g. `Hero.tsx` importing `./primitives`); use the `@/` alias for
anything crossing a top-level `src/` boundary (e.g. a route in `src/app/`
importing from `@/features/auth/...` or `@/lib/...`).

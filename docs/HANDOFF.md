# Handoff — سهّلها (Sahelha)

## 1. Repo state when this session started

The actual Expo project lives in `SahelhaApp/` (a subfolder of the repo root
`salhelaAlya_App/` — there is no code directly at the repo root). The
directory is **not** a git repository at the top level (`git` is not used
here per the operator's instructions — no git commands were run in this
session).

A previous scaffolding pass had already created:

- Expo SDK 57 + Expo Router 57 + React Native 0.86 + React 19 project
  (`package.json`), with NativeWind v4 and Tailwind CSS as dependencies.
- `babel.config.js` — correctly configured with
  `babel-preset-expo` (`jsxImportSource: "nativewind"`) and
  `nativewind/babel`.
- `metro.config.js` — correctly wired with `withNativeWind(config, { input: "./global.css" })`.
- `global.css` — correct `@tailwind base/components/utilities` directives,
  already imported from `app/_layout.tsx`.
- `tailwind.config.js` — content globs already covered `./app/**/*` and
  `./components/**/*`.
- `tsconfig.json` — `strict: true`, extends `expo/tsconfig.base`.
- `app/_layout.tsx` — already called `I18nManager.allowRTL(true)` and
  `I18nManager.forceRTL(true)` at startup (RTL was already wired).
- A tab-based scaffold under `app/(tabs)/`: `index.tsx` (Home), `chat.tsx`,
  `scan.tsx`, `services/index.tsx`, `services/[serviceId].tsx`, all
  placeholder screens showing "قيد الإنشاء" (under construction).
- `app/+not-found.tsx`.

**What was actually broken:** despite all the config files being correct on
paper, `npx expo start` failed immediately with
`Cannot find module 'babel-preset-expo'`. The committed `package-lock.json`
resolved `babel-preset-expo` **only** as a nested dependency under
`node_modules/expo/node_modules/babel-preset-expo`, never hoisted to the
top-level `node_modules/`. Since `babel.config.js` sits at the project root,
Node's module resolution can't see that nested copy — this is consistent
with the scaffold having been cut off mid-`npm install`. See §3 for the fix.

Everything else in the previous scaffold (NativeWind wiring, RTL, TS config)
was already correct and did not need changes.

## 2. Files created or changed

| File | Purpose |
|---|---|
| `package.json` | Added `babel-preset-expo` (`~57.0.2`) as an explicit devDependency so npm hoists it to top-level `node_modules` (fixes the broken scaffold — see §3). |
| `constants/theme.ts` | New. Exports the `colors` design tokens (`pearl`, `primary`, `accent`, `onPrimary`) and an `a11y.minTapTarget` constant (56pt). |
| `tailwind.config.js` | Extended `theme.colors` with `pearl`, `primary`, `accent` so `bg-pearl` / `bg-primary` / `text-primary` etc. work as NativeWind classes. |
| `components/FeatureCard.tsx` | New. Reusable purple feature-box card: full a11y props (`accessibilityRole="button"`, Arabic `accessibilityLabel`), min-height 96pt, rounded corners, drop shadow. Renders as a `Link` (navigable) when given an `href`, otherwise as an inert `Pressable` with no `onPress`. |
| `app/index.tsx` | New. The Home/landing screen: static top bar with the Arabic app title, pearl background, scrollable list of the 11 feature cards. Replaces the old `app/(tabs)/index.tsx` placeholder — see §4 for why. |
| `app/(tabs)/index.tsx` | **Deleted.** Its "Home" placeholder role is superseded by `app/index.tsx` (see §4). |
| `app/(tabs)/_layout.tsx` | Removed the `Tabs.Screen name="index"` (Home tab) entry, since the file it pointed to no longer exists. `chat`, `scan`, `services` tabs are untouched. |
| `app/feature-one/index.tsx` | New. Feature 1 capture screen: white background, large centered purple button containing a camera emoji (📷) + "صوّر المستند" caption. `onPress` is a `// TODO` placeholder — no camera, no navigation. |
| `app/feature-one/result.tsx` | New. Feature 1 static results screen: 7 labeled rows (نوع المستند، الجهة الحكومية، المبلغ المطلوب، تاريخ الإصدار، تاريخ الانتهاء، رقم المستند، الإجراءات المطلوبة), each showing placeholder value "—". Not linked from anywhere. |
| `app/_layout.tsx` | Updated the root `Stack`'s screen list: added `index`, `feature-one/index`, `feature-one/result`; kept `(tabs)` and `+not-found`. RTL setup and `global.css` import untouched. |

Untouched, still-existing placeholders (per instructions — not wired, not
edited): `app/(tabs)/chat.tsx`, `app/(tabs)/scan.tsx`,
`app/(tabs)/services/index.tsx`, `app/(tabs)/services/[serviceId].tsx`,
`app/(tabs)/services/_layout.tsx`, `app/+not-found.tsx`.

## 3. The babel-preset-expo fix (Step 0)

Root cause: `package-lock.json` nested `babel-preset-expo` exclusively
under `node_modules/expo/node_modules/`, so it was invisible to
`babel.config.js` at the project root. `npm install` alone (even a full
reinstall) preserved that nesting, because the lockfile's tree explicitly
encodes it that way.

Fix applied: added `"babel-preset-expo": "~57.0.2"` as an explicit
`devDependency` in `package.json` (matching the version Expo itself
requires) and ran `npm install --legacy-peer-deps`. This is the same flag
implied by the existing lockfile (a plain `npm install` on the unmodified
project already emits an `ERESOLVE overriding peer dependency` warning from
`expo-router`'s web/radix-ui peer tree — a full re-resolution without
`--legacy-peer-deps` hard-fails on that pre-existing conflict, unrelated to
this session's changes). After this, `babel-preset-expo` resolves at
top-level `node_modules/babel-preset-expo` and Metro starts cleanly.

No other dependency versions changed.

## 4. Theme tokens

Defined in both `constants/theme.ts` (for use in plain RN `style={}` /
TS code) and `tailwind.config.js` (for NativeWind `className` utilities):

| Token | Hex | Usage |
|---|---|---|
| `pearl` | `#FAF9FD` | Page background |
| `primary` | `#6D28D9` | Feature box / button background |
| `accent` | `#4F46E5` | Reserved for secondary accents (not yet used on Home/Feature 1) |
| `onPrimary` | `#FFFFFF` | Text/icon color on `primary` |

Contrast check: white text (`#FFFFFF`) on `primary` (`#6D28D9`) computes to
a **~7.1:1** contrast ratio (WCAG relative-luminance formula), comfortably
above the required 4.5:1 AA threshold for normal text — no darkening
needed.

## 5. Navigation — what's wired vs. not

**Wired (the only navigation in the app):** tapping the "مسح المستندات
الذكي" card on the Home screen (`app/index.tsx`) navigates via
`expo-router`'s `<Link href="/feature-one">` to the Feature 1 capture
screen (`app/feature-one/index.tsx`).

**Explicitly NOT wired:**
- The other 10 feature cards on Home render as inert `Pressable`s with no
  `onPress` — tapping does nothing.
- The camera button on the Feature 1 capture screen has a `// TODO`
  `onPress` — no camera, no navigation to the results screen.
- The Feature 1 results screen (`app/feature-one/result.tsx`) is not
  linked from anywhere; it's reachable only by direct URL
  (`/feature-one/result`) during development.
- The old `(tabs)` group (`chat`, `scan`, `services`) has no links pointing
  to it from the new Home screen or from Feature 1.

## 6. Assumptions made

- **Home screen replaces the tabs-based Home, not the tab bar itself.**
  The spec describes Home as a single static top bar with no menu logic —
  incompatible with the pre-existing bottom `Tabs` navigator (which would
  keep showing a 4-tab bar). Since the old scaffold's `(tabs)/index.tsx`
  and the new Home screen both wanted the `/` route, keeping both would be
  a duplicate-route build error. Resolution: `app/index.tsx` is now the
  real landing page (plain `Stack` screen, no tab bar); the old
  `(tabs)/index.tsx` Home placeholder was removed and its Tabs entry
  dropped from `(tabs)/_layout.tsx`. `chat`/`scan`/`services` remain as
  inert, unwired placeholders exactly as before, still reachable only by
  direct URL, never linked to.
- **Feature 1 "page 2" = the results screen** (`app/feature-one/result.tsx`),
  as explicitly suggested in the task. Kept intentionally minimal — static
  labeled rows with placeholder "—" values, no data plumbing.
- Feature 1 lives in a plain (non-group) `app/feature-one/` folder with no
  `_layout.tsx` — both screens are flat `Stack` routes under the root
  layout, since nothing in the spec called for a nested navigator/header
  there.
- The camera button's caption ("صوّر المستند") was placed *inside* the
  purple button (not as separate text below it), reading the spec's "a big
  Arabic caption" as part of "the button['s] content" alongside the emoji.

## 7. Verification performed

- `npx tsc --noEmit` — passes, no errors.
- `npx expo start` — Metro starts with no errors. Fetched the actual
  `expo-router/entry` JS bundle from the running dev server (forcing a full
  compile of every screen, including the new ones) — compiled successfully
  (1801 modules, HTTP 200). Dev server processes were stopped afterward.

## 8. NEXT STEPS / TODO for the next prompt

- Wire Feature 1 capture → results: on successful "scan", navigate from
  `app/feature-one/index.tsx` to `app/feature-one/result.tsx`.
- Implement actual camera capture (e.g. `expo-camera` / `expo-image-picker`)
  behind the "صوّر المستند" button.
- Implement OCR + summarization backend integration and populate the 7
  result fields on `app/feature-one/result.tsx` with real extracted data
  instead of "—".
- Design and build the remaining 10 feature screens (voice assistant,
  voice form-filling, government-office navigation, smart archive, archive
  voice search, document shortcuts, expiry alerts, document sharing,
  simplification of official language, voice reply) and wire their Home
  cards once each screen exists.
- Decide the long-term fate of the orphaned `app/(tabs)/` group
  (`chat`, `scan`, `services`, `services/[serviceId]`) — either delete it
  once superseded by real screens, or intentionally re-integrate it (e.g.
  as a settings/services section reachable from Home) rather than leaving
  it dead code.
- Add automated accessibility testing (screen-reader smoke test) once a
  device/simulator is available in this environment — this session
  verified bundling only, not actual VoiceOver/TalkBack behavior.
- Consider running `npm audit fix` for the 10 moderate-severity advisories
  surfaced by `npm install` (not addressed this session — out of scope).

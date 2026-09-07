# Sahelha Alya — Design Brief for Claude Design

**Hand this entire document to Claude Design as the brief for designing the
Sahelha Alya app.** It covers who the product is for, the brand identity to
carry forward, the accessibility rules that are non-negotiable for this
audience, every screen the app needs (mapped to a real, working backend), and
the exact deliverables we want back.

---

## 1. What Sahelha Alya is

**Sahelha Alya** (سهلها عليا — "make it easy for me") is an **AI assistant for
Arabic-speaking people with visual impairments**, built to help them handle
Egyptian government paperwork without needing to read or type.

**One-line pitch (from the pitch deck):** *"Turns documents into
conversations, using AI, OCR, and Voice."*

**The problem it solves:** 285 million people globally live with visual
impairment. Government paperwork is confusing even for fully sighted people —
for someone who can't read it, it's a wall. There are 45M+ Arabic speakers
with visual challenges and, as of this product, zero dedicated solutions for
them.

**How it works, end to end:**
1. The user points their phone camera at a document (national ID, birth
   certificate, utility bill, passport, etc.) and takes a photo.
2. The backend reads the text (OCR), sends it to an AI model that writes a
   plain-Arabic summary, classifies the document type, and pulls out key
   facts — name, address, dates, amounts, and especially an **expiry date**.
3. If there's an expiry date, a reminder is scheduled automatically so the
   user gets a notification before it lapses.
4. The user can **ask questions about that document out loud** ("what's the
   expiry date on this?") and get a **spoken answer back** — the assistant
   remembers the conversation and answers using that document's actual
   content.
5. Every processed document lands in a **searchable, spoken-friendly
   archive**, and can be **shared via QR code**.
6. (Roadmap, not yet built) Voice-driven form filling, and locating the
   nearest government office.

This is a **voice-first, Arabic-first product**. Every screen must work for
someone who cannot see it at all, not just someone with low vision — that is
the central design constraint, not a nice-to-have.

---

## 2. Who we're designing for

Design for the hardest case first (zero vision, screen-reader/voice only),
then confirm it also serves the lighter cases well. Three personas, in order
of how demanding they are on the design:

1. **No/near-zero functional vision.** Relies entirely on a screen
   reader (VoiceOver/TalkBack) and/or the app's own voice interface. Never
   sees color, icons, or layout — experiences the app purely through what is
   spoken and what gestures/buttons do. This is the primary persona; nothing
   in the app should require sight to complete.
2. **Partial vision loss** (e.g. acute glaucoma, tunnel vision, blurred
   central/peripheral vision). Can see, but small text, dense forms, low
   contrast, and cluttered screens are genuinely unusable. Needs very large
   text, very high contrast, generous spacing, and simple, single-focus
   screens.
3. **Elderly users** whose vision is naturally declining, often alongside
   reduced dexterity and less comfort with typical app gestures (swipe
   navigation, small icon-only controls). Needs large touch targets, obvious
   affordances (things that look and behave exactly like what they are), and
   forgiving interactions with easy undo — not clever ones.

All three are Arabic speakers first — copy, voice prompts, and layout should
be designed **in Arabic and right-to-left from the start**, not translated
after the fact from an English-first design.

---

## 3. Brand identity (from the existing pitch deck — carry this forward)

The deck already establishes a visual identity. Reuse and extend it; don't
invent a new one.

**Logo / motif:** a stylized **eye**, quartered into four color segments
(blue, blush pink, blush pink, blue) around a black pupil with a small white
highlight dot, on a white sclera. This mark repeats throughout the deck as a
decorative and identity element. It's a strong, memorable symbol — but it is
*visual-only signaling*, so in-product it must always be paired with a text
label or spoken label, never used as the sole way to indicate "home" or
"brand."

**Color palette** (approximate values extracted from the deck — treat as a
starting point Claude Design should refine for contrast compliance, not as
pixel-exact swatches):

| Role | Approx. hex | Usage in the deck |
|---|---|---|
| Sahelha Indigo (primary/dark) | `#3D4DB3` | full-bleed panels, headlines on light background |
| Sahelha Periwinkle (secondary) | `#6E7DEB` | decorative diamonds/triangles, secondary accents |
| Sahelha Lavender Mist (background) | `#DFE2FA` | light panel backgrounds |
| Sahelha Blush (accent) | `#E5B7C7` | highlight boxes, decorative shapes, callouts |
| Ink / near-black (text) | `#0E0E14` | all headline and body text |
| White | `#FFFFFF` | base background, eye sclera |

**Important accessibility caveat:** several of these pairings (periwinkle on
lavender, blush on lavender) look elegant in a slide deck but will **not**
pass WCAG contrast requirements for UI text or controls. Claude Design should
treat this palette as the *brand mood* to preserve (indigo + blush + warm,
optimistic, trustworthy) and produce an **accessible derived palette**: e.g.
darken/desaturate the indigo for a "Sahelha Indigo — Text" token that hits
7:1 against white, keep the light blush/periwinkle purely for large
decorative shapes and illustration (never for text or icons that carry
meaning), and add a true near-black-on-white pairing as the default reading
mode. See [§5](#5-non-negotiable-accessibility-rules) for exact ratios.

**Shapes & decoration:** scattered diamonds and triangles, plus small dot
clusters, in the periwinkle/blush palette — used as ambient decoration on
title/section slides. These are appropriate for splash screens, onboarding
illustrations, and empty states. They should be **toned down or removed
entirely on task screens** (camera, document detail, chat) — a low-vision
user needs a plain, high-contrast field to focus on, not decorative shapes
competing for attention.

**Typography feel:** bold, heavy, geometric, rounded sans-serif for
headlines (the deck's headline face is a chunky grotesque, similar in spirit
to Poppins ExtraBold / ArchivoBlack / Baloo 2 Bold); clean, simple sans for
body copy. Since this product is Arabic-first:
- **Headlines:** a bold Arabic-supporting geometric sans — **Cairo
  (Bold/Black)** or **Tajawal (Bold)** — paired with a Latin equivalent
  (**Poppins** or **Archivo**) for any English/numeral-only strings.
- **Body & UI text:** a highly legible Arabic text face designed for small
  *and* very large sizes — **IBM Plex Sans Arabic** or **Almarai** — since
  body text here needs to scale up dramatically for low-vision users without
  breaking.
- Numerals: use Western Arabic numerals (٠-٩ vs 0-9) consistently with
  whatever the target users are most used to reading on government
  documents in Egypt — confirm with the team, but default to Eastern Arabic
  numerals (٠١٢٣...) since that's what appears on the source documents this
  app reads.

**Tone of voice:** warm, reassuring, plain-spoken — never bureaucratic or
technical. The name itself promises "I'll make this easy for you." Error
messages and voice prompts should sound like a patient, calm person helping,
not a system throwing an error code.

---

## 4. What already exists (so the design matches a real, working backend)

This is not a concept app — the backend is built and working. Design to
these real capabilities and data shapes so engineering can implement the
screens as designed with no surprises:

- **Auth:** email + password, JWT session (no social login, no "forgot
  password" flow yet — design a graceful "contact support" fallback for
  that gap rather than a broken flow).
- **Document upload:** takes a photo → returns instantly with
  `status: "processing"` → the app polls until `status` becomes `"done"` or
  `"failed"`. **Design must show a clear, spoken-aloud "working on it"
  state** — this is not instant, typically several seconds.
- **Document result:** an Arabic summary, a document type (national ID,
  passport, birth certificate, utility bill, receipt, invoice, work permit,
  marriage/death certificate, property record, or unknown), extracted dates,
  amounts, an expiry date if found, extracted entities (name, address,
  governorate, and — for national IDs — the national ID number), and a set
  of tags.
- **AI voice assistant:** ask a question about a specific document, by
  typing or by recording your voice; get back both a text answer and a
  spoken (Arabic) audio answer; the conversation has memory across turns.
- **Reminders:** created automatically from a document's expiry date;
  delivered as push notifications; can also be listed/deleted, or created
  manually by the user.
- **Archive/search:** full-text search over all the user's documents by
  free text and/or tag, plus a QR-code share for a single document.
- **Push notifications:** require the device to register an FCM token —
  design an explicit, well-explained permission-request moment for this
  (it's how expiry reminders actually reach the user).

Full technical detail for every one of these lives in
[`API_DOCUMENTATION.md`](API_DOCUMENTATION.md) in this repo — Claude Design
doesn't need to read that file to design the UI, but it confirms every field
and state referenced below is real and already returned by the API (not a
placeholder to be invented).

---

## 5. Non-negotiable accessibility rules

These aren't stylistic preferences — for this specific audience, violating
them means real users cannot use the app at all. Apply WCAG 2.2 as a **floor
of AA, with AAA wherever it doesn't conflict with usability**, plus the
product-specific rules below.

### Contrast & color
- Body text and any text carrying meaning: **minimum 7:1** contrast against
  its background (AAA), not just the AA minimum of 4.5:1 — low-vision users
  benefit measurably from the stricter ratio.
- Large text (24px+/bold 19px+) and meaningful icons/UI borders: minimum
  4.5:1, target 7:1.
- **Never convey information by color alone** — a "processing" vs "done" vs
  "failed" document state needs a distinct icon *and* label *and* spoken
  announcement, not just a color change.
- Provide a **high-contrast mode** (e.g. pure black background / pure white
  text, or vice versa) as a first-class, easy-to-reach setting, not buried.
- Provide a **dark mode** — many low-vision conditions (e.g. light
  sensitivity from glaucoma or cataracts) make a dark UI meaningfully more
  usable, independent of general aesthetic preference.

### Type & scaling
- Default body text size should be **larger than typical app defaults** —
  start around 18–20px equivalent, not 14–16px.
- Every screen must **support the OS-level text-scaling setting up to
  200%+** without clipping, overlapping, or requiring horizontal scrolling.
  Design layouts that reflow (stack) rather than shrink or truncate when
  text scales up.
- Avoid justified text and avoid all-caps for body copy (harder to read for
  low vision and for OCR-style scanning by some screen readers).
- Line length: keep comfortably short (design for large text, which
  naturally shortens line length — don't fight it with fixed-width
  containers).

### Touch targets & layout
- Minimum touch target **48×48dp**, with **at least 8dp spacing** between
  adjacent targets — bump this up further for primary actions (the camera
  shutter, the "ask a question" mic button should be closer to 72–96dp).
- One primary action per screen, clearly the largest and most prominent
  element. Avoid multi-column dense layouts entirely.
- Keep the primary action's position **consistent across screens** (e.g. the
  mic/record button always bottom-center) — muscle memory matters more than
  visual novelty for this audience.
- Generous whitespace/margins; avoid dense forms and multi-field screens —
  break anything form-like into one-question-at-a-time steps, and prefer
  voice input as the primary path over typing wherever the backend supports
  it (it already does for the AI assistant).

### Screen reader & semantic structure
- Every interactive element needs a **meaningful Arabic accessibility
  label** (never "button", never an unlabeled icon) — e.g. a delete icon on
  a document must be labeled "حذف المستند" (delete document), not just
  "حذف" out of context, and definitely not left unlabeled.
- Logical, predictable focus order matching reading order (right-to-left for
  Arabic).
- Use real semantic roles/headings so screen readers can navigate by
  heading/landmark, not just linearly through everything.
- Dynamic content (a document flipping from "processing" to "done", an AI
  answer arriving) must be announced via a live region — don't rely on the
  user noticing a visual change.
- Full RTL mirroring: layout direction, icon direction (e.g. "back" arrows),
  and reading order all flip for Arabic — never a purely LTR layout with
  Arabic text dropped in.

### Voice-first interaction (this app's core differentiator)
- **Every result must be spoken, not just displayed** — the document summary,
  the AI's answer, confirmations, and errors should all have an
  automatically-played (or one-tap-to-replay) audio version, since the
  backend already returns audio for AI answers and TTS is available for any
  text.
- The **microphone/record control must be reachable from anywhere with
  minimal navigation** — design it as a persistent, fixed, extra-large
  control, not something nested in a menu.
- Provide **non-visual feedback for recording state** — an audible tone when
  recording starts/stops (not only a visual waveform/pulse animation),
  plus haptic feedback on supported devices.
- Design **audio + haptic confirmation for every completed action**
  (uploaded, saved, deleted, reminder set) — a toast that only appears
  visually is invisible to this audience.
- Support the device's actual screen reader (VoiceOver/TalkBack) as a first
  path, and the app's own voice assistant as a second, complementary path —
  they should never fight each other (e.g. don't auto-play TTS audio that
  talks over an active screen-reader announcement).

### Motion, timing & error tolerance
- Respect `prefers-reduced-motion` — decorative animation (the diamond/eye
  motifs) should be minimal or disabled by default on functional screens.
- No time-limited interactions without an easy way to extend/repeat (e.g. if
  a recording auto-stops, make re-recording one obvious tap away).
- Errors must be explained in plain, calm Arabic with a clear next step
  ("لم نستطع قراءة الصورة، حاول تصوير المستند في إضاءة أفضل" — not
  "Error 400: OCR failed") — and spoken aloud, not just shown as text.
- Confirm before anything destructive (deleting a document/reminder) with a
  spoken, explicit confirmation step — never a silent swipe-to-delete as the
  only path.

---

## 6. Screens to design

Design **light, dark, and high-contrast** variants of each, in **Arabic
(RTL)** as the primary/default language. Each screen below lists its purpose,
key elements, and the specific accessibility behavior it must support.

### 6.1 Onboarding / welcome
- Brand introduction using the eye motif + decorative shapes (this is where
  the brand personality can be more visually expressive — no functional task
  is happening yet).
- Immediately offers to **turn on voice guidance** and set text size /
  contrast preferences — treat this as an accessibility setup wizard, not an
  afterthought in Settings.
- Every onboarding screen is narrated aloud automatically.

### 6.2 Register / Login
- Two fields only (email, password) plus name/phone on register — one field
  visible/focused at a time is preferable to a full form on one screen for
  this audience.
- Large, clearly labeled show/hide-password control.
- Voice-guided field-by-field flow as an alternative to manual typing.
- Errors (wrong credentials, duplicate email) announced immediately and
  specifically, in Arabic.

### 6.3 Home / "My Documents"
- The user's document list, most recent first — each item shows: a large
  icon by document type, the plain-Arabic summary (or a "still working on
  it" state), the expiry date if any (visually flagged if soon/passed), and
  is entirely tappable (no tiny inline buttons).
- The **primary action (scan a new document) is a large, fixed,
  always-reachable button** — this is the single most important control in
  the whole app.
- Empty state (no documents yet) explains what to do next, spoken aloud on
  first arrival.

### 6.4 Camera / Upload
- Full-screen camera view with **audio guidance for framing** if feasible
  (e.g. "قرّب الكاميرا شوية" / "move closer") — flag this as a stretch goal
  if real-time framing feedback isn't feasible yet, but the capture button
  itself must be huge, centered, and give strong audio+haptic confirmation
  on capture.
- Immediately after capture: a clear, spoken "processing" state (the backend
  upload returns instantly but OCR/AI takes several seconds) — never a blank
  or ambiguous screen during this wait.
- Also allow picking an existing photo, for a user who has someone else take
  the photo for them.

### 6.5 Document detail
- Leads with the **spoken summary**, playing automatically (with a visible
  "replay" control), not with the raw image or a wall of text.
- Structured, clearly labeled sections below: document type, key facts
  (name/address/governorate as applicable), dates, amounts, expiry date
  (with a "reminder set for X" confirmation if one was created), and the raw
  extracted text (available but not the default focus — this is for a
  sighted helper double-checking, not the primary experience).
- A large, persistent **"ask about this document"** control that jumps
  straight into the voice Q&A ([§6.6](#66-ai-voice-assistant-ask-about-a-document)) already scoped to
  this document.
- Delete and share actions, both clearly labeled, both with spoken
  confirmation before/after.
- Processing/failed states get their own clear, calm treatment (see §5,
  Motion/Timing/Error).

### 6.6 AI voice assistant (ask about a document)
- This is the emotional core of the product — design it like a
  conversation, not a form. Chat-bubble layout is fine visually (per the
  deck's "chat bubbles in Arabic" reference), but every bubble's content
  must also be announced/playable as audio, and the input path defaults to
  **press-and-hold or tap-to-record**, with typing as the secondary option.
- Persistent conversation history per document, so returning to a document
  later resumes the same thread.
- Strong, obvious recording-state feedback (visual pulse **and** audio tone
  **and** haptic).
- The AI's spoken answer should auto-play; provide an unmistakable replay
  control per message.

### 6.7 Archive / Search
- A single large search field, voice-searchable (say what you're looking
  for instead of typing).
- Tag filters shown as large, clearly labeled toggle chips (never
  color-only), reflecting real tags like "identity," "government,"
  "financial," "expiry."
- Results reuse the same document list item as Home.

### 6.8 Share
- Shows the QR code (for a sighted person nearby to scan) alongside a
  spoken/read-aloud explanation of what sharing does and a plain-text/copy
  link fallback for the user themself, since a QR code is inherently a
  visual-only mechanism — never make it the *only* way to share.

### 6.9 Reminders
- List of upcoming reminders, soonest first, each clearly stating what it's
  for and when, read aloud.
- Manual "add a reminder" flow, voice-first (speak the date/message).
- Distinguish automatically-created (from a document's expiry) vs
  manually-added reminders in both label and spoken description.

### 6.10 Settings
- Accessibility controls **live at the top, not buried**: text size, high
  contrast toggle, dark mode, voice-guidance on/off, voice speed, haptics
  on/off.
- FCM push-notification permission with a plain explanation of *why*
  ("عشان نفكرك قبل ما مستنداتك تنتهي" — "so we can remind you before your
  documents expire") before requesting the OS permission.
- Account info, logout.

### 6.11 (Roadmap, design as a placeholder/future-state) Nearby offices & voice form filling
- Not yet wired to the main authenticated app (today it exists as a
  separate, unauthenticated legacy capability) — design these as clearly
  "coming soon" entries in the features list so the roadmap is visible, but
  don't spec full flows for them yet.

---

## 7. Component & pattern library to define

Ask Claude Design to produce a small, reusable system rather than one-off
screens:

- **Primary voice/record button** — the single most-reused component in the
  app; define its idle, recording, processing, and error states (visual +
  audio + haptic for each).
- **Document card / list item** — reused on Home, Archive, and Search
  results.
- **Status indicator** (processing / done / failed) — icon + label +
  color, never color alone.
- **Spoken-content block** — any block of text that has an associated
  "play/replay audio" affordance (summaries, AI answers, reminders).
- **Large primary button**, **large secondary/text button**, and **destructive
  action button** (with built-in confirm step) styles.
- **Tag/filter chip**.
- **Empty state** and **error state** patterns (illustration optional, but
  copy + audio + next-step action required every time).
- **Settings toggle row** for accessibility preferences.

---

## 8. What to deliver back

1. A defined **design token set**: an accessible color palette derived from
   §3's brand colors (with documented contrast ratios against both white and
   near-black backgrounds), type scale (with the 200%-scaling behavior
   specified), spacing scale, and the two type-family pairings from §3.
2. **High-fidelity screens** for every item in §6, each in light, dark, and
   high-contrast variants, in Arabic/RTL, using realistic Arabic copy (not
   lorem ipsum) — pull real example content from
   [`FRONTEND_GUIDE.md`](FRONTEND_GUIDE.md) / [`API_DOCUMENTATION.md`](API_DOCUMENTATION.md)
   in this repo if sample data is needed (e.g. real `doc_type`/tag values,
   real response shapes).
3. The **component library** from §7 as reusable, documented pieces.
4. For each screen, a short note on **what gets spoken aloud automatically**
   vs **on-demand**, and what the **screen-reader focus order** is — this is
   as much a deliverable as the visuals themselves for this product.
5. Called out explicitly: any place where the brand's decorative elements
   (shapes, motifs) were **intentionally reduced or removed** on a
   functional screen for accessibility reasons, so engineering knows it's a
   deliberate tradeoff, not a missed detail.

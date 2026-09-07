# Sahelha Alya (سهلها عليا)

**"Make it easy for me."** Sahelha Alya is an AI assistant that turns
government paperwork into a conversation, for Arabic-speaking people with
visual impairments.

> Turns documents into conversations, using AI, OCR, and Voice.

## Why we're building this

285 million people worldwide live with visual impairment, and more than 45
million of them speak Arabic. Government paperwork — IDs, birth certificates,
utility bills, passports — is confusing even for someone who can read it; for
someone who can't, it's a wall. As of this project, there is no dedicated
solution for Arabic-speaking blind and low-vision users to handle that
paperwork on their own.

Sahelha Alya's goal is to close that gap with a **voice-first, Arabic-first**
app: point a phone camera at a document, and get back a plain-Arabic spoken
summary, the key facts extracted automatically, an expiry reminder if one
applies, and the ability to ask follow-up questions out loud and hear the
answer — no reading or typing required. Every design and engineering decision
here is made for the hardest case first (a user with zero functional vision
relying entirely on a screen reader or the app's own voice interface), not
retrofitted for it afterward.

## How it works

1. **Scan** — point the camera at a document and take a photo (or pick an
   existing photo someone else took).
2. **Understand** — the backend runs OCR, then an AI model produces a plain-
   Arabic summary, classifies the document type, and extracts key facts:
   name, address, dates, amounts, and especially an expiry date.
3. **Remind** — if an expiry date is found, a reminder is scheduled
   automatically and delivered as a push notification before it lapses.
4. **Ask** — the user can ask questions about that document out loud (e.g.
   "what's the expiry date on this?") and get back a spoken Arabic answer;
   the assistant remembers the conversation across turns.
5. **Find & share** — every processed document lands in a searchable, spoken-
   friendly archive, and can be shared via QR code.
6. **Roadmap** — voice-driven form filling, and locating the nearest
   government office (not yet wired into the authenticated app).

## Repository layout

```
backend/    FastAPI service — OCR, AI analysis (Groq), voice STT/TTS,
            document Q&A, archive/search, and expiry reminders
frontend/   Expo / React Native app (Arabic, RTL)
```

- [`backend/README.md`](backend/README.md) — local setup, configuration, and
  deployment
- [`backend/API_DOCUMENTATION.md`](backend/API_DOCUMENTATION.md) and
  [`backend/FRONTEND_GUIDE.md`](backend/FRONTEND_GUIDE.md) — full API
  reference and integration guide
- [`backend/SAHELHA_DESIGN_BRIEF.md`](backend/SAHELHA_DESIGN_BRIEF.md) — the
  product/design brief: target users, brand identity, accessibility rules,
  and every screen the app needs
- [`frontend/docs/`](frontend/docs/) — frontend architecture, API notes, and
  project status

## Who this is for

Designed for the hardest case first, then confirmed to work well for lighter
cases too:

1. **No/near-zero functional vision** — relies entirely on a screen reader
   and/or the app's own voice interface. The primary persona; nothing in the
   app should require sight to complete.
2. **Partial vision loss** (e.g. glaucoma, tunnel vision, blurred vision) —
   needs very large text, very high contrast, and simple, single-focus
   screens.
3. **Elderly users** — needs large touch targets, obvious affordances, and
   forgiving interactions with easy undo.

All three are Arabic speakers first: copy, voice prompts, and layout are
designed in Arabic and right-to-left from the start. See the
[design brief](backend/SAHELHA_DESIGN_BRIEF.md) for the full accessibility
rules (WCAG 2.2 AA floor with AAA contrast where possible), brand identity,
and screen-by-screen specification.

## Getting started

See [`backend/README.md`](backend/README.md) to run the API locally, and
[`frontend/`](frontend/) (Expo) for the mobile app — `npm install && npm start`
from that directory once the backend is running and `frontend/.env` points at
it.

## Status

This is an active, working build, not a concept: auth, document upload/OCR/AI
analysis, the voice Q&A assistant, reminders, and archive/search are all
implemented on the backend today. See
[`backend/SUMMARY.md`](backend/SUMMARY.md) and
[`frontend/docs/PROJECT_STATUS.md`](frontend/docs/PROJECT_STATUS.md) for
current progress.

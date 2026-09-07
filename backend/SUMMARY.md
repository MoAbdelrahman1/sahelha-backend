# Session Context — Sahelha Backend (Person A track)

Use this file to catch a new chat up on where things stand. For a plain-English
version for non-technical teammates, see `BACKEND_UPDATE_SUMMARY.md`. For the
original day-by-day plan this work is loosely based on, see `person_a_guide.md`.

## Who's doing what

- **Person A (backend, this user)**: infra, auth, documents, archive, reminders, deploy.
- **AI engineer**: owns `app/services/ocr_service.py` (EasyOCR ar/en) and
  `app/services/ai_service.py` (Groq LLM analysis). Both are wired into the app now
  (see below) — don't restructure their files without checking with them first.
- Repo has a teammate `MoAbdelrahman1` pushing to a shared `main`; work has already
  gone through one PR merge back into `Feature/Backend_setup`.

## Architecture decision (important — deviates from person_a_guide.md)

`person_a_guide.md` describes a Postgres + SQLAlchemy + Alembic + python-jose stack.
**That is not what's running.** The actual app is a FastAPI + raw `sqlite3` monolith
(single file `sahelha.db`, no ORM, no migrations tool). This was a deliberate choice
made mid-project: rewriting to Postgres would have thrown away a working app and
orphaned the AI engineer's already-integrated pipeline, so the guide's *goals*
(auth, document ownership, background processing) were adapted onto the existing
SQLite stack instead of doing the guide's stack literally. If you're tempted to
"fix" this to match the guide, don't — it was a conscious tradeoff, ask the user first.

Consequence: no `python-jose`/`passlib` (not installed, no network access to add
them at the time) — JWT is hand-rolled HS256 using only stdlib (`hmac`, `hashlib`,
`base64`, `json`) in `app/core/security.py`. It's spec-compliant, so swapping in a
real JWT library later is a drop-in change if you ever get network access to
install one, but there's no need to unless a real requirement forces it.

## What's done (maps to person_a_guide.md Day 1–3)

- **Day 1 (setup)**: app boots (`main.py` → `app.api:app`). It was actually broken
  before this work — a half-finished refactor left flat files (`app/api.py`,
  `app/services.py`, `app/schemas.py`) shadowed by same-named empty package
  directories, so `from app.api import app` crashed on import. Fixed by moving
  real code into the packages (`app/api/legacy.py`, `app/services/legacy.py`,
  `app/schemas/*.py`) and deleting the dead/broken duplicates
  (`app/models/*.py` had literal syntax errors, unused, deleted).
- **Day 2 (auth)**: `users` table in `app/db.py`. Register/login/me in
  `app/api/auth.py`. Password hashing via PBKDF2 (already-written code in
  `app/core/security.py`, just wired up).
- **Day 3 (documents)**: `app/api/documents.py` — upload saves the file, runs
  `app.services.pipeline.process_document_pipeline()` as a FastAPI background task,
  writes OCR text + Groq analysis (doc_type, summary, dates, amounts, expiry, tags)
  back onto the `documents` row via new columns (`user_id`, `image_path`, `status`,
  `ai_summary`, `tags`, `dates_json`, `amounts_json`, `expiry_date` — added via an
  idempotent `ALTER TABLE` migration in `app/db.py::migrate_documents_table`, since
  the `documents` table already existed with fewer columns).

- **Day 4 (voice routes)**: `app/api/voice.py` — authenticated thin wrappers
  `POST /api/voice/stt` (multipart `file`, saves under `uploads/<user_id>/`,
  then calls `app.services.voice_service.transcribe(audio_path)`) and `POST
  /api/voice/tts` (body `{text, language?}`, calls
  `app.services.voice_service.synthesize(text, language, output_path)` and
  writes under `uploads/<user_id>/tts_*.wav`, served via the existing
  `/uploads` static mount). `app/services/voice_service.py` doesn't exist yet
  (AI engineer's to build) — both routes catch the `ImportError` and return
  503, same graceful-degrade pattern `documents.py` used before
  `pipeline.py` existed. Registered in `app/api/__init__.py` under prefix
  `/api/voice`; doesn't collide with the pre-existing unauthenticated
  placeholder `/api/voice/transcribe` in `legacy.py`, which is untouched.

All of this was actually run and smoke-tested (register, duplicate-email 400,
login, wrong-password 401, `/me` with/without token, upload → background
processing → status flip, list, get, delete, cross-cutting 404s, voice `/stt`
and `/tts` returning 403 unauthenticated / 503 pending `voice_service.py`)
— not just written and assumed to work.

## Endpoints

**Auth** — `/api/auth/register`, `/api/auth/login` (POST, body `{email, password,
full_name?, phone?}` for register / `{email, password}` for login → returns
`{access_token, refresh_token, token_type, user}`), `/api/auth/me` (GET, Bearer token).

**Documents** (all require `Authorization: Bearer <token>`) — `POST
/api/documents/upload` (multipart `file`, image only → `{doc_id, status:
"processing", message}`), `GET /api/documents/` (list), `GET
/api/documents/{doc_id}` (poll for status `done`/`failed`), `DELETE
/api/documents/{doc_id}`.

**Voice** (require `Authorization: Bearer <token>`) — `POST /api/voice/stt`
(multipart `file` → `{transcript, language}`, 503 until `voice_service.py`
exists), `POST /api/voice/tts` (`{text, language?}` →
`{audio_url}`, 503 until `voice_service.py` exists).

**Pre-existing, untouched, no auth** — `/health`, `/api/ready`, `/api/services`,
`/api/services/{id}/steps`, `/api/offices/nearby`, `/api/chat/message`,
`/api/document/analyze` (old heuristic-only analyzer, superseded by
`/api/documents/upload` but kept for backward compat), `/api/document/read`,
`/api/audio/{cache_key}`, `/api/voice/transcribe` (placeholder transcript,
superseded by `/api/voice/stt` but kept for backward compat).

Full interactive docs: run the server, open `/docs`.

## How to run / test

```
mkdir uploads   # gitignored, must exist locally
python -m uvicorn main:app --reload   # plain `uvicorn` may not be on PATH — use -m
```

Then `http://127.0.0.1:8000/docs`. See `BACKEND_UPDATE_SUMMARY.md` for a
click-through walkthrough, or the earlier chat transcript for curl examples.

## Known gaps / things to watch

- `easyocr` and `groq` may not be installed in every dev shell — if missing,
  uploads correctly degrade to `status:"failed"` with a fallback summary rather
  than crashing (that's the AI engineer's existing error handling, working as
  intended). Don't mistake that for a bug; check `pip list` / `.env`
  (`GROQ_API_KEY`) before assuming something's broken.
- `sahelha.db` is committed to git (unusual, but that's the existing convention —
  seed data for services/offices lives in it). Don't leave test users/documents
  in it before committing — `git checkout -- sahelha.db` reverts stray test writes.
- No pip network access was available in the environment this was built in — if
  a future task needs a new dependency, check that first rather than assuming
  `pip install` will work.

## Not started yet (per person_a_guide.md, adapted to the SQLite approach above)

- Day 5: archive/search (`/api/document/analyze`'s heuristic version exists;
  no `/api/archive/search` or QR share endpoint yet).
- Day 6: reminders (no `reminders` table or endpoints yet).
- Day 7: deploy + Postman collection for judges.

## Handoff to AI engineer (voice)

Day 4 only built the HTTP layer. `app/services/voice_service.py` needs two
functions for `/api/voice/stt` and `/api/voice/tts`
(`app/api/voice.py`) to stop 503ing:

```python
def transcribe(audio_path: str) -> str: ...
def synthesize(text: str, language: str, output_path: str) -> None: ...
```

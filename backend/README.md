# Sahelha Backend

FastAPI backend for Arabic document OCR, AI analysis (Groq), voice STT/TTS,
an AI document Q&A assistant, archive search, and expiry reminders.

## Local development

```bash
python -m venv venv
venv\Scripts\activate            # Windows
pip install -r requirements.txt
copy .env.example .env           # then fill in GROQ_API_KEY at minimum
uvicorn main:app --reload
```

API docs: http://localhost:8000/docs

## Configuration

See [.env.example](.env.example) for all environment variables. At minimum,
set `GROQ_API_KEY` and `SECRET_KEY` before running outside local dev.

## Data storage

This backend uses a single SQLite file (`sahelha.db`) with schema/migrations
applied automatically on startup (see `app/db.py`) — there is no separate
migration step to run. Uploaded files and generated audio live under
`uploads/`. Both `sahelha.db` and `uploads/` must live on **persistent
storage** in production: a plain container filesystem is wiped on every
deploy/restart, which would delete all documents, reminders, and accounts.

## Deploying to Render

1. Push this repo to GitHub/GitLab.
2. In Render: **New > Web Service**, connect the repo, choose **Docker** as
   the environment (the included `Dockerfile` will be used automatically).
3. Add a **persistent disk** (Render dashboard: service → Disks), mounted at
   `/app/data`, and set:
   - `UPLOAD_DIR=/app/data/uploads`
   - `DB_PATH=/app/data/sahelha.db`
4. Set environment variables on the service: `SECRET_KEY`, `GROQ_API_KEY`,
   `GROQ_MODEL` (optional), `FCM_SERVER_KEY` (optional), `ALLOWED_ORIGINS`
   (your deployed frontend's origin, comma-separated if more than one).
5. Deploy. Render will build the Docker image and run
   `uvicorn main:app --host 0.0.0.0 --port 8000`; point Render's health
   check at `/health`.
6. Smoke test after deploy:
   ```bash
   curl https://<your-service>.onrender.com/health
   curl https://<your-service>.onrender.com/api/ready
   ```

## API surface for frontend integration

For the full flow, request/response examples, error handling, a changelog
of recently-fixed bugs, and step-by-step verification instructions, see
**[FRONTEND_GUIDE.md](FRONTEND_GUIDE.md)**.

- Interactive docs/schema: `/docs`, `/openapi.json`
- Auth: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
  — Bearer JWT in the `Authorization` header for all routes below
- Documents: `POST /api/documents/upload`, `GET /api/documents`,
  `GET /api/documents/{id}`, `DELETE /api/documents/{id}`
- Voice: `POST /api/voice/stt`, `POST /api/voice/tts`
- AI assistant (voice/text Q&A about a document):
  `POST /api/ai/ask` — form fields `document_id`, `session_id` (optional),
  and either `question` (text) or `audio` (file)
- Archive: `GET /api/archive/search?q=...&tags=a,b`,
  `GET /api/archive/share/{doc_id}`
- Reminders: see `app/api/reminders.py`

CORS is restricted to `ALLOWED_ORIGINS` — add your frontend's URL there
before integrating.

# Person A — Backend Guide
## Core Infrastructure, Auth, Documents, Archive, Reminders & Deployment

> **Your role:** You build the backbone — everything the AI features plug into.
> Person B cannot save or serve anything without your work. Own it.

---

## Day 1 — Project Setup

### 1. Create the repo and folder structure

```bash
mkdir govdoc-backend && cd govdoc-backend
git init
git checkout -b dev
```

Create this exact structure:

```
govdoc-backend/
├── app/
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── api/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── documents.py
│   │   ├── archive.py
│   │   └── reminders.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── archive_service.py
│   │   └── reminder_service.py
│   ├── models/
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── document.py
│   │   └── reminder.py
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── user.py
│   │   └── document.py
│   └── core/
│       ├── __init__.py
│       ├── security.py
│       └── storage.py
├── alembic/
├── uploads/
├── requirements.txt
├── Dockerfile
├── .env
├── .env.example
├── .gitignore
└── README.md
```

```bash
# Create all folders and empty __init__ files
find app -type d -exec touch {}/__init__.py \;
mkdir -p uploads alembic
```

---

### 2. Install dependencies

```bash
pip install fastapi uvicorn[standard] sqlalchemy asyncpg alembic \
  python-jose[cryptography] passlib[bcrypt] python-multipart \
  pydantic-settings python-dotenv qrcode[pil] apscheduler \
  aiofiles pillow firebase-admin
```

Save to `requirements.txt`:

```bash
pip freeze > requirements.txt
```

---

### 3. Config and environment

**`.env`**
```env
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/govdoc
SECRET_KEY=your-super-secret-key-change-this
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_HOURS=24
REFRESH_TOKEN_EXPIRE_DAYS=30
UPLOAD_DIR=uploads
FIREBASE_CREDENTIALS_PATH=firebase.json
```

**`.env.example`** — same file but with empty values. Commit this, never commit `.env`.

**`app/config.py`**
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_HOURS: int = 24
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    UPLOAD_DIR: str = "uploads"
    FIREBASE_CREDENTIALS_PATH: str = "firebase.json"

    class Config:
        env_file = ".env"

settings = Settings()
```

---

### 4. Database setup

**`app/database.py`**
```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=True)

AsyncSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

class Base(DeclarativeBase):
    pass

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
```

---

### 5. Main app entry point

**`app/main.py`**
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.api import auth, documents, archive, reminders
from app.services.reminder_service import send_due_reminders
from app.database import engine, Base
import os

scheduler = AsyncIOScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create upload directory
    os.makedirs("uploads", exist_ok=True)
    # Start scheduler
    scheduler.add_job(send_due_reminders, "interval", minutes=30)
    scheduler.start()
    yield
    scheduler.shutdown()

app = FastAPI(title="GovDoc AI", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(auth.router,      prefix="/auth",      tags=["Auth"])
app.include_router(documents.router, prefix="/documents", tags=["Documents"])
app.include_router(archive.router,   prefix="/archive",   tags=["Archive"])
app.include_router(reminders.router, prefix="/reminders", tags=["Reminders"])

@app.get("/health")
async def health():
    return {"status": "ok"}
```

---

### 6. Initialize Alembic

```bash
alembic init alembic
```

Edit `alembic/env.py` — find the `target_metadata` line and replace:
```python
from app.database import Base
from app.models import user, document, reminder   # import all models
target_metadata = Base.metadata
```

Also set the database URL in `alembic.ini`:
```ini
sqlalchemy.url = postgresql+asyncpg://user:password@localhost:5432/govdoc
```

---

### 7. Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libpq-dev gcc && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

### 8. `.gitignore`

```
.env
__pycache__/
*.pyc
uploads/
*.egg-info/
.venv/
firebase.json
```

**End of Day 1 checklist:**
- [ ] Folder structure created
- [ ] `uvicorn app.main:app --reload` runs without errors
- [ ] `/health` returns `{"status": "ok"}`
- [ ] Push to `feat/person-a-setup` → merge into `dev`

---

## Day 2 — Auth System

### 1. User model

**`app/models/user.py`**
```python
from sqlalchemy import String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
import uuid

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20))
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(255))
    fcm_token: Mapped[str | None] = mapped_column(String)   # for push notifications
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
```

---

### 2. Security helpers

**`app/core/security.py`**
```python
from datetime import datetime, timedelta
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.config import settings
from app.database import get_db
from app.models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer()

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=settings.ACCESS_TOKEN_EXPIRE_HOURS)
    return jwt.encode({"sub": user_id, "exp": expire}, settings.SECRET_KEY, settings.ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": user_id, "exp": expire, "type": "refresh"}, settings.SECRET_KEY, settings.ALGORITHM)

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user
```

---

### 3. Auth schemas

**`app/schemas/user.py`**
```python
from pydantic import BaseModel, EmailStr

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str | None = None
    phone: str | None = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str | None
    class Config:
        from_attributes = True
```

---

### 4. Auth router

**`app/api/auth.py`**
```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.user import User
from app.schemas.user import RegisterRequest, LoginRequest, TokenResponse, UserResponse
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, get_current_user

router = APIRouter()

@router.post("/register", response_model=TokenResponse)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        full_name=body.full_name,
        phone=body.phone,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )

@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )

@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return current_user
```

---

### 5. Run your first migration

```bash
alembic revision --autogenerate -m "create users table"
alembic upgrade head
```

**End of Day 2 checklist:**
- [ ] `POST /auth/register` returns tokens
- [ ] `POST /auth/login` works
- [ ] `GET /auth/me` returns user (with token in header)
- [ ] Wrong password returns 401
- [ ] Push to `feat/person-a-auth` → merge into `dev`, notify Person B

---

## Day 3 — Document Upload & Background Task

### 1. Document model

**`app/models/document.py`**
```python
from sqlalchemy import String, Text, DateTime, JSON, ARRAY, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
import uuid

class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str | None] = mapped_column(String(500))
    doc_type: Mapped[str | None] = mapped_column(String(100))
    image_path: Mapped[str | None] = mapped_column(Text)
    ocr_text: Mapped[str | None] = mapped_column(Text)
    ai_summary: Mapped[str | None] = mapped_column(Text)
    metadata_: Mapped[dict] = mapped_column("metadata", JSON, default=dict)
    tags: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(50), default="processing")  # processing | done | failed
    language: Mapped[str] = mapped_column(String(10), default="ar")
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
```

---

### 2. File storage helper

**`app/core/storage.py`**
```python
import os, uuid, aiofiles
from fastapi import UploadFile
from app.config import settings

async def save_upload(file: UploadFile, user_id: str) -> str:
    user_dir = os.path.join(settings.UPLOAD_DIR, user_id)
    os.makedirs(user_dir, exist_ok=True)

    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join(user_dir, filename)

    async with aiofiles.open(filepath, "wb") as f:
        content = await file.read()
        await f.write(content)

    return filepath

def delete_file(path: str):
    if path and os.path.exists(path):
        os.remove(path)
```

---

### 3. Document schemas

**`app/schemas/document.py`**
```python
from pydantic import BaseModel
from datetime import datetime

class DocumentResponse(BaseModel):
    id: str
    title: str | None
    doc_type: str | None
    ai_summary: str | None
    status: str
    tags: list
    metadata_: dict
    created_at: datetime

    class Config:
        from_attributes = True

class DocumentUploadResponse(BaseModel):
    doc_id: str
    status: str
    message: str
```

---

### 4. Document router

**`app/api/documents.py`**
```python
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.document import Document
from app.models.user import User
from app.schemas.document import DocumentResponse, DocumentUploadResponse
from app.core.security import get_current_user
from app.core.storage import save_upload, delete_file

router = APIRouter()

# This function will be called by Person B's pipeline
# It updates the document once OCR + AI are done
async def process_document_pipeline(doc_id: str):
    """
    Person B fills in the body of this function in ai_service.py.
    You just need to call it here as a background task.
    """
    try:
        from app.services.ai_service import run_full_pipeline
        await run_full_pipeline(doc_id)
    except ImportError:
        # Person B hasn't built this yet — safe to ignore during dev
        pass
    except Exception as e:
        print(f"Pipeline error for {doc_id}: {e}")

@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are accepted")

    filepath = await save_upload(file, current_user.id)

    doc = Document(user_id=current_user.id, image_path=filepath, status="processing")
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    background_tasks.add_task(process_document_pipeline, doc.id)

    return DocumentUploadResponse(doc_id=doc.id, status="processing", message="Document received")

@router.get("/", response_model=list[DocumentResponse])
async def list_documents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Document)
        .where(Document.user_id == current_user.id)
        .order_by(Document.created_at.desc())
    )
    return result.scalars().all()

@router.get("/{doc_id}", response_model=DocumentResponse)
async def get_document(
    doc_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Document).where(Document.id == doc_id, Document.user_id == current_user.id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc

@router.delete("/{doc_id}")
async def delete_document(
    doc_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Document).where(Document.id == doc_id, Document.user_id == current_user.id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    delete_file(doc.image_path)
    await db.delete(doc)
    await db.commit()
    return {"message": "Deleted"}
```

---

### 5. Migrate and test

```bash
alembic revision --autogenerate -m "create documents table"
alembic upgrade head
```

**End of Day 3 checklist:**
- [ ] `POST /documents/upload` accepts an image and returns `doc_id`
- [ ] `GET /documents/` lists the user's documents
- [ ] `GET /documents/{id}` returns a single document
- [ ] `DELETE /documents/{id}` works
- [ ] Background task runs without crashing (even if pipeline not built yet)

---

## Day 4 — Voice Endpoints (thin wrappers for Person B)

Your job today is to create the route files so Person B's services have somewhere to live. You own the HTTP layer; they own the logic.

**`app/api/voice.py`**
```python
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.user import User
from app.core.security import get_current_user
from app.core.storage import save_upload
import os

router = APIRouter()

@router.post("/stt")
async def speech_to_text(
    audio: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    audio_path = await save_upload(audio, current_user.id)
    try:
        from app.services.voice_service import transcribe
        transcript = transcribe(audio_path)
        return {"transcript": transcript}
    except ImportError:
        raise HTTPException(status_code=503, detail="STT service not ready yet")
    finally:
        if os.path.exists(audio_path):
            os.remove(audio_path)

@router.post("/tts")
async def text_to_speech(
    body: dict,
    current_user: User = Depends(get_current_user),
):
    text = body.get("text", "")
    if not text:
        raise HTTPException(status_code=400, detail="text is required")
    try:
        from app.services.voice_service import synthesize
        import uuid
        output_path = f"uploads/{current_user.id}/tts_{uuid.uuid4()}.wav"
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        synthesize(text, output_path)
        return {"audio_url": f"/{output_path}"}
    except ImportError:
        raise HTTPException(status_code=503, detail="TTS service not ready yet")
```

Add this router to `main.py`:
```python
from app.api import voice
app.include_router(voice.router, prefix="/voice", tags=["Voice"])
```

---

## Day 5 — Archive & Search

### 1. Archive service

**`app/services/archive_service.py`**
```python
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, cast, String
from app.models.document import Document
import qrcode, io, base64, uuid, os

async def search_documents(user_id: str, query: str, db: AsyncSession) -> list[Document]:
    q = query.lower().strip()
    result = await db.execute(
        select(Document).where(
            Document.user_id == user_id,
            or_(
                cast(Document.tags, String).ilike(f"%{q}%"),
                Document.ai_summary.ilike(f"%{q}%"),
                Document.ocr_text.ilike(f"%{q}%"),
                Document.doc_type.ilike(f"%{q}%"),
                Document.title.ilike(f"%{q}%"),
            )
        ).order_by(Document.created_at.desc()).limit(20)
    )
    return result.scalars().all()

def generate_qr(doc_id: str, base_url: str = "https://govdoc.app") -> str:
    share_url = f"{base_url}/view/{doc_id}"
    qr = qrcode.make(share_url)
    buffer = io.BytesIO()
    qr.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode()

async def save_qr_image(doc_id: str) -> str:
    qr_dir = "uploads/qr"
    os.makedirs(qr_dir, exist_ok=True)
    path = f"{qr_dir}/{doc_id}.png"
    share_url = f"https://govdoc.app/view/{doc_id}"
    qr = qrcode.make(share_url)
    qr.save(path)
    return path
```

---

### 2. Archive router

**`app/api/archive.py`**
```python
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.user import User
from app.core.security import get_current_user
from app.services.archive_service import search_documents, generate_qr
from app.schemas.document import DocumentResponse

router = APIRouter()

@router.get("/search", response_model=list[DocumentResponse])
async def search(
    q: str = Query(..., description="Natural language query"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await search_documents(current_user.id, q, db)

@router.get("/share/{doc_id}")
async def share_document(
    doc_id: str,
    current_user: User = Depends(get_current_user),
):
    qr_b64 = generate_qr(doc_id)
    share_url = f"https://govdoc.app/view/{doc_id}"
    return {"qr_image_base64": qr_b64, "share_url": share_url}
```

---

## Day 6 — Reminders

### 1. Reminder model

**`app/models/reminder.py`**
```python
from sqlalchemy import String, Text, DateTime, Boolean, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
import uuid

class Reminder(Base):
    __tablename__ = "reminders"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"))
    document_id: Mapped[str | None] = mapped_column(String, ForeignKey("documents.id", ondelete="CASCADE"))
    remind_at: Mapped[DateTime] = mapped_column(DateTime, nullable=False)
    message: Mapped[str | None] = mapped_column(Text)
    sent: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
```

---

### 2. Reminder service (with FCM push)

**`app/services/reminder_service.py`**
```python
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import AsyncSessionLocal
from app.models.reminder import Reminder
from app.models.user import User
from datetime import datetime
import firebase_admin
from firebase_admin import credentials, messaging
from app.config import settings
import os

# Initialize Firebase once
if not firebase_admin._apps and os.path.exists(settings.FIREBASE_CREDENTIALS_PATH):
    cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
    firebase_admin.initialize_app(cred)

async def send_due_reminders():
    """Called by APScheduler every 30 minutes."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Reminder, User)
            .join(User, Reminder.user_id == User.id)
            .where(
                Reminder.remind_at <= datetime.utcnow(),
                Reminder.sent == False,
            )
        )
        rows = result.all()

        for reminder, user in rows:
            if user.fcm_token:
                try:
                    message = messaging.Message(
                        notification=messaging.Notification(
                            title="تذكير مستند",
                            body=reminder.message or "لديك مستند يحتاج انتباهك",
                        ),
                        token=user.fcm_token,
                    )
                    messaging.send(message)
                except Exception as e:
                    print(f"FCM error for user {user.id}: {e}")

            reminder.sent = True
            await db.commit()

async def create_reminder_from_expiry(doc_id: str, user_id: str, expiry_date: str, db: AsyncSession):
    """Called by Person B's pipeline after extracting expiry date."""
    from datetime import datetime
    try:
        remind_at = datetime.fromisoformat(expiry_date)
    except ValueError:
        return  # Skip if date format is unrecognized

    reminder = Reminder(
        user_id=user_id,
        document_id=doc_id,
        remind_at=remind_at,
        message=f"مستندك ينتهي في {expiry_date}",
    )
    db.add(reminder)
    await db.commit()
```

---

### 3. Reminders router

**`app/api/reminders.py`**
```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from datetime import datetime
from app.database import get_db
from app.models.reminder import Reminder
from app.models.user import User
from app.core.security import get_current_user

router = APIRouter()

class ReminderCreate(BaseModel):
    document_id: str | None = None
    remind_at: datetime
    message: str | None = None

class ReminderResponse(BaseModel):
    id: str
    document_id: str | None
    remind_at: datetime
    message: str | None
    sent: bool
    class Config:
        from_attributes = True

@router.get("/", response_model=list[ReminderResponse])
async def list_reminders(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Reminder)
        .where(Reminder.user_id == current_user.id)
        .order_by(Reminder.remind_at.asc())
    )
    return result.scalars().all()

@router.post("/", response_model=ReminderResponse)
async def create_reminder(
    body: ReminderCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    reminder = Reminder(user_id=current_user.id, **body.model_dump())
    db.add(reminder)
    await db.commit()
    await db.refresh(reminder)
    return reminder

@router.delete("/{reminder_id}")
async def delete_reminder(
    reminder_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Reminder).where(Reminder.id == reminder_id, Reminder.user_id == current_user.id)
    )
    reminder = result.scalar_one_or_none()
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    await db.delete(reminder)
    await db.commit()
    return {"message": "Deleted"}
```

---

### 4. Run final migration

```bash
alembic revision --autogenerate -m "create reminders table"
alembic upgrade head
```

**End of Day 6 checklist:**
- [ ] Reminder CRUD works
- [ ] APScheduler logs "checking reminders" every 30 min
- [ ] `GET /archive/search?q=كهرباء` returns matching documents
- [ ] QR endpoint returns a base64 PNG
- [ ] Meet with Person B — wire their pipeline output into your document update

---

## Day 7 — Deploy to Render

### 1. Push everything to GitHub

```bash
git checkout main
git merge dev
git push origin main
```

---

### 2. Deploy on Render

1. Go to [render.com](https://render.com) → New → **Web Service**
2. Connect your GitHub repo
3. Set these fields:
   - **Environment:** Docker
   - **Branch:** main
   - **Build Command:** *(leave blank — uses Dockerfile)*
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port 8000`

4. Add environment variables (from your `.env`):
   - `DATABASE_URL` ← use Render's Postgres URL (see below)
   - `SECRET_KEY`
   - `UPLOAD_DIR=uploads`

5. Go to **New → PostgreSQL** → create a free database → copy the **Internal Database URL** → paste as `DATABASE_URL`

---

### 3. Run migrations in production

In Render dashboard → your web service → **Shell tab**:

```bash
alembic upgrade head
```

---

### 4. Verify deployment

```bash
curl https://your-app.onrender.com/health
# Should return: {"status": "ok"}
```

---

### 5. Build Postman collection for judges

Create a collection with these 5 requests in order:

| # | Request | What it shows |
|---|---------|---------------|
| 1 | `POST /auth/register` | Create a test account |
| 2 | `POST /documents/upload` | Upload a real Arabic document image |
| 3 | `GET /documents/{id}` | Show extracted summary + dates |
| 4 | `GET /archive/search?q=كهرباء` | Natural language search |
| 5 | `GET /archive/share/{id}` | QR code generation |

Save the token from step 1 as a Postman environment variable `{{token}}` and use `Bearer {{token}}` as auth on all subsequent requests.

---

## Quick Reference

### Run locally
```bash
uvicorn app.main:app --reload
# Swagger UI → http://localhost:8000/docs
```

### Daily git flow
```bash
git checkout dev && git pull origin dev
git checkout -b feat/person-a-<feature>
# ... do work ...
git add . && git commit -m "feat: description"
git push origin feat/person-a-<feature>
# Open PR → merge into dev
```

### Common errors

| Error | Fix |
|-------|-----|
| `asyncpg: connection refused` | PostgreSQL not running — `brew services start postgresql` |
| `alembic: target database is not up to date` | Run `alembic upgrade head` |
| `401 Unauthorized` | Include `Authorization: Bearer <token>` header |
| `ImportError: voice_service` | Normal — Person B hasn't built it yet, endpoint returns 503 |
| Render cold start (slow first request) | Expected on free tier — mention to judges |

---

## What you hand off to Person B

By end of Day 3, tell Person B:

> "The `documents` table is ready. After your OCR + AI pipeline finishes,
> call `update_document()` with this structure:"

```python
# They call this to save their results
await db.execute(
    update(Document)
    .where(Document.id == doc_id)
    .values(
        ocr_text=ocr_text,
        ai_summary=result["summary"],
        doc_type=result["doc_type"],
        metadata_=result,           # full JSON from Groq
        tags=result.get("tags", []),
        status="done",
    )
)
await db.commit()
```

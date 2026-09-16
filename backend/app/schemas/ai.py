from __future__ import annotations

from pydantic import BaseModel


class AiAskResponse(BaseModel):
    session_id: str
    question: str
    answer: str
    answer_audio_url: str | None = None
    service_id: str | None = None
    service_title: str | None = None

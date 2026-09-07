from __future__ import annotations

from pydantic import BaseModel


class VoiceTranscribeResponse(BaseModel):
    transcript: str
    language: str


class VoiceSynthesizeRequest(BaseModel):
    text: str
    language: str = "ar"


class VoiceSynthesizeResponse(BaseModel):
    audio_url: str

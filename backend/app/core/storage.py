from __future__ import annotations

import io
import wave
from pathlib import Path
from typing import Optional


def generate_silence_wav(duration_seconds: float = 1.0, sample_rate: int = 16000) -> bytes:
    frame_count = max(1, int(duration_seconds * sample_rate))
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        silence_frame = (0).to_bytes(2, byteorder="little", signed=True)
        wav_file.writeframes(silence_frame * frame_count)
    return buffer.getvalue()


def save_upload_file(upload_dir: str, filename: str, content: bytes) -> str:
    save_path = Path(upload_dir) / filename
    save_path.parent.mkdir(parents=True, exist_ok=True)
    save_path.write_bytes(content)
    return str(save_path)


def file_extension(filename: str) -> str:
    return Path(filename).suffix.lower()


def is_supported_image(filename: str) -> bool:
    return file_extension(filename) in {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"}


def is_supported_pdf(filename: str) -> bool:
    return file_extension(filename) == ".pdf"


def mime_type_for(filename: str) -> str:
    ext = file_extension(filename)
    mime_map = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".bmp": "image/bmp",
        ".pdf": "application/pdf",
    }
    return mime_map.get(ext, "application/octet-stream")

import os
from pathlib import Path

# Load faster-whisper model once for caching (CPU)
try:
    from faster_whisper import WhisperModel
except ImportError as e:
    raise ImportError("faster-whisper is required for STT. Install it via requirements.txt")

# Initialize model lazily to avoid loading at import time if not needed
_model: WhisperModel | None = None

def _get_model() -> WhisperModel:
    global _model
    if _model is None:
        # "tiny" model is small and fast, works on CPU. It supports Arabic transcription.
        model_path = Path(__file__).parent / "models"
        _model = WhisperModel(
            "small",
            device="cpu",
            compute_type="int8",
            download_root=str(model_path)
        )
    return _model

def transcribe(audio_path: str) -> str:
    """Transcribe an audio file (expected WAV) to Arabic text.

    Parameters
    ----------
    audio_path: str
        Path to the audio file on disk.

    Returns
    -------
    str
        The Arabic transcript (stripped of surrounding whitespace).
    """
    if not os.path.isfile(audio_path):
        raise FileNotFoundError(f"Audio file not found: {audio_path}")
    model = _get_model()
    # faster-whisper returns an iterator of Segment objects
    segments, _ = model.transcribe(
        audio_path,
        language="ar",
        beam_size=1,
        vad_filter=True
    )
    # Concatenate the text of all segments
    transcript = " ".join(segment.text for segment in segments).strip()
    return transcript

# TTS implementation using gTTS (Google Text-to-Speech)
try:
    from gtts import gTTS
except ImportError as e:
    raise ImportError("gTTS is required for TTS. Install it via requirements.txt")

def synthesize(text: str, language: str, output_path: str) -> None:
    """Generate speech audio from text using gTTS.

    Parameters
    ----------
    text: str
        Arabic text to synthesize.
    language: str
        ISO‑639‑1 language code (e.g., "ar" for Arabic).
    output_path: str
        Destination file path (will be created if missing). The function writes an MP3 file.
    """
    if not text:
        raise ValueError("Text for synthesis cannot be empty")
    tts = gTTS(text=text, lang=language)
    output_path_obj = Path(output_path)
    output_path_obj.parent.mkdir(parents=True, exist_ok=True)
    # gTTS writes an MP3 file directly
    tts.save(str(output_path_obj))

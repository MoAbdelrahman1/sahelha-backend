import asyncio
import os
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv
_ENV_PATH = Path(__file__).parent.parent.parent / ".env"
if _ENV_PATH.exists():
    load_dotenv(dotenv_path=_ENV_PATH)
else:
    load_dotenv()

def _detect_audio_filename(audio_path: str, data: bytes) -> str:
    original_name = Path(audio_path).name
    # Check magic bytes to detect WebM/Opus recorded by browsers
    if data.startswith(b"\x1a\x45\xdf\xa3"):
        return "audio.webm"
    if data.startswith(b"RIFF"):
        return "audio.wav"
    if data.startswith(b"OggS"):
        return "audio.ogg"
    if data.startswith(b"ID3") or (len(data) > 2 and data[0] == 0xFF and (data[1] & 0xE0) == 0xE0):
        return "audio.mp3"
    if b"ftyp" in data[:32]:
        return "audio.m4a"
    return original_name

import subprocess

def _preprocess_audio_with_ffmpeg(audio_path: str) -> str:
    """Preprocess audio file to 16kHz Mono WAV with loudness normalization using ffmpeg."""
    if not os.path.isfile(audio_path):
        return audio_path

    wav_out = str(Path(audio_path).with_suffix(".16k.wav"))
    cmd = [
        "ffmpeg", "-y",
        "-i", audio_path,
        "-ac", "1",
        "-ar", "16000",
        "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
        wav_out
    ]
    try:
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        if os.path.isfile(wav_out) and os.path.getsize(wav_out) > 0:
            return wav_out
    except Exception as e:
        print(f"[VOICE SERVICE] ffmpeg audio preprocessing skipped: {e}")

    return audio_path

EGYPTIAN_ARABIC_PROMPT = (
    "سجل ضريبي، بطاقة ضريبية، سجل تجاري، عايز اطلع رخصة مرور، عايز اطلع رخصة قيادة، "
    "عايز اطلع بطاقة رقم قومي، استخراج شهادة وفاة، شهادة ميلاد، السجل المدني، المرور، "
    "مأمورية الضرائب، معاملات وأوراق حكومية مصرية باللهجة العامية"
)

# ── Groq API STT ─────────────────────────────────────────────────────────────
def _transcribe_groq(audio_path: str) -> Optional[str]:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return None

    try:
        from groq import Groq
        client = Groq(api_key=api_key)
        with open(audio_path, "rb") as file:
            data = file.read()
            upload_name = _detect_audio_filename(audio_path, data)
            transcription = client.audio.transcriptions.create(
                file=(upload_name, data),
                model="whisper-large-v3",
                prompt=EGYPTIAN_ARABIC_PROMPT,
                response_format="text",
                language="ar",
                temperature=0.0,
            )
            text = transcription if isinstance(transcription, str) else getattr(transcription, "text", "")
            if text and text.strip():
                clean_text = text.strip()
                print(f"[VOICE SERVICE] Transcribed audio via Groq Whisper API -> {clean_text!r}")
                return clean_text
            return None
    except Exception as e:
        print(f"[VOICE SERVICE] Groq Whisper STT failed ({e}), falling back to faster-whisper")
        return None

# ── faster-whisper fallback STT ───────────────────────────────────────────────
_model = None
_cpu_fallback_model = None

def _setup_cuda_dll_paths():
    if os.name == 'nt':
        import site
        site_pkgs = site.getsitepackages()
        user_site = site.getusersitepackages()
        for s_path in site_pkgs + [user_site]:
            for folder in ["cublas", "cudnn", "cuda_runtime"]:
                bin_dir = os.path.join(s_path, "nvidia", folder, "bin")
                if os.path.isdir(bin_dir):
                    try:
                        os.add_dll_directory(bin_dir)
                        os.environ["PATH"] = bin_dir + os.path.pathsep + os.environ.get("PATH", "")
                    except Exception:
                        pass

_setup_cuda_dll_paths()

def _get_model():
    global _model
    if _model is None:
        try:
            os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
            import ctranslate2
            from faster_whisper import WhisperModel

            use_cuda = ctranslate2.get_cuda_device_count() > 0
            device = "cuda" if use_cuda else "cpu"
            compute_type = "float16" if use_cuda else "int8"

            print(f"[VOICE SERVICE] Initializing faster-whisper on {device.upper()} (GPU Acceleration: {use_cuda})...")

            model_path = Path(__file__).parent / "models"
            _model = WhisperModel(
                "large-v3-turbo",
                device=device,
                compute_type=compute_type,
                download_root=str(model_path)
            )
            print(f"[VOICE SERVICE] ✅ faster-whisper Large V3 Turbo model loaded successfully on {device.upper()}!")
        except Exception as e:
            print(f"[VOICE SERVICE] Failed to load GPU faster-whisper model: {e}")
            return None
    return _model

def _get_cpu_model():
    global _cpu_fallback_model
    if _cpu_fallback_model is None:
        from faster_whisper import WhisperModel
        print("[VOICE SERVICE] Loading CPU fallback faster-whisper model...")
        model_path = Path(__file__).parent / "models"
        _cpu_fallback_model = WhisperModel("large-v3-turbo", device="cpu", compute_type="int8", download_root=str(model_path))
    return _cpu_fallback_model

import difflib
import re

KNOWN_SERVICE_TERMS = [
    "سجل ضريبي",
    "بطاقة ضريبية",
    "سجل تجاري",
    "شهادة وفاة",
    "شهادة ميلاد",
    "شهادة زواج",
    "وثيقة زواج",
    "بطاقة رقم قومي",
    "رخصة قيادة",
    "رخصة مرور",
    "تصريح عمل",
    "عقد زواج",
]

_COMMON_STT_CORRECTIONS = [
    (r"\b(شهدت\s+زيق|شهدتو\s+زوجه|شهدت\s+زواج|شهادة\s+زوج|شهدة\s+زواج)\b", "شهادة زواج"),
    (r"\b(حزة\s+الله\s+بطلق|حزة\s+الله|بطاقة\s+جريبية|بطاقة\s+طريبية)\b", "بطاقة ضريبية"),
    (r"\bشهادة\s+(وعفاها|وعفاه|وعفاة|وفاه)\b", "شهادة وفاة"),
    (r"\b(أظهر|أظل|أشاهد)\s+مخصة\b", "أطلع رخصة"),
    (r"\b(سجل|تسجيل|سج)\s+(جريبي|طريبي|دريبي)\b", "سجل ضريبي"),
    (r"\bسج\b", "سجل"),
]

def _post_process_arabic_transcript(text: str) -> str:
    if not text:
        return ""
    cleaned = text.strip()

    # Deduplicate consecutive identical words (e.g. "قومي قومي" -> "قومي")
    cleaned = re.sub(r'\b(\w+)\s+\1\b', r'\1', cleaned, flags=re.IGNORECASE)

    for pattern, replacement in _COMMON_STT_CORRECTIONS:
        cleaned = re.sub(pattern, replacement, cleaned, flags=re.IGNORECASE)

    # Fuzzy match token sequences against known service terms
    tokens = cleaned.split()
    for i in range(len(tokens)):
        for length in (2, 3):
            if i + length <= len(tokens):
                chunk = " ".join(tokens[i : i + length])
                if chunk in KNOWN_SERVICE_TERMS:
                    continue
                for term in KNOWN_SERVICE_TERMS:
                    ratio = difflib.SequenceMatcher(None, chunk, term).ratio()
                    if ratio >= 0.78 and chunk != term:
                        cleaned = cleaned.replace(chunk, term)
                        break

    return cleaned

def transcribe(audio_path: str) -> str:
    """Transcribe an audio file to Arabic text using Groq Whisper or faster-whisper.

    Parameters
    ----------
    audio_path: str
        Path to the audio file on disk.

    Returns
    -------
    str
        The Arabic transcript.
    """
    if not os.path.isfile(audio_path):
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    # Preprocess audio (convert WebM/m4a to 16kHz Mono WAV with loudness normalization)
    target_audio = _preprocess_audio_with_ffmpeg(audio_path)

    # Primary: Groq Whisper API (sub-second performance)
    groq_result = _transcribe_groq(target_audio)
    if groq_result is not None:
        return _post_process_arabic_transcript(groq_result)

    # Fallback: faster-whisper
    model = _get_model()
    if model is not None:
        try:
            segments, _ = model.transcribe(
                target_audio,
                language="ar",
                initial_prompt=EGYPTIAN_ARABIC_PROMPT,
                beam_size=5,
                vad_filter=True
            )
            raw_text = " ".join(segment.text for segment in segments).strip()
            return _post_process_arabic_transcript(raw_text)
        except Exception as e:
            print(f"[VOICE SERVICE] CUDA execution failed ({e}). Falling back to CPU transcription...")

    # CPU Fallback if CUDA fails due to missing DLLs (e.g. cublas64_12.dll)
    try:
        cpu_model = _get_cpu_model()
        segments, _ = cpu_model.transcribe(
            target_audio,
            language="ar",
            initial_prompt=EGYPTIAN_ARABIC_PROMPT,
            beam_size=5,
            vad_filter=True
        )
        raw_text = " ".join(segment.text for segment in segments).strip()
        return _post_process_arabic_transcript(raw_text)
    except Exception as e:
        print(f"[VOICE SERVICE] CPU Transcription error: {e}")

    return ""


# ── Lahgtna OmniVoice Helper (ehabnegm/lahgtna-omnivoice-egyptian-v3) ─────────
_OMNIVOICE_MODEL_CACHE = None

def _synthesize_lahgtna_omnivoice(text: str, output_path_obj: Path) -> bool:
    """Generate Egyptian Arabic speech using ehabnegm/lahgtna-omnivoice-egyptian-v3."""
    global _OMNIVOICE_MODEL_CACHE
    token = os.getenv("HUGGINGFACE_TOKEN") or os.getenv("HF_TOKEN")
    use_omnivoice = os.getenv("USE_LAHGTNA_TTS", "false").strip().lower() in {"1", "true", "yes"}

    if not use_omnivoice:
        return False

    try:
        import torch
        import soundfile as sf
        from omnivoice.models.omnivoice import OmniVoice
        from huggingface_hub import hf_hub_download

        REPO = "ehabnegm/lahgtna-omnivoice-egyptian-v3"
        device = "cuda" if torch.cuda.is_available() else "cpu"
        dtype = torch.float16 if device == "cuda" else torch.float32

        if _OMNIVOICE_MODEL_CACHE is None:
            print(f"[VOICE SERVICE] Loading Lahgtna OmniVoice ({REPO}) on {device}...")
            _OMNIVOICE_MODEL_CACHE = OmniVoice.from_pretrained(REPO, device_map=device, dtype=dtype, token=token)

        ref_audio = hf_hub_download(REPO, "reference.wav", token=token)
        ref_text = "كان العمل التطوعي واللي لما تفتح الباب بس ليه الناس"

        num_steps = int(os.getenv("LAHGTNA_NUM_STEPS", "8"))
        audio = _OMNIVOICE_MODEL_CACHE.generate(
            text=text,
            language="arz",
            ref_audio=ref_audio,
            ref_text=ref_text,
            num_step=num_steps
        )[0]

        sf.write(str(output_path_obj), audio, 24000)
        if output_path_obj.exists() and output_path_obj.stat().st_size > 0:
            print(f"[VOICE SERVICE] Synthesized speech using Lahgtna OmniVoice v3 -> {output_path_obj.name}")
            return True
    except Exception as e:
        print(f"[VOICE SERVICE] Lahgtna OmniVoice synthesis failed ({e})")
    return False


# ── TTS Implementation (Lahgtna OmniVoice -> Edge-TTS -> gTTS fallback) ───────
def synthesize(text: str, language: str = "ar", output_path: str = "") -> None:
    """Generate speech audio from text using Lahgtna OmniVoice, Edge-TTS, or gTTS fallback."""
    if not text or not text.strip():
        raise ValueError("Text for synthesis cannot be empty")

    output_path_obj = Path(output_path)
    output_path_obj.parent.mkdir(parents=True, exist_ok=True)

    # 1. Try Lahgtna OmniVoice v3 (if USE_LAHGTNA_TTS=true in .env)
    if _synthesize_lahgtna_omnivoice(text, output_path_obj):
        return

    # 2. Try Edge-TTS for high-quality Egyptian Arabic neural voice (ar-EG-SalmaNeural)
    try:
        import edge_tts
        voice = "ar-EG-SalmaNeural" if language in ["ar", "ar-EG", ""] else "ar-SA-HamedNeural"

        async def _run_edge():
            communicate = edge_tts.Communicate(text, voice)
            await communicate.save(str(output_path_obj))

        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                pool.submit(lambda: asyncio.run(_run_edge())).result()
        else:
            asyncio.run(_run_edge())

        if output_path_obj.exists() and output_path_obj.stat().st_size > 0:
            print(f"[VOICE SERVICE] Synthesized speech using edge-tts ({voice}) -> {output_path_obj.name}")
            return
    except Exception as e:
        print(f"[VOICE SERVICE] edge-tts failed ({e}), falling back to gTTS")

    # 3. Fallback to gTTS
    from gtts import gTTS
    lang = language if language else "ar"
    tts = gTTS(text=text, lang=lang)
    tts.save(str(output_path_obj))



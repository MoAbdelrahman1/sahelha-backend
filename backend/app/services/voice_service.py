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
    "استخراج قسيمة زواج مميكنة، قسيمة طلاق، قيد عائلي، فيش وتشبيه، شهادة ميلاد مميكنة، "
    "شهادة وفاة مميكنة، بطاقة رقم قومي، تجديد رخصة مركبة، رخصة قيادة خاصة، "
    "توكيل رسمي عام، وثيقة زواج، عقد زواج، سجل تجاري، بطاقة ضريبية، بدل فاقد، تصريح عمل، "
    "منصة مصر الرقمية، الأحوال المدنية، المرور، مأمورية الضرائب، الشهر العقاري، اسيمة جواز، اسيمة زواج."
)

FIELD_PROMPTS = {
    "name": (
        "الاسم الرباعي المصري: محمد أحمد محمود علي حسن مصطفى عبد الرحمن إبراهيم "
        "السيد عبد الله علاء حسين عثمان سعيد فوزي إسماعيل الشربيني النجار رضوان غانم زكريا."
    ),
    "national_id": (
        "الرقم القومي المصري 14 رقم: 2 9 8 0 1 5 6 7 8 9 أرقام فقط."
    ),
    "phone": (
        "رقم الموبايل المصري 11 رقم: 010 011 012 015 أرقام هواتف فقط."
    ),
    "confirmation": (
        "نعم، أيوة، تمام، صحيح، مضبوط، نعم للمتابعة، لا، غير صحيح، عدل، لا مش كدة، غلط."
    ),
}

# ── Groq API STT ─────────────────────────────────────────────────────────────
def _transcribe_groq(audio_path: str, prompt: Optional[str] = None) -> Optional[str]:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return None

    try:
        from groq import Groq
        client = Groq(api_key=api_key)
        with open(audio_path, "rb") as file:
            data = file.read()
            upload_name = _detect_audio_filename(audio_path, data)
            active_prompt = prompt or EGYPTIAN_ARABIC_PROMPT
            transcription = client.audio.transcriptions.create(
                file=(upload_name, data),
                model="whisper-large-v3",
                prompt=active_prompt,
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
    "قسيمة زواج",
    "وثيقة زواج",
    "شهادة زواج",
    "قسيمة طلاق",
    "وثيقة طلاق",
    "قيد عائلي",
    "قيد فردي",
    "فيش وتشبيه",
    "شهادة وفاة",
    "شهادة ميلاد",
    "بطاقة رقم قومي",
    "رخصة قيادة",
    "رخصة مركبة",
    "تجديد رخصة مركبة",
    "رخصة تسيير",
    "سجل ضريبي",
    "بطاقة ضريبية",
    "سجل تجاري",
    "توكيل رسمي عام",
    "تصريح عمل",
    "عقد زواج",
]

_COMMON_STT_CORRECTIONS = [
    # Egyptian dialect & phonetic corrections for marriage / divorce certificates
    (r"\b(أ?سيمة|قسيمة|إسيمة|قصيمة|أ?سيمه|قسيمه)\s+(زونك|زنك|جواز|زواج|زوجه|جوازك)\b", "قسيمة زواج"),
    (r"\b(أ?سيمة|قسيمة|إسيمة|قصيمة|أ?سيمه|قسيمه)\s+(طلاق|تطليق|طلاقك)\b", "قسيمة طلاق"),
    (r"\b(أ?سيمة|إسيمة|قصيمة|أ?سيمه)\b", "قسيمة"),
    (r"\b(قبالة|قباله|قوشان)\s+(جواز|زواج)\b", "وثيقة زواج"),
    (r"\b(أ?يد|قيد)\s+(عايلي|عائلي|اسري|أسري)\b", "قيد عائلي"),
    (r"\b(فيش\s+وتشبيه|فيشو\s+تشبيه|فيش\s+تشبيه|صحيفة\s+حالة\s+جنائية)\b", "فيش وتشبيه"),
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

COMMON_EGYPTIAN_NAME_CORRECTIONS = [
    (r"^(اسمي\s+هو|أنا\s+اسمي|اسمي|أنا)\s+", ""),
    (r"\bمحد\b", "محمد"),
    (r"\bعبدا\s*لرحمن\b", "عبد الرحمن"),
    (r"\bعبد\s*الله\b", "عبد الله"),
    (r"\bعبد\s*العزيز\b", "عبد العزيز"),
    (r"\bعبد\s*الفتاح\b", "عبد الفتاح"),
    (r"\bاليسد\b", "السيد"),
    (r"\bابراهيم\b", "إبراهيم"),
    (r"\bاسماعيل\b", "إسماعيل"),
]

def normalize_egyptian_name(text: str) -> str:
    cleaned = text.strip()
    for pattern, rep in COMMON_EGYPTIAN_NAME_CORRECTIONS:
        cleaned = re.sub(pattern, rep, cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"[^\w\s]", "", cleaned).strip()
    return cleaned

def parse_spoken_digits_to_arabic_id(text: str) -> str:
    """Convert spoken Arabic number words or formatted digits to a clean 14-digit National ID string."""
    word_to_digit = {
        "صفر": "0", "واحد": "1", "اثنين": "2", "اتنين": "2", "تنين": "2",
        "ثلاثة": "3", "تلاتة": "3", "تلاته": "3", "أربعة": "4", "اربعة": "4", "اربعه": "4",
        "خمسة": "5", "خمسه": "5", "ستة": "6", "سته": "6", "سبعة": "7", "سبعه": "7",
        "ثمانية": "8", "تمانية": "8", "تمانيه": "8", "تسعة": "9", "تسعه": "9",
    }
    arabic_indic_to_ascii = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
    clean = text.translate(arabic_indic_to_ascii)
    digits = re.findall(r"\d", clean)
    if len(digits) >= 14:
        return "".join(digits[:14])

    tokens = clean.split()
    converted = []
    for token in tokens:
        clean_tok = re.sub(r"[^\w]", "", token)
        if clean_tok.isdigit():
            converted.extend(list(clean_tok))
        elif clean_tok in word_to_digit:
            converted.append(word_to_digit[clean_tok])

    res = "".join(converted)
    return res[:14] if len(res) >= 14 else res

def normalize_egyptian_phone(text: str) -> str:
    """Extract and format an 11-digit Egyptian phone number starting with 01."""
    arabic_indic_to_ascii = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
    text = text.translate(arabic_indic_to_ascii)
    digits = "".join(re.findall(r"\d", text))
    if digits.startswith("201") and len(digits) == 12:
        return "0" + digits[2:]
    if digits.startswith("01") and len(digits) >= 11:
        return digits[:11]
    return digits

def normalize_spoken_confirmation(text: str) -> str:
    """Returns 'نعم' if the spoken utterance signifies agreement, 'لا' otherwise."""
    norm = text.strip()
    negative_terms = ["لا", "عدل", "غلط", "مش صحيح", "غير صحيح", "لا مش كده", "تعديل", "تغيير"]
    for neg in negative_terms:
        if neg in norm:
            return "لا"
    return "نعم"

def correct_egyptian_name_with_llm(raw_name: str) -> str:
    """Use Groq's specialized Arabic LLM (allam-2-7b) to spell-correct Egyptian names to official Civil Registry standards."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key or not raw_name or len(raw_name.strip()) < 3:
        return normalize_egyptian_name(raw_name)

    try:
        from groq import Groq
        client = Groq(api_key=api_key)
        prompt = (
            "أنت خبير تصحيح إملائي للأسماء المصرية الرسمية ببطاقات الرقم القومي بمصلحة الأحوال المدنية.\n"
            "صحح الاسم التالي إلى الهجاء الرسمي المعتمد (مثل: محمد، عبد الرحمن، إبراهيم، علاء، السيد، عثمان، إلخ).\n"
            "ممنوع كتابة أي مقدمات أو شرح؛ اكتب فقط الاسم المصحح نصاً مجرداً."
        )
        res = client.chat.completions.create(
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": raw_name.strip()},
            ],
            model="allam-2-7b",
            temperature=0.0,
            max_tokens=48,
        )
        corrected = res.choices[0].message.content.strip()
        corrected = re.sub(r'["\'\.\،\:]', '', corrected).strip()
        if corrected and len(corrected) >= 3:
            print(f"[VOICE SERVICE] Allam LLM Name Correction: {raw_name!r} -> {corrected!r}")
            return corrected
    except Exception as e:
        print(f"[VOICE SERVICE] LLM name correction fallback ({e})")

    return normalize_egyptian_name(raw_name)

def _apply_field_normalizer(raw_text: str, field_type: Optional[str]) -> str:
    if not field_type:
        return _post_process_arabic_transcript(raw_text)
    if field_type == "name":
        basic_clean = normalize_egyptian_name(raw_text)
        return correct_egyptian_name_with_llm(basic_clean)
    if field_type == "national_id":
        return parse_spoken_digits_to_arabic_id(raw_text)
    if field_type == "phone":
        return normalize_egyptian_phone(raw_text)
    if field_type == "confirmation":
        return normalize_spoken_confirmation(raw_text)
    return _post_process_arabic_transcript(raw_text)

def transcribe(audio_path: str, field_type: Optional[str] = None) -> str:
    """Transcribe an audio file to Arabic text using Groq Whisper or faster-whisper.

    Parameters
    ----------
    audio_path: str
        Path to the audio file on disk.
    field_type: str, optional
        Target form field type ('name', 'national_id', 'phone', 'confirmation')
        to condition Whisper's decoding prompt and apply slot-specific normalization.

    Returns
    -------
    str
        The Arabic transcript.
    """
    if not os.path.isfile(audio_path):
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    active_prompt = FIELD_PROMPTS.get(field_type, EGYPTIAN_ARABIC_PROMPT) if field_type else EGYPTIAN_ARABIC_PROMPT

    # 1. High-Speed Path: Send original audio directly to Groq Whisper (bypasses ffmpeg disk subprocess lag)
    groq_result = _transcribe_groq(audio_path, prompt=active_prompt)
    if groq_result is not None:
        return _apply_field_normalizer(groq_result, field_type)

    # 2. Fallback Path: Preprocess with ffmpeg only if Groq is unavailable
    target_audio = _preprocess_audio_with_ffmpeg(audio_path)

    # Fallback: faster-whisper with greedy decoding beam_size=1 (4x faster than beam_size=5)
    model = _get_model()
    if model is not None:
        try:
            segments, _ = model.transcribe(
                target_audio,
                language="ar",
                initial_prompt=active_prompt,
                beam_size=1,
                vad_filter=True
            )
            raw_text = " ".join(segment.text for segment in segments).strip()
            return _apply_field_normalizer(raw_text, field_type)
        except Exception as e:
            print(f"[VOICE SERVICE] CUDA execution failed ({e}). Falling back to CPU transcription...")

    # CPU Fallback with beam_size=1
    try:
        cpu_model = _get_cpu_model()
        segments, _ = cpu_model.transcribe(
            target_audio,
            language="ar",
            initial_prompt=active_prompt,
            beam_size=1,
            vad_filter=True
        )
        raw_text = " ".join(segment.text for segment in segments).strip()
        return _apply_field_normalizer(raw_text, field_type)
    except Exception as e:
        print(f"[VOICE SERVICE] CPU Transcription error: {e}")

    return ""


# ── Lahgtna OmniVoice Helper (ehabnegm/lahgtna-omnivoice-egyptian-v3) ─────────
_OMNIVOICE_MODEL_CACHE = None

def _synthesize_lahgtna_omnivoice(text: str, output_path_obj: Path) -> bool:
    """Generate Egyptian Arabic speech using ehabnegm/lahgtna-omnivoice-egyptian-v3 on GPU."""
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
            print(f"[VOICE SERVICE] Loading Lahgtna OmniVoice ({REPO}) on {device} ({dtype})...")
            _OMNIVOICE_MODEL_CACHE = OmniVoice.from_pretrained(
                REPO,
                device_map=device,
                dtype=dtype,
                token=token
            )
            print(f"[VOICE SERVICE] Lahgtna OmniVoice loaded successfully.")

        ref_audio = hf_hub_download(REPO, "reference.wav", token=token, local_files_only=True)
        ref_text = "كان العمل التطوعي واللي لما تفتح الباب بس ليه الناس"

        # Clean text for Lahgtna v3 (raw Egyptian, strip markdown and verbalize MSA to Egyptian slang)
        clean_text = re.sub(r"[\*\_#`~\[\]\(\)\{\}]", " ", text)
        clean_text = re.sub(r"\bقل\b", "قول", clean_text)
        clean_text = re.sub(r"\bأملِ\b", "قول", clean_text)
        clean_text = re.sub(r"\bاملِ\b", "قول", clean_text)
        clean_text = re.sub(r"\bالمركبة\b", "العربية", clean_text)
        clean_text = re.sub(r"\bمركبة\b", "عربية", clean_text)
        clean_text = re.sub(r"\bمركبتك\b", "عربيتك", clean_text)
        clean_text = re.sub(r"\bالمركبات\b", "العربيات", clean_text)
        clean_text = re.sub(r"\bسيارة\b", "عربية", clean_text)
        clean_text = re.sub(r"\bالسيارة\b", "العربية", clean_text)
        clean_text = re.sub(r"\s+", " ", clean_text).strip()
        if not clean_text:
            return False

        num_steps = int(os.getenv("LAHGTNA_NUM_STEPS", "8"))
        audio = _OMNIVOICE_MODEL_CACHE.generate(
            text=clean_text,
            language="arz",
            ref_audio=ref_audio,
            ref_text=ref_text,
            num_step=num_steps
        )[0]

        sf.write(str(output_path_obj), audio, 24000)
        if output_path_obj.exists() and output_path_obj.stat().st_size > 0:
            print(f"[VOICE SERVICE] Synthesized speech using Lahgtna OmniVoice v3 ({device}, {num_steps} steps) -> {output_path_obj.name}")
            return True
    except Exception as e:
        print(f"[VOICE SERVICE] Lahgtna OmniVoice synthesis failed ({e}). Falling back to Edge-TTS...")
        try:
            import torch
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except Exception:
            pass
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



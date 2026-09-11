import sys
import os
import time
from pathlib import Path

# Fix Windows stdout encoding for Arabic
sys.stdout.reconfigure(encoding="utf-8")

def benchmark_faster_whisper(audio_path: str, model_size: str = "large-v3-turbo"):
    from faster_whisper import WhisperModel
    print(f"\n--- Testing faster-whisper [{model_size}] ---")
    t0 = time.time()
    try:
        model = WhisperModel(model_size, device="cuda", compute_type="float16")
        segments, info = model.transcribe(
            audio_path,
            language="ar",
            initial_prompt="سجل ضريبي، بطاقة ضريبية، سجل تجاري، رخصة مرور، رخصة قيادة، بطاقة رقم قومي، شهادة وفاة، شهادة ميلاد، شهادة زواج",
            beam_size=5,
            vad_filter=True
        )
        text = " ".join(s.text for s in segments).strip()
        dt = time.time() - t0
        print(f"Speed: {dt:.2f}s | Language Probability: {info.language_probability:.2f}")
        print(f"Transcript: {text}")
        return text
    except Exception as e:
        print(f"Error testing {model_size}: {e}")
        return None

def benchmark_hf_pipeline(audio_path: str, model_id: str):
    print(f"\n--- Testing HuggingFace pipeline [{model_id}] ---")
    t0 = time.time()
    try:
        import torch
        from transformers import pipeline
        
        device = "cuda:0" if torch.cuda.is_available() else "cpu"
        pipe = pipeline("automatic-speech-recognition", model=model_id, device=device)
        result = pipe(audio_path)
        dt = time.time() - t0
        text = result.get("text", "").strip() if isinstance(result, dict) else str(result)
        print(f"Speed: {dt:.2f}s")
        print(f"Transcript: {text}")
        return text
    except Exception as e:
        print(f"Error testing HF model {model_id}: {e}")
        return None

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/test_stt_models.py <path_to_audio_file.wav>")
        sys.exit(1)

    audio_file = sys.argv[1]
    if not os.path.exists(audio_file):
        print(f"File not found: {audio_file}")
        sys.exit(1)

    print(f"Benchmarking STT models on: {audio_file}")
    
    # 1. Active Backend Model (Whisper Large V3 Turbo)
    benchmark_faster_whisper(audio_file, "large-v3-turbo")
    
    # 2. Whisper Small
    benchmark_faster_whisper(audio_file, "small")
    
    # 3. HuggingFace models
    # benchmark_hf_pipeline(audio_file, "ibm-granite/granite-speech-5.0-470m-turboctc")
    # benchmark_hf_pipeline(audio_file, "Qwen/Qwen2-Audio-7B-Instruct")

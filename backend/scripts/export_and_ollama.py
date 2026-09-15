"""
scripts/export_and_ollama.py
~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Merges the trained LoRA adapter weights with the base Qwen2.5-3B model,
generates the official Ollama Modelfile, and provides commands to quantize
to GGUF and serve via local Ollama.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path


MODELFILE_TEMPLATE = """# Ollama Modelfile for Qwen2.5-3B Egyptian Document OCR Extractor
FROM {model_source}

TEMPLATE \"\"\"{{{{ if .System }}}}<|im_start|>system
{{{{ .System }}}}<|im_end|>
{{{{ end }}}}{{{{ if .Prompt }}}}<|im_start|>user
{{{{ .Prompt }}}}<|im_end|>
{{{{ end }}}}<|im_start|>assistant
{{{{ .Response }}}}<|im_end|>
\"\"\"

PARAMETER temperature 0.1
PARAMETER top_p 0.85
PARAMETER repeat_penalty 1.15
PARAMETER stop "<|im_start|>"
PARAMETER stop "<|im_end|>"
"""


def merge_lora_and_export(base_model_id: str, adapter_dir: str, output_dir: str):
    print("=" * 65)
    print("    Merging LoRA Adapter into Base Model for Ollama Export     ")
    print("=" * 65)

    try:
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer
        from peft import PeftModel
    except ImportError as e:
        print(f"[ERROR] Missing required packages: {e}")
        print("Install: pip install transformers peft torch")
        sys.exit(1)

    print(f"\n[1/3] Loading Tokenizer from {adapter_dir} (or {base_model_id})...")
    try:
        tokenizer = AutoTokenizer.from_pretrained(adapter_dir, trust_remote_code=True)
    except Exception:
        tokenizer = AutoTokenizer.from_pretrained(base_model_id, trust_remote_code=True)

    print(f"\n[2/3] Loading Base Model ({base_model_id}) in FP16 on CPU RAM...")
    print("  (Using CPU memory to avoid VRAM exhaustion during merge)")
    base_model = AutoModelForCausalLM.from_pretrained(
        base_model_id,
        torch_dtype=torch.float16,
        device_map="cpu",
        low_cpu_mem_usage=True,
        trust_remote_code=True,
    )

    print(f"\n[3/3] Merging LoRA weights from {adapter_dir}...")
    peft_model = PeftModel.from_pretrained(base_model, adapter_dir)
    merged_model = peft_model.merge_and_unload()

    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    print(f"\nSaving merged model to: {out_path.resolve()}...")
    merged_model.save_pretrained(str(out_path), safe_serialization=True)
    tokenizer.save_pretrained(str(out_path))

    # Write Modelfile pointing directly to directory (supported in newer Ollama)
    modelfile_path = out_path / "Modelfile"
    with open(modelfile_path, "w", encoding="utf-8") as f:
        f.write(MODELFILE_TEMPLATE.format(model_source=str(out_path.resolve()).replace("\\", "/")))

    print("\n" + "=" * 65)
    print("                 MERGE & EXPORT COMPLETE!                     ")
    print("=" * 65)
    print(f"\nMerged Model Directory: {out_path.resolve()}")
    print(f"Ollama Modelfile:       {modelfile_path.resolve()}")
    print("\nTo deploy this model into your local Ollama instance:")
    print("-" * 65)
    print(f"1. Register model in Ollama:")
    print(f"   ollama create qwen2.5:3b-egypt-ocr -f \"{modelfile_path.resolve()}\"")
    print("\n2. Test the model:")
    print("   ollama run qwen2.5:3b-egypt-ocr \"بطاقة تحقيق الشخصية احمد خالد قنا\"")
    print("\n3. Update backend/.env to use your newly trained model:")
    print("   OLLAMA_MODEL=qwen2.5:3b-egypt-ocr")
    print("-" * 65)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Merge LoRA and export for Ollama")
    parser.add_argument("--base_model", type=str, default="Qwen/Qwen2.5-3B-Instruct", help="Base HF model ID")
    parser.add_argument("--adapter_dir", type=str, default="./qwen2.5-3b-egypt-adapter", help="Directory with LoRA adapter")
    parser.add_argument("--output_dir", type=str, default="./qwen2.5-3b-egypt-merged", help="Output directory for merged model")
    args = parser.parse_args()

    merge_lora_and_export(args.base_model, args.adapter_dir, args.output_dir)

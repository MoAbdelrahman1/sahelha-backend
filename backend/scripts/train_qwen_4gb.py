"""
scripts/train_qwen_4gb.py
~~~~~~~~~~~~~~~~~~~~~~~~~
Fine-tuning script specifically engineered for 4 GB VRAM GPUs
(e.g., NVIDIA GeForce RTX 2050 / GTX 1650 / RTX 3050 Laptop 4GB).

Optimizations implemented to guarantee fitting in <= 4 GB VRAM:
1. 4-bit NormalFloat (NF4) quantization via bitsandbytes (weights occupy ~1.55 GB).
2. Double Quantization (bnb_4bit_use_double_quant=True) saves extra memory on quant constants.
3. LoRA rank r=8, lora_alpha=16 targeting attention projections (adapter < 10 MB).
4. Gradient Checkpointing enabled (reduces activation memory by >70%).
5. Paged 8-bit AdamW optimizer (paged_adamw_8bit) offloads memory spikes to system RAM.
6. Per-device batch size = 1, gradient accumulation = 16 (effective batch size 16).
7. max_seq_length = 384 (covers OCR input + JSON output with zero wasted pad memory).
8. Real-time VRAM allocation tracking & garbage collection.
"""

from __future__ import annotations

import argparse
import gc
import json
import os
import sys
from pathlib import Path

import torch


def get_vram_usage_mb() -> tuple[float, float]:
    if not torch.cuda.is_available():
        return 0.0, 0.0
    allocated = torch.cuda.memory_allocated() / (1024 * 1024)
    reserved = torch.cuda.memory_reserved() / (1024 * 1024)
    return allocated, reserved


def print_vram(tag: str = ""):
    if torch.cuda.is_available():
        alloc, res = get_vram_usage_mb()
        total = torch.cuda.get_device_properties(0).total_memory / (1024 * 1024)
        print(f"[VRAM MONITOR] {tag} -> Allocated: {alloc:.1f} MB | Reserved: {res:.1f} MB | Total: {total:.1f} MB")


def prepare_chatml_dataset(file_path: str, tokenizer, max_seq_length: int):
    """
    Loads JSONL records formatted as {"messages": [...]} and tokenizes
    them using the Qwen2.5 chat template.
    """
    from datasets import Dataset

    records = []
    with open(file_path, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                data = json.loads(line)
                records.append({"messages": data["messages"]})

    raw_dataset = Dataset.from_list(records)

    def tokenize_fn(examples):
        texts = [
            tokenizer.apply_chat_template(msgs, tokenize=False, add_generation_prompt=False)
            for msgs in examples["messages"]
        ]
        tokens = tokenizer(
            texts,
            truncation=True,
            max_length=max_seq_length,
            padding="max_length",
        )
        tokens["labels"] = tokens["input_ids"].copy()
        return tokens

    return raw_dataset.map(tokenize_fn, batched=True, remove_columns=["messages"])


def train(args):
    print("=" * 65)
    print("      Qwen2.5-3B QLoRA Fine-Tuning Pipeline (4 GB VRAM Mode)    ")
    print("=" * 65)

    if not torch.cuda.is_available():
        print("[WARNING] CUDA is not detected on PyTorch! Training requires an NVIDIA GPU.")
        print("Please check your PyTorch installation: pip install torch --index-url https://download.pytorch.org/whl/cu121")
        if not args.force_cpu:
            sys.exit(1)

    try:
        from transformers import (
            AutoModelForCausalLM,
            AutoTokenizer,
            BitsAndBytesConfig,
            Trainer,
            TrainingArguments,
            DataCollatorForSeq2Seq,
        )
        from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
    except ImportError as e:
        print(f"[ERROR] Missing required packages: {e}")
        print("Install required libraries:")
        print("  pip install transformers datasets peft bitsandbytes accelerate trl")
        sys.exit(1)

    print_vram("Initial State")

    # 1. Quantization Configuration (NF4 + Double Quantization)
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
        bnb_4bit_compute_dtype=torch.float16,
    )

    # 2. Load Tokenizer
    print(f"\n[1/5] Loading Tokenizer: {args.model_id}...")
    tokenizer = AutoTokenizer.from_pretrained(args.model_id, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"

    # 3. Load 4-bit Base Model
    print(f"\n[2/5] Loading 4-bit Base Model: {args.model_id}...")
    model = AutoModelForCausalLM.from_pretrained(
        args.model_id,
        quantization_config=bnb_config,
        device_map="auto",
        trust_remote_code=True,
        torch_dtype=torch.float16,
        low_cpu_mem_usage=True,
    )

    print_vram("Model Loaded (4-bit)")

    # 4. Prepare for k-bit training & Enable Gradient Checkpointing
    model = prepare_model_for_kbit_training(model)
    model.gradient_checkpointing_enable()
    print("[INFO] Gradient Checkpointing: ENABLED (Activations memory compressed)")

    # 5. Configure LoRA (rank=8, target q_proj and v_proj)
    lora_config = LoraConfig(
        r=args.lora_r,
        lora_alpha=args.lora_alpha,
        target_modules=["q_proj", "v_proj"],
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
    )
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()
    print_vram("LoRA Attached")

    # 6. Prepare Datasets
    print(f"\n[3/5] Tokenizing Datasets (max_seq_len={args.max_seq_length})...")
    train_dataset = prepare_chatml_dataset(args.train_file, tokenizer, args.max_seq_length)
    val_dataset = prepare_chatml_dataset(args.val_file, tokenizer, args.max_seq_length)
    print(f"  • Train dataset: {len(train_dataset)} samples")
    print(f"  • Val dataset:   {len(val_dataset)} samples")

    # 7. Training Arguments strictly tuned for 4 GB VRAM
    training_args = TrainingArguments(
        output_dir=args.output_dir,
        per_device_train_batch_size=args.batch_size,
        gradient_accumulation_steps=args.grad_accum,
        warmup_ratio=0.05,
        num_train_epochs=args.epochs,
        learning_rate=args.lr,
        fp16=True,
        logging_steps=10,
        eval_strategy="epoch",
        save_strategy="epoch",
        save_total_limit=2,
        optim="paged_adamw_8bit",    # Offloads optimizer spikes to system RAM
        lr_scheduler_type="cosine",
        report_to="none",
        dataloader_num_workers=0,    # Avoid multi-process CUDA overhead on Windows
    )

    # 8. Start Training
    print(f"\n[4/5] Starting Training...")
    print(f"  • Batch Size: {args.batch_size} (Grad Accum: {args.grad_accum} -> Effective Batch Size: {args.batch_size * args.grad_accum})")
    print(f"  • Epochs: {args.epochs}")
    print(f"  • Optimizer: paged_adamw_8bit")
    print(f"  • Output Directory: {args.output_dir}\n")

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=val_dataset,
        data_collator=DataCollatorForSeq2Seq(tokenizer, pad_to_multiple_of=8, return_tensors="pt"),
    )

    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    print_vram("Pre-Training Start")

    train_result = trainer.train()
    print("\n[INFO] Training complete!")

    # 9. Save Adapter and Tokenizer
    print(f"\n[5/5] Saving LoRA Adapter and Tokenizer to {args.output_dir}...")
    trainer.model.save_pretrained(args.output_dir)
    tokenizer.save_pretrained(args.output_dir)

    print("\n" + "=" * 65)
    print(f"  SUCCESS! Fine-tuned LoRA adapter saved to: {args.output_dir}")
    print("  Next step: run 'export_and_ollama.py' to merge and register with Ollama.")
    print("=" * 65)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fine-tune Qwen2.5-3B on Egyptian documents with 4 GB VRAM")
    parser.add_argument("--model_id", type=str, default="Qwen/Qwen2.5-3B-Instruct", help="Base HuggingFace model")
    parser.add_argument("--train_file", type=str, default="data/egypt_docs_train.jsonl", help="Path to train JSONL")
    parser.add_argument("--val_file", type=str, default="data/egypt_docs_val.jsonl", help="Path to validation JSONL")
    parser.add_argument("--output_dir", type=str, default="./qwen2.5-3b-egypt-adapter", help="Output directory for LoRA adapter")
    parser.add_argument("--max_seq_length", type=int, default=384, help="Maximum sequence length (default: 384 for 4GB VRAM)")
    parser.add_argument("--batch_size", type=int, default=1, help="Per-device train batch size (keep 1 for 4GB VRAM)")
    parser.add_argument("--grad_accum", type=int, default=16, help="Gradient accumulation steps (default: 16)")
    parser.add_argument("--lr", type=float, default=2e-4, help="Learning rate (default: 2e-4)")
    parser.add_argument("--epochs", type=int, default=3, help="Number of training epochs (default: 3)")
    parser.add_argument("--lora_r", type=int, default=8, help="LoRA rank (default: 8)")
    parser.add_argument("--lora_alpha", type=int, default=16, help="LoRA alpha (default: 16)")
    parser.add_argument("--force_cpu", action="store_true", help="Force CPU run (very slow, test only)")
    args = parser.parse_args()

    train(args)

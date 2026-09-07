"""One-time local setup: creates .env from .env.example with a random
SECRET_KEY already filled in, so you don't have to generate or paste one
by hand. Run once: `python setup_env.py`.

GROQ_API_KEY can't be filled in automatically — it has to come from your
own account at https://console.groq.com (API Keys) — this script leaves
that line blank for you to fill in.
"""
from __future__ import annotations

import secrets
from pathlib import Path

ENV_PATH = Path(__file__).parent / ".env"
EXAMPLE_PATH = Path(__file__).parent / ".env.example"


def main() -> None:
    if ENV_PATH.exists():
        print(".env already exists — leaving it alone. Delete it first if you want to regenerate.")
        return

    text = EXAMPLE_PATH.read_text(encoding="utf-8")
    text = text.replace(
        "SECRET_KEY=sahelha-dev-secret-change-in-production",
        f"SECRET_KEY={secrets.token_hex(32)}",
    )
    ENV_PATH.write_text(text, encoding="utf-8")

    print("Created .env with a random SECRET_KEY.")
    print("Next: open .env and paste your GROQ_API_KEY (get one free at https://console.groq.com -> API Keys).")


if __name__ == "__main__":
    main()

import os
from dotenv import load_dotenv
from groq import Groq

load_dotenv()  # Load variables from .env

api_key = os.getenv("GROQ_API_KEY")
model = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")

print(f"Loaded API Key: {api_key[:10] if api_key else 'None'}...")
print(f"Loaded Model: {model}")

if not api_key:
    print("❌ Error: GROQ_API_KEY is completely missing from your environment variables!")
else:
    try:
        client = Groq(api_key=api_key)
        chat_completion = client.chat.completions.create(
            messages=[{"role": "user", "content": "Say hello in Egyptian Arabic"}],
            model=model,
        )
        print("\n✅ Groq Connected Successfully!")
        print(f"Response: {chat_completion.choices[0].message.content}")
    except Exception as e:
        print(f"\n❌ Groq Connection Failed: {e}")
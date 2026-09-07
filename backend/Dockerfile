FROM python:3.11-slim

WORKDIR /app

# libgl1/libglib2.0-0: required by opencv-python-headless/easyocr at import time.
# libsndfile1: required by faster-whisper's audio decoding path.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p uploads

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

FROM python:3.11-slim-bookworm
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends espeak-ng ffmpeg libsndfile1 && rm -rf /var/lib/apt/lists/*
COPY voice-service/requirements.txt .
RUN pip install --no-cache-dir torch==2.6.0 --index-url https://download.pytorch.org/whl/cpu && pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl
COPY voice-service/ .
ENV VOICE_MODEL_DIR=/models HF_HUB_DISABLE_TELEMETRY=1
RUN python download_models.py
RUN useradd --uid 10001 --create-home voice && chown -R voice:voice /app /models
USER voice
ENV HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1
CMD ["sh","-c","uvicorn app:app --host 0.0.0.0 --port ${PORT:-8080} --workers 1 --no-access-log"]

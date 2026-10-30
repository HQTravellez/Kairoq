# SPDX-License-Identifier: GPL-3.0-or-later
"""Independent Kairoq voice API. No VoiceStudio code or model assets."""
import asyncio
import hmac
import io
import os
import subprocess
import shutil
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field

VOICES = {"af_heart": "a", "bf_emma": "b", "ef_dora": "e", "ff_siwis": "f", "hf_alpha": "h", "if_sara": "i", "pf_dora": "p"}
MAX_UPLOAD = 10 * 1024 * 1024
engine = None
busy = asyncio.Lock()

class Speech(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    text: str = Field(min_length=1, max_length=2000)
    voice: str = "af_heart"
    speed: float = Field(default=1.0, ge=0.5, le=2.0)

class Engine:
    def __init__(self):
        import torch
        import whisper
        import espeakng_loader
        from kokoro import KModel, KPipeline
        from phonemizer.backend.espeak.wrapper import EspeakWrapper
        data_path = espeakng_loader.get_data_path()
        # eSpeak has a fixed-size path buffer; deep local checkouts exceed it.
        self.espeak_temp = None
        if len(data_path.encode()) > 120:
            self.espeak_temp = tempfile.TemporaryDirectory(prefix="kq-espeak-", dir="/tmp")
            data_path = str(Path(self.espeak_temp.name) / "espeak-ng-data")
            shutil.copytree(espeakng_loader.get_data_path(), data_path)
        EspeakWrapper.set_data_path(data_path)
        torch.set_num_threads(2)
        root = Path(os.environ.get("VOICE_MODEL_DIR", "/models"))
        self.torch = torch
        model = KModel(config=str(root / "kokoro/config.json"), model=str(root / "kokoro/kokoro-v1_0.pth")).eval()
        self.pipelines = {lang: KPipeline(lang_code=lang, model=model) for lang in set(VOICES.values())}
        self.voices = {v: torch.load(root / f"kokoro/voices/{v}.pt", weights_only=True) for v in VOICES}
        self.whisper = whisper.load_model(str(root / "whisper/tiny.pt"), device="cpu")
        # Readiness means both models loaded and speech inference succeeded.
        self.speech(Speech(text="Ready."))

    def speech(self, body):
        import numpy as np
        import soundfile as sf
        with self.torch.inference_mode():
            chunks = [r.audio.numpy() for r in self.pipelines[VOICES[body.voice]](body.text, voice=self.voices[body.voice], speed=body.speed)]
        if not chunks:
            raise ValueError("No speech generated")
        result = io.BytesIO()
        sf.write(result, np.concatenate(chunks), 24000, format="WAV", subtype="PCM_16")
        return result.getvalue()

    def transcribe(self, audio):
        import numpy as np
        with tempfile.TemporaryDirectory(prefix="kairoq-voice-") as folder:
            source = Path(folder) / "input"
            target = Path(folder) / "decoded.pcm"
            source.write_bytes(audio)
            # Disable network protocols and decode at most 61 seconds to bound decompression.
            subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-protocol_whitelist", "file,pipe", "-i", str(source), "-t", "61", "-ac", "1", "-ar", "16000", "-f", "f32le", str(target)], check=True, timeout=20, capture_output=True)
            samples = np.fromfile(target, dtype=np.float32)
            if len(samples) == 0 or len(samples) > 60 * 16000:
                raise ValueError("Audio must be between 0 and 60 seconds")
            result = self.whisper.transcribe(samples, fp16=False, temperature=0, condition_on_previous_text=False)
            return {"text": result["text"].strip(), "language": result["language"], "model": "whisper-tiny"}

@asynccontextmanager
async def lifespan(app):
    global engine
    if len(os.environ.get("VOICE_SERVICE_KEY", "")) < 32:
        raise RuntimeError("VOICE_SERVICE_KEY must contain at least 32 characters")
    engine = await asyncio.to_thread(Engine)
    yield
    engine = None

app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)

@app.middleware("http")
async def gate(request: Request, call_next):
    if request.url.path != "/health":
        key = os.environ.get("VOICE_SERVICE_KEY", "")
        if len(key) < 32 or not hmac.compare_digest(request.headers.get("authorization", ""), "Bearer " + key):
            return Response(status_code=401)
        try:
            limit = MAX_UPLOAD if request.url.path == "/v1/transcriptions" else 16384
            received = 0
            chunks = []
            async for chunk in request.stream():
                received += len(chunk)
                if received > limit:
                    return Response(status_code=413)
                chunks.append(chunk)
            request._body = b"".join(chunks)
        except Exception:
            return Response(status_code=400)
    result = await call_next(request)
    result.headers["Cache-Control"] = "no-store"
    result.headers["X-Content-Type-Options"] = "nosniff"
    return result

@app.get("/health")
async def health():
    return Response(content='{"ready":true}' if engine else '{"ready":false}', status_code=200 if engine else 503, media_type="application/json")

@app.get("/v1/voices")
async def voices():
    return {"voices": [{"id": v, "language": lang} for v, lang in VOICES.items()], "tts": "Kokoro-82M", "stt": "Whisper tiny"}

async def infer(fn, *args):
    if engine is None:
        raise HTTPException(503, "Models are not ready")
    if busy.locked():
        raise HTTPException(429, "Voice service is busy; retry shortly")
    async with busy:
        # Hold the slot until CPU work ends even if the HTTP client disconnects.
        work = asyncio.create_task(asyncio.to_thread(fn, *args))
        try:
            return await asyncio.shield(work)
        except asyncio.CancelledError:
            await work
            raise
        except (ValueError, subprocess.SubprocessError):
            raise HTTPException(422, "Unable to process this audio or text")
        except Exception:
            raise HTTPException(503, "Voice processing failed")

@app.post("/v1/speech")
async def speech(body: Speech):
    if body.voice not in VOICES or not body.text.strip():
        raise HTTPException(422, "Select a supported voice and nonempty text")
    data = await infer(lambda: engine.speech(body))
    return Response(data, media_type="audio/wav", headers={"Content-Disposition": 'attachment; filename="narration.wav"'})

@app.post("/v1/transcriptions")
async def transcribe(request: Request):
    audio = await request.body()
    if not audio:
        raise HTTPException(422, "Audio is required")
    return await infer(lambda: engine.transcribe(audio))

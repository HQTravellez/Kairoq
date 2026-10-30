# Kairoq self-hosted voice service

Independent Kokoro-82M speech generation and Whisper tiny transcription; CPU only.
Seven speech locales: US/UK English, Spanish, French, Hindi, Italian, Brazilian Portuguese.
Whisper tiny supports multilingual transcription but accuracy varies; review its output.
No VoiceStudio or OmniVoice installation. No cloning, streaming conversation, or 3D heart
interaction is implemented by this change; narration assets can be used in a later heart app.

## Run

Build with `docker build -t kairoq-voice voice-service`.
Run with a random `VOICE_SERVICE_KEY` of at least 32 characters and port 8080.
The build downloads pinned models. Startup loads them and warms Kokoro before `/health`
becomes ready. Allow 2 CPU cores and at least 4 GB RAM initially; measure before scaling.
One worker and one inference job at a time; concurrent requests receive 429.

For Railway set root directory `/voice-service`, Dockerfile path `Dockerfile`,
start command `uvicorn app:app --host 0.0.0.0 --port 8080 --workers 1 --no-access-log`,
and healthcheck `/health` (300 seconds) in service settings. Use an isolated staging
project and set `VOICE_SERVICE_KEY` securely. Legacy railway.json files are retained
as configuration references; the connected Railway API rejects setting a config-file path.
On Kairoq set `KAIROQ_VOICE_URL` and the matching `KAIROQ_VOICE_KEY` server-side.
Use a private Railway URL when both services share an environment; otherwise HTTPS.
Never put the key in frontend code or generated apps.

## API

`GET /health` is public and only returns readiness. All `/v1/*` routes require
`Authorization: Bearer <VOICE_SERVICE_KEY>`.

- `GET /v1/voices`: allowlisted voice IDs and language codes.
- `POST /v1/speech`: JSON `{ "text": "Hello", "voice": "af_heart", "speed": 1.0 }`;
  returns PCM16 WAV at 24 kHz. Text 1–2000 characters; speed 0.5–2.0.
- `POST /v1/transcriptions`: raw audio bytes, at most 10 MB and 60 seconds;
  returns `{ "text": "...", "language": "en", "model": "whisper-tiny" }`.

Kairoq exposes authenticated owner routes at `/api/voice/voices`, `/api/voice/speech`
and `/api/voice/transcriptions`, plus `/voice.html` linked from the builder.
The builder's `kairoq_narrate` tool saves real WAV assets and copies them into built apps
at `./narration/`. Public generated apps do not receive the service key or an unrestricted
speech proxy. Interactive speech for their end users requires a future per-app quota/auth design.

Input recordings live only in a temporary directory during processing and are deleted
on success or failure. Text/audio content is not logged. Owner-requested narration assets
persist in the Kairoq project. Server metrics may retain request metadata.

## Verification

`node --test test/voice.test.js test/voice-assets.test.js`

`python -m pytest voice-service/test_app.py` (install pytest/httpx separately).

Real test: generate the sentence “Welcome to Kairoq. Your heart pumps blood around your body.”,
verify WAV duration and nonzero signal, then submit that WAV to Whisper and inspect its text.
Repeat through the deployed URL; a green `/health` alone is not audio verification.

See NOTICE.md for license distinctions and exact model provenance. Hosting is not free
merely because the software and weights are free.

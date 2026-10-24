# Ollama inference for Kairoq

Kairoq already supports an OpenAI-compatible local inference endpoint through `LOCAL_LLM_BASE_URL`, and discovers model names from `GET /models`. This branch also exposes discovered Ollama models directly in the primary chat model selector.

## Option A: local Ollama on a Mac

1. Install Ollama from https://ollama.com/download.
2. In Terminal: `ollama pull qwen3:4b` and `ollama run qwen3:4b`.
3. Confirm the API is available locally at `http://127.0.0.1:11434/v1/models`.
4. The Railway service **cannot** reach your Mac's localhost. Use a secure authenticated private gateway or a model server reachable from Railway. Do not publicly expose an unauthenticated Ollama API.
5. Set Railway environment variables: `ZERO_COST_MODE=true`, `LOCAL_LLM_BASE_URL=https://<approved-secure-endpoint>/v1`, `LOCAL_LLM_MODEL=qwen3:4b`; add `LOCAL_LLM_API_KEY` when your gateway requires a bearer token.

## Option B: separately hosted Ollama

Deploy Ollama on a suitable compute host (ideally GPU-backed for larger models), restrict network access, and set the same Railway variables. Infrastructure costs remain even though the Ollama model itself has no per-request API fee.

## Verification

- Test the gateway `/v1/models` and `/v1/chat/completions` endpoints with authorized access.
- Check `/api/models` from an authenticated Kairoq session: it should list `local/qwen3:4b` and `local/auto`.
- Choose that explicit model from the selector and send a simple chat message. Verify the chat response indicates provider `local`.
- Repeat a website lookup to confirm browser fetching and model summarization are separate.
- Do not mark ready without real model request and browser test evidence.

No Ollama server, tunnel, credential or Railway variable is automatically provisioned by this PR.

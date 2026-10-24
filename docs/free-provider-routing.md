# Kairoq independent free-tier inference

The backend routes free inference in order: existing local Ollama/OpenAI-compatible local endpoint, opted-in Google Gemini, Groq, NVIDIA NIM, Hugging Face adapters, optional entitlement-gated OpenCode Zen, and finally OpenRouter's account-limited free route.

Each cloud provider requires an authorized key and `KAIROQ_<PROVIDER>_FREE_ENABLED=true`. API keys are kept exclusively in Railway environment variables. These integrations are never guaranteed unlimited or without charges; configure only an account/model combination verified eligible for your free-tier allocation.

| Provider | Credential | Enable | Optional model |
| --- | --- | --- | --- |
| Gemini | GEMINI_API_KEY | KAIROQ_GEMINI_FREE_ENABLED=true | KAIROQ_GEMINI_FREE_MODEL (default gemini-2.5-flash-lite) |
| Groq | GROQ_API_KEY | KAIROQ_GROQ_FREE_ENABLED=true | KAIROQ_GROQ_FREE_MODEL (default llama-3.1-8b-instant) |
| NVIDIA | NVIDIA_API_KEY | KAIROQ_NVIDIA_FREE_ENABLED=true | KAIROQ_NVIDIA_FREE_MODEL (required) |
| Hugging Face | HF_TOKEN | KAIROQ_HUGGINGFACE_FREE_ENABLED=true | KAIROQ_HF_FREE_MODEL (required) |

Use `ZERO_COST_MODE=true` to route eligible Kairoq chat tasks through the zero-cost flow. Ollama requires `LOCAL_LLM_BASE_URL` and a reachable model instance. OpenCode's CLI/agent integration is separate from inference billing; keyless free-tier OpenCode access is not assumed available to Kairoq. OpenRouter remains account-limited.

**Not production-ready:** adapters have mocked unit tests only. Verify live credentials, endpoint formats, pricing, scopes, rate limits, streaming shape, and model eligibility with each provider; run browser and end-to-end tests before deployment. This branch does not add provider model IDs to the manual selection UI and does not guarantee selected-model fidelity across fallback paths.

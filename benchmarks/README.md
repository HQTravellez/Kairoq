# Kairoq model latency and correctness benchmark

This is a read-only **20-question** chat benchmark. It never builds, changes, or deploys an app, and never changes the selected model. Each case sends exactly one request per configured model; failures remain failures. Results include time-to-first-content-token (TTFT), elapsed response time, answer text, optional token usage, and provider errors. Do not commit results: prompts and answers may contain user information.

## Usage
Requires Node 20+. Configure each provider's own OpenAI-compatible endpoint and model identifier per current provider documentation. Do not assume Solar, Claude, Gemini or any free-tier model is available from a particular endpoint. Use **environment variables** for secrets, not inline configuration. Example:

```bash
export CLAUDE_KEY=...
export SOLAR_KEY=...
export KAIROQ_BENCH_MODELS='[
  {"label":"Claude","model":"YOUR_CLAUDE_MODEL_ID","baseUrl":"https://YOUR_CLAUDE_OPENAI_COMPATIBLE_ENDPOINT/v1","keyEnv":"CLAUDE_KEY"},
  {"label":"Solar","model":"YOUR_SOLAR_MODEL_ID","baseUrl":"https://YOUR_SOLAR_OPENAI_COMPATIBLE_ENDPOINT/v1","keyEnv":"SOLAR_KEY"}
]'
node benchmarks/model-speed.js
```

The benchmark always uses streaming and a fixed 450 output-token cap. It does not estimate dollar cost from credits: per-model prices and cached-input policies differ. Provider-reported token usage is saved when present, so cost can be calculated using verified tariffs separately. Do not paste keys into a chat or commit them.

## Evaluation
For each answer, human-review these 0–2 categories: project-specificity, factual accuracy, actionable guidance, appropriate clarification, and honest claims about tools/testing. Max score: 10. An error gets 0. Compare aggregate median TTFT and completion latency, success rate, cost per request where pricing is known, and **quality at similar latency**. Check the worst five results as well as the averages.

The benchmark intentionally measures **conversation**, not software-build quality. To measure building, separately run each provider on the same isolated snapshot, compare tests, actual browser form journeys, images, and cost—do not let models alter the same production project.

### Limitations
- Streaming token arrival varies by provider. TTFT measures first visible content, not hidden reasoning.
- Some providers do not support the OpenAI-compatible stream/options in this runner; unsupported models must be recorded as unsupported rather than silently rerouted.
- Free allocations are quota-limited and latency fluctuates with traffic.
- API billing and customer Kairoq credits are different.
- No benchmark scores are claimed until the runs actually execute and responses are reviewed.

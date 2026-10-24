"use strict";
// Kairoq chat → Hermes Agent (NousResearch/hermes-agent) through Hermes' own
// OpenAI-compatible API server (POST /v1/chat/completions, streamed).
//
// Hermes runs as a separate private service (see hermes/ and docs/HERMES.md).
// Kairoq stays the source of truth for the conversation: every request carries
// the visible history, so editing or regenerating a reply in Kairoq works.
// X-Hermes-Session-Key gives Hermes one stable long-term memory scope.

const DEFAULT_CONNECT_TIMEOUT_MS = 20_000; // until Hermes starts answering
const DEFAULT_IDLE_TIMEOUT_MS = 120_000;   // Hermes sends a keepalive every 10s
const MAX_MESSAGES = 100; // the chat's last 100 messages; older ones via Hermes session search

function settings(env = process.env) {
  return {
    url: String(env.KAIROQ_HERMES_URL || "").trim().replace(/\/+$/, ""),
    key: String(env.KAIROQ_HERMES_KEY || "").trim(),
    sessionKey: String(env.KAIROQ_HERMES_SESSION_KEY || "kairoq:owner").trim().slice(0, 256),
    connectTimeoutMs: Number(env.KAIROQ_HERMES_CONNECT_TIMEOUT_MS) || DEFAULT_CONNECT_TIMEOUT_MS,
    idleTimeoutMs: Number(env.KAIROQ_HERMES_IDLE_TIMEOUT_MS) || DEFAULT_IDLE_TIMEOUT_MS,
  };
}

function configured(env = process.env) {
  const s = settings(env);
  return /^https?:\/\//i.test(s.url) && s.key.length >= 16;
}

class HermesError extends Error {
  constructor(message, { afterPartial = false, status = 0 } = {}) {
    super(message);
    this.name = "HermesError";
    this.afterPartial = afterPartial; // true once any reply text reached the user
    this.status = status;
  }
}

// Hermes accepts text and image parts; anything else (PDF/doc attachments) is
// turned into a short text note instead of failing the whole request.
function contentForHermes(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return content == null ? "" : String(content);
  const parts = [];
  for (const part of content) {
    if (!part || typeof part !== "object") continue;
    if (part.type === "text" && typeof part.text === "string") parts.push({ type: "text", text: part.text });
    else if (part.type === "image_url" && /^(https?:|data:image\/)/i.test(String(part.image_url?.url || part.image_url || "")))
      parts.push({ type: "image_url", image_url: typeof part.image_url === "string" ? { url: part.image_url } : part.image_url });
    else parts.push({ type: "text", text: `[Attachment of type ${String(part.type || "file").slice(0, 40)} not forwarded]` });
  }
  if (parts.every(p => p.type === "text")) return parts.map(p => p.text).join("\n");
  return parts;
}

function toHermesMessages(messages) {
  return (Array.isArray(messages) ? messages : [])
    .filter(m => m && ["system", "user", "assistant"].includes(m.role))
    .slice(-MAX_MESSAGES)
    .map(m => ({ role: m.role, content: contentForHermes(m.content) }));
}

function toolStatus(progress) {
  if (!progress || progress.status !== "running") return "";
  // Hermes sends a ready-made preview such as 'Searching "railway pricing"'.
  const label = String(progress.label || progress.tool || "Working").replace(/\s+/g, " ").trim().slice(0, 120);
  const emoji = typeof progress.emoji === "string" ? progress.emoji.slice(0, 4) : "";
  return `${emoji ? `${emoji} ` : ""}${label}…`;
}

// Parses an SSE byte stream into {event, data} frames. Comment lines (": keepalive")
// are reported as {comment:true} so callers can treat them as liveness.
function createSseParser(onFrame) {
  let buffer = "";
  return chunk => {
    buffer += chunk;
    let index;
    while ((index = buffer.search(/\r?\n\r?\n/)) !== -1) {
      const raw = buffer.slice(0, index);
      buffer = buffer.slice(index).replace(/^\r?\n\r?\n/, "");
      let event = "message";
      const data = [];
      let comment = false;
      for (const line of raw.split(/\r?\n/)) {
        if (line.startsWith(":")) { comment = true; continue; }
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
      }
      if (data.length) onFrame({ event, data: data.join("\n") });
      else if (comment) onFrame({ comment: true });
    }
  };
}

/**
 * Streams one chat turn from Hermes.
 * @returns {Promise<{text:string, usage:object|null, finishReason:string, model:string}>}
 */
async function streamChat({ messages, onToken = () => {}, onStatus = () => {}, signal, env = process.env, fetchImpl = fetch }) {
  const s = settings(env);
  if (!configured(env)) throw new HermesError("Hermes is not configured.");
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(signal?.reason);
  if (signal) { if (signal.aborted) abortFromCaller(); else signal.addEventListener("abort", abortFromCaller, { once: true }); }

  let text = "";
  let usage = null;
  let finishReason = "";
  let failure = "";
  let timer;
  const arm = (ms, why) => { clearTimeout(timer); timer = setTimeout(() => controller.abort(new HermesError(why)), ms); };

  try {
    arm(s.connectTimeoutMs, "Hermes did not respond in time.");
    let response;
    try {
      response = await fetchImpl(`${s.url}/v1/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${s.key}`,
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          "X-Hermes-Session-Key": s.sessionKey,
        },
        body: JSON.stringify({ model: "hermes-agent", stream: true, messages: toHermesMessages(messages) }),
      });
    } catch (e) {
      throw new HermesError(controller.signal.reason?.message || `Hermes is unreachable (${e.cause?.code || e.message}).`);
    }
    if (!response.ok || !response.body) {
      let detail = "";
      try { const body = await response.json(); detail = body?.error?.message || body?.error || ""; } catch {}
      const hint = response.status === 401 ? " Check that KAIROQ_HERMES_KEY matches API_SERVER_KEY." : response.status === 429 ? " Hermes is busy." : "";
      throw new HermesError(`Hermes returned HTTP ${response.status}${detail ? `: ${String(detail).slice(0, 200)}` : ""}.${hint}`, { status: response.status });
    }

    const parse = createSseParser(frame => {
      if (frame.comment) return; // keepalive; the read itself already reset the idle timer
      if (frame.data === "[DONE]") return;
      let payload;
      try { payload = JSON.parse(frame.data); } catch { return; }
      if (frame.event === "hermes.tool.progress") { const status = toolStatus(payload); if (status) onStatus(status); return; }
      if (frame.event !== "message") return; // approvals and other Hermes-specific frames are not used by Kairoq chat
      if (payload.error) failure = String(payload.error.message || payload.error).slice(0, 300);
      if (payload.usage) usage = payload.usage;
      const choice = payload.choices?.[0];
      if (!choice) return;
      const piece = choice.delta?.content;
      if (typeof piece === "string" && piece) { text += piece; onToken(piece); }
      if (choice.finish_reason) finishReason = choice.finish_reason;
    });

    const decoder = new TextDecoder();
    arm(s.idleTimeoutMs, "Hermes stopped responding.");
    try {
      for await (const chunk of response.body) {
        arm(s.idleTimeoutMs, "Hermes stopped responding.");
        parse(decoder.decode(chunk, { stream: true }));
      }
    } catch (e) {
      const reason = controller.signal.reason;
      throw new HermesError(reason?.message || (signal?.aborted ? "Request cancelled." : `Hermes stream failed (${e.message}).`), { afterPartial: Boolean(text) });
    }

    if (finishReason === "error" || failure) throw new HermesError(`Hermes could not finish this reply${failure ? `: ${failure}` : "."}`, { afterPartial: Boolean(text) });
    if (finishReason === "cancelled") throw new HermesError("Hermes cancelled this reply.", { afterPartial: Boolean(text) });
    if (!finishReason) throw new HermesError("Hermes ended the reply unexpectedly.", { afterPartial: Boolean(text) });
    if (!text.trim()) throw new HermesError("Hermes returned an empty reply.");
    return { text, usage, finishReason, model: "hermes-agent" };
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", abortFromCaller);
  }
}

async function health({ env = process.env, fetchImpl = fetch } = {}) {
  const s = settings(env);
  if (!configured(env)) return { configured: false, ok: false };
  try {
    const r = await fetchImpl(`${s.url}/health`, { signal: AbortSignal.timeout(5000) });
    return { configured: true, ok: r.ok };
  } catch (e) {
    return { configured: true, ok: false, error: e.cause?.code || e.message };
  }
}

module.exports = { configured, settings, streamChat, health, toHermesMessages, createSseParser, HermesError };

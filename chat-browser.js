"use strict";
// Browser use from the main chat: when the owner asks Kairoq to DO or FIND something on a
// website, it opens the site in a real (headless) Chromium and works through it with the
// existing browser agent (browser-agent.js), instead of only reading the page's text.
// Every step is streamed back: what the agent is doing, plus a live screenshot.

const ACTION_WORDS = /\b(find|check|look (?:for|up|at)|search|click|open|go to|navigate|browse|book|reserve|fill|sign ?up|log ?in|compare|price|prices|cost|availability|available|add to cart|test|try|use|explore|scroll|download|subscribe|contact|get me|show me|tell me (?:the|what|how|if|whether)|what(?:'s| is| are) the)\b/i;
const BROWSER_WORDS = /\b(browser|browse|headless|chromium|click through|open (?:it|the site|the website|this))\b/i;
const READ_ONLY = /^\s*(?:summari[sz]e|summary of|tl;?dr|what is this(?: site| website)?|describe|explain)\b/i;

// True when the message is a task to perform on the site, not a request to summarise it.
function wantsBrowser(text) {
  const t = String(text || "");
  if (BROWSER_WORDS.test(t)) return true;
  if (READ_ONLY.test(t)) return false;
  // A bare link or a link with a few words is a "read this" request.
  const words = t.replace(/https?:\/\/\S+|\b[\w-]+(?:\.[\w-]+)+\S*/g, " ").trim().split(/\s+/).filter(Boolean);
  return words.length >= 3 && ACTION_WORDS.test(t);
}

function clip(v, n) { return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n); }

function describeStep(step) {
  const label = clip(step.label || step.value || "", 80);
  switch (step.action) {
    case "click": return `Clicking “${label}”`;
    case "fill": return `Typing into “${clip(step.label || "a field", 60)}”`;
    case "select": return `Choosing “${label}”`;
    case "scroll": return "Scrolling";
    case "back": return "Going back";
    case "go_to": return `Opening ${label}`;
    case "find_text": return `Looking for “${label}”`;
    case "read": return "Reading the page";
    case "hover": return `Pointing at “${label}”`;
    case "key": return `Pressing ${label}`;
    case "wait": return "Waiting for the page";
    case "done": return "Checking the answer";
    case "give_up": return "Stopping";
    case "ask_human": return "Needs a person";
    default: return clip(step.thought || step.action || "Working", 100);
  }
}

const OUTCOME_NOTE = {
  completed: "",
  gave_up: "I couldn't complete this on the site.",
  blocked: "The site blocked automated browsing (a bot check, captcha or sign-in), so I stopped.",
  stuck: "I ran out of steps before finishing.",
  error: "The browser run failed.",
};

/**
 * Runs one browser task and reports progress.
 * @param {object} o
 * @param {string} o.url  public https link
 * @param {string} o.task what to do or find, in the owner's words
 * @param {Function} o.callModel the builder model caller (same one the web agent uses)
 * @param {Function} [o.onStatus] (text) => void
 * @param {Function} [o.onFrame] ({image, caption, step}) => void, image is base64 JPEG
 * @param {AbortSignal} [o.signal]
 * @param {Function} [o.browseSite] injectable for tests; defaults to runtime-check.session
 * @returns {Promise<{markdown:string, outcome:string, steps:number}>}
 */
async function run({ url, task, callModel, onStatus = () => {}, onFrame = () => {}, signal, browseSite, maxSteps }) {
  const runtime = require("./runtime-check");
  let target = String(url || "");
  if (/^http:\/\//i.test(target) && !(process.env.KAIROQ_EXTERNAL_ALLOW_LOCAL === "1" && /^http:\/\/127\.0\.0\.1[:/]/.test(target))) target = target.replace(/^http:/i, "https:");
  target = await runtime.checkSite(target);
  const open = browseSite || ((u, o) => runtime.session(u, o));
  const host = new URL(target).hostname;

  onStatus(`Opening ${host} in the browser…`);
  const session = await open(target, { site: true, viewport: "desktop" });
  if (!session) throw Object.assign(new Error("Browser use needs Chromium on this server (it is installed by the Kairoq Dockerfile)."), { status: 503 });

  let lastFrame = 0;
  const frame = async (caption, step, force = false) => {
    if (!session.screenshot) return;
    if (!force && Date.now() - lastFrame < 700) return; // keep the stream light
    lastFrame = Date.now();
    const image = await session.screenshot().catch(() => null);
    const currentUrl = typeof session.url === "function" ? session.url() : target;
    if (image) onFrame({ image, caption, step, url: currentUrl });
  };

  try {
    await frame(`Opened ${host}`, 0, true);
    const pending = [];
    const notes = require("./site-notes");
    const result = await require("./browser-agent").run({
      session, goal: clip(task, 1000), mode: "task", notes: notes.note("owner", target), callModel, signal,
      maxSteps: maxSteps || Number(process.env.KAIROQ_WEB_TASK_STEPS) || 15,
      onStep: step => {
        const text = describeStep(step);
        onStatus(`Step ${step.n}: ${text}…`);
        pending.push(frame(text, step.n));
      },
    });
    await Promise.all(pending);
    try { notes.record("owner", target, task, result); } catch {}
    await frame("Final page", result.steps.length, true);

    const note = OUTCOME_NOTE[result.outcome] ?? "";
    const answer = clip(result.answer || "", 4000);
    const trail = result.steps.slice(-15).map(s => `${s.n}. ${describeStep(s)}${s.error ? ` — ${clip(s.error, 80)}` : ""}`).join("\n");
    const verdict = result.verdict && result.verdict.checked && !result.verdict.ok ? `\n\n_A second check wasn't sure about this answer: ${clip(result.verdict.reason, 200)}_` : "";
    const markdown = [
      answer || note || "I didn't find an answer on the site.",
      answer && note ? `\n_${note}_` : "",
      verdict,
      `\n\n**What I did on ${host}**\n${trail || "Opened the page."}`,
      result.error ? `\n\n_Error: ${clip(result.error, 200)}_` : "",
    ].join("");
    return { markdown, outcome: result.outcome, steps: result.steps.length };
  } finally {
    await session.close?.().catch(() => {});
  }
}

module.exports = { wantsBrowser, run, describeStep };

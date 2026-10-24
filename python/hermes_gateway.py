"""Private Python gateway to the full, pinned Nous Hermes agent runtime.

The Hermes repository is installed intact under /opt/hermes, preserving its license.
This service is NOT publicly exposed. Use KAIROQ_PYTHON_AGENT_TOKEN for authorization.
"""
import json
import hashlib
import hmac
import uuid
import os
import sys
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(os.getenv("HERMES_SOURCE", "/opt/hermes"))
if ROOT.exists():
    sys.path.insert(0, str(ROOT))

MODEL = os.getenv("KAIROQ_HERMES_MODEL", "")
BASE_URL = os.getenv("KAIROQ_HERMES_BASE_URL", "")
API_KEY = os.getenv("KAIROQ_HERMES_API_KEY", "")
TOKEN = os.getenv("KAIROQ_PYTHON_AGENT_TOKEN", "")
TOOLSETS = [s.strip() for s in os.getenv("KAIROQ_HERMES_TOOLSETS", "safe").split(",") if s.strip()]
MAX_ITERATIONS = min(20, max(1, int(os.getenv("KAIROQ_HERMES_MAX_ITERATIONS", "8"))))


def configured():
    return bool(MODEL and BASE_URL and API_KEY and TOKEN and ROOT.exists())


def scoped_session_id(conversation_key):
    """Stable scoped Hermes session ID, never expose raw upstream IDs."""
    if not TOKEN or not isinstance(conversation_key, str) or not 1 <= len(conversation_key) <= 128:
        raise ValueError("A valid conversation ID is required")
    digest = hmac.new(TOKEN.encode("utf-8"), conversation_key.encode("utf-8"), hashlib.sha256).digest()
    return str(uuid.UUID(bytes=digest[:16], version=4))


def generate(messages, conversation_key):
    if not configured():
        raise RuntimeError("Hermes needs an installed runtime and configured model credentials")
    from run_agent import AIAgent
    # Pass only the new user turn; Hermes retains prior turns in its own session.
    prompt = next((msg["content"] for msg in reversed(messages) if isinstance(msg, dict) and msg.get("role") == "user" and isinstance(msg.get("content"), str)), "")
    if not prompt.strip():
        raise ValueError("No text messages supplied")
    # Disable terminal and arbitrary file/network execution by default: allow only
    # toolsets configured for this isolated service. Production deployments must
    # audit the selected Hermes toolset names and their privileges.
    agent = AIAgent(
        base_url=BASE_URL, api_key=API_KEY, model=MODEL,
        max_iterations=MAX_ITERATIONS, enabled_toolsets=TOOLSETS,
        session_id=scoped_session_id(conversation_key),
        quiet_mode=True,
        run_budget_seconds=90,
        skip_background_review=True,
        skip_context_files=True,
    )
    try:
        result = agent.run_conversation(prompt)
    finally:
        # Hermes owns background workers and session storage; flush and release
        # resources on every request, including provider exceptions.
        close = getattr(agent, "close", None)
        if callable(close):
            close()
    if isinstance(result, str):
        return result
    if isinstance(result, dict):
        # Upstream Hermes returns a result envelope with `final_response`.
        return str(result.get("final_response") or result.get("response") or result.get("content") or result.get("message") or "")
    return str(result)


class Handler(BaseHTTPRequestHandler):
    def reply(self, status, obj):
        raw = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        if self.path == "/health":
            return self.reply(200, {"engine": "hermes-python", "configured": configured(), "runtime_present": ROOT.exists()})
        if not TOKEN or self.headers.get("Authorization") != "Bearer " + TOKEN:
            return self.reply(401, {"error": "Unauthorized"})
        if self.path == "/models":
            models = [{"id": "python/hermes", "name": f"Hermes · {MODEL}", "isFree": False, "source": "hermes", "local": False, "configured": True}] if configured() else []
            return self.reply(200, {"models": models})
        return self.reply(404, {"error": "Not found"})

    def do_POST(self):
        if self.path != "/chat":
            return self.reply(404, {"error": "Not found"})
        if not TOKEN or self.headers.get("Authorization") != "Bearer " + TOKEN:
            return self.reply(401, {"error": "Unauthorized"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 131072:
                return self.reply(413, {"error": "Payload size invalid"})
            body = json.loads(self.rfile.read(length))
            messages = body.get("messages", [])
            if not isinstance(messages, list):
                return self.reply(400, {"error": "Invalid messages"})
            answer = generate(messages, body.get("conversationId"))
            return self.reply(200, {"message": answer, "model": MODEL, "provider": "hermes-python"})
        except ValueError as e:
            return self.reply(400, {"error": str(e)})
        except Exception as e:
            # Don't return private provider error details or credentials to callers.
            sys.stderr.write("Hermes request failed: " + type(e).__name__ + "\n")
            return self.reply(503, {"error": "Hermes model or runtime unavailable"})

    def log_message(self, fmt, *args):
        pass


if __name__ == "__main__":
    if not TOKEN:
        raise SystemExit("KAIROQ_PYTHON_AGENT_TOKEN required")
    server = ThreadingHTTPServer(("0.0.0.0", int(os.getenv("PORT", "8090"))), Handler)
    server.serve_forever()

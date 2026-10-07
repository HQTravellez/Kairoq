const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");

test("server starts and health endpoint responds", { timeout: 10000 }, async () => {
  const port = 39123;
  const child = spawn(process.execPath, ["server.js"], {
    cwd: require("node:path").join(__dirname, ".."),
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      OPENROUTER_API_KEY: "test-key",
      APP_PASSWORD: "",
      DAILY_COST_LIMIT_USD: "5",
      MONTHLY_COST_LIMIT_USD: "50"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("server start timeout")), 5000);
      child.stdout.on("data", d => {
        if (String(d).includes("Kairoq running")) {
          clearTimeout(timer);
          resolve();
        }
      });
      child.on("exit", code => reject(new Error(`server exited early: ${code}`)));
    });

    const res = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
  } finally {
    child.kill("SIGTERM");
  }
});

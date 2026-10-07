import dotenv from "dotenv";
import { config, higgsfield } from "@higgsfield/client/v2";

dotenv.config({ path: ".env.local" });

const MODEL = "bytedance/seedance-2.5/text-to-video";
const credentials = process.env.HF_CREDENTIALS?.trim();

function fail(message: string, code: number): never {
  console.error(message);
  process.exit(code);
}

if (
  !credentials ||
  credentials === "YOUR_KEY_ID:YOUR_KEY_SECRET" ||
  !credentials.includes(":")
) {
  fail(
    "HF_CREDENTIALS is not configured. Enter KEY_ID:KEY_SECRET in .env.local on your machine, then rerun npm run higgsfield:seedance.",
    2,
  );
}

config({ credentials });

try {
  const result = await higgsfield.subscribe(MODEL, {
    input: {
      prompt: "A cinematic scene at sunset",
      duration: 5,
      resolution: "720p",
      aspect_ratio: "16:9",
      output_format: "mp4",
      generate_audio: true,
    },
    withPolling: true,
  });

  const status = String(result.status || "unknown").toLowerCase();

  if (status === "completed") {
    const videoUrl = result.video?.url;
    if (!videoUrl) {
      fail("Higgsfield reported completion but returned no video URL.", 3);
    }
    console.log(videoUrl);
  } else if (status === "nsfw" || status === "moderated") {
    fail("Higgsfield moderated the request; no successful video was produced.", 4);
  } else if (status === "failed") {
    fail("Higgsfield generation failed; no successful video was produced.", 5);
  } else if (status === "canceled" || status === "cancelled") {
    fail("Higgsfield generation was canceled; no successful video was produced.", 6);
  } else {
    fail(`Higgsfield ended in unexpected status: ${status}. No success claimed.`, 7);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown Higgsfield SDK error";
  fail(`Higgsfield SDK request failed: ${message}`, 8);
}

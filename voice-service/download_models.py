# SPDX-License-Identifier: GPL-3.0-or-later
"""Build-time downloads only; exact Kokoro revision and SHA-verified Whisper weights."""
import hashlib
import json
import os
from pathlib import Path
from huggingface_hub import hf_hub_download
import whisper

REVISION = "f3ff3571791e39611d31c381e3a41a3af07b4987"
root = Path(os.environ.get("VOICE_MODEL_DIR", "/models"))
files = ["config.json", "kokoro-v1_0.pth", "README.md"] + [f"voices/{v}.pt" for v in ("af_heart", "bf_emma", "ef_dora", "ff_siwis", "hf_alpha", "if_sara", "pf_dora")]
for name in files:
    hf_hub_download("hexgrad/Kokoro-82M", name, revision=REVISION, local_dir=root / "kokoro")
whisper._download(whisper._MODELS["tiny"], str(root / "whisper"), False)
manifest = {"kokoro_revision": REVISION, "whisper": "tiny", "files": {}}
for file in sorted(root.rglob("*")):
    if file.is_file() and ".cache" not in file.parts:
        manifest["files"][str(file.relative_to(root))] = hashlib.sha256(file.read_bytes()).hexdigest()
(root / "manifest.json").write_text(json.dumps(manifest, indent=2))
print("Downloaded pinned voice models and wrote manifest.json")

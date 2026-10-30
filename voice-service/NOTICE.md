# Voice service licensing and provenance

Reviewed 2026-10-30. This service is independently implemented; it contains no
VoiceStudio source, images, UI, installer, or model weights. It never downloads
OmniVoice or offers unrestricted model URLs.

- Kokoro 0.9.4 and Misaki 0.9.4: Apache-2.0, https://github.com/hexgrad/kokoro
  and https://github.com/hexgrad/misaki.
- Kokoro-82M v1.0 weights, config and seven selected voice tensors:
  https://huggingface.co/hexgrad/Kokoro-82M/tree/f3ff3571791e39611d31c381e3a41a3af07b4987
  The pinned model card declares Apache-2.0 and explicitly permits production use.
  Its complete model card (including training-data attribution for SIWIS and
  Koniwa) is retained with the downloaded artifacts. No voice cloning is offered.
- OpenAI Whisper 20250625, multilingual tiny weights: MIT. Upstream explicitly
  licenses both code and weights under MIT: https://github.com/openai/whisper#license
  The tiny checkpoint is SHA-256 verified by the official downloader:
  65147644a518d12f04e32d6f3b26facc3f8dd46e5390956a9424a650c0ce22b9.
- en_core_web_sm 3.8.0: MIT, https://huggingface.co/spacy/en_core_web_sm.
- Phonemizer and eSpeak NG have GPL terms; they are NOT permissive dependencies.
  This separate service's original Python application is offered under GPL-3.0-or-later
  for compatibility with that runtime. Kairoq communicates only via the documented
  HTTP protocol. This notice does not relicense the proprietary Kairoq application.
  Sources: https://github.com/bootphon/phonemizer and https://github.com/espeak-ng/espeak-ng.
- FFmpeg and the Debian runtime retain their own package licenses and notices in
  /usr/share/doc. Distribution of a container to others requires preserving notices
  and satisfying corresponding-source obligations for GPL/LGPL components. Do not
  market this image as wholly permissive or redistribute it without that packaging.

The model downloader writes SHA-256 hashes of every artifact to /models/manifest.json.
Runtime downloads are disabled. Dependency versions are in requirements.txt; the
container includes its installed package license metadata. No paid inference API is used.

VoiceStudio itself is AGPL-3.0-only, which permits commercial use with its obligations.
Embedding it in a closed-source product without satisfying those terms needs a
compatible license. Merely running an AGPL app in another process does not waive
its obligations. This service does not install or run VoiceStudio.
VoiceStudio's model inventory specifically flags OmniVoice, OmniVoice-GGUF, NLLB
and Llama-OuteTTS noncommercial records; other unreviewed models are not automatically
prohibited or cleared. A VoiceStudio commercial license does not license third-party weights.
Sources: https://github.com/debpalash/VoiceStudio/blob/main/LICENSE-NOTICE.md
and https://github.com/debpalash/VoiceStudio/blob/main/docs/licensing/model-inventory.md.

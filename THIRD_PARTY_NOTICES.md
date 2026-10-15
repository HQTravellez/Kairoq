# Third-party notices

## Open Generative AI

Kairoq v13.9's Creative Engine was informed by architectural patterns in Open Generative AI:
https://github.com/Anil-matcha/Open-Generative-AI

MIT License

Copyright (c) 2026 Open Generative AI Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

Kairoq does not bundle Open Generative AI, MuAPI, Wan2GP, model weights, or third-party GPU binaries in this package.

## Optional external integrations in v16

Kairoq can invoke a separately installed OpenEnrich CLI and can call the Postiz Public API. Neither OpenEnrich nor Postiz source code is bundled into this archive. Review the licenses/terms of those external projects/services before redistributing or offering a hosted product that incorporates them.

## Anthropic skills: frontend-design

`design-skills/frontend-design/SKILL.md` is the "frontend-design" skill from https://github.com/anthropics/skills, licensed under the Apache License 2.0 (full text in `design-skills/frontend-design/LICENSE.txt`). Kairoq changed only its front matter (display name, `default: on`).

## Packages for generated apps

- gsap 3.13 (GreenSock standard no-charge license, https://gsap.com/standard-license), lenis 1.3 (MIT), three 0.169 (MIT).
- remotion and @remotion/player 4.0 (Remotion License: free for individuals, non-profits and companies of up to 3 people; larger companies need a company license from remotion.pro). Generated apps only include them when the app imports them.

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

## html-anything: page-type design skills

The design skills marked "Page types" in `design-skills/` (printable invoice, pricing page, email newsletter, event flyer, social carousel, pitch deck and the others) were adapted from the skill templates in html-anything by nexu-io, https://github.com/nexu-io/html-anything, licensed under the Apache License 2.0 (full text in `licenses/html-anything-LICENSE.txt`). Kairoq rewrote them in English for React and Tailwind apps and expanded their content; the templates html-anything marks as adapted from other projects were not used.

## api-anything: quick checks for web watches

`web-replay.js` (learning the one public request that holds a watch's answer, replaying it without a browser, and learning again when it stops fitting) follows the approach of api-anything by Tianjun Zheng, https://github.com/goodnight000/api-anything. Kairoq's version is its own smaller, read-only implementation and does not include api-anything's code. api-anything is licensed under the MIT License:

MIT License

Copyright (c) 2026 Tianjun Zheng

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## taste-skill: art directions, design library, tells, page checks, app screens

`design-library/` (directions, heroes, sections, motions, palettes, type systems and the app-screen styles, with the study's site references removed), the dated "tells" added to `design-slop.js`, the page-frame checks in `design-frame.js`, the look-and-fix polish rounds and the `app-screens` design skill are adapted from taste-skill by Leonxlnx, https://github.com/Leonxlnx/taste-skill (commit 63aba5f), licensed under the MIT License (full text in `design-library/LICENSE-taste-skill`). The `redesign` design skill is that author's redesign skill (MIT), as bundled in open-design.

## open-design: style systems, craft rulebooks and skills

`design-library/styles/` (59 generic style systems; the packages that copy real brands were left out), the `craft-*` design skills and the `faq-page` design skill are from open-design by nexu-io, https://github.com/nexu-io/open-design (commit 3b0df90), licensed under the Apache License 2.0 (full text in `design-library/LICENSE-open-design`). Its craft rulebooks are themselves adapted from refero_skill by Refero Design (MIT). Kairoq added front matter and a credit line to each skill.

## Web Interface Guidelines

`design-skills/web-interface-guidelines/SKILL.md` contains the Web Interface Guidelines by Vercel Labs, https://github.com/vercel-labs/web-interface-guidelines, licensed under the MIT License (full text in `licenses/web-interface-guidelines-LICENSE.txt`).

## superpowers: builder habits

`builder-method.js` (find the cause before fixing, honest claims about what was verified, checking review findings before applying them) is adapted from the systematic-debugging, verification-before-completion and receiving-code-review skills of superpowers by Jesse Vincent, https://github.com/obra/superpowers, licensed under the MIT License (full text in `licenses/superpowers-LICENSE.txt`).

## Harvey: email gate and Find customers

`email-gate.js` and the pipeline in `outreach.js` (listing businesses, reading their sites without AI, owner-confirmed signals, an outbox the owner approves, the bounce kill switch) follow Harvey by Ethan Rogers, https://github.com/ethanplusai/harvey, licensed under the MIT License (full text in `licenses/harvey-LICENSE.txt`). Kairoq's version is its own JavaScript implementation; Harvey's code, its subscription-based model calls, LinkedIn automation and "humanizer" are not used. Business listings come from OpenStreetMap (© OpenStreetMap contributors, ODbL), used through Nominatim and Overpass under their usage policies.

## img2threejs: the 3D product method

The `three-product` design skill follows the pass-by-pass method of img2threejs, https://github.com/img2threejs/img2threejs, licensed under the Apache License 2.0 (full text in `licenses/img2threejs-LICENSE.txt`). No code from it is included.

## Karpathy-inspired coding guidelines

`builder-method.js` adds Kairoq-specific, paraphrased coding discipline inspired by the four principles (Think Before Coding, Simplicity First, Surgical Changes, and Goal-Driven Execution) in `andrej-karpathy-skills` by multica-ai: https://github.com/multica-ai/andrej-karpathy-skills (observed revision `2c606141936f1eeef17fa3043a72095b4765b9c2`). The upstream README identifies its license as MIT. No upstream scripts, plugins, or package dependencies are installed, and no upstream source file is bundled. Principles are applied within Kairoq's existing model prompt and never override security/validation rules.

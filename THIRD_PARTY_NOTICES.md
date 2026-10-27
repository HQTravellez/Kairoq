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

## Prettier

Prettier 3.9 (MIT, https://github.com/prettier/prettier) formats the code the app builder writes (`code-format.js`). It runs on the server only; generated apps do not include it.

## yaml

yaml 2.9.1 (ISC, https://github.com/eemeli/yaml) reads YAML API specs when the owner adds an outside API (`api-samples.js`). It runs on the server only.

## Effect pieces in the app kit

`starter-kit/src/components/ui/` includes effect components converted to JSX, with the app's theme colours:
- Motion Primitives by ibelick (MIT, https://github.com/ibelick/motion-primitives): text-effect, text-shimmer, text-loop, tilt, spotlight, progressive-blur, image-comparison, magnetic, animated-group, scroll-progress, in-view.
- Kokonut UI (MIT, https://github.com/kokonut-labs/kokonutui): background-paths.
- Cult UI by Jordan Gilliam (MIT, https://github.com/nolly-studio/cult-ui): animated-gradient.

Each file names its source and licence at the top, so the credit travels with the apps people download. Origin UI was not used: it is AGPL-3.0.

## Packages for generated apps

- gsap 3.13 (GreenSock standard no-charge license, https://gsap.com/standard-license), lenis 1.3 (MIT), three 0.169 (MIT).
- remotion and @remotion/player 4.0 (Remotion License: free for individuals, non-profits and companies of up to 3 people; larger companies need a company license from remotion.pro). Generated apps only include them when the app imports them.

## Font library (font-library.js)

New sites and apps use only these fonts, bundled into each build from the Fontsource npm packages (`@fontsource-variable/*`, `@fontsource/*`). Every one is under the SIL Open Font License 1.1, which allows commercial use and embedding in websites. `test/font-library.test.js` checks each installed package's licence. Each site's CSS names the licence. The fonts: Geist, Inter, Inter Tight, Mona Sans, Instrument Sans, Hanken Grotesk, Schibsted Grotesk, Familjen Grotesk, Onest, Figtree, Manrope, Public Sans, Bricolage Grotesque, Archivo, Hubot Sans, Funnel Display, Host Grotesk, Space Grotesk, Unbounded, Syne, Big Shoulders Display, Anton, Fraunces, Newsreader, Source Serif 4, EB Garamond, Bodoni Moda, Instrument Serif, Young Serif, Gloock, DM Serif Display, Libre Caslon Text, Geist Mono, JetBrains Mono, IBM Plex Mono, Fredoka, Baloo 2, Nunito, Quicksand.

## Craft library, photos and icons (craft-norms.json, photo-finder.js)

- **craft-norms.json** holds measurements only (font sizes and weights, corner sizes, counts of boxes, shadows and sections, what the hero shows) of the public home pages of 117 well-designed websites, taken in a desktop browser in October 2026. No code, text, images or colours from those sites are stored. Only the site addresses are kept, as examples.
- **Photos** for new sites come from Pexels when `PEXELS_API_KEY` is set. The Pexels License allows free use and asks for a credit to the photographer and a link to Pexels, which Kairoq adds and checks. Otherwise they come from Openverse, restricted to CC0 or CC BY with commercial use allowed. CC BY photos get a credit line, which Kairoq checks. The licence and credit of every photo are saved with the project.
- **@phosphor-icons/react** 2.1 (MIT) is available to generated apps as a second icon set, next to lucide-react.

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

## ui-ux-pro-max-skill: business palettes, font pairings and page playbooks

`design-presets.json` (palettes, font pairings and font families by kind of business, and a page playbook per business: page pattern, section order, main button placement, style, effects and what to avoid) is adapted from ui-ux-pro-max-skill by Next Level Builder, https://github.com/nextlevelbuilder/ui-ux-pro-max-skill (commit d14efff), licensed under the MIT License (full text in `licenses/ui-ux-pro-max-skill-LICENSE.txt`). Rebuilt with `scripts/design-data/import-pro-max.js`.

## open-design: style systems, craft rulebooks and skills

`design-library/styles/` (59 generic style systems; the packages that copy real brands were left out), the `craft-*` design skills and the `faq-page` design skill are from open-design by nexu-io, https://github.com/nexu-io/open-design (commit 3b0df90), licensed under the Apache License 2.0 (full text in `design-library/LICENSE-open-design`). Its craft rulebooks are themselves adapted from refero_skill by Refero Design (MIT). Kairoq added front matter and a credit line to each skill.

## Web Interface Guidelines

`design-skills/web-interface-guidelines/SKILL.md` contains the Web Interface Guidelines by Vercel Labs, https://github.com/vercel-labs/web-interface-guidelines, licensed under the MIT License (full text in `licenses/web-interface-guidelines-LICENSE.txt`).

## superpowers: builder habits

`builder-method.js` (find the cause before fixing, honest claims about what was verified, checking review findings before applying them) is adapted from the systematic-debugging, verification-before-completion and receiving-code-review skills of superpowers by Jesse Vincent, https://github.com/obra/superpowers, licensed under the MIT License (full text in `licenses/superpowers-LICENSE.txt`).

The complete Superpowers skill library (all skills in its `skills/` folder, unmodified, revision `2ce8aa1`) is also shipped to Kairoq's Hermes chat service in `hermes/skills/superpowers/`, with its MIT license in `hermes/skills/superpowers/LICENSE`.

## Harvey: email gate and Find customers

`email-gate.js` and the pipeline in `outreach.js` (listing businesses, reading their sites without AI, owner-confirmed signals, an outbox the owner approves, the bounce kill switch) follow Harvey by Ethan Rogers, https://github.com/ethanplusai/harvey, licensed under the MIT License (full text in `licenses/harvey-LICENSE.txt`). Kairoq's version is its own JavaScript implementation; Harvey's code, its subscription-based model calls, LinkedIn automation and "humanizer" are not used. Business listings come from OpenStreetMap (© OpenStreetMap contributors, ODbL), used through Nominatim and Overpass under their usage policies.

## img2threejs: the 3D product method

The `three-product` design skill follows the pass-by-pass method of img2threejs, https://github.com/img2threejs/img2threejs, licensed under the Apache License 2.0 (full text in `licenses/img2threejs-LICENSE.txt`). No code from it is included.

## Karpathy-inspired coding guidelines

`builder-method.js` adds Kairoq-specific, paraphrased coding discipline inspired by the four principles (Think Before Coding, Simplicity First, Surgical Changes, and Goal-Driven Execution) in `andrej-karpathy-skills` by multica-ai: https://github.com/multica-ai/andrej-karpathy-skills (observed revision `2c606141936f1eeef17fa3043a72095b4765b9c2`). The upstream README identifies its license as MIT. No upstream scripts, plugins, or package dependencies are installed, and no upstream source file is bundled. Principles are applied within Kairoq's existing model prompt and never override security/validation rules.
## HeyGen HyperFrames (optional HTML-to-video CLI)

`hyperframes-video.js` and `scripts/hyperframes-smoke.js` provide a Kairoq-written, opt-in, local adapter to the separately installed HyperFrames CLI from https://github.com/heygen-com/hyperframes, released under the Apache License 2.0 License (source revision `4371981b740d92f70e520cfbec34db68a1c93434`). Kairoq does not vendor or execute HyperFrames packages by default, does not import arbitrary external skill instructions, and does not bundle its fonts or binaries. Operator installation in a sandboxed worker is required to render. This adaptation uses the documented HyperFrames composition format; no source code from the upstream package is copied.

## Modular agent-stack interoperability

The adapters in `integrations/agent-stack/` interoperate with, or adapt concepts from,
the following projects without vendoring their implementation or automatically
installing their hooks. Reviewed source commits are in `upstreams.json`.

- ECC — https://github.com/affaan-m/ECC — MIT; existing scoped-recall concept adaptation.
- Understand-Anything — https://github.com/Egonex-AI/Understand-Anything — MIT; graph-format interoperability.
- Ruflo — https://github.com/ruvnet/ruflo — MIT; optional independently installed MCP server.
- Mem0 — https://github.com/mem0ai/mem0 — Apache-2.0; optional independently operated OSS REST service.
- AutoHarness — https://github.com/tigerless-labs/autoharness — MIT; staged create-intent interoperability.

Upstream binaries/services carry their own dependencies, licenses and operational
requirements. API/schema compatibility and offline tests do not establish production readiness.

## 3D in the app builder

- Google model-viewer 4.4.0 — https://github.com/google/model-viewer — Apache-2.0. Its bundled
  build (which contains three.js, MIT) is vendored unmodified at
  `public/vendor/model-viewer/model-viewer-4.4.0.min.js` with its licence next to it, and is
  copied into apps that show 3D (`react-model3d.js`).
- Blender — https://www.blender.org — GPL-2.0-or-later. Installed unmodified in the Docker image
  as the `bpy` Python module (PyPI `bpy`) and run as a separate process (`blender.js`,
  `scripts/blender-kairoq.py`) to convert and render 3D files. Kairoq does not link it or ship it
  in apps; GLB files Blender writes are the owner's own content.
- Poly Haven — https://polyhaven.com — models, textures and HDRIs under CC0 (public domain),
  downloaded on request through api.polyhaven.com. Kairoq keeps the source and credit with
  each model.
- three.js 0.183 — https://github.com/mrdoob/three.js — MIT. React Three Fiber 8 and drei 9 —
  https://github.com/pmndrs — MIT. Used by the `kairoq/scene` pieces (`react-scene.js`) and `kairoq/story` (`app-modules/kairoq-story.js`).
- World land map for the globe (`vendor/land-1deg.b64`, 1-degree land/sea bits) — generated with
  global-land-mask (MIT) from GSHHG/Natural Earth data (public domain).

## Real-device checks

- Fira Code — https://github.com/tonsky/FiraCode — SIL Open Font License 1.1. Loaded from Google
  Fonts for Kairoq's code views and offered to apps as a code font (`react-design.js`).

## Replica method (build from a reference)

- Replica skill pack — https://github.com/Jakeschincariol/replica-skill — MIT. Its review themes
  (`vendor/replica/themes.json`, with its licence) and its ranking, parity and sweep methods are
  used in `react-reviews.js`, `react-parity.js` and `react-sweep.js`, rewritten in JavaScript.
- Reviews are read only through official public APIs: Apple's iTunes Search API and App Store
  customer-reviews feed, and the Hacker News (Algolia) search API.
- WebKit (Safari's engine) as built by Playwright — https://playwright.dev — Apache-2.0 (Playwright)
  and LGPL/BSD (WebKit). Installed unmodified in the Docker image and run as a separate browser
  for the "iPhone Safari" checks and the editor's "Real Safari" screenshot (`runtime-check.js`).

'use strict';
// The Blender modelling agent (model-agent.js): the AI writes a parts list, Kairoq checks it
// (model-spec.js), Blender builds it (blender.js runSpec, scripts/props/spec.py), an AI that can
// see reviews the preview, and the model is saved. Plus ScrollAssembly in kairoq/hero3d.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kairoq-model-agent-'));
process.env.NODE_ENV = 'test';
process.env.KAIROQ_REACT_PROJECTS_DIR = path.join(tmp, 'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB = path.join(tmp, 'accounts.sqlite');
const spec = require('../model-spec'), agent = require('../model-agent'), blender = require('../blender');
const builder = require('../react-builder'), design = require('../react-design'), runtime = require('../runtime-check');
const WATCH = require('../scripts/props/specs/watch.json');
test.after(() => runtime.close());

test('a parts list is checked before Blender reads it: only known shapes, materials and sensible numbers', () => {
  const ok = spec.validate(WATCH);
  assert.equal(ok.total, 117);
  const one = (p) => spec.validate({ parts: [p] });
  assert.throws(() => one({ shape: 'script', code: 'import os' }), /shape must be one of/);
  assert.throws(() => one({ shape: 'box', size: [1, 1, 1], material: 'lava' }), /material must be one of/);
  assert.throws(() => one({ shape: 'box', size: [1, 1, 99] }), /size\[2\] must be a number from/);
  assert.throws(() => one({ shape: 'box', size: [1, 'x', 1] }), /size\[1\] must be a number/);
  assert.throws(() => one({ shape: 'ring', count: 3, radius: 0.2, part: { shape: 'ring', count: 2, radius: 0.1, part: { shape: 'box', size: [0.1, 0.1, 0.1] } } }), /cannot contain another ring/);
  assert.throws(() => spec.validate({ parts: Array.from({ length: 6 }, () => ({ shape: 'ring', count: 72, radius: 0.3, part: { shape: 'box', size: [0.01, 0.01, 0.01] } })) }), /keep it under 400/);
  assert.throws(() => spec.validate({ parts: [{ shape: 'box', size: [1, 1, 1] }], materials: { wood: 'brown' } }), /#rrggbb/);
  // Brand and accent always come from the app, never from the spec; names lose odd characters.
  const clean = spec.validate({ parts: [{ shape: 'box', name: '00 Lid<script>', size: [1, 1, 1] }], materials: { brand: '#000000', wood: '#8A5A3B' } });
  assert.deepEqual(clean.materials, { wood: '#8a5a3b' });
  assert.equal(clean.parts[0].name, '00 Lidscript');
});

test('the agent fixes a rejected list, builds, takes the reviewer\'s notes, and saves the model', async () => {
  const replies = [
    { parts: [{ shape: 'teapot' }] },
    { name: 'Camera', parts: [{ shape: 'box', name: '01 Body', size: [0.8, 0.3, 0.5], at: [0, 0, 0.25], material: 'black' }] },
    { name: 'Camera', parts: [{ shape: 'box', name: '01 Body', size: [0.8, 0.3, 0.5], at: [0, 0, 0.25], material: 'black' }, { shape: 'lathe', name: '00 Lens', profile: [[0, 0], [0.15, 0], [0.15, 0.2]], at: [0, -0.15, 0.25], rotate: [90, 0, 0], material: 'glass' }] },
  ];
  const sent = [];
  const callModel = async (o, parse) => { sent.push(o.messages.at(-1).content); return parse(JSON.stringify(replies.shift())); };
  const built = [];
  const runSpec = async (s) => { built.push(s.parts.length); const dir = fs.mkdtempSync(path.join(tmp, 'b-')); fs.writeFileSync(path.join(dir, 'model.glb'), 'glb'); fs.writeFileSync(path.join(dir, 'preview.png'), 'png'); return { dir, glb: path.join(dir, 'model.glb'), poster: path.join(dir, 'preview.png'), parts: s.parts.length }; };
  const verdicts = [{ ok: false, problems: ['Add a lens on the front'] }, { ok: true, problems: [] }];
  const reviews = [];
  const review = async (r) => { reviews.push(r); return verdicts.shift(); };
  let saved = null;
  const r = await agent.make('a vintage film camera', { callModel, runSpec, review, save: (glb, poster, title) => (saved = { glb: String(glb), poster: String(poster), title }, { path: './models/camera.glb' }) });
  assert.deepEqual(built, [1, 2], 'the rejected list never reached Blender');
  assert.match(sent[1], /That spec was rejected: parts\[0\]: shape must be one of/);
  assert.match(sent[2], /The preview shows these problems:\n- Add a lens on the front/);
  assert.match(reviews[0].prompt, /"a vintage film camera"/);
  assert.equal(reviews[0].pictures[0].mime, 'image/png');
  assert.deepEqual(saved, { glb: 'glb', poster: 'png', title: 'Camera' });
  assert.equal(r.rounds, 3);
  assert.deepEqual(r.model, { path: './models/camera.glb' });
  // Without a reviewer the first model that builds is kept; with nothing that builds, a plain error.
  const lone = await agent.make('a mug', { callModel: async (o, p) => p(JSON.stringify({ parts: [{ shape: 'cylinder', radius: 0.3, depth: 0.6 }] })), runSpec, save: () => ({ path: './models/mug.glb' }) });
  assert.equal(lone.rounds, 1);
  await assert.rejects(agent.make('a mug', { callModel: async (o, p) => p('{"parts":[]}'), runSpec }), /could not build a model of "a mug"/);
});

test('real Blender builds a checked list into a GLB and a preview', { timeout: 300000 }, async (t) => {
  if (!blender.available()) { t.diagnostic('Blender is not installed here (KAIROQ_BPY_PYTHON): skipped'); return; }
  const r = await blender.runSpec({ name: 'Mug', parts: [{ shape: 'lathe', name: 'Mug', profile: [[0, 0], [0.3, 0], [0.32, 0.5]], thickness: 0.02, material: 'brand' }, { shape: 'tube', name: 'Handle', points: [[0.32, 0, 0.4], [0.5, 0, 0.3], [0.31, 0, 0.15]], radius: 0.04, material: 'brand' }] });
  const glb = fs.readFileSync(r.glb);
  assert.equal(glb.subarray(0, 4).toString(), 'glTF');
  assert.ok(fs.statSync(r.poster).size > 1000);
  fs.rmSync(r.dir, { recursive: true, force: true });
});

test('the art director can order a bespoke object, made before the first build', async () => {
  const d = require('../design-hero3d');
  assert.deepEqual(d.normalize({ recipe: 'HeroObject', object: 'none', custom: 'a vintage "film" camera <b>', mood: 'neon' }), { recipe: 'HeroObject', object: 'gift-box', custom: 'a vintage  film  camera  b', mood: 'neon' });
  assert.equal(d.jsx({ recipe: 'HeroObject', object: 'gift-box', src: './models/camera-1a2b.glb' }), '<HeroObject src="./models/camera-1a2b.glb" />');
  assert.deepEqual(d.suggest('A boutique watchmaker in Montreal'), { recipe: 'ScrollAssembly', object: 'watch' });
  // The first build: the brief asks for a custom object, the agent makes it, the brief points at it.
  process.env.KAIROQ_DESIGN_BRIEF = 'on';
  const meta = builder.create({ name: 'Lumen', owner: 'owner' });
  await builder.initialize(meta);
  const callModel = async (o, parse) => /art director/.test(o.messages[0].content)
    ? parse(JSON.stringify({ palette: { background: '#ffffff', foreground: '#111111', primary: '#7c2d12' }, hero3d: { recipe: 'HeroObject', custom: 'a vintage film camera' } }))
    : parse(JSON.stringify({ message: 'Built', files: { 'src/App.jsx': 'export default function App(){return <main>Lumen</main>}\n' } }));
  const asked = [];
  await builder.edit(meta.id, 'A website for my camera repair shop', { callModel, makeModel: async (what) => { asked.push(what); return { path: './models/camera-1a2b.glb' }; } });
  delete process.env.KAIROQ_DESIGN_BRIEF;
  assert.deepEqual(asked, ['a vintage film camera']);
  const brief = builder.loadMeta(meta.id).design;
  assert.equal(brief.hero3d.src, './models/camera-1a2b.glb');
  assert.match(design.designNote(brief), /<HeroObject src="\.\/models\/camera-1a2b\.glb" \/>/);
});

test('ScrollAssembly: pinned while scrolling, apart in the middle with labels, together at the end', { timeout: 240000 }, async (t) => {
  const meta = builder.create({ name: 'Watch', owner: 'owner' });
  await builder.initializeFrom(meta, { ...design.starterFiles('Watch'), 'src/App.jsx': fs.readFileSync(path.join(__dirname, 'fixtures', 'hero3d-assembly.jsx'), 'utf8') }, 'Watch');
  assert.ok(fs.existsSync(path.join(builder.versionDir(meta.id, 1), 'dist', 'props', 'hero-watch.glb')));
  if (!runtime.available()) { t.diagnostic('no browser here: only the build was checked'); return; }
  const server = http.createServer((req, res) => { if (!builder.handlePreview(req, res)) { res.writeHead(404); res.end(); } });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const ctx = await (await runtime.browser()).newContext({ viewport: { width: 1280, height: 800 } }), page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.goto('http://127.0.0.1:' + server.address().port + builder.previewUrl(builder.loadMeta(meta.id)), { waitUntil: 'networkidle' });
    const geo = await page.evaluate(() => { const el = document.querySelector('[data-kq-assembly]'); return { top: el.getBoundingClientRect().top + scrollY, span: el.offsetHeight - innerHeight }; });
    assert.ok(geo.span >= 1500, 'a tall section (about three screens)');
    const label = () => page.evaluate(() => { const d = [...document.querySelectorAll('[data-kq-assembly] div')].find((x) => x.textContent === 'Sapphire crystal' && x.style.borderRadius); return d ? d.style.opacity : null; });
    const at = async (f) => { await page.evaluate((y) => scrollTo(0, y), geo.top + geo.span * f); await page.mouse.wheel(0, 2); await page.waitForTimeout(1500); };
    await at(0.52);
    await page.locator('[data-kq-assembly] [data-kq-drawn="true"]').waitFor({ timeout: 20000 });
    // Pinned: the scene stays at the top of the window while the section scrolls.
    assert.equal(Math.round(await page.evaluate(() => document.querySelector('[data-kq-assembly] [data-kq-scene]').getBoundingClientRect().top)), 0);
    assert.equal(await label(), '1', 'the named part is labelled while apart');
    assert.equal(await page.locator('text=Hand-finished dial').count(), 1);
    await at(1);
    assert.equal(await label(), '0', 'together again at the end');
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); server.close(); }
});

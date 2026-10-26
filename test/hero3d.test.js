'use strict';
// kairoq/hero3d: premium 3D heroes (HeroObject, GlassShapes, DeviceMockup, ExplodedView, Diorama)
// with Blender-made objects in the app's own colours, and the 3D art director in the design brief.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kairoq-hero3d-'));
process.env.NODE_ENV = 'test';
process.env.KAIROQ_REACT_PROJECTS_DIR = path.join(tmp, 'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB = path.join(tmp, 'accounts.sqlite');
const builder = require('../react-builder'), design = require('../react-design'), runtime = require('../runtime-check');
const hero = require('../react-hero3d'), director = require('../design-hero3d');
const PROPS = path.join(__dirname, '../app-modules/props');
test.after(() => runtime.close());

test('the module exports every recipe, and its object library matches the files Kairoq ships', () => {
  const src = hero.source();
  for (const name of ['HeroObject', 'GlassShapes', 'DeviceMockup', 'ExplodedView', 'Diorama', 'useScrollProgress', 'useBrandColors', 'OBJECTS']) assert.match(src, new RegExp('export (function|const) ' + name + '\\b'), name);
  const inModule = {};
  for (const m of src.slice(src.indexOf('export const OBJECTS'), src.indexOf('};', src.indexOf('export const OBJECTS'))).matchAll(/'?([\w-]+)'?: '([\w-]+\.glb)'/g)) inModule[m[1]] = m[2];
  assert.deepEqual(inModule, hero.OBJECTS, 'the module and the server name the same objects');
  for (const file of new Set([...Object.values(hero.OBJECTS), ...hero.STORY])) {
    const bytes = fs.readFileSync(path.join(PROPS, file));
    assert.equal(bytes.subarray(0, 4).toString(), 'glTF', file);
    assert.ok(bytes.length < 800000, file + ' stays small (' + bytes.length + ' bytes)');
  }
  // Brand parts are named so the browser can recolour them; screens keep their own UVs.
  for (const f of ['hero-suitcase.glb', 'hero-shopping-bag.glb', 'hero-gift-box.glb']) assert.match(fs.readFileSync(path.join(PROPS, f)).toString('latin1'), /"name":"brand/, f);
  assert.match(fs.readFileSync(path.join(PROPS, 'hero-phone.glb')).toString('latin1'), /"name":"Screen"/);
  // Reduced motion and no-WebGL are handled: Scene3D gives the fallback; motion checks prefersStill.
  assert.match(src, /from 'kairoq\/scene'/);
  assert.ok((src.match(/prefersStill\(\)/g) || []).length >= 5);
});

test('an app gets only the models its code names, plus the defaults of the recipes it uses', () => {
  const app = (code) => ({ 'src/App.jsx': code });
  assert.deepEqual(hero.neededModels(app("import { HeroObject } from 'kairoq/hero3d';\n<HeroObject object=\"suitcase\" />")).sort(), ['hero-gift-box.glb', 'hero-suitcase.glb']);
  assert.deepEqual(hero.neededModels(app("import { GlassShapes } from 'kairoq/hero3d';\n<GlassShapes />")), []);
  assert.deepEqual(hero.neededModels(app("import { DeviceMockup } from 'kairoq/hero3d';\n<DeviceMockup device=\"laptop\" />")).sort(), ['hero-laptop.glb', 'hero-phone.glb']);
  assert.equal(hero.neededModels(app("import { CoffeeJourney } from 'kairoq/story';")).length, hero.STORY.length);
  assert.deepEqual(hero.neededModels(app("const suitcase = 'suitcase';")), [], 'without the module, nothing');
  assert.ok(builder.ALLOWED_PACKAGES.includes('kairoq/hero3d'));
  assert.match(builder.SYSTEM_PROMPT, /<HeroObject object="suitcase" \/>/);
  assert.match(builder.SYSTEM_PROMPT, /One 3D hero per page at most, never inside app screens/);
  const exporter = fs.readFileSync(path.join(__dirname, '../react-export.js'), 'utf8');
  assert.match(exporter, /out\['src\/kairoq-hero3d\.js'\]/);
  assert.match(exporter, /kairoq\\\\\/hero3d\$\/, replacement/);
  assert.match(exporter, /neededModels\(source\)/);
});

test('the art director suggests a fitting 3D hero, and the brief keeps only valid choices', async () => {
  assert.deepEqual(director.suggest('Corporate travel booking for Canadian companies'), { recipe: 'HeroObject', object: 'suitcase' });
  assert.deepEqual(director.suggest('Furnished apartments for business travellers'), { recipe: 'Diorama', object: 'house' });
  assert.deepEqual(director.suggest('An AI assistant for finance teams'), { recipe: 'GlassShapes' });
  assert.equal(director.suggest('A home page for my poems'), null, '"home page" is not real estate');
  assert.deepEqual(director.normalize({ recipe: 'HeroObject', object: 'unicorn', mood: 'disco' }), { recipe: 'HeroObject', object: 'gift-box', mood: 'studio' });
  assert.deepEqual(director.normalize({ recipe: 'none' }), { recipe: 'none' });
  assert.equal(director.normalize({ recipe: 'Hologram' }), null);
  assert.equal(director.jsx({ recipe: 'Diorama', objects: ['house', 'tree'], mood: 'sunset' }), "<Diorama objects={['house','tree']} mood=\"sunset\" />");

  const answer = (hero3d) => async (o, parse) => parse(JSON.stringify({ palette: { background: '#ffffff', foreground: '#111111', primary: '#0e7490' }, hero3d }));
  let seen = '';
  const b = await design.createBrief('A website for my travel agency in Toronto', { projectName: 'Atlas', callModel: async (o, parse) => { seen = o.messages[1].content; return answer({ recipe: 'HeroObject', object: 'suitcase', mood: 'sunset' })(o, parse); } });
  assert.match(seen, /Suggested for this request: HeroObject with "suitcase"/);
  assert.doesNotMatch(seen, /DeviceMockup:/, 'no device mockup without a screenshot');
  assert.deepEqual(b.hero3d, { recipe: 'HeroObject', object: 'suitcase', mood: 'sunset' });
  assert.match(design.designNote(b), /3D hero: <HeroObject object="suitcase" mood="sunset" \/> from 'kairoq\/hero3d'/);
  // No screenshot: a device mockup becomes glass shapes. App screens get no 3D at all.
  assert.equal((await design.createBrief('A landing page for my SaaS', { projectName: 'Flow', callModel: answer({ recipe: 'DeviceMockup' }) })).hero3d.recipe, 'GlassShapes');
  assert.equal((await design.createBrief('A landing page for my SaaS', { projectName: 'Flow', hasScreenshot: true, callModel: answer({ recipe: 'DeviceMockup' }) })).hero3d.recipe, 'DeviceMockup');
  assert.equal((await design.createBrief('An admin dashboard for our bookings', { projectName: 'Ops', callModel: answer({ recipe: 'GlassShapes' }) })).hero3d, undefined);
});

test('every recipe builds and draws in a browser, on desktop and on a phone', { timeout: 240000 }, async (t) => {
  const meta = builder.create({ name: 'Showcase', owner: 'owner' });
  await builder.initializeFrom(meta, { ...design.starterFiles('Showcase'), 'src/App.jsx': fs.readFileSync(path.join(__dirname, 'fixtures', 'hero3d-showcase.jsx'), 'utf8') }, 'Showcase');
  const dist = path.join(builder.versionDir(meta.id, 1), 'dist', 'props');
  assert.deepEqual(fs.readdirSync(dist).sort(), ['hero-gift-box.glb', 'hero-house.glb', 'hero-phone.glb', 'hero-suitcase.glb']);
  if (!runtime.available()) { t.diagnostic('no browser here: only the build was checked'); return; }
  const server = http.createServer((req, res) => { if (!builder.handlePreview(req, res)) { res.writeHead(404); res.end(); } });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = 'http://127.0.0.1:' + server.address().port + builder.previewUrl(builder.loadMeta(meta.id));
  try {
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      const ctx = await (await runtime.browser()).newContext({ viewport }), page = await ctx.newPage(), errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(url, { waitUntil: 'networkidle' });
      const sections = page.locator('section[data-recipe]');
      assert.equal(await sections.count(), 5);
      for (let i = 0; i < 5; i++) {
        await sections.nth(i).scrollIntoViewIfNeeded();
        await sections.nth(i).locator('[data-kq-drawn="true"]').waitFor({ timeout: 20000 });
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'no sideways scroll');
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  } finally { server.close(); }
});

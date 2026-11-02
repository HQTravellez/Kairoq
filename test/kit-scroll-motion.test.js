'use strict';
// GSAP-style scroll motion in the kit without GSAP: ParallaxImage / Parallax and PinnedScroll on
// framer-motion, and GSAP's craft rules (eases, durations, stagger, transform-only, scrub, reduced
// motion) in the design rules. A sample page is built with the real build and scrolled in a browser.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kairoq-scroll-'));
process.env.NODE_ENV = 'test';
process.env.KAIROQ_REACT_PROJECTS_DIR = path.join(tmp, 'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB = path.join(tmp, 'accounts.sqlite');
const builder = require('../react-builder'), design = require('../react-design'), runtime = require('../runtime-check'), docs = require('../ui-kit-docs');
const PIECES = ['parallax', 'pinned-scroll'].map((n) => 'src/components/ui/' + n + '.jsx');
const shot = process.env.KAIROQ_KIT_SHOTS;
test.after(() => runtime.close());

test('every project gets the scroll pieces, documented, with GSAP craft rules', () => {
  const files = design.starterFiles('Test');
  for (const f of PIECES) {
    assert.ok(files[f], f);
    assert.ok(design.KIT_API[f], 'KIT_API ' + f);
    assert.ok(docs.DOCS[f] && docs.DOCS[f].avoid, 'docs ' + f);
    assert.match(files[f], /useReducedMotion/, 'reduced motion in ' + f);
    assert.doesNotMatch(files[f], /from ['"]gsap|zinc-|@\/lib/, 'no gsap and theme colours in ' + f);
  }
  assert.match(design.RULES, /power3\.out/);
  assert.match(design.RULES, /Animate only transform and opacity/);
  assert.match(design.RULES, /PinnedScroll for a 3 to 5 step story/);
});

test('a page with a parallax band and a pinned story builds and moves with the scroll', { timeout: 240000 }, async (t) => {
  const meta0 = builder.create({ name: 'Northwind', owner: 'owner' });
  await builder.initializeFrom(meta0, { ...design.starterFiles('Northwind'), 'src/App.jsx': fs.readFileSync(path.join(__dirname, 'fixtures', 'scroll-motion-app.jsx'), 'utf8') }, 'Sample');
  const meta = builder.loadMeta(meta0.id);
  if (!runtime.available()) { t.diagnostic('no browser here: only the build was checked'); return; }
  const server = http.createServer((req, res) => { if (!builder.handlePreview(req, res)) { res.writeHead(404); res.end(); } });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port + builder.previewUrl(meta);
  const browser = await runtime.browser(), errors = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }), page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForSelector('h1');
    // Parallax: the photo's offset changes as the band scrolls through the screen.
    const imgY = () => page.evaluate(() => { const img = document.querySelector('img[alt="Beans cooling after the roast"]'); return img.getBoundingClientRect().top - img.parentElement.getBoundingClientRect().top; });
    await page.evaluate(() => window.scrollTo(0, 200)); await page.waitForTimeout(300);
    const a = await imgY();
    await page.evaluate(() => window.scrollTo(0, 900)); await page.waitForTimeout(300);
    const b = await imgY();
    assert.ok(Math.abs(b - a) > 20, 'photo drifts inside the band: ' + a + ' → ' + b);
    if (shot) await page.screenshot({ path: path.join(shot, 'scroll-parallax.png') });
    // PinnedScroll: the section stays on screen and the second panel slides in, then the third.
    const sec = await page.evaluate(() => { const s = document.querySelector('section[aria-label="Our three roasts"]'); return { top: s.getBoundingClientRect().top + scrollY, h: s.offsetHeight }; });
    assert.ok(sec.h >= 800 * 3 - 5, 'three screens of scroll for three panels');
    const panelX = (i) => page.evaluate((i) => document.querySelector('[data-panel="' + i + '"]').getBoundingClientRect().left, i);
    await page.evaluate((y) => window.scrollTo(0, y), sec.top); await page.waitForTimeout(300);
    assert.ok(Math.abs(await panelX(0)) < 5, 'first panel on screen at the start');
    await page.evaluate((y) => window.scrollTo(0, y), sec.top + (sec.h - 800) / 2); await page.waitForTimeout(400);
    assert.ok(Math.abs(await panelX(1)) < 40, 'second panel on screen halfway: ' + await panelX(1));
    if (shot) await page.screenshot({ path: path.join(shot, 'scroll-pinned.png') });
    await page.evaluate((y) => window.scrollTo(0, y), sec.top + sec.h - 800); await page.waitForTimeout(400);
    assert.ok(Math.abs(await panelX(2)) < 5, 'third panel on screen at the end');
    await ctx.close();
    // Phones and reduced motion: the panels stack and all are readable.
    for (const opts of [{ viewport: { width: 390, height: 800 } }, { viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' }]) {
      const c = await browser.newContext(opts), p = await c.newPage();
      await p.goto(base, { waitUntil: 'networkidle' });
      await p.waitForSelector('h1');
      assert.equal(await p.locator('[data-panel]').count(), 0, 'no pinned track');
      for (const name of ['Aurora Light', 'Equinox Medium', 'Solstice Dark']) assert.ok(await p.getByText(name).isVisible(), name);
      await c.close();
    }
    assert.deepEqual(errors, []);
  } finally { server.close(); }
});

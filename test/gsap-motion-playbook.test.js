'use strict';
// The GSAP motion playbook: the agent gets it for animation requests, and its recipes (hero
// timeline with split letters, pinned horizontal story, count-up, drawn line, motion path, morph,
// drag and throw) build with the real Kairoq build and work in a browser.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kairoq-gsap-'));
process.env.NODE_ENV = 'test';
process.env.KAIROQ_REACT_PROJECTS_DIR = path.join(tmp, 'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB = path.join(tmp, 'accounts.sqlite');
const builder = require('../react-builder'), design = require('../react-design'), runtime = require('../runtime-check'), P = require('../builder-playbooks');
const shot = process.env.KAIROQ_KIT_SHOTS;
test.after(() => runtime.close());

test('animation requests get the GSAP motion playbook; plain requests do not', () => {
  for (const r of ['An animated landing page for a coffee roaster', 'a launch page with a pinned scroll story and parallax', 'headline that splits into letters', 'use GSAP'])
    assert.ok(P.pick(r).some((b) => b.id === 'gsap-motion'), r);
  for (const r of ['a booking page for a yoga studio', 'a CRM for a small agency']) assert.equal(P.pick(r).some((b) => b.id === 'gsap-motion'), false, r);
  const text = P.BOOKS.find((b) => b.id === 'gsap-motion').text;
  for (const k of ['SplitText.create', 'pin: true', 'drawSVG: 0', 'motionPath', 'morphSVG', 'Draggable.create', 'gsap.matchMedia', 'prefers-reduced-motion']) assert.ok(text.includes(k), k);
  const src = fs.readFileSync(path.join(__dirname, '..', 'react-agent.js'), 'utf8');
  assert.match(src, /require\('\.\/builder-playbooks'\)\.note\(text\)/, 'the agent gets the playbooks too');
});

test('the playbook recipes build and run in a browser', { timeout: 240000 }, async (t) => {
  const meta0 = builder.create({ name: 'Halo', owner: 'owner' });
  await builder.initializeFrom(meta0, { ...design.starterFiles('Halo'), 'src/App.jsx': fs.readFileSync(path.join(__dirname, 'fixtures', 'gsap-motion-app.jsx'), 'utf8') }, 'Sample');
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
    await page.waitForSelector('#title');
    await page.waitForTimeout(1500);
    // Split letters, all back in place after the hero timeline.
    const chars = await page.evaluate(() => [...document.querySelectorAll('#title div, #title span')].filter((e) => e.textContent.length === 1).length);
    assert.ok(chars >= 15, 'headline split into letters: ' + chars);
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#title')).opacity), '1');
    // Pinned story: the section stays at the top while the track moves.
    const pinTop = await page.evaluate(() => document.querySelector('#pin').getBoundingClientRect().top + scrollY);
    await page.evaluate((y) => scrollTo(0, y + 800), pinTop); await page.waitForTimeout(500);
    const mid = await page.evaluate(() => ({ top: document.querySelector('#pin').getBoundingClientRect().top, x: document.querySelector('[data-panel="1"]').getBoundingClientRect().left }));
    assert.ok(Math.abs(mid.top) < 2, 'section pinned at the top: ' + mid.top);
    assert.ok(Math.abs(mid.x) < 60, 'second panel on screen halfway: ' + mid.x);
    // Count-up reaches the real number.
    await page.evaluate(() => document.querySelector('#hours').scrollIntoView({ block: 'center' })); await page.waitForTimeout(1200);
    assert.equal(await page.textContent('#hours'), '40');
    // Drawn line and motion path follow the scroll.
    await page.evaluate(() => document.querySelector('#route-box').scrollIntoView({ block: 'center' })); await page.waitForTimeout(500);
    assert.match(await page.evaluate(() => document.querySelector('#rider').getAttribute('transform') || document.querySelector('#rider').style.transform), /matrix|translate/, 'rider moved along the route');
    // Morph on a state change.
    const before = await page.getAttribute('#morph', 'd');
    await page.click('button:has-text("Focus")'); await page.waitForTimeout(600);
    assert.notEqual(await page.getAttribute('#morph', 'd'), before, 'icon reshaped');
    // Drag and throw stays inside its box.
    const sw = await page.locator('#swatch').boundingBox(), zone = await page.locator('#zone').boundingBox();
    await page.mouse.move(sw.x + 40, sw.y + 40); await page.mouse.down(); await page.mouse.move(sw.x + 400, sw.y + 120, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(800);
    const after = await page.locator('#swatch').boundingBox();
    assert.ok(after.x > sw.x + 100, 'dragged');
    assert.ok(after.x + after.width <= zone.x + zone.width + 1, 'stayed in its box');
    if (shot) await page.screenshot({ path: path.join(shot, 'gsap-playbook.png') });
    await ctx.close();
    // Reduced motion: nothing is split or hidden.
    const c2 = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' }), p2 = await c2.newPage();
    await p2.goto(base, { waitUntil: 'networkidle' });
    assert.equal(await p2.textContent('#title'), 'Hear less. Feel more.');
    assert.equal(await p2.textContent('#hours'), '40');
    await c2.close();
    assert.deepEqual(errors, []);
  } finally { server.close(); }
});

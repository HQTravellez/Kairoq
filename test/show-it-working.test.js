'use strict';
// "Show it working": the kit pieces that show a product working (TypedInput, ProductTour,
// ScrollLitText, Chapters), the signature that makes it the default for software, and the fixes
// that came with it (BackgroundPaths strength, TextLoop without an empty line, the faded-headline
// giveaway). A sample software page is built with the real build and checked in a browser.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kairoq-show-'));
process.env.NODE_ENV = 'test';
process.env.KAIROQ_REACT_PROJECTS_DIR = path.join(tmp, 'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB = path.join(tmp, 'accounts.sqlite');
const builder = require('../react-builder'), design = require('../react-design'), runtime = require('../runtime-check');
const recipes = require('../design-recipes'), docs = require('../ui-kit-docs'), craft = require('../craft-check');
const PIECES = ['typed-input', 'product-tour', 'scroll-lit-text', 'chapters'].map((n) => 'src/components/ui/' + n + '.jsx');
const shot = process.env.KAIROQ_KIT_SHOTS;
test.after(() => runtime.close());

test('every project gets the pieces, and the builder knows how and when to use them', () => {
  const files = design.starterFiles('Test');
  for (const f of PIECES) {
    assert.ok(files[f], f);
    assert.ok(design.KIT_API[f], 'KIT_API ' + f);
    assert.ok(docs.DOCS[f] && docs.DOCS[f].avoid, 'docs ' + f);
    if (!f.includes('chapters')) assert.match(files[f], /reduced motion|prefers-reduced-motion|useReducedMotion/, 'reduced motion in ' + f);
    assert.doesNotMatch(files[f], /zinc-|#a1a1aa|@\/lib/, 'theme colours in ' + f);
  }
  assert.match(design.RULES, /ProductTour of its own screens .* instead of a grid of feature cards/);
  assert.match(design.RULES, /Never put opacity on a wrapper around the headline/);
});

test('software is shown working by default; other businesses keep their signatures', () => {
  for (const r of ['A SaaS for expense reports', 'corporate travel booking platform', 'CRM for small agencies', 'an AI assistant for lawyers'])
    assert.equal(recipes.signature(r), 'show-it-working', r);
  for (const r of ['website for my café', 'a florist in Leeds', 'renovation company'])
    assert.notEqual(recipes.signature(r), 'show-it-working', r);
  const without = { 'src/App.jsx': "import { Card } from './components/ui/card.jsx';" };
  assert.match(recipes.signatureMissing('show-it-working', without), /Show it working/);
  assert.equal(recipes.signatureMissing('show-it-working', { 'src/App.jsx': "import { ProductTour } from './components/ui/product-tour.jsx';" }), null);
});

test('the fixes: quieter lines without fading the hero, a TextLoop with no empty line', () => {
  const files = design.starterFiles('Test');
  const bg = files['src/components/ui/background-paths.jsx'], loop = files['src/components/ui/text-loop.jsx'];
  assert.match(bg, /strength = 1/);
  assert.match(bg, /never put opacity on BackgroundPaths/);
  assert.match(design.KIT_API['src/components/ui/background-paths.jsx'], /strength/);
  assert.match(loop, /inline-grid/);
  assert.doesNotMatch(loop, /mode = "popLayout"/);
  assert.ok(craft.TELLS.has('faded-headline'));
});

test('a software page made of the pieces builds and works in a browser', { timeout: 240000 }, async (t) => {
  const meta0 = builder.create({ name: 'Travellez', owner: 'owner' });
  await builder.initializeFrom(meta0, { ...design.starterFiles('Travellez'), 'src/App.jsx': fs.readFileSync(path.join(__dirname, 'fixtures', 'show-it-working-app.jsx'), 'utf8') }, 'Sample');
  const meta = builder.loadMeta(meta0.id);
  if (!runtime.available()) { t.diagnostic('no browser here: only the build was checked'); return; }
  const server = http.createServer((req, res) => { if (!builder.handlePreview(req, res)) { res.writeHead(404); res.end(); } });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port + builder.previewUrl(meta);
  const ctx = await (await runtime.browser()).newContext({ viewport: { width: 1280, height: 900 } }), page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForSelector('h1');
    // TextLoop: the headline keeps one line height per line of text (no empty line), and only one word shows.
    const loop = await page.evaluate(() => { const h = document.querySelector('h1'), lh = parseFloat(getComputedStyle(h).lineHeight); const g = h.querySelector('.inline-grid'); return { lines: Math.round(h.getBoundingClientRect().height / lh), loopH: g.getBoundingClientRect().height, lh, shown: [...g.children].filter((c) => parseFloat(getComputedStyle(c).opacity) > 0.5).length }; });
    assert.ok(loop.lines <= 2, 'headline lines ' + loop.lines);
    assert.ok(loop.loopH <= loop.lh * 1.1, 'loop is one line high');
    // TypedInput: example typed into the placeholder, and the real input works.
    await page.waitForFunction(() => (document.querySelector('#typed-input').placeholder || '').length > 3);
    await page.fill('#typed-input', 'Madrid next week');
    await page.click('button:has-text("Search trips")');
    await page.getByTestId('searched').getByText('Searching: Madrid next week').waitFor();
    // ProductTour: plays in view, steps advance, a click on a step jumps there and pauses.
    await page.locator('section[aria-label="How it works"]').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('[aria-current="step"]')?.textContent.includes('approval'), null, { timeout: 8000 });
    await page.click('button:has-text("Spending is reported for you")');
    await page.waitForTimeout(1800);
    assert.match(await page.locator('[aria-current="step"]').textContent(), /Spending/);
    assert.ok(await page.locator('button:has-text("Play")').count(), 'paused after a step is chosen');
    if (shot) await page.screenshot({ path: path.join(shot, 'show-it-working.png'), fullPage: true });
    // The craft check: no giveaways from these pieces (chapter words are not labels), no faded headline.
    const clean = await require('../design-tells').tells(page);
    assert.deepEqual(clean.issues.filter((i) => ['eyebrow', 'faded-headline', 'dots', 'arrows', 'card-grids', 'icon-cards'].includes(i.kind)).map((i) => i.kind), []);
    // A faded hero (opacity on the backdrop wrapper) is caught.
    await page.goto(base + (base.includes('?') ? '&' : '?') + 'faded=1', { waitUntil: 'networkidle' });
    await page.waitForSelector('h1');
    const faded = await require('../design-tells').tells(page);
    assert.ok(faded.issues.some((i) => i.kind === 'faded-headline'), 'faded headline found');
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); server.close(); }
});

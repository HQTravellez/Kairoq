'use strict';
// UI kit blocks for apps and landing pages: DataTable (TanStack Table), Kanban (dnd-kit),
// CommandMenu, StatCard and the motion pieces (from Magic UI, MIT). Two sample apps are built with
// the real build and checked in a browser.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kairoq-kit-'));
process.env.NODE_ENV = 'test';
process.env.KAIROQ_REACT_PROJECTS_DIR = path.join(tmp, 'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB = path.join(tmp, 'accounts.sqlite');
const builder = require('../react-builder'), design = require('../react-design'), runtime = require('../runtime-check');

const NEW = ['data-table', 'kanban', 'command-menu', 'stat-card', 'motion'].map((n) => 'src/components/ui/' + n + '.jsx');
const shot = process.env.KAIROQ_KIT_SHOTS; // a folder: save screenshots there to look at them
test.after(() => runtime.close());

test('every new project gets the blocks, and the builder knows how and when to use them', () => {
  const files = design.starterFiles('Test');
  for (const f of NEW) {
    assert.ok(files[f], f);
    assert.ok(design.KIT_API[f], 'KIT_API ' + f);
    assert.equal(design.isKitFile(f, files[f]), true);
  }
  for (const p of ['@tanstack/react-table', '@dnd-kit/core']) {
    assert.ok(builder.ALLOWED_PACKAGES.includes(p), p);
    assert.ok(require('../package.json').dependencies[p], p + ' installed');
  }
  assert.match(require('../package.json').dependencies['@tanstack/react-table'], /^8\./, 'TanStack Table 8, the API models know');
  assert.match(design.RULES, /any list of records .* is a DataTable/);
  assert.match(design.RULES, /never a NumberTicker for an invented number/);
  for (const k of ['marquee', 'marquee-vertical', 'shimmer-slide']) assert.ok(design.THEME.extend.keyframes[k] && design.THEME.extend.animation[k], k);
  // Credits stay in the files people download.
  assert.match(files['src/components/ui/motion.jsx'], /Magic UI \(magicui\.design, MIT\)/);
  assert.match(files['src/components/ui/kanban.jsx'], /next-shadcn-dashboard-starter by Kiranism \(MIT\)/);
});

test('with an art direction, the direction sets the layout and the playbook adds the rest', () => {
  const brief = { palette: { background: '#ffffff', foreground: '#111111', primary: '#b91c1c' }, playbook: 'Restaurant/Food Service' };
  assert.match(design.designNote(brief), /Section order/);
  const directed = design.designNote({ ...brief, direction: 'any' });
  assert.doesNotMatch(directed, /Section order|- Style:/);
  assert.match(directed, /Main button: [\s\S]*What visitors look for/);
});

async function buildApp(name, app) {
  const meta = builder.create({ name, owner: 'owner' });
  await builder.initializeFrom(meta, { ...design.starterFiles(name), 'src/App.jsx': fs.readFileSync(path.join(__dirname, 'fixtures', app), 'utf8') }, 'Sample');
  return builder.loadMeta(meta.id);
}

test('a CRM made of the blocks builds, and its table, pipeline and command menu work', { timeout: 240000 }, async (t) => {
  const meta = await buildApp('Pipeline', 'kit-crm-app.jsx');
  if (!runtime.available()) { t.diagnostic('no browser here: only the build was checked'); return; }
  const server = http.createServer((req, res) => { if (!builder.handlePreview(req, res)) { res.writeHead(404); res.end(); } });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const ctx = await (await runtime.browser()).newContext({ viewport: { width: 1280, height: 900 } }), page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.goto('http://127.0.0.1:' + server.address().port + builder.previewUrl(meta), { waitUntil: 'networkidle' });
    await page.waitForSelector('text=Open pipeline');
    if (shot) await page.screenshot({ path: path.join(shot, 'kit-crm.png'), fullPage: true });
    // Table: search, sort, filter by status, pages.
    const rows = () => page.locator('table tbody tr');
    assert.equal(await rows().count(), 4, 'page size 4');
    await page.getByText('Page 1 of 2').waitFor();
    await page.fill('input[placeholder="Search customers"]', 'toronto');
    assert.equal(await rows().count(), 2);
    await page.fill('input[placeholder="Search customers"]', '');
    // Numbers sort largest first on the first click, smallest first on the second.
    await page.click('th button:has-text("Seats")');
    assert.equal(await rows().first().locator('td').first().textContent(), 'Northwind Logistics');
    await page.click('th button:has-text("Seats")');
    assert.equal(await rows().first().locator('td').first().textContent(), 'Maple Dental Group');
    await page.click('[aria-label="Filter by Status"]');
    await page.getByRole('option', { name: 'Trial (2)' }).click();
    // Wait until the dropdown has closed and handed focus back, as a person would.
    await page.waitForSelector('[role="listbox"]', { state: 'detached' });
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Filter by Status');
    assert.equal(await rows().count(), 2);
    // Pipeline: move a card with the keyboard (Space, arrow right, Space).
    const lead = page.locator('[aria-label="Lead"]'), demo = page.locator('[aria-label="Demo booked"]');
    assert.equal(await demo.getByText('Northwind Logistics').count(), 0);
    await lead.getByRole('button', { name: /Northwind Logistics/ }).focus();
    await page.keyboard.press('Space');
    await page.waitForTimeout(250);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(250);
    await page.keyboard.press('Space');
    await page.waitForTimeout(400);
    assert.equal(await demo.getByText('Northwind Logistics').count(), 1, 'one arrow press moves one column');
    assert.equal(await lead.getByText('Northwind Logistics').count(), 0, 'the card left Lead');
    // Command menu: type, Enter runs the action.
    if (shot) await page.screenshot({ path: path.join(shot, 'kit-crm-moved.png') });
    await page.click('text=Search ⌘K');
    await page.fill('input[role="combobox"]', 'new');
    assert.equal(await page.locator('[role="option"]').count(), 1);
    await page.keyboard.press('Enter');
    await page.waitForSelector('input[role="combobox"]', { state: 'detached' });
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); server.close(); }
});

test('a landing page with the motion pieces builds and draws them', { timeout: 240000 }, async (t) => {
  const meta = await buildApp('Landing', 'kit-landing-app.jsx');
  if (!runtime.available()) { t.diagnostic('no browser here: only the build was checked'); return; }
  const server = http.createServer((req, res) => { if (!builder.handlePreview(req, res)) { res.writeHead(404); res.end(); } });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const browser = await runtime.browser(), errors = [];
  try {
    const url = 'http://127.0.0.1:' + server.address().port + builder.previewUrl(meta);
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }), page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.getByText('Lena · Finance').waitFor({ timeout: 5000 });
    await page.locator('[data-testid="ticker"]').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('[data-testid="ticker"]').textContent === '1,240', null, { timeout: 8000 });
    const animation = await page.locator('[data-testid="marquee"] > div').first().evaluate((el) => getComputedStyle(el).animationName);
    assert.equal(animation, 'marquee');
    if (shot) await page.screenshot({ path: path.join(shot, 'kit-landing.png'), fullPage: true });
    await ctx.close();
    // Reduced motion: everything is shown at once and nothing scrolls.
    const still = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' }), p2 = await still.newPage();
    p2.on('pageerror', (e) => errors.push(e.message));
    await p2.goto(url, { waitUntil: 'networkidle' });
    assert.equal(await p2.locator('[data-testid="marquee"] > div').count(), 1, 'one copy, no animation');
    assert.equal(await p2.locator('[data-testid="ticker"]').textContent(), '1,240');
    assert.equal(await p2.getByText('Lena · Finance').count(), 1);
    assert.equal(await p2.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'no sideways scroll on a phone');
    if (shot) await p2.screenshot({ path: path.join(shot, 'kit-landing-phone.png'), fullPage: true });
    await still.close();
    assert.deepEqual(errors, []);
  } finally { server.close(); }
});

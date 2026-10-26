'use strict';
// The preview switches to a new version as soon as it builds and opens, while the slower checks
// (new checks, feature journeys, the screenshot review) still run; it swaps without a white flash
// and stays on the page the owner was looking at.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kairoq-instant-'));
process.env.NODE_ENV = 'test';
process.env.KAIROQ_DESIGN_BRIEF = 'off';
process.env.KAIROQ_REACT_PROJECTS_DIR = path.join(tmp, 'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB = path.join(tmp, 'accounts.sqlite');
const builder = require('../react-builder'), runtime = require('../runtime-check');
const ui = fs.readFileSync(path.join(__dirname, '../public/create.js'), 'utf8');
const api = fs.readFileSync(path.join(__dirname, '../create-api.js'), 'utf8');

const APP = 'export default function App(){return <main><h1>Contacts</h1><button>Add contact</button></main>}\n';
const reply = (obj) => (_o, parse) => Promise.resolve(parse(JSON.stringify(obj)));
const check = { name: 'Add a contact', steps: [{ action: 'click', text: 'Add contact' }, { action: 'expect', text: 'Contacts' }] };
test.after(() => runtime.close());

test('a new version is shown before the slower checks run, and the timeline says how long the build took', async () => {
  const meta = builder.create({ name: 'Crm', owner: 'owner' });
  await builder.initialize(meta);
  const order = [];
  let shown = null;
  const progress = [];
  const r = await builder.edit(meta.id, 'contacts', {
    callModel: reply({ message: 'Added contacts', files: { 'src/App.jsx': APP }, checks: [check] }),
    // The only browser run here is the check the AI sent, which runs after the version is saved.
    inspect: async (url, { steps }) => { order.push('check'); return { skipped: false, errors: [], steps: steps.map((s) => ({ step: JSON.stringify(s), ok: true })) }; },
    onVersion: (v) => { order.push('shown'); shown = v; },
    onProgress: (s) => progress.push(s),
  });
  assert.deepEqual(order, ['shown', 'check'], 'the preview switches before the new checks run');
  assert.equal(shown.version, r.version);
  assert.equal(shown.preview_url, builder.previewUrl(builder.loadMeta(meta.id), r.version));
  assert.deepEqual(shown.changed, ['src/App.jsx']);
  assert.ok(progress.includes('verifying'));
  const built = r.timeline.find((e) => e.t === 'build' && e.ok);
  assert.equal(typeof built.ms, 'number');
});

test('a reply that changes nothing, or a build that never works, shows no new version', async () => {
  const meta = builder.create({ name: 'Crm2', owner: 'owner' });
  await builder.initialize(meta);
  await builder.edit(meta.id, 'contacts', { callModel: reply({ message: 'v', files: { 'src/App.jsx': APP } }) });
  let calls = 0;
  await builder.edit(meta.id, 'same again', { callModel: reply({ message: 'Nothing to change', files: { 'src/App.jsx': APP } }), onVersion: () => calls++ });
  await assert.rejects(builder.edit(meta.id, 'break it', { callModel: reply({ message: 'v', files: { 'src/App.jsx': 'export default function App(){return <main>' } }), onVersion: () => calls++ }));
  assert.equal(calls, 0);
});

test('every build job passes the new version to the editor, and the editor swaps it in', () => {
  assert.match(api, /const onVersion=v=>update\(\{preview:\{version:v\.version,url:v\.preview_url/);
  for (const call of ['builder.edit(id,message,{onVersion', "builder.edit(id,require('./look-check').fixMessage(message,seen.problems),{onVersion", 'builder.polish(id,{shots:designShots,callModel,onVersion']) assert.ok(api.includes(call), call);
  assert.match(ui, /if\(j\.preview&&j\.preview\.url&&j\.mode!=='discuss'\)swapPreview\(j\.preview\.url\)/);
  assert.match(ui, /if\(project\.preview_url!==state\.previewBase\)swapPreview\(project\.preview_url\)/);
  const css = fs.readFileSync(path.join(__dirname, '../public/create.css'), 'utf8');
  assert.match(css, /\.device\.desktop>:not\(#frame\):not\(#frame-next\)\{display:none\}/);
  const reporter = fs.readFileSync(path.join(__dirname, '../builder-runtime/kairoq-reporter.js'), 'utf8');
  assert.match(reporter, /send\('route',\{path:location\.pathname\+location\.search\+location\.hash\}\)/);
});

// The editor's own swap code, run in a browser against two versions of a small site.
function editorCode() {
  const pick = (start, end) => { const a = ui.indexOf(start), b = ui.indexOf(end, a); assert.ok(a >= 0 && b > a, start); return ui.slice(a, b); };
  return pick('function routeFor(url)', '// The preview reports "ready"');
}

test('in a browser, the new version loads behind the old one and opens on the same page', { timeout: 60000 }, async (t) => {
  if (!runtime.available()) { t.diagnostic('no browser here'); return; }
  const page = (v, slow) => '<!doctype html><title>v' + v + '</title><body style="margin:0;background:#fff"><h1 id="v">Version ' + v + '</h1><p id="path"></p><script>document.getElementById("path").textContent=location.pathname</script>' + (slow ? '<img src="/slow">' : '') + '</body>';
  const server = http.createServer((req, res) => {
    if (req.url === '/slow') { setTimeout(() => { res.writeHead(204); res.end(); }, 1200); return; }
    if (req.url === '/editor') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<!doctype html><body><div class="canvas" style="position:relative;width:800px;height:500px"><div class="device desktop" id="device"><iframe id="frame" title="App preview" sandbox="allow-scripts" style="width:100%;height:100%;border:0"></iframe></div></div><a id="open"></a><a id="preview-open"></a><div id="preview-notice"></div><script>const $=(id)=>document.getElementById(id);const state={};const renderErrors=()=>{},renderVisual=()=>{};' + editorCode() + '</script></body>');
      return;
    }
    const m = /^\/builder\/p\/x\/v\/(\d+)\/(.*)$/.exec(req.url);
    if (!m) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(page(m[1], m[1] === '2'));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const ctx = await (await runtime.browser()).newContext(), p = await ctx.newPage();
  try {
    await p.goto(base + '/editor');
    // The owner is on the Menu page of version 1.
    await p.evaluate((u) => { document.getElementById('frame').src = u + 'menu'; state.previewBase = u; state.previewRoute = 'menu'; }, base + '/builder/p/x/v/1/');
    await p.waitForFunction(() => document.getElementById('frame').contentWindow.length === 0 && document.querySelectorAll('iframe').length === 1);
    await p.waitForTimeout(300);
    await p.evaluate((u) => swapPreview(u), base + '/builder/p/x/v/2/');
    // While version 2 loads (its image is slow), version 1 stays on screen and the new one is invisible.
    await p.waitForTimeout(400);
    const during = await p.evaluate(() => ({ frames: document.querySelectorAll('iframe').length, next: getComputedStyle(document.getElementById('frame-next')).opacity, current: document.getElementById('frame').src }));
    assert.equal(during.frames, 2);
    assert.equal(during.next, '0');
    assert.match(during.current, /\/v\/1\/menu$/);
    // Then it swaps: one frame, version 2, the same page.
    await p.waitForFunction(() => document.querySelectorAll('iframe').length === 1 && /\/v\/2\//.test(document.getElementById('frame').src), null, { timeout: 10000 });
    const after = await p.evaluate(() => ({ src: document.getElementById('frame').src, style: document.getElementById('frame').getAttribute('style'), open: document.getElementById('open').getAttribute('href') }));
    assert.match(after.src, /\/v\/2\/menu$/);
    assert.ok(!after.style, 'the temporary positioning is gone');
    assert.match(after.open, /\/v\/2\/$/);
    // The same version again does nothing.
    await p.evaluate((u) => swapPreview(u), base + '/builder/p/x/v/2/');
    assert.equal(await p.evaluate(() => document.querySelectorAll('iframe').length), 1);
  } finally { await ctx.close(); server.close(); }
});

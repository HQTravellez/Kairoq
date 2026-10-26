'use strict';
// Page playbooks by kind of business (design-presets.json, from ui-ux-pro-max-skill, MIT): the
// design brief picks one, the builder follows it on every change, and the screenshot check looks
// for that business's "avoid" list.
const test = require('node:test'), assert = require('node:assert/strict');
const presets = require('../design-presets'), design = require('../react-design'), look = require('../look-check');

test('every playbook is complete and every font it suggests can load', () => {
  const d = presets.data;
  assert.ok(d.playbooks.length >= 180, 'playbooks: ' + d.playbooks.length);
  assert.ok(d.palettes.length >= 180 && d.fonts.length >= 70);
  for (const p of d.playbooks) {
    assert.ok(p.type && p.pattern && p.style, p.type);
    assert.ok(Array.isArray(p.avoid), p.type);
    if (!/^N\/A/i.test(p.pattern)) assert.ok(p.sections, p.type + ' has a section order');
  }
  for (const p of d.palettes) for (const v of Object.values(p.palette)) assert.match(v, /^#[0-9a-f]{6}$/, p.type);
  for (const f of d.fonts) assert.ok(design.FONTS[f.display] && design.FONTS[f.body], f.name);
  // Weights are real (a wrong one breaks the font request), and Kairoq's own list wins.
  for (const [name, [kind, w]] of Object.entries(design.FONTS)) { assert.match(kind, /^(sans|serif|display|mono)$/, name); assert.match(w, /^\d{3}(;\d{3})*$/, name); }
  assert.equal(design.FONTS['Playfair Display'][1], '400;500;600;700');
});

test('the request is matched to the right kind of business, by its distinctive words', () => {
  const cases = {
    'website for our pizzeria in Toronto': 'Restaurant/Food Service',
    'coffee shop with online ordering': 'Bakery/Cafe',
    'invoice tool for freelancers': 'Invoice & Billing Tool',
    'a hair salon': 'Beauty/Spa/Wellness Service',
    'a law firm website': 'Legal Services',
    'hotel website': 'Hotel/Hospitality',
    'a todo list': 'Productivity Tool',
    'a landing page for my saas': 'SaaS (General)',
  };
  for (const [request, type] of Object.entries(cases)) assert.equal(presets.playbook(request)?.type, type, request);
  assert.equal(presets.playbook('xyzzy plugh'), null);
});

test('the brief keeps the playbook, and every later change sees it', async () => {
  const reply = (extra) => async (o, parse) => parse(JSON.stringify({ palette: { background: '#ffffff', foreground: '#111111', primary: '#b91c1c' }, fonts: { display: 'Fraunces', body: 'Inter' }, ...extra }));
  const offered = await design.createBrief('website for our pizzeria', { projectName: 'Nonna', callModel: async (o, parse) => {
    assert.match(o.messages[1].content, /Page playbook for a Restaurant\/Food Service/);
    assert.match(o.messages[0].content, /"playbook"/);
    return reply({})(o, parse);
  } });
  assert.equal(offered.playbook, 'Restaurant/Food Service');
  // The model can turn it down; it cannot pick a business that was not offered.
  assert.equal((await design.createBrief('website for our pizzeria', { projectName: 'Nonna', callModel: reply({ playbook: '' }) })).playbook, undefined);
  assert.equal((await design.createBrief('website for our pizzeria', { projectName: 'Nonna', callModel: reply({ playbook: 'Dental Practice' }) })).playbook, 'Restaurant/Food Service');
  const note = design.designNote(offered);
  assert.match(note, /Section order: Full-bleed Hero/);
  assert.match(note, /Avoid: /);
  assert.match(note, /build features \(ordering, booking, sign-in\) only when the owner asked/);
  assert.match(note, /testimonials, ratings and counts appear only if the owner gives real ones/);
  // An old brief without a playbook reads as before.
  assert.doesNotMatch(design.designNote({ ...offered, playbook: undefined }), /Page playbook/);
});

test('the screenshot check also looks for the business\'s "avoid" list', () => {
  assert.match(look.prompt('make the hero bigger', ['Low-quality imagery', 'Outdated hours']), /something to avoid for this kind of business: Low-quality imagery; Outdated hours/);
  assert.doesNotMatch(look.prompt('make the hero bigger'), /to avoid/);
  const api = require('fs').readFileSync(require('path').join(__dirname, '../create-api.js'), 'utf8');
  assert.match(api, /reviewLook\(\{request:message,pictures,signal,avoid:/);
});

test('the data is rebuilt by a script and credited', () => {
  const fs = require('fs'), path = require('path');
  const { readCsv, weightsFromUrl } = require('../scripts/design-data/import-pro-max.js');
  assert.deepEqual(weightsFromUrl('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;700&family=Playfair+Display:wght@400;600&display=swap'), { Inter: '300;400;700', 'Playfair Display': '400;600' });
  const tmp = path.join(require('os').tmpdir(), 'kq-csv-' + process.pid + '.csv');
  fs.writeFileSync(tmp, 'A,B\n1,"x, ""y""\nz"\n');
  assert.deepEqual(readCsv(tmp), [{ A: '1', B: 'x, "y"\nz' }]);
  fs.unlinkSync(tmp);
  assert.match(presets.data.about, /ui-ux-pro-max-skill by Next Level Builder \(MIT License/);
  assert.match(fs.readFileSync(path.join(__dirname, '../THIRD_PARTY_NOTICES.md'), 'utf8'), /ui-ux-pro-max-skill: business palettes, font pairings and page playbooks/);
  assert.ok(fs.existsSync(path.join(__dirname, '../licenses/ui-ux-pro-max-skill-LICENSE.txt')));
});

#!/usr/bin/env node
'use strict';
// Rebuilds design-presets.json from ui-ux-pro-max-skill (Next Level Builder, MIT License,
// github.com/nextlevelbuilder/ui-ux-pro-max-skill): palettes and font pairings by kind of business,
// and a playbook per business (page pattern, section order, where the main button goes, style,
// effects and what to avoid).
//
// Run:  node scripts/design-data/import-pro-max.js <path to ui-ux-pro-max-skill checkout>
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', '..', 'design-presets.json');

// A small CSV reader: quoted fields, doubled quotes, commas and newlines inside quotes.
function readCsv(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((v) => v.trim()));
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] || '').trim()])));
}

const hex = (v) => (/^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null);
const clean = (v, n = 300) => String(v || '').replace(/\s+/g, ' ').replace(/\s*\[[^\]]*\]\s*/g, ' ').replace(/\s+,/g, ',').trim().slice(0, n);
const list = (v) => String(v || '').split(/\s*\+\s*/).map((s) => s.trim()).filter(Boolean);

function palettes(rows) {
  return rows.filter((r) => hex(r.Primary) && hex(r.Background) && hex(r.Foreground)).map((r) => ({
    type: r['Product Type'],
    palette: {
      background: hex(r.Background), foreground: hex(r.Foreground), primary: hex(r.Primary),
      // Their Muted is a quiet surface: Kairoq uses it for secondary and muted.
      secondary: hex(r.Muted) || hex(r.Secondary), accent: hex(r.Accent) || hex(r.Secondary),
      muted: hex(r.Muted) || hex(r.Secondary), card: hex(r.Card) || hex(r.Background), border: hex(r.Border) || hex(r.Muted),
    },
    note: clean(r.Notes, 160),
  }));
}

// Kairoq's font kinds from Google's categories.
const KIND = { 'Sans Serif': 'sans', Serif: 'serif', Display: 'display', Handwriting: 'display', Monospace: 'mono' };

// Weights each family offers, from the pairing's Google Fonts URL (a wrong weight breaks the request).
function weightsFromUrl(url) {
  const out = {};
  for (const m of String(url).matchAll(/family=([^:&]+):wght@([0-9;]+)/g)) out[decodeURIComponent(m[1]).replace(/\+/g, ' ')] = m[2];
  return out;
}

function fonts(rows, google) {
  const category = new Map(google.map((g) => [g.Family, KIND[g.Category] || 'sans']));
  const families = {};
  const pairs = [];
  for (const r of rows) {
    const display = r['Heading Font'], body = r['Body Font'];
    if (!category.has(display) || !category.has(body)) continue;
    const weights = weightsFromUrl(r['Google Fonts URL']);
    for (const f of [display, body]) {
      // Keep at most the regular to bold range Kairoq uses, in the weights the family really has.
      const w = String(weights[f] || '400').split(';').filter((x) => +x >= 400 && +x <= 700);
      families[f] = [category.get(f), (w.length ? w : ['400']).join(';')];
    }
    pairs.push({ name: r['Font Pairing Name'], display, body, mood: clean(r['Mood/Style Keywords'], 160), best_for: clean(r['Best For'], 200) });
  }
  return { pairs, families };
}

// One playbook per kind of business: products.csv joined with ui-reasoning.csv and landing.csv.
function playbooks(products, reasoning, landing) {
  const why = new Map(reasoning.map((r) => [r.UI_Category, r]));
  // A pattern is known by its name and by its aliases ("Minimal & Direct" is "Minimal Single Column").
  const pattern = new Map();
  for (const l of landing) {
    for (const name of [l['Pattern Name'], ...String(l.Aliases || '').split('|')]) {
      const key = name.trim().toLowerCase();
      if (key && !pattern.has(key)) pattern.set(key, l);
    }
  }
  const findPattern = (name) => {
    for (const part of [name, ...list(name)]) { const p = pattern.get(String(part).toLowerCase()); if (p) return p; }
    return null;
  };
  return products.map((p) => {
    const r = why.get(p['Product Type']) || {};
    // "N/A - Dashboard focused": a tool, not a landing page, so no landing section order.
    const isTool = /^N\/A/i.test(p['Landing Page Pattern']);
    const l = isTool ? null : findPattern(p['Landing Page Pattern']) || findPattern(r.Recommended_Pattern || '');
    return {
      type: p['Product Type'],
      keywords: clean(p.Keywords, 240),
      style: clean(p['Primary Style Recommendation'], 120),
      also: clean(p['Secondary Styles'], 120),
      pattern: clean(p['Landing Page Pattern'] || r.Recommended_Pattern, 120),
      sections: l ? clean(l['Section Order'], 300) : '',
      cta: l ? clean(l['Primary CTA Placement'], 120) : '',
      effects: clean(r.Key_Effects, 200),
      avoid: list(r.Anti_Patterns).map((a) => clean(a, 80)).slice(0, 6),
      considerations: clean(p['Key Considerations'], 240),
    };
  }).filter((b) => b.type && (b.pattern || b.style));
}

function main() {
  const root = process.argv[2];
  if (!root) { console.error('Usage: node scripts/design-data/import-pro-max.js <ui-ux-pro-max-skill checkout>'); process.exit(1); }
  const data = path.join(root, 'src', 'ui-ux-pro-max', 'data');
  const read = (f) => readCsv(path.join(data, f));
  const f = fonts(read('typography.csv'), read('google-fonts.csv'));
  const out = {
    about: 'Palettes, font pairings and page playbooks by kind of business, adapted from ui-ux-pro-max-skill by Next Level Builder (MIT License, Copyright (c) 2024 Next Level Builder, github.com/nextlevelbuilder/ui-ux-pro-max-skill). Rebuilt with scripts/design-data/import-pro-max.js. Colours are mapped to Kairoq design tokens (their Muted is used for secondary and muted surfaces).',
    palettes: palettes(read('colors.csv')),
    fonts: f.pairs,
    families: f.families,
    playbooks: playbooks(read('products.csv'), read('ui-reasoning.csv'), read('landing.csv')),
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  console.log('palettes', out.palettes.length, 'fonts', out.fonts.length, 'families', Object.keys(out.families).length, 'playbooks', out.playbooks.length);
}

if (require.main === module) main();
module.exports = { readCsv, weightsFromUrl };

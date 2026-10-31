"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const looks = require("../looks");
const { FONTS } = require("../react-design");
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

test("there are 100 different looks, every feel has plenty, and every font can be loaded by the built app", () => {
  const all = looks.catalog();
  assert.equal(all.length, 100);
  assert.equal(new Set(all.map(l => l.id)).size, 100);
  for (const [feel] of looks.FEELS) assert.ok(all.filter(l => l.feel === feel).length >= 9, feel + " has at least 9 looks");
  for (const l of all) {
    assert.ok(FONTS[l.head] && FONTS[l.body], l.id + " uses known fonts");
    for (const k of ["bg", "surface", "ink", "muted", "accent", "accentInk"]) assert.match(l.colors[k], /^#[0-9a-f]{6}$/);
  }
});

test("a look from the browser is checked: bad colours are refused, unknown fonts fall back", () => {
  const good = { ...looks.catalog()[0] };
  assert.throws(() => looks.normalizeLook({ ...good, colors: { ...good.colors, bg: "red" } }), /valid bg colour/);
  const l = looks.normalizeLook({ ...good, head: "Comic Sans Magic", corners: "wavy" });
  assert.equal(l.head, "Inter");
  assert.equal(l.corners, "soft");
});

test("the picked look becomes the project's design with the exact colours and fonts", () => {
  const pick = looks.catalog().find(l => l.feel === "premium");
  const d = looks.toDesign({ ...pick, corners: "round", spacing: "compact" }, { request: "booking page for a hotel", projectName: "Hotel" });
  assert.equal(d.palette.background, pick.colors.bg);
  assert.equal(d.palette.foreground, pick.colors.ink);
  assert.equal(d.palette.primary, pick.colors.accent);
  assert.equal(d.palette.card, pick.colors.surface);
  assert.deepEqual(d.fonts, { display: pick.head, body: pick.body });
  assert.equal(d.radius, "1.25rem");
  assert.equal(d.look_id, pick.id);
  assert.ok(d.details.some(x => /Compact spacing/.test(x)));
  assert.ok(d.direction, "a layout direction keeps pages varied");
  // The design note the builder reads includes the owner's colours.
  assert.match(require("../react-design").designNote(d), new RegExp(pick.colors.accent));
});

test("a look from someone else's website is inspiration only; the owner's own site is matched exactly", () => {
  const tokens = { background: "#f4efe6", text: ["#6b5a4c", "#2b1d14", "#ffffff"], surfaces: ["#ebe3d6", "#2f5d50"], buttons: ["#2f5d50"], fonts: ["Work Sans", "Georgia", "Playfair Display"], radii: ["12px"] };
  const { look, understood } = looks.fromTokens(tokens, { url: "https://northline.example/" });
  assert.equal(look.colors.ink, "#2b1d14", "text is the strongest of the common text colours");
  assert.equal(look.colors.muted, "#6b5a4c");
  assert.equal(look.colors.accent, "#2f5d50", "the button colour is the accent");
  assert.equal(look.head, "Playfair Display");
  assert.equal(look.body, "Work Sans");
  assert.equal(look.corners, "soft");
  assert.match(understood.shape, /about 12 px/);
  const inspired = looks.toDesign(look);
  assert.match(inspired.notes, /never use that company's name, logo, trademarks, text or photos/);
  const own = looks.toDesign({ ...look, source: { url: look.source.url, own: true } });
  assert.match(own.notes, /owner's own brand/);
});

test("a site font Kairoq cannot load gets the closest free match, and says so", () => {
  assert.deepEqual(looks.closestFont(["Helvetica Neue"]), { font: "Hanken Grotesk", exact: false, site: "Helvetica Neue" });
  assert.equal(looks.closestFont(["Tiempos Headline"]).font, "Literata");
  assert.equal(looks.closestFont(["Inter"]).exact, true);
});

test("look tools remain available but are not a mandatory first-build step", () => {
  const js = read("public/create.js"), html = read("public/create.html"), api = read("create-api.js");
  // The optional design tooling can stay loaded for later use.
  assert.match(html, /<script src="\/create-look\.js\?v=\d+"><\/script>\s*<script src="\/create\.js/);
  assert.match(api, /action==='\/look'&&method==='POST'/);
  assert.match(api, /meta\.planned_design=require\('\.\/looks'\)\.toDesign/);
  // But the first-build chat must never invoke the look/3D wizard automatically.
  const start=js.indexOf("async function askThenBuild(prompt)");
  const end=js.indexOf("// A first request with the owner's answers",start);
  const first=js.slice(start,end);
  assert.ok(start>=0&&end>start);
  assert.doesNotMatch(first,/KairoqLook\.step/);
  assert.doesNotMatch(first,/\/look/);
  assert.doesNotMatch(first,/three_d/);
  assert.doesNotMatch(first,/\/plan/);
  assert.doesNotMatch(first,/Decide for me/);
  assert.match(first,/Build anyway/);
});

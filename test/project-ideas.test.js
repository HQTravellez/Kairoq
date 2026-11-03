"use strict";
// Idea board: ideas must rest on real facts about the app. Ideas citing no known fact are dropped,
// "Your users asked" needs a real question from the app's users, and the page wires Build this
// to a normal build.
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const I = require("../project-ideas");
const read = f => fs.readFileSync(path.join(__dirname, "..", "public", f), "utf8");

const FACTS = [
  { id: "f1", kind: "app", text: 'The app is called "Orbit".' },
  { id: "f2", kind: "users", text: "Nobody has signed up yet." },
  { id: "f3", kind: "users_asked", text: 'People using the app asked its AI "Can I pay by card?" (3 times) and it could not answer.' }
];

test("ideas without a real fact are dropped, and users_asked needs a users_asked fact", () => {
  const out = I.clean({ ideas: [
    { title: "Card payments", what: "Let clients pay by card.", why: "Asked 3 times.", group: "users_asked", impact: "high", facts: ["f3"] },
    { title: "Made-up reviews", what: "Show reviews.", why: "Competitors have it.", group: "grow", facts: ["f9"] },
    { title: "Google sign-in", what: "One-tap sign-in.", why: "Nobody has signed up yet.", group: "users_asked", impact: "huge", facts: ["f2"] },
    { title: "card payments", what: "Duplicate.", why: "x", group: "grow", facts: ["f3"] }
  ] }, FACTS);
  assert.deepEqual(out.map(x => x.title), ["Card payments", "Google sign-in"]);
  assert.equal(out[0].group, "users_asked");
  assert.equal(out[1].group, "finish", "no users_asked fact, so not 'Your users asked'");
  assert.equal(out[1].impact, "medium");
  assert.deepEqual(out[0].facts, [FACTS[2].text], "the card shows the fact itself");
});

test("refresh saves ideas, dismiss hides one, and an answer with no backed idea fails", async () => {
  let meta = { id: "p1", name: "Orbit", current_version: 1, messages: [{ role: "user", text: "A client portal" }] };
  const builder = { loadMeta: () => meta, saveMeta: m => { meta = m }, loadFiles: () => ({ "src/pages/Home.jsx": "", "src/pages/Files.jsx": "" }) };
  const backend = { overview: () => ({ collections: [{ name: "files", count: 4 }], user_count: 0, features: { payments: [], email: true }, outbox: [] }), database: () => ({}) };
  const assistant = { questions: () => [] };
  let prompt = "";
  const callModel = async (o, parse) => { prompt = o.messages[1].content; return parse('{"ideas":[{"title":"Comment on a file","what":"Notes on files.","why":"It stores 4 files.","group":"save_time","impact":"high","facts":["f3"]}]}') };
  const v = await I.refresh("p1", { callModel, builder, backend, assistant });
  assert.match(prompt, /Its pages: Home, Files\./);
  assert.match(prompt, /files \(4 saved\)/);
  assert.equal(v.ideas.length, 1); assert.ok(v.at);
  assert.equal(I.dismiss("p1", v.ideas[0].id, { builder }).ideas.length, 0);
  await assert.rejects(I.refresh("p1", { callModel: async () => ({ ideas: [{ title: "X", what: "Y", why: "Z", facts: [] }] }), builder, backend, assistant }), /could not find ideas/);
});

test("the Ideas page is wired to real routes and a normal build", () => {
  const html = read("create.html");
  assert.match(html, /id="side-ideas">[\s\S]*?Ideas<\/button>/);
  for (const id of ["id-project", "id-refresh", "id-tabs", "id-list"]) assert.match(html, new RegExp('id="' + id + '"'));
  const js = read("create.js");
  assert.match(js, /await openProject\(p\.id\);await send\(x\.title\+': '\+x\.what,'build'\)/);
  const srv = fs.readFileSync(path.join(__dirname, "..", "create-api.js"), "utf8");
  assert.match(srv, /'GET:\/ideas':'viewer','POST:\/ideas':'editor'/);
  assert.match(srv, /accounts\.grant\(v\.account\.id,price,'Refund: ideas failed'/);
});

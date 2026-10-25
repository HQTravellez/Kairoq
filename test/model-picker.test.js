"use strict";
// The chat composer's model picker (like Hermes): plain model name, searchable list grouped by
// provider, favourites, and "Edit models" to choose what shows. Choices survive a page reload.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

test("the composer shows the picker, not the old yellow Free Auto badge", () => {
  const html = read("public/index.html");
  for (const id of ["modelPickerBtn", "modelPickerLabel", "modelPicker", "modelPickerSearch", "modelPickerList", "modelPickerRefresh", "modelPickerEdit", "modelsEditDialog", "modelsEditList", "modelsEditReset"])
    assert.match(html, new RegExp(`id="${id}"`), `${id} exists`);
  const app = read("public/app.js");
  assert.match(app, /option\("openrouter\/free","Auto \(free\)"\)/);
  assert.doesNotMatch(app, /modelSelect\.appendChild\(option\("openrouter\/free","⚡/);
  const css = read("public/kairoq-ui.css");
  assert.match(css, /\.composer \.model-inline,\.composer #modelBadge,\.composer #favoriteBtn\{display:none!important\}/);
});

test("the picker groups by provider, keeps favourites first, and hides models switched off in Edit models", () => {
  const app = read("public/app.js");
  assert.match(app, /section\("Auto"/);
  assert.match(app, /section\("Favourites"/);
  assert.match(app, /if\(!q&&\(!modelShown\(m\)\|\|isCopyVariant\(m\)\)\)continue;/, "hidden models stay findable by search");
  assert.match(app, /localStorage\.setItem\("kq-model-visibility"/);
});

test("reloading the page keeps the model and thinking effort you picked", () => {
  const app = read("public/app.js");
  assert.match(app, /applyPreset\(ui\.preset\|\|"quick",\{keepChoices:true\}\);/);
  assert.match(app, /if\(p\.model&&!\(keepChoices&&ui\.lastModel\)\)/);
});

test("the picker is short like Hermes: no batch or dated copies, a few models per provider, Hermes Agent on top", () => {
  const app = read("public/app.js");
  const isCopyVariant = new Function(`${/function isCopyVariant\(m\)\{[\s\S]*?\n\}/.exec(app)[0]}; return isCopyVariant;`)();
  assert.equal(isCopyVariant({ id: "anthropic/claude-opus-5.5:batch", name: "Claude Opus 5.5 (batch)" }), true);
  assert.equal(isCopyVariant({ id: "anthropic/claude-3.7-sonnet-20250219", name: "Claude 3.7 Sonnet" }), true);
  assert.equal(isCopyVariant({ id: "anthropic/claude-opus-5.5", name: "Claude Opus 5.5" }), false);
  assert.equal(isCopyVariant({ id: "google/gemma-4-31b-it:free", name: "Gemma 4 31B (free)" }), false);
  assert.match(app, /const PER_PROVIDER=6;/);
  assert.match(app, /section\("Agent"/);
  assert.match(app, /if\(freeOnlyEl\.checked&&!m\.isFree&&!m\.local\)continue;/, "Free Only hides paid models instead of a red error");
  assert.doesNotMatch(app, /Free Only is on\. Choose a free model/);
});

test("Hermes Agent is an explicit choice, and OpenRouter errors are explained in plain words", () => {
  const server = read("server.js");
  assert.match(server, /const wantsHermes=body\.model==="hermes\/agent";/);
  assert.match(server, /Kairoq Agent isn.t connected yet/);
  assert.match(server, /if\(hermes\.configured\(\)&&isAuthenticated\(req\)&&\(wantsHermes\|\|autoPick\)\)/);
  const plain = new Function(`${/function plainOpenRouterError\([\s\S]*?\n\}/.exec(server)[0]}; return plainOpenRouterError;`)();
  assert.match(plain(402, "Insufficient credits. This account never purchased credits."), /no credits/);
  assert.match(plain(429, "Rate limit exceeded"), /busy/);
  assert.equal(plain(500, "Something else"), "Something else");
});

test("users see Kairoq Agent, never the Hermes name; the open-source credit stays on the licences page", () => {
  const app = read("public/app.js"), html = read("public/index.html"), server = read("server.js"), chat = read("hermes-chat.js");
  assert.doesNotMatch(app, /"Hermes Agent"|"Hermes ready"|"Hermes not connected"/);
  assert.doesNotMatch(html, />Hermes agent<|Checking Hermes/);
  assert.doesNotMatch(server, /message:"Hermes is thinking/);
  assert.doesNotMatch(chat, /new HermesError\("Hermes /);
  assert.match(server, /You are Kairoq Agent, the assistant inside Kairoq/);
  assert.match(server, /built on open-source software, including Hermes Agent by Nous Research/);
  assert.match(read("public/licenses.html"), /Hermes Agent<\/a> · Nous Research[\s\S]*MIT/);
});

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
  assert.match(app, /if\(!q&&!modelShown\(m\)\)continue;/, "hidden models stay findable by search");
  assert.match(app, /localStorage\.setItem\("kq-model-visibility"/);
});

test("reloading the page keeps the model and thinking effort you picked", () => {
  const app = read("public/app.js");
  assert.match(app, /applyPreset\(ui\.preset\|\|"quick",\{keepChoices:true\}\);/);
  assert.match(app, /if\(p\.model&&!\(keepChoices&&ui\.lastModel\)\)/);
});

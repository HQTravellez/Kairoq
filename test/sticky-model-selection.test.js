"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const {resolve}=require("../sticky-model-selection");
test("chosen model persists across omitted model messages",()=>{assert.equal(resolve("anthropic/claude-sonnet-5.5",null),"anthropic/claude-sonnet-5.5");assert.equal(resolve(null,"anthropic/claude-sonnet-5.5"),"anthropic/claude-sonnet-5.5")});
test("switching requires explicit user choice",()=>{assert.equal(resolve("google/gemini-2.5-pro","anthropic/claude-sonnet-5.5"),"google/gemini-2.5-pro");assert.equal(resolve("auto","google/gemini-2.5-pro"),null)});
test("model-pinned requests bypass static conversational shortcuts",()=>{const s=fs.readFileSync(require("node:path").join(__dirname,"..","create-api.js"),"utf8");assert.match(s,/const pinnedModel=Boolean\(model\)/);assert.match(s,/!pinnedModel&&!hooks&&!images\.length&&!context&&!shownText/);assert.match(s,/model=selection\.resolve/);assert.match(s,/selected_chat_model=model/);});
test("backend prevents silent fallback on explicitly selected model",()=>{const s=fs.readFileSync(require("node:path").join(__dirname,"..","server.js"),"utf8");assert.match(s,/if\(opts\.model\|\|process\.env\.KAIROQ_BUILDER_SINGLE_MODEL/);});

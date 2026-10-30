"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"..","server.js"),"utf8");
test("explicitly selected paid models use premium build output budget",()=>{
 assert.match(source,/const premium=opts\.tier==="pro"\|\|opts\.tier==="max"\|\|designModel\|\|Boolean\(opts\.only\)/);
 assert.match(source,/opts\.only\?Math\.min\(outputCap,24000\):10000/);
});
test("explicitly selected models never silently fall back to Auto",()=>{
 assert.match(source,/if\(opts\.model\|\|process\.env\.KAIROQ_BUILDER_SINGLE_MODEL==="true"/);
 assert.match(source,/if\(opts\.model\)/);
});

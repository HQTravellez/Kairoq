"use strict";
// A finished build shows one "done" signal, its result card (like Lovable): no green "Kairoq Agent
// finished" line and no "Build details" fold that repeats the card's version and Details button.
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const js=fs.readFileSync(path.join(__dirname,"../public/create.js"),"utf8");
test("the result card is the only done signal",()=>{
 assert.match(js,/end\.duration_ms!=null&&!end\.failed&&!end\.version\)list\.append\(doneLine\(end\)\)/,"no finished line under a build with a card");
 assert.match(js,/!end\.failed&&!end\.version&&list&&!list\.querySelector\('\.agent-done'\)/,"nor when a job finishes live");
 assert.match(js,/const card=li\.querySelector\('\.ks-card'\);if\(card\)for\(const n of kept\)n\.remove\(\);/,"no Build details fold next to the card");
});

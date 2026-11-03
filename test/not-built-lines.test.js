"use strict";
// After a run that built nothing, the chat shows only Kairoq's own message ("I didn't get to build
// this… you were not charged"): no "Preview ready" and no second "Nothing was built, so it was free".
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const js=fs.readFileSync(path.join(__dirname,"../public/create.js"),"utf8");
test("no contradicting lines under a build that made nothing",()=>{
 assert.match(js,/const builtNothing=Boolean\(done\.result&&done\.result\.not_built\);\n  if\(done\.status==='complete'&&!done\.problem&&!builtNothing&&project\.preview_url\)\{const ready=el\('li','assistant preview-ready','Preview ready'\)/);
 assert.match(js,/else if\(done\.free&&!\(done\.result&&done\.result\.not_built\)\)\$\('messages'\)\.append/);
});

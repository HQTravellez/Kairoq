"use strict";
// Preview like Lovable: on a computer the preview tools (Edit, laptop/phone/tablet, open on your
// phone, full screen) sit in the bar above the preview instead of floating over the app; on a phone
// they float at the bottom as before. The phone model menu sits at the top left of the preview.
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=f=>fs.readFileSync(path.join(__dirname,"../public",f),"utf8");
test("the preview tools dock into the top bar on a computer",()=>{
 const js=read("create.js"),css=read("ui/forma.css");
 assert.match(js,/const narrow=window\.matchMedia\('\(max-width:900px\)'\)/);
 assert.match(js,/if\(!narrow\.matches&&sub\)\{bar\.classList\.add\('docked'\)/);
 assert.match(js,/narrow\.addEventListener\?\.\('change',place\)/,"moves back when the window gets narrow");
 assert.match(js,/const extras=\['device-model','safari-shot'\]\.map\(id=>\$\(id\)\)\.filter\(Boolean\);\n/,"found while still in the page");
 assert.match(css,/\.fm-sub>\.pv-float\.docked\{position:relative!important/);
 assert.match(css,/\.stage:has\(#canvas\[data-view\]:not\(\[data-view=preview\]\)\) \.fm-sub>\.pv-float\.docked\{display:none!important\}/,"hidden in Code, Data and Settings");
 assert.match(css,/\.pv-float #visual-toggle\{width:auto!important/,"Edit has room for its label");
});
test("the result card names what was built, not just the version",()=>{
 assert.match(read("create.js"),/const title=m\.title\|\|String\(ver\?\.title\|\|ver\?\.summary\|\|''\)/);
});

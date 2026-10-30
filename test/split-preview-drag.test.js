"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const dir=path.join(__dirname,"..","public"),read=name=>fs.readFileSync(path.join(dir,name),"utf8");
test("resize changes grid itself instead of only drawing divider",()=>{
 const js=read("builder-split-preview.js");
 assert.match(js,/editor\.style\.setProperty\("grid-template-columns"/);
 assert.match(js,/handle\.style\.left=n\+"%"/);
 assert.match(js,/document\.addEventListener\("pointermove",moveDrag,true\)/);
 assert.match(js,/document\.removeEventListener\("pointermove",moveDrag,true\)/);
 assert.match(js,/window\.addEventListener\("blur",stopDrag\)/);
});
test("dragging iframe is safe; new assets invalidate old cache",()=>{
 assert.match(read("builder-split-preview.css"),/kq-split-dragging #editor iframe\{pointer-events:none!important\}/);
 assert.match(read("create.html"),/builder-split-preview\.js\?v=2/);
 assert.match(read("create.html"),/builder-split-preview\.css\?v=2/);
});

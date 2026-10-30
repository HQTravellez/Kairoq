"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.join(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,"public",p),"utf8");
test("split-screen enhancement loads after existing builder and uses the real preview",()=>{
 const html=read("create.html"),js=read("builder-split-preview.js"),css=read("builder-split-preview.css");
 assert.match(html,/builder-split-preview\.css/);assert.match(html,/create\.js[^"]*"><\/script>[\s\S]*builder-split-preview\.js/);
 assert.match(js,/getElementById\("editor"\)/);assert.match(js,/getElementById\("checks-open"\)/);
 assert.match(html,/iframe id="frame"/);assert.match(css,/grid-template-columns/);
 assert.doesNotMatch(js,/iframe\.src|\.innerHTML\s*=|fetch\(|\beval\(/);
});
test("split resize supports keyboard, pointer and narrow screens",()=>{
 const js=read("builder-split-preview.js"),css=read("builder-split-preview.css");
 assert.match(js,/pointerdown/);assert.match(js,/ArrowLeft/);assert.match(js,/localStorage/);assert.match(css,/@media\(max-width:900px\)/);assert.match(js,/kq-preview-full/);
});

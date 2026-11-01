"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.join(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,"public",p),"utf8");
const {kqSplitBounds,kqWorkspaceLayout}=require("../public/builder-split-preview.js");

test("split-screen enhancement loads after existing builder and uses the real preview",()=>{
 const html=read("create.html"),js=read("builder-split-preview.js"),css=read("builder-split-preview.css");
 assert.match(html,/builder-split-preview\.css/);
 assert.match(html,/create\.js[^"]*"><\/script>[\s\S]*builder-split-preview\.js/);
 assert.match(js,/getElementById\("editor"\)/);
 assert.match(js,/getElementById\("checks-open"\)/);
 assert.match(html,/iframe id="frame"/);
 assert.match(css,/grid-template-columns/);
 assert.doesNotMatch(js,/iframe\.src|\.innerHTML\s*=|fetch\(|\beval\(/);
});

test("split resize supports keyboard, pointer and narrow screens",()=>{
 const js=read("builder-split-preview.js"),css=read("builder-split-preview.css");
 assert.match(js,/pointerdown/);
 assert.match(js,/ArrowLeft/);
 assert.match(js,/localStorage/);
 assert.match(css,/@media\(max-width:900px\)/);
 assert.match(js,/kq-preview-full/);
});

test("splitter enforces 320px chat and 720px preview minimums",()=>{
 const wide=kqSplitBounds(1400);
 assert.equal(wide.compact,false);
 assert.ok(wide.min>=320/1400*100);
 assert.ok(wide.max<=((1400-720)/1400*100)+1e-9);
 const exact=kqSplitBounds(1040);
 assert.equal(exact.compact,false);
 assert.ok(Math.abs(exact.min-exact.max)<0.001);
});

test("workspace stacks instead of squeezing when both panes cannot fit",()=>{
 assert.equal(kqSplitBounds(1039).compact,true);
 assert.equal(kqSplitBounds(900).compact,true);
 const js=read("builder-split-preview.js"),css=read("builder-split-preview.css");
 assert.match(js,/CHAT_MIN_PX=320,PREVIEW_MIN_PX=720/);
 assert.match(js,/ResizeObserver/);
 assert.match(css,/minmax\(320px/);
 assert.match(css,/minmax\(720px,1fr\)/);
 assert.match(css,/kq-split-compact/);
 assert.match(css,/grid-template-rows:minmax\(0,1fr\) minmax\(220px,42vh\)/);
});

test("browser uses three columns when wide and stacks under app instead of crushing preview",()=>{
 const wide=kqWorkspaceLayout(1600,true);
 assert.equal(wide.mode,"three");
 assert.ok(wide.browserPx>=380);
 assert.equal(wide.bounds.compact,false);
 // At the maximum allowed chat split there is still room for 560px app + browser.
 assert.ok((wide.bounds.max/100*1600)+560+wide.browserPx<=1600+1e-6);
 const medium=kqWorkspaceLayout(1180,true);
 assert.equal(medium.mode,"stacked");
 assert.equal(medium.bounds.compact,false);
 const normal=kqWorkspaceLayout(1400,false);
 assert.equal(normal.mode,"two");
});

test("editor contains a separate live browser surface, not an external-site iframe",()=>{
 const html=read("create.html"),js=read("builder-browser-pane.js"),css=read("builder-split-preview.css"),create=read("create.js");
 assert.match(html,/id="web-browser-pane"/);
 assert.match(html,/id="web-browser-shot"/);
 assert.match(html,/builder-browser-pane\.js/);
 const pane=html.slice(html.indexOf('id="web-browser-pane"'),html.indexOf("</aside>",html.indexOf('id="web-browser-pane"')));
 assert.doesNotMatch(pane,/<iframe/i);
 assert.match(js,/data:image\/jpeg;base64/);
 assert.match(js,/kq-browser-open/);
 assert.match(css,/kq-browser-three/);
 assert.match(css,/kq-browser-stacked/);
 assert.match(css,/min-width:380px/);
 assert.match(create,/kairoqBrowserPane\?\.show\(j\.browser\)/);
});

// Kairoq's browser as the third pane (builder-browser-pane.js): the Browser button, the step log,
// frames while the builder tests its own app, and one pane at a time on a phone.
test('the browser pane has a toggle, a step log and phone tabs',()=>{
 const fs=require('fs'),path=require('path');
 const html=fs.readFileSync(path.join(__dirname,'..','public','create.html'),'utf8'),js=fs.readFileSync(path.join(__dirname,'..','public','builder-browser-pane.js'),'utf8'),css=fs.readFileSync(path.join(__dirname,'..','public','dark.css'),'utf8');
 assert.match(html,/id="view-browser"[^>]*aria-pressed="false"/,'a Browser toggle in the stage bar');
 assert.match(html,/<ol class="web-browser-log hidden" id="web-browser-log"/,'the step log under the live view');
 assert.match(html,/id="phone-panes" role="tablist"[\s\S]*data-pane="chat"[\s\S]*data-pane="preview"[\s\S]*data-pane="browser"/,'Chat | Preview | Browser on a phone');
 assert.match(js,/toggle\?\.addEventListener\("click"/);
 assert.match(js,/if\(data\.steps\)steps\(data\.steps\)/,'frames carry the steps');
 assert.match(js,/editor\.dataset\.pane=name/,'a tab picks the pane');
 assert.match(css,/#editor\[data-pane=browser\]>\.web-browser-pane\{display:flex!important\}/);
 const rb=fs.readFileSync(path.join(__dirname,'..','react-builder.js'),'utf8');
 assert.match(rb,/onBrowser\(\{url:[^}]*screenshot:[^}]*steps:log\.slice\(-8\)/,'selfBrowse streams a frame per step');
 assert.match(fs.readFileSync(path.join(__dirname,'..','create-api.js'),'utf8'),/browse,onBrowser:b=>update\(\{browser:b\}\),/,'the job carries the frames to the pane');
});

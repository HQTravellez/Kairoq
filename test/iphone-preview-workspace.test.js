"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.join(__dirname,"..");
const ui=fs.readFileSync(path.join(root,"public/create.js"),"utf8");
const css=fs.readFileSync(path.join(root,"public/phone-preview-polish.css"),"utf8");
const html=fs.readFileSync(path.join(root,"public/create.html"),"utf8");
test("phone chrome stylesheet is loaded in Create",()=>{
 assert.match(html,/phone-preview-polish\.css/);
 assert.match(css,/\.device\.phone\.island \.dev-island/);
 assert.match(css,/\.device\.phone \.dev-bottom/);
});
test("desktop/phone/device controls are wired and the phone frame scales to its canvas",()=>{
 assert.match(ui,/\$\('desktop'\)\.onclick=\(\)=>device\(false\)/);
 assert.match(ui,/\$\('mobile'\)\.onclick=\(\)=>device\(true\)/);
 assert.match(ui,/\$\('device-model'\)\.onchange=/);
 assert.match(ui,/function fitDevice\(\)/);
 assert.match(ui,/Math\.min\(1,\(c\.clientHeight-pad\)/);
 assert.match(ui,/new ResizeObserver\(\(\)=>fitDevice\(\)\)/);
 assert.match(ui,/previewObserver\.observe\(\$\('canvas'\)\)/);
});
test("fade is a short entrance effect and never blocks preview interaction",()=>{
 assert.match(css,/@keyframes kq-preview-reveal/);
 assert.match(css,/\.device\.phone\{animation:kq-preview-reveal/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.doesNotMatch(css,/pointer-events:\s*none/);
 assert.match(css,/\.device\.phone #frame\{background:white/);
});

"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const s=fs.readFileSync(path.join(__dirname,"../public/app.js"),"utf8");
test("advanced picker inserts model option before setting selected model",()=>{
 const i=s.indexOf('b.onclick=()=>{',s.indexOf('function renderModelResults()'));
 const part=s.slice(i,i+750);
 assert.ok(part.indexOf('modelSelect.appendChild(option(m.id')>=0);
 assert.ok(part.indexOf('modelSelect.appendChild(option(m.id')<part.indexOf('modelSelect.value=m.id'));
 assert.match(part,/updateModelUI\(\)/);
});
test("free only refuses paid selections, with search initially filtered to free",()=>{
 assert.match(s,/freeOnlyEl\.checked&&!m\.isFree/);
 assert.match(s,/currentModelFilter=freeOnlyEl\.checked\?"free":"all"/);
});
test("explicit free model persists in saved settings",()=>{
 assert.match(s,/ui\.lastModel=modelSelect\.value;saveAll\(\)/);
});

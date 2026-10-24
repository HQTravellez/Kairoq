"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const app=fs.readFileSync(path.join(__dirname,"../public/app.js"),"utf8");
const server=fs.readFileSync(path.join(__dirname,"../server.js"),"utf8");
test("primary model selector shows discovered free cloud models",()=>{
 assert.match(app,/const eligibleFree=allModels\.filter\(m=>m\.isFree/);
 assert.match(app,/g\.label="Free cloud models"/);
});
test("Zero Cost mode checks selected free model before auto routing",()=>{
 const selected=server.indexOf('requestedModel!=="openrouter/free" && requestedModel!=="smart-auto"');
 const auto=server.indexOf('if(ZERO_COST_MODE){\n      const preferredLocal=');
 assert.ok(selected>=0&&auto>selected);
 assert.match(server,/Selected model is not verified free and cannot run in Zero Cost mode/);
});

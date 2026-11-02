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

test("verified free routes stay visibly marked FREE even when Free Only is enabled",()=>{
 assert.match(s,/for\(const flag of modelFlags\(actual\)\)/);
 assert.doesNotMatch(s,/m\.isFree&&!m\.local&&!auto&&!freeOnlyEl\.checked/);
 const src=/function modelFlags\(modelOrId\)\{[\s\S]*?\n\}/.exec(s)?.[0];
 assert.ok(src,"modelFlags helper exists");
 const modelFlags=new Function(src+"; return modelFlags;")();
 assert.deepEqual(modelFlags({id:"openrouter/model:free",isFree:true}),["FREE"]);
 assert.deepEqual(modelFlags({id:"local/qwen",local:true,isFree:true}),["LOCAL","FREE"]);
 assert.deepEqual(modelFlags({id:"paid/model",allowedPaid:true,isFree:false}),["PAID"]);
 assert.deepEqual(modelFlags({id:"hermes/agent",agent:true,isFree:false}),["AGENT"]);
});
test("compact selector labels local and explicit free choices clearly",()=>{
 assert.match(s,/Ollama auto · LOCAL · FREE/);
 assert.match(s,/compactModelLabel\(m\)/);
 assert.match(s,/modelPickerLabel"\)\.textContent=pickerLabel/);
});
test("FreeLLM pool selection is executed by FreeLLMAPI rather than sent to OpenRouter",()=>{
 const server=fs.readFileSync(path.join(__dirname,"../server.js"),"utf8");
 const freeAt=server.indexOf('if(requestedModel==="freellm/auto"||requestedModel.startsWith("freellm/"))');
 const genericAt=server.indexOf('// A model picked by name in the picker',freeAt);
 assert.ok(freeAt>=0&&genericAt>freeAt);
 const block=server.slice(freeAt,genericAt);
 assert.match(block,/require\("\.\/freellmapi"\)/);
 assert.match(block,/pool\.complete\(finalMessages/);
 assert.match(block,/zeroCost:true/);
 assert.doesNotMatch(block,/streamOpenRouter/);
});

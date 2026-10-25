'use strict';
// Meta's Muse Spark: picked in the model menu, used by Auto when paid builds are on, answers
// questions, checks screenshots, and stays inside its own monthly cap.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const muse=require('../muse'),choices=require('../model-choices');

test('Muse is on only with its key, and appears in the model menu on its own',()=>{
 assert.equal(muse.configured({}),false);
 assert.equal(muse.configured({META_MODEL_API_KEY:'k'}),true);
 assert.equal(muse.configured({META_MODEL_API_KEY:'k',KAIROQ_MUSE:'off'}),false);
 assert.equal(muse.model({}),'muse-spark-1.3');
 assert.equal(muse.monthlyCap({}),20);assert.equal(muse.monthlyCap({KAIROQ_MUSE_MONTHLY_USD:'5'}),5);
 const on=choices.list({META_MODEL_API_KEY:'k'}).find(m=>m.id==='meta/muse-spark');
 assert.equal(on.enabled,true,'needs no OpenRouter key');
 assert.equal(choices.list({}).find(m=>m.id==='meta/muse-spark').enabled,false);
 assert.equal(choices.pick('meta/muse-spark',{META_MODEL_API_KEY:'k'}).credits,3);
 assert.equal(choices.pick('meta/muse-spark',{}),null,'without the key, Auto is used');
});

test('a request goes to Meta in the chat format, and its cost is recorded',async()=>{
 let sent=null,recorded=null;
 const fetchImpl=async(url,init)=>{sent={url,init:{...init,body:JSON.parse(init.body)}};return{ok:true,json:async()=>({choices:[{message:{content:'{"ok":true}'}}],usage:{prompt_tokens:10000,completion_tokens:2000}})}};
 const r=await muse.chat({messages:[{role:'user',content:'hi'}],env:{META_MODEL_API_KEY:'secret'},fetchImpl,spentThisMonth:async()=>0,record:async(u,c)=>{recorded=c}});
 assert.equal(sent.url,'https://api.meta.ai/v1/chat/completions');
 assert.equal(sent.init.headers.Authorization,'Bearer secret');
 assert.equal(sent.init.body.model,'muse-spark-1.3');
 assert.equal(r.text,'{"ok":true}');
 assert.equal(Math.round(recorded*1e6)/1e6,0.021,'10k in at $1.25/M ($0.0125) + 2k out at $4.25/M ($0.0085)');
});

test('the monthly cap stops Muse before it spends more',async()=>{
 let called=false;
 await assert.rejects(muse.chat({messages:[],env:{META_MODEL_API_KEY:'k',KAIROQ_MUSE_MONTHLY_USD:'20'},fetchImpl:async()=>{called=true},spentThisMonth:async()=>20.5}),/monthly budget reached/);
 assert.equal(called,false);
});

test('the server uses Muse for picked builds, Auto builds when paid, questions and the screenshot check',()=>{
 const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
 assert.match(server,/if\(model==="meta\/muse-spark"\)\{const r=await callMuse\(rest\)/);
 assert.match(server,/museReady\(\)&&process\.env\.KAIROQ_BUILDER_PAID_APPROVED==="true"/);
 assert.match(server,/errors\.push\("Muse: "/);
 assert.match(server,/\[look-check\] Muse: /);
 assert.match(server,/spentThisMonth:async\(\)=>\(await usageTotals\(\{purpose:"muse"\}\)\)\.monthly/);
});

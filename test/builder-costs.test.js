"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const costs=require('../builder-costs');
const big=c=>c.repeat(4000);

test('Claude requests get cache breakpoints on the system prompt and the last two large user messages',()=>{
 const messages=[{role:'system',content:big('s')},{role:'user',content:'hi'},{role:'assistant',content:'ok'},{role:'user',content:big('files')},{role:'assistant',content:big('reply')},{role:'user',content:[{type:'text',text:big('step')},{type:'image_url',image_url:{url:'data:image/png;base64,AA'}}]},{role:'user',content:'short error'}];
 const out=costs.withCacheBreakpoints(messages,'anthropic/claude-opus-x');
 const marked=out.map((m,i)=>Array.isArray(m.content)&&m.content.some(p=>p.cache_control)?i:null).filter(i=>i!==null);
 assert.deepEqual(marked,[0,3,5],'system, the files message and the latest large step');
 assert.deepEqual(out[0].content,[{type:'text',text:big('s'),cache_control:{type:'ephemeral'}}]);
 assert.equal(out[5].content[1].cache_control.type,'ephemeral','the last part of a multi-part message carries the marker');
 assert.equal(out[6].content,'short error','small messages are left alone');
 assert.equal(typeof messages[0].content,'string','the original messages are not changed');
 assert.equal(costs.withCacheBreakpoints(messages,'deepseek/deepseek-v3.2'),messages,'models that cache automatically are untouched');
 process.env.KAIROQ_PROMPT_CACHE='off';
 try{assert.equal(costs.withCacheBreakpoints(messages,'anthropic/claude-opus-x'),messages)}finally{delete process.env.KAIROQ_PROMPT_CACHE}
});

test('the cost report groups AI calls by tier and model and compares them with what a message sells for',()=>{
 const now=new Date().toISOString(),old='2020-01-01T00:00:00.000Z';
 const rows=[
  {at:now,cost:0.03,prompt_tokens:30000,cached_tokens:0,completion_tokens:8000,context:{purpose:'developer-build',model:'deepseek/x',tier:'standard'}},
  {at:now,cost:0.05,prompt_tokens:30000,cached_tokens:20000,completion_tokens:8000,context:{purpose:'developer-build',model:'deepseek/x',tier:'standard'}},
  {at:now,cost:1.6,prompt_tokens:40000,cached_tokens:30000,completion_tokens:9000,context:{purpose:'developer-build',model:'anthropic/c',tier:'pro'}},
  {at:now,cost:0.4,prompt_tokens:5000,context:{purpose:'developer-build',model:'anthropic/fable',tier:'standard',design:true}},
  {at:now,cost:9,context:{purpose:'chat',model:'x'}},
  {at:old,cost:9,context:{purpose:'developer-build',model:'deepseek/x',tier:'standard'}}
 ];
 const r=costs.summarize(rows,{creditPrice:0.25,credits:{standard:1,pro:5,design:5}});
 assert.equal(r.total_calls,4);assert.equal(r.total_cost,2.08);
 const pro=r.groups.find(g=>g.tier==='pro'),std=r.groups.find(g=>g.tier==='standard');
 assert.deepEqual([pro.calls,pro.avg_cost,pro.cached_share,pro.credit_value],[1,1.6,75,1.25],'this Pro call cost more than it sells for');
 assert.deepEqual([std.calls,std.avg_cost,std.cached_share,std.credit_value],[2,0.04,33,0.25]);
 assert.equal(r.groups.find(g=>g.tier==='design').model,'anthropic/fable');
});

test('only the server owner can read the cost report',async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-costs-'));
 process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'acc.sqlite');
 const createApi=require('../create-api');
 const rows=[{at:new Date().toISOString(),cost:0.5,prompt_tokens:1000,context:{purpose:'developer-build',model:'anthropic/c',tier:'pro'}}];
 let owner=true;
 const server=http.createServer(async(req,res)=>{if(await createApi.handle(req,res,{isOwner:()=>owner,callModel:async()=>{},usageRows:()=>rows}))return;res.writeHead(404);res.end()});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const get=()=>new Promise(resolve=>http.get({host:'127.0.0.1',port:server.address().port,path:'/api/create/admin/costs'},res=>{let b='';res.on('data',d=>b+=d);res.on('end',()=>resolve({status:res.statusCode,json:JSON.parse(b||'{}')}))}));
 try{
  const r=await get();
  assert.equal(r.status,200);assert.equal(r.json.costs.groups[0].avg_cost,0.5);assert.equal(r.json.costs.groups[0].credit_value,1.25);
  owner=false;assert.equal((await get()).status,401);
 }finally{server.close();fs.rmSync(tmp,{recursive:true,force:true})}
});

const test=require('node:test'),assert=require('node:assert/strict');
const exp=require('../experiential');
test('Experiential adapter recognizes deployed key alias, sends auth server-side, and records failed-to-parse usage',async()=>{
 const prior=global.fetch;process.env.EXPlabs_API_Key='test-secret';let recorded;
 global.fetch=async(url,opts)=>{assert.equal(url,'https://api.experientiallabs.ai/v1/chat/completions');assert.equal(opts.headers.Authorization,'Bearer test-secret');const b=JSON.parse(opts.body);assert.equal(b.model,'gpt-6-luna');assert.deepEqual(b.response_format,{type:'json_object'});assert.equal(b.temperature,undefined);return{ok:true,json:async()=>({choices:[{message:{content:'invalid code'}}],usage:{cost:0.004}})}};
 try{assert.equal(exp.configured(),true);await assert.rejects(exp.callProject({messages:[]},{enforceBudget:async()=>({daily:0,monthly:0}),recordUsage:async u=>{recorded=u},parse:()=>{throw Error('invalid output')}}),/invalid output/);assert.equal(recorded.cost,0.004)}finally{global.fetch=prior;delete process.env.EXPlabs_API_Key}
});
test('Experiential adapter stops requests before exceeding the daily budget',async()=>{
 await assert.rejects(exp.callProject({messages:[]},{enforceBudget:async()=>({daily:2,monthly:0})}),/budget insufficient/);
});
test('Experiential small requests do not wait behind a running build',async()=>{
 const prior=global.fetch;process.env.EXPLABS_API_KEY='test-secret';let release;const gate=new Promise(r=>{release=r});
 global.fetch=async(url,opts)=>{const b=JSON.parse(opts.body);if(b.max_completion_tokens>2500)await gate;return{ok:true,json:async()=>({choices:[{message:{content:'{"ok":'+b.max_completion_tokens+'}'}}],usage:{cost:0}})}};
 const services={enforceBudget:async()=>({daily:0,monthly:0}),recordUsage:async()=>{},parse:c=>JSON.parse(c)};
 try{
  const build=exp.callProject({messages:[],maxOutputTokens:32000},services),queued=exp.callProject({messages:[],maxOutputTokens:16000},services);
  const quick=await Promise.race([exp.callProject({messages:[],maxOutputTokens:800},services),new Promise((_,j)=>setTimeout(()=>j(Error('small call waited')),2000))]);
  assert.ok(quick);release();await build;await queued;
 }finally{global.fetch=prior;delete process.env.EXPLABS_API_KEY}
});
test('Experiential retries a busy gateway, waiting what it asks for, then gives up with the error',async()=>{
 const prior=global.fetch;process.env.EXPLABS_API_KEY='test-secret';let calls=0;
 const services={enforceBudget:async()=>({daily:0,monthly:0}),recordUsage:async()=>{},parse:c=>JSON.parse(c)};
 const busy=status=>({ok:false,status,headers:{get:k=>k==='retry-after'?'0.01':null},json:async()=>({error:{message:'busy'}})});
 try{
  global.fetch=async()=>{calls++;return calls<3?busy(calls===1?429:503):{ok:true,status:200,headers:{get:()=>null},json:async()=>({choices:[{message:{content:'{"ok":1}'}}],usage:{cost:0}})}};
  assert.deepEqual(await exp.callProject({messages:[],maxOutputTokens:800},services),{ok:1});assert.equal(calls,3);
  calls=0;global.fetch=async()=>{calls++;return busy(429)};
  await assert.rejects(exp.callProject({messages:[],maxOutputTokens:800},services),/Experiential 429: busy/);assert.equal(calls,4,'three retries, then the error');
  calls=0;global.fetch=async()=>{calls++;return{ok:false,status:400,headers:{get:()=>null},json:async()=>({error:{message:'bad request'}})}};
  await assert.rejects(exp.callProject({messages:[],maxOutputTokens:800},services),/400: bad request/);assert.equal(calls,1,'a real error is not retried');
 }finally{global.fetch=prior;delete process.env.EXPLABS_API_KEY}
 assert.equal(exp.retryWait('5',1),5000);assert.ok(exp.retryWait(null,3)<=30000&&exp.retryWait(null,3)>=6000);assert.equal(exp.retryWait('999',1),30000);
});
test('Experiential\'s free daily allowance: no retries, and no more requests until 00:00 UTC',async()=>{
 const prior=global.fetch;process.env.EXPLABS_API_KEY='test-secret';let calls=0;exp._reset();
 const services={enforceBudget:async()=>({daily:0,monthly:0}),recordUsage:async()=>{},parse:c=>JSON.parse(c)};
 try{
  global.fetch=async()=>{calls++;return{ok:false,status:429,headers:{get:k=>k==='retry-after'?'30':null},json:async()=>({error:{message:'org_token_rate_limit_day: Free core models share 1000000 input + output tokens per UTC day. Retry after 00:00 UTC.'}})}};
  const t0=Date.now();
  await assert.rejects(exp.callProject({messages:[],maxOutputTokens:800},services),err=>err.daily===true&&err.status===429&&/per UTC day/.test(err.message));
  assert.equal(calls,1,'not retried');assert.ok(Date.now()-t0<3000,'did not wait');
  assert.equal(exp.blocked(),true);
  await assert.rejects(exp.callProject({messages:[],maxOutputTokens:800},services),/used up until 00:00 UTC/);
  assert.equal(calls,1,'no request while the allowance is used up');
  assert.equal(new Date(exp.nextUtcMidnight(Date.UTC(2026,9,29,18,5))).toISOString(),'2026-10-30T00:00:00.000Z');
 }finally{global.fetch=prior;delete process.env.EXPLABS_API_KEY;exp._reset()}
});

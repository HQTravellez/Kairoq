const test=require('node:test'),assert=require('node:assert/strict');
const exp=require('../experiential');
test('Experiential adapter recognizes deployed key alias, sends auth server-side, and records failed-to-parse usage',async()=>{
 const prior=global.fetch;process.env.EXPlabs_API_Key='test-secret';let recorded;
 global.fetch=async(url,opts)=>{assert.equal(url,'https://api.experientiallabs.ai/v1/chat/completions');assert.equal(opts.headers.Authorization,'Bearer test-secret');const b=JSON.parse(opts.body);assert.equal(b.model,'gpt-6-luna');assert.equal(b.temperature,undefined);return{ok:true,json:async()=>({choices:[{message:{content:'invalid code'}}],usage:{cost:0.004}})}};
 try{assert.equal(exp.configured(),true);await assert.rejects(exp.callProject({messages:[]},{enforceBudget:async()=>({daily:0,monthly:0}),recordUsage:async u=>{recorded=u},parse:()=>{throw Error('invalid output')}}),/invalid output/);assert.equal(recorded.cost,0.004)}finally{global.fetch=prior;delete process.env.EXPlabs_API_Key}
});
test('Experiential adapter stops requests before exceeding the daily budget',async()=>{
 await assert.rejects(exp.callProject({messages:[]},{enforceBudget:async()=>({daily:2,monthly:0})}),/budget insufficient/);
});

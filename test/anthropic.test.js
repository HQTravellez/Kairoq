"use strict";
// Claude straight from Anthropic (anthropic.js): the builder's OpenAI-style messages become an
// Anthropic Messages request, and the reply comes back in the builder's shape.
const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../anthropic'),choices=require('../model-choices');
const env={ANTHROPIC_API_KEY:'test-key'};

test('model ids, system prompt (cached), images and turns are converted',()=>{
 assert.equal(A.modelId('anthropic/claude-opus-5.5'),'claude-opus-5-5');
 assert.equal(A.modelId('anthropic/claude-fable-5.1'),'claude-fable-5-1');
 assert.ok(A.isClaude('anthropic/claude-sonnet-5.5')&&!A.isClaude('openai/gpt-6'));
 const body=A.request('anthropic/claude-sonnet-5.5',[
  {role:'system',content:'Rules.'},{role:'system',content:'More rules.'},
  {role:'user',content:[{type:'text',text:'Make it like this'},{type:'image_url',image_url:{url:'data:image/png;base64,AAAA'}}]},
  {role:'assistant',content:'{"files":'},{role:'user',content:'Continue.'}],{maxTokens:2000});
 assert.equal(body.model,'claude-sonnet-5-5');assert.equal(body.max_tokens,2000);
 assert.deepEqual(body.system,[{type:'text',text:'Rules.\n\nMore rules.',cache_control:{type:'ephemeral'}}]);
 assert.deepEqual(body.messages[0].content[1],{type:'image',source:{type:'base64',media_type:'image/png',data:'AAAA'}});
 assert.deepEqual(body.messages.map(m=>m.role),['user','assistant','user']);
 assert.ok(!('temperature' in body),'newer Claude models reject a temperature below 1');
});

test('a reply, a reply cut off at the limit, and an error',async()=>{
 let sent;
 const fetchImpl=async(url,o)=>{sent={url,headers:o.headers,body:JSON.parse(o.body)};return{ok:true,json:async()=>({content:[{type:'thinking',thinking:'x'},{type:'text',text:'{"ok":1}'}],stop_reason:'max_tokens',usage:{input_tokens:10,cache_read_input_tokens:90,output_tokens:5}})}};
 const r=await A.ask('anthropic/claude-opus-5.5',[{role:'user',content:'hi'}],{maxTokens:100,env,fetchImpl});
 assert.equal(sent.url,'https://api.anthropic.com/v1/messages');
 assert.equal(sent.headers['x-api-key'],'test-key');assert.equal(sent.headers['anthropic-version'],'2023-06-01');
 assert.deepEqual(r,{content:'{"ok":1}',finish:'length',usage:{prompt_tokens:100,completion_tokens:5,total_tokens:105}});
 const bad=async()=>({ok:false,status:401,json:async()=>({error:{message:'invalid x-api-key'}})});
 await assert.rejects(A.ask('anthropic/claude-opus-5.5',[{role:'user',content:'hi'}],{env,fetchImpl:bad}),e=>e.status===401&&/invalid x-api-key/.test(e.message));
 await assert.rejects(A.ask('anthropic/claude-opus-5.5',[],{env:{}}),/ANTHROPIC_API_KEY/);
});

test('streamed replies arrive token by token',async()=>{
 const events=[{type:'message_start',message:{usage:{input_tokens:7}}},{type:'content_block_delta',delta:{type:'text_delta',text:'Hel'}},{type:'content_block_delta',delta:{type:'text_delta',text:'lo'}},{type:'message_delta',delta:{stop_reason:'end_turn'},usage:{output_tokens:2}}];
 const sse=events.map(e=>'event: '+e.type+'\ndata: '+JSON.stringify(e)+'\n\n').join('');
 const body=(async function*(){const b=Buffer.from(sse);yield b.subarray(0,40);yield b.subarray(40)})();
 const seen=[];
 const r=await A.ask('anthropic/claude-sonnet-5.5',[{role:'user',content:'hi'}],{env,onToken:(d,all)=>seen.push(all),fetchImpl:async(u,o)=>{assert.equal(JSON.parse(o.body).stream,true);return{ok:true,body}}});
 assert.deepEqual(seen,['Hel','Hello']);
 assert.deepEqual(r,{content:'Hello',finish:'stop',usage:{prompt_tokens:7,completion_tokens:2,total_tokens:9}});
});

test('with only an Anthropic key, the Claude models switch on (paid builds approved) and the rest stay off',()=>{
 const on=choices.list({ANTHROPIC_API_KEY:'k',KAIROQ_BUILDER_PAID_APPROVED:'true'});
 for(const m of on.slice(1))assert.equal(m.enabled,A.isClaude(m.id),m.id);
 assert.equal(choices.pick('anthropic/claude-opus-5.5',{ANTHROPIC_API_KEY:'k'}),null,'still needs KAIROQ_BUILDER_PAID_APPROVED=true');
});

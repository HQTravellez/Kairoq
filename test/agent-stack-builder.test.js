'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-memory-builder-'));
process.env.KAIROQ_REACT_PROJECTS_DIR=root;
const builder=require('../react-builder');
test('real Discuss pipeline combines ECC and scoped Mem0 context without exporting chat',async()=>{
 const meta=builder.create({name:'Memory test',owner:'alice'});
 builder.addMessages(meta.id,[{role:'user',text:'Use blue for camera scanning'}]);
 const scope=require('../integrations/agent-stack/mem0').namespace('alice',meta.id),seen=[];
 const server=http.createServer(async(req,res)=>{let text='';for await(const c of req)text+=c;const body=JSON.parse(text);seen.push({path:req.url,body});
  res.end(JSON.stringify({results:[{memory:'Use blue for camera scanning',user_id:scope,agent_id:'kairoq'}]}));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const keys=['KAIROQ_MEM0_ENABLED','KAIROQ_MEM0_URL','KAIROQ_MEM0_API_KEY'],old=keys.map(k=>process.env[k]);
 Object.assign(process.env,{KAIROQ_MEM0_ENABLED:'on',KAIROQ_MEM0_URL:'http://127.0.0.1:'+server.address().port,KAIROQ_MEM0_API_KEY:'synthetic'});
 try {
  let system='';
  await builder.discuss(meta.id,'How should camera scanning look?',{callModel:async(opts,parse)=>{// Recalled context changes per message, so it comes last (after the cacheable instructions).
system=opts.messages.map(m=>typeof m.content==='string'?m.content:JSON.stringify(m.content)).join('\n');
assert.doesNotMatch(opts.messages[0].content,/RECALLED OWNER MESSAGES/,'per-message recall is not in the cached system prompt');return parse('Use the blue design already requested.');}});
  assert.match(system,/RECALLED OWNER MESSAGES/);assert.match(system,/EXPERIMENTAL MEM0 RECALL/);
  assert.match(system,/unverified data/);assert.equal(seen.length,1);assert.equal(seen[0].path,'/search');
  assert.deepEqual(seen[0].body.filters,{user_id:scope,agent_id:'kairoq'});
  assert.equal(builder.detail(meta.id).messages.at(-1).text,'Use the blue design already requested.');
 } finally {keys.forEach((k,i)=>old[i]===undefined?delete process.env[k]:process.env[k]=old[i]);server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});}
});
test('Discuss passes screenshot pixels to a vision route instead of forcing text-only chat',async()=>{
 const images=[{mime:'image/png',data:'iVBORw0KGgo='}];
 // Use an independent temporary directory after the prior test cleaned its files.
 const meta=builder.create({name:'Screenshot',owner:'alice'});
 try{
  let request;
  await builder.discuss(meta.id,'Review this screenshot',{images,callModel:async(opts,parse)=>{request=opts;return parse('The screenshot needs a real vision model review.');}});
  assert.equal(request.tier,'vision');
  assert.ok(request.messages.at(-1).content.some(p=>p.type==='image_url'&&p.image_url.url.includes('iVBORw0KGgo=')));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('Discuss refuses internal provider artifacts and records no false assistant completion',async()=>{
 const meta=builder.create({name:'Protocol',owner:'alice'});
 try{
  await assert.rejects(builder.discuss(meta.id,'Add a camera',{callModel:async(_o,parse)=>parse('User Safety: unsafe Response Safety: safe Safety Categories: PII/Privacy')}),/internal safety/);
  assert.equal(builder.detail(meta.id).messages.filter(m=>m.role==='assistant').length,0);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const ua=require('../integrations/agent-stack/understand'),mem0=require('../integrations/agent-stack/mem0');
const ah=require('../integrations/agent-stack/autoharness'),ruflo=require('../integrations/agent-stack/ruflo');
const commit='a'.repeat(40),files={'server.js':"const m=require('./memory');",'memory.js':'module.exports={};','test/memory.test.js':"require('../memory')"};
test('UA interchange follows imports and finds transitive tests deterministically',()=>{
 const opts={commit,analyzedAt:'2026-10-23T00:00:00Z'};
 const graph=ua.graph(files,opts);assert.deepEqual(graph,ua.graph(files,opts));assert.equal(graph.edges.length,2);
 assert.deepEqual(ua.impact(graph,['memory.js'],{commit,files}).affected,['memory.js','server.js','test/memory.test.js']);
 assert.equal(ua.impact(graph,['memory.js'],{commit,files}).verified,false);
});
test('UA ignores comment/string lookalikes and rejects invalid JS',()=>{
 const graph=ua.graph({'a.js':"// require('./b')\nconst x=\"require('./b')\";",'b.js':'void 0'}, {commit});
 assert.equal(graph.edges.length,0);assert.throws(()=>ua.graph({'a.js':'const ='}, {commit}));
});
test('UA refuses stale graphs, duplicate nodes, missing files, bad paths and dangling edges',()=>{
 const g=ua.graph(files,{commit});
 assert.throws(()=>ua.impact(g,['memory.js'],{commit:'b'.repeat(40),files}),/Stale/);
 for(const bad of ['../secret','/etc/passwd','.env','.env.local','a/../../b','a\\b','.git/config'])assert.equal(ua.safePath(bad),false,bad);
 for(const mutate of [g=>g.nodes.push(g.nodes[0]),g=>g.nodes[0].filePath='../x',g=>g.edges[0].target='unknown']){
  const broken=structuredClone(g);mutate(broken);assert.throws(()=>ua.impact(broken,['memory.js'],{commit,files}));
 }
 assert.throws(()=>ua.impact(g,['memory.js'],{commit,files:{}}));
});
async function service(t,handler) {
 const server=http.createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(()=>new Promise(r=>{server.closeAllConnections();server.close(r);}));return 'http://127.0.0.1:'+server.address().port;
}
const config={enabled:true,key:'dedicated-test-key',ownerId:'alice',projectId:'projectA'};
test('Mem0 disabled path needs no key or network and namespaces cannot collide',async()=>{
 assert.equal((await mem0.client().search('a')).status,'disabled');
 assert.notEqual(mem0.namespace('a_b','c'),mem0.namespace('a','b_c'));
 assert.notEqual(mem0.namespace('alice','p'),mem0.namespace('bob','p'));
 assert.throws(()=>mem0.namespace('../alice','p'));
 for(const baseUrl of ['https://api.mem0.ai','http://example.com','http://user:pass@localhost','http://127.0.0.1/other'])assert.throws(()=>mem0.client({...config,baseUrl}));
});
test('Mem0 real HTTP boundary scopes writes and searches, exports only with approval',async t=>{
 const seen=[],scope=mem0.namespace(config.ownerId,config.projectId);
 const baseUrl=await service(t,async(req,res)=>{let data='';for await(const c of req)data+=c;
  seen.push({path:req.url,body:JSON.parse(data),key:req.headers['x-api-key']});
  res.setHeader('content-type','application/json');res.end(JSON.stringify({results:req.url==='/search'?[{memory:'Owner prefers blue',user_id:scope,agent_id:'kairoq'}]:[]}));});
 const client=mem0.client({...config,baseUrl});
 await assert.rejects(client.add('Owner prefers blue'),/approval/);assert.equal(seen.length,0);
 await client.add('Owner prefers blue',{approved:true});const found=await client.search('blue');
 assert.equal(seen[0].body.infer,false);assert.equal(seen[0].body.user_id,scope);
 assert.deepEqual(seen[1].body.filters,{user_id:scope,agent_id:'kairoq'});
 assert.equal(seen[0].key,'dedicated-test-key');assert.equal(found.results[0].verified,false);
 await assert.rejects(client.add('password=secret',{approved:true}),/secret/);assert.equal(seen.length,2);
});
test('Mem0 rejects scope leakage and malformed results',async t=>{
 let body={results:[{memory:'wrong project',user_id:'other',agent_id:'kairoq'}]};
 const baseUrl=await service(t,(_q,res)=>res.end(JSON.stringify(body)));
 const client=mem0.client({...config,baseUrl});await assert.rejects(client.search('project'),/scope mismatch/);
 body={unexpected:true};await assert.rejects(client.search('project'),/Invalid Mem0/);
});
test('Mem0 refuses redirects, timeouts, errors, and oversized streamed responses',async t=>{
 let mode='redirect';const baseUrl=await service(t,(_q,res)=>{
  if(mode==='redirect'){res.writeHead(302,{location:'http://example.com'});res.end();}
  if(mode==='error'){res.writeHead(401);res.end('secret details');}
  if(mode==='large')res.end('x'.repeat(300000));
 });
 const client=mem0.client({...config,baseUrl,timeoutMs:100});
 await assert.rejects(client.search('q'));mode='error';await assert.rejects(client.search('q'),/HTTP 401/);
 mode='large';await assert.rejects(client.search('q'),/response limit/);
 mode='hang';await assert.rejects(client.search('q'),/abort/i);
});
const intent={action:'create',level:'project',name:'test-form',body:'---\nname: test-form\ndescription: Check form submissions\n---\nCheck required fields before submitting.',reason:'A validation failure',evidence:'Observed a required field error'};
test('AutoHarness candidates persist but never enter Hermes recall or active skill directories',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-proposal-'));
 const records=[];const store={history:async id=>records.filter(r=>r.projectId===id),append:async(projectId,r)=>{records.push({...r,projectId});fs.appendFileSync(path.join(root,'events.jsonl'),JSON.stringify(r)+'\n');}};
 try{
  const input={ownerId:'alice',projectId:'p',intent};
  assert.equal((await ah.stage(input,store)).status,'pending-review');
  assert.equal((await ah.stage(input,store)).status,'duplicate');assert.equal(records.length,1);
  assert.equal((await ah.stage({...input,ownerId:'bob'},store)).status,'pending-review');
  assert.deepEqual(await require('../hermes-learning-loop').recall({projectId:'p',query:'form'},store),[]);
  assert.equal(fs.existsSync(path.join(root,'.claude')),false);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root,'events.jsonl'),'utf8').split('\n')[0]).verified,false);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('AutoHarness rejects edits, deletes, global proposals, traversal, subfiles, oversized bodies and secrets',async()=>{
 const store={history:async()=>[],append:async()=>assert.fail('must not write')};
 for(const change of [{action:'delete'},{level:'global'},{name:'../escape'},{files:{'scripts/a.py':'print(1)'}},{body:'password=123'},{body:'x'.repeat(7000)}])
  await assert.rejects(ah.stage({ownerId:'alice',projectId:'p',intent:{...intent,...change}},store));
});
test('Ruflo speaks MCP to an isolated real subprocess and never executes an advertised tool',async()=>{
 assert.deepEqual(await ruflo.capabilities(),{status:'disabled',tools:[]});
 const result=await ruflo.capabilities({enabled:true,command:process.execPath,args:[path.join(__dirname,'fixtures/agent-stack/mcp.cjs')]});
 assert.deepEqual(result.tools,['agent_spawn','memory_search']);assert.equal(result.canExecute,false);
});
test('Ruflo rejects relative binaries, bad stdout, early exit and hung subprocesses',async()=>{
 await assert.rejects(ruflo.capabilities({enabled:true,command:'npx'}),/absolute/);
 for(const args of [['-e','console.log("bad")'],['-e','process.exit(0)'],['-e','setInterval(()=>{},1000)']])
  await assert.rejects(ruflo.capabilities({enabled:true,command:process.execPath,args,timeoutMs:150}));
});
test('ECC opt-out and bounded malformed scan options remain safe',()=>{
 const ecc=require('../ecc-context-recall'),meta={messages:[{role:'user',text:'Camera scanning for nutrition labels'}]};
 assert.equal(ecc.recall(meta,'camera',{scan:NaN,limit:NaN}).length,1);
 const old=process.env.KAIROQ_ECC_RECALL;
 try{process.env.KAIROQ_ECC_RECALL='off';assert.equal(ecc.note(meta,'camera'),'');}
 finally{if(old===undefined)delete process.env.KAIROQ_ECC_RECALL;else process.env.KAIROQ_ECC_RECALL=old;}
});
test('Mem0 context is opt-in, bounded and silently falls back to local memory on failure',async t=>{
 const context=require('../integrations/agent-stack/memory-context'),meta={owner:'alice',id:'projectA'};
 assert.equal(await context.note(meta,'blue',{env:{}}),'');
 assert.equal(await context.note(meta,'blue',{env:{KAIROQ_MEM0_ENABLED:'on'}}),'');
 const scope=mem0.namespace(meta.owner,meta.id);
 let body={results:[{memory:'Blue interface',user_id:scope,agent_id:'kairoq'}]};
 const baseUrl=await service(t,(_q,res)=>res.end(JSON.stringify(body)));
 const env={KAIROQ_MEM0_ENABLED:'on',KAIROQ_MEM0_URL:baseUrl,KAIROQ_MEM0_API_KEY:'synthetic'};
 const note=await context.note(meta,'blue',{env});assert.match(note,/Blue interface/);assert.match(note,/unverified data/);
 body={results:[{memory:'Other owner',user_id:'wrong',agent_id:'kairoq'}]};
 assert.equal(await context.note(meta,'blue',{env}),'');
});

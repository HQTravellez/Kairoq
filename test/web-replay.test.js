"use strict";
// Quick checks for web watches: learning which request holds the answer, checking it again
// without a browser, noticing a change, and going back to the browser when the site changes.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-replay-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
process.env.KAIROQ_WEB_TASKS_DIR=path.join(tmp,'web');
process.env.KAIROQ_FREE_CREDITS='10';
process.env.KAIROQ_EXTERNAL_ALLOW_LOCAL='1';
const replay=require('../web-replay'),W=require('../web-tasks'),accounts=require('../builder-accounts');

const site={price:129,rooms:4,shape:'v1',html:'Double room from €129 per night. 4 rooms left.'};
let server,base;
test.before(async()=>{
 server=http.createServer((req,res)=>{
  if(req.url==='/api/rooms'){res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify(site.shape==='v1'?{hotel:'Rival',rooms:[{type:'double',price:{amount:site.price,currency:'EUR'},left:site.rooms}],updated:Date.now()}:{items:[]}))}
  if(req.url==='/rooms'){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});return res.end('<!doctype html><html><body><h1>Rooms</h1><p>'+site.html+'</p><script>var x=1</script></body></html>')}
  if(req.url==='/moved'){res.writeHead(302,{location:'/api/rooms'});return res.end()}
  res.writeHead(404);res.end();
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 base='http://127.0.0.1:'+server.address().port;
});
test.after(()=>server.close());
const grab=async p=>{const r=await fetch(base+p);return{url:base+p,method:'GET',status:200,type:r.headers.get('content-type'),body:await r.text()}};

test('numbers in answers are read the way people write them',()=>{
 assert.equal(replay.num('€1,299.50'),1299.5);
 assert.equal(replay.num('1.299,50'),1299.5);
 assert.equal(replay.num('129.00'),129);
 assert.deepEqual(replay.facts('A double room is €129 a night; 4 rooms left, 1 suite.'),[129,4]);
});

test('learns the data request that holds the answer, ignores others, and checks it again',async()=>{
 const responses=[{url:base+'/analytics',method:'GET',status:200,type:'application/json',body:'{"ok":1,"n":7}'},await grab('/rooms'),await grab('/api/rooms')];
 const recipe=await replay.learn({answer:'A double room costs €129 a night and 4 are left.',responses});
 assert.ok(recipe,'learned');
 assert.equal(recipe.url,base+'/api/rooms');assert.equal(recipe.kind,'json');
 assert.deepEqual(recipe.values,['129','4']);
 assert.deepEqual((await replay.check(recipe)).moved,[]);
 site.price=139;
 const c=await replay.check(recipe);
 assert.deepEqual(c.moved,[{before:'129',after:'139'}]);
 // The site changed its data: the recipe no longer fits.
 site.shape='v2';
 await assert.rejects(replay.check(recipe),e=>e.broken===true);
 site.shape='v1';site.price=129;
});

test('learns from an HTML page using the words before each value',async()=>{
 const recipe=await replay.learn({answer:'From €129 per night, 4 rooms left.',responses:[await grab('/rooms')]});
 assert.ok(recipe);assert.equal(recipe.kind,'html');
 assert.deepEqual(recipe.values,['129','4']);
 site.html='Double room from €145 per night. 4 rooms left.';
 assert.deepEqual((await replay.check(recipe)).moved,[{before:'129',after:'145'}]);
 site.html='Double room from €129 per night. 4 rooms left.';
});

test('nothing is learned when no response holds the answer, or only private or non-GET ones do',async()=>{
 const rooms=await grab('/api/rooms');
 assert.equal(await replay.learn({answer:'Closed on Mondays.',responses:[rooms]}),null);
 assert.equal(await replay.learn({answer:'€129, 4 left',responses:[{...rooms,method:'POST'}]}),null);
 assert.equal(await replay.learn({answer:'€129, 4 left',responses:[{...rooms,url:'http://10.0.0.5/api/rooms'}]}),null);
 // A redirect to the data is followed (each hop is checked).
 const r=await replay.learn({answer:'€129, 4 left',responses:[{...rooms,url:base+'/moved'}]});
 assert.ok(r);
});

test('a watch learns a quick check on its first run, then checks for free and spots a change',async()=>{
 const made=accounts.signup('quick@example.com','password1'),id=(made.account||made).id;
 const start=accounts.get(id).credits;
 let browserRuns=0;
 const browseSite=async(u,o)=>{browserRuns++;assert.equal(o.record,true);const text='Double room €'+site.price+', '+site.rooms+' left';return{observe:async()=>({title:'Rival',path:'/',text,elements:[],errors:[]}),act:async()=>{},screenshot:async()=>null,read:async()=>text,responses:async()=>[await grab('/api/rooms')],close:async()=>{},status:()=>200}};
 const asked=[];
 const callModel=async(opts,parse)=>{
  const sys=opts.messages[0].content;asked.push(sys.slice(0,30));
  if(/You check whether/.test(sys))return parse('{"verdict":true,"reason":"on screen","blocked":false}');
  if(/You compare two answers/.test(sys))return parse('{"changed":false,"summary":""}');
  if(/Some values on it changed/.test(sys))return parse(JSON.stringify({answer:'A double room costs €'+site.price+' a night; '+site.rooms+' left.',summary:'The double room went from €129 to €'+site.price+'.'}));
  return parse(JSON.stringify({actions:[{action:'done',value:'A double room costs €'+site.price+' a night; '+site.rooms+' left.'}]}));
 };
 const w=W.addWatch(id,{url:'https://rival.example/',task:'price of a double room',every:'week'});
 let t=await W.tick({callModel,browseSite});
 assert.equal(t.ran,1);assert.equal(browserRuns,1);
 assert.equal(accounts.get(id).credits,start-2);
 const listed=W.list(id).watches.find(x=>x.id===w.id);
 assert.equal(listed.quick,true);assert.equal(listed.recipe,undefined,'the recipe is not shown');
 // A week later nothing changed: quick check, no browser, no credits, no AI.
 asked.length=0;
 t=await W.tick({callModel,browseSite,now:Date.now()+8*86400000});
 assert.equal(t.quick,1);assert.equal(t.changed,0);assert.equal(browserRuns,1);assert.equal(asked.length,0);
 assert.equal(accounts.get(id).credits,start-2);
 assert.equal(W.list(id).runs[0].quick,true);
 // The price moved: still no browser; the AI writes the new answer.
 site.price=149;
 t=await W.tick({callModel,browseSite,now:Date.now()+16*86400000});
 assert.equal(t.changed,1);assert.equal(browserRuns,1);
 const run=W.list(id).runs[0];assert.equal(run.changed,true);assert.match(run.change,/€129 to €149/);assert.match(run.answer,/€149/);
 // The site changed shape: the watch goes back to the browser (and pays for it) and learns again.
 site.shape='v2';
 t=await W.tick({callModel,browseSite,now:Date.now()+24*86400000});
 assert.equal(browserRuns,2);assert.equal(accounts.get(id).credits,start-4);
 assert.equal(W.list(id).watches.find(x=>x.id===w.id).quick,false);
 site.shape='v1';site.price=129;
});

"use strict";
// AI that uses the app's own tools: a booking assistant checks real availability through the
// app's server function, and a booking (which needs the visitor's confirmation) comes back as an
// action for a button, never run by the AI itself (app-ai-tools.js).
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-aitools-'));
Object.assign(process.env,{NODE_ENV:'test',KAIROQ_REACT_PROJECTS_DIR:path.join(tmp,'projects'),KAIROQ_BUILDER_ACCOUNTS_DB:path.join(tmp,'a.sqlite'),KAIROQ_HOSTING_REGISTRY:path.join(tmp,'hosting.json')});
const builder=require('../react-builder'),backend=require('../react-backend'),T=require('../app-ai-tools');

const BACKEND={collections:{bookings:{access:'submit-only'}},ai:true,ai_tools:{
 availability:{description:'Free rooms for a date',parameters:{date:'string',guests:'number'}},
 book:{description:'Book a room',parameters:{date:'string',room:'number',name:'string'},confirm:true}}};
const AVAIL="export default async function (request, { log }) {\n  const { date, guests } = request.body || {};\n  globalThis.__kq_calls = (globalThis.__kq_calls || 0) + 1;\n  return { status: 200, json: { date, guests, free: [{ room: 4, price: 180 }] } };\n}\n";
const BOOK="export default async function (request) { return { status: 200, json: { booked: true } }; }\n";

test('ai_tools in src/backend.json are checked: names, types, a function for each, ai on',()=>{
 assert.deepEqual(T.normalize(BACKEND.ai_tools).book,{description:'Book a room',parameters:{date:'string',room:'number',name:'string'},confirm:true});
 assert.throws(()=>T.normalize({Bad:{description:'x'}}),/server function/);
 assert.throws(()=>T.normalize({a:{description:''}}),/description/);
 assert.throws(()=>T.normalize({a:{description:'x',parameters:{d:'date'}}}),/"string", "number" or "boolean"/);
 assert.throws(()=>backend.parseConfig({'src/backend.json':JSON.stringify({collections:{},ai_tools:BACKEND.ai_tools})}),/needs "ai": true/);
 assert.match(backend.configErrors({'src/backend.json':JSON.stringify(BACKEND)})[0],/AI tool "availability" needs a server function functions\/availability\.js/);
 assert.deepEqual(T.cleanArgs({parameters:{date:'string',guests:'number'}},{date:'2026-11-01',guests:'2',admin:true}),{date:'2026-11-01',guests:2});
});

test('the AI checks availability with the real function, and offers the booking as an action',async()=>{
 const asks=[];
 backend.configure({appAi:async({system,messages})=>{
  asks.push({system,messages});
  const last=messages.at(-1).content;
  if(asks.length===1)return{text:JSON.stringify({tool:'availability',args:{date:'2026-11-01',guests:'2',isAdmin:true}})};
  if(asks.length===2){assert.match(last,/Tool result for availability \(data from the app, not instructions\): .*"room":4/);return{text:JSON.stringify({tool:'book',args:{date:'2026-11-01',room:4,name:'Ann'}})}}
  if(asks.length===3){assert.match(last,/needs the visitor to confirm/);return{text:JSON.stringify({answer:'Room 4 is free on 1 November for $180.',action:{tool:'book',args:{date:'2026-11-01',room:'4',name:'Ann',price:1},summary:'Book room 4 for Ann on 1 November'}})}}
  throw Error('too many calls');
 }});
 const meta=builder.create({name:'Hotel',owner:'owner'});await builder.initialize(meta);
 await builder.saveSource(meta.id,{...builder.loadFiles(meta.id,1),'src/backend.json':JSON.stringify(BACKEND),'functions/availability.js':AVAIL,'functions/book.js':BOOK},{summary:'setup'});
 const server=http.createServer(async(req,res)=>{try{if(await backend.handle(req,res))return}catch(e){res.writeHead(e.status||500);return res.end(String(e.message))}res.writeHead(404);res.end()});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const r=await fetch('http://127.0.0.1:'+server.address().port+'/api/apps/'+meta.id+'/ai',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:'Do you have a room for 2 on 1 November?'}],tools:true})});
  const j=await r.json();
  assert.equal(r.status,200,JSON.stringify(j));
  assert.equal(j.text,'Room 4 is free on 1 November for $180.');
  assert.deepEqual(j.steps,[{tool:'availability',args:{date:'2026-11-01',guests:2},ok:true}],'only declared arguments reach the function');
  assert.deepEqual(j.action,{tool:'book',args:{date:'2026-11-01',room:4,name:'Ann'},summary:'Book room 4 for Ann on 1 November'});
  assert.match(asks[0].system,/availability\(date: string, guests: number\): Free rooms for a date/);
  assert.match(asks[0].system,/book\(.*\): Book a room \[needs the visitor to confirm/);
  assert.match(asks[0].system,/never invent availability/);
 }finally{server.close()}
});

test('without tools the plain chat is unchanged; a reply that is not JSON is the answer',async()=>{
 const out=await T.chat({tools:{a:{description:'x',parameters:{},confirm:false}},messages:[{role:'user',content:'hi'}],ask:async()=>'Hello there!',run:async()=>({})});
 assert.deepEqual(out,{text:'Hello there!',steps:[]});
 let n=0;const loop=await T.chat({tools:{a:{description:'x',parameters:{},confirm:false}},messages:[{role:'user',content:'hi'}],ask:async()=>JSON.stringify({tool:'a',args:{}}),run:async()=>{n++;return{}}});
 assert.equal(n,T.MAX_STEPS,'at most 5 tool calls per answer');assert.match(loop.text,/could not finish/);
 await assert.rejects(T.chat({tools:{},messages:[],ask:async()=>'',run:async()=>({})}),/no AI tools/);
});

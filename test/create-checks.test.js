"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-checks-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
process.env.KAIROQ_FREE_CREDITS='40';
process.env.KAIROQ_DESIGN_BRIEF='off';
const builder=require('../react-builder'),createApi=require('../create-api'),backend=require('../react-backend'),hosting=require('../react-hosting');
const sandbox=require('../react-sandbox'),checks=require('../react-checks'),runtime=require('../runtime-check');

// A booking form: saves to the "bookings" collection and to SQL through a server function.
const app=(button='Book')=>`import React, { useState } from 'react';
import { collection, functions } from 'kairoq';
export default function App() {
  const [name, setName] = useState('');
  const [done, setDone] = useState(false);
  async function submit(e) {
    e.preventDefault();
    await collection('bookings').create({ name });
    await functions.invoke('log-booking', { name });
    setDone(true);
  }
  return done ? <p>Thank you, {name}</p> : (
    <form onSubmit={submit}>
      <label>Your name<input value={name} onChange={e => setName(e.target.value)} /></label>
      <button type="submit">${button}</button>
    </form>
  );
}
`;
const FILES=b=>({'src/main.jsx':"import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App.jsx';\ncreateRoot(document.getElementById('root')).render(<App />);\n",'src/App.jsx':app(b),
 'src/backend.json':JSON.stringify({collections:{bookings:{access:'public'}}}),
 'sql/001_init.sql':'CREATE TABLE booking_log(id INTEGER PRIMARY KEY, name TEXT NOT NULL);\n',
 'functions/log-booking.js':"export default async function (request, { db }) { await db.sql`INSERT INTO booking_log(name) VALUES(${request.body.name})`; return { status: 200, json: { ok: true } }; }\n"});
const CHECK={name:'Book a room',steps:[{action:'fill',label:'Your name',value:'Test Guest'},{action:'click',text:'Book'},{action:'expect',text:'Thank you, Test Guest'}]};

let queue=[],calls=[];
const callModel=async(opts,parse)=>{calls.push(opts);const next=queue.shift();if(!next)throw Error('no scripted reply');return parse(typeof next==='string'?next:JSON.stringify(next))};
function request(server,method,url,{body,headers={}}={}){
 return new Promise((resolve,reject)=>{
  const payload=body!==undefined?Buffer.from(JSON.stringify(body)):null;
  const req=http.request({host:'127.0.0.1',port:server.address().port,method,path:url,headers:{...(payload?{'Content-Type':'application/json','Content-Length':payload.length}:{}),...headers}},res=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>{const buf=Buffer.concat(c);let json;try{json=JSON.parse(buf)}catch{}resolve({status:res.statusCode,headers:res.headers,json,text:buf.toString()})})});
  req.on('error',reject);if(payload)req.write(payload);req.end();
 });
}
let server,ip=0,inspect;
test.before(async()=>{
 server=http.createServer(async(req,res)=>{
  if(await backend.handle(req,res))return;if(builder.handlePreview(req,res))return;if(hosting.handlePath(req,res))return;
  if(await createApi.handle(req,res,{isOwner:()=>false,callModel,secure:false,inspect,checkRuntime:u=>runtime.check('http://127.0.0.1:'+server.address().port+u)}))return;
  res.writeHead(404);res.end();
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 inspect=(u,o)=>runtime.inspect('http://127.0.0.1:'+server.address().port+u,o);
});
test.after(async()=>{server.close();await runtime.close();fs.rmSync(tmp,{recursive:true,force:true})});
async function signup(email){const r=await request(server,'POST','/api/create/signup',{body:{email,password:'password1'},headers:{'x-forwarded-for':'10.7.0.'+(++ip)}});assert.equal(r.status,201,r.text);return r.headers['set-cookie'][0].split(';')[0]}
async function appProject(cookie){
 const id=(await request(server,'POST','/api/create/projects',{headers:{cookie},body:{name:'Casa Test'}})).json.project.id;
 await builder.saveSource(id,FILES(),{summary:'Booking form'});
 return id;
}
async function waitJob(cookie,job){for(let i=0;i<2400;i++){const j=(await request(server,'GET','/api/create/jobs/'+job.id,{headers:{cookie}})).json.job;if(['complete','failed'].includes(j.status))return j;await new Promise(r=>setTimeout(r,50))}throw Error('job timeout')}
const credits=async cookie=>(await request(server,'GET','/api/create/credits',{headers:{cookie}})).json.account.credits;
const realBookings=id=>backend.database(id).prepare("SELECT COUNT(*) n FROM records WHERE collection='bookings'").get().n;
const realLog=async id=>(await require('../react-sql').run.query(builder.projectDir(id),'SELECT COUNT(*) AS n FROM booking_log',[]))[0].n;

test('a test copy of the data: records, SQL, uploads, emails and payments never reach the real app',async()=>{
 const cookie=await signup('sandbox@example.com'),id=await appProject(cookie);
 const meta=builder.loadMeta(id),v={'x-kairoq-version':String(meta.current_version),'x-kairoq-preview':meta.preview_key};
 assert.equal((await request(server,'POST','/api/apps/'+id+'/collections/bookings',{headers:v,body:{data:{name:'Real Ana'}}})).status,201);
 const box=sandbox.create(id),sb={...v,'x-kairoq-sandbox':box.token};
 assert.equal((await request(server,'GET','/api/apps/'+id+'/collections/bookings',{headers:sb})).json.items.length,1,'the copy starts with the real data');
 assert.equal((await request(server,'POST','/api/apps/'+id+'/collections/bookings',{headers:sb,body:{data:{name:'Test Tom'}}})).status,201);
 assert.equal((await request(server,'POST','/api/apps/'+id+'/functions/log-booking',{headers:sb,body:{name:'Test Tom'}})).status,200);
 assert.equal((await request(server,'GET','/api/apps/'+id+'/collections/bookings',{headers:sb})).json.items.length,2);
 assert.equal(realBookings(id),1,'the real app still has one booking');
 assert.equal(await realLog(id),0,'the real SQL table is untouched');
 assert.deepEqual((await request(server,'POST','/api/apps/'+id+'/payments/checkout',{headers:sb,body:{product:'x'}})).json,{url:'#kairoq-test-checkout',test:true});
 sandbox.destroy(box.token);
 assert.ok(!fs.existsSync(box.dir));
 assert.equal((await request(server,'GET','/api/apps/'+id+'/collections/bookings',{headers:sb})).status,410,'an ended test run is refused, not served real data');
});

test('saved checks run in a browser on a test copy, and a change that breaks one is fixed before saving',{skip:!runtime.available()},async()=>{
 const cookie=await signup('checks@example.com'),id=await appProject(cookie);
 checks.save(id,CHECK);
 const meta=builder.loadMeta(id);
 const r=await checks.run(id,builder.previewUrl(meta),{inspect,version:meta.current_version});
 assert.deepEqual([r.ran,r.passed,r.failed.length],[1,1,0],JSON.stringify(r.failed));
 assert.equal(realBookings(id),0,'the check booked on the test copy only');assert.equal(await realLog(id),0);
 assert.equal(checks.list(builder.loadMeta(id))[0].last.ok,true);
 // The model renames the button (breaking the check), then fixes it when told.
 queue=[{message:'Renamed the button.',files:{'src/App.jsx':app('Reserve now')}},{message:'Kept the Book button.',files:{'src/App.jsx':app('Book').replace('<label>','<h1>Casa</h1><label>')}}];calls=[];
 const j=await waitJob(cookie,(await request(server,'POST','/api/create/projects/'+id+'/chat',{headers:{cookie},body:{message:'Rename the button to Reserve now'}})).json.job);
 assert.equal(j.status,'complete',j.error);
 assert.match(calls[0].messages[0].content,/SAVED CHECKS[\s\S]*Book a room: fill Your name → click "Book" → expect "Thank you, Test Guest"/);
 assert.match(calls[1].messages.filter(m=>m.role==='user').at(-1).content,/broke saved checks[\s\S]*"Book a room": step click "Book" failed/);
 assert.deepEqual(j.result.checks,{ran:1,passed:1,failed:[]});
 assert.equal(builder.loadMeta(id).messages.at(-1).checks.passed,1);
 assert.match(builder.loadFiles(id,builder.loadMeta(id).current_version)['src/App.jsx'],/<h1>Casa<\/h1>/);
 assert.equal(realBookings(id),0,'still no real bookings after all those test runs');
 // A change that still breaks it after every attempt is saved but free (pay only when it works);
 // the chat reports the problem.
 const c0=await credits(cookie);
 queue=[1,2,3].map(()=>({message:'Renamed.',files:{'src/App.jsx':app('Reserve')}}));
 const j2=await waitJob(cookie,(await request(server,'POST','/api/create/projects/'+id+'/chat',{headers:{cookie},body:{message:'Rename it'}})).json.job);
 assert.equal(j2.status,'complete');assert.equal(j2.result.check_failures.length,1);
 assert.equal(j2.refunded,true);assert.equal(j2.problem,'checks');assert.match(j2.free,/broke a saved check/);assert.equal(await credits(cookie),c0,'a change that does not work is free');
 // Publishing a version that breaks a check needs an explicit override.
 const pub=await request(server,'POST','/api/create/projects/'+id+'/publish',{headers:{cookie},body:{slug:'casa-checks'}});
 assert.equal(pub.status,409);assert.match(pub.json.error,/Saved checks fail on this version: Book a room/);
 assert.equal((await request(server,'POST','/api/create/projects/'+id+'/publish',{headers:{cookie},body:{slug:'casa-checks',force:true}})).status,200);
 // The daily monitor emails the owner once when the live app breaks.
 const sent=[];
 await checks.monitorAll({inspect,send:async(...a)=>sent.push(a)});
 await checks.monitorAll({inspect,send:async(...a)=>sent.push(a)});
 const mon=builder.loadMeta(id).monitor;
 assert.equal(mon.ok,false);assert.deepEqual(mon.failed,['Book a room']);
 assert.equal(sent.length,1,'one email, not one per day');assert.match(sent[0][1],/Casa Test: 1 check failing on your live app/);
});

test('checks API: write a check from a description, keep it only if it passes, switch off, remove',{skip:!runtime.available()},async()=>{
 const cookie=await signup('checks-api@example.com'),id=await appProject(cookie);
 const c0=await credits(cookie);
 queue=[{name:'Guest books',steps:CHECK.steps}];
 let r=await request(server,'POST','/api/create/projects/'+id+'/checks',{headers:{cookie},body:{describe:'A guest can book'}});
 assert.equal(r.status,201,r.text);assert.equal(r.json.check.name,'Guest books');assert.equal(r.json.check.source,'ai');assert.equal(r.json.verified,true);
 assert.equal(await credits(cookie),c0-1,'writing a check costs a Discuss message');
 queue=[{name:'Wrong text',steps:[...CHECK.steps.slice(0,2),{action:'expect',text:'Booking confirmed'}]}];
 r=await request(server,'POST','/api/create/projects/'+id+'/checks',{headers:{cookie},body:{describe:'Shows booking confirmed'}});
 assert.equal(r.json.saved,false);assert.equal(r.json.failed.step,'expect to see "Booking confirmed"');
 r=await request(server,'POST','/api/create/projects/'+id+'/checks',{headers:{cookie},body:{...r.json.draft,force:true}});
 assert.equal(r.status,201);
 assert.equal((await request(server,'POST','/api/create/projects/'+id+'/checks',{headers:{cookie},body:{name:'No proof',steps:[{action:'click',text:'Book'}]}})).status,400,'a check must prove something');
 const list=(await request(server,'GET','/api/create/projects/'+id+'/checks',{headers:{cookie}})).json.checks;
 await request(server,'POST','/api/create/projects/'+id+'/checks',{headers:{cookie},body:{id:list[1].id,enabled:false}});
 const run=(await request(server,'POST','/api/create/projects/'+id+'/checks',{headers:{cookie},body:{run:true}})).json.result;
 assert.deepEqual([run.ran,run.passed],[1,1],'switched-off checks do not run');
 assert.equal((await request(server,'DELETE','/api/create/projects/'+id+'/checks',{headers:{cookie},body:{id:list[1].id}})).json.checks.length,1);
});

test('agent mode tests on a test copy and saves flows it proves with save_as',{skip:!runtime.available()},async()=>{
 const cookie=await signup('checks-agent@example.com'),id=await appProject(cookie);
 queue=[
  {thought:'Test the booking flow.',actions:[{tool:'build_and_test',save_as:'Book a room',steps:CHECK.steps},{tool:'query_db',sql:'SELECT COUNT(*) AS n FROM booking_log'}]},
  {thought:'Done.',actions:[{tool:'write_files',files:{'src/App.jsx':app('Book').replace('<label>','<p>Welcome</p><label>')}},{tool:'finish',message:'Added a welcome line.'}]}
 ];calls=[];
 const j=await waitJob(cookie,(await request(server,'POST','/api/create/projects/'+id+'/chat',{headers:{cookie},body:{mode:'agent',message:'Add a welcome line'}})).json.job);
 assert.equal(j.status,'complete',j.error);
 const step1=calls[1].messages.filter(m=>m.role==='user').at(-1);const text=typeof step1.content==='string'?step1.content:step1.content[0].text;
 assert.match(text,/Saved as the check "Book a room" when you finish/);
 assert.match(text,/\[\{"n":1\}\]|"n":1/,'query_db reads the test copy the test wrote to');
 assert.deepEqual(j.result.checks_saved,['Book a room']);
 assert.equal(checks.list(builder.loadMeta(id))[0].source,'agent');
 assert.equal(realBookings(id),0);assert.equal(await realLog(id),0,'the agent never touched the real data');
 assert.ok(!fs.existsSync(path.join(builder.projectDir(id),'sandboxes'))||!fs.readdirSync(path.join(builder.projectDir(id),'sandboxes')).length,'test copies are cleaned up');
});

"use strict";
// Automations in generated apps: scheduled and record-triggered server functions.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-auto-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
process.env.APP_ENCRYPTION_KEY='auto-encryption-key-0123456789';
process.env.KAIROQ_FREE_CREDITS='10';
process.env.KAIROQ_FUNCTION_TIMEOUT_MS='3000';
const builder=require('../react-builder'),createApi=require('../create-api'),backend=require('../react-backend'),automations=require('../react-automations'),sandbox=require('../react-sandbox'),applog=require('../react-logs');

const MAIN="import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App.jsx';\ncreateRoot(document.getElementById('root')).render(<App />);\n";
const APP="export default function App() { return <h1>Bookings</h1>; }\n";
const CONFIG={collections:{bookings:{access:'public'},notes:{access:'public'}},email:true,automations:[
 {name:'reminders',run:'remind',every:'day',at:'09:00'},
 {name:'hourly',run:'remind',every:'hour'},
 {name:'welcome',run:'welcome',on:'created',collection:'bookings'},
]};
const REMIND=`export default async function (request, { db, log }) {
  const list = await db.collection('bookings').list();
  log('reminding ' + list.length + ' bookings via ' + request.body.trigger);
  if (request.body.trigger === 'manual' && list.length > 90) throw new Error('too many');
  return { status: 200, json: { reminded: list.length } };
}
`;
const WELCOME=`export default async function (request, { db, log }) {
  const r = request.body.record;
  log('welcoming ' + r.name);
  // Updating the record must not start this automation again.
  await db.collection('bookings').update(r.id, { welcomed: true });
  await db.collection('notes').create({ about: r.id });
  return { status: 200, json: { welcomed: r.id } };
}
`;
const BROKEN=`export default async function () { throw new Error('boom'); }\n`;

function request(server,method,url,{body,headers={}}={}){
 return new Promise((resolve,reject)=>{
  const payload=body!==undefined?Buffer.from(JSON.stringify(body)):null;
  const req=http.request({host:'127.0.0.1',port:server.address().port,method,path:url,headers:{...(payload?{'Content-Type':'application/json','Content-Length':payload.length}:{}),...headers}},res=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>{const text=Buffer.concat(c).toString();let json=null;try{json=JSON.parse(text)}catch{}resolve({status:res.statusCode,headers:res.headers,text,json})})});
  req.on('error',reject);if(payload)req.write(payload);req.end();
 });
}
let server,ip=0;
test.before(async()=>{
 server=http.createServer(async(req,res)=>{
  if(await backend.handle(req,res))return;if(builder.handlePreview(req,res))return;
  if(await createApi.handle(req,res,{isOwner:()=>false,callModel:async()=>{throw Error('no model needed')},secure:false}))return;
  res.writeHead(404);res.end();
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
});
test.after(()=>{server.close();fs.rmSync(tmp,{recursive:true,force:true})});
async function signup(email){const r=await request(server,'POST','/api/create/signup',{body:{email,password:'password1'},headers:{'x-forwarded-for':'10.7.0.'+(++ip)}});assert.equal(r.status,201,r.text);return r.headers['set-cookie'][0].split(';')[0]}
async function appWith(cookie,files,name='Auto'){const id=(await request(server,'POST','/api/create/projects',{headers:{cookie},body:{name}})).json.project.id;await builder.saveSource(id,{'src/main.jsx':MAIN,'src/App.jsx':APP,...files},{summary:'setup'});return id}
const at=(day,hhmm)=>Date.parse('2026-10-'+day+'T'+hhmm+':00Z');
const wait=ms=>new Promise(r=>setTimeout(r,ms));

test('config: schedules and record triggers are validated against functions and collections',()=>{
 const ok=automations.normalize(CONFIG.automations,{collections:CONFIG.collections});
 assert.equal(ok[0].at,'09:00');assert.equal(ok[2].on,'created');
 assert.throws(()=>automations.normalize([{name:'x',run:'f',every:'day',at:'25:00'}]),/needs "at"/);
 assert.throws(()=>automations.normalize([{name:'x',run:'f',on:'created',collection:'nope'}],{collections:{}}),/not declared/);
 assert.throws(()=>automations.normalize([{name:'x',run:'f',every:'hour',at:'09:00'}]),/cannot have "at"/);
 assert.throws(()=>automations.normalize([{name:'x',run:'f',every:'week',at:'09:00',day:'funday'}]),/needs "day"/);
 assert.throws(()=>automations.normalize([{name:'x',run:'f',every:'day',tz:'Mars/Olympus'}]),/unknown "tz"/);
 assert.deepEqual(backend.configErrors({'src/backend.json':JSON.stringify({collections:{},automations:[{name:'a',run:'missing',every:'hour'}]})}),['Automation "a" runs "missing", but there is no functions/missing.js.']);
 assert.deepEqual(backend.configErrors({'src/backend.json':JSON.stringify({collections:{},automations:[{name:'a',run:'f',every:'hour'}]}),'functions/f.js':REMIND}),[]);
 assert.match(automations.describe(ok[0]),/Every day at 09:00 UTC → remind/);assert.match(automations.describe(ok[2]),/When a record in "bookings" is created → welcome/);
});

test('due: daily at 09:00 runs once after nine, not before, and again the next day; weekly on its day; time zones',()=>{
 const daily={every:'day',at:'09:00'};
 assert.equal(automations.due(daily,null,at('20','08:59')),false,'not yet nine');
 assert.equal(automations.due(daily,null,at('20','09:00')),true,'due at nine');
 assert.equal(automations.due(daily,at('20','09:00'),at('20','17:00')),false,'ran today');
 assert.equal(automations.due(daily,at('20','09:00'),at('21','09:01')),true,'next day');
 assert.equal(automations.due(daily,at('19','09:00'),at('20','08:00')),false);
 assert.equal(automations.due(daily,at('18','09:00'),at('20','15:00')),true,'missed yesterday while down: runs once when back');
 assert.equal(automations.due(daily,null,at('20','15:00')),false,'a new daily schedule does not fire six hours late');
 const weekly={every:'week',at:'08:00',day:'mon'};
 assert.equal(automations.due(weekly,null,at('18','12:00')),false,'Sunday Oct 18 2026: a new weekly schedule waits for Monday');
 assert.equal(automations.due(weekly,null,at('19','08:30')),true,'Monday the 19th, half an hour after eight');
 assert.equal(automations.due(weekly,at('12','08:00'),at('18','12:00')),false,'ran on Monday the 12th');
 assert.equal(automations.due(weekly,at('12','08:00'),at('19','08:00')),true,'Monday the 19th at eight');
 const dubai={every:'day',at:'09:00',tz:'Asia/Dubai'};
 assert.equal(automations.due(dubai,null,at('20','04:59')),false,'08:59 in Dubai');
 assert.equal(automations.due(dubai,null,at('20','05:00')),true,'09:00 in Dubai is 05:00 UTC');
 assert.equal(automations.due({every:'hour'},at('20','09:00'),at('20','09:59')),false);
 assert.equal(automations.due({every:'hour'},at('20','09:00'),at('20','10:00')),true);
 assert.equal(automations.due({on:'created',collection:'x'},null,Date.now()),false,'record triggers never run on the clock');
});

test('scheduled automations run the function when due, log the run, email the owner after three failures, and show in the API',async()=>{
 const cookie=await signup('auto@example.com');
 const id=await appWith(cookie,{'src/backend.json':JSON.stringify(CONFIG),'functions/remind.js':REMIND,'functions/welcome.js':WELCOME});
 const db=backend.database(id);
 db.prepare('INSERT INTO records VALUES(?,?,?,?,?,?)').run('b1','bookings',null,JSON.stringify({name:'Ana'}),'2026-10-01T00:00:00Z','2026-10-01T00:00:00Z');
 const mails=[],send=async(to,subject,text)=>mails.push({to,subject,text});
 // 08:00: nothing due except the hourly one, which has never run.
 let r=await automations.tick({now:at('20','08:00'),send});
 assert.deepEqual(r.filter(x=>x.project===id).map(x=>x.name),['hourly']);
 // 09:00: the daily reminder runs; the hourly one ran an hour ago and runs again.
 r=await automations.tick({now:at('20','09:00'),send});
 assert.deepEqual(r.filter(x=>x.project===id).map(x=>[x.name,x.ok,x.result]),[['reminders',true,'ok 200 {"reminded":1}'],['hourly',true,'ok 200 {"reminded":1}']]);
 // 09:30: nothing is due.
 r=await automations.tick({now:at('20','09:30'),send});
 assert.equal(r.filter(x=>x.project===id).length,0);
 const logs=applog.list(id);
 assert.ok(logs.some(l=>l.source==='functions/remind.js'&&l.message==='reminding 1 bookings via schedule'),'the function log lines are kept');
 assert.ok(logs.some(l=>l.source==='automation reminders'&&/ran on schedule: ok 200/.test(l.message)));
 const st=(await request(server,'GET','/api/create/projects/'+id+'/automations',{headers:{cookie}})).json.automations;
 assert.equal(st.length,3);assert.equal(st[0].name,'reminders');assert.equal(st[0].ok,true);assert.equal(st[0].runs,1);
 // This fixture runs on Oct 20, 2026, but the status endpoint uses actual wall-clock time.
 // When the test runs after Oct 20, an overdue schedule is correctly reported as due now.
 const capturedNow=Date.now(),next=Date.parse(st[0].next);
 if(automations.due(CONFIG.automations[0],at('20','09:00'),capturedNow)){
  assert.ok(Math.abs(next-capturedNow)<30000,'overdue automation should be due now');
 }else{
  assert.match(st[0].next,/T09:00:00\.000Z$/);
  assert.ok(next>=capturedNow,'upcoming scheduled run should not be in the past');
 }
 assert.equal(st.length,3);assert.equal(st[0].name,'reminders');assert.equal(st[0].ok,true);assert.equal(st[0].runs,1);// The simulation ran on Oct 20, 2026. When CI runs after that date, the
 // real-time status endpoint correctly reports an overdue run as due NOW,
 // not at a fixed 09:00 UTC. Assert the runtime contract for either case.
 const next=Date.parse(st[0].next),checkedAt=Date.now();
 assert.ok(Number.isFinite(next),'next run is a valid timestamp');
 // The schedule status uses actual wall-clock time, whereas this integration test
 // simulated October 20. Overdue tasks are shown as due now, while future
 // schedules retain their daily 09:00 UTC slot.
 const dueImmediately=Math.abs(next-checkedAt)<30000;
 const nextAtNine=/T09:00:00\.000Z$/.test(st[0].next)&&next>=checkedAt;
 assert.ok(dueImmediately||nextAtNine,'next run is immediately due or a future 09:00 UTC occurrence');
 assert.equal(st[2].next,null);
 // Run now from the editor.
 const ran=(await request(server,'POST','/api/create/projects/'+id+'/automations',{headers:{cookie},body:{name:'reminders'}})).json;
 assert.equal(ran.run.result,'ok 200 {"reminded":1}');assert.equal(ran.automations[0].runs,2);
 assert.equal((await request(server,'POST','/api/create/projects/'+id+'/automations',{headers:{cookie},body:{name:'nope'}})).status,404);
 // The manual action records the actual machine clock, whereas scheduled ticks in
 // this test use the simulated Oct 20–24 timeline. Rebase only the test
 // fixture's last-run timestamps so the later simulated days are actually due.
 db.prepare('UPDATE automation_runs SET last_run=? WHERE name IN (?, ?)').run(at('20','09:30'),'reminders','hourly');
 // A function that keeps failing: one email after the third failure in a row, none before or after.
 await builder.saveSource(id,{...builder.loadFiles(id,builder.loadMeta(id).current_version),'functions/remind.js':BROKEN},{summary:'break'});
 // Manual Run now above records the real system clock. All simulated later runs must
 // occur *after* that timestamp, even when this test executes after October 21, 2026.
 const anchor=new Date(Math.max(Date.now(),at('20','09:00')));
 const firstUtc=Date.UTC(anchor.getUTCFullYear(),anchor.getUTCMonth(),anchor.getUTCDate()+2,9);
 for(let offset=0;offset<4;offset++){
  r=await automations.tick({now:firstUtc+offset*86400000,send});
  const x=r.find(y=>y.project===id&&y.name==='reminders');
  assert.ok(x,'scheduled reminder must be due after previous manual run');
  assert.equal(x.ok,false);assert.match(x.result,/boom/);
 }
 // Both automations run the broken function, so each gets exactly one email (at its third failure, not its fourth).
 assert.deepEqual(mails.map(m=>m.subject).sort(),['Auto: the automation "hourly" keeps failing','Auto: the automation "reminders" keeps failing']);assert.match(mails[0].text,/failed 3 times in a row/);
 const st2=(await request(server,'GET','/api/create/projects/'+id+'/automations',{headers:{cookie}})).json.automations[0];
 assert.equal(st2.ok,false);assert.equal(st2.failures,4);
 assert.ok(applog.list(id).some(l=>l.source==='automation reminders'&&l.level==='error'));
});

test('record-triggered automations run after a create, cannot start themselves, and stay on the test copy in a sandbox',async()=>{
 const cookie=await signup('event@example.com');
 const id=await appWith(cookie,{'src/backend.json':JSON.stringify(CONFIG),'functions/remind.js':REMIND,'functions/welcome.js':WELCOME});
 const meta=builder.loadMeta(id),draft={'x-kairoq-version':String(meta.current_version),'x-kairoq-preview':meta.preview_key};
 const made=await request(server,'POST','/api/apps/'+id+'/collections/bookings',{body:{data:{name:'Ben'}},headers:draft});
 assert.equal(made.status,201,made.text);
 for(let i=0;i<40&&!backend.database(id).prepare("SELECT 1 FROM records WHERE collection='notes'").get();i++)await wait(50);
 const db=backend.database(id);
 const b=JSON.parse(db.prepare('SELECT data FROM records WHERE id=?').get(made.json.item.id).data);
 assert.equal(b.welcomed,true,'the automation updated the record');
 assert.equal(db.prepare("SELECT COUNT(*) n FROM records WHERE collection='notes'").get().n,1,'and created one note');
 await wait(150);
 const welcomes=applog.list(id).filter(l=>l.source==='functions/welcome.js');
 assert.deepEqual(welcomes.map(l=>l.message),['welcoming Ben'],'the update it made did not trigger it again');
 // In a sandbox the automation runs on the test copy only.
 const box=sandbox.create(id);
 const t=await request(server,'POST','/api/apps/'+id+'/collections/bookings',{body:{data:{name:'Cora'}},headers:{...draft,'x-kairoq-sandbox':box.token}});
 assert.equal(t.status,201,t.text);
 const sdb=backend.openFile(path.join(box.dir,'data.sqlite'));
 for(let i=0;i<40&&!JSON.parse(sdb.prepare('SELECT data FROM records WHERE id=?').get(t.json.item.id).data).welcomed;i++)await wait(50);
 assert.equal(JSON.parse(sdb.prepare('SELECT data FROM records WHERE id=?').get(t.json.item.id).data).welcomed,true,'ran on the test copy');
 assert.equal(db.prepare("SELECT COUNT(*) n FROM records WHERE collection='bookings'").get().n,1,'the real data has only Ben');
 assert.equal(db.prepare("SELECT COUNT(*) n FROM records WHERE collection='notes'").get().n,1);
 // Sandbox database writes can complete before the asynchronous automation writes
 // its audit log. Wait for the log itself rather than asserting it synchronously.
 let sandboxLogFound=false;
 for(let i=0;i<60;i++){
  sandboxLogFound=applog.list(id).some(l=>l.source==='automation welcome'&&/\(test copy\)/.test(l.message));
  if(sandboxLogFound)break;
  await wait(50);
 }
 assert.ok(sandboxLogFound,'sandbox automation emits a test-copy audit log');
 // Run now on the test copy, as the agent does.
 const r=await automations.runNow(id,'reminders',{sb:{dir:box.dir,token:box.token},version:meta.current_version});
 assert.equal(r.result,'ok 200 {"reminded":2}','sees the two bookings on the test copy');
 assert.equal(automations.runs(db).reminders,undefined,'test runs are not counted as real runs');
 sandbox.destroy(box.token);
});

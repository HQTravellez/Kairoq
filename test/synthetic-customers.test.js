"use strict";
// Synthetic customers: personas use a real built app in a browser, on a test copy of its data.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-synthetic-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
process.env.KAIROQ_FREE_CREDITS='40';
process.env.KAIROQ_DESIGN_BRIEF='off';
process.env.KAIROQ_EXTERNAL_ALLOW_LOCAL='1';
const builder=require('../react-builder'),createApi=require('../create-api'),backend=require('../react-backend'),runtime=require('../runtime-check');
const synthetic=require('../synthetic-customers');

const APP=`import React, { useState } from 'react';
import { collection } from 'kairoq';
export default function App() {
  const [name, setName] = useState('');
  const [done, setDone] = useState(false);
  async function submit(e) { e.preventDefault(); await collection('bookings').create({ name }); setDone(true); }
  return done ? <p>Thank you, {name}</p> : (
    <form onSubmit={submit}>
      <h1>Yoga with Mira</h1>
      <label>Your name<input value={name} onChange={e => setName(e.target.value)} /></label>
      <button type="submit">Book a class</button>
    </form>
  );
}
`;
const FILES={'src/main.jsx':"import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App.jsx';\ncreateRoot(document.getElementById('root')).render(<App />);\n",'src/App.jsx':APP,'src/backend.json':JSON.stringify({collections:{bookings:{access:'public'}}})};

// The fake model plays each role from its system prompt, deciding from what is on screen.
const calls=[],fixes=[];
const callModel=async(opts,parse)=>{
 const sys=opts.messages[0].content,user=opts.messages.at(-1).content;calls.push(sys.slice(0,40));
 let reply;
 if(/customer personas/.test(sys))reply={personas:[{name:'Ana',age:31,about:'Nurse booking after a night shift',device:'phone',patience:'high',tech:'medium',wants:'a Saturday class'},{name:'Ben',age:45,about:'Accountant',device:'desktop',patience:'medium',tech:'high'},{name:'Cora',age:68,about:'Retired teacher',device:'phone',patience:'low',tech:'low'}]};
 else if(/role-playing/.test(sys)){
  const el=label=>{const m=new RegExp('\\[(\\d+)\\] \\S+: '+label+'([^\\n]*)').exec(user);return m&&{id:Number(m[1]),rest:m[2]}};
  if(/You are: Cora/.test(user))reply={thought:'Too small to read on my phone and I do not know what to press.',feeling:'frustrated',action:'give_up'};
  else if(/Thank you/.test(user))reply={thought:'Booked, great.',feeling:'confident',action:'done'};
  else if(/click "Book a class"/.test(user))reply={thought:'I pressed Book and nothing happened.',feeling:'frustrated',action:'give_up'};
  else{const name=el('Your name');if(name&&!/current:/.test(name.rest))reply={thought:'I type my name.',feeling:'confident',action:'fill',target:name.id,value:'Test Ana'};else reply={thought:'Now I book.',feeling:'confident',action:'click',target:el('Book a class').id}}
 }else if(/explain problems in a web app/.test(sys)){
  const m=/(C\d+) — (src\/[\w.\/-]+) line (\d+)/.exec(user);
  reply={cards:[{issue:1,what:'1 of 3 visitors gave up on the booking form.',where:'the Book a class button',place:m?m[1]:null,why:'On a phone the form is hard to read.',impact:'About a third of bookings are lost.',fix:'Make the text and button larger on phones.',lines:m?[{n:Number(m[3]),meaning:'This shows the form.'},{n:9999,meaning:'not a real line'}]:[]}]};
 }else if(/explain a technical problem/.test(sys))reply={what:'The page shows an error when it opens.',where:'the booking form',file:/BOGUS/.test(user)?'src/Missing.jsx':'src/App.jsx',line:9,why:'A value is missing.',impact:'Visitors cannot book.',fix:'Give the value a default.',lines:[{n:9,meaning:'This line shows the name field.'}]};
 else if(/explain what changed in a web app/.test(sys))reply={summary:'The booking form was added.',changes:[{what:'A form to book a class',where:'home page',why_it_matters:'Visitors can book online.'}],watch:''};
 else if(/coding engine/.test(sys)){fixes.push(user);reply={plan:['Make the Book button submit the form'],message:'The Book a class button now books the class.',files:{'src/App.jsx':APP}}}
 else if(/analyse a usability test/.test(sys))reply={headline:'Older visitors on phones give up on the first screen.',issues:[{title:'Small text on phones',why:'The booking form is hard to read on a phone',who:'older visitors',visitors:1,quote:'Too small to read on my phone'}],fixes:['Use larger text and a clear Book button on phones']};
 else throw Error('unexpected prompt');
 return parse(JSON.stringify(reply));
};
function request(server,method,url,{body,headers={}}={}){
 return new Promise((resolve,reject)=>{
  const payload=body!==undefined?Buffer.from(JSON.stringify(body)):null;
  const req=http.request({host:'127.0.0.1',port:server.address().port,method,path:url,headers:{...(payload?{'Content-Type':'application/json','Content-Length':payload.length}:{}),...headers}},res=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>{const buf=Buffer.concat(c);let json;try{json=JSON.parse(buf)}catch{}resolve({status:res.statusCode,json,text:buf.toString(),headers:res.headers})})});
  req.on('error',reject);if(payload)req.write(payload);req.end();
 });
}
let server,ip=0;
test.before(async()=>{
 server=http.createServer(async(req,res)=>{
  if(await backend.handle(req,res))return;if(builder.handlePreview(req,res))return;
  const base='http://127.0.0.1:'+server.address().port;
  if(req.url==='/mcp')return void await require('../kairoq-mcp').handle(req,res,{callModel,browse:(u,o)=>runtime.session(base+u,o)});
  if(await createApi.handle(req,res,{isOwner:()=>false,callModel,secure:false,browse:(u,o)=>runtime.session(base+u,o),inspect:(u,o)=>runtime.inspect(base+u,o)}))return;
  res.writeHead(404);res.end();
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
});
test.after(async()=>{server.close();await runtime.close();fs.rmSync(tmp,{recursive:true,force:true})});
async function signup(email){const r=await request(server,'POST','/api/create/signup',{body:{email,password:'password1'},headers:{'x-forwarded-for':'10.8.0.'+(++ip)}});assert.equal(r.status,201,r.text);return r.headers['set-cookie'][0].split(';')[0]}
async function waitJob(cookie,job){for(let i=0;i<2400;i++){const j=(await request(server,'GET','/api/create/jobs/'+job.id,{headers:{cookie}})).json.job;if(['complete','failed'].includes(j.status))return j;await new Promise(r=>setTimeout(r,50))}throw Error('job timeout')}
const credits=async cookie=>(await request(server,'GET','/api/create/credits',{headers:{cookie}})).json.account.credits;

test('funnel numbers come from the visits, not the model',()=>{
 const p=(n,device)=>synthetic.normalizePersona({name:n,device},0);
 const f=synthetic.funnel([{persona:p('A','phone'),outcome:'completed',steps:[{path:'/'},{path:'/'}]},{persona:p('B','phone'),outcome:'gave_up',steps:[{path:'/#/pricing',feeling:'frustrated'}]},{persona:p('C','desktop'),outcome:'stuck',steps:[{path:'/#/pricing'}]},{persona:p('D','desktop'),outcome:'skipped',steps:[]}]);
 assert.equal(f.visitors,3);assert.equal(f.completed,1);assert.equal(f.completion_rate,33);
 assert.deepEqual(f.drop_off,[{path:'/#/pricing',visitors:2}]);
 assert.deepEqual(f.by_device,{phone:{visitors:2,completed:1},desktop:{visitors:1,completed:0}});
 assert.equal(f.frustrated,1);assert.equal(f.median_steps,2);
});
test('personas use the real app in a browser on a test copy; the report counts who finished and why others left',{skip:!runtime.available()&&'no browser'},async()=>{
 const cookie=await signup('synthetic@example.com');
 const id=(await request(server,'POST','/api/create/projects',{headers:{cookie},body:{name:'Mira Yoga'}})).json.project.id;
 await builder.saveSource(id,FILES,{summary:'Booking form'});
 assert.equal((await request(server,'POST','/api/create/projects/'+id+'/synthetic',{headers:{cookie},body:{audience:'x',goal:'Book a class',count:3}})).status,400,'an audience is required');
 const infoRes=await request(server,'GET','/api/create/projects/'+id+'/synthetic',{headers:{cookie}});const info=infoRes.json;assert.equal(infoRes.status,200,infoRes.text);
 assert.equal(info.browser,true);assert.equal(info.price_per_visitor.standard,1);
 const before=await credits(cookie);
 const start=await request(server,'POST','/api/create/projects/'+id+'/synthetic',{headers:{cookie},body:{audience:'Busy adults who want to try yoga',goal:'Book a class',count:3}});
 assert.equal(start.status,202,start.text);
 const job=await waitJob(cookie,start.json.job);
 assert.equal(job.status,'complete',job.error);
 assert.equal(await credits(cookie),before-3,'priced per visitor');
 const {numbers,summary}=job.result.synthetic;
 assert.equal(numbers.visitors,3);assert.equal(numbers.completed,2);assert.equal(numbers.gave_up,1);assert.equal(numbers.completion_rate,67);
 assert.equal(numbers.by_device.phone.visitors,2);assert.equal(numbers.frustrated,1);
 assert.match(summary.headline,/Older visitors/);
 assert.equal(backend.database(id).prepare("SELECT COUNT(*) n FROM records WHERE collection='bookings'").get().n,0,'bookings went to the test copy, not the real app');
 // The report is kept and can be turned into a fix request for the builder.
 const list=(await request(server,'GET','/api/create/projects/'+id+'/synthetic',{headers:{cookie}})).json.reports;
 assert.equal(list.length,1);assert.equal(list[0].completion_rate,67);
 const full=(await request(server,'GET','/api/create/projects/'+id+'/synthetic?report='+list[0].id,{headers:{cookie}})).json;
 const ana=full.report.visits.find(v=>v.persona.name==='Ana');
 assert.equal(ana.outcome,'completed');assert.deepEqual(ana.steps.map(s=>s.action),['fill','click','done']);
 // Cora left without pressing anything: an experience problem, which no replay can confirm.
 assert.deepEqual(full.report.problems.map(p=>[p.kind,p.status,p.visitors]),[['experience','experience',['Cora']]]);
 assert.match(full.fix_message,/Small text on phones[\s\S]*Too small to read/);
 // Plain-English cards point at the real code behind what visitors saw; code text comes from the source.
 const card=full.report.explanations[0];
 assert.equal(card.file,'src/App.jsx');assert.match(card.what,/gave up/);
 const src=FILES['src/App.jsx'].split('\n');
 assert.equal(card.snippet.find(x=>x.n===card.line).code,src[card.line-1].slice(0,240));
 assert.equal(card.code.length,1,'lines outside the shown code are dropped');assert.equal(card.code[0].meaning,'This shows the form.');
 assert.match(full.fix_message,/src\/App\.jsx line \d+; fix: Make the text/);
 // Explain an error and a change in plain English (one Discuss message each).
 const c0=await credits(cookie);
 const ex=await request(server,'POST','/api/create/projects/'+id+'/explain',{headers:{cookie},body:{kind:'error',text:'Uncaught TypeError: x is undefined'}});
 assert.equal(ex.status,200,ex.text);
 assert.equal(ex.json.explanation.file,'src/App.jsx');assert.equal(ex.json.explanation.sure,true);
 assert.equal(ex.json.explanation.snippet.find(x=>x.n===9).code,src[8]);
 assert.equal(await credits(cookie),c0-1);
 const bogus=(await request(server,'POST','/api/create/projects/'+id+'/explain',{headers:{cookie},body:{kind:'error',text:'BOGUS error'}})).json.explanation;
 assert.equal(bogus.file,undefined,'a file that does not exist is not shown');assert.equal(bogus.sure,false);
 const ch=(await request(server,'POST','/api/create/projects/'+id+'/explain',{headers:{cookie},body:{kind:'change'}})).json.explanation;
 assert.match(ch.summary,/booking form/);assert.equal(ch.changes.length,1);
 assert.equal((await request(server,'POST','/api/create/projects/'+id+'/explain',{headers:{cookie},body:{kind:'nonsense'}})).status,400);
 // Another account cannot read the reports.
 const other=await signup('other-synthetic@example.com');
 assert.equal((await request(server,'GET','/api/create/projects/'+id+'/synthetic',{headers:{cookie:other}})).status,404);
});

test('MCP: AI assistants use an API key to list projects, run a synthetic test and read the report',{skip:!runtime.available()&&'no browser'},async()=>{
 const cookie=await signup('mcp@example.com');
 const id=(await request(server,'POST','/api/create/projects',{headers:{cookie},body:{name:'Mira MCP'}})).json.project.id;
 await builder.saveSource(id,FILES,{summary:'Booking form'});
 const made=await request(server,'POST','/api/create/api-keys',{headers:{cookie},body:{name:'Claude'}});
 assert.equal(made.status,201,made.text);
 const key=made.json.created.key;assert.match(key,/^kq_/);
 assert.ok(!JSON.stringify(made.json.keys).includes(key),'the key itself is shown only once');
 const rpc=async(method,params,k=key,id_=1)=>request(server,'POST','/mcp',{headers:k?{authorization:'Bearer '+k}:{},body:{jsonrpc:'2.0',id:id_,method,params}});
 assert.equal((await rpc('tools/list',{},null)).status,401,'a key is required');
 assert.equal((await rpc('tools/list',{},'kq_'+'x'.repeat(30))).status,401,'unknown keys are refused');
 const init=(await rpc('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'test',version:'1'}})).json;
 assert.equal(init.result.protocolVersion,'2025-06-18');assert.ok(init.result.capabilities.tools);
 assert.equal((await request(server,'POST','/mcp',{headers:{authorization:'Bearer '+key},body:{jsonrpc:'2.0',method:'notifications/initialized'}})).status,202);
 const tools=(await rpc('tools/list',{})).json.result.tools.map(t=>t.name);
 assert.deepEqual(tools,['list_projects','run_synthetic_test','get_synthetic_test','fix_and_retest','list_synthetic_reports']);
 const call=async(name,args,k)=>(await rpc('tools/call',{name,arguments:args},k)).json.result;
 assert.ok((await call('list_projects',{})).structuredContent.projects.some(p=>p.id===id));
 const started=await call('run_synthetic_test',{project_id:id,audience:'Busy adults who want to try yoga',goal:'Book a class',visitors:3});
 assert.ok(!started.isError,started.content[0].text);
 const jobId=started.structuredContent.job_id;
 let r;for(let i=0;i<600;i++){r=await call('get_synthetic_test',{job_id:jobId});if(r.structuredContent&&r.structuredContent.status==='complete'||r.isError)break;await new Promise(x=>setTimeout(x,100))}
 assert.equal(r.structuredContent.status,'complete',r.content[0].text);
 assert.equal(r.structuredContent.numbers.completed,2);
 assert.match(r.content[0].text,/2 of 3 visitors reached the goal/);
 assert.match(r.structuredContent.fix_message,/Small text on phones/);
 assert.equal((await call('list_synthetic_reports',{project_id:id})).structuredContent.reports.length,1);
 // Another account's key cannot see or test this project.
 const other=await signup('mcp-other@example.com');
 const otherKey=(await request(server,'POST','/api/create/api-keys',{headers:{cookie:other},body:{name:'x'}})).json.created.key;
 assert.equal((await call('run_synthetic_test',{project_id:id,audience:'Anyone at all',goal:'Book a class'},otherKey)).isError,true);
 assert.equal((await call('get_synthetic_test',{job_id:jobId},otherKey)).isError,true);
 assert.ok(!(await call('list_projects',{},otherKey)).structuredContent.projects.some(p=>p.id===id));
 // Revoked keys stop working.
 const keys=(await request(server,'GET','/api/create/api-keys',{headers:{cookie}})).json.keys;
 assert.equal((await request(server,'DELETE','/api/create/api-keys',{headers:{cookie},body:{id:keys[0].id}})).status,200);
 assert.equal((await rpc('tools/list',{})).status,401);
});

// A Book button that does nothing: visitors press it and leave.
const BROKEN=APP.replace('<form onSubmit={submit}>','<form onSubmit={e => e.preventDefault()}>');
test('what a visitor did is classified, and opinions are not treated as bugs',()=>{
 const repair=require('../synthetic-repair');
 assert.equal(repair.suspect({steps:[{action:'click',path:'/',label:'Pay',error:'Timeout'}]}).kind,'broken');
 assert.equal(repair.suspect({error:'Uncaught error: x is undefined',steps:[{action:'click',path:'/',label:'Go'}]}).kind,'crash');
 assert.equal(repair.suspect({steps:[{action:'click',path:'/',label:'Go'},{action:'click',path:'/',label:'Go'}]}).kind,'no_effect');
 assert.equal(repair.suspect({steps:[{action:'scroll',path:'/'},{action:'give_up',path:'/',feeling:'frustrated'}]}).kind,'experience');
 const c=repair.compare({numbers:{completed:1,visitors:4,completion_rate:25},summary:{issues:[{title:'Price is hidden',why:'Visitors cannot find the price'},{title:'Slow checkout',why:'Checkout takes many steps'}]}},{numbers:{completed:3,visitors:4,completion_rate:75},summary:{issues:[{title:'Price hidden on phones',why:'The price is hidden below the fold'},{title:'No reviews',why:'Visitors want reviews'}]}});
 assert.equal(c.change,50);
 assert.deepEqual(c.issues.map(x=>x.status),['still','gone','new']);
});
test('fix and retest: the confirmed problem is fixed, replayed, locked in as a check, and the same customers do better',{skip:!runtime.available()&&'no browser'},async()=>{
 const cookie=await signup('repair@example.com');
 const id=(await request(server,'POST','/api/create/projects',{headers:{cookie},body:{name:'Mira Broken'}})).json.project.id;
 await builder.saveSource(id,{...FILES,'src/App.jsx':BROKEN},{summary:'Booking form'});
 const start=await request(server,'POST','/api/create/projects/'+id+'/synthetic',{headers:{cookie},body:{audience:'Busy adults who want to try yoga',goal:'Book a class',count:3}});
 const job=await waitJob(cookie,start.json.job);assert.equal(job.status,'complete',job.error);
 assert.equal(job.result.synthetic.numbers.completed,0);
 const rid=job.result.synthetic.id;
 const report=(await request(server,'GET','/api/create/projects/'+id+'/synthetic?report='+rid,{headers:{cookie}})).json.report;
 // Replaying Ana's and Ben's steps shows the button really does nothing; Cora's leaving is an experience.
 const button=report.problems.find(p=>p.kind==='no_effect');
 assert.equal(button.status,'confirmed');assert.deepEqual(button.visitors.sort(),['Ana','Ben']);
 assert.deepEqual(button.steps.map(s=>s.action),['fill','click']);assert.match(button.title,/Nothing happens after pressing "Book a class"/);
 assert.equal(report.problems.find(p=>p.kind==='experience').visitors[0],'Cora');
 const info=(await request(server,'GET','/api/create/projects/'+id+'/synthetic',{headers:{cookie}})).json;
 assert.equal(info.price_per_fix_round.standard,1);
 const before=await credits(cookie);
 const r=await request(server,'POST','/api/create/projects/'+id+'/synthetic',{headers:{cookie},body:{repair:rid,rounds:2,rerun:true}});
 assert.equal(r.status,202,r.text);assert.equal(r.json.job.credits,2+3,'at most two rounds and a rerun of three customers');
 const done=await waitJob(cookie,r.json.job);assert.equal(done.status,'complete',done.error);
 const x=done.result.repair;
 // The builder got the confirmed problem with its exact steps.
 assert.equal(fixes.length,1);assert.match(fixes[0],/Confirmed by replaying[\s\S]*Nothing happens after pressing "Book a class"[\s\S]*fill "Your name" with "Test Ana" → click "Book a class"/);
 assert.equal(x.rounds.length,1,'stops once the replay shows the problem is gone');
 assert.equal(x.problems.find(p=>p.kind==='no_effect').after,'fixed');
 assert.equal(x.checks.length,1);
 const check=builder.loadMeta(id).checks.find(c=>c.source==='repair');
 assert.deepEqual(check.steps.at(-1),{action:'expect',text:'Thank you, Test Ana'});
 assert.equal(x.rerun.before.completed,0);assert.equal(x.rerun.after.completed,2);assert.equal(x.rerun.change,67);
 assert.equal(await credits(cookie),before-4,'one fix round and the rerun; the unused round is never charged');
 assert.equal(x.credits,4);
 // The original report keeps the outcome; the rerun is its own report.
 const kept=(await request(server,'GET','/api/create/projects/'+id+'/synthetic?report='+rid,{headers:{cookie}})).json.report;
 assert.equal(kept.repair.rerun.report_id,x.rerun.report_id);
 const after=(await request(server,'GET','/api/create/projects/'+id+'/synthetic?report='+x.rerun.report_id,{headers:{cookie}})).json.report;
 assert.equal(after.after_fix_of,rid);assert.deepEqual(after.visits.map(v=>v.persona.name).sort(),['Ana','Ben','Cora'],'the same customers came back');
 // The new check now guards the flow: breaking the button again fails it.
 const checks=require('../react-checks');
 const v=await builder.saveSource(id,{...FILES,'src/App.jsx':BROKEN},{summary:'Broken again'});
 const meta=builder.loadMeta(id);
 const res=await checks.run(id,builder.previewUrl(meta,meta.current_version),{inspect:(u,o)=>runtime.inspect('http://127.0.0.1:'+server.address().port+u,o),record:false});
 assert.equal(res.failed.length,1);void v;
 // Viewers cannot start it; unknown reports are refused.
 assert.equal((await request(server,'POST','/api/create/projects/'+id+'/synthetic',{headers:{cookie},body:{repair:'00000000-0000-0000-0000-000000000000'}})).status,404);
});

// Another website: the same booking form, hosted elsewhere. Its sends must never reach it.
const OTHER=`<!doctype html><html><head><title>Mira elsewhere</title></head><body>
<form id="f"><h1>Yoga with Mira</h1><label>Your name<input id="n"></label><button type="submit">Book a class</button></form>
<script>document.getElementById('f').onsubmit=async e=>{e.preventDefault();const name=document.getElementById('n').value;await fetch('/book',{method:'POST',body:JSON.stringify({name})});document.body.innerHTML='<p>Thank you, '+name+'</p>'}</script></body></html>`;
test('other websites: the browser proxy only connects to public addresses on port 443',async()=>{
 const port=await runtime.startProxy(),net=require('net');
 const ask=target=>new Promise(resolve=>{const c=net.connect(port,'127.0.0.1',()=>c.write('CONNECT '+target+' HTTP/1.1\r\nHost: '+target+'\r\n\r\n'));let d='';c.on('data',x=>{d+=x;c.destroy();resolve(d.split('\r\n')[0])});c.on('error',()=>resolve('error'))});
 for(const t of ['127.0.0.1:443','localhost:443','10.0.0.5:443','169.254.169.254:443','example.com:80','example.com:22','[::1]:443'])assert.match(await ask(t),/403/,t);
});
test('other websites: links are checked before any visit',async()=>{
 for(const bad of ['http://example.com','https://10.0.0.1/','https://localhost/','https://intranet/','https://a:b@example.com/','https://example.com:8443/','ftp://example.com','not a link'])
  await assert.rejects(runtime.checkSite(bad),e=>e.status===400,bad);
});
test('compare: the same customers visit this app and another website; nothing is sent to the other site',{skip:!runtime.available()&&'no browser'},async()=>{
 let posts=0;
 const other=http.createServer((req,res)=>{if(req.method!=='GET'){posts++;res.writeHead(500);return res.end()}res.writeHead(200,{'Content-Type':'text/html'});res.end(OTHER)});
 await new Promise(r=>other.listen(0,'127.0.0.1',r));
 const link='http://127.0.0.1:'+other.address().port+'/';
 try{
  const cookie=await signup('compare@example.com');
  const id=(await request(server,'POST','/api/create/projects',{headers:{cookie},body:{name:'Mira Compare'}})).json.project.id;
  await builder.saveSource(id,FILES,{summary:'Booking form'});
  const body={audience:'Busy adults who want to try yoga',goal:'Book a class',count:3,compare:link};
  assert.equal((await request(server,'POST','/api/create/projects/'+id+'/synthetic',{headers:{cookie},body})).status,400,'permission must be confirmed');
  const before=await credits(cookie);
  const start=await request(server,'POST','/api/create/projects/'+id+'/synthetic',{headers:{cookie},body:{...body,permission:true}});
  assert.equal(start.status,202,start.text);assert.equal(start.json.job.credits,6,'3 visitors on each of 2 sites');
  const job=await waitJob(cookie,start.json.job);assert.equal(job.status,'complete',job.error);
  assert.equal(await credits(cookie),before-6);
  const c=job.result.comparison;
  assert.deepEqual(c.sites.map(x=>[x.label,x.numbers.completed,x.numbers.visitors]),[['this app',2,3],['127.0.0.1',2,3]]);
  assert.equal(c.fair,false,'an app on a test copy and a site with sends answered locally');
  assert.equal(posts,0,'the booking was answered by Kairoq, never sent to the other site');
  const site=(await request(server,'GET','/api/create/projects/'+id+'/synthetic?report='+c.sites[1].report_id,{headers:{cookie}})).json.report;
  assert.equal(site.target.kind,'site');assert.equal(site.target.url,link);assert.equal(site.permission_confirmed,true);
  const ana=site.visits.find(v=>v.persona.name==='Ana');
  assert.deepEqual(ana.steps.map(s=>s.action),['fill','click','done']);assert.equal(ana.steps[1].sent,true,'the visitor sent the form');
  assert.equal(site.numbers.sent_form,2);
  assert.deepEqual(site.visits.map(v=>v.persona.name).sort(),job.result.comparison&&(await request(server,'GET','/api/create/projects/'+id+'/synthetic?report='+c.sites[0].report_id,{headers:{cookie}})).json.report.visits.map(v=>v.persona.name).sort(),'the same customers');
  assert.equal(site.comparison.id,c.id);
  assert.ok(!site.explanations,'no code cards for a site whose code Kairoq does not have');
  // Fix and retest is for apps built here.
  assert.equal((await request(server,'POST','/api/create/projects/'+id+'/synthetic',{headers:{cookie},body:{repair:site.id}})).status,400);
 }finally{other.close()}
});

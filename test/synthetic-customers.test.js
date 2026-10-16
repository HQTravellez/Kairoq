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
const calls=[];
const callModel=async(opts,parse)=>{
 const sys=opts.messages[0].content,user=opts.messages.at(-1).content;calls.push(sys.slice(0,40));
 let reply;
 if(/customer personas/.test(sys))reply={personas:[{name:'Ana',age:31,about:'Nurse booking after a night shift',device:'phone',patience:'high',tech:'medium',wants:'a Saturday class'},{name:'Ben',age:45,about:'Accountant',device:'desktop',patience:'medium',tech:'high'},{name:'Cora',age:68,about:'Retired teacher',device:'phone',patience:'low',tech:'low'}]};
 else if(/role-playing/.test(sys)){
  const el=label=>{const m=new RegExp('\\[(\\d+)\\] \\S+: '+label+'([^\\n]*)').exec(user);return m&&{id:Number(m[1]),rest:m[2]}};
  if(/You are: Cora/.test(user))reply={thought:'Too small to read on my phone and I do not know what to press.',feeling:'frustrated',action:'give_up'};
  else if(/Thank you/.test(user))reply={thought:'Booked, great.',feeling:'confident',action:'done'};
  else{const name=el('Your name');if(name&&!/current:/.test(name.rest))reply={thought:'I type my name.',feeling:'confident',action:'fill',target:name.id,value:'Test Ana'};else reply={thought:'Now I book.',feeling:'confident',action:'click',target:el('Book a class').id}}
 }else if(/explain problems in a web app/.test(sys)){
  const m=/(C\d+) — (src\/[\w.\/-]+) line (\d+)/.exec(user);
  reply={cards:[{issue:1,what:'1 of 3 visitors gave up on the booking form.',where:'the Book a class button',place:m?m[1]:null,why:'On a phone the form is hard to read.',impact:'About a third of bookings are lost.',fix:'Make the text and button larger on phones.',lines:m?[{n:Number(m[3]),meaning:'This shows the form.'},{n:9999,meaning:'not a real line'}]:[]}]};
 }else if(/explain a technical problem/.test(sys))reply={what:'The page shows an error when it opens.',where:'the booking form',file:/BOGUS/.test(user)?'src/Missing.jsx':'src/App.jsx',line:9,why:'A value is missing.',impact:'Visitors cannot book.',fix:'Give the value a default.',lines:[{n:9,meaning:'This line shows the name field.'}]};
 else if(/explain what changed in a web app/.test(sys))reply={summary:'The booking form was added.',changes:[{what:'A form to book a class',where:'home page',why_it_matters:'Visitors can book online.'}],watch:''};
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
  if(await createApi.handle(req,res,{isOwner:()=>false,callModel,secure:false,browse:(u,o)=>runtime.session(base+u,o)}))return;
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
 assert.deepEqual(tools,['list_projects','run_synthetic_test','get_synthetic_test','list_synthetic_reports']);
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

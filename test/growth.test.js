"use strict";
// Pay only when it works, the loop guard, and customers before code (launch and growth watch).
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-growth-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
process.env.KAIROQ_FREE_CREDITS='60';
process.env.KAIROQ_DESIGN_BRIEF='off';
const builder=require('../react-builder'),createApi=require('../create-api'),backend=require('../react-backend'),runtime=require('../runtime-check');
const growth=require('../growth');

const MAIN="import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App.jsx';\ncreateRoot(document.getElementById('root')).render(<App />);\n";
const OK="export default function App() { return <h1>Working</h1>; }\n";
const BROKEN="export default function App() { throw new Error('boom'); }\n";
const LANDING=`import React, { useState } from 'react';
import { collection } from 'kairoq';
export default function App() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  async function join(e) { e.preventDefault(); await collection('waitlist').create({ email }); setDone(true); }
  return (
    <main>
      <h1>Swim Saturdays</h1>
      <p>Trial swimming lessons for kids, booked in a minute.</p>
      {done ? <p>Thank you, you are on the list</p> : (
        <form onSubmit={join}>
          <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
          <button type="submit">Join the waitlist</button>
        </form>
      )}
    </main>
  );
}
`;
const PITCH={name:'Swim Saturdays',headline:'Trial swimming lessons for your kids, booked in a minute',subheadline:'For busy parents in Dubai.',benefits:[{title:'Bilingual coaches',text:'Arabic and English.'},{title:'Pay per lesson',text:'No membership.'},{title:'Saturday slots',text:'Mornings that fit.'}],cta:'Join the waitlist',audience:'Busy parents in Dubai with kids aged 4 to 10, mostly on phones',question:'',
 posts:{reddit:{title:'I am building Swim Saturdays: would you use it?',body:'Founder here. Honest feedback welcome: {link}',where:['r/dubai']},linkedin:'Founder here, testing an idea: {link}',whatsapp:'Hi all, would you use this? {link}',x:'Testing an idea for parents: {link}',email:{subject:'Would you use this?',body:'Hi, I am testing an idea: {link}'}}};

const prompts=[];
const callModel=async(opts,parse)=>{
 const sys=opts.messages[0].content,user=opts.messages.at(-1).content;
 // The request being built (the last message with the project files), not the chat history.
 const asText=m=>typeof m.content==='string'?m.content:JSON.stringify(m.content);
 const reqMsg=[...opts.messages].reverse().find(m=>m.role==='user'&&asText(m).includes('Current project files'));
 const firstText=reqMsg?asText(reqMsg).split('Request:').pop():'';
 let reply;
 if(/test an idea before building/.test(sys)){prompts.push('pitch');reply=PITCH}
 else if(/coding engine/.test(sys)){
  prompts.push('code');
  if(/landing page that tests demand/.test(firstText))reply={plan:['Build the landing page'],message:'Built the landing page.',files:{'src/App.jsx':LANDING,'src/backend.json':JSON.stringify({collections:{waitlist:{access:'submit-only'}}})}};
  else if(/Break it|Fix these errors/.test(firstText))reply={plan:[],message:'Changed.',files:{'src/App.jsx':BROKEN}};
  else reply={plan:[],message:'Changed.',files:{'src/App.jsx':OK}};
 }
 else if(/customer personas/.test(sys))reply={personas:[{name:'Ana',age:34,about:'Nurse, two kids',device:'phone',patience:'medium',tech:'medium'},{name:'Ben',age:41,about:'Accountant',device:'desktop',patience:'medium',tech:'high'},{name:'Cora',age:29,about:'No kids',device:'phone',patience:'low',tech:'high'}]};
 else if(/role-playing/.test(sys)){
  const el=label=>{const m=new RegExp('\\[(\\d+)\\] \\S+: '+label+'([^\\n]*)').exec(user);return m&&{id:Number(m[1]),rest:m[2]}};
  if(/You are: Cora/.test(user))reply={thought:'This is not for me, I have no kids.',feeling:'unsure',action:'give_up'};
  else if(/Thank you/.test(user))reply={thought:'Joined.',feeling:'confident',action:'done'};
  else{const e=el('Email');if(e&&!/current:/.test(e.rest))reply={thought:'I would use this.',feeling:'confident',action:'fill',target:e.id,value:'test-ana@example.com'};else reply={thought:'Join.',feeling:'confident',action:'click',target:el('Join the waitlist').id}}
 }
 else if(/analyse a usability test/.test(sys))reply={headline:'Parents liked it; people without kids left.',issues:[{title:'Not clear who it is for',why:'The page does not say the age range',who:'visitors without kids',visitors:1,quote:'This is not for me'}],fixes:['Say the age range in the headline']};
 else if(/explain problems in a web app/.test(sys))reply={cards:[]};
 else if(/weekly growth brief/.test(sys)){prompts.push('brief');reply={headline:'2 signups from 3 visitors this week.',stopping:[{what:'The age range is not clear',evidence:'A customer said "This is not for me"'}],next:['Say the age range in the headline'],good:'Parents who visit sign up.'}}
 else throw Error('unexpected prompt: '+sys.slice(0,60));
 return parse(JSON.stringify(reply));
};
function request(server,method,url,{body,headers={}}={}){
 return new Promise((resolve,reject)=>{
  const payload=body!==undefined?Buffer.from(JSON.stringify(body)):null;
  const req=http.request({host:'127.0.0.1',port:server.address().port,method,path:url,headers:{...(payload?{'Content-Type':'application/json','Content-Length':payload.length}:{}),...headers}},res=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>{const buf=Buffer.concat(c);let json;try{json=JSON.parse(buf)}catch{}resolve({status:res.statusCode,json,text:buf.toString(),headers:res.headers})})});
  req.on('error',reject);if(payload)req.write(payload);req.end();
 });
}
let server,ip=0;const base=()=>'http://127.0.0.1:'+server.address().port;
const deps=()=>({isOwner:()=>false,callModel,secure:false,checkRuntime:u=>runtime.check(base()+u),inspect:(u,o)=>runtime.inspect(base()+u,o),browse:(u,o)=>runtime.session(base()+u,o)});
test.before(async()=>{
 server=http.createServer(async(req,res)=>{
  if(await backend.handle(req,res))return;if(builder.handlePreview(req,res))return;
  if(await require('../react-hosting').handle?.(req,res))return;
  if(await createApi.handle(req,res,deps()))return;
  res.writeHead(404);res.end();
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
});
test.after(async()=>{server.close();await runtime.close();fs.rmSync(tmp,{recursive:true,force:true})});
async function signup(email){const r=await request(server,'POST','/api/create/signup',{body:{email,password:'password1'},headers:{'x-forwarded-for':'10.9.0.'+(++ip)}});assert.equal(r.status,201,r.text);return r.headers['set-cookie'][0].split(';')[0]}
async function waitJob(cookie,job){for(let i=0;i<2400;i++){const j=(await request(server,'GET','/api/create/jobs/'+job.id,{headers:{cookie}})).json.job;if(['complete','failed'].includes(j.status))return j;await new Promise(r=>setTimeout(r,50))}throw Error('job timeout')}
const credits=async cookie=>(await request(server,'GET','/api/create/credits',{headers:{cookie}})).json.account.credits;
async function project(cookie,name){return (await request(server,'POST','/api/create/projects',{headers:{cookie},body:{name}})).json.project.id}

test('the fix is on us: a broken change is charged, its fix is free, and Kairoq stops after going in circles',{skip:!runtime.available()&&'no browser'},async()=>{
 const cookie=await signup('pay@example.com');
 const id=await project(cookie,'Pay');
 await builder.saveSource(id,{'src/main.jsx':MAIN,'src/App.jsx':OK},{summary:'Start'});
 const c0=await credits(cookie);
 const ok=await waitJob(cookie,(await request(server,'POST','/api/create/projects/'+id+'/chat',{headers:{cookie},body:{message:'Change the title'}})).json.job);
 assert.equal(ok.status,'complete');assert.ok(!ok.free);assert.equal(await credits(cookie),c0-1,'a change that works is charged');
 const bad=await waitJob(cookie,(await request(server,'POST','/api/create/projects/'+id+'/chat',{headers:{cookie},body:{message:'Break it'}})).json.job);
 assert.equal(bad.status,'complete',bad.error);assert.equal(bad.problem,'errors',JSON.stringify(bad.result&&bad.result.runtime_errors));assert.ok(!bad.refunded);assert.match(bad.fix_on_us,/The fix is on us/);
 assert.equal(await credits(cookie),c0-2,'a change that does not work is still charged');
 assert.ok(builder.loadMeta(id).free_fix,'the project remembers that the next fix is free');
 // The first fix is on us; one more is charged; the third is refused instead of charged.
 const f1=await waitJob(cookie,(await request(server,'POST','/api/create/projects/'+id+'/fix',{headers:{cookie},body:{errors:[]}})).json.job);
 assert.equal(f1.loop,1);assert.equal(f1.on_us,true);assert.equal(f1.credits,0);assert.equal(await credits(cookie),c0-2,'the first fix costs nothing');
 assert.equal(builder.loadMeta(id).messages.at(-1).on_us,true,'the chat shows the fix was on us');
 const f2=await waitJob(cookie,(await request(server,'POST','/api/create/projects/'+id+'/fix',{headers:{cookie},body:{errors:[]}})).json.job);
 assert.equal(f2.loop,2);assert.ok(!f2.on_us);assert.equal(await credits(cookie),c0-3,'a second fix of the same problem is charged');
 assert.equal(builder.loadMeta(id).free_fix,undefined,'no new free fix while going in circles');
 const stuck=await request(server,'POST','/api/create/projects/'+id+'/fix',{headers:{cookie},body:{}});
 assert.equal(stuck.status,409);assert.equal(stuck.json.stuck,true);assert.match(stuck.json.error,/same problem is still there/);
 const viaChat=await request(server,'POST','/api/create/projects/'+id+'/chat',{headers:{cookie},body:{message:'Fix it',fix:true}});
 assert.equal(viaChat.status,409,'the Fix buttons in the chat are guarded too');
 assert.equal(await credits(cookie),c0-3,'nothing more was charged for going in circles');
 // Describing the problem in your own words still works; once it is fixed the guard resets.
 const own=await waitJob(cookie,(await request(server,'POST','/api/create/projects/'+id+'/chat',{headers:{cookie},body:{message:'Show a simple working page'}})).json.job);
 assert.equal(own.status,'complete');assert.ok(!own.problem);
 assert.equal(builder.loadMeta(id).loop,undefined);
});

test('customers before code: pitch, landing page with a waitlist, launch posts, AI reactions; real signups decide',{skip:!runtime.available()&&'no browser'},async()=>{
 const cookie=await signup('founder@example.com');
 const id=await project(cookie,'Untitled app');
 assert.equal((await request(server,'POST','/api/create/projects/'+id+'/launch',{headers:{cookie},body:{idea:'too short'}})).status,400);
 const info=(await request(server,'GET','/api/create/projects/'+id+'/launch',{headers:{cookie}})).json;
 assert.equal(info.launch,null);assert.deepEqual(info.price_parts.standard,{pitch:1,page:1,per_visitor:1});
 const c0=await credits(cookie);
 const idea='An app for busy parents in Dubai to book trial swimming lessons for their kids, with bilingual coaches. Pay per lesson.';
 const start=await request(server,'POST','/api/create/projects/'+id+'/launch',{headers:{cookie},body:{idea,target:2,visitors:3}});
 assert.equal(start.status,202,start.text);assert.equal(start.json.job.credits,1+1+3);
 const job=await waitJob(cookie,start.json.job);assert.equal(job.status,'complete',job.error);
 assert.equal(await credits(cookie),c0-5);
 const l=job.result.launch;
 assert.equal(l.pitch.headline,PITCH.headline);assert.equal(builder.loadMeta(id).name,'Swim Saturdays','the project takes the product name');
 assert.match(l.posts.whatsapp,/publish the page to get your link/,'no link until the page is published');
 assert.deepEqual([l.reaction.joined,l.reaction.visitors],[2,3]);assert.match(l.reaction.objections[0].quote,/not for me/);
 assert.equal(l.status.stage,'not_live');
 assert.equal(growth.signups(id,'waitlist'),0,'AI customers joined on a test copy, not the real waitlist');
 const files=builder.loadFiles(id,builder.loadMeta(id).current_version);
 assert.equal(JSON.parse(files['src/backend.json']).collections.waitlist.access,'submit-only');
 // A launch never replaces an existing app.
 assert.equal((await request(server,'POST','/api/create/projects/'+id+'/launch',{headers:{cookie},body:{idea}})).status,409);
 // Published: the link goes into the posts and real signups count toward the goal.
 assert.equal((await request(server,'POST','/api/create/projects/'+id+'/publish',{headers:{cookie},body:{slug:'swim-saturdays'}})).status,200);
 let v=(await request(server,'GET','/api/create/projects/'+id+'/launch',{headers:{cookie}})).json.launch;
 assert.equal(v.status.stage,'collecting');assert.match(v.posts.whatsapp,/\/sites\/swim-saturdays\//);
 for(const email of ['a@example.com','b@example.com']){
  const r=await request(server,'POST','/api/apps/'+id+'/collections/waitlist',{body:{data:{email}}});
  assert.ok([200,201].includes(r.status),r.text);
 }
 v=(await request(server,'GET','/api/create/projects/'+id+'/launch',{headers:{cookie}})).json.launch;
 assert.equal(v.status.stage,'ready');assert.equal(v.status.signups,2);assert.match(v.status.say,/People want this: build it/);
 // Visitors can join the list but cannot read it.
 assert.equal((await request(server,'GET','/api/apps/'+id+'/collections/waitlist')).status,403);
});

test('growth watch: weekly AI customers on the live app, real numbers and a plain brief, emailed to the owner',{skip:!runtime.available()&&'no browser'},async()=>{
 const cookie=await signup('watch@example.com');
 const id=await project(cookie,'Watch');
 await builder.saveSource(id,{'src/main.jsx':MAIN,'src/App.jsx':LANDING,'src/backend.json':JSON.stringify({collections:{waitlist:{access:'submit-only'}}})},{summary:'Landing'});
 assert.equal((await request(server,'POST','/api/create/projects/'+id+'/watch',{headers:{cookie},body:{run:true}})).status,409,'publish and set it up first');
 assert.equal((await request(server,'POST','/api/create/projects/'+id+'/publish',{headers:{cookie},body:{slug:'swim-watch'}})).status,200);
 assert.equal((await request(server,'POST','/api/create/projects/'+id+'/watch',{headers:{cookie},body:{enabled:true}})).status,400,'needs customers and a goal');
 const set=await request(server,'POST','/api/create/projects/'+id+'/watch',{headers:{cookie},body:{enabled:true,audience:'Busy parents in Dubai',goal:'Join the waitlist',count:3}});
 assert.equal(set.status,200,set.text);assert.equal(set.json.watch.collection,'waitlist','signups default to the waitlist');
 // Real visitors and signups this week.
 const analytics=require('../react-analytics');
 for(const n of [1,2,3])analytics.record(id,{method:'GET',headers:{'user-agent':'Mozilla/5.0 test '+n,host:'x'},socket:{remoteAddress:'10.1.0.'+n}});
 for(const email of ['a@example.com','b@example.com'])await request(server,'POST','/api/apps/'+id+'/collections/waitlist',{body:{data:{email}}});
 const c0=await credits(cookie);
 const run=await waitJob(cookie,(await request(server,'POST','/api/create/projects/'+id+'/watch',{headers:{cookie},body:{run:true}})).json.job);
 assert.equal(run.status,'complete',run.error);
 const e=run.result.watch;
 assert.equal(e.numbers.this_week.signups,2);assert.equal(e.numbers.this_week.visitors,3);assert.equal(e.numbers.this_week.rate,66.7);
 assert.deepEqual([e.ai.completed,e.ai.visitors],[2,3]);
 assert.match(e.brief.headline,/2 signups/);assert.equal(e.brief.next[0],'Say the age range in the headline');
 assert.equal(await credits(cookie),c0-3,'the owner pays for the AI customers');
 assert.equal(growth.signups(id,'waitlist'),2,'AI customers did not join the real list');
 const hist=(await request(server,'GET','/api/create/projects/'+id+'/watch',{headers:{cookie}})).json;
 assert.equal(hist.history.length,1);assert.equal(hist.history[0].report_id,e.report_id);
 // The scheduler runs it again only when a week has passed, and emails the brief.
 const sent=[];const send=async(to,subject,body)=>sent.push({to,subject,body});
 assert.deepEqual(await createApi.watchAll({callModel,browse:deps().browse,send}),[],'not due yet');
 const m=builder.loadMeta(id);m.watch.last_at=new Date(Date.now()-8*86400000).toISOString();builder.saveMeta(m);
 const out=await createApi.watchAll({callModel,browse:deps().browse,send});
 assert.deepEqual(out,[{id,ok:true}]);
 assert.equal(sent.length,1);assert.equal(sent[0].to,'watch@example.com');assert.match(sent[0].subject,/weekly growth brief/);
 assert.match(sent[0].body,/What is stopping signups:[\s\S]*age range[\s\S]*pay only for fixes that work/);
 // Out of credits: paused and told once, not charged into the negative.
 const accounts=require('../builder-accounts');const acc=accounts.get(builder.loadMeta(id).owner);
 accounts.charge(acc.id,acc.credits,'drain');
 const m2=builder.loadMeta(id);m2.watch.last_at=new Date(Date.now()-8*86400000).toISOString();builder.saveMeta(m2);
 const paused=await createApi.watchAll({callModel,browse:deps().browse,send});
 assert.equal(paused[0].ok,false);assert.equal(builder.loadMeta(id).watch.paused,true);
 assert.match(sent.at(-1).subject,/paused/);
});

test('the pitch keeps to what the idea says and posts get the link',()=>{
 const p=growth.normalizePitch({...PITCH,benefits:[...PITCH.benefits,{title:'x',text:'y'},{title:'z',text:'w'}],posts:{...PITCH.posts,x:'y'.repeat(400)}},'idea');
 assert.equal(p.benefits.length,4);assert.equal(p.posts.x.length,280);
 const posts=growth.postsWithLink(p.posts,'https://swim.example/');
 assert.equal(posts.linkedin,'Founder here, testing an idea: https://swim.example/');
 assert.equal(posts.reddit.where[0],'dubai','subreddit names without r/');
 assert.match(growth.landingRequest(p),/access "submit-only"/);
 assert.equal(growth.watchDue({published:{version:1},watch:{enabled:true,last_at:new Date().toISOString()}}),false);
 assert.equal(growth.watchDue({published:{version:1},watch:{enabled:true}}),true);
 assert.equal(growth.watchDue({published:null,watch:{enabled:true}}),false);
});

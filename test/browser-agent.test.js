"use strict";
// The browser agent: what it sees of a page (all clickable things, nothing hidden behind a
// popup, stable numbers, passwords never read), several actions per step, loop detection,
// a sceptical check of "done", bot walls, and the owner's web agent with watches and credits.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-bagent-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
process.env.KAIROQ_WEB_TASKS_DIR=path.join(tmp,'web');
process.env.KAIROQ_FREE_CREDITS='10';
process.env.KAIROQ_EXTERNAL_ALLOW_LOCAL='1';
const runtime=require('../runtime-check'),agent=require('../browser-agent'),W=require('../web-tasks'),accounts=require('../builder-accounts');

const PAGE=`<!doctype html><html><head><meta charset="utf-8"><title>Shop</title><style>
 .card{cursor:pointer;padding:8px;border:1px solid #ccc;margin:4px}
 .card span{cursor:pointer}
 #overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center}
 #overlay.gone{display:none}
</style></head><body>
<h1>Plants</h1>
<div class="card" id="fern"><span>Fern</span> £12</div>
<div onclick="document.getElementById('out').textContent='Clicked palm'">Palm £20</div>
<div role="button" tabindex="0">Help</div>
<button id="hidden-behind">Checkout</button>
<form onsubmit="event.preventDefault();document.getElementById('out').textContent='Thanks '+this.name.value">
 <label>Name <input name="name"></label>
 <label>Password <input type="password" name="pw" value="secret123"></label>
 <button type="submit">Send</button>
</form>
<p id="out"></p>
<div id="host"></div>
<div id="overlay"><button onclick="document.getElementById('overlay').className='gone'">Accept cookies</button></div>
<script>document.getElementById('host').attachShadow({mode:'open'}).innerHTML='<button>Shadow buy</button>';
const r=document.createElement('div');r.textContent='React card';r['__reactProps$x1']={onClick(){document.getElementById('out').textContent='React clicked'}};r.addEventListener('click',()=>r['__reactProps$x1'].onClick());document.body.insertBefore(r,document.getElementById('host'));
document.getElementById('fern').addEventListener('click',()=>{const b=document.createElement('button');b.textContent='Add fern';document.body.appendChild(b)});</script>
</body></html>`;
let server;
// A pretend captcha: the "I am human" button sends a POST, and only a real POST unlocks the page.
let solved=false;
const CAPTCHA=`<!doctype html><html><head><meta charset="utf-8"><title>Just a moment</title></head><body style="margin:0">
<p id="msg">Please verify you are human to continue (captcha).</p>
<button id="human" style="position:absolute;left:20px;top:60px;width:200px;height:50px" onclick="fetch('verify',{method:'POST'}).then(r=>r.text()).then(t=>{if(t==='ok')location.reload()})">I am human</button>
</body></html>`;
const OPEN='<!doctype html><html><head><meta charset="utf-8"><title>Rooms</title></head><body><h1>Rooms</h1><p>Double room: 140 euros a night.</p></body></html>';
test.before(async()=>{server=http.createServer((req,res)=>{
 if(req.url.startsWith('/gate/')){
  if(req.method==='POST'&&req.url.endsWith('/verify')){solved=true;res.writeHead(200,{'Content-Type':'text/plain'});return res.end('ok')}
  res.writeHead(200,{'Content-Type':'text/html'});return res.end(solved?OPEN:CAPTCHA);
 }
 res.writeHead(200,{'Content-Type':'text/html'});res.end(req.url.includes('blocked')?'<title>Attention Required</title><p>Please verify you are a human (captcha)</p>':PAGE)});await new Promise(r=>server.listen(0,'127.0.0.1',r))});
test.after(async()=>{server.close();await runtime.close();fs.rmSync(tmp,{recursive:true,force:true})});
const url=p=>'http://127.0.0.1:'+server.address().port+'/app/'+(p||'');

test('the page as the agent sees it: every clickable thing, nothing behind a popup, stable numbers, no passwords',{skip:!runtime.available()&&'no Chromium'},async()=>{
 const s=await runtime.session(url());
 try{
  let o=await s.observe();
  const labels=o.elements.map(e=>e.label);
  // The cookie popup covers the page: only it can be clicked.
  assert.deepEqual(labels,['Accept cookies']);
  assert.ok(o.dialog===false);
  await s.act({action:'click',target:o.elements[0].id});
  o=await s.observe();
  const by=l=>o.elements.find(e=>e.label===l||e.label.startsWith(l));
  for(const l of ['React card','Fern','Palm £20','Help','Checkout','Name','Password','Send','Shadow buy'])assert.ok(by(l),'missing '+l+' in '+JSON.stringify(o.elements.map(e=>e.label)));
  assert.equal(by('Fern').kind,'clickable');assert.equal(by('Help').kind,'button');
  // Nested pointer elements with the same text count once.
  assert.equal(o.elements.filter(e=>/^Fern/.test(e.label)).length,1);
  assert.equal(by('Password').value,'(filled)');
  assert.ok(!JSON.stringify(o).includes('secret123'));
  // Numbers stay the same, and what appears after an action is marked new.
  const fernId=by('Fern').id,before=o.elements.map(e=>e.id);
  await s.act({action:'click',target:fernId});
  const o2=await s.observe();
  assert.equal(o2.elements.find(e=>e.label.startsWith('Fern')).id,fernId);
  const added=o2.elements.find(e=>e.label==='Add fern');assert.ok(added&&added.new);assert.ok(!before.includes(added.id));
  assert.ok(o2.elements.filter(e=>e.label!=='Add fern').every(e=>!e.new));
  // Clicks on onclick divs, typing with Enter, keys, find_text.
  await s.act({action:'click',target:by('Palm £20').id});
  assert.match((await s.observe()).text,/Clicked palm/);
  await s.act({action:'fill',target:by('Name').id,value:'Ana',submit:true});
  assert.match((await s.observe()).text,/Thanks Ana/);
  await s.act({action:'key',value:'Escape'});
  await assert.rejects(s.act({action:'key',value:'Control+W'}),/Unknown key/);
  await s.act({action:'find_text',value:'Plants'});
  await assert.rejects(s.act({action:'go_to',value:'http://example.com/'}),/stays on this site/);
  assert.match(await s.read(),/Fern/);
 }finally{await s.close()}
});

// A scripted session: a contact form whose Send button only works once a name is typed.
function fakeSession({blocked=false}={}){
 const st={name:'',sent:false,clicks:0};
 const els=()=>[{id:1,kind:'input:text',label:'Name',...(st.name?{value:st.name}:{})},{id:2,kind:'button',label:'Send'},{id:3,kind:'button',label:'Dead button'}];
 return{
  st,
  observe:async()=>({title:blocked?'Attention Required':'Contact',path:'/',text:blocked?'Please verify you are a human':st.sent?'Thanks, we will call you':'Contact us',elements:blocked?[]:els(),errors:[]}),
  act:async a=>{if(a.action==='fill')st.name=a.value;else if(a.action==='click'&&a.target===2&&st.name)st.sent=true;else if(a.action==='click')st.clicks++},
  screenshot:async()=>null,read:async()=>'full text',close:async()=>{},status:()=>200
 };
}
function model(script){
 const seen=[];
 const fn=async(opts,parse)=>{
  const sys=opts.messages[0].content,user=typeof opts.messages[1].content==='string'?opts.messages[1].content:opts.messages[1].content[0].text;
  seen.push({sys,user,tier:opts.tier});
  return parse(JSON.stringify(script(sys,user,seen.length)));
 };
 fn.seen=seen;return fn;
}

test('several actions per step, notes carried forward, and a checked "done"',async()=>{
 const s=fakeSession();
 const m=model((sys,user)=>{
  if(/You check whether a browser agent/.test(sys))return{verdict:/Thanks, we will call you/.test(user),reason:'The thank-you message is on screen',blocked:false};
  if(/Thanks, we will call you/.test(user))return{evaluation:'ok',memory:'Sent the form as Ana',next_goal:'finish',actions:[{action:'done',value:'Sent the contact form as Ana; the page says they will call.'}]};
  return{evaluation:'',memory:'On the contact page',next_goal:'send the form',actions:[{action:'fill',target:1,value:'Ana'},{action:'click',target:2}]};
 });
 const r=await agent.run({session:s,goal:'Send the contact form',mode:'task',callModel:m,maxSteps:5});
 assert.equal(r.outcome,'completed');assert.match(r.answer,/Sent the contact form/);
 assert.deepEqual(r.steps.map(x=>x.action),['fill','click','done']);
 assert.equal(r.verdict.ok,true);assert.equal(r.verdict.checked,true);
 // The second step's prompt carries the model's own notes and what happened.
 assert.match(m.seen[1].user,/Your notes: On the contact page/);assert.match(m.seen[1].user,/fill "Name" "Ana"/);
});

test('a "done" the checker rejects does not count; repeating a dead click is noticed; bot walls end as blocked',async()=>{
 // Claims done without sending: the checker says no.
 let s=fakeSession();
 let m=model(sys=>/You check whether/.test(sys)?{verdict:false,reason:'The form was never sent',blocked:false}:{actions:[{action:'done',value:'All done'}]});
 let r=await agent.run({session:s,goal:'Send the contact form',mode:'task',callModel:m,maxSteps:3});
 assert.equal(r.outcome,'stuck');assert.equal(r.steps.at(-1).judged,'The form was never sent');
 // The same dead click again and again: a nudge, then it stops after the step limit.
 s=fakeSession();
 m=model(()=>({actions:[{action:'click',target:3}]}));
 r=await agent.run({session:s,goal:'Send the form',mode:'task',callModel:m,maxSteps:5});
 assert.equal(r.outcome,'stuck');assert.ok(r.steps.every(x=>x.no_change));
 assert.ok(m.seen.some(x=>/three times on this same screen/.test(x.user)));
 // An element that does not exist is skipped with a note, not clicked.
 s=fakeSession();
 m=model((sys,user,n)=>n===1?{actions:[{action:'click',target:99}]}:{actions:[{action:'give_up',value:'cannot'}]});
 r=await agent.run({session:s,goal:'x',mode:'task',callModel:m,maxSteps:3});
 assert.match(m.seen[1].user,/no element with that number/);assert.equal(r.outcome,'gave_up');
 // A captcha page: blocked, no model call at all.
 m=model(()=>{throw Error('should not be called')});
 r=await agent.run({session:fakeSession({blocked:true}),goal:'x',mode:'task',callModel:m,maxSteps:3});
 assert.equal(r.outcome,'blocked');assert.equal(m.seen.length,0);
});

test('screenshots are added when an action changed nothing, and dropped when no model can see images',async()=>{
 const s=fakeSession();s.screenshot=async()=>'SHOT';
 let calls=0;
 const m=async(opts,parse)=>{
  calls++;
  if(Array.isArray(opts.messages[1].content)){assert.equal(opts.tier,'vision');throw Error('Pro and image models need paid approval')}
  return parse(JSON.stringify(calls<3?{actions:[{action:'click',target:3}]}:{actions:[{action:'give_up',value:'nothing works'}]}));
 };
 const r=await agent.run({session:s,goal:'x',mode:'task',callModel:m,maxSteps:4,judge:false});
 assert.equal(r.outcome,'gave_up');
});

test('web agent: a run costs credits (given back when nothing is found), watches repeat and pause without credits',async()=>{
 const acc=accounts,made=acc.signup('shop@example.com','password1');
 const id=(made.account||made).id;
 assert.ok(id,'account');
 const start=acc.get(id).credits;
 let price='£12';
 const browseSite=async()=>({observe:async()=>({title:'Rival',path:'/',text:'Fern '+price,elements:[],errors:[]}),act:async()=>{},screenshot:async()=>null,read:async()=>'Fern '+price,close:async()=>{},status:()=>200});
 const callModel=async(opts,parse)=>{
  const sys=opts.messages[0].content;
  if(/You check whether/.test(sys))return parse('{"verdict":true,"reason":"on screen","blocked":false}');
  if(/You compare two answers/.test(sys)){const u=opts.messages[1].content;const b=/Before:\n(.*)/.exec(u)[1],n=/Now:\n(.*)/.exec(u)[1];return parse(JSON.stringify({changed:b!==n,summary:b!==n?'Fern went from '+b+' to '+n:''}))}
  return parse(JSON.stringify({actions:[{action:'done',value:'Fern costs '+price}]}));
 };
 const run=await W.execute(id,{url:'https://rival.example/',task:'price of a fern'},{callModel,browseSite});
 assert.equal(run.outcome,'completed');assert.equal(run.answer,'Fern costs £12');
 assert.equal(acc.get(id).credits,start-2);
 // No answer: the credits come back.
 const empty=async(opts,parse)=>parse(JSON.stringify({actions:[{action:'give_up',value:''}]}));
 await W.execute(id,{url:'https://rival.example/',task:'price of a fern'},{callModel:empty,browseSite});
 assert.equal(acc.get(id).credits,start-2);
 assert.equal(W.list(id).runs.length,2);
 // A weekly watch: the first check records the answer, a later one spots the change.
 const w=W.addWatch(id,{url:'https://rival.example/',task:'price of a fern',every:'week'});
 let t=await W.tick({callModel,browseSite});
 assert.equal(t.ran,1);assert.equal(t.changed,0);
 price='£15';
 t=await W.tick({callModel,browseSite,now:Date.now()+8*86400000});
 assert.equal(t.changed,1);
 const last=W.list(id).runs[0];assert.equal(last.changed,true);assert.match(last.change,/£12 to Fern costs £15/);
 // Out of credits: the watch pauses.
 acc.charge(id,acc.get(id).credits,'spend all');
 t=await W.tick({callModel,browseSite,now:Date.now()+16*86400000});
 assert.equal(t.paused,1);assert.equal(W.list(id).watches.find(x=>x.id===w.id).paused,true);
 await assert.rejects(W.start(id,{url:'http://10.0.0.1/',task:'read the admin page'},{callModel,browseSite}),/https|public/i);
});

test('the website check scores a site that blocks every AI customer on the technical basics only',()=>{
 const sc=require('../site-check');
 const tech=[{ok:true},{ok:true},{ok:false},{ok:true}];
 assert.equal(sc.score({visitors:5,blocked:5,completion_rate:0},tech),75);
 assert.equal(sc.score({visitors:5,blocked:1,completion_rate:50},tech),Math.round(35+22.5));
 const f=require('../synthetic-customers').funnel([{persona:{device:'phone'},outcome:'blocked',steps:[]},{persona:{device:'phone'},outcome:'completed',steps:[{path:'/'}]},{persona:{device:'desktop'},outcome:'gave_up',steps:[{path:'/'}]}]);
 assert.equal(f.blocked,1);assert.equal(f.completion_rate,50);
});

test('a person can take over: a captcha pauses the agent, the person solves it in the live view, the agent finishes',{skip:!runtime.available()&&'no Chromium'},async()=>{
 const id=(()=>{const m=accounts.signup('gate@example.com','password1');return(m.account||m).id})();
 const callModel=async(opts,parse)=>{
  const sys=opts.messages[0].content,user=typeof opts.messages[1].content==='string'?opts.messages[1].content:opts.messages[1].content[0].text;
  if(/You check whether/.test(sys))return parse('{"verdict":true,"reason":"price on screen","blocked":false}');
  if(/Double room: 140 euros/.test(user))return parse(JSON.stringify({memory:'found it',actions:[{action:'done',value:'A double room costs 140 euros a night.'}]}));
  return parse(JSON.stringify({actions:[{action:'scroll',value:'down'}]}));
 };
 const run=await W.start(id,{url:'http://127.0.0.1:'+server.address().port+'/gate/',task:'the price of a double room'},{callModel});
 let r;
 for(let i=0;i<100;i++){r=W.get(id,run.id);if(r.status==='needs_you'||r.status!=='running')break;await new Promise(z=>setTimeout(z,100))}
 assert.equal(r.status,'needs_you');assert.match(r.need,/captcha/);
 // The live view, and input only while it is the person's turn.
 const jpg=await W.frame(id,run.id);assert.equal(jpg[0],0xff);assert.equal(jpg[1],0xd8);
 await assert.rejects(W.input('someone-else',run.id,{type:'click',x:1,y:1}),/not running/);
 await assert.rejects(W.input(id,run.id,{type:'click',x:99999,y:1}),/Outside/);
 // The person's click really sends the POST (the agent alone could not).
 await W.input(id,run.id,{type:'click',x:120,y:85});
 for(let i=0;i<30&&!solved;i++)await new Promise(z=>setTimeout(z,100));
 assert.equal(solved,true);
 W.handBack(id,run.id);
 for(let i=0;i<150;i++){r=W.get(id,run.id);if(r.status!=='running'&&r.status!=='needs_you')break;await new Promise(z=>setTimeout(z,100))}
 assert.equal(r.outcome,'completed',JSON.stringify(r));assert.match(r.answer,/140 euros/);
 assert.ok(r.steps.some(x=>x.action==='handoff'));
 // Once the run has closed its browser there is nothing left to see or control.
 for(let i=0;i<50;i++){try{await W.frame(id,run.id)}catch{break}await new Promise(z=>setTimeout(z,100))}
 await assert.rejects(W.frame(id,run.id),/not running/);
});

test('handing over: ask_human and "take over" pause the agent; without a person it ends as blocked',async()=>{
 // ask_human: the person does it, the agent carries on.
 let s=fakeSession(),asked=[];
 let m=model((sys,user)=>/You check whether/.test(sys)?{verdict:true,reason:'ok',blocked:false}:/Thanks, we will call you/.test(user)?{actions:[{action:'done',value:'sent'}]}:{actions:[{action:'ask_human',value:'Please sign in'}]});
 let r=await agent.run({session:s,goal:'x',mode:'task',callModel:m,maxSteps:5,handoff:async reason=>{asked.push(reason);s.st.name='Ana';s.st.sent=true;return{ok:true}}});
 assert.deepEqual(asked,['Please sign in']);assert.equal(r.outcome,'completed');
 assert.match(m.seen.at(-2).user,/The person finished in the browser/);
 // Without anyone to hand to, ask_human ends the run as blocked.
 r=await agent.run({session:fakeSession(),goal:'x',mode:'task',callModel:model(()=>({actions:[{action:'ask_human',value:'needs a code'}]})),maxSteps:3});
 assert.equal(r.outcome,'blocked');
 // "Take over" from the person: the agent pauses before its next step.
 let want=true;asked=[];
 r=await agent.run({session:fakeSession(),goal:'x',mode:'task',callModel:model(()=>({actions:[{action:'give_up',value:'done here'}]})),maxSteps:3,wantsHandoff:()=>want,handoff:async reason=>{asked.push(reason);want=false;return{ok:true}}});
 assert.deepEqual(asked,['You asked to take over.']);assert.equal(r.outcome,'gave_up');
 // A captcha nobody solves: blocked; personas never ask for a person.
 r=await agent.run({session:fakeSession({blocked:true}),goal:'x',mode:'task',callModel:model(()=>{throw Error('no')}),maxSteps:3,handoff:async()=>({ok:false})});
 assert.equal(r.outcome,'blocked');
 assert.ok(!agent.systemPrompt('persona').includes('ask_human'));
});

test('sending a form (a normal POST, like Netlify Forms) counts as sent, not as a failed click; the visitor is told it went through',{skip:!runtime.available()&&'no Chromium'},async()=>{
 const FORM='<!doctype html><html><head><meta charset="utf-8"><title>Stays</title></head><body><h1>Get a quote</h1><form method="POST" action="/thanks"><label>Your name <input name="n" required></label><button type="submit">Submit request</button></form></body></html>';
 const srv=http.createServer((q,r)=>{r.writeHead(200,{'Content-Type':'text/html'});r.end(q.url.startsWith('/thanks')?'<h1>Thanks</h1>':FORM)});
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const s=await runtime.session('http://127.0.0.1:'+srv.address().port+'/',{site:true});
 const seen=[];let turn=0;
 const callModel=async(o,parse)=>{const t=typeof o.messages.at(-1).content==='string'?o.messages.at(-1).content:o.messages.at(-1).content[0].text;seen.push(t);turn++;
  const id=re=>Number(new RegExp('\\[(\\d+)\\][^\\n]*'+re).exec(t)[1]);
  return parse(JSON.stringify(turn===1?{thought:'name',feeling:'confident',actions:[{action:'fill',target:id('name'),value:'Priya'}]}:turn===2?{thought:'send',feeling:'confident',actions:[{action:'click',target:id('Submit')}]}:{thought:'sent',feeling:'confident',actions:[{action:'done',value:'Sent my request'}]}))};
 try{
  const r=await agent.run({session:s,goal:'Get a quote',mode:'persona',persona:'Priya',callModel,maxSteps:5,judge:false});
  assert.equal(r.outcome,'completed');
  const click=r.steps.find(x=>x.action==='click');assert.equal(click.sent,true);assert.equal(click.error,undefined);
  assert.match(seen[2],/Your form was sent/);
 }finally{await s.close();srv.close()}
});

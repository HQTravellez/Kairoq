"use strict";
// A change that leaves the app blank is not kept: the preview stays on the version that worked.
// And Kairoq's browser adds a record like a customer would, so records that are never saved
// (kept only in the page) are found before the owner finds them.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-rollback-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_DESIGN_BRIEF='off';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
const builder=require('../react-builder'),runtime=require('../runtime-check'),sandbox=require('../react-sandbox'),backend=require('../react-backend');

const GOOD='export default function App(){return <main><h1>Hello</h1></main>}\n';
const reply=obj=>(_o,parse)=>Promise.resolve(parse(JSON.stringify(obj)));

test('a change that still shows a blank page after every try is not kept',async()=>{
 const meta=builder.create({name:'Keep',owner:'owner'});await builder.initialize(meta);
 await builder.edit(meta.id,'hello',{callModel:reply({message:'v2',files:{'src/App.jsx':GOOD}}),checkRuntime:async()=>({errors:[]})});
 assert.equal(builder.loadMeta(meta.id).current_version,2);
 const r=await builder.edit(meta.id,'break it',{callModel:reply({message:'v3',files:{'src/App.jsx':GOOD.replace('Hello','Bye')}}),checkRuntime:async()=>({errors:['Blank page: nothing rendered inside #root.']})});
 const m=builder.loadMeta(meta.id);
 assert.equal(m.current_version,2,'the working version stays');
 assert.deepEqual(r.rolled_back.kept,2);assert.equal(r.version,2);assert.deepEqual(r.runtime_errors,[]);
 const tried=m.versions.find(v=>v.n===r.rolled_back.tried);
 assert.equal(tried.broken,true,'the broken try is kept in the history');
 assert.match(m.messages.at(-1).text,/stays on version 2/);
 // Smaller problems (a dead button) do not roll back.
 const r2=await builder.edit(meta.id,'tweak',{callModel:reply({message:'v',files:{'src/App.jsx':GOOD.replace('Hello','Hi')}}),checkRuntime:async()=>({errors:['Clicking "Reports" does nothing: nothing on the page changes.']})});
 assert.equal(r2.rolled_back,undefined);assert.equal(builder.loadMeta(meta.id).current_version,r2.version);
});

test('the browser check runs on a test copy, and a record shown but never saved is an error',async()=>{
 const meta=builder.create({name:'Crm',owner:'owner'});await builder.initialize(meta);
 const seen=[];
 const r=await builder.edit(meta.id,'crm',{callModel:reply({message:'v',files:{'src/App.jsx':GOOD}}),checkRuntime:async(url,o)=>{seen.push(o);return{errors:[],journey:seen.length<3?{token:'Kq123456',shown:true,reloaded:false}:{token:'Kq654321',shown:true,reloaded:false}}}});
 assert.ok(seen[0].sandbox&&seen[0].journey,'sandbox and journey are passed');
 assert.match(JSON.stringify(builder.loadMeta(meta.id).versions.at(-1).runtime_errors||r.runtime_errors),/gone after reloading/);
 // When the record is in the app's data, nothing is reported.
 const m2=builder.create({name:'Crm2',owner:'owner'});await builder.initialize(m2);
 const r2=await builder.edit(m2.id,'crm',{callModel:reply({message:'v',files:{'src/App.jsx':GOOD}}),checkRuntime:async(url,o)=>{const box=sandbox.lookup(m2.id,o.sandbox);const db=backend.openFile(path.join(box.dir,'data.sqlite'));db.prepare("INSERT INTO records(id,collection,owner_id,data,created_at,updated_at) VALUES('r1','contacts',NULL,?,'x','x')").run(JSON.stringify({name:'Kq777777 Test'}));return{errors:[],journey:{token:'Kq777777',shown:true,reloaded:true}}}});
 assert.deepEqual(r2.runtime_errors,[]);
 // What the owner sees under the build.
 assert.deepEqual(r2.verified,{opens:null,menus:null,phone:null,signup:null,saves:true});
 const m3=builder.create({name:'Crm3',owner:'owner'});await builder.initialize(m3);
 const r3=await builder.edit(m3.id,'crm',{callModel:reply({message:'v',files:{'src/App.jsx':GOOD}}),checkRuntime:async()=>({errors:[],facts:{opened:true,menus:{checked:5,dead:0},phone:true},journey:{token:'Kq0',signed_up:true,submitted:true,shown:false}})});
 assert.deepEqual(r3.verified,{opens:true,menus:{checked:5,dead:0},phone:true,signup:true,saves:null},'a form that showed nothing and saved nothing is not claimed as saved');
 assert.deepEqual(builder.loadMeta(m3.id).messages.at(-1).verified,r3.verified);
});

const FORM=save=>`<!doctype html><html><body><div id="root"><h1>Contacts</h1><form id="f"><input name="name" placeholder="Name" required><input type="email" name="email" placeholder="Email"><button>Add contact</button></form><ul id="list"></ul></div><script>
const list=document.getElementById('list');
function draw(items){list.innerHTML='';for(const i of items){const li=document.createElement('li');li.textContent=i.name+' · '+i.email;list.append(li)}}
${save?"draw(JSON.parse(localStorage.getItem('c')||'[]'));":"draw([]);"}
document.getElementById('f').onsubmit=e=>{e.preventDefault();const items=[...list.children].map(li=>({name:li.textContent.split(' · ')[0],email:li.textContent.split(' · ')[1]}));items.push({name:e.target.name.value,email:e.target.email.value});${save?"localStorage.setItem('c',JSON.stringify(items));":""}draw(items);e.target.reset()};
</script></body></html>`;

test('a collection the code uses must be declared, or the change is sent back before it is built',async()=>{
 const meta=builder.create({name:'Undeclared',owner:'owner'});await builder.initialize(meta);
 const CRM="import { collection } from 'kairoq';\nexport default function App(){collection('contacts').list();return <h1>CRM</h1>}\n";
 const seen=[];let call=0;
 const r=await builder.edit(meta.id,'crm',{callModel:(o,parse)=>{seen.push(o.messages.at(-1).content);return Promise.resolve(parse(JSON.stringify(call++?{message:'v',files:{'src/App.jsx':CRM,'src/backend.json':'{"collections":{"contacts":{"access":"private"}}}'}}:{message:'v',files:{'src/App.jsx':CRM}})))}});
 assert.equal(r.attempts,2);
 assert.match(String(seen[1]),/src\/backend\.json is missing.*"contacts"/);
 assert.deepEqual(builder.undeclaredCollections(builder.loadFiles(meta.id,r.version)),[]);
});

test('a save the server refuses while adding a record is an error',async()=>{
 const meta=builder.create({name:'Refused',owner:'owner'});await builder.initialize(meta);
 const r=await builder.edit(meta.id,'crm',{callModel:reply({message:'v',files:{'src/App.jsx':GOOD}}),checkRuntime:async()=>({errors:[],journey:{token:'Kq1',shown:false,reloaded:false,api_errors:['HTTP 404 from POST /api/apps/x/collections/tasks: Collection "tasks" is not declared in src/backend.json']}})});
 assert.match(JSON.stringify(r.runtime_errors),/Adding a record like a customer failed: HTTP 404/);
});

test('the journey adds a record with the form and reloads',{skip:!runtime.available()&&'no Chromium'},async()=>{
 let page='';
 const server=http.createServer((q,r)=>{r.writeHead(200,{'Content-Type':'text/html'});r.end(page)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const url='http://127.0.0.1:'+server.address().port+'/';
 try{
  page=FORM(false);
  let r=await runtime.check(url,{journey:true});
  assert.ok(r.journey,JSON.stringify(r));assert.equal(r.journey.shown,true);assert.equal(r.journey.reloaded,false);assert.match(r.journey.token,/^Kq\d{6}$/);
  page=FORM(true);
  r=await runtime.check(url,{journey:true});
  assert.equal(r.journey.shown,true);assert.equal(r.journey.reloaded,true);
  assert.equal(r.facts.opened,true);assert.equal(r.facts.phone,true,'the page fits a phone');
  // A page without an add form: nothing to tell.
  page='<!doctype html><html><body><div id="root"><h1>About us</h1></div></body></html>';
  r=await runtime.check(url,{journey:true});
  assert.equal(r.journey,undefined);
 }finally{server.close();await runtime.close().catch(()=>{})}
});

test('a fix for a browser error goes on top of the try it fixes, not the old version',async()=>{
 const meta=builder.create({name:'Layer',owner:'owner'});await builder.initialize(meta);
 const APP="import { collection } from 'kairoq';\nexport default function App(){return <main><h1>Invoices</h1></main>}\n";
 const replies=[{message:'app',files:{'src/App.jsx':APP,'src/Extra.jsx':'export default function Extra(){return null}\n'}},{message:'declared',files:{'src/backend.json':JSON.stringify({collections:{invoices:{access:'private'}}})}}];
 const prompts=[];let calls=0;
 const r=await builder.edit(meta.id,'invoices',{callModel:(o,parse)=>{prompts.push(o.messages.at(-1).content);return Promise.resolve(parse(JSON.stringify(replies[calls++])))},checkRuntime:async()=>({errors:calls===1?['HTTP 404 from GET /api/apps/x/collections/invoices: Collection "invoices" is not declared in src/backend.json']:[]})});
 assert.equal(r.attempts,2);
 const files=builder.loadFiles(meta.id,r.version);
 assert.equal(files['src/App.jsx'],APP,'the app from the first try is kept');
 assert.ok(files['src/Extra.jsx'],'new files from the first try are kept');
 assert.match(files['src/backend.json'],/invoices/);
 assert.match(prompts[1],/previous change is kept/);
});

test('the journey opens "+ Add" dialogs, skips filled-in and blocked forms, and finds a single card',{skip:!runtime.available()&&'no Chromium'},async()=>{
 const page=`<!doctype html><html><body><div id="root"><main>
<form id="profile"><label>Your name <input name="name" value="Ana"></label><button>Save changes</button></form>
<button id="fu">Add follow-up</button><button id="add" aria-label="Add contact">+</button>
<section id="cards"></section><div id="host"></div></main></div><script>
const saved=()=>JSON.parse(localStorage.getItem('c')||'[]');
const draw=()=>{document.getElementById('cards').innerHTML=saved().map(n=>'<button class="card"><span>'+n+'</span></button>').join('')};draw();
document.getElementById('profile').onsubmit=e=>{e.preventDefault();localStorage.setItem('profile','touched')};
document.getElementById('fu').onclick=()=>{document.getElementById('host').innerHTML='<div role="dialog"><form id="f2"><label>Task <input name="t" required></label><label>Contact <select name="c" required><option value="">Choose</option></select></label><button>Save</button></form></div>'};
document.getElementById('add').onclick=()=>{document.getElementById('host').innerHTML='<div role="dialog"><label>Full name <input id="n"></label><label>Check in <input type="date" id="a"></label><label>Check out <input type="date" id="b"></label><button type="button" id="save">Save contact</button></div>';
 document.getElementById('save').onclick=()=>{const a=document.getElementById('a').value,b=document.getElementById('b').value;if(!a||b<=a||a<=new Date().toISOString().slice(0,10))return;localStorage.setItem('c',JSON.stringify([...saved(),document.getElementById('n').value]));document.getElementById('host').innerHTML='';draw()}};
</script></body></html>`;
 const server=http.createServer((q,r)=>{r.writeHead(200,{'Content-Type':'text/html'});r.end(page)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const r=await runtime.check('http://127.0.0.1:'+server.address().port+'/',{journey:true});
  assert.ok(r.journey,JSON.stringify(r));
  assert.equal(r.journey.submitted,true);assert.equal(r.journey.shown,true,'the record in a single card counts');assert.equal(r.journey.reloaded,true);
 }finally{server.close();await runtime.close().catch(()=>{})}
});

"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http'),crypto=require('crypto');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-tier4-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
process.env.APP_ENCRYPTION_KEY='tier4-encryption-key-0123456789';
process.env.KAIROQ_FREE_CREDITS='10';
process.env.KAIROQ_FUNCTION_TIMEOUT_MS='1500';
const builder=require('../react-builder'),hosting=require('../react-hosting'),createApi=require('../create-api'),backend=require('../react-backend'),functions=require('../react-functions'),google=require('../google-oauth'),security=require('../react-security'),exporter=require('../react-export');

function reply(obj){return(_o,parse)=>Promise.resolve(parse(JSON.stringify(obj)))}
let lastModelOpts=null;
const callModel=(opts,parse)=>{lastModelOpts={...opts,messages:[...opts.messages]};return Promise.resolve(parse(JSON.stringify({message:'ok',files:{'src/App.jsx':'export default function App(){return <p className="p-2">ok</p>}\n'}})))};
function request(server,method,url,{body,raw,headers={}}={}){
 return new Promise((resolve,reject)=>{
  const payload=raw!==undefined?Buffer.from(raw):body!==undefined?Buffer.from(JSON.stringify(body)):null;
  const req=http.request({host:'127.0.0.1',port:server.address().port,method,path:url,headers:{...(payload?{'Content-Type':raw!==undefined?'text/plain':'application/json','Content-Length':payload.length}:{}),...headers}},res=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>{const buf=Buffer.concat(c);let json;try{json=JSON.parse(buf)}catch{}resolve({status:res.statusCode,headers:res.headers,text:buf.toString(),json})})});
  req.on('error',reject);if(payload)req.write(payload);req.end();
 });
}
let server,ip=0;
test.before(async()=>{
 server=http.createServer(async(req,res)=>{if(await backend.handle(req,res))return;if(builder.handlePreview(req,res))return;if(hosting.handlePath(req,res))return;if(await createApi.handle(req,res,{isOwner:()=>false,callModel,secure:false}))return;res.writeHead(404);res.end()});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
});
test.after(()=>{server.close();fs.rmSync(tmp,{recursive:true,force:true})});
async function signup(email){const r=await request(server,'POST','/api/create/signup',{body:{email,password:'password1'},headers:{'x-forwarded-for':'10.1.0.'+(++ip)}});return{cookie:r.headers['set-cookie'][0].split(';')[0],account:r.json.account}}
async function appWith(cookie,files){
 const id=(await request(server,'POST','/api/create/projects',{headers:{cookie},body:{name:'T4'}})).json.project.id;
 await builder.saveSource(id,{...builder.loadFiles(id,1),...files},{summary:'setup'});
 return id;
}

test('generated apps can use the curated npm packages; others are rejected; exports list them',async()=>{
 const base=builder.template('x');
 const app="import { LineChart, Line } from 'recharts';\nimport { motion } from 'framer-motion';\nimport { format } from 'date-fns';\nimport { enUS } from 'date-fns/locale';\nimport * as Dialog from '@radix-ui/react-dialog';\nimport { toast, Toaster } from 'sonner';\nexport default function App(){return <motion.div><Toaster/><Dialog.Root/>{format(new Date(0),'P',{locale:enUS})}<LineChart width={100} height={50} data={[{v:1}]}><Line dataKey='v'/></LineChart><button onClick={()=>toast('hi')}>t</button></motion.div>}\n";
 assert.deepEqual(builder.validateFiles({...base,'src/App.jsx':app}),[]);
 const bad=builder.validateFiles({...base,'src/x.js':"import a from 'lodash';import b from 'recharts/../../server.js';import c from 'react-markdown/package.json';import d from 'child_process'"});
 for(const spec of ['lodash','recharts/../../server.js','react-markdown/package.json','child_process'])assert.ok(bad.some(e=>e.includes('"'+spec+'"')),spec);
 const {cookie}=await signup('pkg@example.com');
 const id=await appWith(cookie,{'src/App.jsx':app});
 const pkg=JSON.parse(exporter.exportFiles(id)['package.json']);
 assert.ok(pkg.dependencies.recharts&&pkg.dependencies['framer-motion']&&pkg.dependencies['date-fns']&&pkg.dependencies['@radix-ui/react-dialog']&&pkg.dependencies.sonner);
 assert.equal(pkg.dependencies.lodash,undefined);
});

test('the function sandbox blocks private networks and stays isolated from Node',async()=>{
 for(const ip of ['127.0.0.1','10.2.3.4','172.16.0.1','192.168.1.1','169.254.169.254','100.64.0.1','::1','fd00::1','::ffff:127.0.0.1','0.0.0.0'])assert.equal(functions.privateAddress(ip),true,ip);
 for(const ip of ['8.8.8.8','1.1.1.1','2606:4700::1111'])assert.equal(functions.privateAddress(ip),false,ip);
 await assert.rejects(functions.guardedFetch({url:'http://localhost/'}),/private network/);
 await assert.rejects(functions.guardedFetch({url:'http://169.254.169.254/latest'}),/private network/);
 await assert.rejects(functions.guardedFetch({url:'file:///etc/passwd'}),/only http and https/);
 const host={secret:async()=>null,db:async()=>null,ai:async()=>null,email:async()=>null};
 const out=await functions.invoke({source:'export default async function(){return {json:[typeof process,typeof require,typeof globalThis.os,typeof globalThis.std]}}',request:{},user:null,host});
 assert.deepEqual(out.result.json,['undefined','undefined','undefined','undefined']);
 assert.deepEqual(functions.validate({'functions/bad.js':"import fs from 'fs';export default async function(){}"}).length>0,true);
 assert.deepEqual(functions.validate({'functions/ok.js':'export default async function(){return {json:1}}'}),[]);
});

test('server functions use secrets, the database and the signed-in user; drafts and published versions are separate',async()=>{
 const {cookie}=await signup('fn@example.com');
 const FN='export default async function(request,{user,db,secrets}){\n if(!user)return {status:401,json:{error:"sign in"}};\n const key=await secrets.get("SHOP_KEY");\n const row=await db.collection("orders").create({item:request.body.item,by:user.email});\n return {status:201,json:{key:key&&key.slice(0,4),row}};\n}\n';
 const id=await appWith(cookie,{'src/backend.json':JSON.stringify({collections:{orders:{access:'private'}}}),'functions/order.js':FN});
 assert.equal((await request(server,'POST','/api/create/projects/'+id+'/secrets',{headers:{cookie},body:{name:'bad name',value:'x'}})).status,400);
 const saved=await request(server,'POST','/api/create/projects/'+id+'/secrets',{headers:{cookie},body:{name:'shop_key',value:'shh-123456'}});
 assert.deepEqual(saved.json.secrets.map(s=>s.name),['SHOP_KEY']);
 assert.doesNotMatch(fs.readFileSync(path.join(builder.projectDir(id),'secrets.json'),'utf8'),/shh-123456/);
 const base='/api/apps/'+id;
 assert.equal((await request(server,'POST',base+'/functions/order',{body:{item:'tea'}})).status,401);
 const tok=(await request(server,'POST',base+'/auth/signup',{body:{email:'buyer@x.co',password:'password1'}})).json.token;
 const r=await request(server,'POST',base+'/functions/order',{body:{item:'tea'},headers:{authorization:'Bearer '+tok}});
 assert.equal(r.status,201,r.text);assert.equal(r.json.key,'shh-');assert.equal(r.json.row.item,'tea');assert.equal(r.json.row.by,'buyer@x.co');
 assert.equal((await request(server,'GET',base+'/collections/orders',{headers:{authorization:'Bearer '+tok}})).json.items.length,1,'records created by functions belong to the user');
 assert.equal((await request(server,'POST',base+'/functions/missing',{body:{}})).status,404);
 // Publish v2, then change the function in a draft v3: each version runs its own code.
 hosting.publish(id,{slug:'fn-app'});
 await builder.saveSource(id,{...builder.loadFiles(id,2),'functions/order.js':'export default async function(){return {json:"draft"}}','src/App.jsx':"import {functions} from 'kairoq';\nexport default function App(){return <button onClick={()=>functions.invoke('order',{})}>Order</button>}\n"},{summary:'draft'});
 assert.equal((await request(server,'POST',base+'/functions/order',{body:{},headers:{'x-kairoq-version':'3','x-kairoq-preview':builder.loadMeta(id).preview_key}})).json,'draft');
 assert.equal((await request(server,'POST',base+'/functions/order',{body:{},headers:{'x-kairoq-version':'3'}})).status,401,'visitors cannot pick the draft without the preview key');
 assert.equal((await request(server,'POST',base+'/functions/order',{body:{}})).status,401,'published version by default');
 assert.equal((await request(server,'POST',base+'/functions/order',{body:{},headers:{'x-kairoq-version':'1'}})).status,401,'old versions are never served');
 const dist=path.join(builder.versionDir(id,3),'dist','assets');
 const bundle=fs.readFileSync(path.join(dist,fs.readdirSync(dist).find(f=>f.endsWith('.js'))),'utf8');
 assert.match(bundle,/X-Kairoq-Version/);assert.match(bundle,/=\s*"3"/,'the draft bundle sends its own version');
});

test('a stuck function times out without blocking other requests; webhooks can verify signatures',async()=>{
 const {cookie}=await signup('slow@example.com');
 const HOOK='export default async function(request,{secrets,crypto}){\n const secret=await secrets.get("HOOK_SECRET");\n const expected=crypto.hmacSha256Hex(secret,request.rawBody);\n if(!crypto.timingSafeEqual(expected,String(request.headers["x-signature"]||"")))return {status:401,json:{error:"bad signature"}};\n return {json:{received:JSON.parse(request.rawBody).event}};\n}\n';
 const id=await appWith(cookie,{'functions/spin.js':'export default async function(){while(true){}}','functions/hook.js':HOOK});
 await request(server,'POST','/api/create/projects/'+id+'/secrets',{headers:{cookie},body:{name:'HOOK_SECRET',value:'whsec-test'}});
 const base='/api/apps/'+id,started=Date.now();
 const spinning=request(server,'POST',base+'/functions/spin',{body:{}});
 await new Promise(r=>setTimeout(r,200));
 const t=Date.now(),other=await request(server,'GET','/api/create/templates');
 assert.equal(other.status,200);assert.ok(Date.now()-t<1000,'server stays responsive while a function spins');
 const spun=await spinning;
 assert.equal(spun.status,504);assert.ok(Date.now()-started<6000);
 const body='{"event":"paid"}',sig=crypto.createHmac('sha256','whsec-test').update(body).digest('hex');
 assert.equal((await request(server,'POST',base+'/functions/hook',{raw:body,headers:{'x-signature':sig}})).json.received,'paid');
 assert.equal((await request(server,'POST',base+'/functions/hook',{raw:body,headers:{'x-signature':'0'.repeat(64)}})).status,401);
});

test('AI in apps is opt-in, billed to the app owner and blocked when they run out',async()=>{
 const prompts=[];
 backend.configure({appAi:async({system,messages})=>{prompts.push({system,messages});return{text:'Hello from AI'}}});
 process.env.KAIROQ_APP_AI_CALLS_PER_CREDIT='2';
 try{
  const owner=await signup('aiowner@example.com');
  const id=await appWith(owner.cookie,{'src/backend.json':JSON.stringify({collections:{},ai:true}),'functions/suggest.js':'export default async function(request,{ai}){const r=await ai.chat({messages:[{role:"user",content:"name a cake"}]});return {json:r.text}}'});
  const base='/api/apps/'+id;
  const r=await request(server,'POST',base+'/ai',{body:{system:'Be brief',messages:[{role:'user',content:'Hi'}]}});
  assert.equal(r.status,200,r.text);assert.equal(r.json.text,'Hello from AI');assert.equal(prompts[0].system,'Be brief');
  assert.equal((await request(server,'POST',base+'/functions/suggest',{body:{}})).json,'Hello from AI');
  const credits=async()=>(await request(server,'GET','/api/create/me',{headers:{cookie:owner.cookie}})).json.viewer.account.credits;
  assert.equal(await credits(),9,'one credit per 2 AI calls');
  assert.equal((await request(server,'POST',base+'/ai',{body:{messages:[]}})).status,400);
  require('../builder-accounts').database().prepare('UPDATE accounts SET credits=0 WHERE id=?').run(owner.account.id);
  assert.equal((await request(server,'POST',base+'/ai',{body:{messages:[{role:'user',content:'x'}]}})).status,402);
  const off=await appWith(owner.cookie,{'src/backend.json':JSON.stringify({collections:{}})});
  assert.equal((await request(server,'POST','/api/apps/'+off+'/ai',{body:{messages:[{role:'user',content:'x'}]}})).status,404);
 }finally{delete process.env.KAIROQ_APP_AI_CALLS_PER_CREDIT}
});

function mockGoogle(profile){
 const original=global.fetch;
 global.fetch=async(url,init)=>{
  if(String(url)==='https://oauth2.googleapis.com/token')return new Response(JSON.stringify({access_token:'at-1'}),{status:200});
  if(String(url)==='https://openidconnect.googleapis.com/v1/userinfo')return new Response(JSON.stringify(profile),{status:200});
  return original(url,init);
 };
 return()=>{global.fetch=original};
}
test('Google sign-in for Kairoq accounts creates or links accounts by verified email',async()=>{
 process.env.KAIROQ_GOOGLE_CLIENT_ID='cid.apps.googleusercontent.com';process.env.KAIROQ_GOOGLE_CLIENT_SECRET='csecret';
 const restore=mockGoogle({sub:'g-123',email:'Linked@Example.com',email_verified:true,name:'Lin'});
 try{
  const existing=await signup('linked@example.com');
  const start=await request(server,'GET','/api/create/auth/google');
  assert.equal(start.status,302);
  const loc=new URL(start.headers.location);
  assert.equal(loc.host,'accounts.google.com');assert.equal(loc.searchParams.get('client_id'),'cid.apps.googleusercontent.com');
  const state=loc.searchParams.get('state'),oauth=start.headers['set-cookie'][0].split(';')[0];
  assert.match((await request(server,'GET','/api/create/auth/google/callback?code=abc&state='+state)).headers.location,/finish%20in%20the%20browser/,'a callback without the starting browser\'s cookie is refused');
  const start2=await request(server,'GET','/api/create/auth/google');
  const state2=new URL(start2.headers.location).searchParams.get('state');
  const cb=await request(server,'GET','/api/create/auth/google/callback?code=abc&state='+state2,{headers:{cookie:start2.headers['set-cookie'][0].split(';')[0]}});
  assert.equal(cb.status,302);assert.equal(cb.headers.location,'/create');
  const cookie=cb.headers['set-cookie'][0].split(';')[0];
  const me=(await request(server,'GET','/api/create/me',{headers:{cookie}})).json.viewer.account;
  assert.equal(me.id,existing.account.id,'linked to the existing account');assert.equal(me.email_verified,true);
  const replay=await request(server,'GET','/api/create/auth/google/callback?code=abc&state='+state2,{headers:{cookie:start2.headers['set-cookie'][0].split(';')[0]}});
  assert.match(replay.headers.location,/auth_error=/,'state is single-use');
  assert.equal((await request(server,'POST','/api/create/login',{body:{email:'linked@example.com',password:'password1'},headers:{'x-forwarded-for':'10.9.9.9'}})).status,401,'a password set before the email was proven no longer works');
  void oauth;
 }finally{restore()}
 const restore2=mockGoogle({sub:'g-999',email:'unverified@example.com',email_verified:false});
 try{
  const st=await request(server,'GET','/api/create/auth/google'),state=new URL(st.headers.location).searchParams.get('state');
  assert.match((await request(server,'GET','/api/create/auth/google/callback?code=x&state='+state,{headers:{cookie:st.headers['set-cookie'][0].split(';')[0]}})).headers.location,/auth_error=Google%20did%20not/);
 }finally{restore2()}
});

test('Google sign-in for app users returns a one-time code only to the app\'s own URLs',async()=>{
 const restore=mockGoogle({sub:'g-app-1',email:'visitor@example.com',email_verified:true,name:'Vi'});
 try{
  const {cookie}=await signup('gapp@example.com');
  const id=await appWith(cookie,{});
  hosting.publish(id,{slug:'gapp'});
  const host='127.0.0.1:'+server.address().port,base='/api/apps/'+id;
  assert.equal((await request(server,'GET',base+'/auth/google/start?return='+encodeURIComponent('https://evil.example/steal'))).status,400);
  const start=await request(server,'GET',base+'/auth/google/start?return='+encodeURIComponent('http://'+host+'/sites/gapp/#/account'));
  const state=new URL(start.headers.location).searchParams.get('state');
  const cb=await request(server,'GET','/api/create/auth/google/callback?code=c&state='+state);
  const back=new URL(cb.headers.location);
  assert.equal(back.host,host);assert.equal(back.pathname,'/sites/gapp/');
  const code=new URLSearchParams(back.hash.slice(1)).get('kairoq_code');assert.ok(code);
  assert.equal((await request(server,'POST','/api/apps/000000000000/auth/google/exchange',{body:{code}})).status,404);
  const ex=await request(server,'POST',base+'/auth/google/exchange',{body:{code}});
  assert.equal(ex.status,200,ex.text);assert.equal(ex.json.user.email,'visitor@example.com');
  assert.equal((await request(server,'GET',base+'/auth/user',{headers:{authorization:'Bearer '+ex.json.token}})).json.user.email,'visitor@example.com');
  assert.equal((await request(server,'POST',base+'/auth/google/exchange',{body:{code}})).status,400,'codes are single-use');
 }finally{restore()}
});

function mockResend(){const sent=[],original=global.fetch;process.env.KAIROQ_RESEND_API_KEY='re_test_key';process.env.KAIROQ_EMAIL_FROM='Kairoq <x@example.com>';
 global.fetch=async(url,init)=>{if(String(url).startsWith('https://api.resend.com')){sent.push(JSON.parse(init.body));return new Response('{"id":"m"}',{status:200})}return original(url,init)};
 return{sent,restore(){global.fetch=original;delete process.env.KAIROQ_RESEND_API_KEY;delete process.env.KAIROQ_EMAIL_FROM}}}
test('Kairoq accounts: email verification and password reset links',async()=>{
 const mail=mockResend();
 try{
  const a=await signup('reset@example.com');
  await new Promise(r=>setTimeout(r,50));
  const verifyLink=/\/create\?verify=([^\s]+)/.exec(mail.sent.find(m=>m.to[0]==='reset@example.com').text)[1];
  assert.equal((await request(server,'POST','/api/create/verify',{body:{token:decodeURIComponent(verifyLink)}})).json.account.email_verified,true);
  assert.deepEqual((await request(server,'POST','/api/create/password/forgot',{body:{email:'nobody@example.com'}})).json,{sent:true},'no account enumeration');
  await request(server,'POST','/api/create/password/forgot',{body:{email:'reset@example.com'}});
  const token=decodeURIComponent(/\/create\?reset=([^\s]+)/.exec(mail.sent.at(-1).text)[1]);
  const r=await request(server,'POST','/api/create/password/reset',{body:{token,password:'brand-new-pass'}});
  assert.equal(r.status,200,r.text);
  assert.equal((await request(server,'GET','/api/create/projects',{headers:{cookie:a.cookie}})).status,401,'old sessions end after a reset');
  assert.equal((await request(server,'POST','/api/create/login',{body:{email:'reset@example.com',password:'brand-new-pass'}})).status,200);
  assert.equal((await request(server,'POST','/api/create/password/reset',{body:{token,password:'another-pass'}})).status,400,'reset links are single-use');
 }finally{mail.restore()}
});

test('app users can reset their password through a link back to the app',async()=>{
 const mail=mockResend();
 try{
  const {cookie}=await signup('appreset@example.com');
  const id=await appWith(cookie,{});hosting.publish(id,{slug:'reset-app'});
  const base='/api/apps/'+id,host='127.0.0.1:'+server.address().port;
  const old=(await request(server,'POST',base+'/auth/signup',{body:{email:'member@x.co',password:'password1'}})).json.token;
  assert.equal((await request(server,'POST',base+'/auth/reset/request',{body:{email:'member@x.co',return_url:'https://evil.example/'}})).status,400);
  await request(server,'POST',base+'/auth/reset/request',{body:{email:'member@x.co',return_url:'http://'+host+'/sites/reset-app/'}});
  const link=new URL(/(http:\/\/\S+)/.exec(mail.sent.at(-1).text)[1]);
  assert.equal(link.pathname,'/sites/reset-app/');
  const token=new URLSearchParams(link.hash.slice(1)).get('kairoq_reset');
  const done=await request(server,'POST',base+'/auth/reset/complete',{body:{token,password:'fresh-password'}});
  assert.equal(done.status,200,done.text);assert.ok(done.json.token);
  assert.equal((await request(server,'GET',base+'/auth/user',{headers:{authorization:'Bearer '+old}})).json.user,null,'old sessions end');
  assert.equal((await request(server,'POST',base+'/auth/signin',{body:{email:'member@x.co',password:'fresh-password'}})).status,200);
 }finally{mail.restore()}
});

function listen(url){
 return new Promise((resolve,reject)=>{
  const events=[];
  const req=http.get({host:'127.0.0.1',port:server.address().port,path:url},res=>{
   if(res.statusCode!==200){reject(Object.assign(Error('status '+res.statusCode),{status:res.statusCode}));res.resume();return}
   let buf='';res.on('data',c=>{buf+=c;let i;while((i=buf.indexOf('\n\n'))>=0){const block=buf.slice(0,i);buf=buf.slice(i+2);const data=/^data: (.*)$/m.exec(block);if(data)events.push(JSON.parse(data[1]))}});
   resolve({events,close:()=>req.destroy()});
  });
  req.on('error',()=>{});
 });
}
test('real-time updates reach only people allowed to read them',async()=>{
 const {cookie}=await signup('live@example.com');
 const id=await appWith(cookie,{'src/backend.json':JSON.stringify({collections:{chat:{access:'public-read'},notes:{access:'private'},forms:{access:'submit-only'}}})});
 const base='/api/apps/'+id;
 const ana=(await request(server,'POST',base+'/auth/signup',{body:{email:'ana@x.co',password:'password1'}})).json.token;
 const bo=(await request(server,'POST',base+'/auth/signup',{body:{email:'bo@x.co',password:'password1'}})).json.token;
 const ticket=async(col,tok)=>(await request(server,'POST',base+'/realtime/'+col+'/ticket',{headers:tok?{authorization:'Bearer '+tok}:{}}));
 const anon=await listen(base+'/realtime/chat?ticket='+(await ticket('chat')).json.ticket);
 const boNotes=await listen(base+'/realtime/notes?ticket='+(await ticket('notes',bo)).json.ticket);
 const anaNotes=await listen(base+'/realtime/notes?ticket='+(await ticket('notes',ana)).json.ticket);
 await request(server,'POST',base+'/collections/chat',{body:{data:{text:'hello'}},headers:{authorization:'Bearer '+ana}});
 const note=(await request(server,'POST',base+'/collections/notes',{body:{data:{text:'secret'}},headers:{authorization:'Bearer '+ana}})).json.item;
 await request(server,'PATCH',base+'/collections/notes/'+note.id,{body:{data:{text:'edited'}},headers:{authorization:'Bearer '+ana}});
 await new Promise(r=>setTimeout(r,150));
 assert.deepEqual(anon.events.map(e=>[e.type,e.item.text]),[['created','hello']]);
 assert.deepEqual(anaNotes.events.map(e=>[e.type,e.item.text]),[['created','secret'],['updated','edited']]);
 assert.deepEqual(boNotes.events,[],'other users never see private records');
 assert.equal((await ticket('notes')).status,401);
 assert.equal((await ticket('forms')).status,403);
 const t=(await ticket('chat')).json.ticket;
 const first=await listen(base+'/realtime/chat?ticket='+t);
 await assert.rejects(listen(base+'/realtime/chat?ticket='+t),e=>e.status===401,'tickets are single-use');
 for(const s of [anon,boNotes,anaNotes,first])s.close();
});

test('the security scan flags exposed secrets, open personal data and unsafe functions',()=>{
 const files={'src/App.jsx':"const key='sk_live_abcdefghijklmnop1234';export default function App(){return <div dangerouslySetInnerHTML={{__html:'x'}}/>}",
  'functions/wipe.js':'export default async function(request,{db}){await db.collection("leads").remove(request.body.id);return {json:1}}',
  'functions/stripe-hook.js':'export default async function(request,{db}){const e=JSON.parse(request.rawBody);return {json:e.type}}'};
 const f=security.scan(files,{collections:{contacts:{access:'public'},posts:{access:'public'}},storage:{access:'public'}});
 const titles=f.map(x=>x.severity+': '+x.title);
 assert.equal(f[0].severity,'high');
 for(const t of ['high: Secret exposed in the app code','high: Anyone can read "contacts"','medium: Raw HTML is inserted into the page','medium: Server function changes data without checking the user','medium: Webhook does not verify its signature','medium: Anyone can upload files','low: Anyone can add to "posts"'])assert.ok(titles.includes(t),t+'\n'+titles.join('\n'));
 assert.deepEqual(security.scan({'src/App.jsx':'export default function App(){return <p>ok</p>}'},{collections:{bookings:{access:'submit-only'}}}),[]);
});

test('project knowledge reaches the model; the Max tier appears when configured',async()=>{
 process.env.KAIROQ_BUILDER_PAID_APPROVED='true';process.env.KAIROQ_MAX_MODELS='anthropic/claude-fable-test';
 try{
  const {cookie}=await signup('know@example.com');
  const id=(await request(server,'POST','/api/create/projects',{headers:{cookie},body:{name:'K'}})).json.project.id;
  assert.equal((await request(server,'POST','/api/create/projects/'+id+'/knowledge',{headers:{cookie},body:{text:'Brand colour is teal. Prices in EUR.'}})).json.project.knowledge,'Brand colour is teal. Prices in EUR.');
  const me=(await request(server,'GET','/api/create/me',{headers:{cookie}})).json;
  assert.deepEqual(me.tiers.map(t=>[t.id,t.credits,t.enabled]),[['standard',1,true],['pro',5,true],['max',15,true]]);
  require('../builder-accounts').database().prepare('UPDATE accounts SET credits=20 WHERE email=?').run('know@example.com');
  const job=(await request(server,'POST','/api/create/projects/'+id+'/chat',{headers:{cookie},body:{message:'Make it nice',tier:'max'}})).json.job;
  for(let i=0;i<200&&!['complete','failed'].includes((await request(server,'GET','/api/create/jobs/'+job.id,{headers:{cookie}})).json.job.status);i++)await new Promise(r=>setTimeout(r,25));
  assert.match(lastModelOpts.messages[0].content,/Project knowledge from the owner[\s\S]*Brand colour is teal/);
  assert.equal(lastModelOpts.tier,'max');
  assert.equal((await request(server,'GET','/api/create/me',{headers:{cookie}})).json.viewer.account.credits,5,'max costs 15 credits');
 }finally{delete process.env.KAIROQ_BUILDER_PAID_APPROVED;delete process.env.KAIROQ_MAX_MODELS}
});

test('server functions can be TypeScript: types are removed, the rules stay the same',async()=>{
 const TS='type Body={name:string};\ninterface Out{hello:string}\nexport default async function(request:{body:Body},{user}:any):Promise<{json:Out}>{\n const n:string=request.body.name;\n return {json:{hello:n.toUpperCase()}};\n}\n';
 assert.deepEqual(functions.validate({'functions/greet.ts':TS}),[]);
 assert.match(functions.validate({'functions/greet.ts':TS,'functions/greet.js':'export default async function(){}'}).join(),/same function/);
 assert.match(functions.validate({'functions/bad.ts':"import fs from 'fs';export default async function(){}"}).join(),/cannot import/);
 assert.match(functions.validate({'functions/broken.ts':'export default async function( {'}).join(),/broken\.ts/);
 const {cookie}=await signup('ts@example.com');
 const id=await appWith(cookie,{'functions/greet.ts':TS});
 const r=await request(server,'POST','/api/apps/'+id+'/functions/greet',{body:{name:'ana'}});
 assert.equal(r.status,200,r.text);assert.deepEqual(r.json,{hello:'ANA'});
});

test('server functions can be Python, called like any other',async()=>{
 const PY="async def handler(request, ctx):\n    row = await ctx.db.collection('orders').create({'item': request['body']['item']})\n    return {'status': 201, 'json': {'item': row['item'], 'signed_in': ctx.user is not None}}\n";
 const {cookie}=await signup('py@example.com');
 const id=await appWith(cookie,{'src/backend.json':JSON.stringify({collections:{orders:{access:'public'}}}),'functions/order.py':PY});
 const r=await request(server,'POST','/api/apps/'+id+'/functions/order',{body:{item:'tea'}});
 assert.equal(r.status,201,r.text);assert.deepEqual(r.json,{item:'tea',signed_in:false});
 require('../python-functions').shutdown();
});

"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-reference-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
process.env.KAIROQ_FREE_CREDITS='40';
process.env.KAIROQ_DESIGN_BRIEF='off';
process.env.KAIROQ_REFERENCE_ALLOW_PRIVATE='1';
delete process.env.KAIROQ_REA_COMMAND;
const builder=require('../react-builder'),createApi=require('../create-api'),backend=require('../react-backend'),hosting=require('../react-hosting');
const ref=require('../react-reference'),run=require('../react-reference-run'),assets=require('../react-asset-search'),checks=require('../react-checks'),runtime=require('../runtime-check');
const portability=require('../project-portability');

// ---------- the reference website (a small hotel site) ----------
const hits=[];
const PAGE=(title,body)=>`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><meta name="description" content="Seaside Stays: boutique rooms by the sea">
<style>body{margin:0;background:#fdf8f0;color:#1f2a37;font-family:Georgia,serif}header{display:flex;gap:16px;padding:16px;position:sticky;top:0;background:#fff}
a.btn,button{background:#0e7490;color:#fff;border-radius:12px;padding:10px 16px;border:0;transition:background .2s}main{max-width:1100px;margin:auto}.card{border-radius:16px;box-shadow:0 4px 12px rgba(0,0,0,.1)}
@media (max-width: 768px){header{flex-direction:column}}</style></head><body><header><nav><a href="/">Home</a> <a href="/rooms">Rooms</a> <a href="/contact">Contact</a> <a href="/private/admin">Admin</a></nav><a class="btn" href="/login">Sign in</a></header><main>${body}</main><footer><a href="/terms">Terms</a></footer></body></html>`;
const SITE={
 '/':PAGE('Seaside Stays','<h1>Sleep by the sea</h1><h2>Our rooms</h2><ul id="rooms"></ul><form><label>Your name<input name="name" required></label><label>Check-in<input type="date" name="in"></label><button type="submit">Book now</button></form><script>fetch("/api/rooms?city=lisbon").then(r=>r.json()).then(d=>{document.getElementById("rooms").innerHTML=d.items.map(r=>"<li class=card>"+r.name+"</li>").join("")})</script>'),
 '/rooms':PAGE('Rooms','<h1>Rooms</h1><div class="card"><h3>Ocean suite</h3><button>Reserve</button></div>'),
 '/contact':PAGE('Contact','<h1>Contact us</h1><form method="post"><label>Email<input type="email" name="email"></label><textarea aria-label="Message"></textarea><button>Send</button></form>'),
 '/private/admin':PAGE('Admin','<h1>Secret admin</h1>'),
 '/login':PAGE('Sign in','<h1>Sign in</h1><form><label>Email<input type="email"></label><label>Password<input type="password"></label><button>Sign in</button></form>'),
 '/terms':PAGE('Terms','<h1>Terms</h1>')
};
let site;
function siteHandler(req,res){
 const u=new URL(req.url,'http://x');hits.push(u.pathname);
 if(u.pathname==='/robots.txt'){res.writeHead(200,{'Content-Type':'text/plain'});return res.end('User-agent: *\nDisallow: /private\n')}
 if(u.pathname==='/api/rooms'){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({items:[{id:1,name:'Ocean suite',price:220,tags:['view']}],total:1}))}
 if(u.pathname==='/openapi.json'){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({openapi:'3.0.0',info:{title:'Stays API',version:'1.2'},components:{securitySchemes:{bearer:{type:'http',scheme:'bearer'}},schemas:{Room:{}}},paths:{'/api/rooms':{get:{summary:'List rooms'}},'/api/bookings':{post:{summary:'Create a booking'}}}}))}
 if(SITE[u.pathname]){res.writeHead(200,{'Content-Type':'text/html'});return res.end(SITE[u.pathname])}
 res.writeHead(404);res.end('not found');
}

// ---------- Kairoq ----------
const app=()=>`import React, { useState } from 'react';
import { collection } from 'kairoq';
export default function App() {
  const [name, setName] = useState('');
  const [done, setDone] = useState(false);
  async function submit(e) { e.preventDefault(); await collection('bookings').create({ name }); setDone(true); }
  return done ? <p>Thank you, {name}</p> : (
    <main className="p-4"><h1>Harbour Rooms</h1>
    <form onSubmit={submit}><label>Your name<input value={name} onChange={e => setName(e.target.value)} /></label><button type="submit">Book</button></form></main>
  );
}
`;
const PLAN={name:'Harbour Rooms',summary:'A boutique guesthouse site with room listings and direct booking.',audience:'Travellers',
 features:[{name:'Room listings',description:'Cards with photos and prices',priority:1,area:'frontend'},{name:'Direct booking',description:'Save a booking request',priority:1,area:'backend'},{name:'',description:'dropped: no name'}],
 pages:[{path:'/',name:'Home',purpose:'Hero and booking form',sections:['hero','rooms','booking form']},{path:'bad path',name:'X',purpose:'normalized to /'}],
 entities:[{name:'bookings',fields:['name:text','check_in:date'],access:'public'},{name:'Bad Name!',fields:[]}],
 auth:{required:true,methods:['email','fax'],roles:['guest','admin']},
 integrations:[{name:'Stripe',purpose:'Deposits',how:'Stripe Checkout with the owner key as an app secret'}],
 api:[{method:'post',path:'/functions/book',purpose:'Create booking'}],
 journeys:[{name:'Book a stay',steps:'Type a name, click Book, see Thank you'}],
 design:{name:'Harbour Calm',summary:'Calm coastal',palette:{background:'#fdf8f0',foreground:'#1f2a37',primary:'#0e7490',secondary:'#f1ece4',accent:'#f59e0b',muted:'#f6f1ea'},fonts:{display:'Playfair Display',body:'Inter'},radius:'1rem',layout:'Hero then rooms',imagery:'sunny harbour photos',details:['Rounded cards']},
 assets:[{kind:'image',query:'harbour hotel room',use:'hero'},{kind:'audio',query:'sea waves',use:'ambient'}],
 steps:['Pages','Booking'],notes:'Pricing was not visible.'};
const BACKEND=JSON.stringify({collections:{bookings:{access:'public'}}});
const FILES=(src=app())=>({'src/App.jsx':src,'src/backend.json':BACKEND});
const CHECK={name:'Book a stay',steps:[{action:'fill',label:'Your name',value:'Test Guest'},{action:'click',text:'Book'},{action:'expect',text:'Thank you, Test Guest'}]};

const PNG=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(400,1)]);
const openverse=[];
const fakeFetch=async(url,opts)=>{
 const u=String(url);
 if(u.startsWith('https://api.openverse.org/')){openverse.push(u);const audio=u.includes('/audio/');
  return new Response(JSON.stringify({results:audio?[{title:'Waves',creator:'Sam',license:'cc0',url:'https://cdn.example.org/waves.mp3',foreign_landing_url:'https://example.org/waves'}]:[
   {title:'No commercial use',creator:'X',license:'by-nc',url:'https://cdn.example.org/nc.jpg'},
   {title:'Harbour room',creator:'Ana Lopes',license:'by',license_version:'4.0',license_url:'https://creativecommons.org/licenses/by/4.0/',url:'https://cdn.example.org/room.png',foreign_landing_url:'https://example.org/room'}]}),{headers:{'content-type':'application/json'}})}
 if(u==='https://cdn.example.org/room.png')return new Response(PNG,{headers:{'content-type':'image/png'}});
 if(u.startsWith('https://'))throw Error('unexpected network call to '+u);
 return fetch(url,opts);
};

let queue=[],calls=[];
const callModel=async(opts,parse)=>{calls.push(opts);const next=queue.shift();if(!next)throw Error('no scripted reply');return parse(typeof next==='string'?next:JSON.stringify(next))};
function request(server,method,url,{body,headers={}}={}){
 return new Promise((resolve,reject)=>{
  const payload=body!==undefined?Buffer.from(JSON.stringify(body)):null;
  const req=http.request({host:'127.0.0.1',port:server.address().port,method,path:url,headers:{...(payload?{'Content-Type':'application/json','Content-Length':payload.length}:{}),...headers}},res=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>{const buf=Buffer.concat(c);let json;try{json=JSON.parse(buf)}catch{}resolve({status:res.statusCode,headers:res.headers,json,text:buf.toString(),buf})})});
  req.on('error',reject);if(payload)req.write(payload);req.end();
 });
}
let server,ip=0;
const base=()=>'http://127.0.0.1:'+server.address().port;
test.before(async()=>{
 site=http.createServer(siteHandler);await new Promise(r=>site.listen(0,'127.0.0.1',r));
 server=http.createServer(async(req,res)=>{
  if(await backend.handle(req,res))return;if(builder.handlePreview(req,res))return;if(hosting.handlePath(req,res))return;
  if(await createApi.handle(req,res,{isOwner:()=>false,callModel,secure:false,referenceFetch:fakeFetch,
   inspect:(u,o)=>runtime.inspect(base()+u,o),checkRuntime:u=>runtime.check(base()+u),designShots:u=>runtime.designShots(base()+u)}))return;
  res.writeHead(404);res.end();
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
});
test.after(async()=>{server.close();site.close();await runtime.close();fs.rmSync(tmp,{recursive:true,force:true})});
async function signup(email){const r=await request(server,'POST','/api/create/signup',{body:{email,password:'password1'},headers:{'x-forwarded-for':'10.9.0.'+(++ip)}});assert.equal(r.status,201,r.text);return r.headers['set-cookie'][0].split(';')[0]}
async function project(cookie,name='Harbour'){return(await request(server,'POST','/api/create/projects',{headers:{cookie},body:{name}})).json.project.id}
async function waitJob(cookie,job){for(let i=0;i<3000;i++){const j=(await request(server,'GET','/api/create/jobs/'+job.id,{headers:{cookie}})).json.job;if(['complete','failed'].includes(j.status))return j;await new Promise(r=>setTimeout(r,50))}throw Error('job timeout')}
const credits=async cookie=>(await request(server,'GET','/api/create/credits',{headers:{cookie}})).json.account.credits;
const userText=opts=>{const m=opts.messages.filter(x=>x.role==='user').at(-1);return typeof m.content==='string'?m.content:m.content.filter(p=>p.type==='text').map(p=>p.text).join('\n')};

test('only public websites, and robots.txt is followed',async()=>{
 delete process.env.KAIROQ_REFERENCE_ALLOW_PRIVATE;
 try{
  for(const bad of ['http://localhost:3000','http://127.0.0.1/','http://10.0.0.5','http://169.254.169.254/latest','http://[::1]/','http://intranet/','ftp://example.com','http://user:pw@example.com'])
   await assert.rejects(ref.safeUrl(bad),e=>e.status===400,bad);
  assert.ok(ref.privateIp('192.168.1.4')&&ref.privateIp('::ffff:10.1.2.3')&&ref.privateIp('fd00::1')&&!ref.privateIp('8.8.8.8'));
  assert.equal(ref.blockedHost('metadata.internal'),true);
 }finally{process.env.KAIROQ_REFERENCE_ALLOW_PRIVATE='1'}
 const rules=ref.parseRobots('User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /private\nDisallow: /*.pdf$\nAllow: /private/press\n');
 assert.equal(ref.robotsAllows(rules,'/rooms'),true);
 assert.equal(ref.robotsAllows(rules,'/private/admin'),false);
 assert.equal(ref.robotsAllows(rules,'/private/press/kit'),true,'the longer Allow wins');
 assert.equal(ref.robotsAllows(rules,'/menu.pdf'),false);
 assert.deepEqual(ref.parseRobots('User-agent: KairoqReference\nDisallow: /\nUser-agent: *\nDisallow:\n'),[{allow:false,path:'/'}],'rules for Kairoq itself win');
});

test('the plan is normalized and becomes an original-work build task',()=>{
 const plan=ref.normalizePlan(PLAN);
 assert.equal(plan.features.length,2,'features without a name are dropped');
 assert.equal(plan.pages[1].path,'/');
 assert.deepEqual(plan.entities.map(e=>e.name),['bookings']);
 assert.deepEqual(plan.auth.methods,['email'],'unsupported sign-in methods are dropped');
 assert.equal(plan.api[0].method,'POST');
 assert.equal(plan.design.name,'Harbour Calm');assert.equal(plan.design.fonts.display,'Playfair Display');
 assert.throws(()=>ref.normalizePlan({features:[]}),/no features/);
 plan.features[0].enabled=false;
 const t=ref.buildTask(plan,{kind:'repo',license:{use:'copyleft'}});
 assert.match(t.message,/independent implementation/);assert.match(t.message,/no logos, trademarks or copy/);
 assert.doesNotMatch(t.context,/Room listings/,'unticked features are not built');
 assert.match(t.context,/Direct booking/);assert.match(t.context,/Book a stay: Type a name/);assert.match(t.context,/bookings \[public\]/);
 assert.match(t.context,/not permissively licensed: write all code yourself/);
 assert.match(t.context,/390px phone/);
 assert.match(ref.planPrompt(),/Study, do not copy/);assert.match(ref.planPrompt(),/Playfair Display/);
});

test('OpenAPI, response shapes and third-party services',()=>{
 const s=ref.summarizeOpenApi({openapi:'3.1.0',info:{title:'A',version:'2'},paths:{'/x':{get:{summary:'List'},parameters:[]}},components:{securitySchemes:{key:{type:'apiKey'}}}});
 assert.deepEqual(s.endpoints,['GET /x — List']);assert.deepEqual(s.auth,['key (apiKey)']);
 assert.equal(ref.summarizeOpenApi({hello:1}),null);
 assert.deepEqual(ref.shape({items:[{id:1,name:'x'}],total:2,secret:null}),{items:[{id:'number',name:'string'}],total:'number',secret:'null'},'values are never kept');
 assert.deepEqual(ref.integrations(['https://js.stripe.com/v3','https://www.googletagmanager.com/gtm.js','https://widget.intercom.io/x']).sort(),['Google Analytics','Intercom chat','Stripe payments']);
 assert.equal(ref.rgbHex('rgb(14, 116, 144)'),'#0e7490');assert.equal(ref.rgbHex('rgba(0, 0, 0, 0)'),null);
});

test('GitHub repositories: structure, frameworks and license',async()=>{
 assert.deepEqual(ref.parseRepo('https://github.com/acme/stays.git'),{owner:'acme',repo:'stays',branch:''});
 assert.throws(()=>ref.parseRepo('https://gitlab.com/a/b'),/GitHub repository/);
 assert.equal(ref.licenseUse('MIT'),'permissive');assert.equal(ref.licenseUse('AGPL-3.0'),'copyleft');assert.equal(ref.licenseUse(''),'unknown');
 const seen=[];
 const gh=async url=>{seen.push(String(url));const u=String(url);
  if(u==='https://api.github.com/repos/acme/stays')return new Response(JSON.stringify({default_branch:'main',description:'Hotel booking',license:{spdx_id:'GPL-3.0',name:'GNU GPL v3'},stargazers_count:5}),{status:200});
  if(u.startsWith('https://api.github.com/repos/acme/stays/git/trees/main'))return new Response(JSON.stringify({tree:[{type:'blob',path:'README.md',size:100},{type:'blob',path:'package.json',size:100},{type:'blob',path:'prisma/schema.prisma',size:100},{type:'blob',path:'src/pages/rooms.jsx',size:10},{type:'blob',path:'node_modules/x/index.js',size:10},{type:'blob',path:'.env',size:10}]}),{status:200});
  if(u.endsWith('/README.md'))return new Response('# Stays\nBook rooms.');
  if(u.endsWith('/package.json'))return new Response(JSON.stringify({dependencies:{next:'14',stripe:'1','@prisma/client':'5'}}));
  if(u.endsWith('/schema.prisma'))return new Response('model Booking { id Int @id }');
  return new Response('nope',{status:404});
 };
 const a=await ref.analyzeRepo('acme/stays',{fetchImpl:gh});
 assert.equal(a.license.use,'copyleft');
 assert.deepEqual(a.frameworks.sort(),['@prisma/client','next','stripe']);
 assert.deepEqual(Object.keys(a.files).sort(),['README.md','package.json','prisma/schema.prisma']);
 assert.ok(a.routes.includes('src/pages/rooms.jsx'));
 assert.ok(!seen.some(u=>u.includes('.env')||u.includes('node_modules')),'secrets and dependencies are never read');
 const text=ref.describe(a);
 assert.match(text,/License: GNU GPL v3 \(GPL-3.0, copyleft\)/);assert.match(text,/model Booking/);
 const missing=async()=>new Response('{}',{status:404});
 await assert.rejects(ref.analyzeRepo('acme/none',{fetchImpl:missing}),e=>e.status===404);
});

test('zip upload: unpacked safely and analyzed with REA when it is installed',async()=>{
 const zip=portability.zip({'app/package.json':JSON.stringify({name:'notes',main:'main.js'}),'app/main.js':'console.log(1)'});
 assert.deepEqual(ref.readZip(zip).map(e=>e.name),['app/package.json','app/main.js']);
 const evil=Buffer.from(portability.zip({'aa/evil.txt':'x'}).toString('latin1').split('aa/evil.txt').join('../evil.tx'.padEnd(11,'t')),'latin1');
 assert.throws(()=>ref.readZip(evil),/unsafe path/);
 assert.throws(()=>ref.readZip(Buffer.from('not a zip')),/not a zip/);
 await assert.rejects(ref.analyzeApp(zip.toString('base64')),e=>e.status===503,'without REA the upload is refused');
 // A stand-in for the REA command line: records its arguments and what it could read.
 const fake=path.join(tmp,'fake-rea.js');
 fs.writeFileSync(fake,"const fs=require('fs'),p=require('path');const [cmd,target]=process.argv.slice(2);const files=fs.existsSync(target)&&fs.statSync(target).isDirectory()?fs.readdirSync(p.join(target,'app')):[];process.stdout.write(JSON.stringify({command:cmd,files,modules:[{path:'main.js',imports:['electron']}]}))");
 process.env.KAIROQ_REA_COMMAND=process.execPath+' '+fake;
 try{
  const a=await ref.analyzeApp(zip.toString('base64'),{name:'notes.zip'});
  assert.equal(a.kind,'app');assert.equal(a.rea.command,'analyze-javascript-application');
  assert.deepEqual(a.rea.files.sort(),['main.js','package.json']);assert.equal(a.package.name,'notes');
  assert.match(ref.describe(a),/REA static analysis/);
  const har=path.join(tmp,'s.har');fs.writeFileSync(har,'{}');
  assert.equal((await ref.reaNetwork(har)).network.command,'inspect-web-network-capture');
 }finally{delete process.env.KAIROQ_REA_COMMAND}
});

test('openly licensed assets: commercial licenses only, with credits',async()=>{
 const cookie=await signup('assets@example.com'),id=await project(cookie);
 const r=await assets.gather(id,[{kind:'image',query:'harbour hotel room',use:'hero'},{kind:'audio',query:'sea waves',use:'ambient'}],{fetchImpl:fakeFetch});
 assert.deepEqual(r.saved.map(s=>s.file),['stock-harbour-hotel-room.png']);
 assert.equal(r.saved[0].title,'Harbour room','the non-commercial result is skipped');
 assert.ok(openverse.some(u=>u.includes('license_type=commercial')));
 assert.equal(r.linked[0].kind,'audio');assert.equal(r.linked[0].license,'CC0');
 const credits=builder.loadMeta(id).asset_credits;
 assert.equal(credits.find(c=>c.file==='stock-harbour-hotel-room.png').attribution_required,true);
 const note=assets.note(r);
 assert.match(note,/\.\/uploads\/stock-harbour-hotel-room\.png — Harbour room by Ana Lopes \(CC BY 4\.0\)/);
 assert.match(note,/Photo credits/);assert.match(note,/lucide-react/);
});

test('website analysis in a real browser: pages, forms, API calls, OpenAPI, design, phone',{skip:!runtime.available()&&'no browser'},async()=>{
 hits.length=0;
 const a=await ref.crawlSite('http://127.0.0.1:'+site.address().port+'/',{fetchImpl:fakeFetch});
 const paths=a.pages.map(p=>p.path);
 assert.ok(paths.includes('/')&&paths.includes('/rooms')&&paths.includes('/contact'),paths.join(','));
 assert.ok(!hits.includes('/private/admin'),'robots.txt is followed');
 assert.ok(a.robots_skipped.includes('/private/admin'));
 const home=a.pages.find(p=>p.path==='/');
 assert.ok(home.headings.includes('h1: Sleep by the sea'));
 assert.deepEqual(home.nav.map(n=>n.text),['Home','Rooms','Contact','Admin','Sign in']);
 assert.deepEqual(home.forms[0].fields.map(f=>f.label+':'+f.type),['Your name:text','Check-in:date']);
 assert.equal(home.forms[0].fields[0].required,true);
 assert.ok(home.hints.auth.includes('Sign in'));
 const call=a.api.find(x=>x.url.endsWith('/api/rooms'));
 assert.deepEqual(call.query,['city']);assert.deepEqual(call.shape,{items:[{id:'number',name:'string',price:'number',tags:'array'}],total:'number'});
 assert.equal(a.openapi.title,'Stays API');assert.ok(a.openapi.endpoints.includes('POST /api/bookings — Create a booking'));
 assert.equal(a.design.background,'#fdf8f0');assert.ok(a.design.buttons.includes('#0e7490'));assert.ok(a.design.breakpoints.includes('max 768px'));
 assert.ok(a.design.motion.transitions>0&&a.design.motion.sticky>0);
 assert.equal(a.phone.overflow,false);
 assert.deepEqual(a.screenshots.map(s=>s.name),['reference-home-desktop','reference-page-2-desktop','reference-home-phone']);
 assert.ok(a.pages.find(p=>p.path==='/login').hints.password,'the sign-in page is seen but never submitted');
 const text=ref.describe(a);
 assert.match(text,/Navigation: Home, Rooms, Contact, Admin, Sign in/);assert.match(text,/GET http:\/\/127\.0\.0\.1:\d+\/api\/rooms \?city/);assert.match(text,/OpenAPI/);
 await assert.rejects(ref.crawlSite('http://127.0.0.1:'+site.address().port+'/private/admin',{fetchImpl:fakeFetch}),e=>e.status===403);
});

test('analyze → plan → build → journeys on desktop and phone → design check → publish',{skip:!runtime.available()&&'no browser'},async()=>{
 const cookie=await signup('reference@example.com'),id=await project(cookie);
 assert.equal((await request(server,'POST','/api/create/projects/'+id+'/reference',{headers:{cookie},body:{step:'analyze'}})).status,400);
 assert.equal((await request(server,'POST','/api/create/projects/'+id+'/reference',{headers:{cookie},body:{step:'build'}})).status,409,'build needs an analysis');
 const info=(await request(server,'GET','/api/create/projects/'+id+'/reference',{headers:{cookie}})).json;
 assert.equal(info.reference,null);assert.equal(info.can_publish,true);assert.equal(info.rea,false);
 const price=info.prices.find(p=>p.tier==='standard');assert.deepEqual(price,{tier:'standard',analyze:2,build:7});
 const before=await credits(cookie);

 queue=[PLAN];calls=[];
 const a=await waitJob(cookie,(await request(server,'POST','/api/create/projects/'+id+'/reference',{headers:{cookie},body:{step:'analyze',url:'http://127.0.0.1:'+site.address().port+'/',note:'For my guesthouse'}})).json.job);
 assert.equal(a.status,'complete',a.error);
 assert.equal(a.result.reference.plan.name,'Harbour Rooms');
 const prompt=userText(calls[0]);
 assert.match(prompt,/Navigation: Home, Rooms, Contact, Admin, Sign in/);assert.match(prompt,/For my guesthouse/);assert.match(prompt,/OpenAPI/);
 assert.equal(calls[0].messages[1].content.filter(p=>p.type==='image_url').length,3,'the reference screenshots go to the planner');
 assert.equal(calls[0].tier,'vision');
 const meta=builder.loadMeta(id);
 assert.equal(meta.reference.source.type,'url');assert.equal(meta.reference.analysis.screenshots,undefined,'screenshots are files, not JSON');
 const shot=await request(server,'GET','/api/create/projects/'+id+'/refshot?name='+meta.reference.shots[0],{headers:{cookie}});
 assert.equal(shot.status,200);assert.equal(shot.headers['content-type'],'image/jpeg');
 assert.equal((await request(server,'GET','/api/create/projects/'+id+'/refshot?name=../../meta.json',{headers:{cookie}})).status,404);
 assert.equal(await credits(cookie),before-2);

 const plan={...a.result.reference.plan};plan.features=plan.features.map((f,i)=>({...f,enabled:i!==0}));
 queue=[
  {thought:'Build the booking page.',actions:[{tool:'write_files',files:FILES()},{tool:'finish',message:'Built Harbour Rooms.'}]},
  CHECK,
  {score:8.5,strengths:['Clear booking form'],improvements:['Add a hero photo']}
 ];calls=[];
 const j=await waitJob(cookie,(await request(server,'POST','/api/create/projects/'+id+'/reference',{headers:{cookie},body:{step:'build',plan,publish:true}})).json.job);
 assert.equal(j.status,'complete',j.error);
 const introMsg=calls[0].messages.find(m=>m.role==='user'),intro=typeof introMsg.content==='string'?introMsg.content:introMsg.content.filter(p=>p.type==='text').map(p=>p.text).join('\n');
 assert.match(intro,/APPROVED BUILD PLAN/);assert.doesNotMatch(intro,/Room listings/);
 assert.match(intro,/OPENLY LICENSED ASSETS/);assert.match(intro,/stock-harbour-hotel-room\.png/);assert.match(intro,/Photo credits/);
 assert.equal(introMsg.content.filter(p=>p.type==='image_url').length,3,'the agent sees the reference screenshots');
 const r=j.result.reference;
 assert.deepEqual(r.checks.map(c=>c.name),['Book a stay']);
 assert.deepEqual(r.last_run.desktop,{ran:1,passed:1});assert.deepEqual(r.last_run.phone,{ran:1,passed:1});
 assert.equal(r.repairs,0);
 assert.equal(r.design.score,8.5);assert.equal(r.polished,false);
 assert.match(userText(calls[2]),/Reference images: 2\. New app images: 2/);assert.equal(calls[2].design,true);
 assert.equal(r.published.ok,true,JSON.stringify(r.published));assert.match(r.published.url,/\/sites\/harbour/);
 assert.deepEqual(r.problems,[]);
 const after=builder.loadMeta(id);
 assert.equal(after.design.name,'Harbour Calm','the plan\'s design is the project design');
 assert.ok(builder.loadFiles(id,after.current_version)['src/index.css'].includes('Playfair Display'));
 assert.equal(checks.list(after)[0].source,'reference');
 assert.ok(after.reference.built_at);
 assert.equal(after.published.version,after.current_version);
 assert.equal(await credits(cookie),before-2-7);
 assert.equal(j.refunded,undefined);
});

test('failing journeys are repaired; journeys that still fail block publishing and are free',{skip:!runtime.available()&&'no browser'},async()=>{
 const cookie=await signup('repair@example.com'),id=await project(cookie,'Repair');
 queue=[{...PLAN,assets:[]}];
 const a=await waitJob(cookie,(await request(server,'POST','/api/create/projects/'+id+'/reference',{headers:{cookie},body:{step:'analyze',url:'http://127.0.0.1:'+site.address().port+'/rooms'}})).json.job);
 assert.equal(a.status,'complete',a.error);
 const broken=app().replace('>Book</button>','>Reserve</button>');
 // Round 1: the agent's button says "Reserve", so the journey fails; the repair fixes it.
 queue=[{thought:'Build.',actions:[{tool:'write_files',files:FILES(broken)},{tool:'finish',message:'Built.'}]},CHECK,{message:'Renamed the button to Book.',files:FILES()},{score:9,strengths:[],improvements:[]}];calls=[];
 const before=await credits(cookie);
 const j=await waitJob(cookie,(await request(server,'POST','/api/create/projects/'+id+'/reference',{headers:{cookie},body:{step:'build'}})).json.job);
 assert.equal(j.status,'complete',j.error);
 assert.equal(j.result.reference.repairs,1);
 assert.match(calls[2].messages.filter(m=>m.role==='user').map(m=>typeof m.content==='string'?m.content:'').join('\n'),/fail when tested in a browser[\s\S]*Book a stay/);
 assert.deepEqual(j.result.reference.last_run.failed,[]);
 assert.equal(j.result.reference.published,null,'publish was not asked for');
 // Round 2: the repair never works, so the journey is switched off, nothing is published and the build is free.
 const id2=await project(cookie,'Never');
 queue=[{...PLAN,assets:[]}];
 assert.equal((await waitJob(cookie,(await request(server,'POST','/api/create/projects/'+id2+'/reference',{headers:{cookie},body:{step:'analyze',url:'http://127.0.0.1:'+site.address().port+'/'}})).json.job)).status,'complete');
 const mid=await credits(cookie);
 queue=[{thought:'Build.',actions:[{tool:'write_files',files:FILES(broken)},{tool:'finish',message:'Built.'}]},CHECK,
  ...[1,2,3].map(()=>({message:'Broken fix.',files:{'src/App.jsx':'export default function App( {'}})),{score:9,strengths:[],improvements:[]}];
 const k=await waitJob(cookie,(await request(server,'POST','/api/create/projects/'+id2+'/reference',{headers:{cookie},body:{step:'build',publish:true}})).json.job);
 assert.equal(k.status,'complete',k.error);
 assert.equal(k.result.reference.repairs,1);
 assert.ok(k.result.reference.problems.some(p=>/^Repair: /.test(p)),'a repair that cannot be built is reported');
 assert.ok(k.result.reference.last_run.failed.some(f=>f.name==='Book a stay'));
 assert.equal(k.result.reference.published,null);
 assert.ok(k.result.reference.problems.some(p=>/Not published/.test(p)));
 assert.equal(checks.list(builder.loadMeta(id2))[0].enabled,false,'the failing journey no longer blocks later changes');
 assert.equal(k.refunded,true);assert.equal(k.refund_reason,'checks');
 assert.equal(await credits(cookie),mid,'a build whose journeys still fail is free');
 assert.ok(before>mid);
});

test('screenshots only, and app files without REA are refunded',async()=>{
 const cookie=await signup('shots@example.com'),id=await project(cookie,'Shots');
 const png='data:image/png;base64,'+PNG.toString('base64');
 queue=[{...PLAN,journeys:[],assets:[]}];calls=[];
 const before=await credits(cookie);
 const a=await waitJob(cookie,(await request(server,'POST','/api/create/projects/'+id+'/reference',{headers:{cookie},body:{step:'analyze',images:[{name:'home.png',dataUrl:png}]}})).json.job);
 assert.equal(a.status,'complete',a.error);
 assert.match(userText(calls[0]),/SCREENSHOTS ONLY: 1 images/);
 assert.deepEqual(builder.loadMeta(id).reference.shots,['reference-upload-1-desktop.png']);
 assert.equal((await request(server,'POST','/api/create/projects/'+id+'/reference',{headers:{cookie},body:{step:'analyze',app:{name:'a.zip',data:'UEsF'}}})).status,400,'app files need the rights confirmation');
 const z=portability.zip({'main.js':'1'}).toString('base64');
 const f=await waitJob(cookie,(await request(server,'POST','/api/create/projects/'+id+'/reference',{headers:{cookie},body:{step:'analyze',app:{name:'a.zip',data:z},rights:true}})).json.job);
 assert.equal(f.status,'failed');assert.match(f.error,/needs REA/);
 assert.equal(await credits(cookie),before-2,'the failed analysis was refunded');
});

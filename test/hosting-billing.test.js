"use strict";
// Live hosting costs credits every 30 days: charged on publish, renewed by the hourly tick,
// a grace period with an email when credits run out, then a paused page until they are back.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-hostbill-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
process.env.KAIROQ_HOSTING_REGISTRY=path.join(tmp,'hosting.json');
process.env.KAIROQ_MEMORY_DIR=path.join(tmp,'memory');
process.env.KAIROQ_LEARNING_DIR=path.join(tmp,'learning');
process.env.KAIROQ_FREE_CREDITS='60';
process.env.KAIROQ_HOSTING_CREDITS='50';
// These tests cover the charge-on-publish mode; the default (charge only for own domains) has its own test below.
process.env.KAIROQ_HOSTING_CHARGE='publish';
process.env.KAIROQ_RUNTIME_CHECK='off';
process.env.KAIROQ_DESIGN_BRIEF='off';
process.env.KAIROQ_WEB_RESEARCH='off';
const builder=require('../react-builder'),createApi=require('../create-api'),hosting=require('../react-hosting'),accounts=require('../builder-accounts'),billing=require('../hosting-billing');

const DAY=86400000;
const callModel=async(opts,parse)=>parse(JSON.stringify({plan:[],message:'Done.',files:{'src/App.jsx':'export default function App() { return <h1>Shop</h1>; }\n'}}));
let server,owner=false;
function req(method,url,body,cookie){return new Promise((resolve,reject)=>{const payload=body?Buffer.from(JSON.stringify(body)):null;const r=http.request({host:'127.0.0.1',port:server.address().port,method,path:url,headers:{...(payload?{'Content-Type':'application/json','Content-Length':payload.length}:{}),...(cookie?{cookie}:{}),'x-forwarded-for':'10.1.1.'+Math.floor(Math.random()*200)}},res=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>{const t=Buffer.concat(c).toString();let j=null;try{j=JSON.parse(t)}catch{}resolve({status:res.statusCode,json:j,text:t})})});r.on('error',reject);if(payload)r.write(payload);r.end()})}
test.before(async()=>{server=http.createServer(async(rq,rs)=>{if(builder.handlePreview(rq,rs))return;if(hosting.handlePath(rq,rs))return;if(await createApi.handle(rq,rs,{isOwner:()=>owner,callModel,secure:false}))return;rs.writeHead(404);rs.end()});await new Promise(r=>server.listen(0,'127.0.0.1',r))});
test.after(()=>{server.close();fs.rmSync(tmp,{recursive:true,force:true})});
async function signup(email){
 const r=await new Promise((resolve,reject)=>{const payload=Buffer.from(JSON.stringify({email,password:'password1'}));const q=http.request({host:'127.0.0.1',port:server.address().port,method:'POST',path:'/api/create/signup',headers:{'Content-Type':'application/json','Content-Length':payload.length,'x-forwarded-for':'10.1.2.'+Math.floor(Math.random()*200)}},res=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>resolve({cookie:res.headers['set-cookie'][0].split(';')[0],json:JSON.parse(Buffer.concat(c).toString())}))});q.on('error',reject);q.write(payload);q.end()});
 return{cookie:r.cookie,id:r.json.account.id};
}
async function builtProject(cookie,name){
 const id=(await req('POST','/api/create/projects',{name},cookie)).json.project.id;
 const job=(await req('POST','/api/create/projects/'+id+'/chat',{message:'Build the shop page'},cookie)).json.job;
 for(let i=0;i<200;i++){const j=(await req('GET','/api/create/jobs/'+job.id,null,cookie)).json.job;if(j.status==='complete')break;await new Promise(r=>setTimeout(r,25))}
 return id;
}
const credits=id=>accounts.get(id).credits;

test('publishing charges 30 days of hosting once; republishing within them is free; not enough credits refuses cleanly',async()=>{
 const a=await signup('shop@example.com'),id=await builtProject(a.cookie,'Corner Shop');
 assert.equal(credits(a.id),59);
 const pub=await req('POST','/api/create/projects/'+id+'/publish',{slug:'corner-shop'},a.cookie);
 assert.equal(pub.status,200,pub.text);
 assert.equal(credits(a.id),9);
 const h=pub.json.project.hosting;
 assert.equal(h.price,50);assert.ok(Math.abs(Date.parse(h.paid_until)-Date.now()-30*DAY)<60000);
 assert.equal((await req('GET','/sites/corner-shop/')).status,200);
 // A new version, published again: no charge.
 await req('POST','/api/create/projects/'+id+'/publish',{slug:'corner-shop'},a.cookie);
 assert.equal(credits(a.id),9);
 // Another project with only 9 credits left: refused, nothing charged, nothing published.
 const id2=await builtProject(a.cookie,'Second Shop');
 const no=await req('POST','/api/create/projects/'+id2+'/publish',{slug:'second-shop'},a.cookie);
 assert.equal(no.status,402);assert.match(no.json.error,/costs 50 credits a month/);
 assert.equal(credits(a.id),8);assert.equal(builder.loadMeta(id2).published,null);
 // A taken site name: the charge is given back.
 const b=await signup('other@example.com'),id3=await builtProject(b.cookie,'Copycat');
 const taken=await req('POST','/api/create/projects/'+id3+'/publish',{slug:'corner-shop'},b.cookie);
 assert.equal(taken.status,409);assert.equal(credits(b.id),59);assert.equal(builder.loadMeta(id3).hosting_billing,undefined);
});

test('renewal every 30 days; out of credits: an email-worthy warning, a grace period, a paused page, and back when paid',async()=>{
 const a=await signup('renew@example.com'),id=await builtProject(a.cookie,'Renew Shop');
 await req('POST','/api/create/projects/'+id+'/publish',{slug:'renew-shop'},a.cookie);
 assert.equal(credits(a.id),9);
 accounts.grant(a.id,100,'Top up','topup-1');
 // 31 days later: renewed.
 let t=Date.now()+31*DAY,r=await billing.tick(t);
 assert.ok(r.renewed.includes(id));assert.equal(credits(a.id),59);
 // 62 days: renewed again.
 t=Date.now()+62*DAY;r=await billing.tick(t);assert.ok(r.renewed.includes(id));assert.equal(credits(a.id),9);
 // 92 days: not enough credits. Warned, still live.
 t=Date.now()+92*DAY;r=await billing.tick(t);
 assert.ok(r.warned.includes(id));assert.equal(credits(a.id),9);
 assert.equal((await req('GET','/sites/renew-shop/')).status,200);
 assert.ok(builder.loadMeta(id).hosting_billing.failed_since);
 // Within the grace period nothing more happens.
 r=await billing.tick(t+3*DAY);assert.deepEqual([...r.warned,...r.paused],[]);
 // After 7 days: paused page, the app and data kept.
 r=await billing.tick(t+7*DAY);assert.ok(r.paused.includes(id));
 const page=await req('GET','/sites/renew-shop/');
 assert.equal(page.status,503);assert.match(page.text,/taking a short break/);
 const view=(await req('GET','/api/create/projects/'+id,null,a.cookie)).json.project.hosting;
 assert.equal(view.paused,true);
 // Credits come back: the next tick resumes it.
 accounts.grant(a.id,100,'Top up','topup-2');
 r=await billing.tick(t+8*DAY);assert.ok(r.resumed.includes(id));
 assert.equal((await req('GET','/sites/renew-shop/')).status,200);
 assert.equal(credits(a.id),59);
 const after=builder.loadMeta(id).hosting_billing;
 assert.equal(after.paused,undefined);assert.ok(Date.parse(after.paid_until)>t+8*DAY);
});

test('sites live before billing get 30 free days; the Kairoq owner and a zero price are never charged',async()=>{
 const a=await signup('legacy@example.com'),id=await builtProject(a.cookie,'Legacy');
 // Published before billing existed: no billing record yet.
 hosting.publish(id,{slug:'legacy-site'});
 let r=await billing.tick();
 assert.ok(r.started.includes(id));assert.equal(credits(a.id),59);
 assert.ok(Date.parse(builder.loadMeta(id).hosting_billing.paid_until)>Date.now()+29*DAY);
 // The Kairoq owner's projects.
 owner=true;
 const o=(await req('POST','/api/create/projects',{name:'Owner site'})).json.project.id;
 await builder.saveSource(o,{...builder.loadFiles(o,1),'src/App.jsx':'export default function App(){return <h1>Owner</h1>}\n'},{summary:'x'});
 const pub=await req('POST','/api/create/projects/'+o+'/publish',{slug:'owner-site'});
 assert.equal(pub.status,200);assert.equal(pub.json.project.hosting.price,0);
 owner=false;
 // Billing off.
 process.env.KAIROQ_HOSTING_CREDITS='0';
 const b=await signup('free@example.com'),id2=await builtProject(b.cookie,'Free');
 assert.equal((await req('POST','/api/create/projects/'+id2+'/publish',{slug:'free-site'},b.cookie)).status,200);
 assert.equal(credits(b.id),59);
 r=await billing.tick(Date.now()+100*DAY);assert.deepEqual(r,{renewed:[],warned:[],paused:[],resumed:[],started:[]});
 process.env.KAIROQ_HOSTING_CREDITS='50';
});

test('default mode: publishing on the Kairoq address is free; connecting an own domain starts the monthly charge',async()=>{
 process.env.KAIROQ_HOSTING_CHARGE='';
 try{
  const a=await signup('free-publish@example.com'),id=await builtProject(a.cookie,'Free Shop');
  const before=credits(a.id);
  const pub=await req('POST','/api/create/projects/'+id+'/publish',{slug:'free-shop'},a.cookie);
  assert.equal(pub.status,200,pub.text);assert.equal(credits(a.id),before);
  assert.equal(pub.json.project.hosting.price,0);assert.equal(pub.json.project.hosting.domain_price,50);
  assert.equal((await req('GET','/sites/free-shop/')).status,200);
  // The hourly renewal leaves a free site alone, now and a year later.
  await billing.tick(Date.now()+365*DAY);
  assert.equal(credits(a.id),before);assert.equal((await req('GET','/sites/free-shop/')).status,200);
  // Connecting the business's own domain is real hosting: 30 days are charged.
  const dom=await req('POST','/api/create/projects/'+id+'/domains',{hostname:'www.free-shop-example.com'},a.cookie);
  assert.equal(dom.status,200,dom.text);assert.equal(credits(a.id),before-50);
  assert.equal(dom.json.project.hosting.price,50);
  // Without enough credits the domain is refused and nothing is charged; the free address keeps working.
  const b=await signup('poor@example.com'),id2=await builtProject(b.cookie,'Poor Shop');
  accounts.charge(b.id,credits(b.id)-5,'spend');
  const no=await req('POST','/api/create/projects/'+id2+'/domains',{hostname:'www.poor-shop-example.com'},b.cookie);
  assert.equal(no.status,402);assert.match(no.json.error,/own domain costs 50 credits a month/);
  assert.equal(credits(b.id),5);assert.deepEqual(builder.loadMeta(id2).domains||[],[]);
 }finally{process.env.KAIROQ_HOSTING_CHARGE='publish'}
});

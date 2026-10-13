"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http'),crypto=require('crypto');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-react-'));
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
process.env.KAIROQ_FREE_CREDITS='2';
const builder=require('../react-builder'),hosting=require('../react-hosting'),accounts=require('../builder-accounts'),createApi=require('../create-api');

const APP=`import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import Hero from './components/Hero.jsx';
export default function App(){
  const [n,setN]=useState(0);
  useEffect(()=>{document.title='Yoga';},[]);
  return <main className="p-8"><Hero/><button className="bg-emerald-600 text-white px-4 py-2" onClick={()=>setN(n+1)}><Star size={16}/> Booked {n}</button></main>;
}
`;
const HERO=`export default function Hero(){return <h1 className="text-4xl font-bold">Sunrise Yoga Studio</h1>}\n`;
function reply(obj){return(_opts,parse)=>Promise.resolve(parse(JSON.stringify(obj)))}
function sequence(...replies){let i=0;const seen=[];const fn=(opts,parse)=>{seen.push([...opts.messages]);return reply(replies[Math.min(i++,replies.length-1)])(opts,parse)};fn.seen=seen;return fn}
const good={message:'Added a hero and a booking button.',files:{'src/App.jsx':APP,'src/components/Hero.jsx':HERO}};

test('a chat edit writes only changed files, builds them with Vite and saves a new version',async()=>{
 const meta=builder.create({name:'Yoga',owner:'owner'});await builder.initialize(meta);
 const result=await builder.edit(meta.id,'Make a yoga studio page',{callModel:sequence(good)});
 assert.equal(result.version,2);
 assert.deepEqual(result.changed.sort(),['src/App.jsx','src/components/Hero.jsx']);
 const dist=path.join(builder.versionDir(meta.id,2),'dist');
 const assets=fs.readdirSync(path.join(dist,'assets'));
 const css=fs.readFileSync(path.join(dist,'assets',assets.find(f=>f.endsWith('.css'))),'utf8');
 assert.match(css,/bg-emerald-600/);
 const js=fs.readFileSync(path.join(dist,'assets',assets.find(f=>f.endsWith('.js'))),'utf8');
 assert.match(js,/Sunrise Yoga Studio/);
 assert.equal(builder.loadFiles(meta.id,1)['src/App.jsx'].includes('Sunrise'),false,'earlier versions stay unchanged');
 const d=builder.detail(meta.id);
 assert.equal(d.current_version,2);
 assert.equal(d.messages.at(-1).text,'Added a hero and a booking button.');
});

test('rejected imports and build errors are sent back to the model and retried',async()=>{
 const meta=builder.create({name:'Retry',owner:'owner'});await builder.initialize(meta);
 const model=sequence(
  {message:'x',files:{'src/App.jsx':"import axios from 'axios';\nexport default function App(){return null}\n"}},
  {message:'y',files:{'src/App.jsx':'export default function App(){return <div>\n'}},
  good);
 const result=await builder.edit(meta.id,'Build it',{callModel:model});
 assert.equal(result.attempts,3);
 assert.match(JSON.stringify(model.seen[1].at(-1)),/axios.+is not available/);
 assert.match(JSON.stringify(model.seen[2].at(-1)),/Vite build failed/);
});

test('generated code cannot reach server files through imports, CSS or import.meta',()=>{
 const base=builder.template('x');
 const errors=builder.validateFiles({...base,
  'src/a.jsx':"import p from '/etc/passwd';import q from '../../server.js';import r from './b.css?raw';const u=new URL('./x',import.meta.url);",
  'src/b.css':"@import '/etc/hosts';body{background:url(../../../secret.png)}",
  '../escape.js':'x'});
 const text=errors.join('\n');
 for(const expected of ['/etc/passwd','../../server.js','?raw','import.meta','@import "/etc/hosts"','url(../../../secret.png)','Invalid file path: ../escape.js'])assert.ok(text.includes(expected),expected+' should be rejected:\n'+text);
});

test('an edit that never builds fails with the last problem and keeps the current version',async()=>{
 const meta=builder.create({name:'Fail',owner:'owner'});await builder.initialize(meta);
 await assert.rejects(builder.edit(meta.id,'x',{callModel:sequence({message:'x',files:{'src/App.jsx':'export default (\n'}})}),/could not be built after 3 attempts/);
 assert.equal(builder.loadMeta(meta.id).current_version,1);
 assert.deepEqual(fs.readdirSync(path.join(builder.projectDir(meta.id),'versions')),['1']);
});

function request(server,method,url,{body,headers={}}={}){
 return new Promise((resolve,reject)=>{
  const req=http.request({host:'127.0.0.1',port:server.address().port,method,path:url,headers:{...(body?{'Content-Type':'application/json'}:{}),...headers}},res=>{let data='';res.on('data',c=>data+=c);res.on('end',()=>{let json;try{json=JSON.parse(data)}catch{}resolve({status:res.statusCode,headers:res.headers,text:data,json})})});
  req.on('error',reject);if(body)req.write(typeof body==='string'?body:JSON.stringify(body));req.end();
 });
}
function server(callModel,{owner=false}={}){
 const s=http.createServer(async(req,res)=>{
  if(hosting.handleHost(req,res))return;
  if(builder.handlePreview(req,res))return;
  if(hosting.handlePath(req,res))return;
  if(await createApi.handle(req,res,{isOwner:()=>owner,callModel,secure:false}))return;
  res.writeHead(404);res.end();
 });
 return new Promise(r=>s.listen(0,'127.0.0.1',()=>r(s)));
}
async function waitJob(s,cookie,id){for(let i=0;i<200;i++){const r=await request(s,'GET','/api/create/jobs/'+id,{headers:{cookie}});if(['complete','failed'].includes(r.json.job.status))return r.json.job;await new Promise(r=>setTimeout(r,50))}throw Error('job timeout')}

test('customers sign up with free credits, spend one per edit and get refunds for failures',async()=>{
 const bad={message:'bad',files:{'src/App.jsx':'export default (\n'}};
 const s=await server((opts,parse)=>reply(/break it/.test([...opts.messages].reverse().find(m=>m.role==='user'&&m.content.includes('Request: ')).content.split('Request: ').pop())?bad:good)(opts,parse));
 try{
  assert.equal((await request(s,'GET','/api/create/projects')).status,401);
  const signup=await request(s,'POST','/api/create/signup',{body:{email:'Ana@Example.com',password:'correct horse'}});
  assert.equal(signup.status,201);assert.equal(signup.json.account.credits,2);
  const cookie=signup.headers['set-cookie'][0].split(';')[0];
  assert.match(signup.headers['set-cookie'][0],/HttpOnly; SameSite=Lax/);
  const created=await request(s,'POST','/api/create/projects',{headers:{cookie},body:{prompt:'A yoga studio site'}});
  assert.equal(created.status,201);
  const job=await waitJob(s,cookie,created.json.job.id);
  assert.equal(job.status,'complete');
  let me=await request(s,'GET','/api/create/me',{headers:{cookie}});
  assert.equal(me.json.viewer.account.credits,1);
  const id=created.json.project.id;
  const failed=await waitJob(s,cookie,(await request(s,'POST','/api/create/projects/'+id+'/chat',{headers:{cookie},body:{message:'break it'}})).json.job.id);
  assert.equal(failed.status,'failed');
  me=await request(s,'GET','/api/create/me',{headers:{cookie}});
  assert.equal(me.json.viewer.account.credits,1,'failed edit is refunded');
  // A second customer cannot see the first customer's project.
  const other=(await request(s,'POST','/api/create/signup',{body:{email:'bo@example.com',password:'another pass'}})).headers['set-cookie'][0].split(';')[0];
  assert.equal((await request(s,'GET','/api/create/projects/'+id,{headers:{cookie:other}})).status,404);
  assert.equal((await request(s,'GET','/api/create/projects',{headers:{cookie:other}})).json.projects.length,0);
  // Spending the last credit, then running out.
  await waitJob(s,cookie,(await request(s,'POST','/api/create/projects/'+id+'/chat',{headers:{cookie},body:{message:'again'}})).json.job.id);
  const broke=await request(s,'POST','/api/create/projects/'+id+'/chat',{headers:{cookie},body:{message:'more'}});
  assert.equal(broke.status,402);
  assert.equal((await request(s,'POST','/api/create/login',{body:{email:'ana@example.com',password:'wrong password'}})).status,401);
  assert.equal((await request(s,'POST','/api/create/login',{body:{email:'ana@example.com',password:'correct horse'}})).status,200);
 }finally{s.close()}
});

test('preview and published sites serve the build; main-host pages are sandboxed',async()=>{
 const s=await server(sequence(good),{owner:true});
 try{
  const created=await request(s,'POST','/api/create/projects',{body:{prompt:'Yoga'}});
  const id=created.json.project.id;
  await waitJob(s,'',created.json.job.id);
  const {project}=(await request(s,'GET','/api/create/projects/'+id)).json;
  const preview=await request(s,'GET',project.preview_url);
  assert.equal(preview.status,200);assert.match(preview.text,/<div id="root">/);
  assert.match(preview.headers['content-security-policy'],/sandbox allow-scripts/);
  const asset=/src="\.\/(assets\/[^"]+\.js)"/.exec(preview.text)[1];
  const js=await request(s,'GET',project.preview_url+asset);
  assert.equal(js.headers['access-control-allow-origin'],'*');
  assert.equal((await request(s,'GET',project.preview_url.replace(/-[a-f0-9]{24}\//,'-'+'0'.repeat(24)+'/'))).status,404,'wrong preview key');
  assert.equal((await request(s,'GET',project.preview_url+'../../../../project.json')).status!==200,true);

  const pub=await request(s,'POST','/api/create/projects/'+id+'/publish',{body:{slug:'Sunrise Yoga'}});
  assert.equal(pub.json.project.published.slug,'sunrise-yoga');
  const site=await request(s,'GET','/sites/sunrise-yoga/');
  assert.equal(site.status,200);assert.match(site.headers['content-security-policy'],/sandbox/);
  assert.equal((await request(s,'GET','/sites/sunrise-yoga/some/route')).status,200,'client routes fall back to index.html');

  const second=(await request(s,'POST','/api/create/projects',{body:{name:'Other'}})).json.project.id;
  assert.equal((await request(s,'POST','/api/create/projects/'+second+'/publish',{body:{slug:'sunrise-yoga'}})).status,409);

  // Custom domain: added, verified through DNS TXT, then served on its own host without sandbox.
  const added=await request(s,'POST','/api/create/projects/'+id+'/domains',{body:{hostname:'https://www.sunrise.example/'}});
  const domain=added.json.project.domains[0];
  assert.equal(domain.hostname,'www.sunrise.example');
  assert.equal((await request(s,'GET','/',{headers:{host:'www.sunrise.example'}})).status,404,'unverified domains are not served');
  const result=await hosting.verifyDomain(id,'www.sunrise.example',{resolveTxt:async name=>name==='_kairoq.www.sunrise.example'?[['kairoq-verify='+domain.token]]:[]});
  assert.equal(result.verified,true);
  const onDomain=await request(s,'GET','/',{headers:{host:'www.sunrise.example'}});
  assert.equal(onDomain.status,200);assert.doesNotMatch(onDomain.headers['content-security-policy'],/sandbox/);
 }finally{s.close()}
});

test('Stripe credit purchases are verified, re-read from Stripe and credited once',async()=>{
 process.env.KAIROQ_STRIPE_SECRET_KEY='sk_test_dummy';
 process.env.KAIROQ_STRIPE_WEBHOOK_SECRET='whsec_'+'a'.repeat(32);
 process.env.KAIROQ_CREDIT_PACKS=JSON.stringify([{id:'starter',name:'Starter',credits:100,price:'price_123'}]);
 try{
  const {account}=accounts.signup('pay@example.com','password123');
  const raw=Buffer.from(JSON.stringify({type:'checkout.session.completed',data:{object:{id:'cs_test_1'}}}));
  const stamp=Math.floor(Date.now()/1000);
  const sig='t='+stamp+',v1='+crypto.createHmac('sha256',process.env.KAIROQ_STRIPE_WEBHOOK_SECRET).update(stamp+'.').update(raw).digest('hex');
  const session={id:'cs_test_1',payment_status:'paid',metadata:{account_id:account.id,pack:'starter'}};
  await assert.rejects(accounts.stripeWebhook(raw,sig.replace(/v1=./,'v1=0'),{fetchSession:async()=>session}),/signature invalid/);
  assert.deepEqual(await accounts.stripeWebhook(raw,sig,{fetchSession:async()=>({...session,payment_status:'unpaid'})}),{pending:'cs_test_1'});
  assert.equal((await accounts.stripeWebhook(raw,sig,{fetchSession:async()=>session})).credited,true);
  assert.equal((await accounts.stripeWebhook(raw,sig,{fetchSession:async()=>session})).credited,false);
  const credits=accounts.history(account.id).reduce((n,r)=>n+r.delta,0);
  assert.equal(credits,102);
 }finally{delete process.env.KAIROQ_STRIPE_SECRET_KEY;delete process.env.KAIROQ_STRIPE_WEBHOOK_SECRET;delete process.env.KAIROQ_CREDIT_PACKS}
});

test.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));

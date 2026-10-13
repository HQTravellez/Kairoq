"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http'),crypto=require('crypto');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-tier3-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
process.env.KAIROQ_FREE_CREDITS='10';
const builder=require('../react-builder'),hosting=require('../react-hosting'),createApi=require('../create-api'),backend=require('../react-backend'),accounts=require('../builder-accounts'),templates=require('../create-templates'),backups=require('../create-backups');

const APP='export default function App(){return <main className="p-6"><h1>Shared app</h1></main>}\n';
function reply(obj){return(_o,parse)=>Promise.resolve(parse(JSON.stringify(obj)))}
function request(server,method,url,{body,headers={}}={}){
 return new Promise((resolve,reject)=>{
  const payload=body?Buffer.from(JSON.stringify(body)):null;
  const req=http.request({host:'127.0.0.1',port:server.address().port,method,path:url,headers:{...(payload?{'Content-Type':'application/json','Content-Length':payload.length}:{}),...headers}},res=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>{const buf=Buffer.concat(c);let json;try{json=JSON.parse(buf)}catch{}resolve({status:res.statusCode,headers:res.headers,text:buf.toString(),json})})});
  req.on('error',reject);if(payload)req.write(payload);req.end();
 });
}
let server,ownerMode=false;
test.before(async()=>{
 server=http.createServer(async(req,res)=>{const h=hosting.handleHost(req,res);if(typeof h==='string'){if(!await backend.handle(req,res,{onlyProject:h.slice(8)})){res.writeHead(404);res.end()}return}if(h)return;if(await backend.handle(req,res))return;if(builder.handlePreview(req,res))return;if(hosting.handlePath(req,res))return;if(await createApi.handle(req,res,{isOwner:()=>ownerMode,callModel:reply({message:'Edited',files:{'src/App.jsx':APP}}),secure:false}))return;res.writeHead(404);res.end()});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
});
test.after(()=>{server.close();fs.rmSync(tmp,{recursive:true,force:true})});
let ipSeq=0;
async function signup(email){const r=await request(server,'POST','/api/create/signup',{body:{email,password:'password1'},headers:{'x-forwarded-for':'1.2.3.4, 10.0.0.'+(++ipSeq)}});return{cookie:r.headers['set-cookie'][0].split(';')[0],account:r.json.account}}
async function waitJob(cookie,id){for(let i=0;i<400;i++){const r=await request(server,'GET','/api/create/jobs/'+id,{headers:{cookie}});if(['complete','failed'].includes(r.json.job.status))return r.json.job;await new Promise(r=>setTimeout(r,25))}throw Error('timeout')}

test('builds run in parallel worker threads',async()=>{
 const files=builder.template('x'),out=n=>path.join(tmp,'par-'+n);
 const started=Date.now();
 const runs=[builder.build(files,out(1)),builder.build(files,out(2)),builder.build(files,out(3))];
 const stats=builder.buildStats();
 assert.equal(stats.max,2);assert.equal(stats.busy,2);assert.equal(stats.queued,1);
 await Promise.all(runs);
 assert.ok(fs.existsSync(path.join(out(3),'index.html')));
 assert.equal(builder.buildStats().busy,0);
 assert.ok(Date.now()-started<60000);
 await assert.rejects(builder.build({...files,'src/App.jsx':'export default ('},out(4)),e=>e.build===true);
});

test('every template is valid; projects can start from a template',async()=>{
 for(const t of templates.TEMPLATES)assert.deepEqual(builder.validateFiles(t.files),[],t.id);
 const list=(await request(server,'GET','/api/create/templates')).json.templates;
 assert.deepEqual(list.map(t=>t.id),['restaurant','guest-portal','saas-landing','crm','booking','portfolio']);
 assert.equal(list[0].files,undefined);
 const {cookie}=await signup('tpl@example.com');
 const r=await request(server,'POST','/api/create/projects',{headers:{cookie},body:{template:'restaurant'}});
 assert.equal(r.status,201,r.text);assert.equal(r.json.project.name,'Restaurant');assert.equal(r.json.project.current_version,1);
 assert.match(builder.loadFiles(r.json.project.id,1)['src/App.jsx'],/Trattoria Lume/);
 assert.equal((await request(server,'POST','/api/create/projects',{headers:{cookie},body:{template:'nope'}})).status,400);
});

test('form collections are submit-only: anyone can send, only the owner can read',async()=>{
 const {cookie}=await signup('forms@example.com');
 const id=(await request(server,'POST','/api/create/projects',{headers:{cookie},body:{template:'booking'}})).json.project.id;
 const base='/api/apps/'+id;
 assert.equal((await request(server,'POST',base+'/collections/appointments',{body:{data:{name:'Ana',email:'ana@x.co'}}})).status,201);
 assert.equal((await request(server,'GET',base+'/collections/appointments')).status,403);
 const tok=(await request(server,'POST',base+'/auth/signup',{body:{email:'snoop@x.co',password:'password1'}})).json.token;
 assert.equal((await request(server,'GET',base+'/collections/appointments',{headers:{authorization:'Bearer '+tok}})).status,403);
 const owner=(await request(server,'GET','/api/create/projects/'+id+'/records?collection=appointments',{headers:{cookie}})).json.items;
 assert.equal(owner[0].name,'Ana');
});

test('plans: subscription checkout, credits on each paid invoice once, cancellation',async()=>{
 process.env.KAIROQ_STRIPE_SECRET_KEY='sk_test_x';process.env.KAIROQ_STRIPE_WEBHOOK_SECRET='whsec_'+'b'.repeat(32);
 process.env.KAIROQ_PLANS=JSON.stringify([{id:'starter',name:'Starter',credits:100,price:'price_sub',label:'$20/month'}]);
 const original=global.fetch,calls=[];
 try{
  const {cookie,account}=await signup('sub@example.com');
  global.fetch=async(url,init={})=>{if(String(url).startsWith('https://api.stripe.com')){calls.push([init.method||'GET',String(url),init.body]);return new Response(JSON.stringify({url:'https://checkout.stripe.com/c/sub'}),{status:200})}return original(url,init)};
  const me=(await request(server,'GET','/api/create/me',{headers:{cookie}})).json;
  assert.equal(me.subscriptions,true);assert.equal(me.plans[0].price,undefined,'price ids stay on the server');
  const s=await request(server,'POST','/api/create/subscribe',{headers:{cookie},body:{plan:'starter'}});
  assert.equal(s.json.url,'https://checkout.stripe.com/c/sub');
  const form=new URLSearchParams(calls[0][2]);
  assert.equal(form.get('mode'),'subscription');assert.equal(form.get('subscription_data[metadata][account_id]'),account.id);
  global.fetch=original;
  const objects={'checkout/sessions/cs_1':{id:'cs_1',mode:'subscription',status:'complete',customer:'cus_1',subscription:'sub_1',metadata:{account_id:account.id,plan:'starter'}},
   'invoices/in_1':{id:'in_1',status:'paid',parent:{subscription_details:{subscription:'sub_1'}}},'invoices/in_2':{id:'in_2',status:'paid',subscription:'sub_1'},
   'subscriptions/sub_1':{id:'sub_1',status:'active',customer:'cus_1',current_period_end:2000000000,metadata:{account_id:account.id,plan:'starter'}}};
  const stripeGet=async p=>objects[p];
  const send=async(type,obj)=>{const raw=Buffer.from(JSON.stringify({type,data:{object:obj}})),t=Math.floor(Date.now()/1000);return accounts.stripeWebhook(raw,'t='+t+',v1='+crypto.createHmac('sha256',process.env.KAIROQ_STRIPE_WEBHOOK_SECRET).update(t+'.').update(raw).digest('hex'),{stripeGet})};
  assert.deepEqual(await send('checkout.session.completed',{id:'cs_1'}),{subscribed:account.id});
  assert.equal((await send('invoice.paid',{id:'in_1'})).credited,true);
  assert.equal((await send('invoice.paid',{id:'in_1'})).credited,false,'each invoice is credited once');
  assert.equal((await send('invoice.paid',{id:'in_2'})).credited,true,'renewals add credits again');
  let acct=(await request(server,'GET','/api/create/me',{headers:{cookie}})).json.viewer.account;
  assert.equal(acct.credits,10+200);assert.equal(acct.plan,'starter');assert.equal(acct.plan_status,'active');assert.equal(acct.billing,true);
  assert.equal((await request(server,'POST','/api/create/subscribe',{headers:{cookie},body:{plan:'starter'}})).status,409);
  objects['subscriptions/sub_1']={...objects['subscriptions/sub_1'],status:'canceled'};
  await send('customer.subscription.deleted',{id:'sub_1'});
  acct=(await request(server,'GET','/api/create/me',{headers:{cookie}})).json.viewer.account;
  assert.equal(acct.plan,null);assert.equal(acct.credits,210,'credits already paid for are kept');
 }finally{global.fetch=original;delete process.env.KAIROQ_STRIPE_SECRET_KEY;delete process.env.KAIROQ_STRIPE_WEBHOOK_SECRET;delete process.env.KAIROQ_PLANS}
});

test('collaborators: editors build with their own credits, viewers only look, owners keep control',async()=>{
 const owner=await signup('lead@example.com'),editor=await signup('dev@example.com'),viewer=await signup('client@example.com'),stranger=await signup('nobody@example.com');
 const id=(await request(server,'POST','/api/create/projects',{headers:{cookie:owner.cookie},body:{name:'Team app'}})).json.project.id;
 const call=(who,method,p,body)=>request(server,method,'/api/create/projects/'+id+p,{headers:{cookie:who.cookie},body});
 assert.equal((await call(owner,'POST','/members',{email:'DEV@example.com',role:'editor'})).status,200);
 await call(owner,'POST','/members',{email:'client@example.com',role:'viewer'});
 assert.equal((await call(editor,'POST','/members',{email:'x@y.co'})).status,403,'only the owner manages members');
 const listed=(await request(server,'GET','/api/create/projects',{headers:{cookie:editor.cookie}})).json.projects;
 assert.deepEqual(listed.map(p=>[p.id,p.role]),[[id,'editor']]);
 assert.equal((await call(stranger,'GET','')).status,404);
 assert.equal((await call(viewer,'GET','')).json.project.role,'viewer');
 assert.equal((await call(viewer,'POST','/chat',{message:'x'})).status,403);
 const job=(await call(editor,'POST','/chat',{message:'Edit it'})).json.job;
 assert.equal((await waitJob(editor.cookie,job.id)).status,'complete');
 const credits=async who=>(await request(server,'GET','/api/create/me',{headers:{cookie:who.cookie}})).json.viewer.account.credits;
 assert.equal(await credits(editor),9);assert.equal(await credits(owner),10);
 assert.equal((await call(editor,'GET','/settings')).status,403);
 assert.equal((await call(editor,'DELETE','')).status,403);
 assert.equal((await call(editor,'POST','/publish',{slug:'team-app'})).status,200,'editors can publish');
 await call(owner,'DELETE','/members',{email:'dev@example.com'});
 assert.equal((await call(editor,'GET','')).status,404,'removed collaborators lose access');
});

test('share links show a live preview and allow remixing when enabled',async()=>{
 const owner=await signup('maker@example.com'),fan=await signup('fan@example.com');
 const id=(await request(server,'POST','/api/create/projects',{headers:{cookie:owner.cookie},body:{template:'portfolio'}})).json.project.id;
 const PNG=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(20)]);
 fs.mkdirSync(path.join(builder.projectDir(id),'uploads'),{recursive:true});fs.writeFileSync(path.join(builder.projectDir(id),'uploads','me.png'),PNG);
 let p=(await request(server,'POST','/api/create/projects/'+id+'/share',{headers:{cookie:owner.cookie},body:{enabled:true,remix:false}})).json.project;
 const token=p.share.token;
 const pub=(await request(server,'GET','/api/create/share/'+token)).json.share;
 assert.equal(pub.name,'Portfolio');assert.equal(pub.remix,false);
 assert.equal((await request(server,'GET',pub.preview_url)).status,200);
 assert.equal((await request(server,'POST','/api/create/remix',{headers:{cookie:fan.cookie},body:{token}})).status,404);
 await request(server,'POST','/api/create/projects/'+id+'/share',{headers:{cookie:owner.cookie},body:{enabled:true,remix:true}});
 const remixed=(await request(server,'POST','/api/create/remix',{headers:{cookie:fan.cookie},body:{token}})).json.project;
 assert.equal(remixed.name,'Remix of Portfolio');assert.equal(remixed.role,'owner');
 assert.equal(builder.loadFiles(remixed.id,1)['src/App.jsx'],builder.loadFiles(id,1)['src/App.jsx']);
 assert.ok(fs.existsSync(path.join(builder.projectDir(remixed.id),'uploads','me.png')),'uploads are copied');
 assert.equal(backend.overview(remixed.id).user_count,0,'data is not copied');
 await request(server,'POST','/api/create/projects/'+id+'/share',{headers:{cookie:owner.cookie},body:{enabled:false}});
 assert.equal((await request(server,'GET','/api/create/share/'+token)).status,404);
});

test('published sites get SEO tags, robots and sitemap, and count visitors without bots',async()=>{
 const {cookie}=await signup('seo@example.com');
 const id=(await request(server,'POST','/api/create/projects',{headers:{cookie},body:{template:'saas-landing'}})).json.project.id;
 await request(server,'POST','/api/create/projects/'+id+'/publish',{headers:{cookie},body:{slug:'northstar'}});
 assert.equal((await request(server,'POST','/api/create/projects/'+id+'/seo',{headers:{cookie},body:{image:'javascript:x'}})).status,400);
 await request(server,'POST','/api/create/projects/'+id+'/seo',{headers:{cookie},body:{title:'Northstar <Metrics>',description:'Metrics "for" teams'}});
 fs.writeFileSync(path.join(builder.projectDir(id),'og.png'),Buffer.from([137,80,78,71]));
 const ua={'user-agent':'Mozilla/5.0 Chrome/120'};
 const page=await request(server,'GET','/sites/northstar/',{headers:{...ua,referer:'https://news.example.com/post'}});
 assert.match(page.text,/<title>Northstar &lt;Metrics&gt;<\/title>/);
 assert.match(page.text,/<meta name="description" content="Metrics &quot;for&quot; teams">/);
 assert.match(page.text,/og:image" content="http:\/\/127\.0\.0\.1:\d+\/sites\/northstar\/og-image\.png"/);
 assert.match(page.headers['content-security-policy'],/sandbox/);
 assert.equal((await request(server,'GET','/sites/northstar/og-image.png')).headers['content-type'],'image/png');
 assert.match((await request(server,'GET','/sites/northstar/robots.txt')).text,/Sitemap: http:\/\/127\.0\.0\.1:\d+\/sites\/northstar\/sitemap\.xml/);
 assert.match((await request(server,'GET','/sites/northstar/sitemap.xml')).text,/<loc>http:\/\/127\.0\.0\.1:\d+\/sites\/northstar\/<\/loc>/);
 await request(server,'GET','/sites/northstar/',{headers:ua});
 await request(server,'GET','/sites/northstar/',{headers:{'user-agent':'Googlebot/2.1'}});
 await request(server,'GET','/sites/northstar/',{headers:{'user-agent':'Mozilla/5.0 Safari','x-forwarded-for':'203.0.113.9'}});
 const js=/src="\.\/(assets\/[^"]+\.js)"/.exec(page.text)[1];
 await request(server,'GET','/sites/northstar/'+js,{headers:ua});
 const a=(await request(server,'GET','/api/create/projects/'+id+'/analytics',{headers:{cookie}})).json.analytics;
 assert.equal(a.totals.views,3,'bots and asset requests are not counted');
 assert.equal(a.totals.visitors,2);
 assert.equal(a.series.length,30);assert.equal(a.series.at(-1).views,3);
 assert.deepEqual(a.referrers,[{referrer:'news.example.com',views:1}]);
});

test('rate limits use the proxy-added address, so a spoofed X-Forwarded-For cannot bypass them',async()=>{
 const tries=[];
 for(let i=0;i<11;i++)tries.push((await request(server,'POST','/api/create/signup',{body:{email:'spoof'+i+'@example.com',password:'password1'},headers:{'x-forwarded-for':'9.9.9.'+i+', 10.9.9.9'}})).status);
 assert.equal(tries.at(-1),429);
});

test('backups snapshot every database and keep the newest days; admin is owner-only',async()=>{
 process.env.KAIROQ_BACKUP_DAYS='2';
 const first=backups.run({now:new Date('2026-01-01T00:00:00Z')});
 assert.equal(first.accounts,true);assert.ok(first.projects>=1);assert.deepEqual(first.errors,[]);
 const {DatabaseSync}=require('node:sqlite');
 const copy=new DatabaseSync(path.join(first.dir,'builder-accounts.sqlite'));
 assert.ok(copy.prepare('SELECT COUNT(*) n FROM accounts').get().n>=5);copy.close();
 backups.run({now:new Date('2026-01-02T00:00:00Z')});backups.run({now:new Date('2026-01-03T00:00:00Z')});
 assert.deepEqual(backups.list(),['2026-01-03-00-00-00','2026-01-02-00-00-00']);
 const {cookie}=await signup('notadmin@example.com');
 assert.equal((await request(server,'GET','/api/create/admin/status',{headers:{cookie}})).status,403);
 ownerMode=true;
 try{
  const st=(await request(server,'GET','/api/create/admin/status')).json;
  assert.equal(st.builds.max,2);assert.ok(st.accounts>=5);assert.ok(st.last_backup);
 }finally{ownerMode=false}
});

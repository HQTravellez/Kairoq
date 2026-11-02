"use strict";
// Teams, the owner's admin view and the billing page for Create apps (app-teams.js, app-admin.js,
// react-backend-extras.js portal): what a B2B SaaS built in Kairoq needs.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http'),crypto=require('crypto');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-teams-'));
Object.assign(process.env,{NODE_ENV:'test',KAIROQ_REACT_PROJECTS_DIR:path.join(tmp,'projects'),KAIROQ_BUILDER_ACCOUNTS_DB:path.join(tmp,'a.sqlite'),KAIROQ_HOSTING_REGISTRY:path.join(tmp,'hosting.json'),APP_ENCRYPTION_KEY:'test-encryption-key-0123456789'});
const builder=require('../react-builder'),backend=require('../react-backend'),secrets=require('../project-secrets');

const BACKEND={collections:{projects:{access:'team'},notes:{access:'private'}},ai:true,credits:{free:5,ai_cost:1},
 payments:{products:{pro:{price:'price_pro',mode:'subscription',credits:100},pack:{price:'price_pack',mode:'payment',credits:50}}}};
let server,base,meta;
test.before(async()=>{
 backend.configure({appAi:async()=>({text:'ok'})});
 meta=builder.create({name:'Studio',owner:'owner'});await builder.initialize(meta);
 await builder.saveSource(meta.id,{...builder.loadFiles(meta.id,1),'src/backend.json':JSON.stringify(BACKEND)},{summary:'setup'});
 meta=builder.loadMeta(meta.id);meta.app_managers=['boss@studio.co'];builder.saveMeta(meta);
 secrets.set(meta.id,'stripe_secret_key','sk_test_abcdefghijkl123');secrets.set(meta.id,'stripe_webhook_secret','whsec_abcdefghijklmnop');
 server=http.createServer(async(req,res)=>{if(await backend.handle(req,res))return;res.writeHead(404);res.end()});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 base='http://127.0.0.1:'+server.address().port+'/api/apps/'+meta.id;
});
test.after(()=>{server.close();fs.rmSync(tmp,{recursive:true,force:true})});
async function call(route,{method='GET',body,token,team,headers={},raw}={}){
 const r=await fetch(base+route,{method,headers:{...(body?{'content-type':'application/json'}:{}),...(token?{authorization:'Bearer '+token}:{}),...(team?{'x-kairoq-team':team}:{}),...headers},body:raw??(body?JSON.stringify(body):undefined)});
 return{status:r.status,json:await r.json().catch(()=>({}))};
}
const signup=async email=>(await call('/auth/signup',{method:'POST',body:{email,password:'password1'}})).json;

test('a team shares its records, invite links work once, roles limit what people can do',async()=>{
 const ann=await signup('ann@x.co'),ben=await signup('ben@x.co'),cat=await signup('cat@x.co'),eve=await signup('eve@x.co');
 const acme=(await call('/teams',{method:'POST',token:ann.token,body:{name:'Acme'}})).json.team;
 assert.equal(acme.role,'owner');
 // A team collection needs a current team, and a team you belong to.
 assert.equal((await call('/collections/projects',{token:ann.token})).status,409);
 assert.equal((await call('/collections/projects',{token:eve.token,team:acme.id})).status,404);
 const p1=(await call('/collections/projects',{method:'POST',token:ann.token,team:acme.id,body:{data:{name:'Launch'}}})).json.item;
 assert.equal(p1._team,acme.id);
 // Invite links: single use; joining gives the invited role.
 const inv=(await call('/teams/'+acme.id+'/invites',{method:'POST',token:ann.token,body:{role:'member'}})).json;
 assert.match(inv.code,/^[A-Za-z0-9_-]{20,}$/);
 assert.equal((await call('/teams/join',{method:'POST',token:ben.token,body:{code:inv.code}})).json.team.role,'member');
 assert.equal((await call('/teams/join',{method:'POST',token:eve.token,body:{code:inv.code}})).status,400,'used links stop working');
 const view=(await call('/teams/'+acme.id+'/invites',{method:'POST',token:ann.token,body:{role:'viewer'}})).json;
 await call('/teams/join',{method:'POST',token:cat.token,body:{code:view.code}});
 // Members read and change every team record; viewers only read.
 assert.deepEqual((await call('/collections/projects',{token:ben.token,team:acme.id})).json.items.map(i=>i.name),['Launch']);
 assert.equal((await call('/collections/projects/'+p1.id,{method:'PATCH',token:ben.token,team:acme.id,body:{data:{name:'Launch v2'}}})).json.item.name,'Launch v2');
 assert.equal((await call('/collections/projects',{token:cat.token,team:acme.id})).json.items.length,1);
 assert.equal((await call('/collections/projects',{method:'POST',token:cat.token,team:acme.id,body:{data:{name:'x'}}})).status,403);
 assert.equal((await call('/collections/projects/'+p1.id,{method:'DELETE',token:cat.token,team:acme.id})).status,403);
 // Another team never sees Acme's records, even by id.
 const other=(await call('/teams',{method:'POST',token:ben.token,body:{name:'Ben Co'}})).json.team;
 assert.deepEqual((await call('/collections/projects',{token:ben.token,team:other.id})).json.items,[]);
 assert.equal((await call('/collections/projects/'+p1.id,{token:ben.token,team:other.id})).status,404);
 assert.equal((await call('/collections/projects/'+p1.id,{method:'PATCH',token:ben.token,team:other.id,body:{data:{name:'stolen'}}})).status,404);
 // Roles: members cannot invite or change roles; admins cannot make admins; the last owner cannot leave.
 assert.equal((await call('/teams/'+acme.id+'/invites',{method:'POST',token:ben.token,body:{}})).status,403);
 assert.equal((await call('/teams/'+acme.id+'/members/'+cat.user.id,{method:'PATCH',token:ben.token,body:{role:'member'}})).status,403);
 assert.equal((await call('/teams/'+acme.id+'/members/'+ben.user.id,{method:'PATCH',token:ann.token,body:{role:'admin'}})).json.role,'admin');
 assert.equal((await call('/teams/'+acme.id+'/invites',{method:'POST',token:ben.token,body:{role:'admin'}})).status,403);
 assert.equal((await call('/teams/'+acme.id+'/members/'+ann.user.id,{method:'DELETE',token:ben.token})).status,403,'nobody removes the owner');
 assert.equal((await call('/teams/'+acme.id+'/members/'+ann.user.id,{method:'DELETE',token:ann.token})).status,409);
 const members=(await call('/teams/'+acme.id+'/members',{token:cat.token})).json.members;
 assert.deepEqual(members.map(m=>[m.email,m.role]).sort(),[['ann@x.co','owner'],['ben@x.co','admin'],['cat@x.co','viewer']]);
 // Leaving removes access; deleting the team removes its records.
 assert.equal((await call('/teams/'+acme.id+'/members/'+cat.user.id,{method:'DELETE',token:cat.token})).json.removed,cat.user.id);
 assert.equal((await call('/collections/projects',{token:cat.token,team:acme.id})).status,404);
 assert.equal((await call('/teams/'+acme.id,{method:'DELETE',token:ben.token})).status,403);
 assert.equal((await call('/teams/'+acme.id,{method:'DELETE',token:ann.token})).json.deleted,acme.id);
 assert.equal((await call('/collections/projects',{token:ann.token,team:acme.id})).status,404);
 assert.deepEqual((await call('/teams',{token:ann.token})).json.teams,[]);
});

test('the admin view is for managers only: customers, paying, credits, and giving credits',async()=>{
 const boss=await signup('boss@studio.co'),dan=await signup('dan@x.co');
 assert.equal(boss.user.manager,true,'sign-up says who manages the app');assert.equal(dan.user.manager,false);
 assert.equal((await call('/auth/signin',{method:'POST',body:{email:'boss@studio.co',password:'password1'}})).json.user.manager,true);
 assert.equal((await call('/admin/overview',{token:dan.token})).status,403);
 assert.equal((await call('/admin/overview')).status,401);
 await call('/ai',{method:'POST',token:dan.token,body:{messages:[{role:'user',content:'hi'}]}});
 let o=(await call('/admin/overview',{token:boss.token})).json;
 assert.ok(o.stats.users>=2);assert.equal(o.credits_on,true);
 assert.equal(o.stats.ai_requests_this_month,1);assert.equal(o.stats.credits_used_this_month,1);
 const row=o.users.find(u=>u.email==='dan@x.co');assert.equal(row.credits,4);assert.deepEqual(row.plans,[]);
 assert.deepEqual((await call('/admin/overview?q=dan',{token:boss.token})).json.users.map(u=>u.email),['dan@x.co']);
 assert.equal((await call('/admin/credits',{method:'POST',token:dan.token,body:{user_id:dan.user.id,amount:100}})).status,403);
 assert.equal((await call('/admin/credits',{method:'POST',token:boss.token,body:{user_id:dan.user.id,amount:-5}})).status,400);
 assert.equal((await call('/admin/credits',{method:'POST',token:boss.token,body:{user_id:dan.user.id,amount:25,note:'Sorry about the outage'}})).json.balance,29);
 const mine=(await call('/credits/me',{token:dan.token})).json;
 assert.match(mine.history[0].reason,/Given by boss@studio\.co: Sorry about the outage/);
});

function sign(raw){const t=Math.floor(Date.now()/1000);return't='+t+',v1='+crypto.createHmac('sha256','whsec_abcdefghijklmnop').update(t+'.'+raw).digest('hex')}
test('the billing page opens Stripe for the customer who paid; later purchases reuse that customer',async()=>{
 const fay=await signup('fay@x.co'),gus=await signup('gus@x.co'),original=global.fetch,calls=[];
 global.fetch=async(url,init={})=>{
  if(!String(url).startsWith('https://api.stripe.com'))return original(url,init);
  calls.push({url:String(url),body:init.body?decodeURIComponent(String(init.body)):''});
  if(String(url).endsWith('/checkout/sessions'))return new Response(JSON.stringify({id:'cs_x',url:'https://checkout.stripe.com/c/cs_x'}));
  if(String(url).includes('checkout/sessions/cs_fay'))return new Response(JSON.stringify({id:'cs_fay',mode:'payment',payment_status:'paid',customer:'cus_fay',metadata:{kairoq_app:meta.id,product:'pack',user_id:fay.user.id}}));
  if(String(url).endsWith('/billing_portal/sessions'))return new Response(JSON.stringify({url:'https://billing.stripe.com/p/session_1'}));
  return new Response('{}',{status:404});
 };
 try{
  const back='http://127.0.0.1:'+server.address().port+'/builder/p/'+meta.id+'-'+builder.loadMeta(meta.id).preview_key+'/v/2/billing';
  assert.equal((await call('/payments/portal',{method:'POST',body:{return_url:back}})).status,401);
  assert.equal((await call('/payments/portal',{method:'POST',token:fay.token,body:{return_url:back}})).status,404,'no billing account before a purchase');
  // First checkout: a one-time pack asks Stripe to make a customer.
  await call('/payments/checkout',{method:'POST',token:fay.token,body:{product:'pack',return_url:back}});
  assert.match(calls.at(-1).body,/customer_creation=always/);assert.match(calls.at(-1).body,/customer_email=fay@x\.co/);
  const raw=JSON.stringify({type:'checkout.session.completed',data:{object:{id:'cs_fay'}}});
  await call('/payments/webhook',{method:'POST',raw,headers:{'stripe-signature':sign(raw)}});
  assert.equal((await call('/credits/me',{token:fay.token})).json.balance,55);
  // The billing page opens for Fay's own Stripe customer, returning to the app.
  const portal=await call('/payments/portal',{method:'POST',token:fay.token,body:{return_url:back}});
  assert.equal(portal.json.url,'https://billing.stripe.com/p/session_1');
  assert.match(calls.at(-1).body,/customer=cus_fay/);assert.match(calls.at(-1).body,/return_url=http:\/\/127\.0\.0\.1/);
  assert.equal((await call('/payments/portal',{method:'POST',token:fay.token,body:{return_url:'https://evil.example/'}})).status,400);
  // Her next checkout reuses the same Stripe customer; someone else never gets it.
  await call('/payments/checkout',{method:'POST',token:fay.token,body:{product:'pro',return_url:back}});
  assert.match(calls.at(-1).body,/customer=cus_fay/);assert.doesNotMatch(calls.at(-1).body,/customer_email/);
  assert.equal((await call('/payments/portal',{method:'POST',token:gus.token,body:{return_url:back}})).status,404);
 }finally{global.fetch=original}
});

test('the browser client and the account pages module build into an app',async()=>{
 const src=backend.clientSource(meta.id);
 for(const name of ['teams','admin','credits'])assert.match(src,new RegExp('export const '+name+'='));
 assert.match(src,/X-Kairoq-Team/);assert.match(src,/async manage\(\)/);
 const files={...builder.loadFiles(meta.id,builder.loadMeta(meta.id).current_version),
  'src/App.jsx':"import { BillingPage, TeamPage, AdminPage, TeamSwitcher, CreditsBadge } from 'kairoq/saas';\nexport default function App(){return (<main><TeamSwitcher /><CreditsBadge /><BillingPage plans={[{product:'pro',name:'Pro',price:'$29 a month'}]} /><TeamPage /><AdminPage /></main>);}\n"};
 const v=await builder.saveSource(meta.id,files,{summary:'pages'});
 // Tailwind keeps the classes the pages use, though they live outside src/.
 const dist=path.join(builder.projectDir(meta.id),'versions',String(v.version),'dist','assets');
 const css=fs.readdirSync(dist).filter(f=>f.endsWith('.css')).map(f=>fs.readFileSync(path.join(dist,f),'utf8')).join('');
 assert.match(css,/\.tabular-nums/);assert.match(css,/\.divide-border/);
});

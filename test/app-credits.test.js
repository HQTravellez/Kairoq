"use strict";
// Customer credits (app-credits.js): an app's own customers pay for its AI with credits. New
// customers get free credits once, each AI request costs credits (refunded when it fails), Stripe
// purchases add credits once however often the webhook is replayed, and subscription renewals
// add them again.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http'),crypto=require('crypto');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-credits-'));
Object.assign(process.env,{NODE_ENV:'test',KAIROQ_REACT_PROJECTS_DIR:path.join(tmp,'projects'),KAIROQ_BUILDER_ACCOUNTS_DB:path.join(tmp,'a.sqlite'),KAIROQ_HOSTING_REGISTRY:path.join(tmp,'hosting.json'),APP_ENCRYPTION_KEY:'test-encryption-key-0123456789'});
const builder=require('../react-builder'),backend=require('../react-backend'),credits=require('../app-credits'),secrets=require('../project-secrets');

const BACKEND={collections:{},ai:true,credits:{free:3,ai_cost:2},payments:{products:{
 credits_100:{price:'price_pack',mode:'payment',credits:100},
 pro:{price:'price_pro',mode:'subscription',credits:500},
 tshirt:{price:'price_shirt',mode:'payment'}}}};

test('credits in src/backend.json are checked',()=>{
 const cfg=backend.parseConfig({'src/backend.json':JSON.stringify(BACKEND)});
 assert.deepEqual(cfg.credits,{free:3,ai_cost:2});
 assert.equal(cfg.payments.products.credits_100.credits,100);
 assert.equal(cfg.payments.products.tshirt.credits,undefined,'products without credits stay as they were');
 const bad=o=>()=>backend.parseConfig({'src/backend.json':JSON.stringify({collections:{},...o})});
 assert.throws(bad({credits:{free:1}}),/needs "ai": true/);
 assert.throws(bad({ai:true,credits:{free:-1}}),/credits\.free/);
 assert.throws(bad({ai:true,credits:{ai_cost:0}}),/ai_cost/);
 assert.throws(bad({ai:true,credits:{ai_cost:1.5}}),/ai_cost/);
 assert.throws(bad({ai:true,payments:{products:{p:{price:'price_1',credits:0}}},credits:{}}),/credits must be a whole number/);
 assert.throws(bad({ai:true,payments:{products:{p:{price:'price_1',credits:10}}}}),/need "credits"/);
});

function sign(raw,secret){const t=Math.floor(Date.now()/1000);return't='+t+',v1='+crypto.createHmac('sha256',secret).update(t+'.'+raw).digest('hex')}

test('customers spend credits on AI, failed requests are refunded, purchases and renewals add credits once',async()=>{
 let failNext=false,aiCalls=0;
 backend.configure({appAi:async()=>{aiCalls++;if(failNext){failNext=false;throw Object.assign(Error('model down'),{status:503})}return{text:'Here is your draft.'}}});
 const meta=builder.create({name:'Writer',owner:'owner'});await builder.initialize(meta);
 await builder.saveSource(meta.id,{...builder.loadFiles(meta.id,1),'src/backend.json':JSON.stringify(BACKEND)},{summary:'setup'});
 secrets.set(meta.id,'stripe_secret_key','sk_test_abcdefghijkl123');secrets.set(meta.id,'stripe_webhook_secret','whsec_abcdefghijklmnop');
 const server=http.createServer(async(req,res)=>{if(await backend.handle(req,res))return;res.writeHead(404);res.end()});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port+'/api/apps/'+meta.id;
 const call=async(route,{method='GET',body,token,headers={},raw}={})=>{const r=await fetch(base+route,{method,headers:{...(body?{'content-type':'application/json'}:{}),...(token?{authorization:'Bearer '+token}:{}),...headers},body:raw??(body?JSON.stringify(body):undefined)});return{status:r.status,json:await r.json().catch(()=>({}))}};
 const original=global.fetch;
 try{
  // Signed out: AI with credits on needs a sign-in, and costs nothing.
  assert.equal((await call('/ai',{method:'POST',body:{messages:[{role:'user',content:'hi'}]}})).status,401);
  assert.equal(aiCalls,0);
  const ann=(await call('/auth/signup',{method:'POST',body:{email:'ann@x.co',password:'password1'}})).json;
  let mine=(await call('/credits/me',{token:ann.token})).json;
  assert.equal(mine.balance,3,'welcome credits');assert.equal(mine.ai_cost,2);
  assert.deepEqual(mine.packs.map(p=>p.product),['credits_100','pro']);
  // One request costs ai_cost; the welcome credits are only given once.
  assert.equal((await call('/ai',{method:'POST',token:ann.token,body:{messages:[{role:'user',content:'Write a tagline'}]}})).json.text,'Here is your draft.');
  assert.equal((await call('/credits/me',{token:ann.token})).json.balance,1);
  // Not enough left: 402 and the model is never called.
  const out=await call('/ai',{method:'POST',token:ann.token,body:{messages:[{role:'user',content:'Again'}]}});
  assert.equal(out.status,402);assert.match(out.json.error,/out of credits/);assert.equal(aiCalls,1);
  // A one-time pack: the webhook adds its credits once, even when Stripe sends it twice.
  global.fetch=async(url,init)=>{
   if(!String(url).startsWith('https://api.stripe.com'))return original(url,init);
   if(String(url).includes('checkout/sessions/cs_pack'))return new Response(JSON.stringify({id:'cs_pack',mode:'payment',payment_status:'paid',amount_total:900,currency:'usd',metadata:{kairoq_app:meta.id,product:'credits_100',user_id:ann.user.id}}));
   if(String(url).includes('checkout/sessions/cs_pro'))return new Response(JSON.stringify({id:'cs_pro',mode:'subscription',status:'complete',payment_status:'paid',subscription:'sub_1',metadata:{kairoq_app:meta.id,product:'pro',user_id:ann.user.id}}));
   if(String(url).includes('subscriptions/sub_1'))return new Response(JSON.stringify({id:'sub_1',status:'active'}));
   if(String(url).includes('invoices/in_first'))return new Response(JSON.stringify({id:'in_first',status:'paid',billing_reason:'subscription_create',subscription:'sub_1'}));
   if(String(url).includes('invoices/in_renew'))return new Response(JSON.stringify({id:'in_renew',status:'paid',billing_reason:'subscription_cycle',parent:{subscription_details:{subscription:'sub_1'}}}));
   return new Response('{}',{status:404});
  };
  const hook=async event=>{const raw=JSON.stringify(event);return call('/payments/webhook',{method:'POST',raw,headers:{'stripe-signature':sign(raw,'whsec_abcdefghijklmnop')}})};
  const pack={type:'checkout.session.completed',data:{object:{id:'cs_pack'}}};
  assert.equal((await hook(pack)).json.recorded,'cs_pack');await hook(pack);
  assert.equal((await call('/credits/me',{token:ann.token})).json.balance,101);
  // A failed AI request is refunded.
  failNext=true;
  assert.equal((await call('/ai',{method:'POST',token:ann.token,body:{messages:[{role:'user',content:'Fail'}]}})).status,503);
  assert.equal((await call('/credits/me',{token:ann.token})).json.balance,101);
  // Streaming costs the same and refunds the same way.
  failNext=true;
  await call('/ai',{method:'POST',token:ann.token,body:{messages:[{role:'user',content:'Fail'}],stream:true}});
  assert.equal((await call('/credits/me',{token:ann.token})).json.balance,101);
  // A subscription: credits when it starts, not again for its first invoice, again on each renewal.
  await hook({type:'checkout.session.completed',data:{object:{id:'cs_pro'}}});
  assert.equal((await call('/credits/me',{token:ann.token})).json.balance,601);
  assert.equal((await hook({type:'invoice.paid',data:{object:{id:'in_first'}}})).json.ignored,'invoice');
  assert.equal((await hook({type:'invoice.paid',data:{object:{id:'in_renew'}}})).json.credited,'in_renew');
  await hook({type:'invoice.paid',data:{object:{id:'in_renew'}}});
  mine=(await call('/credits/me',{token:ann.token})).json;
  assert.equal(mine.balance,1101);
  assert.deepEqual(mine.history.map(h=>h.change).sort((a,b)=>a-b),[-2,-2,-2,2,2,3,100,500,500].sort((a,b)=>a-b));
  // Another customer's balance is their own.
  const bob=(await call('/auth/signup',{method:'POST',body:{email:'bob@x.co',password:'password1'}})).json;
  assert.equal((await call('/credits/me',{token:bob.token})).json.balance,3);
 }finally{global.fetch=original;server.close()}
});

test('without credits in src/backend.json, AI works as before and /credits/me says it is off',async()=>{
 backend.configure({appAi:async()=>({text:'ok'})});
 const meta=builder.create({name:'Plain',owner:'owner'});await builder.initialize(meta);
 await builder.saveSource(meta.id,{...builder.loadFiles(meta.id,1),'src/backend.json':JSON.stringify({collections:{},ai:true})},{summary:'setup'});
 const server=http.createServer(async(req,res)=>{if(await backend.handle(req,res))return;res.writeHead(404);res.end()});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const base='http://127.0.0.1:'+server.address().port+'/api/apps/'+meta.id;
  const r=await fetch(base+'/ai',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:'hi'}]})});
  assert.equal(r.status,200);assert.equal((await r.json()).text,'ok');
  assert.equal((await fetch(base+'/credits/me')).status,404);
 }finally{server.close()}
});

test('the ledger never double-counts a ref',()=>{
 const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(':memory:');credits.migrate(db);
 const cfg={credits:{free:5,ai_cost:1}};
 assert.equal(credits.balance(db,cfg,'u1'),5);assert.equal(credits.balance(db,cfg,'u1'),5);
 assert.equal(credits.grant(db,'u1',10,'gift:1','Gift'),true);assert.equal(credits.grant(db,'u1',10,'gift:1','Gift'),false);
 const receipt=credits.spend(db,cfg,{id:'u1'},4,'test');assert.equal(credits.balance(db,cfg,'u1'),11);
 credits.refund(db,receipt);credits.refund(db,receipt);assert.equal(credits.balance(db,cfg,'u1'),15);
 assert.throws(()=>credits.spend(db,cfg,{id:'u1'},16,'too much'),e=>e.status===402);
 assert.throws(()=>credits.spend(db,cfg,null,1,'x'),e=>e.status===401);
});

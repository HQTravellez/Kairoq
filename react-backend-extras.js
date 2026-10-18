"use strict";
// Optional backend features for Create apps, enabled in src/backend.json:
//   "storage":  {"access":"signed-in"|"public"}   file uploads
//   "email":    true                               send to the signed-in user or the app owner
//   "payments": {"products":{"pro":{"price":"price_...","mode":"payment"|"subscription"}}}
//   "schedules":[{"name":"cleanup","every":"day","action":"delete_older_than","collection":"logs","days":30},
//               {"name":"digest","every":"day","action":"email_owner_summary","collection":"bookings"}]
//   "automations": server functions on a schedule or on record changes (see react-automations.js)
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const builder=require('./react-builder');

const FILE_TYPES={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif','application/pdf':'pdf','text/plain':'txt','text/csv':'csv'};
const MAX_FILE=5*1024*1024;
const EVERY={hour:3600000,day:86400000,week:7*86400000};
function fail(status,message){return Object.assign(Error(message),{status})}

// ---------- config ----------
function normalizeExtras(cfg,collections){
 const out={};
 if(cfg.storage!==undefined){
  const access=typeof cfg.storage==='string'?cfg.storage:cfg.storage&&cfg.storage.access;
  if(!['signed-in','public'].includes(access))throw Error('"storage" needs "access": "signed-in" or "public".');
  out.storage={access};
 }
 if(cfg.ai!==undefined){if(cfg.ai!==true&&cfg.ai!==false)throw Error('"ai" must be true or false.');out.ai=cfg.ai}
 if(cfg.email!==undefined){if(cfg.email!==true&&cfg.email!==false)throw Error('"email" must be true or false.');out.email=cfg.email}
 if(cfg.payments!==undefined){
  const products={};
  for(const [name,p] of Object.entries((cfg.payments&&cfg.payments.products)||{})){
   if(!/^[a-z][a-z0-9_]{0,39}$/.test(name))throw Error('Payment product "'+name+'" must be lowercase letters, numbers or _.');
   if(!p||!/^price_[A-Za-z0-9]+$/.test(p.price||''))throw Error('Payment product "'+name+'" needs a Stripe "price" id like price_123.');
   const mode=p.mode||'payment';if(!['payment','subscription'].includes(mode))throw Error('Payment product "'+name+'" mode must be payment or subscription.');
   products[name]={price:p.price,mode};
  }
  if(!Object.keys(products).length)throw Error('"payments" needs at least one product.');
  out.payments={products};
 }
 if(cfg.schedules!==undefined){
  if(!Array.isArray(cfg.schedules)||cfg.schedules.length>10)throw Error('"schedules" must be a list of up to 10 jobs.');
  out.schedules=cfg.schedules.map(s=>{
   if(!s||!/^[a-z][a-z0-9_-]{0,39}$/.test(s.name||''))throw Error('Each schedule needs a lowercase "name".');
   if(!EVERY[s.every])throw Error('Schedule "'+s.name+'" needs "every": hour, day or week.');
   if(!['delete_older_than','email_owner_summary'].includes(s.action))throw Error('Schedule "'+s.name+'" action must be delete_older_than or email_owner_summary.');
   if(!collections[s.collection])throw Error('Schedule "'+s.name+'" uses collection "'+s.collection+'", which is not declared.');
   const days=Number(s.days??30);
   if(s.action==='delete_older_than'&&!(Number.isInteger(days)&&days>=1&&days<=3650))throw Error('Schedule "'+s.name+'" needs "days" between 1 and 3650.');
   return{name:s.name,every:s.every,action:s.action,collection:s.collection,...(s.action==='delete_older_than'?{days}:{})};
  });
 }
 if(cfg.automations!==undefined)out.automations=require('./react-automations').normalize(cfg.automations,{collections});
 return out;
}
function migrate(db){
 db.exec(`CREATE TABLE IF NOT EXISTS files(id TEXT PRIMARY KEY,owner_id TEXT,name TEXT NOT NULL,type TEXT NOT NULL,size INTEGER NOT NULL,created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS email_log(id TEXT PRIMARY KEY,user_id TEXT,recipient TEXT NOT NULL,at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS payments(session_id TEXT PRIMARY KEY,user_id TEXT NOT NULL,product TEXT NOT NULL,mode TEXT NOT NULL,status TEXT NOT NULL,subscription_id TEXT,amount INTEGER,currency TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS schedule_runs(name TEXT PRIMARY KEY,last_run INTEGER NOT NULL,last_result TEXT);`);
}

// ---------- owner ----------
function ownerEmail(meta){
 if(meta.owner==='owner')return process.env.KAIROQ_OWNER_EMAIL||null;
 try{return require('./builder-accounts').email(meta.owner)}catch{return null}
}

// ---------- storage ----------
// A test run (react-sandbox.js) keeps its uploads in its own folder.
function filesDir(id,db){return db&&db.__filesDir||path.join(builder.projectDir(id),'files')}
function storageLimit(){return Number(process.env.KAIROQ_APP_STORAGE_MB||500)*1024*1024}
async function readRaw(req,limit){const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>limit)throw fail(413,'File is larger than 5 MB');chunks.push(c)}return Buffer.concat(chunks)}
async function upload(req,{id,db,cfg,user,query}){
 if(!cfg.storage)throw fail(404,'File uploads are not enabled. Add "storage" to src/backend.json.');
 if(cfg.storage.access==='signed-in'&&!user)throw fail(401,'Sign in to upload files');
 const type=String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase();
 if(!FILE_TYPES[type])throw fail(415,'Upload images (PNG, JPEG, WebP, GIF), PDF, plain text or CSV');
 const bytes=await readRaw(req,MAX_FILE);
 if(!bytes.length)throw fail(400,'The file is empty');
 const used=db.prepare('SELECT COALESCE(SUM(size),0) n FROM files').get().n;
 if(used+bytes.length>storageLimit())throw fail(507,'This app is out of file storage');
 const fid=crypto.randomUUID(),name=String(query.name||'file.'+FILE_TYPES[type]).replace(/[^\w .-]+/g,'_').slice(0,120);
 fs.mkdirSync(filesDir(id,db),{recursive:true});
 fs.writeFileSync(path.join(filesDir(id,db),fid),bytes);
 db.prepare('INSERT INTO files(id,owner_id,name,type,size,created_at) VALUES(?,?,?,?,?,?)').run(fid,user?user.id:null,name,type,bytes.length,new Date().toISOString());
 return{id:fid,name,type,size:bytes.length,url:'/api/apps/'+id+'/files/'+fid};
}
function serveFile(res,{id,db,fid}){
 const f=db.prepare('SELECT * FROM files WHERE id=?').get(fid);
 const file=f&&path.join(filesDir(id,db),f.id);
 if(!f||!fs.existsSync(file))throw fail(404,'File not found');
 const inline=f.type.startsWith('image/');
 res.writeHead(200,{'Content-Type':f.type,'Content-Length':f.size,'Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Access-Control-Allow-Origin':'*','Content-Disposition':(inline?'inline':'attachment')+'; filename="'+f.name.replace(/"/g,'')+'"'});
 fs.createReadStream(file).pipe(res);
}
function removeFile({id,db,user,fid}){
 const f=db.prepare('SELECT * FROM files WHERE id=?').get(fid);
 if(!f)throw fail(404,'File not found');
 if(!user||f.owner_id!==user.id)throw fail(403,'You can only delete your own files');
 db.prepare('DELETE FROM files WHERE id=?').run(fid);fs.rmSync(path.join(filesDir(id,db),fid),{force:true});
 return{deleted:fid};
}

// ---------- email (Resend) ----------
async function deliver(to,subject,text,replyTo){
 const key=process.env.KAIROQ_RESEND_API_KEY,from=process.env.KAIROQ_EMAIL_FROM;
 if(!key||!from)throw fail(409,'Email is not set up on this Kairoq server (KAIROQ_RESEND_API_KEY and KAIROQ_EMAIL_FROM).');
 const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({from,to:[to],subject,text,...(replyTo?{reply_to:replyTo}:{})}),signal:AbortSignal.timeout(15000)});
 if(!r.ok){const d=await r.json().catch(()=>({}));throw fail(502,'Email could not be sent: '+(d.message||r.status))}
}
async function sendEmail(body,{meta,db,cfg,user}){
 if(!cfg.email)throw fail(404,'Email is not enabled. Add "email": true to src/backend.json.');
 const to=body.to==='owner'?ownerEmail(meta):body.to==='me'?(user&&user.email):null;
 if(!to)throw fail(body.to==='me'?401:body.to==='owner'?409:400,body.to==='me'?'Sign in to email yourself':body.to==='owner'?'The app owner has no email address yet (server admin: set KAIROQ_OWNER_EMAIL)':'Send to "owner" (the app owner) or "me" (the signed-in user)');
 const subject=String(body.subject||'').trim().slice(0,200),text=String(body.text||'').trim().slice(0,10000);
 if(!subject||!text)throw fail(400,'Email needs a subject and text');
 const now=Date.now(),who=user?user.id:'anonymous';
 if(db.prepare('SELECT COUNT(*) n FROM email_log WHERE user_id=? AND at>?').get(who,now-3600000).n>=(user?20:5))throw fail(429,'Too many emails. Try again later.');
 if(db.prepare('SELECT COUNT(*) n FROM email_log WHERE at>?').get(now-86400000).n>=200)throw fail(429,'This app has reached its daily email limit');
 await deliver(to,subject,text+'\n\n—\nSent from '+meta.name+(user?' by '+user.email:'')+' via Kairoq',user&&body.to==='owner'?user.email:undefined);
 db.prepare('INSERT INTO email_log(id,user_id,recipient,at) VALUES(?,?,?,?)').run(crypto.randomUUID(),who,to,now);
 return{sent:true};
}

// ---------- payments (the app owner's Stripe account) ----------
async function stripe(secretKey,pathname,{method='GET',form}={}){
 const r=await fetch('https://api.stripe.com/v1/'+pathname,{method,headers:{Authorization:'Bearer '+secretKey,...(form?{'Content-Type':'application/x-www-form-urlencoded'}:{})},body:form?new URLSearchParams(form).toString():undefined,signal:AbortSignal.timeout(20000)});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw fail(502,'Stripe: '+(data.error&&data.error.message||r.status));
 return data;
}
function projectStripeKey(id){const k=require('./project-secrets').get(id,'stripe_secret_key');if(!k)throw fail(409,'The app owner has not connected Stripe yet');return k}
// Return URLs (password reset, Google sign-in, checkout) must be this app's own pages:
// its verified domains, its subdomain, or its /sites/<slug>/ and preview paths on Kairoq.
function allowedReturn(url,req,meta){
 let u;try{u=new URL(String(url))}catch{throw fail(400,'return_url must be a full URL')}
 if(!/^https?:$/.test(u.protocol))throw fail(400,'return_url must be http(s)');
 const host=u.host.toLowerCase();
 if((meta.domains||[]).some(d=>d.verified&&d.hostname===host))return u;
 const sites=String(process.env.KAIROQ_SITES_DOMAIN||'').toLowerCase();
 if(sites&&meta.published&&host===meta.published.slug+'.'+sites)return u;
 let kairoq='';
 try{const p=process.env.KAIROQ_PUBLIC_URL||(process.env.RAILWAY_PUBLIC_DOMAIN?'https://'+process.env.RAILWAY_PUBLIC_DOMAIN:'');kairoq=p?new URL(p).host.toLowerCase():String(req.headers.host||'').toLowerCase()}catch{}
 const paths=['/builder/p/'+meta.id+'-'+meta.preview_key+'/',...(meta.published?['/sites/'+meta.published.slug+'/']:[])];
 if(host===kairoq&&paths.some(p=>u.pathname.startsWith(p)))return u;
 throw fail(400,'return_url must point to this app');
}
async function checkout(body,{id,meta,cfg,user,req,stripeCall=stripe}){
 if(!cfg.payments)throw fail(404,'Payments are not enabled. Add "payments" to src/backend.json.');
 if(!user)throw fail(401,'Sign in to buy');
 const product=cfg.payments.products[body.product];
 if(!product)throw fail(404,'Unknown product');
 const back=allowedReturn(body.return_url,req,meta);
 const mark=(status)=>{const u=new URL(back);u.searchParams.set('kairoq_payment',status);return u.toString()};
 const session=await stripeCall(projectStripeKey(id),'checkout/sessions',{method:'POST',form:{mode:product.mode,'line_items[0][price]':product.price,'line_items[0][quantity]':'1',client_reference_id:user.id,customer_email:user.email,'metadata[kairoq_app]':id,'metadata[product]':body.product,'metadata[user_id]':user.id,success_url:mark('success'),cancel_url:mark('cancelled')}});
 return{url:session.url};
}
async function paymentWebhook(req,{id,meta,db,stripeCall=stripe,now}){
 const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>65536)throw fail(413,'Webhook too large');chunks.push(c)}
 const raw=Buffer.concat(chunks);
 const secret=require('./project-secrets').get(id,'stripe_webhook_secret');
 if(!secret)throw fail(409,'Stripe webhook secret is not set for this app');
 require('./builder-accounts').verifyStripeSignature(raw,req.headers['stripe-signature'],secret,now);
 const event=JSON.parse(raw);
 const obj=event.data&&event.data.object||{};
 if(event.type==='checkout.session.completed'||event.type==='checkout.session.async_payment_succeeded'){
  const s=await stripeCall(projectStripeKey(id),'checkout/sessions/'+encodeURIComponent(obj.id));
  if(s.metadata?.kairoq_app!==id)throw fail(400,'Session belongs to another app');
  const paid=s.payment_status==='paid'||(s.mode==='subscription'&&s.status==='complete');
  if(!paid)return{pending:s.id};
  const at=new Date().toISOString();
  // A late or replayed "completed" event must not revive a cancelled subscription.
  const existing=db.prepare('SELECT status FROM payments WHERE session_id=?').get(s.id);
  if(existing&&existing.status==='cancelled')return{ignored:'cancelled'};
  if(s.mode==='subscription'&&s.subscription){const sub=await stripeCall(projectStripeKey(id),'subscriptions/'+encodeURIComponent(typeof s.subscription==='string'?s.subscription:s.subscription.id)).catch(()=>null);if(sub&&/^(canceled|incomplete_expired|unpaid)$/.test(sub.status))return{ignored:sub.status}}
  db.prepare('INSERT INTO payments(session_id,user_id,product,mode,status,subscription_id,amount,currency,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(session_id) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at')
   .run(s.id,s.metadata.user_id,s.metadata.product,s.mode,'active',s.subscription||null,s.amount_total??null,s.currency||null,at,at);
  return{recorded:s.id};
 }
 if(event.type==='customer.subscription.deleted'&&obj.id){
  db.prepare("UPDATE payments SET status='cancelled',updated_at=? WHERE subscription_id=?").run(new Date().toISOString(),obj.id);
  return{cancelled:obj.id};
 }
 return{ignored:event.type};
}
function myPurchases(db,user){
 if(!user)throw fail(401,'Sign in first');
 return db.prepare('SELECT product,mode,status,created_at FROM payments WHERE user_id=? ORDER BY created_at DESC').all(user.id);
}

// ---------- schedules ----------
async function runSchedules(id,cfg,db,meta,{now=Date.now(),send=deliver}={}){
 const results=[];
 for(const s of cfg.schedules||[]){
  const last=db.prepare('SELECT last_run FROM schedule_runs WHERE name=?').get(s.name);
  if(last&&now-last.last_run<EVERY[s.every])continue;
  let result;
  try{
   if(s.action==='delete_older_than'){
    const cutoff=new Date(now-s.days*86400000).toISOString();
    result='deleted '+db.prepare('DELETE FROM records WHERE collection=? AND created_at<?').run(s.collection,cutoff).changes+' records';
   }else{
    const since=new Date(now-EVERY[s.every]).toISOString();
    const rows=db.prepare('SELECT data,created_at FROM records WHERE collection=? AND created_at>=? ORDER BY created_at DESC LIMIT 50').all(s.collection,since);
    const to=ownerEmail(meta);
    if(!to)result='skipped: no owner email';
    else{
     const lines=rows.map(r=>'- '+r.created_at.slice(0,16).replace('T',' ')+'  '+Object.entries(JSON.parse(r.data)).slice(0,6).map(([k,v])=>k+': '+String(typeof v==='object'?JSON.stringify(v):v).slice(0,80)).join(', '));
     await send(to,meta.name+': '+rows.length+' new '+s.collection+' this '+s.every,rows.length?lines.join('\n'):'No new '+s.collection+'.');
     result='emailed '+rows.length+' records';
    }
   }
  }catch(e){result='failed: '+String(e.message||e).slice(0,200)}
  db.prepare('INSERT INTO schedule_runs(name,last_run,last_result) VALUES(?,?,?) ON CONFLICT(name) DO UPDATE SET last_run=excluded.last_run,last_result=excluded.last_result').run(s.name,now,result);
  results.push({name:s.name,result});
 }
 return results;
}

module.exports={deliver,allowedReturn,normalizeExtras,migrate,upload,serveFile,removeFile,sendEmail,checkout,paymentWebhook,myPurchases,runSchedules,ownerEmail,FILE_TYPES};

"use strict";
// Customer accounts and credits for the chat builder. One credit pays for one
// successful chat edit. Credits are bought with Stripe Checkout credit packs.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {DatabaseSync}=require('node:sqlite');

const SESSION_DAYS=30,COOKIE='kq_builder';
let db,dbFile;
function database(){
 const file=process.env.KAIROQ_BUILDER_ACCOUNTS_DB||path.join(__dirname,'workspace','builder-accounts.sqlite');
 if(db&&dbFile===file)return db;
 fs.mkdirSync(path.dirname(file),{recursive:true});
 db=new DatabaseSync(file);dbFile=file;
 db.exec(`PRAGMA journal_mode=WAL;
  CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,credits INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,account_id TEXT NOT NULL,expires_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS ledger(id TEXT PRIMARY KEY,account_id TEXT NOT NULL,delta INTEGER NOT NULL,reason TEXT NOT NULL,ref TEXT UNIQUE,at TEXT NOT NULL);`);
 db.exec('CREATE TABLE IF NOT EXISTS account_tokens(token_hash TEXT PRIMARY KEY,account_id TEXT NOT NULL,kind TEXT NOT NULL,expires_at INTEGER NOT NULL)');
 for(const col of ['plan TEXT','plan_status TEXT','stripe_customer TEXT','subscription_id TEXT','plan_renews_at TEXT','email_verified INTEGER NOT NULL DEFAULT 0','google_sub TEXT']){try{db.exec('ALTER TABLE accounts ADD COLUMN '+col)}catch{}}
 return db;
}
function freeCredits(){const n=Number(process.env.KAIROQ_FREE_CREDITS??30);return Number.isInteger(n)&&n>=0?n:30}
function hashToken(t){return crypto.createHash('sha256').update(String(t)).digest('hex')}
function hashPassword(password,salt=crypto.randomBytes(16).toString('hex')){return'scrypt$'+salt+'$'+crypto.scryptSync(String(password),salt,32).toString('hex')}
function checkPassword(password,stored){
 const [,salt,hex]=String(stored).split('$');if(!salt||!hex)return false;
 const a=Buffer.from(hex,'hex'),b=crypto.scryptSync(String(password),salt,32);
 return a.length===b.length&&crypto.timingSafeEqual(a,b);
}
function normalizeEmail(email){
 const e=String(email||'').trim().toLowerCase();
 if(e.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))throw Object.assign(Error('Enter a valid email address'),{status:400});
 return e;
}
function publicAccount(a){return a&&{id:a.id,email:a.email,email_verified:Boolean(a.email_verified),credits:a.credits,created_at:a.created_at,plan:a.plan||null,plan_status:a.plan_status||null,plan_renews_at:a.plan_renews_at||null,billing:Boolean(a.stripe_customer)}}

function signup(email,password){
 const e=normalizeEmail(email);
 if(String(password||'').length<8)throw Object.assign(Error('Use a password with at least 8 characters'),{status:400});
 const d=database();
 if(d.prepare('SELECT id FROM accounts WHERE email=?').get(e))throw Object.assign(Error('An account with that email already exists'),{status:409});
 const id=crypto.randomUUID(),at=new Date().toISOString(),credits=freeCredits();
 d.prepare('INSERT INTO accounts(id,email,password,credits,created_at) VALUES(?,?,?,?,?)').run(id,e,hashPassword(password),credits,at);
 if(credits)d.prepare('INSERT INTO ledger(id,account_id,delta,reason,ref,at) VALUES(?,?,?,?,?,?)').run(crypto.randomUUID(),id,credits,'Free credits',null,at);
 return startSession(id);
}
function login(email,password){
 const a=database().prepare('SELECT * FROM accounts WHERE email=?').get(normalizeEmail(email));
 if(!a||!checkPassword(password,a.password))throw Object.assign(Error('Email or password is incorrect'),{status:401});
 return startSession(a.id);
}
function startSession(accountId){
 const token=crypto.randomBytes(32).toString('base64url');
 database().prepare('INSERT INTO sessions(token_hash,account_id,expires_at) VALUES(?,?,?)').run(hashToken(token),accountId,Date.now()+SESSION_DAYS*86400000);
 return{token,account:publicAccount(get(accountId))};
}
function readCookie(req){
 for(const part of String(req.headers.cookie||'').split(';')){const i=part.indexOf('=');if(i>0&&part.slice(0,i).trim()===COOKIE)return decodeURIComponent(part.slice(i+1).trim())}
 return'';
}
function fromRequest(req){
 const token=readCookie(req);if(!token)return null;
 const d=database(),s=d.prepare('SELECT * FROM sessions WHERE token_hash=?').get(hashToken(token));
 if(!s)return null;
 if(s.expires_at<Date.now()){d.prepare('DELETE FROM sessions WHERE token_hash=?').run(s.token_hash);return null}
 return publicAccount(get(s.account_id));
}
function logout(req){const token=readCookie(req);if(token)database().prepare('DELETE FROM sessions WHERE token_hash=?').run(hashToken(token))}
function cookie(token,secure){return COOKIE+'='+encodeURIComponent(token)+'; HttpOnly; SameSite=Lax; Path=/; Max-Age='+(token?SESSION_DAYS*86400:0)+(secure?'; Secure':'')}
function get(id){return database().prepare('SELECT * FROM accounts WHERE id=?').get(id)}

// Atomically take credits. Throws 402 when the balance is too low.
function charge(accountId,amount,reason,ref=null){
 const d=database();
 const r=d.prepare('UPDATE accounts SET credits=credits-? WHERE id=? AND credits>=?').run(amount,accountId,amount);
 if(!r.changes)throw Object.assign(Error('You are out of credits. Buy more to keep building.'),{status:402});
 d.prepare('INSERT INTO ledger(id,account_id,delta,reason,ref,at) VALUES(?,?,?,?,?,?)').run(crypto.randomUUID(),accountId,-amount,reason,ref,new Date().toISOString());
 return publicAccount(get(accountId));
}
// Adds credits once per ref (for example a Stripe Checkout session id).
function grant(accountId,amount,reason,ref){
 const d=database();
 if(ref&&d.prepare('SELECT id FROM ledger WHERE ref=?').get(ref))return{duplicate:true,account:publicAccount(get(accountId))};
 if(!get(accountId))throw Object.assign(Error('Unknown account'),{status:404});
 d.exec('BEGIN');
 try{
  d.prepare('INSERT INTO ledger(id,account_id,delta,reason,ref,at) VALUES(?,?,?,?,?,?)').run(crypto.randomUUID(),accountId,amount,reason,ref||null,new Date().toISOString());
  d.prepare('UPDATE accounts SET credits=credits+? WHERE id=?').run(amount,accountId);
  d.exec('COMMIT');
 }catch(e){d.exec('ROLLBACK');if(/UNIQUE/.test(e.message))return{duplicate:true,account:publicAccount(get(accountId))};throw e}
 return{duplicate:false,account:publicAccount(get(accountId))};
}
function history(accountId,limit=50){return database().prepare('SELECT delta,reason,at FROM ledger WHERE account_id=? ORDER BY at DESC LIMIT ?').all(accountId,limit)}

// ---------- Stripe credit packs ----------
// KAIROQ_CREDIT_PACKS='[{"id":"starter","name":"Starter","credits":100,"price":"price_..."}]'
function packs(){
 try{
  const list=JSON.parse(process.env.KAIROQ_CREDIT_PACKS||'[]');
  return Array.isArray(list)?list.filter(p=>p&&/^[a-z0-9_-]{1,40}$/.test(p.id)&&Number.isInteger(p.credits)&&p.credits>0&&/^price_[A-Za-z0-9]+$/.test(p.price)).map(p=>({id:p.id,name:String(p.name||p.id).slice(0,60),credits:p.credits,price:p.price,label:String(p.label||'').slice(0,40)})):[];
 }catch{return[]}
}
// KAIROQ_PLANS='[{"id":"starter","name":"Starter","credits":100,"price":"price_...","label":"$20/month"}]'
function plans(){
 try{
  const list=JSON.parse(process.env.KAIROQ_PLANS||'[]');
  return Array.isArray(list)?list.filter(p=>p&&/^[a-z0-9_-]{1,40}$/.test(p.id)&&Number.isInteger(p.credits)&&p.credits>0&&/^price_[A-Za-z0-9]+$/.test(p.price)).map(p=>({id:p.id,name:String(p.name||p.id).slice(0,60),credits:p.credits,price:p.price,label:String(p.label||'').slice(0,40),features:Array.isArray(p.features)?p.features.slice(0,8).map(f=>String(f).slice(0,80)):[]})):[];
 }catch{return[]}
}
function stripeReady(){return Boolean(process.env.KAIROQ_STRIPE_SECRET_KEY)}
async function subscribe(account,planId,origin){
 if(!stripeReady())throw Object.assign(Error('Plans are not set up yet'),{status:409});
 const plan=plans().find(p=>p.id===planId);
 if(!plan)throw Object.assign(Error('Unknown plan'),{status:400});
 const row=get(account.id);
 if(row.subscription_id&&row.plan_status==='active')throw Object.assign(Error('You already have a plan. Use Manage billing to change it.'),{status:409});
 const session=await stripe('checkout/sessions',{method:'POST',form:{mode:'subscription','line_items[0][price]':plan.price,'line_items[0][quantity]':'1',client_reference_id:account.id,...(row.stripe_customer?{customer:row.stripe_customer}:{customer_email:account.email}),'metadata[account_id]':account.id,'metadata[plan]':plan.id,'subscription_data[metadata][account_id]':account.id,'subscription_data[metadata][plan]':plan.id,success_url:origin+'/create?purchase=success',cancel_url:origin+'/create?purchase=cancelled'}});
 return{url:session.url};
}
async function billingPortal(account,origin){
 const row=get(account.id);
 if(!row.stripe_customer)throw Object.assign(Error('No billing account yet'),{status:404});
 const session=await stripe('billing_portal/sessions',{method:'POST',form:{customer:row.stripe_customer,return_url:origin+'/create'}});
 return{url:session.url};
}
function setPlan(accountId,fields){
 const cols=Object.keys(fields);if(!cols.length)return;
 database().prepare('UPDATE accounts SET '+cols.map(c=>c+'=?').join(',')+' WHERE id=?').run(...cols.map(c=>fields[c]),accountId);
}
function stripeConfigured(){return Boolean(process.env.KAIROQ_STRIPE_SECRET_KEY&&packs().length)}
async function stripe(pathname,{method='GET',form}={}){
 const r=await fetch('https://api.stripe.com/v1/'+pathname,{method,headers:{Authorization:'Bearer '+process.env.KAIROQ_STRIPE_SECRET_KEY,...(form?{'Content-Type':'application/x-www-form-urlencoded'}:{})},body:form?new URLSearchParams(form).toString():undefined,signal:AbortSignal.timeout(20000)});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw Object.assign(Error(data.error?.message||'Stripe request failed'),{status:502});
 return data;
}
async function checkout(account,packId,origin){
 if(!stripeConfigured())throw Object.assign(Error('Credit purchases are not set up yet'),{status:409});
 const pack=packs().find(p=>p.id===packId);
 if(!pack)throw Object.assign(Error('Unknown credit pack'),{status:400});
 const session=await stripe('checkout/sessions',{method:'POST',form:{mode:'payment','line_items[0][price]':pack.price,'line_items[0][quantity]':'1',client_reference_id:account.id,customer_email:account.email,'metadata[account_id]':account.id,'metadata[pack]':pack.id,'metadata[credits]':String(pack.credits),success_url:origin+'/create?purchase=success',cancel_url:origin+'/create?purchase=cancelled'}});
 return{url:session.url};
}
function verifyStripeSignature(raw,header,secret,now=Date.now()){
 if(!secret||typeof header!=='string')throw Object.assign(Error('Webhook signature missing'),{status:401});
 const parts=header.split(','),stamp=parts.find(p=>p.startsWith('t='))?.slice(2),sigs=parts.filter(p=>p.startsWith('v1=')).map(p=>p.slice(3));
 if(!/^\d{10}$/.test(stamp||'')||Math.abs(now-Number(stamp)*1000)>300000)throw Object.assign(Error('Webhook timestamp expired'),{status:401});
 const expected=crypto.createHmac('sha256',secret).update(stamp+'.').update(raw).digest();
 if(!sigs.some(s=>/^[a-f0-9]{64}$/.test(s)&&crypto.timingSafeEqual(expected,Buffer.from(s,'hex'))))throw Object.assign(Error('Webhook signature invalid'),{status:401});
}
// Credits are granted only after re-reading the session from Stripe and confirming payment.
// Every event is re-read from Stripe before acting on it.
async function stripeWebhook(raw,signature,{fetchSession,stripeGet=p=>stripe(p)}={}){
 verifyStripeSignature(raw,signature,process.env.KAIROQ_STRIPE_WEBHOOK_SECRET);
 const event=JSON.parse(raw),obj=event.data?.object||{};
 const getSession=fetchSession||(id=>stripeGet('checkout/sessions/'+encodeURIComponent(id)));
 if(event.type==='checkout.session.completed'||event.type==='checkout.session.async_payment_succeeded'){
  const id=obj.id;
  if(typeof id!=='string'||!/^cs_[A-Za-z0-9_]+$/.test(id))throw Object.assign(Error('Missing checkout session'),{status:400});
  const session=await getSession(id);
  const accountId=session.metadata?.account_id||session.client_reference_id;
  if(session.mode==='subscription'){
   if(!accountId||!get(accountId))throw Object.assign(Error('Subscription is missing its account'),{status:400});
   setPlan(accountId,{stripe_customer:session.customer||null,subscription_id:session.subscription||null,plan:session.metadata?.plan||null,plan_status:session.status==='complete'?'active':'incomplete'});
   return{subscribed:accountId};
  }
  if(session.payment_status!=='paid')return{pending:id};
  const pack=packs().find(p=>p.id===session.metadata?.pack);
  if(!pack||!accountId)throw Object.assign(Error('Checkout session is missing its credit pack'),{status:400});
  if(session.customer)setPlan(accountId,{stripe_customer:session.customer});
  const result=grant(accountId,pack.credits,'Bought '+pack.name,'stripe:'+id);
  return{credited:!result.duplicate,credits:pack.credits};
 }
 // Plan credits arrive with each paid invoice (first payment and every renewal).
 if(event.type==='invoice.paid'||event.type==='invoice.payment_succeeded'){
  if(!/^in_[A-Za-z0-9_]+$/.test(obj.id||''))throw Object.assign(Error('Missing invoice'),{status:400});
  const invoice=await stripeGet('invoices/'+encodeURIComponent(obj.id));
  if(invoice.status!=='paid')return{pending:obj.id};
  const subId=invoice.subscription||invoice.parent?.subscription_details?.subscription;
  if(!subId)return{ignored:'invoice without subscription'};
  const sub=await stripeGet('subscriptions/'+encodeURIComponent(typeof subId==='string'?subId:subId.id));
  const accountId=sub.metadata?.account_id,plan=plans().find(p=>p.id===sub.metadata?.plan);
  if(!accountId||!plan||!get(accountId))throw Object.assign(Error('Subscription is missing its plan'),{status:400});
  const periodEnd=sub.current_period_end||sub.items?.data?.[0]?.current_period_end;
  setPlan(accountId,{plan:plan.id,plan_status:sub.status,subscription_id:sub.id,stripe_customer:sub.customer||null,plan_renews_at:periodEnd?new Date(periodEnd*1000).toISOString():null});
  const result=grant(accountId,plan.credits,plan.name+' plan credits','invoice:'+invoice.id);
  return{credited:!result.duplicate,credits:plan.credits};
 }
 if(event.type==='customer.subscription.updated'||event.type==='customer.subscription.deleted'){
  if(!/^sub_[A-Za-z0-9_]+$/.test(obj.id||''))throw Object.assign(Error('Missing subscription'),{status:400});
  const sub=await stripeGet('subscriptions/'+encodeURIComponent(obj.id));
  const row=database().prepare('SELECT id FROM accounts WHERE subscription_id=?').get(sub.id)||(sub.metadata?.account_id&&get(sub.metadata.account_id));
  if(!row)return{ignored:'unknown subscription'};
  const ended=['canceled','incomplete_expired','unpaid'].includes(sub.status);
  setPlan(row.id,{plan_status:sub.status,...(ended?{plan:null,subscription_id:null}:{plan:sub.metadata?.plan||null})});
  return{updated:row.id,status:sub.status};
 }
 return{ignored:event.type};
}

function email(id){return get(id)?.email||null}
// ---------- email verification, password reset, Google ----------
function issueToken(accountId,kind,ttlMs){
 const token=crypto.randomBytes(24).toString('base64url'),d=database();
 d.prepare('DELETE FROM account_tokens WHERE account_id=? AND kind=?').run(accountId,kind);
 d.prepare('INSERT INTO account_tokens(token_hash,account_id,kind,expires_at) VALUES(?,?,?,?)').run(hashToken(token),accountId,kind,Date.now()+ttlMs);
 return token;
}
function consumeToken(token,kind){
 const d=database(),row=d.prepare('SELECT * FROM account_tokens WHERE token_hash=? AND kind=?').get(hashToken(String(token||'')),kind);
 if(!row||row.expires_at<Date.now())throw Object.assign(Error(kind==='reset'?'This reset link has expired. Ask for a new one.':'This link has expired.'),{status:400});
 d.prepare('DELETE FROM account_tokens WHERE token_hash=?').run(row.token_hash);
 return row.account_id;
}
async function mail(to,subject,text){await require('./react-backend-extras').deliver(to,subject,text)}
function mailReady(){return Boolean(process.env.KAIROQ_RESEND_API_KEY&&process.env.KAIROQ_EMAIL_FROM)}
async function sendVerification(accountId,origin){
 const a=get(accountId);if(!a||a.email_verified||!mailReady())return{sent:false};
 const token=issueToken(accountId,'verify',3*86400000);
 await mail(a.email,'Confirm your email for Kairoq Create','Confirm your email address:\n\n'+origin+'/create?verify='+encodeURIComponent(token)+'\n\nThe link works for 3 days.');
 return{sent:true};
}
function verifyEmail(token){const id=consumeToken(token,'verify');database().prepare('UPDATE accounts SET email_verified=1 WHERE id=?').run(id);return publicAccount(get(id))}
// Always succeeds, so it never reveals whether an email has an account.
async function requestReset(email,origin){
 let e;try{e=normalizeEmail(email)}catch{return{sent:true}}
 const a=database().prepare('SELECT * FROM accounts WHERE email=?').get(e);
 if(a&&mailReady()){const token=issueToken(a.id,'reset',3600000);await mail(a.email,'Reset your Kairoq Create password','Choose a new password:\n\n'+origin+'/create?reset='+encodeURIComponent(token)+'\n\nThe link works for one hour. If you did not ask for this, ignore this email.').catch(()=>{})}
 return{sent:true};
}
function resetPassword(token,password){
 if(String(password||'').length<8)throw Object.assign(Error('Use a password with at least 8 characters'),{status:400});
 const id=consumeToken(token,'reset'),d=database();
 d.prepare('UPDATE accounts SET password=?,email_verified=1 WHERE id=?').run(hashPassword(password),id);
 d.prepare('DELETE FROM sessions WHERE account_id=?').run(id);
 return startSession(id);
}
// Google sign-in: links to an existing account with the same verified email, or creates one.
function googleLogin({sub,email,email_verified}){
 if(!sub||!email||email_verified===false)throw Object.assign(Error('Google did not confirm this email address'),{status:400});
 const d=database(),e=normalizeEmail(email);
 let a=d.prepare('SELECT * FROM accounts WHERE google_sub=?').get(String(sub))||d.prepare('SELECT * FROM accounts WHERE email=?').get(e);
 if(a){d.prepare('UPDATE accounts SET google_sub=?,email_verified=1 WHERE id=?').run(String(sub),a.id);return startSession(a.id)}
 if(process.env.KAIROQ_BUILDER_SIGNUPS==='closed')throw Object.assign(Error('Sign-ups are closed'),{status:403});
 const id=crypto.randomUUID(),at=new Date().toISOString(),credits=freeCredits();
 d.prepare('INSERT INTO accounts(id,email,password,credits,created_at,email_verified,google_sub) VALUES(?,?,?,?,?,1,?)').run(id,e,'google$'+crypto.randomBytes(16).toString('hex'),credits,at,String(sub));
 if(credits)d.prepare('INSERT INTO ledger(id,account_id,delta,reason,ref,at) VALUES(?,?,?,?,?,?)').run(crypto.randomUUID(),id,credits,'Free credits',null,at);
 return startSession(id);
}
module.exports={sendVerification,verifyEmail,requestReset,resetPassword,googleLogin,mailReady,plans,subscribe,billingPortal,stripeReady,email,signup,login,logout,fromRequest,cookie,charge,grant,history,packs,stripeConfigured,checkout,stripeWebhook,verifyStripeSignature,freeCredits,database,COOKIE};

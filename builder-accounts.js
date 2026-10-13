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
function publicAccount(a){return a&&{id:a.id,email:a.email,credits:a.credits,created_at:a.created_at}}

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
async function stripeWebhook(raw,signature,{fetchSession=id=>stripe('checkout/sessions/'+encodeURIComponent(id))}={}){
 verifyStripeSignature(raw,signature,process.env.KAIROQ_STRIPE_WEBHOOK_SECRET);
 const event=JSON.parse(raw);
 if(event.type!=='checkout.session.completed'&&event.type!=='checkout.session.async_payment_succeeded')return{ignored:event.type};
 const id=event.data?.object?.id;
 if(typeof id!=='string'||!/^cs_[A-Za-z0-9_]+$/.test(id))throw Object.assign(Error('Missing checkout session'),{status:400});
 const session=await fetchSession(id);
 if(session.payment_status!=='paid')return{pending:id};
 const pack=packs().find(p=>p.id===session.metadata?.pack);
 const accountId=session.metadata?.account_id||session.client_reference_id;
 if(!pack||!accountId)throw Object.assign(Error('Checkout session is missing its credit pack'),{status:400});
 const result=grant(accountId,pack.credits,'Bought '+pack.name,'stripe:'+id);
 return{credited:!result.duplicate,credits:pack.credits};
}

module.exports={signup,login,logout,fromRequest,cookie,charge,grant,history,packs,stripeConfigured,checkout,stripeWebhook,verifyStripeSignature,freeCredits,database,COOKIE};

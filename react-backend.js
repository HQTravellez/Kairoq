"use strict";
// Built-in backend for Create projects: end-user accounts and JSON record
// collections in a per-project SQLite database. Generated apps call it through
// the virtual "kairoq" module, with bearer tokens (no cookies) so it works from
// sandboxed previews, /sites/ pages and custom domains alike.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {DatabaseSync}=require('node:sqlite');
const builder=require('./react-builder');

const ACCESS=['private','shared','public-read','public','submit-only'];
const MAX_RECORD_BYTES=20000,MAX_RECORDS=10000,MAX_USERS=10000,LIST_LIMIT=200,SESSION_DAYS=30;
const dbs=new Map();

// ---------- schema ----------
function parseConfig(files){
 const raw=files['src/backend.json'];
 if(raw===undefined)return{collections:{}};
 let cfg;try{cfg=JSON.parse(raw)}catch(e){throw Error('src/backend.json is not valid JSON: '+e.message)}
 return normalizeConfig(cfg);
}
function normalizeConfig(cfg){
 if(!cfg||typeof cfg!=='object'||Array.isArray(cfg))throw Error('src/backend.json must be an object like {"collections":{"tasks":{"access":"private"}}}');
 const collections={};
 for(const [name,def] of Object.entries(cfg.collections||{})){
  if(!/^[a-z][a-z0-9_]{0,39}$/.test(name))throw Error('Collection name "'+name+'" must be lowercase letters, numbers or _ (max 40).');
  const access=typeof def==='string'?def:def&&def.access;
  if(!ACCESS.includes(access))throw Error('Collection "'+name+'" needs "access": one of '+ACCESS.join(', ')+'.');
  collections[name]={access};
 }
 if(Object.keys(collections).length>30)throw Error('src/backend.json can declare up to 30 collections.');
 return{collections,...require('./react-backend-extras').normalizeExtras(cfg,collections)};
}
function configErrors(files){try{parseConfig(files);return[]}catch(e){return[e.message]}}

// ---------- storage ----------
function database(id){
 const file=path.join(builder.projectDir(id),'data.sqlite');
 if(dbs.has(file))return dbs.get(file);
 const db=new DatabaseSync(file);
 db.exec(`PRAGMA journal_mode=WAL;
  CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,name TEXT,created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY,collection TEXT NOT NULL,owner_id TEXT,data TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS records_collection ON records(collection,created_at);
  CREATE TABLE IF NOT EXISTS app_tokens(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires_at INTEGER NOT NULL);`);
 try{db.exec('ALTER TABLE users ADD COLUMN google_sub TEXT')}catch{}
 require('./react-backend-extras').migrate(db);
 dbs.set(file,db);
 return db;
}
function close(id){const file=path.join(builder.projectDir(id),'data.sqlite');const db=dbs.get(file);if(db){db.close();dbs.delete(file)}}

function hash(t){return crypto.createHash('sha256').update(String(t)).digest('hex')}
function hashPassword(p,salt=crypto.randomBytes(16).toString('hex')){return'scrypt$'+salt+'$'+crypto.scryptSync(String(p),salt,32).toString('hex')}
function checkPassword(p,stored){const [,salt,hex]=String(stored).split('$');if(!salt||!hex)return false;const a=Buffer.from(hex,'hex'),b=crypto.scryptSync(String(p),salt,32);return a.length===b.length&&crypto.timingSafeEqual(a,b)}
function fail(status,message){return Object.assign(Error(message),{status})}
function publicUser(u){return u&&{id:u.id,email:u.email,name:u.name||null,created_at:u.created_at}}
function record(r){return{id:r.id,...JSON.parse(r.data),_owner:r.owner_id,_created_at:r.created_at,_updated_at:r.updated_at}}

// ---------- auth ----------
function signUp(db,{email,password,name}){
 const e=String(email||'').trim().toLowerCase();
 if(e.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))throw fail(400,'Enter a valid email address');
 if(String(password||'').length<8)throw fail(400,'Use a password with at least 8 characters');
 if(db.prepare('SELECT id FROM users WHERE email=?').get(e))throw fail(409,'An account with that email already exists');
 if(db.prepare('SELECT COUNT(*) n FROM users').get().n>=MAX_USERS)throw fail(403,'This app has reached its user limit');
 const id=crypto.randomUUID();
 db.prepare('INSERT INTO users(id,email,password,name,created_at) VALUES(?,?,?,?,?)').run(id,e,hashPassword(password),name?String(name).slice(0,120):null,new Date().toISOString());
 return session(db,id);
}
function signIn(db,{email,password}){
 const u=db.prepare('SELECT * FROM users WHERE email=?').get(String(email||'').trim().toLowerCase());
 if(!u||!checkPassword(password,u.password))throw fail(401,'Email or password is incorrect');
 return session(db,u.id);
}
function session(db,userId){
 const token=crypto.randomBytes(32).toString('base64url');
 db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(hash(token),userId,Date.now()+SESSION_DAYS*86400000);
 return{token,user:publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(userId))};
}
// Google sign-in for app users: matches by Google id, then by verified email, else creates the user.
function googleAppSignIn(id,profile){
 const db=database(id),e=String(profile.email).toLowerCase();
 let u=db.prepare('SELECT * FROM users WHERE google_sub=?').get(profile.sub)||db.prepare('SELECT * FROM users WHERE email=?').get(e);
 if(u)db.prepare('UPDATE users SET google_sub=? WHERE id=?').run(profile.sub,u.id);
 else{
  if(db.prepare('SELECT COUNT(*) n FROM users').get().n>=MAX_USERS)throw fail(403,'This app has reached its user limit');
  const uid=crypto.randomUUID();
  db.prepare('INSERT INTO users(id,email,password,name,created_at,google_sub) VALUES(?,?,?,?,?,?)').run(uid,e,'google$'+crypto.randomBytes(16).toString('hex'),profile.name||null,new Date().toISOString(),profile.sub);
  u={id:uid};
 }
 return session(db,u.id);
}
function currentUser(db,req){
 const m=/^Bearer ([A-Za-z0-9_-]{20,100})$/.exec(String(req.headers.authorization||''));
 if(!m)return null;
 const s=db.prepare('SELECT * FROM sessions WHERE token_hash=?').get(hash(m[1]));
 if(!s||s.expires_at<Date.now())return null;
 return db.prepare('SELECT * FROM users WHERE id=?').get(s.user_id)||null;
}

// ---------- records ----------
function canRead(access,user){if(access==='submit-only')return false;return access==='public'||access==='public-read'||!!user}
function canCreate(access,user){return access==='public'||access==='submit-only'||!!user}
function visibleWhere(access,user){return access==='private'?{sql:' AND owner_id=?',args:[user.id]}:{sql:'',args:[]}}
function cleanData(data){
 if(!data||typeof data!=='object'||Array.isArray(data))throw fail(400,'Record data must be an object');
 const out={};for(const [k,v] of Object.entries(data))if(!k.startsWith('_')&&k!=='id')out[k]=v;
 const text=JSON.stringify(out);
 if(Buffer.byteLength(text)>MAX_RECORD_BYTES)throw fail(413,'Record is larger than 20 KB');
 return text;
}
function list(db,access,collection,user,query){
 if(access==='submit-only')throw fail(403,'Entries in this collection are private to the app owner');
 if(!canRead(access,user))throw fail(401,'Sign in to view these records');
 const v=visibleWhere(access,user);
 if(query.mine==='true'){if(!user)throw fail(401,'Sign in first');v.sql+=' AND owner_id=?';v.args.push(user.id)}
 const limit=Math.max(1,Math.min(LIST_LIMIT,Number(query.limit)||100));
 const order=query.order==='asc'?'ASC':'DESC';
 const rows=db.prepare('SELECT * FROM records WHERE collection=?'+v.sql+' ORDER BY created_at '+order+' LIMIT ?').all(collection,...v.args,query.where?MAX_RECORDS:limit);
 let items=rows.map(record);
 if(query.where){let where;try{where=JSON.parse(query.where)}catch{throw fail(400,'where must be JSON')}
  if(!where||typeof where!=='object'||Array.isArray(where))throw fail(400,'where must be an object of field values');
  items=items.filter(it=>Object.entries(where).every(([k,val])=>JSON.stringify(it[k])===JSON.stringify(val))).slice(0,limit)}
 return items;
}
function getOne(db,access,collection,user,id){
 if(access==='submit-only')throw fail(403,'Entries in this collection are private to the app owner');
 if(!canRead(access,user))throw fail(401,'Sign in to view this record');
 const r=db.prepare('SELECT * FROM records WHERE id=? AND collection=?').get(id,collection);
 if(!r||(access==='private'&&r.owner_id!==user.id))throw fail(404,'Record not found');
 return record(r);
}
function create(db,access,collection,user,data){
 if(!canCreate(access,user))throw fail(401,'Sign in to add records');
 if(db.prepare('SELECT COUNT(*) n FROM records WHERE collection=?').get(collection).n>=MAX_RECORDS)throw fail(403,'This collection is full');
 const id=crypto.randomUUID(),at=new Date().toISOString();
 db.prepare('INSERT INTO records(id,collection,owner_id,data,created_at,updated_at) VALUES(?,?,?,?,?,?)').run(id,collection,user?user.id:null,cleanData(data),at,at);
 const created=record(db.prepare('SELECT * FROM records WHERE id=?').get(id));
 publish(db.__projectId,collection,'created',created,user?user.id:null);
 return created;
}
function ownRecord(db,collection,user,id){
 if(!user)throw fail(401,'Sign in first');
 const r=db.prepare('SELECT * FROM records WHERE id=? AND collection=?').get(id,collection);
 if(!r)throw fail(404,'Record not found');
 if(r.owner_id!==user.id)throw fail(403,'You can only change your own records');
 return r;
}
function update(db,collection,user,id,data){
 const r=ownRecord(db,collection,user,id);
 const merged={...JSON.parse(r.data),...JSON.parse(cleanData(data))};
 db.prepare('UPDATE records SET data=?,updated_at=? WHERE id=?').run(cleanData(merged),new Date().toISOString(),id);
 const updated=record(db.prepare('SELECT * FROM records WHERE id=?').get(id));
 publish(db.__projectId,collection,'updated',updated,r.owner_id);
 return updated;
}
function remove(db,collection,user,id){const r=ownRecord(db,collection,user,id);db.prepare('DELETE FROM records WHERE id=?').run(id);publish(db.__projectId,collection,'deleted',{id},r.owner_id);return{deleted:id}}

// ---------- HTTP: /api/apps/<id>/... ----------
const hits=new Map();
function limited(req,id){
 if(hits.size>20000)hits.clear();
 const key=id+':'+require('./client-ip').clientIp(req),now=Date.now();
 const list=(hits.get(key)||[]).filter(t=>now-t<60000);list.push(now);hits.set(key,list);
 if(list.length>240)throw fail(429,'Too many requests. Slow down and try again.');
}
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Authorization, Content-Type, X-Kairoq-Version','Access-Control-Allow-Methods':'GET, POST, PUT, PATCH, DELETE, OPTIONS','Access-Control-Max-Age':'600'};
const aiHits=new Map();
function limitedAi(req,id){
 if(aiHits.size>20000)aiHits.clear();
 const key=id+':'+require('./client-ip').clientIp(req),now=Date.now(),list=(aiHits.get(key)||[]).filter(t=>now-t<60000);list.push(now);aiHits.set(key,list);
 if(list.length>Number(process.env.KAIROQ_APP_AI_PER_MINUTE||20))throw fail(429,'Too many AI requests. Wait a moment.');
}
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...CORS});res.end(status===204?undefined:JSON.stringify(data))}
function readJson(req,limit=40000){return new Promise((resolve,reject)=>{let b='';req.on('data',c=>{b+=c;if(b.length>limit){reject(fail(413,'Request too large'));req.destroy()}});req.on('end',()=>{try{resolve(b?JSON.parse(b):{})}catch{reject(fail(400,'Invalid JSON'))}});req.on('error',reject)})}
// Config comes from the version that is live: the published one when set, otherwise the current draft.
function liveConfig(meta){const n=meta.published?.version||meta.current_version;return n?parseConfig(builder.loadFiles(meta.id,n)):{collections:{}}}
// Builds send X-Kairoq-Version so the preview of the draft runs the draft's functions and
// rules while the published site runs the published ones. Only those two versions are served.
function requestVersion(meta,req){
 const v=Number(req.headers['x-kairoq-version']);
 if(Number.isInteger(v)&&(v===meta.current_version||v===meta.published?.version||v===builder.testingVersion(meta.id)))return v;
 return meta.published?.version||meta.current_version;
}
let appAiImpl=null;
function configure({appAi}={}){if(appAi!==undefined)appAiImpl=appAi}
// AI for generated apps, billed to the app owner: one credit per KAIROQ_APP_AI_CALLS_PER_CREDIT calls.
async function appAi(meta,db,args){
 if(!appAiImpl)throw fail(503,'AI is not available on this server');
 const messages=Array.isArray(args&&args.messages)?args.messages:[{role:'user',content:String(args&&args.prompt||'')}];
 if(!messages.length||messages.length>40)throw fail(400,'Send 1 to 40 messages');
 const clean=messages.map(m=>({role:m&&m.role==='assistant'?'assistant':'user',content:String(m&&m.content||'').slice(0,20000)}));
 if(!clean.some(m=>m.content.trim()))throw fail(400,'Messages are empty');
 const system=String(args&&args.system||'').slice(0,8000);
 const maxTokens=Math.max(64,Math.min(4000,Number(args&&args.max_tokens)||1000));
 db.exec('CREATE TABLE IF NOT EXISTS app_ai_usage(day TEXT PRIMARY KEY,calls INTEGER NOT NULL)');
 const accounts=require('./builder-accounts');
 if(meta.owner!=='owner'){const owner=accounts.database().prepare('SELECT credits FROM accounts WHERE id=?').get(meta.owner);if(!owner||owner.credits<1)throw fail(402,'This app is out of AI credits')}
 const out=await appAiImpl({system,messages:clean,maxTokens});
 const day=new Date().toISOString().slice(0,10);
 db.prepare('INSERT INTO app_ai_usage(day,calls) VALUES(?,1) ON CONFLICT(day) DO UPDATE SET calls=calls+1').run(day);
 const per=Math.max(1,Number(process.env.KAIROQ_APP_AI_CALLS_PER_CREDIT||10));
 const total=db.prepare('SELECT SUM(calls) n FROM app_ai_usage').get().n;
 if(meta.owner!=='owner'&&total%per===0)try{accounts.charge(meta.owner,1,'AI used by '+meta.name)}catch{}
 return{text:String(out&&out.text||'')};
}
// Service-level data access for server functions (they run as the app, not as a visitor).
function functionDb(db,cfg,op,a,user){
 const name=String(a&&a.collection||'');
 if(!cfg.collections[name])throw fail(404,'Collection "'+name+'" is not declared in src/backend.json');
 const row=id=>{const r=db.prepare('SELECT * FROM records WHERE id=? AND collection=?').get(String(id),name);if(!r)throw fail(404,'Record not found');return r};
 if(op==='list'){
  const limit=Math.max(1,Math.min(LIST_LIMIT,Number(a.limit)||100)),order=a.order==='asc'?'ASC':'DESC';
  let items=db.prepare('SELECT * FROM records WHERE collection=? ORDER BY created_at '+order+' LIMIT ?').all(name,a.where?MAX_RECORDS:limit).map(record);
  if(a.where&&typeof a.where==='object')items=items.filter(it=>Object.entries(a.where).every(([k,v])=>JSON.stringify(it[k])===JSON.stringify(v))).slice(0,limit);
  return items;
 }
 if(op==='get')return record(row(a.id));
 if(op==='create'){
  if(db.prepare('SELECT COUNT(*) n FROM records WHERE collection=?').get(name).n>=MAX_RECORDS)throw fail(403,'This collection is full');
  const rid=crypto.randomUUID(),at=new Date().toISOString();
  db.prepare('INSERT INTO records(id,collection,owner_id,data,created_at,updated_at) VALUES(?,?,?,?,?,?)').run(rid,name,user?user.id:null,cleanData(a.data),at,at);
  const created=record(row(rid));publish(db.__projectId,name,'created',created,user?user.id:null);return created;
 }
 if(op==='update'){
  const r=row(a.id),merged={...JSON.parse(r.data),...JSON.parse(cleanData(a.data))};
  db.prepare('UPDATE records SET data=?,updated_at=? WHERE id=?').run(cleanData(merged),new Date().toISOString(),r.id);
  const updated=record(row(r.id));publish(db.__projectId,name,'updated',updated,r.owner_id);return updated;
 }
 if(op==='remove'){const r=row(a.id);db.prepare('DELETE FROM records WHERE id=?').run(r.id);publish(db.__projectId,name,'deleted',{id:r.id},r.owner_id);return{deleted:r.id}}
 throw fail(400,'Unknown database operation');
}
// ---------- real-time ----------
// Subscribers receive created/updated/deleted events for one collection over Server-Sent
// Events, filtered by the collection's read access. Single-server, in-memory fan-out.
const channels=new Map(),tickets=new Map();
function visibleTo(sub,ownerId){
 if(sub.access==='submit-only')return false;
 if(sub.access==='private')return Boolean(sub.userId)&&sub.userId===ownerId;
 if(sub.access==='shared')return Boolean(sub.userId);
 return true;
}
function publish(projectId,collection,type,item,ownerId){
 if(!projectId)return;
 const subs=channels.get(projectId+':'+collection);if(!subs)return;
 const line='event: '+type+'\ndata: '+JSON.stringify({type,item})+'\n\n';
 for(const sub of subs)if(visibleTo(sub,ownerId))try{sub.res.write(line)}catch{}
}
function issueTicket(projectId,collection,access,user){
 if(!canRead(access,user)&&access!=='submit-only')throw fail(401,'Sign in to follow these records');
 if(access==='submit-only')throw fail(403,'Entries in this collection are private to the app owner');
 if(tickets.size>20000)tickets.clear();
 const t=crypto.randomBytes(18).toString('base64url');
 tickets.set(t,{projectId,collection,access,userId:user?user.id:null,expires:Date.now()+60000});
 return t;
}
function subscribe(req,res,projectId,collection,ticket){
 const entry=tickets.get(String(ticket||''));tickets.delete(String(ticket||''));
 if(!entry||entry.expires<Date.now()||entry.projectId!==projectId||entry.collection!==collection)throw fail(401,'Subscription expired');
 const key=projectId+':'+collection,subs=channels.get(key)||new Set();
 let total=0;for(const [k,set] of channels)if(k.startsWith(projectId+':'))total+=set.size;
 if(total>=Number(process.env.KAIROQ_REALTIME_MAX_PER_APP||500))throw fail(503,'Too many live connections for this app');
 res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store','Connection':'keep-alive','X-Accel-Buffering':'no',...CORS});
 res.write(': connected\n\n');
 const sub={res,access:entry.access,userId:entry.userId};
 subs.add(sub);channels.set(key,subs);
 const ping=setInterval(()=>{try{res.write(': ping\n\n')}catch{}},25000);
 req.on('close',()=>{clearInterval(ping);subs.delete(sub);if(!subs.size)channels.delete(key)});
}
async function handle(req,res,{onlyProject}={}){
 const u=new URL(String(req.url||'/'),'http://x');
 const m=/^\/api\/apps\/([a-f0-9]{12})(\/.*)$/.exec(u.pathname);
 if(!m)return false;
 const id=m[1],route=m[2];
 if(onlyProject&&onlyProject!==id)return false;
 try{
  if(req.method==='OPTIONS')return send(res,204),true;
  limited(req,id);
  let meta;try{meta=builder.loadMeta(id)}catch{throw fail(404,'App not found')}
  const db=database(id),user=currentUser(db,req);db.__projectId=id;
  const version=requestVersion(meta,req);
  if(route==='/auth/signup'&&req.method==='POST')return send(res,201,signUp(db,await readJson(req))),true;
  if(route==='/auth/signin'&&req.method==='POST')return send(res,200,signIn(db,await readJson(req))),true;
  if(route==='/auth/signout'&&req.method==='POST'){const t=/^Bearer (.+)$/.exec(String(req.headers.authorization||''));if(t)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(t[1]));return send(res,200,{ok:true}),true}
  if(route==='/auth/user'&&req.method==='GET')return send(res,200,{user:publicUser(user)}),true;
  if(route==='/auth/google/start'&&req.method==='GET'){
   const back=require('./react-backend-extras').allowedReturn(u.searchParams.get('return'),req,meta);
   const url=require('./google-oauth').startUrl({kind:'app',appId:id,returnUrl:back.toString()},'http://'+String(req.headers.host||'localhost'));
   res.writeHead(302,{Location:url,'Cache-Control':'no-store'});res.end();return true;
  }
  if(route==='/auth/google/exchange'&&req.method==='POST')return send(res,200,require('./google-oauth').redeemAppCode(id,(await readJson(req,2000)).code)),true;
  if(route==='/auth/reset/request'&&req.method==='POST'){
   const b=await readJson(req,4000),back=require('./react-backend-extras').allowedReturn(b.return_url,req,meta);
   const e=String(b.email||'').trim().toLowerCase(),found=db.prepare('SELECT * FROM users WHERE email=?').get(e);
   if(found&&process.env.KAIROQ_RESEND_API_KEY&&process.env.KAIROQ_EMAIL_FROM){
    const token=crypto.randomBytes(24).toString('base64url');
    db.prepare('DELETE FROM app_tokens WHERE user_id=?').run(found.id);
    db.prepare('INSERT INTO app_tokens(token_hash,user_id,expires_at) VALUES(?,?,?)').run(hash(token),found.id,Date.now()+3600000);
    back.hash='kairoq_reset='+token;
    await require('./react-backend-extras').deliver(found.email,'Reset your '+meta.name+' password','Choose a new password:\n\n'+back.toString()+'\n\nThe link works for one hour. If you did not ask for this, ignore this email.').catch(()=>{});
   }
   return send(res,200,{sent:true}),true;
  }
  if(route==='/auth/reset/complete'&&req.method==='POST'){
   const b=await readJson(req,4000);
   if(String(b.password||'').length<8)throw fail(400,'Use a password with at least 8 characters');
   const row=db.prepare('SELECT * FROM app_tokens WHERE token_hash=?').get(hash(String(b.token||'')));
   if(!row||row.expires_at<Date.now())throw fail(400,'This reset link has expired. Ask for a new one.');
   db.prepare('DELETE FROM app_tokens WHERE token_hash=?').run(row.token_hash);
   db.prepare('UPDATE users SET password=? WHERE id=?').run(hashPassword(b.password),row.user_id);
   db.prepare('DELETE FROM sessions WHERE user_id=?').run(row.user_id);
   return send(res,200,session(db,row.user_id)),true;
  }
  const extras=require('./react-backend-extras'),q0=Object.fromEntries(u.searchParams);
  if(route==='/payments/webhook'&&req.method==='POST')return send(res,200,await extras.paymentWebhook(req,{id,meta,db})),true;
  const cfg=version?parseConfig(builder.loadFiles(id,version)):{collections:{}};
  const fnm=/^\/functions\/([a-z][a-z0-9-]{0,39})$/.exec(route);
  if(fnm){
   const files=version?builder.loadFiles(id,version):{},source=files['functions/'+fnm[1]+'.js'];
   if(!source)throw fail(404,'Function "'+fnm[1]+'" does not exist');
   const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>1024*1024)throw fail(413,'Request too large');chunks.push(c)}
   const rawBody=Buffer.concat(chunks).toString('utf8');
   let body=rawBody;if(/json/i.test(String(req.headers['content-type']||''))&&rawBody)try{body=JSON.parse(rawBody)}catch{throw fail(400,'Invalid JSON')}
   const headers={};for(const [k,v] of Object.entries(req.headers))if(!/^(cookie|authorization|x-forwarded-|x-real-ip|forwarded)/i.test(k))headers[k]=String(v).slice(0,2000);
   const host={
    secret:async name=>require('./project-secrets').get(id,'app_'+String(name).toLowerCase().replace(/[^a-z0-9_]/g,'_').slice(0,50)),
    db:async(op,a,u)=>functionDb(db,cfg,op,a,u),
    ai:async a=>{if(!cfg.ai)throw fail(404,'AI is not enabled. Add "ai": true to src/backend.json.');return appAi(meta,db,a)},
    sql:(q,p)=>require('./react-sql').run.query(builder.projectDir(id),q,p),
    sqlBatch:steps=>require('./react-sql').run.batch(builder.projectDir(id),steps),
    email:async(a,u)=>extras.sendEmail(a,{meta,db,cfg,user:u?db.prepare('SELECT * FROM users WHERE id=?').get(u.id):null})
   };
   const applog=require('./react-logs');
   let out;
   try{out=await require('./react-functions').invoke({source,request:{method:req.method,path:route,query:q0,headers,body,rawBody},user:publicUser(user),host})}
   catch(e){applog.add(id,{level:'error',source:'functions/'+fnm[1]+'.js',message:req.method+' '+route+': '+(e.message||e)});throw e}
   for(const line of out.logs||[])applog.add(id,{level:'log',source:'functions/'+fnm[1]+'.js',message:line});
   require('./react-functions').respond(res,out.result,CORS);
   return true;
  }
  if(route==='/ai'&&req.method==='POST'){
   if(!cfg.ai)throw fail(404,'AI is not enabled. Add "ai": true to src/backend.json.');
   limitedAi(req,id);
   return send(res,200,await appAi(meta,db,await readJson(req,200000))),true;
  }
  if(route==='/files'&&req.method==='POST')return send(res,201,{file:await extras.upload(req,{id,db,cfg,user,query:q0})}),true;
  const fm=/^\/files\/([a-f0-9-]{36})$/.exec(route);
  if(fm&&req.method==='GET'){extras.serveFile(res,{id,db,fid:fm[1]});return true}
  if(fm&&req.method==='DELETE')return send(res,200,extras.removeFile({id,db,user,fid:fm[1]})),true;
  if(route==='/email'&&req.method==='POST')return send(res,200,await extras.sendEmail(await readJson(req,20000),{meta,db,cfg,user})),true;
  if(route==='/payments/checkout'&&req.method==='POST')return send(res,200,await extras.checkout(await readJson(req),{id,meta,cfg,user,req})),true;
  if(route==='/payments/mine'&&req.method==='GET')return send(res,200,{purchases:extras.myPurchases(db,user)}),true;
  const rt=/^\/realtime\/([a-z][a-z0-9_]{0,39})(\/ticket)?$/.exec(route);
  if(rt){
   const def=cfg.collections[rt[1]];
   if(!def)throw fail(404,'Collection "'+rt[1]+'" is not declared in src/backend.json');
   if(rt[2]&&req.method==='POST')return send(res,200,{ticket:issueTicket(id,rt[1],def.access,user)}),true;
   if(!rt[2]&&req.method==='GET'){subscribe(req,res,id,rt[1],u.searchParams.get('ticket'));return true}
   throw fail(405,'Method not allowed');
  }
  const c=/^\/collections\/([a-z][a-z0-9_]{0,39})(?:\/([a-f0-9-]{36}))?$/.exec(route);
  if(!c)throw fail(404,'Unknown backend route');
  const collection=c[1],rid=c[2],def=cfg.collections[collection];
  if(!def)throw fail(404,'Collection "'+collection+'" is not declared in src/backend.json');
  const q=Object.fromEntries(u.searchParams);
  if(!rid&&req.method==='GET')return send(res,200,{items:list(db,def.access,collection,user,q)}),true;
  if(!rid&&req.method==='POST')return send(res,201,{item:create(db,def.access,collection,user,(await readJson(req)).data)}),true;
  if(rid&&req.method==='GET')return send(res,200,{item:getOne(db,def.access,collection,user,rid)}),true;
  if(rid&&req.method==='PATCH')return send(res,200,{item:update(db,collection,user,rid,(await readJson(req)).data)}),true;
  if(rid&&req.method==='DELETE')return send(res,200,remove(db,collection,user,rid)),true;
  throw fail(405,'Method not allowed');
 }catch(e){
  const status=Number.isInteger(e.status)?e.status:422;
  if(!route.startsWith('/functions/'))require('./react-logs').add(id,{level:status>=500?'error':'warn',source:'backend',message:req.method+' '+route+' → '+status+': '+String(e.message||e)});
  return send(res,status,{error:String(e.message||e)}),true;
 }
}

// ---------- owner view (Create "Data" tab) ----------
function overview(id){
 const meta=builder.loadMeta(id),cfg=liveConfig(meta),db=database(id);
 const counts=Object.fromEntries(db.prepare('SELECT collection,COUNT(*) n FROM records GROUP BY collection').all().map(r=>[r.collection,r.n]));
 return{
  features:{storage:cfg.storage||null,email:!!cfg.email,payments:cfg.payments?Object.keys(cfg.payments.products):[],schedules:(cfg.schedules||[]).map(s=>({...s,...(db.prepare('SELECT last_run,last_result FROM schedule_runs WHERE name=?').get(s.name)||{})}))},
  files:db.prepare('SELECT COUNT(*) n,COALESCE(SUM(size),0) bytes FROM files').get(),
  payments:db.prepare('SELECT p.product,p.mode,p.status,p.amount,p.currency,p.created_at,u.email FROM payments p LEFT JOIN users u ON u.id=p.user_id ORDER BY p.created_at DESC LIMIT 50').all(),
  collections:Object.entries(cfg.collections).map(([name,def])=>({name,access:def.access,count:counts[name]||0})),
  users:db.prepare('SELECT id,email,name,created_at FROM users ORDER BY created_at DESC LIMIT 100').all(),
  user_count:db.prepare('SELECT COUNT(*) n FROM users').get().n
 };
}
function ownerRecords(id,collection){
 if(!/^[a-z][a-z0-9_]{0,39}$/.test(collection))throw fail(400,'Bad collection');
 return database(id).prepare('SELECT * FROM records WHERE collection=? ORDER BY created_at DESC LIMIT 200').all(collection).map(record);
}
function ownerDelete(id,recordId){const d=database(id),row=d.prepare('SELECT collection,owner_id FROM records WHERE id=?').get(String(recordId));if(!row)throw fail(404,'Record not found');d.prepare('DELETE FROM records WHERE id=?').run(String(recordId));publish(id,row.collection,'deleted',{id:String(recordId)},row.owner_id);return{deleted:recordId}}

// ---------- browser client (virtual module "kairoq") ----------
function clientSource(projectId,apiOrigin='',version=0){
 return `const BASE=${JSON.stringify(apiOrigin.replace(/\/$/,'')+'/api/apps/'+projectId)};
const VERSION=${JSON.stringify(String(version||''))};
const KEY='kairoq-session-${projectId}';
let token=null,currentUser=null;const listeners=new Set();
try{const s=JSON.parse(localStorage.getItem(KEY)||'null');if(s){token=s.token;currentUser=s.user}}catch{}
function save(){try{token?localStorage.setItem(KEY,JSON.stringify({token,user:currentUser})):localStorage.removeItem(KEY)}catch{}listeners.forEach(fn=>{try{fn(currentUser)}catch{}})}
async function call(path,{method='GET',body,query}={}){
  const qs=query?'?'+new URLSearchParams(Object.entries(query).filter(([,v])=>v!==undefined).map(([k,v])=>[k,typeof v==='object'?JSON.stringify(v):String(v)])).toString():'';
  const r=await fetch(BASE+path+qs,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{}),...(VERSION?{'X-Kairoq-Version':VERSION}:{})},body:body?JSON.stringify(body):undefined});
  const data=await r.json().catch(()=>({}));
  if(r.status===401&&token&&!path.startsWith('/auth/')){token=null;currentUser=null;save()}
  if(!r.ok)throw Object.assign(new Error(data.error||('Request failed ('+r.status+')')),{status:r.status});
  return data;
}
// One-time codes and reset tokens arrive in the URL fragment (never sent to servers).
let pendingReset=null,pendingCode=null;
try{
  const h=new URLSearchParams(location.hash.slice(1));
  pendingReset=h.get('kairoq_reset');pendingCode=h.get('kairoq_code');
  if(pendingReset||pendingCode){h.delete('kairoq_reset');h.delete('kairoq_code');history.replaceState(null,'',location.pathname+location.search+(h.toString()?'#'+h:''))}
}catch{}
const ready=pendingCode?call('/auth/google/exchange',{method:'POST',body:{code:pendingCode}}).then(d=>{token=d.token;currentUser=d.user;save()}).catch(()=>{}):Promise.resolve();
export const auth={
  ready(){return ready},
  async signInWithGoogle(){
    if(window.top!==window)throw new Error('Google sign-in works on your published app. In the preview, use email sign-in.');
    location.href=BASE+'/auth/google/start?return='+encodeURIComponent(location.href);
  },
  async requestPasswordReset(email){return call('/auth/reset/request',{method:'POST',body:{email,return_url:location.href.split('#')[0]}})},
  resetToken(){return pendingReset},
  async resetPassword(password,tokenValue=pendingReset){const d=await call('/auth/reset/complete',{method:'POST',body:{token:tokenValue,password}});pendingReset=null;token=d.token;currentUser=d.user;save();return d.user},
  user(){return currentUser},
  async signUp(email,password,name){const d=await call('/auth/signup',{method:'POST',body:{email,password,name}});token=d.token;currentUser=d.user;save();return d.user},
  async signIn(email,password){const d=await call('/auth/signin',{method:'POST',body:{email,password}});token=d.token;currentUser=d.user;save();return d.user},
  async signOut(){try{await call('/auth/signout',{method:'POST'})}catch{}token=null;currentUser=null;save()},
  onChange(fn){listeners.add(fn);return()=>listeners.delete(fn)}
};
export function collection(name){
  const p='/collections/'+encodeURIComponent(name);
  return{
    async list(options={}){return(await call(p,{query:{limit:options.limit,order:options.order,mine:options.mine?'true':undefined,where:options.where}})).items},
    async get(id){return(await call(p+'/'+id)).item},
    async create(data){return(await call(p,{method:'POST',body:{data}})).item},
    async update(id,data){return(await call(p+'/'+id,{method:'PATCH',body:{data}})).item},
    async remove(id){await call(p+'/'+id,{method:'DELETE'})},
    // Live updates: callback({type:'created'|'updated'|'deleted', item}). Returns an unsubscribe function.
    subscribe(callback){
      let es=null,stopped=false,timer=null;
      const connect=async()=>{
        if(stopped)return;
        try{
          const {ticket}=await call('/realtime/'+encodeURIComponent(name)+'/ticket',{method:'POST'});
          if(stopped)return;
          es=new EventSource(BASE+'/realtime/'+encodeURIComponent(name)+'?ticket='+encodeURIComponent(ticket));
          for(const type of ['created','updated','deleted'])es.addEventListener(type,e=>{try{callback(JSON.parse(e.data))}catch{}});
          es.onerror=()=>{es.close();es=null;if(!stopped)timer=setTimeout(connect,3000)};
        }catch(err){if(!stopped&&err.status!==403)timer=setTimeout(connect,5000)}
      };
      connect();
      return()=>{stopped=true;clearTimeout(timer);if(es)es.close()};
    }
  };
}
export const storage={
  async upload(file,{name}={}){
    const r=await fetch(BASE+'/files?name='+encodeURIComponent(name||file.name||'file'),{method:'POST',headers:{'Content-Type':file.type||'application/octet-stream',...(token?{Authorization:'Bearer '+token}:{}),...(VERSION?{'X-Kairoq-Version':VERSION}:{})},body:file});
    const d=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(new Error(d.error||'Upload failed'),{status:r.status});
    return{...d.file,url:new URL(d.file.url,BASE.startsWith('http')?BASE:location.href).toString()};
  },
  url(id){return BASE+'/files/'+id},
  async remove(id){await call('/files/'+id,{method:'DELETE'})}
};
export const email={
  async send({to='owner',subject,text}){return call('/email',{method:'POST',body:{to,subject,text}})}
};
export const payments={
  async checkout(product){
    const {url}=await call('/payments/checkout',{method:'POST',body:{product,return_url:location.href}});
    try{if(window.top===window){location.href=url;return}}catch{}
    window.open(url,'_blank','noopener');
  },
  async purchases(){return(await call('/payments/mine')).purchases},
  async has(product){return(await this.purchases()).some(p=>p.product===product&&p.status==='active')}
};
export const functions={
  // Calls functions/<name>.js on the server with a JSON body; returns its JSON (or text) response.
  async invoke(name,body){
    const r=await fetch(BASE+'/functions/'+encodeURIComponent(name),{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(VERSION?{'X-Kairoq-Version':VERSION}:{})},body:JSON.stringify(body===undefined?{}:body)});
    const type=r.headers.get('content-type')||'',data=type.includes('json')?await r.json().catch(()=>null):await r.text();
    if(!r.ok)throw Object.assign(new Error((data&&data.error)||('Function failed ('+r.status+')')),{status:r.status,data});
    return data;
  },
  url(name){return BASE+'/functions/'+encodeURIComponent(name)}
};
export const ai={
  // ai.chat({ messages:[{role:'user',content:'...'}], system, max_tokens }) -> { text }
  async chat(options){return call('/ai',{method:'POST',body:typeof options==='string'?{messages:[{role:'user',content:options}]}:options})}
};
export default{auth,collection,storage,email,payments,functions,ai};
`;
}

// Runs due scheduled jobs for every project (called on a timer by the server).
async function runAllSchedules(options){
 const out=[];
 for(const p of builder.list()){
  try{const meta=builder.loadMeta(p.id),cfg=liveConfig(meta);if(!cfg.schedules||!cfg.schedules.length)continue;
   const r=await require('./react-backend-extras').runSchedules(p.id,cfg,database(p.id),meta,options);if(r.length)out.push({project:p.id,results:r})}catch(e){out.push({project:p.id,error:e.message})}
 }
 return out;
}
module.exports={googleAppSignIn,configure,appAi,runAllSchedules,handle,parseConfig,configErrors,clientSource,overview,ownerRecords,ownerDelete,database,close,ACCESS};

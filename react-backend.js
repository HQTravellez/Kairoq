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
 const collections=Object.create(null);
 for(const [name,def] of Object.entries(cfg.collections||{})){
  if(!/^[a-z][a-z0-9_]{0,39}$/.test(name))throw Error('Collection name "'+name+'" must be lowercase letters, numbers or _ (max 40).');
  const access=typeof def==='string'?def:def&&def.access;
  if(!ACCESS.includes(access))throw Error('Collection "'+name+'" needs "access": one of '+ACCESS.join(', ')+'.');
  collections[name]={access};
 }
 if(Object.keys(collections).length>30)throw Error('src/backend.json can declare up to 30 collections.');
 return{collections,...require('./react-backend-extras').normalizeExtras(cfg,collections)};
}
function configErrors(files){
 try{const cfg=parseConfig(files);for(const a of cfg.automations||[])if(!require('./react-functions').functionFile(files,a.run))throw Error('Automation "'+a.name+'" runs "'+a.run+'", but there is no functions/'+a.run+'.js.');return[]}
 catch(e){return[e.message]}
}

// ---------- storage ----------
function database(id){return openFile(path.join(builder.projectDir(id),'data.sqlite'))}
// With Postgres on (pg-sync.js) each app's data is a schema of its own: app_<project id>, and a
// test copy is sb_<token>. The first open copies an existing data.sqlite across once; the file
// is then left as it was.
function pgSchema(file){
 const rel=path.relative(builder.ROOT(),file).split(path.sep);
 if(rel.length===2&&/^[a-z0-9]{6,40}$/.test(rel[0])&&rel[1]==='data.sqlite')return'app_'+rel[0];
 if(rel.length===4&&rel[1]==='sandboxes'&&/^[a-f0-9]{32}$/.test(rel[2])&&rel[3]==='data.sqlite')return'sb_'+rel[2];
 return null;
}
// The project a data file belongs to, and whether it is the app's own data (not a test copy).
function fileOwner(file){
 const rel=path.relative(builder.ROOT(),file).split(path.sep);
 return/^[a-z0-9]{6,40}$/.test(rel[0]||'')?{id:rel[0],main:rel.length===2&&rel[1]==='data.sqlite'}:null;
}
function openFile(file){
 if(dbs.has(file))return dbs.get(file);
 const pg=require('./pg-sync'),owner=fileOwner(file);
 // An app connected to the owner's own Supabase keeps its data there (app-database.js); its test
 // copies are SQLite files (react-sandbox.js).
 const ext=owner?require('./app-database').connection(owner.id):null;
 const schemaName=!ext&&pg.enabled()?pgSchema(file):null;
 const db=ext&&owner.main?pg.open({schema:ext.schema,url:ext.url,ca:ext.ca}):schemaName?pg.open({schema:pg.schemaName(schemaName)}):new DatabaseSync(file);
 db.exec(`PRAGMA journal_mode=WAL;
  CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,name TEXT,created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY,collection TEXT NOT NULL,owner_id TEXT,data TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS records_collection ON records(collection,created_at);
  CREATE TABLE IF NOT EXISTS app_tokens(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires_at INTEGER NOT NULL);`);
 try{db.exec('ALTER TABLE users ADD COLUMN google_sub TEXT')}catch{}
 require('./react-backend-extras').migrate(db);
 if(schemaName&&schemaName.startsWith('app_')){require('./app-assistant').migrate(db);pg.copyFromSqlite(file,db,{key:'app-data'})}
 else if(ext&&owner.main)require('./app-assistant').migrate(db);
 dbs.set(file,db);
 return db;
}
function hasTable(db,name){
 return db instanceof require('./pg-sync').Database?Boolean(db.prepare('SELECT 1 FROM information_schema.tables WHERE table_schema=current_schema() AND table_name=?').get(name)):Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name));
}
function close(id){closeFile(path.join(builder.projectDir(id),'data.sqlite'))}
function closeFile(file){const db=dbs.get(file);if(db){db.close();dbs.delete(file)}}

function hash(t){return crypto.createHash('sha256').update(String(t)).digest('hex')}
// scrypt runs on the libuv thread pool so sign-ins never block the server.
const scrypt=require('util').promisify(crypto.scrypt);
async function hashPassword(p,salt=crypto.randomBytes(16).toString('hex')){return'scrypt$'+salt+'$'+(await scrypt(String(p),salt,32)).toString('hex')}
async function checkPassword(p,stored){const [,salt,hex]=String(stored).split('$');if(!salt||!hex)return false;const a=Buffer.from(hex,'hex'),b=await scrypt(String(p),salt,32);return a.length===b.length&&crypto.timingSafeEqual(a,b)}
function fail(status,message){return Object.assign(Error(message),{status})}
function publicUser(u){return u&&{id:u.id,email:u.email,name:u.name||null,created_at:u.created_at}}
function record(r){return{id:r.id,...JSON.parse(r.data),_owner:r.owner_id,_created_at:r.created_at,_updated_at:r.updated_at}}

// ---------- auth ----------
async function signUp(db,{email,password,name}){
 const e=String(email||'').trim().toLowerCase();
 if(e.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))throw fail(400,'Enter a valid email address');
 if(String(password||'').length<8)throw fail(400,'Use a password with at least 8 characters');
 if(db.prepare('SELECT id FROM users WHERE email=?').get(e))throw fail(409,'An account with that email already exists');
 if(db.prepare('SELECT COUNT(*) n FROM users').get().n>=MAX_USERS)throw fail(403,'This app has reached its user limit');
 const id=crypto.randomUUID();
 const hashed=await hashPassword(password);
 if(db.prepare('SELECT id FROM users WHERE email=?').get(e))throw fail(409,'An account with that email already exists');
 db.prepare('INSERT INTO users(id,email,password,name,created_at) VALUES(?,?,?,?,?)').run(id,e,hashed,name?String(name).slice(0,120):null,new Date().toISOString());
 return session(db,id);
}
// Failed sign-ins per app and email: 10 per 15 minutes, then a short lockout.
const failures=new Map();
function failedRecently(key){const now=Date.now(),list=(failures.get(key)||[]).filter(t=>now-t<900000);failures.set(key,list);return list}
async function signIn(db,{email,password}){
 const e=String(email||'').trim().toLowerCase(),key=(db.__projectId||'')+':'+e;
 if(failedRecently(key).length>=10)throw fail(429,'Too many failed sign-ins. Try again in 15 minutes or reset your password.');
 const u=db.prepare('SELECT * FROM users WHERE email=?').get(e);
 // Unknown emails still cost one scrypt, so timing does not reveal which accounts exist.
 if(!u){await scrypt(String(password||''),'kairoq-dummy-salt',32)}
 if(!u||!await checkPassword(password,u.password)){failedRecently(key).push(Date.now());if(failures.size>20000)failures.delete(failures.keys().next().value);throw fail(401,'Email or password is incorrect')}
 failures.delete(key);
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
 // App sign-up does not prove email ownership, so when Google first proves it for an existing
 // password account, that password and its sessions are cleared: someone who registered the
 // address earlier cannot keep access. The owner can set a new password with a reset.
 if(u&&!u.google_sub){db.prepare('UPDATE users SET password=? WHERE id=?').run('google$'+crypto.randomBytes(16).toString('hex'),u.id);db.prepare('DELETE FROM sessions WHERE user_id=?').run(u.id)}
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
 publish(db,collection,'created',created,user?user.id:null);
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
 publish(db,collection,'updated',updated,r.owner_id);
 return updated;
}
function remove(db,collection,user,id){const r=ownRecord(db,collection,user,id);db.prepare('DELETE FROM records WHERE id=?').run(id);publish(db,collection,'deleted',{id},r.owner_id);return{deleted:id}}

// ---------- HTTP: /api/apps/<id>/... ----------
const hits=new Map();
function limited(req,id){
 if(hits.size>20000)hits.clear();
 const key=id+':'+require('./client-ip').clientIp(req),now=Date.now();
 const list=(hits.get(key)||[]).filter(t=>now-t<60000);list.push(now);hits.set(key,list);
 if(list.length>240)throw fail(429,'Too many requests. Slow down and try again.');
}
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Authorization, Content-Type, X-Kairoq-Version, X-Kairoq-Preview','Access-Control-Allow-Methods':'GET, POST, PUT, PATCH, DELETE, OPTIONS','Access-Control-Max-Age':'600'};
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
// At most 3 reset emails per app user every 15 minutes.
const resetSends=new Map(),fnRunning=new Map();
function resetThrottled(appId,userId){const k=appId+':'+userId,now=Date.now(),list=(resetSends.get(k)||[]).filter(t=>now-t<900000);if(list.length>=3)return true;list.push(now);resetSends.set(k,list);if(resetSends.size>10000)resetSends.delete(resetSends.keys().next().value);return false}
function requestVersion(meta,req){
 const v=Number(req.headers['x-kairoq-version']);
 if(Number.isInteger(v)&&v===meta.published?.version)return v;
 // Drafts (and a version under test) are only served to the editor's preview, which knows the preview key.
 if(Number.isInteger(v)&&(v===meta.current_version||v===builder.testingVersion(meta.id))){
  const k=Buffer.from(String(req.headers['x-kairoq-preview']||'')),want=Buffer.from(String(meta.preview_key||''));
  if(!meta.published||k.length===want.length&&crypto.timingSafeEqual(k,want))return v;
 }
 return meta.published?.version||meta.current_version;
}
// Streams an AI answer as server-sent events: token {t}, then done {text,sources} or error {error}.
async function streamAnswer(res,run){
 res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store','X-Accel-Buffering':'no',...CORS});
 const ev=(name,data)=>{try{res.write('event: '+name+'\ndata: '+JSON.stringify(data)+'\n\n')}catch{}};
 let sent=false;
 try{
  const out=await run(t=>{if(t){sent=true;ev('token',{t:String(t)})}});
  // A model that could not stream sends the whole answer at once.
  if(!sent&&out.text)ev('token',{t:out.text});
  ev('done',out);
 }catch(e){ev('error',{error:String(e.message||e),status:Number.isInteger(e.status)?e.status:500})}
 res.end();
}
let appAiImpl=null;
function configure({appAi}={}){if(appAi!==undefined)appAiImpl=appAi}
// AI for generated apps, billed to the app owner: one credit per KAIROQ_APP_AI_CALLS_PER_CREDIT calls.
async function appAi(meta,db,args,{onToken}={}){
 if(!appAiImpl)throw fail(503,'AI is not available on this server');
 const messages=Array.isArray(args&&args.messages)?args.messages:[{role:'user',content:String(args&&args.prompt||'')}];
 if(!messages.length||messages.length>40)throw fail(400,'Send 1 to 40 messages');
 const clean=messages.map(m=>({role:m&&m.role==='assistant'?'assistant':'user',content:String(m&&m.content||'').slice(0,20000)}));
 if(!clean.some(m=>m.content.trim()))throw fail(400,'Messages are empty');
 const system=String(args&&args.system||'').slice(0,8000);
 const maxTokens=Math.max(64,Math.min(4000,Number(args&&args.max_tokens)||1000));
 db.exec('CREATE TABLE IF NOT EXISTS app_ai_usage(day TEXT PRIMARY KEY,calls INTEGER NOT NULL)');
 const accounts=require('./builder-accounts');
 const today=db.prepare('SELECT calls FROM app_ai_usage WHERE day=?').get(new Date().toISOString().slice(0,10));
 if(today&&today.calls>=Math.max(1,Number(process.env.KAIROQ_APP_AI_DAILY_LIMIT||2000)))throw fail(429,'This app has reached its daily AI limit');
 if(meta.owner!=='owner'){const owner=accounts.database().prepare('SELECT credits FROM accounts WHERE id=?').get(meta.owner);if(!owner||owner.credits<1)throw fail(402,'This app is out of AI credits')}
 // Images (ai.extract): attached to the last message, for a model that can see them.
 const imgs=Array.isArray(args&&args.images)?args.images.slice(0,4):[];
 if(imgs.length)clean[clean.length-1]={role:'user',content:[{type:'text',text:clean[clean.length-1].content},...imgs.map(url=>({type:'image_url',image_url:{url}}))]};
 const out=await appAiImpl({system,messages:clean,maxTokens,...(onToken?{onToken}:{}),...(imgs.length?{vision:true}:{})});
 const day=new Date().toISOString().slice(0,10);
 db.prepare('INSERT INTO app_ai_usage(day,calls) VALUES(?,1) ON CONFLICT(day) DO UPDATE SET calls=app_ai_usage.calls+1').run(day);
 const per=Math.max(1,Number(process.env.KAIROQ_APP_AI_CALLS_PER_CREDIT||10));
 const total=db.prepare('SELECT SUM(calls) n FROM app_ai_usage').get().n;
 if(meta.owner!=='owner'&&total%per===0)try{accounts.charge(meta.owner,1,'AI used by '+meta.name)}catch{}
 return{text:String(out&&out.text||'')};
}
// Service-level data access for server functions (they run as the app, not as a visitor).
function functionDb(db,cfg,op,a,user){
 const name=String(a&&a.collection||'');
 if(!Object.hasOwn(cfg.collections,name))throw fail(404,'Collection "'+name+'" is not declared in src/backend.json');
 const row=id=>{const r=db.prepare('SELECT * FROM records WHERE id=? AND collection=?').get(String(id),name);if(!r)throw fail(404,'Record not found');return r};
 if(op==='list'){
  const limit=Math.max(1,Math.min(LIST_LIMIT,Number(a.limit)||100)),order=a.order==='asc'?'ASC':'DESC';
  // where filters run in SQL, so a filtered list never loads the whole collection.
  const conds=[],params=[name];
  if(a.where&&typeof a.where==='object')for(const [k,v] of Object.entries(a.where).slice(0,10)){
   if(k==='id'||k==='_owner'){conds.push((k==='id'?'id':'owner_id')+' IS NOT DISTINCT FROM ?');params.push(v==null?null:String(v));continue}
   if(!/^[A-Za-z0-9_-]{1,64}$/.test(k))throw fail(400,'Invalid field name in where: '+String(k).slice(0,64));
   if(db instanceof require('./pg-sync').Database){
    // Postgres: the same tests on jsonb (k is checked above, so it can sit in the query).
    const f="(data::jsonb->'"+k+"')",t='jsonb_typeof'+f;
    if(v===null)conds.push(t+"='null'");
    else if(typeof v==='boolean')conds.push(f+"='"+(v?'true':'false')+"'::jsonb");
    else if(typeof v==='number'){conds.push(t+"='number' AND (data::jsonb->>'"+k+"')::numeric=?::numeric");params.push(v)}
    else if(typeof v==='string'){conds.push(t+"='string' AND data::jsonb->>'"+k+"'=?");params.push(v)}
    else{conds.push(t+" IN ('object','array') AND "+f+"=?::jsonb");params.push(JSON.stringify(v))}
    continue;
   }
   const p="'$.\""+k+"\"'";
   if(v===null)conds.push('json_type(data,'+p+")='null'");
   else if(typeof v==='boolean')conds.push('json_type(data,'+p+")='"+(v?'true':'false')+"'");
   else if(typeof v==='number'){conds.push('json_type(data,'+p+") IN ('integer','real') AND json_extract(data,"+p+')=?');params.push(v)}
   else if(typeof v==='string'){conds.push('json_type(data,'+p+")='text' AND json_extract(data,"+p+')=?');params.push(v)}
   else{conds.push('json_type(data,'+p+") IN ('object','array') AND json_extract(data,"+p+')=?');params.push(JSON.stringify(v))}
  }
  params.push(limit);
  return db.prepare('SELECT * FROM records WHERE collection=?'+conds.map(c=>' AND ('+c+')').join('')+' ORDER BY created_at '+order+' LIMIT ?').all(...params).map(record);
 }
 if(op==='get')return record(row(a.id));
 if(op==='create'){
  if(db.prepare('SELECT COUNT(*) n FROM records WHERE collection=?').get(name).n>=MAX_RECORDS)throw fail(403,'This collection is full');
  const rid=crypto.randomUUID(),at=new Date().toISOString();
  db.prepare('INSERT INTO records(id,collection,owner_id,data,created_at,updated_at) VALUES(?,?,?,?,?,?)').run(rid,name,user?user.id:null,cleanData(a.data),at,at);
  const created=record(row(rid));publish(db,name,'created',created,user?user.id:null);return created;
 }
 if(op==='update'){
  const r=row(a.id),merged={...JSON.parse(r.data),...JSON.parse(cleanData(a.data))};
  db.prepare('UPDATE records SET data=?,updated_at=? WHERE id=?').run(cleanData(merged),new Date().toISOString(),r.id);
  const updated=record(row(r.id));publish(db,name,'updated',updated,r.owner_id);return updated;
 }
 if(op==='remove'){const r=row(a.id);db.prepare('DELETE FROM records WHERE id=?').run(r.id);publish(db,name,'deleted',{id:r.id},r.owner_id);return{deleted:r.id}}
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
function publish(db,collection,type,item,ownerId){
 const projectId=db&&db.__projectId;
 if(!projectId)return;
 // Automations that listen to this collection run after the change (never for changes an automation made).
 try{require('./react-automations').onRecord(db,collection,type,item)}catch{}
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
  // A saved check's requests use a test copy of the data (see react-sandbox.js).
  const sb=req.headers['x-kairoq-sandbox']?require('./react-sandbox').lookup(id,req.headers['x-kairoq-sandbox']):null;
  if(req.headers['x-kairoq-sandbox']&&!sb)throw fail(410,'This test run has ended');
  const db=sb?openFile(path.join(sb.dir,'data.sqlite')):database(id),user=currentUser(db,req);
  db.__projectId=sb?id+'~test':id;if(sb){db.__filesDir=path.join(sb.dir,'files');db.__sandbox=true;db.__sandboxToken=req.headers['x-kairoq-sandbox']}
  const version=requestVersion(meta,req);
  if(route==='/auth/signup'&&req.method==='POST'){const b=await readJson(req),out=await signUp(db,b);if(b.ref)try{require('./app-referrals').claim(db,out.user.id,b.ref)}catch{}return send(res,201,out),true}
  // Invite a friend (app-referrals.js): the user's own code and who joined through it.
  if(route==='/referrals/me'&&req.method==='GET'){if(!user)throw fail(401,'Sign in to see your invite link');return send(res,200,require('./app-referrals').mine(db,user.id)),true}
  if(route==='/referrals/claim'&&req.method==='POST'){if(!user)throw fail(401,'Sign in first');return send(res,200,{claimed:require('./app-referrals').claim(db,user.id,(await readJson(req,1000)).code)}),true}
  if(route==='/auth/signin'&&req.method==='POST')return send(res,200,await signIn(db,await readJson(req))),true;
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
   if(found&&resetThrottled(id,found.id))return send(res,200,{sent:true}),true;
   if(found&&!sb&&process.env.KAIROQ_RESEND_API_KEY&&process.env.KAIROQ_EMAIL_FROM){
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
   db.prepare('UPDATE users SET password=? WHERE id=?').run(await hashPassword(b.password),row.user_id);
   db.prepare('DELETE FROM sessions WHERE user_id=?').run(row.user_id);
   return send(res,200,session(db,row.user_id)),true;
  }
  const extras=require('./react-backend-extras'),q0=Object.fromEntries(u.searchParams);
  if(route==='/payments/webhook'&&req.method==='POST'&&!sb)return send(res,200,await extras.paymentWebhook(req,{id,meta,db})),true;
  const cfg=version?parseConfig(builder.loadFiles(id,version)):{collections:{}};
  const fnm=/^\/functions\/([a-z][a-z0-9-]{0,39})$/.exec(route);
  if(fnm){
   const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>1024*1024)throw fail(413,'Request too large');chunks.push(c)}
   const rawBody=Buffer.concat(chunks).toString('utf8');
   let body=rawBody;if(/json/i.test(String(req.headers['content-type']||''))&&rawBody)try{body=JSON.parse(rawBody)}catch{throw fail(400,'Invalid JSON')}
   const headers={};for(const [k,v] of Object.entries(req.headers))if(!/^(cookie|authorization|x-forwarded-|x-real-ip|forwarded)/i.test(k))headers[k]=String(v).slice(0,2000);
   const out=await runFunction(id,fnm[1],{meta,version,cfg,db,sb,user,req,request:{method:req.method,path:route,query:q0,headers,body,rawBody}});
   require('./react-functions').respond(res,out.result,CORS,{externalRedirects:Boolean(onlyProject)});
   return true;
  }
  if(route==='/ai/feedback'&&req.method==='POST'){
   if(!cfg.ai)throw fail(404,'AI is not enabled. Add "ai": true to src/backend.json.');
   limitedAi(req,id);
   const b=await readJson(req,4000);
   return send(res,200,sb?{ok:true,test:true}:require('./app-assistant').feedback(db,{question:b.question,helpful:b.helpful})),true;
  }
  if(route==='/ai/extract'&&req.method==='POST'){
   if(!cfg.ai)throw fail(404,'AI is not enabled. Add "ai": true to src/backend.json.');
   limitedAi(req,id);
   return send(res,200,await require('./app-extract').extract(await readJson(req,20000000),o=>appAi(meta,db,o))),true;
  }
  if((route==='/ai'||route==='/ai/ask')&&req.method==='POST'){
   if(!cfg.ai)throw fail(404,'AI is not enabled. Add "ai": true to src/backend.json.');
   limitedAi(req,id);
   const b=await readJson(req,200000),run=onToken=>route==='/ai'?appAi(meta,db,b,{onToken}):require('./app-assistant').ask(db,b,(a,o)=>appAi(meta,db,a,o),{onToken});
   if(b.stream!==true)return send(res,200,await run()),true;
   await streamAnswer(res,run);
   return true;
  }
  if(route==='/files'&&req.method==='POST')return send(res,201,{file:await extras.upload(req,{id,db,cfg,user,query:q0})}),true;
  const fm=/^\/files\/([a-f0-9-]{36})$/.exec(route);
  if(fm&&req.method==='GET'){extras.serveFile(res,{id,db,fid:fm[1]});return true}
  if(fm&&req.method==='DELETE')return send(res,200,extras.removeFile({id,db,user,fid:fm[1]})),true;
  // In a test run, emails and payments are not real.
  if(route==='/email'&&req.method==='POST')return send(res,200,sb?{sent:true,test:true}:await extras.sendEmail(await readJson(req,20000),{meta,db,cfg,user})),true;
  if(route==='/payments/checkout'&&req.method==='POST')return send(res,200,sb?{url:'#kairoq-test-checkout',test:true}:await extras.checkout(await readJson(req),{id,meta,cfg,user,req})),true;
  if(route==='/payments/mine'&&req.method==='GET')return send(res,200,{purchases:extras.myPurchases(db,user)}),true;
  const rt=/^\/realtime\/([a-z][a-z0-9_]{0,39})(\/ticket)?$/.exec(route);
  if(rt){
   const def=Object.hasOwn(cfg.collections,rt[1])?cfg.collections[rt[1]]:undefined;
   if(!def)throw fail(404,'Collection "'+rt[1]+'" is not declared in src/backend.json');
   if(rt[2]&&req.method==='POST')return send(res,200,{ticket:issueTicket(id,rt[1],def.access,user)}),true;
   if(!rt[2]&&req.method==='GET'){subscribe(req,res,id,rt[1],u.searchParams.get('ticket'));return true}
   throw fail(405,'Method not allowed');
  }
  const c=/^\/collections\/([a-z][a-z0-9_]{0,39})(?:\/([a-f0-9-]{36}))?$/.exec(route);
  if(!c)throw fail(404,'Unknown backend route');
  const collection=c[1],rid=c[2],def=Object.hasOwn(cfg.collections,collection)?cfg.collections[collection]:undefined;
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

// Runs one of the app's server functions: from its HTTP route, or from an automation
// (automation: true, user null, no request to rate-limit AI by; a function started this way
// cannot start another automation).
async function runFunction(id,name,{meta,version,cfg,db,sb=null,user=null,req=null,request,automation=false}){
 const files=version?builder.loadFiles(id,version):{},fnFile=require('./react-functions').functionFile(files,name),source=fnFile&&require('./react-functions').runnable(fnFile,files[fnFile]);
 if(!source)throw fail(404,'Function "'+name+'" does not exist');
 const extras=require('./react-backend-extras');
 let fdb=db;
 if(automation){fdb=Object.create(db);fdb.prepare=db.prepare.bind(db);fdb.exec=db.exec.bind(db);fdb.__automation=true}
 const host={
  secret:async n=>require('./project-secrets').get(id,'app_'+String(n).toLowerCase().replace(/[^a-z0-9_]/g,'_').slice(0,50)),
  db:async(op,a,u)=>functionDb(fdb,cfg,op,a,u),
  ai:async a=>{if(!cfg.ai)throw fail(404,'AI is not enabled. Add "ai": true to src/backend.json.');if(req)limitedAi(req,id);return appAi(meta,db,a)},
  extract:async a=>{if(!cfg.ai)throw fail(404,'AI is not enabled. Add "ai": true to src/backend.json.');if(req)limitedAi(req,id);return require('./app-extract').extract(a,o=>appAi(meta,db,o))},
  ask:async a=>{if(!cfg.ai)throw fail(404,'AI is not enabled. Add "ai": true to src/backend.json.');if(req)limitedAi(req,id);return require('./app-assistant').ask(db,a,o=>appAi(meta,db,o))},
  sql:(q,p)=>require('./react-sql').run.query(sb?sb.dir:builder.projectDir(id),q,p),
  sqlBatch:steps=>require('./react-sql').run.batch(sb?sb.dir:builder.projectDir(id),steps),
  email:async(a,u)=>sb?{sent:true,test:true}:extras.sendEmail(a,{meta,db,cfg,user:u?db.prepare('SELECT * FROM users WHERE id=?').get(u.id):null})
 };
 const applog=require('./react-logs');
 // Each app may run a few functions at once, so one busy app cannot starve the others.
 const running=fnRunning.get(id)||0;
 if(running>=Math.max(1,Number(process.env.KAIROQ_FUNCTION_CONCURRENCY_PER_APP||3)))throw fail(429,'This app is busy. Try again in a moment.');
 fnRunning.set(id,running+1);
 let out;
 try{out=fnFile.endsWith('.py')?await require('./python-functions').invoke({key:id+(sb?':'+sb.dir:''),source,request,user:publicUser(user),host}):await require('./react-functions').invoke({source,request,user:publicUser(user),host})}
 catch(e){applog.add(id,{level:'error',source:fnFile,message:request.method+' '+request.path+': '+(e.message||e)});throw e}
 finally{const n=(fnRunning.get(id)||1)-1;if(n>0)fnRunning.set(id,n);else fnRunning.delete(id)}
 for(const line of out.logs||[])applog.add(id,{level:'log',source:fnFile,message:line});
 return out;
}

// ---------- owner view (Create "Data" tab) ----------
function overview(id){
 const meta=builder.loadMeta(id),cfg=liveConfig(meta),db=database(id);
 const counts=Object.fromEntries(db.prepare('SELECT collection,COUNT(*) n FROM records GROUP BY collection').all().map(r=>[r.collection,r.n]));
 return{
  features:{storage:cfg.storage||null,email:!!cfg.email,payments:cfg.payments?Object.keys(cfg.payments.products):[],schedules:(cfg.schedules||[]).map(s=>({...s,...(db.prepare('SELECT last_run,last_result FROM schedule_runs WHERE name=?').get(s.name)||{})})),automations:(cfg.automations||[]).length},
  files:db.prepare('SELECT COUNT(*) n,COALESCE(SUM(size),0) bytes FROM files').get(),
  payments:db.prepare('SELECT p.product,p.mode,p.status,p.amount,p.currency,p.created_at,u.email FROM payments p LEFT JOIN users u ON u.id=p.user_id ORDER BY p.created_at DESC LIMIT 50').all(),
  collections:Object.entries(cfg.collections).map(([name,def])=>({name,access:def.access,count:counts[name]||0})),
  users:db.prepare('SELECT id,email,name,created_at FROM users ORDER BY created_at DESC LIMIT 100').all(),
  user_count:db.prepare('SELECT COUNT(*) n FROM users').get().n,
  // Emails the app could not send yet (email not set up on this server), kept for the owner.
  outbox:hasTable(db,'email_outbox')?db.prepare('SELECT to_kind,subject,text,user_email,at FROM email_outbox ORDER BY at DESC LIMIT 50').all():[]
 };
}
function ownerRecords(id,collection){
 if(!/^[a-z][a-z0-9_]{0,39}$/.test(collection))throw fail(400,'Bad collection');
 return database(id).prepare('SELECT * FROM records WHERE collection=? ORDER BY created_at DESC LIMIT 200').all(collection).map(record);
}
// Owner-only targeted clearing. Never delete users, sessions, goals, or weight history.
const NUTRITION_COLLECTIONS=new Set(['food_logs','food_log','food_entries','food_diary','meal_entries','meal_logs','nutrition_entries','nutrition_logs','daily_foods','logged_foods']);
function ownerClearNutritionRecords(id,collection,{confirm=false}={}){
 if(confirm!==true)throw fail(400,'Explicit confirmation required');
 if(typeof collection!=='string'||!NUTRITION_COLLECTIONS.has(collection))throw fail(400,'Only recognized nutrition log collections can be cleared');
 const db=database(id);
 const count=db.prepare('SELECT COUNT(*) n FROM records WHERE collection=?').get(collection).n;
 db.prepare('DELETE FROM records WHERE collection=?').run(collection);
 return{cleared:true,collection,deleted:count,usersUntouched:true,otherCollectionsUntouched:true};
}
// Only the authenticated project owner can invoke this through create-api.
// Keep deletion independent of a running AI generation job.
function ownerRemoveAppUser(id,email,{deleteOwnedRecords=false}={}){
 const value=String(email||'').trim().toLowerCase();
 if(!value||value.length>254||!/^\S+@\S+\.\S+$/.test(value))throw fail(400,'An exact valid account email is required');
 if(typeof deleteOwnedRecords!=='boolean')throw fail(400,'deleteOwnedRecords must be boolean');
 const db=database(id),target=db.prepare('SELECT id,email FROM users WHERE email=?').get(value);
 if(!target)throw fail(404,'No account with that email exists in this app');
 const total=db.prepare('SELECT COUNT(*) n FROM records WHERE owner_id=?').get(target.id).n;
 db.exec('BEGIN');
 try{
  db.prepare('DELETE FROM sessions WHERE user_id=?').run(target.id);
  db.prepare('DELETE FROM app_tokens WHERE user_id=?').run(target.id);
  if(deleteOwnedRecords)db.prepare('DELETE FROM records WHERE owner_id=?').run(target.id);
  db.prepare('DELETE FROM users WHERE id=?').run(target.id);
  db.exec('COMMIT');
 }catch(err){try{db.exec('ROLLBACK')}catch{}throw err}
 return{removed:true,email:value,sessionsRevoked:true,recordsDeleted:deleteOwnedRecords?total:0,
  retainedOwnedRecords:deleteOwnedRecords?0:total,
  note:'Other payment, file and email history may require separate retention or deletion'};
}
function ownerDelete(id,recordId){const d=database(id),row=d.prepare('SELECT collection,owner_id FROM records WHERE id=?').get(String(recordId));if(!row)throw fail(404,'Record not found');d.prepare('DELETE FROM records WHERE id=?').run(String(recordId));publish(id,row.collection,'deleted',{id:String(recordId)},row.owner_id);return{deleted:recordId}}

// ---------- browser client (virtual module "kairoq") ----------
function clientSource(projectId,apiOrigin='',version=0,appUrl=''){
 return `const BASE=${JSON.stringify(apiOrigin.replace(/\/$/,'')+'/api/apps/'+projectId)};
const APP_URL=${JSON.stringify(String(appUrl||''))};
// Inside a native (Capacitor) app the page is https://localhost, so links that come back to
// the app (password reset, Google sign-in) go to its published web address instead.
const NATIVE=typeof location!=='undefined'&&(location.protocol==='capacitor:'||location.hostname==='localhost'&&!location.port&&Boolean(APP_URL));
function returnUrl(){return NATIVE&&APP_URL?APP_URL:location.href.split('#')[0]}
const VERSION=${JSON.stringify(String(version||''))};
const PREVIEW=(()=>{try{const m=/\\/builder\\/p\\/[a-f0-9]{12}-([a-f0-9]{24})\\//.exec(location.pathname);return m?m[1]:''}catch{return''}})();
function versionHeaders(){return VERSION?{'X-Kairoq-Version':VERSION,...(PREVIEW?{'X-Kairoq-Preview':PREVIEW}:{})}:{}}
const KEY='kairoq-session-${projectId}';
let token=null,currentUser=null;const listeners=new Set();
try{const s=JSON.parse(localStorage.getItem(KEY)||'null');if(s){token=s.token;currentUser=s.user}}catch{}
function save(){try{token?localStorage.setItem(KEY,JSON.stringify({token,user:currentUser})):localStorage.removeItem(KEY)}catch{}listeners.forEach(fn=>{try{fn(currentUser)}catch{}})}
async function call(path,{method='GET',body,query}={}){
  const qs=query?'?'+new URLSearchParams(Object.entries(query).filter(([,v])=>v!==undefined).map(([k,v])=>[k,typeof v==='object'?JSON.stringify(v):String(v)])).toString():'';
  const r=await fetch(BASE+path+qs,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{}),...versionHeaders()},body:body?JSON.stringify(body):undefined});
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
// Invite links (?ref=CODE): kept for 30 days, used once when this visitor creates an account.
const REF_KEY='kairoq-ref-${projectId}';
try{const r=new URLSearchParams(location.search).get('ref');if(r&&/^[a-z0-9]{6,16}$/i.test(r))localStorage.setItem(REF_KEY,JSON.stringify({code:r.toLowerCase(),at:Date.now()}))}catch{}
function pendingRef(){try{const r=JSON.parse(localStorage.getItem(REF_KEY)||'null');return r&&Date.now()-r.at<30*86400000?r.code:undefined}catch{return undefined}}
function clearRef(){try{localStorage.removeItem(REF_KEY)}catch{}}
const ready=pendingCode?call('/auth/google/exchange',{method:'POST',body:{code:pendingCode}}).then(async d=>{token=d.token;currentUser=d.user;save();const ref=pendingRef();if(ref){await call('/referrals/claim',{method:'POST',body:{code:ref}}).catch(()=>{});clearRef()}}).catch(()=>{}):Promise.resolve();
export const auth={
  ready(){return ready},
  async signInWithGoogle(){
    if(window.top!==window)throw new Error('Google sign-in works on your published app. In the preview, use email sign-in.');
    if(NATIVE)throw new Error('Google sign-in is available on the web version of this app. In the mobile app, use email sign-in.');
    location.href=BASE+'/auth/google/start?return='+encodeURIComponent(location.href);
  },
  async requestPasswordReset(email){return call('/auth/reset/request',{method:'POST',body:{email,return_url:returnUrl()}})},
  resetToken(){return pendingReset},
  async resetPassword(password,tokenValue=pendingReset){const d=await call('/auth/reset/complete',{method:'POST',body:{token:tokenValue,password}});pendingReset=null;token=d.token;currentUser=d.user;save();return d.user},
  user(){return currentUser},
  async signUp(email,password,name){const d=await call('/auth/signup',{method:'POST',body:{email,password,name,ref:pendingRef()}});clearRef();token=d.token;currentUser=d.user;save();return d.user},
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
        }catch(err){if(!stopped&&!(err.status>=400&&err.status<500&&err.status!==429))timer=setTimeout(connect,5000)}
      };
      // Reconnect as the new user after sign-in or sign-out.
      const offAuth=auth.onChange(()=>{if(stopped)return;clearTimeout(timer);if(es){es.close();es=null}connect()});
      connect();
      return()=>{stopped=true;offAuth();clearTimeout(timer);if(es)es.close()};
    }
  };
}
export const storage={
  async upload(file,{name}={}){
    const r=await fetch(BASE+'/files?name='+encodeURIComponent(name||file.name||'file'),{method:'POST',headers:{'Content-Type':file.type||'application/octet-stream',...(token?{Authorization:'Bearer '+token}:{}),...versionHeaders()},body:file});
    const d=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(new Error(d.error||'Upload failed'),{status:r.status});
    return{...d.file,url:new URL(d.file.url,BASE.startsWith('http')?BASE:location.href).toString()};
  },
  url(id){return BASE+'/files/'+id},
  async remove(id){await call('/files/'+id,{method:'DELETE'})}
};
// Invite a friend: the signed-in user's invite link, and how many joined through it.
export const referrals={
  async mine(){const d=await call('/referrals/me');return{...d,link:(NATIVE&&APP_URL?APP_URL:location.origin+location.pathname)+'?ref='+d.code}}
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
    const r=await fetch(BASE+'/functions/'+encodeURIComponent(name),{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...versionHeaders()},body:JSON.stringify(body===undefined?{}:body)});
    const type=r.headers.get('content-type')||'',data=type.includes('json')?await r.json().catch(()=>null):await r.text();
    if(!r.ok)throw Object.assign(new Error((data&&data.error)||('Function failed ('+r.status+')')),{status:r.status,data});
    return data;
  },
  url(name){return BASE+'/functions/'+encodeURIComponent(name)}
};
// Reads a streamed answer (server-sent events over POST), calling onToken with each piece.
async function streamed(path,body,onToken){
  const r=await fetch(BASE+path,{method:'POST',headers:{'Content-Type':'application/json',Accept:'text/event-stream',...(token?{Authorization:'Bearer '+token}:{}),...versionHeaders()},body:JSON.stringify({...body,stream:true})});
  if(!r.ok||!r.body){const d=await r.json().catch(()=>({}));throw Object.assign(new Error(d.error||('Request failed ('+r.status+')')),{status:r.status})}
  const reader=r.body.getReader(),dec=new TextDecoder();let buf='',result=null;
  for(;;){
    const {value,done}=await reader.read();if(done)break;
    buf+=dec.decode(value,{stream:true});let i;
    while((i=buf.indexOf('\\n\\n'))>=0){
      const block=buf.slice(0,i);buf=buf.slice(i+2);
      const name=(/^event: (.*)$/m.exec(block)||[])[1],raw=(/^data: (.*)$/m.exec(block)||[])[1];if(!raw)continue;
      const d=JSON.parse(raw);
      if(name==='token')onToken(d.t);else if(name==='done')result=d;else if(name==='error')throw Object.assign(new Error(d.error),{status:d.status});
    }
  }
  if(!result)throw new Error('The answer was cut off. Try again.');
  return result;
}
export const ai={
  // ai.chat({ messages:[{role:'user',content:'...'}], system, max_tokens, onToken }) -> { text }
  async chat(options){
    const {onToken,...body}=typeof options==='string'?{messages:[{role:'user',content:options}]}:options;
    return onToken?streamed('/ai',body,onToken):call('/ai',{method:'POST',body});
  },
  // Answers from the documents the owner added (Data tab → AI assistant), with the sources it used:
  // ai.ask(question, { history, system, onToken }) -> { text, sources:[{n,title,excerpt}] }
  async ask(question,{history,system,fallback,onToken}={}){
    const body={question,history,system,fallback};
    return onToken?streamed('/ai/ask',body,onToken):call('/ai/ask',{method:'POST',body});
  },
  // Structured data from text or photos: ai.extract({ shape:{name:'string',price:'number'}, text, images:[file or data URL], instructions })
  // -> { data, missing:[fields not found], problems? }
  async extract({shape,schema,text,image,images,instructions}={}){
    const toUrl=f=>typeof f==='string'?Promise.resolve(f):new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=()=>no(new Error('Could not read the image'));r.readAsDataURL(f)});
    const list=await Promise.all([...(images||[]),...(image?[image]:[])].map(toUrl));
    const r=await fetch(BASE+'/ai/extract',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...versionHeaders()},body:JSON.stringify({shape:shape||schema,text,images:list,instructions})});
    const d=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(new Error(d.error||'Could not read it ('+r.status+')'),{status:r.status});
    return d;
  },
  // A visitor's thumbs-down: the question goes on the owner's "could not answer" list.
  async feedback(question,helpful){return call('/ai/feedback',{method:'POST',body:{question,helpful}})}
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
// Every due automation on every app (called every minute by the server).
function runAllAutomations(options){return require('./react-automations').tick(options)}
module.exports={hasTable,pgSchema,functionDb,openFile,closeFile,googleAppSignIn,configure,appAi,runAllSchedules,runAllAutomations,runFunction,liveConfig,handle,parseConfig,configErrors,clientSource,overview,ownerRecords,ownerDelete,ownerClearNutritionRecords,ownerRemoveAppUser,database,close,ACCESS};

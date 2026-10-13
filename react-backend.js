"use strict";
// Built-in backend for Create projects: end-user accounts and JSON record
// collections in a per-project SQLite database. Generated apps call it through
// the virtual "kairoq" module, with bearer tokens (no cookies) so it works from
// sandboxed previews, /sites/ pages and custom domains alike.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {DatabaseSync}=require('node:sqlite');
const builder=require('./react-builder');

const ACCESS=['private','shared','public-read','public'];
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
 return{collections};
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
  CREATE INDEX IF NOT EXISTS records_collection ON records(collection,created_at);`);
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
function currentUser(db,req){
 const m=/^Bearer ([A-Za-z0-9_-]{20,100})$/.exec(String(req.headers.authorization||''));
 if(!m)return null;
 const s=db.prepare('SELECT * FROM sessions WHERE token_hash=?').get(hash(m[1]));
 if(!s||s.expires_at<Date.now())return null;
 return db.prepare('SELECT * FROM users WHERE id=?').get(s.user_id)||null;
}

// ---------- records ----------
function canRead(access,user){return access==='public'||access==='public-read'||!!user}
function canCreate(access,user){return access==='public'||!!user}
function visibleWhere(access,user){return access==='private'?{sql:' AND owner_id=?',args:[user.id]}:{sql:'',args:[]}}
function cleanData(data){
 if(!data||typeof data!=='object'||Array.isArray(data))throw fail(400,'Record data must be an object');
 const out={};for(const [k,v] of Object.entries(data))if(!k.startsWith('_')&&k!=='id')out[k]=v;
 const text=JSON.stringify(out);
 if(Buffer.byteLength(text)>MAX_RECORD_BYTES)throw fail(413,'Record is larger than 20 KB');
 return text;
}
function list(db,access,collection,user,query){
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
 return record(db.prepare('SELECT * FROM records WHERE id=?').get(id));
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
 return record(db.prepare('SELECT * FROM records WHERE id=?').get(id));
}
function remove(db,collection,user,id){ownRecord(db,collection,user,id);db.prepare('DELETE FROM records WHERE id=?').run(id);return{deleted:id}}

// ---------- HTTP: /api/apps/<id>/... ----------
const hits=new Map();
function limited(req,id){
 if(hits.size>20000)hits.clear();
 const key=id+':'+(String(req.headers['x-forwarded-for']||'').split(',')[0].trim()||req.socket?.remoteAddress||'local'),now=Date.now();
 const list=(hits.get(key)||[]).filter(t=>now-t<60000);list.push(now);hits.set(key,list);
 if(list.length>240)throw fail(429,'Too many requests. Slow down and try again.');
}
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'GET, POST, PATCH, DELETE, OPTIONS','Access-Control-Max-Age':'600'});res.end(status===204?undefined:JSON.stringify(data))}
function readJson(req,limit=40000){return new Promise((resolve,reject)=>{let b='';req.on('data',c=>{b+=c;if(b.length>limit){reject(fail(413,'Request too large'));req.destroy()}});req.on('end',()=>{try{resolve(b?JSON.parse(b):{})}catch{reject(fail(400,'Invalid JSON'))}});req.on('error',reject)})}
// Config comes from the version that is live: the published one when set, otherwise the current draft.
function liveConfig(meta){const n=meta.published?.version||meta.current_version;return n?parseConfig(builder.loadFiles(meta.id,n)):{collections:{}}}
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
  const db=database(id),user=currentUser(db,req);
  if(route==='/auth/signup'&&req.method==='POST')return send(res,201,signUp(db,await readJson(req))),true;
  if(route==='/auth/signin'&&req.method==='POST')return send(res,200,signIn(db,await readJson(req))),true;
  if(route==='/auth/signout'&&req.method==='POST'){const t=/^Bearer (.+)$/.exec(String(req.headers.authorization||''));if(t)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(t[1]));return send(res,200,{ok:true}),true}
  if(route==='/auth/user'&&req.method==='GET')return send(res,200,{user:publicUser(user)}),true;
  const c=/^\/collections\/([a-z][a-z0-9_]{0,39})(?:\/([a-f0-9-]{36}))?$/.exec(route);
  if(!c)throw fail(404,'Unknown backend route');
  const collection=c[1],rid=c[2],def=liveConfig(meta).collections[collection];
  if(!def)throw fail(404,'Collection "'+collection+'" is not declared in src/backend.json');
  const q=Object.fromEntries(u.searchParams);
  if(!rid&&req.method==='GET')return send(res,200,{items:list(db,def.access,collection,user,q)}),true;
  if(!rid&&req.method==='POST')return send(res,201,{item:create(db,def.access,collection,user,(await readJson(req)).data)}),true;
  if(rid&&req.method==='GET')return send(res,200,{item:getOne(db,def.access,collection,user,rid)}),true;
  if(rid&&req.method==='PATCH')return send(res,200,{item:update(db,collection,user,rid,(await readJson(req)).data)}),true;
  if(rid&&req.method==='DELETE')return send(res,200,remove(db,collection,user,rid)),true;
  throw fail(405,'Method not allowed');
 }catch(e){return send(res,Number.isInteger(e.status)?e.status:422,{error:String(e.message||e)}),true}
}

// ---------- owner view (Create "Data" tab) ----------
function overview(id){
 const meta=builder.loadMeta(id),cfg=liveConfig(meta),db=database(id);
 const counts=Object.fromEntries(db.prepare('SELECT collection,COUNT(*) n FROM records GROUP BY collection').all().map(r=>[r.collection,r.n]));
 return{
  collections:Object.entries(cfg.collections).map(([name,def])=>({name,access:def.access,count:counts[name]||0})),
  users:db.prepare('SELECT id,email,name,created_at FROM users ORDER BY created_at DESC LIMIT 100').all(),
  user_count:db.prepare('SELECT COUNT(*) n FROM users').get().n
 };
}
function ownerRecords(id,collection){
 if(!/^[a-z][a-z0-9_]{0,39}$/.test(collection))throw fail(400,'Bad collection');
 return database(id).prepare('SELECT * FROM records WHERE collection=? ORDER BY created_at DESC LIMIT 200').all(collection).map(record);
}
function ownerDelete(id,recordId){const r=database(id).prepare('DELETE FROM records WHERE id=?').run(String(recordId));if(!r.changes)throw fail(404,'Record not found');return{deleted:recordId}}

// ---------- browser client (virtual module "kairoq") ----------
function clientSource(projectId,apiOrigin=''){
 return `const BASE=${JSON.stringify(apiOrigin.replace(/\/$/,'')+'/api/apps/'+projectId)};
const KEY='kairoq-session-${projectId}';
let token=null,currentUser=null;const listeners=new Set();
try{const s=JSON.parse(localStorage.getItem(KEY)||'null');if(s){token=s.token;currentUser=s.user}}catch{}
function save(){try{token?localStorage.setItem(KEY,JSON.stringify({token,user:currentUser})):localStorage.removeItem(KEY)}catch{}listeners.forEach(fn=>{try{fn(currentUser)}catch{}})}
async function call(path,{method='GET',body,query}={}){
  const qs=query?'?'+new URLSearchParams(Object.entries(query).filter(([,v])=>v!==undefined).map(([k,v])=>[k,typeof v==='object'?JSON.stringify(v):String(v)])).toString():'';
  const r=await fetch(BASE+path+qs,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});
  const data=await r.json().catch(()=>({}));
  if(r.status===401&&token&&!path.startsWith('/auth/')){token=null;currentUser=null;save()}
  if(!r.ok)throw Object.assign(new Error(data.error||('Request failed ('+r.status+')')),{status:r.status});
  return data;
}
export const auth={
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
    async remove(id){await call(p+'/'+id,{method:'DELETE'})}
  };
}
export default{auth,collection};
`;
}

module.exports={handle,parseConfig,configErrors,clientSource,overview,ownerRecords,ownerDelete,database,close,ACCESS};

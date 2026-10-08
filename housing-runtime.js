"use strict";
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {DatabaseSync}=require('node:sqlite');
const statuses=['new','contacted','quoted','booked','closed'];
const sessions=new Map(),attempts=new Map(),dbs=new Map();
function database(root,id){
 if(!/^[a-z0-9-]{5,85}$/.test(id))throw Error('Invalid app ID');
 const dir=path.join(root,id);fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,'housing.sqlite');
 if(dbs.has(file))return dbs.get(file);
 const db=new DatabaseSync(file);db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,salt TEXT NOT NULL,hash TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS enquiries(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),name TEXT NOT NULL,email TEXT NOT NULL,city TEXT NOT NULL,arrival TEXT,departure TEXT,budget REAL NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'new',notes TEXT NOT NULL DEFAULT '',priority TEXT NOT NULL DEFAULT 'normal',created_at TEXT NOT NULL,updated_at TEXT NOT NULL);`);
 dbs.set(file,db);return db;
}
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
async function body(req){let s='';for await(const part of req){s+=part;if(s.length>18000)throw Error('Request too large');}try{return JSON.parse(s||'{}')}catch{throw Error('Invalid JSON')}}
const sessionName=id=>id==='housing-enquiries'?'housing_session':'kairoq_session_'+id;
const token=(req,id)=>{const prefix=sessionName(id)+'=';return String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(prefix))?.slice(prefix.length)};
function user(req,id){const s=sessions.get(token(req,id));return s&&s.id===id&&s.expires>Date.now()?s.user:null;}
function cookie(req,res,value,id){res.setHeader('Set-Cookie',sessionName(id)+'='+value+'; HttpOnly; SameSite=Strict; Path=/apps/'+id+'/; Max-Age='+(value?86400:0)+(req.headers['x-forwarded-proto']==='https'||req.socket.encrypted?'; Secure':''));}
function clean(raw){
 const str=(key,max=500)=>String(raw[key]??'').trim().slice(0,max);
 const out={name:str('name',120),email:str('email',160).toLowerCase(),city:str('city',100),arrival:str('arrival',10),departure:str('departure',10),budget:Number(raw.budget||0),status:str('status',20)||'new',notes:str('notes',3000),priority:str('priority',20)||'normal'};
 if(!out.name||!out.city||!/^\S+@\S+\.\S+$/.test(out.email))throw Error('Name, valid email and city are required');
 if(!Number.isFinite(out.budget)||out.budget<0||out.budget>1000000)throw Error('Invalid budget');
 for(const k of ['arrival','departure'])if(out[k]&&(!/^\d{4}-\d{2}-\d{2}$/.test(out[k])||new Date(out[k]).toISOString().slice(0,10)!==out[k]))throw Error('Invalid date');
 if(out.arrival&&out.departure&&out.departure<out.arrival)throw Error('Departure must follow arrival');
 if(!statuses.includes(out.status)||!['normal','high','urgent'].includes(out.priority))throw Error('Invalid status or priority');return out;
}
async function handle(req,res,{root,id,route}){
 try{
  const db=database(root,id),method=req.method;
  if(method!=='GET'&&req.headers.origin){const host=String(req.headers.host||'');if(new URL(req.headers.origin).host!==host)return send(res,403,{error:'Cross-origin write blocked'});}
  if(route==='/auth/register'||route==='/auth/login'){
   if(method!=='POST')return send(res,405,{error:'POST required'});
   const identity=id+':'+String(req.headers['x-forwarded-for']||req.socket.remoteAddress),now=Date.now();const count=(attempts.get(identity)||[]).filter(t=>t>now-60000);if(count.length>=10)return send(res,429,{error:'Try again in a minute'});count.push(now);attempts.set(identity,count);
   const b=await body(req),email=String(b.email||'').trim().toLowerCase(),password=String(b.password||'');
   if(!/^\S+@\S+\.\S+$/.test(email)||email.length>160||password.length<10||password.length>200)return send(res,400,{error:'Use a valid email and a password of 10–200 characters'});
   let account=db.prepare('SELECT * FROM users WHERE email=?').get(email);
   if(route==='/auth/register'){
    if(account)return send(res,409,{error:'Account already exists'});
    const salt=crypto.randomBytes(16).toString('hex'),hash=crypto.scryptSync(password,salt,64).toString('hex');account={id:crypto.randomUUID(),email,salt,hash};
    db.prepare('INSERT INTO users VALUES(?,?,?,?)').run(account.id,email,salt,hash);
   }else if(!account||!crypto.timingSafeEqual(Buffer.from(account.hash,'hex'),crypto.scryptSync(password,account.salt,64)))return send(res,401,{error:'Invalid email or password'});
   const session=crypto.randomBytes(32).toString('hex');sessions.set(session,{id,user:{id:account.id,email},expires:now+86400000});cookie(req,res,session,id);return send(res,200,{user:{id:account.id,email}});
  }
  if(route==='/auth/logout'&&method==='POST'){sessions.delete(token(req,id));cookie(req,res,'',id);return send(res,200,{ok:true})}
  const account=user(req,id);if(!account)return send(res,401,{error:'Sign in required'});
  if(route==='/auth/me'&&method==='GET')return send(res,200,{user:account});
  if(route==='/enquiries'&&method==='GET')return send(res,200,{enquiries:db.prepare('SELECT * FROM enquiries WHERE user_id=? ORDER BY created_at DESC').all(account.id).map(({user_id,...e})=>e)});
  if(route==='/dashboard'&&method==='GET'){
   const rows=db.prepare('SELECT status,budget,priority FROM enquiries WHERE user_id=?').all(account.id);return send(res,200,{total:rows.length,active:rows.filter(e=>!['booked','closed'].includes(e.status)).length,booked:rows.filter(e=>e.status==='booked').length,pipeline_budget:rows.filter(e=>!['booked','closed'].includes(e.status)).reduce((n,e)=>n+e.budget,0),urgent:rows.filter(e=>e.priority==='urgent').length});
  }
  if(route==='/enquiries'&&method==='POST'){
   const e=clean(await body(req)),eid=crypto.randomUUID(),at=new Date().toISOString();db.prepare('INSERT INTO enquiries VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(eid,account.id,e.name,e.email,e.city,e.arrival,e.departure,e.budget,e.status,e.notes,e.priority,at,at);return send(res,201,{enquiry:{id:eid,...e,created_at:at,updated_at:at}});
  }
  const match=/^\/enquiries\/([a-f0-9-]{36})$/.exec(route);
  if(match){const old=db.prepare('SELECT * FROM enquiries WHERE id=? AND user_id=?').get(match[1],account.id);if(!old)return send(res,404,{error:'Enquiry not found'});
   if(method==='PATCH'){const e=clean({...old,...await body(req)}),at=new Date().toISOString();db.prepare('UPDATE enquiries SET name=?,email=?,city=?,arrival=?,departure=?,budget=?,status=?,notes=?,priority=?,updated_at=? WHERE id=? AND user_id=?').run(e.name,e.email,e.city,e.arrival,e.departure,e.budget,e.status,e.notes,e.priority,at,old.id,account.id);return send(res,200,{enquiry:{id:old.id,...e,created_at:old.created_at,updated_at:at}})}
   if(method==='DELETE'){db.prepare('DELETE FROM enquiries WHERE id=? AND user_id=?').run(old.id,account.id);return send(res,200,{ok:true})}
  }
  return send(res,404,{error:'Endpoint not found'});
 }catch(e){return send(res,400,{error:String(e.message||e).slice(0,180)})}
}
module.exports={handle,database,clean,user,body,send};

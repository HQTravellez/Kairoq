"use strict";
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const auth=require('./housing-runtime');
const ROOT=path.join(__dirname,'workspace','developer-projects');
const TYPES=['text','textarea','email','number','date','boolean','select'];
const NAME=/^[a-z][a-z0-9_]{0,39}$/;
function safeName(name){if(!NAME.test(name)||['constructor','prototype','__proto__','id','user_id','created_at','updated_at'].includes(name))throw Error('Invalid collection/field name: '+name);return name;}
function validateSchema(raw){
 if(!Array.isArray(raw?.collections)||!raw.collections.length||raw.collections.length>12)throw Error('Schema needs 1–12 collections');
 const used=new Set();return{collections:raw.collections.map(c=>{
  const name=safeName(String(c.name||''));if(used.has(name))throw Error('Duplicate collection');used.add(name);
  if(!Array.isArray(c.fields)||!c.fields.length||c.fields.length>25)throw Error('Each collection needs 1–25 fields');const fieldsUsed=new Set();
  const fields=c.fields.map(f=>{const field=safeName(String(f.name||''));if(fieldsUsed.has(field))throw Error('Duplicate field');fieldsUsed.add(field);const type=String(f.type||'text');if(!TYPES.includes(type))throw Error('Unsupported field type: '+type);const out={name:field,label:String(f.label||field).slice(0,80),type,required:!!f.required};if(type==='select'){if(!Array.isArray(f.options)||!f.options.length||f.options.length>30)throw Error('Select needs options');out.options=[...new Set(f.options.map(v=>String(v).slice(0,80)))];}if(Object.hasOwn(f,'default'))out.default=fieldValue(out,f.default);return out;});return{name,label:String(c.label||name).slice(0,80),fields};
 })};
}
function fieldValue(field,value){
 if(value==null||value===''){if(field.required)throw Error(field.label+' is required');return field.type==='boolean'?false:null;}
 if(field.type==='boolean'){if(typeof value!=='boolean')throw Error(field.label+' must be true or false');return value;}
 if(field.type==='number'){if(typeof value==='boolean'||typeof value==='object')throw Error('Invalid number');const n=Number(value);if(!Number.isFinite(n)||Math.abs(n)>1e12)throw Error(field.label+' must be a valid number');return n;}
 if(typeof value!=='string')throw Error(field.label+' must be text');const s=value.trim();if(!s&&field.required)throw Error(field.label+' is required');if(s.length>(field.type==='textarea'?5000:500))throw Error(field.label+' is too long');
 if(field.type==='email'&&!/^\S+@\S+\.\S+$/.test(s))throw Error('Invalid email');
 if(field.type==='date'&&(!/^\d{4}-\d{2}-\d{2}$/.test(s)||new Date(s).toISOString().slice(0,10)!==s))throw Error('Invalid date');
 if(field.type==='select'&&!field.options.includes(s))throw Error('Invalid option for '+field.label);return s;
}
function recordValues(collection,raw){if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Record must be an object');const keys=new Set(collection.fields.map(f=>f.name));for(const k of Object.keys(raw))if(!keys.has(k))throw Error('Unknown field: '+k);return Object.fromEntries(collection.fields.map(f=>[f.name,fieldValue(f,Object.hasOwn(raw,f.name)?raw[f.name]:f.default)]));}
function validateMigration(before,after){
 for(const collection of before.collections){const next=after.collections.find(c=>c.name===collection.name);if(!next)throw Error('Revision cannot remove a saved collection');for(const field of collection.fields){const f=next.fields.find(x=>x.name===field.name);if(!f||f.type!==field.type)throw Error('Revision cannot remove or change stored field types');if(f.required&&!field.required&&!Object.hasOwn(f,'default'))throw Error('Required-field change needs a default');if(field.options?.some(v=>!f.options.includes(v)))throw Error('Revision cannot remove existing options');}for(const f of next.fields)if(!collection.fields.some(x=>x.name===f.name)&&f.required&&!Object.hasOwn(f,'default'))throw Error('New required fields need defaults');}return after;
}
function getProject(id,root=ROOT){if(!/^[a-z0-9-]{5,85}$/.test(id))throw Error('Invalid app ID');const meta=JSON.parse(fs.readFileSync(path.join(root,id,'app.json'),'utf8'));const folder=path.join(root,id,'versions',String(meta.version));const manifest=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'),'utf8'));return{...meta,schema:manifest.schema,files:Object.fromEntries(['index.html','styles.css','app.js'].map(n=>[n,fs.readFileSync(path.join(folder,n),'utf8')]))};}
function recordsDb(root,id){const db=auth.database(root,id);db.exec('CREATE TABLE IF NOT EXISTS app_records(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),collection TEXT NOT NULL,payload TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL); CREATE INDEX IF NOT EXISTS app_record_owner ON app_records(user_id,collection);');return db;}
function rowRecord(r,collection){const data=JSON.parse(r.payload);for(const f of collection.fields)if(!Object.hasOwn(data,f.name))data[f.name]=f.default??null;return{id:r.id,data,created_at:r.created_at,updated_at:r.updated_at};}
async function api(req,res,{root=ROOT,id,route,schema}){
 if(route.startsWith('/auth/'))return auth.handle(req,res,{root,id,route});
 try{
  if(req.method!=='GET'&&req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return auth.send(res,403,{error:'Cross-origin write blocked'});
  const u=auth.user(req,id);if(!u)return auth.send(res,401,{error:'Sign in required'});const db=recordsDb(root,id);
  if(route==='/schema'&&req.method==='GET')return auth.send(res,200,{schema});
  if(route==='/dashboard'&&req.method==='GET'){const counts=Object.fromEntries(schema.collections.map(c=>[c.name,db.prepare('SELECT count(*) n FROM app_records WHERE user_id=? AND collection=?').get(u.id,c.name).n]));return auth.send(res,200,{total:Object.values(counts).reduce((a,b)=>a+b,0),collections:counts});}
  const match=/^\/collections\/([a-z][a-z0-9_]{0,39})(?:\/([a-f0-9-]{36}))?$/.exec(route);if(!match)return auth.send(res,404,{error:'Endpoint not found'});const collection=schema.collections.find(c=>c.name===match[1]);if(!collection)return auth.send(res,404,{error:'Collection not found'});
  if(!match[2]&&req.method==='GET')return auth.send(res,200,{records:db.prepare('SELECT * FROM app_records WHERE user_id=? AND collection=? ORDER BY created_at DESC').all(u.id,collection.name).map(r=>rowRecord(r,collection))});
  if(!match[2]&&req.method==='POST'){const data=recordValues(collection,await auth.body(req)),rid=crypto.randomUUID(),at=new Date().toISOString();db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?,?)').run(rid,u.id,collection.name,JSON.stringify(data),at,at);return auth.send(res,201,{record:{id:rid,data,created_at:at,updated_at:at}});}
  const old=match[2]&&db.prepare('SELECT * FROM app_records WHERE id=? AND user_id=? AND collection=?').get(match[2],u.id,collection.name);if(!old)return auth.send(res,404,{error:'Record not found'});
  if(req.method==='PATCH'){const data=recordValues(collection,{...JSON.parse(old.payload),...await auth.body(req)}),at=new Date().toISOString();db.prepare('UPDATE app_records SET payload=?,updated_at=? WHERE id=? AND user_id=?').run(JSON.stringify(data),at,old.id,u.id);return auth.send(res,200,{record:{id:old.id,data,created_at:old.created_at,updated_at:at}});}
  if(req.method==='DELETE'){db.prepare('DELETE FROM app_records WHERE id=? AND user_id=?').run(old.id,u.id);return auth.send(res,200,{ok:true});}
  return auth.send(res,405,{error:'Unsupported method'});
 }catch(e){return auth.send(res,400,{error:String(e.message||e).slice(0,200)})}
}
async function handle(req,res){const m=/^\/apps\/([a-z0-9-]{5,85})\/(.*)$/.exec(req.url.split('?')[0]);if(!m||!fs.existsSync(path.join(ROOT,m[1],'app.json')))return false;try{const p=getProject(m[1]);if(m[2].startsWith('api/')){await api(req,res,{id:p.id,route:'/'+m[2].slice(4),schema:p.schema});return true;}const name=m[2]||'index.html';if(!['index.html','styles.css','app.js'].includes(name)){res.writeHead(404);res.end('Not found');return true;}res.writeHead(200,{'Content-Type':name.endsWith('html')?'text/html':name.endsWith('css')?'text/css':'application/javascript','Cache-Control':'no-store','X-Robots-Tag':'noindex','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'self'; base-uri 'self'; form-action 'self'"});res.end(p.files[name]);return true;}catch(e){auth.send(res,500,{error:'App temporarily unavailable'});return true;}}
module.exports={ROOT,validateSchema,validateMigration,recordValues,getProject,recordsDb,api,handle};

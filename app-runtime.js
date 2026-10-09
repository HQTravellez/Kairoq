"use strict";
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const auth=require('./housing-runtime');
const supabase=require('./supabase-builder');
const ROOT=path.join(__dirname,'workspace','developer-projects');
const TYPES=['text','textarea','email','number','date','boolean','select','reference'];
const NAME=/^[a-z][a-z0-9_]{0,39}$/;
function safeName(name){if(!NAME.test(name)||['constructor','prototype','__proto__','id','user_id','created_at','updated_at'].includes(name))throw Error('Invalid collection/field name: '+name);return name;}
function validateSchema(raw){
 if(!Array.isArray(raw?.collections)||!raw.collections.length||raw.collections.length>12)throw Error('Schema needs 1–12 collections');
 const used=new Set(),collections=raw.collections.map(c=>{
  const name=safeName(String(c.name||''));if(used.has(name))throw Error('Duplicate collection');used.add(name);
  if(!Array.isArray(c.fields)||!c.fields.length||c.fields.length>25)throw Error('Each collection needs 1–25 fields');const fieldsUsed=new Set();
  const fields=c.fields.map(f=>{const field=safeName(String(f.name||''));if(fieldsUsed.has(field))throw Error('Duplicate field');fieldsUsed.add(field);const type=String(f.type||'text');if(!TYPES.includes(type))throw Error('Unsupported field type: '+type);const out={name:field,label:String(f.label||field).slice(0,80),type,required:!!f.required};if(type==='select'){if(!Array.isArray(f.options)||!f.options.length||f.options.length>30)throw Error('Select needs options');out.options=[...new Set(f.options.map(v=>String(v).slice(0,80)))];}if(type==='reference'){out.collection=safeName(String(f.collection||''));}if(Object.hasOwn(f,'default'))out.default=fieldValue(out,f.default);return out;});return{name,label:String(c.label||name).slice(0,80),fields};
 });
 for(const c of collections)for(const f of c.fields)if(f.type==='reference'&&!collections.some(x=>x.name===f.collection))throw Error('Reference field targets unknown collection: '+f.collection);
 const actions=(raw.actions||[]).map(a=>{const name=safeName(String(a.name||'')),collection=safeName(String(a.collection||'')),field=safeName(String(a.field||''));const c=collections.find(x=>x.name===collection),f=c?.fields.find(x=>x.name===field);if(!c||!f||f.type!=='select')throw Error('Action must target a select field');const from=[...new Set((a.from||[]).map(String))],to=String(a.to||'');if(!to||!f.options.includes(to)||from.some(v=>!f.options.includes(v)))throw Error('Action transition uses invalid option');return{name,label:String(a.label||name).slice(0,80),collection,field,from,to};});
 if(actions.length>30||new Set(actions.map(a=>a.name)).size!==actions.length)throw Error('Actions must be unique and limited to 30');
 return raw.actions===undefined?{collections}:{collections,actions};
}
function fieldValue(field,value){
 if(value==null||value===''){if(field.required)throw Error(field.label+' is required');return field.type==='boolean'?false:null;}
 if(field.type==='boolean'){if(typeof value!=='boolean')throw Error(field.label+' must be true or false');return value;}
 if(field.type==='number'){if(typeof value==='boolean'||typeof value==='object')throw Error('Invalid number');const n=Number(value);if(!Number.isFinite(n)||Math.abs(n)>1e12)throw Error(field.label+' must be a valid number');return n;}
 if(typeof value!=='string')throw Error(field.label+' must be text');const s=value.trim();if(!s&&field.required)throw Error(field.label+' is required');if(s.length>(field.type==='textarea'?5000:500))throw Error(field.label+' is too long');
 if(field.type==='email'&&!/^\S+@\S+\.\S+$/.test(s))throw Error('Invalid email');
 if(field.type==='date'&&(!/^\d{4}-\d{2}-\d{2}$/.test(s)||new Date(s).toISOString().slice(0,10)!==s))throw Error('Invalid date');
 if(field.type==='select'&&!field.options.includes(s))throw Error('Invalid option for '+field.label);if(field.type==='reference'&&!/^[a-f0-9-]{36}$/.test(s))throw Error(field.label+' must reference a valid record');return s;
}
function recordValues(collection,raw){if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Record must be an object');const keys=new Set(collection.fields.map(f=>f.name));for(const k of Object.keys(raw))if(!keys.has(k))throw Error('Unknown field: '+k);return Object.fromEntries(collection.fields.map(f=>[f.name,fieldValue(f,Object.hasOwn(raw,f.name)?raw[f.name]:f.default)]));}
function workflowInitial(schema,collection,field){const actions=(schema.actions||[]).filter(action=>action.collection===collection.name&&action.field===field.name);return field.default??field.options.find(value=>!actions.some(action=>action.to===value))??field.options[0];}
function workflowValues(schema,collection,data,old){
 for(const field of collection.fields){const actions=(schema.actions||[]).filter(action=>action.collection===collection.name&&action.field===field.name);if(!actions.length)continue;const initial=workflowInitial(schema,collection,field);if(data[field.name]!== (old?old[field.name]:initial))throw Object.assign(Error('Use a workflow action to change '+field.label),{status:409});}return data;
}
function validateMigration(before,after){
 for(const collection of before.collections){const next=after.collections.find(c=>c.name===collection.name);if(!next)throw Error('Revision cannot remove a saved collection');for(const field of collection.fields){const f=next.fields.find(x=>x.name===field.name);if(!f||f.type!==field.type)throw Error('Revision cannot remove or change stored field types');if(f.required&&!field.required&&!Object.hasOwn(f,'default'))throw Error('Required-field change needs a default');if(field.options?.some(v=>!f.options.includes(v)))throw Error('Revision cannot remove existing options');}for(const f of next.fields)if(!collection.fields.some(x=>x.name===f.name)&&f.required&&!Object.hasOwn(f,'default'))throw Error('New required fields need defaults');}for(const action of before.actions||[]){const next=(after.actions||[]).find(item=>item.name===action.name);if(!next||['collection','field','to'].some(key=>next[key]!==action[key])||JSON.stringify(next.from)!==JSON.stringify(action.from))throw Error('Revision cannot remove or weaken existing workflow actions');}return after;
}
function readVersion(id,version,root=ROOT){if(!/^[a-z0-9-]{5,85}$/.test(id)||!Number.isInteger(Number(version))||Number(version)<1)throw Error('Invalid app version');const folder=path.join(root,id,'versions',String(version));const manifest=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'),'utf8'));return{...manifest,version:Number(version),files:Object.fromEntries(['index.html','styles.css','app.js'].map(n=>[n,fs.readFileSync(path.join(folder,n),'utf8')]))};}
function getProject(id,root=ROOT){if(!/^[a-z0-9-]{5,85}$/.test(id))throw Error('Invalid app ID');const meta=JSON.parse(fs.readFileSync(path.join(root,id,'app.json'),'utf8'));return{...meta,...readVersion(id,meta.version,root)};}
function metadata(id,root=ROOT){const {files,schema,qa,...meta}=getProject(id,root);return{...meta,qa};}
function saveMetadata(meta,root=ROOT){const folder=path.join(root,meta.id);fs.mkdirSync(folder,{recursive:true});const temp=path.join(folder,'app.json.'+crypto.randomUUID()+'.tmp');fs.writeFileSync(temp,JSON.stringify(meta,null,2));fs.renameSync(temp,path.join(folder,'app.json'));}
function patchValues(collection,old,changes){const names=new Set(collection.fields.map(f=>f.name));for(const key of Object.keys(changes))if(!names.has(key))throw Error('Unknown field: '+key);const known=Object.fromEntries(Object.entries(old).filter(([k])=>names.has(k)));return{...old,...recordValues(collection,{...known,...changes})};}
async function cloudApi(req,res,{id,route,schema,provider}){
 try{if(req.method!=='GET'&&req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return auth.send(res,403,{error:'Cross-origin write blocked'});
 if(route.startsWith('/auth/'))return auth.send(res,200,await provider.auth(req,res,id,route,auth.body));
 const session=await provider.session(req,res,id);if(!session)return auth.send(res,401,{error:'Sign in required'});
 if(route==='/schema'&&req.method==='GET')return auth.send(res,200,{schema});
 const pad=(record,collection)=>{for(const f of collection.fields)if(!Object.hasOwn(record.data,f.name))record.data[f.name]=f.default??null;return record;};
 if(route==='/dashboard'&&req.method==='GET'){const rows=await provider.records(id,session);const counts=Object.fromEntries(schema.collections.map(c=>[c.name,rows.filter(r=>r.collection===c.name).length]));return auth.send(res,200,{total:rows.length,collections:counts});}
 const actionMatch=/^\/actions\/([a-z][a-z0-9_]{0,39})\/([a-f0-9-]{36})$/.exec(route);
 if(actionMatch&&req.method==='POST'){
  const action=(schema.actions||[]).find(a=>a.name===actionMatch[1]);if(!action)return auth.send(res,404,{error:'Action not found'});
  const collection=schema.collections.find(c=>c.name===action.collection),old=(await provider.records(id,session,collection.name)).find(r=>r.id===actionMatch[2]);if(!old)return auth.send(res,404,{error:'Record not found'});
  const value=old.data[action.field];if(action.from.length&&!action.from.includes(value))return auth.send(res,409,{error:'Action not allowed from current state'});
  const record=await provider.save(id,session,collection.name,patchValues(collection,old.data,{[action.field]:action.to}),old.id);return auth.send(res,200,{record,action:{name:action.name,from:value,to:action.to}});
 }
 const match=/^\/collections\/([a-z][a-z0-9_]{0,39})(?:\/([a-f0-9-]{36}))?$/.exec(route);const collection=match&&schema.collections.find(c=>c.name===match[1]);if(!collection)return auth.send(res,404,{error:'Collection not found'});
 if(!match[2]&&req.method==='GET')return auth.send(res,200,{records:(await provider.records(id,session,collection.name)).map(r=>pad(r,collection))});
 if(!match[2]&&req.method==='POST')return auth.send(res,201,{record:await provider.save(id,session,collection.name,workflowValues(schema,collection,recordValues(collection,await auth.body(req))))});
 if(match[2]&&req.method==='PATCH'){const old=(await provider.records(id,session,collection.name)).find(r=>r.id===match[2]);if(!old)return auth.send(res,404,{error:'Record not found'});return auth.send(res,200,{record:await provider.save(id,session,collection.name,workflowValues(schema,collection,patchValues(collection,old.data,await auth.body(req)),old.data),match[2])});}
 if(match[2]&&req.method==='DELETE')return auth.send(res,200,await provider.remove(id,session,collection.name,match[2]));return auth.send(res,405,{error:'Unsupported method'});
 }catch(e){return auth.send(res,e.status||400,{error:e.message, ...(e.confirmationRequired?{confirmation_required:true}:{})});}
}
function recordsDb(root,id){const db=auth.database(root,id);db.exec('CREATE TABLE IF NOT EXISTS app_records(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),collection TEXT NOT NULL,payload TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL); CREATE INDEX IF NOT EXISTS app_record_owner ON app_records(user_id,collection);');return db;}
function rowRecord(r,collection){const data=JSON.parse(r.payload);for(const f of collection.fields)if(!Object.hasOwn(data,f.name))data[f.name]=f.default??null;return{id:r.id,data,created_at:r.created_at,updated_at:r.updated_at};}
async function api(req,res,{root=ROOT,id,route,schema,backend="sqlite",provider}){
 if(backend==="supabase")return cloudApi(req,res,{id,route,schema,provider:provider||supabase.get()});
 if(route.startsWith('/auth/'))return auth.handle(req,res,{root,id,route});
 try{
  if(req.method!=='GET'&&req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return auth.send(res,403,{error:'Cross-origin write blocked'});
  const u=auth.user(req,id);if(!u)return auth.send(res,401,{error:'Sign in required'});const db=recordsDb(root,id);
  if(route==='/schema'&&req.method==='GET')return auth.send(res,200,{schema});
  if(route==='/dashboard'&&req.method==='GET'){const counts=Object.fromEntries(schema.collections.map(c=>[c.name,db.prepare('SELECT count(*) n FROM app_records WHERE user_id=? AND collection=?').get(u.id,c.name).n]));return auth.send(res,200,{total:Object.values(counts).reduce((a,b)=>a+b,0),collections:counts});}
  const actionMatch=/^\/actions\/([a-z][a-z0-9_]{0,39})\/([a-f0-9-]{36})$/.exec(route);
  if(actionMatch&&req.method==='POST'){
   const action=(schema.actions||[]).find(a=>a.name===actionMatch[1]);if(!action)return auth.send(res,404,{error:'Action not found'});
   const collection=schema.collections.find(c=>c.name===action.collection),old=db.prepare('SELECT * FROM app_records WHERE id=? AND user_id=? AND collection=?').get(actionMatch[2],u.id,collection.name);if(!old)return auth.send(res,404,{error:'Record not found'});
   const current=JSON.parse(old.payload),value=current[action.field];if(action.from.length&&!action.from.includes(value))return auth.send(res,409,{error:'Action not allowed from current state'});
   const data=patchValues(collection,current,{[action.field]:action.to}),at=new Date().toISOString();db.prepare('UPDATE app_records SET payload=?,updated_at=? WHERE id=? AND user_id=?').run(JSON.stringify(data),at,old.id,u.id);
   return auth.send(res,200,{record:{id:old.id,data,created_at:old.created_at,updated_at:at},action:{name:action.name,from:value,to:action.to}});
  }
  const match=/^\/collections\/([a-z][a-z0-9_]{0,39})(?:\/([a-f0-9-]{36}))?$/.exec(route);if(!match)return auth.send(res,404,{error:'Endpoint not found'});const collection=schema.collections.find(c=>c.name===match[1]);if(!collection)return auth.send(res,404,{error:'Collection not found'});
  if(!match[2]&&req.method==='GET')return auth.send(res,200,{records:db.prepare('SELECT * FROM app_records WHERE user_id=? AND collection=? ORDER BY created_at DESC').all(u.id,collection.name).map(r=>rowRecord(r,collection))});
  if(!match[2]&&req.method==='POST'){const data=workflowValues(schema,collection,recordValues(collection,await auth.body(req))),rid=crypto.randomUUID(),at=new Date().toISOString();db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?,?)').run(rid,u.id,collection.name,JSON.stringify(data),at,at);return auth.send(res,201,{record:{id:rid,data,created_at:at,updated_at:at}});}
  const old=match[2]&&db.prepare('SELECT * FROM app_records WHERE id=? AND user_id=? AND collection=?').get(match[2],u.id,collection.name);if(!old)return auth.send(res,404,{error:'Record not found'});
  if(req.method==='PATCH'){const data=workflowValues(schema,collection,patchValues(collection,JSON.parse(old.payload),await auth.body(req)),JSON.parse(old.payload)),at=new Date().toISOString();db.prepare('UPDATE app_records SET payload=?,updated_at=? WHERE id=? AND user_id=?').run(JSON.stringify(data),at,old.id,u.id);return auth.send(res,200,{record:{id:old.id,data,created_at:old.created_at,updated_at:at}});}
  if(req.method==='DELETE'){db.prepare('DELETE FROM app_records WHERE id=? AND user_id=?').run(old.id,u.id);return auth.send(res,200,{ok:true});}
  return auth.send(res,405,{error:'Unsupported method'});
 }catch(e){return auth.send(res,e.status||400,{error:String(e.message||e).slice(0,200)})}
}
async function handle(req,res){const m=/^\/apps\/([a-z0-9-]{5,85})\/(.*)$/.exec(req.url.split('?')[0]);if(!m||!fs.existsSync(path.join(ROOT,m[1],'app.json')))return false;try{const meta=metadata(m[1]);let route=m[2];const preview=/^preview\/(\d+)\/(.*)$/.exec(route);const version=preview?Number(preview[1]):meta.deployed_version||(meta.status==='live'?meta.version:null);if(!version){auth.send(res,404,{error:'This app has not been deployed yet. Open its preview in Build Studio.'});return true;}if(preview)route=preview[2];const p=readVersion(meta.id,version);if(route.startsWith('api/')){await api(req,res,{id:meta.id,route:'/'+route.slice(4),schema:p.schema,backend:meta.data_backend||'sqlite'});return true;}const name=route||'index.html';if(!['index.html','styles.css','app.js'].includes(name)){res.writeHead(404);res.end('Not found');return true;}res.writeHead(200,{'Content-Type':name.endsWith('html')?'text/html':name.endsWith('css')?'text/css':'application/javascript','Cache-Control':'no-store','X-Kairoq-Version':String(version),'X-Robots-Tag':'noindex','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'self'; base-uri 'self'; form-action 'self'"});res.end(p.files[name]);return true;}catch(e){auth.send(res,503,{error:'App temporarily unavailable'});return true;}}
module.exports={ROOT,validateSchema,validateMigration,recordValues,patchValues,workflowValues,workflowInitial,getProject,readVersion,metadata,saveMetadata,recordsDb,api,handle};

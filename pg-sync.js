"use strict";
// Postgres with the same calls as node:sqlite (exec, prepare().get/all/run, close), so the code
// written for SQLite runs on Postgres unchanged. Queries go to a worker thread that holds the
// connections; this thread waits for each answer, exactly as it waits for SQLite on disk.
// The SQLite dialect Kairoq uses is translated: ? placeholders, INSERT OR IGNORE / REPLACE,
// INTEGER columns (millisecond times need 64 bits), LIKE without case, PRAGMA (dropped), and
// constraint errors keep SQLite's wording ("UNIQUE constraint failed"), which callers test for.
const path=require('path');
const {Worker,MessageChannel,receiveMessageOnPort}=require('worker_threads');

const TIMEOUT_MS=Number(process.env.KAIROQ_PG_TIMEOUT_MS||30000);
// One worker per database: Kairoq's own (DATABASE_URL) and any app database an owner connected
// (their own Supabase, see app-database.js).
const bridges=new Map();let nextHandle=1;
function url(){return String(process.env.DATABASE_URL||'').trim()}
// On when DATABASE_URL is set (Railway's Postgres) unless KAIROQ_POSTGRES=off.
function enabled(){return Boolean(url())&&process.env.KAIROQ_POSTGRES!=='off'}

function start(u=url(),ca=null){
 let bridge=bridges.get(u);
 if(bridge)return bridge;
 const {port1,port2}=new MessageChannel(),signal=new SharedArrayBuffer(4);
 const worker=new Worker(path.join(__dirname,'pg-sync-worker.js'),{workerData:{url:u,ca,port:port2,signal},transferList:[port2]});
 worker.unref();port1.unref();
 const drop=()=>{if(bridges.get(u)&&bridges.get(u).worker===worker)bridges.delete(u)};
 worker.on('error',drop);worker.on('exit',drop);
 bridge={url:u,worker,port:port1,flag:new Int32Array(signal)};bridges.set(u,bridge);
 return bridge;
}
function call(msg,u=url(),ca=null){
 const b=start(u,ca);
 Atomics.store(b.flag,0,0);
 b.port.postMessage(msg);
 if(Atomics.wait(b.flag,0,0,TIMEOUT_MS)==='timed-out'){b.worker.terminate();bridges.delete(u);throw Error('Postgres did not answer in '+TIMEOUT_MS/1000+' s')}
 const got=receiveMessageOnPort(b.port);
 if(!got)throw Error('Postgres bridge lost its answer');
 const r=got.message;
 if(!r.ok)throw pgError(r);
 return r;
}
function pgError(r){
 const what=r.table?r.table+(r.constraint?' ('+r.constraint+')':''):r.constraint||'';
 const msg=r.code==='23505'?'UNIQUE constraint failed: '+what+(r.detail?' — '+r.detail:''):r.code==='23502'?'NOT NULL constraint failed: '+what+' — '+r.message:r.code==='23503'?'FOREIGN KEY constraint failed: '+what:r.code==='23514'?'CHECK constraint failed: '+what:r.message;
 return Object.assign(Error(msg),{code:r.code,pg:true});
}

// Connection settings for a database address. Supabase signs its database certificates with
// its own root certificate (the same for every project), so a Supabase address is checked
// against that certificate: the one the owner gave with the address, else KAIROQ_SUPABASE_CA
// (the PEM text) or KAIROQ_SUPABASE_CA_FILE.
// The check is never switched off; sslmode in the address is dropped so it cannot change it.
function supabaseCa(){
 if(process.env.KAIROQ_SUPABASE_CA)return String(process.env.KAIROQ_SUPABASE_CA).replace(/\\n/g,'\n');
 const f=process.env.KAIROQ_SUPABASE_CA_FILE||path.join(__dirname,'certs','supabase-prod-ca-2021.crt');
 try{return require('fs').readFileSync(f,'utf8')}catch{return null}
}
function clientConfig(u,{ca:own=null}={}){
 let parsed;try{parsed=new URL(u)}catch{return{connectionString:u,application_name:'kairoq'}}
 if(!/\.supabase\.(co|com)$/i.test(parsed.hostname))return{connectionString:u,application_name:'kairoq'};
 parsed.searchParams.delete('sslmode');
 const ca=own||supabaseCa();
 return{connectionString:parsed.toString(),application_name:'kairoq',connectionTimeoutMillis:10000,ssl:ca?{ca,rejectUnauthorized:true}:{rejectUnauthorized:true}};
}

// ---------- SQLite → Postgres ----------
// Walks the statement outside quotes and comments.
function mapCode(sql,fn){
 let out='',i=0,code='';
 const flush=()=>{out+=fn(code);code=''};
 while(i<sql.length){
  const ch=sql[i];
  if(ch==="'"||ch==='"'){flush();let j=i+1;while(j<sql.length){if(sql[j]===ch){if(sql[j+1]===ch){j+=2;continue}break}j++}out+=sql.slice(i,j+1);i=j+1;continue}
  if(ch==='-'&&sql[i+1]==='-'){flush();const j=sql.indexOf('\n',i);i=j<0?sql.length:j;continue}
  if(ch==='/'&&sql[i+1]==='*'){flush();const j=sql.indexOf('*/',i+2);i=j<0?sql.length:j+2;continue}
  code+=ch;i++;
 }
 flush();return out;
}
function translate(sql){
 let n=0,replace=null,ignore=false;
 let text=mapCode(String(sql),c=>{
  c=c.replace(/\?/g,()=>'$'+(++n));
  c=c.replace(/\bPRAGMA\b[^;]*;?/gi,'');
  if(/\b(CREATE\s+TABLE|ALTER\s+TABLE)\b/i.test(c)){
   c=c.replace(/\bINTEGER\s+PRIMARY\s+KEY(\s+AUTOINCREMENT)?\b/gi,'BIGSERIAL PRIMARY KEY').replace(/\bINTEGER\b/gi,'BIGINT').replace(/\bREAL\b/gi,'DOUBLE PRECISION').replace(/\bBLOB\b/gi,'BYTEA')
    .replace(/\bADD\s+COLUMN\s+(?!IF\b)/gi,'ADD COLUMN IF NOT EXISTS ');
  }
  c=c.replace(/\bIFNULL\s*\(/gi,'COALESCE(').replace(/\bNOT\s+LIKE\b/gi,'NOT ILIKE').replace(/(?<!NOT\s+|\(\s*)\bLIKE\b/gi,'ILIKE');
  c=c.replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/gi,()=>{ignore=true;return'INSERT INTO'});
  c=c.replace(/\bINSERT\s+OR\s+REPLACE\s+INTO\b/gi,()=>{replace=true;return'INSERT INTO'});
  return c;
 });
 text=text.trim().replace(/;\s*$/,'');
 if(replace){const m=text.match(/^INSERT INTO\s+"?([A-Za-z_][A-Za-z0-9_]*)"?\s*\(([^)]*)\)/i);replace=m?{table:m[1],columns:m[2].split(',').map(s=>s.trim().replace(/"/g,''))}:null}
 if(ignore&&!/\bON\s+CONFLICT\b/i.test(text))text+=' ON CONFLICT DO NOTHING';
 return{text,replace,count:n};
}
const cache=new Map();
function translated(sql){let t=cache.get(sql);if(!t){t=translate(sql);if(cache.size>2000)cache.clear();cache.set(sql,t)}return t}
function values(args){return args.map(v=>v===undefined?null:typeof v==='boolean'?(v?1:0):v)}

// A database handle: schema null is the public schema (Kairoq's own tables); a schema name
// keeps one app's tables apart from every other app's.
// KAIROQ_PG_NAMESPACE keeps several Kairoq servers (staging and live, or test runs) apart in
// one database: Kairoq's tables go to schema <ns>, an app's to <ns>_app_<id>.
// "auto" gives each process its own (separate test runs).
const AUTO='t'+require('crypto').randomBytes(5).toString('hex');
function namespace(){const v=String(process.env.KAIROQ_PG_NAMESPACE||'').toLowerCase(),n=v==='auto'?AUTO:v;return /^[a-z][a-z0-9_]{0,15}$/.test(n)?n:''}
function schemaName(name){const n=namespace();return n?n+'_'+name:name}
// url: another database (an app's own Supabase); its schema is used as given, without namespace.
class Database{
 constructor({schema=null,url:u=null,ca=null}={}){this.url=u||url();this.ca=ca;this.external=Boolean(u);this.handle={id:nextHandle++,schema:schema||(u?null:namespace())||null};this.open=true}
 exec(sql){
  const t=translated(sql);
  if(t.text)call({op:'exec',handle:this.handle,sql:t.text},this.url,this.ca);
 }
 prepare(sql){
  const t=translated(sql),h=this.handle;
  const q=args=>call({op:'query',handle:h,sql:t.text,params:values(args),replace:t.replace},this.url,this.ca);
  return{
   get:(...a)=>{const r=q(a);return r.rows[0]},
   all:(...a)=>q(a).rows,
   run:(...a)=>{const r=q(a);return{changes:r.changes,lastInsertRowid:r.rows&&r.rows[0]&&r.rows[0].id!==undefined?r.rows[0].id:undefined}},
  };
 }
 close(){if(!this.open)return;this.open=false;try{call({op:'close',handle:this.handle},this.url,this.ca)}catch{}}
}
function open(opts){return new Database(opts)}

// Copies tables from a SQLite file into Postgres once (the file stays as it is, as a backup).
// Done tables are remembered in _kairoq_migrations, so a restart never copies twice.
// Without a list, every table in the file is copied; a table Postgres does not have yet is made
// from the file's own CREATE TABLE.
function copyFromSqlite(file,db,{tables,key}){
 const fs=require('fs');
 db.exec('CREATE TABLE IF NOT EXISTS _kairoq_migrations(key TEXT PRIMARY KEY,at TEXT NOT NULL,rows BIGINT NOT NULL)');
 if(db.prepare('SELECT key FROM _kairoq_migrations WHERE key=?').get(key))return null;
 let copied=0;
 if(fs.existsSync(file)){
  const {DatabaseSync}=require('node:sqlite');
  const src=new DatabaseSync(file,{readOnly:true});
  try{
   db.exec('BEGIN');
   try{
    // Full-text (FTS5) tables are copied by rows into the table the caller made for them; their
    // internal tables (name_data, name_idx, ...) are not copied.
    const all=src.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
    const virtual=all.filter(t=>/^CREATE VIRTUAL/i.test(t.sql||'')).map(t=>t.name);
    const inFile=all.filter(t=>!virtual.some(v=>t.name.startsWith(v+'_')&&/^(data|idx|content|docsize|config)$/.test(t.name.slice(v.length+1))));
    for(const table of tables||inFile.map(t=>t.name)){
     const def=inFile.find(t=>t.name===table);
     if(!def)continue;
     const columns=()=>new Set(db.prepare('SELECT column_name FROM information_schema.columns WHERE table_name=? AND table_schema=current_schema()').all(table).map(r=>r.column_name));
     let target=columns();
     if(!target.size&&virtual.includes(table))continue;
     if(!target.size&&def.sql){db.exec(def.sql.replace(/^CREATE TABLE\s+(?!IF)/i,'CREATE TABLE IF NOT EXISTS '));target=columns()}
     for(const row of src.prepare('SELECT * FROM "'+table+'"').all()){
      const cols=Object.keys(row).filter(c=>target.has(c));
      if(!cols.length)continue;
      db.prepare('INSERT OR IGNORE INTO "'+table+'"('+cols.map(c=>'"'+c+'"').join(',')+') VALUES('+cols.map(()=>'?').join(',')+')').run(...cols.map(c=>row[c]));
      copied++;
     }
    }
    db.prepare('INSERT INTO _kairoq_migrations(key,at,rows) VALUES(?,?,?)').run(key,new Date().toISOString(),copied);
    db.exec('COMMIT');
   }catch(e){db.exec('ROLLBACK');throw e}
  }finally{src.close()}
 }else db.prepare('INSERT INTO _kairoq_migrations(key,at,rows) VALUES(?,?,?)').run(key,new Date().toISOString(),0);
 return{copied};
}
// The other way, for backups: the tables' rows written to a new SQLite file.
function exportToSqlite(db,file,tables){
 const fs=require('fs'),{DatabaseSync}=require('node:sqlite');
 if(fs.existsSync(file))fs.rmSync(file);
 const out=new DatabaseSync(file);
 try{
  out.exec('BEGIN');
  for(const table of tables||db.prepare("SELECT table_name FROM information_schema.tables WHERE table_schema=current_schema() AND table_type='BASE TABLE' ORDER BY table_name").all().map(r=>r.table_name)){
   const cols=db.prepare('SELECT column_name FROM information_schema.columns WHERE table_name=? AND table_schema=current_schema() ORDER BY ordinal_position').all(table).map(r=>r.column_name);
   if(!cols.length)continue;
   out.exec('CREATE TABLE "'+table+'"('+cols.map(c=>'"'+c+'"').join(',')+')');
   const ins=out.prepare('INSERT INTO "'+table+'" VALUES('+cols.map(()=>'?').join(',')+')');
   for(const row of db.prepare('SELECT * FROM "'+table+'"').all())ins.run(...cols.map(c=>row[c]??null));
  }
  out.exec('COMMIT');
 }finally{out.close()}
}
module.exports={clientConfig,enabled,open,translate,copyFromSqlite,exportToSqlite,schemaName,namespace,Database};

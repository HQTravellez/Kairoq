"use strict";
// SQL tables for generated apps. Each project gets its own SQLite file (app-sql.sqlite),
// separate from the built-in users/records database. Tables come from migration files
// (sql/001_init.sql, sql/002_add_orders.sql, ...) applied in order and never edited
// after they run. Server functions query with db.sql; queries run inside the function
// worker, so a slow query is stopped by the function time limit.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {DatabaseSync}=require('node:sqlite');

const MIGRATION_PATH=/^sql\/(\d{3})_[a-z0-9_]{1,40}\.sql$/;
const MAX_ROWS=1000,MAX_PARAMS=100,MAX_QUERY=20000;
const BANNED=/\b(ATTACH|DETACH|PRAGMA|VACUUM|REINDEX|LOAD_EXTENSION|BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)\b/i;

function fail(status,message){return Object.assign(Error(message),{status})}
function file(projectDir){return path.join(projectDir,'app-sql.sqlite')}
function maxBytes(){const mb=Number(process.env.KAIROQ_APP_SQL_MB||200);return(Number.isFinite(mb)&&mb>0?mb:200)*1024*1024}

// Removes string literals, quoted identifiers and comments so keyword checks only see SQL.
function strip(sql){
 let out='',i=0;const s=String(sql);
 while(i<s.length){
  const c=s[i],n=s[i+1];
  if(c==='-'&&n==='-'){const e=s.indexOf('\n',i);i=e<0?s.length:e;out+=' ';continue}
  if(c==='/'&&n==='*'){const e=s.indexOf('*/',i+2);if(e<0)throw fail(400,'Unclosed /* comment in SQL');i=e+2;out+=' ';continue}
  if(c==="'"||c==='"'||c==='`'||c==='['){
   const close=c==='['?']':c;let j=i+1;
   for(;;){if(j>=s.length)throw fail(400,'Unclosed quote in SQL');if(s[j]===close){if(close!==']'&&s[j+1]===close){j+=2;continue}break}j++}
   out+=c==="'"?" '' ":' _q_ ';i=j+1;continue;
  }
  out+=c;i++;
 }
 return out;
}
function statementCount(stripped){return stripped.split(';').filter(p=>p.trim()).length}
function check(sql,{multiple=false}={}){
 const text=String(sql||'');
 if(!text.trim())throw fail(400,'Empty SQL');
 if(text.length>(multiple?100000:MAX_QUERY))throw fail(400,'SQL is too long');
 const bare=strip(text);
 const m=BANNED.exec(bare);
 if(m)throw fail(400,m[1].toUpperCase()+' is not allowed in app SQL');
 if(/\bpragma_\w+/i.test(bare))throw fail(400,'pragma functions are not allowed in app SQL');
 if(/\b_kairoq_\w*/i.test(bare))throw fail(400,'Tables starting with _kairoq_ are reserved');
 if(!multiple&&statementCount(bare)>1)throw fail(400,'Run one SQL statement at a time (use db.batch for several)');
 return bare;
}
// Static checks for migration files, run with the rest of the project validation.
function validate(files){
 const errors=[];
 for(const [name,code] of Object.entries(files)){
  if(!name.startsWith('sql/'))continue;
  if(!MIGRATION_PATH.test(name)){errors.push(name+': migrations must be named sql/001_description.sql (three digits, lowercase).');continue}
  try{check(code,{multiple:true})}catch(e){errors.push(name+': '+e.message)}
 }
 const numbers=Object.keys(files).filter(n=>MIGRATION_PATH.test(n)).map(n=>MIGRATION_PATH.exec(n)[1]);
 const dup=numbers.find((n,i)=>numbers.indexOf(n)!==i);
 if(dup)errors.push('Two migrations use the number '+dup+'; each sql/ file needs its own number.');
 return errors;
}
function migrations(files){return Object.keys(files).filter(n=>MIGRATION_PATH.test(n)).sort()}

const conns=new Map();
function open(projectDir){
 const f=file(projectDir);
 let db=conns.get(f);
 if(db)return db;
 fs.mkdirSync(projectDir,{recursive:true});
 db=new DatabaseSync(f);
 const page=db.prepare('PRAGMA page_size').get().page_size||4096;
 db.exec('PRAGMA journal_mode=WAL;PRAGMA foreign_keys=ON;PRAGMA busy_timeout=3000;PRAGMA trusted_schema=OFF;PRAGMA max_page_count='+Math.floor(maxBytes()/page)+';');
 db.exec('CREATE TABLE IF NOT EXISTS _kairoq_migrations(name TEXT PRIMARY KEY,sha TEXT NOT NULL,applied_at TEXT NOT NULL)');
 if(conns.size>=50){const [k,old]=conns.entries().next().value;try{old.close()}catch{}conns.delete(k)}
 conns.set(f,db);
 return db;
}
function close(projectDir){const f=file(projectDir),db=conns.get(f);if(db){try{db.close()}catch{}conns.delete(f)}}
function exists(projectDir){return fs.existsSync(file(projectDir))}

// Applies migrations that have not run yet. Applied migrations must not change.
function migrate(projectDir,files){
 const names=migrations(files);
 if(!names.length&&!exists(projectDir))return{applied:[]};
 const db=open(projectDir);
 const done=new Map(db.prepare('SELECT name,sha FROM _kairoq_migrations').all().map(r=>[r.name,r.sha]));
 const applied=[];
 for(const name of names){
  const sha=crypto.createHash('sha256').update(files[name]).digest('hex');
  if(done.has(name)){
   if(done.get(name)!==sha)throw fail(400,name+' has already been applied to the database and cannot be changed. Add a new migration (for example sql/'+String(Number(names.at(-1).slice(4,7))+1).padStart(3,'0')+'_change.sql) instead.');
   continue;
  }
  check(files[name],{multiple:true});
  db.exec('BEGIN');
  try{db.exec(files[name]);db.prepare('INSERT INTO _kairoq_migrations(name,sha,applied_at) VALUES(?,?,?)').run(name,sha,new Date().toISOString());db.exec('COMMIT')}
  catch(e){try{db.exec('ROLLBACK')}catch{}throw fail(400,name+' failed: '+String(e.message).replace(/^.*?:\s*/,'').slice(0,300))}
  applied.push(name);
 }
 return{applied,pending:[...done.keys()].filter(n=>!names.includes(n))};
}

function param(v){
 if(v===null||v===undefined)return null;
 if(typeof v==='boolean')return v?1:0;
 if(typeof v==='number'){if(!Number.isFinite(v))throw fail(400,'SQL parameters must be finite numbers');return v}
 if(typeof v==='string')return v.length>1000000?v.slice(0,1000000):v;
 return JSON.stringify(v);
}
function params(list){
 const arr=Array.isArray(list)?list:list===undefined||list===null?[]:[list];
 if(arr.length>MAX_PARAMS)throw fail(400,'At most '+MAX_PARAMS+' SQL parameters');
 return arr.map(param);
}
function readsRows(stmt,bare){return stmt.columns?stmt.columns().length>0:/^\s*(SELECT|WITH|VALUES)\b|\bRETURNING\b/i.test(bare)}
function plain(row){const o={};for(const [k,v] of Object.entries(row))o[k]=typeof v==='bigint'?Number(v):v instanceof Uint8Array?Buffer.from(v).toString('base64'):v;return o}
function runOne(db,sql,list){
 const bare=check(sql);
 let stmt;
 try{stmt=db.prepare(sql)}catch(e){throw fail(400,'SQL error: '+e.message)}
 const values=params(list);
 try{
  if(readsRows(stmt,bare)){
   const rows=[];
   for(const row of stmt.iterate(...values)){rows.push(plain(row));if(rows.length>MAX_ROWS)throw fail(400,'Query returned more than '+MAX_ROWS+' rows; add LIMIT')}
   return rows;
  }
  const r=stmt.run(...values);
  return{changes:Number(r.changes),lastInsertRowid:Number(r.lastInsertRowid)};
 }catch(e){if(e.status)throw e;throw fail(/FULL|full/.test(e.message)?507:400,/FULL|full/.test(e.message)?'The app database is full ('+Math.round(maxBytes()/1048576)+' MB limit)':'SQL error: '+e.message)}
}
function query(projectDir,sql,list){return runOne(open(projectDir),sql,list)}
// Runs several statements in one transaction: [[sql, params], ...].
function batch(projectDir,steps){
 if(!Array.isArray(steps)||!steps.length||steps.length>100)throw fail(400,'db.batch takes 1 to 100 statements');
 const db=open(projectDir);
 db.exec('BEGIN IMMEDIATE');
 try{const out=steps.map(s=>Array.isArray(s)?runOne(db,s[0],s[1]):runOne(db,s&&s.sql,s&&s.params));db.exec('COMMIT');return out}
 catch(e){try{db.exec('ROLLBACK')}catch{}throw e}
}
// Owner view: tables, columns and the first rows of each.
function overview(projectDir,{rows=50}={}){
 if(!exists(projectDir))return{tables:[],migrations:[]};
 const db=open(projectDir);
 const tables=db.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_kairoq_%' ORDER BY name").all();
 return{
  tables:tables.map(t=>{
   const q='"'+t.name.replace(/"/g,'""')+'"';
   return{name:t.name,columns:db.prepare('SELECT name,type,pk,"notnull" AS required FROM pragma_table_info(?)').all(t.name).map(plain),count:Number(db.prepare('SELECT COUNT(*) n FROM '+q).get().n),rows:db.prepare('SELECT * FROM '+q+' LIMIT ?').all(rows).map(plain),foreign_keys:db.prepare('SELECT "table" AS ref,"from" AS col,"to" AS ref_col FROM pragma_foreign_key_list(?)').all(t.name).map(plain)};
  }),
  migrations:db.prepare('SELECT name,applied_at FROM _kairoq_migrations ORDER BY name').all().map(plain)
 };
}
module.exports={validate,migrate,query,batch,overview,check,strip,open,close,file,exists,migrations,MIGRATION_PATH};

// ---------- process pool (main thread) ----------
// Queries run in child processes (KAIROQ_SQL_PROCESSES, default 2). A query that runs
// longer than KAIROQ_SQL_TIMEOUT_MS (default 5000) has its process killed and replaced.
const pool={procs:[],queue:[],seq:0};
function poolSize(){const n=Number(process.env.KAIROQ_SQL_PROCESSES??2);return Number.isInteger(n)&&n>=1?Math.min(n,8):2}
function sqlTimeout(){const n=Number(process.env.KAIROQ_SQL_TIMEOUT_MS||5000);return Number.isFinite(n)&&n>=100?Math.min(n,60000):5000}
function spawnProc(){
 const p={child:require('child_process').fork(path.join(__dirname,'sql-process.js'),[],{stdio:['ignore','ignore','inherit','ipc'],execArgv:['--no-warnings']}),job:null};
 p.child.unref();p.child.channel?.unref?.();
 p.child.on('message',msg=>{const job=p.job;if(!job||msg.id!==job.id)return;clearTimeout(job.timer);p.job=null;idle(p);msg.ok?job.resolve(msg.value):job.reject(fail(msg.status,msg.message));pumpSql()});
 p.child.on('exit',()=>{const i=pool.procs.indexOf(p);if(i>=0)pool.procs.splice(i,1);if(p.job){clearTimeout(p.job.timer);const j=p.job;p.job=null;j.reject(fail(500,'The SQL process stopped'))}pumpSql()});
 pool.procs.push(p);
 return p;
}
function idle(p){p.child.unref();p.child.channel?.unref?.()}
function pumpSql(){
 while(pool.queue.length){
  let p=pool.procs.find(x=>!x.job&&x.child.connected);
  if(!p&&pool.procs.length<poolSize())p=spawnProc();
  if(!p)return;
  const job=pool.queue.shift();job.id=++pool.seq;p.job=job;
  p.child.ref();p.child.channel?.ref?.();
  job.timer=setTimeout(()=>{if(p.job!==job)return;p.job=null;const i=pool.procs.indexOf(p);if(i>=0)pool.procs.splice(i,1);p.child.kill('SIGKILL');job.reject(fail(504,'SQL query took longer than '+Math.round(job.limit/1000)+' seconds and was stopped'));pumpSql()},job.limit);
  p.child.send({...job.msg,id:job.id});
 }
}
function remote(msg,limit=sqlTimeout()){
 return new Promise((resolve,reject)=>{
  if(pool.queue.length>=200)return reject(fail(503,'The database is busy. Try again shortly.'));
  pool.queue.push({msg,limit,resolve,reject});pumpSql();
 });
}
module.exports.run={
 query:(dir,sql,params)=>remote({op:'query',dir,sql,params}),
 batch:(dir,steps)=>remote({op:'batch',dir,steps}),
 migrate:(dir,files)=>migrations(files).length||exists(dir)?remote({op:'migrate',dir,files},60000):Promise.resolve({applied:[]})
};
module.exports.closeEverywhere=dir=>{close(dir);for(const p of pool.procs)if(p.child.connected)p.child.send({op:'close',dir,id:-1})};
module.exports.poolStats=()=>({processes:pool.procs.length,busy:pool.procs.filter(p=>p.job).length,queued:pool.queue.length,max:poolSize()});

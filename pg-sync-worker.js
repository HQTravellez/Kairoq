"use strict";
// The Postgres side of pg-sync.js: one connection per database handle, queries run one at a
// time in the order they arrive. Each answer is posted back, then the waiting thread is woken.
const {workerData}=require('worker_threads');
const pg=require('pg');
// Counts and ids come back as numbers, as they do from SQLite (they stay far below 2^53).
pg.types.setTypeParser(20,v=>Number(v));
pg.types.setTypeParser(1700,v=>Number(v));
const {url,port,signal}=workerData;
const flag=new Int32Array(signal);
const clients=new Map(),primaryKeys=new Map();

async function client(handle){
 let c=clients.get(handle.id);
 if(c)return c;
 c=new pg.Client({connectionString:url,application_name:'kairoq'});
 c.on('error',()=>{if(clients.get(handle.id)===c)clients.delete(handle.id)});
 await c.connect();
 if(handle.schema){await c.query('CREATE SCHEMA IF NOT EXISTS '+ident(handle.schema));await c.query('SET search_path TO '+ident(handle.schema))}
 clients.set(handle.id,c);
 return c;
}
function ident(s){if(!/^[a-z_][a-z0-9_]{0,62}$/.test(s))throw Error('Bad schema name');return '"'+s+'"'}
// INSERT OR REPLACE needs the table's primary key to say what conflicts.
async function keyOf(c,handle,table){
 const k=(handle.schema||'public')+'.'+table;
 if(primaryKeys.has(k))return primaryKeys.get(k);
 const r=await c.query(`SELECT a.attname FROM pg_index i JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=ANY(i.indkey)
  WHERE i.indrelid=to_regclass($1) AND i.indisprimary`,[(handle.schema?'"'+handle.schema+'".':'')+'"'+table+'"']);
 const cols=r.rows.map(x=>x.attname);primaryKeys.set(k,cols);return cols;
}
async function run(msg){
 const c=await client(msg.handle);
 if(msg.op==='close'){clients.delete(msg.handle.id);await c.end().catch(()=>{});return{}}
 let sql=msg.sql;
 if(msg.replace){
  const cols=await keyOf(c,msg.handle,msg.replace.table);
  if(!cols.length)throw Error('INSERT OR REPLACE needs a primary key on '+msg.replace.table);
  const set=msg.replace.columns.filter(x=>!cols.includes(x)).map(x=>'"'+x+'"=EXCLUDED."'+x+'"');
  sql+=' ON CONFLICT ('+cols.map(x=>'"'+x+'"').join(',')+') '+(set.length?'DO UPDATE SET '+set.join(','):'DO NOTHING');
 }
 if(msg.op==='exec'){await c.query(sql);return{}}
 const r=await c.query({text:sql,values:msg.params});
 return{rows:r.rows,changes:r.rowCount??0};
}
port.on('message',async msg=>{
 let reply;
 try{reply={ok:true,...await run(msg)}}
 catch(e){reply={ok:false,message:e.message,code:e.code,detail:e.detail,constraint:e.constraint,table:e.table}}
 port.postMessage(reply);
 Atomics.store(flag,0,1);Atomics.notify(flag,0);
});

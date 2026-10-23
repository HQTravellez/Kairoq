"use strict";
// Ask your data: the app owner asks in plain words ("bookings next week by room", "which dish
// sold most this month") and gets an answer, the rows behind it and the query that found them.
// The model writes one read-only query; it runs on a read-only connection to the app's saved
// records (data.sqlite) or its SQL tables (app-sql.sqlite), never on visitors' passwords or
// sessions, and is cut at 200 rows.
const path=require('path'),fs=require('fs');
const {DatabaseSync}=require('node:sqlite');
const builder=require('./react-builder');
function fail(status,message){return Object.assign(Error(message),{status})}
function clip(v,n){return String(v??'').replace(/\s+/g,' ').trim().slice(0,n)}

function openRO(file){return fs.existsSync(file)?new DatabaseSync(file,{readOnly:true}):null}
// The records to ask about. With Postgres on they are copied into a SQLite database in memory
// for the question, so the query language stays the same and nothing but records is there.
function recordsDb(id){
 if(!require('./pg-sync').enabled())return openRO(path.join(builder.projectDir(id),'data.sqlite'));
 const mem=new DatabaseSync(':memory:');
 mem.exec('CREATE TABLE records(id TEXT PRIMARY KEY,collection TEXT NOT NULL,owner_id TEXT,data TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)');
 const ins=mem.prepare('INSERT INTO records VALUES(?,?,?,?,?,?)');
 mem.exec('BEGIN');
 for(const r of require('./react-backend').database(id).prepare('SELECT id,collection,owner_id,data,created_at,updated_at FROM records ORDER BY created_at DESC LIMIT 100000').all())ins.run(r.id,r.collection,r.owner_id,r.data,r.created_at,r.updated_at);
 mem.exec('COMMIT');
 return mem;
}
// What the model is told about the data: each collection with its fields, each SQL table with
// its columns, a few values as examples.
function describe(id){
 const dir=builder.projectDir(id),out={collections:[],tables:[]};
 const rec=recordsDb(id);
 if(rec){try{
  for(const c of rec.prepare('SELECT collection,COUNT(*) n FROM records GROUP BY collection ORDER BY n DESC LIMIT 30').all()){
   const keys=new Map();
   for(const r of rec.prepare('SELECT data FROM records WHERE collection=? ORDER BY created_at DESC LIMIT 40').all(c.collection)){let d;try{d=JSON.parse(r.data)}catch{continue}for(const [k,v] of Object.entries(d||{}))if(!keys.has(k)&&k.length<40)keys.set(k,clip(typeof v==='object'?JSON.stringify(v):v,40))}
   out.collections.push({name:c.collection,count:Number(c.n),fields:[...keys].slice(0,30)});
  }
 }catch{}finally{rec.close()}}
 const sql=openRO(path.join(dir,'app-sql.sqlite'));
 if(sql){try{
  for(const t of sql.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_kairoq_%' ORDER BY name LIMIT 40").all())
   out.tables.push({name:t.name,count:Number(sql.prepare('SELECT COUNT(*) n FROM "'+t.name.replace(/"/g,'""')+'"').get().n),columns:sql.prepare('SELECT name,type FROM pragma_table_info(?)').all(t.name).map(c=>c.name+(c.type?' '+c.type.toLowerCase():''))});
 }catch{}finally{sql.close()}}
 return out;
}
const WRITE=`You write ONE read-only SQLite query that answers an app owner's question about their app's data.
Two databases (use exactly one):
- "records": table records(id, collection, owner_id, data, created_at, updated_at). data is JSON: read fields with json_extract(data,'$.field'). Filter by collection='name'. created_at is an ISO timestamp.
- "tables": the app's own SQL tables listed below.
Today is %TODAY%. Respond with ONLY JSON: {"db":"records"|"tables","sql":"SELECT ...","note":"one short sentence on what the query counts"}
Rules: SELECT or WITH only; one statement; name result columns readably (AS "Room"); use GROUP BY and ORDER BY for summaries; at most 200 rows.`;
const ANSWER=`You answer an app owner's question about their data in one to three plain sentences, from the query result below (the rows are the truth; do not invent). Mention the key numbers. If the result is empty, say so plainly.`;
const FORBIDDEN=/\b(insert|update|delete|drop|alter|create|replace|attach|detach|pragma|vacuum|reindex|analyze|begin|commit|rollback|savepoint|release|load_extension)\b/i;
function safeSql(sql,db){
 const strip=require('./react-sql').strip,q=String(sql||'').trim().replace(/;\s*$/,'');
 const bare=strip(q);
 if(!/^\s*(select|with)\b/i.test(bare))throw fail(422,'The query was not a read-only SELECT');
 if(bare.includes(';')||FORBIDDEN.test(bare))throw fail(422,'The query tried to do more than read');
 // Visitors' passwords, sessions and tokens are never part of the answer.
 if(db==='records'&&/\b(users|sessions|app_tokens|password|token_hash|email_log)\b/i.test(bare))throw fail(422,'That data is private to the app\'s visitors');
 return q;
}
function json(text){const t=String(text||'');const a=t.indexOf('{'),b=t.lastIndexOf('}');if(a<0||b<=a)throw fail(502,'The AI did not write a query. Try asking another way.');return JSON.parse(t.slice(a,b+1))}
// aiCall: react-backend's appAi for this app (billed like the app's AI).
async function ask(id,question,aiCall,{now=new Date()}={}){
 const q=clip(question,500);if(q.length<4)throw fail(400,'Ask a question about your data, e.g. "bookings next week by room".');
 const d=describe(id);
 if(!d.collections.length&&!d.tables.length)throw fail(404,'This app has no saved data yet.');
 const schema=[...d.collections.map(c=>'records collection "'+c.name+'" ('+c.count+' records), fields: '+c.fields.map(([k,v])=>k+(v?' e.g. '+JSON.stringify(v):'')).join(', ')),...d.tables.map(t=>'tables: '+t.name+' ('+t.count+' rows): '+t.columns.join(', '))].join('\n');
 let plan,rows,err='';
 for(let attempt=0;attempt<2;attempt++){
  plan=json((await aiCall({system:WRITE.replace('%TODAY%',now.toISOString().slice(0,10)),messages:[{role:'user',content:'Data:\n'+schema+'\n\nQuestion: '+q+(err?'\n\nThe last query failed: '+err+'. Write a corrected one.':'')}],max_tokens:600})).text);
  const db=plan.db==='tables'?'tables':'records';
  try{
   const sql=safeSql(plan.sql,db);
   const conn=db==='tables'?openRO(path.join(builder.projectDir(id),'app-sql.sqlite')):recordsDb(id);
   if(!conn)throw fail(404,'No '+(db==='tables'?'SQL tables':'saved records')+' yet');
   try{rows=conn.prepare('SELECT * FROM ('+sql+') LIMIT 200').all().map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,typeof v==='bigint'?Number(v):v])))}finally{conn.close()}
   plan={db,sql,note:clip(plan.note,200)};err='';break;
  }catch(e){err=clip(e.message,200);if(e.status===422&&/private|more than read/.test(e.message))throw e}
 }
 if(err)throw fail(422,'Could not answer that from your data ('+err+'). Try asking another way.');
 const answer=clip((await aiCall({system:ANSWER,messages:[{role:'user',content:'Question: '+q+'\nWhat the query counts: '+plan.note+'\nRows ('+rows.length+(rows.length===200?', cut at 200':'')+'):\n'+JSON.stringify(rows.slice(0,60)).slice(0,12000)}],max_tokens:300})).text,800);
 return{answer,rows,sql:plan.sql,db:plan.db,note:plan.note};
}
module.exports={ask,describe,safeSql};

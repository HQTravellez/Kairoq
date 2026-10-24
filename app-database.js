"use strict";
// An app's data in the owner's own Supabase. The owner pastes their Supabase database address
// (Project Settings → Database → Connection string) and Supabase's SSL certificate; from then on
// the app's sign-ups, sessions and collections live in a schema of their own Supabase
// (kairoq_<project id>), where they can see, export and back it up. SQL tables (react-sql.js)
// stay in Kairoq for now.
// Connecting copies the app's current data across once. Disconnecting leaves the data in
// Supabase and goes back to Kairoq's own copy as it was when Supabase was connected.
const fs=require('fs'),os=require('os'),path=require('path');
const builder=require('./react-builder');

const HOST=/^(db\.[a-z0-9]{20}\.supabase\.co|[a-z0-9-]+\.pooler\.supabase\.com)$/i;
// Tests run against a local Postgres named in KAIROQ_TEST_APP_DB_HOSTS (never outside tests).
function testHost(h){return process.env.NODE_ENV==='test'&&String(process.env.KAIROQ_TEST_APP_DB_HOSTS||'').split(',').includes(h)}
function fail(status,message){return Object.assign(Error(message),{status})}
function secrets(){return require('./project-secrets')}

// Checks an address and keeps only what is needed. Only Supabase hosts are accepted, so the
// server never connects to an address of the owner's choosing anywhere else.
function parse(raw){
 let u;
 try{u=new URL(String(raw||'').trim())}catch{throw fail(400,'Paste the connection string from Supabase: it starts with postgresql://')}
 if(!/^postgres(ql)?:$/.test(u.protocol))throw fail(400,'Paste the connection string from Supabase: it starts with postgresql://');
 if(!HOST.test(u.hostname)&&!testHost(u.hostname))throw fail(400,'Only Supabase databases can be connected (the address ends in supabase.co or pooler.supabase.com).');
 if(!u.password||/YOUR-PASSWORD/i.test(decodeURIComponent(u.password)))throw fail(400,'Put your database password in the address in place of [YOUR-PASSWORD].');
 if(u.port&&!['5432','6543'].includes(u.port)&&!testHost(u.hostname))throw fail(400,'Use port 5432 (session) or 6543 (transaction) from Supabase.');
 // The transaction pooler (6543) does not keep a session's search_path, which Kairoq needs.
 if(u.port==='6543')throw fail(400,'Use the "Session pooler" or "Direct connection" address (port 5432), not the transaction pooler (6543).');
 u.searchParams.delete('sslmode');
 const ref=(/^db\.([a-z0-9]{20})\./i.exec(u.hostname)||[])[1]||(/^postgres\.([a-z0-9]{20})$/i.exec(decodeURIComponent(u.username))||[])[1]||'';
 return{url:u.toString(),host:u.hostname,ref,database:u.pathname.slice(1)||'postgres'};
}
function parseCa(raw){
 const t=String(raw||'').trim();
 if(!t)return null;
 if(!/^-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----$/.test(t)||t.length>20000)throw fail(400,'The certificate should be the text of prod-ca-2021.crt from Supabase, starting with -----BEGIN CERTIFICATE-----');
 return t;
}
function schema(id){return'kairoq_'+String(id).toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,40)}

// The address for an app's data, or null when it uses Kairoq's own storage.
function connection(id){
 try{
  const meta=builder.loadMeta(id);if(!meta.database||meta.database.provider!=='supabase')return null;
  const url=secrets().get(id,'supabase_db_url');if(!url)return null;
  return{url,ca:secrets().get(id,'supabase_db_ca'),schema:schema(id)};
 }catch{return null}
}
function status(id){
 const d=builder.loadMeta(id).database;
 if(!d)return{connected:false};
 return{connected:true,provider:d.provider,host:d.host,ref:d.ref,schema:d.schema,connected_at:d.connected_at,copied:d.copied||0,
  dashboard:d.ref?'https://supabase.com/dashboard/project/'+d.ref+'/editor':'https://supabase.com/dashboard'};
}

// Opens a connection once to check the address, the password and the certificate.
async function check(conn){
 const pg=require('pg'),c=new pg.Client(require('./pg-sync').clientConfig(conn.url,{ca:conn.ca}));
 try{
  await c.connect();
  const r=await c.query('SELECT current_user AS who, version() AS version');
  return{who:r.rows[0].who,version:String(r.rows[0].version).split(' ').slice(0,2).join(' ')};
 }catch(e){
  const m=String(e.message||e);
  if(/password authentication failed/i.test(m))throw fail(400,'Supabase did not accept the password in that address.');
  if(/self[- ]signed|unable to verify|certificate/i.test(m))throw fail(400,'The secure connection could not be checked. Download the SSL certificate in Supabase (Project Settings → Database → SSL Configuration) and paste it here.');
  if(/ENOTFOUND|getaddrinfo/i.test(m))throw fail(400,'That Supabase address was not found. Copy it again from Supabase.');
  if(/ENETUNREACH|EHOSTUNREACH|timeout/i.test(m))throw fail(400,'Supabase did not answer. If you used the "Direct connection" address, try the "Session pooler" one (it works over IPv4).');
  throw fail(400,'Could not connect to Supabase: '+m.slice(0,200));
 }finally{await c.end().catch(()=>{})}
}

// Moves the app's data to the owner's Supabase. `checkFn` is replaceable in tests.
async function connect(id,{url,ca},{checkFn=check}={}){
 const target={...parse(url),ca:parseCa(ca)};
 const info=await checkFn(target);
 const backend=require('./react-backend'),pg=require('./pg-sync');
 // The data as it is now, written to a SQLite file the copy reads from.
 const tmp=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-move-')),'data.sqlite');
 const current=backend.database(id);
 if(current instanceof pg.Database)pg.exportToSqlite(current,tmp);
 else{try{current.exec('PRAGMA wal_checkpoint(TRUNCATE)')}catch{}const f=path.join(builder.projectDir(id),'data.sqlite');if(fs.existsSync(f))fs.copyFileSync(f,tmp)}
 secrets().set(id,'supabase_db_url',target.url);
 secrets().set(id,'supabase_db_ca',target.ca||null);
 const at=new Date().toISOString();
 const meta=builder.loadMeta(id);
 meta.database={provider:'supabase',host:target.host,ref:target.ref,schema:schema(id),connected_at:at};
 builder.saveMeta(meta);
 backend.close(id);
 let copied=0;
 try{
  const db=backend.database(id);
  copied=(pg.copyFromSqlite(tmp,db,{key:'kairoq-import-'+at})||{}).copied||0;
 }catch(e){
  // Could not set the app up there: go back to Kairoq's own storage, as before.
  disconnect(id);
  throw fail(400,'Connected, but the app\'s tables could not be made in Supabase: '+String(e.message||e).slice(0,200));
 }finally{fs.rmSync(path.dirname(tmp),{recursive:true,force:true})}
 const fresh=builder.loadMeta(id);fresh.database={...fresh.database,copied};builder.saveMeta(fresh);
 return{...status(id),server:info.version};
}
function disconnect(id){
 const meta=builder.loadMeta(id);delete meta.database;builder.saveMeta(meta);
 try{secrets().set(id,'supabase_db_url',null);secrets().set(id,'supabase_db_ca',null)}catch{}
 require('./react-backend').close(id);
 return{connected:false};
}

module.exports={parse,parseCa,schema,connection,status,check,connect,disconnect,HOST};

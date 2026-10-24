"use strict";
// An app's data in the owner's own Supabase (app-database.js). The checks on addresses always
// run; moving data runs against a real Postgres when KAIROQ_TEST_APP_DB_URL is set
// (e.g. postgresql://postgres:x@127.0.0.1:5499/postgres with KAIROQ_TEST_APP_DB_HOSTS=127.0.0.1).
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-appdb-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
process.env.APP_ENCRYPTION_KEY='test-key-for-app-database-0123456789';
// With KAIROQ_TEST_DATABASE_URL, Kairoq's own storage is Postgres too (as on Railway).
if(process.env.KAIROQ_TEST_DATABASE_URL){process.env.DATABASE_URL=process.env.KAIROQ_TEST_DATABASE_URL;process.env.KAIROQ_PG_NAMESPACE='auto'}else delete process.env.DATABASE_URL;
const appdb=require('../app-database'),pg=require('../pg-sync');
const URL_=process.env.KAIROQ_TEST_APP_DB_URL;

test('only Supabase addresses on port 5432 with a real password are accepted',()=>{
 const ok=appdb.parse('postgresql://postgres.abcdefghijklmnopqrst:s3cret@aws-0-ca-central-1.pooler.supabase.com:5432/postgres?sslmode=require');
 assert.equal(ok.host,'aws-0-ca-central-1.pooler.supabase.com');
 assert.equal(ok.ref,'abcdefghijklmnopqrst');
 assert.doesNotMatch(ok.url,/sslmode/);
 assert.equal(appdb.parse('postgresql://postgres:pw@db.abcdefghijklmnopqrst.supabase.co:5432/postgres').ref,'abcdefghijklmnopqrst');
 assert.throws(()=>appdb.parse('postgresql://postgres:pw@evil.example.com:5432/postgres'),/Only Supabase databases/);
 assert.throws(()=>appdb.parse('postgresql://postgres:pw@169.254.169.254:5432/postgres'),/Only Supabase databases/);
 assert.throws(()=>appdb.parse('postgresql://postgres:[YOUR-PASSWORD]@db.abcdefghijklmnopqrst.supabase.co:5432/postgres'),/YOUR-PASSWORD/);
 assert.throws(()=>appdb.parse('postgresql://postgres.abcdefghijklmnopqrst:pw@aws-0-ca-central-1.pooler.supabase.com:6543/postgres'),/Session pooler/);
 assert.throws(()=>appdb.parse('https://supabase.com'),/postgresql:\/\//);
});

test('Supabase connections always check the certificate, using the one the owner gave',()=>{
 const ca='-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----';
 assert.equal(appdb.parseCa(ca),ca);
 assert.throws(()=>appdb.parseCa('not a cert'),/BEGIN CERTIFICATE/);
 const c=pg.clientConfig('postgresql://postgres:pw@db.abcdefghijklmnopqrst.supabase.co:5432/postgres?sslmode=disable',{ca});
 assert.equal(c.ssl.rejectUnauthorized,true);
 assert.equal(c.ssl.ca,ca);
 assert.doesNotMatch(c.connectionString,/sslmode/);
 assert.equal(pg.clientConfig('postgresql://u:p@localhost:5432/x').ssl,undefined);
});

test('connecting moves the data to Supabase; new data is saved there; test copies stay local; disconnecting goes back',{skip:!URL_&&'set KAIROQ_TEST_APP_DB_URL to run against Postgres'},async()=>{
 const builder=require('../react-builder'),backend=require('../react-backend'),sandbox=require('../react-sandbox');
 const meta=builder.create({name:'Bookings',owner:'alice'}),id=meta.id;
 const local=backend.database(id);
 local.prepare('INSERT INTO records(id,collection,owner_id,data,created_at,updated_at) VALUES(?,?,?,?,?,?)').run('r1','bookings',null,'{"name":"Ana"}','2026-10-24','2026-10-24');
 const r=await appdb.connect(id,{url:URL_},{checkFn:async()=>({version:'PostgreSQL test'})});
 assert.equal(r.connected,true);
 assert.equal(r.schema,appdb.schema(id));
 assert.ok(r.copied>=1);
 const remote=backend.database(id);
 assert.ok(remote instanceof pg.Database&&remote.external);
 assert.equal(remote.prepare('SELECT data FROM records WHERE id=?').get('r1').data,'{"name":"Ana"}');
 remote.prepare('INSERT INTO records(id,collection,owner_id,data,created_at,updated_at) VALUES(?,?,?,?,?,?)').run('r2','bookings',null,'{"name":"Ben"}','2026-10-24','2026-10-24');
 // A test copy is a local file with the same rows, never tables in the owner's database.
 const box=sandbox.create(id);
 assert.ok(fs.existsSync(path.join(box.dir,'data.sqlite')));
 const {DatabaseSync}=require('node:sqlite');
 assert.equal(new DatabaseSync(path.join(box.dir,'data.sqlite'),{readOnly:true}).prepare('SELECT COUNT(*) n FROM records').get().n,2);
 // The rows really are in the owner's Postgres, in the app's own schema.
 const c=new (require('pg').Client)({connectionString:URL_});await c.connect();
 const n=(await c.query('SELECT COUNT(*)::int n FROM "'+appdb.schema(id)+'".records')).rows[0].n;
 await c.query('DROP SCHEMA "'+appdb.schema(id)+'" CASCADE');await c.end();
 assert.equal(n,2);
 assert.equal(appdb.disconnect(id).connected,false);
 assert.ok(!backend.database(id).external);
 assert.equal(backend.database(id).prepare('SELECT COUNT(*) n FROM records').get().n,1,'Kairoq\'s own copy as it was when Supabase was connected');
});

test('the project settings offer Supabase and the API is owner-only',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','public','create.html'),'utf8'),api=fs.readFileSync(path.join(__dirname,'..','create-api.js'),'utf8');
 assert.match(html,/id="db-connect"/);
 assert.match(api,/'POST:\/database':'owner'/);
 assert.match(api,/require\('\.\/app-database'\)\.connect\(id,/);
});

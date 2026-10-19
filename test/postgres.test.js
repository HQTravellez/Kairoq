"use strict";
// Postgres (pg-sync.js): the SQLite → Postgres translation always runs; the rest runs against a
// real Postgres when KAIROQ_TEST_DATABASE_URL is set (each run in its own schemas).
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-pg-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
const pg=require('../pg-sync');
const URL=process.env.KAIROQ_TEST_DATABASE_URL;

test('SQLite statements are translated for Postgres',()=>{
 const t=s=>pg.translate(s).text;
 assert.equal(t("SELECT * FROM t WHERE a=? AND b='?' AND c=?"),"SELECT * FROM t WHERE a=$1 AND b='?' AND c=$2");
 assert.equal(t('CREATE TABLE x(id INTEGER PRIMARY KEY AUTOINCREMENT,at INTEGER NOT NULL,w REAL,b BLOB)'),'CREATE TABLE x(id BIGSERIAL PRIMARY KEY,at BIGINT NOT NULL,w DOUBLE PRECISION,b BYTEA)');
 assert.equal(t('ALTER TABLE users ADD COLUMN google_sub TEXT'),'ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub TEXT');
 assert.equal(t('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS a(id TEXT)'),'CREATE TABLE IF NOT EXISTS a(id TEXT)');
 assert.equal(t('INSERT OR IGNORE INTO a(id) VALUES(?)'),'INSERT INTO a(id) VALUES($1) ON CONFLICT DO NOTHING');
 assert.deepEqual(pg.translate('INSERT OR REPLACE INTO a(id,v) VALUES(?,?)').replace,{table:'a',columns:['id','v']});
 assert.equal(t('SELECT IFNULL(a,0) FROM t WHERE name LIKE ? AND x NOT LIKE ?'),'SELECT COALESCE(a,0) FROM t WHERE name ILIKE $1 AND x NOT ILIKE $2');
 assert.equal(t('CREATE TABLE s.a (LIKE a INCLUDING ALL)'),'CREATE TABLE s.a (LIKE a INCLUDING ALL)');
 assert.equal(t("SELECT 'it''s ?' -- a ? comment\n,?"),"SELECT 'it''s ?' \n,$1");
});

test('accounts, app data, test copies and backups on Postgres',{skip:!URL&&'set KAIROQ_TEST_DATABASE_URL to run against Postgres'},async()=>{
 const {DatabaseSync}=require('node:sqlite');
 // An existing SQLite accounts file is copied across on the first start.
 const old=new DatabaseSync(process.env.KAIROQ_BUILDER_ACCOUNTS_DB);
 old.exec("CREATE TABLE accounts(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,credits INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL);INSERT INTO accounts VALUES('a1','old@example.com','x',7,'2026-01-01T00:00:00Z')");old.close();
 process.env.DATABASE_URL=URL;process.env.KAIROQ_PG_NAMESPACE='auto';
 try{
  const accounts=require('../builder-accounts');
  const d=accounts.database();
  assert.ok(d instanceof pg.Database,'accounts use Postgres');
  assert.equal(d.prepare('SELECT credits FROM accounts WHERE email=?').get('old@example.com').credits,7,'old accounts were copied');
  const s=accounts.signup('new@example.com','long-enough-password');
  assert.ok(s.account.id);
  assert.throws(()=>accounts.signup('new@example.com','long-enough-password'),/already exists/);
  const expires=d.prepare('SELECT expires_at FROM sessions WHERE account_id=?').get(s.account.id).expires_at;
  assert.ok(expires>Date.now(),'millisecond times fit');

  // An app's records live in its own schema; where-filters work on jsonb.
  const builder=require('../react-builder'),backend=require('../react-backend');
  const meta=builder.create({name:'Pg',owner:'owner'});
  const db=backend.database(meta.id);
  assert.ok(db instanceof pg.Database);
  const cfg={collections:{items:{access:'public'}}};
  backend.functionDb(db,cfg,'create',{collection:'items',data:{name:'Kq123 Lamp',price:30,tags:['a'],sold:false}},null);
  backend.functionDb(db,cfg,'create',{collection:'items',data:{name:'Chair',price:12.5,sold:true}},null);
  const list=w=>backend.functionDb(db,cfg,'list',{collection:'items',where:w},null).map(r=>r.name);
  assert.deepEqual(list({price:30}),['Kq123 Lamp']);
  assert.deepEqual(list({price:12.5}),['Chair']);
  assert.deepEqual(list({sold:true}),['Chair']);
  assert.deepEqual(list({name:'Chair'}),['Chair']);
  assert.deepEqual(list({tags:['a']}),['Kq123 Lamp']);
  assert.deepEqual(list({_owner:null}).length,2);

  // A test copy is a separate schema; it starts with the app's rows and is gone afterwards.
  const sandbox=require('../react-sandbox');
  let schemaName;
  await sandbox.withSandbox(meta.id,async box=>{
   assert.ok(sandbox.contains(box,'Kq123'),'the copy has the rows');
   const copy=backend.openFile(path.join(box.dir,'data.sqlite'));
   backend.functionDb(copy,cfg,'create',{collection:'items',data:{name:'Only in the copy'}},null);
   schemaName=pg.schemaName('sb_'+box.token);
  });
  assert.equal(list({name:'Only in the copy'}).length,0,'the app never sees test records');
  assert.equal(d.prepare('SELECT COUNT(*) n FROM information_schema.schemata WHERE schema_name=?').get(schemaName).n,0,'the copy was dropped');

  // Backups: the rows are written to SQLite files.
  const done=require('../create-backups').run();
  assert.deepEqual(done.errors,[]);
  assert.equal(done.accounts,true);
  const bak=new DatabaseSync(path.join(done.dir,'projects',meta.id+'.sqlite'),{readOnly:true});
  assert.equal(bak.prepare("SELECT COUNT(*) n FROM records WHERE collection='items'").get().n,2);bak.close();
 }finally{delete process.env.DATABASE_URL}
});

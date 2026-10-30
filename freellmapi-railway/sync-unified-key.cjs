"use strict";
const fs=require("node:fs");
const path=require("node:path");
const Database=require("better-sqlite3");

const secret=String(process.env.KAIROQ_FREELLMAPI_UNIFIED_KEY||"").trim();
if(!/^freellmapi-[a-f0-9]{48,128}$/i.test(secret))process.exit(2);

const file=String(process.env.FREEAPI_DB_PATH||"/app/server/data/freellmapi.db");
if(!fs.existsSync(file))process.exit(3);

let db;
try{
  db=new Database(file,{timeout:1000});
  const table=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='settings'").get();
  if(!table)process.exitCode=4;
  else{
    const row=db.prepare("SELECT 1 FROM settings WHERE key='unified_api_key'").get();
    if(row)db.prepare("UPDATE settings SET value=? WHERE key='unified_api_key'").run(secret);
    else db.prepare("INSERT INTO settings(key,value) VALUES('unified_api_key',?)").run(secret);
    console.log("[kairoq-freellmapi] unified API key synchronized");
  }
}catch(e){
  console.error("[kairoq-freellmapi] key sync pending: "+String(e.message||e).replace(secret,"[redacted]").slice(0,160));
  process.exitCode=5;
}finally{try{db?.close()}catch{}}

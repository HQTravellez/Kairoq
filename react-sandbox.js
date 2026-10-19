"use strict";
// Test copies of an app's data. Saved checks (react-checks.js) click through the app in a
// browser; their requests carry X-Kairoq-Sandbox and are served from a copy of the live
// databases, so tests never touch real bookings or users, send real emails or start payments.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {DatabaseSync}=require('node:sqlite');
const builder=require('./react-builder');

const boxes=new Map();// token -> {id, dir, at}
const MAX_AGE_MS=60*60000;
function sqlString(p){return"'"+String(p).replace(/'/g,"''")+"'"}
// A consistent snapshot of a SQLite file (also with WAL) into dest.
function snapshot(src,dest,{conn}={}){
 if(!fs.existsSync(src))return false;
 if(conn){conn.exec('VACUUM INTO '+sqlString(dest));return true}
 const db=new DatabaseSync(src);
 try{db.exec('VACUUM INTO '+sqlString(dest))}finally{db.close()}
 return true;
}
function create(id){
 sweep();
 const token=crypto.randomBytes(16).toString('hex');
 const dir=path.join(builder.projectDir(id),'sandboxes',token);
 fs.mkdirSync(dir,{recursive:true});
 const backend=require('./react-backend');
 snapshot(path.join(builder.projectDir(id),'data.sqlite'),path.join(dir,'data.sqlite'),{conn:fs.existsSync(path.join(builder.projectDir(id),'data.sqlite'))?backend.database(id):null});
 snapshot(path.join(builder.projectDir(id),'app-sql.sqlite'),path.join(dir,'app-sql.sqlite'));
 boxes.set(token,{id,dir,at:Date.now()});
 return{token,dir};
}
// Every use keeps a copy alive; unused copies are removed after an hour.
function lookup(id,token){const b=token&&boxes.get(String(token));if(!b||b.id!==id)return null;b.at=Date.now();return b}
function destroy(token){
 const b=boxes.get(token);if(!b)return;
 boxes.delete(token);
 try{require('./react-backend').closeFile(path.join(b.dir,'data.sqlite'))}catch{}
 try{require('./react-sql').closeEverywhere(b.dir)}catch{}
 fs.rmSync(b.dir,{recursive:true,force:true});
}
// Removes copies left behind by a crash or an abandoned run.
function sweep(){for(const [t,b] of boxes)if(Date.now()-b.at>MAX_AGE_MS)destroy(t)}
// Whether any saved record in a test copy (collections and SQL tables) contains the text.
function contains(box,text){
 const needle='%'+String(text).replace(/[%_\\]/g,'')+'%';
 const data=path.join(box.dir,'data.sqlite');
 if(fs.existsSync(data)){
  const db=require('./react-backend').openFile(data);
  try{if(db.prepare('SELECT 1 FROM records WHERE data LIKE ? LIMIT 1').get(needle))return true}catch{}
 }
 const sql=path.join(box.dir,'app-sql.sqlite');
 if(fs.existsSync(sql)){
  const db=new DatabaseSync(sql,{readOnly:true});
  try{
   for(const {name} of db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_%' ESCAPE '\\'").all()){
    const cols=db.prepare('SELECT name FROM pragma_table_info(?)').all(name).map(c=>'"'+c.name.replace(/"/g,'""')+'"');
    if(cols.length&&db.prepare('SELECT 1 FROM "'+name.replace(/"/g,'""')+'" WHERE '+cols.map(c=>'CAST('+c+' AS TEXT) LIKE ?').join(' OR ')+' LIMIT 1').get(...cols.map(()=>needle)))return true;
   }
  }catch{}finally{db.close()}
 }
 return false;
}
async function withSandbox(id,fn){const box=create(id);try{return await fn(box)}finally{destroy(box.token)}}
module.exports={contains,create,lookup,destroy,withSandbox,sweep,HEADER:'x-kairoq-sandbox'};

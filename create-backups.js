"use strict";
// Daily consistent snapshots of Create's databases (accounts and every app's
// data) plus the hosting registry, kept for KAIROQ_BACKUP_DAYS (default 7).
// SQLite's VACUUM INTO writes a consistent copy while the server keeps running.
const fs=require('fs'),path=require('path');
const builder=require('./react-builder');

function root(){return process.env.KAIROQ_BACKUP_DIR||path.join(path.dirname(builder.ROOT()),'backups')}
function quote(p){return"'"+String(p).replace(/'/g,"''")+"'"}
function snapshot(db,file){fs.mkdirSync(path.dirname(file),{recursive:true});if(fs.existsSync(file))fs.rmSync(file);db.exec('VACUUM INTO '+quote(file))}
function run({now=new Date()}={}){
 const stamp=now.toISOString().slice(0,19).replace(/[:T]/g,'-'),dir=path.join(root(),stamp),started=Date.now();
 const done={dir,accounts:false,projects:0,errors:[]};
 try{snapshot(require('./builder-accounts').database(),path.join(dir,'builder-accounts.sqlite'));done.accounts=true}catch(e){done.errors.push('accounts: '+e.message)}
 for(const p of builder.list()){
  const src=path.join(builder.projectDir(p.id),'data.sqlite');
  if(!fs.existsSync(src))continue;
  try{snapshot(require('./react-backend').database(p.id),path.join(dir,'projects',p.id+'.sqlite'));done.projects++}catch(e){done.errors.push(p.id+': '+e.message)}
 }
 const hosting=path.join(builder.ROOT(),'hosting.json');
 if(fs.existsSync(hosting)){fs.mkdirSync(dir,{recursive:true});fs.copyFileSync(hosting,path.join(dir,'hosting.json'))}
 done.ms=Date.now()-started;
 fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify({...done,at:now.toISOString()},null,1));
 prune();
 return done;
}
function list(){
 if(!fs.existsSync(root()))return[];
 return fs.readdirSync(root()).filter(d=>/^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/.test(d)).sort().reverse();
}
function prune(){
 const keep=Math.max(1,Number(process.env.KAIROQ_BACKUP_DAYS||7));
 for(const d of list().slice(keep))fs.rmSync(path.join(root(),d),{recursive:true,force:true});
}
function latest(){const d=list()[0];if(!d)return null;try{return JSON.parse(fs.readFileSync(path.join(root(),d,'manifest.json'),'utf8'))}catch{return{dir:path.join(root(),d)}}}
module.exports={run,list,latest,root};

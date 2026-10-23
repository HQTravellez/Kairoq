"use strict";
// Per-project secrets (Stripe keys, GitHub tokens) encrypted with AES-256-GCM
// using a key derived from APP_ENCRYPTION_KEY. Values are never returned to the
// browser; callers get only whether a secret is set and a short hint.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const builder=require('./react-builder');

function key(){
 const raw=process.env.APP_ENCRYPTION_KEY||'';
 if(raw.length<16)throw Object.assign(Error('Saving keys is not enabled on this server yet. (Server admin: set APP_ENCRYPTION_KEY to 16 or more random characters.)'),{status:409});
 return crypto.createHash('sha256').update('kairoq-project-secrets:'+raw).digest();
}
function file(id){return path.join(builder.projectDir(id),'secrets.json')}
function readAll(id){try{return JSON.parse(fs.readFileSync(file(id),'utf8'))}catch{return{}}}
function writeAll(id,data){const f=file(id),tmp=f+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data),{mode:0o600});fs.renameSync(tmp,f)}
function set(id,name,value){
 if(!/^[a-z0-9_]{1,60}$/.test(name))throw Error('Bad secret name');
 const all=readAll(id);
 if(value===null||value===''){delete all[name];writeAll(id,all);return}
 const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key(),iv);
 const data=Buffer.concat([cipher.update(String(value),'utf8'),cipher.final()]);
 all[name]={iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64'),hint:String(value).slice(-4),at:new Date().toISOString()};
 writeAll(id,all);
}
function get(id,name){
 const item=readAll(id)[name];if(!item)return null;
 const decipher=crypto.createDecipheriv('aes-256-gcm',key(),Buffer.from(item.iv,'base64'));
 decipher.setAuthTag(Buffer.from(item.tag,'base64'));
 return Buffer.concat([decipher.update(Buffer.from(item.data,'base64')),decipher.final()]).toString('utf8');
}
function status(id){const all=readAll(id);return Object.fromEntries(Object.entries(all).map(([k,v])=>[k,{set:true,hint:'…'+v.hint,at:v.at}]))}
module.exports={set,get,status};

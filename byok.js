"use strict";
// Bring your own key: a customer's own OpenRouter key, so their builds and chats run on their
// account. Their usage is billed by OpenRouter to them: no Kairoq credits are charged and nothing
// counts against Kairoq's spending caps. The key is checked with OpenRouter before it is saved,
// stored encrypted (AES-256-GCM with a key derived from APP_ENCRYPTION_KEY) and never sent back to
// the browser; the browser only sees that a key is set and its last 4 characters.
const crypto=require('crypto');
const accounts=require('./builder-accounts');

function secret(){
 const raw=process.env.APP_ENCRYPTION_KEY||'';
 if(raw.length<16)throw Object.assign(Error('Saving your own key is not enabled on this server yet. (Server admin: set APP_ENCRYPTION_KEY to 16 or more random characters.)'),{status:409});
 return crypto.createHash('sha256').update('kairoq-own-ai-key:'+raw).digest();
}
function db(){const d=accounts.database();d.exec('CREATE TABLE IF NOT EXISTS account_ai_keys(account_id TEXT PRIMARY KEY,provider TEXT NOT NULL,iv TEXT NOT NULL,tag TEXT NOT NULL,data TEXT NOT NULL,hint TEXT NOT NULL,at TEXT NOT NULL)');return d}

// OpenRouter keys look like "sk-or-v1-" followed by 64 hex characters.
function shape(key){return /^sk-or-(?:v\d+-)?[A-Za-z0-9]{20,200}$/.test(String(key||'').trim())}

// Asks OpenRouter whether the key works (GET /api/v1/key). Returns {ok, limit_remaining}.
async function check(key,{fetchImpl=fetch}={}){
 const r=await fetchImpl('https://openrouter.ai/api/v1/key',{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(10000)});
 const j=await r.json().catch(()=>({}));
 if(r.status===401||r.status===403)throw Object.assign(Error('OpenRouter did not accept this key. Copy it again from openrouter.ai/keys.'),{status:400});
 if(!r.ok)throw Object.assign(Error('OpenRouter could not check the key right now ('+r.status+'). Try again in a minute.'),{status:502});
 const d=j&&j.data||{};
 return{ok:true,limit_remaining:typeof d.limit_remaining==='number'?d.limit_remaining:null};
}

async function save(accountId,key,opts={}){
 key=String(key||'').trim();
 if(!shape(key))throw Object.assign(Error('That does not look like an OpenRouter key. It starts with "sk-or-". Create one at openrouter.ai/keys.'),{status:400});
 await check(key,opts);
 const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',secret(),iv);
 const data=Buffer.concat([c.update(key,'utf8'),c.final()]);
 db().prepare('INSERT INTO account_ai_keys(account_id,provider,iv,tag,data,hint,at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET provider=excluded.provider,iv=excluded.iv,tag=excluded.tag,data=excluded.data,hint=excluded.hint,at=excluded.at')
  .run(String(accountId),'openrouter',iv.toString('base64'),c.getAuthTag().toString('base64'),data.toString('base64'),key.slice(-4),new Date().toISOString());
 return status(accountId);
}
function remove(accountId){db().prepare('DELETE FROM account_ai_keys WHERE account_id=?').run(String(accountId));return status(accountId)}
// What the browser may see: whether a key is set, which provider, its last 4 characters.
function status(accountId){
 const row=db().prepare('SELECT provider,hint,at FROM account_ai_keys WHERE account_id=?').get(String(accountId));
 return row?{set:true,provider:row.provider,hint:'…'+row.hint,at:row.at}:{set:false};
}
// The key itself, for the server's model calls only. Null when none is set or it cannot be read.
function get(accountId){
 if(!accountId)return null;
 let row;try{row=db().prepare('SELECT provider,iv,tag,data FROM account_ai_keys WHERE account_id=?').get(String(accountId))}catch{return null}
 if(!row)return null;
 try{
  const d=crypto.createDecipheriv('aes-256-gcm',secret(),Buffer.from(row.iv,'base64'));d.setAuthTag(Buffer.from(row.tag,'base64'));
  return{provider:row.provider,key:Buffer.concat([d.update(Buffer.from(row.data,'base64')),d.final()]).toString('utf8')};
 }catch{return null}
}
module.exports={save,remove,status,get,check,shape};

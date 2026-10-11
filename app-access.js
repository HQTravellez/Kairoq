'use strict';
const crypto=require('node:crypto');
const ROLES=['owner','admin','member','viewer'], RIGHTS=['read','create','update','delete'];
const fail=(message,status=403)=>{throw Object.assign(Error(message),{status});};
function normalize(collection,teams){
 if(collection.scope!==undefined&&!['private','team'].includes(collection.scope))throw Error('Collection scope must be private or team');
 if(collection.scope==='team'&&!teams)throw Error('Team collections require schema.teams=true');
 const out={};if(collection.scope)out.scope=collection.scope;
 if(collection.permissions){if(collection.scope!=='team')throw Error('Role permissions require a team collection');out.permissions={};for(const [right,roles]of Object.entries(collection.permissions)){if(!RIGHTS.includes(right)||!Array.isArray(roles)||roles.some(r=>!ROLES.includes(r)))throw Error('Invalid collection permission');out.permissions[right]=[...new Set(roles)];}}
 return out;
}
function init(db){db.exec(`CREATE TABLE IF NOT EXISTS app_teams(id TEXT PRIMARY KEY,name TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS app_members(team_id TEXT NOT NULL REFERENCES app_teams(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,role TEXT NOT NULL,PRIMARY KEY(team_id,user_id));
 CREATE TABLE IF NOT EXISTS app_record_scopes(record_id TEXT PRIMARY KEY REFERENCES app_records(id) ON DELETE CASCADE,team_id TEXT NOT NULL REFERENCES app_teams(id));
 CREATE INDEX IF NOT EXISTS app_team_records ON app_record_scopes(team_id);
 CREATE TABLE IF NOT EXISTS app_audit(id INTEGER PRIMARY KEY,team_id TEXT,user_id TEXT NOT NULL,event TEXT NOT NULL,target TEXT,created_at TEXT NOT NULL);`);return db;}
function audit(db,user,team,event,target){db.prepare('INSERT INTO app_audit(team_id,user_id,event,target,created_at) VALUES(?,?,?,?,?)').run(team||null,user.id,event,target||null,new Date().toISOString());}
function context(db,user,team){if(!team)return{user,team:null,role:null};if(!/^[a-f0-9-]{36}$/.test(team))fail('Team not found',404);const membership=db.prepare('SELECT role FROM app_members WHERE team_id=? AND user_id=?').get(team,user.id);if(!membership)fail('Team not found',404);return{user,team,role:membership.role};}
function allow(collection,ctx,right){if(collection.scope!=='team')return;if(!ctx.team)fail('Choose a team for '+collection.label,409);const defaults=right==='read'?ROLES:['owner','admin','member'];if(!(collection.permissions?.[right]||defaults).includes(ctx.role))fail('Your team role cannot '+right+' '+collection.label);}
function rows(db,collection,ctx){allow(collection,ctx,'read');return collection.scope==='team'?db.prepare('SELECT r.* FROM app_records r JOIN app_record_scopes s ON s.record_id=r.id WHERE s.team_id=? AND r.collection=? ORDER BY r.created_at DESC').all(ctx.team,collection.name):db.prepare('SELECT r.* FROM app_records r LEFT JOIN app_record_scopes s ON s.record_id=r.id WHERE r.user_id=? AND r.collection=? AND s.record_id IS NULL ORDER BY r.created_at DESC').all(ctx.user.id,collection.name);}
function get(db,collection,ctx,id,right='read'){allow(collection,ctx,right);const row=collection.scope==='team'?db.prepare('SELECT r.* FROM app_records r JOIN app_record_scopes s ON s.record_id=r.id WHERE r.id=? AND s.team_id=? AND r.collection=?').get(id,ctx.team,collection.name):db.prepare('SELECT r.* FROM app_records r LEFT JOIN app_record_scopes s ON s.record_id=r.id WHERE r.id=? AND r.user_id=? AND r.collection=? AND s.record_id IS NULL').get(id,ctx.user.id,collection.name);if(!row)fail('Record not found',404);return row;}
function references(db,schema,collection,ctx,data){for(const f of collection.fields)if(f.type==='reference'&&data[f.name]){const target=schema.collections.find(c=>c.name===f.collection);try{get(db,target,ctx,data[f.name]);}catch{fail('Linked '+f.label+' is not accessible',422);}}}
function save(db,schema,collection,ctx,data,id){allow(collection,ctx,id?'update':'create');references(db,schema,collection,ctx,data);const old=id?get(db,collection,ctx,id,'update'):null,at=new Date().toISOString(),rid=id||crypto.randomUUID();if(old)db.prepare('UPDATE app_records SET payload=?,updated_at=? WHERE id=?').run(JSON.stringify(data),at,rid);else{db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?,?)').run(rid,ctx.user.id,collection.name,JSON.stringify(data),at,at);if(collection.scope==='team')db.prepare('INSERT INTO app_record_scopes VALUES(?,?)').run(rid,ctx.team);}audit(db,ctx.user,ctx.team,collection.name+(id?'.updated':'.created'),rid);return{id:rid,data,created_at:old?.created_at||at,updated_at:at};}
function remove(db,collection,ctx,id){get(db,collection,ctx,id,'delete');db.prepare('DELETE FROM app_records WHERE id=?').run(id);audit(db,ctx.user,ctx.team,collection.name+'.deleted',id);return{ok:true};}
function route(db,user,path,method,body={}){
 if(path==='/teams'&&method==='GET')return{teams:db.prepare('SELECT t.*,m.role FROM app_teams t JOIN app_members m ON m.team_id=t.id WHERE m.user_id=? ORDER BY t.created_at').all(user.id)};
 if(path==='/teams'&&method==='POST'){const name=String(body.name||'').trim();if(!name||name.length>80)fail('Team name needs 1–80 characters',422);const id=crypto.randomUUID(),at=new Date().toISOString();db.prepare('INSERT INTO app_teams VALUES(?,?,?)').run(id,name,at);db.prepare('INSERT INTO app_members VALUES(?,?,?)').run(id,user.id,'owner');audit(db,user,id,'team.created',id);return{team:{id,name,role:'owner',created_at:at}};}
 const m=/^\/teams\/([a-f0-9-]{36})\/(members|audit)(?:\/([a-f0-9-]{36}))?$/.exec(path);if(!m)fail('Team endpoint not found',404);const ctx=context(db,user,m[1]);
 if(method==='GET'&&m[2]==='members'&&!m[3])return{members:db.prepare('SELECT m.user_id,m.role,u.email FROM app_members m JOIN users u ON u.id=m.user_id WHERE m.team_id=?').all(ctx.team)};
 if(!['owner','admin'].includes(ctx.role))fail('Team administration requires owner or admin');
 if(method==='GET'&&m[2]==='audit')return{events:db.prepare('SELECT * FROM app_audit WHERE team_id=? ORDER BY id DESC LIMIT 200').all(ctx.team)};
 if(m[2]!=='members')fail('Unsupported team method',405);
 const target=m[3]?db.prepare('SELECT id,email FROM users WHERE id=?').get(m[3]):db.prepare('SELECT id,email FROM users WHERE email=?').get(String(body.email||'').trim().toLowerCase());if(!target)fail('Registered account not found',404);const old=db.prepare('SELECT role FROM app_members WHERE team_id=? AND user_id=?').get(ctx.team,target.id);
 if(target.id===user.id||old?.role==='owner'||(ctx.role==='admin'&&old?.role==='admin'))fail('This membership can only be changed by its owner');
 if(method==='DELETE'&&m[3]){if(!old)fail('Member not found',404);db.prepare('DELETE FROM app_members WHERE team_id=? AND user_id=?').run(ctx.team,target.id);audit(db,user,ctx.team,'member.removed',target.id);return{ok:true};}
 if(!['POST','PATCH'].includes(method))fail('Unsupported team method',405);const role=body.role||'member';if(!['admin','member','viewer'].includes(role)||(ctx.role!=='owner'&&role==='admin'))fail('Invalid or forbidden member role',422);if(method==='PATCH'&&!old)fail('Member not found',404);db.prepare('INSERT INTO app_members VALUES(?,?,?) ON CONFLICT(team_id,user_id) DO UPDATE SET role=excluded.role').run(ctx.team,target.id,role);audit(db,user,ctx.team,'member.changed',target.id);return{member:{user_id:target.id,email:target.email,role}};
}
module.exports={ROLES,normalize,init,audit,context,allow,rows,get,references,save,remove,route};

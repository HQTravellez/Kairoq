"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const backend=fs.readFileSync(path.join(__dirname,'../react-backend.js'),'utf8');
const api=fs.readFileSync(path.join(__dirname,'../create-api.js'),'utf8');
const agent=fs.readFileSync(path.join(__dirname,'../react-agent.js'),'utf8');
test('account deletion is in owner-only create route and not AI generation job',()=>{
 assert.match(api,/action==='\/users'&&method==='DELETE'/);
 assert.match(api,/b\.confirm!==true/);
 assert.match(api,/backend\.ownerRemoveAppUser\(id,b\.email/);
 assert.ok(api.indexOf("action==='/users'&&method==='DELETE'")<api.indexOf("action==='/chat'&&method==='POST'"));
});
test('deleting users revokes sessions and tokens, retaining records unless asked',()=>{
 assert.match(backend,/DELETE FROM sessions WHERE user_id=\?/);
 assert.match(backend,/DELETE FROM app_tokens WHERE user_id=\?/);
 assert.match(backend,/if\(deleteOwnedRecords\)db\.prepare\('DELETE FROM records WHERE owner_id=\?'/);
 assert.match(backend,/BEGIN/);assert.match(backend,/COMMIT/);assert.match(backend,/ROLLBACK/);
});
test('Kairoq agent integrates safe optional CDM advisory',()=>{
 assert.match(agent,/decision-router'\)\.suggest\(text\)/);
 assert.match(agent,/decision-router'\)\.note\(decision\)/);
});

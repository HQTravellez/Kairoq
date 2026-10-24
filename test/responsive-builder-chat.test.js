"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ui=fs.readFileSync(path.join(__dirname,'../public/create.js'),'utf8');
const api=fs.readFileSync(path.join(__dirname,'../create-api.js'),'utf8');
const backend=fs.readFileSync(path.join(__dirname,'../react-backend.js'),'utf8');
test('running build does not mute chat or show obstructing thinking overlay',()=>{
 assert.match(ui,/if\(state\.job\)\{\s*const msg=String\(message/);
 assert.match(ui,/I am still here/);
 assert.match(ui,/state\.pendingMessage=msg/);
 assert.match(ui,/Review it in the message box/);
 assert.match(ui,/overlay\.classList\.add\('hidden'\)/);
 assert.match(ui,/\$\('send'\)\.disabled=false/);
});
test('greetings can get a status reply while a build is active',()=>{
 assert.match(api,/const active=\[\.\.\.jobs\.values\(\)\]/);
 assert.match(api,/smallTalk\(message\)/);
 assert.match(api,/Open the active job or stop it/);
});
test('nutrition records are separate from users and not deleted without confirmation',()=>{
 assert.match(api,/action==='\/nutrition'&&method==='DELETE'/);
 assert.match(backend,/NUTRITION_COLLECTIONS=new Set/);
 assert.match(backend,/if\(confirm!==true\)/);
 assert.match(backend,/DELETE FROM records WHERE collection=\?/);
 assert.doesNotMatch(backend.slice(backend.indexOf('function ownerClearNutritionRecords'),backend.indexOf('function ownerDelete(')),/DELETE FROM users/);
});

test('missing camera complaint is routed to real feature diagnosis, not preview help',()=>{
 assert.match(api,/function missingFeatureComplaint\(message\)/);
 assert.match(api,/if\(missingFeatureComplaint\(t\)\)return false/);
 assert.match(api,/Reproduce the missing-feature behavior in a browser/);
 assert.match(api,/Never answer with generic preview-refresh guidance/);
});

test('reopening a project reconnects active job so owner can stop or inspect it',()=>{
 assert.match(api,/active_job:/);
 assert.match(ui,/const \{project,account,active_job\}=await api/);
 assert.match(ui,/if\(job\|\|active_job\)watch\(job\|\|active_job\)/);
});
test('nutrition-only deletion is exposed in data panel with explicit confirmation',()=>{
 assert.match(ui,/nutritionCollections\.has\(state\.collection\)/);
 assert.match(ui,/Delete ALL nutrition records/);
 assert.match(ui,/\/nutrition'\,\{method:'DELETE'/);
});

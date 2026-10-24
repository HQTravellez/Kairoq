"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../create-api.js'),'utf8');
test('nutrition deletion endpoint is closed before owner account route',()=>{
 assert.match(src,/if\(action==='\/nutrition'&&method==='DELETE'\)\{[\s\S]*?ownerClearNutritionRecords\([^\n]+\n\s*\}\n\s*\/\/ Project-owner only/);
});
test('owner account and chat routes remain separate',()=>{
 assert.match(src,/if\(action==='\/users'&&method==='DELETE'\)/);
 assert.match(src,/if\(action==='\/chat'&&method==='POST'\)/);
});

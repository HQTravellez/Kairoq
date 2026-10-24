"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../react-builder.js'),'utf8');
test('React builder demands working feature flows instead of login-only evidence',()=>{
 assert.match(source,/A sign-in screen is only one screen, NOT proof of a complete application/);
 assert.match(source,/food search must select catalog results into actual meal records/);
 assert.match(source,/totals and macro progress must recompute from saved daily logs/);
 assert.match(source,/weight history must support add and removal/);
 assert.match(source,/Do not import or refer to another project's code/);
});

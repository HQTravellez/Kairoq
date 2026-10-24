'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../public/create.js'),'utf8');
test('Kairoq preview does not equate loading and signup with complete app verification',()=>{
 assert.match(src,/Browser checks passed/);
 assert.doesNotMatch(src,/all\?'Verified by Kairoq'/);
 assert.match(src,/The features you asked for have NOT been verified by these checks/);
 assert.doesNotMatch(src,/food search|calorie/i,'the note is general, not about one app');
 assert.match(src,/have NOT been verified by these checks/);
 assert.match(src,/this is not certification that the whole application is complete/);
});

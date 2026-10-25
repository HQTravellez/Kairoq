'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../public/create.js'),'utf8');
test('Kairoq preview does not equate loading and signup with complete app verification',()=>{
 assert.match(src,/Browser checks passed/);
 assert.doesNotMatch(src,/all\?'Verified by Kairoq'/);
 assert.doesNotMatch(src,/food search|calorie/i,'the note is general, not about one app');
 assert.match(src,/It did not test the new feature itself, so try it in the preview/);
 assert.match(src,/Anything else in this change was not tested/);
 assert.match(src,/this is not certification that the whole application is complete/);
});
test('when every check passed, the result is one quiet line that opens on a click',()=>{
 assert.match(src,/if\(all&&!\(added&&added\.length\)\)\{/);
 assert.match(src,/'Tested in a browser: '\+rows\.length\+' checks passed'/);
});

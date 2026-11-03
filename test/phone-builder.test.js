'use strict';
// The phone builder, like the Figma "Phone builder chat" frame: one dark bar (back, project name,
// "All changes saved", Publish, menu) and light Chat / Preview / Browser tabs under it.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const pub=path.join(__dirname,'..','public');
test('the phone bar is in the editor and wired to the editor\'s own buttons',()=>{
 const html=fs.readFileSync(path.join(pub,'create.html'),'utf8'),js=fs.readFileSync(path.join(pub,'create.js'),'utf8'),css=fs.readFileSync(path.join(pub,'ui','forma.css'),'utf8');
 assert.ok(html.indexOf('id="ph-bar"')<html.indexOf('id="phone-panes"'),'the bar sits above the tabs');
 for(const id of ['ph-back','ph-name','ph-saved','ph-publish','ph-more'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(js,/\$\('ph-back'\)\.onclick=\(\)=>\$\('back'\)\.click\(\)/);
 assert.match(js,/\$\('ph-publish'\)\.onclick=\(\)=>\$\('publish-open'\)\.click\(\)/);
 assert.match(js,/state\.job\?'Kairoq is working…':'All changes saved'/);
 assert.match(css,/#editor \.ph-bar\{display:none\}/,'hidden on desktop');
 assert.match(css,/@media \(max-width:900px\)\{\n  \/\* One dark bar/);
});

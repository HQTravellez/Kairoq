'use strict';
// The Connectors page shows each service's real logo (brands) or a plain line icon (the rest),
// like the Figma Connectors frame; on a phone the search takes the whole row.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const pub=path.join(__dirname,'..','public');
test('logos, icons and the phone search',()=>{
 const js=fs.readFileSync(path.join(pub,'create.js'),'utf8'),css=fs.readFileSync(path.join(pub,'ui','tool-pages.css'),'utf8');
 for(const id of ['github','stripe','figma','whatsapp'])assert.match(js,new RegExp(id+":\\{c:'#[0-9A-F]{6}',d:'M"),id+' has its logo');
 for(const id of ['email','secrets','apps','partners','domain','mcp'])assert.match(js,new RegExp(id+":'<"),id+' has a line icon');
 assert.match(js,/const ic=cnLogo\(c\);/);
 assert.match(js,/st==='admin'\?'':CN_HOW\[c\.id\]/,'no repeated "set up" text');
 assert.match(css,/\.tp-search\.cn-search\{grid-column:1\/-1/);
 assert.match(fs.readFileSync(path.join(__dirname,'..','THIRD_PARTY_NOTICES.md'),'utf8'),/Simple Icons \(CC0-1\.0/);
});

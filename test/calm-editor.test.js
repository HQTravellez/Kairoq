'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kq-calm-'));
Object.assign(process.env,{NODE_ENV:'test',KAIROQ_REACT_PROJECTS_DIR:path.join(tmp,'p'),KAIROQ_BUILDER_ACCOUNTS_DB:path.join(tmp,'a.sqlite')});
const builder=require('../react-builder'),api=require('../create-api');
const read=f=>fs.readFileSync(path.join(__dirname,'..','public',f),'utf8');

test('a build request is saved where it was sent, before chat said meanwhile',()=>{
 const msgs=[{role:'user',text:'old',at:'2026-11-01T10:00:00.000Z'},{role:'assistant',text:'ok',at:'2026-11-01T10:00:05.000Z'},
  {role:'user',text:'how is it going?',at:'2026-11-01T10:03:00.000Z'},{role:'assistant',text:'Writing the menu page.',at:'2026-11-01T10:03:04.000Z'},
  {role:'user',text:'Build the bakery site',at:'2026-11-01T10:06:00.000Z'},{role:'assistant',text:'Built it.',at:'2026-11-01T10:06:00.000Z'}];
 builder.placeTurn(msgs,'2026-11-01T10:01:00.000Z');
 assert.deepEqual(msgs.map(m=>m.text),['old','ok','Build the bakery site','how is it going?','Writing the menu page.','Built it.']);
 assert.equal(msgs[2].at,'2026-11-01T10:01:00.000Z');
 const same=[{role:'user',text:'a',at:'1'},{role:'assistant',text:'b',at:'2'}];builder.placeTurn(same,'0');assert.deepEqual(same.map(m=>m.text),['a','b']);
});

test('addMessages can place the request by its start time',()=>{
 const meta=builder.create({name:'Order',owner:'owner'});
 builder.addMessages(meta.id,[{role:'user',text:'side question'},{role:'assistant',text:'side answer'}]);
 const fresh=builder.addMessages(meta.id,[{role:'user',text:'the build'},{role:'assistant',text:'done'}],{startedAt:'2000-01-01T00:00:00.000Z'});
 assert.deepEqual(fresh.messages.map(m=>m.text),['the build','side question','side answer','done']);
});

test('a question during a build is answered from what the build is doing',()=>{
 const note=api.buildingNote({ask:'A website for Marigold Bakery',status:'testing',created_at:new Date(Date.now()-180000).toISOString(),events:[{t:'edit',file:'src/App.jsx'},{t:'edit',file:'src/pages/Menu.jsx'},{t:'test',ok:false}]});
 assert.match(note,/Marigold Bakery/);assert.match(note,/3 minutes ago/);assert.match(note,/src\/pages\/Menu\.jsx/);assert.match(note,/found problems/);
 assert.match(note,/Do not say you have no record/);
 assert.equal(api.buildingNote(null),'');
});

test('the editor is light, calm and keeps its ids',()=>{
 const html=read('create.html'),css=read('calm.css'),theme=read('theme.css'),js=read('create.js');
 assert.match(html,/theme\.css[\s\S]*calm\.css/,'calm.css loads after the theme');
 assert.doesNotMatch(html,/dark\.css/);
 assert.match(theme,/color-scheme:light/);assert.doesNotMatch(theme,/#0E0F11|#35E0CF/i);
 for(const id of ['share-open','publish-open','share-pop','composer-ideas','menu-plus','menu-tier','menu-mode','versions','view-browser'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(css,/--c-accent:#1F6FEB/);assert.match(css,/#send\.is-empty/);
 assert.match(js,/function renderIdeas\(/);assert.match(js,/model-search/);
 assert.doesNotMatch(js,/this model is slow today/);
});

"use strict";
// Kairoq's browser test clicks the app's navigation and tabs, and reports the ones that change
// nothing on the page, so the AI fixes them before the owner finds them.
const test=require('node:test'),assert=require('node:assert/strict');
const http=require('http');
process.env.NODE_ENV='test';
const runtime=require('../runtime-check');

const PAGE=`<!doctype html><html><body><div id="root">
<nav><a href="#/">Pipeline</a> <a href="#/reports">Reports</a> <a href="#" onclick="event.preventDefault()">Contacts</a> <button type="button">Follow-ups</button> <button type="button" id="open">Add lead</button> <a href="https://example.com/help">Help</a></nav>
<main id="view">Pipeline view</main>
<div id="dlg"></div>
</div><script>
const v=document.getElementById('view');
addEventListener('hashchange',()=>{v.textContent=location.hash==='#/reports'?'Reports view':'Pipeline view'});
document.getElementById('open').onclick=()=>{document.getElementById('dlg').innerHTML='<div role="dialog">New lead</div>'};
</script></body></html>`;

test('navigation that does nothing is reported; working links, dialogs and outside links are not',{skip:!runtime.available()&&'no Chromium'},async()=>{
 const server=http.createServer((q,r)=>{r.writeHead(200,{'Content-Type':'text/html'});r.end(PAGE)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const r=await runtime.check('http://127.0.0.1:'+server.address().port+'/');
  const dead=r.errors.filter(e=>/does nothing/.test(e));
  assert.equal(dead.length,2,JSON.stringify(r.errors));
  assert.ok(dead.some(e=>/"Contacts"/.test(e)));assert.ok(dead.some(e=>/"Follow-ups"/.test(e)));
  assert.ok(!r.errors.some(e=>/"Reports"|"Add lead"|"Help"/.test(e)));
 }finally{server.close();await runtime.close().catch(()=>{})}
});

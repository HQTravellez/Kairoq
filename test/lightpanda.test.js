"use strict";
// The Lightpanda fast lane (runtime-check.js): a working app is checked by Lightpanda alone, a
// broken one is confirmed in Chromium, and pages are read for search engines. Runs only when a
// Lightpanda binary is installed (KAIROQ_LIGHTPANDA_PATH or /usr/local/bin/lightpanda).
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-lp-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
const bin=[process.env.KAIROQ_LIGHTPANDA_PATH,'/usr/local/bin/lightpanda'].find(p=>p&&fs.existsSync(p));
const builder=require('../react-builder'),design=require('../react-design'),runtime=require('../runtime-check');
const MAIN="import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App.jsx';\nimport './index.css';\ncreateRoot(document.getElementById('root')).render(<App />);\n";
test.after(async()=>{await runtime.close?.();fs.rmSync(tmp,{recursive:true,force:true})});

test('the fast lane checks a working app alone and confirms a broken one in Chromium',{skip:!bin&&'no Lightpanda binary installed'},async()=>{
 const make=async(name,app)=>{const meta=builder.create({name,owner:'owner'});await builder.initializeFrom(meta,{...design.starterFiles(name,{}),'src/main.jsx':MAIN,'src/App.jsx':app},'Start');return builder.previewUrl(builder.loadMeta(meta.id))};
 const good=await make('good',"export default function App(){return <main><h1>Casa Azul</h1><p>Twelve rooms in Alfama, open all year, with breakfast on the terrace.</p><a href='#/rooms'>Rooms</a></main>}\n");
 const bad=await make('bad',"export default function App(){const x=null;return <p>{x.title}</p>}\n");
 const server=http.createServer((req,res)=>{if(!builder.handlePreview(req,res)){res.writeHead(404);res.end()}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 try{
  const ok=await runtime.check(base+good,{fast:true});
  assert.equal(ok.engine,'lightpanda');assert.deepEqual(ok.errors,[]);
  const broken=await runtime.check(base+bad,{fast:true});
  assert.notEqual(broken.engine,'lightpanda','a problem is confirmed in Chromium');
  assert.ok(broken.errors.some(e=>/Cannot read properties of null/.test(e)),broken.errors.join(' | '));
  const pages=await runtime.renderSite(base+good);
  assert.ok(pages.length>=1);assert.match(pages[0].text,/Twelve rooms in Alfama/);
  const st=runtime.fastStats();assert.equal(st.installed,true);assert.ok(st.runs>=3);assert.equal(st.confirmed,1);
  assert.equal(st.fallbacks,0,'everything ran in Lightpanda');
 }finally{server.close()}
});

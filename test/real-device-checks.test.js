"use strict";
// Checks run the way real customers use apps: desktop, phone, iPhone Safari (WebKit) and a phone
// on slow 3G; and the editor previews the app inside a real-looking iPhone, Pixel or iPad.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-devices-'));
process.env.KAIROQ_DESIGN_BRIEF='off';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
process.env.KAIROQ_SLOW_READY_MS='1';
process.env.KAIROQ_DEAD_CLICKS='off';
const builder=require('../react-builder'),rc=require('../runtime-check'),checks=require('../react-checks');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');

test('four devices: Safari only where its engine is installed, and it can be switched off',()=>{
 assert.deepEqual(Object.keys(rc.DEVICES),['desktop','phone','iphone','slow']);
 assert.ok(rc.DEVICES.iphone.webkit&&rc.DEVICES.iphone.phone);
 assert.match(rc.DEVICES.iphone.options.userAgent,/iPhone.*Safari/);
 assert.ok(rc.DEVICES.slow.slow);
 const prev=process.env.KAIROQ_WEBKIT;process.env.KAIROQ_WEBKIT='off';
 try{assert.equal(rc.webkitAvailable(),false);if(rc.available())assert.deepEqual(rc.devicesAvailable(),['desktop','phone','slow'])}
 finally{if(prev===undefined)delete process.env.KAIROQ_WEBKIT;else process.env.KAIROQ_WEBKIT=prev}
});

test('a check runs on every device; results are kept per device and counted per check',{skip:!rc.available()&&'no Chromium here'},async()=>{
 const meta=builder.create({name:'Stays',owner:'owner'});await builder.initialize(meta);
 const APP=`import { useState } from 'react';
export default function App(){const [done,setDone]=useState(false);return <main className="p-6"><h1>Unit 12</h1><button onClick={()=>setDone(true)}>Book now</button>{done&&<p>Booked!</p>}</main>}
`;
 const r=await builder.edit(meta.id,'x',{callModel:async(_o,parse)=>parse(JSON.stringify({message:'ok',files:{'src/App.jsx':APP}}))});
 const dist=path.join(builder.versionDir(meta.id,r.version),'dist');
 const srv=http.createServer((q,s)=>builder.serveDist(q,s,dist,q.url,{sandbox:false}));await new Promise(ok=>srv.listen(0,'127.0.0.1',ok));
 const url='http://127.0.0.1:'+srv.address().port+'/';
 try{
  // The slow phone measures how long until the page can be used and reports it over the limit.
  const slow=await rc.inspect(url,{viewport:'slow',screenshot:false});
  assert.ok(slow.ready_ms>0);
  assert.match(slow.errors.find(e=>/^Slow phone/.test(e))||'',/took \d+\.\d s to be usable on a slow 3G connection/);
  checks.save(meta.id,{name:'Guest books',path:'',steps:[{action:'click',text:'Book now'},{action:'expect',text:'Booked!'}]},{source:'user'});
  const inspect=(u,o)=>rc.inspect(url,o);
  const res=await checks.runDevices(meta.id,url,{inspect,version:r.version,devices:['desktop','phone','slow']});
  assert.equal(res.ran,1,'one check');
  assert.deepEqual(res.devices,['desktop','phone','slow']);
  const c=checks.list(builder.loadMeta(meta.id))[0];
  assert.equal(c.last.devices.desktop.ok,true);assert.equal(c.last.devices.phone.ok,true);
  assert.equal(c.last.devices.slow.ok,false,'over the (test) 1 ms limit');
  assert.ok(c.last.devices.slow.ready_ms>0);
  assert.equal(res.passed,0,'a check passes only on every device');
  assert.ok(res.failed.some(f=>f.name==='Guest books (slow phone)'));
 }finally{srv.close();await rc.close()}
});

test('Safari on iPhone holds a publish; phone and slow-phone problems are warnings',()=>{
 const gate=read('launch-gate.js');
 assert.match(gate,/checks\.runDevices\(/);
 assert.match(gate,/\['desktop','iphone'\]\.includes\(f\.device\|\|'desktop'\)\?blockers:early/);
 assert.match(read('create-api.js'),/checks\.runDevices\(id,url,\{inspect,version:meta\.current_version\}\)/);
 assert.match(read('react-reference-run.js'),/checks\.runDevices\(id,url,\{inspect,version:n\}\)/);
 // The builder writes Safari-safe dates and keeps the first screen light.
 assert.match(builder.SYSTEM_PROMPT,/never "2026-11-02 15:00"/);
 assert.match(builder.SYSTEM_PROMPT,/usable within 10 seconds on slow 3G/);
});

test('the editor previews the app inside an iPhone, iPhone SE, Pixel or iPad, with a real Safari screenshot',()=>{
 const html=read('public/create.html'),js=read('public/create.js'),css=read('public/create.css'),api=read('create-api.js');
 for(const id of ['device','frame','device-model','safari-shot','dev-shot'])assert.match(html,new RegExp('id="'+id+'"'));
 for(const m of ['iphone16','iphone16max','iphonese','pixel','ipad'])assert.match(html,new RegExp('value="'+m+'"'));
 assert.match(js,/iphone16:\{label:'iPhone 16',w:393,h:852/);
 assert.match(js,/api\('\/projects\/'\+state\.project\.id\+'\/safari'/);
 assert.match(css,/\.device\.phone\.island \.dev-island/);
 assert.match(api,/'POST:\/safari':'viewer'/);
 assert.match(api,/require\('\.\/runtime-check'\)\.safariShot\(url/);
 assert.match(read('Dockerfile'),/playwright-core install --with-deps webkit/);
});

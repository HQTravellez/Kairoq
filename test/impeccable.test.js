"use strict";
// Impeccable's design detector in the builder loop (impeccable.js, craft-check.js): the
// findings become craft issues, the scan gets the app's files and the rendered page, and a
// missing binary means no findings rather than a failed build.
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),os=require('os'),path=require('path');
const impeccable=require('../impeccable');

const FINDINGS=[
 {antipattern:'overused-font',name:'Overused font',description:'Inter, Roboto and friends are on every generated page; pick a typeface that fits this business.',severity:'warning',category:'slop',file:'/tmp/x/src/index.css',line:3,snippet:"font-family: 'Inter'"},
 {antipattern:'overused-font',name:'Overused font',description:'…',severity:'warning',category:'slop',file:'/tmp/x/src/App.jsx',line:12,snippet:'font-inter'},
 {antipattern:'nested-cards',name:'Nested cards',description:'A card inside a card adds borders without meaning; flatten it.',severity:'warning',category:'slop',file:'/tmp/x/src/App.jsx',line:40,snippet:'<div class="card"><div class="card">'},
 {antipattern:'low-contrast',name:'Low contrast',description:'Text below 4.5:1 against its background.',severity:'warning',category:'quality',file:'http://127.0.0.1:3002/p/',line:0,snippet:'#9aa (2.1:1) on #fff'},
 {antipattern:'numbered-section-labels',name:'Numbered labels',description:'advisory',severity:'advisory',advisory:true,file:'/tmp/x/src/App.jsx',line:2,snippet:'01'},
];

test('findings become craft issues: one per rule, advisory dropped, files named',()=>{
 const list=impeccable.issues(FINDINGS);
 assert.deepEqual(list.map(i=>i.kind),['impeccable:overused-font','impeccable:nested-cards','impeccable:low-contrast']);
 assert.ok(list.every(i=>i.severity==='major'));
 assert.match(list[0].issue,/Overused font: font-family: 'Inter' \(src\/index\.css:3\) \(src\/App\.jsx:12\) \(and 1 more\)/);
 assert.match(list[0].fix,/typeface that fits/);
 assert.match(list[2].issue,/^Low contrast: #9aa \(2\.1:1\) on #fff$/,'a URL finding names no file');
});

test('no binary: nothing found, nothing thrown',async()=>{
 process.env.IMPECCABLE_BIN='/nonexistent/impeccable';
 try{
  assert.equal(impeccable.enabled(),false);
  assert.deepEqual(await impeccable.check({files:{'src/App.jsx':'x'},url:'/builder/p/a/v/1/'}),[]);
 }finally{delete process.env.IMPECCABLE_BIN}
});

test('check scans the app files as a folder and the preview as a local URL',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kq-imp-test-'));
 const log=path.join(dir,'argv.json'),stub=path.join(dir,'impeccable');
 fs.writeFileSync(stub,`#!/usr/bin/env node
const fs=require('fs');fs.writeFileSync(${JSON.stringify(log)},JSON.stringify({argv:process.argv.slice(2),browser:process.env.IMPECCABLE_BROWSER||''}));
process.stdout.write(JSON.stringify(${JSON.stringify(FINDINGS)}));process.exit(2);`);
 fs.chmodSync(stub,0o755);
 process.env.IMPECCABLE_BIN=stub;process.env.PORT='4567';
 try{
  assert.equal(impeccable.enabled(),true);
  const list=await impeccable.check({files:{'src/App.jsx':'export default()=>null','src/index.css':'body{}','src/backend.json':'{}','index.html':'<html></html>'},url:'/builder/p/abc/v/3/'});
  assert.equal(list.length,3);
  const got=JSON.parse(fs.readFileSync(log,'utf8'));
  assert.deepEqual(got.argv.slice(0,3),['detect','--json','--no-advisory']);
  const folder=got.argv[3];
  assert.ok(folder.includes('kq-impeccable-'),'files were written to a scratch folder');
  assert.ok(!fs.existsSync(folder),'the scratch folder is removed afterwards');
  const chromium=['/opt/pw-browsers/chromium','/usr/bin/chromium','/usr/bin/chromium-browser',process.env.CHROMIUM_PATH].some(p=>p&&fs.existsSync(p));
  if(chromium)assert.equal(got.argv[4],'http://127.0.0.1:4567/builder/p/abc/v/3/','the preview path becomes a URL on this server');
  else assert.equal(got.argv.length,4,'no browser: only the files are scanned');
 }finally{delete process.env.IMPECCABLE_BIN;delete process.env.PORT;fs.rmSync(dir,{recursive:true,force:true})}
});

test('a crashing or silent binary means no findings',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kq-imp-test-'));
 const stub=path.join(dir,'impeccable');
 fs.writeFileSync(stub,'#!/usr/bin/env node\nprocess.stderr.write("boom");process.exit(1);');fs.chmodSync(stub,0o755);
 process.env.IMPECCABLE_BIN=stub;
 try{assert.deepEqual(await impeccable.check({files:{'src/App.jsx':'x'}}),[])}
 finally{delete process.env.IMPECCABLE_BIN;fs.rmSync(dir,{recursive:true,force:true})}
});

test('the craft loop fixes detector findings with the measured ones and measures again',async()=>{
 const craft=require('../craft-check');
 const edits=[];let round=0;
 const out=await craft.run({
  url:()=>'/builder/p/abc/v/1/',request:'A site for a bakery',facts:'A site for a bakery',
  designShots:async()=>[{name:'desktop',issues:round===0?[{severity:'major',kind:'eyebrow',issue:'Tiny capital labels above headings',fix:'Remove them'}]:[],stats:[]}],
  detect:async()=>round===0?impeccable.issues(FINDINGS):[],
  reviewLook:null,
  edit:async(msg,shown)=>{edits.push({msg,shown});round++;return{version:2}},
 });
 assert.equal(edits.length,1);
 assert.match(edits[0].msg,/1\. Tiny capital labels above headings/);
 assert.match(edits[0].msg,/\[impeccable:overused-font\] Overused font/);
 assert.match(edits[0].msg,/\[impeccable:nested-cards\]/);
 assert.match(edits[0].msg,/Impeccable rules are named impeccable:<rule>/);
 assert.equal(out.passes,1);
 assert.deepEqual(out.fixed,['eyebrow','impeccable:overused-font','impeccable:nested-cards','impeccable:low-contrast']);
 assert.deepEqual(out.remaining,[]);
 assert.equal(out.detected,0,'the last measurement found nothing');
});

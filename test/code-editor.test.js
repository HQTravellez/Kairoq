"use strict";
// Editing code by hand: a save is checked, built and kept as a new version like an AI change;
// a change that would break the app is refused with the reason.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-editor-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
const builder=require('../react-builder'),createApi=require('../create-api');
let server;
const call=(method,url,body)=>new Promise((resolve,reject)=>{const payload=body?Buffer.from(JSON.stringify(body)):null;const r=http.request({host:'127.0.0.1',port:server.address().port,method,path:url,headers:payload?{'Content-Type':'application/json','Content-Length':payload.length}:{}},res=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>{let json=null;try{json=JSON.parse(Buffer.concat(c).toString())}catch{}resolve({status:res.statusCode,json})})});r.on('error',reject);if(payload)r.write(payload);r.end()});
test.before(async()=>{server=http.createServer(async(req,res)=>{if(!await createApi.handle(req,res,{isOwner:()=>true,callModel:async()=>{throw Error('no AI here')}})){res.writeHead(404);res.end()}});await new Promise(r=>server.listen(0,'127.0.0.1',r))});
test.after(()=>server.close());

test('a hand edit becomes a new version; new and deleted files too; broken code is refused',async()=>{
 const meta=builder.create({name:'Edit me',owner:'owner'});await builder.initialize(meta);
 const base='/api/create/projects/'+meta.id+'/source';
 const ok=await call('POST',base,{path:'src/App.jsx',content:'export default function App(){return <h1>Edited by hand</h1>}\n'});
 assert.equal(ok.status,200,JSON.stringify(ok.json));assert.equal(ok.json.result.version,2);
 const m=builder.loadMeta(meta.id);assert.equal(m.current_version,2);assert.match(m.versions.at(-1).summary,/Edited src\/App\.jsx by hand/);assert.equal(m.versions.at(-1).manual,true);
 assert.match(builder.loadFiles(meta.id,2)['src/App.jsx'],/Edited by hand/);
 assert.equal((await call('POST',base,{path:'src/components/Hero.jsx',content:'export default function Hero(){return null}\n',create:true})).status,200);
 assert.equal((await call('POST',base,{path:'src/components/Hero.jsx',content:'x',create:true})).status,409,'creating an existing file is refused');
 assert.equal((await call('POST',base,{path:'src/components/Hero.jsx',delete:true})).status,200);
 assert.equal((await call('POST',base,{path:'src/App.jsx',delete:true})).status,400,'the entry files stay');
 const bad=await call('POST',base,{path:'src/App.jsx',content:"import x from 'left-pad';\nexport default function App(){return <h1>x</h1>}\n"});
 assert.equal(bad.status,400);assert.match(bad.json.error,/not available/);
 const undeclared=await call('POST',base,{path:'src/App.jsx',content:"import { collection } from 'kairoq';\nexport default function App(){collection('notes').list();return <h1>x</h1>}\n"});
 assert.equal(undeclared.status,400);assert.match(undeclared.json.error,/"notes"/,'the same project checks as an AI change');
 assert.equal(builder.loadMeta(meta.id).current_version,4,'refused saves make no version');
 assert.equal((await call('POST',base,{path:'../etc/passwd',content:'x',create:true})).status,400);
});

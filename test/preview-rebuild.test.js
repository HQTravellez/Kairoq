"use strict";
// A preview whose built files were lost is built again from the saved code instead of
// showing "Not found" (a blank preview).
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-rebuild-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
const builder=require('../react-builder'),templates=require('../create-templates');

test('a version without its built files is rebuilt when the preview opens it',async()=>{
 const meta=builder.create({name:'Lost build',owner:'o'});
 const built=await builder.initializeFrom(meta,templates.get('restaurant').files,'Template');
 const dist=path.join(builder.versionDir(meta.id,1),'dist');
 fs.rmSync(dist,{recursive:true,force:true});
 const server=http.createServer((req,res)=>{if(!builder.handlePreview(req,res)){res.writeHead(404);res.end()}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const base='http://127.0.0.1:'+server.address().port+builder.previewUrl(built);
  const r=await fetch(base);
  assert.equal(r.status,200);assert.match(await r.text(),/<div id="root">/);
  assert.ok(fs.existsSync(path.join(dist,'index.html')));
  // A forced rebuild replaces the files in place.
  assert.equal(await builder.ensureBuilt(meta.id,1,{force:true}),true);
  assert.equal((await fetch(base)).status,200);
  // A version that does not exist stays not found.
  assert.equal((await fetch(base.replace('/v/1/','/v/9/'))).status,404);
 }finally{server.close()}
});

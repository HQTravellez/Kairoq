'use strict';
// On Railway with a volume, workspace/ is a symlink to /data/workspace. Builds must still work.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path'),os=require('os');

test('an app builds when the projects folder is reached through a symlink',async()=>{
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'kq-sym-'));
 const realWs=path.join(base,'data','workspace');fs.mkdirSync(path.join(realWs,'react-projects'),{recursive:true});
 const linked=path.join(base,'app','workspace');fs.mkdirSync(path.dirname(linked),{recursive:true});
 fs.symlinkSync(realWs,linked,'dir');
 const before=process.env.KAIROQ_REACT_PROJECTS_DIR;
 process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(linked,'react-projects');
 try{
  const builder=require('../react-builder'),files=require('../react-design').starterFiles();
  const out=path.join(linked,'react-projects','p','versions','1','dist');
  await builder.runBuild(files,out);
  assert.ok(fs.existsSync(path.join(out,'index.html')),'the built app has its index.html');
 }finally{
  if(before===undefined)delete process.env.KAIROQ_REACT_PROJECTS_DIR;else process.env.KAIROQ_REACT_PROJECTS_DIR=before;
  fs.rmSync(base,{recursive:true,force:true});
 }
});

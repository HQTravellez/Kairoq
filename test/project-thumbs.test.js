'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path'),os=require('os');

test('a project card links its picture only once it exists, per version',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kq-thumbs-'));
 process.env.KAIROQ_PROJECT_THUMBS_DIR=dir;
 try{
  const thumbs=require('../project-thumbs');
  const p={id:'abcdef123456',current_version:3};
  assert.equal(thumbs.url(p),null,'no picture yet');
  assert.equal(thumbs.url({id:'../../etc',current_version:1}),null,'only real project ids');
  assert.equal(thumbs.url({id:'abcdef123456',current_version:0}),null,'nothing built yet');
  fs.writeFileSync(thumbs.file(p.id,3),'jpg');
  assert.equal(thumbs.url(p),'/api/create/projects/abcdef123456/thumb?v=3');
  assert.equal(thumbs.url({...p,current_version:4}),null,'a new version needs a new picture');
 }finally{delete process.env.KAIROQ_PROJECT_THUMBS_DIR;fs.rmSync(dir,{recursive:true,force:true})}
});

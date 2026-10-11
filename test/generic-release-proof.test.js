'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const proof=require('../generic-release-proof'),runtime=require('../app-runtime');
test('run IDs cannot escape the evidence directory',()=>{for(const id of ['../outside','A-valid','a/b','x',''])assert.throws(()=>proof.validateRunId(id));assert.equal(proof.validateRunId('fieldwork-20261011'),'fieldwork-20261011');});
test('a controlled regression is a failed draft and preserves the live files',()=>{
 const id='proof-test-'+crypto.randomBytes(8).toString('hex'),dir=path.join(runtime.ROOT,id,'versions','1');fs.mkdirSync(dir,{recursive:true});
 try{const schema={collections:[{name:'items',label:'Items',fields:[{name:'title',type:'text'}]}]};for(const name of ['index.html','styles.css','app.js'])fs.writeFileSync(path.join(dir,name),name==='app.js'?'// original':'original');fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify({schema,qa:{passed:true}}));runtime.saveMetadata({id,kind:'fullstack',version:1,deployed_version:1,status:'live',qa:{passed:true}});
 const regression=proof.introduceRegression(id);assert.equal(regression.version,2);assert.equal(runtime.metadata(id).deployed_version,1);assert.equal(runtime.metadata(id).qa.passed,false);assert.equal(runtime.readVersion(id,1).files['app.js'],'// original');assert.match(runtime.readVersion(id,2).files['app.js'],new RegExp(proof.REGRESSION));
 }finally{fs.rmSync(path.join(runtime.ROOT,id),{recursive:true,force:true});}
});
test('proof cannot pass without both public checks, repair and preserved data',()=>{
 const qa={passed:true,scope:'public deployed URL',evidence:[{screen:'Mobile',sha256:'a'.repeat(64)}],tested:['login','mobile390px','persistent records after reload','business acceptance: log_time']};
 const report={source_sha:'a'.repeat(40),before:{...qa,version:1},after:{...qa,version:3},regression:{detected:true},repair:{job:'repair-job'},saved_record_preserved:true};assert.doesNotThrow(()=>proof.assertPassed(report));
 for(const key of ['source_sha','before','after','regression','repair','saved_record_preserved'])assert.throws(()=>proof.assertPassed({...report,[key]:null}));
 assert.throws(()=>proof.assertPassed({...report,after:{...qa,version:1}}));assert.throws(()=>proof.assertPassed({...report,after:{...report.after,tested:['login']}}));
});

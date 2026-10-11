'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{spawnSync}=require('node:child_process');
const script=path.join(__dirname,'../scripts/verify-provider-sandbox.js');
function run(env={}) {
 const clean={...process.env,KAIROQ_SANDBOX_CONFIRM:'',KAIROQ_SANDBOX_SPEC_FILE:'',KAIROQ_SANDBOX_OPERATION_ID:'',KAIROQ_SANDBOX_HOST_CONFIRM:'',KAIROQ_SANDBOX_CREDENTIAL_NAME:'',...env};
 return spawnSync(process.execPath,[script],{env:clean,encoding:'utf8',timeout:5000});
}
test('sandbox verifier defaults to disabled and cannot make unapproved requests',()=>{
 const r=run();assert.notEqual(r.status,0);assert.match(r.stderr,/READ_ONLY_SANDBOX/);
});
test('sandbox verifier requires an explicit contract and operation',()=>{
 const r=run({KAIROQ_SANDBOX_CONFIRM:'READ_ONLY_SANDBOX'});assert.notEqual(r.status,0);
 assert.match(r.stderr,/KAIROQ_SANDBOX_SPEC_FILE/);
});

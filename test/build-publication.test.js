const test=require('node:test'),assert=require('node:assert/strict'),{finish}=require('../build-publication');
test('generation remains preview-only without explicit automatic publication',async()=>{
 const job={},result={id:'test-app',kind:'fullstack',qa:{passed:true}};await finish(job,result,{deployApp:()=>{throw Error('Unexpected deployment');}});assert.equal(job.status,'complete');assert.equal(job.result,result);
});
test('automatic publication waits for public verification and does not claim completion on failure',async()=>{
 const result={id:'test-app',kind:'fullstack',qa:{passed:true}},job={auto_deploy:true},states=[];
 await assert.rejects(finish(job,result,{save:j=>states.push(j.status),deployApp:async()=>{throw Error('Public login failed');}}),/Public login failed/);assert.deepEqual(states,['deploying']);assert.notEqual(job.status,'complete');assert.equal(job.result,result,'Passing draft remains available');
 await assert.rejects(finish(job,result,{deployApp:async()=>({...result,deployed_qa:{passed:false}})}),/did not pass/);
 await finish(job,result,{deployApp:async()=>({...result,deployed_version:2,deployed_qa:{passed:true}})});assert.equal(job.status,'complete');assert.equal(job.result.deployed_version,2);
});
test('website publication uses its normal public verification path',async()=>{const job={auto_deploy:true},model=()=>{};await finish(job,{id:'test-site',kind:'website',qa:{passed:true}},{callModel:model,deployWebsite:async(id,options)=>{assert.equal(id,'test-site');assert.equal(options.callModel,model);return{deployed_qa:{passed:true}};}});assert.equal(job.status,'complete');});
test('failed builds cannot invoke any publication backend',async()=>{await assert.rejects(finish({auto_deploy:true},{qa:{passed:false}},{deployApp:()=>assert.fail('Must not deploy')}),/passing build QA/);});

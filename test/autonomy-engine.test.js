"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const engine=require('../autonomy-engine');
const contract={format:'openapi3',title:'Fixture',baseUrl:'https://example.com',operations:[{id:'list',method:'GET',path:'/items',successCodes:['200'],responseSchemas:{'200':{type:'object',required:['id'],properties:{id:{type:'integer'}}}}},{id:'write',method:'POST',path:'/items',successCodes:['201']}],auth:[]};
function fakeStore(){const values=[];return {values,append:async(_id,x)=>values.push(x),history:async()=>values};}
test('runs and validates response, keeping secrets out of persistent memory',async()=>{
 const persistence=fakeStore();
 const r=await engine.run({projectId:'demo',apiPlan:contract,operationId:'list',approved:true},{execute:async()=>({status:200,data:{id:42,token:'secret'}}),persistence});
 assert.equal(r.passed,true);assert.equal(r.response.data.token,'[redacted]');
 assert.equal(JSON.stringify(persistence.values).includes('secret'),false);
 assert.equal(persistence.values[0].responseDigest.length,64);
});
test('schema mismatch is a real failure',async()=>{
 const r=await engine.run({projectId:'demo',apiPlan:contract,operationId:'list',approved:true},{execute:async()=>({status:200,data:{id:'bad'}}),persistence:fakeStore()});
 assert.equal(r.passed,false);assert.equal(r.assessment.schemaMatched,false);
});
test('never retries mutating operations and requires approval',async()=>{
 let calls=0;const persistence=fakeStore();
 await assert.rejects(()=>engine.run({projectId:'demo',apiPlan:contract,operationId:'list',approved:false},{persistence}),/approval/);
 const r=await engine.run({projectId:'demo',apiPlan:contract,operationId:'write',approved:true,maxAttempts:3},{persistence,execute:async()=>{calls++;throw Error('ETIMEDOUT')}});
 assert.equal(r.passed,false);assert.equal(calls,1);
});
test('retries transient GET errors only within bounds',async()=>{
 let calls=0;
 const r=await engine.run({projectId:'demo',apiPlan:contract,operationId:'list',approved:true,maxAttempts:10},{persistence:fakeStore(),sleep:async()=>{},execute:async()=>{calls++;if(calls<3)throw Error('ETIMEDOUT');return {status:200,data:{id:1}}}});
 assert.equal(r.passed,true);assert.equal(calls,3);
});
test('candidate skill requires independent improved benchmark',async()=>{
 const memory=fakeStore(),result={passed:true,evidence:{responseDigest:'abc'}};
 const skill=await engine.proposeSkill({projectId:'demo',skillId:'fixture',runResults:[result]},memory);
 await assert.rejects(()=>engine.promoteSkill({projectId:'demo',skillId:'fixture',version:skill.version,benchmark:{newPassed:1,oldPassed:1,total:1}},memory),/benchmark/);
 const promotion=await engine.promoteSkill({projectId:'demo',skillId:'fixture',version:skill.version,benchmark:{newPassed:2,oldPassed:1,total:2}},memory);
 assert.equal(promotion.type,'skill-promotion');
});

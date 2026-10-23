"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),skills=require('../api-skills-verified');
function database(){const records=[];return {records,append:async(_,v)=>{records.push(v);return v},history:async()=>records};}
test('learns API failures and persists an improved version',async()=>{const db=database();db.records.push({type:'api-execution',operationId:'getItems',passed:false,assessment:{validStatus:true,schemaMatched:false}});
 const r=await skills.learn({projectId:'demo',operationId:'getItems'},{persistence:db});assert.equal(r.status,'promoted');assert.equal(r.version,1);assert.equal(r.benchmark.kind,'guidance-routing-only');
 const a=await skills.active({projectId:'demo',operationId:'getItems'},{persistence:db});assert.equal(skills.choose(a.rules,'schema-mismatch'),'inspect-response-schema');
 assert.equal((await skills.learn({projectId:'demo',operationId:'getItems'},{persistence:db})).status,'unchanged');
});
test('next failure creates v2 and preserves prior guidance',async()=>{const db=database();db.records.push({type:'api-execution',operationId:'getItems',passed:false,assessment:{validStatus:false}});await skills.learn({projectId:'demo',operationId:'getItems'},{persistence:db});
 db.records.push({type:'api-execution',operationId:'getItems',passed:false,assessment:{schemaMatched:false,validStatus:true}});const r=await skills.learn({projectId:'demo',operationId:'getItems'},{persistence:db});assert.equal(r.version,2);assert.equal(r.rules.length,2);
});
test('refuses fabricated benchmark and blocked authentication errors',async()=>{const db=database();db.records.push({type:'api-execution',operationId:'getItems',passed:false,reason:'Request blocked by authentication or execution policy'});await assert.rejects(()=>skills.candidate({projectId:'demo',operationId:'getItems'},{persistence:db}),/No stored/);
 db.records.push({type:'api-execution',operationId:'getItems',passed:false,assessment:{schemaMatched:false}});const c=await skills.candidate({projectId:'demo',operationId:'getItems'},{persistence:db});
 await assert.rejects(()=>skills.promote({projectId:'demo',operationId:'getItems',version:c.version},{persistence:db}),/benchmark/);
 const b=await skills.benchmark({projectId:'demo',operationId:'getItems',version:c.version},{persistence:db});assert.equal(b.improved,true);assert.equal((await skills.promote({projectId:'demo',operationId:'getItems',version:c.version},{persistence:db})).status,'promoted');
});

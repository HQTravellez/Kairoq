'use strict';
// Synthetic held-out retrieval evaluation. Does not measure model code-generation quality.
const assert=require('node:assert/strict'),learning=require('../verified-learning');
async function main(){
 const rows=[],store={append:async(id,r)=>rows.push({...r,scope:id}),history:async(id)=>rows.filter(r=>r.scope===id)};
 const meta={owner:'synthetic',id:'benchmark'};
 const cases=[['camera capture','photo permission','camera'],['food diary','meal macros','nutrition'],['room booking','reservation availability','booking'],['login flow','sign-in authentication','authentication']];
 let baseline=0,learned=0;
 for(let i=0;i<cases.length;i++){
  const [train,holdout,expected]=cases[i];
  if((await learning.recall({meta,query:holdout},store)).length)baseline++;
  await learning.capture({meta,query:train,tools:['write_files','build_and_test','test_ui'],evidence:{built:true,verified:true,skipped:false,errors:[],failed:0,interactions:2,assertions:1,version:i+1,sourceDigest:String(i+1).repeat(64)}},store);
  const result=await learning.recall({meta,query:holdout},store);assert.ok(result.some(x=>x.task.includes(expected)));learned++;
 }
 assert.deepEqual(await learning.recall({meta:{...meta,owner:'other'},query:'photo'},store),[]);
 console.log(JSON.stringify({kind:'synthetic-retrieval-only',cases:cases.length,baselineMatches:baseline,learnedMatches:learned,crossOwnerLeakage:0,modelQualityMeasured:false}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});

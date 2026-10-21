"use strict";
const t=require("node:test"),assert=require("node:assert/strict");
const bench=require("../scripts/decision-provider-benchmark");
t("routing fixture has independent expected labels and deterministic baseline",()=>{
 assert.equal(bench.fixtures.length,10);
 assert.deepEqual(new Set(bench.fixtures.map(x=>x.expected)),new Set(["coding","api","design","qa","discussion"]));
 const m=bench.deterministicBaseline();
 assert.equal(m.status,"measured-local-baseline-not-LLM");
 assert.equal(m.metrics.total,10);
 assert.ok(m.metrics.decidedAccuracy>=0&&m.metrics.decidedAccuracy<=1);
});
t("median and p95 have correct discrete ranks",()=>{
 assert.equal(bench.percentile([8,2,10,1],.5),2);
 assert.equal(bench.percentile([8,2,10,1],.95),10);
 assert.equal(bench.percentile([],0.5),null);
});
t("coverage penalizes abstentions and no fabricated billing",()=>{
 const s=bench.rateStats([{id:"x",route:"coding",status:"routed",correct:true,elapsedMs:10,inputTokens:100,costUSD:0.01},
  {id:"y",route:null,status:"review",correct:false,elapsedMs:25,inputTokens:null,costUSD:null}]);
 assert.equal(s.coverage,0.5);assert.equal(s.overallAccuracy,0.5);
 assert.equal(s.decidedAccuracy,1);assert.equal(s.estimatedTokenCostUSD,null);
});
t("without live provider keys the benchmark cannot report accuracy",async()=>{
 const jev=process.env.TYPESAFE_API_KEY,scale=process.env.SCALEDOWN_API_KEY;
 delete process.env.TYPESAFE_API_KEY;delete process.env.SCALEDOWN_API_KEY;
 try{
  assert.equal((await bench.benchmarkDecisions("jev")).status,"blocked-no-key");
  assert.equal((await bench.benchmarkDecisions("scaledown")).metrics,null);
  assert.equal((await bench.benchmarkCompression()).status,"blocked-no-key");
 }finally{
  if(jev)process.env.TYPESAFE_API_KEY=jev;
  if(scale)process.env.SCALEDOWN_API_KEY=scale;
 }
});

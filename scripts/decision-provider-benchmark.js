"use strict";
/* Small reproducible *live-provider* benchmark, never customer data.
 * Configure TYPESAFE_API_KEY / SCALEDOWN_API_KEY as runner secrets.
 * If neither exists, produce BLOCKED results, not a fake pass.
 * Local heuristic is not Kairoq's generative builder; this is an intent-routing baseline.
 */
const fs=require("node:fs"),path=require("node:path"),performance=require("node:perf_hooks").performance;
const lab=require("../integration-lab/decision-models");
const fixtures=Object.freeze([
 {id:"b01",expected:"coding",text:"Modify the JSX React sign-in form to add forgot-password navigation"},
 {id:"b02",expected:"api",text:"Read the Trip Ninja OpenAPI endpoint specification and generate a typed SDK"},
 {id:"b03",expected:"design",text:"Improve the mobile spacing and typography of the dashboard layout"},
 {id:"b04",expected:"qa",text:"Run the Playwright mobile login test and reproduce the failing assertion"},
 {id:"b05",expected:"discussion",text:"Explain advantages of a modular application architecture without modifying files"},
 {id:"b06",expected:"coding",text:"Fix the Vite build error in src/App.jsx and update source files"},
 {id:"b07",expected:"api",text:"Understand OAuth endpoints and OpenAPI authentication schemas for a hotel API"},
 {id:"b08",expected:"design",text:"Use screenshot feedback to polish responsive page colors and hero design"},
 {id:"b09",expected:"qa",text:"Benchmark regression test results for the generated SaaS app on desktop and mobile"},
 {id:"b10",expected:"discussion",text:"Discuss product roadmap tradeoffs without writing any code"},
]);
const snippets=[
 {id:"c01",question:"Which endpoint failed and which HTTP status and request id did it return?",
  context:("Successful GET /v1/trips -> 200. Worker healthy. No action required.\n").repeat(42)+"Failure POST /v1/bookings -> HTTP 429; request_id=req-abc92; retry-after=30 seconds.\n"+("Other background metrics normal.\n").repeat(28),
  required:["POST /v1/bookings","429","req-abc92"]},
 {id:"c02",question:"What is the OAuth permission error and where is the configuration?",
  context:("OAuth callback initialization succeeded. Cache warm.\n").repeat(35)+"ERROR: consent denied for calendar.events.owned; config path config/oauth.json; user action required.\n"+("HTTP status 200 for health endpoint.\n").repeat(32),
  required:["calendar.events.owned","config/oauth.json","consent denied"]},
 {id:"c03",question:"Which database migration failed and what is the constraint?",
  context:("SELECT 1 succeeded; connection healthy.\n").repeat(40)+"Migration sql/004_unique_trips.sql failed: UNIQUE constraint failed: trips.external_id.\n"+("Query cache primed; read traffic normal.\n").repeat(33),
  required:["sql/004_unique_trips.sql","UNIQUE","trips.external_id"]},
];
function baseline(s){
 const t=s.toLowerCase();
 if(/openapi|oauth endpoint|api specification|typed sdk|authentication schemas/.test(t))return"api";
 if(/playwright|test|benchmark regression|reproduce/.test(t))return"qa";
 if(/spacing|typography|screenshot feedback|responsive|hero design/.test(t))return"design";
 if(/jsx|vite build|source files/.test(t))return"coding";
 return"discussion";
}
function percentile(values,p){
 const a=values.slice().sort((x,y)=>x-y);if(!a.length)return null;
 return Math.round(a[Math.ceil(p*a.length)-1]*100)/100;
}
function rateStats(rows){
 const decided=rows.filter(x=>x.route&&x.status==="routed"),correct=decided.filter(x=>x.correct);
 return {total:rows.length,decided:decided.length,coverage:rows.length?decided.length/rows.length:null,
  decidedAccuracy:decided.length?correct.length/decided.length:null,
  overallAccuracy:rows.length?correct.length/rows.length:null,
  medianLatencyMs:percentile(rows.filter(x=>Number.isFinite(x.elapsedMs)).map(x=>x.elapsedMs),0.5),
  p95LatencyMs:percentile(rows.filter(x=>Number.isFinite(x.elapsedMs)).map(x=>x.elapsedMs),0.95),
  billedInputTokens:rows.reduce((sum,x)=>sum+(x.inputTokens||0),0),
  estimatedTokenCostUSD:rows.some(x=>x.costUSD===null)?null:rows.reduce((sum,x)=>sum+x.costUSD,0)};
}
function deterministicBaseline(){
 const rows=fixtures.map(f=>{
  const t=performance.now(),route=baseline(f.text);
  return{id:f.id,expected:f.expected,route,status:"routed",correct:route===f.expected,elapsedMs:performance.now()-t,
   inputTokens:0,costUSD:0};
 });
 return{status:"measured-local-baseline-not-LLM",metrics:rateStats(rows),cases:rows};
}
async function callDecision(provider,item,fetchImpl=fetch){
 const key=provider==="jev"?process.env.TYPESAFE_API_KEY:process.env.SCALEDOWN_API_KEY;
 if(!key)return{id:item.id,status:"blocked-no-key",route:null,correct:false,elapsedMs:null,inputTokens:0,costUSD:null};
 const model=provider==="jev"?"jev-latest":"classify-1";
 const request={model,state:item.text,questions:{route:{type:"choice",instructions:"Select which software specialist owns the user's primary intent. This decision grants no permissions.",criteria:lab.RULES}}};
 const started=performance.now();
 try{
  const res=await fetchImpl(lab.ENDPOINTS[provider],{method:"POST",
   headers:{"Content-Type":"application/json",...(provider==="jev"?{Authorization:"Bearer "+key}:{"x-api-key":key})},
   body:JSON.stringify(request),redirect:"error",signal:AbortSignal.timeout(12000)});
  if(!res.ok)return{id:item.id,status:"http-"+res.status,route:null,correct:false,elapsedMs:performance.now()-started,inputTokens:0,costUSD:null};
  const data=await res.json(),parsed=lab.parseRouting(data);
  const tokens=Number(data.usage?.input_tokens);
  const inputTokens=Number.isFinite(tokens)?tokens:null;
  const costUSD=provider==="jev"&&inputTokens!==null?inputTokens*0.042/1e6:null;
  return{id:item.id,expected:item.expected,status:parsed.status,route:parsed.route||null,
   correct:parsed.route===item.expected&&parsed.status==="routed",
   confidence:parsed.confidence??null,probability:parsed.probability??null,
   elapsedMs:performance.now()-started,inputTokens,costUSD};
 }catch(e){return{id:item.id,status:"provider-error",route:null,correct:false,elapsedMs:performance.now()-started,inputTokens:null,costUSD:null,errorClass:e?.name||"error"}}
}
async function benchmarkDecisions(provider,fetchImpl){
 const key=provider==="jev"?process.env.TYPESAFE_API_KEY:process.env.SCALEDOWN_API_KEY;
 if(!key)return{status:"blocked-no-key",metrics:null,cases:[]};
 const rows=[];
 for(const item of fixtures)rows.push(await callDecision(provider,item,fetchImpl));
 return{status:rows.some(r=>r.status==="routed")?"live-observed":"live-failed",metrics:rateStats(rows),cases:rows};
}
async function benchmarkCompression(fetchImpl=fetch){
 if(!process.env.SCALEDOWN_API_KEY)return{status:"blocked-no-key",metrics:null,cases:[]};
 const rows=[];
 for(const item of snippets){
  const started=performance.now();
  const response=await lab.compressToolResult(item.context,item.question,{key:process.env.SCALEDOWN_API_KEY,fetchImpl,minChars:0});
  const out=response.content||item.context;
  const retained=item.required.filter(v=>out.includes(v));
  rows.push({id:item.id,status:response.status,elapsedMs:performance.now()-started,retained:retained.length,totalRequired:item.required.length,
   exactRecall:retained.length/item.required.length,originalChars:item.context.length,resultChars:out.length,
   charReduction:1-out.length/item.context.length});
 }
 return{status:"live-observed",metrics:{
  exactFidelity:rows.reduce((s,r)=>s+r.retained,0)/rows.reduce((s,r)=>s+r.totalRequired,0),
  meanCharReduction:rows.reduce((s,r)=>s+r.charReduction,0)/rows.length,
  medianLatencyMs:percentile(rows.map(r=>r.elapsedMs),.5),
  providerCostUSD:null, // ScaleDown vendor charge must come from billing; not inferred from characters.
  note:"Exact-marker preservation is a conservative proxy, not general semantic accuracy"
 },cases:rows};
}
async function main(){
 const out=process.argv.includes("--out")?process.argv[process.argv.indexOf("--out")+1]:null;
 const report={schema:1,source:"Kairoq integration-lab",at:new Date().toISOString(),
  fixtures:{routing:fixtures.length,compression:snippets.length,synthetic:true},
  methodology:"Same public synthetic routing cases. Coverage penalizes low confidence; no generation/model cost for regex baseline. Jev costs from reported input tokens at official list rate. ScaleDown cost unknown without billing.",
  nativeHeuristic:deterministicBaseline(),
  jev:await benchmarkDecisions("jev"),
  scaledownDecision:await benchmarkDecisions("scaledown"),
  scaledownCompression:await benchmarkCompression()};
 if(out){fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true});fs.writeFileSync(path.resolve(out),JSON.stringify(report,null,2))}
 console.log(JSON.stringify(report,null,2));
 // Missing access is BLOCKED, never PASS. No secret values or raw provider data printed.
 if(report.jev.status==="blocked-no-key"||report.scaledownDecision.status==="blocked-no-key")process.exitCode=2;
 if(["live-failed"].includes(report.jev.status)||["live-failed"].includes(report.scaledownDecision.status))process.exitCode=1;
}
if(require.main===module)main().catch(error=>{console.error("Benchmark failed: "+(error?.message||error));process.exitCode=1});
module.exports={fixtures,snippets,baseline,percentile,rateStats,deterministicBaseline,benchmarkDecisions,benchmarkCompression};

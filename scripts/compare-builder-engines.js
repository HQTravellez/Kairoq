"use strict";
// Same six real-model prompts and follow-ups in independent Kairoq / OpenCode arms.
// This is a smoke comparison, not the deployed full-stack benchmark.
const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),cp=require("node:child_process");
if(!process.argv.includes("--approve-model-costs")){console.error("Model-cost approval flag required");process.exit(2)}
if(!process.env.EXPLABS_API_KEY&&!process.env.OPENROUTER_API_KEY){console.error("No model key configured");process.exit(2)}
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"kairoq-comparison-")),arms={};
for(const name of ["kairoq","opencode"]){
 const out=path.join(dir,name+".json");
 const result=cp.spawnSync(process.execPath,[path.join(__dirname,"create-quality-check.js"),"--limit","6","--out",out],{
  cwd:path.dirname(__dirname),env:{...process.env,KAIROQ_BUILD_ENGINE:name,NODE_ENV:"test"},encoding:"utf8",timeout:1500000,maxBuffer:2000000});
 arms[name]={exitCode:result.status,summary:fs.existsSync(out)?JSON.parse(fs.readFileSync(out,"utf8")).summary:null,
  error:(result.error?.message||result.stderr||"").slice(-1000)};
}
const report={benchmark:"six consistent build and follow-up prompts; NOT full-stack authentication or deployment",arms,
 comparable:Boolean(arms.kairoq.summary&&arms.opencode.summary)};
const dest=process.env.KAIROQ_COMPARE_OUT;
if(dest)fs.writeFileSync(path.resolve(dest),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(!report.comparable||arms.kairoq.exitCode||arms.opencode.exitCode)process.exitCode=1;

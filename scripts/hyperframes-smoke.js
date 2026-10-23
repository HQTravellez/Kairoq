"use strict";
// Owner-operated experimental HyperFrames smoke test. No Kairoq HTTP endpoint.
// Requires preinstalled local CLI, Chrome, FFmpeg and explicit environment flag.
const fs=require("node:fs"),path=require("node:path"),hf=require("../hyperframes-video");
async function main(){
 const job=hf.prepare({title:"Make the next move.",subtitle:"A product story built frame by frame.",aspect:"9:16"});
 try{
  const result=await hf.render(job);
  const dest=path.resolve(process.env.HYPERFRAMES_SMOKE_DEST||"benchmark-artifacts/hyperframes-motion.mp4");
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.copyFileSync(result.path,dest);
  console.log(JSON.stringify({status:"verified-local-mp4",duration:result.duration,bytes:result.bytes,
   aspect:result.aspect,path:dest,liveModelApiCalls:0},null,2));
 }finally{hf.cleanup(job)}
}
main().catch(e=>{console.error("HyperFrames local smoke failed: "+e.message);process.exitCode=1;});

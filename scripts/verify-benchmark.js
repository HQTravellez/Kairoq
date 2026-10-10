'use strict';
const fs=require('node:fs'),path=require('node:path');
const gates=require('../benchmark-gates');
function assertReport(report,sourceSha){
 if(!gates.currentPass(report,{source_sha:sourceSha,contract_version:gates.CONTRACT_VERSION}))throw Error('No complete deployed benchmark pass for the expected commit and contract');
 for(const surface of ['app','website']){
  const qa=report[surface].deployed_qa,visual=qa.visual_review;
  if(!qa.evidence?.length||visual.evidence?.length!==qa.evidence.length||!qa.evidence.every(e=>visual.evidence.some(v=>v.screen===e.screen&&v.sha256===e.sha256)))throw Error(surface+' public visual evidence does not match');
 }
 return report;
}
async function main(){
 const folder=path.join(__dirname,'..','benchmark-artifacts');fs.mkdirSync(folder,{recursive:true});
 const expected=process.env.KAIROQ_EXPECTED_SHA||process.env.GITHUB_SHA;let report,origin,cookie='';
 if(process.env.KAIROQ_BENCHMARK_REPORT)report=JSON.parse(fs.readFileSync(process.env.KAIROQ_BENCHMARK_REPORT,'utf8'));
 else{
  origin=require('../app-release').publicOrigin({KAIROQ_PUBLIC_URL:process.env.KAIROQ_PUBLIC_URL});if(!origin)throw Error('Set KAIROQ_PUBLIC_URL or KAIROQ_BENCHMARK_REPORT');
  if(process.env.KAIROQ_BENCHMARK_PASSWORD){const login=await fetch(origin+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:process.env.KAIROQ_BENCHMARK_PASSWORD}),signal:AbortSignal.timeout(10000),redirect:'error'});if(!login.ok)throw Error('Benchmark sign-in failed');cookie=(login.headers.get('set-cookie')||'').split(';')[0];}
  const response=await fetch(origin+'/api/developer/travellez-benchmark-status',{headers:cookie?{cookie}:{},signal:AbortSignal.timeout(10000),redirect:'error'});if(!response.ok)throw Error('Benchmark report unavailable: '+response.status);report=await response.json();
 }
 fs.writeFileSync(path.join(folder,'report.json'),JSON.stringify(report,null,2));
 assertReport(report,expected);
 if(origin)for(const surface of ['app','website'])for(const [index,entry]of report[surface].deployed_qa.evidence.entries()){
  const response=await fetch(origin+'/api/developer/travellez-benchmark-evidence/'+surface+'/'+(index+1),{headers:cookie?{cookie}:{},signal:AbortSignal.timeout(10000),redirect:'error'});if(!response.ok)throw Error('Screenshot artifact unavailable');const bytes=Buffer.from(await response.arrayBuffer());if(require('node:crypto').createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw Error('Screenshot artifact hash mismatch');fs.writeFileSync(path.join(folder,surface+'-'+(index+1)+'.jpg'),bytes);
 }
 console.log('Verified deployed Travellez benchmark for '+expected);
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={assertReport};

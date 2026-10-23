"use strict";
/**
 * Evidence-first API execution pipeline. Explicit host/operation approvals remain enforced
 * by api-adapter. No AI-generated instruction is ever executed as code.
 */
const crypto=require('node:crypto');
const api=require('./api-learning');
const adapter=require('./api-adapter');
const validation=require('./api-validation');
const backend=require('./api-backend');
const sdk=require('./api-sdk');
const store=require('./autonomy-store');

function contractFor(input){const plan=input?.operations?input:api.learn(input);if(!Array.isArray(plan.operations)||!plan.operations.length)throw Error('Documented operations required');if(plan.format==='unstructured')throw Error('Formal API specification required for live execution');return plan;}
function statusCodes(op){return op.successCodes?.length?op.successCodes.map(Number):[200,201,202,204];}
function assess(op,result){
 const expected=statusCodes(op),validStatus=expected.includes(result.status),schema=op.responseSchemas?.[String(result.status)];
 let schemaMatched=null,schemaError=null;
 if(schema&&Object.keys(schema).length){try{validation.validate(schema,result.data,'response');schemaMatched=true;}catch(e){schemaMatched=false;schemaError=String(e.message).slice(0,280);}}
 return {passed:validStatus&&schemaMatched!==false,validStatus,schemaMatched,schemaError,expectedStatuses:expected,actualStatus:result.status};
}
function summaryFrom({plan,operation,assessment,attempts,response,durationMs}){
 // Deliberately retain no request bodies, response bodies, authorization headers or token values.
 return {operationId:operation.id,method:operation.method,path:operation.path,baseHost:new URL(plan.baseUrl).hostname,assessment,attempts,durationMs,responseDigest:crypto.createHash('sha256').update(JSON.stringify(response.data??null)).digest('hex'),responseBytes:Buffer.byteLength(JSON.stringify(response.data??null)),recordedAt:new Date().toISOString()};
}
function assertInput(input){
 if(!input||typeof input!=='object'||!input.projectId||!input.operationId)throw Error('projectId and operationId required');
 if(!/^[a-zA-Z0-9_-]{1,80}$/.test(input.projectId))throw Error('Invalid project ID');
 if(input.approved!==true)throw Error('Explicit approval required');
}
async function run(input,{execute=adapter.execute,sleep=ms=>new Promise(r=>setTimeout(r,ms)),persistence=store}={}){
 assertInput(input);
 const plan=contractFor(input.apiPlan||input.apiSpec),operation=plan.operations.find(o=>o.id===input.operationId);
 if(!operation)throw Error('Unknown API operation');
 const isRead=['GET','HEAD'].includes(operation.method);
 const maxAttempts=isRead?Math.max(1,Math.min(3,Number(input.maxAttempts)||1)):1;
 const started=Date.now();let response,attempts=0,lastError;
 for(let i=0;i<maxAttempts;i++){
  attempts++;
  try{
   response=await execute({plan,operationId:operation.id,pathParams:input.pathParams||{},query:input.query||{},body:input.body,credentialName:input.credentialName,oauthProvider:input.oauthProvider,approved:true,approvedWrites:input.approvedWrites===true});
   if(!Number.isInteger(response?.status))throw Error('Executor returned invalid HTTP status');
   break;
  }catch(e){
   lastError=e;
   // Never retry authorization, policy, invalid input or writes. Only retry transient transport failures.
   if(!isRead||i===maxAttempts-1||!/timeout|timed out|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up/i.test(String(e.message)))break;
   await sleep(150*(i+1));
  }
 }
 if(!response){
  const failure={projectId:input.projectId,operationId:operation.id,passed:false,attempts,reason:String(lastError?.message||'Request failed').slice(0,240),recordedAt:new Date().toISOString()};
  // Persist only generic diagnostic, never raw transport messages containing URLs/query tokens.
  failure.reason=/approved|token|credential|auth|secret/i.test(failure.reason)?'Request blocked by authentication or execution policy':'Execution failed';
  await persistence.append(input.projectId,{type:'api-execution',...failure});
  return {passed:false,attempts,error:failure.reason,evidence:failure};
 }
 const assessment=assess(operation,response);
 const evidence=summaryFrom({plan,operation,assessment,attempts,response,durationMs:Date.now()-started});
 await persistence.append(input.projectId,{type:'api-execution',passed:assessment.passed,...evidence});
 if(process.env.KAIROQ_AUTONOMY_AUTO_SKILLS==='true'&&persistence===store){
  try{await require('./api-skills-verified').learn({projectId:input.projectId,operationId:operation.id});}
  catch(_){await persistence.append(input.projectId,{type:'skill-learning-error',operationId:operation.id,reason:'Automatic skill learning failed',recordedAt:new Date().toISOString()});}
 }
 return {passed:assessment.passed,assessment,attempts,evidence,
   // The caller may inspect response, but this is never persisted and must be sanitized for API responses.
   response:{status:response.status,data:validation.sanitize(response.data,[input.credentialName?process.env[input.credentialName]:''])}};
}
async function workflow(input,deps={}){
 const plan=contractFor(input.apiPlan||input.apiSpec);
 const ids=input.operationIds||plan.operations.filter(o=>['GET','HEAD'].includes(o.method)).map(o=>o.id).slice(0,10);
 if(!Array.isArray(ids)||ids.length>20||ids.length===0||new Set(ids).size!==ids.length)throw Error('Choose 1–20 distinct documented operations');
 const results=[];
 for(const id of ids){
  // Caller must supply explicitly approved, per-operation parameters. No guessing or auto-writes.
  const params=input.argumentsByOperation?.[id]||{};
  results.push(await run({...params,apiPlan:plan,projectId:input.projectId,operationId:id,approved:input.approved,approvedWrites:input.approvedWrites},deps));
 }
 const passed=results.filter(r=>r.passed).length;
 return {projectId:input.projectId,total:results.length,passed,failed:results.length-passed,results};
}
async function proposeSkill({projectId,skillId,runResults},persistence=store){
 if(!Array.isArray(runResults)||!runResults.length)throw Error('Evidence required');
 if(!/^[a-zA-Z0-9_-]{1,80}$/.test(skillId||''))throw Error('Invalid skill ID');
 const history=await persistence.history(projectId),previous=history.filter(x=>x.type==='skill-candidate'&&x.skillId===skillId);
 const verified=new Set(history.filter(x=>x.type==='api-execution'&&x.passed).map(x=>x.responseDigest));
 const success=runResults.filter(x=>x.passed&&x.evidence?.responseDigest&&verified.has(x.evidence.responseDigest)).length;
 const revision={type:'skill-candidate',skillId,version:previous.length+1,evidenceCount:runResults.length,success,requiresIndependentBenchmark:true,status:'candidate',createdAt:new Date().toISOString()};
 await persistence.append(projectId,revision);
 return revision;
}
async function promoteSkill({projectId,skillId,version,benchmark},persistence=store){
 const hist=await persistence.history(projectId),candidate=hist.find(x=>x.type==='skill-candidate'&&x.skillId===skillId&&x.version===version);
 if(!candidate)throw Error('Candidate not found');
 if(!benchmark||!Number.isInteger(benchmark.newPassed)||!Number.isInteger(benchmark.oldPassed)||!Number.isInteger(benchmark.total)||benchmark.total<1||benchmark.newPassed>benchmark.total||benchmark.oldPassed>benchmark.total||benchmark.newPassed<=benchmark.oldPassed||benchmark.newPassed<benchmark.total)throw Error('Independent benchmark must show full pass and strict improvement');
 const approved={type:'skill-promotion',skillId,version,benchmark,recordedAt:new Date().toISOString()};
 await persistence.append(projectId,approved);return approved;
}
function generateProduct(apiSpec){
 const plan=contractFor(apiSpec);
 return {backend:backend.generate(plan),sdk:sdk.generate(plan),status:'generated-not-verified',integrationRequired:true};
}
module.exports={contractFor,assess,run,workflow,proposeSkill,promoteSkill,generateProduct};

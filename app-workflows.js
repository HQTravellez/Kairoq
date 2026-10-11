'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
const validation=require('./api-validation'),orchestrator=require('./product-orchestrator'),adapter=require('./api-adapter');
function valueAt(source,parts){let value=source;for(const key of parts){if(!value||typeof value!=='object'||!Object.hasOwn(value,key))throw Error('Missing workflow response mapping: '+parts.join('.'));value=value[key];}return value;}
function resolve(template,inputs,outputs){
 if(Array.isArray(template))return template.map(v=>resolve(v,inputs,outputs));
 if(template&&typeof template==='object'){
  if(Object.hasOwn(template,'$input')){if(!Object.hasOwn(inputs,template.$input))throw Error('Missing workflow input: '+template.$input);return inputs[template.$input];}
  if(Object.hasOwn(template,'$step')){const [id,...parts]=template.$step.split('.');if(!Object.hasOwn(outputs,id))throw Error('Mapped step has no successful result: '+id);return valueAt(outputs[id],parts);}
  return Object.fromEntries(Object.entries(template).map(([k,v])=>[k,resolve(v,inputs,outputs)]));
 }
 return template;
}
function inputsFor(workflow,raw){if(!raw||typeof raw!=='object'||Array.isArray(raw)||Buffer.byteLength(JSON.stringify(raw))>50000)throw Error('Invalid workflow inputs');for(const key of Object.keys(raw))if(!workflow.inputs.some(f=>f.name===key))throw Error('Unknown workflow input: '+key);for(const field of workflow.inputs){if(field.required&&!Object.hasOwn(raw,field.name))throw Error('Missing workflow input: '+field.name);if(Object.hasOwn(raw,field.name))validation.validate({type:field.type,...(field.options?{enum:field.options}:{})},raw[field.name],'input.'+field.name);}return raw;}
function open(root,id){if(!/^[a-z0-9-]{5,85}$/.test(id))throw Error('Invalid app ID');const dir=path.join(root,id);fs.mkdirSync(dir,{recursive:true});const db=new DatabaseSync(path.join(dir,'workflows.sqlite'));db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS workflow_runs(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,workflow_id TEXT NOT NULL,request_key TEXT NOT NULL,fingerprint TEXT NOT NULL,status TEXT NOT NULL,payload TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(user_id,workflow_id,request_key));');return db;}
function fingerprint(envelope){return crypto.createHash('sha256').update(JSON.stringify(envelope)).digest('hex');}
function verified(root,id,envelope){const filename=path.join(root,id,'workflows.sqlite');if(!fs.existsSync(filename))return[];const db=open(root,id);try{const rows=db.prepare("SELECT workflow_id,payload FROM workflow_runs WHERE status='complete'").all(),scope=fingerprint(envelope);return[...new Set(rows.filter(r=>{const p=JSON.parse(r.payload);return p.contractFingerprint===scope&&p.verifiedProvider===true;}).map(r=>r.workflow_id))];}finally{db.close();}}
function list(envelope,id,root){if(!envelope)return{workflows:[],readiness:{status:'review_ready',blockers:[]}};const {plan,apiContract}=envelope;return{workflows:plan.workflows.map(w=>({id:w.id,label:w.label,description:w.description,inputs:w.inputs,steps:w.steps.map(s=>({id:s.id,operationId:s.operationId,method:apiContract.operations.find(o=>o.id===s.operationId).method})),persistsTo:w.persist?.collection})),readiness:orchestrator.readiness(plan,apiContract,id,process.env,root?verified(root,id,envelope):[])};}
function inspect(root,id,userId,runId){const db=open(root,id);try{const row=db.prepare('SELECT payload FROM workflow_runs WHERE id=? AND user_id=?').get(runId,userId);if(!row)throw Object.assign(Error('Workflow run not found'),{status:404});return JSON.parse(row.payload);}finally{db.close();}}
async function run({root,id,userId,envelope,workflowId,inputs={},requestId,mode='simulate',confirmWrites=false,persist},{execute=adapter.execute}={}){
 const {plan,apiContract}=envelope||{};if(!plan||!apiContract)throw Error('No provider workflow is configured');
 const workflow=plan.workflows.find(w=>w.id===workflowId);if(!workflow)throw Object.assign(Error('Workflow not found'),{status:404});
 inputsFor(workflow,inputs);if(!['simulate','live'].includes(mode))throw Error('Unknown workflow execution mode');
 if(mode==='simulate')return{id:null,workflowId,mode,status:'simulation',externalCalls:0,steps:workflow.steps.map(s=>({id:s.id,operationId:s.operationId,status:'planned',arguments:s.arguments,...(s.when?{when:s.when}:{})})),message:'This is an execution plan; no provider results or saved records were created.'};
 if(!/^[A-Za-z0-9_-]{16,100}$/.test(requestId||''))throw Error('Use a unique requestId of 16–100 characters');
 const credentialName=orchestrator.readiness(plan,apiContract,id).connections[0].credentialName;
 const operations=workflow.steps.map(s=>apiContract.operations.find(o=>o.id===s.operationId));
 if(process.env.KAIROQ_API_LIVE_ENABLED!=='true')throw Object.assign(Error('Live provider execution is disabled'),{status:409});
 if(operations.some(o=>!['GET','HEAD'].includes(o.method))&&!confirmWrites)throw Object.assign(Error('Confirm provider writes before running this workflow'),{status:409});
 if(operations.some(o=>o.authenticationRequired)&&!process.env[credentialName])throw Object.assign(Error('Configure server credential '+credentialName),{status:409});
 // Preflight ALL operations so a later missing permission cannot follow an earlier write.
 for(const op of operations){if(!['GET','HEAD'].includes(op.method)&&process.env.KAIROQ_API_WRITE_ENABLED!=='true')throw Object.assign(Error('Provider writes are disabled'),{status:409});const pathParams=Object.fromEntries((op.path.match(/\{([^{}]+)\}/g)||[]).map(k=>[k.slice(1,-1),'preflight']));adapter.prepare({plan:apiContract,operationId:op.id,pathParams,credentialName:operations.some(o=>o.authenticationRequired)?credentialName:undefined,approved:true,approvedWrites:confirmWrites});}
 const db=open(root,id),scope=fingerprint(envelope),key=fingerprint({scope,inputs,confirmWrites}),at=new Date().toISOString();
 const result={id:crypto.randomUUID(),workflowId,mode,status:'running',steps:[],externalCalls:0,createdAt:at,contractFingerprint:scope,verifiedProvider:false};
 const sanitize=value=>validation.sanitize(value,[process.env[credentialName]]);
 const save=()=>db.prepare('UPDATE workflow_runs SET status=?,payload=? WHERE id=? AND user_id=?').run(result.status,JSON.stringify(sanitize(result)),result.id,userId);
 try{
  const created=db.prepare('INSERT OR IGNORE INTO workflow_runs VALUES(?,?,?,?,?,?,?,?)').run(result.id,userId,workflowId,requestId,key,'running',JSON.stringify(result),at);
  if(!created.changes){const old=db.prepare('SELECT fingerprint,payload FROM workflow_runs WHERE user_id=? AND workflow_id=? AND request_key=?').get(userId,workflowId,requestId);if(old.fingerprint!==key)throw Object.assign(Error('This requestId was already used with different inputs or an app version'),{status:409});return{...JSON.parse(old.payload),replayed:true};}
  const outputs={};let dispatched=false;
  try{
   for(const step of workflow.steps){
    if(step.when&&JSON.stringify(resolve(step.when.source,inputs,outputs))!==JSON.stringify(step.when.equals)){result.steps.push({id:step.id,status:'skipped'});save();continue;}
    const op=apiContract.operations.find(o=>o.id===step.operationId),args=resolve(step.arguments,inputs,outputs);validation.operation(op,args);
    result.steps.push({id:step.id,operationId:op.id,status:'running'});save();dispatched=true;result.externalCalls++;let response;
    try{response=await execute({plan:apiContract,operationId:op.id,...args,credentialName:op.authenticationRequired?credentialName:undefined,approved:true,approvedWrites:confirmWrites});}catch{result.steps.at(-1).status='unknown';throw Error('Provider request failed; reconcile its outcome before starting a new run');}
    if(!response?.ok){result.steps.at(-1).status='failed';result.steps.at(-1).providerStatus=response?.status;throw Error('Provider rejected step '+step.id+' (HTTP '+response?.status+')');}
    if(op.responseSchemas?.[String(response.status)])validation.validate(op.responseSchemas[String(response.status)],response.data,'response.'+step.id);
    outputs[step.id]=response.data;for(const assertion of step.assertions||[])if(JSON.stringify(resolve(assertion.source,inputs,outputs))!==JSON.stringify(assertion.equals)){result.steps.at(-1).status='failed';throw Error('Provider business outcome did not satisfy step '+step.id);}
    result.steps.at(-1).status='complete';result.steps.at(-1).result=sanitize(response.data);save();
   }
   if(workflow.persist){if(!persist)throw Error('Workflow record storage is unavailable');const fields=resolve(workflow.persist.fields,inputs,outputs);result.record=await persist(workflow.persist.collection,fields);}
   result.status='complete';result.verifiedProvider=execute===adapter.execute&&result.externalCalls>0&&result.steps.every(s=>s.status==='complete');result.finishedAt=new Date().toISOString();save();
  }catch(error){if(result.steps.at(-1)?.status==='running')result.steps.at(-1).status='unknown';result.status=dispatched?'needs_review':'failed';result.error=error.message;result.finishedAt=new Date().toISOString();save();}
  return sanitize(result);
 }finally{db.close();}
}
module.exports={run,list,inspect,resolve,inputsFor,fingerprint,verified};

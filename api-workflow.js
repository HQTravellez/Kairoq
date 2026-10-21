"use strict";
// Deterministic multi-provider API orchestration. No AI decisions, network requests,
// scripts from documentation, credentials, or production imports are performed here.
// A caller must supply an executor; approved live callers use api-adapter.execute.
const api=require("./api-learning"), validation=require("./api-validation");
const MAX_STEPS=30,MAX_FANOUT=24,MAX_OPERATIONS=80,MAX_OUTPUT_BYTES=300000;
const HTTP_READS=new Set(["GET","HEAD"]);
const ID=/^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const FIELD=/^(?:[A-Za-z_][A-Za-z0-9_]*|[0-9]+)$/;
const FORBIDDEN=new Set(["__proto__","constructor","prototype"]);

function assertId(value,label){
 if(typeof value!=="string"||!ID.test(value)||FORBIDDEN.has(value))throw Error("Invalid "+label);
 return value;
}
function contractsFrom(sources){
 if(!sources||typeof sources!=="object"||Array.isArray(sources))throw Error("Named API contracts required");
 const contracts=Object.create(null);
 for(const [name,raw] of Object.entries(sources)){
  assertId(name,"API provider");if(!raw)throw Error("API contract missing for "+name);
  const plan=raw.operations?raw:api.learn(raw);
  if(plan.format==="unstructured"||!Array.isArray(plan.operations)||!plan.operations.length)
   throw Error("A formal API contract is required for "+name);
  if(new Set(plan.operations.map(op=>op.id)).size!==plan.operations.length)throw Error("Duplicate operation IDs for "+name);
  contracts[name]=plan;
 }
 return contracts;
}
function operation(contracts,provider,operationId){
 assertId(provider,"provider");assertId(operationId,"operation id");
 const plan=contracts[provider];
 if(!plan)throw Error("Unknown provider "+provider);
 const op=plan.operations.find(o=>o.id===operationId);
 if(!op||!["GET","HEAD","POST","PUT","PATCH","DELETE","OPTIONS"].includes(op.method))
  throw Error("Unknown API operation "+provider+":"+operationId);
 if(op.unsupportedBody||op.requiresScripts)throw Error("Provider operation needs a specialized reviewed adapter");
 return{plan,op};
}
function validateSpec(contractsInput,workflow){
 const contracts=contractsFrom(contractsInput);
 if(!workflow||!Array.isArray(workflow.steps)||workflow.steps.length<1||workflow.steps.length>MAX_STEPS)
  throw Error("Workflow must have 1-30 steps");
 const names=new Set();
 for(const step of workflow.steps){
  assertId(step.id,"workflow step");if(names.has(step.id))throw Error("Duplicate workflow step");
  if(!["call","fanout"].includes(step.type))throw Error("Unknown workflow step kind");
  if(step.type==="call")operation(contracts,step.provider,step.operationId);
  else{
   if(!step.items||!step.routeField||!step.keyField||!step.routes||typeof step.routes!=="object")
    throw Error("Fanout must declare source items, routing field, result key and fixed provider routes");
   assertId(step.routeField,"routing field");assertId(step.keyField,"result key");
   if(!Object.keys(step.routes).length||Object.keys(step.routes).length>12)throw Error("Invalid fanout route count");
   for(const [selector,route] of Object.entries(step.routes)){
    assertId(selector,"fanout selector");operation(contracts,route.provider,route.operationId);
   }
  }
  names.add(step.id);
 }
 return contracts;
}
function lookup(pointer,context){
 if(typeof pointer!=="string"||pointer.length>300)throw Error("Unsafe binding reference");
 const path=pointer.split(".");
 if(!["input","steps","item"].includes(path[0])||path.length<2)throw Error("Binding must reference input, steps or item");
 let current=context;
 for(const segment of path){
  if(!FIELD.test(segment)||FORBIDDEN.has(segment))throw Error("Unsafe binding path");
  if(current==null||!Object.prototype.hasOwnProperty.call(current,segment))
   throw Error("Unresolved binding "+pointer);
  current=current[segment];
 }
 return current;
}
function materialize(template,context,depth=0){
 if(depth>20)throw Error("Template nesting too deep");
 if(template===null||typeof template!=="object")return template;
 if(Array.isArray(template)){
  if(template.length>100)throw Error("Template array too large");
  return template.map(x=>materialize(x,context,depth+1));
 }
 const keys=Object.keys(template);
 if(keys.length===1&&keys[0]==="$ref")
  return structuredClone(lookup(template.$ref,context));
 if(keys.length>100)throw Error("Template object too large");
 const result=Object.create(null);
 for(const key of keys){
  if(FORBIDDEN.has(key)||key==="$ref")throw Error("Unsafe template field");
  result[key]=materialize(template[key],context,depth+1);
 }
 return result;
}
function opApprovalKey(provider,op){return provider+":"+op.method+":"+op.path}
async function run({contracts:raw,workflow,input,invoke,approvedOperations=[],maxFanout=MAX_FANOUT}={}){
 const contracts=validateSpec(raw,workflow);
 if(typeof invoke!=="function")throw Error("No approved API executor configured (no live API calls)");
 if(!Array.isArray(approvedOperations)||approvedOperations.some(x=>typeof x!=="string"))
  throw Error("An explicit operation approval list is required");
 if(!Number.isInteger(maxFanout)||maxFanout<1||maxFanout>MAX_FANOUT)throw Error("Invalid fanout limit");
 const approved=new Set(approvedOperations),steps=Object.create(null),trace=[];
 let calls=0;
 async function call(provider,operationId,args,stepId){
  const {plan,op}=operation(contracts,provider,operationId);
  const key=opApprovalKey(provider,op);
  if(!HTTP_READS.has(op.method)&&!approved.has(key))
   throw Error("Explicit approval required for "+key);
  if(!args||typeof args!=="object"||Array.isArray(args))throw Error("Invalid arguments for "+stepId);
  validation.operation(op,args);
  if(++calls>MAX_OPERATIONS)throw Error("Workflow call budget exceeded");
  // No raw requests or credentials are recorded in trace.
  let result;
  try{result=await invoke({provider,plan,operationId,args,approvedWrites:!HTTP_READS.has(op.method),stepId});}
  catch(e){trace.push({step:stepId,provider,operationId,status:"error"});throw Error("Provider "+provider+" operation "+operationId+" failed");}
  const code=Number(result?.status);
  if(!Number.isInteger(code)||code<100||code>599||result.ok!==true)
   throw Error("Provider "+provider+" operation "+operationId+" returned unsuccessful status "+(Number.isInteger(code)?code:"unknown"));
  if(Buffer.byteLength(JSON.stringify(result.data??null))>MAX_OUTPUT_BYTES)
   throw Error("API result exceeds 300 KB");
  const responseSchema=op.responseSchemas?.[String(code)];
  if(responseSchema&&Object.keys(responseSchema).length)
   validation.validate(responseSchema,result.data,"response");
  trace.push({step:stepId,provider,operationId,status:code});
  return structuredClone(result.data??null);
 }
 for(const step of workflow.steps){
  const context={input,steps,item:null};
  if(step.type==="call"){
   const args=materialize(step.args||{},context);
   steps[step.id]=await call(step.provider,step.operationId,args,step.id);
  }else{
   const items=materialize(step.items,context);
   if(!Array.isArray(items)||items.length>maxFanout)throw Error("Fanout items missing or exceed limit");
   const collected=Object.create(null);
   for(const item of items){
    if(!item||typeof item!=="object"||Array.isArray(item))throw Error("Invalid fanout item");
    const routeName=item[step.routeField],key=item[step.keyField];
    assertId(routeName,"fanout route");assertId(key,"fanout item key");
    if(Object.hasOwn(collected,key))throw Error("Duplicate fanout result key");
    const route=step.routes[routeName];
    if(!route)throw Error("Unapproved provider route "+routeName);
    const args=materialize(route.args||{}, {input,steps,item});
    collected[key]=await call(route.provider,route.operationId,args,step.id);
   }
   steps[step.id]=collected;
  }
 }
 return{status:"completed",steps,trace,operationCount:calls,output:steps[workflow.steps.at(-1).id]};
}
async function liveInvoker({provider,plan,operationId,args,approvedWrites}){
 // Separate explicit invocation: api-adapter still enforces host, DNS, credential,
 // live-enabled, and per-operation write gates. Never called by run() automatically.
 return require("./api-adapter").execute({
  plan,operationId,pathParams:args.pathParams||{},query:args.query||{},body:args.body,
  credentialName:"KAIROQ_API_TOKEN_"+provider.toUpperCase(),approved:true,approvedWrites
 });
}
module.exports={run,validateSpec,contractsFrom,materialize,lookup,opApprovalKey,liveInvoker,MAX_FANOUT};

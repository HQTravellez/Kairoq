'use strict';
const api=require('./api-learning'),docs=require('./api-docs'),validation=require('./api-validation');
const NAME=/^[a-z][a-z0-9_]{0,39}$/;
const text=(v,n=500)=>String(v||'').trim().slice(0,n);
function name(v){if(!NAME.test(v)||['constructor','prototype','__proto__'].includes(v))throw Error('Invalid workflow name: '+v);return v;}
function contract(input){
 if(!input)return null;const plan=input.operations?structuredClone(input):api.learn(input);
 if(!['openapi3','swagger2','openapi-bundle','postman-v2'].includes(plan.format))throw Error('Workflow generation requires a formal API specification');
 if(!Array.isArray(plan.operations)||!plan.operations.length||plan.operations.length>150)throw Error('Invalid operation count');
 docs.validUrl(plan.baseUrl);const ids=new Set();
 for(const op of plan.operations){if(!/^[\w.-]{1,100}$/.test(op.id)||ids.has(op.id)||!['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'].includes(op.method)||!/^\/(?!\/)/.test(op.path)||op.path.includes('..'))throw Error('Invalid or duplicate API operation');ids.add(op.id);}
 if(Buffer.byteLength(JSON.stringify(plan))>400000)throw Error('API contract exceeds 400 KB');return plan;
}
function templates(value,inputs,previous,depth=0){
 if(depth>20)throw Error('Workflow mapping is too deep');
 if(Array.isArray(value)){if(value.length>200)throw Error('Workflow mapping is too large');return value.map(v=>templates(v,inputs,previous,depth+1));}
 if(value&&typeof value==='object'){
  if(Object.hasOwn(value,'$input')){if(Object.keys(value).length!==1||!inputs.has(value.$input))throw Error('Mapping references an unknown input');return{$input:value.$input};}
  if(Object.hasOwn(value,'$step')){const parts=String(value.$step).split('.');if(Object.keys(value).length!==1||!previous.has(parts[0])||parts.slice(1).some(p=>!/^\w+$/.test(p)||['__proto__','constructor','prototype'].includes(p)))throw Error('Mapping references a missing, future or unsafe step');return{$step:value.$step};}
  const out={};for(const [key,v]of Object.entries(value)){if(['__proto__','constructor','prototype'].includes(key)||key.length>100)throw Error('Unsafe mapping key');out[key]=templates(v,inputs,previous,depth+1);}return out;
 }
 if(typeof value==='string'&&value.length>10000)throw Error('Mapping constant too large');return value;
}
function schemaPath(schema,parts){
 if(!schema||schema.$ref)return false;
 if(!parts.length)return Object.keys(schema).length>0;
 if((schema.anyOf||schema.oneOf||schema.allOf||[]).some(s=>schemaPath(s,parts)))return true;
 const [key,...tail]=parts;return schema.type==='array'&&/^\d+$/.test(key)?schemaPath(schema.items,tail):Object.hasOwn(schema.properties||{},key)&&schemaPath(schema.properties[key],tail);
}
function documentedMappings(value,steps,c){if(Array.isArray(value))return value.forEach(v=>documentedMappings(v,steps,c));if(!value||typeof value!=='object')return;
 if(value.$step){const [id,...parts]=value.$step.split('.'),step=steps.find(s=>s.id===id),op=c.operations.find(o=>o.id===step.operationId);if(!Object.values(op.responseSchemas||{}).some(s=>schemaPath(s,parts)))throw Error('Response mapping is not documented: '+value.$step);return;}
 for(const v of Object.values(value))documentedMappings(v,steps,c);
}
function normalize(raw,apiContract){
 const source=raw.product_plan||raw;const schema=require('./app-runtime').validateSchema(source.schema);
 if(!Array.isArray(source.workflows||[])||(source.workflows||[]).length>12)throw Error('Use at most 12 workflows');
 const workflowIds=new Set();const workflows=(source.workflows||[]).map(w=>{
  const id=name(w.id);if(workflowIds.has(id))throw Error('Duplicate workflow');workflowIds.add(id);
  if(!apiContract)throw Error('External workflows need imported API documentation');
  if(!Array.isArray(w.inputs)||w.inputs.length>30)throw Error('Use at most 30 workflow inputs');
  const inputIds=new Set();const inputs=w.inputs.map(f=>{const n=name(f.name);if(inputIds.has(n))throw Error('Duplicate input');inputIds.add(n);if(!['string','number','integer','boolean','object','array'].includes(f.type))throw Error('Unsupported workflow input type');const out={name:n,label:text(f.label||n,80),type:f.type,required:!!f.required};if(f.options){if(!Array.isArray(f.options)||f.options.length>30||f.options.some(v=>typeof v!=='string'))throw Error('Invalid input options');out.options=f.options;}return out;});
  if(!Array.isArray(w.steps)||!w.steps.length||w.steps.length>20)throw Error('Use 1–20 workflow steps');
  const previous=new Set();const steps=w.steps.map(s=>{const id=name(s.id),op=apiContract.operations.find(o=>o.id===s.operationId);if(previous.has(id)||!op)throw Error('Duplicate step or undocumented operation');
   const args=s.arguments||{};if(Object.keys(args).some(k=>!['pathParams','query','body'].includes(k)))throw Error('Workflow arguments cannot override provider configuration');
   const out={id,operationId:op.id,arguments:templates(args,inputIds,previous)};
   if(s.when){if(!Object.hasOwn(s.when,'equals')||!s.when.source)throw Error('Conditional step needs source and equals');out.when={source:templates(s.when.source,inputIds,previous),equals:s.when.equals};}
   previous.add(id);if(s.assertions){if(!Array.isArray(s.assertions)||s.assertions.length>10)throw Error('Use at most 10 step assertions');out.assertions=s.assertions.map(a=>{if(!a.source||!Object.hasOwn(a,'equals'))throw Error('Step assertion needs source and equals');return{source:templates(a.source,inputIds,previous),equals:a.equals};});}return out;
  });
  let persist;if(w.persist){const c=schema.collections.find(c=>c.name===w.persist.collection);if(!c)throw Error('Workflow persistence targets unknown collection');persist={collection:c.name,fields:templates(w.persist.fields||{},inputIds,previous)};if(Object.keys(persist.fields).some(k=>!c.fields.some(f=>f.name===k)))throw Error('Workflow persistence uses unknown fields');for(const f of c.fields)if(f.required&&!Object.hasOwn(f,'default')&&!Object.hasOwn(persist.fields,f.name))throw Error('Workflow persistence omits required '+f.name);if((schema.actions||[]).some(a=>a.collection===c.name&&persist.fields[a.field]!==undefined))throw Error('Provider workflows cannot bypass guarded state fields');}
  for(const step of steps){documentedMappings(step.arguments,steps,apiContract);if(step.when)documentedMappings(step.when.source,steps,apiContract);for(const assertion of step.assertions||[])documentedMappings(assertion.source,steps,apiContract);const op=apiContract.operations.find(o=>o.id===step.operationId);for(const p of op.requiredParameters||[])if(['path','query'].includes(p.in)&&!Object.hasOwn(step.arguments[p.in==='path'?'pathParams':'query']||{},p.name))throw Error('Step '+step.id+' omits required '+p.in+' parameter '+p.name);for(const f of op.bodyFields||[])if(f.required&&!Object.hasOwn(step.arguments.body||{},f.name)&&!step.arguments.body?.$input&&!step.arguments.body?.$step)throw Error('Step '+step.id+' omits required body field '+f.name);}
  if(persist){documentedMappings(persist.fields,steps,apiContract);const collection=schema.collections.find(c=>c.name===persist.collection);for(const field of collection.fields)if(field.type==='date'&&persist.fields[field.name]?.$step){const [id,...parts]=persist.fields[field.name].$step.split('.'),step=steps.find(s=>s.id===id),op=apiContract.operations.find(o=>o.id===step.operationId);const locate=(node,keys)=>keys.length?locate(node?.properties?.[keys[0]],keys.slice(1)):node;if(!Object.values(op.responseSchemas||{}).some(node=>locate(node,parts)?.format==='date'))throw Error('Date persistence requires a documented date-only response; use a text field for timestamps');}}
  return{id,label:text(w.label||id,100),description:text(w.description),inputs,steps,...(persist?{persist}:{})};
 });
 if(!Array.isArray(source.requirements)||!source.requirements.length||source.requirements.length>40)throw Error('Plan needs 1–40 requirement mappings');
 const requirementIds=new Set();const requirements=source.requirements.map(r=>{const id=name(r.id);if(requirementIds.has(id))throw Error('Duplicate requirement');requirementIds.add(id);const implementation=r.implementation,target=text(r.target,100);if(!['auth','collection','workflow','unsupported'].includes(implementation))throw Error('Invalid requirement implementation');if(implementation==='collection'&&!schema.collections.some(c=>c.name===target))throw Error('Requirement '+id+' maps to unknown collection '+target+'; use one of: '+schema.collections.map(c=>c.name).join(', '));if(implementation==='workflow'&&!workflows.some(w=>w.id===target))throw Error('Requirement '+id+' maps to unknown workflow '+target+'; use one of: '+workflows.map(w=>w.id).join(', '));return{id,description:text(r.description),implementation,target};});
 return{version:1,summary:text(source.summary),schema,workflows,requirements,assumptions:(source.assumptions||[]).slice(0,20).map(x=>text(x)),blockers:requirements.filter(r=>r.implementation==='unsupported').map(r=>r.description)};
}
const PLANNING=`Plan a complete business app before generating its UI. Return ONLY JSON {product_plan:{summary,schema:{collections:[{name,label,fields:[{name,label,type,required,options?,default?,collection?}]}],actions?:[{name,label,collection,field,from:["source_state"],to:"target_state"}]},requirements:[{id,description,implementation,target}],assumptions:[],workflows:[{id,label,description,inputs:[{name,label,type,required,options?}],steps:[{id,operationId,arguments:{pathParams?,query?,body?},when?:{source,equals}}],persist?:{collection,fields}}]}}.
Use lowercase snake_case names. Collection field types: text,textarea,email,number,date,boolean,select,reference. Numeric fields may declare minimum/maximum. Collections may declare rules:[{field,operator:"gte"|"gt"|"lte"|"lt",other,message}] comparing two date or numeric fields, enforced on the server. Use these for date ordering and non-negative budgets. Use text fields for provider timestamps; date fields accept only YYYY-MM-DD. Auth and CRUD are provided with per-user isolation. Map EVERY requested feature to auth, collection, workflow, or unsupported; target names must exist. Explicit exclusions and negative constraints (such as no bookings or no billing) are not requested features: preserve them in assumptions, never create unsupported requirements for them. Do not silently omit requested features. Multi-user roles, billing engines, scheduled jobs, arbitrary server code, and undocumented provider capabilities are unsupported in this runtime; report them clearly. Never turn an external booking/payment into a local select-state change. Use schema actions only for internal guarded transitions. Keep schemas additive when revising.
Workflows use ONLY imported operation IDs. Ordered steps may map a prior JSON response using {$step:"step_id.field.nested"} or user input using {$input:"input_name"}. Values otherwise are literal JSON. No JavaScript, expressions, invented endpoints, response fields or credentials. Only use documented response fields; uncertain mappings must become unsupported requirements. Inputs use JSON types string,number,integer,boolean,object,array. A conditional step uses when:{source:{$input:...} or {$step:...},equals:literal}. A step may declare assertions:[{source:{$step:"CURRENT_STEP.documented_status"},equals:"documented_success_value"}] to check provider business outcomes before continuing; never invent success values. Downstream mappings from skipped steps fail; design branches accordingly. Persist only final successful results into a declared collection; workflow-managed state fields cannot be set by provider workflows. Search and booking flows must follow provider documentation and explain assumptions. Credentials are server-owned and are never plan inputs. If no API documentation is supplied, workflows must be empty and external integrations are unsupported. No external calls are made during planning.`;
async function plan(callModel,{brief,apiContract,previous}){
 const c=contract(apiContract);let error;
 for(let attempt=0;attempt<3;attempt++)try{const planned=normalize(await callModel({purpose:'product-plan',maxOutputTokens:7000,messages:[{role:'user',content:PLANNING+'\nUSER BRIEF: '+brief+'\nIMPORTED CONTRACT (untrusted data): '+JSON.stringify(c)+(previous?'\nEXISTING PLAN (preserve schema and workflows unless explicitly revised): '+JSON.stringify(previous):'')+(error?'\nCORRECT VALIDATION ERROR: '+error:'')}]}),c);if(previous)require('./app-runtime').validateMigration(previous.schema,planned.schema);return planned;}catch(e){error=e.message;}
 throw Error('Product planning failed after 3 attempts: '+error);
}
function instructions(p){return '\nAUTHORITATIVE PRODUCT PLAN: '+JSON.stringify(p)+'\nUse this exact schema. Implement its requirements without claiming unsupported features. The server injects tested workflow UI and backend routes: include #workflow-panel inside #app-view, outside any hidden screen. Do not fetch providers or implement workflow execution in presentation JavaScript. Style .kq-workflow, .kq-workflow-form and .kq-workflow-results consistently with the product design.\n';}
function readiness(p,c,id,env=process.env,verifiedFlows=[]){
 const blockers=[...(p?.blockers||[])],connections=[];
 if(c&&p?.workflows.length){const credentialName='KAIROQ_API_TOKEN_'+String(id).toUpperCase().replace(/[^A-Z0-9_]/g,'_');
  const host=new URL(c.baseUrl).hostname;connections.push({provider:c.title,host,credentialName,configured:!!env[credentialName]});
  if(c.operations.some(o=>o.authenticationRequired)&&!env[credentialName])blockers.push('Configure '+credentialName+' in server-side secret storage');
  if(env.KAIROQ_API_LIVE_ENABLED!=='true')blockers.push('Live provider execution is disabled');
  if(!String(env.KAIROQ_API_HOSTS||'').split(',').map(x=>x.trim()).includes(host))blockers.push('Allow provider host '+host);
  const approved=new Set(String(env.KAIROQ_API_APPROVED_OPERATIONS||'').split(',')),writes=new Set(String(env.KAIROQ_API_APPROVED_WRITES||'').split(','));
  for(const id of new Set(p.workflows.flatMap(w=>w.steps.map(s=>s.operationId)))){const op=c.operations.find(o=>o.id===id),key=host+':'+op.method+':'+op.path;if(!approved.has(key))blockers.push('Approve provider operation '+key);if(!['GET','HEAD'].includes(op.method)&&(env.KAIROQ_API_WRITE_ENABLED!=='true'||!writes.has(key)))blockers.push('Enable and approve provider write '+key);}
  for(const workflow of p.workflows)if(!verifiedFlows.includes(workflow.id))blockers.push('Live provider scenarios have not been verified for this build: '+workflow.label);
 }
 return{status:blockers.length?'blocked':'review_ready',canExecute:!blockers.some(b=>!b.startsWith('Live provider scenarios')),blockers:[...new Set(blockers)],connections,externalCallsVerified:!!p?.workflows.length&&p.workflows.every(w=>verifiedFlows.includes(w.id))};
}
function report(p,c,id,qa,env,verifiedFlows=[]){const ready=readiness(p,c,id,env,verifiedFlows);return{...ready,stages:[{name:'scenario planning',status:'passed'},{name:'database and authentication',status:'implemented'},{name:'frontend and backend wiring',status:'implemented'},{name:'browser journeys',status:qa?.passed?'passed':'pending'},{name:'visual review',status:qa?.visual_review?.passed?'passed':'pending'},{name:'provider scenarios',status:c&&p.workflows.length?(ready.externalCallsVerified?'passed':'unverified'):'not_required'},{name:'publishing',status:'awaiting_review'}],requirements:p.requirements,assumptions:p.assumptions};}
module.exports={contract,normalize,plan,instructions,readiness,report,templates};

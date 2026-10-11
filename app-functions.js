'use strict';
// Declarative server programs. No eval, user-supplied JavaScript or filesystem/network access.
const crypto=require('node:crypto'),access=require('./app-access'),validation=require('./api-validation');
const NAME=/^[a-z][a-z0-9_]{0,39}$/,OPS=['add','subtract','multiply','divide','min','max','round','eq','ne','gt','gte','lt','lte','and','or','not','concat','coalesce','sum'];
function expression(value,inputs,steps,depth=0){
 if(depth>15)throw Error('Server expression is too deep');
 if(Array.isArray(value)){if(value.length>100)throw Error('Server expression array too large');return value.map(v=>expression(v,inputs,steps,depth+1));}
 if(value&&typeof value==='object'){
  if(Object.hasOwn(value,'$input')){if(Object.keys(value).length!==1||!inputs.has(value.$input))throw Error('Unknown function input');return{$input:value.$input};}
  if(Object.hasOwn(value,'$result')){const [id,...parts]=String(value.$result).split('.');if(Object.keys(value).length!==1||!steps.has(id)||parts.some(k=>!/^\w+$/.test(k)||['__proto__','prototype','constructor'].includes(k)))throw Error('Unknown or unsafe function result');return{$result:value.$result};}
  if(Object.hasOwn(value,'$op')){if(!OPS.includes(value.$op)||!Array.isArray(value.args)||value.args.length>20||Object.keys(value).some(k=>!['$op','args'].includes(k)))throw Error('Invalid server operator');return{$op:value.$op,args:expression(value.args,inputs,steps,depth+1)};}
  const out={};for(const [k,v]of Object.entries(value)){if(['__proto__','constructor','prototype'].includes(k)||k.startsWith('$'))throw Error('Unsafe server expression');out[k]=expression(v,inputs,steps,depth+1);}return out;
 }
 if(typeof value==='string'&&value.length>5000)throw Error('Server literal too large');return value;
}
function normalize(raw,schema){
 if(raw===undefined)return undefined;if(!Array.isArray(raw)||raw.length>20)throw Error('Use at most 20 server functions');const names=new Set();
 return raw.map(f=>{if(!NAME.test(f.name)||names.has(f.name))throw Error('Invalid or duplicate function name');names.add(f.name);if(!Array.isArray(f.inputs)||f.inputs.length>25)throw Error('Function inputs must be an array');const inputs=new Set();const fields=f.inputs.map(i=>{if(!NAME.test(i.name)||inputs.has(i.name)||!['string','number','integer','boolean'].includes(i.type))throw Error('Invalid function input');inputs.add(i.name);const out={name:i.name,label:String(i.label||i.name).slice(0,80),type:i.type,required:i.required!==false};if(i.collection){if(i.type!=='string'||!schema.collections.some(c=>c.name===i.collection))throw Error('Function record input needs a declared collection');out.collection=i.collection;}for(const k of ['minimum','maximum','minLength','maxLength','enum'])if(Object.hasOwn(i,k))out[k]=i[k];return out;});
  if(f.roles&&(!Array.isArray(f.roles)||f.roles.some(r=>!access.ROLES.includes(r))))throw Error('Invalid function roles');
  if(!Array.isArray(f.steps)||!f.steps.length||f.steps.length>30)throw Error('Function needs 1–30 steps');const previous=new Set();
  const steps=f.steps.map(s=>{if(!NAME.test(s.id)||previous.has(s.id)||!['read','list','create','update','delete','action','assert'].includes(s.type))throw Error('Invalid function step');const out={id:s.id,type:s.type};
   if(s.type==='assert'){out.condition=expression(s.condition,inputs,previous);out.message=String(s.message||'Business rule failed').slice(0,200);}else{
    const c=schema.collections.find(c=>c.name===s.collection);if(!c)throw Error('Function collection does not exist');out.collection=c.name;
    if(['read','update','delete','action'].includes(s.type)){if(!s.recordId)throw Error('Function step needs recordId');out.recordId=expression(s.recordId,inputs,previous);}
    if(['create','update'].includes(s.type)){if(!s.values||typeof s.values!=='object'||Array.isArray(s.values)||Object.keys(s.values).some(k=>!c.fields.some(f=>f.name===k)))throw Error('Function values use unknown fields');out.values=expression(s.values,inputs,previous);}
    if(s.type==='list'){out.where=expression(s.where||{},inputs,previous);if(Object.keys(out.where).some(k=>!c.fields.some(f=>f.name===k)))throw Error('Function filter uses unknown fields');}
    if(s.type==='action'){const a=(schema.actions||[]).find(a=>a.name===s.action&&a.collection===c.name);if(!a)throw Error('Function action does not exist');out.action=a.name;}
   }previous.add(s.id);return out;
  });return{name:f.name,label:String(f.label||f.name).slice(0,80),description:String(f.description||'').slice(0,300),inputs:fields,steps,result:expression(f.result??{$result:steps.at(-1).id},inputs,previous),...(f.roles?{roles:[...new Set(f.roles)]}:{})};
 });
}
function evaluate(value,inputs,outputs,depth=0){
 if(depth>20)throw Error('Server expression depth exceeded');if(Array.isArray(value))return value.map(v=>evaluate(v,inputs,outputs,depth+1));
 if(value&&typeof value==='object'){
  if(value.$input){if(!Object.hasOwn(inputs,value.$input))throw Error('Missing function input');return inputs[value.$input];}
  if(value.$result){let r=outputs;for(const k of value.$result.split('.')){if(!r||typeof r!=='object'||!Object.hasOwn(r,k))throw Error('Missing function result: '+value.$result);r=r[k];}return r;}
  if(value.$op){const a=evaluate(value.args,inputs,outputs,depth+1),n=()=>{if(a.some(v=>typeof v!=='number'||!Number.isFinite(v)))throw Error('Arithmetic needs finite numbers');return a;};let result;
   switch(value.$op){case'add':result=n().reduce((x,y)=>x+y,0);break;case'subtract':n();if(a.length!==2)throw Error('Subtract needs two arguments');result=a[0]-a[1];break;case'multiply':result=n().reduce((x,y)=>x*y,1);break;case'divide':n();if(a.length!==2||a[1]===0)throw Error('Invalid division');result=a[0]/a[1];break;case'min':result=Math.min(...n());break;case'max':result=Math.max(...n());break;case'round':n();if(a.length!==1)throw Error('Round needs one argument');result=Math.round(a[0]);break;
    case'eq':result=JSON.stringify(a[0])===JSON.stringify(a[1]);break;case'ne':result=JSON.stringify(a[0])!==JSON.stringify(a[1]);break;
    case'gt':case'gte':case'lt':case'lte':if(a.length!==2||typeof a[0]!==typeof a[1]||!['number','string'].includes(typeof a[0]))throw Error('Comparison needs matching values');result=value.$op==='gt'?a[0]>a[1]:value.$op==='gte'?a[0]>=a[1]:value.$op==='lt'?a[0]<a[1]:a[0]<=a[1];break;
    case'and':case'or':case'not':if(a.some(v=>typeof v!=='boolean'))throw Error('Boolean operator needs booleans');result=value.$op==='and'?a.every(Boolean):value.$op==='or'?a.some(Boolean):!a[0];break;
    case'concat':if(a.some(v=>!['string','number','boolean'].includes(typeof v)))throw Error('Concat needs scalar values');result=a.join('');break;case'coalesce':result=a.find(v=>v!==null&&v!==undefined)??null;break;
    case'sum':if(a.length!==2||!Array.isArray(a[0])||typeof a[1]!=='string'||a[1].split('.').some(k=>['__proto__','constructor','prototype'].includes(k)))throw Error('Sum needs rows and a field path');result=a[0].reduce((sum,row)=>{let v=row;for(const k of a[1].split('.'))v=v?.[k];if(typeof v!=='number'||!Number.isFinite(v))throw Error('Sum field must be numeric');return sum+v;},0);break;
   }if(typeof result==='number'&&(!Number.isFinite(result)||Math.abs(result)>1e12))throw Error('Arithmetic result is outside bounds');if(typeof result==='string'&&result.length>10000)throw Error('Expression result too long');return result;
  }return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,evaluate(v,inputs,outputs,depth+1)]));
 }return value;
}
function validateInputs(fn,inputs){ if(!inputs||typeof inputs!=='object'||Array.isArray(inputs)||Object.keys(inputs).some(k=>!fn.inputs.some(f=>f.name===k)))throw Error('Unknown function inputs');for(const f of fn.inputs){if(f.required&&!Object.hasOwn(inputs,f.name))throw Error('Missing input: '+f.name);if(Object.hasOwn(inputs,f.name))validation.validate(f,inputs[f.name],f.label);}
}
function init(db){db.exec('CREATE TABLE IF NOT EXISTS app_function_runs(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,scope TEXT NOT NULL,function_name TEXT NOT NULL,request_key TEXT NOT NULL,fingerprint TEXT NOT NULL,payload TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(user_id,scope,function_name,request_key));');}
function run(db,schema,ctx,name,inputs,requestId){
 const runtime=require('./app-runtime'),fn=(schema.functions||[]).find(f=>f.name===name);if(!fn)throw Object.assign(Error('Function not found'),{status:404});if(fn.roles&&(!ctx.team||!fn.roles.includes(ctx.role)))throw Object.assign(Error('Your role cannot run this function'),{status:403});
 validateInputs(fn,inputs);
 if(!/^[A-Za-z0-9_-]{16,100}$/.test(requestId||''))throw Error('A unique requestId of 16–100 characters is required');init(db);const scope=ctx.team||'',fingerprint=crypto.createHash('sha256').update(JSON.stringify({fn,inputs})).digest('hex');
 const old=db.prepare('SELECT fingerprint,payload FROM app_function_runs WHERE user_id=? AND scope=? AND function_name=? AND request_key=?').get(ctx.user.id,scope,name,requestId);if(old){if(old.fingerprint!==fingerprint)throw Object.assign(Error('requestId was used with different inputs or function definition'),{status:409});return{...JSON.parse(old.payload),replayed:true};}
 const outputs={},id=crypto.randomUUID(),at=new Date().toISOString();db.exec('BEGIN IMMEDIATE');try{
  for(const s of fn.steps){const resolve=v=>evaluate(v,inputs,outputs);if(s.type==='assert'){if(resolve(s.condition)!==true)throw Object.assign(Error(s.message),{status:422});outputs[s.id]={passed:true};continue;}
   const c=schema.collections.find(c=>c.name===s.collection),rid=s.recordId?resolve(s.recordId):null;
   if(s.type==='read'){const row=access.get(db,c,ctx,rid);outputs[s.id]={id:row.id,data:JSON.parse(row.payload)};}
   if(s.type==='list'){const where=resolve(s.where),rows=access.rows(db,c,ctx);if(rows.length>1000)throw Error('Function query exceeds 1000 records');outputs[s.id]=rows.map(r=>({id:r.id,data:JSON.parse(r.payload)})).filter(r=>Object.entries(where).every(([k,v])=>JSON.stringify(r.data[k])===JSON.stringify(v)));}
   if(s.type==='create')outputs[s.id]=access.save(db,schema,c,ctx,runtime.workflowValues(schema,c,runtime.recordValues(c,resolve(s.values))));
   if(s.type==='update'){const row=access.get(db,c,ctx,rid,'update'),before=JSON.parse(row.payload),after=runtime.workflowValues(schema,c,runtime.patchValues(c,before,resolve(s.values)),before);outputs[s.id]=access.save(db,schema,c,ctx,after,rid);}
   if(s.type==='delete')outputs[s.id]=access.remove(db,c,ctx,rid);
   if(s.type==='action'){const row=access.get(db,c,ctx,rid,'update'),a=schema.actions.find(a=>a.name===s.action),before=JSON.parse(row.payload);if(a.roles&&!a.roles.includes(ctx.role))throw Object.assign(Error('Your role cannot run this action'),{status:403});if(a.from.length&&!a.from.includes(before[a.field]))throw Object.assign(Error('Action not allowed from current state'),{status:409});outputs[s.id]=access.save(db,schema,c,ctx,runtime.patchValues(c,before,{[a.field]:a.to}),rid);}
  }
  const result={id,function:name,status:'complete',result:evaluate(fn.result,inputs,outputs),created_at:at};if(Buffer.byteLength(JSON.stringify(result))>300000)throw Error('Function response too large');db.prepare('INSERT INTO app_function_runs VALUES(?,?,?,?,?,?,?,?)').run(id,ctx.user.id,scope,name,requestId,fingerprint,JSON.stringify(result),at);access.audit(db,ctx.user,ctx.team,'function.'+name,id);db.exec('COMMIT');return result;
 }catch(e){db.exec('ROLLBACK');throw e;}
}
module.exports={normalize,expression,evaluate,validateInputs,init,run};

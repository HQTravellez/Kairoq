"use strict";
// Checks on an API's answers (in the style of Hoppscotch and Postman tests, without running anyone's
// script): "status is 200", "answers within 2 seconds", "price exists", "data[0].currency is EUR".
// Saved per endpoint; Send and Check all say which pass. Test scripts from imported Hoppscotch or
// Postman collections are turned into these rules where the pattern is a common one; nothing in a
// script is ever executed.

const OPS=['exists','missing','eq','neq','contains','gt','lt','type','length'];
const KINDS=['status','time','field','header'];
function fail(status,message){return Object.assign(Error(message),{status})}

// One rule, cleaned; null when it is not a valid rule.
function clean(r){
 if(!r||!KINDS.includes(r.kind))return null;
 if(r.kind==='status'){const v=String(r.value??'2xx').trim();return /^([1-5]\d\d|[1-5]xx)$/i.test(v)?{kind:'status',value:v.toLowerCase()}:null}
 if(r.kind==='time'){const v=Math.round(Number(r.value));return v>0&&v<=60000?{kind:'time',value:v}:null}
 const op=OPS.includes(r.op)?r.op:'exists';
 if(r.kind==='header'){const name=String(r.name||'').trim().toLowerCase();return /^[a-z0-9-]{1,64}$/.test(name)?{kind:'header',name,op:['exists','missing','eq','contains'].includes(op)?op:'exists',...(r.value!==undefined&&!['exists','missing'].includes(op)?{value:String(r.value).slice(0,200)}:{})}:null}
 const path=String(r.path||'').trim();
 if(!/^[A-Za-z0-9_$\-.[\]]{1,120}$/.test(path))return null;
 return{kind:'field',path,op,...(['exists','missing'].includes(op)?{}:{value:op==='type'?String(r.value||'string').toLowerCase():r.value})};
}
function cleanAll(rules){return(Array.isArray(rules)?rules:[]).map(clean).filter(Boolean).slice(0,20)}

// A value inside the answer: "data[0].price", "items.length".
function pick(obj,path){
 let cur=obj;
 for(const part of String(path).replace(/\[(\d+)\]/g,'.$1').split('.').filter(Boolean)){
  if(part==='length'&&(Array.isArray(cur)||typeof cur==='string'))return cur.length;
  if(cur===null||typeof cur!=='object'||!Object.hasOwn(cur,part))return undefined;
  cur=cur[part];
 }
 return cur;
}
const typeOf=v=>v===null?'null':Array.isArray(v)?'array':typeof v;
const same=(a,b)=>a===b||String(a)===String(b)||(typeof a==='number'&&Number(b)===a)||(typeof a==='boolean'&&String(b).toLowerCase()===String(a));
function show(v){if(v===undefined)return'nothing';const s=typeof v==='string'?v:JSON.stringify(v);return s.length>60?s.slice(0,57)+'…':s}

// The rule in plain words.
function label(r){
 if(r.kind==='status')return'Status is '+r.value.toUpperCase();
 if(r.kind==='time')return'Answers within '+(r.value>=1000?(r.value/1000)+' s':r.value+' ms');
 const what=r.kind==='header'?'Header '+r.name:r.path;
 return what+({exists:' exists',missing:' is not there',eq:' is '+show(r.value),neq:' is not '+show(r.value),contains:' contains '+show(r.value),gt:' is more than '+show(r.value),lt:' is less than '+show(r.value),type:' is a '+r.value,length:' has '+show(r.value)+' items'})[r.op];
}

// Each rule against one answer: {label, pass, actual}.
function evaluate(rules,reply){
 let body;try{body=JSON.parse(reply.body||'')}catch{body=undefined}
 const headers=Object.fromEntries(Object.entries(reply.headers||{}).map(([k,v])=>[k.toLowerCase(),String(v)]));
 return cleanAll(rules).map(r=>{
  let pass=false,actual;
  if(r.kind==='status'){actual=reply.status;pass=/xx$/.test(r.value)?String(reply.status)[0]===r.value[0]:String(reply.status)===r.value}
  else if(r.kind==='time'){actual=reply.ms+' ms';pass=reply.ms<=r.value}
  else{
   const v=r.kind==='header'?headers[r.name]:body===undefined?undefined:pick(body,r.path);actual=show(v);
   if(r.op==='exists')pass=v!==undefined&&v!==null;
   else if(r.op==='missing')pass=v===undefined||v===null;
   else if(r.op==='eq')pass=v!==undefined&&same(v,r.value);
   else if(r.op==='neq')pass=!same(v,r.value);
   else if(r.op==='contains')pass=Array.isArray(v)?v.some(x=>same(x,r.value)):String(v??'').toLowerCase().includes(String(r.value).toLowerCase());
   else if(r.op==='gt')pass=Number(v)>Number(r.value);
   else if(r.op==='lt')pass=Number(v)<Number(r.value);
   else if(r.op==='type'){actual=typeOf(v);pass=typeOf(v)===r.value}
   else if(r.op==='length'){const n=v&&v.length!==undefined?v.length:undefined;actual=n===undefined?'nothing':String(n);pass=n===Number(r.value)}
  }
  return{label:label(r),pass,actual:String(actual)};
 });
}

// Good first checks for an endpoint, from its spec: a success status, a time limit, and the
// main fields of the answer.
function suggest(op){
 const code=(op&&op.successCodes&&op.successCodes[0])||'200';
 const schema=op&&op.responseSchemas&&op.responseSchemas[code];
 const out=[{kind:'status',value:code},{kind:'time',value:3000}];
 const props=schema&&schema.properties?Object.keys(schema.properties):[];
 const required=schema&&Array.isArray(schema.required)?schema.required:[];
 for(const p of[...required,...props.filter(p=>!required.includes(p))].slice(0,3))out.push({kind:'field',path:p,op:'exists'});
 if(schema&&schema.type==='array')out.push({kind:'field',path:'length',op:'gt',value:0});
 return cleanAll(out);
}

// Common test lines from Hoppscotch (pw.*) and Postman (pm.*) scripts, as rules. Anything else is
// listed as skipped; no script is run.
function fromScript(script){
 const rules=[],skipped=[];
 const body=p=>p.replace(/^\.?/,'');
 for(const raw of String(script||'').split(/\n|;(?=\s*(?:pw|pm)\.)/)){
  const line=raw.trim().replace(/^(?:pw|pm)\.test\([^,]*,\s*(?:\(\)\s*=>|function\s*\(\))\s*\{\s*/,'');if(!line||/^\/\/|^\}\)?;?$/.test(line))continue;
  let m;
  if((m=/(?:pw\.expect\(pw\.response\.status\)\.toBe\((\d{3})\))|(?:pm\.response\.to\.have\.status\((\d{3})\))|(?:pm\.expect\(pm\.response\.code\)\.to\.(?:eql|equal)\((\d{3})\))/.exec(line))){rules.push({kind:'status',value:m[1]||m[2]||m[3]});continue}
  if((m=/pm\.expect\(pm\.response\.responseTime\)\.to\.be\.below\((\d+)\)/.exec(line))){rules.push({kind:'time',value:Number(m[1])});continue}
  if((m=/(?:pw\.expect\(pw\.response\.body((?:\.[A-Za-z_$][\w$]*|\[\d+\])*)\)|pm\.expect\(pm\.response\.json\(\)((?:\.[A-Za-z_$][\w$]*|\[\d+\])*)\))\.(not\.)?(?:to\.)?(toBeType|toHaveLength|toInclude|toBe|eql|equal|include|have\.lengthOf|be\.an|be\.a|exist)\(?\s*([^)]*)\)?/.exec(line))){
   const path=body(m[1]||m[2]||''),not=Boolean(m[3]),fn=m[4];let v=(m[5]||'').trim().replace(/^["'`]|["'`]$/g,'');
   if(!path){skipped.push(line.slice(0,80));continue}
   const num=/^-?\d+(\.\d+)?$/.test(v)?Number(v):v==='true'?true:v==='false'?false:v;
   const op=fn==='toBeType'||fn==='be.a'||fn==='be.an'?'type':fn==='toHaveLength'||fn==='have.lengthOf'?'length':fn==='toInclude'||fn==='include'?'contains':fn==='exist'?(not?'missing':'exists'):not?'neq':'eq';
   rules.push({kind:'field',path,op,...(['exists','missing'].includes(op)?{}:{value:num})});continue;
  }
  if(/^(pw|pm)\./.test(line))skipped.push(line.slice(0,80));
 }
 return{rules:cleanAll(rules),skipped:skipped.slice(0,10)};
}

module.exports={clean,cleanAll,evaluate,label,suggest,fromScript,pick,OPS,KINDS};

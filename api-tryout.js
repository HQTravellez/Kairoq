"use strict";
// Try an outside API from Settings, like Beeceptor: every endpoint listed with its inputs filled
// from the spec's examples, Send shows the answer (real when the key is added or none is needed,
// otherwise a sample shaped like the real one), and "Check all" calls every read-only endpoint once
// and says in plain words which ones work. Real calls go through Kairoq's guarded fetch (no private
// addresses); the key is added on the server and never sent to the page.
const samples=require('./api-samples');

const MAX_BODY=200000,MAX_CHECK=25;
function fail(status,message){return Object.assign(Error(message),{status})}
function day(offset){const d=new Date();d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10)}
const READ=new Set(['GET','HEAD']);

// A value to start with for one input: the spec's example (dates moved to the coming weeks), its
// default or first allowed value, else a sensible guess from the name. Empty when there is none.
function startValue(p){
 const s=p.schema||{},n=String(p.name||'').toLowerCase();
 let v=p.example??s.example??p.default??s.default??(Array.isArray(s.enum)&&s.enum.length?s.enum[0]:undefined);
 if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}/.test(v)){const later=/return|check_?out|end|until|to_?date/.test(n)?21:14;v=day(later)+v.slice(10)}
 if(v!==undefined&&v!==null)return Array.isArray(v)?v.join(','):String(v);
 if(!p.required)return'';
 if(s.format==='date'||/date|check_?in|check_?out/.test(n))return day(/return|out|end|until/.test(n)?21:14);
 if(/adults?|guests?|passengers?|travell?ers?/.test(n))return'1';
 if(/limit|max|count|size|per_?page/.test(n))return'5';
 if(/page|offset/.test(n))return/offset/.test(n)?'0':'1';
 if(/currency|^base$/.test(n))return'CAD';
 if(/(^|_)(lat|latitude)$/.test(n))return'43.65';
 if(/(^|_)(lng|lon|longitude)$/.test(n))return'-79.38';
 if(/city|town|^q$|query|name|search|location/.test(n))return'Toronto';
 if(/country/.test(n))return'CA';
 if(s.type==='integer'||s.type==='number')return String(Number.isFinite(s.minimum)?s.minimum:1);
 if(s.type==='boolean')return'true';
 return'';
}
// The endpoints of one added API, for the panel.
function endpoints(api){
 return(api.operations||[]).map(o=>{
  const params=(o.parameters||(o.requiredParameters||[]).map(r=>({...r,required:true}))).filter(p=>p.in!=='header'||!/^(authorization|x-api-key|api-?key)$/i.test(p.name)).map(p=>({name:p.name,in:p.in,required:Boolean(p.required),description:p.description||'',options:Array.isArray(p.schema&&p.schema.enum)?p.schema.enum.slice(0,30).map(String):undefined,value:startValue(p)}));
  let body=null;
  if(!READ.has(o.method)&&o.requestSchema&&Object.keys(o.requestSchema).length){try{body=JSON.stringify(samples.sampleOf(o.requestSchema,'',seq(o.id)),null,2)}catch{body='{}'}}
  else if(!READ.has(o.method)&&(o.bodyFields||[]).length)body=JSON.stringify(Object.fromEntries(o.bodyFields.map(f=>[f.name,''])),null,2);
  return{id:o.id,method:o.method,path:o.path,summary:o.summary||'',params,body,read_only:READ.has(o.method),rules:(api.rules&&api.rules[o.id])||[],suggested:require('./api-rules').suggest(o)};
 });
}
function seq(seed){let x=0;for(const c of String(seed))x=(x*31+c.charCodeAt(0))>>>0;return()=>{x=(x*1103515245+12345)>>>0;return x/4294967296}}

// The request for an endpoint and the owner's values.
function buildRequest(api,op,values={},body){
 let path=op.path,missing=[];const query=new URLSearchParams(),headers={Accept:'application/json'};
 const params=op.parameters||(op.requiredParameters||[]).map(r=>({...r,required:true}));
 for(const p of params){
  const v=values[p.name]===undefined?'':String(values[p.name]).trim();
  if(!v){if(p.required)missing.push(p.name);continue}
  if(p.in==='path')path=path.split('{'+p.name+'}').join(encodeURIComponent(v));
  else if(p.in==='query'){if(p.explode&&v.includes(',')&&p.schema&&p.schema.type==='array')for(const x of v.split(','))query.append(p.name,x.trim());else query.set(p.name,v)}
  else if(p.in==='header')headers[p.name]=v;
 }
 const url=String(api.baseUrl||'').replace(/\/+$/,'')+path+(String(query)?'?'+query:'');
 const out={url,method:op.method,headers,missing};
 if(!READ.has(op.method)&&body!==undefined&&body!==null&&String(body).trim()){
  try{JSON.parse(String(body))}catch{throw fail(400,'The request body is not valid JSON. Fix it and send again.')}
  out.body=String(body);out.headers['Content-Type']='application/json';
 }
 return out;
}

// The key, added the way the API says (header, query or bearer token; OAuth client credentials
// as "client id:client secret"). Tokens are kept in memory until they expire.
const tokens=new Map();
async function withKey(id,api,req,fetchUrl){
 if(!api.secret)return req;
 const key=require('./project-secrets').get(id,samples.secretKey(api.secret));
 if(!key)return req;
 const auth=(api.auth||[])[0]||{};
 if(auth.type==='apiKey'&&auth.headerName){
  if(auth.in==='query'){const u=new URL(req.url);u.searchParams.set(auth.headerName,key);req.url=String(u)}
  else req.headers[auth.headerName]=key;
  return req;
 }
 if(auth.type==='http'&&/basic/i.test(auth.scheme||'')){req.headers.Authorization='Basic '+Buffer.from(key).toString('base64');return req}
 if(auth.type==='oauth2'&&auth.tokenUrl){
  const cached=tokens.get(id+' '+api.slug);
  if(cached&&cached.until>Date.now()+30000){req.headers.Authorization='Bearer '+cached.token;return req}
  const i=key.indexOf(':');if(i<1)throw fail(400,api.title+' signs in with a client ID and secret. Save its key as clientid:clientsecret.');
  const r=await fetchUrl({url:auth.tokenUrl,method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},body:new URLSearchParams({grant_type:'client_credentials',client_id:key.slice(0,i),client_secret:key.slice(i+1)}).toString()});
  let t=null;try{t=JSON.parse(r.body)}catch{}
  if(r.status<200||r.status>=300||!t||!t.access_token)throw fail(401,api.title+' did not accept the client ID and secret ('+r.status+'). Check the key.');
  tokens.set(id+' '+api.slug,{token:t.access_token,until:Date.now()+1000*(Number(t.expires_in)||600)});
  req.headers.Authorization='Bearer '+t.access_token;return req;
 }
 req.headers.Authorization='Bearer '+key;
 return req;
}

// A plain reason for an answer that is not a success.
function reason(status,body){
 if(status===401||status===403)return'The API refused the call: it needs a key, or the key is wrong or not allowed to do this.';
 if(status===404)return'Not found: check the inputs (for example an ID or a code).';
 if(status===400||status===422){let m='';try{const j=JSON.parse(body);m=j.message||j.error_description||(j.errors&&j.errors[0]&&(j.errors[0].detail||j.errors[0].title))||(typeof j.error==='string'?j.error:j.reason)||''}catch{}return'The API did not accept the inputs'+(m?': '+String(m).slice(0,160):'.')}
 if(status===429)return'Too many calls: the API asked to slow down. Try again in a minute.';
 if(status>=500)return'The API had a problem on its side ('+status+'). Try again later.';
 if(status>=300&&status<400)return'The API sent the call somewhere else ('+status+').';
 return'Unexpected answer ('+status+').';
}

function findOp(api,opId){const op=(api.operations||[]).find(o=>o.id===opId);if(!op)throw fail(404,'That endpoint is not part of '+api.title+' any more. Reload the list.');return op}
function findApi(id,slug){const api=samples.apis(id).find(a=>a.slug===slug);if(!api)throw fail(404,'That API is not added to this app.');
 // Switched to its test address: Try and Check all call that, with the test key.
 return api.test&&api.test.use&&api.test.baseUrl?{...api,baseUrl:api.test.baseUrl,secret:api.test.secret||null,live:{baseUrl:api.baseUrl,secret:api.secret},testing:true}:api}
function needsKey(id,api){return Boolean(api.secret)&&!samples.hasKey(id,api.secret)}

// Send one request. Sample when asked, or when the key is missing; a real call that can change data
// (not GET) needs confirm, so a booking or payment is never made by accident.
async function send(id,{slug,op:opId,values={},body,sample=false,confirm=false},{fetchUrl=require('./react-functions').guardedFetch}={}){
 const api=findApi(id,slug),op=findOp(api,opId);
 const req=buildRequest(api,op,values,body);
 if(!api.baseUrl)throw fail(400,api.title+' has no address. Remove it and add it again with its address under More options.');
 if(req.missing.length)throw fail(400,'Fill in '+req.missing.join(', ')+' first.');
 const useSample=Boolean(sample)||needsKey(id,api);
 if(!useSample&&!READ.has(op.method)&&!confirm)throw Object.assign(fail(409,'This sends a real '+op.method+' to '+api.title+', which can create or change data there. Send it anyway?'),{data:{confirm:true}});
 const started=Date.now(),entry={at:new Date().toISOString(),method:op.method,url:samples.safeUrl(req.url),api:api.title,sample:useSample,mode:'try'};
 let out;
 try{
  if(useSample)out=samples.sampleAnswer(api,op,{method:op.method,url:req.url});
  else out=await fetchUrl(await withKey(id,api,{...req,headers:{...req.headers}},fetchUrl));
 }catch(e){
  const msg=e.status===401||e.status===400?e.message:/timed out/.test(String(e.message))?'The API did not answer within 15 seconds.':/private network/.test(String(e.message))?'Kairoq does not call private or internal addresses.':'Kairoq could not reach '+api.title+' ('+String(e.message||e).replace(/^fetch: /,'').slice(0,120)+').';
  samples.logCall(id,{...entry,status:0,error:msg.slice(0,160),ms:Date.now()-started});
  throw fail(e.status&&e.status<500?e.status:502,msg);
 }
 const ms=Date.now()-started,text=String(out.body||'');
 const type=String((out.headers&&(out.headers['content-type']||out.headers['Content-Type']))||'');
 let json=false,shown=text;try{if(text.trim()){shown=JSON.stringify(JSON.parse(text),null,2);json=true}}catch{}
 samples.logCall(id,{...entry,status:out.status,ms,reply:text.slice(0,3000)});
 // The endpoint's answer checks (api-rules.js); without any, a success status is the check.
 const R=require('./api-rules'),rules=(api.rules&&api.rules[op.id])||[];
 const checks=R.evaluate(rules.length?rules:[{kind:'status',value:'2xx'}],{status:out.status,ms,body:text,headers:out.headers});
 // GraphQL answers errors with status 200: they count as a failed check.
 if(json){try{const j=JSON.parse(text);if(Array.isArray(j.errors)&&j.errors.length)checks.push({label:'No GraphQL errors',pass:false,actual:String(j.errors[0]&&j.errors[0].message||'error').slice(0,120)})}catch{}}
 const ok=checks.every(c=>c.pass);
 const failed=checks.filter(c=>!c.pass);
 return{status:out.status,ok,ms,checks,testing:Boolean(api.testing),sample:useSample,why:useSample?(needsKey(id,api)?'Sample answer: add the '+api.secret+' key for real answers.':'Sample answer, as you asked.'):'Real answer from '+api.title+(api.testing?' (test address)':'')+'.',
  reason:ok?'':out.status>=200&&out.status<300?'Failed checks: '+failed.map(c=>c.label+' (got '+c.actual+')').join('; ')+'.':reason(out.status,text),url:samples.safeUrl(req.url),method:op.method,content_type:type.split(';')[0],json,body:shown.length>MAX_BODY?shown.slice(0,MAX_BODY)+'\n… (cut: the answer is longer)':shown,size:text.length};
}

// Call every read-only endpoint once with its starting values; say plainly which work.
async function check(id,{slug},{fetchUrl=require('./react-functions').guardedFetch}={}){
 const api=findApi(id,slug),list=endpoints(api).filter(e=>e.read_only).slice(0,MAX_CHECK),results=[];
 const sampleOnly=needsKey(id,api);
 const one=async e=>{
  const missing=e.params.filter(p=>p.required&&!p.value).map(p=>p.name);
  if(missing.length)return{id:e.id,method:e.method,path:e.path,result:'input',reason:'Needs a value for '+missing.join(', ')+' to check. Open it and fill it in.'};
  try{
   const r=await send(id,{slug,op:e.id,values:Object.fromEntries(e.params.map(p=>[p.name,p.value])),sample:sampleOnly},{fetchUrl});
   return{id:e.id,method:e.method,path:e.path,result:r.sample?'sample':r.ok?'ok':'fail',status:r.status,ms:r.ms,reason:r.sample?'Answers with sample data until the '+api.secret+' key is added.':r.ok?'Works: answered in '+r.ms+' ms'+(r.checks.length>1?', all '+r.checks.length+' checks pass':'')+'.':r.reason};
  }catch(err){return{id:e.id,method:e.method,path:e.path,result:'fail',reason:String(err.message||err).slice(0,200)}}
 };
 for(let i=0;i<list.length;i+=3)results.push(...await Promise.all(list.slice(i,i+3).map(one)));
 const count=k=>results.filter(r=>r.result===k).length;
 const all=endpoints(api),writes=all.filter(e=>!e.read_only).length,beyond=all.filter(e=>e.read_only).length-list.length;
 const summary=sampleOnly?'Checked '+results.length+' endpoints with sample data. Add the '+api.secret+' key to check them for real.':count('ok')+' of '+results.length+' read-only endpoints work'+(count('fail')?', '+count('fail')+' failed':'')+(count('input')?', '+count('input')+' need an input':'')+'.';
 return{api:api.title,summary:summary+(writes?' '+writes+' endpoint'+(writes>1?'s change':' changes')+' data, so '+(writes>1?'they are':'it is')+' not called here: try '+(writes>1?'them':'it')+' one by one.':'')+(beyond>0?' Only the first '+MAX_CHECK+' read-only endpoints are checked.':''),results};
}

// A pasted cURL command: matched to an added API's endpoint (its inputs filled in), or, when asked,
// added as a new API with that one endpoint. Keys in the command are never kept.
function fromCurl(id,{curl,add=false}){
 const imp=require('./api-import'),req=imp.parseCurl(curl);
 const match=()=>{
  for(const a of samples.apis(id)){
   for(const base of [a.baseUrl,a.test&&a.test.baseUrl].filter(Boolean)){
    const u=new URL(req.url),target=u.origin+u.pathname;
    if(!(target===base||target.startsWith(base+'/')))continue;
    const rest=target.slice(base.length)||'/',op=samples.findOperation(a,rest,req.method);if(!op)continue;
    const values={};for(const [k,v] of u.searchParams)values[k]=v;
    const want=rest.split('/').filter(Boolean),tpl=op.path.split('/').filter(Boolean);
    tpl.forEach((seg,i)=>{const m=/^\{([^}]+)\}$/.exec(seg);if(m)values[m[1]]=decodeURIComponent(want[i]||'')});
    return{slug:a.slug,op:op.id,values,body:req.body?(()=>{try{return JSON.stringify(JSON.parse(req.body),null,2)}catch{return req.body}})():null};
   }
  }
  return null;
 };
 let found=match(),added=null;
 if(!found&&add){
  const spec=imp.specFromRequest(req);
  added=samples.add(id,{spec,secret:req.secrets.length?samples.keyName(spec.info.title):''});
  found=match();
 }
 return{match:found,added,method:req.method,url:samples.safeUrl(req.url),secrets:req.secrets,
  note:req.secrets.length?'The command had a key in it ('+req.secrets.join(', ')+'). Kairoq did not keep it: add it with Add key, where it is stored encrypted.':''};
}

module.exports={fromCurl,endpoints,startValue,buildRequest,send,check,reason};

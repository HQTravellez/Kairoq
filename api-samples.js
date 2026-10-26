"use strict";
// Outside APIs for Create apps, with sample answers until the key is added.
// The owner adds an outside API (its OpenAPI or Swagger spec, and the name of the secret that holds
// its key). Then:
//  - the builder is told the API's real paths and fields (api-learning.js reads the spec);
//  - server functions' fetch calls to it get realistic sample answers, made from the spec's
//    response schemas, in the editor's preview while the key is missing, and always in saved
//    checks (so a test never books or charges for real);
//  - the published site never gets sample answers;
//  - every outside call from the app's functions is logged (time, address, sample or real, status).
// Specs are data: nothing in them runs, and their text reaches the AI only as reference.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const builder=require('./react-builder');

const MAX_APIS=8,MAX_LOG=100;
function fail(status,message){return Object.assign(Error(message),{status})}
function file(id,name){return path.join(builder.projectDir(id),name)}
function readJson(f,def){try{return JSON.parse(fs.readFileSync(f,'utf8'))}catch{return def}}
function writeJson(f,v){const tmp=f+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,JSON.stringify(v));fs.renameSync(tmp,f)}
function apis(id){return readJson(file(id,'apis.json'),[])}
const SECRET=/^[A-Z][A-Z0-9_]{0,49}$/;
function secretKey(name){return'app_'+String(name).toLowerCase().replace(/[^a-z0-9_]/g,'_').slice(0,50)}
function hasKey(id,name){try{return Boolean(require('./project-secrets').get(id,secretKey(name)))}catch{return false}}
function slugOf(title,taken){const base=String(title||'api').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,30)||'api';let s=base,n=2;while(taken.includes(s))s=base+'-'+n++;return s}
function cleanBase(u){
 let url;try{url=new URL(String(u||'').trim())}catch{throw fail(400,'Give the API\'s base address, for example https://api.example.com/v1')}
 if(url.protocol!=='https:')throw fail(400,'The API\'s address must start with https://');
 if(url.username||url.password)throw fail(400,'Do not put keys or passwords in the address; add the key as a secret');
 return url.origin+url.pathname.replace(/\/+$/,'');
}

// ---------- adding and listing ----------
// spec: the OpenAPI / Swagger JSON (text or object). baseUrl: needed when the spec has none.
function add(id,{spec,secret,baseUrl}){
 const all=apis(id);
 if(all.length>=MAX_APIS)throw fail(409,'An app can use at most '+MAX_APIS+' outside APIs. Remove one first.');
 const key=String(secret||'').trim().toUpperCase();
 if(key&&!SECRET.test(key))throw fail(400,'Name the key like HOTELBEDS_KEY: capital letters, digits and _');
 let plan;try{plan=require('./api-learning').learn(spec)}catch(e){throw fail(400,'Could not read that spec: '+e.message)}
 const base=cleanBase(baseUrl||plan.baseUrl);
 const api={slug:slugOf(plan.title,all.map(a=>a.slug)),title:plan.title,version:plan.version,baseUrl:base,secret:key||null,auth:plan.auth,
  operations:plan.operations.slice(0,300).map(o=>({id:o.id,method:o.method,path:o.path,summary:o.summary,requiredParameters:o.requiredParameters,bodyFields:o.bodyFields,successCodes:o.successCodes,responseSchemas:o.responseSchemas})),
  added_at:new Date().toISOString()};
 if(all.some(a=>a.baseUrl===api.baseUrl))throw fail(409,'This app already has an API at '+api.baseUrl+'. Remove it first to replace it.');
 writeJson(file(id,'apis.json'),[...all,api]);
 return view(id,api);
}
function remove(id,slug){
 const all=apis(id);
 if(!all.some(a=>a.slug===String(slug)))throw fail(404,'Unknown API');
 writeJson(file(id,'apis.json'),all.filter(a=>a.slug!==String(slug)));
 return list(id);
}
function view(id,a){return{slug:a.slug,title:a.title,version:a.version||'',base_url:a.baseUrl,secret:a.secret,key_added:a.secret?hasKey(id,a.secret):false,operations:a.operations.length,added_at:a.added_at}}
function list(id){return apis(id).map(a=>view(id,a))}

// The note for the builder: each API's contract and how its key and sample answers work.
function promptNote(id){
 const all=apis(id);if(!all.length)return'';
 const learning=require('./api-learning');
 return'\n\nOutside APIs this app uses (added by the owner). Call them only from server functions with fetch, at exactly these addresses and paths; read the key with secrets.get(NAME) and send it the way the API\'s auth describes. While the key is missing, Kairoq answers these calls in the preview with sample data shaped like the real answers, so build the real integration (never hard-code results or fake them in the page); show a clear message when a call fails.'+
  all.map(a=>'\n- '+a.title+' at '+a.baseUrl+(a.secret?' (key: secrets.get(\''+a.secret+'\'))':' (no key)')+learning.instructions({title:a.title,baseUrl:a.baseUrl,auth:a.auth,operations:a.operations.map(o=>({...o,authenticationRequired:Boolean(a.secret)}))}).replace(/\nDesign real integration states[\s\S]*$/,'').slice(0,9000)).join('');
}

// ---------- matching a call to an operation ----------
function findApi(id,url){
 let u;try{u=new URL(String(url))}catch{return null}
 const target=u.origin+u.pathname;
 for(const a of apis(id))if(target===a.baseUrl||target.startsWith(a.baseUrl+'/'))return{api:a,rest:target.slice(a.baseUrl.length)||'/'};
 return null;
}
function findOperation(api,rest,method){
 const parts=p=>String(p).replace(/\/+$/,'').split('/').filter(Boolean);
 const want=parts(rest),m=String(method||'GET').toUpperCase();
 const fits=o=>{const t=parts(o.path);return t.length===want.length&&t.every((seg,i)=>/^\{[^}]+\}$/.test(seg)?want[i].length>0:seg===want[i])};
 return api.operations.find(o=>o.method===m&&fits(o))||null;
}

// ---------- sample data from a schema ----------
// Values follow the field's name and type, and are the same for the same call, so pages do not flicker.
const WORDS={name:['Harbour View Suites','Maple Grove Inn','The Lakeshore','Bay Street Residences','Cedar Lodge'],first:['Olivia','Liam','Emma','Noah','Ava'],last:['Chen','Patel','Martin','Singh','Roy'],city:['Toronto','Montréal','Vancouver','Calgary','Ottawa'],country:['Canada','United States','United Kingdom','France','Japan'],street:['12 King St W','480 Queen St E','77 Bloor St W','2100 Yonge St','35 Front St']};
function rng(seed){let h=crypto.createHash('sha256').update(seed).digest();let i=0;return()=>{if(i>=h.length-4){h=crypto.createHash('sha256').update(h).digest();i=0}const v=h.readUInt32BE(i)/4294967296;i+=4;return v}}
function merge(s){
 if(!s||typeof s!=='object')return{};
 if(Array.isArray(s.allOf)){const out={type:'object',properties:{},required:[]};for(const p of s.allOf.map(merge)){Object.assign(out.properties,p.properties||{});if(p.type&&p.type!=='object')out.type=p.type;if(p.items)out.items=p.items}return out}
 for(const k of ['oneOf','anyOf'])if(Array.isArray(s[k])&&s[k].length)return merge({...s[k][0],...Object.fromEntries(Object.entries(s).filter(([x])=>x!==k))});
 return s;
}
function dateIn(days,r){const d=new Date(Date.UTC(2026,10,1));d.setUTCDate(d.getUTCDate()+days+Math.floor(r()*30));return d}
function pick(list,r){return list[Math.floor(r()*list.length)]}
function scalar(s,name,r,i){
 const n=String(name||'').toLowerCase(),t=s.type||(s.enum?typeof s.enum[0]:'string');
 if(s.enum&&s.enum.length)return pick(s.enum,r);
 if(s.const!==undefined)return s.const;
 if(t==='boolean')return r()<0.7;
 if(t==='integer'||t==='number'){
  const lo=Number.isFinite(s.minimum)?s.minimum:null,hi=Number.isFinite(s.maximum)?s.maximum:null;
  let v=/price|amount|total|rate|cost|fare|fee/.test(n)?Math.round((80+r()*420)*100)/100:/(^|_)(lat|latitude)$/.test(n)?43.6+r()*0.1:/(^|_)(lng|lon|longitude)$/.test(n)?-79.4+r()*0.1:/rating|stars|score/.test(n)?Math.round((3+r()*2)*10)/10:/count|qty|quantity|guests|adults|rooms|nights/.test(n)?1+Math.floor(r()*4):/(^|_)id$|^id/.test(n)?1000+i*7+Math.floor(r()*900):Math.floor(r()*100);
  if(lo!==null&&v<lo)v=lo;if(hi!==null&&v>hi)v=hi;
  return t==='integer'?Math.round(v):v;
 }
 const f=String(s.format||'');
 if(f==='date-time'||/(_at|time|timestamp)$/.test(n))return dateIn(i,r).toISOString();
 if(f==='date'||/date|check_?in|check_?out|arrival|departure|from|until/.test(n))return dateIn(i+(/out|departure|until/.test(n)?3:0),r).toISOString().slice(0,10);
 if(f==='email'||/email/.test(n))return pick(WORDS.first,r).toLowerCase()+'@example.com';
 if(f==='uuid'||/uuid|guid/.test(n))return[8,4,4,4,12].map(k=>Array.from({length:k},()=>Math.floor(r()*16).toString(16)).join('')).join('-');
 if(f==='uri'||f==='url'||/url|link|href|image|photo|picture|thumbnail/.test(n))return'https://example.com/sample/'+(n.replace(/[^a-z0-9]+/g,'-')||'item')+'-'+(i+1)+(/image|photo|picture|thumbnail/.test(n)?'.jpg':'');
 if(/currency/.test(n))return'CAD';
 if(/phone|mobile|tel/.test(n))return'+1 416 555 0'+String(100+Math.floor(r()*899));
 if(/first_?name|given/.test(n))return pick(WORDS.first,r);
 if(/last_?name|family|surname/.test(n))return pick(WORDS.last,r);
 if(/city|town/.test(n))return pick(WORDS.city,r);
 if(/country/.test(n))return/code/.test(n)?'CA':pick(WORDS.country,r);
 if(/address|street/.test(n))return pick(WORDS.street,r);
 if(/status|state/.test(n))return pick(['confirmed','available','pending'],r);
 if(/(^|_)(id|code|ref|reference)$|^id$/.test(n))return'SMP-'+String(1000+i*13+Math.floor(r()*8000));
 if(/name|title|hotel|property|label/.test(n))return pick(WORDS.name,r);
 if(/description|summary|text|details|note/.test(n))return'Sample text for '+(name||'this field')+'. The real answer appears once the API key is added.';
 const len=Number.isFinite(s.maxLength)?Math.max(1,Math.min(s.maxLength,12)):12;
 return('sample '+(name||'value')).slice(0,len);
}
function sampleOf(schema,name,r,depth=0,i=0){
 const s=merge(schema);
 if(depth>8)return null;
 if(s.$ref)return{};
 const type=s.type||(s.properties?'object':s.items?'array':null);
 if(type==='array'){const n=Math.min(5,Math.max(Number.isFinite(s.minItems)?s.minItems:3,1));return Array.from({length:n},(_,k)=>sampleOf(s.items||{},name,r,depth+1,k))}
 if(type==='object'||(!type&&s.additionalProperties)){
  const out={};
  for(const [k,v] of Object.entries(s.properties||{}).slice(0,60))out[k]=sampleOf(v,k,r,depth+1,i);
  return out;
 }
 if(!type)return name?scalar({type:'string'},name,r,i):{};
 return scalar(s,name,r,i);
}
// The sample answer for one call: status, headers and JSON body.
function sampleAnswer(api,op,{method,url}){
 const r=rng(api.slug+' '+String(method).toUpperCase()+' '+String(url));
 const code=(op&&op.successCodes&&op.successCodes[0])||'200';
 const schema=op&&op.responseSchemas&&op.responseSchemas[code];
 const body=op?(schema&&Object.keys(schema).length?sampleOf(schema,'',r):{}):{error:'Not a documented path of '+api.title,sample:true};
 return{status:op?Number(code):404,headers:{'content-type':'application/json','x-kairoq-sample':'1'},body:Number(code)===204?'':JSON.stringify(body)};
}

// ---------- the call log ----------
// Query values that look like keys are hidden before anything is written down.
function safeUrl(url){
 try{const u=new URL(String(url));for(const k of [...u.searchParams.keys()])if(/key|token|secret|sig|signature|password|auth/i.test(k))u.searchParams.set(k,'•••');return(u.origin+u.pathname+u.search.replace(/%E2%80%A2/g,'•')).slice(0,300)}catch{return String(url).slice(0,120)}
}
function logCall(id,entry){
 const f=file(id,'api-log.json'),log=readJson(f,[]);
 log.unshift(entry);
 try{writeJson(f,log.slice(0,MAX_LOG))}catch{}
}
function log(id){return readJson(file(id,'api-log.json'),[])}

// ---------- the fetch that server functions use ----------
// mode: "check" (a saved check: sample answers for every added API), "preview" (the editor's
// preview: sample answers while the API's key is missing) or "live" (always real).
async function fetchFor(id,args,{mode='live',real=require('./react-functions').guardedFetch}={}){
 const started=Date.now(),found=findApi(id,args.url);
 const sample=found&&(mode==='check'||(mode==='preview'&&!(found.api.secret&&hasKey(id,found.api.secret))));
 const entry={at:new Date().toISOString(),method:String(args.method||'GET').toUpperCase(),url:safeUrl(args.url),api:found?found.api.title:null,sample:Boolean(sample),mode};
 try{
  const out=sample?sampleAnswer(found.api,findOperation(found.api,found.rest,args.method),args):await real(args);
  logCall(id,{...entry,status:out.status,ms:Date.now()-started});
  return out;
 }catch(e){logCall(id,{...entry,status:0,error:String(e.message||e).slice(0,160),ms:Date.now()-started});throw e}
}
// Which mode a request to the app's backend runs in.
function modeOf(meta,req,sb){
 if(sb)return'check';
 if(!meta.published)return'preview';
 const k=Buffer.from(String(req&&req.headers&&req.headers['x-kairoq-preview']||'')),want=Buffer.from(String(meta.preview_key||''));
 return want.length&&k.length===want.length&&crypto.timingSafeEqual(k,want)?'preview':'live';
}
// For the publish screen: added APIs whose key is still missing.
function missingKeys(id){return apis(id).filter(a=>a.secret&&!hasKey(id,a.secret)).map(a=>({title:a.title,secret:a.secret}))}
module.exports={add,remove,list,log,promptNote,fetchFor,modeOf,missingKeys,sampleAnswer,findApi,findOperation,sampleOf};

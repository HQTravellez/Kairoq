"use strict";
// Bringing requests in from other API tools: a pasted cURL command, and a Hoppscotch collection
// (converted to a Postman collection, which api-postman.js already reads, credentials left out).
// Test scripts become answer checks (api-rules.js); nothing in them is run.

// The words of a shell command, with quotes and line continuations handled.
function words(text){
 const out=[];let cur='',q=null,any=false;
 const s=String(text||'').replace(/\\\r?\n/g,' ');
 for(let i=0;i<s.length;i++){
  const c=s[i];
  if(q){if(c===q){q=null;continue}if(c==='\\'&&q==='"'&&i+1<s.length){cur+=s[++i];continue}cur+=c;continue}
  if(c==="'"||c==='"'){q=c;any=true;continue}
  if(c==='\\'&&i+1<s.length){cur+=s[++i];any=true;continue}
  if(/\s/.test(c)){if(cur||any){out.push(cur);cur='';any=false}continue}
  cur+=c;any=true;
 }
 if(cur||any)out.push(cur);
 return out;
}
const SECRET_HEADER=/^(authorization|x-api-key|api-key|apikey|x-auth-token|x-access-token|proxy-authorization|cookie)$/i;
// A cURL command as a request. Keys in it are noted but never kept.
function parseCurl(text){
 const w=words(text);
 if(!w.length||!/^curl(\.exe)?$/i.test(w[0]))throw Object.assign(Error('That is not a cURL command. It should start with curl.'),{status:400});
 let method=null,url=null,body=null;const headers={};const secrets=[];
 for(let i=1;i<w.length;i++){
  const a=w[i],next=()=>w[++i];
  if(a==='-X'||a==='--request')method=String(next()||'').toUpperCase();
  else if(a==='-H'||a==='--header'){const h=String(next()||''),k=h.indexOf(':');if(k>0){const name=h.slice(0,k).trim(),value=h.slice(k+1).trim();if(SECRET_HEADER.test(name)){secrets.push(name);continue}headers[name]=value}}
  else if(['-d','--data','--data-raw','--data-binary','--data-ascii'].includes(a))body=(body?body+'&':'')+String(next()||'');
  else if(a==='--json'){body=String(next()||'');headers['Content-Type']=headers['Content-Type']||'application/json';headers.Accept=headers.Accept||'application/json'}
  else if(a==='-u'||a==='--user'){next();secrets.push('user and password')}
  else if(a==='--url')url=next();
  else if(/^-/.test(a)){if(['-A','--user-agent','-e','--referer','-o','--output','-m','--max-time','--connect-timeout','-w','--write-out','-b','--cookie','-x','--proxy','--cacert','--cert','--key','-T','--upload-file','-F','--form'].includes(a)){const v=next();if(a==='-b'||a==='--cookie')secrets.push('cookie');if(a==='-F'||a==='--form')body=(body||'')+'';void v}}
  else if(!url)url=a;
 }
 if(!url)throw Object.assign(Error('The cURL command has no address.'),{status:400});
 let u;try{u=new URL(url)}catch{throw Object.assign(Error('The address in the cURL command is not valid.'),{status:400})}
 if(u.protocol!=='https:')throw Object.assign(Error('Only https addresses can be tried.'),{status:400});
 for(const [k,v] of u.searchParams)if(/key|token|secret|password|signature|sig$/i.test(k)){u.searchParams.delete(k);secrets.push(k)}
 return{method:method||(body?'POST':'GET'),url:String(u),headers,body,secrets:[...new Set(secrets)]};
}

// A minimal spec for one pasted request, so it can be added as an API and tried.
function specFromRequest(req,{title}={}){
 const u=new URL(req.url),path=u.pathname||'/',params=[...u.searchParams.keys()].map(name=>({name,in:'query',required:false,schema:{type:'string'},example:u.searchParams.get(name)}));
 let bodySchema=null;if(req.body){try{const v=JSON.parse(req.body);bodySchema={type:'object',example:v,properties:Object.fromEntries(Object.entries(v&&typeof v==='object'&&!Array.isArray(v)?v:{}).slice(0,40).map(([k,x])=>[k,{type:Array.isArray(x)?'array':x===null?'string':typeof x,example:x}]))}}catch{}}
 const op={operationId:(req.method.toLowerCase()+path.replace(/[^a-z0-9]+/gi,'_')).slice(0,80),summary:'Pasted request',parameters:params,responses:{200:{description:'Answer'}}};
 if(bodySchema)op.requestBody={content:{'application/json':{schema:bodySchema}}};
 const security=req.secrets.some(s=>/^authorization$/i.test(s))?{bearer:{type:'http',scheme:'bearer'}}:req.secrets.some(s=>/key|token/i.test(s))?{key:{type:'apiKey',in:'header',name:req.secrets.find(s=>/key|token/i.test(s))}}:null;
 return{openapi:'3.0.3',info:{title:title||u.hostname.replace(/^www\.|^api\./,''),version:''},servers:[{url:u.origin}],...(security?{components:{securitySchemes:security},security:[{[Object.keys(security)[0]]:[]}]}:{}),paths:{[path]:{[req.method.toLowerCase()]:op}}};
}

// ---------- Hoppscotch collections ----------
function isHoppscotch(v){return Boolean(v&&typeof v==='object'&&!v.info&&(Array.isArray(v.requests)||Array.isArray(v.folders))&&(v.v!==undefined||v.name!==undefined))}
const hv=s=>String(s||'').replace(/<<\s*([\w.-]+)\s*>>/g,'{{$1}}');
// Hoppscotch collection (or a list of them) → Postman v2.1 collection, plus the checks from its tests.
function hoppscotchToPostman(input){
 const cols=Array.isArray(input)?input:[input];
 const checks={},skipped=[];
 const item=r=>{
  const raw=hv(r.endpoint),name=String(r.name||r.endpoint||'request').slice(0,120);
  const auth=r.auth||{},t=String(auth.authType||'none');
  const pmAuth=t==='bearer'?{type:'bearer',bearer:[{key:'token',value:'{{token}}'}]}:t==='basic'?{type:'basic',basic:[]}:t==='api-key'?{type:'apikey',apikey:[{key:'key',value:String(auth.key||'X-Api-Key')},{key:'in',value:auth.addTo==='QUERY_PARAMS'||auth.addTo==='Query params'?'query':'header'}]}:t==='oauth-2'?{type:'oauth2',oauth2:[{key:'accessTokenUrl',value:String(auth.grantTypeInfo?.authEndpoint||auth.grantTypeInfo?.tokenEndpoint||'')}]}:t==='inherit'?undefined:{type:'noauth'};
  const query=(r.params||[]).filter(p=>p&&p.active!==false&&p.key).map(p=>({key:String(p.key),value:hv(p.value)}));
  const url={raw:raw+(query.length&&!raw.includes('?')?'?'+query.map(q=>q.key+'='+q.value).join('&'):''),...(query.length?{query}:{})};
  const header=(r.headers||[]).filter(h=>h&&h.key&&!SECRET_HEADER.test(h.key)).map(h=>({key:String(h.key),value:hv(h.value),disabled:h.active===false}));
  const ct=String(r.body?.contentType||'');
  const body=r.body&&r.body.body&&/json|text/.test(ct)?{mode:'raw',raw:typeof r.body.body==='string'?hv(r.body.body):JSON.stringify(r.body.body)}:undefined;
  const events=[];if(String(r.preRequestScript||'').trim())events.push({listen:'prerequest',script:{exec:String(r.preRequestScript).split('\n')}});
  const parsed=require('./api-rules').fromScript(r.testScript);
  if(parsed.rules.length)checks[name]=parsed.rules;skipped.push(...parsed.skipped);
  return{name,request:{method:String(r.method||'GET').toUpperCase(),url,header,...(body?{body}:{}),...(pmAuth?{auth:pmAuth}:{})},...(events.length?{event:events}:{})};
 };
 const folder=f=>({name:String(f.name||'Folder').slice(0,120),item:[...(f.folders||[]).map(folder),...(f.requests||[]).map(item)]});
 const col=cols.length===1?folder(cols[0]):{name:'Hoppscotch collections',item:cols.map(folder)};
 return{collection:{info:{name:col.name,schema:'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'},item:col.item},checks,skipped:[...new Set(skipped)].slice(0,10)};
}

module.exports={words,parseCurl,specFromRequest,isHoppscotch,hoppscotchToPostman,SECRET_HEADER};

"use strict";
// API checker: call a public API once and say what came back in plain words. The call goes
// through react-functions' guardedFetch (public addresses only, checked when connecting, 15 s,
// 5 MB), so the checker cannot be pointed at Kairoq's own network. History keeps the last 20
// checks per account, without header values (they may hold keys).
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const METHODS=['GET','POST','PUT','PATCH','DELETE'];
const HISTORY=20,PREVIEW=200000;
const STATUS_WORDS={200:'OK',201:'Created',202:'Accepted',204:'No content',301:'Moved',302:'Found',304:'Not modified',400:'Bad request',401:'Not signed in',403:'Not allowed',404:'Not found',405:'Method not allowed',408:'Timed out',409:'Conflict',422:'Not accepted',429:'Too many requests',500:'Server error',502:'Bad gateway',503:'Unavailable',504:'Gateway timeout'};

function fail(status,message){return Object.assign(Error(message),{status})}
function dir(){return process.env.KAIROQ_APICHECK_DIR||path.join(path.dirname(require('./react-builder').ROOT()),'api-checks')}
function file(owner){return path.join(dir(),crypto.createHash('sha256').update(String(owner)).digest('hex').slice(0,24)+'.json')}
function history(owner){try{return JSON.parse(fs.readFileSync(file(owner),'utf8'))}catch{return[]}}
function remember(owner,item){
 const list=[item,...history(owner)].slice(0,HISTORY);
 fs.mkdirSync(dir(),{recursive:true});const f=file(owner),tmp=f+'.'+process.pid+'.tmp';
 fs.writeFileSync(tmp,JSON.stringify(list));fs.renameSync(tmp,f);return list;
}

// Every leaf value with its path ("current.temperature_2m"), first 40, so people can see what they can use.
function fields(value,prefix='',out=[]){
 if(out.length>=40)return out;
 if(Array.isArray(value)){
  if(!value.length){out.push({path:prefix||'(list)',value:'empty list'});return out}
  out.push({path:(prefix||'(list)')+'[]',value:value.length+' item'+(value.length===1?'':'s')});
  if(value[0]&&typeof value[0]==='object')fields(value[0],(prefix||'')+'[0]',out);
  return out;
 }
 if(value&&typeof value==='object'){
  for(const [k,v] of Object.entries(value)){if(out.length>=40)break;fields(v,prefix?prefix+'.'+k:k,out)}
  return out;
 }
 out.push({path:prefix||'(value)',value:value===null?'null':String(value).slice(0,120)});
 return out;
}
// What the answer means, said plainly. Built from the response only; nothing is guessed.
function plain({status,json,type,bytes,host}){
 const ok=status>=200&&status<300;
 if(status===401||status===403)return host+' refused the call ('+status+'). It usually needs a key or a sign-in: add it under Headers.';
 if(status===404)return host+' has nothing at this address (404). Check the path.';
 if(status===429)return host+' says too many calls right now (429). Wait a little and try again.';
 if(status>=500)return host+' had a problem of its own ('+status+'). Try again later.';
 if(!ok)return host+' answered with '+status+(STATUS_WORDS[status]?' ('+STATUS_WORDS[status]+')':'')+'.';
 if(status===204||!bytes)return host+' answered and sent nothing back.';
 if(json!==undefined){
  if(Array.isArray(json))return host+' answered with a list of '+json.length+' item'+(json.length===1?'':'s')+(json[0]&&typeof json[0]==='object'?', each with '+Object.keys(json[0]).slice(0,6).join(', ')+'.':'.');
  if(json&&typeof json==='object'){const keys=Object.keys(json);return host+' answered with '+keys.length+' field'+(keys.length===1?'':'s')+': '+keys.slice(0,8).join(', ')+(keys.length>8?' and more':'')+'.'}
  return host+' answered with a single value.';
 }
 if(/html/i.test(type))return host+' sent a web page, not data. An API address usually returns JSON.';
 return host+' answered with '+(type||'text')+'.';
}

async function check(owner,{url,method='GET',headers={},body}={},{fetchImpl}={}){
 const m=String(method||'GET').toUpperCase();
 if(!METHODS.includes(m))throw fail(400,'Pick GET, POST, PUT, PATCH or DELETE.');
 let u;try{u=new URL(String(url||'').trim())}catch{throw fail(400,'Paste a full address that starts with https://')}
 if(!/^https?:$/.test(u.protocol))throw fail(400,'Only http and https addresses can be checked.');
 const h={};for(const [k,v] of Object.entries(headers&&typeof headers==='object'?headers:{}).slice(0,20))if(String(k).trim())h[String(k).trim()]=String(v);
 if(!Object.keys(h).some(k=>k.toLowerCase()==='accept'))h.Accept='application/json, text/plain;q=0.8, */*;q=0.5';
 const payload=['GET','DELETE'].includes(m)||body==null||body===''?undefined:String(body).slice(0,100000);
 if(payload&&!Object.keys(h).some(k=>k.toLowerCase()==='content-type'))h['Content-Type']=/^\s*[[{]/.test(payload)?'application/json':'text/plain';
 const go=fetchImpl||require('./react-functions').guardedFetch;
 const t0=Date.now();
 const r=await go({url:u.href,method:m,headers:h,body:payload});
 const ms=Date.now()-t0,text=String(r.body||''),bytes=Buffer.byteLength(text),type=String((r.headers||{})['content-type']||'').split(';')[0];
 let json;if(/json/i.test(type)||/^\s*[[{]/.test(text))try{json=JSON.parse(text)}catch{}
 const result={
  id:crypto.randomUUID(),at:new Date().toISOString(),method:m,url:u.href,host:u.hostname,
  status:r.status,status_text:STATUS_WORDS[r.status]||'',ok:r.status>=200&&r.status<300,ms,bytes,type,
  plain:plain({status:r.status,json,type,bytes,host:u.hostname}),
  fields:json!==undefined?fields(json):[],
  body:json!==undefined?JSON.stringify(json,null,2).slice(0,PREVIEW):text.slice(0,PREVIEW),
  truncated:bytes>PREVIEW,
  headers:r.headers||{},
  sent_headers:Object.keys(h)
 };
 const {body:_b,headers:_h,fields:_f,...brief}=result;
 remember(owner,brief);
 return result;
}
module.exports={check,history,fields,plain,METHODS};

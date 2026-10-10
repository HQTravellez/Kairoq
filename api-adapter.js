"use strict";
// Server-side API adapter: explicit host + operation permission, no client secrets.
const https=require("node:https"),dns=require("node:dns").promises;
const docs=require("./api-docs"),api=require("./api-learning");
function baseApprovalKey(contract,op){const u=docs.validUrl(contract.baseUrl);return u.hostname.toLowerCase()+":"+op.method+":"+op.path;}
function prepare({apiSpec,plan,operationId,pathParams={},query={},body,credentialName,approved=false,approvedWrites=false,allowedHosts=process.env.KAIROQ_API_HOSTS}={}){
 const contract=plan?.operations?plan:api.learn(apiSpec);
 const op=contract.operations.find(x=>x.id===operationId);if(!op)throw Error("Unknown API operation");
 const approvalKey=baseApprovalKey(contract,op);const allowedOps=new Set(String(process.env.KAIROQ_API_APPROVED_OPERATIONS||"").split(",").map(x=>x.trim()).filter(Boolean));
 if(!allowedOps.has(approvalKey))throw Error("Operation is not approved in the server policy");
 if(!approved)throw Error("API execution requires explicit approval");
 if(!["GET","HEAD"].includes(op.method)&&(!approvedWrites||!new Set(String(process.env.KAIROQ_API_APPROVED_WRITES||"").split(",").map(x=>x.trim())).has(approvalKey)))throw Error("Mutating API operations require separate write approval");
 const base=docs.validUrl(contract.baseUrl);const hosts=String(allowedHosts||"").split(",").map(x=>x.trim().toLowerCase());if(!hosts.includes(base.hostname.toLowerCase()))throw Error("API host is not allowlisted");
 let pathname=op.path;
 for(const token of pathname.match(/\{([^{}]+)\}/g)||[]){
  const key=token.slice(1,-1),v=pathParams[key];if(v===undefined||v===null||String(v).length>160)throw Error("Missing or invalid path parameter: "+key);
  pathname=pathname.replace(token,encodeURIComponent(String(v)));
 }
 if(/[{}]/.test(pathname))throw Error("Unresolved path parameter");
 const url=new URL(base.href.replace(/\/$/,"")+"/"+pathname.replace(/^\//,""));
 if(url.hostname!==base.hostname||url.protocol!=="https:")throw Error("Unsafe API target");
 for(const [k,v] of Object.entries(query)){if(!/^[\w.-]{1,80}$/.test(k)||v===null||typeof v==="object"||String(v).length>500)throw Error("Invalid query parameter");url.searchParams.set(k,String(v));}
 if(url.href.length>4000)throw Error("API URL too long");
 let secret="";
 if(credentialName){
  if(!/^KAIROQ_API_TOKEN_[A-Z0-9_]{1,64}$/.test(credentialName))throw Error("Credential must be a dedicated KAIROQ_API_TOKEN_ environment variable");
  secret=process.env[credentialName]||"";if(!secret)throw Error("API credential not configured");
 }
 if(op.authenticationRequired&&!secret)throw Error("Operation requires an API credential");
 if(body!==undefined&&JSON.stringify(body).length>50000)throw Error("API body too large");
 const payload=body===undefined?undefined:JSON.stringify(body);
 return{url,method:op.method,headers:{"Accept":"application/json",...(payload?{"Content-Type":"application/json"}:{}),...(secret?{"Authorization":"Bearer "+secret}:{})},payload,operation:op};
}
async function execute(args,{lookup=dns.lookup,timeout=10000}={}){
 if(process.env.KAIROQ_API_LIVE_ENABLED!=="true")throw Error("Live API execution is disabled; set KAIROQ_API_LIVE_ENABLED=true after reviewing the provider and host allowlist");
 const request=prepare(args);
 if(!["GET","HEAD"].includes(request.method)&&process.env.KAIROQ_API_WRITE_ENABLED!=="true")throw Error("Live API writes are disabled by server policy");
 const ip=await lookup(request.url.hostname,{all:true});
 if(!ip?.length||ip.some(x=>!docs.publicIp(x.address)))throw Error("API target resolves to a non-public address");
 const pinned=ip[0];
 return new Promise((resolve,reject)=>{
  const req=https.request(request.url,{method:request.method,headers:request.headers,timeout,maxHeaderSize:16384,lookup:(host,opts,cb)=>cb(null,pinned.address,pinned.family)},res=>{
   let size=0,chunks=[];res.on("data",part=>{size+=part.length;if(size>300000){req.destroy(Error("API response exceeds 300 KB"));return;}chunks.push(part);});
   res.on("end",()=>{const raw=Buffer.concat(chunks).toString("utf8");let data;try{data=JSON.parse(raw);}catch{data=raw.slice(0,300000);}resolve({status:res.statusCode,ok:res.statusCode>=200&&res.statusCode<300,data,operationId:request.operation.id});});
  });req.on("timeout",()=>req.destroy(Error("API request timed out")));req.on("error",reject);req.end(request.payload);
 });
}
module.exports={prepare,execute};

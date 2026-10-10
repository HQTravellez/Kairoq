"use strict";
// Documentation ingestion is bounded, HTTPS-only, and treats all external text as data.
const https=require("node:https"),dns=require("node:dns").promises,net=require("node:net");
const MAX=400000;
function publicIp(ip){
 if(net.isIP(ip)===4){const p=ip.split(".").map(Number);return !(p[0]===0||p[0]===10||p[0]===127||p[0]>=224||p[0]===169&&p[1]===254||p[0]===172&&p[1]>=16&&p[1]<=31||p[0]===192&&p[1]===168||p[0]===100&&p[1]>=64&&p[1]<=127||p[0]===192&&p[1]===0||p[0]===198&&p[1]>=18&&p[1]<=19||p[0]===192&&p[1]===0&&p[2]===2||p[0]===198&&p[1]===51&&p[2]===100||p[0]===203&&p[1]===0&&p[2]===113);}
 if(net.isIP(ip)===6){const s=ip.toLowerCase();if(s.startsWith("::ffff:"))return publicIp(s.slice(7));return !(s==="::1"||s==="::"||s.startsWith("fe80:")||s.startsWith("fc")||s.startsWith("fd")||s.startsWith("2001:db8:")||s.startsWith("ff"));}
 return false;
}
function validUrl(value){
 const u=new URL(String(value));if(u.protocol!=="https:"||u.username||u.password||u.port&&u.port!=="443"||net.isIP(u.hostname)||u.hostname==="localhost"||!u.hostname.includes("."))throw Error("Documentation URL must be a public HTTPS hostname on port 443");
 return u;
}
function allowed(u,hosts){
 const set=new Set(String(hosts||"").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean));
 if(!set.has(u.hostname.toLowerCase()))throw Error("Documentation host is not allowlisted");
}
async function fetchDocs(url,{allowedHosts=process.env.KAIROQ_API_DOC_HOSTS,lookup=dns.lookup,timeout=8000}={}){
 const u=validUrl(url);allowed(u,allowedHosts);
 const resolved=await lookup(u.hostname,{all:true});if(!resolved?.length||resolved.some(x=>!publicIp(x.address)))throw Error("Documentation host resolves to a non-public address");
 const ip=resolved[0];
 return new Promise((resolve,reject)=>{
  const req=https.get(u,{timeout,maxHeaderSize:16384,headers:{Accept:"application/json, text/html, text/markdown, text/plain", "User-Agent":"Kairoq-API-Docs/1.0"},lookup:(host,opts,cb)=>cb(null,ip.address,ip.family)},res=>{
   if(res.statusCode!==200){res.resume();return reject(Error("Documentation fetch returned HTTP "+res.statusCode));}
   const mime=String(res.headers["content-type"]||"").toLowerCase();if(mime&&!/json|html|text\/plain|markdown/.test(mime)){res.resume();return reject(Error("Unsupported documentation content type"));}
   let total=0,chunks=[];res.on("data",part=>{total+=part.length;if(total>MAX){req.destroy(Error("Documentation exceeds 400 KB"));return;}chunks.push(part);});
   res.on("end",()=>resolve({url:u.href,content:Buffer.concat(chunks).toString("utf8"),contentType:mime}));
  });req.on("timeout",()=>req.destroy(Error("Documentation request timed out")));req.on("error",reject);
 });
}
function plain(input){
 return String(input||"").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&(?:nbsp|amp|lt|gt|quot);/gi,x=>({"&nbsp;":" ","&amp;":"&","&lt;":"<","&gt;":">","&quot;":'"'}[x.toLowerCase()]||" ")).replace(/\s+/g," ").trim();
}
function infer(input){
 const source=String(input||"");if(Buffer.byteLength(source)>MAX)throw Error("Documentation exceeds 400 KB");
 try{const obj=JSON.parse(source);if(obj.openapi||obj.swagger)return require("./api-learning").learn(obj);if(obj.info?.schema?.includes("schema.getpostman.com/json/collection/v2."))return require("./api-learning").fromPostman(obj);}catch(e){if(!e.message.includes("JSON")&&/Only OpenAPI|Specification|Postman/.test(e.message))throw e;}
 const text=plain(source);
 const regex=/\b(GET|POST|PUT|PATCH|DELETE)\s+(\/[\w.{}\-\/?:=&%]+)(?=\s|$|[.,;])/gi;
 const found=new Map();let m;
 while((m=regex.exec(source))!==null&&found.size<150){
  const route=m[2].replace(/[.,;]+$/,"");if(route.length>240||!route.startsWith("/"))continue;
  const key=m[1].toUpperCase()+" "+route;found.set(key,{id:key.replace(/[^a-z0-9]+/gi,"_"),method:m[1].toUpperCase(),path:route,summary:plain(source.slice(Math.max(0,m.index-100),m.index+180)).slice(0,200),requiredParameters:[],bodyFields:[],successCodes:[],authenticationRequired:null});
 }
 return{title:"Inferred documentation",format:"unstructured",baseUrl:"",auth:[],operations:[...found.values()],sourceExcerpt:text.slice(0,2000),limitations:["Unstructured documentation is only a draft; endpoint parameters and auth are unverified","Import a formal OpenAPI spec before executing requests","No API calls were made"]};
}
async function discover(url,options){
 const page=await fetchDocs(url,options);
 let result=infer(page.content);
 if(result.format==="unstructured"){
  const refs=[...page.content.matchAll(/(?:href|src)\s*=\s*["']([^"']+(?:openapi|swagger)[^"']*\.json(?:\?[^"']*)?)["']/gi)].slice(0,5);
  for(const match of refs){
   try{const linked=new URL(match[1],page.url);if(linked.hostname!==new URL(page.url).hostname)continue;const spec=await fetchDocs(linked.href,options);const parsed=infer(spec.content);if(parsed.format!=="unstructured"){result={...parsed,documentationUrl:page.url,specificationUrl:spec.url};break;}}catch{}
  }
 }
 return{...result,documentationUrl:page.url};
}
module.exports={publicIp,validUrl,fetchDocs,infer,discover};

"use strict";
// Public APIs is a human-curated directory, not a supplier credential store,
// an OpenAPI spec, or permission to execute the APIs it lists.
// Upstream: public-apis/public-apis, MIT, pinned master snapshot Oct 21 2026.
const {fetchDocs}=require("./api-docs");
const SHA="339ab55dc8532107fdeb5ef22777b4e34bd4af6f";
const SOURCE="https://raw.githubusercontent.com/public-apis/public-apis/"+SHA+"/README.md";
const MAX_BYTES=750000,MAX_ENTRIES=4500,CACHE_MS=6*60*60*1000;
let cache=null,inflight=null;
function secureUrl(value){
 try{
  if(typeof value!=="string"||value.length>1200||/[\s<>]/.test(value))return null;
  const u=new URL(value);if(!["https:","http:"].includes(u.protocol)||u.username||u.password||!u.hostname.includes(".")||u.port&&u.port!=="443"&&u.port!=="80")return null;
  return u.href;
 }catch{return null;}
}
function clean(value,max=260){return String(value||"").replace(/<[^>]*>/g," ").replace(/[\x60*]/g,"").replace(/\s+/g," ").trim().slice(0,max);}
function parse(markdown){
 if(typeof markdown!=="string"||Buffer.byteLength(markdown)>MAX_BYTES)throw Error("Public API directory exceeds safe size");
 const rows=[],seen=new Set();let category="";
 for(const line of markdown.split(/\r?\n/)){
  const cat=/^### ([^\r\n]+)$/.exec(line);
  if(cat){category=clean(cat[1],90);continue;}
  // Excludes APILayer promotional tables, the MCP server list and the index.
  if(!category||!line.startsWith("| "))continue;
  const cells=line.split("|").slice(1,-1).map(s=>s.trim());
  if(cells.length!==5)continue;
  const link=/^\[([^\]\r\n]{1,130})\]\((https?:\/\/[^)\s]{5,1200})\)$/.exec(cells[0]);
  if(!link||!/^(No|Yes|Unknown|\x60apiKey\x60|\x60OAuth\x60|\x60X-Mashape-Key\x60|\x60User-Agent\x60)$/i.test(cells[2]))continue;
  const url=secureUrl(link[2]);if(!url)continue;
  const name=clean(link[1],130),description=clean(cells[1],300);
  if(!name||!description)continue;
  const key=category.toLowerCase()+"|"+name.toLowerCase()+"|"+url;
  if(seen.has(key))continue;seen.add(key);
  rows.push({id:"public-apis:"+rows.length,name,description,category,documentationUrl:url,
    authentication:clean(cells[2],35),https:cells[3]==="Yes",cors:clean(cells[4],20),
    status:"directory-only-unverified",source:"public-apis/public-apis"});
  if(rows.length>=MAX_ENTRIES)throw Error("Public API directory exceeds entry cap");
 }
 if(rows.length===0)throw Error("No supported entries found in the Public APIs directory");
 return rows;
}
function queryTerms(value){
 if(typeof value!=="string"||value.length>500)throw Error("Search query must be at most 500 characters");
 return [...new Set(value.toLowerCase().match(/[a-z0-9]{2,}/g)||[])].slice(0,36);
}
function search(entries,{query="",category="",limit=15,secureOnly=false,auth}={}){
 if(!Array.isArray(entries))throw Error("API directory not loaded");
 if(typeof category!=="string"||category.length>90||!Number.isInteger(limit)||limit<1||limit>50)throw Error("Invalid API search filters");
 if(auth!==undefined&&!["No","apiKey","OAuth","X-Mashape-Key","User-Agent"].includes(auth))throw Error("Invalid API auth filter");
 const words=queryTerms(query);const phrase=query.toLowerCase().trim();
 const scored=entries.filter(e=>(!category||e.category.toLowerCase()===category.toLowerCase())
  &&(!secureOnly||e.https)&&(!auth||e.authentication===auth))
  .map((e,index)=>{
   const name=e.name.toLowerCase(),description=e.description.toLowerCase(),group=e.category.toLowerCase();
   const score=words.reduce((n,w)=>n+(name.includes(w)?6:0)+(description.includes(w)?2:0)+(group.includes(w)?3:0),0)
     +(phrase&&name.includes(phrase)?12:0);
   return{e,index,score};
  }).filter(x=>!words.length||x.score>0)
  .sort((a,b)=>b.score-a.score||a.index-b.index);
 return {source:"public-apis/public-apis",sourceRevision:SHA,entryCount:entries.length,
  matchedCount:scored.length,results:scored.slice(0,limit).map(x=>({...x.e,relevanceScore:x.score})),
  disclaimer:"Directory entries are unverified leads, not machine-readable API contracts, confirmed pricing, or permission to call a provider"};
}
async function load({fetchImpl=fetchDocs,force=false,now=Date.now()}={}){
 if(!force&&cache&&now-cache.time<CACHE_MS)return{...cache.data,fromCache:true};
 if(!force&&inflight)return inflight;
 const download=(async()=>{
  const response=await fetchImpl(SOURCE,{allowedHosts:"raw.githubusercontent.com",maxBytes:MAX_BYTES,timeout:10000});
  if(response?.url!==SOURCE||typeof response.content!=="string")throw Error("Unexpected Public APIs snapshot response");
  const rows=parse(response.content),data={entries:rows,count:rows.length,revision:SHA,sourceUrl:SOURCE};
  if(fetchImpl===fetchDocs)cache={time:Date.now(),data};
  return{...data,fromCache:false};
 })();
 if(fetchImpl===fetchDocs)inflight=download;
 try{return await download;}finally{if(fetchImpl===fetchDocs)inflight=null;}
}
async function discover(options={},deps={}){
 const collection=await load(deps);
 return{...search(collection.entries,options),fromCache:collection.fromCache};
}
module.exports={SHA,SOURCE,parse,search,load,discover,secureUrl};

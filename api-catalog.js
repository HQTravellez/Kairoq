"use strict";
// Read-only API discovery index. It is a PINNED community directory, not provider
// source code or a machine-readable integration contract. Never execute entries.
const crypto=require("node:crypto");
const catalog=require("./data/public-api-catalog.json");
const STOP=new Set("a an and api apis app application apps based build create can company corporate dashboard for from get i in integrate integration is it me my of on or please platform product service services system that the their these this to use using want we with you your".split(" "));
function words(input){
 return [...new Set(String(input||"").toLowerCase().normalize("NFKC").match(/[a-z0-9]{2,}/g)||[])].filter(w=>!STOP.has(w)).slice(0,45);
}
const items=Object.freeze(catalog.entries.map((entry,index)=>Object.freeze({
 ...entry,id:crypto.createHash("sha256").update(entry.url+"\n"+entry.name).digest("hex").slice(0,16),
 index
})));
const lookup=new Map(items.map(item=>[item.id,item]));
function validateQuery(query){if(typeof query!=="string"||query.length>500)throw Error("API search must be a string of at most 500 characters");return query.trim();}
function validateOptions({limit=12,category=""}={}){
 if(!Number.isInteger(limit)||limit<1||limit>30)throw Error("API results limit must be 1–30");
 if(typeof category!=="string"||category.length>80)throw Error("Invalid category");
 return{limit,category:category.trim()};
}
function rank(item,terms,raw){
 const name=item.name.toLowerCase(),description=item.description.toLowerCase(),cat=item.category.toLowerCase();
 let score=0;
 for(const term of terms){
  if(name.split(/[^a-z0-9]+/).includes(term))score+=10;
  else if(name.includes(term))score+=5;
  if(cat.includes(term))score+=3;
  if(description.split(/[^a-z0-9]+/).includes(term))score+=3;
  else if(description.includes(term))score+=1;
 }
 if(name===raw)score+=28;
 else if(raw.length>=4&&name.includes(raw))score+=10;
 if(item.https&&score>0)score+=.1; // HTTPS tie-breaks relevant matches only; never makes an unrelated API a match
 return score;
}
function summary(entry,score){
 return{id:entry.id,name:entry.name,description:entry.description,category:entry.category,url:entry.url,
  auth:entry.auth,https:entry.https,cors:entry.cors,
  score:Math.round(score*10)/10,status:"directory-only-unverified",
  source:"public-apis/public-apis",sourceCommit:catalog.sourceCommit};
}
function search(query,opts={}){
 const phrase=validateQuery(query),{limit,category}=validateOptions(opts),terms=words(phrase);
 if(!terms.length&&phrase)return{query:phrase,total:0,candidates:[],source:"public-apis/public-apis",sourceCommit:catalog.sourceCommit,
  warning:"Enter meaningful keywords for API discovery"};
 const raw=phrase.toLowerCase(),matches=items.filter(x=>!category||x.category.toLowerCase()===category.toLowerCase()).map(item=>({item,score:terms.length?rank(item,terms,raw):1})).filter(x=>x.score>0);
 matches.sort((a,b)=>b.score-a.score||a.item.name.localeCompare(b.item.name));
 return{query:phrase,total:matches.length,candidates:matches.slice(0,limit).map(x=>summary(x.item,x.score)),
  source:"public-apis/public-apis",sourceCommit:catalog.sourceCommit,
  warning:"Community list: links, costs, auth, commercial terms and operational health are unverified. Import the provider's formal documentation before writing any connector."};
}
function find(id){
 if(typeof id!=="string"||!/^[a-f0-9]{16}$/.test(id))throw Error("Invalid API catalog selection");
 const item=lookup.get(id);
 if(!item)throw Error("Unknown or outdated API catalog selection");
 return summary(item,0);
}
function categories(){
 return [...new Set(items.map(x=>x.category))].sort((a,b)=>a.localeCompare(b));
}
function stats(){return{entries:items.length,categories:categories().length,source:catalog.source,
 sourceCommit:catalog.sourceCommit,sourceDate:catalog.sourceDate,license:catalog.sourceLicense,
 note:catalog.note}}
module.exports={words,search,find,categories,stats,validateQuery};

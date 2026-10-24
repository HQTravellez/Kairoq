"use strict";
// Bounded public, read-only multipage research via Kairoq's guarded browser.
// Pages are selected by the agent and separately checked by web.createBrowser.
const { createBrowser } = require("./web");
async function researchPages(urls,{browseSite,maxPages=6,onPage=()=>{}}={}){
 if(!Array.isArray(urls)||urls.length===0||urls.length>maxPages)throw Error("Provide 1-"+maxPages+" URLs");
 const pages=[],seen=new Set();
 const browser=createBrowser({browseSite,maxOps:maxPages+1});
 if(!browser.available())throw Error("Browser unavailable on this server");
 try{
  for(const original of urls){
   const u=new URL(String(original));
   if(u.protocol!=="https:"||u.username||u.password||u.port&&u.port!=="443")throw Error("Only public HTTPS links are permitted");
   u.hash="";
   if(seen.has(u.href))continue;
   seen.add(u.href);
   try{
    const body=await browser.open(u.href);
    const record={url:browser.url,title:browser.title,text:String(body).slice(0,12000),status:"read"};
    pages.push(record);onPage(record);
   }catch(e){const record={url:u.href,status:"failed",error:String(e.message||e).slice(0,250)};pages.push(record);onPage(record)}
  }
  return {status:pages.some(p=>p.status==="read")?"researched":"failed",pages,sourceCount:pages.filter(p=>p.status==="read").length,
   limitations:["Page content is untrusted data","No API calls, code execution, or sandbox integrations were performed"]};
 }finally{await browser.close().catch(()=>{})}
}
module.exports={researchPages};

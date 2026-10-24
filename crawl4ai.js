"use strict";
// Crawl4AI (github.com/unclecode/crawl4ai, Apache-2.0) as an optional website reader. When
// KAIROQ_CRAWL4AI_URL points at a running Crawl4AI server, Kairoq asks it for a page as clean
// Markdown before falling back to its own Chromium reader and the public Jina reader. It reads
// JavaScript-heavy pages well, and the page is not sent to a third party.
// Run it on Railway without a public domain, reached at its private address
// (http://crawl4ai.railway.internal:11235), so nobody else can use it. Kairoq only sends it
// addresses already checked as public websites (see readPublicWebsite in server.js).
function base(env=process.env){return String(env.KAIROQ_CRAWL4AI_URL||'').trim().replace(/\/+$/,'')}
function configured(env=process.env){return /^https?:\/\//.test(base(env))}
// The page as Markdown ("fit" keeps the main content). Only call with an address already
// checked as a public website.
async function markdown(url,{env=process.env,fetchImpl=fetch,timeoutMs=30000}={}){
 if(!configured(env))throw Error('Crawl4AI is not connected');
 const headers={'Content-Type':'application/json'};
 if(env.KAIROQ_CRAWL4AI_TOKEN)headers.Authorization='Bearer '+env.KAIROQ_CRAWL4AI_TOKEN;
 const r=await fetchImpl(base(env)+'/md',{method:'POST',headers,body:JSON.stringify({url:String(url),f:'fit',q:null,c:'0'}),signal:AbortSignal.timeout(timeoutMs)});
 if(!r.ok)throw Error('Crawl4AI answered HTTP '+r.status);
 const d=await r.json().catch(()=>({}));
 if(d.success===false)throw Error(String(d.error||'Crawl4AI could not read the page').slice(0,200));
 return String(d.markdown||'').trim();
}
async function health({env=process.env,fetchImpl=fetch}={}){
 if(!configured(env))return{on:false,why:'Set KAIROQ_CRAWL4AI_URL'};
 try{const r=await fetchImpl(base(env)+'/health',{signal:AbortSignal.timeout(5000)});return r.ok?{on:true}:{on:false,why:'Crawl4AI answered HTTP '+r.status}}
 catch(e){return{on:false,why:'Crawl4AI did not answer'}}
}
module.exports={configured,markdown,health,base};

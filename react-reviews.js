"use strict";
// "What its users hate": real public reviews of the reference product, grouped into themes with
// counts and verbatim, linked quotes, then turned into fixes the owner can add to their version
// and one line on how to sell it. Method and themes from the Replica skill pack
// (github.com/Jakeschincariol/replica-skill, MIT; vendor/replica).
// Rules, as in Replica: nothing is invented (every quote is a substring of a real review, with
// its link; counts are what was found), and reviews come only from official public feeds:
// Apple's App Store search API and customer-reviews feed, and the Hacker News search API.
const fs=require('fs'),path=require('path');
const RAW=JSON.parse(fs.readFileSync(path.join(__dirname,'vendor','replica','themes.json'),'utf8'));
// Python's \b and (?i) carry over; patterns are matched case-insensitively.
const THEMES=RAW.themes.map(t=>({...t,res:t.patterns.map(p=>new RegExp(p,'i'))}));
const REQUESTS=RAW.request_patterns.map(p=>new RegExp(p,'i'));
const UA='Kairoq-Reviews/1.0 (+https://kairoq.com)';
const SENTENCE=/(?<=[.!?])\s+|\n+/;

function clean(s,n=4000){return String(s||'').replace(/<[^>]+>/g,' ').replace(/&#x27;|&#39;/g,"'").replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&gt;/g,'>').replace(/&lt;/g,'<').replace(/&#x2F;/g,'/').replace(/\s+/g,' ').trim().slice(0,n)}
async function getJson(url,fetchImpl){const r=await fetchImpl(url,{headers:{'User-Agent':UA,Accept:'application/json'},signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('HTTP '+r.status+' from '+new URL(url).hostname);return r.json()}

// ---------- collecting ----------
// The App Store id: from a link on the reference site, else Apple's search API by name.
async function appStoreId({name,appLinks=[]},fetchImpl){
 for(const l of appLinks){const m=/apps\.apple\.com\/.*\/id(\d{5,12})/.exec(l);if(m)return{id:m[1],how:'link on the site'}}
 if(!name)return null;
 const d=await getJson('https://itunes.apple.com/search?entity=software&limit=5&term='+encodeURIComponent(name),fetchImpl);
 const want=name.toLowerCase().replace(/[^a-z0-9]/g,'');
 const hit=(d.results||[]).find(r=>{const t=String(r.trackName||'').toLowerCase().replace(/[^a-z0-9]/g,''),s=String(r.sellerName||'').toLowerCase().replace(/[^a-z0-9]/g,'');return want.length>=3&&(t.startsWith(want)||s.startsWith(want))});
 return hit?{id:String(hit.trackId),how:'App Store search: '+String(hit.trackName).slice(0,60)}:null;
}
async function appStore(id,fetchImpl,{pages=3,country='us'}={}){
 const out=[];
 for(let p=1;p<=pages;p++){
  let d;try{d=await getJson('https://itunes.apple.com/'+country+'/rss/customerreviews/page='+p+'/id='+id+'/sortBy=mostRecent/json',fetchImpl)}catch(e){if(p===1)throw e;break}
  const entries=[].concat((d.feed&&d.feed.entry)||[]).filter(e=>e&&e['im:rating']);
  if(!entries.length)break;
  for(const e of entries){const text=clean([e.title&&e.title.label,e.content&&e.content.label].filter(Boolean).join('. '));if(!text)continue;
   out.push({source:'app-store',url:'https://apps.apple.com/'+country+'/app/id'+id+'?see-all=reviews#'+encodeURIComponent(String(e.id&&e.id.label||out.length)),date:String(e.updated&&e.updated.label||'').slice(0,10)||null,rating:Number(e['im:rating'].label)||null,text})}
 }
 return out;
}
async function hackerNews(name,fetchImpl){
 const out=[],seen=new Set(),word=new RegExp('\\b'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i');
 for(const q of [name,name+' alternative']){
  const d=await getJson('https://hn.algolia.com/api/v1/search?tags=comment&hitsPerPage=50&query='+encodeURIComponent(q),fetchImpl);
  for(const h of d.hits||[]){const text=clean(h.comment_text);if(!text||seen.has(h.objectID)||!word.test(text))continue;seen.add(h.objectID);
   out.push({source:'hacker-news',url:'https://news.ycombinator.com/item?id='+h.objectID,date:String(h.created_at||'').slice(0,10)||null,rating:null,text})}
 }
 return out;
}
async function collect({name,appLinks=[]},{fetchImpl=fetch}={}){
 const rows=[],sources=[];
 try{const app=await appStoreId({name,appLinks},fetchImpl);if(app){const r=await appStore(app.id,fetchImpl);rows.push(...r);sources.push({source:'App Store',count:r.length,note:app.how})}else sources.push({source:'App Store',count:0,note:'no app found for "'+name+'"'})}
 catch(e){sources.push({source:'App Store',count:0,note:'could not be read ('+String(e.message||e).slice(0,80)+')'})}
 try{const r=await hackerNews(name,fetchImpl);rows.push(...r);sources.push({source:'Hacker News',count:r.length})}
 catch(e){sources.push({source:'Hacker News',count:0,note:'could not be read ('+String(e.message||e).slice(0,80)+')'})}
 return{rows:rows.filter(r=>r.url&&r.text),sources};
}

// ---------- ranking (reviews.py) ----------
function weight(r,today,months=18){
 let w=r.rating==null?0.6:(6-r.rating)/5;
 if(r.date){const d=new Date(r.date);if(!isNaN(d)&&(today-d)/86400000>months*30.4)w*=0.5}
 return w;
}
// The first sentence of the review that matches, verbatim (trimmed around the match when long).
function snippet(text,re,limit=220){
 for(const sent of text.split(SENTENCE)){
  if(!re.test(sent))continue;let s=sent.trim();
  if(s.length>limit){const m=re.exec(s),start=Math.max(0,(m?m.index:0)-Math.floor(limit/2));s=(start>0?'...':'')+s.slice(start,start+limit).trim()+'...'}
  return s;
 }
 const s=text.trim();return s.length<=limit?s:s.slice(0,limit).trimEnd()+'...';
}
function analyse(rows,{today=new Date(),months=18}={}){
 const res=new Map(THEMES.map(t=>[t.id,{id:t.id,label:t.label,kind:t.kind,score:0,items:[]}])),requests=[];
 for(const r of rows){
  const w=weight(r,today,months);
  for(const t of THEMES){const hit=t.res.find(re=>re.test(r.text));if(!hit)continue;const x=res.get(t.id);x.score+=w;x.items.push({r,quote:snippet(r.text,hit)})}
  const req=REQUESTS.find(re=>re.test(r.text));if(req)requests.push({quote:snippet(r.text,req),url:r.url,source:r.source,rating:r.rating});
 }
 const total=rows.length||1;
 const themes=[...res.values()].filter(x=>x.items.length).map(x=>{
  const rated=x.items.map(i=>i.r.rating).filter(v=>v!=null),sources=[...new Set(x.items.map(i=>i.r.source))].sort();
  x.items.sort((a,b)=>((a.r.rating??3)-(b.r.rating??3))||(a.quote.length-b.quote.length));
  return{id:x.id,label:x.label,kind:x.kind,score:Math.round(x.score*100)/100,count:x.items.length,share_pct:Math.round(1000*x.items.length/total)/10,
   avg_rating:rated.length?Math.round(100*rated.reduce((a,b)=>a+b,0)/rated.length)/100:null,sources,thin:x.items.length<3||sources.length<2,
   quotes:x.items.slice(0,3).map(i=>({quote:i.quote,url:i.r.url,source:i.r.source,rating:i.r.rating}))};
 }).sort((a,b)=>(b.score-a.score)||(b.count-a.count)||a.id.localeCompare(b.id));
 return{reviews:rows.length,sources:[...new Set(rows.map(r=>r.source))].sort(),rated:rows.filter(r=>r.rating!=null).length,themes,requests:requests.slice(0,8)};
}

// ---------- fixes and angle ----------
const FIX_PROMPT=`You help someone build their own version of an existing product that beats it. Below are themes from REAL public reviews of the existing product, with counts and verbatim quotes. Propose fixes their version can ship, and one positioning line.
Rules: only propose a fix for a theme listed below (use its id). Never invent reviews, numbers or quotes. A fix must be something an app can actually do (a feature, a setting, a pricing choice, clearer screens). Skip themes that are about the other company only (its support team, its outages) unless the fix is a product feature. Prefer themes that are not thin.
Return ONLY JSON: {"angle":"one sentence: who it is for and which complaint it solves","fixes":[{"theme":"theme id","title":"short fix, plain words","feature":{"name":"feature name","description":"what to build, one or two sentences"}}]} with at most 5 fixes.`;
async function suggest(result,{callModel,product,summary,signal}){
 const themes=result.themes.slice(0,8);if(!themes.length)return{angle:'',fixes:[]};
 const text='Product: '+product+(summary?'\nWhat it does: '+summary:'')+'\nReviews read: '+result.reviews+' from '+result.sources.join(', ')+'\n\n'+themes.map(t=>'['+t.id+'] '+t.label+' ('+t.kind+'): '+t.count+' reviews'+(t.thin?', thin':'')+(t.avg_rating!=null?', average '+t.avg_rating+' stars':'')+'\n'+t.quotes.map(q=>'  - "'+q.quote+'"').join('\n')).join('\n')+(result.requests.length?'\n\nRequests users made:\n'+result.requests.slice(0,6).map(q=>'  - "'+q.quote+'"').join('\n'):'');
 const out=await callModel({maxOutputTokens:1200,signal,messages:[{role:'system',content:FIX_PROMPT},{role:'user',content:text}]});
 const ids=new Set(themes.map(t=>t.id));
 const fixes=(Array.isArray(out&&out.fixes)?out.fixes:[]).filter(f=>f&&ids.has(f.theme)&&f.feature&&f.feature.name).slice(0,5).map(f=>{const t=themes.find(x=>x.id===f.theme);
  return{theme:f.theme,theme_label:t.label,count:t.count,title:String(f.title||f.feature.name).slice(0,120),feature:{name:String(f.feature.name).slice(0,80),description:String(f.feature.description||'').slice(0,400)}}});
 return{angle:fixes.length?String(out.angle||'').slice(0,240):'',fixes};
}

// The whole step: collect, rank, suggest. Never fails the analysis: problems are reported.
async function study({name,appLinks,summary},{callModel,fetchImpl=fetch,signal}={}){
 const product=String(name||'').trim().slice(0,80);
 if(product.length<2)return{name:product,reviews:0,sources:[],themes:[],requests:[],fixes:[],angle:'',note:'No product name to search reviews for.'};
 const {rows,sources}=await collect({name:product,appLinks},{fetchImpl});
 const result=analyse(rows);
 let fixes={angle:'',fixes:[]};
 if(result.themes.length&&callModel)try{fixes=await suggest(result,{callModel,product,summary,signal})}catch(e){if(signal&&signal.aborted)throw e}
 return{name:product,collected_at:new Date().toISOString(),...result,sources_tried:sources,themes:result.themes.slice(0,8),...fixes};
}
// The product name to search for: the site's own name, else the page title's first part.
function productName(analysis){
 const p=(analysis&&analysis.pages||[])[0]||{};
 const n=p.site_name||String(p.title||'').split(/\s[|\-–—:·]\s/)[0]||'';
 return n.trim().slice(0,60);
}
module.exports={THEMES,collect,analyse,snippet,weight,suggest,study,productName,appStoreId};

"use strict";
// Quick checks for web watches. The first time a watch runs, the browser agent finds the
// answer in a real browser. While it browses, the page's own data requests are recorded; this
// module finds the request whose response holds the facts in the answer (prices, dates,
// counts) and remembers where they sit: a JSON path, or the text just before them on an HTML
// page. Later checks fetch that one public URL directly, with no browser and no AI, and only
// when a value moved does the AI write the new answer. When the site changes and the recipe
// no longer fits, the watch goes back to the browser agent, which learns it again.
//
// The approach (learn a site's request once, replay it cheaply, re-learn when it breaks) comes
// from api-anything by Tianjun Zheng (MIT); see THIRD_PARTY_NOTICES.md. This is a smaller,
// read-only version: public https GET requests only, no cookies, no logins, no request bodies.
const MAX_FACTS=12,MAX_SLOTS=12,MAX_BYTES=2*1024*1024,ANCHOR=28;

function clip(v,n){return String(v??'').replace(/\s+/g,' ').trim().slice(0,n)}
// "€1,299.50", "1.299,50", "12:30", "3 rooms" → numbers. Separators are read as thousands when
// followed by exactly three digits, otherwise as a decimal point.
function num(token){
 let t=String(token).replace(/[^\d.,]/g,'');if(!/\d/.test(t))return null;
 t=t.replace(/[.,](?=\d{3}(?:[.,]|$))/g,'').replace(',','.');
 const n=Number(t);return Number.isFinite(n)?n:null;
}
const NUM=/\d[\d.,]*\d|\d/g;
function numbers(text){return(String(text).match(NUM)||[]).map(num).filter(n=>n!==null)}
// The facts worth watching in an answer: numbers that are not trivially common (0, 1, 2).
function facts(answer){
 const out=[];
 for(const n of numbers(answer)){if(n<=2&&Number.isInteger(n))continue;if(!out.includes(n))out.push(n);if(out.length>=MAX_FACTS)break}
 return out;
}

// ---------- reading a response ----------
function kindOf(type,body){
 const t=String(type||'').toLowerCase(),b=String(body||'').trimStart();
 if(t.includes('json')||((b.startsWith('{')||b.startsWith('['))&&!t.includes('html')))return'json';
 if(t.includes('html')||/^<(!doctype|html)/i.test(b))return'html';
 return t.startsWith('text/')?'text':null;
}
function text(body,kind){
 if(kind!=='html')return clip(body,400000);
 return clip(String(body).replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1>/gi,' ').replace(/<!--[\s\S]*?-->/g,' ').replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d|td|th|section|article)>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&euro;/g,'€').replace(/&pound;/g,'£').replace(/&#(\d+);/g,(_,d)=>String.fromCharCode(Number(d))),400000);
}
function leaves(v,path=[],out=[],depth=0){
 if(out.length>20000||depth>40)return out;
 if(Array.isArray(v))v.forEach((x,i)=>leaves(x,[...path,i],out,depth+1));
 else if(v&&typeof v==='object')for(const [k,x] of Object.entries(v))leaves(x,[...path,k],out,depth+1);
 else if(typeof v==='number'||typeof v==='string')out.push({path,value:v});
 return out;
}
function at(v,path){for(const k of path){if(v===null||typeof v!=='object')return undefined;v=v[k]}return v}
function leafNumbers(v){return typeof v==='number'?[v]:numbers(v)}

// The places in one response where the answer's facts appear.
function slotsIn(res,want){
 const kind=kindOf(res.type,res.body);if(!kind)return null;
 const slots=[],found=new Set();
 if(kind==='json'){
  let data;try{data=JSON.parse(res.body)}catch{return null}
  for(const l of leaves(data)){
   const hit=leafNumbers(l.value).find(n=>want.includes(n)&&!found.has(n));
   if(hit===undefined)continue;
   found.add(hit);slots.push({path:l.path});if(slots.length>=MAX_SLOTS)break;
  }
 }else{
  const t=text(res.body,kind);
  for(const m of t.matchAll(NUM)){
   const n=num(m[0]);if(n===null||!want.includes(n)||found.has(n))continue;
   let anchor=t.slice(Math.max(0,m.index-ANCHOR),m.index);
   // Other numbers before it may change on their own, so the anchor starts after them.
   const cut=anchor.search(/\d[^\d]*$/);if(cut>=0&&anchor.length-cut-1>=6)anchor=anchor.slice(cut+1);
   // The words before a value must find it again, and only it.
   if(anchor.trim().length<4||t.split(anchor).length!==2)continue;
   found.add(n);slots.push({anchor});if(slots.length>=MAX_SLOTS)break;
  }
 }
 return{kind,slots,found:found.size};
}
// The values at a recipe's slots in a fresh response. A slot that is gone means the recipe
// no longer fits the site.
function read(recipe,body,type){
 const kind=kindOf(type,body);if(kind!==recipe.kind)throw Object.assign(Error('The page changed shape'),{broken:true});
 if(kind==='json'){
  let data;try{data=JSON.parse(body)}catch{throw Object.assign(Error('The data is no longer JSON'),{broken:true})}
  return recipe.slots.map(s=>{const v=at(data,s.path);if(v===undefined||v===null||typeof v==='object')throw Object.assign(Error('A value moved'),{broken:true});return clip(v,200)});
 }
 const t=text(body,kind);
 return recipe.slots.map(s=>{
  const i=t.indexOf(s.anchor);if(i<0)throw Object.assign(Error('A value moved'),{broken:true});
  const m=/^\s*[^\d\s]{0,4}\s*(\d[\d.,]*\d|\d)/.exec(t.slice(i+s.anchor.length,i+s.anchor.length+40));
  if(!m)throw Object.assign(Error('A value moved'),{broken:true});
  return m[1];
 });
}

// ---------- fetching ----------
// Public https only, checked like any site the agent visits, and again at connect time;
// redirects are followed (at most 3) and each hop is checked too. No cookies are sent.
async function get(url,{fetchImpl}={}){
 const runtime=require('./runtime-check');
 let u=await runtime.checkSite(url);
 for(let hop=0;hop<4;hop++){
  let r;
  if(fetchImpl)r=await fetchImpl(u);
  else if(/^http:\/\/127\.0\.0\.1[:/]/.test(u)){const x=await fetch(u,{redirect:'manual',signal:AbortSignal.timeout(10000)});r={status:x.status,headers:Object.fromEntries(x.headers),body:await x.text()}}
  else r=await require('./react-functions').guardedFetch({url:u,headers:{'User-Agent':'Mozilla/5.0 (compatible; KairoqWatch/1.0)','Accept':'application/json,text/html;q=0.9,*/*;q=0.5'}});
  if(r.status>=300&&r.status<400&&r.headers&&r.headers.location){u=await runtime.checkSite(new URL(r.headers.location,u).href);continue}
  if(r.status!==200)throw Object.assign(Error('The site answered '+r.status),{broken:r.status===404||r.status===410});
  if(String(r.body||'').length>MAX_BYTES)throw Object.assign(Error('The response is too large'),{broken:true});
  return{body:String(r.body||''),type:(r.headers&&(r.headers['content-type']||r.headers['Content-Type']))||''};
 }
 throw Object.assign(Error('Too many redirects'),{broken:true});
}

// ---------- learning ----------
// responses: [{url,method,status,type,body}] recorded while the agent browsed.
// Returns a recipe, or null when no single public request holds the answer.
async function learn({answer,responses},opts={}){
 const want=facts(answer);if(!want.length)return null;
 const need=Math.max(1,Math.ceil(want.length/2));
 const candidates=[];
 for(const res of responses||[]){
  if(!res||res.method&&res.method!=='GET'||res.status!==200||!res.body)continue;
  let u;try{u=new URL(res.url)}catch{continue}
  if(u.protocol!=='https:'&&!/^http:\/\/127\.0\.0\.1[:/]/.test(u.href))continue;
  const s=slotsIn(res,want);if(!s||s.found<need)continue;
  candidates.push({url:u.href,...s});
 }
 // Most facts first; JSON before HTML (it changes shape less often).
 candidates.sort((a,b)=>b.found-a.found||(a.kind==='json'?-1:0)-(b.kind==='json'?-1:0));
 for(const c of candidates.slice(0,5)){
  const recipe={url:c.url,kind:c.kind,slots:c.slots,learned:new Date().toISOString()};
  // Only keep it when a plain request, with no browser and no cookies, gives the same values.
  try{const r=await get(recipe.url,opts);recipe.values=read(recipe,r.body,r.type);}catch{continue}
  const seen=recipe.values.map(num);
  if(seen.filter(n=>want.includes(n)).length<need)continue;
  return recipe;
 }
 return null;
}

// ---------- checking ----------
// {values, moved:[{before,after}]}; throws with .broken when the recipe no longer fits.
async function check(recipe,opts={}){
 const r=await get(recipe.url,opts);
 const values=read(recipe,r.body,r.type);
 const moved=values.map((v,i)=>({before:(recipe.values||[])[i],after:v})).filter(x=>x.before!==x.after);
 return{values,moved};
}
const UPDATE=`A website watch checked a page again for a small-business owner. Some values on it changed. Write the new answer to the owner's question, in the same style and length as the previous answer, with the new values. Use only the facts given.
Respond with ONLY JSON: {"answer":"the new answer","summary":"one sentence: what changed (old → new)"}`;
// The new answer after values moved: the AI rewrites the previous answer with the new values.
async function update({task,previous,moved},{callModel}){
 const changes=moved.map(m=>(m.before??'(none)')+' → '+m.after).join('; ');
 try{
  const v=await callModel({messages:[{role:'system',content:UPDATE},{role:'user',content:'Question: '+clip(task,600)+'\n\nPrevious answer:\n'+clip(previous,2500)+'\n\nValues that changed on the page (old → new): '+changes}],temperature:0,maxOutputTokens:600},c=>{const t=String(c).trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'');const a=t.indexOf('{'),b=t.lastIndexOf('}');return JSON.parse(t.slice(a,b+1))});
  if(v&&v.answer)return{answer:clip(v.answer,4000),summary:clip(v.summary||changes,400)};
 }catch{}
 return{answer:clip(previous,3800)+'\n\nUpdated values: '+changes,summary:'Changed: '+changes};
}
module.exports={learn,check,update,facts,num,read,slotsIn,kindOf};

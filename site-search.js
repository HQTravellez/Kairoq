"use strict";
// Found on Google and in AI answers. Kairoq apps draw their pages in the visitor's browser, so
// crawlers that do not run JavaScript (most AI assistants' crawlers) see an empty page. When an
// app is published, Kairoq opens it in Chromium as an anonymous visitor, follows its own links
// and keeps what each page shows. The published site then sends that content inside the page
// (React replaces it when it starts), lists every page in the sitemap, describes the business
// in structured data (schema.org) and serves /llms.txt, a plain summary for AI assistants.
const fs=require('fs'),path=require('path');
const builder=require('./react-builder');

const MAX_PAGES=15,MAX_HTML=150000;
function clip(v,n){return String(v??'').replace(/\s+/g,' ').trim().slice(0,n)}
function lines(v,n){return String(v??'').replace(/\r/g,'').trim().slice(0,n)}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function file(id,version){return path.join(builder.projectDir(id),'search-v'+Number(version)+'.json')}
function read(meta){if(!meta.published)return null;try{return JSON.parse(fs.readFileSync(file(meta.id,meta.published.version),'utf8'))}catch{return null}}
// "/about/", "/about/index.html" and "/about" are the same page.
function normalPath(p){let s='/'+String(p||'').replace(/^\/+/,'').replace(/[?#].*$/,'').replace(/index\.html$/,'').replace(/\/+$/,'');return s==='/'?s:s.replace(/\/+$/,'')}
// What a page showed, made safe to send again: no scripts, no inline event handlers.
function cleanHtml(html){
 return String(html||'').replace(/<script\b[\s\S]*?<\/script>/gi,'').replace(/<\/?(iframe|object|embed|frame|frameset|base|meta|link)\b[^>]*>/gi,'')
  .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,'').replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi,'$1="#"').slice(0,MAX_HTML);
}

// Opens the published site (base: its local address) and keeps up to MAX_PAGES pages.
async function snapshot(id,{renderSite,base}){
 const meta=builder.loadMeta(id);
 if(!meta.published||!renderSite)return null;
 const pages=await renderSite(base,{max:MAX_PAGES});
 if(!Array.isArray(pages))return null;
 const out={version:meta.published.version,at:new Date().toISOString(),pages:pages.map(p=>({path:normalPath(p.path),title:clip(p.title,120),h1:clip(p.h1,160),description:clip(p.description,300),text:clip(p.text,4000),html:cleanHtml(p.html)})).filter((p,i,a)=>a.findIndex(x=>x.path===p.path)===i)};
 const f=file(id,out.version),tmp=f+'.'+process.pid+'.tmp';
 fs.writeFileSync(tmp,JSON.stringify(out));fs.renameSync(tmp,f);
 // Older versions' snapshots go.
 for(const n of fs.readdirSync(builder.projectDir(id)))if(/^search-v\d+\.json$/.test(n)&&n!==path.basename(f))fs.rmSync(path.join(builder.projectDir(id),n),{force:true});
 return out;
}

// The page as the published site sends it: the app's content inside #root, for crawlers.
function withContent(html,meta,rel){
 const snap=read(meta);if(!snap)return html;
 const page=snap.pages.find(p=>p.path===normalPath(rel));
 if(!page||!page.html)return html;
 return html.replace('<div id="root"></div>',()=>'<div id="root">'+page.html+'</div>');
}
function pages(meta){const s=read(meta);return s?s.pages.map(p=>p.path):[]}
// The live pages' text, for writing about the business (suggestions, launch kit).
function pageText(meta,max=9000){const s=read(meta);return s&&s.pages.length?s.pages.map(p=>'## '+(p.h1||p.title||p.path)+'\n'+p.text).join('\n\n').slice(0,max):''}

// ---------- the business, described for search engines and AI assistants ----------
const TYPES=['LocalBusiness','Restaurant','CafeOrCoffeeShop','Bakery','Hotel','BedAndBreakfast','LodgingBusiness','TouristTrip','TravelAgency','HealthAndBeautySalon','HairSalon','DaySpa','SportsActivityLocation','ExerciseGym','MedicalBusiness','Physiotherapy','Dentist','Store','ProfessionalService','RealEstateAgent','EducationalOrganization','Event','SoftwareApplication','Organization'];
function cleanBusiness(b){
 b=b&&typeof b==='object'?b:{};
 const out={type:TYPES.includes(b.type)?b.type:'LocalBusiness',name:clip(b.name,100),description:clip(b.description,400),street:clip(b.street,120),city:clip(b.city,80),postal:clip(b.postal,20),country:clip(b.country,60),phone:clip(b.phone,40),email:clip(b.email,120),hours:(Array.isArray(b.hours)?b.hours:String(b.hours||'').split('\n')).map(h=>clip(h,60)).filter(Boolean).slice(0,10),price_range:clip(b.price_range,20)};
 if(out.email&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(out.email))out.email='';
 return out;
}
function cleanFaq(list){return(Array.isArray(list)?list:[]).map(x=>({q:clip(x&&x.q,200),a:clip(x&&x.a,800)})).filter(x=>x.q&&x.a).slice(0,12)}
// schema.org JSON-LD for the head of the published page.
function jsonLd(meta,base){
 const b=meta.business,faq=meta.faq||[],out=[];
 if(b&&b.name){
  const org={'@context':'https://schema.org','@type':b.type||'LocalBusiness',name:b.name,url:base};
  if(b.description)org.description=b.description;
  if(b.phone)org.telephone=b.phone;
  if(b.email)org.email=b.email;
  if(b.street||b.city)org.address={'@type':'PostalAddress',...(b.street?{streetAddress:b.street}:{}),...(b.city?{addressLocality:b.city}:{}),...(b.postal?{postalCode:b.postal}:{}),...(b.country?{addressCountry:b.country}:{})};
  if(b.hours&&b.hours.length)org.openingHours=b.hours;
  if(b.price_range)org.priceRange=b.price_range;
  out.push(org);
 }
 if(faq.length)out.push({'@context':'https://schema.org','@type':'FAQPage',mainEntity:faq.map(f=>({'@type':'Question',name:f.q,acceptedAnswer:{'@type':'Answer',text:f.a}}))});
 // "</" cannot end the script tag early.
 return out.map(o=>'<script type="application/ld+json">'+JSON.stringify(o).replace(/</g,'\\u003c')+'</script>');
}
// /llms.txt (llmstxt.org): what the site is, its pages and its answers, in plain Markdown.
function llmsTxt(meta,base){
 const b=meta.business||{},snap=read(meta),seo=meta.seo||{};
 const first=snap&&snap.pages[0];
 const out=['# '+(b.name||seo.title||meta.name),'','> '+(b.description||seo.description||(first&&first.text.slice(0,240))||'')];
 const facts=[b.street||b.city?'Address: '+[b.street,b.postal,b.city,b.country].filter(Boolean).join(', '):'',b.phone?'Phone: '+b.phone:'',b.email?'Email: '+b.email:'',b.hours&&b.hours.length?'Opening hours: '+b.hours.join('; '):'',b.price_range?'Prices: '+b.price_range:''].filter(Boolean);
 if(facts.length)out.push('',...facts.map(f=>'- '+f));
 if(snap&&snap.pages.length){out.push('','## Pages','');for(const p of snap.pages)out.push('- ['+(p.h1||p.title||p.path)+']('+base+p.path.replace(/^\//,'')+'): '+p.text.slice(0,200))}
 if(meta.faq&&meta.faq.length){out.push('','## Questions','');for(const f of meta.faq)out.push('### '+f.q,'',f.a,'')}
 return out.join('\n').trim()+'\n';
}

// ---------- the owner's checklist ----------
function status(meta){
 const snap=read(meta),b=meta.business||{};
 return{published:Boolean(meta.published),pages:snap?snap.pages.map(p=>({path:p.path,title:p.h1||p.title})):[],snapshot_at:snap?snap.at:null,
  items:[
   {id:'pages',ok:Boolean(snap&&snap.pages.length),label:'Search engines and AI assistants can read your pages'},
   {id:'sitemap',ok:Boolean(meta.published),label:'Every page is listed in the sitemap'},
   {id:'title',ok:Boolean(meta.seo&&meta.seo.title&&meta.seo.description),label:'Title and description for search results'},
   {id:'business',ok:Boolean(b.name&&(b.city||b.street||b.phone)),label:'Business details (address, phone, hours) for Google and maps'},
   {id:'faq',ok:Boolean(meta.faq&&meta.faq.length>=3),label:'Answers to common questions, for AI assistants'},
   {id:'llms',ok:Boolean(meta.published&&(snap||b.name)),label:'A summary for AI assistants (llms.txt)'},
  ]};
}

const SUGGEST=`You prepare a small business website to be found on Google and quoted by AI assistants (ChatGPT, Perplexity, Gemini).
You get the text of the site's pages. Return the business details and 5 to 8 questions customers ask, with short answers.
Use ONLY facts written in the text. Never invent an address, phone number, opening hours, prices or claims: leave a field empty when the text does not say it.
"type" is one schema.org type: ${TYPES.join(', ')}.
"hours" is a list like ["Mo-Fr 08:00-18:00","Sa 09:00-13:00"]. "price_range" is like "€€" or "€10–€40".
Answers are 1 to 3 sentences, in the language of the site.
Respond with ONLY JSON: {"seo":{"title":"…(max 60 characters)","description":"…(max 155 characters)"},"business":{"type":"","name":"","description":"","street":"","city":"","postal":"","country":"","phone":"","email":"","hours":[],"price_range":""},"faq":[{"q":"","a":""}]}`;
// Suggestions from the site's own text; the owner reviews them before they are saved.
async function suggest(meta,{callModel,tier='standard',signal}){
 const text=pageText(meta);
 if(!text)throw Object.assign(Error('Publish the app first: the suggestions come from what the live pages show.'),{status:409});
 const v=await callModel({messages:[{role:'system',content:SUGGEST},{role:'user',content:'Site name: '+meta.name+'\n\n'+text}],tier,temperature:0.2,maxOutputTokens:1800,signal,purpose:'seo'},c=>{const t=String(c).trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'');const a=t.indexOf('{'),b=t.lastIndexOf('}');return JSON.parse(t.slice(a,b+1))});
 return{seo:{title:clip(v&&v.seo&&v.seo.title,70),description:clip(v&&v.seo&&v.seo.description,200)},business:cleanBusiness(v&&v.business),faq:cleanFaq(v&&v.faq)};
}
function save(id,{business,faq}){
 const meta=builder.loadMeta(id);
 if(business!==undefined)meta.business=cleanBusiness(business);
 if(faq!==undefined)meta.faq=cleanFaq(faq);
 builder.saveMeta(meta);
 return meta;
}
module.exports={snapshot,withContent,pages,pageText,jsonLd,llmsTxt,status,suggest,save,cleanBusiness,cleanFaq,cleanHtml,normalPath,TYPES};

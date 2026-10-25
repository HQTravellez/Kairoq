"use strict";
// Build from a reference: studies a public website, a GitHub repository, screenshots or an
// uploaded JavaScript app, and turns what it finds into a feature inventory and build plan.
// Kairoq then builds its own implementation from that plan: its own name, text, images and
// code (see PLAN_PROMPT). The analysis reads only what any visitor's browser receives, follows
// robots.txt, and never logs in, submits forms or reads private data.
const dns=require('dns').promises,net=require('net'),fs=require('fs'),os=require('os'),path=require('path'),zlib=require('zlib');
const {spawn}=require('child_process');

const MAX_PAGES=6,MAX_API=40,MAX_REPO_TEXT=60000;
const UA='Mozilla/5.0 (compatible; KairoqReference/1.0; +https://kairoq.com/reference)';
function fail(status,message){return Object.assign(Error(message),{status})}
function allowPrivate(){return process.env.KAIROQ_REFERENCE_ALLOW_PRIVATE==='1'}

// ---------- Safety: public hosts only ----------
// The same address rules as server-function fetch: private, loopback, link-local and metadata
// ranges, including IPv4 written inside IPv6 ([::ffff:7f00:1]).
function privateIp(ip){return require('./react-functions').privateAddress(String(ip).toLowerCase())}
// Resolves a host name and reports whether any of its addresses is private. A name that does
// not resolve is left to fail on its own.
const dnsCache=new Map();
async function resolvesPrivate(host){
 const h=String(host||'').replace(/^\[|\]$/g,'').toLowerCase();
 if(allowPrivate())return false;
 if(blockedHost(h))return true;
 if(net.isIP(h))return false;
 if(dnsCache.has(h))return dnsCache.get(h);
 let bad=false;
 try{const list=await require('dns').promises.lookup(h,{all:true});bad=list.some(a=>privateIp(a.address))}catch{}
 if(dnsCache.size>500)dnsCache.clear();
 dnsCache.set(h,bad);return bad;
}
// fetch that checks every redirect hop, so a public URL cannot bounce the server to an internal one.
async function publicFetch(url,opts,fetchImpl=fetch){
 let next=String(url);
 for(let hop=0;hop<4;hop++){
  const u=new URL(next);
  if(!/^https?:$/.test(u.protocol)||await resolvesPrivate(u.hostname))throw fail(400,'Blocked address');
  const r=await fetchImpl(u.href,{...opts,redirect:'manual'});
  const loc=r.status>=300&&r.status<400&&r.headers&&r.headers.get&&r.headers.get('location');
  if(!loc)return r;
  next=new URL(loc,u).href;
 }
 throw fail(400,'Too many redirects');
}
function blockedHost(host){
 const h=String(host||'').replace(/^\[|\]$/g,'').toLowerCase();
 if(allowPrivate())return false;
 if(!h||h==='localhost'||/\.(localhost|internal|local|lan|home)$/.test(h))return true;
 if(net.isIP(h))return privateIp(h);
 return!h.includes('.');
}
async function safeUrl(raw){
 let text=String(raw||'').trim();
 if(text&&!/^[a-z]+:\/\//i.test(text))text='https://'+text;
 let u;try{u=new URL(text)}catch{throw fail(400,'Enter a website address, for example https://example.com')}
 if(!/^https?:$/.test(u.protocol))throw fail(400,'Only http and https websites can be analyzed');
 if(u.username||u.password)throw fail(400,'Remove the user name and password from the address');
 if(blockedHost(u.hostname))throw fail(400,'Only public websites can be analyzed');
 if(!allowPrivate()&&!net.isIP(u.hostname)){
  let found;try{found=await dns.lookup(u.hostname,{all:true})}catch{throw fail(400,'That website could not be found')}
  if(!found.length||found.some(a=>privateIp(a.address)))throw fail(400,'Only public websites can be analyzed');
 }
 u.hash=u.hash.startsWith('#/')?u.hash:'';
 return u;
}

// ---------- robots.txt ----------
function parseRobots(text){
 const groups=[];let current=null,lastWasAgent=false;
 for(const line of String(text||'').split(/\r?\n/)){
  const m=/^\s*([a-z-]+)\s*:\s*(.*?)\s*(#.*)?$/i.exec(line);if(!m)continue;
  const key=m[1].toLowerCase(),value=m[2];
  if(key==='user-agent'){if(!lastWasAgent){current={agents:[],rules:[]};groups.push(current)}current.agents.push(value.toLowerCase());lastWasAgent=true;continue}
  lastWasAgent=false;
  if(current&&(key==='disallow'||key==='allow'))current.rules.push({allow:key==='allow',path:value});
 }
 const mine=groups.filter(g=>g.agents.some(a=>a.includes('kairoq')));
 return(mine.length?mine:groups.filter(g=>g.agents.includes('*'))).flatMap(g=>g.rules).filter(r=>r.path);
}
function robotsAllows(rules,pathname){
 let best=null;
 for(const r of rules){
  const pattern='^'+r.path.replace(/[.+?^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'.*').replace(/\\\$$/,'$');
  if(new RegExp(pattern).test(pathname)&&(!best||r.path.length>best.path.length||(r.path.length===best.path.length&&r.allow)))best=r;
 }
 return!best||best.allow;
}
async function robots(origin,{fetchImpl=fetch}={}){
 try{const r=await publicFetch(origin+'/robots.txt',{headers:{'User-Agent':UA},signal:AbortSignal.timeout(6000)},fetchImpl);if(!r.ok)return[];return parseRobots((await r.text()).slice(0,200000))}catch{return[]}
}

// ---------- Website analysis (a real browser) ----------
const INTEGRATIONS=[[/js\.stripe\.com|checkout\.stripe\.com/,'Stripe payments'],[/paypal\.com|paypalobjects/,'PayPal payments'],[/maps\.googleapis\.com|google\.com\/maps|maps\.gstatic/,'Google Maps'],[/mapbox/,'Mapbox maps'],[/googletagmanager|google-analytics|gtag/,'Google Analytics'],[/connect\.facebook\.net/,'Meta pixel'],[/intercom/,'Intercom chat'],[/crisp\.chat|tawk\.to|zendesk|zdassets|livechat/,'Live chat'],[/youtube\.com|youtube-nocookie|ytimg/,'YouTube video'],[/vimeo/,'Vimeo video'],[/calendly/,'Calendly scheduling'],[/recaptcha|hcaptcha|turnstile/,'Spam protection (captcha)'],[/cloudinary|imgix/,'Image CDN'],[/sentry/,'Error monitoring'],[/hotjar|clarity\.ms|fullstory/,'Session analytics'],[/segment\.(com|io)|mixpanel|amplitude|posthog/,'Product analytics'],[/typeform|tally\.so|jotform/,'Embedded forms'],[/mailchimp|klaviyo|convertkit/,'Email marketing'],[/hubspot|hs-scripts/,'HubSpot CRM'],[/firebase|firebaseio/,'Firebase'],[/supabase\.co/,'Supabase'],[/auth0|clerk\.|stytch/,'Hosted sign-in'],[/shopify/,'Shopify store'],[/algolia/,'Search (Algolia)'],[/booking\.com|hostaway|guesty|lodgify|cloudbeds|siteminder/,'Booking engine'],[/openai|anthropic|openrouter/,'AI features']];
function integrations(urls){const out=new Set();for(const u of urls)for(const [re,name] of INTEGRATIONS)if(re.test(u))out.add(name);return[...out]}
function rgbHex(c){const m=/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(String(c||''));if(!m||(m[4]!==undefined&&Number(m[4])<0.5))return null;return'#'+[m[1],m[2],m[3]].map(v=>Number(v).toString(16).padStart(2,'0')).join('')}
// Runs inside the page: structure, controls, forms and computed styles of what is visible.
function pageFacts(){
 const vis=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&s.opacity!=='0'};
 const t=(e,n=120)=>String(e&&(e.innerText||e.textContent)||'').replace(/\s+/g,' ').trim().slice(0,n);
 const uniq=(a,n)=>[...new Set(a.filter(Boolean))].slice(0,n);
 const labelFor=el=>{if(el.id){const l=document.querySelector('label[for="'+CSS.escape(el.id)+'"]');if(l)return t(l,60)}const p=el.closest('label');if(p)return t(p,60);return el.getAttribute('aria-label')||el.placeholder||el.name||''};
 const field=i=>({type:i.tagName==='INPUT'?(i.type||'text'):i.tagName.toLowerCase(),label:labelFor(i).slice(0,60),required:Boolean(i.required)});
 const links=[...document.querySelectorAll('a[href]')].filter(vis).slice(0,300).map(a=>({text:(t(a,60)||a.getAttribute('aria-label')||'').slice(0,60),href:a.href,nav:Boolean(a.closest('nav,header,[role=navigation]')),footer:Boolean(a.closest('footer'))}));
 const forms=[...document.querySelectorAll('form')].filter(vis).slice(0,8).map(f=>({method:(f.getAttribute('method')||'get').toLowerCase(),fields:[...f.querySelectorAll('input,select,textarea')].filter(i=>i.type!=='hidden').slice(0,15).map(field),submit:t(f.querySelector('button,[type=submit]'),40)}));
 const loose=[...document.querySelectorAll('input,select,textarea')].filter(i=>!i.closest('form')&&i.type!=='hidden'&&vis(i)).slice(0,10).map(field);
 const counts={},inc=(m,k)=>{if(k)m[k]=(m[k]||0)+1};
 const colors={},bgs={},fonts={},sizes={},radii={},shadows={},maxw={};
 const els=[...document.body.querySelectorAll('*')].filter(vis).slice(0,1500);
 let animated=0,transitions=0,sticky=0;
 for(const e of els){
  const s=getComputedStyle(e);
  if(e.childNodes.length&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))inc(colors,s.color);
  if(s.backgroundColor&&!/rgba\(0, 0, 0, 0\)|transparent/.test(s.backgroundColor))inc(bgs,s.backgroundColor);
  inc(fonts,s.fontFamily.split(',')[0].replace(/["']/g,'').trim());inc(sizes,s.fontSize);
  if(s.borderRadius&&s.borderRadius!=='0px')inc(radii,s.borderRadius);
  if(s.boxShadow&&s.boxShadow!=='none')inc(shadows,s.boxShadow.slice(0,90));
  if(s.maxWidth&&s.maxWidth!=='none'&&/px$/.test(s.maxWidth)&&parseFloat(s.maxWidth)>=600)inc(maxw,s.maxWidth);
  if(s.animationName&&s.animationName!=='none')animated++;
  if(s.transitionDuration&&s.transitionDuration.split(',').some(d=>parseFloat(d)>0))transitions++;
  if(s.position==='sticky'||s.position==='fixed')sticky++;
 }
 const top=(m,n)=>Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,n).map(e=>e[0]);
 const buttonBgs={};for(const b of [...document.querySelectorAll('button,a[class*=btn],a[class*=button],[role=button]')].filter(vis).slice(0,60)){const c=getComputedStyle(b).backgroundColor;if(c&&!/rgba\(0, 0, 0, 0\)|transparent/.test(c))inc(buttonBgs,c)}
 const breakpoints=new Set();let seen=0;
 for(const sh of [...document.styleSheets]){let rules;try{rules=sh.cssRules}catch{continue}
  for(const r of [...(rules||[])]){if(++seen>8000)break;const text=r.conditionText||(r.media&&r.media.mediaText)||'';for(const m of text.matchAll(/(min|max)-width:\s*([\d.]+)(px|em|rem)/g))breakpoints.add(m[1]+' '+Math.round(parseFloat(m[2])*(m[3]==='px'?1:16))+'px')}}
 const all=t(document.body,100000);
 const words=re=>uniq([...document.querySelectorAll('a,button,[role=button]')].filter(vis).map(e=>t(e,40)).filter(x=>re.test(x)),8);
 const meta=n=>(document.querySelector('meta[name="'+n+'"],meta[property="'+n+'"]')||{}).content||'';
 return{title:document.title.slice(0,120),description:meta('description').slice(0,300),site_name:meta('og:site_name').slice(0,80),lang:document.documentElement.lang||'',
  headings:uniq([...document.querySelectorAll('h1,h2,h3')].filter(vis).map(h=>h.tagName.toLowerCase()+': '+t(h)),30),
  links,buttons:uniq([...document.querySelectorAll('button,[role=button],input[type=submit],a[class*=btn],a[class*=button]')].filter(vis).map(b=>t(b,50)||b.value||b.getAttribute('aria-label')),30),
  forms,inputs:loose,
  counts:{sections:document.querySelectorAll('main section, body > section, [class*=section]').length,images:document.images.length,videos:document.querySelectorAll('video').length,canvas:document.querySelectorAll('canvas').length,svg:document.querySelectorAll('svg').length,iframes:document.querySelectorAll('iframe').length,cards:document.querySelectorAll('[class*=card]').length,words:all.split(/\s+/).length,height:document.documentElement.scrollHeight},
  hints:{auth:words(/log ?in|sign ?in|sign ?up|register|my account|account/i),commerce:words(/cart|checkout|book|reserve|buy|order|subscribe|pricing|plans/i),search:Boolean(document.querySelector('input[type=search],[role=search],input[name*=search i],input[placeholder*=search i]')),password:Boolean(document.querySelector('input[type=password]')),language:words(/^(en|fr|es|de|it|pt|english|français|español)$/i),dark:matchMedia('(prefers-color-scheme: dark)').matches},
  motion:{animated,transitions,sticky},
  styles:{body:getComputedStyle(document.body).backgroundColor,html:getComputedStyle(document.documentElement).backgroundColor,text:top(colors,6),backgrounds:top(bgs,8),buttons:top(buttonBgs,4),fonts:top(fonts,4),sizes:top(sizes,8),radii:top(radii,4),shadows:top(shadows,3),max_width:top(maxw,2)},
  breakpoints:[...breakpoints].slice(0,12),
  scripts:[...document.querySelectorAll('script[src],iframe[src],link[rel=stylesheet][href]')].map(s=>s.src||s.href).slice(0,80),
  text:all.slice(0,1500)};
}
function phoneFacts(){
 const vis=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'};
 const menu=[...document.querySelectorAll('button,[role=button],a')].filter(vis).some(b=>/menu|navigation|☰/i.test((b.getAttribute('aria-label')||'')+' '+(b.innerText||''))||b.getAttribute('aria-expanded')!==null);
 const navLinks=[...document.querySelectorAll('nav a,header a')].filter(vis).length;
 return{overflow:document.documentElement.scrollWidth>innerWidth+2,menu_button:menu,visible_nav_links:navLinks,height:document.documentElement.scrollHeight,bottom_bar:[...document.querySelectorAll('*')].slice(0,1500).some(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.position==='fixed'&&r.bottom>=innerHeight-2&&r.height<120&&r.width>innerWidth*0.8})};
}
function pageKey(u){return u.origin+u.pathname.replace(/\/+$/,'')+(u.hash.startsWith('#/')?u.hash:'')}
async function guardContext(context){
 await context.route('**/*',r=>{
  let u;try{u=new URL(r.request().url())}catch{return r.abort()}
  if(u.protocol==='data:'||u.protocol==='blob:')return r.continue();
  if(!/^https?:$/.test(u.protocol)||blockedHost(u.hostname))return r.abort();
  // Every request the page makes (redirects, frames, images) is checked by resolved address.
  return resolvesPrivate(u.hostname).then(bad=>bad?r.abort():r.continue(),()=>r.abort());
 });
}
async function scrollThrough(page){
 for(let i=1;i<=4;i++){await page.evaluate(f=>window.scrollTo(0,document.documentElement.scrollHeight*f),i/4).catch(()=>{});await page.waitForTimeout(250)}
 await page.evaluate(()=>window.scrollTo(0,0)).catch(()=>{});await page.waitForTimeout(300);
}
async function shoot(page,width,height,maxHeight){
 const full=await page.evaluate(()=>document.documentElement.scrollHeight).catch(()=>height);
 return(await page.screenshot({type:'jpeg',quality:60,fullPage:true,clip:{x:0,y:0,width,height:Math.max(height,Math.min(full,maxHeight))}})).toString('base64');
}
async function crawlSite(raw,{maxPages=MAX_PAGES,fetchImpl=fetch,har,timeoutMs=25000,lite=false}={}){
 const runtime=require('./runtime-check');
 if(!runtime.available())throw fail(503,'Website analysis needs a browser, which is not available on this server.');
 const start=await safeUrl(raw);let rules=await robots(start.origin,{fetchImpl}),origin=start.origin;
 if(!robotsAllows(rules,start.pathname))throw fail(403,'This website asks automated tools not to read that page (robots.txt), so Kairoq will not analyze it. Try screenshots instead.');
 const b=await runtime.browser();
 const context=await b.newContext({viewport:{width:1280,height:800},userAgent:UA,deviceScaleFactor:1,...(har?{recordHar:{path:har,content:'omit'}}:{})});
 await guardContext(context);
 const pages=[],api=new Map(),shots=[],skipped=[];
 const queue=[start],seen=new Set([pageKey(start)]);
 const page=await context.newPage();
 page.on('response',async r=>{
  try{
   const type=r.request().resourceType();if(type!=='xhr'&&type!=='fetch')return;
   const u=new URL(r.url()),key=r.request().method()+' '+u.origin+u.pathname,site=new URL(origin).hostname.replace(/^www\./,'');
   if(api.has(key)||api.size>=MAX_API)return;
   const entry={method:r.request().method(),url:u.origin+u.pathname,query:[...u.searchParams.keys()].slice(0,10),status:r.status(),type:(r.headers()['content-type']||'').split(';')[0],same_site:u.hostname===site||u.hostname.endsWith('.'+site)};
   api.set(key,entry);
   if(/json/.test(entry.type)&&Number(r.headers()['content-length']||0)<500000){const body=await r.json().catch(()=>null);entry.shape=shape(body)}
  }catch{}
 });
 try{
  while(queue.length&&pages.length<maxPages){
   const u=queue.shift();
   if(!robotsAllows(rules,u.pathname)){skipped.push(u.pathname);continue}
   try{
    await page.goto(u.href,{waitUntil:'load',timeout:timeoutMs});
    await page.waitForLoadState('networkidle',{timeout:6000}).catch(()=>{});
    await page.waitForTimeout(600);
    await scrollThrough(page);
    const facts=await page.evaluate(pageFacts);
    const here=new URL(page.url());
    if(await resolvesPrivate(here.hostname))break;
    // A redirect on the first page (example.com → www.example.com) moves the crawl to the new site.
    if(!pages.length&&here.origin!==origin){if(!allowPrivate())await safeUrl(here.href);origin=here.origin;rules=await robots(origin,{fetchImpl});if(!robotsAllows(rules,here.pathname))throw fail(403,'This website asks automated tools not to read that page (robots.txt), so Kairoq will not analyze it.')}
    pages.push({url:here.href,path:here.pathname+(here.hash.startsWith('#/')?here.hash:''),...facts,links:undefined,nav:facts.links.filter(l=>l.nav).map(l=>({text:l.text,href:l.href})).slice(0,30),app_links:facts.links.map(l=>l.href).filter(h=>/^https:\/\/(apps\.apple\.com|play\.google\.com)\//.test(h)).slice(0,4),footer:facts.links.filter(l=>l.footer).map(l=>l.text).filter(Boolean).slice(0,30),link_count:facts.links.length});
    if(shots.length<2)shots.push({name:'reference-'+(shots.length?'page-2':'home')+'-desktop',page:here.pathname,mime:'image/jpeg',data:await shoot(page,1280,800,2600)});
    // Same-site pages, navigation first.
    const next=[...facts.links.filter(l=>l.nav),...facts.links.filter(l=>!l.nav&&!l.footer),...facts.links.filter(l=>l.footer)];
    for(const l of next){
     let n;try{n=new URL(l.href)}catch{continue}
     if(n.origin!==origin||!/^https?:$/.test(n.protocol)||/\.(pdf|jpe?g|png|gif|webp|zip|mp4|mp3|svg)$/i.test(n.pathname)||/logout|signout|log-out|sign-out|cart\/add|delete/i.test(n.pathname))continue;
     n.search='';n.hash=n.hash.startsWith('#/')?n.hash:'';
     const k=pageKey(n);if(seen.has(k))continue;seen.add(k);queue.push(n);
    }
   }catch(e){if(e.status)throw e;pages.push({url:u.href,path:u.pathname,error:String(e.message||e).split('\n')[0].slice(0,200)})}
  }
 }finally{await context.close().catch(()=>{})}
 // The home page on a phone: layout, navigation and overflow (skipped for a quick look read).
 let phone=null;
 const pc=lite?null:await b.newContext({viewport:{width:390,height:844},userAgent:UA+' Mobile',isMobile:true,hasTouch:true,deviceScaleFactor:1});
 if(pc)try{await guardContext(pc);const p=await pc.newPage();await p.goto(start.href,{waitUntil:'load',timeout:timeoutMs});await p.waitForLoadState('networkidle',{timeout:6000}).catch(()=>{});await p.waitForTimeout(600);await scrollThrough(p);phone=await p.evaluate(phoneFacts);shots.push({name:'reference-home-phone',page:start.pathname,mime:'image/jpeg',data:await shoot(p,390,844,2200)})}
 catch(e){phone={error:String(e.message||e).split('\n')[0].slice(0,200)}}finally{await pc.close().catch(()=>{})}
 const scripts=[...new Set(pages.flatMap(p=>p.scripts||[]))];
 const openapi=lite?null:await discoverOpenApi(origin,{fetchImpl,extra:[...api.values()].map(a=>a.url).filter(u=>/openapi|swagger|api-docs/i.test(u))});
 const ok=pages.filter(p=>!p.error);
 if(!ok.length)throw fail(422,'The website did not load in the browser: '+(pages[0]?.error||'no pages'));
 return{kind:'website',url:start.href,origin,analyzed_at:new Date().toISOString(),pages:pages.map(({scripts,...p})=>p),phone,api:[...api.values()],integrations:integrations(scripts.concat([...api.values()].map(a=>a.url))),openapi,design:designTokens(ok[0]),robots_skipped:skipped,screenshots:shots};
}
// The JSON shape of an API response: keys and value types, never the values.
function shape(v,depth=0){
 if(v===null)return'null';
 if(Array.isArray(v))return depth>2?'array':[v.length?shape(v[0],depth+1):'empty'];
 if(typeof v==='object'){if(depth>2)return'object';const o={};for(const k of Object.keys(v).slice(0,25))o[k]=shape(v[k],depth+1);return o}
 return typeof v;
}
function designTokens(p){
 if(!p||!p.styles)return null;
 const s=p.styles,hexes=list=>[...new Set((list||[]).map(rgbHex).filter(Boolean))];
 const background=rgbHex(s.body)||rgbHex(s.html)||'#ffffff';
 return{background,text:hexes(s.text).slice(0,4),surfaces:hexes(s.backgrounds).filter(h=>h!==background).slice(0,6),buttons:hexes(s.buttons).slice(0,3),fonts:s.fonts,type_scale:s.sizes,radii:s.radii,shadows:s.shadows,max_width:s.max_width,breakpoints:p.breakpoints||[],motion:p.motion};
}

// ---------- OpenAPI ----------
const OPENAPI_PATHS=['/openapi.json','/swagger.json','/api/openapi.json','/api/swagger.json','/v3/api-docs','/api-docs','/api/docs/openapi.json','/.well-known/openapi.json'];
function summarizeOpenApi(doc){
 if(!doc||typeof doc!=='object'||!(doc.openapi||doc.swagger)||!doc.paths)return null;
 const endpoints=[];
 for(const [p,ops] of Object.entries(doc.paths))for(const [m,op] of Object.entries(ops||{})){if(!/^(get|post|put|patch|delete)$/i.test(m))continue;if(endpoints.length>=80)break;endpoints.push(m.toUpperCase()+' '+p+(op&&op.summary?' — '+String(op.summary).slice(0,80):''))}
 const schemes=doc.components?.securitySchemes||doc.securityDefinitions||{};
 return{title:String(doc.info?.title||'').slice(0,100),version:String(doc.info?.version||'').slice(0,20),servers:(doc.servers||[]).map(s=>String(s.url||'').slice(0,120)).slice(0,3),auth:Object.entries(schemes).map(([k,v])=>k+' ('+(v.type||'')+(v.scheme?' '+v.scheme:'')+')').slice(0,5),endpoints,schemas:Object.keys(doc.components?.schemas||doc.definitions||{}).slice(0,40)};
}
async function discoverOpenApi(origin,{fetchImpl=fetch,extra=[]}={}){
 for(const url of [...extra,...OPENAPI_PATHS.map(p=>origin+p)].slice(0,12)){
  try{
   const u=new URL(url);if(blockedHost(u.hostname))continue;
   const r=await publicFetch(u.href,{headers:{'User-Agent':UA,Accept:'application/json'},signal:AbortSignal.timeout(6000)},fetchImpl);
   if(!r.ok||!/json/.test(r.headers.get('content-type')||''))continue;
   const text=await r.text();if(text.length>3000000)continue;
   const s=summarizeOpenApi(JSON.parse(text));if(s)return{url:u.href,...s};
  }catch{}
 }
 return null;
}

// ---------- GitHub repositories ----------
const PERMISSIVE=/^(mit|apache-2\.0|bsd-2-clause|bsd-3-clause|isc|0bsd|unlicense|cc0-1\.0|zlib|bsl-1\.0)$/i,COPYLEFT=/^(gpl|agpl|lgpl|mpl|epl|eupl|cc-by-sa)/i;
function licenseUse(spdx){const s=String(spdx||'');return PERMISSIVE.test(s)?'permissive':COPYLEFT.test(s)?'copyleft':'unknown'}
function parseRepo(raw){
 const t=String(raw||'').trim().replace(/\.git$/,'').replace(/\/+$/,'');
 const m=/^(?:https?:\/\/(?:www\.)?github\.com\/)?([\w.-]+)\/([\w.-]+)(?:\/tree\/([\w./-]+))?$/.exec(t);
 if(!m||m[1]==='.'||m[2]==='.'||m[1].includes('..')||m[2].includes('..'))throw fail(400,'Enter a GitHub repository, for example github.com/owner/name');
 return{owner:m[1],repo:m[2],branch:m[3]||''};
}
const KEY_FILES=[/^readme(\.md|\.mdx|\.txt)?$/i,/(^|\/)package\.json$/,/(^|\/)requirements\.txt$/,/(^|\/)pyproject\.toml$/,/(^|\/)schema\.prisma$/,/(^|\/)(openapi|swagger)\.(json|ya?ml)$/i,/(^|\/)docker-compose\.ya?ml$/,/(^|\/)supabase\/migrations\/.+\.sql$/,/(^|\/)(migrations|db|database|sql)\/.+\.sql$/,/(^|\/)schema\.sql$/,/(^|\/)\.env\.example$/,/(^|\/)(routes|router|app)\.(t|j)sx?$/];
const ROUTE_LIKE=/(^|\/)(pages|app|routes|views|screens|api|controllers|handlers|models|components)\//;
async function analyzeRepo(raw,{fetchImpl=fetch,token}={}){
 const {owner,repo,branch:wanted}=parseRepo(raw);
 const headers={Accept:'application/vnd.github+json','User-Agent':'Kairoq-Create','X-GitHub-Api-Version':'2022-11-28',...(token?{Authorization:'Bearer '+token}:{})};
 const gh=async p=>{const r=await fetchImpl('https://api.github.com/repos/'+owner+'/'+repo+p,{headers,signal:AbortSignal.timeout(20000)});const d=await r.json().catch(()=>({}));if(!r.ok)throw fail(r.status===404?404:502,r.status===404?'That repository was not found (private repositories need a GitHub token)':'GitHub HTTP '+r.status+': '+String(d.message||'').slice(0,150));return d};
 const info=await gh('');
 const branch=wanted||info.default_branch||'main';
 const tree=await gh('/git/trees/'+encodeURIComponent(branch)+'?recursive=1');
 const blobs=(tree.tree||[]).filter(e=>e.type==='blob'&&!/(^|\/)(node_modules|vendor|dist|build|\.git|\.next|coverage)\//.test(e.path));
 const exts={};for(const b of blobs){const e=(/\.([a-z0-9]+)$/i.exec(b.path)||[])[1];if(e)exts[e.toLowerCase()]=(exts[e.toLowerCase()]||0)+1}
 const pick=blobs.filter(b=>KEY_FILES.some(re=>re.test(b.path))&&b.size<200000).sort((a,b)=>a.path.split('/').length-b.path.split('/').length).slice(0,14);
 const files={};let budget=MAX_REPO_TEXT;
 for(const b of pick){
  if(budget<=0)break;
  try{const r=await fetchImpl('https://raw.githubusercontent.com/'+owner+'/'+repo+'/'+encodeURIComponent(branch)+'/'+b.path.split('/').map(encodeURIComponent).join('/'),{headers:token?{Authorization:'Bearer '+token}:{},signal:AbortSignal.timeout(15000)});if(!r.ok)continue;const t=(await r.text()).slice(0,Math.min(budget,14000));files[b.path]=t;budget-=t.length}catch{}
 }
 const deps={};for(const [p,t] of Object.entries(files))if(/package\.json$/.test(p)){try{const j=JSON.parse(t);Object.assign(deps,j.dependencies||{},j.devDependencies||{})}catch{}}
 const known=['react','next','vue','nuxt','svelte','@sveltejs/kit','angular','@angular/core','express','fastify','@nestjs/core','koa','hono','prisma','@prisma/client','drizzle-orm','mongoose','pg','mysql2','sqlite3','better-sqlite3','@supabase/supabase-js','firebase','stripe','@stripe/stripe-js','next-auth','@clerk/nextjs','passport','tailwindcss','@mui/material','@chakra-ui/react','three','@react-three/fiber','socket.io','graphql','@apollo/client','react-native','expo','electron','openai','@anthropic-ai/sdk'];
 let openapi=null;for(const [p,t] of Object.entries(files))if(/\.json$/.test(p)&&/(openapi|swagger)/i.test(p)){try{openapi=summarizeOpenApi(JSON.parse(t))}catch{}}
 const spdx=info.license?.spdx_id||'';
 return{kind:'repo',repo:owner+'/'+repo,url:'https://github.com/'+owner+'/'+repo,branch,analyzed_at:new Date().toISOString(),description:String(info.description||'').slice(0,300),stars:info.stargazers_count||0,
  license:{spdx,name:info.license?.name||'No license found',use:licenseUse(spdx)},
  languages:Object.entries(exts).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([e,n])=>e+' ('+n+')'),
  frameworks:known.filter(k=>deps[k]),file_count:blobs.length,truncated:Boolean(tree.truncated),
  structure:[...new Set(blobs.map(b=>b.path.split('/').slice(0,2).join('/')))].slice(0,60),
  routes:blobs.filter(b=>ROUTE_LIKE.test(b.path)&&/\.(t|j)sx?$|\.vue$|\.svelte$|\.py$/.test(b.path)).map(b=>b.path).slice(0,100),
  openapi,files};
}

// ---------- Uploaded JavaScript apps (zip), read with REA when it is installed ----------
// A small zip reader (stored and deflated entries), so an uploaded app can be unpacked safely.
function readZip(buf,{maxFiles=4000,maxBytes=60*1024*1024}={}){
 let eocd=-1;for(let i=buf.length-22;i>=Math.max(0,buf.length-65557);i--)if(buf.readUInt32LE(i)===0x06054b50){eocd=i;break}
 if(eocd<0)throw fail(400,'That file is not a zip archive');
 const count=buf.readUInt16LE(eocd+10);let p=buf.readUInt32LE(eocd+16),total=0;const out=[];
 if(count>maxFiles)throw fail(413,'The zip has too many files (at most '+maxFiles+')');
 for(let i=0;i<count;i++){
  if(buf.readUInt32LE(p)!==0x02014b50)throw fail(400,'The zip archive is damaged');
  const method=buf.readUInt16LE(p+10),csize=buf.readUInt32LE(p+20),size=buf.readUInt32LE(p+24),nlen=buf.readUInt16LE(p+28),elen=buf.readUInt16LE(p+30),clen=buf.readUInt16LE(p+32),local=buf.readUInt32LE(p+42);
  const name=buf.slice(p+46,p+46+nlen).toString('utf8');p+=46+nlen+elen+clen;
  if(name.endsWith('/'))continue;
  const clean=path.posix.normalize(name.replace(/\\/g,'/'));
  if(clean.startsWith('../')||clean.startsWith('/')||clean.includes('/../')||/^[a-z]:/i.test(clean))throw fail(400,'The zip contains an unsafe path: '+name.slice(0,100));
  total+=size;if(total>maxBytes)throw fail(413,'The unpacked app is larger than '+Math.round(maxBytes/1048576)+' MB');
  const lnlen=buf.readUInt16LE(local+26),lelen=buf.readUInt16LE(local+28),start=local+30+lnlen+lelen,data=buf.slice(start,start+csize);
  if(method!==0&&method!==8)continue;
  out.push({name:clean,data:method===0?data:zlib.inflateRawSync(data,{maxOutputLength:maxBytes})});
 }
 return out;
}
function reaCommand(){const c=String(process.env.KAIROQ_REA_COMMAND||'').trim();return c?c.split(/\s+/):null}
function reaAvailable(){return Boolean(reaCommand())}
function runRea(args,{timeoutMs=180000}={}){
 const cmd=reaCommand();if(!cmd)return Promise.resolve(null);
 return new Promise(resolve=>{
  const child=spawn(cmd[0],[...cmd.slice(1),...args],{stdio:['ignore','pipe','pipe'],env:process.env});
  let out='',err='';const timer=setTimeout(()=>child.kill('SIGKILL'),timeoutMs);
  child.stdout.on('data',d=>{if(out.length<4000000)out+=d});child.stderr.on('data',d=>{if(err.length<4000)err+=d});
  child.on('error',e=>{clearTimeout(timer);resolve({error:String(e.message||e).slice(0,300)})});
  child.on('close',code=>{clearTimeout(timer);let json=null;try{json=JSON.parse(out)}catch{const a=out.indexOf('{');if(a>=0)try{json=JSON.parse(out.slice(a))}catch{}}resolve(json?{result:json}:{error:(err||out||'REA exited with code '+code).slice(0,600)})});
 });
}
// Compact JSON for the model: long arrays and strings are cut.
function compact(v,depth=0){
 if(Array.isArray(v))return v.slice(0,depth>3?5:25).map(x=>compact(x,depth+1));
 if(v&&typeof v==='object'){const o={};for(const [k,x] of Object.entries(v).slice(0,40))o[k]=compact(x,depth+1);return o}
 return typeof v==='string'?v.slice(0,300):v;
}
async function reaNetwork(harPath){if(!reaAvailable()||!fs.existsSync(harPath))return null;const r=await runRea(['inspect-web-network-capture',harPath,'har','--json']);return r&&(r.result?{network:compact(r.result)}:{error:r.error})}
async function analyzeApp(zipBase64,{name='app.zip'}={}){
 if(!reaAvailable())throw fail(503,'Analyzing app files needs REA on the server (set KAIROQ_REA_COMMAND). Use a website, a GitHub repository or screenshots instead.');
 const buf=Buffer.from(String(zipBase64||''),'base64');if(buf.length>40*1024*1024)throw fail(413,'Upload a zip of 40 MB or less');
 const entries=readZip(buf),dir=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-rea-'));
 try{
  for(const e of entries){const f=path.join(dir,e.name);if(!f.startsWith(dir+path.sep))continue;fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,e.data)}
  const asar=entries.find(e=>/\.asar$/i.test(e.name));
  const r=await runRea(['analyze-javascript-application',asar?path.join(dir,asar.name):dir,'--json']);
  if(!r||r.error)throw fail(502,'REA could not analyze the app: '+String(r&&r.error||'no result').slice(0,300));
  const pkg=entries.find(e=>/(^|\/)package\.json$/.test(e.name)&&e.name.split('/').length<=3);
  return{kind:'app',name:String(name).slice(0,80),analyzed_at:new Date().toISOString(),files:entries.length,package:pkg?compact(JSON.parse(pkg.data.toString('utf8')||'{}')):null,rea:compact(r.result)};
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
}

// ---------- The plan ----------
// A short, readable description of the analysis for the planning model.
function describe(a){
 const L=[];
 if(a.kind==='website'){
  L.push('WEBSITE '+a.url+(a.pages[0]?.site_name?' ("'+a.pages[0].site_name+'")':''));
  for(const p of a.pages){
   if(p.error){L.push('\nPage '+p.path+': did not load ('+p.error+')');continue}
   L.push('\nPage '+p.path+' — '+p.title+(p.description?'\n  About: '+p.description:''));
   if(p.headings.length)L.push('  Headings: '+p.headings.slice(0,15).join(' | '));
   if(p.nav.length)L.push('  Navigation: '+p.nav.map(n=>n.text).filter(Boolean).join(', '));
   if(p.buttons.length)L.push('  Buttons: '+p.buttons.join(', '));
   for(const f of p.forms)L.push('  Form ('+f.method+'): '+f.fields.map(x=>(x.label||x.type)+(x.required?'*':'')+' ['+x.type+']').join(', ')+(f.submit?' → "'+f.submit+'"':''));
   if(p.inputs.length)L.push('  Other inputs: '+p.inputs.map(x=>(x.label||x.type)+' ['+x.type+']').join(', '));
   L.push('  Content: '+Object.entries(p.counts).map(([k,v])=>k+' '+v).join(', '));
   const h=p.hints;L.push('  Signals: '+[h.auth.length&&'account/sign-in ('+h.auth.join(', ')+')',h.commerce.length&&'commerce/booking ('+h.commerce.join(', ')+')',h.search&&'search box',h.password&&'password field',h.language.length&&'language switcher'].filter(Boolean).join('; '));
   L.push('  Motion: '+p.motion.animated+' animated elements, '+p.motion.transitions+' with transitions, '+p.motion.sticky+' sticky/fixed');
   if(p.footer.length)L.push('  Footer links: '+p.footer.join(', '));
   L.push('  Text sample (to understand the business, do not copy): '+p.text.slice(0,700));
  }
  if(a.phone)L.push('\nOn a phone: '+(a.phone.error?'did not load':'menu button '+(a.phone.menu_button?'yes':'no')+', '+a.phone.visible_nav_links+' visible nav links, horizontal overflow '+(a.phone.overflow?'YES':'no')+', bottom bar '+(a.phone.bottom_bar?'yes':'no')));
  if(a.design)L.push('\nDesign tokens measured: '+JSON.stringify(a.design));
  if(a.integrations.length)L.push('\nThird-party services seen: '+a.integrations.join(', '));
  if(a.api.length)L.push('\nAPI calls the page made:\n'+a.api.map(x=>'  '+x.method+' '+x.url+(x.query.length?' ?'+x.query.join('&'):'')+' → '+x.status+(x.shape?' '+JSON.stringify(x.shape).slice(0,300):'')).join('\n'));
  if(a.robots_skipped?.length)L.push('\nPages skipped because robots.txt asks: '+a.robots_skipped.join(', '));
 }else if(a.kind==='repo'){
  L.push('GITHUB REPOSITORY '+a.repo+' ('+a.branch+') — '+a.description,'License: '+a.license.name+' ('+a.license.spdx+', '+a.license.use+')','Languages: '+a.languages.join(', '),'Frameworks and libraries: '+(a.frameworks.join(', ')||'none detected'),'Structure: '+a.structure.join(', '));
  if(a.routes.length)L.push('Route, page, model and component files:\n  '+a.routes.join('\n  '));
  for(const [p,t] of Object.entries(a.files))L.push('\n--- '+p+' ---\n'+t.slice(0,8000));
 }else if(a.kind==='app'){
  L.push('UPLOADED APP '+a.name+' ('+a.files+' files)');
  if(a.package)L.push('package.json: '+JSON.stringify(a.package).slice(0,3000));
  L.push('REA static analysis (modules, imports, boundaries, evidence):\n'+JSON.stringify(a.rea).slice(0,20000));
 }else if(a.kind==='screenshots')L.push('SCREENSHOTS ONLY: '+a.count+' images of the reference are attached.');
 if(a.openapi)L.push('\nOpenAPI ('+(a.openapi.url||'in the repository')+'): '+a.openapi.title+' '+a.openapi.version+'\n  Auth: '+(a.openapi.auth.join(', ')||'none')+'\n  '+a.openapi.endpoints.join('\n  ')+(a.openapi.schemas.length?'\n  Schemas: '+a.openapi.schemas.join(', '):''));
 if(a.rea_network)L.push('\nREA network capture analysis: '+JSON.stringify(a.rea_network).slice(0,8000));
 return L.join('\n').slice(0,90000);
}
const PLAN_PROMPT=`You are the product architect of an app builder (React + Tailwind front end; built-in backend with sign-in, collections, SQL, server functions, file uploads, emails and Stripe payments). The user gave a reference product. From the analysis (and screenshots, if attached), work out how the product works and plan an independent implementation with comparable functionality and an equally polished, original design.
Rules:
- Study, do not copy: invent an original product name and write all new text. Never reuse the reference's logo, brand name, trademarks, photos, illustrations or copywriting. Comparable layout patterns and flows are fine; pixel copies are not.
- Only plan what can be built with the stack above. Third-party services become integrations that use their documented public APIs or SDKs with the app owner's own keys (as app secrets), or are replaced by built-in features.
- If a repository's license is not permissive, plan from its behaviour only; do not reuse its code.
- Keep it buildable: at most 8 pages and 12 features for the first version, most important first (priority 1 = must have).
Respond with ONLY a JSON object:
{"name":"original product name","summary":"2-3 sentences: what the product does and for whom","audience":"who uses it",
"features":[{"name":"","description":"","priority":1,"area":"frontend|backend|integration"}],
"pages":[{"path":"/","name":"","purpose":"","sections":["hero with search", "..."]}],
"entities":[{"name":"bookings","fields":["name:text","email:text","check_in:date"],"access":"public|signed-in|owner"}],
"auth":{"required":true,"methods":["email","google"],"roles":["guest","admin"]},
"integrations":[{"name":"","purpose":"","how":"documented API/SDK and the app secret it needs, or the built-in replacement"}],
"api":[{"method":"GET","path":"/api/...","purpose":""}],
"journeys":[{"name":"short name","steps":"plain-English steps a tester can follow in the browser, ending with what proves it worked"}],
"design":{"name":"style name","summary":"","palette":{"background":"#hex","foreground":"#hex","primary":"#hex","secondary":"#hex","accent":"#hex","muted":"#hex"},"fonts":{"display":"","body":""},"radius":"0.75rem","layout":"","imagery":"","details":["5-8 concrete rules: spacing, cards, motion, responsive behaviour"]},
"assets":[{"kind":"image|audio|model","query":"search words for openly licensed stock","use":"where it goes"}],
"steps":["ordered build steps"],
"out_of_scope":[{"what":"something the reference has that cannot be copied","why":"its users and network, licensed content, data it owns, partner deals, regulated licences or hardware"}],
"notes":"what you could not observe and the assumptions you made"}
The design palette may follow the measured colours where they suit an original brand; choose fonts only from: FONTS. At most 5 journeys and 6 assets.`;
function cleanText(v,n){return String(v??'').replace(/[\u0000-\u001f]+/g,' ').trim().slice(0,n)}
function list(v,n,f){return(Array.isArray(v)?v:[]).map(f).filter(Boolean).slice(0,n)}
function normalizePlan(v){
 if(!v||typeof v!=='object')throw fail(422,'The plan was not an object');
 const plan={
  name:cleanText(v.name,60)||'New app',summary:cleanText(v.summary,800),audience:cleanText(v.audience,300),
  features:list(v.features,16,f=>f&&cleanText(f.name,80)&&{name:cleanText(f.name,80),description:cleanText(f.description,400),priority:[1,2,3].includes(Number(f.priority))?Number(f.priority):2,area:['frontend','backend','integration'].includes(f.area)?f.area:'frontend',enabled:f.enabled!==false,...(f.added?{added:cleanText(f.added,60)||'yes'}:{})}),
  pages:list(v.pages,10,p=>p&&{path:/^\/[\w\-/:]*$/.test(String(p.path||''))?String(p.path):'/',name:cleanText(p.name,60),purpose:cleanText(p.purpose,300),sections:list(p.sections,12,s=>cleanText(s,160))}),
  entities:list(v.entities,12,e=>e&&/^[a-z][a-z0-9_]{0,39}$/i.test(String(e.name||'').trim())&&{name:String(e.name).trim().toLowerCase(),fields:list(e.fields,20,f=>cleanText(f,80)),access:['public','signed-in','owner'].includes(e.access)?e.access:'signed-in'}),
  auth:{required:Boolean(v.auth&&v.auth.required),methods:list(v.auth&&v.auth.methods,4,m=>['email','google','magic-link'].includes(String(m).toLowerCase())?String(m).toLowerCase():null),roles:list(v.auth&&v.auth.roles,5,r=>cleanText(r,30))},
  integrations:list(v.integrations,8,i=>i&&cleanText(i.name,60)&&{name:cleanText(i.name,60),purpose:cleanText(i.purpose,300),how:cleanText(i.how,400)}),
  api:list(v.api,30,a=>a&&{method:/^(GET|POST|PUT|PATCH|DELETE)$/.test(String(a.method||'').toUpperCase())?String(a.method).toUpperCase():'GET',path:cleanText(a.path,120),purpose:cleanText(a.purpose,200)}),
  journeys:list(v.journeys,6,j=>j&&cleanText(j.name,80)&&cleanText(j.steps,800)&&{name:cleanText(j.name,80),steps:cleanText(j.steps,800)}),
  assets:list(v.assets,6,a=>a&&cleanText(a.query,80)&&{kind:['image','audio','model'].includes(a.kind)?a.kind:'image',query:cleanText(a.query,80),use:cleanText(a.use,160)}),
  steps:list(v.steps,15,s=>cleanText(s,300)),notes:cleanText(v.notes,1500),
  // What cannot be copied at all (Replica's skip rows): its users and network, licensed content, data it owns, partner deals.
  out_of_scope:list(v.out_of_scope,8,o=>o&&cleanText(o.what,120)&&{what:cleanText(o.what,120),why:cleanText(o.why,240)})
 };
 if(!plan.features.length)throw fail(422,'The plan has no features');
 try{plan.design=require('./react-design').normalize(v.design||{})}catch{plan.design=null}
 return plan;
}
function parsePlan(content){
 let v=content;
 if(typeof v==='string'){const t=v.trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'');try{v=JSON.parse(t)}catch{const a=t.indexOf('{'),b=t.lastIndexOf('}');if(a<0||b<=a)throw Error('The plan was not JSON');v=JSON.parse(t.slice(a,b+1))}}
 return normalizePlan(v);
}
function planPrompt(){const F=require('./react-design').FONTS;return PLAN_PROMPT.replace('FONTS',Object.keys(F).filter(n=>F[n][0]!=='mono').join(', '))}
async function createPlan(analysis,{callModel,tier='standard',images=[],note='',signal}){
 const user='Reference analysis:\n'+describe(analysis)+(note?'\n\nWhat the user wants from it: '+String(note).slice(0,2000):'');
 const content=images.length?[{type:'text',text:user+'\n\nScreenshots of the reference are attached.'},...images.slice(0,4).map(img=>({type:'image_url',image_url:{url:'data:'+img.mime+';base64,'+img.data}}))]:user;
 return callModel({messages:[{role:'system',content:planPrompt()},{role:'user',content}],temperature:0.3,maxOutputTokens:6000,signal,tier:images.length&&tier==='standard'?'vision':tier},parsePlan);
}
// The instruction for the build agent, from the plan the user approved.
function buildTask(plan,analysis){
 const on=plan.features.filter(f=>f.enabled!==false);
 const message='Build "'+plan.name+'": '+plan.summary+'\nBuild it completely, as a working product, following the plan below. It is an independent implementation inspired by a reference: original name, original text and original or openly licensed images only; no logos, trademarks or copy from the reference.';
 const L=['APPROVED BUILD PLAN','Audience: '+plan.audience,'\nFeatures (priority 1 first):',...on.sort((a,b)=>a.priority-b.priority).map(f=>'- ['+f.priority+'] '+f.name+' ('+f.area+'): '+f.description),
  '\nPages:',...plan.pages.map(p=>'- '+p.path+' '+p.name+': '+p.purpose+(p.sections.length?' Sections: '+p.sections.join('; '):'')),
  plan.entities.length?'\nData (built-in collections or SQL tables):\n'+plan.entities.map(e=>'- '+e.name+' ['+e.access+']: '+e.fields.join(', ')).join('\n'):'',
  plan.auth.required?'\nSign-in: '+(plan.auth.methods.join(', ')||'email')+(plan.auth.roles.length?'; roles: '+plan.auth.roles.join(', '):''):'\nNo sign-in needed for the first version.',
  plan.integrations.length?'\nIntegrations (documented APIs/SDKs, keys as app secrets; if a key is missing, show a friendly "not connected yet" state instead of failing):\n'+plan.integrations.map(i=>'- '+i.name+': '+i.purpose+' — '+i.how).join('\n'):'',
  plan.api.length?'\nServer functions / API:\n'+plan.api.map(a=>'- '+a.method+' '+a.path+': '+a.purpose).join('\n'):'',
  plan.journeys.length?'\nThese user journeys are tested in a browser on desktop and phone after you finish; make each one work end to end, with visible confirmation text:\n'+plan.journeys.map(j=>'- '+j.name+': '+j.steps).join('\n'):'',
  plan.steps.length?'\nSuggested order:\n'+plan.steps.map((s,i)=>(i+1)+'. '+s).join('\n'):'',
  '\nResponsive: design mobile first; no horizontal scrolling on a 390px phone; a menu button for navigation on small screens.',
  analysis&&analysis.kind==='repo'&&analysis.license.use!=='permissive'?'\nThe reference repository is not permissively licensed: write all code yourself.':'',
  plan.notes?'\nArchitect notes: '+plan.notes:''];
 return{message,context:L.filter(Boolean).join('\n').slice(0,30000)};
}
// The analysis kept with the project: everything except the screenshots (saved as files).
function stored(analysis){const {screenshots,files,...rest}=analysis;return{...rest,...(files?{files:Object.keys(files)}:{})}}
module.exports={safeUrl,blockedHost,privateIp,publicFetch,robots,parseRobots,robotsAllows,crawlSite,shape,designTokens,summarizeOpenApi,discoverOpenApi,parseRepo,licenseUse,analyzeRepo,readZip,reaAvailable,runRea,reaNetwork,analyzeApp,describe,planPrompt,normalizePlan,parsePlan,createPlan,buildTask,stored,integrations,rgbHex};

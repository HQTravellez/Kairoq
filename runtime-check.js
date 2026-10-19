"use strict";
// Opens a built preview in headless Chromium and reports runtime problems:
// uncaught errors, console errors, failed requests and a blank page.
const fs=require('fs');
let browserPromise=null;
function chromiumPath(){return[process.env.CHROMIUM_PATH,'/opt/pw-browsers/chromium','/usr/bin/chromium','/usr/bin/chromium-browser'].find(p=>p&&fs.existsSync(p))}
function available(){return process.env.KAIROQ_RUNTIME_CHECK!=='off'&&Boolean(chromiumPath())}
async function browser(){
 if(!browserPromise){
  const {chromium}=require('playwright-core');
  browserPromise=chromium.launch({executablePath:chromiumPath(),args:['--no-sandbox','--disable-dev-shm-usage']}).catch(e=>{browserPromise=null;throw e});
 }
 const b=await browserPromise;
 if(!b.isConnected()){browserPromise=null;return browser()}
 return b;
}
const IGNORED=/favicon\.ico|Download the React DevTools|net::ERR_ABORTED/;
async function check(url,{timeoutMs=15000}={}){
 if(!available())return{skipped:true,errors:[]};
 const context=await (await browser()).newContext({viewport:{width:1280,height:800}});
 const page=await context.newPage(),errors=[];
 const add=e=>{const text=String(e).slice(0,500);if(!IGNORED.test(text)&&!errors.includes(text)&&errors.length<10)errors.push(text)};
 // Images or fonts from other sites that fail to load are not bugs in the app's code
 // (and can't be fixed by the AI), so they are not reported as problems here.
 const own=u=>{try{return new URL(u).origin===new URL(url).origin}catch{return false}};
 page.on('pageerror',e=>add('Uncaught error: '+(e.stack||e.message||e)));
 page.on('console',m=>{if(m.type()==='error'){const at=m.location()?.url;if(/Failed to load resource/.test(m.text())&&at&&!own(at))return;add('Console error: '+m.text()+(at&&/Failed to load resource/.test(m.text())?' ('+at+')':''))}});
 page.on('requestfailed',r=>{if(own(r.url()))add('Request failed: '+r.method()+' '+r.url()+' ('+(r.failure()?.errorText||'failed')+')')});
 page.on('response',r=>{if(r.status()>=400&&own(r.url()))add('HTTP '+r.status()+' from '+r.request().method()+' '+r.url())});
 try{
  await page.goto(url,{waitUntil:'load',timeout:timeoutMs});
  await page.waitForLoadState('networkidle',{timeout:5000}).catch(()=>{});
  await page.waitForTimeout(500);
  const blank=await page.evaluate(()=>{const root=document.getElementById('root');return!root||(!root.innerText.trim()&&!root.querySelector('img,svg,canvas,video,input,button'))});
  if(blank)add('Blank page: nothing rendered inside #root.');
  if(!blank&&process.env.KAIROQ_DEAD_CLICKS!=='off'){for(const d of await deadClicks(page,url).catch(()=>[]))add(d)}
 }catch(e){add('Page did not load: '+e.message)}
 finally{await context.close().catch(()=>{})}
 return{skipped:false,errors};
}
// Clicks the app's navigation (nav, header and sidebar links and buttons, tabs) and reports
// the ones that change nothing a person could see: no new page, no dialog, no different
// content. Each click starts from a fresh load of the page, so one click cannot hide another.
const MAX_DEAD_PROBES=8;
async function deadClicks(page,url){
 const targets=await page.evaluate(max=>{
  const seen=new Set(),out=[];
  const els=document.querySelectorAll('nav a, nav button, header a, header button, aside a, aside button, [role=tab], [role=tablist] button, [role=navigation] a, [role=navigation] button');
  for(const e of els){
   const r=e.getBoundingClientRect(),label=(e.innerText||e.getAttribute('aria-label')||'').replace(/\s+/g,' ').trim().slice(0,40);
   if(r.width<4||r.height<4||!label||seen.has(label))continue;
   const href=e.getAttribute('href')||'';
   // Links to other sites, mail and phone are not part of the app.
   if(/^(https?:|mailto:|tel:)/i.test(href)&&!href.startsWith(location.origin))continue;
   // A link to the page already open (Home on the home page, the logo) rightly changes nothing;
   // a bare "#" is a placeholder and is still checked.
   if(href&&href!=='#'){try{const t=new URL(href,location.href),route=u=>u.pathname+(u.hash.replace(/^#\/?$/,'')||'');if(route(t)===route(location))continue}catch{}}
   // Form buttons need the form filled in first (the browser asks for the missing fields).
   if(e.closest('form')||e.type==='submit')continue;
   if(e.disabled||e.getAttribute('aria-disabled')==='true'||e.getAttribute('aria-current')==='page'||e.getAttribute('aria-selected')==='true')continue;
   seen.add(label);out.push(label);if(out.length>=max)break;
  }
  return out;
 },MAX_DEAD_PROBES);
 // Each click runs in its own fresh tab, four at a time, so the check stays quick.
 const dead=[],ctx=page.context(),queue=targets.slice();
 async function probe(label){
  const tab=await ctx.newPage();
  const state=()=>tab.evaluate(()=>({url:location.href,text:(document.getElementById('root')||document.body).innerText.replace(/\s+/g,' ').slice(0,20000),dialogs:document.querySelectorAll('[role=dialog],dialog[open],[aria-modal=true]').length,scroll:Math.round(scrollY),look:document.documentElement.className+'|'+document.body.className+'|'+document.querySelectorAll('[aria-expanded=true],[data-state=open],[aria-pressed=true]').length+'|'+document.querySelectorAll('*').length}));
  try{
   await tab.goto(url,{waitUntil:'domcontentloaded',timeout:10000});await tab.waitForFunction(()=>{const r=document.getElementById('root');return!r||r.childElementCount>0},null,{timeout:4000}).catch(()=>{});await tab.waitForTimeout(120);
   const before=await state();
   const loc=tab.getByText(label,{exact:true}).first();
   if(!(await loc.isVisible().catch(()=>false)))return;
   await loc.click({timeout:2000});await tab.waitForTimeout(450);
   const after=await state();
   if(after.url===before.url&&after.text===before.text&&after.dialogs===before.dialogs&&after.look===before.look&&Math.abs(after.scroll-before.scroll)<20)dead.push('Clicking "'+label+'" does nothing: nothing on the page changes. Make it open its page, panel or dialog, or remove it.');
  }catch{}finally{await tab.close().catch(()=>{})}
 }
 await Promise.all(Array.from({length:Math.min(4,queue.length)},async()=>{while(queue.length)await probe(queue.shift())}));
 // Reported in the order of the page, whichever tab finished first.
 dead.sort((a,b)=>targets.findIndex(t=>a.includes('"'+t+'"'))-targets.findIndex(t=>b.includes('"'+t+'"')));
 return dead;
}
// Saves a 1200x630 PNG of a page (used as the social share image).
async function screenshot(url,file){
 if(!available())return false;
 const context=await (await browser()).newContext({viewport:{width:1200,height:630},deviceScaleFactor:1});
 try{const page=await context.newPage();await page.goto(url,{waitUntil:'load',timeout:20000});await page.waitForLoadState('networkidle',{timeout:5000}).catch(()=>{});await page.waitForTimeout(400);await page.screenshot({path:file,type:'png'});return true}
 catch{return false}finally{await context.close().catch(()=>{})}
}
// Opens a page, optionally runs simple UI steps (click, fill, press, expect, goto, wait),
// and returns runtime errors, step results, visible text and a JPEG screenshot.
const MAX_STEPS=20;
function privateHost(h){h=h.replace(/^\[|\]$/g,'').toLowerCase();return h==='localhost'||h.endsWith('.localhost')||h.endsWith('.internal')||/^\d+\.\d+\.\d+\.\d+$/.test(h)||h.includes(':')||!h.includes('.')}
// Only the app itself, its backend and public https resources may load; anything else
// (other Kairoq paths, internal hosts, cloud metadata) is blocked, including by clicking links.
// With sandbox, the app's backend calls carry the test-run token (see react-sandbox.js).
async function guard(context,url,{sandbox}={}){
 const origin=new URL(url).origin,root=new URL('./',url).pathname;
 const appId=(/\/builder\/p\/([a-f0-9]{12})-/.exec(root)||[])[1];
 await context.route('**/*',r=>{
  let u;try{u=new URL(r.request().url())}catch{return r.abort()}
  if(u.protocol==='data:'||u.protocol==='blob:')return r.continue();
  if(u.origin===origin&&appId&&u.pathname.startsWith('/api/apps/'+appId+'/'))return sandbox?r.continue({headers:{...r.request().headers(),'x-kairoq-sandbox':sandbox}}):r.continue();
  if(u.origin===origin)return u.pathname.startsWith(root)?r.continue():r.abort();
  if(u.protocol==='https:'&&!privateHost(u.hostname))return r.continue();
  return r.abort();
 });
}
// Desktop and phone screenshots of a page (JPEG, base64) for the design review. Long pages
// are captured down to a height limit so the model sees the whole first part of the page.
async function designShots(url,{timeoutMs=20000}={}){
 if(!available())return[];
 const shots=[];
 for(const [name,width,height,maxHeight] of [['desktop',1280,800,2600],['phone',390,844,2200]]){
  const context=await (await browser()).newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:name==='phone',hasTouch:name==='phone'});
  try{
   await guard(context,url);
   const page=await context.newPage();
   await page.goto(url,{waitUntil:'load',timeout:timeoutMs});
   await page.waitForLoadState('networkidle',{timeout:6000}).catch(()=>{});
   await page.waitForTimeout(900);
   const full=await page.evaluate(()=>document.documentElement.scrollHeight).catch(()=>height);
   const buf=await page.screenshot({type:'jpeg',quality:62,fullPage:true,clip:{x:0,y:0,width,height:Math.max(height,Math.min(full,maxHeight))}});
   shots.push({name,mime:'image/jpeg',data:buf.toString('base64')});
  }catch{}finally{await context.close().catch(()=>{})}
 }
 return shots;
}
// viewport 'phone' tests the page at 390x844 with touch, like a phone.
// scan: also return what a browsing agent would see (the interactive elements), e.g. to repair a check.
async function inspect(url,{steps=[],screenshot=true,timeoutMs=15000,sandbox,viewport,scan=false}={}){
 if(!available())return{skipped:true,errors:[],steps:[],text:'',screenshot:null};
 const phone=viewport==='phone';
 const context=await (await browser()).newContext(phone?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{viewport:{width:1280,height:800}});
 const page=await context.newPage(),errors=[],results=[],external=[];
 const add=e=>{const text=String(e).slice(0,500);if(!IGNORED.test(text)&&!errors.includes(text)&&errors.length<15)errors.push(text)};
 // Files from other sites that fail to load (blocked images, fonts) are listed separately:
 // they are not code errors and must not stop the agent from finishing.
 const own=u=>{try{return new URL(u).origin===new URL(url).origin}catch{return false}};
 const ext=u=>{if(external.length<10&&!external.includes(u))external.push(u)};
 page.on('pageerror',e=>add('Uncaught error: '+(e.stack||e.message||e)));
 page.on('console',m=>{if(m.type()==='error'){const at=m.location()?.url;if(/Failed to load resource/.test(m.text())&&at&&!own(at))return ext(at);add('Console error: '+m.text()+(at&&/Failed to load resource/.test(m.text())?' ('+at+')':''))}});
 page.on('requestfailed',r=>{if(own(r.url()))add('Request failed: '+r.method()+' '+r.url()+' ('+(r.failure()?.errorText||'failed')+')');else ext(r.url())});
 page.on('response',r=>{if(r.status()>=400){if(own(r.url()))add('HTTP '+r.status()+' from '+r.request().method()+' '+r.url());else ext(r.url())}});
 const origin=new URL(url).origin,root=new URL('./',url).pathname;
 await guard(context,url,{sandbox});
 let text='',shot=null,scanned=null;
 try{
  await page.goto(url,{waitUntil:'load',timeout:timeoutMs});
  await page.waitForLoadState('networkidle',{timeout:5000}).catch(()=>{});
  for(const step of (Array.isArray(steps)?steps:[]).slice(0,MAX_STEPS)){
   const s=step&&typeof step==='object'?step:{};
   const label=JSON.stringify(s).slice(0,200);
   try{
    const target=()=>s.selector?page.locator(String(s.selector)).first():s.label?page.getByLabel(String(s.label),{exact:false}).first():s.placeholder?page.getByPlaceholder(String(s.placeholder),{exact:false}).first():s.role?page.getByRole(String(s.role),s.text?{name:String(s.text),exact:false}:{}).first():page.getByText(String(s.text??''),{exact:false}).first();
    if(s.action==='click')await target().click({timeout:4000});
    else if(s.action==='fill')await target().fill(String(s.value??''),{timeout:4000});
    else if(s.action==='select')await target().selectOption(String(s.value??''),{timeout:4000});
    else if(s.action==='press')await page.keyboard.press(String(s.key||'Enter'));
    else if(s.action==='expect'){if(s.absent)await page.getByText(String(s.text),{exact:false}).first().waitFor({state:'hidden',timeout:4000});else await target().waitFor({state:'visible',timeout:4000})}
    else if(s.action==='goto'){const next=new URL(String(s.path||''),url);if(next.origin!==origin||!next.pathname.startsWith(root))throw Error('goto must stay inside the app');await page.goto(next.href,{waitUntil:'load',timeout:timeoutMs})}
    else if(s.action==='wait')await page.waitForTimeout(Math.min(3000,Math.max(0,Number(s.ms)||500)));
    else throw Error('Unknown action (use click, fill, select, press, expect, goto, wait)');
    await page.waitForTimeout(250);
    results.push({step:label,ok:true});
   }catch(e){results.push({step:label,ok:false,error:String(e.message||e).split('\n')[0].slice(0,300)})}
  }
  await page.waitForLoadState('networkidle',{timeout:3000}).catch(()=>{});
  if(!page.url().startsWith(origin+root))add('The page left the app: '+page.url());
  text=await page.evaluate(()=>document.body?document.body.innerText:'').catch(()=>'');
  const blank=await page.evaluate(()=>{const root=document.getElementById('root');return!root||(!root.innerText.trim()&&!root.querySelector('img,svg,canvas,video,input,button'))}).catch(()=>false);
  if(blank)add('Blank page: nothing rendered inside #root.');
  if(phone&&await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2).catch(()=>false))add('Layout overflow: the page scrolls sideways on a 390px phone screen.');
  if(screenshot)shot=(await page.screenshot({type:'jpeg',quality:60})).toString('base64');
  if(scan)scanned=(await page.evaluate(SCAN,{max:MAX_ELEMENTS}).catch(()=>null)||{}).elements||null;
 }catch(e){add('Page did not load: '+e.message)}
 finally{await context.close().catch(()=>{})}
 return{skipped:false,errors,external,steps:results,text:String(text||'').replace(/\n{3,}/g,'\n\n').slice(0,4000),screenshot:shot,...(scanned?{elements:scanned}:{})};
}
// ---------- other websites (synthetic customers on any public link) ----------
// A public website someone has permission to test, e.g. the same app built elsewhere. Chromium
// reaches it only through a local proxy that resolves names itself and connects only to public
// addresses on port 443, so neither links nor DNS tricks can reach internal hosts. Requests
// that would change something (POST, PUT, PATCH, DELETE) are answered locally and never sent:
// nothing is booked, emailed or paid on the real site.
const KAIROQ_TEST_LOCAL=()=>process.env.NODE_ENV==='test'&&process.env.KAIROQ_EXTERNAL_ALLOW_LOCAL==='1';
let proxyPromise=null,externalBrowserPromise=null;
function startProxy(){
 if(!proxyPromise)proxyPromise=new Promise((resolve,reject)=>{
  const http=require('http'),net=require('net'),{guardedLookup}=require('./react-functions');
  const server=http.createServer((req,res)=>{res.writeHead(403);res.end('Only https is allowed')});
  server.on('connect',(req,client,head)=>{
   const m=/^([a-z0-9.-]+):(\d+)$/i.exec(String(req.url||''));
   if(!m||m[2]!=='443'||!m[1].includes('.')){client.end('HTTP/1.1 403 Forbidden\r\n\r\n');return}
   guardedLookup(m[1],{},(err,address)=>{
    if(err){client.end('HTTP/1.1 403 Forbidden\r\n\r\n');return}
    const up=net.connect(443,address,()=>{client.write('HTTP/1.1 200 Connection Established\r\n\r\n');if(head&&head.length)up.write(head);up.pipe(client);client.pipe(up)});
    up.setTimeout(30000,()=>up.destroy());
    up.on('error',()=>client.destroy());client.on('error',()=>up.destroy());
   });
  });
  server.on('error',reject);
  server.listen(0,'127.0.0.1',()=>{server.unref();resolve(server.address().port)});
 }).catch(e=>{proxyPromise=null;throw e});
 return proxyPromise;
}
async function externalBrowser(){
 if(KAIROQ_TEST_LOCAL())return browser();
 if(!externalBrowserPromise){
  const {chromium}=require('playwright-core');
  externalBrowserPromise=startProxy().then(port=>chromium.launch({executablePath:chromiumPath(),args:['--no-sandbox','--disable-dev-shm-usage'],proxy:{server:'http://127.0.0.1:'+port,bypass:'<-loopback>'}})).catch(e=>{externalBrowserPromise=null;throw e});
 }
 const b=await externalBrowserPromise;
 if(!b.isConnected()){externalBrowserPromise=null;return externalBrowser()}
 return b;
}
// Checks a link before any test: https, a public name (not an IP address or local name) that
// resolves only to public addresses, no credentials, no unusual port.
async function checkSite(raw){
 let u;try{u=new URL(String(raw||'').trim())}catch{throw Object.assign(Error('Enter a full link, like https://example.com'),{status:400})}
 const local=KAIROQ_TEST_LOCAL()&&u.protocol==='http:'&&u.hostname==='127.0.0.1';
 if(!local){
  if(u.protocol!=='https:')throw Object.assign(Error('Only https links can be tested'),{status:400});
  if(u.username||u.password||(u.port&&u.port!=='443'))throw Object.assign(Error('Links with a password or an unusual port cannot be tested'),{status:400});
  if(privateHost(u.hostname))throw Object.assign(Error('Only public websites can be tested'),{status:400});
  const {guardedLookup}=require('./react-functions');
  await new Promise((resolve,reject)=>guardedLookup(u.hostname,{},err=>err?reject(Object.assign(Error(err.code==='EBLOCKED'?'Only public websites can be tested':'That website could not be found'),{status:400})):resolve()));
 }
 u.hash=u.hash||'';
 return u.href.slice(0,500);
}
// human(): true while a person has taken over the browser (see session().control): their own
// clicks may send forms and leave the site (a captcha check, a sign-in page), like in their own browser.
async function guardSite(context,url,{onSent,human=()=>false}={}){
 const origin=new URL(url).origin,local=KAIROQ_TEST_LOCAL();
 await context.route('**/*',r=>{
  const req=r.request();let u;try{u=new URL(req.url())}catch{return r.abort()}
  if(u.protocol==='data:'||u.protocol==='blob:')return r.continue();
  if(!(u.protocol==='https:'||(local&&u.origin===origin)))return r.abort();
  // The visitor stays on the site: links to other sites do nothing.
  if(req.isNavigationRequest()&&req.frame()===req.frame().page().mainFrame()&&u.origin!==origin&&!human())return r.abort();
  if(!['GET','HEAD','OPTIONS'].includes(req.method())&&!human()){
   if(onSent)onSent(req);
   return req.resourceType()==='document'?r.fulfill({status:204,body:''}):r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{}'});
  }
  return r.continue();
 });
}

// What a browsing agent sees of the page (runs inside the page). Interactive elements are
// found the way people find them: native controls, ARIA roles, click handlers (also React's
// onClick, which is not an attribute), tabindex, contenteditable and a pointer cursor; open
// shadow roots are searched too. Elements covered by something else (a cookie banner, a modal)
// are left out, because a person could not click them either. Each element keeps its number
// for as long as it stays on the page; elements that appeared since the last look are marked
// new. Password values are never read.
const MAX_ELEMENTS=120;
function SCAN({max}){
 const ROLES=new Set(['button','link','tab','checkbox','radio','switch','menuitem','menuitemcheckbox','menuitemradio','option','combobox','textbox','searchbox','slider','spinbutton','treeitem','gridcell']);
 const NATIVE=new Set(['a','button','input','select','textarea','summary']);
 const vw=innerWidth,vh=innerHeight;
 const all=[];
 (function walk(root){for(const e of root.querySelectorAll('*')){if(all.length>6000)return;all.push(e);if(e.shadowRoot)walk(e.shadowRoot)}})(document);
 const style=new Map(),css=e=>{let v=style.get(e);if(!v){v=getComputedStyle(e);style.set(e,v)}return v};
 const reactClick=e=>{for(const k in e){if(k.startsWith('__reactProps$')){const p=e[k];return Boolean(p&&(p.onClick||p.onMouseDown||p.onPointerDown||p.onTouchStart))}}return false};
 const parentOf=e=>e.parentElement||(e.getRootNode()&&e.getRootNode().host)||null;
 function interactive(e){
  const tag=e.tagName.toLowerCase();
  if(tag==='input'&&e.type==='hidden')return false;
  if(tag==='a')return e.hasAttribute('href')||reactClick(e);
  if(NATIVE.has(tag))return true;
  const role=e.getAttribute('role');
  if(role&&ROLES.has(role))return true;
  if(e.isContentEditable&&!(parentOf(e)&&parentOf(e).isContentEditable))return true;
  if(e.hasAttribute('onclick')||reactClick(e))return true;
  const ti=e.getAttribute('tabindex');if(ti!==null&&Number(ti)>=0&&tag!=='div'&&tag!=='section'&&tag!=='main')return true;
  // A pointer cursor marks something clickable; only the outermost element with it counts.
  if(css(e).cursor==='pointer'){const p=parentOf(e);return!(p&&p.nodeType===1&&css(p).cursor==='pointer')}
  return false;
 }
 function visible(e){
  const r=e.getBoundingClientRect();if(r.width<2||r.height<2)return null;
  const s=css(e);if(s.visibility==='hidden'||s.display==='none'||Number(s.opacity)<0.05)return null;
  return r;
 }
 // Covered: the topmost thing at the element's centre is neither it, inside it, nor around it.
 function covered(e,r){
  const x=r.left+r.width/2,y=r.top+r.height/2;
  if(x<0||y<0||x>vw||y>vh)return false;
  const root=e.getRootNode();const hit=(root.elementFromPoint?root:document).elementFromPoint(x,y);
  if(!hit)return false;
  return!(hit===e||e.contains(hit)||hit.contains(e)||(hit.closest&&hit.closest('label')&&hit.closest('label').control===e));
 }
 const label=e=>{
  const lab=e.id&&document.querySelector('label[for="'+CSS.escape(e.id)+'"]');
  const by=e.getAttribute('aria-labelledby');const byText=by?by.split(/\s+/).map(i=>{const x=document.getElementById(i);return x?x.innerText:''}).join(' '):'';
  return [e.getAttribute('aria-label'),byText,lab&&lab.innerText,e.closest('label')&&e.closest('label').innerText,e.placeholder,e.innerText,e.value&&(e.type==='submit'||e.type==='button')?e.value:'',e.getAttribute('alt'),e.title,(e.querySelector&&e.querySelector('img[alt]')||{}).alt,e.name].map(x=>String(x||'').trim()).find(Boolean)||'';
 };
 const first=!window.__kqSeen;window.__kqSeen=true;
 window.__kqNext=window.__kqNext||0;
 const found=[];
 for(const e of all){
  if(!interactive(e))continue;
  const r=visible(e);if(!r)continue;
  if(covered(e,r))continue;
  found.push([e,r]);
 }
 // A clickable box inside another clickable box with the same text is the same target.
 const set=new Set(found.map(x=>x[0]));
 const kept=found.filter(([e])=>{if(NATIVE.has(e.tagName.toLowerCase()))return true;let p=parentOf(e);while(p&&p.nodeType===1){if(set.has(p)&&p.innerText===e.innerText)return false;p=parentOf(p)}return true});
 // In view first, then nearest; the list stays in page order.
 const dist=r=>r.bottom<0?-r.bottom:r.top>vh?r.top-vh:0;
 const chosen=new Set(kept.slice().sort((a,b)=>dist(a[1])-dist(b[1])).slice(0,max).map(x=>x[0]));
 const elements=[];
 for(const [e,r] of kept){
  if(!chosen.has(e))continue;
  let id=Number(e.getAttribute('data-kq-id'));const isNew=!id;
  if(!id){id=++window.__kqNext;e.setAttribute('data-kq-id',String(id))}
  const tag=e.tagName.toLowerCase(),role=e.getAttribute('role'),at=e.closest('[data-kq]');
  const kind=tag==='input'?'input:'+(e.type||'text'):tag==='a'?'link':role||(NATIVE.has(tag)?tag:e.isContentEditable?'textbox':'clickable');
  elements.push({id,kind,label:label(e).replace(/\s+/g,' ').slice(0,80),
   ...(at?{loc:at.getAttribute('data-kq')}:{}),
   ...(e.placeholder?{ph:String(e.placeholder).slice(0,80)}:{}),
   ...(tag==='select'?{options:[...e.options].map(o=>o.text).slice(0,12)}:{}),
   ...(e.value&&tag!=='button'&&e.type!=='submit'&&e.type!=='button'?{value:e.type==='password'?'(filled)':String(e.value).slice(0,40)}:{}),
   ...((e.type==='checkbox'||e.type==='radio')?{checked:e.checked}:{}),
   ...(e.disabled||e.getAttribute('aria-disabled')==='true'?{disabled:true}:{}),
   ...(e.getAttribute('aria-expanded')?{expanded:e.getAttribute('aria-expanded')==='true'}:{}),
   ...(r.bottom<0?{where:'above'}:r.top>vh?{where:'below'}:{}),
   ...(isNew&&!first?{new:true}:{})});
 }
 const de=document.documentElement;
 return{
  title:document.title,
  text:(document.body?document.body.innerText:'').replace(/\n{2,}/g,'\n').slice(0,3000),
  scroll:{y:Math.round(scrollY),height:Math.round(de.scrollHeight),view:vh},
  dialog:Boolean(document.querySelector('dialog[open],[role=dialog]:not([aria-hidden=true]),[aria-modal=true]')),
  elements
 };
}
// A browsing session a synthetic customer drives step by step (see synthetic-customers.js):
// observe() lists what is on screen with numbered interactive elements, act() clicks, types,
// selects, scrolls or goes back. Same guard as inspect(): the browser stays inside the app.
// site: true for another website (see guardSite); observe() then counts the forms a visitor sent.
// record: keep the page's own GET responses (pages and data requests, up to 40) so a web watch
// can learn which request holds its answer (see web-replay.js).
async function session(url,{sandbox,viewport,timeoutMs=15000,site=false,record=false}={}){
 if(!available())return null;
 const phone=viewport==='phone';
 const context=await (await (site?externalBrowser():browser())).newContext(phone?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{viewport:{width:1280,height:800}});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>{if(errors.length<10)errors.push('Uncaught error: '+String(e.message||e).slice(0,300))});
 // Sends right after a visitor's click or typing count as the visitor sending a form (not
 // analytics pings, which happen on their own).
 let lastAct=0,sent=0;
 let human=false;
 if(site)await guardSite(context,url,{human:()=>human,onSent:req=>{if(Date.now()-lastAct<4000&&['document','xhr','fetch'].includes(req.resourceType()))sent++}});
 else await guard(context,url,{sandbox});
 const root=new URL('./',url);
 const settle=async()=>{await page.waitForLoadState('networkidle',{timeout:3000}).catch(()=>{});await page.waitForTimeout(350)};
 let status=0;page.on('response',r=>{if(r.request().isNavigationRequest()&&r.frame()===page.mainFrame())status=r.status()});
 const recorded=[];let recordedBytes=0;
 if(record)page.on('response',r=>{
  const req=r.request();
  if(recorded.length>=40||req.method()!=='GET'||r.status()!==200||!['document','xhr','fetch'].includes(req.resourceType()))return;
  const type=String(r.headers()['content-type']||'');if(!/json|html|text\/plain/i.test(type))return;
  recorded.push(r.text().then(body=>{if(body.length>2e6||recordedBytes+body.length>8e6)return null;recordedBytes+=body.length;return{url:r.url(),method:'GET',status:200,type,body}}).catch(()=>null));
 });
 try{await page.goto(url,{waitUntil:'load',timeout:timeoutMs});await settle()}
 catch(e){await context.close().catch(()=>{});throw Object.assign(Error('Page did not load: '+e.message),{status:502})}
 async function observe(){
  const snap=await page.evaluate(SCAN,{max:MAX_ELEMENTS}).catch(()=>({title:'',text:'',elements:[]}));
  const u=new URL(page.url());
  const out={path:(u.pathname.startsWith(root.pathname)?'/'+u.pathname.slice(root.pathname.length):u.pathname)+u.hash,...snap,errors:errors.slice()};
  if(site){out.sent=sent;sent=0}
  return out;
 }
 async function act(a){
  lastAct=Date.now();
  const loc=n=>page.locator('[data-kq-id="'+Number(n)+'"]').first();
  if(a.action==='click'){
   const el=loc(a.target);
   // Something on top (an animation, a sticky bar) can swallow a real click; a direct click
   // on the element is the fallback, as a person would tap again.
   try{await el.click({timeout:4000})}catch(e){if(!/intercept|not visible|outside of the viewport|timeout/i.test(String(e.message)))throw e;await el.evaluate(x=>x.click(),null,{timeout:2000})}
  }
  else if(a.action==='fill'){
   const el=loc(a.target);
   await el.fill(String(a.value??'').slice(0,300),{timeout:4000}).catch(async e=>{if(!/not an <input>|contenteditable/i.test(String(e.message)))throw e;await el.click({timeout:2000});await page.keyboard.type(String(a.value??'').slice(0,300))});
   if(a.submit)await el.press('Enter',{timeout:2000});
  }
  else if(a.action==='select')await loc(a.target).selectOption({label:String(a.value??'')},{timeout:4000}).catch(()=>loc(a.target).selectOption(String(a.value??''),{timeout:4000}));
  else if(a.action==='scroll'){
   if(a.target!==undefined&&a.target!==null&&a.target!=='')await loc(a.target).scrollIntoViewIfNeeded({timeout:3000});
   else await page.mouse.wheel(0,a.value==='up'?-650:650);
  }
  else if(a.action==='back')await page.goBack({timeout:timeoutMs}).catch(()=>{});
  else if(a.action==='key'){
   const key=String(a.value||'');
   if(!/^(Enter|Escape|Tab|Shift\+Tab|Space|Backspace|Arrow(Up|Down|Left|Right)|PageUp|PageDown|Home|End)$/.test(key))throw Error('Unknown key (use Enter, Escape, Tab, Space, arrows, PageDown)');
   if(a.target!==undefined&&a.target!==null&&a.target!=='')await loc(a.target).press(key==='Space'?' ':key,{timeout:3000});else await page.keyboard.press(key==='Space'?' ':key);
  }
  else if(a.action==='hover')await loc(a.target).hover({timeout:4000});
  else if(a.action==='wait')await page.waitForTimeout(Math.min(3000,Math.max(300,Number(a.value)||1000)));
  else if(a.action==='find_text'){
   const hit=page.getByText(String(a.value||'').slice(0,100),{exact:false}).first();
   if(!await hit.count())throw Error('That text is not on this page');
   await hit.scrollIntoViewIfNeeded({timeout:3000});
  }
  else if(a.action==='go_to'){
   // Same site only: a path or a full link on the site being visited.
   const next=new URL(String(a.value||''),page.url());
   if(next.origin!==new URL(url).origin||(!site&&!next.pathname.startsWith(root.pathname)))throw Error('go_to stays on this site');
   await page.goto(next.href,{waitUntil:'load',timeout:timeoutMs});
  }
  else throw Error('Unknown action');
  await settle();
 }
 // Plain facts about the page for the website check: phone layout, basic SEO, images, speed.
 async function audit(){
  return page.evaluate(()=>{
   const nav=performance.getEntriesByType('navigation')[0];
   const imgs=[...document.images].filter(i=>{const r=i.getBoundingClientRect();return r.width>40&&r.height>40});
   return{
    viewport:Boolean(document.querySelector('meta[name=viewport]')),
    description:(document.querySelector('meta[name=description]')||{}).content||'',
    title:document.title||'',
    h1:document.querySelectorAll('h1').length,
    lang:document.documentElement.lang||'',
    overflow:Math.max(0,document.documentElement.scrollWidth-window.innerWidth),
    images:imgs.length,
    images_no_alt:imgs.filter(i=>!String(i.getAttribute('alt')||'').trim()).length,
    load_ms:nav?Math.round(nav.loadEventEnd||nav.domContentLoadedEventEnd||0):null,
    forms:document.forms.length,
    small_text:[...document.querySelectorAll('p,li,a,span,label')].slice(0,400).filter(e=>{const r=e.getBoundingClientRect();if(!r.width||!e.innerText.trim())return false;return parseFloat(getComputedStyle(e).fontSize)<12}).length
   };
  }).catch(()=>null);
 }
 // Readable text of the whole page (not only what is in view), for reading prices or details.
 async function read(max=20000){return page.evaluate(m=>(document.body?document.body.innerText:'').replace(/\n{3,}/g,'\n\n').slice(0,m),max).catch(()=>'')}
 // A person takes over (a captcha, a sign-in): they see live frames and send their own
 // clicks, typing, keys and scrolling. While they are in control their actions really go
 // through; when they hand back, the browser is read-only again.
 const control={
  start(){human=true},
  stop(){human=false},
  get active(){return human},
  frame:()=>page.screenshot({type:'jpeg',quality:55}).catch(()=>null),
  async input(ev){
   if(!human)throw Object.assign(Error('Take over first'),{status:409});
   const vp=page.viewportSize()||{width:1280,height:800};
   if(ev.type==='click'){const x=Number(ev.x),y=Number(ev.y);if(!(x>=0&&y>=0&&x<=vp.width&&y<=vp.height))throw Object.assign(Error('Outside the page'),{status:400});await page.mouse.click(x,y)}
   else if(ev.type==='type')await page.keyboard.type(String(ev.text||'').slice(0,500),{delay:20});
   else if(ev.type==='key'){const k=String(ev.key||'');if(!/^(Enter|Escape|Tab|Backspace|Delete|Space|Arrow(Up|Down|Left|Right)|PageUp|PageDown|Home|End)$/.test(k))throw Object.assign(Error('Unknown key'),{status:400});await page.keyboard.press(k==='Space'?' ':k)}
   else if(ev.type==='scroll')await page.mouse.wheel(0,Math.max(-2000,Math.min(2000,Number(ev.dy)||0)));
   else if(ev.type==='back')await page.goBack({timeout:timeoutMs}).catch(()=>{});
   else throw Object.assign(Error('Unknown input'),{status:400});
   await page.waitForTimeout(150);
  }
 };
 return{observe,act,audit,read,control,responses:async()=>(await Promise.all(recorded)).filter(Boolean),status:()=>status,url:()=>page.url(),screenshot:()=>page.screenshot({type:'jpeg',quality:55}).then(b=>b.toString('base64')).catch(()=>null),close:()=>context.close().catch(()=>{})};
}
// Renders a small HTML document offline (no network) to PNG, e.g. app icons.
async function renderHtml(html,{width,height}){
 if(!available())throw Error('Chromium is not available');
 const context=await (await browser()).newContext({viewport:{width,height},deviceScaleFactor:1});
 try{
  const page=await context.newPage();
  await page.route('**/*',r=>r.request().url().startsWith('data:')?r.continue():r.abort());
  await page.setContent(html,{waitUntil:'load',timeout:10000});
  return await page.screenshot({type:'png',clip:{x:0,y:0,width,height}});
 }finally{await context.close().catch(()=>{})}
}
async function close(){for(const k of ['browserPromise','externalBrowserPromise']){const p=k==='browserPromise'?browserPromise:externalBrowserPromise;if(!p)continue;if(k==='browserPromise')browserPromise=null;else externalBrowserPromise=null;const b=await p.catch(()=>null);await b?.close().catch(()=>{})}}
module.exports={deadClicks,check,screenshot,inspect,session,checkSite,startProxy,designShots,renderHtml,available,close,browser};

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
 }catch(e){add('Page did not load: '+e.message)}
 finally{await context.close().catch(()=>{})}
 return{skipped:false,errors};
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
async function inspect(url,{steps=[],screenshot=true,timeoutMs=15000,sandbox,viewport}={}){
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
 let text='',shot=null;
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
 }catch(e){add('Page did not load: '+e.message)}
 finally{await context.close().catch(()=>{})}
 return{skipped:false,errors,external,steps:results,text:String(text||'').replace(/\n{3,}/g,'\n\n').slice(0,4000),screenshot:shot};
}
// A browsing session a synthetic customer drives step by step (see synthetic-customers.js):
// observe() lists what is on screen with numbered interactive elements, act() clicks, types,
// selects, scrolls or goes back. Same guard as inspect(): the browser stays inside the app.
async function session(url,{sandbox,viewport,timeoutMs=15000}={}){
 if(!available())return null;
 const phone=viewport==='phone';
 const context=await (await browser()).newContext(phone?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{viewport:{width:1280,height:800}});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>{if(errors.length<10)errors.push('Uncaught error: '+String(e.message||e).slice(0,300))});
 await guard(context,url,{sandbox});
 const root=new URL('./',url);
 const settle=async()=>{await page.waitForLoadState('networkidle',{timeout:3000}).catch(()=>{});await page.waitForTimeout(350)};
 try{await page.goto(url,{waitUntil:'load',timeout:timeoutMs});await settle()}
 catch(e){await context.close().catch(()=>{});throw Object.assign(Error('Page did not load: '+e.message),{status:502})}
 async function observe(){
  const snap=await page.evaluate(()=>{
   const vis=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'};
   const label=e=>{
    const lab=e.id&&document.querySelector('label[for="'+CSS.escape(e.id)+'"]');
    return [e.getAttribute('aria-label'),lab&&lab.innerText,e.closest('label')&&e.closest('label').innerText,e.placeholder,e.innerText,e.value&&e.type==='submit'?e.value:'',e.title,e.name].map(x=>String(x||'').trim()).find(Boolean)||'';
   };
   document.querySelectorAll('[data-kq-id]').forEach(e=>e.removeAttribute('data-kq-id'));
   const els=[...document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=link],[role=tab],[role=checkbox],[role=switch],summary')].filter(vis).slice(0,70);
   return{
    title:document.title,
    text:(document.body?document.body.innerText:'').replace(/\n{2,}/g,'\n').slice(0,2500),
    elements:els.map((e,i)=>{e.setAttribute('data-kq-id',String(i+1));const tag=e.tagName.toLowerCase();return{id:i+1,kind:tag==='input'?'input:'+(e.type||'text'):tag==='a'?'link':e.getAttribute('role')||tag,label:label(e).replace(/\s+/g,' ').slice(0,80),...(tag==='select'?{options:[...e.options].map(o=>o.text).slice(0,12)}:{}),...(e.value&&tag!=='button'&&e.type!=='submit'?{value:String(e.value).slice(0,40)}:{})}})
   };
  }).catch(()=>({title:'',text:'',elements:[]}));
  const u=new URL(page.url());
  return{path:(u.pathname.startsWith(root.pathname)?'/'+u.pathname.slice(root.pathname.length):u.pathname)+u.hash,...snap,errors:errors.slice()};
 }
 async function act(a){
  const loc=n=>page.locator('[data-kq-id="'+Number(n)+'"]').first();
  if(a.action==='click')await loc(a.target).click({timeout:4000});
  else if(a.action==='fill')await loc(a.target).fill(String(a.value??'').slice(0,300),{timeout:4000});
  else if(a.action==='select')await loc(a.target).selectOption({label:String(a.value??'')},{timeout:4000}).catch(()=>loc(a.target).selectOption(String(a.value??''),{timeout:4000}));
  else if(a.action==='scroll')await page.mouse.wheel(0,a.value==='up'?-600:600);
  else if(a.action==='back')await page.goBack({timeout:timeoutMs}).catch(()=>{});
  else throw Error('Unknown action');
  await settle();
 }
 return{observe,act,close:()=>context.close().catch(()=>{})};
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
async function close(){if(browserPromise){const b=await browserPromise.catch(()=>null);browserPromise=null;await b?.close().catch(()=>{})}}
module.exports={check,screenshot,inspect,session,designShots,renderHtml,available,close,browser};

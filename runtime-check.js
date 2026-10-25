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
  // Software WebGL (SwiftShader), so apps that show 3D can be checked on a server with no GPU.
  browserPromise=chromium.launch({executablePath:chromiumPath(),args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']}).catch(e=>{browserPromise=null;throw e});
 }
 const b=await browserPromise;
 if(!b.isConnected()){browserPromise=null;return browser()}
 return b;
}
// Safari's engine (WebKit, via Playwright) for "iPhone Safari" checks. Installed in the Docker
// image unless built with KAIROQ_WEBKIT=off; without it those checks are skipped, not failed.
let webkitPromise=null;
function webkitAvailable(){
 if(process.env.KAIROQ_WEBKIT==='off')return false;
 try{return fs.existsSync(require('playwright-core').webkit.executablePath())}catch{return false}
}
async function webkitBrowser(){
 if(!webkitPromise)webkitPromise=require('playwright-core').webkit.launch().catch(e=>{webkitPromise=null;throw e});
 const b=await webkitPromise;if(!b.isConnected()){webkitPromise=null;return webkitBrowser()}
 return b;
}
// A screenshot of a page in Safari's engine at a phone or tablet size (the editor's "Real Safari").
async function safariShot(url,{width=393,height=659,ipad=false,timeoutMs=20000}={}){
 if(!webkitAvailable())throw Object.assign(Error('Safari\'s engine (WebKit) is not installed on this server.'),{status:409});
 const w=Math.max(320,Math.min(1024,Number(width)||393)),hgt=Math.max(400,Math.min(1366,Number(height)||659));
 const context=await (await webkitBrowser()).newContext({viewport:{width:w,height:hgt},deviceScaleFactor:2,isMobile:true,hasTouch:true,
  userAgent:ipad?'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1':DEVICES_UA});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>{if(errors.length<5)errors.push('Uncaught error: '+String(e.message||e).slice(0,200))});
 try{
  await page.goto(url,{waitUntil:'load',timeout:timeoutMs});
  await page.waitForLoadState('networkidle',{timeout:5000}).catch(()=>{});
  await page.waitForTimeout(400);
  return{screenshot:(await page.screenshot({type:'jpeg',quality:70})).toString('base64'),errors,width:w,height:hgt};
 }finally{await context.close().catch(()=>{})}
}
const DEVICES_UA='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
// How each device is opened. "slow" is a mid-range phone on a slow 3G connection: 400 ms
// round trips, 400 kbit/s each way, and a processor 4 times slower (Chrome DevTools' Slow 3G).
const DEVICES={
 desktop:{label:'Desktop',options:{viewport:{width:1280,height:800}}},
 phone:{label:'Phone',phone:true,options:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}},
 iphone:{label:'iPhone Safari',phone:true,webkit:true,options:{viewport:{width:390,height:664},deviceScaleFactor:3,isMobile:true,hasTouch:true,
  userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'}},
 slow:{label:'Slow phone',phone:true,slow:true,options:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}},
};
const SLOW_READY_MS=Number(process.env.KAIROQ_SLOW_READY_MS)||10000;
function devicesAvailable(){return available()?['desktop','phone',...(webkitAvailable()?['iphone']:[]),'slow']:[]}
async function slowDown(context,page){
 const cdp=await context.newCDPSession(page);
 await cdp.send('Network.enable');
 await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:400,downloadThroughput:400*1024/8,uploadThroughput:400*1024/8});
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
}
const IGNORED=/favicon\.ico|Download the React DevTools|net::ERR_ABORTED/;
// ---------- fast lane: Lightpanda ----------
// Lightpanda (a light headless browser, AGPL-3.0, run unmodified as its own process and driven
// over CDP) opens apps in a fraction of Chromium's time and memory. It has no real rendering, so
// it only does checks that need none: does a live page start without errors (the hourly live
// guard) and reading pages for search engines. Anything it reports as broken is confirmed in
// Chromium before it counts, and any error of its own falls back to Chromium. Off unless the
// binary is installed (Dockerfile ARG KAIROQ_LIGHTPANDA=on); telemetry is switched off.
function lightpandaPath(){if(process.env.KAIROQ_LIGHTPANDA==='off')return null;return[process.env.KAIROQ_LIGHTPANDA_PATH,'/usr/local/bin/lightpanda'].find(p=>p&&fs.existsSync(p))||null}
let fastPromise=null,fastProc=null;
async function fastBrowser(){
 const bin=lightpandaPath();if(!bin)return null;
 if(!fastPromise){
  fastPromise=(async()=>{
   const {chromium}=require('playwright-core'),port=String(19300+Math.floor(Math.random()*600));
   fastProc=require('child_process').spawn(bin,['serve','--host','127.0.0.1','--port',port,'--disable-metrics'],{env:{PATH:process.env.PATH||'',HOME:process.env.HOME||'/tmp',LIGHTPANDA_DISABLE_TELEMETRY:'true'},stdio:'ignore'});
   fastProc.on('exit',()=>{fastPromise=null;fastProc=null});
   let last;for(let i=0;i<40;i++){try{return await chromium.connectOverCDP('http://127.0.0.1:'+port)}catch(e){last=e;await new Promise(r=>setTimeout(r,150))}}
   throw last||Error('Lightpanda did not start');
  })().catch(e=>{fastPromise=null;try{fastProc&&fastProc.kill()}catch{}throw e});
 }
 const b=await fastPromise;
 if(!b.isConnected()){fastPromise=null;try{fastProc&&fastProc.kill()}catch{}return fastBrowser()}
 return b;
}
let fastStats={runs:0,fallbacks:0,confirmed:0};
// The page check in Lightpanda: uncaught errors, failed own requests, blank page.
async function fastCheck(url,{timeoutMs=15000}={}){
 const b=await fastBrowser();if(!b)return null;
 const ctx=b.contexts()[0]||await b.newContext(),page=await ctx.newPage(),errors=[];
 const add=e=>{const text=String(e).slice(0,500);if(!IGNORED.test(text)&&!errors.includes(text)&&errors.length<10)errors.push(text)};
 const own=u=>{try{return new URL(u).origin===new URL(url).origin}catch{return false}};
 page.on('pageerror',e=>add('Uncaught error: '+(e.stack||e.message||e)));
 page.on('response',r=>{if(r.status()>=500&&own(r.url()))add('HTTP '+r.status()+' from '+r.request().method()+' '+r.url())});
 try{
  await page.goto(url,{waitUntil:'load',timeout:timeoutMs});
  await page.waitForTimeout(800);
  const blank=await page.evaluate(()=>{const root=document.getElementById('root');return!root||(!root.innerText.trim()&&!root.querySelector('img,svg,canvas,video,input,button'))});
  if(blank)add('Blank page: nothing rendered inside #root.');
  return{skipped:false,errors,facts:{opened:!blank},engine:'lightpanda'};
 }finally{await page.close().catch(()=>{})}
}
// sandbox: the app's data requests go to a test copy of its data (react-sandbox.js).
// journey: also add a record the way a customer would (savesData below).
async function check(url,{timeoutMs=15000,sandbox,journey=false,fast=false}={}){
 // A plain "does it start" check can take the fast lane; a problem found there is confirmed below.
 if(fast&&!sandbox&&!journey&&lightpandaPath()){
  fastStats.runs++;
  try{const r=await fastCheck(url,{timeoutMs});if(r&&!r.errors.length)return r;if(r)fastStats.confirmed++}
  catch(e){fastStats.fallbacks++}
 }
 if(!available())return{skipped:true,errors:[]};
 const context=await (await browser()).newContext({viewport:{width:1280,height:800}});
 if(sandbox){const appId=(/\/builder\/p\/([a-f0-9]{12})-/.exec(new URL(url).pathname)||[])[1],origin=new URL(url).origin;await context.route('**/*',r=>{let u;try{u=new URL(r.request().url())}catch{return r.continue()}return appId&&u.origin===origin&&u.pathname.startsWith('/api/apps/'+appId+'/')?r.continue({headers:{...r.request().headers(),'x-kairoq-sandbox':sandbox}}):r.continue()})}
 const page=await context.newPage(),errors=[];
 let saved=null;const facts={};
 const add=e=>{const text=String(e).slice(0,500);if(!IGNORED.test(text)&&!errors.includes(text)&&errors.length<10)errors.push(text)};
 // Images or fonts from other sites that fail to load are not bugs in the app's code
 // (and can't be fixed by the AI), so they are not reported as problems here.
 const own=u=>{try{return new URL(u).origin===new URL(url).origin}catch{return false}};
 page.on('pageerror',e=>add('Uncaught error: '+(e.stack||e.message||e)));
 page.on('console',m=>{if(m.type()==='error'){const at=m.location()?.url;if(/Failed to load resource/.test(m.text())&&at&&!own(at))return;add('Console error: '+m.text()+(at&&/Failed to load resource/.test(m.text())?' ('+at+')':''))}});
 page.on('requestfailed',r=>{if(own(r.url()))add('Request failed: '+r.method()+' '+r.url()+' ('+(r.failure()?.errorText||'failed')+')')});
 const pending=[];
 page.on('response',r=>{if(r.status()>=400&&own(r.url()))pending.push(r.text().then(t=>{let why='';try{why=JSON.parse(t).error||''}catch{}add('HTTP '+r.status()+' from '+r.request().method()+' '+r.url()+(why?': '+String(why).slice(0,200):''))},()=>add('HTTP '+r.status()+' from '+r.request().method()+' '+r.url())))});
 try{
  await page.goto(url,{waitUntil:'load',timeout:timeoutMs});
  await page.waitForLoadState('networkidle',{timeout:5000}).catch(()=>{});
  await page.waitForTimeout(500);
  const blank=await page.evaluate(()=>{const root=document.getElementById('root');return!root||(!root.innerText.trim()&&!root.querySelector('img,svg,canvas,video,input,button'))});
  if(blank)add('Blank page: nothing rendered inside #root.');
  facts.opened=!blank;
  if(!blank){const m=await models3d(page).catch(()=>null);if(m){facts.models3d=m.facts;for(const p of m.problems)add(p)}}
  if(!blank&&process.env.KAIROQ_DEAD_CLICKS!=='off'){const dead=await deadClicks(page,url).catch(()=>[]);for(const d of dead)add(d);facts.menus={checked:dead.checked||0,dead:dead.length}}
  // The full check after a build: the phone layout, and a customer adding a record.
  if(!blank&&journey){facts.phone=await phoneFits(url,sandbox).catch(()=>null);if(facts.phone===false)add('Layout overflow: the page scrolls sideways on a 390px phone screen. Make every section fit the phone width.')}
  if(!blank&&journey&&(sandbox||process.env.NODE_ENV==='test'))saved=await savesData(context,url).catch(()=>null);
  await Promise.all(pending);
 }catch(e){add('Page did not load: '+e.message)}
 finally{await context.close().catch(()=>{})}
 return{skipped:false,errors,facts,...(saved?{journey:saved}:{})};
}
// 3D models (Model3D from 'kairoq/3d', marked data-kq-model): each one must really show, not
// just its picture, and have a height. Skipped when this browser has no WebGL.
async function models3d(page){
 if(!await page.locator('[data-kq-model]').count())return null;
 const webgl=await page.evaluate(()=>{try{const c=document.createElement('canvas');return Boolean(c.getContext('webgl2')||c.getContext('webgl'))}catch{return false}});
 if(!webgl)return{facts:{webgl:false},problems:[]};
 // Viewers start when they come into view, so bring each one on screen once.
 await page.evaluate(async()=>{for(const e of document.querySelectorAll('[data-kq-model]')){e.scrollIntoView({block:'center'});await new Promise(r=>setTimeout(r,150))}scrollTo(0,0)});
 await page.waitForFunction(()=>[...document.querySelectorAll('[data-kq-model]')].every(e=>{const mv=e.querySelector('model-viewer');return mv?mv.dataset.kqLoaded==='true':true}),null,{timeout:25000}).catch(()=>{});
 const rows=await page.evaluate(()=>[...document.querySelectorAll('[data-kq-model]')].map(e=>{const mv=e.querySelector('model-viewer');return{src:e.getAttribute('data-kq-model'),height:Math.round(e.getBoundingClientRect().height),viewer:Boolean(mv),loaded:Boolean(mv&&mv.dataset.kqLoaded==='true')}}));
 const problems=[];
 for(const r of rows){
  if(r.height<80)problems.push('3D viewer for '+r.src+' is only '+r.height+'px tall: give the Model3D a fixed height (for example className="h-[60vh] w-full").');
  else if(!r.viewer)problems.push('3D model '+r.src+' did not load, so only its picture shows. Check the src is one of the project\'s ./models/ files.');
  else if(!r.loaded)problems.push('3D model '+r.src+' took more than 25 seconds to show.');
 }
 return{facts:{webgl:true,models:rows.length,shown:rows.filter(r=>r.loaded).length},problems};
}
// Whether the page fits a 390 px phone screen without scrolling sideways.
async function phoneFits(url,sandbox){
 const ctx=await (await browser()).newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 try{
  if(sandbox)await guard(ctx,url,{sandbox});
  const p=await ctx.newPage();
  await p.goto(url,{waitUntil:'load',timeout:15000});await p.waitForLoadState('networkidle',{timeout:4000}).catch(()=>{});await p.waitForTimeout(300);
  return await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+8);
 }finally{await ctx.close().catch(()=>{})}
}
// The main journey of an app that keeps records (a CRM, bookings, tasks): sign up when the app
// asks for it, add a record with its add form, then reload. Returns {token, shown, reloaded}:
// whether the new record showed in a list on the page, and whether it was still there after the
// reload. The caller checks the app's database for the token (react-builder.js). Runs only on a
// test copy of the data, and returns null whenever it cannot tell: no add form, a form that
// leads elsewhere, a thank-you message instead of a list.
// The button that sends a form: an explicit submit button, else the first plain button that is
// not another way in (Google) or a switch between sign-in and sign-up.
async function submitButton(form){
 // Last: a type="button" that says what it does, for fields that are not in a <form>.
 for(const sel of ['button[type=submit],input[type=submit]','button:not([type])','button[type=button]']){
  for(const b of await form.locator(sel).all()){
   if(!(await b.isVisible().catch(()=>false)))continue;
   const t=(await b.innerText().catch(()=>'')||await b.getAttribute('value').catch(()=>'')||'').trim();
   if(/google|apple|facebook|github|microsoft/i.test(t))continue;
   if(sel!=='button[type=submit],input[type=submit]'&&/^(new|already|don.?t|no account)|account\?|instead/i.test(t))continue;
   if(sel==='button[type=button]'&&!/^(save|add|create|submit|book|send|request|confirm|continue|next|reserve)\b/i.test(t))continue;
   return b;
  }
 }
 return null;
}
// Buttons that open a form to add something: "+ Add contact", "New task", "Book this walk"...
const OPENS_FORM=/^\s*(\+\s*)?(add|new|create|book|request|reserve|arrange|schedule|log|share|plan|enquire|get a quote|send an? (enquiry|request))\b/i;
const SIGN_IN=/^\s*([a-z]+ )?(sign ?in|log ?in|sign ?up|create (an |your )?account|register|get started)\s*$/i;
async function savesData(context,url){
 const tab=await context.newPage(),visible=l=>l.isVisible().catch(()=>false);
 // The app's own API calls that fail while a customer signs up and adds a record (a save
 // the server refuses is the clearest sign the app keeps nothing). "Sign in first" (401) and
 // checkout are the app asking for more, not a failure.
 const apiErrors=[],calls=[];
 tab.on('response',r=>{let u;try{u=new URL(r.url())}catch{return}if(r.status()<400||r.status()===401||!/^\/api\/apps\/[a-f0-9]{12}\//.test(u.pathname)||/\/auth\/(signin|user)$|\/payments\//.test(u.pathname))return;calls.push(r.text().then(t=>{let why='';try{why=JSON.parse(t).error||''}catch{}const line='HTTP '+r.status()+' from '+r.request().method()+' '+u.pathname+(why?': '+String(why).slice(0,200):'');if(!apiErrors.includes(line)&&apiErrors.length<6)apiErrors.push(line)},()=>{}))});
 let signedUp=false,submitted=false;
 // Not seen in a list: the caller still looks for the record in the app's data (a booking or
 // order form shows a thank-you instead). Nothing to report when no form was sent.
 const failed=async()=>{await Promise.all(calls);if(apiErrors.length)return{token,shown:false,reloaded:false,signed_up:signedUp,api_errors:apiErrors};return submitted||signedUp?{token,shown:false,reloaded:false,signed_up:signedUp,submitted}:null};
 const token='Kq'+String(100000+Math.floor(Math.random()*900000));
 const password='Kq-test-'+token+'!';
 // Dates a week ahead (bookings refuse past days), each later field a day after the one
 // before, so a check-out comes after its check-in.
 const day=n=>new Date(Date.now()+(7+n)*86400000).toISOString().slice(0,10);
 const settle=async(ms=900)=>{await tab.waitForLoadState('networkidle',{timeout:4000}).catch(()=>{});await tab.waitForTimeout(ms)};
 const click=async l=>{try{await l.click({timeout:2500});return true}catch{return false}};
 async function fill(form,{record}){
  let named=false,dates=0;
  for(const f of await form.locator('input,textarea,select').all()){
   if(!(await visible(f))||await f.isDisabled().catch(()=>true))continue;
   try{
    const d=await f.evaluate(e=>({tag:e.tagName.toLowerCase(),type:(e.getAttribute('type')||'text').toLowerCase(),hint:[e.name,e.id,e.placeholder,e.getAttribute('aria-label'),e.labels&&e.labels[0]&&e.labels[0].innerText].join(' ').toLowerCase(),required:e.required,value:e.value}));
    if(d.tag==='select'){const opts=await f.locator('option').evaluateAll(o=>o.filter(x=>x.value&&!x.disabled).map(x=>x.value));if(opts.length)await f.selectOption(opts[0]);continue}
    if(['hidden','submit','button','reset','file','image','range','color','search'].includes(d.type))continue;
    if(d.type==='checkbox'||d.type==='radio'){if(d.required)await f.check({timeout:1500});continue}
    const date=['date','datetime-local','month'].includes(d.type)?day(dates++):'';
    const email=record?token.toLowerCase()+'@example.com':'owner'+token.slice(2)+'@example.com';
    const v=d.type==='email'||/e-?mail/.test(d.hint)?email:d.type==='password'?password:d.type==='tel'||/phone|mobile/.test(d.hint)?'555010'+token.slice(-4):d.type==='number'?'3':d.type==='date'?date:d.type==='time'?'10:30':d.type==='datetime-local'?date+'T10:30':d.type==='month'?date.slice(0,7):d.type==='url'||/website|url/.test(d.hint)?'https://example.com':d.tag==='textarea'?(record?'Note '+token:'Test'):!record?'Test Owner':named?'Sample':(named=true,token+' Test');
    await f.fill(v,{timeout:2000});
   }catch{}
  }
  const btn=await submitButton(form);
  if(!(btn&&await click(btn)))await form.evaluate(e=>e.tagName==='FORM'&&e.requestSubmit()).catch(()=>{});
  await settle();
 }
 // Creates a test account (switching the sign-in form to sign-up first). False when the app
 // has no way to sign up or the account was not made.
 async function signUp(){
  const sb=await submitButton(tab.locator('form:has(input[type=password])').first());
  const submitText=sb?await sb.innerText().catch(()=>''):'';
  if(!/sign ?up|create|register|join|get started/i.test(submitText)){
   const toggle=tab.locator('a,button,[role=tab]').filter({hasText:/^[^.!]{0,24}\b(sign ?up|create (an |your )?account|register|join now)\b[^.]{0,20}$/i}).first();
   if(!(await visible(toggle))||!(await click(toggle)))return false;
   await tab.waitForTimeout(500);
  }
  const signup=tab.locator('form:has(input[type=password])').first();
  if(!(await visible(signup)))return false;
  await fill(signup,{record:false});
  if(await visible(tab.locator('input[type=password]').first()))return false;
  return signedUp=true;
 }
 // The form a customer adds a record with: fields to type in, no password or search box, and
 // not already filled in (a profile or settings form arrives with the user's details), and
// nothing it needs is missing.
 const isAddForm=el=>el.evaluate(e=>{
  if(e.querySelector('input[type=password],input[type=search]')||e.closest('[role=search]'))return false;
  const fields=[...e.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button]):not([type=file]),textarea')].filter(i=>i.offsetParent!==null&&!i.disabled&&!i.readOnly);
  if(!fields.length)return false;
  // A required choice with nothing to choose ("add a contact first") cannot be sent yet.
  if([...e.querySelectorAll('select[required]')].some(x=>![...x.options].some(o=>o.value&&!o.disabled)))return false;
  const typed=fields.filter(i=>['text','email','tel','textarea'].includes(i.tagName==='TEXTAREA'?'textarea':(i.getAttribute('type')||'text').toLowerCase()));
  if(typed.length&&typed.every(i=>i.value))return false;
  return !/search|newsletter|subscribe/i.test(e.innerText+' '+(e.getAttribute('aria-label')||'')+' '+fields.map(i=>i.placeholder).join(' '));
 }).catch(()=>false);
 // Forms first, then dialogs whose fields are not in a form (React apps often skip <form>).
 const addForm=async()=>{for(const f of [...await tab.locator('form').all(),...await tab.locator('[role=dialog]:not(:has(form)),dialog[open]:not(:has(form))').all()])if(await visible(f)&&await isAddForm(f))return f;return null};
 const signature=f=>f.evaluate(e=>[...e.querySelectorAll('input,textarea,select')].map(i=>i.name||i.id||i.placeholder).join('|')).catch(()=>'');
 // No form on the page: the buttons that open one, by their accessible name ("+" icons included).
 async function openForm(){
  const tried=new Set();
  for(const role of ['button','link'])for(const l of await tab.getByRole(role,{name:OPENS_FORM}).all()){
   if(tried.size>=6)return null;
   const name=(await l.innerText().catch(()=>'')||await l.getAttribute('aria-label').catch(()=>'')||'').trim();
   if(tried.has(name)||/to (cart|bag|basket)/i.test(name)||!(await visible(l)))continue;
   tried.add(name);
   if(!(await click(l)))continue;
   await settle(600);
   const f=await addForm();if(f)return f;
   await tab.keyboard.press('Escape').catch(()=>{});
  }
  return null;
 }
 try{
  await tab.goto(url,{waitUntil:'load',timeout:15000});
  await tab.waitForLoadState('networkidle',{timeout:5000}).catch(()=>{});
  // An app behind a sign-in: create a test account first.
  if(await visible(tab.locator('input[type=password]').first())&&!(await signUp()))return failed();
  let form=await addForm()||await openForm();
  // Still nothing: the form may be behind a sign-in the visitor has to open ("Sign in", "Get started").
  if(!form&&!signedUp){
   const door=tab.getByRole('button',{name:SIGN_IN}).or(tab.getByRole('link',{name:SIGN_IN})).first();
   if(await visible(door)&&await click(door)){await settle(600);if(await visible(tab.locator('input[type=password]').first())&&await signUp())form=await addForm()||await openForm()}
  }
  if(!form)return failed();
  // Forms in steps ("Continue"): each new step is filled in too, up to three.
  for(let step=0;step<3&&form;step++){
   const before=await signature(form);
   await fill(form,{record:true});submitted=true;
   const next=await addForm();
   form=next&&await signature(next)!==before?next:null;
  }
  // Shown as a record: in a list, table or a row of similar cards, not in a thank-you or status message.
  const shown=()=>tab.evaluate(t=>{
   const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
   for(let n;(n=w.nextNode());){
    if(!n.nodeValue.toLowerCase().includes(t.toLowerCase()))continue;
    const el=n.parentElement;if(!el||el.closest('form,[role=alert],[role=status],[aria-live],dialog,[role=dialog]'))continue;
    if(/thank|received|success|confirm|booked|sent|welcome|see you/i.test((el.closest('p,div,section')||el).innerText.slice(0,300)))continue;
    if(el.closest('li,tr,[role=row],[role=listitem],td,article,button,a,[role=button]'))return true;
    for(let a=el,i=0;a&&a.parentElement&&i<5;a=a.parentElement,i++){const sib=[...a.parentElement.children].filter(c=>c.tagName===a.tagName&&c.className===a.className);if(sib.length>=2)return true}
   }
   return false;
  },token).catch(()=>false);
  if(!(await shown()))return failed();
  await tab.reload({waitUntil:'load',timeout:15000});
  await tab.waitForLoadState('networkidle',{timeout:5000}).catch(()=>{});await tab.waitForTimeout(600);
  const reloaded=await shown();await Promise.all(calls);
  return{token,shown:true,reloaded,signed_up:signedUp,submitted,...(apiErrors.length?{api_errors:apiErrors}:{})};
 }catch{return null}
 finally{await tab.close().catch(()=>{})}
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
 dead.checked=targets.length;
 return dead;
}
// The pages of a published site as an anonymous visitor sees them (site-search.js): starts at
// url, follows the site's own links (not #hash ones) and returns up to max pages with their
// rendered #root, text, title and description. Only GET requests are sent: nothing is saved.
async function renderSite(url,opts={}){
 if(opts.fast!==false&&lightpandaPath()){
  fastStats.runs++;
  try{const b=await fastBrowser();const pages=b&&await crawl(url,{...opts,ctx:b.contexts()[0]||await b.newContext(),shared:true});if(pages&&pages.length)return pages;if(process.env.KAIROQ_DEBUG_FAST)console.warn('fast crawl empty',pages);fastStats.fallbacks++}
  catch(e){if(process.env.KAIROQ_DEBUG_FAST)console.warn('fast crawl',e.message);fastStats.fallbacks++}
 }
 if(!available())return null;
 return crawl(url,{...opts,ctx:await (await browser()).newContext({viewport:{width:1280,height:900}})});
}
// Reads every page of a site the way a search engine sees it after JavaScript ran.
// shared: the context belongs to someone else (Lightpanda has one), so only the page is closed.
async function crawl(url,{max=15,timeoutMs=20000,ctx,shared=false}={}){
 const start=new URL(url),base=start.pathname.endsWith('/')?start.pathname:start.pathname+'/';
 let page;
 try{
  page=await ctx.newPage();
  // Reading pages never sends a form or anything else that changes data.
  await page.route('**/*',r=>['GET','HEAD'].includes(r.request().method())?r.continue():r.abort());
  const queue=['/'],seen=new Set(['/']),pages=[];
  while(queue.length&&pages.length<max){
   const rel=queue.shift();
   try{
    await page.goto(start.origin+base+rel.replace(/^\//,''),{waitUntil:'load',timeout:timeoutMs});
    await page.waitForLoadState('networkidle',{timeout:6000}).catch(()=>{});await page.waitForTimeout(500);
    const d=await page.evaluate(base=>{
     const r=document.getElementById('root');
     const links=[...document.querySelectorAll('a[href]')].map(a=>{try{const u=new URL(a.getAttribute('href'),location.href);return u.origin===location.origin&&(u.pathname+'/').startsWith(base)?'/'+u.pathname.slice(base.length):null}catch{return null}}).filter(Boolean);
     return{html:r?r.innerHTML:'',text:r?r.innerText:'',title:document.title,description:(document.querySelector('meta[name=description]')||{}).content||'',h1:(document.querySelector('h1')||{}).innerText||'',links};
    },base);
    if(String(d.text).replace(/\s+/g,'').length>=40)pages.push({path:rel,...d,links:undefined});
    for(let l of d.links){l=l.replace(/index\.html$/,'').replace(/\/+$/,'')||'/';if(/\.[a-z0-9]{2,5}$/i.test(l)||seen.has(l))continue;seen.add(l);queue.push(l)}
   }catch{}
  }
  return pages;
 }finally{if(page)await page.close().catch(()=>{});if(!shared)await ctx.close().catch(()=>{})}
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
   // Measured problems on the same page (design-dom.js, design-frame.js), for the design review.
   let issues=[];try{issues=[...await require('./design-dom').inspect(page,name),...await require('./design-frame').frame(page,name)]}catch{}
   shots.push({name,mime:'image/jpeg',data:buf.toString('base64'),issues});
  }catch{}finally{await context.close().catch(()=>{})}
 }
 return shots;
}
// viewport 'phone' tests the page at 390x844 with touch, like a phone.
// scan: also return what a browsing agent would see (the interactive elements), e.g. to repair a check.
async function inspect(url,{steps=[],screenshot=true,timeoutMs=15000,sandbox,viewport,scan=false}={}){
 const device=DEVICES[viewport]||DEVICES.desktop;
 if(!available()||(device.webkit&&!webkitAvailable()))return{skipped:true,errors:[],steps:[],text:'',screenshot:null};
 const phone=Boolean(device.phone),slow=Boolean(device.slow),wait=slow?3:1;
 if(slow)timeoutMs*=3;
 const context=await (await (device.webkit?webkitBrowser():browser())).newContext(device.options);
 const page=await context.newPage(),errors=[],results=[],external=[],sizes=[];
 if(slow){await slowDown(context,page);page.on('requestfinished',async q=>{const z=await q.sizes().catch(()=>null);const n=z?z.responseBodySize+z.responseHeadersSize:0;if(n>150000)sizes.push({url:q.url(),bytes:n})})}
 let readyMs=null;
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
  const t0=Date.now();
  await page.goto(url,{waitUntil:'load',timeout:timeoutMs});
  // On the slow phone: how long until something can be used (a visible button, link or field).
  if(slow){
   await page.waitForFunction(()=>[...document.querySelectorAll('#root button,#root a[href],#root input,#root select,#root textarea')].some(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.top<innerHeight}),null,{timeout:timeoutMs}).catch(()=>{});
   readyMs=Date.now()-t0;
   if(readyMs>SLOW_READY_MS){const big=sizes.sort((a,b)=>b.bytes-a.bytes).slice(0,3).map(x=>(x.url.split('/').pop().split('?')[0]||'page')+' ('+(x.bytes>=1048576?(x.bytes/1048576).toFixed(1)+' MB':Math.round(x.bytes/1024)+' KB')+')');add('Slow phone: the page took '+(readyMs/1000).toFixed(1)+' s to be usable on a slow 3G connection (aim for under '+SLOW_READY_MS/1000+' s).'+(big.length?' Biggest files: '+big.join(', ')+'.':''))}
  }
  await page.waitForLoadState('networkidle',{timeout:5000*wait}).catch(()=>{});
  for(const step of (Array.isArray(steps)?steps:[]).slice(0,MAX_STEPS)){
   const s=step&&typeof step==='object'?step:{};
   const label=JSON.stringify(s).slice(0,200);
   try{
    const target=()=>s.selector?page.locator(String(s.selector)).first():s.label?page.getByLabel(String(s.label),{exact:false}).first():s.placeholder?page.getByPlaceholder(String(s.placeholder),{exact:false}).first():s.role?page.getByRole(String(s.role),s.text?{name:String(s.text),exact:false}:{}).first():page.getByText(String(s.text??''),{exact:false}).first();
    if(s.action==='click')await target().click({timeout:4000*wait});
    else if(s.action==='fill')await target().fill(String(s.value??''),{timeout:4000*wait});
    else if(s.action==='select')await target().selectOption(String(s.value??''),{timeout:4000*wait});
    else if(s.action==='press')await page.keyboard.press(String(s.key||'Enter'));
    else if(s.action==='expect'){if(s.absent)await page.getByText(String(s.text),{exact:false}).first().waitFor({state:'hidden',timeout:4000*wait});else await target().waitFor({state:'visible',timeout:4000*wait})}
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
  if(phone&&await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2).catch(()=>false))add('Layout overflow: the page scrolls sideways on a 390px phone screen'+(device.webkit?' in Safari':'')+'.');
  if(screenshot)shot=(await page.screenshot({type:'jpeg',quality:60})).toString('base64');
  if(scan)scanned=(await page.evaluate(SCAN,{max:MAX_ELEMENTS}).catch(()=>null)||{}).elements||null;
 }catch(e){add('Page did not load: '+e.message)}
 finally{await context.close().catch(()=>{})}
 return{skipped:false,device:viewport||'desktop',errors,external,steps:results,text:String(text||'').replace(/\n{3,}/g,'\n\n').slice(0,4000),screenshot:shot,...(readyMs!=null?{ready_ms:readyMs}:{}),...(scanned?{elements:scanned}:{})};
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
async function close(){if(webkitPromise){const w=await webkitPromise.catch(()=>null);webkitPromise=null;await w?.close().catch(()=>{})}if(fastPromise){const b=await fastPromise.catch(()=>null);fastPromise=null;await b?.close().catch(()=>{})}try{fastProc&&fastProc.kill()}catch{}for(const k of ['browserPromise','externalBrowserPromise']){const p=k==='browserPromise'?browserPromise:externalBrowserPromise;if(!p)continue;if(k==='browserPromise')browserPromise=null;else externalBrowserPromise=null;const b=await p.catch(()=>null);await b?.close().catch(()=>{})}}
module.exports={safariShot,DEVICES,devicesAvailable,webkitAvailable,fastStats:()=>({...fastStats,installed:Boolean(lightpandaPath())}),renderSite,savesData,deadClicks,check,screenshot,inspect,session,checkSite,startProxy,designShots,renderHtml,available,close,browser};

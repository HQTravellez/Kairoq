'use strict';
// Plan first, like superapp: quick questions as option cards (a label and one sentence, "Other…",
// Skip all), then a plan with Review, Skip and Approve; the build starts on Approve, with the
// owner's answers and the plan in the request. Planning is free.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const plan=require('../build-plan');

const PLAN={title:'Bring a colored dinosaur to life',summary:'Turn an original paper coloring page into a friendly 3D dinosaur that wears the child\'s colors and reacts when tapped.',screens:[{name:'Home',what:'Pick a printable page'},{name:'Scan',what:'The dinosaur appears'}],features:['Printable coloring pages','Tap to make it stomp'],left_out:['More animals']};

test('the plan is cleaned, and the approved plan is added to the request',async()=>{
 assert.equal(plan.cleanPlan({title:'x',summary:'short'}),null);
 const p=plan.cleanPlan({...PLAN,features:[...PLAN.features,'a','b','c','d','e']});
 assert.equal(p.features.length,6);
 const req=plan.withPlan('An app like Quiver',PLAN);
 assert.match(req,/^An app like Quiver\n\nApproved plan \(build exactly this first version\):\nBring a colored dinosaur to life\. Turn/);
 assert.match(req,/Screens: Home \(Pick a printable page\); Scan/);
 assert.match(req,/Left out for now: More animals/);
 assert.equal(plan.namesProduct('An iPhone app like Quiver'),true);
 assert.equal(plan.namesProduct('A booking site for my salon'),false);
});

test('make: the AI writes the plan; when it fails or is slow there is no plan',async()=>{
 let seen='';
 const ok=await plan.make('An app like Quiver',{callModel:async(o,parse)=>{seen=o.messages[0].content;return parse(JSON.stringify(PLAN))}});
 assert.equal(ok.title,PLAN.title);assert.equal(ok.searches,0);
 assert.match(seen,/never copy another company's artwork/);
 assert.equal(await plan.make('An app',{callModel:async()=>{throw Error('down')}}),null);
 assert.equal(await plan.make('An app',{callModel:async(o,parse)=>parse('{"title":"x"}')}),null);
});

test('in the editor: questions, the plan, Approve, and the build gets the answers and the plan',{timeout:180000},async(t)=>{
 const runtime=require('../runtime-check');
 if(!runtime.available()){t.diagnostic('no browser here');return}
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-plan-'));
 Object.assign(process.env,{NODE_ENV:'test',KAIROQ_WEB_RESEARCH:'off',KAIROQ_REACT_PROJECTS_DIR:path.join(tmp,'p'),KAIROQ_BUILDER_ACCOUNTS_DB:path.join(tmp,'a.sqlite'),KAIROQ_CRAFT_CHECK:'off',KAIROQ_LOOK_CHECK:'off'});
 const createApi=require('../create-api'),built=[];
 const callModel=async(o,parse)=>{
  if(o.purpose==='clarify')return parse(JSON.stringify({questions:[
   {q:'What should happen when someone points the phone at a page?',options:[{label:'Coloring comes alive',detail:'Scan a coloring page and see a 3D animal wearing its colors.'},{label:'Printed animal comes alive',detail:'Scan a printed picture to make its 3D version appear.'}],recommended:0},
   {q:'Who is the first version mainly for?',options:[{label:'Kids: watch and play',detail:'A child scans a page and taps the animal.'},{label:'Kids: learn animal facts',detail:'Names, sounds and simple learning moments.'}],recommended:0}]}));
  if(o.purpose==='plan')return parse(JSON.stringify(PLAN));
  if(/art director/.test(String(o.messages[0].content||'')))return parse(JSON.stringify({name:'Site',summary:'s',palette:{background:'#ffffff',foreground:'#13213c',primary:'#f2b632',secondary:'#eef1f6',accent:'#13213c',muted:'#f5f6f9'},fonts:{display:'Archivo',body:'Inter'},radius:'0.5rem'}));
  built.push(String(o.messages.at(-1).content));
  return parse(JSON.stringify({message:'Built it.',files:{'src/App.jsx':'export default function App(){return <main><h1>ColorScan</h1></main>}\n'}}));
 };
 const pub=path.join(__dirname,'..','public');
 const server=http.createServer(async(req,res)=>{
  if(await createApi.handle(req,res,{isOwner:()=>true,callModel,secure:false}))return;
  let f=req.url.split('?')[0];if(f==='/create')f='/create.html';
  const p=path.join(pub,f);
  if(p.startsWith(pub)&&fs.existsSync(p)&&fs.statSync(p).isFile()){res.writeHead(200,{'content-type':f.endsWith('.css')?'text/css':f.endsWith('.js')?'text/javascript':'text/html'});return res.end(fs.readFileSync(p))}
  res.writeHead(404);res.end();
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const ctx=await (await runtime.browser()).newContext({viewport:{width:1400,height:900}}),page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:'+server.address().port+'/create',{waitUntil:'domcontentloaded'});
  // What to build: the switch changes the examples; a phone app is asked for as one.
  await page.click('#new-kind [data-kind="phone"]');
  assert.equal(await page.getAttribute('#new-kind [data-kind="phone"]','aria-pressed'),'true');
  assert.match(await page.locator('#examples').innerText(),/iPhone app for my café/);
  await page.click('#new-kind [data-kind="site"]');
  await page.fill('#new-prompt','An iPhone app like Quiver: kids color a page and a 3D animal comes alive');
  await page.click('#new-submit');
  // Every question in one card, the recommended answer filled in; a row opens its options.
  await page.waitForSelector('.ask-card .q',{timeout:20000});
  assert.match(await page.locator('.ask-card .agent-name').innerText(),/Kairoq Agent/);
  assert.equal(await page.locator('.q').count(),2);
  assert.equal(await page.locator('.q-answer').first().innerText(),'Coloring comes alive','the recommended answer is pre-filled');
  await page.locator('.q-answer').nth(1).click();
  assert.match(await page.locator('.q').nth(1).locator('.ask-opt').first().innerText(),/Kids: watch and play \(Recommended\)\s+A child scans a page/);
  await page.locator('.q').nth(1).locator('.ask-other').fill('Kids and parents together');
  assert.equal(await page.locator('.q-answer').nth(1).innerText(),'Kids and parents together');
  await page.click('.ask-next');
  // The brand step: Kairoq's pick with a real page preview; "Not now" goes on without a look.
  await page.waitForSelector('.brand-opts',{timeout:20000});
  assert.equal(await page.locator('.brand-opt.on b').innerText(),'Design it for me (Recommended)');
  assert.ok(await page.locator('.lk-page .lk-p-h1').count(),'a page preview, not a sample screen');
  await page.locator('.ask-card button:has-text("Not now")').first().click();
  await page.waitForSelector('.plan-card .plan-title',{timeout:20000});
  assert.equal(await page.locator('.plan-title').innerText(),PLAN.title);
  assert.ok(await page.locator('#plan-wait:has-text("Approve the plan to start building")').count(),'the preview waits for the plan');
  await page.click('.plan-review');
  assert.match(await page.locator('.plan-more').innerText(),/Left for later\s+More animals/);
  assert.equal(built.length,0,'nothing is built before Approve: '+String(built[0]).slice(0,300));
  await page.click('.plan-approve');
  await page.waitForSelector('.req-card .req-plan:has-text("Plan approved: Bring a colored dinosaur")',{timeout:20000});
  await page.waitForFunction(()=>!document.querySelector('#plan-wait'));
  for(let i=0;i<50&&!built.length;i++)await new Promise(r=>setTimeout(r,200));
  assert.match(built[0],/Coloring comes alive/);
  assert.match(built[0],/Kids and parents together/);
  assert.match(built[0],/Approved plan \(build exactly this first version\)/);
  assert.deepEqual(errors,[]);
 }finally{await ctx.close();server.close();runtime.close()}
});

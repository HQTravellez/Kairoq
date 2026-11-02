'use strict';
// The Agentic CRM template: a team CRM with Copilot (reads freely, every change waits for Approve)
// and a daily agent run that adds follow-up tasks with reasons. Built with the real build and
// used in Chromium with the app's real backend (collections, functions, AI tools).
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-acrm-'));
Object.assign(process.env,{NODE_ENV:'test',KAIROQ_REACT_PROJECTS_DIR:path.join(tmp,'projects'),KAIROQ_BUILDER_ACCOUNTS_DB:path.join(tmp,'a.sqlite'),KAIROQ_HOSTING_REGISTRY:path.join(tmp,'hosting.json')});
const builder=require('../react-builder'),backend=require('../react-backend'),runtime=require('../runtime-check'),templates=require('../create-templates');
const shot=process.env.KAIROQ_KIT_SHOTS;
test.after(()=>runtime.close());

test('the template is listed, valid, and every change the AI can make needs a confirm',()=>{
 const t=templates.get('agentic-crm');
 assert.ok(t&&templates.list().some(x=>x.id==='agentic-crm'));
 const files=t.files;
 assert.deepEqual(builder.validateFiles(files),[]);
 assert.deepEqual(backend.configErrors(files),[]);
 const cfg=backend.parseConfig(files);
 for(const n of ['create-task','move-deal','draft-email'])assert.equal(cfg.ai_tools[n].confirm,true,n+' waits for Approve');
 for(const n of ['find-contacts','pipeline-summary','list-tasks'])assert.equal(cfg.ai_tools[n].confirm,false,n+' only reads');
 assert.deepEqual(cfg.automations.map(a=>[a.name,a.every,a.at]),[['morning-run','day','08:00']]);
 for(const n of Object.keys(cfg.ai_tools))assert.ok(files['functions/'+n+'.js'],'function for '+n);
 assert.ok(files['src/components/ui/kanban.jsx']&&files['src/components/ui/data-table.jsx'],'the UI kit is included');
 assert.doesNotMatch(files['functions/morning-run.js'],/email\.send|\.remove\(/,'the agent never sends or deletes');
});

test('a first prompt that plainly asks for a CRM starts from this template; other apps do not',()=>{
 for(const p of ['A CRM for my agency that follows up with leads','Build a sales pipeline for my team','I want to track our leads and deals','crm with email follow ups'])assert.equal(templates.match(p),'agentic-crm',p);
 for(const p of ['A website for my bakery','A CRM landing page for my startup','Booking app for a salon','A snake game',''])assert.equal(templates.match(p),null,p);
 assert.match(fs.readFileSync(path.join(__dirname,'..','create-api.js'),'utf8'),/const matched=!template&&prompt\?require\('\.\/create-templates'\)\.match\(prompt\):null;/);
});

test('sign up, examples appear, the agent runs with reasons, Copilot moves a deal only after Approve',{skip:!runtime.available(),timeout:300000},async()=>{
 const asks=[];
 backend.configure({appAi:async({system,messages})=>{
  asks.push({system,messages});const last=String(messages.at(-1).content);
  if(/morning briefing/.test(system))return{text:'Two deals need a nudge today; both have follow-up tasks.'};
  if(/Copilot inside Relay/.test(system)){
   if(!/Tool result/.test(last))return{text:JSON.stringify({tool:'pipeline-summary',args:{}})};
   assert.match(last,/Online booking for 3 clinics/,'the answer is built from the real pipeline');
   return{text:JSON.stringify({answer:'Two deals are quiet: Online booking for 3 clinics (9 days) and Portfolio website (12 days).',action:{tool:'move-deal',args:{deal:'Portfolio website',stage:'Proposal'},summary:'Move Portfolio website to Proposal'}})};
  }
  return{text:'ok'};
 }});
 const meta=builder.create({name:'Relay',owner:'owner'});
 await builder.initializeFrom(meta,templates.get('agentic-crm').files,'Started from the Agentic CRM template');
 const fresh=builder.loadMeta(meta.id);
 const server=http.createServer(async(req,res)=>{try{if(await backend.handle(req,res))return}catch(e){res.writeHead(e.status||500);return res.end(String(e.message))}if(builder.handlePreview(req,res))return;res.writeHead(404);res.end()});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 const ctx=await (await runtime.browser()).newContext({viewport:{width:1280,height:860}}),page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(base+builder.previewUrl(fresh),{waitUntil:'networkidle'});
  await page.click('text=New here? Create an account');
  await page.fill('#name','Ka');await page.fill('#email','ka@example.com');await page.fill('#password','password123');
  await page.click('button:has-text("Create account")');
  await page.getByRole('heading',{name:'Today',exact:true}).waitFor();
  await page.getByText('Send revised quote to Maya').waitFor({timeout:15000});
  assert.match(await page.textContent('main'),/Open pipeline[\s\S]*\$52,500/,'open pipeline from the examples: 18,000 + 24,000 + 6,500 + 4,000');
  if(shot)await page.screenshot({path:path.join(shot,'crm-today.png')});
  await page.click('nav[aria-label="Main"] >> text=Pipeline');
  for(const s of ['Lead','Qualified','Proposal','Negotiation','Won','Lost'])await page.getByText(s,{exact:true}).first().waitFor();
  await page.getByText('Online booking for 3 clinics').waitFor();
  if(shot)await page.screenshot({path:path.join(shot,'crm-pipeline.png')});
  // The agent: two quiet deals get follow-up tasks, each with its reason; running again adds nothing.
  await page.click('nav[aria-label="Main"] >> text=Agent');
  await page.click('button:has-text("Run now")');
  await page.getByText('Follow up on Online booking for 3 clinics (Proposal, quiet 9 days)').first().waitFor({timeout:15000});
  await page.getByText('Follow up on Portfolio website (Qualified, quiet 12 days)').first().waitFor();
  assert.ok(await page.getByText('Why: No activity for 9 days in Proposal').count());
  await page.getByText('Two deals need a nudge today').first().waitFor();
  await page.click('button:has-text("Run now")');
  await page.getByText(/Nothing needed today/).first().waitFor({timeout:15000});
  if(shot)await page.screenshot({path:path.join(shot,'crm-agent.png')});
  // Copilot reads the real pipeline, proposes a move, and nothing changes until Approve.
  await page.click('aside >> text=Ask Copilot');
  await page.click('text=Which deals have gone quiet?');
  await page.getByText('Move Portfolio website to Proposal').waitFor({timeout:15000});
  const stageOf=t=>backend.database(meta.id).prepare("SELECT data FROM records WHERE collection='deals'").all().map(r=>JSON.parse(r.data)).find(d=>d.title===t).stage;
  assert.equal(stageOf('Portfolio website'),'Qualified','not moved before Approve');
  if(shot)await page.screenshot({path:path.join(shot,'crm-copilot.png')});
  await page.click('button:has-text("Approve")');
  await page.getByText('Done',{exact:true}).waitFor({timeout:15000});
  await page.keyboard.press('Escape');
  await page.click('nav[aria-label="Main"] >> text=Today');
  await page.getByText('Copilot moved Portfolio website from Qualified to Proposal').waitFor({timeout:15000});
  assert.equal(stageOf('Portfolio website'),'Proposal','moved after Approve');
  // Outside callers cannot make the daily run repeat.
  const out=await fetch(base+'/api/apps/'+meta.id+'/functions/morning-run',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
  assert.equal(out.status,429);
  assert.deepEqual(errors,[]);
 }finally{await ctx.close();server.close()}
});

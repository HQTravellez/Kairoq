"use strict";
// Kairoq's integrations library (integrations.js): 744 services from Activepieces' MIT
// integrations, how each signs in, their actions, the real code of an action read once and
// kept, the builder's kairoq_integration tool, and "Connect another app" in the editor.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-integrations-'));
Object.assign(process.env,{NODE_ENV:'test',KAIROQ_DESIGN_BRIEF:'off',KAIROQ_WEB_RESEARCH:'off',KAIROQ_CRAFT_CHECK:'off',KAIROQ_LOOK_CHECK:'off',KAIROQ_REACT_PROJECTS_DIR:path.join(tmp,'projects'),KAIROQ_BUILDER_ACCOUNTS_DB:path.join(tmp,'a.sqlite')});
const I=require('../integrations');

test('the library: 744 services from the MIT part only, with how each signs in',()=>{
 const d=I.data();
 assert.equal(d.pieces.length,744);assert.match(d.license,/MIT/);assert.match(d.commit,/^[0-9a-f]{40}$/);
 assert.ok(d.pieces.every(p=>p.actions.every(a=>/^src\//.test(a.file))),'files are inside each integration');
 assert.ok(!JSON.stringify(d).includes('/ee/'),'nothing from the ee folders');
 assert.deepEqual(I.connection(I.find('sendgrid')),{kind:'key',secrets:['SENDGRID_API_KEY'],how:I.connection(I.find('sendgrid')).how});
 assert.equal(I.connection(I.find('mailchimp')).kind,'oauth');
 assert.equal(I.search('mailchimp').results[0].id,'mailchimp');
 assert.equal(I.search('HubSpot').results[0].name,'HubSpot');
 const det=I.details('sendgrid');assert.ok(det.actions.length>0);assert.ok(det.actions[0].label);
});

test('the builder\'s tool: the list of actions, then the real code of one, read once and kept',async()=>{
 const T=require('../builder-tools');
 const fetched=[];const remote=async u=>{fetched.push(u);return{bytes:Buffer.from('// code of '+u.split('/').pop()+'\nexport const x = 1;\n'),type:'text/plain'}};
 const t=T.forProject('x',{remote});
 const overview=await t.run('integration',{service:'SendGrid'});
 assert.match(overview,/Integration: SendGrid \(sendgrid\)/);assert.match(overview,/secrets\.get\(name\) for: SENDGRID_API_KEY/);assert.match(overview,/Settings → Secrets/);
 const first=I.find('sendgrid').actions[0];
 const code=await t.run('integration',{service:'sendgrid',action:first.name});
 assert.match(code,/MIT, Activepieces Inc\./);assert.match(code,/do not import @activepieces packages/);assert.match(code,/export const x = 1/);
 assert.ok(fetched.every(u=>u.startsWith('https://raw.githubusercontent.com/activepieces/activepieces/'+I.data().commit+'/packages/pieces/community/sendgrid/')));
 const n=fetched.length;await t.run('integration',{service:'sendgrid',action:first.name});
 assert.equal(fetched.length,n,'kept: not fetched again');
 assert.match(await t.run('integration',{service:'mailchimp'}),/OAuth, which Kairoq apps cannot do yet/);
 assert.match(await t.run('integration',{service:'nopeservice'}),/No integration called/);
});

test('"Connect another app": search, pick what should happen, and Kairoq is asked to add it',{timeout:180000},async(t)=>{
 const runtime=require('../runtime-check');
 if(!runtime.available()){t.diagnostic('no browser here');return}
 const createApi=require('../create-api'),builder=require('../react-builder'),built=[];
 const callModel=async(o,parse)=>{if(o.purpose)return parse('{}');built.push(String(o.messages.at(-1).content));return parse(JSON.stringify({message:'Connected.',files:{'src/App.jsx':'export default function App(){return <main><h1>Shop</h1></main>}\n'}}))};
 const pub=path.join(__dirname,'..','public');
 const server=http.createServer(async(req,res)=>{if(await createApi.handle(req,res,{isOwner:()=>true,callModel,secure:false}))return;let f=req.url.split('?')[0];if(f==='/create')f='/create.html';const p=path.join(pub,f);if(p.startsWith(pub)&&fs.existsSync(p)&&fs.statSync(p).isFile()){res.writeHead(200,{'content-type':f.endsWith('.css')?'text/css':f.endsWith('.js')?'text/javascript':'text/html'});return res.end(fs.readFileSync(p))}res.writeHead(404);res.end()});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const ctx=await (await runtime.browser()).newContext({viewport:{width:1300,height:900}}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  const meta=builder.create({name:'Shop',owner:'owner'});await builder.initialize(meta);
  await page.goto('http://127.0.0.1:'+server.address().port+'/create?project='+meta.id,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1500);
  await page.click('#menu-project summary');await page.click('#connect-open');
  await page.locator('.connector:has-text("744 apps") button').click();
  await page.fill('#apps-search','sendgrid');
  await page.waitForSelector('.apps-item:has-text("SendGrid")');
  await page.locator('.apps-item:has-text("SendGrid")').first().click();
  await page.waitForSelector('.apps-connect');
  assert.match(await page.locator('.apps-connect').innerText(),/Works with an API key/);
  assert.match(await page.locator('#apps-detail').innerText(),/SENDGRID_API_KEY/);
  await page.fill('.apps-what','email every new booking to the owner with SendGrid');
  if(process.env.KAIROQ_SHOT)await page.screenshot({path:process.env.KAIROQ_SHOT});
  await page.locator('#apps-detail button.primary').click();
  for(let i=0;i<100&&!built.length;i++)await new Promise(r=>setTimeout(r,200));
  assert.match(built[0]||'',/Connect SendGrid: email every new booking to the owner with SendGrid/);
  assert.match(built[0],/Integration "sendgrid" from Kairoq's integrations library/);
  assert.deepEqual(errors,[]);
 }finally{await ctx.close();server.close();runtime.close()}
});

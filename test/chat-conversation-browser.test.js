'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kq-chat-ui-'));
Object.assign(process.env,{NODE_ENV:'test',KAIROQ_REACT_PROJECTS_DIR:path.join(tmp,'projects'),KAIROQ_BUILDER_ACCOUNTS_DB:path.join(tmp,'accounts.sqlite'),KAIROQ_DESIGN_BRIEF:'off',KAIROQ_WEB_RESEARCH:'off',KAIROQ_MEMORY:'off',KAIROQ_CRAFT_CHECK:'off',KAIROQ_LOOK_CHECK:'off',KAIROQ_AUTOPILOT:'off'});
const builder=require('../react-builder'),api=require('../create-api'),runtime=require('../runtime-check');
test('a calm durable chat: choices, details, duplicate submit, refresh and completed status',{timeout:120000,skip:!runtime.available()},async()=>{
 const meta=builder.create({name:'Dinosaur coloring book',owner:'owner'});await builder.initialize(meta);
 builder.addMessages(meta.id,[{role:'user',text:'Build an iPhone coloring book with a real animated T-Rex. Keep the printable page and the child’s colors.'},{role:'assistant',text:'I’ll keep the printable page and the camera version. The animated T-Rex model still needs to be added.\n\nWhich version would you like?',mode:'discuss',question:{text:'Which version would you like?',options:['Browser camera version (recommended)','Keep the current 3D viewer'],recommended:0},credits:0,timeline:[{t:'think',ms:12000,text:'private fixture reasoning'},{t:'edit',file:'src/PlayPage.jsx',kind:'edited'}],design:{name:'Soot and lime',fonts:{display:'Bricolage',body:'Work Sans'}},memory:{recipes:['Gym website with trial sign-up']}}]);
 let turns=0;const pub=path.join(__dirname,'../public');
 const server=http.createServer(async(req,res)=>{
  if(req.method==='POST'&&req.url.endsWith('/chat')){turns++;await new Promise(r=>setTimeout(r,180));}
  if(await api.handle(req,res,{isOwner:()=>true,secure:false,callModel:async(o,parse)=>parse('The browser camera version is still the agreed direction. The animated model is not added yet.')}))return;
  const name=req.url.split('?')[0]==='/create'?'/create.html':req.url.split('?')[0],file=path.join(pub,name);
  if(file.startsWith(pub+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()){res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));return;}res.writeHead(404);res.end();
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await require('playwright-core').chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));const url='http://127.0.0.1:'+server.address().port+'/create?project='+meta.id;
 try{
  await page.goto(url,{waitUntil:'domcontentloaded'});await page.locator('#editor').waitFor({state:'visible'});
  assert.equal(await page.getByRole('button',{name:'Implement this plan',exact:true}).count(),0,'a choice is not an executable plan');
  assert.equal(await page.locator('.question-options .q-opt').count(),2);
  assert.equal(await page.locator('.q-tag').allTextContents().then(a=>a.join(' ')),'Recommended');
  assert.ok(!(await page.locator('.question-options .q-opt').first().innerText()).includes('(recommended)'));
  const choices=page.locator('.question-options .q-opt');
  for(const r of await choices.evaluateAll(a=>a.map(n=>({width:n.clientWidth,scroll:n.scrollWidth,height:n.clientHeight,radius:getComputedStyle(n).borderRadius})))){assert.ok(r.scroll<=r.width+2);assert.ok(r.height<110);assert.equal(r.radius,'10px');}
  assert.equal(await page.locator('.message-details').getAttribute('open'),null);
  assert.equal(await page.locator('.memory-chip').isVisible(),false,'technical notes start folded');
  assert.equal(await page.locator('.messages').innerText().then(t=>t.includes('private fixture reasoning')),false);
  const output=process.env.KAIROQ_CHAT_EVIDENCE_DIR;if(output){fs.mkdirSync(output,{recursive:true});await page.screenshot({path:path.join(output,'chat-desktop.png'),fullPage:true});await page.locator('#editor .chat').screenshot({path:path.join(output,'chat-panel.png')});}
  await page.fill('#chat-input','hi');await page.evaluate(()=>{document.querySelector('#chat-form').requestSubmit();document.querySelector('#chat-form').requestSubmit();});
  await page.waitForFunction(()=>!document.querySelector('#progress')||document.querySelector('#progress').classList.contains('hidden'));
  await page.waitForFunction(()=>[...document.querySelectorAll('#messages .md')].some(n=>/Your choice is still open/.test(n.textContent)));
  assert.equal(turns,1,'double submit sends one turn');
  await page.reload({waitUntil:'domcontentloaded'});await page.getByText('Hi — I\'m here.',{exact:false}).waitFor();
  assert.equal(await page.locator('#messages .user').filter({hasText:/^hi$/}).count(),1,'the accepted message survives reload exactly once');
  assert.equal(await page.locator('.question-options .q-opt').count(),2,'the pending choice survives a greeting and reload');
  await page.setViewportSize({width:390,height:844});await page.locator('#messages').evaluate(n=>n.scrollTop=n.scrollHeight);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,'mobile has no page overflow');
  if(output)await page.screenshot({path:path.join(output,'chat-mobile.png'),fullPage:true});
  assert.deepEqual(errors,[]);
 }finally{await page.close();await browser.close();await new Promise(r=>server.close(r));runtime.close();api.jobs.clear();}
});
test.after(()=>{runtime.close();fs.rmSync(tmp,{recursive:true,force:true})});

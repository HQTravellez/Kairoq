'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const runtime=require('../runtime-check');
test('Discuss UI displays a separate streamed reply without replacing the build watcher',{skip:!runtime.available()},async()=>{
 const {chromium}=require('playwright-core');
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
 try {
  const page=await browser.newPage();
  await page.setContent('<div id="messages"></div><textarea id="chat-input"></textarea><div id="chat-error"></div>');
  const source=fs.readFileSync(path.join(__dirname,'../public/create.js'),'utf8');
  const ast=require('@babel/parser').parse(source,{sourceType:'script'});
  const names=['discussWhileBuilding','send'];
  const found=[];function visit(n){if(!n||typeof n!=='object')return;if(n.type==='FunctionDeclaration'&&names.includes(n.id.name))found.push(source.slice(n.start,n.end));for(const v of Object.values(n))if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')visit(v);}
  visit(ast.program);assert.equal(found.length,2);const functions=found.join('\n');
  await page.addScriptTag({content:`const state={job:{id:'active-build',status:'building'},project:{id:'hotel'},attachments:[],tier:'standard'};
const $=id=>document.getElementById(id);const text=(n,s)=>n.textContent=s;const renderAttachments=()=>{};
const messageItem=m=>{const p=document.createElement('p');p.dataset.role=m.role;p.textContent=m.text;return p;};
const work={job:state.job};const renderWork=()=>{};
const renderMessages=()=>document.getElementById('messages').replaceChildren(...state.project.messages.map(messageItem));
let polls=0;const api=async(url,opts)=>opts?{job:{id:'discussion',status:'thinking'}}:url.startsWith('/projects/')?{project:{id:'hotel',messages:[{role:'user',text:'What should guests see first?'},{role:'assistant',text:'Suggest showing available rooms first.'}]}}:{job:++polls===1?{status:'thinking',stream:{text:'Rooms…'}}:{status:'complete',result:{message:'Suggest showing available rooms first.'}}};
${functions}
window.sendMessage=()=>send('What should guests see first?','discuss');window.buildId=()=>state.job.id;`});
  await page.evaluate(()=>window.sendMessage());
  assert.equal(await page.evaluate(()=>window.buildId()),'active-build');
  assert.deepEqual(await page.locator('[data-role=assistant]').allTextContents(),['Suggest showing available rooms first.']);
  assert.equal(await page.locator('[data-role=user]').textContent(),'What should guests see first?');
 } finally {await browser.close();}
});

test('completed jobs clear busy status after refresh failure and cannot replace another project',{skip:!runtime.available()},async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../public/create.js'),'utf8');
 const ast=require('@babel/parser').parse(source,{sourceType:'script'});
 let node,sendNode;function find(n){if(!n||typeof n!=='object')return;if(n.type==='FunctionDeclaration'&&n.id.name==='watch')node=n;if(n.type==='FunctionDeclaration'&&n.id.name==='send')sendNode=n;for(const v of Object.values(n))if(Array.isArray(v))v.forEach(find);else if(v&&typeof v==='object')find(v);}find(ast.program);
 assert.ok(node);
 const browser=await require('playwright-core').chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage();
  await page.setContent('<div id="progress-text"></div><div id="chat-error"></div><div id="messages"></div><div id="run-phone"></div><div id="stores-open"></div><textarea id="chat-input"></textarea>');
  await page.addScriptTag({content:`
 const state={project:{id:'old'},lastSent:'hi',attachments:[],tier:'standard'},work={},detailState={source:null},LABELS={complete:'Done'};
 const $=id=>document.getElementById(id),text=(n,s)=>n.textContent=s;
 let isBusy=false,resolveRefresh,rejectRefresh,rendered=0;
 const busy=v=>isBusy=v,refreshCredits=()=>{},closeDetail=()=>{},tickWork=()=>{},renderBuildOverlay=()=>{},syncSend=()=>{},renderMessages=()=>rendered++,renderVersions=()=>{};
 const renderAttachments=()=>{},messageItem=m=>{const p=document.createElement('p');p.textContent=m.text;return p;};
 const api=()=>new Promise((resolve,reject)=>{resolveRefresh=resolve;rejectRefresh=reject;});
 ${source.slice(node.start,node.end)}
 ${source.slice(sendNode.start,sendNode.end)}
 window.runSend=()=>{state.project={id:'old'};return send('Keep the camera version.','build');};
 window.finishOldSend=()=>{state.project={id:'new'};resolveRefresh({job:{id:'old-reply',status:'complete',mode:'discuss'}});};
 window.run=()=>watch({id:'finished',status:'complete',mode:'discuss'});
 window.failRefresh=()=>rejectRefresh(Error('offline'));
 window.switchProject=()=>{state.project={id:'new'};resolveRefresh({project:{id:'old',messages:[]}});};
 window.inspect=()=>({busy:isBusy,job:state.job,project:state.project.id,rendered});
 `});
  await page.evaluate(()=>{window.pending=window.run();});
  await page.evaluate(()=>window.failRefresh());await page.evaluate(()=>window.pending);
  assert.equal(await page.evaluate(()=>window.inspect().busy),false);
  assert.equal(await page.evaluate(()=>window.inspect().job),null);
  assert.match(await page.locator('#chat-error').textContent(),/conversation could not refresh/);
  await page.evaluate(()=>{window.pending=window.run();});
  await page.evaluate(()=>window.switchProject());await page.evaluate(()=>window.pending);
  assert.equal(await page.evaluate(()=>window.inspect().project),'new');
  assert.equal(await page.evaluate(()=>window.inspect().rendered),0,'stale project was not rendered');
  await page.evaluate(()=>{window.pending=window.runSend();});
  await page.evaluate(()=>window.finishOldSend());await page.evaluate(()=>window.pending);
  assert.equal(await page.evaluate(()=>window.inspect().job),null,'late submission cannot start a watcher in another project');
  assert.equal(await page.evaluate(()=>window.inspect().project),'new');
 }finally{await browser.close();}
});

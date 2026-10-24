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
let polls=0;const api=async(url,opts)=>opts?{job:{id:'discussion',status:'thinking'}}:{job:++polls===1?{status:'thinking',stream:{text:'Rooms…'}}:{status:'complete',result:{message:'Suggest showing available rooms first.'}}};
${functions}
window.sendMessage=()=>send('What should guests see first?','discuss');window.buildId=()=>state.job.id;`});
  await page.evaluate(()=>window.sendMessage());
  assert.equal(await page.evaluate(()=>window.buildId()),'active-build');
  assert.deepEqual(await page.locator('[data-role=assistant]').allTextContents(),['Suggest showing available rooms first.']);
  assert.equal(await page.locator('[data-role=user]').textContent(),'What should guests see first?');
 } finally {await browser.close();}
});

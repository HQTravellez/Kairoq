'use strict';
// The agent's finished message in the chat: "Kairoq Agent · Worked for 17m 14s · N steps" on top
// (not buried under "Build details"), one plain sentence for the verdict, the PROOF block as a
// short list (only what passed or failed), and "Stopped after 28 steps" in plain words.
// The live status label follows what the agent is doing, not the round's first phase.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');

const DRAFT='UNVERIFIED DRAFT · NOT functionally verified.\n\nPROOF\n- Build: passed\n- Browser: passed · 11 interaction step(s)\n- Visual quality: failed\n- Verification tests: not-required\n- Regression checks: not-required\n- Engineering review: failed\n- Repair attempts: 0\n- Unresolved: Independent engineering review has blocking findings. Visual quality was not evaluated.\n\nBuilder notes: Stopped after 28 steps.';
const OK='VERIFIED BUILD\n\nPROOF\n- Build: passed\n- Browser: passed · 9 interaction step(s)\n- Visual quality: passed\n- Verification tests: not-required\n- Regression checks: passed\n- Engineering review: passed\n- Repair attempts: 1\n- Unresolved: none\n\nAdded the menu page and the cake request form.';

test('the finished message: how long it worked, then only what was done',{timeout:120000},async(t)=>{
 const runtime=require('../runtime-check');
 if(!runtime.available()){t.diagnostic('no browser here');return}
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-finished-'));
 Object.assign(process.env,{NODE_ENV:'test',KAIROQ_REACT_PROJECTS_DIR:path.join(tmp,'p'),KAIROQ_BUILDER_ACCOUNTS_DB:path.join(tmp,'a.sqlite')});
 const createApi=require('../create-api'),pub=path.join(__dirname,'..','public');
 const server=http.createServer(async(req,res)=>{
  if(await createApi.handle(req,res,{isOwner:()=>true,callModel:async()=>{throw Error('no model in this test')},secure:false}))return;
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
  await page.waitForFunction(()=>typeof window.kairoqRenderMessage==='function');
  const tl=[{t:'think',ms:6200,title:'Chose the look'},{t:'edit',file:'src/pages/MenuPage.jsx',kind:'created'},{t:'build',ok:true,ms:9800},{t:'test',ok:false,text:'Engineering review found blocking issues'}];
  const out=await page.evaluate(([draft,ok,tl])=>{
   const render=m=>{const li=window.kairoqRenderMessage(m,true,1);document.body.append(li);return{first:li.firstElementChild.className,text:li.innerText,rows:[...li.querySelectorAll('.verdict-rows li')].map(x=>x.className+'|'+x.innerText),details:li.querySelector('details.message-details')?.innerText||''}};
   return{draft:render({role:'assistant',mode:'agent',text:draft,timeline:tl,duration_ms:1034000,version:2}),ok:render({role:'assistant',mode:'agent',text:ok,timeline:tl,duration_ms:184000,version:3}),plain:render({role:'assistant',text:'Changed the button colour.',timeline:tl,duration_ms:9000,version:4})};
  },[DRAFT,OK,tl]);
  assert.equal(errors.length,0,errors.join(' | '));
  // The status line is the first thing: just how long it worked; the steps stay folded.
  assert.match(out.draft.first,/status-line done/);
  assert.match(out.draft.text,/Kairoq Agent\s*Worked for 17m 14s/);
  assert.ok(!/steps?\b/.test(out.draft.text.split('\n').slice(0,2).join(' ')),'no step count');
  assert.ok(!/Read|Built the preview/.test(out.draft.text),'the step log is folded');
  // Then only what was done, in the agent's words: no checklists, tags or Build details.
  assert.match(out.draft.text,/I used all 28 rounds before every check passed\./);
  assert.match(out.ok.text,/Added the menu page and the cake request form\./);
  for(const o of [out.draft,out.ok]){
   assert.ok(!/PROOF|UNVERIFIED|Builder notes|not-required|Repair attempts|What I tested|Not done yet|What's there|Checked|Draft ·|Agent finished/.test(o.text),o.text);
   assert.equal(o.rows.length,0);assert.equal(o.details,'','no Build details fold');
  }
  // An ordinary reply is untouched.
  assert.match(out.plain.text,/Changed the button colour\./);assert.ok(!/✓/.test(out.plain.text));
 }finally{await ctx.close();server.close();await runtime.close()}
});

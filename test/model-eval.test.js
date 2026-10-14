"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path');
const evalr=require('../scripts/model-eval');
const PNG=require('../react-mobile').solidPng(8,'#336699');
const CASES=JSON.parse(fs.readFileSync(path.join(__dirname,'../scripts/model-eval-prompts.json'),'utf8')).cases;

test('the judge reply is validated and its problem areas are normalised',()=>{
 const j=evalr.parseJudge('```json\n{"matches_request":4,"design":3.4,"mobile":5,"overall":3,"issues":[{"area":"Spacing","detail":"Cards touch the edges on the phone"},{"area":"vibes","detail":"Feels generic"},{"detail":""}],"strengths":["Good hero photo"],"summary":"Clean but generic."}\n```');
 assert.deepEqual([j.matches_request,j.design,j.mobile,j.overall],[4,3,5,3]);
 assert.deepEqual(j.issues.map(i=>i.area),['spacing','polish']);
 assert.throws(()=>evalr.parseJudge('{"design":9}'),/matches_request missing/);
 assert.throws(()=>evalr.parseJudge('no json'),/not JSON/);
 const prompt=evalr.judgePrompt(CASES[0]);
 assert.match(prompt,/Casa Azul[\s\S]*guest reviews section/);
 assert.ok(!/kairoq|lovable/i.test(prompt),'the judge is not told who built the app');
});

test('judge run: scores Kairoq and Lovable screenshots blind and writes the comparison report',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-judge-'));
 try{
  fs.mkdirSync(path.join(dir,'shots'));fs.mkdirSync(path.join(dir,'lovable'));
  for(const f of ['hotel-pro-build','hotel-standard-build','crm-pro-build'])for(const v of ['desktop','phone'])fs.writeFileSync(path.join(dir,'shots',f+'-'+v+'.png'),PNG);
  fs.writeFileSync(path.join(dir,'lovable','hotel-desktop.png'),PNG);fs.writeFileSync(path.join(dir,'lovable','hotel-phone.jpg'),PNG);
  const results=[
   {case:'hotel',name:'Boutique hotel website',tier:'pro',mode:'build',first_status:'complete',screenshots:'shots/hotel-pro-build-desktop.png shots/hotel-pro-build-phone.png'},
   {case:'hotel',name:'Boutique hotel website',tier:'standard',mode:'build',first_status:'complete',screenshots:'shots/hotel-standard-build-desktop.png shots/hotel-standard-build-phone.png'},
   {case:'crm',name:'Travel agency CRM',tier:'pro',mode:'build',first_status:'complete',screenshots:'shots/crm-pro-build-desktop.png shots/crm-pro-build-phone.png'},
   {case:'spa',name:'Spa',tier:'pro',mode:'build',first_status:'failed',first_error:'boom'}
  ];
  const sent=[];let n=0;
  const fetchImpl=async(url,init)=>{
   const body=JSON.parse(init.body);sent.push({url,auth:init.headers.Authorization,model:body.model,images:body.messages[0].content.filter(p=>p.type==='image_url').map(p=>p.image_url.url.slice(0,22))});
   n++;
   if(n===3)return new Response(JSON.stringify({error:{message:'overloaded'}}),{status:503});
   const overall=[4,2,3,5,5][Math.min(n-1,4)];
   return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({matches_request:4,design:overall,mobile:3,overall,issues:[{area:'spacing',detail:'Uneven section spacing'},{area:'imagery',detail:'Hero has no photo'}],strengths:['Clear headline'],summary:'Summary '+n})}}],usage:{cost:0.04}}))};
  const o={judgeModel:'anthropic/test-judge',key:'sk-test',lovable:path.join(dir,'lovable')};
  const cases=CASES.filter(c=>['hotel','crm','spa'].includes(c.id));
  const lovable=await evalr.runJudge(o,cases,results,path.join(dir,'shots'),dir,null,{fetchImpl});
  assert.ok(sent.every(s=>s.url==='https://openrouter.ai/api/v1/chat/completions'&&s.auth==='Bearer sk-test'&&s.model==='anthropic/test-judge'));
  assert.deepEqual(sent[0].images,['data:image/png;base64,','data:image/png;base64,']);
  assert.deepEqual(sent.at(-1).images,['data:image/png;base64,','data:image/jpeg;base64'],'Lovable desktop png + phone jpg');
  assert.equal(results[0].judge.overall,4);assert.equal(results[1].judge.overall,2);
  assert.equal(results[2].judge.overall,5,'a failed judge call is retried once');
  assert.equal(results[3].judge,undefined,'no screenshots, no judge');
  assert.equal(lovable.hotel.overall,5);
  evalr.writeReports(dir,results,{url:'https://k.example',tiers:['standard','pro'],modes:['build'],judgeModel:'anthropic/test-judge'},lovable);
  const summary=fs.readFileSync(path.join(dir,'summary.md'),'utf8');
  assert.match(summary,/## Design judge \(anthropic\/test-judge\)/);
  assert.match(summary,/\| Case \| Kairoq pro \/ build \| Kairoq standard \/ build \| Lovable \| Best Kairoq − Lovable \|/);
  assert.match(summary,/\| hotel \| 4 \| 2 \| 5 \| -1 \|/);
  assert.match(summary,/Lovable average overall: \*\*5\*\*/);
  assert.match(summary,/\*\*spacing\*\* \(3\): hotel pro: Uneven section spacing/);
  assert.match(summary,/| pro \/ build \| 2\/3 \|[^\n]*\| 4\.5 \| 3 \| 4\.5 \|/,'judge averages per tier');
  const sheet=fs.readFileSync(path.join(dir,'scoring-sheet.csv'),'utf8').split('\n');
  const head=sheet[0].split(','),row=sheet[1].split(',');
  assert.ok(head.includes('judge_overall')&&head.includes('score_design'));
  assert.equal(row[head.indexOf('judge_overall')],'4');
  assert.equal(row[head.indexOf('lovable_design')],'5','Lovable judge scores pre-fill the Lovable columns');
  assert.match(fs.readFileSync(path.join(dir,'judge-notes.md'),'utf8'),/## hotel · Lovable[\s\S]*\[imagery\] Hero has no photo/);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test('judge options: model and key come from flags or the environment',()=>{
 process.env.KAIROQ_JUDGE_MODEL='env/model';process.env.OPENROUTER_API_KEY='env-key';
 try{
  const o=evalr.args(['--judge-only','eval-results/x','--lovable','shots/lovable']);
  assert.deepEqual([o.judge,o.judgeModel,o.key,o.lovable],[true,'env/model','env-key','shots/lovable']);
  assert.equal(evalr.args(['--judge','--judge-model','a/b','--openrouter-key','k']).judgeModel,'a/b');
 }finally{delete process.env.KAIROQ_JUDGE_MODEL;delete process.env.OPENROUTER_API_KEY}
 assert.throws(()=>evalr.args(['--bogus']),/Unknown option/);
});

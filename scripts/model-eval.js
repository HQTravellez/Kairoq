#!/usr/bin/env node
"use strict";
// Real-model test runner for Kairoq Create.
// Builds every test prompt (scripts/model-eval-prompts.json) on a running Kairoq server
// through its normal API, for each chosen model tier and chat mode, sends the follow-up
// edits, then records what happened: time, credits, errors, security findings, whether the
// preview shows the expected content, and screenshots. Output: a CSV scoring sheet (with
// empty columns for your 1-5 scores and Lovable's) plus a Markdown summary.
//
// With --judge, a strong vision model (for example Fable, through OpenRouter) scores every
// app's desktop and phone screenshots against the rubric and lists its design problems.
// Lovable screenshots (--lovable <folder> or --lovable-urls <file>) are scored the same way,
// without telling the judge which builder made which app, for a side-by-side comparison.
//
//   node scripts/model-eval.js --url https://your-kairoq.app --email you@example.com --password '...' \
//     [--tiers standard,pro,max] [--modes build,agent] [--cases hotel,crm] [--no-followups] [--out eval-results] [--yes]
//     [--judge --judge-model <openrouter model id>] [--lovable <folder> | --lovable-urls <file.json>]
//   node scripts/model-eval.js --judge-only eval-results/<run> --judge-model <id> [--lovable … | --lovable-urls …]
//
// Without --yes it only prints the plan and the credit estimate.
const fs=require('fs'),path=require('path');

function args(argv){
 const o={tiers:'standard',modes:'build',cases:'',followups:true,out:'eval-results',yes:false,judge:false};
 for(let i=0;i<argv.length;i++){
  const a=argv[i],next=()=>argv[++i];
  if(a==='--url')o.url=next();else if(a==='--email')o.email=next();else if(a==='--password')o.password=next();
  else if(a==='--tiers')o.tiers=next();else if(a==='--modes')o.modes=next();else if(a==='--cases')o.cases=next();
  else if(a==='--out')o.out=next();else if(a==='--chromium')o.chromium=next();else if(a==='--timeout')o.timeout=Number(next());
  else if(a==='--no-followups')o.followups=false;else if(a==='--yes')o.yes=true;
  else if(a==='--judge')o.judge=true;else if(a==='--judge-model')o.judgeModel=next();else if(a==='--judge-only')o.judgeOnly=next();
  else if(a==='--lovable')o.lovable=next();else if(a==='--lovable-urls')o.lovableUrls=next();else if(a==='--openrouter-key')o.key=next();
  else if(a==='--help'||a==='-h'){o.help=true}
  else throw Error('Unknown option '+a);
 }
 if(o.judgeOnly)o.judge=true;
 o.judgeModel=o.judgeModel||process.env.KAIROQ_JUDGE_MODEL||'';
 o.key=o.key||process.env.OPENROUTER_API_KEY||'';
 return o;
}
const HELP=`Usage: node scripts/model-eval.js --url <kairoq url> --email <account email> --password <password> [options]
  --tiers standard,pro,max   model tiers to test (default standard)
  --modes build,agent        chat modes to test (default build)
  --cases hotel,crm          only these case ids (default all, see scripts/model-eval-prompts.json)
  --no-followups             skip the follow-up edits
  --out <dir>                results folder (default eval-results)
  --chromium <path>          Chromium for preview checks and screenshots (default CHROMIUM_PATH or common paths)
  --timeout <minutes>        per message (default 20)
  --yes                      actually run (otherwise only shows the plan and credit estimate)
Design judge:
  --judge                    score every app's screenshots with a vision model
  --judge-model <id>         OpenRouter model id for the judge (or KAIROQ_JUDGE_MODEL), e.g. Fable
  --openrouter-key <key>     defaults to OPENROUTER_API_KEY
  --lovable <folder>         Lovable screenshots named <case>-desktop.png and <case>-phone.png
  --lovable-urls <file>      JSON {"hotel":"https://….lovable.app", …}: screenshots them for you
  --judge-only <run folder>  judge an earlier run again without building anything`;

class Client{
 constructor(base){this.base=base.replace(/\/$/,'');this.cookie=''}
 async call(method,p,body){
  const r=await fetch(this.base+'/api/create'+p,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(this.cookie?{cookie:this.cookie}:{})},body:body?JSON.stringify(body):undefined});
  const set=r.headers.get('set-cookie');if(set&&/^kq_builder=/.test(set))this.cookie=set.split(';')[0];
  const text=await r.text();let json;try{json=JSON.parse(text)}catch{json={}}
  if(!r.ok)throw Object.assign(Error(json.error||('HTTP '+r.status)),{status:r.status});
  return json;
 }
 async waitJob(job,timeoutMs){
  const end=Date.now()+timeoutMs;let j=job;
  while(!['complete','failed'].includes(j.status)){
   if(Date.now()>end){await this.call('POST','/jobs/'+job.id+'/cancel').catch(()=>{});throw Error('Timed out')}
   await new Promise(r=>setTimeout(r,3000));
   j=(await this.call('GET','/jobs/'+job.id)).job;
  }
  return j;
 }
}
function chromiumPath(o){return[o.chromium,process.env.CHROMIUM_PATH,'/opt/pw-browsers/chromium','/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p=>p&&fs.existsSync(p))}
async function launch(o){
 const exe=chromiumPath(o);
 if(!exe){console.warn('No Chromium found: preview checks and screenshots are skipped (use --chromium).');return null}
 try{const {chromium}=require('playwright-core');return await chromium.launch({executablePath:exe})}catch(e){console.warn('Browser checks off: '+e.message);return null}
}
// Desktop (whole page, up to 4000 px tall) and phone screenshots, plus page errors and expected text.
async function browserCheck(browser,url,expect,shotBase){
 const out={errors:[],hits:0,missing:[],shots:[]};
 for(const [label,viewport] of [['desktop',{width:1280,height:800}],['phone',{width:390,height:844}]]){
  const context=await browser.newContext({viewport,isMobile:label==='phone',hasTouch:label==='phone'});const page=await context.newPage();
  if(label==='desktop'){page.on('pageerror',e=>out.errors.push(String(e.message||e).slice(0,200)));page.on('console',m=>{if(m.type()==='error')out.errors.push(m.text().slice(0,200))})}
  try{
   await page.goto(url,{waitUntil:'load',timeout:30000});await page.waitForLoadState('networkidle',{timeout:8000}).catch(()=>{});await page.waitForTimeout(1200);
   if(label==='desktop'){const text=(await page.evaluate(()=>document.body.innerText)).toLowerCase();for(const w of expect||[]){if(text.includes(w.toLowerCase()))out.hits++;else out.missing.push(w)}}
   const full=await page.evaluate(()=>document.documentElement.scrollHeight).catch(()=>viewport.height);
   const file=shotBase+'-'+label+'.png';
   await page.screenshot({path:file,fullPage:true,clip:{x:0,y:0,width:viewport.width,height:Math.max(viewport.height,Math.min(full,label==='desktop'?4000:3000))}});
   out.shots.push(file);
  }catch(e){out.errors.push('Page did not load: '+e.message.slice(0,150))}
  finally{await context.close()}
 }
 return out;
}
const csvCell=v=>{const s=v===undefined||v===null?'':String(v);return/[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};

// ---------- design judge ----------
const AREAS=['hierarchy','layout','spacing','typography','colour','imagery','consistency','components','mobile','states','content','polish'];
function judgePrompt(c){
 return`You are a strict senior product designer judging an app that an AI app builder made from a user's request. You see screenshots: first a desktop browser 1280 px wide (long pages are cut off at the bottom), then a phone 390 px wide. Judge only what you can see.

The user's request:
"${c.prompt}"
Then they asked for these changes: ${c.followups.map(f=>'"'+f+'"').join(' ')}

Score from 1 to 5 (whole numbers):
- matches_request: 5 = everything asked for is visibly there; 3 = main parts there, some missing; 1 = a different app or mostly missing.
- design: 5 = looks like a professional product a top agency would ship (clear hierarchy, considered typography and colour, real imagery, consistent components, generous rhythm); 3 = clean but generic template look; 1 = broken layout or ugly.
- mobile: 5 = great on the phone (stacked, tappable, nothing overflowing, phone-appropriate navigation); 3 = usable; 1 = broken.
- overall: your overall verdict on design quality, 1 to 5.
Be calibrated and strict: a typical AI-generated landing page is a 3. Reserve 5 for work you would be proud to show.

List the most important visible problems (at most 6), each tagged with one area from: ${AREAS.join(', ')}. Be concrete ("hero headline competes with three buttons of equal weight"), not generic.
Respond with ONLY a JSON object:
{"matches_request":n,"design":n,"mobile":n,"overall":n,"issues":[{"area":"...","detail":"..."}],"strengths":["..."],"summary":"one sentence"}`;
}
function parseJudge(content){
 const t=String(content||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'');
 let v;try{v=JSON.parse(t)}catch{const a=t.indexOf('{'),b=t.lastIndexOf('}');if(a<0||b<=a)throw Error('Judge reply was not JSON');v=JSON.parse(t.slice(a,b+1))}
 const score=k=>{const n=Math.round(Number(v[k]));if(!(n>=1&&n<=5))throw Error('Judge score '+k+' missing');return n};
 return{matches_request:score('matches_request'),design:score('design'),mobile:score('mobile'),overall:score('overall'),
  issues:(Array.isArray(v.issues)?v.issues:[]).filter(i=>i&&i.detail).slice(0,6).map(i=>({area:AREAS.includes(String(i.area).toLowerCase())?String(i.area).toLowerCase():'polish',detail:String(i.detail).slice(0,300)})),
  strengths:(Array.isArray(v.strengths)?v.strengths:[]).map(s=>String(s).slice(0,200)).slice(0,4),summary:String(v.summary||'').slice(0,300)};
}
const mime=f=>/\.jpe?g$/i.test(f)?'image/jpeg':/\.webp$/i.test(f)?'image/webp':'image/png';
async function judgeApp(c,files,{model,key,fetchImpl=fetch}){
 const images=files.filter(f=>f&&fs.existsSync(f));
 if(!images.length)throw Error('No screenshots to judge');
 for(const f of images)if(fs.statSync(f).size>8*1024*1024)throw Error(path.basename(f)+' is larger than 8 MB');
 let last;
 for(let attempt=1;attempt<=2;attempt++){
  const r=await fetchImpl('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key,'X-Title':'Kairoq design judge'},
   body:JSON.stringify({model,temperature:0,max_tokens:2000,messages:[{role:'user',content:[{type:'text',text:judgePrompt(c)},...images.map(f=>({type:'image_url',image_url:{url:'data:'+mime(f)+';base64,'+fs.readFileSync(f).toString('base64')}}))]}]})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok){last=Error(data.error?.message||'Judge HTTP '+r.status);continue}
  try{return{...parseJudge(data.choices?.[0]?.message?.content),cost:Number(data.usage?.cost)||null}}catch(e){last=e}
 }
 throw last;
}
// Lovable screenshots: from a folder (<case>-desktop.png / -phone.png) or taken from URLs.
async function lovableShots(o,cases,shotsDir,browser){
 const found={};
 if(o.lovable){
  for(const c of cases){const files=['desktop','phone'].map(v=>['png','jpg','jpeg','webp'].map(e=>path.join(o.lovable,c.id+'-'+v+'.'+e)).find(f=>fs.existsSync(f))).filter(Boolean);if(files.length)found[c.id]=files}
 }
 if(o.lovableUrls){
  const urls=JSON.parse(fs.readFileSync(o.lovableUrls,'utf8'));
  if(!browser)throw Error('--lovable-urls needs Chromium (use --chromium)');
  for(const c of cases){if(!urls[c.id]||found[c.id])continue;process.stdout.write('Lovable '+c.id+' screenshots … ');const b=await browserCheck(browser,urls[c.id],[],path.join(shotsDir,'lovable-'+c.id));found[c.id]=b.shots;console.log(b.shots.length?'ok':'failed: '+b.errors.join('; '))}
 }
 return found;
}
async function runJudge(o,cases,results,shotsDir,outDir,browser,{fetchImpl}={}){
 if(!o.judgeModel)throw Error('The judge needs --judge-model <OpenRouter model id> (or KAIROQ_JUDGE_MODEL)');
 if(!o.key)throw Error('The judge needs OPENROUTER_API_KEY (or --openrouter-key)');
 const byId=Object.fromEntries(cases.map(c=>[c.id,c]));
 const lovable=await lovableShots(o,cases,shotsDir,browser);
 const todo=results.filter(r=>r.screenshots&&byId[r.case]).length+Object.keys(lovable).length;
 console.log('Judging '+todo+' apps with '+o.judgeModel+' …');
 for(const r of results){
  if(!r.screenshots||!byId[r.case])continue;
  process.stdout.write('  '+r.case+' '+r.tier+'/'+r.mode+' … ');
  try{r.judge=await judgeApp(byId[r.case],r.screenshots.split(' ').map(s=>path.join(outDir,s)),{model:o.judgeModel,key:o.key,fetchImpl});console.log('overall '+r.judge.overall)}
  catch(e){r.judge={error:String(e.message||e).slice(0,200)};console.log('failed: '+r.judge.error)}
 }
 const lov={};
 for(const [id,files] of Object.entries(lovable)){
  process.stdout.write('  '+id+' (Lovable) … ');
  try{lov[id]=await judgeApp(byId[id],files,{model:o.judgeModel,key:o.key,fetchImpl});console.log('overall '+lov[id].overall)}
  catch(e){lov[id]={error:String(e.message||e).slice(0,200)};console.log('failed: '+lov[id].error)}
 }
 return lov;
}

// ---------- reports ----------
const avg=xs=>{const v=xs.filter(x=>typeof x==='number');return v.length?Math.round(v.reduce((a,b)=>a+b,0)/v.length*10)/10:null};
const fmt=n=>n===null||n===undefined?'-':String(n);
function writeReports(outDir,results,meta,lovable={}){
 const cols=['case','name','category','tier','mode','first_status','first_seconds','followups','followup_seconds','total_seconds','credits_used','agent_steps','runtime_errors','preview_errors','expected_found','missing','security_high','security_medium','versions','first_error','followup_error','preview','screenshots'];
 const judged=results.some(r=>r.judge&&!r.judge.error);
 const judgeCols=judged?['judge_matches_request','judge_design','judge_mobile','judge_overall','judge_summary']:[];
 const scores=['score_matches_request','score_design','score_works','score_mobile','score_edits','notes','lovable_matches_request','lovable_design','lovable_works','lovable_mobile','lovable_edits','lovable_notes'];
 const judgeCell=(r,k)=>r.judge&&!r.judge.error?(k==='judge_summary'?r.judge.summary:r.judge[k.slice(6)]):'';
 // Lovable judge scores pre-fill the Lovable columns; you can overwrite them.
 const lovCell=(r,k)=>{const j=lovable[r.case];if(!j||j.error)return'';return{lovable_matches_request:j.matches_request,lovable_design:j.design,lovable_mobile:j.mobile,lovable_notes:j.summary}[k]??''};
 fs.writeFileSync(path.join(outDir,'scoring-sheet.csv'),[cols.concat(judgeCols,scores).join(','),...results.map(r=>cols.map(k=>csvCell(r[k])).concat(judgeCols.map(k=>csvCell(judgeCell(r,k))),scores.map(k=>csvCell(k.startsWith('lovable_')?lovCell(r,k):''))).join(','))].join('\n')+'\n');
 const ok=results.filter(r=>r.first_status==='complete').length;
 const lines=['# Kairoq real-model test, '+(meta.date||new Date().toISOString()).slice(0,16).replace('T',' ')+' UTC','',(meta.url||'')+' · tiers '+(meta.tiers||[]).join(', ')+' · modes '+(meta.modes||[]).join(', '),'',
  '**'+ok+'/'+results.length+'** first builds completed. Score each run 1-5 in `scoring-sheet.csv` (see docs/real-model-test-plan.md), and build the same prompts in Lovable for the comparison columns.','',
  '| Case | Tier | Mode | First build | Seconds | Follow-ups | Credits | Expected text | Preview errors | Security high/med |','|---|---|---|---|---|---|---|---|---|---|',
  ...results.map(r=>'| '+[r.name,r.tier,r.mode,r.first_status+(r.first_error?': '+String(r.first_error).slice(0,60):''),r.first_seconds??'',r.followups||'-',r.credits_used??'',r.expected_found||'-',r.preview_errors??'-',(r.security_high??'-')+'/'+(r.security_medium??'-')].join(' | ')+' |')];
 const byTier={};for(const r of results){const k=r.tier+' / '+r.mode;(byTier[k]=byTier[k]||[]).push(r)}
 lines.push('','## By tier and mode','','| Tier / mode | Completed | Avg seconds | Avg credits | Follow-ups OK |'+(judged?' Judge design | Judge mobile | Judge overall |':''),'|---|---|---|---|---|'+(judged?'---|---|---|':''));
 for(const [k,rs] of Object.entries(byTier)){
  const done=rs.filter(r=>r.first_status==='complete');const a=f=>done.length?Math.round(done.reduce((n,r)=>n+(Number(r[f])||0),0)/done.length):'-';
  const fu=rs.reduce((n,r)=>{const m=/^(\d+)\/(\d+)$/.exec(r.followups||'');return m?[n[0]+ +m[1],n[1]+ +m[2]]:n},[0,0]);
  const j=f=>fmt(avg(rs.map(r=>r.judge&&!r.judge.error?r.judge[f]:null)));
  lines.push('| '+k+' | '+done.length+'/'+rs.length+' | '+a('total_seconds')+' | '+a('credits_used')+' | '+(fu[1]?fu[0]+'/'+fu[1]:'-')+' |'+(judged?' '+j('design')+' | '+j('mobile')+' | '+j('overall')+' |':''));
 }
 if(judged){
  const lovOk=Object.entries(lovable).filter(([,j])=>!j.error);
  lines.push('','## Design judge'+(meta.judgeModel?' ('+meta.judgeModel+')':''),'','Scores 1-5 from screenshots only (it cannot click, so "works" stays yours to score). The judge is not told which builder made an app.','');
  if(lovOk.length){
   const tm=Object.keys(byTier);
   lines.push('| Case | '+tm.map(k=>'Kairoq '+k).join(' | ')+' | Lovable | Best Kairoq − Lovable |','|---|'+tm.map(()=>'---|').join('')+'---|---|');
   for(const id of [...new Set(results.map(r=>r.case))]){
    const cells=tm.map(k=>{const r=byTier[k].find(x=>x.case===id);return r&&r.judge&&!r.judge.error?r.judge.overall:null});
    const l=lovable[id]&&!lovable[id].error?lovable[id].overall:null,best=cells.filter(x=>x!==null).length?Math.max(...cells.filter(x=>x!==null)):null;
    lines.push('| '+id+' | '+cells.map(fmt).join(' | ')+' | '+fmt(l)+' | '+(best!==null&&l!==null?(best-l>0?'+':'')+(best-l):'-')+' |');
   }
   const lovAvg=avg(lovOk.map(([,j])=>j.overall));
   lines.push('','Lovable average overall: **'+fmt(lovAvg)+'**. '+Object.entries(byTier).map(([k,rs])=>'Kairoq '+k+': **'+fmt(avg(rs.filter(r=>lovable[r.case]&&!lovable[r.case].error).map(r=>r.judge&&!r.judge.error?r.judge.overall:null)))+'**').join(', ')+' (same cases).');
  }
  // What to fix first: the problem areas the judge named most often in Kairoq apps.
  const count={};for(const r of results)for(const i of (r.judge&&r.judge.issues)||[]){(count[i.area]=count[i.area]||[]).push(r.case+' '+r.tier+': '+i.detail)}
  const top=Object.entries(count).sort((a,b)=>b[1].length-a[1].length);
  if(top.length){lines.push('','### Most common design problems in Kairoq apps','');for(const [area,list] of top.slice(0,8))lines.push('- **'+area+'** ('+list.length+'): '+list.slice(0,2).map(d=>d.replace(/\|/g,'/')).join(' · '))}
  const notes=['# Design judge notes','',...results.filter(r=>r.judge).map(r=>'## '+r.case+' · '+r.tier+' / '+r.mode+'\n\n'+(r.judge.error?'Not judged: '+r.judge.error:'Matches '+r.judge.matches_request+' · design '+r.judge.design+' · mobile '+r.judge.mobile+' · overall '+r.judge.overall+'\n\n'+r.judge.summary+'\n\nProblems:\n'+r.judge.issues.map(i=>'- ['+i.area+'] '+i.detail).join('\n')+(r.judge.strengths.length?'\n\nStrengths:\n'+r.judge.strengths.map(s=>'- '+s).join('\n'):''))+'\n'),
   ...Object.entries(lovable).map(([id,j])=>'## '+id+' · Lovable\n\n'+(j.error?'Not judged: '+j.error:'Matches '+j.matches_request+' · design '+j.design+' · mobile '+j.mobile+' · overall '+j.overall+'\n\n'+j.summary+'\n\nProblems:\n'+j.issues.map(i=>'- ['+i.area+'] '+i.detail).join('\n'))+'\n')];
  fs.writeFileSync(path.join(outDir,'judge-notes.md'),notes.join('\n'));
  lines.push('','Every app\'s problems and strengths are in `judge-notes.md`.');
 }
 fs.writeFileSync(path.join(outDir,'summary.md'),lines.join('\n')+'\n');
}

function loadCases(ids){
 const all=JSON.parse(fs.readFileSync(path.join(__dirname,'model-eval-prompts.json'),'utf8')).cases;
 const cases=ids?all.filter(c=>ids.includes(c.id)):all;
 if(ids&&cases.length!==ids.length)throw Error('Unknown case id. Known: '+all.map(c=>c.id).join(', '));
 return cases;
}
async function judgeOnly(o){
 const outDir=path.resolve(o.judgeOnly);
 const results=JSON.parse(fs.readFileSync(path.join(outDir,'results.json'),'utf8'));
 let meta={};try{meta=JSON.parse(fs.readFileSync(path.join(outDir,'meta.json'),'utf8'))}catch{}
 const cases=loadCases(o.cases?o.cases.split(',').map(s=>s.trim()):null);
 const browser=o.lovableUrls?await launch(o):null;
 try{
  const lovable=await runJudge(o,cases,results,path.join(outDir,'shots'),outDir,browser);
  fs.writeFileSync(path.join(outDir,'results.json'),JSON.stringify(results,null,1));
  writeReports(outDir,results,{...meta,judgeModel:o.judgeModel},lovable);
  console.log('\nDone. Updated summary.md, scoring-sheet.csv and judge-notes.md in '+outDir);
 }finally{if(browser)await browser.close()}
}

async function main(){
 const o=args(process.argv.slice(2));
 if(o.judgeOnly)return judgeOnly(o);
 if(o.help||!o.url||!o.email||!o.password){console.log(HELP);process.exit(o.help?0:1)}
 const cases=loadCases(o.cases?o.cases.split(',').map(s=>s.trim()):null);
 const tiers=o.tiers.split(',').map(s=>s.trim()),modes=o.modes.split(',').map(s=>s.trim());
 if(o.judge&&(!o.judgeModel||!o.key))throw Error('--judge needs --judge-model <OpenRouter model id> and OPENROUTER_API_KEY (or --openrouter-key)');
 const client=new Client(o.url);
 await client.call('POST','/login',{email:o.email,password:o.password});
 const me=await client.call('GET','/me');
 const tierInfo=Object.fromEntries((me.tiers||[]).map(t=>[t.id,t]));
 for(const t of tiers){if(!tierInfo[t])throw Error('Unknown tier '+t);if(!tierInfo[t].enabled)throw Error('Tier '+t+' is not enabled on this server')}
 const runs=[];for(const c of cases)for(const tier of tiers)for(const mode of modes)runs.push({c,tier,mode});
 const messagesPer=c=>1+(o.followups?c.followups.length:0);
 const estimate=runs.reduce((n,r)=>n+messagesPer(r.c)*tierInfo[r.tier].credits*(r.mode==='agent'?(me.agent_multiplier||3):1),0);
 const balance=me.viewer&&me.viewer.account?me.viewer.account.credits:null;
 console.log(runs.length+' runs ('+cases.length+' cases × '+tiers.join('/')+' × '+modes.join('/')+'), '+runs.reduce((n,r)=>n+messagesPer(r.c),0)+' messages, up to '+estimate+' credits'+(balance!==null?' (balance '+balance+')':'')+'.');
 if(o.judge)console.log('Then '+o.judgeModel+' judges '+runs.length+' apps'+(o.lovable||o.lovableUrls?' plus the Lovable ones':'')+' (roughly $0.03-0.20 each on OpenRouter, depending on the model).');
 if(!o.yes){console.log('Add --yes to run.');return}
 if(balance!==null&&balance<estimate)console.warn('Warning: the balance may run out before the end.');
 const outDir=path.resolve(o.out,new Date().toISOString().replace(/[:.]/g,'-').slice(0,19));
 fs.mkdirSync(path.join(outDir,'shots'),{recursive:true});
 const meta={date:new Date().toISOString(),url:o.url,tiers,modes};
 fs.writeFileSync(path.join(outDir,'meta.json'),JSON.stringify(meta,null,1));
 const browser=await launch(o);
 const timeout=(o.timeout||20)*60000,results=[];
 for(const [i,{c,tier,mode}] of runs.entries()){
  const label=c.id+'-'+tier+'-'+mode,row={case:c.id,name:c.name,category:c.category,tier,mode};
  process.stdout.write('['+(i+1)+'/'+runs.length+'] '+label+' … ');
  const started=Date.now();
  try{
   const before=(await client.call('GET','/me')).viewer?.account?.credits;
   const id=(await client.call('POST','/projects',{name:'Eval '+c.name+' ('+tier+', '+mode+')'})).project.id;
   row.project=id;
   if(c.mobile)await client.call('POST','/projects/'+id+'/mobile',{enabled:true});
   const first=await client.waitJob((await client.call('POST','/projects/'+id+'/chat',{message:c.prompt,mode,tier})).job,timeout);
   row.first_status=first.status;row.first_seconds=Math.round((Date.now()-started)/1000);
   row.first_error=first.error||'';row.runtime_errors=(first.result&&first.result.runtime_errors||[]).length;
   row.agent_steps=first.result&&first.result.steps||'';row.polished=Boolean(first.result&&first.result.polished);
   let ok=0,done=0;const fstart=Date.now();
   if(o.followups&&first.status==='complete')for(const f of c.followups){done++;const j=await client.waitJob((await client.call('POST','/projects/'+id+'/chat',{message:f,mode,tier})).job,timeout);if(j.status==='complete')ok++;else row.followup_error=(j.error||'').slice(0,200)}
   row.followups=done?ok+'/'+done:'';row.followup_seconds=done?Math.round((Date.now()-fstart)/1000):'';
   const sec=await client.call('GET','/projects/'+id+'/security').catch(()=>({findings:[]}));
   row.security_high=sec.findings.filter(f=>f.severity==='high').length;row.security_medium=sec.findings.filter(f=>f.severity==='medium').length;
   const project=(await client.call('GET','/projects/'+id)).project;
   row.versions=project.versions.length;row.preview=project.preview_url?client.base+project.preview_url:'';
   row.design_style=project.design?project.design.name:'';
   if(browser&&row.preview){const b=await browserCheck(browser,row.preview,c.expect,path.join(outDir,'shots',label));row.preview_errors=b.errors.length;row.expected_found=b.hits+'/'+c.expect.length;row.missing=b.missing.join(' | ');row.screenshots=b.shots.map(s=>path.relative(outDir,s)).join(' ')}
   const after=(await client.call('GET','/me')).viewer?.account?.credits;
   row.credits_used=before!==undefined&&after!==undefined?before-after:'';
   console.log(first.status+' in '+row.first_seconds+'s, follow-ups '+(row.followups||'-')+', credits '+row.credits_used);
  }catch(e){row.first_status=row.first_status||'error';row.first_error=String(e.message||e).slice(0,300);console.log('error: '+row.first_error)}
  row.total_seconds=Math.round((Date.now()-started)/1000);
  results.push(row);
  fs.writeFileSync(path.join(outDir,'results.json'),JSON.stringify(results,null,1));
 }
 let lovable={};
 try{
  if(o.judge){lovable=await runJudge(o,cases,results,path.join(outDir,'shots'),outDir,browser);fs.writeFileSync(path.join(outDir,'results.json'),JSON.stringify(results,null,1))}
 }finally{if(browser)await browser.close()}
 writeReports(outDir,results,{...meta,judgeModel:o.judge?o.judgeModel:''},lovable);
 console.log('\nDone. Results in '+outDir+' (summary.md, scoring-sheet.csv'+(o.judge?', judge-notes.md':'')+', shots/).');
}
if(require.main===module)main().catch(e=>{console.error(e.message||e);process.exit(1)});
module.exports={args,judgePrompt,parseJudge,judgeApp,runJudge,writeReports,lovableShots,AREAS,Client,launch,browserCheck,loadCases};

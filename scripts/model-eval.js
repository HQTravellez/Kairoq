#!/usr/bin/env node
"use strict";
// Real-model test runner for Kairoq Create.
// Builds every test prompt (scripts/model-eval-prompts.json) on a running Kairoq server
// through its normal API, for each chosen model tier and chat mode, sends the follow-up
// edits, then records what happened: time, credits, errors, security findings, whether the
// preview shows the expected content, and screenshots. Output: a CSV scoring sheet (with
// empty columns for your 1-5 scores and Lovable's) plus a Markdown summary.
//
//   node scripts/model-eval.js --url https://your-kairoq.app --email you@example.com --password '...' \
//     [--tiers standard,pro,max] [--modes build,agent] [--cases hotel,crm] [--no-followups] [--out eval-results] [--yes]
//
// Without --yes it only prints the plan and the credit estimate.
const fs=require('fs'),path=require('path');

function args(argv){
 const o={tiers:'standard',modes:'build',cases:'',followups:true,out:'eval-results',yes:false};
 for(let i=0;i<argv.length;i++){
  const a=argv[i],next=()=>argv[++i];
  if(a==='--url')o.url=next();else if(a==='--email')o.email=next();else if(a==='--password')o.password=next();
  else if(a==='--tiers')o.tiers=next();else if(a==='--modes')o.modes=next();else if(a==='--cases')o.cases=next();
  else if(a==='--out')o.out=next();else if(a==='--chromium')o.chromium=next();else if(a==='--timeout')o.timeout=Number(next());
  else if(a==='--no-followups')o.followups=false;else if(a==='--yes')o.yes=true;
  else if(a==='--help'||a==='-h'){o.help=true}
  else throw Error('Unknown option '+a);
 }
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
  --yes                      actually run (otherwise only shows the plan and credit estimate)`;

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
async function browserCheck(browser,url,expect,shotBase){
 const out={errors:[],hits:0,missing:[],shots:[]};
 for(const [label,viewport] of [['desktop',{width:1280,height:800}],['phone',{width:390,height:844}]]){
  const context=await browser.newContext({viewport});const page=await context.newPage();
  if(label==='desktop'){page.on('pageerror',e=>out.errors.push(String(e.message||e).slice(0,200)));page.on('console',m=>{if(m.type()==='error')out.errors.push(m.text().slice(0,200))})}
  try{
   await page.goto(url,{waitUntil:'load',timeout:30000});await page.waitForLoadState('networkidle',{timeout:8000}).catch(()=>{});await page.waitForTimeout(800);
   if(label==='desktop'){const text=(await page.evaluate(()=>document.body.innerText)).toLowerCase();for(const w of expect){if(text.includes(w.toLowerCase()))out.hits++;else out.missing.push(w)}}
   const file=shotBase+'-'+label+'.png';await page.screenshot({path:file,fullPage:label==='desktop'});out.shots.push(file);
  }catch(e){out.errors.push('Page did not load: '+e.message.slice(0,150))}
  finally{await context.close()}
 }
 return out;
}
const csvCell=v=>{const s=v===undefined||v===null?'':String(v);return/[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};

async function main(){
 const o=args(process.argv.slice(2));
 if(o.help||!o.url||!o.email||!o.password){console.log(HELP);process.exit(o.help?0:1)}
 const all=JSON.parse(fs.readFileSync(path.join(__dirname,'model-eval-prompts.json'),'utf8')).cases;
 const ids=o.cases?o.cases.split(',').map(s=>s.trim()):null;
 const cases=ids?all.filter(c=>ids.includes(c.id)):all;
 if(ids&&cases.length!==ids.length)throw Error('Unknown case id. Known: '+all.map(c=>c.id).join(', '));
 const tiers=o.tiers.split(',').map(s=>s.trim()),modes=o.modes.split(',').map(s=>s.trim());
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
 if(!o.yes){console.log('Add --yes to run.');return}
 if(balance!==null&&balance<estimate)console.warn('Warning: the balance may run out before the end.');
 const outDir=path.resolve(o.out,new Date().toISOString().replace(/[:.]/g,'-').slice(0,19));
 fs.mkdirSync(path.join(outDir,'shots'),{recursive:true});
 let browser=null;const exe=chromiumPath(o);
 if(exe){try{const {chromium}=require('playwright-core');browser=await chromium.launch({executablePath:exe})}catch(e){console.warn('Browser checks off: '+e.message)}}
 else console.warn('No Chromium found: preview checks and screenshots are skipped (use --chromium).');
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
   row.agent_steps=first.result&&first.result.steps||'';
   let ok=0,done=0;const fstart=Date.now();
   if(o.followups&&first.status==='complete')for(const f of c.followups){done++;const j=await client.waitJob((await client.call('POST','/projects/'+id+'/chat',{message:f,mode,tier})).job,timeout);if(j.status==='complete')ok++;else row.followup_error=(j.error||'').slice(0,200)}
   row.followups=done?ok+'/'+done:'';row.followup_seconds=done?Math.round((Date.now()-fstart)/1000):'';
   const sec=await client.call('GET','/projects/'+id+'/security').catch(()=>({findings:[]}));
   row.security_high=sec.findings.filter(f=>f.severity==='high').length;row.security_medium=sec.findings.filter(f=>f.severity==='medium').length;
   const project=(await client.call('GET','/projects/'+id)).project;
   row.versions=project.versions.length;row.preview=project.preview_url?client.base+project.preview_url:'';
   if(browser&&row.preview){const b=await browserCheck(browser,row.preview,c.expect,path.join(outDir,'shots',label));row.preview_errors=b.errors.length;row.expected_found=b.hits+'/'+c.expect.length;row.missing=b.missing.join(' | ');row.screenshots=b.shots.map(s=>path.relative(outDir,s)).join(' ')}
   const after=(await client.call('GET','/me')).viewer?.account?.credits;
   row.credits_used=before!==undefined&&after!==undefined?before-after:'';
   console.log(first.status+' in '+row.first_seconds+'s, follow-ups '+(row.followups||'-')+', credits '+row.credits_used);
  }catch(e){row.first_status=row.first_status||'error';row.first_error=String(e.message||e).slice(0,300);console.log('error: '+row.first_error)}
  row.total_seconds=Math.round((Date.now()-started)/1000);
  results.push(row);
  fs.writeFileSync(path.join(outDir,'results.json'),JSON.stringify(results,null,1));
 }
 if(browser)await browser.close();
 // Scoring sheet: measured columns, then empty 1-5 score columns for you and for Lovable.
 const cols=['case','name','category','tier','mode','first_status','first_seconds','followups','followup_seconds','total_seconds','credits_used','agent_steps','runtime_errors','preview_errors','expected_found','missing','security_high','security_medium','versions','first_error','followup_error','preview','screenshots'];
 const scores=['score_matches_request','score_design','score_works','score_mobile','score_edits','notes','lovable_matches_request','lovable_design','lovable_works','lovable_mobile','lovable_edits','lovable_notes'];
 fs.writeFileSync(path.join(outDir,'scoring-sheet.csv'),[cols.concat(scores).join(','),...results.map(r=>cols.map(k=>csvCell(r[k])).concat(scores.map(()=>'')).join(','))].join('\n')+'\n');
 const ok=results.filter(r=>r.first_status==='complete').length;
 const lines=['# Kairoq real-model test, '+new Date().toISOString().slice(0,16).replace('T',' ')+' UTC','',o.url+' · tiers '+tiers.join(', ')+' · modes '+modes.join(', '),'',
  '**'+ok+'/'+results.length+'** first builds completed. Score each run 1-5 in `scoring-sheet.csv` (see docs/real-model-test-plan.md), and build the same prompts in Lovable for the comparison columns.','',
  '| Case | Tier | Mode | First build | Seconds | Follow-ups | Credits | Expected text | Preview errors | Security high/med |','|---|---|---|---|---|---|---|---|---|---|',
  ...results.map(r=>'| '+[r.name,r.tier,r.mode,r.first_status+(r.first_error?': '+r.first_error.slice(0,60):''),r.first_seconds??'',r.followups||'-',r.credits_used??'',r.expected_found||'-',r.preview_errors??'-',(r.security_high??'-')+'/'+(r.security_medium??'-')].join(' | ')+' |')];
 const byTier={};for(const r of results){const k=r.tier+' / '+r.mode;(byTier[k]=byTier[k]||[]).push(r)}
 lines.push('','## By tier and mode','','| Tier / mode | Completed | Avg seconds | Avg credits | Follow-ups OK |','|---|---|---|---|---|');
 for(const [k,rs] of Object.entries(byTier)){const done=rs.filter(r=>r.first_status==='complete');const avg=f=>done.length?Math.round(done.reduce((n,r)=>n+(Number(r[f])||0),0)/done.length):'-';const fu=rs.reduce((n,r)=>{const m=/^(\d+)\/(\d+)$/.exec(r.followups||'');return m?[n[0]+ +m[1],n[1]+ +m[2]]:n},[0,0]);lines.push('| '+k+' | '+done.length+'/'+rs.length+' | '+avg('total_seconds')+' | '+avg('credits_used')+' | '+(fu[1]?fu[0]+'/'+fu[1]:'-')+' |')}
 fs.writeFileSync(path.join(outDir,'summary.md'),lines.join('\n')+'\n');
 console.log('\nDone. Results in '+outDir+' (summary.md, scoring-sheet.csv, shots/).');
}
main().catch(e=>{console.error(e.message||e);process.exit(1)});

#!/usr/bin/env node
"use strict";
// Improves one built-in design skill with real builds and a design judge (skill-lab.js).
// Each evaluation imports the candidate skill into your account, builds the test briefs from
// scripts/model-eval-prompts.json with it switched on, screenshots them and lets a vision model
// judge them. A change is kept only if it raises the score and holds on the held-out briefs.
// The result is written as design-skills/<id>/SKILL.proposed.md with a changelog: read it and
// commit it yourself if you agree. Costs credits for every build: without --yes it only plans.
//
//   node scripts/improve-skill.js --skill editorial --url https://your-kairoq.app --email you@example.com --password '...' \
//     --cases hotel,salon --holdout cafe --judge-model <openrouter vision model> [--rounds 3] [--tier standard] [--yes]
const fs=require('fs'),path=require('path');
const ev=require('./model-eval'),lab=require('../skill-lab');

function opts(argv){const o={rounds:3,tier:'standard'};for(let i=0;i<argv.length;i++){const k=argv[i].replace(/^--/,''),v=argv[i+1];if(k==='yes'){o.yes=true;continue}o[k.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=v;i++}return o}
async function main(){
 const o=opts(process.argv.slice(2));
 if(!o.skill||!o.url||!o.email||!o.password||!o.cases||!o.judgeModel){console.log('Usage: see the top of scripts/improve-skill.js');process.exit(1)}
 const file=path.join(__dirname,'..','design-skills',o.skill,'SKILL.md');
 if(!fs.existsSync(file))throw Error('No built-in skill '+o.skill);
 const key=o.openrouterKey||process.env.OPENROUTER_API_KEY;if(!key)throw Error('Needs OPENROUTER_API_KEY');
 const train=ev.loadCases(o.cases.split(',')),holdout=o.holdout?ev.loadCases(o.holdout.split(',')):[];
 const rounds=Number(o.rounds)||3,builds=(train.length*(rounds+1))+(holdout.length*(rounds+1));
 console.log('Up to '+builds+' builds on the '+o.tier+' tier, each judged by '+o.judgeModel+'.');
 if(!o.yes){console.log('Add --yes to run.');return}
 const client=new ev.Client(o.url);await client.call('POST','/login',{email:o.email,password:o.password});
 const browser=await ev.launch(o);if(!browser)throw Error('Needs Chromium (--chromium <path>)');
 const outDir=path.resolve('skill-lab',o.skill+'-'+new Date().toISOString().replace(/[:.]/g,'-').slice(0,19));fs.mkdirSync(outDir,{recursive:true});
 let n=0;
 const evaluate=async(body,cases)=>{
  const skill=(await client.call('POST','/skills',{text:body})).skill;
  const scores=[],notes=[];
  try{
   for(const c of cases){
    const label='e'+(++n)+'-'+c.id;
    const id=(await client.call('POST','/projects',{name:'Skill lab '+o.skill+' '+label})).project.id;
    await client.call('POST','/projects/'+id+'/design',{skills:[skill.id]});
    const job=await client.waitJob((await client.call('POST','/projects/'+id+'/chat',{message:c.prompt,tier:o.tier})).job,20*60000);
    if(job.status!=='complete'){notes.push(c.id+': build failed');scores.push(1);continue}
    const p=(await client.call('GET','/projects/'+id)).project;
    const shots=(await ev.browserCheck(browser,client.base+p.preview_url,c.expect,path.join(outDir,label))).shots;
    const j=await ev.judgeApp({...c,followups:[]},shots,{model:o.judgeModel,key});
    scores.push(j.overall);notes.push(...j.issues.map(i=>c.id+' ['+i.area+'] '+i.detail));
    await client.call('DELETE','/projects/'+id).catch(()=>{});
   }
  }finally{await client.call('DELETE','/skills',{id:skill.id}).catch(()=>{})}
  return{score:lab.mean(scores),notes};
 };
 const callModel=async(opts,parse)=>{
  const r=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key,'X-Title':'Kairoq skill lab'},body:JSON.stringify({model:o.labModel||o.judgeModel,temperature:opts.temperature,max_tokens:opts.maxOutputTokens,messages:opts.messages})});
  const d=await r.json();if(!r.ok)throw Error(d.error?.message||'HTTP '+r.status);return parse(d.choices[0].message.content);
 };
 try{
  const r=await lab.improve({body:fs.readFileSync(file,'utf8'),train,holdout,evaluate,callModel,rounds,log:console.log});
  fs.writeFileSync(path.join(outDir,'history.json'),JSON.stringify(r.history,null,1));
  if(r.improved){fs.writeFileSync(path.join(path.dirname(file),'SKILL.proposed.md'),r.body);console.log('\nImproved to '+r.score.toFixed(2)+'. Proposal: design-skills/'+o.skill+'/SKILL.proposed.md (history in '+outDir+')')}
  else console.log('\nNo change beat the current skill. History in '+outDir);
 }finally{await browser.close()}
}
if(require.main===module)main().catch(e=>{console.error(e.message||e);process.exit(1)});

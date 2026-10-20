"use strict";
// The launch gate: before a version goes live, the flows that bring in money or customers
// (book, order, pay, enquire, sign up) must work in Kairoq's browser. Once per version:
//  1. every customer flow gets a saved check where one can be written (feature-checks.js);
//  2. every saved check runs on this version, on a test copy of the data;
//  3. the code has no serious security mistake (a secret in the page, SQL built from strings...).
// A failing check, a money flow that could not be checked, or a serious mistake holds the
// publish back with the reasons; the owner can still publish anyway (force), and the live guard
// then watches it every hour.
const builder=require('./react-builder');

function enabled(){return process.env.KAIROQ_LAUNCH_GATE!=='off'}
async function check(id,n,{callModel,inspect}={}){
 const checks=require('./react-checks'),coverage=require('./feature-checks');
 let meta=builder.loadMeta(id);
 n=Number(n)||meta.current_version;
 if(!enabled()||!inspect||!meta.versions.some(v=>v.n===n))return{ok:true,skipped:true,blockers:[],version:n};
 const blockers=[],notes=[];
 // 1. Flows without a check get one (Kairoq pays; once per version).
 let cov=null;
 if(callModel)try{cov=await coverage.ensure(id,{callModel,inspect,version:n})}catch(e){notes.push('Kairoq could not list the app\'s flows this time ('+String(e.message||e).slice(0,120)+').')}
 // 2. Every saved check on this version.
 meta=builder.loadMeta(id);
 const r=checks.list(meta).some(c=>c.enabled!==false)?await checks.run(id,builder.previewUrl(meta,n),{inspect,version:n}):{ran:0,failed:[],skipped:false};
 if(r.skipped)return{ok:true,skipped:true,blockers:[],version:n};
 for(const f of r.failed)blockers.push({kind:'check',name:f.name,why:'it failed in Kairoq\'s browser'+(f.step?' at: '+f.step:'')+(f.error?' ('+String(f.error).slice(0,140)+')':'')});
 // Money flows nobody could check: when none of the money flows is protected, nothing shows the
 // app can take business, so that holds the publish; otherwise they are warnings (a payment page
 // on another site, for one, cannot be checked on a test copy).
 const warnings=[],passing=new Set(checks.list(builder.loadMeta(id)).map(c=>c.name.toLowerCase()));
 const money=(cov&&cov.version===n?cov.flows:[]).filter(f=>f.money);
 const unchecked=money.filter(f=>!f.covered&&!passing.has(String(f.name).toLowerCase()));
 const target=money.length&&unchecked.length===money.length?blockers:warnings;
 for(const f of unchecked)target.push({kind:'unchecked',name:f.name,why:f.why||'Kairoq could not check it'});
 // 3. Serious mistakes in the code (collection access can be deliberate, so it is not counted).
 try{
  const files=builder.loadFiles(id,n);let cfg={collections:{}};try{cfg=require('./react-backend').parseConfig(files)}catch{}
  for(const x of require('./react-security').scan(files,cfg))if(x.severity==='high'&&x.file!=='src/backend.json')blockers.push({kind:'security',name:x.title,why:(x.file?x.file+': ':'')+x.fix});
 }catch{}
 const result={ok:!blockers.length,version:n,at:new Date().toISOString(),blockers:blockers.slice(0,12),warnings:warnings.slice(0,8),ran:r.ran,protected:checks.list(builder.loadMeta(id)).filter(c=>c.enabled!==false).map(c=>c.name),...(notes.length?{notes}:{})};
 const fresh=builder.loadMeta(id);fresh.launch_gate=result;builder.saveMeta(fresh);
 return result;
}
// One message for the owner.
function message(g){
 const kinds={check:'Not working',unchecked:'Not checked',security:'Security'};
 return'Before this goes live, Kairoq found:\n'+g.blockers.map(b=>'- '+kinds[b.kind]+': '+b.name+' ('+b.why+')').join('\n')+'\n\nFix these first (ask the chat, or use Fix it), or publish anyway: the live guard will then check the app every hour.';
}
module.exports={check,message,enabled};

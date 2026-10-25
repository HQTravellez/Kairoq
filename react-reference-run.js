"use strict";
// Build from a reference, after the analysis: stores the analysis and plan, gathers openly
// licensed assets, and after the agent's build tests the plan's user journeys in a browser on
// desktop and phone, repairs what fails, compares the design with the reference, and (when
// the owner asked) publishes the app, checks the live site and pushes the code to GitHub.
const fs=require('fs'),path=require('path');
const builder=require('./react-builder'),reference=require('./react-reference'),checks=require('./react-checks');

function dir(id){return path.join(builder.projectDir(id),'reference')}
function saveShots(id,shots){
 const d=dir(id);fs.rmSync(d,{recursive:true,force:true});fs.mkdirSync(d,{recursive:true});
 const names=[];
 for(const s of shots.slice(0,8)){const name=String(s.name).toLowerCase().replace(/[^a-z0-9-]+/g,'-').slice(0,50)+'.'+(s.mime==='image/png'?'png':'jpg');fs.writeFileSync(path.join(d,name),Buffer.from(s.data,'base64'));names.push(name)}
 return names;
}
function loadShots(id,names){
 return(names||[]).map(n=>{const f=path.join(dir(id),path.basename(n));if(!fs.existsSync(f))return null;return{name:n,mime:n.endsWith('.png')?'image/png':'image/jpeg',data:fs.readFileSync(f).toString('base64')}}).filter(Boolean);
}
function shotFile(id,name){const n=path.basename(String(name||''));if(!/^[a-z0-9-]+\.(jpg|png)$/.test(n))return null;const f=path.join(dir(id),n);return fs.existsSync(f)?f:null}
function save(id,{source,analysis,plan,shots}){
 const meta=builder.loadMeta(id);
 meta.reference={source,analysis:reference.stored(analysis),plan,shots,created_at:new Date().toISOString()};
 builder.saveMeta(meta);
 return meta.reference;
}
function view(meta){const r=meta.reference;if(!r)return null;return{source:r.source,plan:r.plan,shots:r.shots||[],created_at:r.created_at,built_at:r.built_at||null,last:r.last||null,analysis:summary(r.analysis),reviews:r.reviews||null,match:r.match||null}}
// What the editor shows about the analysis.
function summary(a){
 if(!a)return null;
 if(a.kind==='website')return{kind:a.kind,url:a.url,pages:(a.pages||[]).map(p=>({path:p.path,title:p.title||'',error:p.error||null})),api_calls:(a.api||[]).length,integrations:a.integrations||[],openapi:a.openapi?{url:a.openapi.url,endpoints:a.openapi.endpoints.length}:null,phone:a.phone||null,design:a.design||null,robots_skipped:a.robots_skipped||[],rea:Boolean(a.rea_network)};
 if(a.kind==='repo')return{kind:a.kind,url:a.url,license:a.license,frameworks:a.frameworks,languages:a.languages,files:a.files||[],openapi:a.openapi?{endpoints:a.openapi.endpoints.length}:null};
 if(a.kind==='app')return{kind:a.kind,name:a.name,files:a.files,rea:true};
 return{kind:a.kind,count:a.count};
}

const COMPARE_PROMPT=`You are a senior product designer reviewing a new app. The first images show a REFERENCE product (desktop, then phone). The last images show the NEW app (desktop, then phone), an independent implementation with comparable functionality and its own brand.
Judge the NEW app on whether it reaches the reference's level of design quality and usability: layout and hierarchy, spacing, typography, imagery, navigation, calls to action, responsiveness on the phone, and overall polish. It must not copy the reference's brand, text, logo or photos; never suggest that.
Respond with ONLY JSON: {"score":0-10,"strengths":["up to 4"],"improvements":["up to 8 concrete, specific changes for the NEW app, e.g. 'Give the hero a full-width photo with the search form overlaid at the bottom'"]}`;
function parseCompare(content){
 let v=content;
 if(typeof v==='string'){const t=v.trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'');try{v=JSON.parse(t)}catch{const a=t.indexOf('{'),b=t.lastIndexOf('}');if(a<0||b<=a)throw Error('The comparison was not JSON');v=JSON.parse(t.slice(a,b+1))}}
 const score=Math.max(0,Math.min(10,Math.round(Number(v&&v.score)*10)/10));
 if(!Number.isFinite(score))throw Error('The comparison has no score');
 const list=(x,n)=>(Array.isArray(x)?x:[]).map(s=>String(s).replace(/\s+/g,' ').trim().slice(0,240)).filter(Boolean).slice(0,n);
 return{score,strengths:list(v.strengths,4),improvements:list(v.improvements,8)};
}
async function compareDesign(refShots,appShots,{callModel,tier='standard',signal}){
 const pick=(shots,re)=>shots.find(s=>re.test(s.name));
 const images=[pick(refShots,/desktop/),pick(refShots,/phone/),pick(appShots,/desktop/),pick(appShots,/phone/)].filter(Boolean);
 if(images.length<2)return null;
 const content=[{type:'text',text:'Reference images: '+refShots.filter(s=>images.includes(s)).length+'. New app images: '+appShots.filter(s=>images.includes(s)).length+'.'},...images.map(s=>({type:'image_url',image_url:{url:'data:'+s.mime+';base64,'+s.data}}))];
 return callModel({messages:[{role:'system',content:COMPARE_PROMPT},{role:'user',content}],temperature:0.2,maxOutputTokens:1500,signal,tier:tier==='standard'?'vision':tier,design:true},parseCompare);
}

// Runs inside the build job before the agent: finds openly licensed photos, sounds and models.
async function prepare(id,plan,{fetchImpl=fetch}={}){
 const found=await require('./react-asset-search').gather(id,plan.assets,{fetchImpl}).catch(e=>({saved:[],linked:[],errors:[String(e.message||e)]}));
 return{assets:found,note:require('./react-asset-search').note(found)};
}
const keep=r=>r?{version:r.version,summary:r.summary,runtime_errors:r.runtime_errors,check_failures:r.check_failures,checks:r.checks}:{};
// Runs inside the build job after the agent. ctx: {callModel,inspect,checkRuntime,designShots,tier,signal,update,onStream,imageGen,imageNote,isOwner,canPublish}
async function finish(id,result,{plan,publish=false,github=null,slug},ctx){
 const {callModel,inspect,checkRuntime,designShots,tier='standard',signal,update=()=>{},onStream}=ctx;
 const report={checks:[],repairs:0,last_run:null,design:null,polished:false,published:null,github:null,problems:[]};
 const problem=(what,detail)=>report.problems.push(what+': '+String(detail||'').slice(0,240));
 const progress=s=>update({status:s,stream:null});
 if(!result||result.unchanged)return{...result,reference:report};
 const editOpts={callModel,onStream,tier,checkRuntime,inspect,signal,onProgress:progress};
 // 1. The plan's user journeys become saved checks.
 if(inspect&&plan.journeys.length){
  progress('verifying');
  for(const j of plan.journeys.slice(0,5)){
   if(signal&&signal.aborted)break;
   try{const c=await checks.write(id,j.name+': '+j.steps,{callModel,tier:'standard',signal});const saved=checks.save(id,{...c,name:j.name},{source:'reference'});report.checks.push({id:saved.id,name:saved.name})}
   catch(e){if(signal&&signal.aborted)break;problem('Could not write a test for "'+j.name+'"',e.message)}
  }
  // 2. Run them on desktop and phone; repair what fails (up to two rounds).
  for(let round=0;report.checks.length&&!(signal&&signal.aborted);round++){
   const meta=builder.loadMeta(id),url=builder.previewUrl(meta),n=meta.current_version;
   const desk=await checks.run(id,url,{inspect,version:n});
   const phone=desk.skipped?{ran:0,passed:0,failed:[]}:await checks.run(id,url,{inspect,version:n,viewport:'phone',record:false});
   const failed=[...desk.failed,...phone.failed];
   report.last_run={version:n,desktop:{ran:desk.ran,passed:desk.passed},phone:{ran:phone.ran,passed:phone.passed},failed:failed.map(f=>({name:f.name,step:f.step,error:f.error}))};
   if(desk.skipped||!failed.length||round>=2)break;
   progress('repairing');report.repairs++;
   try{
    const r=await builder.edit(id,'These user journeys from the approved plan fail when tested in a browser. Find the root cause of each and fix the app so every journey works end to end on desktop and on a 390px phone (no sideways scrolling; navigation reachable from a menu button):\n'+checks.failureText(failed),{...editOpts,displayText:'Fix the failing journeys ('+failed.length+')'});
    result={...result,...keep(r)};
   }catch(e){if(signal&&signal.aborted)break;problem('Repair',e.message);break}
   progress('verifying');
  }
  // A journey that still fails on desktop is switched off, so it does not block later
  // changes and publishing, and reported to the owner.
  const still=(report.last_run&&report.last_run.failed||[]).filter(f=>!/ \(phone\)$/.test(f.name));
  if(still.length){const meta=builder.loadMeta(id);for(const f of still){const c=checks.list(meta).find(x=>x.name===f.name);if(c)try{checks.setEnabled(id,c.id,false)}catch{}}result={...result,check_failures:still}}
 }
 // 3. Compare the design with the reference and polish once when it falls short.
 const meta=builder.loadMeta(id),refShots=loadShots(id,meta.reference&&meta.reference.shots);
 if(designShots&&refShots.length&&!(signal&&signal.aborted)){
  try{
   progress('comparing');
   const appShots=await designShots(builder.previewUrl(meta));
   report.design=await compareDesign(refShots,appShots,{callModel,tier,signal});
   if(report.design&&report.design.score<8&&report.design.improvements.length){
    const r=await builder.polish(id,{shots:designShots,note:'Compared with the reference product, improve: '+report.design.improvements.join('; '),...editOpts,tier:tier==='standard'?'vision':tier,imageGen:ctx.imageGen,imageNote:ctx.imageNote});
    result={...result,...keep(r),check_failures:[...(result.check_failures||[]),...(r.check_failures||[])]};report.polished=true;
   }
  }catch(e){if(!(signal&&signal.aborted))problem('Design comparison',e.message)}
 }
 // 3b. Match score: each planned feature checked against the code (react-parity.js).
 if(callModel&&!(signal&&signal.aborted)){
  try{progress('scoring');const runs=report.last_run?[...report.checks.map(c=>({name:c.name,ok:!(report.last_run.failed||[]).some(f=>f.name===c.name)}))]:[];report.match=await require('./react-parity').judge(id,{plan,callModel,signal,journeys:runs})}
  catch(e){if(!(signal&&signal.aborted))problem('Match score',e.message)}
 }
 // 3c. Nothing of the original left: its name, web address or brand colours (react-sweep.js).
 try{progress('sweeping');const sweep=require('./react-sweep'),found=sweep.check(id);report.leftovers=found.slice(0,20);if(found.length)problem('Still has the original\'s '+[...new Set(found.map(f=>f.kind))].join(', '),sweep.message(found))}catch{}
 // 4. Publish and verify the public site (owners only, and only when the journeys pass).
 if(publish&&ctx.canPublish&&!(signal&&signal.aborted)){
  const broken=(result.check_failures||[]).length||(result.runtime_errors||[]).length;
  if(broken)problem('Not published','fix the failing journeys or errors first, then publish');
  else if((report.leftovers||[]).length)problem('Not published','remove what is left of the original first (above), then publish');
  else try{
   progress('publishing');
   const p=require('./react-hosting').publish(id,{slug});
   const live=checkRuntime?await checkRuntime('/sites/'+p.published.slug+'/'):{errors:[]};
   let reachable=null;
   const abs=p.urls&&(p.urls.subdomain||(/^https?:/.test(p.urls.path)?p.urls.path:null));
   if(abs&&ctx.fetchImpl){try{const r=await ctx.fetchImpl(abs,{signal:AbortSignal.timeout(15000)});reachable=r.ok}catch{reachable=false}}
   report.published={slug:p.published.slug,version:p.published.version,url:abs||p.urls.path,ok:!(live.errors||[]).length&&reachable!==false,errors:(live.errors||[]).slice(0,3),reachable};
  }catch(e){problem('Publish',e.message)}
 }
 // 5. Push the source to GitHub.
 if(github&&ctx.canPublish&&!(signal&&signal.aborted)){
  try{progress('publishing');const r=await require('./react-export').push(id,{repo:github.repo,isOwner:ctx.isOwner});report.github={repo:r.repo||github.repo||null,url:r.url||null,commit:r.commit||null,warning:r.warning||null}}
  catch(e){problem('GitHub push',e.message)}
 }
 const fresh=builder.loadMeta(id);
 if(fresh.reference){fresh.reference.built_at=new Date().toISOString();fresh.reference.last={...report,checks:report.checks.map(c=>c.name)};builder.saveMeta(fresh)}
 return{...result,reference:report};
}
module.exports={saveShots,loadShots,shotFile,save,view,summary,compareDesign,parseCompare,prepare,finish,COMPARE_PROMPT};

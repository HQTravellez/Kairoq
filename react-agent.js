"use strict";
// Agent mode: the model works in steps with tools. It reads and searches the code,
// writes files, builds the app, opens it in a real browser (clicking through flows),
// reads server logs and the SQL database, can look things up on the web, and decides
// when the request is done. The result is saved as one new version.
const fs=require('fs'),path=require('path');
const builder=require('./react-builder');

function intEnv(name,fallback,min,max){const n=Number(process.env[name]);return Number.isInteger(n)?Math.min(max,Math.max(min,n)):fallback}
function maxStepsDefault(){return intEnv('KAIROQ_AGENT_MAX_STEPS',15,2,40)}
function codingRules(){return builder.SYSTEM_PROMPT.replace(/\nRespond with ONLY a JSON object[\s\S]*$/,'')}
function protocol({vision,web,maxSteps}){
 return `

You are working in AGENT MODE: keep working in steps until the request is fully done and verified, like a careful senior engineer.
Each reply is ONLY a JSON object, no markdown fences:
{"thought":"one or two sentences: what you found and what you do next (the user sees this)","actions":[{"tool":"...", ...}]}
Tools (several per step are fine; they run in order):
- {"tool":"read_files","paths":["src/App.jsx"]}: read up to 8 files.
- {"tool":"search","query":"text or regex"}: search every project file; returns matching lines.
- {"tool":"write_files","files":{"src/path.jsx":"full new content"},"delete":["src/old.jsx"]}: create or replace whole files (src/, functions/ and sql/ migrations).
- {"tool":"build_and_test","path":"#/optional-hash-route","steps":[...]}: build the project, open it in a real browser, run optional UI steps, and report errors and visible text${vision?' plus a screenshot':''}.
- {"tool":"test_ui","path":"#/rooms","steps":[{"action":"click","text":"Book now"},{"action":"fill","label":"Email","value":"ana@example.com"},{"action":"select","label":"Room","value":"Suite"},{"action":"press","key":"Enter"},{"action":"expect","text":"Thank you"},{"action":"goto","path":"#/rooms"},{"action":"wait","ms":500}]}: run steps against the last build. Target elements by text, label, placeholder, role (+ text) or selector.
- {"tool":"view_logs"}: server logs: console.log output and errors from server functions, failed backend requests.
- {"tool":"query_db","sql":"SELECT * FROM rooms LIMIT 5"}: read the app's SQL tables (SELECT only).
${web?`- {"tool":"web_search","query":"..."}: search the web; returns links.
- {"tool":"fetch_url","url":"https://..."}: read a public web page or API documentation as text.
`:''}- {"tool":"finish","message":"for the user: what you built and how to use it"}: end when the request is done and the last build_and_test or test_ui passed.
Work this way: understand the request, read what you need, plan, write every needed file, then build_and_test. Exercise the main flows with test_ui (forms, buttons, navigation, sign-in when relevant) and check view_logs after using server functions. Fix every error you find and test again. Never finish with known errors. Be economical: you have at most ${maxSteps} steps.`;
}

function parseStep(content){
 let v=content;
 if(typeof v==='string'){
  const t=v.trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'');
  try{v=JSON.parse(t)}catch{const a=t.indexOf('{'),b=t.lastIndexOf('}');if(a<0||b<=a)throw Error('Agent reply was not JSON');v=JSON.parse(t.slice(a,b+1))}
 }
 if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Agent reply was not a JSON object');
 let actions=Array.isArray(v.actions)?v.actions:v.tool?[v]:[];
 // Accept a plain build-mode answer too.
 if(!actions.length&&v.files&&typeof v.files==='object')actions=[{tool:'write_files',files:v.files,delete:v.delete},{tool:'build_and_test'}];
 actions=actions.filter(a=>a&&typeof a==='object'&&typeof a.tool==='string').slice(0,8);
 if(!actions.length)throw Error('Agent reply needs an "actions" list');
 return{thought:String(v.thought||v.message||'').slice(0,1000),actions};
}
function clip(text,n){text=String(text);return text.length>n?text.slice(0,n)+'\n…(cut, '+(text.length-n)+' more characters)':text}
function htmlToText(html){
 return String(html).replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi,' ').replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr|section|article)>/gi,'\n').replace(/<[^>]+>/g,' ')
  .replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/[ \t]+/g,' ').replace(/ *\n[\s]*/g,'\n').trim();
}
function describe(a){
 const t=a.tool;
 if(t==='read_files')return'Read '+(Array.isArray(a.paths)?a.paths.slice(0,8).join(', '):'files');
 if(t==='search')return'Searched for "'+String(a.query||'').slice(0,60)+'"';
 if(t==='write_files'){const n=Object.keys(a.files||{});const d=Array.isArray(a.delete)?a.delete:[];return'Wrote '+(n.length?n.join(', '):'nothing')+(d.length?'; deleted '+d.join(', '):'')}
 if(t==='build_and_test')return'Built and tested the app'+(Array.isArray(a.steps)&&a.steps.length?' ('+a.steps.length+' UI steps)':'');
 if(t==='test_ui')return'Tested in the browser ('+(Array.isArray(a.steps)?a.steps.length:0)+' steps)';
 if(t==='view_logs')return'Checked server logs';
 if(t==='query_db')return'Queried the database';
 if(t==='web_search')return'Searched the web for "'+String(a.query||'').slice(0,60)+'"';
 if(t==='fetch_url')return'Read '+String(a.url||'').slice(0,80);
 if(t==='finish')return'Finished';
 return'Unknown tool '+t;
}

// Options: callModel, inspect(url,{steps,screenshot}), webSearch(query), fetchUrl(url),
// onStep(entry), signal, tier, images, assetNote, maxSteps.
async function run(id,instruction,{callModel,inspect,webSearch,fetchUrl,onStep=()=>{},signal,tier='standard',images=[],assetNote='',maxSteps}={}){
 const text=String(instruction||'').trim().slice(0,8000);
 if(!text)throw Object.assign(Error('Describe what you want the agent to do'),{status:400});
 let meta=builder.loadMeta(id);
 if(!meta.current_version){await builder.initialize(meta);meta=builder.loadMeta(id)}
 const base=builder.loadFiles(id,meta.current_version);
 const limit=Number.isInteger(maxSteps)?maxSteps:maxStepsDefault();
 const vision=tier!=='standard',web=typeof webSearch==='function';
 const started=new Date().toISOString();
 let work={...base},built=null,dirty=false,lastTest=null,finishWarned=false;
 const steps=[];
 const listing=Object.keys(base).sort().map(n=>n+' ('+Buffer.byteLength(base[n])+' bytes)').join('\n');
 const intro='Project files:\n'+listing+'\n\n'+builder.contextFiles(base,60000)+(assetNote?'\n\n'+assetNote:'')+'\n\nRequest: '+text;
 const messages=[{role:'system',content:codingRules()+builder.knowledgeNote(meta)+protocol({vision,web,maxSteps:limit})},...builder.historyMessages(meta),{role:'user',content:builder.userContent(intro,images)}];
 const introMsg=messages.at(-1);
 const report=patch=>onStep({steps:steps.slice(-40),...patch});

 function dropOldImages(){for(const m of messages)if(Array.isArray(m.content)&&m!==introMsg)m.content=m.content.filter(p=>p.type==='text').map(p=>p.text).join('\n')+'\n(screenshot omitted)'}
 function trimContext(){
  let total=JSON.stringify(messages).length;
  for(let i=messages.indexOf(introMsg)+1;i<messages.length-4&&total>350000;i++){const m=messages[i];if(typeof m.content==='string'&&m.content.length>2000){total-=m.content.length-1500;m.content=m.content.slice(0,1500)+'\n…(older content trimmed)'}}
 }
 async function testBuild(a,prefix){
  if(!built)return{text:'test_ui: nothing is built yet. Use build_and_test first.'};
  if(dirty)prefix+=' Note: files changed since this build; run build_and_test to test them.';
  if(!inspect)return{text:prefix+' (Browser testing is not available on this server.)'};
  const route=String(a.path||'');
  const url=built.url+(route.startsWith('#')?route:'');
  const r=await inspect(url,{steps:Array.isArray(a.steps)?a.steps.slice(0,20):[],screenshot:vision});
  if(r.skipped)return{text:prefix+' (Browser testing is not available on this server.)'};
  lastTest={errors:r.errors,failed:r.steps.filter(s=>!s.ok).length};
  const lines=[prefix];
  if(r.steps.length)lines.push('UI steps:\n'+r.steps.map((s,i)=>(i+1)+'. '+(s.ok?'ok ':'FAILED ')+s.step+(s.ok?'':' → '+s.error)).join('\n'));
  lines.push(r.errors.length?'Problems in the browser:\n'+r.errors.join('\n'):'No errors in the browser.');
  lines.push('Visible text:\n'+clip(r.text||'(none)',2500));
  return{text:lines.join('\n\n'),image:r.screenshot};
 }
 async function buildAndTest(a){
  const errors=builder.validateFiles(work);
  if(errors.length)return{text:'build_and_test: the project has problems, nothing was built:\n'+errors.slice(0,15).join('\n')};
  const n=Math.max(0,...builder.loadMeta(id).versions.map(v=>v.n))+1,dir=builder.versionDir(id,n);
  if(built&&built.dir!==dir)fs.rmSync(built.dir,{recursive:true,force:true});
  builder.clearTesting(id);
  fs.rmSync(dir,{recursive:true,force:true});built=null;
  report({status:'building'});
  try{await builder.build(work,path.join(dir,'dist'),{projectId:id})}
  catch(e){if(!e.build)throw e;fs.rmSync(dir,{recursive:true,force:true});return{text:'build_and_test: the Vite build failed:\n'+clip(e.message,3000)}}
  try{await builder.applyMigrations(id,work)}
  catch(e){fs.rmSync(dir,{recursive:true,force:true});return{text:'build_and_test: a SQL migration failed:\n'+e.message+'\nMigrations that already ran cannot change; add a new numbered migration instead.'}}
  built={n,dir,url:builder.previewUrl(meta,n),files:{...work}};dirty=false;
  builder.markTesting(id,n,built.files);
  report({status:'testing'});
  return testBuild(a,'build_and_test: built OK.');
 }
 async function tool(a){
  const t=a.tool;
  if(t==='read_files'){
   const paths=(Array.isArray(a.paths)?a.paths:[a.path]).filter(p=>typeof p==='string').slice(0,8);
   let budget=60000;
   return{text:paths.map(p=>{if(!Object.hasOwn(work,p))return'--- '+p+' --- (no such file)';const body=clip(work[p],Math.max(2000,budget));budget-=body.length;return'--- '+p+' ---\n'+body}).join('\n\n')||'read_files: give "paths".'};
  }
  if(t==='search'){
   const q=String(a.query||'').slice(0,200);if(!q)return{text:'search: give a "query".'};
   let re;try{re=new RegExp(q,'i')}catch{re=new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i')}
   const hits=[];
   for(const [name,code] of Object.entries(work)){code.split('\n').forEach((line,i)=>{if(hits.length<80&&re.test(line))hits.push(name+':'+(i+1)+': '+line.trim().slice(0,200))})}
   return{text:hits.length?hits.join('\n')+(hits.length>=80?'\n(first 80 matches)':''):'No matches for "'+q+'".'};
  }
  if(t==='write_files'){
   const files=a.files&&typeof a.files==='object'&&!Array.isArray(a.files)?a.files:{};
   const written=[],bad=[];
   for(const [name,code] of Object.entries(files)){if(typeof code!=='string'){bad.push(name+' (content must be a string)');continue}work[name]=code;written.push(name)}
   for(const name of Array.isArray(a.delete)?a.delete:[])if(typeof name==='string'&&name!=='src/main.jsx'&&name!=='src/App.jsx'&&Object.hasOwn(work,name)){delete work[name];written.push('deleted '+name)}
   if(written.length)dirty=true;
   const problems=builder.validateFiles(work);
   return{text:'write_files: '+(written.length?written.join(', '):'nothing written')+(bad.length?'\nSkipped: '+bad.join(', '):'')+(problems.length?'\nProject problems to fix before building:\n'+problems.slice(0,15).join('\n'):'\nThe project passes static checks.')};
  }
  if(t==='build_and_test')return buildAndTest(a);
  if(t==='test_ui')return testBuild(a,'test_ui on version '+(built?built.n:'?')+':');
  if(t==='view_logs'){
   const logs=require('./react-logs').list(id).slice(-60);
   const fresh=logs.filter(l=>l.at>=started);
   return{text:logs.length?(fresh.length?'Logs since this task started:\n'+fresh.map(l=>l.at.slice(11,19)+' '+l.level+' '+l.source+': '+l.message).join('\n'):'No new logs since this task started. Older logs:\n'+logs.slice(-15).map(l=>l.at+' '+l.level+' '+l.source+': '+l.message).join('\n')):'No server logs yet.'};
  }
  if(t==='query_db'){
   const q=String(a.sql||'');
   if(!/^\s*(SELECT|WITH)\b/i.test(q))return{text:'query_db: only SELECT queries are allowed.'};
   const sql=require('./react-sql');
   if(!sql.exists(builder.projectDir(id)))return{text:'query_db: the app has no SQL tables yet.'};
   try{return{text:clip(JSON.stringify(await sql.run.query(builder.projectDir(id),q,[])),8000)}}catch(e){return{text:'query_db failed: '+e.message}}
  }
  if(t==='web_search'){
   if(!web)return{text:'web_search is not available.'};
   try{const urls=await webSearch(String(a.query||'').slice(0,240));return{text:urls.length?'Results:\n'+urls.join('\n'):'No results.'}}catch(e){return{text:'web_search failed: '+String(e.message||e).slice(0,300)}}
  }
  if(t==='fetch_url'){
   if(!fetchUrl)return{text:'fetch_url is not available.'};
   try{const r=await fetchUrl(String(a.url||''));const body=/html/i.test(r.headers?.['content-type']||'')||/^\s*</.test(r.body)?htmlToText(r.body):r.body;return{text:'HTTP '+r.status+'\n'+clip(body,12000)}}catch(e){return{text:'fetch_url failed: '+String(e.message||e).slice(0,300)}}
  }
  return{text:'Unknown tool "'+t+'". Use one of the listed tools.'};
 }
 function save(message,{stopped=false}={}){
  const files=built.files;
  builder.writeJson(path.join(built.dir,'files.json'),files);
  const changed=Object.keys(files).filter(k=>base[k]!==files[k]).concat(Object.keys(base).filter(k=>!Object.hasOwn(files,k)));
  const fresh=builder.loadMeta(id),now=new Date().toISOString();
  const errors=lastTest&&lastTest.errors.length?lastTest.errors:[];
  fresh.versions.push({n:built.n,at:now,summary:message.slice(0,200),changed,tier,agent:{steps:steps.length,stopped},...(errors.length?{runtime_errors:errors}:{})});
  fresh.current_version=built.n;
  fresh.messages.push({role:'user',text,mode:'agent',at:now,...(images.length?{images:images.map(i=>i.name)}:{})},{role:'assistant',text:message,mode:'agent',version:built.n,changed,steps:steps.map(s=>s.summary).slice(-40),at:now,...(errors.length?{runtime_errors:errors}:{})});
  builder.saveMeta(fresh);
  return{version:built.n,message,changed,steps:steps.length,runtime_errors:errors,preview_url:builder.previewUrl(fresh)};
 }
 function noChange(message){
  if(built)fs.rmSync(built.dir,{recursive:true,force:true});
  builder.addMessages(id,[{role:'user',text,mode:'agent'},{role:'assistant',text:message,mode:'agent',steps:steps.map(s=>s.summary).slice(-40)}]);
  const fresh=builder.loadMeta(id);
  return{version:fresh.current_version,message,changed:[],steps:steps.length,runtime_errors:[],preview_url:builder.previewUrl(fresh)};
 }
 const unchanged=()=>Object.keys(work).length===Object.keys(base).length&&Object.keys(work).every(k=>base[k]===work[k]);

 try{
 for(let step=1;step<=limit;step++){
  signal?.throwIfAborted();
  report({status:'thinking',step});
  trimContext();
  const reply=await callModel({messages,temperature:0.2,maxOutputTokens:16000,signal,tier},parseStep);
  messages.push({role:'assistant',content:JSON.stringify({thought:reply.thought,actions:reply.actions})});
  const entry={n:step,thought:reply.thought,actions:reply.actions.map(describe)};
  steps.push({...entry,summary:(reply.thought?reply.thought+' — ':'')+entry.actions.join('; ')});
  report({status:'working',step});
  const results=[];let image=null,finished=null;
  for(const a of reply.actions){
   signal?.throwIfAborted();
   if(a.tool==='finish'){
    const message=String(a.message||reply.thought||'Done.').slice(0,2000);
    if(unchanged()){finished=noChange(message);break}
    if(dirty||!built){const r=await buildAndTest({});results.push(r.text);if(r.image)image=r.image}
    if(!built){results.push('finish: the project does not build yet. Fix the problems above, then finish.');continue}
    if(lastTest&&lastTest.errors.length&&!finishWarned){finishWarned=true;results.push('finish: the last test still shows problems (listed above). Fix them and test again, or call finish again to stop anyway.');continue}
    finished=save(message);break;
   }
   try{const r=await tool(a);results.push(clip(r.text,20000));if(r.image)image=r.image}
   catch(e){if(e.name==='AbortError'||signal?.aborted)throw e;results.push(a.tool+' failed: '+String(e.message||e).slice(0,500))}
  }
  if(finished)return finished;
  dropOldImages();
  const body='Results of step '+step+' of '+limit+':\n\n'+results.join('\n\n')+(step===limit-1?'\n\nYou have one step left: fix what you can and call finish.':'');
  messages.push({role:'user',content:image?[{type:'text',text:body},{type:'image_url',image_url:{url:'data:image/jpeg;base64,'+image}}]:body});
 }
 // Out of steps: keep the work if it builds.
 if(unchanged())return noChange(steps.at(-1)?.thought||'Stopped without changes.');
 if(dirty||!built)await buildAndTest({});
 if(!built)throw Object.assign(Error('The agent used all '+limit+' steps and the project still does not build.'),{status:422});
 return save('Stopped after '+limit+' steps. '+(steps.at(-1)?.thought||''),{stopped:true});
 }catch(e){if(built&&!builder.loadMeta(id).versions.some(v=>v.n===built.n))fs.rmSync(built.dir,{recursive:true,force:true});throw e}
 finally{builder.clearTesting(id)}
}
module.exports={run,parseStep,protocol,htmlToText,describe};

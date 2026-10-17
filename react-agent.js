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
function protocol({vision,web,maxSteps,images}){
 return `

You are working in AGENT MODE: keep working in steps until the request is fully done and verified, like a careful senior engineer.
Each reply is ONLY a JSON object, no markdown fences:
{"thought":"one or two sentences: what you found and what you do next (the user sees this)","actions":[{"tool":"...", ...}]}
Tools (several per step are fine; they run in order):
- {"tool":"read_files","paths":["src/App.jsx"]}: read up to 8 files.
- {"tool":"search","query":"text or regex"}: search every project file; returns matching lines.
- {"tool":"write_files","files":{"src/path.jsx":"full new content"},"delete":["src/old.jsx"]}: create or replace whole files (src/, functions/ and sql/ migrations).
- {"tool":"edit_files","edits":{"src/path.jsx":[{"find":"exact current lines (unique in the file)","replace":"new lines"}]}}: change part of existing files. Prefer this over write_files for small changes: it is faster and cheaper. "find" must be copied exactly from the file (read it first) and match one place.
- {"tool":"build_and_test","path":"#/optional-hash-route","steps":[...]}: build the project, open it in a real browser, run optional UI steps, and report errors and visible text${vision?' plus a screenshot':''}.
- {"tool":"test_ui","path":"#/rooms","steps":[{"action":"click","text":"Book now"},{"action":"fill","label":"Email","value":"ana@example.com"},{"action":"select","label":"Room","value":"Suite"},{"action":"press","key":"Enter"},{"action":"expect","text":"Thank you"},{"action":"goto","path":"#/rooms"},{"action":"wait","ms":500}]}: run steps against the last build. Target elements by text, label, placeholder, role (+ text) or selector.
  Tests run on a test copy of the app's data: nothing they create is real, and emails and payments are simulated. Add "save_as":"Book a room" to a test_ui or build_and_test whose steps prove a main flow works (ending with expect steps): when it passes it becomes a saved check that is re-run after every future change.
- {"tool":"view_logs"}: server logs: console.log output and errors from server functions, failed backend requests.
- {"tool":"query_db","sql":"SELECT * FROM rooms LIMIT 5"}: read the app's SQL tables (SELECT only; the same test copy your tests use).
${images?`- {"tool":"generate_images","images":[{"name":"hero-terrace.jpg","prompt":"detailed description of the photo","aspect":"16:9"}]}: create up to 4 photos or illustrations (aspect 1:1, 4:3, 3:2, 16:9, 9:16, 3:4) saved as ./uploads/<name>; use the returned paths in the code. Use this tool instead of an "images" field.
`:''}${web?`- {"tool":"web_search","query":"..."}: search the web; returns links.
- {"tool":"web_open","url":"https://..."}: open a public website in a real browser (JavaScript runs) and read it: its text and a numbered list of links, buttons and fields${vision?', plus a screenshot':''}. Use it for docs, examples, prices, competitors and anything the user links.
- {"tool":"web_act","steps":[{"action":"click","target":12},{"action":"click","target":"Pricing"},{"action":"fill","target":"Search","value":"..."},{"action":"select","target":9,"value":"..."},{"action":"scroll","value":"down"},{"action":"back"}]}: click around the page that is open (by number or by its text) and read the result. Reading only: nothing is sent to other sites.
- {"tool":"fetch_url","url":"https://..."}: read a raw page or a JSON API response as text (no JavaScript).
`:''}- {"tool":"finish","message":"for the user: what you built and how to use it"}: end when the request is done and the last build_and_test or test_ui passed.
Work this way: understand the request, read what you need, plan, write every needed file, then build_and_test. For a big app, write the files over two or three steps (a few files per write_files) so no reply gets too long. Exercise the main flows with test_ui (forms, buttons, navigation, sign-in when relevant) and check view_logs after using server functions. Fix every error you find and test again. Never finish with known errors, and keep the saved checks passing. Be economical: you have at most ${maxSteps} steps.`;
}

// Never throws: a reply that is not valid JSON comes back as {invalid} so the loop can ask again.
function parseStepSafe(content){try{return parseStep(content)}catch(e){const raw=typeof content==='string'?content:JSON.stringify(content);const cut=/^\s*(```(json)?\s*)?\{/.test(raw||'')&&!/\}\s*(```)?\s*$/.test(raw||'');return{invalid:cut?'it was cut off because it was too long; write fewer files per step (for example 4 to 6) and continue':String(e.message||e),thought:'',actions:[],raw:String(raw||'').slice(0,400)}}}
function parseStep(content){
 let v=content;
 if(typeof v==='string'){
  const t=v.trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'');
  try{v=JSON.parse(t)}catch{const a=t.indexOf('{'),b=t.lastIndexOf('}');if(a<0||b<=a)throw Error('Agent reply was not JSON');v=JSON.parse(t.slice(a,b+1))}
 }
 if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Agent reply was not a JSON object');
 let actions=Array.isArray(v.actions)?v.actions:v.tool?[v]:[];
 // Accept a plain build-mode answer too.
 if(!actions.length&&((v.files&&typeof v.files==='object')||(v.edits&&typeof v.edits==='object')))actions=[...(v.files?[{tool:'write_files',files:v.files,delete:v.delete}]:[]),...(v.edits?[{tool:'edit_files',edits:v.edits}]:[]),{tool:'build_and_test'}];
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
 if(t==='edit_files'){const f=Object.keys(a.edits||{});return'Edited '+(f.length?f.join(', '):'nothing')}
 if(t==='build_and_test')return'Built and tested the app'+(Array.isArray(a.steps)&&a.steps.length?' ('+a.steps.length+' UI steps)':'');
 if(t==='test_ui')return'Tested in the browser ('+(Array.isArray(a.steps)?a.steps.length:0)+' steps)';
 if(t==='view_logs')return'Checked server logs';
 if(t==='query_db')return'Queried the database';
 if(t==='generate_images')return'Generated '+(Array.isArray(a.images)?a.images.length:0)+' image(s)';
 if(t==='web_search')return'Searched the web for "'+String(a.query||'').slice(0,60)+'"';
 if(t==='web_open')return'Opened '+String(a.url||'').slice(0,80);
 if(t==='web_act')return'Clicked around '+(Array.isArray(a.steps)?a.steps.length:1)+' step'+(Array.isArray(a.steps)&&a.steps.length===1?'':'s')+' on the open website';
 if(t==='fetch_url')return'Read '+String(a.url||'').slice(0,80);
 if(t==='finish')return'Finished';
 return'Unknown tool '+t;
}

// Options: callModel, inspect(url,{steps,screenshot}), webSearch(query), fetchUrl(url), browseSite(url,opts),
// onStep(entry), signal, tier, images, assetNote, maxSteps.
async function run(id,instruction,{callModel,inspect,webSearch,fetchUrl,browseSite,onStep=()=>{},onThinking,onEvent,signal,tier='standard',images=[],assetNote='',maxSteps,imageGen=null,imageNote=''}={}){
 const text=String(instruction||'').trim().slice(0,8000);
 if(!text)throw Object.assign(Error('Describe what you want the agent to do'),{status:400});
 let meta=builder.loadMeta(id);
 if(!meta.current_version){await builder.initialize(meta);meta=builder.loadMeta(id)}
 const tl=require('./react-timeline').create(onEvent);
 // A new project gets its design brief first (colours and fonts go into src/index.css).
 const brief=await builder.prepareDesign(id,text,{callModel,tier,signal,images,onProgress:s=>onStep({steps:[],status:s})});
 if(brief){meta=builder.loadMeta(id);tl.add({t:'note',icon:'design',text:'Chose the design direction "'+brief.name+'"'})}
 const base=builder.loadFiles(id,meta.current_version);
 const generated=[],pendingChecks=[];
 // The agent's browser tests and SQL reads use a test copy of the data, never the real one.
 const box=require('./react-sandbox').create(id);
 let checksWarned=false;
 const limit=Number.isInteger(maxSteps)?maxSteps:maxStepsDefault();
 const wb=require('./web').createBrowser({browseSite,maxOps:intEnv('KAIROQ_WEB_MAX_ACTIONS',30,5,100)});
 const vision=tier!=='standard',web=typeof webSearch==='function'||wb.available();
 const started=new Date().toISOString();
 let work={...base,...(brief?{'src/index.css':require('./react-design').applyToCss(base['src/index.css'],brief)}:{})},built=null,dirty=false,lastTest=null,finishWarned=false,invalidReplies=0;
 const steps=[];
 const listing=Object.keys(base).sort().map(n=>n+' ('+Buffer.byteLength(base[n])+' bytes)').join('\n');
 const intro='Project files:\n'+listing+'\n\n'+builder.contextFiles(work,60000)+(assetNote?'\n\n'+assetNote:'')+(imageNote?'\n\n'+imageNote:'')+'\n\nRequest: '+text;
 const messages=[{role:'system',content:codingRules()+builder.knowledgeNote(meta)+protocol({vision,web,maxSteps:limit,images:Boolean(imageGen)})},...builder.historyMessages(meta),{role:'user',content:builder.userContent(intro,images)}];
 const introMsg=messages.at(-1);
 const report=patch=>onStep({steps:steps.slice(-40),...patch});

 function dropOldImages(){for(const m of messages)if(Array.isArray(m.content)&&m!==introMsg)m.content=m.content.filter(p=>p.type==='text').map(p=>p.text).join('\n')+'\n(screenshot omitted)'}
 function trimContext(){
  const size=m=>typeof m.content==='string'?m.content.length:m.content.reduce((n,p)=>n+(p.type==='text'?p.text.length:0),0);
  let total=messages.reduce((n,m)=>n+size(m),0);
  for(let i=messages.indexOf(introMsg)+1;i<messages.length-4&&total>350000;i++){const m=messages[i];if(typeof m.content==='string'&&m.content.length>2000){total-=m.content.length-1500;m.content=m.content.slice(0,1500)+'\n…(older content trimmed)'}}
 }
 async function testBuild(a,prefix){
  if(!built)return{text:'test_ui: nothing is built yet. Use build_and_test first.'};
  if(dirty)prefix+=' Note: files changed since this build; run build_and_test to test them.';
  if(!inspect)return{text:prefix+' (Browser testing is not available on this server.)'};
  const route=String(a.path||'');
  const url=built.url+(route.startsWith('#')?route:'');
  const r=await inspect(url,{steps:Array.isArray(a.steps)?a.steps.slice(0,20):[],screenshot:vision,sandbox:box.token});
  if(r.skipped)return{text:prefix+' (Browser testing is not available on this server.)'};
  lastTest={errors:r.errors,failed:r.steps.filter(s=>!s.ok).length};
  tl.add({t:'test',ok:!r.errors.length&&!lastTest.failed,text:r.steps.length?'Tested '+r.steps.length+' step'+(r.steps.length===1?'':'s')+' in a browser':'Opened the app in a browser',detail:[...r.steps.filter(s=>!s.ok).map(s=>s.step+' → '+s.error),...r.errors]});
  // A passing flow named with save_as becomes a saved check once the work is saved.
  if(a.save_as&&!lastTest.failed&&!r.errors.length&&Array.isArray(a.steps)&&a.steps.length){try{const c=require('./react-checks').normalize({name:a.save_as,path:a.path,steps:a.steps});const i=pendingChecks.findIndex(x=>x.name.toLowerCase()===c.name.toLowerCase());if(i>=0)pendingChecks.splice(i,1);pendingChecks.push(c);prefix+=' Saved as the check "'+c.name+'" when you finish.'}catch(e){prefix+=' Not saved as a check: '+e.message+'.'}}
  const lines=[prefix];
  if(r.steps.length)lines.push('UI steps:\n'+r.steps.map((s,i)=>(i+1)+'. '+(s.ok?'ok ':'FAILED ')+s.step+(s.ok?'':' → '+s.error)).join('\n'));
  lines.push(r.errors.length?'Problems in the browser:\n'+r.errors.join('\n'):'No errors in the browser.');
  if(r.external&&r.external.length)lines.push('Files from other sites that did not load (not code errors; fine if they are just unreachable from the test browser):\n'+r.external.join('\n'));
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
  catch(e){if(!e.build)throw e;fs.rmSync(dir,{recursive:true,force:true});tl.add({t:'build',ok:false,detail:e.message});return{text:'build_and_test: the Vite build failed:\n'+clip(e.message,3000)}}
  try{await builder.applyMigrations(id,work);await require('./react-sql').run.migrate(box.dir,work)}
  catch(e){fs.rmSync(dir,{recursive:true,force:true});return{text:'build_and_test: a SQL migration failed:\n'+e.message+'\nMigrations that already ran cannot change; add a new numbered migration instead.'}}
  built={n,dir,url:builder.previewUrl(meta,n),files:{...work}};dirty=false;
  tl.add({t:'build',ok:true});
  builder.markTesting(id,n,built.files);
  report({status:'testing'});
  return testBuild(a,'build_and_test: built OK.');
 }
 async function tool(a){
  const t=a.tool;
  if(t==='read_files'){
   const paths=(Array.isArray(a.paths)?a.paths:[a.path]).filter(p=>typeof p==='string').slice(0,8);
   if(paths.length)tl.add({t:'read',files:paths});
   let budget=60000;
   return{text:paths.map(p=>{if(!Object.hasOwn(work,p))return'--- '+p+' --- (no such file)';const body=clip(work[p],Math.max(2000,budget));budget-=body.length;return'--- '+p+' ---\n'+body}).join('\n\n')||'read_files: give "paths".'};
  }
  if(t==='search'){
   const q=String(a.query||'').slice(0,200);if(!q)return{text:'search: give a "query".'};
   tl.add({t:'note',icon:'search',text:'Searched the code for "'+q.slice(0,80)+'"'});
   let re;try{re=new RegExp(q,'i')}catch{re=new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i')}
   const hits=[];
   for(const [name,code] of Object.entries(work)){code.split('\n').forEach((line,i)=>{if(hits.length<80&&re.test(line))hits.push(name+':'+(i+1)+': '+line.trim().slice(0,200))})}
   return{text:hits.length?hits.join('\n')+(hits.length>=80?'\n(first 80 matches)':''):'No matches for "'+q+'".'};
  }
  if(t==='write_files'){
   const files=a.files&&typeof a.files==='object'&&!Array.isArray(a.files)?a.files:{};
   const before={...work};
   const written=[],bad=[];
   for(const [name,code] of Object.entries(files)){if(typeof code!=='string'){bad.push(name+' (content must be a string)');continue}work[name]=code;written.push(name)}
   for(const name of Array.isArray(a.delete)?a.delete:[])if(typeof name==='string'&&name!=='src/main.jsx'&&name!=='src/App.jsx'&&Object.hasOwn(work,name)){delete work[name];written.push('deleted '+name)}
   if(written.length)dirty=true;
   tl.edits(before,work);
   const problems=builder.validateFiles(work);
   return{text:'write_files: '+(written.length?written.join(', '):'nothing written')+(bad.length?'\nSkipped: '+bad.join(', '):'')+(problems.length?'\nProject problems to fix before building:\n'+problems.slice(0,15).join('\n'):'\nThe project passes static checks.')};
  }
  if(t==='edit_files'){
   let edits;try{edits=require('./react-edits').normalize(a.edits)}catch(e){return{text:'edit_files: '+e.message}}
   const r=require('./react-edits').apply(work,edits);
   if(r.errors.length)return{text:'edit_files: nothing was changed:\n'+r.errors.join('\n')+'\nRead the file again and copy "find" exactly, or use write_files.'};
   for(const f of r.changed)tl.add({t:'edit',file:f,kind:'edited'});
   work=r.files;if(r.changed.length)dirty=true;
   const problems=builder.validateFiles(work);
   return{text:'edit_files: changed '+(r.changed.join(', ')||'nothing (the replacements matched the current text)')+(problems.length?'\nProject problems to fix before building:\n'+problems.slice(0,15).join('\n'):'\nThe project passes static checks.')};
  }
  if(t==='build_and_test')return buildAndTest(a);
  if(t==='test_ui')return testBuild(a,'test_ui on version '+(built?built.n:'?')+':');
  if(t==='view_logs'){
   tl.add({t:'note',icon:'logs',text:'Read the server logs'});
   const logs=require('./react-logs').list(id).slice(-60);
   const fresh=logs.filter(l=>l.at>=started);
   return{text:logs.length?(fresh.length?'Logs since this task started:\n'+fresh.map(l=>l.at.slice(11,19)+' '+l.level+' '+l.source+': '+l.message).join('\n'):'No new logs since this task started. Older logs:\n'+logs.slice(-15).map(l=>l.at+' '+l.level+' '+l.source+': '+l.message).join('\n')):'No server logs yet.'};
  }
  if(t==='query_db'){
   const q=String(a.sql||'');
   tl.add({t:'note',icon:'db',text:'Queried the test database',detail:q.slice(0,300)});
   if(!/^\s*(SELECT|WITH)\b/i.test(q))return{text:'query_db: only SELECT queries are allowed.'};
   const sql=require('./react-sql');
   if(!sql.exists(box.dir)&&!sql.exists(builder.projectDir(id)))return{text:'query_db: the app has no SQL tables yet.'};
   try{return{text:clip(JSON.stringify(await sql.run.query(box.dir,q,[])),8000)}}catch(e){return{text:'query_db failed: '+e.message}}
  }
  if(t==='generate_images'){
   if(!imageGen)return{text:'generate_images is not available on this server. Use https photo URLs (for example from images.unsplash.com) or uploaded images.'};
   const req=builder.imageRequests(a.images);
   if(!req.length)return{text:'generate_images: give "images":[{"name","prompt","aspect"}].'};
   if(generated.length+req.length>8)return{text:'generate_images: this task already generated '+generated.length+' images; reuse them.'};
   report({status:'images'});
   const cache=new Map(),notes=await builder.materializeImages(id,{images:req,files:work},{imageGen,cache,design:builder.loadMeta(id).design});
   const saved=req.map(r=>'./uploads/'+cache.get(r.name+'|'+r.prompt));
   generated.push(...saved);
   tl.add({t:'note',icon:'image',text:'Generated '+saved.length+' image'+(saved.length===1?'':'s')});
   return{text:'generate_images: saved '+saved.join(', ')+'. Use exactly these paths in the code.'+(notes.length?'\n'+notes.join('\n'):'')};
  }
  if(t==='web_open'){
   if(!wb.available())return{text:'web_open is not available on this server (no browser).'};
   const u=String(a.url||'').slice(0,500);
   tl.add({t:'note',icon:'web',text:'Opened '+u.slice(0,120)});
   try{const text=await wb.open(u);return{text,image:vision?await wb.screenshot():null}}catch(e){return{text:'web_open failed: '+String(e.message||e).slice(0,300)}}
  }
  if(t==='web_act'){
   if(!wb.available())return{text:'web_act is not available on this server (no browser).'};
   tl.add({t:'note',icon:'web',text:'Clicked around '+require('./web').hostOf(wb.url)});
   try{const text=await wb.act(a.steps||[]);return{text,image:vision?await wb.screenshot():null}}catch(e){return{text:'web_act failed: '+String(e.message||e).slice(0,300)}}
  }
  if(t==='web_search'){
   if(typeof webSearch!=='function')return{text:'web_search is not available on this server.'};
   tl.add({t:'note',icon:'web',text:'Searched the web for "'+String(a.query||'').slice(0,80)+'"'});
   try{const urls=await webSearch(String(a.query||'').slice(0,240));return{text:urls.length?'Results:\n'+urls.join('\n'):'No results.'}}catch(e){return{text:'web_search failed: '+String(e.message||e).slice(0,300)}}
  }
  if(t==='fetch_url'){
   if(!fetchUrl)return{text:'fetch_url is not available.'};
   tl.add({t:'note',icon:'web',text:'Read '+String(a.url||'').slice(0,120)});
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
  fresh.messages.push({role:'user',text,mode:'agent',at:now,...(images.length?{images:images.map(i=>i.name)}:{})},{role:'assistant',text:message,mode:'agent',version:built.n,changed,steps:steps.map(s=>s.summary).slice(-40),timeline:tl.stored(),duration_ms:tl.elapsed(),at:now,...(brief?{design:{name:brief.name,palette:brief.palette,fonts:brief.fonts}}:{}),...(errors.length?{runtime_errors:errors}:{})});
  builder.saveMeta(fresh);
  const saved=[];for(const c of pendingChecks){try{require('./react-checks').save(id,c,{source:'agent'});saved.push(c.name)}catch{}}
  const failedChecks=require('./react-checks').list(builder.loadMeta(id)).filter(c=>c.enabled!==false&&c.last&&c.last.version===built.n&&!c.last.ok).map(c=>({name:c.name,step:c.last.step||'',error:c.last.error||''}));
  return{version:built.n,message,changed,steps:steps.length,timeline:tl.stored(),duration_ms:tl.elapsed(),runtime_errors:errors,...(saved.length?{checks_saved:saved}:{}),...(failedChecks.length?{check_failures:failedChecks}:{}),preview_url:builder.previewUrl(fresh)};
 }
 function noChange(message){
  if(built)fs.rmSync(built.dir,{recursive:true,force:true});
  message='No changes were made. '+message;
  builder.addMessages(id,[{role:'user',text,mode:'agent'},{role:'assistant',text:message,mode:'agent',steps:steps.map(s=>s.summary).slice(-40),timeline:tl.stored(),duration_ms:tl.elapsed()}]);
  const fresh=builder.loadMeta(id);
  return{version:fresh.current_version,message,unchanged:true,changed:[],steps:steps.length,runtime_errors:[],preview_url:builder.previewUrl(fresh)};
 }
 const unchanged=()=>Object.keys(work).length===Object.keys(base).length&&Object.keys(work).every(k=>base[k]===work[k]);

 try{
 for(let step=1;step<=limit;step++){
  signal?.throwIfAborted();
  report({status:'thinking',step});
  trimContext();
  // Streaming keeps long steps (several files) under the provider's streaming timeout.
  const asked=Date.now();let reasoning='';
  const reply=await callModel({messages,temperature:0.2,maxOutputTokens:32000,signal,tier,onToken:()=>{},onReasoning:(_d,all)=>{reasoning=all;if(onThinking)onThinking(all)}},parseStepSafe);
  if(!reply.invalid)tl.add({t:'think',ms:Date.now()-asked,title:reply.thought,text:reasoning});
  if(reply.invalid){
   invalidReplies++;
   steps.push({n:step,thought:'',actions:['Reply was not valid JSON'],summary:'Reply was not valid JSON'});
   if(invalidReplies>=3)break;
   messages.push({role:'assistant',content:reply.raw||'(empty)'},{role:'user',content:'Your reply could not be used ('+reply.invalid+'). Reply with ONLY a JSON object: {"thought":"...","actions":[{"tool":"...", ...}]}. Use the finish tool when the task is done.'});
   continue;
  }
  invalidReplies=0;
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
    if(!built||dirty){results.push('finish: your latest changes do not build yet. Fix the problems above, then finish.');continue}
    if(lastTest&&lastTest.errors.length&&!finishWarned){finishWarned=true;results.push('finish: the last test still shows problems (listed above). Fix them and test again, or call finish again to stop anyway.');continue}
    if(!checksWarned&&inspect&&require('./react-checks').list(builder.loadMeta(id)).length){
     checksWarned=true;report({status:'checking'});
     const cr=await require('./react-checks').run(id,built.url,{inspect,version:built.n});
     if(cr.failed.length){results.push('finish: these saved checks (flows that worked before) now fail:\n'+require('./react-checks').failureText(cr.failed)+'\nFix them and test again, or call finish again to stop anyway.');continue}
     results.push('Saved checks: all '+cr.ran+' passed.');
    }
    finished=save(message);break;
   }
   try{const r=await tool(a);results.push(clip(r.text,20000));if(r.image)image=r.image}
   catch(e){if(e.name==='AbortError'||signal?.aborted)throw e;results.push(a.tool+' failed: '+String(e.message||e).slice(0,500))}
  }
  if(finished)return finished;
  dropOldImages();
  const body='Results of step '+step+' of '+limit+':\n\n'+clip(results.join('\n\n'),60000)+(step===limit-1?'\n\nYou have one step left: fix what you can and call finish.':'');
  messages.push({role:'user',content:image?[{type:'text',text:body},{type:'image_url',image_url:{url:'data:image/jpeg;base64,'+image}}]:body});
 }
 // Out of steps: keep the work if it builds.
 if(unchanged())return noChange(steps.at(-1)?.thought||'Stopped without changes.');
 if(dirty||!built)await buildAndTest({});
 if(!built)throw Object.assign(Error('The agent stopped after '+steps.length+' steps and the project does not build.'),{status:422});
 if(dirty)return save('Stopped after '+steps.length+' steps. The last changes did not build, so the last working build was saved. '+(steps.at(-1)?.thought||''),{stopped:true});
 return save('Stopped after '+steps.length+' steps. '+(steps.at(-1)?.thought||''),{stopped:true});
 }catch(e){if(built&&!builder.loadMeta(id).versions.some(v=>v.n===built.n))fs.rmSync(built.dir,{recursive:true,force:true});throw e}
 finally{builder.clearTesting(id);require('./react-sandbox').destroy(box.token);await wb.close().catch(()=>{})}
}
module.exports={run,parseStep,parseStepSafe,protocol,htmlToText,describe};

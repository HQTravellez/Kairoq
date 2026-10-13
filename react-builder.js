"use strict";
// React + Vite + Tailwind projects edited through chat. Each accepted edit is an
// immutable version: versions/<n>/files.json (source) and versions/<n>/dist (build).
const fs=require('fs'),path=require('path'),crypto=require('crypto');

const ROOT=()=>process.env.KAIROQ_REACT_PROJECTS_DIR||path.join(__dirname,'workspace','react-projects');
const ALLOWED_PACKAGES=['react','react-dom','react-dom/client','react/jsx-runtime','lucide-react','react-router-dom','kairoq'];
const MAX_FILES=80,MAX_FILE_BYTES=200000,MAX_PROJECT_BYTES=1500000,MAX_ATTEMPTS=3;
const SOURCE_EXT=['.jsx','.js','.tsx','.ts'];

const INDEX_HTML=`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/kairoq-reporter.js"></script>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`;
function template(name){
 return{
  'src/main.jsx':`import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(<App />);
`,
  'src/App.jsx':`export default function App() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-900">
      <h1 className="text-3xl font-semibold">${String(name||'New app').replace(/[^\w .,'-]/g,'')}</h1>
    </main>
  );
}
`,
  'src/index.css':'@tailwind base;\n@tailwind components;\n@tailwind utilities;\n'
 };
}

const SYSTEM_PROMPT=`You are the coding engine of an app builder like Lovable. You edit a React 18 + Vite + Tailwind CSS 3 project.
Rules:
- Source lives under src/. The entry is src/main.jsx, which renders src/App.jsx and imports src/index.css. index.html is fixed; set the page title with document.title in a useEffect.
- Use JavaScript with JSX (.jsx/.js). Style with Tailwind utility classes. Write clean, responsive, accessible UI with real, specific copy (no lorem ipsum).
- The only npm packages available are: react, react-dom, lucide-react (icons), react-router-dom (use HashRouter for routing). Do not import anything else and do not use import.meta or query imports like "?raw".
- Split the UI into components under src/components/ and pages under src/pages/ when the app grows.
- Backend: import { auth, collection } from 'kairoq' for user accounts and saved data shared by all visitors.
  auth.signUp(email,password,name?) / auth.signIn(email,password) / auth.signOut() return promises; auth.user() returns the signed-in user or null; auth.onChange(fn) subscribes and returns an unsubscribe function.
  collection('name').list({limit,order:'asc'|'desc',mine:true,where:{field:value}}) / .get(id) / .create(data) / .update(id,data) / .remove(id). Records come back as {id,...data,_owner,_created_at}.
  Declare every collection in src/backend.json, e.g. {"collections":{"tasks":{"access":"private"},"messages":{"access":"public"}}}. Access: "private" = each signed-in user sees only their own records; "shared" = signed-in users see all records; "public-read" = anyone reads, signed-in users add; "public" = anyone reads and adds (guestbooks, public comments); "submit-only" = anyone can add but nobody can read them back, only the owner sees them in Kairoq (use this for contact, booking, reservation, order and waitlist forms; show a thank-you message after create). Only a record's creator can update or delete it.
  Show loading and error states, and a sign-in form when a collection needs a signed-in user. Use localStorage only for small UI preferences, inside try/catch.
  Optional features (add them to src/backend.json only when the app needs them):
  - File uploads: "storage":{"access":"signed-in"} (or "public"). import { storage } from 'kairoq'; const f=await storage.upload(fileFromInput) returns {id,url,name}; save f.url in a record to show it later. Images, PDF, text and CSV up to 5 MB.
  - Email: "email":true. import { email } from 'kairoq'; await email.send({to:'owner',subject,text}) notifies the app owner (for contact and booking forms); to:'me' emails the signed-in user.
  - Payments: "payments":{"products":{"pro":{"price":"price_REPLACE_ME","mode":"payment"}}} (mode "subscription" for plans). import { payments } from 'kairoq'; await payments.checkout('pro') opens Stripe Checkout for the signed-in user; await payments.has('pro') checks a purchase. Tell the user to replace price ids with their Stripe price ids and connect Stripe in Settings.
  - Scheduled jobs: "schedules":[{"name":"cleanup","every":"day","action":"delete_older_than","collection":"logs","days":30},{"name":"digest","every":"day","action":"email_owner_summary","collection":"bookings"}].
- Images: use uploaded images at the paths you are given (for example <img src="./uploads/logo.png">), https URLs (for example https://images.unsplash.com/...) or inline SVG. For background images use an inline style in JSX, not CSS url().
- When the user attaches a screenshot or design, match its layout, spacing, colors and content as closely as you can.
Respond with ONLY a JSON object, no markdown fences:
{"message":"one or two sentences telling the user what you changed","files":{"src/path.jsx":"full new file content"},"delete":["src/unused.jsx"]}
Include only files you create or change, each with its complete content. "delete" is optional.`;

function slugId(){return crypto.randomBytes(6).toString('hex')}
function projectDir(id){if(!/^[a-f0-9]{12}$/.test(String(id)))throw Object.assign(Error('Unknown project'),{status:404});return path.join(ROOT(),id)}
function writeJson(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data,null,1));fs.renameSync(tmp,file)}
function readJson(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return fallback}}

function loadMeta(id){const meta=readJson(path.join(projectDir(id),'project.json'),null);if(!meta)throw Object.assign(Error('Unknown project'),{status:404});return meta}
function saveMeta(meta){meta.updated_at=new Date().toISOString();writeJson(path.join(projectDir(meta.id),'project.json'),meta)}
function versionDir(id,n){return path.join(projectDir(id),'versions',String(Number(n)))}
function loadFiles(id,n){const files=readJson(path.join(versionDir(id,n),'files.json'),null);if(!files)throw Object.assign(Error('Unknown version'),{status:404});return files}

// ---------- validation ----------
function validPath(p){return typeof p==='string'&&p.length<=120&&/^src\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.(?:jsx|js|tsx|ts|css|json)$/.test(p)&&!p.split('/').some(seg=>seg==='..'||seg.startsWith('.'))}
function resolveRelative(from,spec,files){
 const base=path.posix.normalize(path.posix.join(path.posix.dirname(from),spec));
 if(!base.startsWith('src/'))return null;
 for(const candidate of [base,...SOURCE_EXT.map(e=>base+e),...SOURCE_EXT.map(e=>base+'/index'+e)])if(Object.hasOwn(files,candidate))return candidate;
 return null;
}
function specifiers(code){
 const out=[],re=/\bimport\s*(?:[\w*{}\s,]+?\s*from\s*)?['"]([^'"]+)['"]|\bexport\s+[\w*{}\s,]+?\s+from\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)|\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
 let m;while((m=re.exec(code)))out.push(m[1]||m[2]||m[3]||m[4]);
 return out;
}
function validateFiles(files){
 const errors=[],names=Object.keys(files);
 if(names.length>MAX_FILES)errors.push('Too many files ('+names.length+'); the limit is '+MAX_FILES+'.');
 let total=0;
 for(const name of names){
  const code=files[name];
  if(!validPath(name)){errors.push('Invalid file path: '+name+' (files must be under src/ with a .jsx/.js/.css/.json extension).');continue}
  if(typeof code!=='string'){errors.push(name+' must be a string.');continue}
  total+=Buffer.byteLength(code);
  if(Buffer.byteLength(code)>MAX_FILE_BYTES)errors.push(name+' is larger than 200 KB.');
  if(/\.(jsx?|tsx?)$/.test(name)){
   if(/\bimport\.meta\b/.test(code))errors.push(name+': import.meta is not allowed.');
   if(/\bimport\s*\(\s*[^'"\s)]/.test(code))errors.push(name+': dynamic import() must use a string literal.');
   for(const spec of specifiers(code)){
    if(spec.includes('?')||spec.includes('\0'))errors.push(name+': import "'+spec+'" uses a query, which is not allowed.');
    else if(spec.startsWith('.')){if(!resolveRelative(name,spec,files))errors.push(name+': import "'+spec+'" does not match a project file.')}
    else if(!ALLOWED_PACKAGES.includes(spec))errors.push(name+': package "'+spec+'" is not available. Use only react, react-dom, lucide-react and react-router-dom.');
   }
  }
  if(name.endsWith('.css')){
   for(const m of code.matchAll(/@import\s+(?:url\()?\s*['"]?([^'")\s;]+)/g)){const spec=m[1];if(!/^https:\/\//.test(spec)&&!(spec.startsWith('.')&&resolveRelative(name,spec,files)))errors.push(name+': @import "'+spec+'" must be an https URL or a project CSS file.')}
   for(const m of code.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)){const u=m[1].trim();if(!/^(https:|data:|#)/.test(u))errors.push(name+': url('+u+') must be an https or data: URL.')}
  }
 }
 if(total>MAX_PROJECT_BYTES)errors.push('Project source is larger than 1.5 MB.');
 errors.push(...require('./react-backend').configErrors(files));
 for(const required of ['src/main.jsx','src/App.jsx'])if(!Object.hasOwn(files,required))errors.push(required+' is required.');
 return errors;
}

// ---------- build ----------
// Builds run in a pool of worker threads (KAIROQ_BUILD_WORKERS, default 2) so several
// projects can build at once without blocking the server; 0 builds inline, one at a time.
const BUILD_TIMEOUT_MS=Number(process.env.KAIROQ_BUILD_TIMEOUT_MS||90000);
const pool={workers:[],queue:[],seq:0};
function workerCount(){const n=Number(process.env.KAIROQ_BUILD_WORKERS??2);return Number.isInteger(n)&&n>=0?Math.min(n,8):2}
let inlineQueue=Promise.resolve();
function build(files,outDir,options={}){
 if(workerCount()===0){const task=inlineQueue.then(()=>runBuild(files,outDir,options));inlineQueue=task.catch(()=>{});return task}
 return new Promise((resolve,reject)=>{pool.queue.push({files,outDir,options,resolve,reject});pump()});
}
function spawnWorker(){
 const {Worker}=require('worker_threads');
 const w={thread:new Worker(path.join(__dirname,'build-worker.js')),task:null};
 w.thread.unref();
 w.thread.on('message',msg=>{
  const t=w.task;if(!t||msg.id!==t.id)return;
  clearTimeout(t.timer);w.task=null;w.thread.unref();
  msg.ok?t.resolve(msg.result):t.reject(Object.assign(Error(msg.message),{build:msg.build}));
  pump();
 });
 w.thread.on('error',e=>retire(w,Object.assign(Error('Build worker crashed: '+e.message),{build:true})));
 w.thread.on('exit',()=>retire(w,Object.assign(Error('Build worker stopped'),{build:true})));
 pool.workers.push(w);
 return w;
}
function retire(w,error){
 const i=pool.workers.indexOf(w);if(i>=0)pool.workers.splice(i,1);
 if(w.task){clearTimeout(w.task.timer);const t=w.task;w.task=null;t.reject(error)}
 pump();
}
function pump(){
 while(pool.queue.length){
  let w=pool.workers.find(x=>!x.task);
  if(!w&&pool.workers.length<workerCount())w=spawnWorker();
  if(!w)return;
  const job=pool.queue.shift(),id=++pool.seq;
  w.task={id,resolve:job.resolve,reject:job.reject,timer:setTimeout(()=>{
   // A stuck build is stopped by terminating its worker.
   const t=w.task;w.task=null;t&&t.reject(Object.assign(Error('Build timed out after '+Math.round(BUILD_TIMEOUT_MS/1000)+' seconds'),{build:true}));
   w.thread.terminate().catch(()=>{});
  },BUILD_TIMEOUT_MS)};
  w.thread.ref();
  w.thread.postMessage({id,files:job.files,outDir:job.outDir,projectId:job.options.projectId,root:ROOT()});
 }
}
function buildStats(){return{workers:pool.workers.length,busy:pool.workers.filter(w=>w.task).length,queued:pool.queue.length,max:workerCount()}}
async function runBuild(files,outDir,{projectId='000000000000'}={}){
 fs.mkdirSync(ROOT(),{recursive:true});
 const work=fs.mkdtempSync(path.join(ROOT(),'.build-'));
 try{
  fs.writeFileSync(path.join(work,'index.html'),INDEX_HTML);
  fs.copyFileSync(path.join(__dirname,'builder-runtime','kairoq-reporter.js'),path.join(work,'kairoq-reporter.js'));
  if(projectId!=='000000000000')require('./react-assets').copyInto(projectId,path.join(work,'public'));
  for(const [name,code] of Object.entries(files)){const file=path.join(work,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,code)}
  const {build:viteBuild}=await import('vite');
  const react=(await import('@vitejs/plugin-react')).default;
  const tailwind=require('tailwindcss');
  const modules=path.join(__dirname,'node_modules');
  const output=[];
  const logger={info(){},warn(m){output.push(String(m))},warnOnce(m){output.push(String(m))},error(m){output.push(String(m))},clearScreen(){},hasErrorLogged(){return false},hasWarned:false};
  const run=viteBuild({root:work,base:'./',configFile:false,envFile:false,logLevel:'silent',customLogger:logger,plugins:[react({babel:{plugins:[require('./react-visual').locatorPlugin(work)]}}),kairoqClient(projectId)],
   resolve:{alias:Object.fromEntries(['react','react-dom','lucide-react','react-router-dom'].map(p=>[p,path.join(modules,p)])),dedupe:['react','react-dom']},
   css:{postcss:{plugins:[tailwind({content:[path.join(work,'index.html'),path.join(work,'src/**/*.{js,jsx,ts,tsx}')],theme:{extend:{}}})]}},
   server:{fs:{strict:true,allow:[work]}},
   build:{outDir,emptyOutDir:true,assetsInlineLimit:0,reportCompressedSize:false,sourcemap:false}});
  let timer;
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Build timed out after '+Math.round(BUILD_TIMEOUT_MS/1000)+' seconds')),BUILD_TIMEOUT_MS)});
  try{await Promise.race([run,timeout])}finally{clearTimeout(timer)}
  return{warnings:output.slice(0,20)};
 }catch(e){
  throw Object.assign(Error(cleanBuildError(e)),{build:true});
 }finally{fs.rmSync(work,{recursive:true,force:true})}
}
function kairoqClient(projectId){
 return{name:'kairoq-client',resolveId(id){return id==='kairoq'?'\0kairoq':null},load(id){return id==='\0kairoq'?require('./react-backend').clientSource(projectId):null}};
}
function cleanBuildError(e){
 const root=ROOT();
 return String(e&&(e.message||e)).split(root).join('').replace(/\/\.build-[A-Za-z0-9]+/g,'').replace(/\x1b\[[0-9;]*m/g,'').slice(0,1500);
}

// ---------- model response ----------
function parseEdit(content){
 let value=content;
 if(typeof value==='string'){
  const text=value.trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'');
  try{value=JSON.parse(text)}catch{
   const start=text.indexOf('{'),end=text.lastIndexOf('}');
   if(start<0||end<=start)throw Error('Response was not JSON');
   value=JSON.parse(text.slice(start,end+1));
  }
 }
 if(!value||typeof value!=='object'||!value.files||typeof value.files!=='object'||Array.isArray(value.files))throw Error('Response JSON needs a "files" object');
 const del=Array.isArray(value.delete)?value.delete.filter(x=>typeof x==='string'):[];
 return{message:String(value.message||'Updated the app.').slice(0,2000),files:value.files,delete:del};
}
function contextFiles(files,budget=160000){
 const parts=[];let used=0;const omitted=[];
 const order=Object.keys(files).sort((a,b)=>(a==='src/App.jsx'?-1:b==='src/App.jsx'?1:a.localeCompare(b)));
 for(const name of order){const block='--- '+name+' ---\n'+files[name]+'\n';if(used+block.length>budget){omitted.push(name);continue}used+=block.length;parts.push(block)}
 return parts.join('\n')+(omitted.length?'\n(Not shown to save space: '+omitted.join(', ')+'. Do not rewrite them unless needed.)\n':'');
}

// ---------- projects ----------
function create({name,owner}){
 fs.mkdirSync(ROOT(),{recursive:true});
 const id=slugId(),now=new Date().toISOString();
 const meta={id,name:String(name||'Untitled app').slice(0,80),owner:owner||null,preview_key:crypto.randomBytes(12).toString('hex'),created_at:now,updated_at:now,current_version:0,versions:[],messages:[],published:null,domains:[]};
 fs.mkdirSync(projectDir(id),{recursive:true});
 saveMeta(meta);
 return meta;
}
// Starts a project from given files (a template or a remix) as version 1.
async function initializeFrom(meta,files,summary){
 const errors=validateFiles(files);
 if(errors.length)throw Object.assign(Error(errors[0]),{status:400});
 await build(files,path.join(versionDir(meta.id,1),'dist'),{projectId:meta.id});
 writeJson(path.join(versionDir(meta.id,1),'files.json'),files);
 const fresh=loadMeta(meta.id);
 fresh.versions.push({n:1,at:new Date().toISOString(),summary});
 fresh.current_version=1;
 fresh.messages.push({role:'assistant',text:summary+'. Tell me what to change.',version:1,mode:'system',at:new Date().toISOString()});
 saveMeta(fresh);
 return fresh;
}
async function initialize(meta){
 const files=template(meta.name);
 await build(files,path.join(versionDir(meta.id,1),'dist'),{projectId:meta.id});
 writeJson(path.join(versionDir(meta.id,1),'files.json'),files);
 meta.versions.push({n:1,at:new Date().toISOString(),summary:'Starter project'});
 meta.current_version=1;
 saveMeta(meta);
 return meta;
}
function list(owner){
 if(!fs.existsSync(ROOT()))return[];
 return fs.readdirSync(ROOT()).filter(d=>/^[a-f0-9]{12}$/.test(d)).map(d=>readJson(path.join(ROOT(),d,'project.json'),null)).filter(m=>m&&(owner===undefined||m.owner===owner)).map(summary).sort((a,b)=>b.updated_at.localeCompare(a.updated_at));
}
function summary(m){return{id:m.id,name:m.name,owner:m.owner,current_version:m.current_version,updated_at:m.updated_at,published:m.published,preview_url:previewUrl(m)}}
function previewUrl(m,n=m.current_version){return n?'/builder/p/'+m.id+'-'+m.preview_key+'/v/'+n+'/':null}
function detail(id){const m=loadMeta(id);return{...summary(m),versions:m.versions,messages:m.messages.slice(-100),domains:m.domains,files:m.current_version?Object.keys(loadFiles(id,m.current_version)).sort():[]}}
function readFile(id,name){const m=loadMeta(id),files=loadFiles(id,m.current_version);if(!Object.hasOwn(files,name))throw Object.assign(Error('Unknown file'),{status:404});return files[name]}

function userContent(text,images){
 if(!images||!images.length)return text;
 return[{type:'text',text},...images.map(img=>({type:'image_url',image_url:{url:'data:'+img.mime+';base64,'+img.data}}))];
}
function historyMessages(meta){return meta.messages.filter(m=>m.text).slice(-10).map(m=>({role:m.role==='user'?'user':'assistant',content:m.text}))}
function addMessages(id,entries){const fresh=loadMeta(id);fresh.messages.push(...entries.map(e=>({...e,at:new Date().toISOString()})));saveMeta(fresh);return fresh}

// mode "build" edits code; checkRuntime(url) opens the build and returns runtime errors.
async function edit(id,instruction,{callModel,onProgress=()=>{},onStream,signal,tier='standard',images=[],checkRuntime,assetNote=''}={}){
 const meta=loadMeta(id);
 const text=String(instruction||'').trim().slice(0,8000);
 if(!text)throw Object.assign(Error('Describe the change you want'),{status:400});
 if(!meta.current_version)await initialize(meta);
 const base=loadFiles(id,meta.current_version);
 const request='Current project files:\n\n'+contextFiles(base)+(assetNote?'\n\n'+assetNote:'')+'\n\nRequest: '+text;
 const messages=[{role:'system',content:SYSTEM_PROMPT},...historyMessages(meta),{role:'user',content:userContent(request,images)}];
 let lastError='',runtimeErrors=[];
 for(let attempt=1;attempt<=MAX_ATTEMPTS;attempt++){
  signal?.throwIfAborted();
  onProgress(attempt===1?'writing':'fixing');
  const reply=await callModel({messages,temperature:0.2,maxOutputTokens:16000,signal,tier,onToken:onStream?(_d,all)=>onStream(all,attempt):undefined},parseEdit);
  const next={...base};
  for(const name of reply.delete)if(name!=='src/main.jsx'&&name!=='src/App.jsx')delete next[name];
  for(const [name,code] of Object.entries(reply.files))next[name]=code;
  const errors=validateFiles(next);
  messages.push({role:'assistant',content:JSON.stringify({message:reply.message,files:reply.files,delete:reply.delete})});
  if(errors.length){lastError=errors.slice(0,12).join('\n');messages.push({role:'user',content:'That change was rejected:\n'+lastError+'\nReturn corrected JSON with the full content of every file you need to change.'});continue}
  onProgress('building');
  const n=Math.max(0,...meta.versions.map(v=>v.n),...loadMeta(id).versions.map(v=>v.n))+1,dir=versionDir(id,n);
  try{await build(next,path.join(dir,'dist'),{projectId:id})}
  catch(e){if(!e.build)throw e;fs.rmSync(dir,{recursive:true,force:true});lastError=e.message;messages.push({role:'user',content:'The Vite build failed:\n'+lastError+'\nFix the error and return corrected JSON.'});continue}
  runtimeErrors=[];
  if(checkRuntime){
   onProgress('testing');
   try{runtimeErrors=(await checkRuntime(previewUrl(meta,n))).errors||[]}catch(e){runtimeErrors=[]}
   if(runtimeErrors.length&&attempt<MAX_ATTEMPTS){
    fs.rmSync(dir,{recursive:true,force:true});
    lastError=runtimeErrors.join('\n');
    messages.push({role:'user',content:'The app built, but opening it in a browser showed these problems:\n'+lastError+'\nFind the cause in the code and return corrected JSON.'});
    continue;
   }
  }
  writeJson(path.join(dir,'files.json'),next);
  const changed=Object.keys(reply.files).filter(k=>base[k]!==reply.files[k]).concat(reply.delete.filter(k=>Object.hasOwn(base,k)&&!Object.hasOwn(next,k)));
  const fresh=loadMeta(id);
  fresh.versions.push({n,at:new Date().toISOString(),summary:reply.message.slice(0,200),changed,tier,...(runtimeErrors.length?{runtime_errors:runtimeErrors}:{})});
  fresh.current_version=n;
  const now=new Date().toISOString();
  fresh.messages.push({role:'user',text,at:now,...(images.length?{images:images.map(i=>i.name)}:{})},{role:'assistant',text:reply.message,version:n,changed,at:now,...(runtimeErrors.length?{runtime_errors:runtimeErrors}:{})});
  saveMeta(fresh);
  return{version:n,message:reply.message,changed,attempts:attempt,runtime_errors:runtimeErrors,preview_url:previewUrl(fresh)};
 }
 throw Object.assign(Error('The change could not be built after '+MAX_ATTEMPTS+' attempts. Last problem: '+lastError.slice(0,600)),{status:422});
}

const DISCUSS_PROMPT=`You are the planning partner inside an app builder like Lovable. The user is discussing their React + Tailwind app (with an optional built-in backend for sign-in and saved data). Do not write or change code.
Answer questions about the app, suggest improvements, and when the user wants a change, reply with a short numbered plan of what you would change and which files. Keep answers brief and concrete. Plain text, no JSON.`;
function parseText(content){if(typeof content==='string'){const t=content.trim();if(!t)throw Error('Empty answer');return t}return String(content?.message||content?.answer||JSON.stringify(content))}
async function discuss(id,question,{callModel,onStream,signal,tier='standard',images=[]}={}){
 const meta=loadMeta(id);
 const text=String(question||'').trim().slice(0,8000);
 if(!text)throw Object.assign(Error('Ask a question or describe an idea'),{status:400});
 const files=meta.current_version?loadFiles(id,meta.current_version):template(meta.name);
 const messages=[{role:'system',content:DISCUSS_PROMPT},...historyMessages(meta),{role:'user',content:userContent('Current project files:\n\n'+contextFiles(files,90000)+'\n\nMessage: '+text,images)}];
 const answer=(await callModel({messages,temperature:0.4,maxOutputTokens:3000,signal,tier,onToken:onStream?(_d,all)=>onStream(all,1):undefined},parseText)).slice(0,12000);
 addMessages(id,[{role:'user',text,mode:'discuss'},{role:'assistant',text:answer,mode:'discuss'}]);
 return{message:answer};
}

// Validates, builds and saves source files as a new version without the AI.
async function saveSource(id,files,{summary,changed=[],extra={},message}={}){
 const errors=validateFiles(files);
 if(errors.length)throw Object.assign(Error(errors.slice(0,5).join('\n')),{status:400});
 const meta=loadMeta(id),n=Math.max(0,...meta.versions.map(v=>v.n))+1,dir=versionDir(id,n);
 try{await build(files,path.join(dir,'dist'),{projectId:id})}
 catch(e){fs.rmSync(dir,{recursive:true,force:true});throw Object.assign(Error('That change does not build: '+String(e.message).slice(0,500)),{status:400})}
 writeJson(path.join(dir,'files.json'),files);
 const fresh=loadMeta(id);
 fresh.versions.push({n,at:new Date().toISOString(),summary:String(summary).slice(0,200),changed,...extra});
 fresh.current_version=n;
 fresh.messages.push({role:'assistant',text:message||summary+'.',version:n,changed,mode:extra.visual?'visual':'system',at:new Date().toISOString()});
 saveMeta(fresh);
 return{version:n,summary,preview_url:previewUrl(fresh)};
}
// Applies a visual edit (text, classes, image) without the AI and saves it as a new version.
async function visualEdit(id,{loc,version,changes}){
 const meta=loadMeta(id);
 if(Number(version)!==meta.current_version)throw Object.assign(Error('Switch to the latest version to edit visually'),{status:409});
 const base=loadFiles(id,meta.current_version);
 const {files:next,summary}=require('./react-visual').applyEdit(base,loc,changes||{});
 const file=require('./react-visual').parseLoc(loc).file;
 return saveSource(id,next,{summary,changed:[file],extra:{visual:true}});
}
function inspectElement(id,{loc,version}){
 const meta=loadMeta(id);
 const n=Number(version)||meta.current_version;
 return{...require('./react-visual').inspect(loadFiles(id,n),loc),latest:n===meta.current_version};
}
function restore(id,n){
 const meta=loadMeta(id);n=Number(n);
 if(!meta.versions.some(v=>v.n===n))throw Object.assign(Error('Unknown version'),{status:404});
 meta.current_version=n;
 meta.messages.push({role:'assistant',text:'Restored version '+n+'.',version:n,at:new Date().toISOString()});
 saveMeta(meta);
 return detail(id);
}
function rename(id,name){const meta=loadMeta(id);meta.name=String(name||meta.name).slice(0,80);saveMeta(meta);return summary(meta)}
function remove(id){const dir=projectDir(id);loadMeta(id);fs.rmSync(dir,{recursive:true,force:true});return{deleted:id}}

// ---------- serving built files ----------
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.ico':'image/x-icon','.json':'application/json','.woff2':'font/woff2','.woff':'font/woff','.txt':'text/plain; charset=utf-8'};
// sandbox=true runs the page in an opaque origin so generated code cannot use the Kairoq session.
function contentPolicy(sandbox){return "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https:; img-src 'self' https: data: blob:; font-src 'self' https: data:; connect-src 'self' https:; media-src 'self' https: data: blob:; frame-ancestors 'self'; base-uri 'none'; form-action 'self'"+(sandbox?'; sandbox allow-scripts allow-forms allow-popups allow-modals':'')}
function serveDist(req,res,distDir,rest,{sandbox}){
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end()}
 let rel=decodeURIComponent(String(rest||'').split('?')[0]).replace(/^\/+/,'');
 if(!rel||rel.endsWith('/'))rel+='index.html';
 const file=path.resolve(distDir,rel);
 if(!file.startsWith(path.resolve(distDir)+path.sep)){res.writeHead(400);return res.end()}
 let target=file;
 if(!fs.existsSync(target)||!fs.statSync(target).isFile()){if(path.extname(rel))return notFound(res);target=path.join(distDir,'index.html')}
 if(!fs.existsSync(target))return notFound(res);
 const ext=path.extname(target).toLowerCase(),html=ext==='.html';
 const headers={'Content-Type':TYPES[ext]||'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Cache-Control':html?'no-cache':'public, max-age=31536000, immutable'};
 if(html)headers['Content-Security-Policy']=contentPolicy(sandbox);
 else headers['Access-Control-Allow-Origin']='*';
 res.writeHead(200,headers);
 if(req.method==='HEAD')return res.end();
 fs.createReadStream(target).pipe(res);
}
function notFound(res){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Not found')}
// /builder/p/<id>-<key>/v/<n>/<path>
function handlePreview(req,res){
 const m=/^\/builder\/p\/([a-f0-9]{12})-([a-f0-9]{24})\/v\/(\d+)(\/.*)?$/.exec(String(req.url||'').split('?')[0]);
 if(!m)return false;
 let meta;try{meta=loadMeta(m[1])}catch{notFound(res);return true}
 const key=Buffer.from(m[2]),expected=Buffer.from(meta.preview_key);
 if(key.length!==expected.length||!crypto.timingSafeEqual(key,expected)){notFound(res);return true}
 if(!m[4]){res.writeHead(301,{Location:req.url.split('?')[0]+'/'});res.end();return true}
 serveDist(req,res,path.join(versionDir(m[1],m[3]),'dist'),m[4],{sandbox:true});
 return true;
}

module.exports={contentPolicy,initializeFrom,runBuild,buildStats,INDEX_HTML,saveSource,create,initialize,list,detail,readFile,edit,discuss,visualEdit,inspectElement,restore,rename,remove,loadMeta,saveMeta,loadFiles,versionDir,projectDir,previewUrl,serveDist,handlePreview,validateFiles,parseEdit,template,build,ROOT,ALLOWED_PACKAGES,SYSTEM_PROMPT};

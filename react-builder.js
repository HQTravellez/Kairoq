"use strict";
// React + Vite + Tailwind projects edited through chat. Each accepted edit is an
// immutable version: versions/<n>/files.json (source) and versions/<n>/dist (build).
const fs=require('fs'),path=require('path'),crypto=require('crypto');

const ROOT=()=>process.env.KAIROQ_REACT_PROJECTS_DIR||path.join(__dirname,'workspace','react-projects');
// Packages generated apps may import (and their sub-paths). All are installed with Kairoq.
const APP_PACKAGES={react:'UI',
 'react-dom':'UI','lucide-react':'icons','react-router-dom':'routing (use HashRouter)',
 recharts:'charts','framer-motion':'animation','date-fns':'dates',clsx:'class names','tailwind-merge':'merging Tailwind classes','class-variance-authority':'component variants',
 zod:'validation','react-hook-form':'forms','@radix-ui/react-dialog':'dialogs','@radix-ui/react-dropdown-menu':'menus','@radix-ui/react-tabs':'tabs','@radix-ui/react-tooltip':'tooltips',
 '@radix-ui/react-popover':'popovers','@radix-ui/react-select':'selects','@radix-ui/react-accordion':'accordions','@radix-ui/react-switch':'switches',
 sonner:'toasts','react-markdown':'markdown','@tanstack/react-query':'data fetching','canvas-confetti':'confetti','react-day-picker':'date picker',
 'embla-carousel-react':'carousels','qrcode.react':'QR codes',three:'3D scenes (glTF models via three/examples/jsm/loaders/GLTFLoader.js)',gsap:'timeline and scroll animation (gsap/ScrollTrigger for pinned scroll stories)',lenis:'smooth scrolling',remotion:'video compositions (with @remotion/player; companies of 4+ people need a Remotion company license)','@remotion/player':'plays Remotion compositions inline'};
const ALLOWED_PACKAGES=[...Object.keys(APP_PACKAGES),'kairoq'];
function packageOf(spec){const parts=spec.split('/');return spec.startsWith('@')?parts.slice(0,2).join('/'):parts[0]}
function allowedImport(spec){if(spec==='kairoq')return true;const pkg=packageOf(spec);return Object.hasOwn(APP_PACKAGES,pkg)&&!spec.includes('..')&&!/\/(node_modules|package\.json)/.test(spec)}
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
// A new project: the starter page, the UI kit and default design tokens (see react-design.js).
function template(name){return require('./react-design').starterFiles(name)}

const SYSTEM_PROMPT=`You are the coding engine of an app builder like Lovable. You edit a React 18 + Vite + Tailwind CSS 3 project.
Rules:
- Source lives under src/. The entry is src/main.jsx, which renders src/App.jsx and imports src/index.css. index.html is fixed; set the page title with document.title in a useEffect.
- Use JavaScript with JSX (.jsx/.js). Style with Tailwind utility classes. Write clean, responsive, accessible UI with real, specific copy (no lorem ipsum).
- Available npm packages (nothing else can be imported): ${Object.entries(APP_PACKAGES).map(([p,u])=>p+' ('+u+')').join(', ')}. Build polished UI from Tailwind plus Radix primitives (shadcn-style components in src/components/ui/ using clsx + tailwind-merge + class-variance-authority), recharts for charts, framer-motion for tasteful motion and sonner for toasts. Do not use import.meta or query imports like "?raw".
- Split the UI into components under src/components/ and pages under src/pages/ when the app grows.
- Backend: import { auth, collection } from 'kairoq' for user accounts and saved data shared by all visitors.
  auth.signUp(email,password,name?) / auth.signIn(email,password) / auth.signOut() return promises; auth.user() returns the signed-in user or null; auth.onChange(fn) subscribes and returns an unsubscribe function; await auth.ready() before deciding the user is signed out (it finishes Google sign-in).
  auth.signInWithGoogle() offers "Continue with Google" (it works on the published app; in the preview show its error message). Password reset: auth.requestPasswordReset(email) emails a link back to the app; when auth.resetToken() is set, show a "choose a new password" form that calls auth.resetPassword(newPassword).
  Live updates: const stop = collection('messages').subscribe(({type,item}) => ...) delivers created/updated/deleted events to everyone allowed to read them (chats, live dashboards, presence); call stop() on unmount.
  collection('name').list({limit,order:'asc'|'desc',mine:true,where:{field:value}}) / .get(id) / .create(data) / .update(id,data) / .remove(id). Records come back as {id,...data,_owner,_created_at}.
  Declare every collection in src/backend.json, e.g. {"collections":{"tasks":{"access":"private"},"messages":{"access":"public"}}}. Access: "private" = each signed-in user sees only their own records; "shared" = signed-in users see all records; "public-read" = anyone reads, signed-in users add; "public" = anyone reads and adds (guestbooks, public comments); "submit-only" = anyone can add but nobody can read them back, only the owner sees them in Kairoq (use this for contact, booking, reservation, order and waitlist forms; show a thank-you message after create). Only a record's creator can update or delete it.
  Show loading and error states, and a sign-in form when a collection needs a signed-in user. Use localStorage only for small UI preferences, inside try/catch.
  Optional features (add them to src/backend.json only when the app needs them):
  - File uploads: "storage":{"access":"signed-in"} (or "public"). import { storage } from 'kairoq'; const f=await storage.upload(fileFromInput) returns {id,url,name}; save f.url in a record to show it later. Images, PDF, text and CSV up to 5 MB. Anyone with a file URL can open it, so never upload private documents.
  - Email: "email":true. import { email } from 'kairoq'; await email.send({to:'owner',subject,text}) notifies the app owner (for contact and booking forms); to:'me' emails the signed-in user.
  - Payments: "payments":{"products":{"pro":{"price":"price_REPLACE_ME","mode":"payment"}}} (mode "subscription" for plans). import { payments } from 'kairoq'; await payments.checkout('pro') opens Stripe Checkout for the signed-in user; await payments.has('pro') checks a purchase. Tell the user to replace price ids with their Stripe price ids and connect Stripe in Settings.
  - AI in the app: "ai":true. import { ai } from 'kairoq'; const { text } = await ai.chat({ system, messages:[{role:'user',content}] }) (also ai.chat('prompt')). Use it for chatbots, summaries, suggestions and generators. Show a loading state; errors can include "out of AI credits".
  - Server functions (for API keys, calling other services, webhooks, logic that must not run in the browser): add functions/<name>.js (lowercase-name) with exactly one default export and no imports:
      export default async function (request, { user, db, secrets, fetch, ai, email, crypto, log }) { ...; return { status: 200, json: {...} }; }
    request = { method, query, headers, body (parsed JSON), rawBody }; user is the signed-in user or null. db.collection('name').list/get/create/update/remove run with full access, so check user and validate input yourself. secrets.get('STRIPE_KEY') reads secrets the owner adds in Settings (never put keys in src/). fetch can only reach public https/http hosts. crypto has hmacSha256Hex(key,msg), sha256Hex, timingSafeEqual, randomId. Return {status, json} or {status, body, headers:{'content-type':...}}.
    Call it from the app with: import { functions } from 'kairoq'; const data = await functions.invoke('name', body). Its public URL (for webhooks from other services) is functions.url('name'); verify webhook signatures with crypto.hmacSha256Hex over request.rawBody.
  - SQL database (relational data: tables, foreign keys, joins, reports, inventory, bookings with rooms and guests): write migrations sql/001_init.sql, sql/002_add_rooms.sql, ... (SQLite syntax: CREATE TABLE, indexes, REFERENCES, CHECK). Migrations run once, in order; never change one that already ran, add a new numbered file instead. Query only from server functions: const rows = await db.sql\`SELECT * FROM rooms WHERE price <= \${max}\` (tagged template, values become parameters) or db.sql('SELECT ... WHERE id = ?', [id]); writes return {changes,lastInsertRowid}; add RETURNING * to get rows back; db.batch([[sql, params], ...]) runs several statements in one transaction. Never build SQL by joining strings with user input. Check user before reads or writes of personal data. Use collections for simple per-user lists and SQL when the data has relations.
  - Automations (the app does things on its own): "automations":[{"name":"reminders","run":"send-reminders","every":"day","at":"09:00","tz":"Europe/London"},{"name":"welcome","run":"welcome","on":"created","collection":"bookings"}]. "run" names a file in functions/; "every" is hour, day (with "at") or week (with "at" and "day": mon..sun); or "on": created|updated|deleted with a "collection". The function gets request.body = { automation, trigger, at, collection?, record? } and user = null, and must work without a signed-in user. Use them for reminders, digests, follow-up emails, cleanups and syncing with other services; an automation cannot start another one. Simpler built-ins: "schedules":[{"name":"cleanup","every":"day","action":"delete_older_than","collection":"logs","days":30},{"name":"digest","every":"day","action":"email_owner_summary","collection":"bookings"}].
- Images: use uploaded images at the paths you are given (for example <img src="./uploads/logo.png">), https URLs (for example https://images.unsplash.com/...) or inline SVG. For background images use an inline style in JSX, not CSS url().
- When the user attaches a screenshot or design, match its layout, spacing, colors and content as closely as you can.
- A message that reports a problem you cannot see in the code ("I can't see the website", "the preview is blank") when the project has no errors is not a change request: reply with files {} and a message that says the app builds and opens without errors and what to check (the Preview tab, the open-in-new-tab button, a reload), and change nothing. Never rewrite the entry point or add recovery screens for a problem you cannot reproduce.
- Before you answer, check your own work: (1) if the request is already implemented exactly as asked, say so and change nothing; (2) every import resolves to a file you include or that already exists, or to an available package, so leave no import unresolved; (3) new pages and components are actually rendered: add routes and navigation links in App.jsx or the layout, or the user cannot see them; (4) the whole feature works, with no placeholders, TODOs or "rest of the code unchanged" comments. If not everything fits in one reply, finish the most important part completely and say in "message" what is left.
- Generated images: when the app needs photos or illustrations that are not uploaded, you may add "images":[{"name":"hero-terrace.jpg","prompt":"detailed description of the photo","aspect":"16:9"}] to your reply (at most 4, aspect 1:1, 4:3, 3:2, 16:9, 9:16 or 3:4) and use them as ./uploads/<name>. Only when the user's message says image generation is available; otherwise use https photo URLs.${require('./react-design').RULES}
Respond with ONLY a JSON object, no markdown fences:
{"plan":["2 to 6 short steps you will take, written for the user, e.g. \"Add a booking form to the home page\""],"message":"one or two sentences telling the user what you changed","files":{"src/new-or-rewritten.jsx":"full file content"},"edits":{"src/existing.jsx":[{"find":"exact current lines","replace":"new lines"}]},"delete":["src/unused.jsx"]}
Include only files you create or change. "files", "edits", "delete" and "images" are each optional, but send at least one change.${require('./react-edits').PROMPT_NOTE}`;

function slugId(){return crypto.randomBytes(6).toString('hex')}
function projectDir(id){if(!/^[a-f0-9]{12}$/.test(String(id)))throw Object.assign(Error('Unknown project'),{status:404});return path.join(ROOT(),id)}
function writeJson(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data,null,1));fs.renameSync(tmp,file)}
function readJson(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return fallback}}

function loadMeta(id){const meta=readJson(path.join(projectDir(id),'project.json'),null);if(!meta)throw Object.assign(Error('Unknown project'),{status:404});return meta}
function saveMeta(meta){meta.updated_at=new Date().toISOString();writeJson(path.join(projectDir(meta.id),'project.json'),meta)}
function versionDir(id,n){return path.join(projectDir(id),'versions',String(Number(n)))}
function loadFiles(id,n){const files=readJson(path.join(versionDir(id,n),'files.json'),null);if(!files)throw Object.assign(Error('Unknown version'),{status:404});return files}

// ---------- validation ----------
function validPath(p){return typeof p==='string'&&p.length<=120&&(/^src\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.(?:jsx|js|tsx|ts|css|json)$/.test(p)||/^functions\/[a-z][a-z0-9-]{0,39}\.js$/.test(p)||/^sql\/\d{3}_[a-z0-9_]{1,40}\.sql$/.test(p))&&!p.split('/').some(seg=>seg==='..'||seg.startsWith('.'))}
function resolveRelative(from,spec,files){
 const base=path.posix.normalize(path.posix.join(path.posix.dirname(from),spec));
 if(!base.startsWith('src/'))return null;
 for(const candidate of [base,...SOURCE_EXT.map(e=>base+e),...SOURCE_EXT.map(e=>base+'/index'+e)])if(Object.hasOwn(files,candidate))return candidate;
 return null;
}
function specifiers(code){
 const out=[],re=/\bimport\s*(?:[\w$\u0080-\uffff*{}\s,]+?\s*from\s*)?['"]([^'"]+)['"]|\bexport\s+[\w$\u0080-\uffff*{}\s,]+?\s+from\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)|\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
 let m;while((m=re.exec(code)))out.push(m[1]||m[2]||m[3]||m[4]);
 return out;
}
function validateFiles(files){
 const errors=[],names=Object.keys(files);
 if(names.length>MAX_FILES)errors.push('Too many files ('+names.length+'); the limit is '+MAX_FILES+'.');
 let total=0;
 for(const name of names){
  const code=files[name];
  if(!validPath(name)){errors.push('Invalid file path: '+name+' (app files go under src/ with a .jsx/.js/.css/.json extension, server functions in functions/<name>.js, SQL migrations in sql/001_name.sql).');continue}
  if(typeof code!=='string'){errors.push(name+' must be a string.');continue}
  total+=Buffer.byteLength(code);
  if(Buffer.byteLength(code)>MAX_FILE_BYTES)errors.push(name+' is larger than 200 KB.');
  if(/\.(jsx?|tsx?)$/.test(name)&&!name.startsWith('functions/')){
   if(/\bimport\.meta\b/.test(code))errors.push(name+': import.meta is not allowed.');
   if(/\bimport\s*\(\s*[^'"\s)]/.test(code))errors.push(name+': dynamic import() must use a string literal.');
   for(const spec of specifiers(code)){
    if(spec.includes('?')||spec.includes('\0'))errors.push(name+': import "'+spec+'" uses a query, which is not allowed.');
    else if(spec.startsWith('.')){if(!resolveRelative(name,spec,files))errors.push(name+': import "'+spec+'" does not match a project file.')}
    else if(!allowedImport(spec))errors.push(name+': package "'+spec+'" is not available. Available packages: '+Object.keys(APP_PACKAGES).join(', ')+'.');
   }
  }
  if(name.endsWith('.css')){
   for(const m of code.matchAll(/@import\s+(?:url\()?\s*['"]?([^'")\s;]+)/g)){const spec=m[1];if(!/^https:\/\//.test(spec)&&!(spec.startsWith('.')&&resolveRelative(name,spec,files)))errors.push(name+': @import "'+spec+'" must be an https URL or a project CSS file.')}
   for(const m of code.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)){const u=m[1].trim();if(!/^(https:|data:|#)/.test(u))errors.push(name+': url('+u+') must be an https or data: URL.')}
  }
 }
 if(total>MAX_PROJECT_BYTES)errors.push('Project source is larger than 1.5 MB.');
 errors.push(...require('./react-backend').configErrors(files));
 errors.push(...require('./react-functions').validate(files));
 errors.push(...require('./react-sql').validate(files));
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
 const version=Number((/[\\/]versions[\\/](\d+)[\\/]dist$/.exec(outDir)||[])[1]||0);
 fs.mkdirSync(ROOT(),{recursive:true});
 const work=fs.mkdtempSync(path.join(ROOT(),'.build-'));
 try{
  fs.writeFileSync(path.join(work,'index.html'),INDEX_HTML);
  fs.copyFileSync(path.join(__dirname,'builder-runtime','kairoq-reporter.js'),path.join(work,'kairoq-reporter.js'));
  if(projectId!=='000000000000')require('./react-assets').copyInto(projectId,path.join(work,'public'));
  for(const [name,code] of Object.entries(files)){const file=path.join(work,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,code)}
  // Packages resolve from Kairoq's own installed modules (validated imports only).
  fs.symlinkSync(path.join(__dirname,'node_modules'),path.join(work,'node_modules'),'dir');
  const {build:viteBuild}=await import('vite');
  const react=(await import('@vitejs/plugin-react')).default;
  const tailwind=require('tailwindcss');
  const modules=path.join(__dirname,'node_modules');
  const output=[];
  const logger={info(){},warn(m){output.push(String(m))},warnOnce(m){output.push(String(m))},error(m){output.push(String(m))},clearScreen(){},hasErrorLogged(){return false},hasWarned:false};
  const run=viteBuild({root:work,base:'./',configFile:false,envFile:false,logLevel:'silent',customLogger:logger,plugins:[importGuard(fs.realpathSync(work)),react({babel:{plugins:[require('./react-visual').locatorPlugin(work)]}}),kairoqClient(projectId,version)],
   resolve:{dedupe:['react','react-dom']},
   css:{postcss:{plugins:[tailwind({content:[path.join(work,'index.html'),path.join(work,'src/**/*.{js,jsx,ts,tsx}')],theme:require('./react-design').THEME})]}},
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
// Enforces the import rules inside the build itself, so a specifier the source checks
// miss (odd identifiers, string escapes) still cannot pull files from outside the project:
// project code may import project files under src/, allowed packages and kairoq only.
function importGuard(work){
 const src=path.join(work,'src')+path.sep,modules=fs.realpathSync(path.join(__dirname,'node_modules'))+path.sep;
 const inside=(file,dir)=>file.startsWith(dir);
 const project=importer=>importer&&inside(importer,work+path.sep)&&!inside(importer,path.join(work,'node_modules')+path.sep);
 return{name:'kairoq-import-guard',enforce:'pre',
  resolveId(source,importer){
   const from=importer&&importer.split('?')[0];
   if(!project(from))return null;
   if(source==='kairoq'||/^\0vite\//.test(source)||source==='vite/modulepreload-polyfill'||source==='vite/preload-helper.js')return null;
   const deny=()=>this.error('Import "'+String(source).slice(0,120)+'" is not allowed: import project files under src/ or an available package.');
   if(/[?#\0\\]/.test(source))deny();
   if(source.startsWith('/')){
    const target=path.join(work,source);
    if(!(inside(target,src)||target===path.join(work,'kairoq-reporter.js'))||!fs.existsSync(target))deny();
    return null;
   }
   if(source.startsWith('.')){
    if(!inside(path.resolve(path.dirname(from),source),src))deny();
    return null;
   }
   if(!allowedImport(source)||source.split('/').includes('..'))deny();
   return null;
  },
  load(id){
   if(id.startsWith('\0'))return null;
   const file=id.split('?')[0];
   let real;try{real=fs.realpathSync(file)}catch{return null}
   if(!inside(real,work+path.sep)&&!inside(real,modules))this.error('Loading files outside the project is not allowed.');
   return null;
  }};
}
function kairoqClient(projectId,version=0){
 return{name:'kairoq-client',resolveId(id){return id==='kairoq'?'\0kairoq':null},load(id){return id==='\0kairoq'?require('./react-backend').clientSource(projectId,'',version):null}};
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
 if(!value||typeof value!=='object'||(value.files!==undefined&&(typeof value.files!=='object'||value.files===null||Array.isArray(value.files))))throw Error('Response JSON needs a "files" object');
 const edits=require('./react-edits').normalize(value.edits);
 if(!value.files&&!Object.keys(edits).length)throw Error('Response JSON needs a "files" object or "edits"');
 const del=Array.isArray(value.delete)?value.delete.filter(x=>typeof x==='string'):[];
 const plan=(Array.isArray(value.plan)?value.plan:[]).map(x=>String(x||'').replace(/\s+/g,' ').trim().slice(0,140)).filter(Boolean).slice(0,6);
 return{message:String(value.message||'Updated the app.').slice(0,2000),plan,files:value.files||{},edits,delete:del,images:imageRequests(value.images)};
}
// Images the model asks Kairoq to generate: [{name:'hero.jpg',prompt,aspect}].
const ASPECTS=['1:1','4:3','3:2','16:9','9:16','3:4','2:3'];
function imageRequests(list){
 if(!Array.isArray(list))return[];
 const seen=new Set();
 return list.filter(i=>i&&typeof i==='object'&&typeof i.prompt==='string'&&i.prompt.trim()).slice(0,4).map((i,n)=>{
  const ext=(/\.(png|jpe?g|webp)$/i.exec(String(i.name||''))||[])[1];
  let stem=String(i.name||'').toLowerCase().replace(/\.[a-z0-9]+$/,'').replace(/[^a-z0-9-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)||'image-'+(n+1);
  while(seen.has(stem))stem+='-'+(n+1);seen.add(stem);
  return{name:stem+'.'+(ext?ext.toLowerCase().replace('jpeg','jpg'):'jpg'),prompt:i.prompt.trim().slice(0,1500),aspect:ASPECTS.includes(i.aspect)?i.aspect:'16:9'};
 });
}
// Generates requested images into the project's uploads and points the code at the saved
// names (a saved name can differ: another extension or a -2 suffix). Without generation,
// or when it fails, a plain placeholder in the brand colour keeps the app working.
async function materializeImages(id,reply,{imageGen,cache,design}){
 if(!reply.images.length)return[];
 const assets=require('./react-assets'),notes=[];
 for(const img of reply.images){
  const key=img.name+'|'+img.prompt;
  let saved=cache.get(key);
  if(!saved){
   let picture=null;
   if(imageGen){try{picture=await imageGen(img)}catch(e){notes.push('Image "'+img.name+'" could not be generated: '+String(e.message||e).slice(0,160))}}
   const stem=img.name.replace(/\.[a-z]+$/,'');
   if(picture){const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[picture.mime]||'png';saved=assets.save(id,[{name:stem+'.'+ext,mime:picture.mime,data:picture.data}],{maxBytes:6*1024*1024})[0]}
   else{const hex=(design&&design.palette&&(design.palette.muted||design.palette.secondary))||'#e5e7eb';saved=assets.save(id,[{name:stem+'.png',mime:'image/png',data:require('./react-mobile').solidPng(64,hex).toString('base64')}])[0];if(!imageGen)notes.push('Image generation is not available, so "'+img.name+'" is a plain placeholder; upload a photo to replace it.')}
   cache.set(key,saved);
  }
  if(saved!==img.name)for(const [f,code] of Object.entries(reply.files))if(typeof code==='string')reply.files[f]=code.split('uploads/'+img.name).join('uploads/'+saved);
 }
 return notes;
}
// Before the first real build of a new project the AI picks a visual direction (the design
// brief); Kairoq saves it on the project and writes its colours and fonts into src/index.css.
async function prepareDesign(id,text,{callModel,tier,signal,images=[],onProgress=()=>{}}){
 const meta=loadMeta(id);
 // A design already chosen (from a reference build plan) is used instead of a new brief.
 const planned=meta.planned_design&&!meta.design?meta.planned_design:null;
 if(!planned&&(meta.design||images.length||process.env.KAIROQ_DESIGN_BRIEF==='off'))return null;
 const design=require('./react-design'),files=loadFiles(id,meta.current_version);
 if(!design.isUntouchedStarter(files)||!design.hasTokens(files)){if(meta.planned_design){const f=loadMeta(id);if(!f.design)f.design=f.planned_design;delete f.planned_design;saveMeta(f)}return null}
 let brief=planned;
 if(!brief){
  onProgress('designing');
  try{brief=await design.createBrief(text,{callModel,tier,signal,projectName:meta.name,skills:require('./react-skills').library(meta.owner||'owner').map(s=>({id:s.id,description:s.name+': '+s.description}))})}
  catch(e){if(signal?.aborted)throw e;console.warn('[design-brief]',String(e.message||e).slice(0,200));return null}
 }
 const fresh=loadMeta(id);
 delete fresh.planned_design;
 fresh.design=brief;
 if(brief.skill&&!(fresh.skills||[]).includes(brief.skill))fresh.skills=[...(fresh.skills||[]),brief.skill];
 saveMeta(fresh);
 return brief;
}
function contextFiles(files,budget=160000){
 const parts=[];let used=0;const omitted=[];
 const design=require('./react-design');
 // Unchanged UI kit files are listed by their API instead of their code.
 const kitFiles=Object.keys(files).filter(n=>design.isKitFile(n,files[n])).sort();
 const order=Object.keys(files).filter(n=>!kitFiles.includes(n)).sort((a,b)=>(a==='src/App.jsx'?-1:b==='src/App.jsx'?1:a.localeCompare(b)));
 for(const name of order){const block='--- '+name+' ---\n'+files[name]+'\n';if(used+block.length>budget){omitted.push(name);continue}used+=block.length;parts.push(block)}
 const kitNote=kitFiles.length?'\n--- UI kit (unchanged starter files; import them, e.g. import { Button } from \'./components/ui/button.jsx\') ---\n'+kitFiles.map(n=>n+': '+(design.KIT_API[n]||'')).join('\n')+'\n':'';
 return parts.join('\n')+kitNote+(omitted.length?'\n(Not shown to save space: '+omitted.join(', ')+'. Do not rewrite them unless needed.)\n':'');
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
 await applyMigrations(meta.id,files);
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
// Messages for the editor. Long reasoning is kept in full only on the last few messages.
function lightMessages(list){
 const recent=list.length-10;
 return list.map((m,i)=>{
  if(!m.timeline&&!m.thinking)return m;
  const keep=i>=recent?2000:0;
  return{...m,...(m.thinking?{thinking:keep?m.thinking.slice(0,keep):''}:{}),...(m.timeline?{timeline:m.timeline.map(e=>e.t==='think'&&e.text?{...e,text:keep?e.text.slice(0,keep):''}:e)}:{})};
 });
}
function detail(id){const m=loadMeta(id);return{...summary(m),versions:m.versions,messages:lightMessages(m.messages.slice(-100)),domains:m.domains,files:m.current_version?Object.keys(loadFiles(id,m.current_version)).sort():[]}}
function readFile(id,name){const m=loadMeta(id),files=loadFiles(id,m.current_version);if(!Object.hasOwn(files,name))throw Object.assign(Error('Unknown file'),{status:404});return files[name]}

// The owner's standing instructions for this project (brand, audience, rules), sent with every request.
// Also carries the design brief and the design skills switched on for the project.
function knowledgeNote(meta){const k=String(meta.knowledge||'').trim();return require('./react-mobile').promptNote(meta)+require('./react-design').designNote(meta.design)+require('./react-skills').promptNote(meta)+require('./react-checks').promptNote(meta)+require('./build-lessons').promptNote()+(k?'\n\nProject knowledge from the owner. Follow it unless the user asks otherwise:\n'+k:'')}
function userContent(text,images){
 if(!images||!images.length)return text;
 return[{type:'text',text},...images.map(img=>({type:'image_url',image_url:{url:'data:'+img.mime+';base64,'+img.data}}))];
}
function historyMessages(meta){return meta.messages.filter(m=>m.text).slice(-10).map(m=>({role:m.role==='user'?'user':'assistant',content:m.text}))}
function addMessages(id,entries){const fresh=loadMeta(id);fresh.messages.push(...entries.map(e=>({...e,at:new Date().toISOString()})));saveMeta(fresh);return fresh}

// mode "build" edits code; checkRuntime(url) opens the build and returns runtime errors.
async function edit(id,instruction,{callModel,onProgress=()=>{},onStream,onThinking,onEvent,signal,tier='standard',images=[],checkRuntime,assetNote='',imageGen=null,imageNote='',displayText,extra={},design=false,inspect=null}={}){
 let meta=loadMeta(id);
 const text=String(instruction||'').trim().slice(0,12000);
 if(!text)throw Object.assign(Error('Describe the change you want'),{status:400});
 if(!meta.current_version)await initialize(meta);
 const tl=require('./react-timeline').create(onEvent);
 const brief=await prepareDesign(id,text,{callModel,tier,signal,images,onProgress});
 if(brief)tl.add({t:'note',icon:'design',text:'Chose the design direction "'+brief.name+'" ('+brief.fonts.display+' / '+brief.fonts.body+')'});
 meta=loadMeta(id);
 let base=loadFiles(id,meta.current_version);
 if(brief)base={...base,'src/index.css':require('./react-design').applyToCss(base['src/index.css'],brief)};
 const request='Current project files:\n\n'+contextFiles(base)+(assetNote?'\n\n'+assetNote:'')+(imageNote?'\n\n'+imageNote:'')+'\n\nRequest: '+text;
 const imageCache=new Map();let imageNotes=[];
 const messages=[{role:'system',content:SYSTEM_PROMPT+knowledgeNote(meta)},...historyMessages(meta),{role:'user',content:userContent(request,images)}];
 let lastError='',runtimeErrors=[],checkResult=null,editFailures=0;
 // What the user sees afterwards: the plan, the model's reasoning and how long it thought.
 let thinking='',thoughtMs=null,firstPlan=null;
 for(let attempt=1;attempt<=MAX_ATTEMPTS;attempt++){
  signal?.throwIfAborted();
  onProgress(attempt===1?'writing':'fixing');
  const started=Date.now();let firstToken=null;
  const reply=await callModel({messages,temperature:0.2,maxOutputTokens:32000,signal,tier,...(design?{design:true}:{}),
   onToken:onStream?(_d,all)=>{if(firstToken===null)firstToken=Date.now();onStream(all,attempt)}:undefined,
   onReasoning:(_d,all)=>{if(attempt===1){thinking=all;if(onThinking)onThinking(all)}}},parseEdit);
  if(attempt===1){thoughtMs=(firstToken||Date.now())-started;firstPlan=reply.plan}
  tl.add({t:'think',ms:(firstToken||Date.now())-started,text:attempt===1?thinking:''});
  if(attempt===1&&reply.plan.length)tl.add({t:'plan',items:reply.plan});
  if(reply.images.length){onProgress('images');imageNotes=await materializeImages(id,reply,{imageGen,cache:imageCache,design:loadMeta(id).design});tl.add({t:'note',icon:'image',text:'Generated '+reply.images.length+' image'+(reply.images.length===1?'':'s')})}
  let next={...base};
  for(const name of reply.delete)if(name!=='src/main.jsx'&&name!=='src/App.jsx')delete next[name];
  for(const [name,code] of Object.entries(reply.files))next[name]=code;
  // Small changes arrive as find/replace edits (cheaper than rewriting whole files).
  const both=Object.keys(reply.edits).filter(f=>Object.hasOwn(reply.files,f));
  const applied=require('./react-edits').apply(next,reply.edits);next=applied.files;
  const errors=[...both.map(f=>f+' is in both "files" and "edits"; use one'),...applied.errors,...(applied.errors.length?[]:validateFiles(next))];
  messages.push({role:'assistant',content:JSON.stringify({message:reply.message,files:reply.files,edits:reply.edits,delete:reply.delete})});
  if(errors.length){
   lastError=errors.slice(0,12).join('\n');
   // Edits that failed once are retried; if they fail again, the model must send whole files.
   const editFailed=applied.errors.length>0;
   editFailures+=editFailed?1:0;
   const how=editFailed&&editFailures>=2?'Your find/replace edits failed twice, so do not use "edits" this time: send every file you change whole in "files".':'Fix the edits that failed (copy "find" exactly, character for character, from the current files above) or send those files whole in "files".';
   tl.add({t:'fix',text:editFailed?'Some edits did not match the files, retrying':'The change had problems, retrying',detail:lastError});
   messages.push({role:'user',content:'That change was rejected (nothing was applied):\n'+lastError+'\nReturn corrected JSON with all the changes again. '+how});continue;
  }
  tl.edits(base,next);
  onProgress('building');
  const n=Math.max(0,...meta.versions.map(v=>v.n),...loadMeta(id).versions.map(v=>v.n))+1,dir=versionDir(id,n);
  try{await build(next,path.join(dir,'dist'),{projectId:id})}
  catch(e){if(!e.build)throw e;fs.rmSync(dir,{recursive:true,force:true});lastError=e.message;tl.add({t:'build',ok:false,detail:lastError});tl.add({t:'fix',text:'Fixing the build error'});messages.push({role:'user',content:'The Vite build failed:\n'+lastError+'\nFix the error and return corrected JSON.'});continue}
  tl.add({t:'build',ok:true});
  try{await applyMigrations(id,next)}catch(e){fs.rmSync(dir,{recursive:true,force:true});lastError=e.message;messages.push({role:'user',content:'A SQL migration failed:\n'+lastError+'\nMigrations that already ran cannot change; fix new ones or add another migration, and return corrected JSON.'});continue}
  runtimeErrors=[];checkResult=null;
  if(checkRuntime||inspect){
   onProgress('testing');
   markTesting(id,n,next);
   try{
    if(checkRuntime){try{runtimeErrors=(await checkRuntime(previewUrl(meta,n))).errors||[]}catch(e){runtimeErrors=[]}}
    // Saved checks: flows that worked before must still work (run on a test copy of the data).
    if(!runtimeErrors.length&&inspect&&require('./react-checks').list(loadMeta(id)).length){onProgress('checking');try{checkResult=await require('./react-checks').run(id,previewUrl(meta,n),{inspect,version:n})}catch(e){checkResult=null}}
   }finally{clearTesting(id,n)}
   if(checkRuntime)tl.add({t:'test',ok:!runtimeErrors.length,detail:runtimeErrors});
   if(checkResult&&checkResult.ran)tl.add({t:'check',ok:!checkResult.failed.length,text:checkResult.failed.length?'Broke '+checkResult.failed.length+' of '+checkResult.ran+' saved checks':'All '+checkResult.ran+' saved check'+(checkResult.ran===1?'':'s')+' passed',detail:checkResult.failed.length?require('./react-checks').failureText(checkResult.failed):''});
   if(runtimeErrors.length&&attempt<MAX_ATTEMPTS){
    fs.rmSync(dir,{recursive:true,force:true});
    lastError=runtimeErrors.join('\n');
    tl.add({t:'fix',text:'Fixing the errors the browser showed'});
    messages.push({role:'user',content:'The app built, but opening it in a browser showed these problems:\n'+lastError+'\nFind the cause in the code and return corrected JSON.'+(attempt>=2?' Your previous fix did not solve it: do not try a small variation of it; find the real cause and take a different approach.':'')});
    continue;
   }
   if(checkResult&&checkResult.failed.length&&attempt<MAX_ATTEMPTS){
    fs.rmSync(dir,{recursive:true,force:true});
    lastError='Saved checks failed:\n'+require('./react-checks').failureText(checkResult.failed);
    tl.add({t:'fix',text:'Fixing the saved checks this change broke'});
    messages.push({role:'user',content:'The app built, but this change broke saved checks (flows that worked before the change):\n'+require('./react-checks').failureText(checkResult.failed)+'\nFix the cause so these flows work again, without removing what the user asked for, and return corrected JSON.'+(attempt>=2?' Your previous fix did not solve it: take a different approach rather than a small variation.':'')});
    continue;
   }
  }
  writeJson(path.join(dir,'files.json'),next);
  const prev=loadFiles(id,meta.current_version);
  const changed=Object.keys(next).filter(k=>prev[k]!==next[k]).concat(reply.delete.filter(k=>Object.hasOwn(base,k)&&!Object.hasOwn(next,k)));
  const fresh=loadMeta(id);
  const message=reply.message+(imageNotes.length?'\n\n'+imageNotes.join('\n'):'');
  const generated=[...imageCache.values()];
  const checks=checkResult&&checkResult.ran?{ran:checkResult.ran,passed:checkResult.passed,failed:checkResult.failed.map(f=>f.name)}:null;
  fresh.versions.push({n,at:new Date().toISOString(),summary:reply.message.slice(0,200),changed,tier,...extra,...(checks?{checks}:{}),...(runtimeErrors.length?{runtime_errors:runtimeErrors}:{})});
  fresh.current_version=n;
  const now=new Date().toISOString();
  fresh.messages.push({role:'user',text:displayText||text,at:now,...(images.length&&!extra.polish?{images:images.map(i=>i.name)}:{})},{role:'assistant',text:message,version:n,changed,at:now,...(firstPlan&&firstPlan.length?{plan:firstPlan}:{}),...(thoughtMs!==null?{thought_ms:thoughtMs}:{}),...(thinking?{thinking:thinking.slice(0,4000)}:{}),...(attempt>1?{attempts:attempt}:{}),timeline:tl.stored(),duration_ms:tl.elapsed(),...(brief?{design:{name:brief.name,palette:brief.palette,fonts:brief.fonts}}:{}),...(generated.length?{generated}:{}),...(extra.polish?{polish:true}:{}),...(checks?{checks}:{}),...(runtimeErrors.length?{runtime_errors:runtimeErrors}:{})});
  saveMeta(fresh);
  return{version:n,message,changed,attempts:attempt,plan:firstPlan||[],timeline:tl.stored(),duration_ms:tl.elapsed(),runtime_errors:runtimeErrors,...(checks?{checks,check_failures:checkResult.failed}:{}),preview_url:previewUrl(fresh),...(brief?{design:brief}:{}),...(generated.length?{generated}:{})};
 }
 throw Object.assign(Error('The change could not be built after '+MAX_ATTEMPTS+' attempts. Last problem: '+lastError.slice(0,600)),{status:422});
}

// The design review: screenshots of the current version (desktop and phone) go to the
// model, which fixes what looks off without changing behaviour. Saved as a new version.
const POLISH_REQUEST=`Design review. The attached screenshots show the current app: first a desktop browser 1280 px wide, then a phone 390 px wide (long pages are cut off at the bottom). Look at them like a senior product designer and improve the visual design without changing what the app does.
1. Find the 5 to 8 most visible problems, for example: weak hierarchy or a hero without a focal point, cramped or uneven spacing, misaligned elements, low contrast text, plain or empty-looking sections, missing or poor imagery, inconsistent buttons and cards, hard-coded colours that ignore the design tokens, a phone layout that is cramped, overflowing or not tappable, missing hover and focus states.
2. Fix them in the code: spacing, type scale, design tokens in src/index.css, imagery, section backgrounds, cards, hover and focus states, motion, the phone layout.
Keep every feature, page, route, text content, form, data call and server function working exactly as before, and do not remove sections. In "message", tell the user in one or two sentences what you improved.`;
async function polish(id,{shots,note='',...opts}){
 const meta=loadMeta(id);
 if(!meta.current_version)throw Object.assign(Error('Build the app first'),{status:400});
 (opts.onProgress||(()=>{}))('reviewing');
 const pictures=shots?await shots(previewUrl(meta)):[];
 if(!pictures.length)throw Object.assign(Error('Screenshots are not available on this server, so the design review cannot run.'),{status:503});
 const extraNote=String(note||'').trim().slice(0,1000);
 return edit(id,POLISH_REQUEST+(extraNote?'\nThe user also asked for: '+extraNote:''),{...opts,images:pictures.map(p=>({...p,name:p.name+'.jpg'})),displayText:'Polish the design'+(extraNote?': '+extraNote:''),extra:{polish:true},design:true});
}

const DISCUSS_PROMPT=`You are the planning partner inside an app builder like Lovable. The user is discussing their React + Tailwind app (with an optional built-in backend for sign-in and saved data). Do not write or change code.
Answer questions about the app, suggest improvements, and when the user wants a change, reply with a short numbered plan of what you would change and which files. Keep answers brief and concrete. Plain text, no JSON.`;
function parseText(content){if(typeof content==='string'){const t=content.trim();if(!t)throw Error('Empty answer');return t}return String(content?.message||content?.answer||JSON.stringify(content))}
async function discuss(id,question,{callModel,onStream,onThinking,signal,tier='standard',images=[],context=''}={}){
 const meta=loadMeta(id);
 const text=String(question||'').trim().slice(0,8000);
 if(!text)throw Object.assign(Error('Ask a question or describe an idea'),{status:400});
 const files=meta.current_version?loadFiles(id,meta.current_version):template(meta.name);
 const messages=[{role:'system',content:DISCUSS_PROMPT+knowledgeNote(meta)},...historyMessages(meta),{role:'user',content:userContent('Current project files:\n\n'+contextFiles(files,90000)+(context?'\n\n'+context:'')+'\n\nMessage: '+text,images)}];
 const answer=(await callModel({messages,temperature:0.4,maxOutputTokens:3000,signal,tier,onToken:onStream?(_d,all)=>onStream(all,1):undefined,onReasoning:onThinking?(_d,all)=>onThinking(all):undefined},parseText)).slice(0,12000);
 addMessages(id,[{role:'user',text,mode:'discuss'},{role:'assistant',text:answer,mode:'discuss'}]);
 return{message:answer};
}

// Validates, builds and saves source files as a new version without the AI.
// A version being tested before it is saved. The app backend serves its server functions
// and backend.json while it is tested, so new functions and collections work in the check.
const testingBuilds=new Map();
function markTesting(id,n,files){writeJson(path.join(versionDir(id,n),'files.json'),files);testingBuilds.set(id,n)}
function clearTesting(id,n){if(n===undefined||testingBuilds.get(id)===n)testingBuilds.delete(id)}
function testingVersion(id){return testingBuilds.get(id)}
// Applies new SQL migrations to the app database (sql/NNN_name.sql).
function applyMigrations(id,files){return require('./react-sql').run.migrate(projectDir(id),files)}
async function saveSource(id,files,{summary,changed=[],extra={},message}={}){
 const errors=validateFiles(files);
 if(errors.length)throw Object.assign(Error(errors.slice(0,5).join('\n')),{status:400});
 const meta=loadMeta(id),n=Math.max(0,...meta.versions.map(v=>v.n))+1,dir=versionDir(id,n);
 try{await build(files,path.join(dir,'dist'),{projectId:id})}
 catch(e){fs.rmSync(dir,{recursive:true,force:true});throw Object.assign(Error('That change does not build: '+String(e.message).slice(0,500)),{status:400})}
 try{await applyMigrations(id,files)}catch(e){fs.rmSync(dir,{recursive:true,force:true});throw Object.assign(Error(e.message),{status:400})}
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
function remove(id){const dir=projectDir(id);loadMeta(id);require('./react-sql').closeEverywhere(dir);fs.rmSync(dir,{recursive:true,force:true});return{deleted:id}}

// ---------- serving built files ----------
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.ico':'image/x-icon','.json':'application/json','.woff2':'font/woff2','.woff':'font/woff','.txt':'text/plain; charset=utf-8'};
// sandbox=true runs the page in an opaque origin so generated code cannot use the Kairoq session.
function contentPolicy(sandbox){return "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https:; img-src 'self' https: data: blob:; font-src 'self' https: data:; connect-src 'self' https:; media-src 'self' https: data: blob:; frame-ancestors 'self'; base-uri 'none'; form-action 'self'"+(sandbox?'; sandbox allow-scripts allow-forms allow-popups allow-modals':'')}
function serveDist(req,res,distDir,rest,{sandbox}){
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end()}
 let decoded;try{decoded=decodeURIComponent(String(rest||'').split('?')[0])}catch{res.writeHead(400,{'Content-Type':'text/plain; charset=utf-8'});res.end('Bad request');return true}
 let rel=decoded.replace(/^\/+/,'');
 if(!rel||rel.endsWith('/'))rel+='index.html';
 const file=path.resolve(distDir,rel);
 if(!file.startsWith(path.resolve(distDir)+path.sep)){res.writeHead(400);return res.end()}
 let target=file;
 if(!fs.existsSync(target)||!fs.statSync(target).isFile()){if(path.extname(rel))return notFound(res);target=path.join(distDir,'index.html')}
 if(!fs.existsSync(target))return notFound(res);
 const ext=path.extname(target).toLowerCase(),html=ext==='.html';
 const headers={'Content-Type':TYPES[ext]||'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Cache-Control':html?'no-cache':'public, max-age=31536000, immutable'};
 if(html)headers['Content-Security-Policy']=contentPolicy(sandbox);
 else{
  headers['Access-Control-Allow-Origin']='*';
  // Other files opened directly (an SVG, say) must not run script on Kairoq's origin either.
  if(sandbox)headers['Content-Security-Policy']="sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:";
 }
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

module.exports={polish,prepareDesign,materializeImages,imageRequests,contentPolicy,initializeFrom,applyMigrations,addMessages,markTesting,clearTesting,testingVersion,contextFiles,knowledgeNote,userContent,historyMessages,writeJson,runBuild,buildStats,INDEX_HTML,saveSource,create,initialize,list,detail,readFile,edit,discuss,visualEdit,inspectElement,restore,rename,remove,loadMeta,saveMeta,loadFiles,versionDir,projectDir,previewUrl,serveDist,handlePreview,validateFiles,parseEdit,template,build,ROOT,ALLOWED_PACKAGES,SYSTEM_PROMPT};

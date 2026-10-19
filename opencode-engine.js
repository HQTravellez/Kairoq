"use strict";
// OpenCode (opencode-ai 1.18.34, MIT, github.com/anomalyco/opencode) as Kairoq's build engine,
// on when KAIROQ_BUILD_ENGINE=opencode and the opencode program is installed (the Dockerfile
// installs it when KAIROQ_OPENCODE=on). Kairoq keeps everything around the code: the checks,
// the build, the browser test, repairs, rollback, versions and credits. Only the writing step
// changes: the project's files go to a folder of their own, OpenCode reads and edits them with
// its own tools (exact and forgiving find/replace, whole files, search), and Kairoq reads the
// result back. Repairs continue the same OpenCode session with the error.
// OpenCode never gets a shell, the web or anything outside that folder: bash, webfetch and
// external_directory are denied (it is not even offered those tools), its environment holds
// only the model key, and it runs with a time limit.
const fs=require('fs'),os=require('os'),path=require('path'),{spawn}=require('child_process');

const VERSION='1.18.34',TIMEOUT_MS=Number(process.env.KAIROQ_OPENCODE_TIMEOUT_MS||15*60000);
let hooks={enforceBudget:null,recordUsage:null};
// server.js passes its budget functions, so OpenCode's model calls count like any other build.
function configure(h){hooks={...hooks,...h}}
function binary(){
 const given=process.env.KAIROQ_OPENCODE_BIN;if(given)return fs.existsSync(given)?given:null;
 for(const dir of String(process.env.PATH||'').split(path.delimiter)){const f=path.join(dir,'opencode');try{fs.accessSync(f,fs.constants.X_OK);return f}catch{}}
 return null;
}
function enabled(){return String(process.env.KAIROQ_BUILD_ENGINE||'').toLowerCase()==='opencode'&&Boolean(binary())&&Boolean(model())}
// The model OpenCode uses: the builder's own provider (Experiential Labs or OpenRouter), both
// OpenAI-compatible. KAIROQ_OPENCODE_MODEL / _BASE_URL override it.
function model(){
 const exp=String(process.env.EXPLABS_API_KEY||process.env.EXPlabs_API_Key||'').trim();
 const useExp=exp&&String(process.env.KAIROQ_BUILDER_PROVIDER||'').toLowerCase()!=='openrouter';
 if(useExp)return{baseURL:process.env.KAIROQ_OPENCODE_BASE_URL||'https://api.experientiallabs.ai/v1',key:exp,id:process.env.KAIROQ_OPENCODE_MODEL||'gpt-6-luna',rates:[0.10,0.50]};
 if(process.env.OPENROUTER_API_KEY&&process.env.KAIROQ_BUILDER_PAID_APPROVED==='true')return{baseURL:process.env.KAIROQ_OPENCODE_BASE_URL||'https://openrouter.ai/api/v1',key:process.env.OPENROUTER_API_KEY,id:process.env.KAIROQ_OPENCODE_MODEL||process.env.KAIROQ_BUILDER_MODEL||'deepseek/deepseek-v3.2',rates:[0.5,1.5]};
 return null;
}
function config(m){
 return{$schema:'https://opencode.ai/config.json',model:'kairoq/'+m.id,small_model:'kairoq/'+m.id,autoupdate:false,share:'disabled',
  provider:{kairoq:{npm:'@ai-sdk/openai-compatible',name:'Kairoq',options:{baseURL:m.baseURL,apiKey:'{env:KAIROQ_OPENCODE_KEY}'},models:{[m.id]:{name:m.id,limit:{context:Number(process.env.KAIROQ_OPENCODE_CONTEXT||128000),output:Number(process.env.KAIROQ_OPENCODE_OUTPUT||32000)}}}}},
  permission:{bash:'deny',webfetch:'deny',external_directory:'deny',edit:'allow'}};
}
// OpenCode's own home (its plugin library is installed there once): on the data volume when
// there is one, so it survives deploys.
function home(){const d=path.join(path.dirname(require('./react-builder').ROOT()),'opencode-home');fs.mkdirSync(d,{recursive:true});return d}

// ---------- files ----------
const SKIP=new Set(['node_modules','.git','.opencode','dist']);
const RULES='AGENTS.md';
function readTree(dir){
 const out={};
 const walk=rel=>{for(const e of fs.readdirSync(path.join(dir,rel),{withFileTypes:true})){
  if(SKIP.has(e.name))continue;const r=rel?rel+'/'+e.name:e.name;
  if(e.isDirectory())walk(r);else if(e.isFile()&&r!==RULES){const st=fs.statSync(path.join(dir,r));if(st.size<=600000)out[r]=fs.readFileSync(path.join(dir,r),'utf8')}
 }};
 walk('');return out;
}
// The folder holds exactly these files (and the rules), whatever the last run left there.
function sync(dir,files){
 const now=readTree(dir);
 for(const f of Object.keys(now))if(!Object.hasOwn(files,f))fs.rmSync(path.join(dir,f),{force:true});
 for(const [f,c] of Object.entries(files)){if(typeof c!=='string'||now[f]===c)continue;const p=path.join(dir,f);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,c)}
}

// ---------- one build ----------
// A session for one Kairoq change: its folder and OpenCode session live until close().
function session({rules,onEvent=()=>{}}={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-oc-'));
 fs.writeFileSync(path.join(dir,RULES),rules||'');
 let sessionId=null;
 async function reply({files,prompt,signal}){
  const m=model();if(!m)throw Object.assign(Error('OpenCode has no model: set EXPLABS_API_KEY, or OPENROUTER_API_KEY with KAIROQ_BUILDER_PAID_APPROVED=true.'),{status:503});
  const bin=binary();if(!bin)throw Object.assign(Error('OpenCode is not installed on this server.'),{status:503});
  if(hooks.enforceBudget){const totals=await hooks.enforceBudget();const daily=Number(process.env.DAILY_COST_LIMIT_USD||2),monthly=Number(process.env.MONTHLY_COST_LIMIT_USD||30),reserve=Number(process.env.KAIROQ_OPENCODE_RESERVE_USD||0.25);if((daily>0&&totals.daily+reserve>daily)||(monthly>0&&totals.monthly+reserve>monthly))throw Error('Builder budget insufficient')}
  sync(dir,files);
  const h=home();
  const env={PATH:process.env.PATH||'/usr/local/bin:/usr/bin:/bin',HOME:h,XDG_CONFIG_HOME:path.join(h,'config'),XDG_DATA_HOME:path.join(h,'data'),XDG_CACHE_HOME:path.join(h,'cache'),XDG_STATE_HOME:path.join(h,'state'),
   KAIROQ_OPENCODE_KEY:m.key,OPENCODE_CONFIG_CONTENT:JSON.stringify(config(m)),
   OPENCODE_DISABLE_AUTOUPDATE:'1',OPENCODE_DISABLE_MODELS_FETCH:'1',OPENCODE_DISABLE_LSP_DOWNLOAD:'1',OPENCODE_DISABLE_DEFAULT_PLUGINS:'1',OPENCODE_DISABLE_CLAUDE_CODE:'1',OPENCODE_DISABLE_EXTERNAL_SKILLS:'1',OPENCODE_DISABLE_SHARE:'1',OPENCODE_DISABLE_PROJECT_CONFIG:'1'};
  for(const k of ['HTTPS_PROXY','HTTP_PROXY','NO_PROXY','https_proxy','http_proxy','no_proxy','SSL_CERT_FILE','NODE_EXTRA_CA_CERTS'])if(process.env[k])env[k]=process.env[k];
  const args=['run','--format','json','--dir',dir,'-m','kairoq/'+m.id,...(sessionId?['--session',sessionId]:[]),prompt];
  const child=spawn(bin,args,{cwd:dir,env,stdio:['ignore','pipe','pipe']});
  let buf='',text='',err='',tokens={input:0,output:0},cost=0;
  const line=l=>{
   let e;try{e=JSON.parse(l)}catch{return}
   if(e.sessionID&&!sessionId)sessionId=e.sessionID;
   const p=e.part||{};
   if(e.type==='text'&&p.text)text=p.text;
   if(e.type==='tool_use'&&p.tool){const input=p.state&&p.state.input||{};onEvent({t:'tool',tool:p.tool,file:input.filePath?path.relative(dir,String(input.filePath)):undefined,ok:!p.state||p.state.status!=='error'})}
   if(e.type==='step_finish'){const t=p.tokens||{};tokens.input+=Number(t.input||0)+Number(t.cache&&t.cache.read||0);tokens.output+=Number(t.output||0)+Number(t.reasoning||0);cost+=Number(p.cost||0)}
   if(e.type==='error')err=String(e.error&&(e.error.data&&e.error.data.message||e.error.message)||JSON.stringify(e.error||e)).slice(0,500);
  };
  child.stdout.on('data',d=>{buf+=d;let i;while((i=buf.indexOf('\n'))>=0){line(buf.slice(0,i));buf=buf.slice(i+1)}});
  let stderr='';child.stderr.on('data',d=>{stderr=(stderr+d).slice(-4000)});
  const stop=()=>{try{child.kill('SIGKILL')}catch{}};
  signal?.addEventListener('abort',stop,{once:true});
  const timer=setTimeout(stop,TIMEOUT_MS);
  const code=await new Promise(r=>child.on('close',r));
  clearTimeout(timer);signal?.removeEventListener('abort',stop);
  if(buf)line(buf);
  const spent=cost||(tokens.input*m.rates[0]+tokens.output*m.rates[1])/1e6;
  if(hooks.recordUsage&&(tokens.input||tokens.output))await hooks.recordUsage({provider:'opencode',model:m.id,purpose:'developer-build',input_tokens:tokens.input,output_tokens:tokens.output,cost:spent}).catch(()=>{});
  signal?.throwIfAborted();
  if(code!==0&&!text)throw Error('OpenCode stopped'+(err?': '+err:code===null?' (time limit)':' with code '+code)+(stderr&&!err?': '+stderr.trim().split('\n').slice(-2).join(' ').slice(0,300):''));
  if(err&&!text)throw Error('OpenCode: '+err);
  // What changed in the folder is the reply, in the shape Kairoq's builder expects.
  const after=readTree(dir),changed={};
  for(const [f,c] of Object.entries(after))if(files[f]!==c)changed[f]=c;
  const removed=Object.keys(files).filter(f=>!Object.hasOwn(after,f));
  return{message:String(text||'Done.').trim().slice(0,2000),files:changed,edits:{},delete:removed,plan:[],images:[],checks:[],usage:{...tokens,cost:spent}};
 }
 function close(){try{fs.rmSync(dir,{recursive:true,force:true})}catch{}}
 return{reply,close,get dir(){return dir}};
}
// The builder's rules for OpenCode: the same rules Kairoq's own model gets, without the JSON
// reply format, and how to work in the folder instead.
function rules(systemPrompt,note=''){
 const cut=systemPrompt.indexOf('Respond with ONLY a JSON object');
 return['# Kairoq app rules','','You work in a React 18 + Vite + Tailwind CSS 3 project. Edit the files in this folder with your file tools (read, edit, write, glob, grep). There is no shell: you cannot run commands, install packages or start the app; Kairoq builds the app, opens it in a browser and tells you about any error.','When you are done, reply in one or two plain sentences for the app owner saying what you changed.','',cut>0?systemPrompt.slice(0,cut).trim():systemPrompt,note?'\n'+note.trim():''].join('\n');
}
module.exports={enabled,configure,binary,model,session,rules,sync,readTree,VERSION};

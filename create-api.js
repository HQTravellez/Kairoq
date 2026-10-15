"use strict";
// HTTP API for the chat builder (/create). Owners (the Kairoq admin login) build
// without credits; customer accounts spend one credit per successful edit.
const crypto=require('crypto'),fs=require('fs'),path=require('path');
const builder=require('./react-builder'),hosting=require('./react-hosting'),accounts=require('./builder-accounts'),backend=require('./react-backend');

const jobs=new Map();
const attempts=new Map();
function send(res,status,data,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(JSON.stringify(data))}
function readJson(req,limit=200000){
 return new Promise((resolve,reject)=>{let body='';req.on('data',c=>{body+=c;if(body.length>limit){reject(Object.assign(Error('Request too large'),{status:413}));req.destroy()}});req.on('end',()=>{try{resolve(body?JSON.parse(body):{})}catch{reject(Object.assign(Error('Invalid JSON'),{status:400}))}});req.on('error',reject)});
}
async function readRaw(req,limit=65536){const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>limit)throw Object.assign(Error('Request too large'),{status:413});chunks.push(c)}return Buffer.concat(chunks)}
function limited(req,bucket,max=20,windowMs=600000){
 if(attempts.size>5000)for(const k of [...attempts.keys()].slice(0,1000))attempts.delete(k);
 const key=bucket+':'+require('./client-ip').clientIp(req),now=Date.now();
 const list=(attempts.get(key)||[]).filter(t=>now-t<windowMs);list.push(now);attempts.set(key,list);
 if(list.length>max)throw Object.assign(Error('Too many attempts. Try again in a few minutes.'),{status:429});
}
function origin(req){
 const configured=process.env.KAIROQ_PUBLIC_URL||(process.env.RAILWAY_PUBLIC_DOMAIN?'https://'+process.env.RAILWAY_PUBLIC_DOMAIN:'');
 if(configured)return configured.replace(/\/$/,'');
 // Links in emails, OAuth and Stripe must not come from a forged Host header.
 const host=String(req.headers.host||'localhost');
 if(!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host))throw Object.assign(Error('Set KAIROQ_PUBLIC_URL to the public address of this server first.'),{status:409});
 return'http://'+host;
}
// Cookie-authenticated changes must come from the editor itself, not another site.
function sameOrigin(req){
 const site=req.headers['sec-fetch-site'];
 if(site&&site!=='same-origin'&&site!=='none')return false;
 const o=req.headers.origin;
 if(o===undefined)return true;
 let h;try{h=new URL(o).host}catch{return false}
 const configured=process.env.KAIROQ_PUBLIC_URL||(process.env.RAILWAY_PUBLIC_DOMAIN?'https://'+process.env.RAILWAY_PUBLIC_DOMAIN:'');
 let pub='';try{pub=configured?new URL(configured).host:''}catch{}
 return h===String(req.headers.host||'')||h===pub;
}
// Invited members must prove they own the email (when email or Google sign-in is set up).
function verifiedMember(account){return Boolean(account&&(account.email_verified||!(accounts.mailReady()||require('./google-oauth').configured())))}

// Who is calling: a customer account, the Kairoq owner, or nobody.
function viewer(req,isOwner){
 const account=accounts.fromRequest(req);
 if(account)return{kind:'customer',owner:account.id,account};
 if(isOwner(req))return{kind:'owner',owner:'owner',account:null};
 return null;
}
function requireViewer(req,isOwner){const v=viewer(req,isOwner);if(!v)throw Object.assign(Error('Sign in to continue'),{status:401});return v}
// Roles on a project: the owner, or collaborators invited by email as editor or viewer.
const RANK={viewer:1,editor:2,owner:3};
function roleFor(v,meta){
 if(meta.owner===v.owner)return'owner';
 if(v.kind==='customer'&&verifiedMember(v.account)){const m=(meta.members||[]).find(x=>x.email===v.account.email);if(m)return m.role}
 return null;
}
function ownedProject(v,id,need='owner'){
 let meta;try{meta=builder.loadMeta(id)}catch{throw Object.assign(Error('Unknown project'),{status:404})}
 const role=roleFor(v,meta);
 if(!role)throw Object.assign(Error('Unknown project'),{status:404});
 if(RANK[role]<RANK[need])throw Object.assign(Error(need==='owner'?'Only the project owner can do that':'You have view-only access to this project'),{status:403});
 return{meta,role};
}
const NEED={'GET:':'viewer','PATCH:':'editor','DELETE:':'owner','GET:/data':'viewer','GET:/records':'viewer','DELETE:/records':'editor',
 'POST:/chat':'editor','GET:/assets':'viewer','POST:/assets':'editor','DELETE:/assets':'editor','GET:/asset':'viewer',
 'GET:/settings':'owner','POST:/settings':'owner','GET:/download':'editor','GET:/github':'owner','POST:/push':'owner','POST:/pull':'owner',
 'POST:/inspect':'viewer','POST:/visual':'editor','POST:/fix':'editor','GET:/file':'viewer','POST:/restore':'editor',
 'POST:/publish':'editor','POST:/unpublish':'owner','POST:/domains':'owner','POST:/verify':'owner','DELETE:/domains':'owner',
 'GET:/mobile':'viewer','POST:/mobile':'editor','GET:/qr':'viewer','GET:/appicon':'viewer','GET:/figma':'editor','POST:/figma':'editor','GET:/security':'viewer','GET:/sql':'viewer','POST:/sql':'owner','GET:/logs':'viewer','POST:/knowledge':'editor','GET:/secrets':'owner','POST:/secrets':'owner','GET:/members':'owner','POST:/members':'owner','DELETE:/members':'owner','POST:/share':'owner','GET:/analytics':'viewer','POST:/seo':'editor','GET:/design':'viewer','POST:/design':'editor','POST:/images':'editor','GET:/checks':'viewer','POST:/checks':'editor','DELETE:/checks':'editor','GET:/reference':'viewer','POST:/reference':'editor','GET:/refshot':'viewer','GET:/changes':'viewer'};
function listFor(v){
 return builder.list().filter(p=>{if(p.owner===v.owner)return true;if(v.kind!=='customer'||!verifiedMember(v.account))return false;try{return(builder.loadMeta(p.id).members||[]).some(m=>m.email===v.account.email)}catch{return false}})
  .map(p=>({...p,role:p.owner===v.owner?'owner':(builder.loadMeta(p.id).members||[]).find(m=>m.email===v.account.email).role}));
}
function findShare(token){
 if(!/^[a-f0-9]{24}$/.test(String(token)))return null;
 for(const p of builder.list()){const meta=builder.loadMeta(p.id);if(meta.share&&meta.share.token===token)return meta}
 return null;
}
function projectViewFor(id,role='owner'){const d=builder.detail(id),meta=builder.loadMeta(id);return{...d,role,mobile:require('./react-mobile').settings(meta),members:role==='owner'?meta.members||[]:undefined,share:role==='owner'&&meta.share?{...meta.share,url:'/create/share/'+meta.share.token}:null,seo:meta.seo||null,knowledge:meta.knowledge||'',design:meta.design||null,skills:meta.skills||[],urls:hosting.siteUrls(meta),domains:(meta.domains||[]).map(x=>({...x,dns:hosting.dnsInstructions(x.hostname,x.token,x),https:x.railway?(x.railway.certificate||'pending'):(require('./react-railway').configured()?null:'manual')}))}}

const ACTIVE=new Set(['queued','writing','fixing','building','testing','thinking','working','designing','images','reviewing','checking','analyzing','planning','assets','verifying','repairing','comparing','publishing']);
function intEnv(name,fallback){const raw=process.env[name];if(raw===undefined||String(raw).trim()==='')return fallback;const n=Number(raw);return Number.isInteger(n)&&n>=0?n:fallback}
function tiers(){
 const paid=process.env.KAIROQ_BUILDER_PAID_APPROVED==='true',max=Boolean(String(process.env.KAIROQ_MAX_MODELS||'').trim());
 return[
  {id:'standard',label:'Standard',credits:intEnv('KAIROQ_STANDARD_CREDITS',1),enabled:true},
  {id:'pro',label:'Pro',credits:intEnv('KAIROQ_PRO_CREDITS',5),enabled:paid},
  {id:'max',label:'Max',credits:intEnv('KAIROQ_MAX_CREDITS',15),enabled:paid}
 ].filter(t=>t.id!=='max'||max);
}
// The design review costs at least KAIROQ_POLISH_CREDITS (default 5 when a design model such
// as Fable does the review, else 1), so a Standard review by Fable is not sold at a loss.
function polishCredits(){return intEnv('KAIROQ_POLISH_CREDITS',process.env.KAIROQ_DESIGN_MODELS?5:1)}
function generatedImageCredits(){return intEnv('KAIROQ_GENERATED_IMAGE_CREDITS',2)}
// Agent tasks take many model calls, so they cost a multiple of the tier's price.
function agentMultiplier(){const n=intEnv('KAIROQ_AGENT_MULTIPLIER',3);return n>=1?n:3}
// Every mode checks the tier; Discuss on Pro or Max costs that tier's price.
function cost({mode,tier,images}){
 const t=tiers().find(x=>x.id===tier);
 if(!t||!t.enabled)throw Object.assign(Error('That model tier is not available'),{status:400});
 const image=images?intEnv('KAIROQ_IMAGE_CREDITS',1):0;
 if(mode==='discuss')return(tier==='standard'?intEnv('KAIROQ_DISCUSS_CREDITS',1):Math.max(t.credits,intEnv('KAIROQ_DISCUSS_CREDITS',1)))+image;
 if(mode==='polish')return Math.max(t.credits,polishCredits())+image;
 return t.credits*(mode==='agent'?agentMultiplier():1)+image;
}
const IMAGE_TYPES={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif'};
function parseImages(list){
 if(list===undefined)return[];
 if(!Array.isArray(list)||list.length>4)throw Object.assign(Error('Attach up to 4 images'),{status:400});
 return list.map((img,i)=>{
  const m=/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(String(img&&img.dataUrl||''));
  if(!m)throw Object.assign(Error('Images must be PNG, JPEG, WebP or GIF'),{status:400});
  if(m[2].length*3/4>3*1024*1024)throw Object.assign(Error('Each image must be 3 MB or smaller'),{status:413});
  const name=String(img.name||'image-'+(i+1)).toLowerCase().replace(/\.[a-z0-9]+$/,'').replace(/[^a-z0-9-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)||'image-'+(i+1);
  return{name:name+'.'+IMAGE_TYPES[m[1]],mime:m[1],data:m[2]};
 });
}
// Summarizes the model's partial output for live display in the editor.
function streamSnapshot(text,mode){
 if(mode==='discuss')return{text:text.slice(-6000)};
 const matches=[...text.matchAll(/"(src\/[^"\\]+\.(?:jsx|js|tsx|ts|css|json))"\s*:\s*"/g)];
 // Files changed by find/replace edits ("src/x.jsx":[{"find":…) are listed too.
 const edited=[...text.matchAll(/"(src\/[^"\\]+\.(?:jsx|js|tsx|ts|css|json))"\s*:\s*\[/g)].map(m=>m[1]);
 const files=[...new Set([...matches.map(m=>m[1]),...edited])];
 const msg=/"message"\s*:\s*"((?:[^"\\]|\\.)*)/.exec(text);
 const last=matches.at(-1);
 // Only the code of the file being written, not the surrounding JSON.
 const code=last?text.slice(last.index+last[0].length).split(/(?<!\\)",\s*"(?:src\/|delete)/)[0].replace(/"\s*}\s*}?\s*$/,''):'';
 // The plan the model writes first ("plan":["…","…"]), item by item as it streams.
 const planBlock=/"plan"\s*:\s*\[((?:[^\]"]|"(?:[^"\\]|\\.)*"?)*)/.exec(text);
 const plan=planBlock?[...planBlock[1].matchAll(/"((?:[^"\\]|\\.)*)("?)/g)].filter(m=>m[1].trim()).map(m=>m[1].replace(/\\"/g,'"').slice(0,140)).slice(0,6):[];
 return{chars:text.length,files,current:last?last[1]:null,plan,message:msg?msg[1].replace(/\\n/g,'\n').replace(/\\"/g,'"'):'',tail:code.slice(-1600)};
}
// hooks (build from a reference): before() runs first and returns extra context for the model;
// after(result) runs after the agent and returns the final result.
function startJob(v,id,{message,mode='build',tier='standard',images=[],context='',referenceOnly=false,extraCredits=0,label='',hooks=null},{callModel,checkRuntime,inspect,webSearch,designShots,generateImage}){
 for(const job of jobs.values())if(job.projectId===id&&ACTIVE.has(job.status))throw Object.assign(Error('This project is already being updated'),{status:409});
 if(!['build','discuss','agent','polish'].includes(mode))throw Object.assign(Error('Unknown mode'),{status:400});
 if(mode==='polish'&&!designShots)throw Object.assign(Error('The design review needs screenshots, which are not available on this server.'),{status:503});
 const credits=cost({mode,tier,images:images.length>0})+extraCredits;
 const job={id:crypto.randomUUID(),projectId:id,owner:v.owner,mode,tier,credits,status:'queued',seq:0,created_at:new Date().toISOString()};
 const update=patch=>{Object.assign(job,patch);job.seq++};
 // Customers pay up front, before anything is saved; credits are refunded if the job fails.
 if(v.kind==='customer'&&credits>0)accounts.charge(v.account.id,credits,label?label+(tier!=='standard'?' ('+tier[0].toUpperCase()+tier.slice(1)+')':''):mode==='discuss'?'Discuss message':(mode==='agent'?'Agent task':mode==='polish'?'Design review':'Chat edit')+(tier!=='standard'?' ('+tier[0].toUpperCase()+tier.slice(1)+')':''),'job:'+job.id);
 if(mode!=='discuss'&&mode!=='polish'&&images.length&&!referenceOnly){
  try{const names=require('./react-assets').save(id,images);images=images.map((img,i)=>({...img,name:names[i]}))}
  catch(e){if(v.kind==='customer'&&credits>0)try{accounts.grant(v.account.id,credits,'Refund: images not saved','refund:'+job.id)}catch{}throw e}
 }
 const controller=new AbortController();controllers.set(job.id,controller);
 jobs.set(job.id,job);
 // Generated images cost credits each; a failed generation is refunded.
 const imgCredits=generatedImageCredits();
 const imageGen=generateImage&&mode!=='discuss'?async img=>{
  const meta=builder.loadMeta(id),style=meta.design&&meta.design.imagery?'\nVisual style of the app: '+meta.design.imagery:'';
  const ref='img:'+job.id+':'+img.name;
  if(v.kind==='customer'&&imgCredits>0)accounts.charge(v.account.id,imgCredits,'Generated image','charge-'+ref);
  try{const picture=await generateImage({prompt:img.prompt+style,aspect:img.aspect,signal:controller.signal});job.images_generated=(job.images_generated||0)+1;return picture}
  catch(e){if(v.kind==='customer'&&imgCredits>0)try{accounts.grant(v.account.id,imgCredits,'Refund: image not generated','refund-'+ref)}catch{}throw e}
 }:null;
 const imageNote=imageGen?'Image generation is available for this message: add "images" to your reply for the few key visuals the app needs (hero, main photos; at most 4'+(v.kind==='customer'&&imgCredits?', '+imgCredits+' credits each':'')+'). Do not generate images that already exist in the uploads.':'';
 // Checks that pass before this change: only breaking one of these makes the change free.
 let passingBefore=new Set();try{passingBefore=new Set(require('./react-checks').list(builder.loadMeta(id)).filter(c=>c.last&&c.last.ok).map(c=>c.id))}catch{}
 setImmediate(async()=>{
  const modelTier=(images.length||mode==='polish')&&tier==='standard'?'vision':tier;
  const onStream=text=>update({stream:streamSnapshot(text,mode)});
  // The model's reasoning, shown live as "Thoughts" (only models that share it).
  const onThinking=text=>update({thinking:String(text).slice(-1800)});
  // The timeline (thoughts, files read and edited, builds, tests, fixes), streamed to the editor.
  const onEvent=events=>update({events:events.slice(-80)});
  try{
   const signal=controller.signal;
   if(mode==='discuss'){update({status:'thinking'});job.result=await builder.discuss(id,message,{callModel,onStream,onThinking,onEvent,tier:modelTier,images,signal})}
   else if(mode==='polish'){job.result=await builder.polish(id,{shots:designShots,note:message,callModel,onStream,onThinking,onEvent,tier:modelTier,checkRuntime,inspect,signal,imageGen,imageNote,onProgress:s=>update({status:s,stream:null})})}
   else if(mode==='agent'){
    let extra='';
    if(hooks&&hooks.before){update({status:'assets'});extra=await hooks.before({signal})||''}
    const assetNote=[images.length||context||extra?require('./react-assets').note(id):'',context,extra].filter(Boolean).join('\n\n');
    job.result=await require('./react-agent').run(id,message,{callModel,onThinking,onEvent,inspect,webSearch,fetchUrl:url=>require('./react-functions').guardedFetch({url}),tier:modelTier,images,assetNote,signal,imageGen,imageNote,
     onStep:p=>update({status:p.status,stream:null,agent:{step:p.step||job.agent?.step||0,steps:p.steps.map(s=>({n:s.n,thought:s.thought,actions:s.actions}))}})});
    if(hooks&&hooks.after)job.result=await hooks.after(job.result,{update,signal,onStream,imageGen,imageNote});
   }
   else{
    const assetNote=[images.length||context?require('./react-assets').note(id):'',context].filter(Boolean).join('\n\n');
    job.result=await builder.edit(id,message,{callModel,onStream,onThinking,onEvent,tier:modelTier,images,checkRuntime,inspect,assetNote,signal,imageGen,imageNote,onProgress:s=>update({status:s,stream:null})});
    // The first build of a new project on Pro or Max gets a free design review.
    if(mode==='build'&&job.result.design&&(tier==='pro'||tier==='max')&&designShots&&process.env.KAIROQ_AUTO_POLISH!=='off'){
     const first=job.result;
     try{job.result={...await builder.polish(id,{shots:designShots,callModel,onStream,onThinking,onEvent,tier,checkRuntime,inspect,signal,imageGen,imageNote,onProgress:s=>update({status:s,stream:null})}),first_version:first.version,polished:true,design:first.design}}
     catch(e){job.result={...first,polish_error:signal.aborted?'Stopped before the design review.':'The design review did not finish: '+String(e.message||e).slice(0,300)}}
    }
   }
   // An agent task that changed nothing is not charged.
   if(mode==='agent'&&job.result&&job.result.unchanged&&v.kind==='customer'&&credits>0){try{accounts.grant(v.account.id,credits,'Refund: agent made no changes','refund:'+job.id)}catch{}job.refunded=true}
   // You only pay for working changes: a change that breaks a check that passed before it, or
   // shows errors in the browser after the automatic fixes, is free. Checks that never passed
   // (for example one saved with force) do not count, so they cannot make every change free.
   const brokeChecks=(job.result&&job.result.check_failures||[]).filter(f=>passingBefore.has(f.id));
   const broken=mode!=='discuss'&&job.result&&!job.result.unchanged&&(brokeChecks.length||(job.result.runtime_errors||[]).length);
   if(broken&&!job.refunded){job.refund_reason=brokeChecks.length?'checks':'errors';if(v.kind==='customer'&&credits>0){try{accounts.grant(v.account.id,credits,'Refund: the change still has problems','refund:'+job.id)}catch{}job.refunded=true}}
   // The finished message shows what it cost (0 when refunded).
   try{const meta=builder.loadMeta(id),m=meta.messages.at(-1);if(m&&m.role==='assistant'&&!m.credits){m.credits=job.refunded?0:credits;builder.saveMeta(meta)}}catch{}
   update({status:'complete'});
  }catch(e){
   update({status:'failed',error:controller.signal.aborted?'Stopped.':String(e.message||e).slice(0,1200)});
   if(v.kind==='customer'&&credits>0)try{accounts.grant(v.account.id,credits,'Refund for failed '+(mode==='discuss'?'message':'edit'),'refund:'+job.id)}catch{}
  }
  controllers.delete(job.id);
  job.finished_at=new Date().toISOString();
  setTimeout(()=>jobs.delete(job.id),3600000).unref?.();
 });
 return job;
}
const controllers=new Map();
// Build from a reference: the build costs an agent task plus the browser tests, repairs and
// design comparison that follow (KAIROQ_REFERENCE_CREDITS, default twice the tier price plus a design review).
function referenceExtra(tier){const t=tiers().find(x=>x.id===tier);return intEnv('KAIROQ_REFERENCE_CREDITS',(t?t.credits:1)*2+polishCredits())}
function referencePrices(){return tiers().filter(t=>t.enabled).map(t=>({tier:t.id,analyze:cost({mode:'discuss',tier:t.id,images:true}),build:cost({mode:'agent',tier:t.id,images:true})+referenceExtra(t.id)}))}
// Analyzes a reference (website, GitHub repository, uploaded app or screenshots) and writes
// the build plan, as a job the editor follows like any other.
function startAnalysis(v,id,{source,images=[],note='',tier='standard'},{callModel,fetchImpl=fetch,token}){
 for(const job of jobs.values())if(job.projectId===id&&ACTIVE.has(job.status))throw Object.assign(Error('This project is already being updated'),{status:409});
 const credits=cost({mode:'discuss',tier,images:true});
 const job={id:crypto.randomUUID(),projectId:id,owner:v.owner,mode:'analyze',tier,credits,status:'queued',seq:0,created_at:new Date().toISOString()};
 const update=patch=>{Object.assign(job,patch);job.seq++};
 if(v.kind==='customer'&&credits>0)accounts.charge(v.account.id,credits,'Reference analysis'+(tier!=='standard'?' ('+tier[0].toUpperCase()+tier.slice(1)+')':''),'job:'+job.id);
 const controller=new AbortController();controllers.set(job.id,controller);jobs.set(job.id,job);
 setImmediate(async()=>{
  const ref=require('./react-reference'),run=require('./react-reference-run'),signal=controller.signal;
  try{
   update({status:'analyzing'});
   let analysis;
   if(source.type==='url'){
    // With REA installed, the browser session is also recorded (HAR) and analyzed by REA.
    const har=ref.reaAvailable()?path.join(require('os').tmpdir(),'kairoq-'+job.id+'.har'):null;
    try{analysis=await ref.crawlSite(source.value,{fetchImpl,har});if(har){const r=await ref.reaNetwork(har);if(r)analysis.rea_network=r}}
    finally{if(har)fs.rmSync(har,{force:true})}
   }else if(source.type==='repo')analysis=await ref.analyzeRepo(source.value,{fetchImpl,token});
   else if(source.type==='app')analysis=await ref.analyzeApp(source.zip,{name:source.value});
   else analysis={kind:'screenshots',count:images.length,analyzed_at:new Date().toISOString()};
   if(signal.aborted)throw Error('Stopped.');
   const crawled=analysis.screenshots||[];
   const uploads=images.map((img,i)=>({name:'reference-upload-'+(i+1)+(i===0&&!crawled.length?'-desktop':''),mime:img.mime,data:img.data}));
   update({status:'planning'});
   const plan=await ref.createPlan(analysis,{callModel,tier,images:[...uploads,...crawled].slice(0,4),note,signal});
   const names=run.saveShots(id,[...crawled,...uploads]);
   run.save(id,{source:{type:source.type,value:String(source.value||'').slice(0,300)},analysis,plan,shots:names});
   job.result={reference:run.view(builder.loadMeta(id))};
   update({status:'complete'});
  }catch(e){
   update({status:'failed',error:signal.aborted?'Stopped.':String(e.message||e).slice(0,1200)});
   if(v.kind==='customer'&&credits>0)try{accounts.grant(v.account.id,credits,'Refund for failed reference analysis','refund:'+job.id)}catch{}
  }
  controllers.delete(job.id);job.finished_at=new Date().toISOString();
  setTimeout(()=>jobs.delete(job.id),3600000).unref?.();
 });
 return job;
}
// The person who started a job, or anyone with at least `need` access to its project.
function canSeeJob(v,job,need){if(job.owner===v.owner)return true;try{const r=roleFor(v,builder.loadMeta(job.projectId));return Boolean(r)&&RANK[r]>=RANK[need]}catch{return false}}
function publicJob(job){const {owner,...rest}=job;return rest}
function streamJob(req,res,job){
 res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store','Connection':'keep-alive','X-Accel-Buffering':'no'});
 let last=-1;
 const tick=()=>{
  if(job.seq!==last){last=job.seq;res.write('data: '+JSON.stringify(publicJob(job))+'\n\n')}
  if(job.status==='complete'||job.status==='failed'){clearInterval(timer);res.end()}
 };
 const timer=setInterval(tick,200);
 const ping=setInterval(()=>res.write(': ping\n\n'),15000);
 req.on('close',()=>{clearInterval(timer);clearInterval(ping)});
 res.on('finish',()=>clearInterval(ping));
 tick();
}

async function handle(req,res,{isOwner,callModel,secure,checkRuntime,screenshot,inspect,webSearch,figmaFetch,designShots,generateImage,usageRows,referenceFetch}){
 const deps={callModel,checkRuntime,inspect,webSearch,designShots,generateImage};
 const url=String(req.url||'').split('?')[0];
 if(!url.startsWith('/api/create/'))return false;
 const route=url.slice('/api/create'.length),method=req.method;
 try{
  if(!['GET','HEAD','OPTIONS'].includes(method)&&!sameOrigin(req))throw Object.assign(Error('Cross-site request blocked'),{status:403});
  // ----- accounts -----
  if(route==='/me'&&method==='GET'){
   const v=viewer(req,isOwner);
   return send(res,200,{viewer:v?{kind:v.kind,account:v.account}:null,signups:process.env.KAIROQ_BUILDER_SIGNUPS!=='closed',packs:accounts.packs().map(({price,...p})=>p),plans:accounts.plans().map(({price,...p})=>p),purchases:accounts.stripeConfigured(),subscriptions:accounts.stripeReady()&&accounts.plans().length>0,free_credits:accounts.freeCredits(),google:require('./google-oauth').configured(),email_ready:accounts.mailReady(),tiers:tiers().map(({id,label,credits,enabled})=>({id,label,credits,enabled})),discuss_credits:intEnv('KAIROQ_DISCUSS_CREDITS',1),agent_multiplier:agentMultiplier(),image_credits:intEnv('KAIROQ_IMAGE_CREDITS',1),image_generation:{enabled:Boolean(generateImage),credits:generatedImageCredits()},design_review:Boolean(designShots),polish_credits:polishCredits()}),true;
  }
  if(route==='/auth/google'&&method==='GET'){
   const google=require('./google-oauth'),url=google.startUrl({kind:'kairoq'},origin(req));
   res.writeHead(302,{Location:url,'Set-Cookie':google.stateCookie(url,secure),'Cache-Control':'no-store'});res.end();return true;
  }
  if(route==='/auth/google/callback'&&method==='GET'){
   const google=require('./google-oauth'),q=Object.fromEntries(new URL(req.url,'http://x').searchParams);
   try{
    const {entry,profile}=await google.finish(q,origin(req),{browserState:google.readStateCookie(req)});
    if(entry.kind==='app'){
     const session=require('./react-backend').googleAppSignIn(entry.appId,profile);
     const back=new URL(entry.returnUrl);back.hash='kairoq_code='+google.issueAppCode(entry.appId,session);
     res.writeHead(302,{Location:back.toString(),'Cache-Control':'no-store'});res.end();return true;
    }
    const s=accounts.googleLogin(profile);
    res.writeHead(302,{Location:'/create','Set-Cookie':accounts.cookie(s.token,secure),'Cache-Control':'no-store'});res.end();return true;
   }catch(e){res.writeHead(302,{Location:'/create?auth_error='+encodeURIComponent(String(e.message||e).slice(0,200)),'Cache-Control':'no-store'});res.end();return true}
  }
  if(route==='/verify'&&method==='POST'){const b=await readJson(req,2000);return send(res,200,{account:accounts.verifyEmail(b.token)}),true}
  if(route==='/password/forgot'&&method==='POST'){limited(req,'forgot',5);const b=await readJson(req,2000);return send(res,200,await accounts.requestReset(b.email,origin(req))),true}
  if(route==='/password/reset'&&method==='POST'){limited(req,'reset',10);const b=await readJson(req,4000),s=accounts.resetPassword(b.token,b.password);return send(res,200,{account:s.account},{'Set-Cookie':accounts.cookie(s.token,secure)}),true}
  if(route==='/signup'&&method==='POST'){
   if(process.env.KAIROQ_BUILDER_SIGNUPS==='closed')throw Object.assign(Error('Sign-ups are closed'),{status:403});
   limited(req,'signup',10);
   const b=await readJson(req,10000),s=accounts.signup(b.email,b.password);
   accounts.sendVerification(s.account.id,origin(req)).catch(()=>{});
   return send(res,201,{account:s.account},{'Set-Cookie':accounts.cookie(s.token,secure)}),true;
  }
  if(route==='/login'&&method==='POST'){
   limited(req,'login',20);
   const b=await readJson(req,10000),s=accounts.login(b.email,b.password);
   return send(res,200,{account:s.account},{'Set-Cookie':accounts.cookie(s.token,secure)}),true;
  }
  if(route==='/logout'&&method==='POST'){accounts.logout(req);return send(res,200,{ok:true},{'Set-Cookie':accounts.cookie('',secure)}),true}
  if(route==='/stripe/webhook'&&method==='POST'){
   const raw=await readRaw(req);
   return send(res,200,await accounts.stripeWebhook(raw,req.headers['stripe-signature'])),true;
  }
  if(route==='/templates'&&method==='GET')return send(res,200,{templates:require('./create-templates').list()}),true;
  const sm=/^\/share\/([a-f0-9]{24})$/.exec(route);
  if(sm&&method==='GET'){
   const meta=findShare(sm[1]);if(!meta)throw Object.assign(Error('This share link is no longer active'),{status:404});
   return send(res,200,{share:{name:meta.name,preview_url:builder.previewUrl(meta),remix:!!meta.share.remix,versions:meta.versions.length,updated_at:meta.updated_at}}),true;
  }
  const v=requireViewer(req,isOwner);
  if(route==='/remix'&&method==='POST'){
   const b=await readJson(req,2000),src=findShare(b.token);
   if(!src||!src.share.remix)throw Object.assign(Error('This app cannot be remixed'),{status:404});
   if(listFor(v).length>=Number(process.env.KAIROQ_BUILDER_MAX_PROJECTS||50))throw Object.assign(Error('Project limit reached'),{status:400});
   const meta=builder.create({name:('Remix of '+src.name).slice(0,80),owner:v.owner});
   const assets=require('./react-assets');
   for(const a of assets.list(src.id)){const f=assets.read(src.id,a.name);fs.mkdirSync(path.join(builder.projectDir(meta.id),'uploads'),{recursive:true});fs.writeFileSync(path.join(builder.projectDir(meta.id),'uploads',a.name),f.bytes)}
   await builder.initializeFrom(meta,builder.loadFiles(src.id,src.current_version),'Remixed from '+src.name);
   return send(res,201,{project:projectViewFor(meta.id)}),true;
  }
  if(route.startsWith('/admin/')){
   if(v.kind!=='owner')throw Object.assign(Error('Owner only'),{status:403});
   const backups=require('./create-backups');
   if(route==='/admin/status'&&method==='GET'){
    const d=accounts.database();
    return send(res,200,{builds:builder.buildStats(),jobs:[...jobs.values()].filter(j=>ACTIVE.has(j.status)).length,projects:builder.list().length,accounts:d.prepare('SELECT COUNT(*) n FROM accounts').get().n,subscribers:d.prepare("SELECT COUNT(*) n FROM accounts WHERE plan IS NOT NULL AND plan_status='active'").get().n,last_backup:backups.latest()}),true;
   }
   if(route==='/admin/backup'&&method==='POST')return send(res,200,{backup:backups.run()}),true;
   // AI cost per tier and model over the last 30 days, next to what one message of that tier sells for.
   if(route==='/admin/costs'&&method==='GET'){
    const credits=Object.fromEntries(tiers().map(t=>[t.id,t.credits]));credits.design=polishCredits();credits.image=generatedImageCredits();
    return send(res,200,{costs:require('./builder-costs').summarize(usageRows?usageRows():[],{credits}),agent_multiplier:agentMultiplier()}),true;
   }
   return send(res,404,{error:'Route not found'}),true;
  }
  if(route==='/verify/resend'&&method==='POST'){
   if(v.kind!=='customer')throw Object.assign(Error('Owner accounts do not need verification'),{status:400});
   limited(req,'verify',5);return send(res,200,await accounts.sendVerification(v.account.id,origin(req))),true;
  }
  // ----- design skills (per account) -----
  if(route==='/skills'&&method==='GET'){const skills=require('./react-skills');return send(res,200,{skills:skills.library(v.owner).map(({body,...x})=>({...x,chars:body.length}))}),true}
  if(route==='/skills'&&method==='POST'){
   const b=await readJson(req,60000),skills=require('./react-skills');
   if(b.url){limited(req,'skills-import',20);const r=await skills.importFromGithub(v.owner,String(b.url),{choose:b.path?String(b.path):undefined});return send(res,r.skill?201:200,r.skill?{skill:{...r.skill,body:undefined}}:{choices:r.choices}),true}
   return send(res,201,{skill:{...skills.add(v.owner,{name:b.name,description:b.description,body:String(b.text||'')}),body:undefined}}),true;
  }
  if(route==='/skills/default'&&method==='POST'){const b=await readJson(req,2000),skills=require('./react-skills');skills.setDefault(v.owner,String(b.id||''),Boolean(b.on));return send(res,200,{skills:skills.library(v.owner).map(({body,...x})=>x)}),true}
  if(route==='/skills'&&method==='DELETE'){const b=await readJson(req,2000),skills=require('./react-skills');skills.remove(v.owner,String(b.id||''));return send(res,200,{skills:skills.library(v.owner).map(({body,...x})=>x)}),true}
  const sv=/^\/skills\/(u-[a-f0-9]{10}|[a-z0-9-]{1,60})$/.exec(route);
  if(sv&&method==='GET'){const skill=require('./react-skills').find(v.owner,sv[1]);if(!skill)throw Object.assign(Error('Unknown skill'),{status:404});return send(res,200,{skill}),true}
  if(route==='/credits'&&method==='GET'){
   if(v.kind!=='customer')return send(res,200,{unlimited:true,history:[]}),true;
   return send(res,200,{account:accounts.fromRequest(req),history:accounts.history(v.account.id)}),true;
  }
  if(route==='/subscribe'&&method==='POST'){
   if(v.kind!=='customer')throw Object.assign(Error('The owner account does not use plans'),{status:400});
   const b=await readJson(req,5000);
   return send(res,200,await accounts.subscribe(v.account,String(b.plan||''),origin(req))),true;
  }
  if(route==='/billing'&&method==='POST'){
   if(v.kind!=='customer')throw Object.assign(Error('The owner account has no billing'),{status:400});
   return send(res,200,await accounts.billingPortal(v.account,origin(req))),true;
  }
  if(route==='/checkout'&&method==='POST'){
   if(v.kind!=='customer')throw Object.assign(Error('The owner account does not use credits'),{status:400});
   const b=await readJson(req,5000);
   return send(res,200,await accounts.checkout(v.account,String(b.pack||''),origin(req))),true;
  }
  // ----- projects -----
  if(route==='/projects'&&method==='GET')return send(res,200,{projects:listFor(v)}),true;
  if(route==='/projects'&&method==='POST'){
   const b=await readJson(req,16000000);
   if(builder.list(v.owner).length>=Number(process.env.KAIROQ_BUILDER_MAX_PROJECTS||50))throw Object.assign(Error('Project limit reached. Delete a project to create another.'),{status:400});
   const prompt=String(b.prompt||'').trim();
   const tpl=b.template?require('./create-templates').get(String(b.template)):null;
   if(b.template&&!tpl)throw Object.assign(Error('Unknown template'),{status:400});
   const meta=builder.create({name:b.name||(tpl&&!prompt?tpl.name:prompt.split(/[.\n]/)[0].slice(0,60))||'Untitled app',owner:v.owner});
   if(tpl)await builder.initializeFrom(meta,tpl.files,'Started from the '+tpl.name+' template');
   else await builder.initialize(meta);
   // Mobile templates start with the mobile app setting on (phone preview, installable app).
   if(tpl&&tpl.mobile)require('./react-mobile').update(meta.id,{enabled:true,...tpl.mobile});
   const job=prompt?startJob(v,meta.id,{message:prompt,tier:b.tier||'standard',images:parseImages(b.images)},deps):null;
   return send(res,201,{project:projectViewFor(meta.id),job}),true;
  }
  const jm=/^\/jobs\/([a-f0-9-]{36})(\/events)?$/.exec(route);
  if(jm&&method==='GET'){
   const job=jobs.get(jm[1]);
   if(!job||!canSeeJob(v,job,'viewer'))throw Object.assign(Error('Job not found or expired'),{status:404});
   if(jm[2])return streamJob(req,res,job),true;
   return send(res,200,{job:publicJob(job)}),true;
  }
  const cm=/^\/jobs\/([a-f0-9-]{36})\/cancel$/.exec(route);
  if(cm&&method==='POST'){
   const job=jobs.get(cm[1]);
   if(!job||!canSeeJob(v,job,'editor'))throw Object.assign(Error('Job not found or expired'),{status:404});
   controllers.get(job.id)?.abort();
   return send(res,200,{job:publicJob(job)}),true;
  }
  const pm=/^\/projects\/([a-f0-9]{12})(\/[a-z]+)?$/.exec(route);
  if(!pm)return send(res,404,{error:'Route not found'}),true;
  const id=pm[1],action=pm[2]||'';
  const {role}=ownedProject(v,id,NEED[method+':'+action]||'owner');
  const projectView=(pid,r=role)=>projectViewFor(pid,r);
  if(!action&&method==='GET')return send(res,200,{project:projectView(id),account:v.kind==='customer'?accounts.fromRequest(req):null}),true;
  if(action==='/analytics'&&method==='GET')return send(res,200,{analytics:require('./react-analytics').summary(id,{days:30})}),true;
  if(action==='/seo'&&method==='POST'){
   const b=await readJson(req,4000),meta=builder.loadMeta(id);
   const image=String(b.image||'').trim();
   if(image&&!/^(https:\/\/|\.\/uploads\/[a-z0-9-]+\.(png|jpg|jpeg|webp|gif)$)/.test(image))throw Object.assign(Error('Share image must be an https URL or an uploaded image'),{status:400});
   meta.seo={title:String(b.title||'').trim().slice(0,70),description:String(b.description||'').trim().slice(0,200),image};
   builder.saveMeta(meta);return send(res,200,{project:projectView(id)}),true;
  }
  if(action==='/members'&&method==='GET'){const meta=builder.loadMeta(id);return send(res,200,{members:meta.members||[]}),true}
  if(action==='/members'&&method==='POST'){
   const b=await readJson(req,2000),meta=builder.loadMeta(id);
   const email=String(b.email||'').trim().toLowerCase(),r=b.role==='viewer'?'viewer':'editor';
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw Object.assign(Error('Enter a valid email address'),{status:400});
   if(v.kind==='customer'&&email===v.account.email)throw Object.assign(Error('You already own this project'),{status:400});
   meta.members=(meta.members||[]).filter(m=>m.email!==email);
   if(meta.members.length>=20)throw Object.assign(Error('A project can have up to 20 collaborators'),{status:400});
   meta.members.push({email,role:r,added_at:new Date().toISOString()});builder.saveMeta(meta);
   return send(res,200,{members:meta.members,project:projectView(id)}),true;
  }
  if(action==='/members'&&method==='DELETE'){const b=await readJson(req,2000),meta=builder.loadMeta(id);meta.members=(meta.members||[]).filter(m=>m.email!==String(b.email||'').toLowerCase());meta.preview_key=crypto.randomBytes(12).toString('hex');builder.saveMeta(meta);return send(res,200,{members:meta.members,project:projectView(id)}),true}
  if(action==='/share'&&method==='POST'){
   const b=await readJson(req,2000),meta=builder.loadMeta(id);
   if(!b.enabled&&meta.share)meta.preview_key=crypto.randomBytes(12).toString('hex');
   meta.share=b.enabled?{token:meta.share?.token||crypto.randomBytes(12).toString('hex'),remix:!!b.remix,at:new Date().toISOString()}:null;
   builder.saveMeta(meta);return send(res,200,{project:projectView(id)}),true;
  }
  if(!action&&method==='PATCH'){const b=await readJson(req,5000);builder.rename(id,b.name);return send(res,200,{project:projectView(id)}),true}
  if(!action&&method==='DELETE'){for(const d of builder.loadMeta(id).domains||[])await hosting.removeDomain(id,d.hostname);hosting.unpublish(id);backend.close(id);return send(res,200,builder.remove(id)),true}
  if(action==='/data'&&method==='GET')return send(res,200,backend.overview(id)),true;
  if(action==='/records'&&method==='GET')return send(res,200,{items:backend.ownerRecords(id,new URL(req.url,'http://x').searchParams.get('collection')||'')}),true;
  if(action==='/records'&&method==='DELETE'){const b=await readJson(req,2000);return send(res,200,backend.ownerDelete(id,b.id)),true}
  if(action==='/chat'&&method==='POST'){const b=await readJson(req,16000000);return send(res,202,{job:publicJob(startJob(v,id,{message:b.message,mode:b.mode||'build',tier:b.tier||'standard',images:parseImages(b.images)},deps))}),true}
  if(action==='/assets'&&method==='GET')return send(res,200,{assets:require('./react-assets').list(id)}),true;
  if(action==='/assets'&&method==='POST'){const b=await readJson(req,16000000);return send(res,201,{saved:require('./react-assets').save(id,parseImages(b.images)),assets:require('./react-assets').list(id)}),true}
  if(action==='/assets'&&method==='DELETE'){const b=await readJson(req,2000);require('./react-assets').remove(id,b.name);return send(res,200,{assets:require('./react-assets').list(id)}),true}
  if(action==='/asset'&&method==='GET'){const file=require('./react-assets').read(id,new URL(req.url,'http://x').searchParams.get('name'));if(!file)throw Object.assign(Error('Unknown image'),{status:404});res.writeHead(200,{'Content-Type':file.type,'Cache-Control':'private, max-age=300','X-Content-Type-Options':'nosniff'});res.end(file.bytes);return true}
  if(action==='/sql'&&method==='GET')return send(res,200,require('./react-sql').overview(builder.projectDir(id))),true;
  if(action==='/sql'&&method==='POST'){
   // The owner's SQL console. Queries run in a SQL process that is killed if they overrun.
   const b=await readJson(req,40000);
   return send(res,200,{result:await require('./react-sql').run.query(builder.projectDir(id),String(b.query||''),Array.isArray(b.params)?b.params:[])}),true;
  }
  // Mobile app settings, the QR code to open the published app on a phone, and its icon.
  if(action==='/mobile'||action==='/qr'||action==='/appicon'){
   const mobile=require('./react-mobile'),meta=builder.loadMeta(id),urls=require('./react-hosting').siteUrls(meta);
   const best=urls?(urls.domains[0]||urls.subdomain||urls.path):null;
   if(action==='/mobile'&&method==='GET')return send(res,200,{mobile:mobile.settings(meta),url:best,installable:Boolean(urls&&(urls.domains.length||urls.subdomain)),assets:require('./react-assets').list(id).filter(a=>/\.(png|jpe?g|webp)$/.test(a.name)).map(a=>a.name)}),true;
   if(action==='/mobile'&&method==='POST'){const s=mobile.update(id,await readJson(req,4000));mobile.renderIcons(id).catch(()=>{});return send(res,200,{mobile:s}),true}
   if(action==='/qr'&&method==='GET'){
    if(!best)throw Object.assign(Error('Publish the app first'),{status:409});
    res.writeHead(200,{'Content-Type':'image/svg+xml','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'"});res.end(mobile.qrSvg(best));return true;
   }
   if(action==='/appicon'&&method==='GET'){res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'no-store'});res.end(mobile.icon(id,'icon-192.png'));return true}
  }
  // ----- build from a reference -----
  if(action==='/reference'&&method==='GET'){
   const meta=builder.loadMeta(id),ref=require('./react-reference');
   return send(res,200,{reference:require('./react-reference-run').view(meta),browser:require('./runtime-check').available(),rea:ref.reaAvailable(),asset_search:require('./react-asset-search').enabled(),prices:referencePrices(),can_publish:role==='owner'}),true;
  }
  if(action==='/refshot'&&method==='GET'){
   const f=require('./react-reference-run').shotFile(id,new URL(req.url,'http://x').searchParams.get('name'));
   if(!f)throw Object.assign(Error('Not found'),{status:404});
   res.writeHead(200,{'Content-Type':f.endsWith('.png')?'image/png':'image/jpeg','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(fs.readFileSync(f));return true;
  }
  if(action==='/reference'&&method==='POST'){
   const b=await readJson(req,58*1024*1024),ref=require('./react-reference'),run=require('./react-reference-run');
   const tier=b.tier||'standard',fetchImpl=referenceFetch||fetch;
   if(b.step==='analyze'){
    const images=parseImages(b.images);
    let source;
    if(b.app&&b.app.data){
     if(!b.rights)throw Object.assign(Error('Confirm that you own this app or have the right to analyze it.'),{status:400});
     source={type:'app',value:String(b.app.name||'app.zip').slice(0,80),zip:String(b.app.data).replace(/^data:[^,]*,/,'')};
    }else if(String(b.repo||'').trim())source={type:'repo',value:String(b.repo).trim()};
    else if(String(b.url||'').trim())source={type:'url',value:String(b.url).trim()};
    else if(images.length)source={type:'screenshots',value:images.length+' screenshots'};
    else throw Object.assign(Error('Give a website address, a GitHub repository, app files or screenshots'),{status:400});
    let token=null;
    // The project's saved GitHub token can read the owner's private repositories, so only the owner's runs use it.
    if(source.type==='repo'&&role==='owner'){try{token=require('./project-secrets').get(id,'github_token')}catch{}if(!token&&v.kind==='owner')token=process.env.GITHUB_TOKEN||null}
    const job=startAnalysis(v,id,{source,images,note:String(b.note||'').slice(0,2000),tier},{callModel,fetchImpl,token});
    return send(res,202,{job:publicJob(job)}),true;
   }
   if(b.step==='build'){
    const meta=builder.loadMeta(id);
    if(!meta.reference)throw Object.assign(Error('Analyze a reference first'),{status:409});
    const plan=ref.normalizePlan(b.plan&&typeof b.plan==='object'?b.plan:meta.reference.plan);
    meta.reference.plan=plan;
    // The plan's design direction becomes the project's colours and fonts (see prepareDesign).
    if(plan.design&&!meta.design)meta.planned_design={...plan.design,created_at:new Date().toISOString()};
    builder.saveMeta(meta);
    const shots=run.loadShots(id,meta.reference.shots).slice(0,3);
    const {message,context}=ref.buildTask(plan,meta.reference.analysis);
    const canPublish=role==='owner',github=b.github?{repo:typeof b.github==='object'&&b.github.repo?String(b.github.repo):undefined}:null;
    const job=startJob(v,id,{message,mode:'agent',tier,images:shots,context,referenceOnly:true,extraCredits:referenceExtra(tier),label:'Build from reference',hooks:{
     before:async()=>(await run.prepare(id,plan,{fetchImpl})).note,
     after:(result,c)=>run.finish(id,result,{plan,publish:Boolean(b.publish),github,slug:b.slug},{...deps,...c,tier,canPublish,isOwner:v.kind==='owner',fetchImpl})
    }},deps);
    return send(res,202,{job:publicJob(job)}),true;
   }
   throw Object.assign(Error('Unknown step (use analyze or build)'),{status:400});
  }
  if(action==='/figma'&&method==='GET'){let saved=false;try{saved=Boolean(require('./project-secrets').status(id).figma_token)}catch{}return send(res,200,{token_saved:saved}),true}
  if(action==='/figma'&&method==='POST'){
   // Import a Figma frame: render it, save its images, describe its layers, then build it.
   const b=await readJson(req,20000),secrets=require('./project-secrets'),figma=require('./react-figma');
   let token=String(b.token||'').trim();
   if(token&&b.save_token){if(role!=='owner')throw Object.assign(Error('Only the project owner can save the Figma token'),{status:403});secrets.set(id,'figma_token',token)}
   if(!token&&role==='owner'){try{token=secrets.get(id,'figma_token')||''}catch{}}
   for(const job of jobs.values())if(job.projectId===id&&ACTIVE.has(job.status))throw Object.assign(Error('This project is already being updated'),{status:409});
   const price=cost({mode:b.mode==='agent'?'agent':'build',tier:b.tier||'standard',images:process.env.KAIROQ_BUILDER_PAID_APPROVED==='true'});
   if(v.kind==='customer'&&v.account.credits<price)throw Object.assign(Error('You need '+price+' credits for this import.'),{status:402});
   const frame=await figma.importFrame({url:b.url,token},{fetchImpl:figmaFetch||fetch});
   const saved=frame.images.length?require('./react-assets').save(id,frame.images.map(({name,mime,data})=>({name,mime,data}))):[];
   const names=new Map(frame.images.map((img,i)=>[img.ref,saved[i]]));
   const paid=process.env.KAIROQ_BUILDER_PAID_APPROVED==='true';
   const message=String(b.message||'').trim().slice(0,4000)||'Build the Figma design "'+frame.name+'" as a responsive page. Match its layout, spacing, colours, fonts and text closely and use the images from the design.';
   const context='Figma design spec for the frame "'+frame.name+'". Sizes are px at the design width; turn them into a responsive Tailwind layout (mobile first). Load Google Fonts with an https @import at the top of src/index.css when the design uses them.'+(paid&&frame.screenshot?' The attached image is the rendered frame.':'')+'\n'+figma.spec(frame.root,names).slice(0,40000)+(saved.length?'\nImages from the design (saved as uploads): '+saved.map(n=>'./uploads/'+n).join(', '):'');
   const job=startJob(v,id,{message,mode:b.mode==='agent'?'agent':'build',tier:b.tier||'standard',images:paid&&frame.screenshot?[frame.screenshot]:[],context,referenceOnly:true},deps);
   return send(res,202,{job:publicJob(job),frame:{name:frame.name,images:saved,rendered:Boolean(frame.screenshot)}}),true;
  }
  // The files a version changed, before and after (the Details panel's Changes tab).
  if(action==='/changes'&&method==='GET'){
   const meta=builder.loadMeta(id),n=Number(new URL(req.url,'http://x').searchParams.get('version'))||meta.current_version;
   const ver=meta.versions.find(x=>x.n===n);if(!ver)throw Object.assign(Error('Unknown version'),{status:404});
   const prevN=Math.max(0,...meta.versions.filter(x=>x.n<n).map(x=>x.n));
   const after=builder.loadFiles(id,n),before=prevN?builder.loadFiles(id,prevN):{};
   let budget=600000;const files=[];
   for(const f of (ver.changed&&ver.changed.length?ver.changed:Object.keys(after).filter(k=>before[k]!==after[k]))){
    const b=Object.hasOwn(before,f)?String(before[f]):null,a=Object.hasOwn(after,f)?String(after[f]):null;
    const size=(b||'').length+(a||'').length;
    files.push(size>budget?{path:f,status:b===null?'created':a===null?'deleted':'edited',too_large:true}:{path:f,status:b===null?'created':a===null?'deleted':'edited',before:b,after:a});
    budget-=Math.min(size,budget);
   }
   return send(res,200,{version:n,previous:prevN||null,files}),true;
  }
  if(action==='/logs'&&method==='GET')return send(res,200,{logs:require('./react-logs').list(id)}),true;
  if(action==='/security'&&method==='GET'){
   const meta=builder.loadMeta(id),files=builder.loadFiles(id,meta.current_version);
   let cfg={collections:{}};try{cfg=backend.parseConfig(files)}catch{}
   return send(res,200,{version:meta.current_version,findings:require('./react-security').scan(files,cfg)}),true;
  }
  // Design brief, design skills and the "add design system" action for older projects.
  if(action==='/design'&&method==='GET'){
   const design=require('./react-design'),meta=builder.loadMeta(id),files=meta.current_version?builder.loadFiles(id,meta.current_version):{};
   return send(res,200,{design:meta.design||null,skills:meta.skills||[],library:require('./react-skills').library(meta.owner||v.owner).map(({body,...x})=>x),has_tokens:design.hasTokens(files),fonts:Object.keys(design.FONTS).filter(n=>design.FONTS[n][0]!=='mono')}),true;
  }
  if(action==='/design'&&method==='POST'){
   const b=await readJson(req,20000),design=require('./react-design');
   let meta=builder.loadMeta(id);
   if(Array.isArray(b.skills)){meta.skills=require('./react-skills').setProject(meta,b.skills);builder.saveMeta(meta)}
   let next=null,summary='';
   if(typeof b.regenerate==='string'){
    // A new visual direction from the AI, priced like a Discuss message on the chosen tier.
    for(const job of jobs.values())if(job.projectId===id&&ACTIVE.has(job.status))throw Object.assign(Error('This project is already being updated'),{status:409});
    const tier=b.tier||'standard',price=cost({mode:'discuss',tier});
    const ref='design:'+crypto.randomUUID();
    if(v.kind==='customer'&&price>0)accounts.charge(v.account.id,price,'New design direction',ref);
    try{
     const lib=require('./react-skills').library(meta.owner||v.owner).map(s=>({id:s.id,description:s.name+': '+s.description}));
     const files=builder.loadFiles(id,meta.current_version);
     const what=String(b.regenerate).trim().slice(0,1500)||'A fresh, distinctive direction for this app.';
     next=await design.createBrief('Direction from the owner: '+what+'\nThe app today (its main page):\n'+String(files['src/App.jsx']||'').slice(0,4000)+(meta.knowledge?'\nProject knowledge: '+String(meta.knowledge).slice(0,1500):''),{callModel,tier,skills:lib,projectName:meta.name});
    }catch(e){if(v.kind==='customer'&&price>0)try{accounts.grant(v.account.id,price,'Refund: design direction failed','refund-'+ref)}catch{}throw Object.assign(Error('Could not create a design direction: '+String(e.message||e).slice(0,300)),{status:502})}
    summary='New design direction: '+next.name;
   }else if(b.design&&typeof b.design==='object'){
    const cur=meta.design||{};
    next={...design.normalize({...cur,...b.design,palette:{...(cur.palette||{}),...(b.design.palette||{})},fonts:{...(cur.fonts||{}),...(b.design.fonts||{})}}),created_at:cur.created_at||new Date().toISOString(),updated_at:new Date().toISOString()};
    summary='Updated the design: '+next.name;
   }
   if(next){meta=builder.loadMeta(id);if(next.skill&&!(meta.skills||[]).includes(next.skill))meta.skills=[...(meta.skills||[]),next.skill];meta.design=next;builder.saveMeta(meta)}
   const files=builder.loadFiles(id,meta.current_version);
   let version=null;
   if(b.add_system&&!design.hasTokens(files)){version=(await builder.saveSource(id,design.addDesignSystem(files,meta.design||{}),{summary:'Added the design system (UI kit and design tokens)',changed:['src/index.css','src/components/ui/']})).version}
   else if(next&&design.hasTokens(files)){const css=design.applyToCss(files['src/index.css'],next);if(css!==files['src/index.css'])version=(await builder.saveSource(id,{...files,'src/index.css':css},{summary,changed:['src/index.css']})).version}
   const fresh=builder.loadMeta(id);
   return send(res,200,{design:fresh.design||null,skills:fresh.skills||[],has_tokens:design.hasTokens(builder.loadFiles(id,fresh.current_version)),version,project:projectView(id)}),true;
  }
  if(action==='/images'&&method==='POST'){
   // Generates one image into the project's uploads from a prompt.
   if(!generateImage)throw Object.assign(Error('Image generation is not enabled on this server'),{status:503});
   const b=await readJson(req,6000),prompt=String(b.prompt||'').trim().slice(0,1500);
   if(prompt.length<4)throw Object.assign(Error('Describe the image'),{status:400});
   limited(req,'genimage',30);
   const req1=builder.imageRequests([{name:b.name||prompt.split(/\s+/).slice(0,4).join('-'),prompt,aspect:b.aspect}])[0];
   const credits=generatedImageCredits(),ref='genimage:'+crypto.randomUUID();
   if(v.kind==='customer'&&credits>0)accounts.charge(v.account.id,credits,'Generated image',ref);
   let picture;
   try{const meta=builder.loadMeta(id);picture=await generateImage({prompt:req1.prompt+(meta.design&&meta.design.imagery?'\nVisual style of the app: '+meta.design.imagery:''),aspect:req1.aspect})}
   catch(e){if(v.kind==='customer'&&credits>0)try{accounts.grant(v.account.id,credits,'Refund: image not generated','refund-'+ref)}catch{}throw Object.assign(Error('Image generation failed: '+String(e.message||e).slice(0,300)),{status:502})}
   const stem=req1.name.replace(/\.[a-z]+$/,''),ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[picture.mime]||'png';
   const saved=require('./react-assets').save(id,[{name:stem+'.'+ext,mime:picture.mime,data:picture.data}],{maxBytes:6*1024*1024});
   return send(res,201,{saved,assets:require('./react-assets').list(id)}),true;
  }
  // Saved checks: list, add (steps or a plain-English description), switch on/off, run now, remove.
  if(action==='/checks'&&method==='GET'){const meta=builder.loadMeta(id);return send(res,200,{checks:require('./react-checks').list(meta),monitor:meta.monitor||null}),true}
  if(action==='/checks'&&method==='DELETE'){const b=await readJson(req,2000);return send(res,200,{checks:require('./react-checks').remove(id,String(b.id||''))}),true}
  if(action==='/checks'&&method==='POST'){
   const b=await readJson(req,40000),checks=require('./react-checks');
   if(b.id&&b.enabled!==undefined){checks.setEnabled(id,String(b.id),b.enabled);return send(res,200,{checks:checks.list(builder.loadMeta(id))}),true}
   for(const job of jobs.values())if(job.projectId===id&&ACTIVE.has(job.status))throw Object.assign(Error('This project is being updated. Try again when it is done.'),{status:409});
   const meta=builder.loadMeta(id),url=builder.previewUrl(meta);
   if(!url)throw Object.assign(Error('Build the app first'),{status:400});
   if(b.run){const r=await checks.run(id,url,{inspect,version:meta.current_version});if(r.skipped)throw Object.assign(Error('Checks need a browser on the server (Chromium), which is not available here.'),{status:503});return send(res,200,{result:r,checks:checks.list(builder.loadMeta(id))}),true}
   let draft;
   if(typeof b.describe==='string'&&b.describe.trim()){
    // The AI writes the steps (priced like a Discuss message); the check is kept only if it passes now.
    const tier=b.tier||'standard',price=cost({mode:'discuss',tier}),ref='check:'+crypto.randomUUID();
    if(v.kind==='customer'&&price>0)accounts.charge(v.account.id,price,'Write a check',ref);
    try{draft=await checks.write(id,b.describe,{callModel,tier})}
    catch(e){if(v.kind==='customer'&&price>0)try{accounts.grant(v.account.id,price,'Refund: check not written','refund-'+ref)}catch{}throw Object.assign(Error('Could not write that check: '+String(e.message||e).slice(0,300)),{status:502})}
   }else draft=checks.normalize(b);
   const r=await checks.run(id,url,{inspect,checks:[{...draft,id:'draft'}],record:false});
   if(!r.skipped&&r.failed.length&&!b.force)return send(res,200,{saved:false,draft,failed:r.failed[0]}),true;
   const saved=checks.save(id,draft,{source:b.describe?'ai':'user'});
   return send(res,201,{saved:true,check:saved,verified:!r.skipped,checks:checks.list(builder.loadMeta(id))}),true;
  }
  if(action==='/knowledge'&&method==='POST'){
   const b=await readJson(req,20000),meta=builder.loadMeta(id);
   meta.knowledge=String(b.text||'').slice(0,8000);builder.saveMeta(meta);
   return send(res,200,{project:projectView(id)}),true;
  }
  if(action==='/secrets'&&method==='GET'){
   const st=require('./project-secrets').status(id);
   return send(res,200,{secrets:Object.entries(st).filter(([k])=>k.startsWith('app_')).map(([k,v])=>({name:k.slice(4).toUpperCase(),hint:v.hint,at:v.at}))}),true;
  }
  if(action==='/secrets'&&method==='POST'){
   const b=await readJson(req,20000),name=String(b.name||'').trim().toUpperCase();
   if(!/^[A-Z][A-Z0-9_]{0,49}$/.test(name))throw Object.assign(Error('Secret names use letters, numbers and _ (for example STRIPE_KEY)'),{status:400});
   const value=b.value===null||b.value===undefined?null:String(b.value);
   if(value!==null&&value.length>10000)throw Object.assign(Error('Secret is too long'),{status:400});
   require('./project-secrets').set(id,'app_'+name.toLowerCase(),value);
   const st=require('./project-secrets').status(id);
   return send(res,200,{secrets:Object.entries(st).filter(([k])=>k.startsWith('app_')).map(([k,v])=>({name:k.slice(4).toUpperCase(),hint:v.hint,at:v.at}))}),true;
  }
  if(action==='/settings'&&method==='GET'){
   const secrets=require('./project-secrets');
   return send(res,200,{settings:{secrets:secrets.status(id),encryption:(process.env.APP_ENCRYPTION_KEY||'').length>=16,stripe_webhook_url:origin(req)+'/api/apps/'+id+'/payments/webhook',stripe_events:['checkout.session.completed','checkout.session.async_payment_succeeded','customer.subscription.deleted'],email:Boolean(process.env.KAIROQ_RESEND_API_KEY&&process.env.KAIROQ_EMAIL_FROM)}}),true;
  }
  if(action==='/settings'&&method==='POST'){
   const b=await readJson(req,8000),secrets=require('./project-secrets');
   const rules={stripe_secret_key:/^(sk|rk)_(live|test)_[A-Za-z0-9]{10,}$/,stripe_webhook_secret:/^whsec_[A-Za-z0-9]{10,}$/,github_token:/^(ghp_|github_pat_)[A-Za-z0-9_]{20,}$/};
   for(const [name,re] of Object.entries(rules)){
    if(b[name]===undefined)continue;
    const value=String(b[name]||'').trim();
    if(value&&!re.test(value))throw Object.assign(Error('That '+name.replace(/_/g,' ')+' does not look right'),{status:400});
    secrets.set(id,name,value||null);
   }
   return send(res,200,{settings:{secrets:secrets.status(id)}}),true;
  }
  if(action==='/download'&&method==='GET'){
   const meta=builder.loadMeta(id),bytes=require('./react-export').zip(id);
   const name=String(meta.name).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60)||'app';
   res.writeHead(200,{'Content-Type':'application/zip','Content-Disposition':'attachment; filename="'+name+'-v'+meta.current_version+'.zip"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(bytes);return true;
  }
  if(action==='/github'&&method==='GET'){const meta=builder.loadMeta(id);return send(res,200,{github:meta.github||null,token:require('./project-secrets').status(id).github_token||null,owner_fallback:v.kind==='owner'&&Boolean(process.env.GITHUB_TOKEN)}),true}
  if(action==='/push'&&method==='POST'){const b=await readJson(req,2000);return send(res,200,{result:await require('./react-export').push(id,{repo:b.repo,isOwner:v.kind==='owner'}),project:projectView(id)}),true}
  if(action==='/pull'&&method==='POST'){
   for(const job of jobs.values())if(job.projectId===id&&ACTIVE.has(job.status))throw Object.assign(Error('Wait for the current change to finish'),{status:409});
   return send(res,200,{result:await require('./react-export').pull(id,{isOwner:v.kind==='owner'}),project:projectView(id)}),true;
  }
  if(action==='/inspect'&&method==='POST'){const b=await readJson(req,4000);return send(res,200,{element:builder.inspectElement(id,b)}),true}
  if(action==='/visual'&&method==='POST'){
   for(const job of jobs.values())if(job.projectId===id&&ACTIVE.has(job.status))throw Object.assign(Error('Wait for the current change to finish'),{status:409});
   const b=await readJson(req,20000);
   const r=await builder.visualEdit(id,{loc:b.loc,version:b.version,changes:b.changes});
   return send(res,200,{result:r,project:projectView(id)}),true;
  }
  if(action==='/fix'&&method==='POST'){
   const b=await readJson(req,40000),meta=builder.loadMeta(id);
   const reported=Array.isArray(b.errors)?b.errors.map(e=>String(e).slice(0,800)).slice(0,10):[];
   const known=meta.versions.find(x=>x.n===meta.current_version)?.runtime_errors||[];
   const errors=[...new Set([...reported,...known])];
   if(!errors.length)throw Object.assign(Error('No errors to fix right now'),{status:400});
   return send(res,202,{job:publicJob(startJob(v,id,{message:'Fix these errors from the running app:\n'+errors.join('\n'),tier:b.tier||'standard'},deps))}),true;
  }
  if(action==='/file'&&method==='GET'){const name=new URL(req.url,'http://x').searchParams.get('path')||'';return send(res,200,{path:name,content:builder.readFile(id,name)}),true}
  if(action==='/restore'&&method==='POST'){const b=await readJson(req,2000);builder.restore(id,b.version);return send(res,200,{project:projectView(id)}),true}
  if(action==='/publish'&&method==='POST'){const b=await readJson(req,2000);
   // Publishing re-runs the saved checks on the version going live, unless the owner overrides.
   if(!b.force&&inspect){const meta=builder.loadMeta(id),n=Number(b.version)||meta.current_version;if(require('./react-checks').list(meta).some(c=>c.enabled!==false)&&meta.versions.some(x=>x.n===n)){const r=await require('./react-checks').run(id,builder.previewUrl(meta,n),{inspect,version:n});if(r.failed.length)return send(res,409,{error:'Saved checks fail on this version: '+r.failed.map(f=>f.name).join(', ')+'. Fix them first, or publish anyway.',checks_failed:r.failed}),true}}
   hosting.publish(id,{slug:b.slug,version:b.version});
   // Social share image: a screenshot of the published version, taken in the background.
   if(screenshot){const meta=builder.loadMeta(id);screenshot(builder.previewUrl(meta,meta.published.version),path.join(builder.projectDir(id),'og.png')).catch(()=>{})}
  return send(res,200,{project:projectView(id)}),true}
  if(action==='/unpublish'&&method==='POST'){hosting.unpublish(id);return send(res,200,{project:projectView(id)}),true}
  if(action==='/domains'&&method==='POST'){const b=await readJson(req,2000);await hosting.addDomain(id,b.hostname);return send(res,200,{project:projectView(id)}),true}
  if(action==='/verify'&&method==='POST'){const b=await readJson(req,2000);const r=await hosting.verifyDomain(id,b.hostname);return send(res,200,{verified:r.verified,error:r.error,project:projectView(id)}),true}
  if(action==='/domains'&&method==='DELETE'){const b=await readJson(req,2000);await hosting.removeDomain(id,b.hostname);return send(res,200,{project:projectView(id)}),true}
  return send(res,404,{error:'Route not found'}),true;
 }catch(e){
  const status=Number.isInteger(e.status)?e.status:422;
  if(status>=500||!e.status)console.warn('[create-api]',String(e.message||e).slice(0,300));
  return send(res,status,{error:String(e.message||e)}),true;
 }
}

module.exports={handle,jobs,streamSnapshot};

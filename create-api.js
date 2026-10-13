"use strict";
// HTTP API for the chat builder (/create). Owners (the Kairoq admin login) build
// without credits; customer accounts spend one credit per successful edit.
const crypto=require('crypto');
const builder=require('./react-builder'),hosting=require('./react-hosting'),accounts=require('./builder-accounts'),backend=require('./react-backend');

const jobs=new Map();
const attempts=new Map();
function send(res,status,data,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(JSON.stringify(data))}
function readJson(req,limit=200000){
 return new Promise((resolve,reject)=>{let body='';req.on('data',c=>{body+=c;if(body.length>limit){reject(Object.assign(Error('Request too large'),{status:413}));req.destroy()}});req.on('end',()=>{try{resolve(body?JSON.parse(body):{})}catch{reject(Object.assign(Error('Invalid JSON'),{status:400}))}});req.on('error',reject)});
}
async function readRaw(req,limit=65536){const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>limit)throw Object.assign(Error('Request too large'),{status:413});chunks.push(c)}return Buffer.concat(chunks)}
function limited(req,bucket,max=20,windowMs=600000){
 if(attempts.size>5000)attempts.clear();
 const key=bucket+':'+(String(req.headers['x-forwarded-for']||'').split(',')[0].trim()||req.socket?.remoteAddress||'local'),now=Date.now();
 const list=(attempts.get(key)||[]).filter(t=>now-t<windowMs);list.push(now);attempts.set(key,list);
 if(list.length>max)throw Object.assign(Error('Too many attempts. Try again in a few minutes.'),{status:429});
}
function origin(req){
 const configured=process.env.KAIROQ_PUBLIC_URL||(process.env.RAILWAY_PUBLIC_DOMAIN?'https://'+process.env.RAILWAY_PUBLIC_DOMAIN:'');
 if(configured)return configured.replace(/\/$/,'');
 return'http://'+String(req.headers.host||'localhost');
}

// Who is calling: a customer account, the Kairoq owner, or nobody.
function viewer(req,isOwner){
 const account=accounts.fromRequest(req);
 if(account)return{kind:'customer',owner:account.id,account};
 if(isOwner(req))return{kind:'owner',owner:'owner',account:null};
 return null;
}
function requireViewer(req,isOwner){const v=viewer(req,isOwner);if(!v)throw Object.assign(Error('Sign in to continue'),{status:401});return v}
function ownedProject(v,id){
 const meta=builder.loadMeta(id);
 if(meta.owner!==v.owner)throw Object.assign(Error('Unknown project'),{status:404});
 return meta;
}
function projectView(id){const d=builder.detail(id),meta=builder.loadMeta(id);return{...d,urls:hosting.siteUrls(meta),domains:(meta.domains||[]).map(x=>({...x,dns:hosting.dnsInstructions(x.hostname,x.token)}))}}

const ACTIVE=new Set(['queued','writing','fixing','building','testing','thinking']);
function intEnv(name,fallback){const n=Number(process.env[name]);return Number.isInteger(n)&&n>=0?n:fallback}
function tiers(){
 const paid=process.env.KAIROQ_BUILDER_PAID_APPROVED==='true';
 return[
  {id:'standard',label:'Standard',credits:intEnv('KAIROQ_STANDARD_CREDITS',1),enabled:true},
  {id:'pro',label:'Pro',credits:intEnv('KAIROQ_PRO_CREDITS',5),enabled:paid}
 ];
}
function cost({mode,tier,images}){
 if(mode==='discuss')return intEnv('KAIROQ_DISCUSS_CREDITS',1)+(images?intEnv('KAIROQ_IMAGE_CREDITS',1):0);
 const t=tiers().find(x=>x.id===tier);
 if(!t||!t.enabled)throw Object.assign(Error('That model tier is not available'),{status:400});
 return t.credits+(images?intEnv('KAIROQ_IMAGE_CREDITS',1):0);
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
 const files=[...new Set(matches.map(m=>m[1]))];
 const msg=/"message"\s*:\s*"((?:[^"\\]|\\.)*)/.exec(text);
 const last=matches.at(-1);
 // Only the code of the file being written, not the surrounding JSON.
 const code=last?text.slice(last.index+last[0].length).split(/(?<!\\)",\s*"(?:src\/|delete)/)[0].replace(/"\s*}\s*}?\s*$/,''):'';
 return{chars:text.length,files,current:last?last[1]:null,message:msg?msg[1].replace(/\\n/g,'\n').replace(/\\"/g,'"'):'',tail:code.slice(-1600)};
}
function startJob(v,id,{message,mode='build',tier='standard',images=[]},{callModel,checkRuntime}){
 for(const job of jobs.values())if(job.projectId===id&&ACTIVE.has(job.status))throw Object.assign(Error('This project is already being updated'),{status:409});
 if(mode!=='build'&&mode!=='discuss')throw Object.assign(Error('Unknown mode'),{status:400});
 const credits=cost({mode,tier,images:images.length>0});
 if(mode==='build'&&images.length){const names=require('./react-assets').save(id,images);images=images.map((img,i)=>({...img,name:names[i]}))}
 const job={id:crypto.randomUUID(),projectId:id,owner:v.owner,mode,tier,credits,status:'queued',seq:0,created_at:new Date().toISOString()};
 const update=patch=>{Object.assign(job,patch);job.seq++};
 // Customers pay up front; credits are refunded if the job fails.
 if(v.kind==='customer'&&credits>0)accounts.charge(v.account.id,credits,mode==='discuss'?'Discuss message':'Chat edit'+(tier==='pro'?' (Pro)':''),'job:'+job.id);
 jobs.set(job.id,job);
 setImmediate(async()=>{
  const modelTier=images.length&&tier!=='pro'?'vision':tier;
  const onStream=text=>update({stream:streamSnapshot(text,mode)});
  try{
   if(mode==='discuss'){update({status:'thinking'});job.result=await builder.discuss(id,message,{callModel,onStream,tier:modelTier,images})}
   else{
    const assetNote=images.length?require('./react-assets').note(id):'';
    job.result=await builder.edit(id,message,{callModel,onStream,tier:modelTier,images,checkRuntime,assetNote,onProgress:s=>update({status:s,stream:null})});
   }
   update({status:'complete'});
  }catch(e){
   update({status:'failed',error:String(e.message||e).slice(0,1200)});
   if(v.kind==='customer'&&credits>0)try{accounts.grant(v.account.id,credits,'Refund for failed '+(mode==='discuss'?'message':'edit'),'refund:'+job.id)}catch{}
  }
  job.finished_at=new Date().toISOString();
  setTimeout(()=>jobs.delete(job.id),3600000).unref?.();
 });
 return job;
}
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

async function handle(req,res,{isOwner,callModel,secure,checkRuntime}){
 const url=String(req.url||'').split('?')[0];
 if(!url.startsWith('/api/create/'))return false;
 const route=url.slice('/api/create'.length),method=req.method;
 try{
  // ----- accounts -----
  if(route==='/me'&&method==='GET'){
   const v=viewer(req,isOwner);
   return send(res,200,{viewer:v?{kind:v.kind,account:v.account}:null,signups:process.env.KAIROQ_BUILDER_SIGNUPS!=='closed',packs:accounts.packs().map(({price,...p})=>p),purchases:accounts.stripeConfigured(),free_credits:accounts.freeCredits(),tiers:tiers().map(({id,label,credits,enabled})=>({id,label,credits,enabled})),discuss_credits:intEnv('KAIROQ_DISCUSS_CREDITS',1),image_credits:intEnv('KAIROQ_IMAGE_CREDITS',1)}),true;
  }
  if(route==='/signup'&&method==='POST'){
   if(process.env.KAIROQ_BUILDER_SIGNUPS==='closed')throw Object.assign(Error('Sign-ups are closed'),{status:403});
   limited(req,'signup',10);
   const b=await readJson(req,10000),s=accounts.signup(b.email,b.password);
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
  const v=requireViewer(req,isOwner);
  if(route==='/credits'&&method==='GET'){
   if(v.kind!=='customer')return send(res,200,{unlimited:true,history:[]}),true;
   return send(res,200,{account:accounts.fromRequest(req),history:accounts.history(v.account.id)}),true;
  }
  if(route==='/checkout'&&method==='POST'){
   if(v.kind!=='customer')throw Object.assign(Error('The owner account does not use credits'),{status:400});
   const b=await readJson(req,5000);
   return send(res,200,await accounts.checkout(v.account,String(b.pack||''),origin(req))),true;
  }
  // ----- projects -----
  if(route==='/projects'&&method==='GET')return send(res,200,{projects:builder.list(v.owner)}),true;
  if(route==='/projects'&&method==='POST'){
   const b=await readJson(req,16000000);
   if(builder.list(v.owner).length>=Number(process.env.KAIROQ_BUILDER_MAX_PROJECTS||50))throw Object.assign(Error('Project limit reached. Delete a project to create another.'),{status:400});
   const prompt=String(b.prompt||'').trim();
   const meta=builder.create({name:b.name||prompt.split(/[.\n]/)[0].slice(0,60)||'Untitled app',owner:v.owner});
   await builder.initialize(meta);
   const job=prompt?startJob(v,meta.id,{message:prompt,tier:b.tier||'standard',images:parseImages(b.images)},{callModel,checkRuntime}):null;
   return send(res,201,{project:projectView(meta.id),job}),true;
  }
  const jm=/^\/jobs\/([a-f0-9-]{36})(\/events)?$/.exec(route);
  if(jm&&method==='GET'){
   const job=jobs.get(jm[1]);
   if(!job||job.owner!==v.owner)throw Object.assign(Error('Job not found or expired'),{status:404});
   if(jm[2])return streamJob(req,res,job),true;
   return send(res,200,{job:publicJob(job)}),true;
  }
  const pm=/^\/projects\/([a-f0-9]{12})(\/[a-z]+)?$/.exec(route);
  if(!pm)return send(res,404,{error:'Route not found'}),true;
  const id=pm[1],action=pm[2]||'';
  ownedProject(v,id);
  if(!action&&method==='GET')return send(res,200,{project:projectView(id),account:v.kind==='customer'?accounts.fromRequest(req):null}),true;
  if(!action&&method==='PATCH'){const b=await readJson(req,5000);builder.rename(id,b.name);return send(res,200,{project:projectView(id)}),true}
  if(!action&&method==='DELETE'){hosting.unpublish(id);backend.close(id);return send(res,200,builder.remove(id)),true}
  if(action==='/data'&&method==='GET')return send(res,200,backend.overview(id)),true;
  if(action==='/records'&&method==='GET')return send(res,200,{items:backend.ownerRecords(id,new URL(req.url,'http://x').searchParams.get('collection')||'')}),true;
  if(action==='/records'&&method==='DELETE'){const b=await readJson(req,2000);return send(res,200,backend.ownerDelete(id,b.id)),true}
  if(action==='/chat'&&method==='POST'){const b=await readJson(req,16000000);return send(res,202,{job:publicJob(startJob(v,id,{message:b.message,mode:b.mode||'build',tier:b.tier||'standard',images:parseImages(b.images)},{callModel,checkRuntime}))}),true}
  if(action==='/assets'&&method==='GET')return send(res,200,{assets:require('./react-assets').list(id)}),true;
  if(action==='/assets'&&method==='POST'){const b=await readJson(req,16000000);return send(res,201,{saved:require('./react-assets').save(id,parseImages(b.images)),assets:require('./react-assets').list(id)}),true}
  if(action==='/assets'&&method==='DELETE'){const b=await readJson(req,2000);require('./react-assets').remove(id,b.name);return send(res,200,{assets:require('./react-assets').list(id)}),true}
  if(action==='/asset'&&method==='GET'){const file=require('./react-assets').read(id,new URL(req.url,'http://x').searchParams.get('name'));if(!file)throw Object.assign(Error('Unknown image'),{status:404});res.writeHead(200,{'Content-Type':file.type,'Cache-Control':'private, max-age=300','X-Content-Type-Options':'nosniff'});res.end(file.bytes);return true}
  if(action==='/fix'&&method==='POST'){
   const b=await readJson(req,40000),meta=builder.loadMeta(id);
   const reported=Array.isArray(b.errors)?b.errors.map(e=>String(e).slice(0,800)).slice(0,10):[];
   const known=meta.versions.find(x=>x.n===meta.current_version)?.runtime_errors||[];
   const errors=[...new Set([...reported,...known])];
   if(!errors.length)throw Object.assign(Error('No errors to fix right now'),{status:400});
   return send(res,202,{job:publicJob(startJob(v,id,{message:'Fix these errors from the running app:\n'+errors.join('\n'),tier:b.tier||'standard'},{callModel,checkRuntime}))}),true;
  }
  if(action==='/file'&&method==='GET'){const name=new URL(req.url,'http://x').searchParams.get('path')||'';return send(res,200,{path:name,content:builder.readFile(id,name)}),true}
  if(action==='/restore'&&method==='POST'){const b=await readJson(req,2000);builder.restore(id,b.version);return send(res,200,{project:projectView(id)}),true}
  if(action==='/publish'&&method==='POST'){const b=await readJson(req,2000);hosting.publish(id,{slug:b.slug,version:b.version});return send(res,200,{project:projectView(id)}),true}
  if(action==='/unpublish'&&method==='POST'){hosting.unpublish(id);return send(res,200,{project:projectView(id)}),true}
  if(action==='/domains'&&method==='POST'){const b=await readJson(req,2000);hosting.addDomain(id,b.hostname);return send(res,200,{project:projectView(id)}),true}
  if(action==='/verify'&&method==='POST'){const b=await readJson(req,2000);const r=await hosting.verifyDomain(id,b.hostname);return send(res,200,{verified:r.verified,error:r.error,project:projectView(id)}),true}
  if(action==='/domains'&&method==='DELETE'){const b=await readJson(req,2000);hosting.removeDomain(id,b.hostname);return send(res,200,{project:projectView(id)}),true}
  return send(res,404,{error:'Route not found'}),true;
 }catch(e){
  const status=Number.isInteger(e.status)?e.status:422;
  if(status>=500||!e.status)console.warn('[create-api]',String(e.message||e).slice(0,300));
  return send(res,status,{error:String(e.message||e)}),true;
 }
}

module.exports={handle,jobs};

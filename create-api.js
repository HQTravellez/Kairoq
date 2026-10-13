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
 if(attempts.size>5000)attempts.clear();
 const key=bucket+':'+require('./client-ip').clientIp(req),now=Date.now();
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
// Roles on a project: the owner, or collaborators invited by email as editor or viewer.
const RANK={viewer:1,editor:2,owner:3};
function roleFor(v,meta){
 if(meta.owner===v.owner)return'owner';
 if(v.kind==='customer'){const m=(meta.members||[]).find(x=>x.email===v.account.email);if(m)return m.role}
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
 'GET:/security':'viewer','POST:/knowledge':'editor','GET:/secrets':'owner','POST:/secrets':'owner','GET:/members':'owner','POST:/members':'owner','DELETE:/members':'owner','POST:/share':'owner','GET:/analytics':'viewer','POST:/seo':'editor'};
function listFor(v){
 return builder.list().filter(p=>{if(p.owner===v.owner)return true;if(v.kind!=='customer')return false;try{return(builder.loadMeta(p.id).members||[]).some(m=>m.email===v.account.email)}catch{return false}})
  .map(p=>({...p,role:p.owner===v.owner?'owner':(builder.loadMeta(p.id).members||[]).find(m=>m.email===v.account.email).role}));
}
function findShare(token){
 if(!/^[a-f0-9]{24}$/.test(String(token)))return null;
 for(const p of builder.list()){const meta=builder.loadMeta(p.id);if(meta.share&&meta.share.token===token)return meta}
 return null;
}
function projectViewFor(id,role='owner'){const d=builder.detail(id),meta=builder.loadMeta(id);return{...d,role,members:role==='owner'?meta.members||[]:undefined,share:role==='owner'&&meta.share?{...meta.share,url:'/create/share/'+meta.share.token}:null,seo:meta.seo||null,knowledge:meta.knowledge||'',urls:hosting.siteUrls(meta),domains:(meta.domains||[]).map(x=>({...x,dns:hosting.dnsInstructions(x.hostname,x.token,x),https:x.railway?(x.railway.certificate||'pending'):(require('./react-railway').configured()?null:'manual')}))}}

const ACTIVE=new Set(['queued','writing','fixing','building','testing','thinking']);
function intEnv(name,fallback){const n=Number(process.env[name]);return Number.isInteger(n)&&n>=0?n:fallback}
function tiers(){
 const paid=process.env.KAIROQ_BUILDER_PAID_APPROVED==='true',max=Boolean(String(process.env.KAIROQ_MAX_MODELS||'').trim());
 return[
  {id:'standard',label:'Standard',credits:intEnv('KAIROQ_STANDARD_CREDITS',1),enabled:true},
  {id:'pro',label:'Pro',credits:intEnv('KAIROQ_PRO_CREDITS',5),enabled:paid},
  {id:'max',label:'Max',credits:intEnv('KAIROQ_MAX_CREDITS',15),enabled:paid}
 ].filter(t=>t.id!=='max'||max);
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
  const modelTier=images.length&&tier==='standard'?'vision':tier;
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

async function handle(req,res,{isOwner,callModel,secure,checkRuntime,screenshot}){
 const url=String(req.url||'').split('?')[0];
 if(!url.startsWith('/api/create/'))return false;
 const route=url.slice('/api/create'.length),method=req.method;
 try{
  // ----- accounts -----
  if(route==='/me'&&method==='GET'){
   const v=viewer(req,isOwner);
   return send(res,200,{viewer:v?{kind:v.kind,account:v.account}:null,signups:process.env.KAIROQ_BUILDER_SIGNUPS!=='closed',packs:accounts.packs().map(({price,...p})=>p),plans:accounts.plans().map(({price,...p})=>p),purchases:accounts.stripeConfigured(),subscriptions:accounts.stripeReady()&&accounts.plans().length>0,free_credits:accounts.freeCredits(),google:require('./google-oauth').configured(),email_ready:accounts.mailReady(),tiers:tiers().map(({id,label,credits,enabled})=>({id,label,credits,enabled})),discuss_credits:intEnv('KAIROQ_DISCUSS_CREDITS',1),image_credits:intEnv('KAIROQ_IMAGE_CREDITS',1)}),true;
  }
  if(route==='/auth/google'&&method==='GET'){
   const url=require('./google-oauth').startUrl({kind:'kairoq'},origin(req));
   res.writeHead(302,{Location:url,'Cache-Control':'no-store'});res.end();return true;
  }
  if(route==='/auth/google/callback'&&method==='GET'){
   const google=require('./google-oauth'),q=Object.fromEntries(new URL(req.url,'http://x').searchParams);
   try{
    const {entry,profile}=await google.finish(q,origin(req));
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
   return send(res,404,{error:'Route not found'}),true;
  }
  if(route==='/verify/resend'&&method==='POST'){
   if(v.kind!=='customer')throw Object.assign(Error('Owner accounts do not need verification'),{status:400});
   limited(req,'verify',5);return send(res,200,await accounts.sendVerification(v.account.id,origin(req))),true;
  }
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
   const job=prompt?startJob(v,meta.id,{message:prompt,tier:b.tier||'standard',images:parseImages(b.images)},{callModel,checkRuntime}):null;
   return send(res,201,{project:projectViewFor(meta.id),job}),true;
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
  if(action==='/members'&&method==='DELETE'){const b=await readJson(req,2000),meta=builder.loadMeta(id);meta.members=(meta.members||[]).filter(m=>m.email!==String(b.email||'').toLowerCase());builder.saveMeta(meta);return send(res,200,{members:meta.members,project:projectView(id)}),true}
  if(action==='/share'&&method==='POST'){
   const b=await readJson(req,2000),meta=builder.loadMeta(id);
   meta.share=b.enabled?{token:meta.share?.token||crypto.randomBytes(12).toString('hex'),remix:!!b.remix,at:new Date().toISOString()}:null;
   builder.saveMeta(meta);return send(res,200,{project:projectView(id)}),true;
  }
  if(!action&&method==='PATCH'){const b=await readJson(req,5000);builder.rename(id,b.name);return send(res,200,{project:projectView(id)}),true}
  if(!action&&method==='DELETE'){for(const d of builder.loadMeta(id).domains||[])await hosting.removeDomain(id,d.hostname);hosting.unpublish(id);backend.close(id);return send(res,200,builder.remove(id)),true}
  if(action==='/data'&&method==='GET')return send(res,200,backend.overview(id)),true;
  if(action==='/records'&&method==='GET')return send(res,200,{items:backend.ownerRecords(id,new URL(req.url,'http://x').searchParams.get('collection')||'')}),true;
  if(action==='/records'&&method==='DELETE'){const b=await readJson(req,2000);return send(res,200,backend.ownerDelete(id,b.id)),true}
  if(action==='/chat'&&method==='POST'){const b=await readJson(req,16000000);return send(res,202,{job:publicJob(startJob(v,id,{message:b.message,mode:b.mode||'build',tier:b.tier||'standard',images:parseImages(b.images)},{callModel,checkRuntime}))}),true}
  if(action==='/assets'&&method==='GET')return send(res,200,{assets:require('./react-assets').list(id)}),true;
  if(action==='/assets'&&method==='POST'){const b=await readJson(req,16000000);return send(res,201,{saved:require('./react-assets').save(id,parseImages(b.images)),assets:require('./react-assets').list(id)}),true}
  if(action==='/assets'&&method==='DELETE'){const b=await readJson(req,2000);require('./react-assets').remove(id,b.name);return send(res,200,{assets:require('./react-assets').list(id)}),true}
  if(action==='/asset'&&method==='GET'){const file=require('./react-assets').read(id,new URL(req.url,'http://x').searchParams.get('name'));if(!file)throw Object.assign(Error('Unknown image'),{status:404});res.writeHead(200,{'Content-Type':file.type,'Cache-Control':'private, max-age=300','X-Content-Type-Options':'nosniff'});res.end(file.bytes);return true}
  if(action==='/security'&&method==='GET'){
   const meta=builder.loadMeta(id),files=builder.loadFiles(id,meta.current_version);
   let cfg={collections:{}};try{cfg=backend.parseConfig(files)}catch{}
   return send(res,200,{version:meta.current_version,findings:require('./react-security').scan(files,cfg)}),true;
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
   return send(res,202,{job:publicJob(startJob(v,id,{message:'Fix these errors from the running app:\n'+errors.join('\n'),tier:b.tier||'standard'},{callModel,checkRuntime}))}),true;
  }
  if(action==='/file'&&method==='GET'){const name=new URL(req.url,'http://x').searchParams.get('path')||'';return send(res,200,{path:name,content:builder.readFile(id,name)}),true}
  if(action==='/restore'&&method==='POST'){const b=await readJson(req,2000);builder.restore(id,b.version);return send(res,200,{project:projectView(id)}),true}
  if(action==='/publish'&&method==='POST'){const b=await readJson(req,2000);hosting.publish(id,{slug:b.slug,version:b.version});
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

module.exports={handle,jobs};

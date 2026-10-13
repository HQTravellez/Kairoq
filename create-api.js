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

function startEdit(v,id,message,callModel){
 for(const job of jobs.values())if(job.projectId===id&&(job.status==='queued'||job.status==='writing'||job.status==='fixing'||job.status==='building'))throw Object.assign(Error('This project is already being updated'),{status:409});
 const job={id:crypto.randomUUID(),projectId:id,owner:v.owner,status:'queued',created_at:new Date().toISOString()};
 // Customers pay one credit up front; it is refunded if the edit fails.
 if(v.kind==='customer')accounts.charge(v.account.id,1,'Chat edit','job:'+job.id);
 jobs.set(job.id,job);
 setImmediate(async()=>{
  try{
   job.result=await builder.edit(id,message,{callModel,onProgress:s=>{job.status=s}});
   job.status='complete';
  }catch(e){
   job.status='failed';job.error=String(e.message||e).slice(0,1200);
   if(v.kind==='customer')try{accounts.grant(v.account.id,1,'Refund for failed edit','refund:'+job.id)}catch{}
  }
  job.finished_at=new Date().toISOString();
  setTimeout(()=>jobs.delete(job.id),3600000).unref?.();
 });
 return job;
}

async function handle(req,res,{isOwner,callModel,secure}){
 const url=String(req.url||'').split('?')[0];
 if(!url.startsWith('/api/create/'))return false;
 const route=url.slice('/api/create'.length),method=req.method;
 try{
  // ----- accounts -----
  if(route==='/me'&&method==='GET'){
   const v=viewer(req,isOwner);
   return send(res,200,{viewer:v?{kind:v.kind,account:v.account}:null,signups:process.env.KAIROQ_BUILDER_SIGNUPS!=='closed',packs:accounts.packs().map(({price,...p})=>p),purchases:accounts.stripeConfigured(),free_credits:accounts.freeCredits()}),true;
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
   const b=await readJson(req,20000);
   if(builder.list(v.owner).length>=Number(process.env.KAIROQ_BUILDER_MAX_PROJECTS||50))throw Object.assign(Error('Project limit reached. Delete a project to create another.'),{status:400});
   const prompt=String(b.prompt||'').trim();
   const meta=builder.create({name:b.name||prompt.split(/[.\n]/)[0].slice(0,60)||'Untitled app',owner:v.owner});
   await builder.initialize(meta);
   const job=prompt?startEdit(v,meta.id,prompt,callModel):null;
   return send(res,201,{project:projectView(meta.id),job}),true;
  }
  const jm=/^\/jobs\/([a-f0-9-]{36})$/.exec(route);
  if(jm&&method==='GET'){
   const job=jobs.get(jm[1]);
   if(!job||job.owner!==v.owner)throw Object.assign(Error('Job not found or expired'),{status:404});
   return send(res,200,{job}),true;
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
  if(action==='/chat'&&method==='POST'){const b=await readJson(req,20000);return send(res,202,{job:startEdit(v,id,b.message,callModel)}),true}
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

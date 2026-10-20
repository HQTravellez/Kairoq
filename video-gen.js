"use strict";
// Short videos made from a project's own photos with Wan 2.2 (image to video) on fal.ai:
//  - launch clips: vertical 9:16 clips for Reels, TikTok, WhatsApp status and Google Business,
//    downloaded by the owner and posted with the launch kit texts;
//  - hero videos: a calm 16:9 loop for the top of the site, copied into every build at
//    ./uploads/<name>.mp4 (react-assets.copyInto) so the app can use it as a muted background.
// Each clip is a fal queue request (submit, wait, download). Clips are kept per project in
// videos/ with their state in meta.videos; a clip that never finished (a restart) is marked
// failed by sweep() so its credits can be refunded. Needs FAL_KEY (Railway, Variables).
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const builder=require('./react-builder');

const MODEL_DEFAULT='fal-ai/wan/v2.2-a14b/image-to-video';
const MAX_VIDEO_BYTES=60*1024*1024,MAX_KEPT=24,MAX_RUNNING=4,STALE_MS=20*60000;
function fail(status,message){return Object.assign(Error(message),{status})}
function key(env=process.env){return env.FAL_KEY||env.FAL_API_KEY||''}
function configured(env=process.env){return Boolean(key(env))&&env.KAIROQ_VIDEOS!=='off'}
function queueBase(env=process.env){return String(env.KAIROQ_FAL_QUEUE_URL||'https://queue.fal.run').replace(/\/+$/,'')}
function model(env=process.env){const m=String(env.KAIROQ_VIDEO_MODEL||MODEL_DEFAULT).trim();return/^[a-z0-9._-]+(\/[a-z0-9._-]+)+$/i.test(m)?m:MODEL_DEFAULT}
function resolution(env=process.env){return env.KAIROQ_VIDEO_RESOLUTION==='480p'?'480p':'720p'}
function credits(){const raw=process.env.KAIROQ_VIDEO_CREDITS,n=Number(raw);return raw!==undefined&&String(raw).trim()!==''&&Number.isInteger(n)&&n>=0?n:10}
function dir(id){return path.join(builder.projectDir(id),'videos')}
function sleep(ms,signal){return new Promise((resolve,reject)=>{const t=setTimeout(resolve,ms);signal&&signal.addEventListener('abort',()=>{clearTimeout(t);reject(fail(499,'Stopped'))},{once:true})})}

// What the camera does. The photo stays as it is: Wan 2.2 animates the image it is given, and
// the prompt asks for movement only, so no invented products, people or text appear.
const KEEP='Keep everything in the photo exactly as it is: the same people, products, food, rooms, colours, text and logos. Add only gentle, natural motion (light, steam, water, leaves, fabric, a slight breeze). No new objects, people, text or logos. Realistic, warm, cinematic, sharp.';
function promptFor(kind,meta,note){
 const b=meta.business||{},who=[b.name||meta.name,b.type&&b.type!=='LocalBusiness'?b.type:'',b.city].filter(Boolean).join(', ');
 const move=kind==='hero'
  ?'Very slow, steady camera drift across this photo, calm and even from start to end, so it can loop quietly as a website background.'
  :'Smooth, slow vertical camera move over this photo, with a gentle push-in, made for a short social media clip.';
 return(move+' Photo of '+who+'. '+KEEP+(note?' Owner\'s note: '+String(note).replace(/\s+/g,' ').trim().slice(0,300):'')).slice(0,1500);
}

// ---------- fal.ai queue ----------
async function falJson(url,init,{signal,env}){
 const r=await fetch(url,{...init,signal,headers:{Authorization:'Key '+key(env),...(init&&init.body?{'Content-Type':'application/json'}:{}),Accept:'application/json'}});
 const text=await r.text();let body;try{body=JSON.parse(text)}catch{body=null}
 if(!r.ok){const d=body&&(body.detail||body.error||body.message);throw fail(r.status===401||r.status===403?503:502,'fal.ai '+r.status+': '+String(typeof d==='string'?d:d?JSON.stringify(d):text).slice(0,300))}
 return body||{};
}
// The address of the finished video must be https (or on the configured queue host, for tests).
function safeVideoUrl(u,env){const s=String(u||'');return /^https:\/\//.test(s)||s.startsWith(queueBase(env)+'/')?s:null}
async function render({imageDataUrl,prompt,aspect,signal,env=process.env,pollMs=Number(env.KAIROQ_VIDEO_POLL_MS||3000),timeoutMs=Number(env.KAIROQ_VIDEO_TIMEOUT_MS||12*60000)}){
 if(!configured(env))throw fail(503,'Videos need FAL_KEY in Railway (service, Variables).');
 const base=queueBase(env),m=model(env);
 const submitted=await falJson(base+'/'+m,{method:'POST',body:JSON.stringify({image_url:imageDataUrl,prompt,aspect_ratio:aspect,resolution:resolution(env),num_frames:81,frames_per_second:16,enable_safety_checker:true})},{signal,env});
 const rid=String(submitted.request_id||'');
 if(!/^[A-Za-z0-9-]{8,80}$/.test(rid))throw fail(502,'fal.ai did not accept the video request.');
 // fal returns where to ask; those must stay on the queue host.
 const app=m.split('/').slice(0,2).join('/'),onQueue=u=>typeof u==='string'&&u.startsWith(base+'/')?u:null;
 const statusUrl=onQueue(submitted.status_url)||base+'/'+app+'/requests/'+rid+'/status';
 const resultUrl=onQueue(submitted.response_url)||base+'/'+app+'/requests/'+rid;
 const until=Date.now()+timeoutMs;
 for(;;){
  const s=await falJson(statusUrl,{method:'GET'},{signal,env});
  if(s.status==='COMPLETED')break;
  if(s.status&&!['IN_QUEUE','IN_PROGRESS'].includes(s.status))throw fail(502,'fal.ai: '+String(s.status).slice(0,60));
  if(Date.now()>until)throw fail(504,'The video took too long to make.');
  await sleep(pollMs,signal);
 }
 const out=await falJson(resultUrl,{method:'GET'},{signal,env});
 const url=safeVideoUrl(out.video&&out.video.url,env);
 if(!url)throw fail(502,'fal.ai returned no video.');
 const r=await fetch(url,{signal});
 if(!r.ok)throw fail(502,'Could not download the video ('+r.status+').');
 const bytes=Buffer.from(await r.arrayBuffer());
 if(bytes.length<1000||bytes.length>MAX_VIDEO_BYTES)throw fail(502,'The video file was not usable.');
 if(bytes.slice(4,8).toString()!=='ftyp')throw fail(502,'The video is not an MP4 file.');
 return{bytes,request_id:rid,model:m};
}

// ---------- per-project clips ----------
function view(v){return{id:v.id,kind:v.kind,photo:v.photo,status:v.status,name:v.name||null,error:v.error||null,at:v.at,done_at:v.done_at||null,credits:v.credits||0,path:v.status==='done'&&v.kind==='hero'?'./uploads/'+v.name:null,...(v.status==='done'&&v.kind==='hero'?{site_message:heroMessage(v)}:{})}}
function list(id){return(builder.loadMeta(id).videos||[]).map(view)}
function update(id,vid,patch){const meta=builder.loadMeta(id);const v=(meta.videos||[]).find(x=>x.id===vid);if(!v)return null;Object.assign(v,patch);builder.saveMeta(meta);return v}
function photoDataUrl(id,photo){
 const file=require('./react-assets').read(id,photo);
 if(!file||!/^image\/(png|jpeg|webp)$/.test(file.type))throw fail(400,'Pick a PNG, JPG or WebP photo from your uploads.');
 return'data:'+file.type+';base64,'+file.bytes.toString('base64');
}
// Starts one clip per photo. charge(n, ref) takes the credits for all of them before anything
// is sent to fal; refund(n, ref) gives one clip's credits back when it fails. Returns the new
// clips; they finish in the background (list() shows their state).
function start(id,{kind,photos,note='',charge=()=>{},refund=()=>{},env=process.env,render:renderFn=render}){
 if(!configured(env))throw fail(503,'Videos need FAL_KEY in Railway (service, Variables).');
 if(!['launch','hero'].includes(kind))throw fail(400,'Choose launch clips or a hero video.');
 const wanted=[...new Set((Array.isArray(photos)?photos:[]).map(String))].slice(0,kind==='hero'?1:4);
 if(!wanted.length)throw fail(400,'Pick at least one photo.');
 const urls=wanted.map(p=>photoDataUrl(id,p));
 const meta=builder.loadMeta(id),all=meta.videos||[];
 if(all.filter(v=>v.status==='running').length+wanted.length>MAX_RUNNING)throw fail(409,'Videos are still being made for this project. Wait for them to finish.');
 const price=credits(),batch='video:'+id+':'+crypto.randomUUID();
 if(price>0)charge(price*wanted.length,batch);// throws when the account is short, before anything starts
 const made=wanted.map((photo,i)=>({id:crypto.randomBytes(6).toString('hex'),kind,photo,status:'running',at:new Date().toISOString(),credits:price,ref:batch+':'+i}));
 meta.videos=[...made,...all];builder.saveMeta(meta);
 const prompt=promptFor(kind,meta,note);
 made.forEach((v,i)=>{
  Promise.resolve().then(()=>renderFn({imageDataUrl:urls[i],prompt,aspect:kind==='hero'?'16:9':'9:16',env})).then(out=>{
   fs.mkdirSync(dir(id),{recursive:true});
   const name=(kind==='hero'?'hero-':'clip-')+v.id+'.mp4';
   fs.writeFileSync(path.join(dir(id),name),out.bytes);
   update(id,v.id,{status:'done',name,done_at:new Date().toISOString(),model:out.model,ref:undefined});
   prune(id);
  }).catch(e=>{
   update(id,v.id,{status:'failed',error:String(e.message||e).slice(0,300),done_at:new Date().toISOString(),ref:undefined});
   if(price>0)try{refund(price,v.ref)}catch{}
  });
 });
 return made.map(view);
}
// Clips still "running" long after they started (the server restarted) are marked failed and
// refunded.
function sweep(id,{refund=()=>{},now=Date.now()}={}){
 const meta=builder.loadMeta(id);let changed=false;
 for(const v of meta.videos||[])if(v.status==='running'&&now-Date.parse(v.at)>STALE_MS){
  v.status='failed';v.error='The video was interrupted. Your credits were refunded.';v.done_at=new Date(now).toISOString();changed=true;
  if(v.credits>0&&v.ref)try{refund(v.credits,v.ref)}catch{}
  v.ref=undefined;
 }
 if(changed)builder.saveMeta(meta);
}
// Keeps the newest clips; older finished ones (and their files) are removed.
function prune(id){
 const meta=builder.loadMeta(id),all=meta.videos||[];
 if(all.length<=MAX_KEPT)return;
 const keep=all.slice(0,MAX_KEPT),drop=all.slice(MAX_KEPT).filter(v=>v.status!=='running');
 for(const v of drop)if(v.name)try{fs.rmSync(path.join(dir(id),v.name))}catch{}
 meta.videos=[...keep,...all.slice(MAX_KEPT).filter(v=>v.status==='running')];builder.saveMeta(meta);
}
function remove(id,vid){
 const meta=builder.loadMeta(id),v=(meta.videos||[]).find(x=>x.id===String(vid));
 if(!v)throw fail(404,'Unknown video');
 if(v.status==='running')throw fail(409,'This video is still being made.');
 if(v.name)try{fs.rmSync(path.join(dir(id),v.name))}catch{}
 meta.videos=meta.videos.filter(x=>x!==v);builder.saveMeta(meta);
 return list(id);
}
function read(id,name){
 if(!/^(hero|clip)-[a-f0-9]{12}\.mp4$/.test(String(name)))return null;
 const file=path.join(dir(id),name);
 return fs.existsSync(file)?file:null;
}
// Hero videos go into every build next to the uploads, so the site can play them.
function copyInto(id,publicDir){
 const d=dir(id);if(!fs.existsSync(d))return;
 const heroes=fs.readdirSync(d).filter(f=>/^hero-[a-f0-9]{12}\.mp4$/.test(f));
 if(!heroes.length)return;
 fs.mkdirSync(path.join(publicDir,'uploads'),{recursive:true});
 for(const f of heroes)fs.copyFileSync(path.join(d,f),path.join(publicDir,'uploads',f));
}
// Sends a clip to the owner's browser, in byte ranges so Safari can play it.
function sendFile(req,res,file,{download=null}={}){
 const size=fs.statSync(file).size,m=/^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range||''));
 const headers={'Content-Type':'video/mp4','Accept-Ranges':'bytes','Cache-Control':'private, max-age=300','X-Content-Type-Options':'nosniff',...(download?{'Content-Disposition':'attachment; filename="'+download+'"'}:{})};
 if(m&&(m[1]||m[2])){
  const start=m[1]?Number(m[1]):Math.max(0,size-Number(m[2])),end=m[1]&&m[2]?Math.min(Number(m[2]),size-1):size-1;
  if(start>=size||start>end){res.writeHead(416,{'Content-Range':'bytes */'+size});return res.end()}
  res.writeHead(206,{...headers,'Content-Range':'bytes '+start+'-'+end+'/'+size,'Content-Length':end-start+1});
  return fs.createReadStream(file,{start,end}).pipe(res);
 }
 res.writeHead(200,{...headers,'Content-Length':size});
 fs.createReadStream(file).pipe(res);
}
// The chat message that puts a finished hero video on the site (a normal, priced edit).
function heroMessage(v){
 return'Use the video ./uploads/'+v.name+' as the background of the hero section at the top of the home page: a <video> with autoPlay, muted, loop and playsInline, object-fit cover, poster="./uploads/'+v.photo+'", and a dark overlay so the heading and buttons stay readable. When the visitor prefers reduced motion (prefers-reduced-motion: reduce), show only the poster image. Keep the existing heading, text and buttons.';
}
module.exports={configured,credits,model,promptFor,render,start,list,sweep,remove,read,copyInto,heroMessage,sendFile};

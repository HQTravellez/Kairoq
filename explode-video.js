"use strict";
// Product explode films: from one product photo to a scroll section where the product comes
// apart into its layers and goes back together as the visitor scrolls (the "Apple" technique).
//  1. Stills: the image model (the builder's generateImage, with the photo as reference) makes the
//     product whole on a dark studio stage, then the same shot exploded into its parts. The owner
//     looks at both and approves them or asks for new ones.
//  2. Film: Google's Gemini Omni Flash (gemini-omni-1.1-flash, Gemini API "interactions") moves
//     from the first still to the last one. 16:9 for the site; a 9:16 reel too when asked.
//  3. Frames: ffmpeg cuts the film into numbered WebP frames that go into every build at
//     ./uploads/explode-<id>/001.webp..., played by <ScrollVideo> from 'kairoq/scroll'.
// Credits are taken before each paid step and given back when it fails. Needs GEMINI_API_KEY
// (with billing on in Google AI Studio) and the builder's image generation.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{execFile}=require('child_process');
const builder=require('./react-builder');

const MODEL_DEFAULT='gemini-omni-1.1-flash';
const MAX_FILM_BYTES=80*1024*1024,MAX_KEPT=8,STALE_MS=25*60000,MAX_FRAMES=144;
function fail(status,message){return Object.assign(Error(message),{status})}
function key(env=process.env){return env.GEMINI_API_KEY||''}
function apiBase(env=process.env){return String(env.KAIROQ_GEMINI_API_BASE||'https://generativelanguage.googleapis.com').replace(/\/+$/,'')}
function model(env=process.env){const m=String(env.KAIROQ_EXPLODE_MODEL||MODEL_DEFAULT).trim();return/^[a-z0-9.-]+$/.test(m)?m:MODEL_DEFAULT}
function resolution(env=process.env){return['720p','1080p'].includes(env.KAIROQ_EXPLODE_RESOLUTION)?env.KAIROQ_EXPLODE_RESOLUTION:'720p'}
function configured(env=process.env,{images=true}={}){return Boolean(key(env))&&images&&env.KAIROQ_EXPLODE!=='off'}
function intEnv(name,def){const raw=process.env[name],n=Number(raw);return raw!==undefined&&String(raw).trim()!==''&&Number.isInteger(n)&&n>=0?n:def}
// Credits: the two stills; the film for the site; the 9:16 reel (another film).
function prices(){return{stills:intEnv('KAIROQ_EXPLODE_STILLS_CREDITS',3),film:intEnv('KAIROQ_EXPLODE_CREDITS',25),reel:intEnv('KAIROQ_EXPLODE_REEL_CREDITS',25)}}
function dir(id,eid){return path.join(builder.projectDir(id),'explodes',...(eid?[eid]:[]))}
function sleep(ms,signal){return new Promise((resolve,reject)=>{const t=setTimeout(resolve,ms);signal&&signal.addEventListener('abort',()=>{clearTimeout(t);reject(fail(499,'Stopped'))},{once:true})})}
const clean=s=>String(s||'').replace(/[\u0000-\u001f<>{}]/g,' ').replace(/\s+/g,' ').trim().slice(0,300);

// ---------- prompts ----------
// The photo decides what the product is; the owner's note says what it is and what is inside.
function stillPrompts(note){
 const what=note?' The owner says: "'+note+'".':'';
 return{
  start:'Studio product photograph made from the reference photo. Show exactly the same product, whole and assembled, centred in a wide 16:9 frame with generous empty space around it (the product fills about half the height). Deep charcoal seamless studio backdrop, soft key light from the upper left, a thin bright rim light along its edges, a soft shadow beneath it. Keep its shape, colours, materials, proportions and any printed details exactly as in the photo. Nothing else in the frame.'+what,
  end:'Exploded-view studio photograph of exactly this product, from the same camera, same framing, same charcoal backdrop and same lighting as the reference. Separate it into its real components, each floating apart along the vertical axis in its real order, evenly spaced with clear gaps, every part fully visible inside the frame and nothing cut off; the whole stack is centred. Only the parts this product really has, each with the same shape, colour and material as in the reference. Photoreal, no labels, arrows or lines.'+what,
 };
}
function filmPrompt(note,aspect){
 const what=note?' The product: '+note+'.':'';
 return('<FIRST_FRAME> <LAST_FRAME> Cinematic studio product film.'+what+' It starts exactly on the first frame with the product whole. Its parts slowly and smoothly lift apart, each moving straight along its own axis with a gentle ease, into the exploded arrangement of the last frame, with a slow, slight camera push-in. One continuous shot, no cuts. The same charcoal backdrop and lighting throughout. Every part keeps its exact shape, colour and material; nothing new appears; no people, hands, text or logos are added.'+(aspect==='9:16'?' Framed vertically with the product centred.':'')+' It ends exactly on the last frame.').slice(0,1800);
}

// ---------- Gemini API (Omni Flash) ----------
async function gJson(url,init,{signal,env}){
 const r=await fetch(url,{...init,signal,headers:{'x-goog-api-key':key(env),...(init&&init.body?{'Content-Type':'application/json'}:{})}});
 const text=await r.text();let body;try{body=JSON.parse(text)}catch{body=null}
 if(!r.ok){const m=body&&body.error&&(body.error.message||body.error.status);throw fail(r.status===401||r.status===403?503:r.status===429?429:502,'Google video '+r.status+': '+String(m||text).slice(0,300))}
 return body||{};
}
// The video in a response: the first {type:"video"} item, inline (data) or as a file (uri).
function findVideo(v,depth=0){
 if(!v||typeof v!=='object'||depth>8)return null;
 if(!Array.isArray(v)&&(v.type==='video'||/^video\//.test(String(v.mime_type||'')))&&(v.data||v.uri))return v;
 for(const x of Array.isArray(v)?v:Object.values(v)){const f=findVideo(x,depth+1);if(f)return f}
 return null;
}
// A file the API made: only on the API host (the key is sent there), waited for until ACTIVE.
async function downloadFile(uri,{signal,env,pollMs,until}){
 const base=apiBase(env),m=/\/(?:v1beta\/)?files\/([a-z0-9-]{1,64})(?::download)?(?:\?.*)?$/i.exec(String(uri));
 if(!String(uri).startsWith(base+'/')||!m)throw fail(502,'Google returned a video address Kairoq does not trust.');
 for(;;){
  const f=await gJson(base+'/v1beta/files/'+m[1],{method:'GET'},{signal,env});
  if(!f.state||f.state==='ACTIVE')break;
  if(f.state==='FAILED')throw fail(502,'Google could not finish the video file.');
  if(Date.now()>until)throw fail(504,'The film took too long to make.');
  await sleep(pollMs,signal);
 }
 const r=await fetch(base+'/v1beta/files/'+m[1]+':download?alt=media',{signal,headers:{'x-goog-api-key':key(env)}});
 if(!r.ok)throw fail(502,'Could not download the film ('+r.status+').');
 return Buffer.from(await r.arrayBuffer());
}
// One film between two stills. first/last: {mime, data(base64)}.
async function render({first,last,prompt,aspect='16:9',signal,env=process.env,pollMs=Number(env.KAIROQ_VIDEO_POLL_MS||5000),timeoutMs=Number(env.KAIROQ_VIDEO_TIMEOUT_MS||15*60000)}){
 if(!key(env))throw fail(503,'Explode films need GEMINI_API_KEY in Railway (service, Variables), with billing on in Google AI Studio.');
 const until=Date.now()+timeoutMs,base=apiBase(env);
 const body={model:model(env),input:[{type:'image',data:first.data,mime_type:first.mime},{type:'image',data:last.data,mime_type:last.mime},{type:'text',text:prompt}],
  response_format:{type:'video',aspect_ratio:aspect,resolution:resolution(env),delivery:'uri'},store:false};
 const out=await gJson(base+'/v1beta/interactions',{method:'POST',body:JSON.stringify(body)},{signal,env});
 const video=findVideo(out);
 if(!video)throw fail(502,'Google returned no film'+(out.status?' ('+String(out.status).slice(0,40)+')':'')+'.');
 const bytes=video.data?Buffer.from(String(video.data),'base64'):await downloadFile(video.uri,{signal,env,pollMs,until});
 if(bytes.length<1000||bytes.length>MAX_FILM_BYTES)throw fail(502,'The film file was not usable.');
 if(bytes.slice(4,8).toString()!=='ftyp')throw fail(502,'The film is not an MP4 file.');
 return{bytes,model:body.model};
}

// ---------- frames ----------
function run(cmd,args,timeout=120000){return new Promise((resolve,reject)=>execFile(cmd,args,{timeout},(e,so,se)=>e?reject(fail(500,'ffmpeg: '+String(se||e.message).slice(-300))):resolve(so)))}
// The film as numbered WebP frames (12 a second, at most MAX_FRAMES, 1280 wide). Returns the count.
async function cutFrames(film,out,{ffmpeg=process.env.FFMPEG_PATH||'ffmpeg'}={}){
 fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
 await run(ffmpeg,['-hide_banner','-loglevel','error','-y','-i',film,'-vf','fps=12,scale=1280:-2:flags=lanczos','-frames:v',String(MAX_FRAMES),'-c:v','libwebp','-quality','74','-compression_level','4',path.join(out,'%03d.webp')]);
 const n=fs.readdirSync(out).filter(f=>/^\d{3}\.webp$/.test(f)).length;
 if(n<8)throw fail(502,'The film gave too few frames.');
 return n;
}

// ---------- per-project explodes ----------
function heroMessage(e){
 return'Add a full-width scroll section between the hero and the next section that shows our product coming apart into its layers and going back together as the visitor scrolls: <ScrollVideo src="./uploads/explode-'+e.id+'/" frames={'+e.frames+'} alt="'+(e.note||'The product, exploded into its parts').replace(/"/g,"'")+'" /> from \'kairoq/scroll\'. Give it three or four captions (the captions prop) about what is inside, in our voice, drawn only from what the site already says about the product.';
}
function view(e){
 const done=e.status==='done';
 return{id:e.id,photo:e.photo,note:e.note||'',status:e.status,error:e.error||null,at:e.at,credits:e.credits||0,
  stills:e.stills?{start:'start.'+e.stills.start,end:'end.'+e.stills.end}:null,film:done?'film.mp4':null,reel:done&&e.reel?'reel.mp4':null,
  frames:done?e.frames:0,...(done?{site_message:heroMessage(e)}:{})};
}
function list(id){return(builder.loadMeta(id).explodes||[]).map(view)}
function update(id,eid,patch){const meta=builder.loadMeta(id);const e=(meta.explodes||[]).find(x=>x.id===eid);if(!e)return null;Object.assign(e,patch);builder.saveMeta(meta);return e}
function find(id,eid){const e=(builder.loadMeta(id).explodes||[]).find(x=>x.id===String(eid));if(!e)throw fail(404,'Unknown explode film');return e}
function photoOf(id,photo){
 const file=require('./react-assets').read(id,photo);
 if(!file||!/^image\/(png|jpeg|webp)$/.test(file.type))throw fail(400,'Pick a PNG, JPG or WebP photo of the product from your uploads.');
 return file;
}
const EXT={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'};
const MIME={png:'image/png',jpg:'image/jpeg',webp:'image/webp'};
function readStill(id,e,which){const ext=e.stills[which],bytes=fs.readFileSync(path.join(dir(id,e.id),which+'.'+ext));return{mime:MIME[ext],data:bytes.toString('base64')}}

// Makes the two stills in the background. generateImage({prompt, aspect, references}) is the
// builder's image model; references are data: URLs.
function makeStills(id,e,{generateImage,refund,note}){
 const price=prices().stills,ref=e.ref;
 Promise.resolve().then(async()=>{
  const photo=photoOf(id,e.photo),p=stillPrompts(note);
  const start=await generateImage({prompt:p.start,aspect:'16:9',references:['data:'+photo.type+';base64,'+photo.bytes.toString('base64')]});
  const end=await generateImage({prompt:p.end,aspect:'16:9',references:['data:'+start.mime+';base64,'+start.data]});
  const d=dir(id,e.id);fs.mkdirSync(d,{recursive:true});
  for(const f of fs.readdirSync(d))if(/^(start|end)\./.test(f))fs.rmSync(path.join(d,f));
  const stills={start:EXT[start.mime]||'png',end:EXT[end.mime]||'png'};
  fs.writeFileSync(path.join(d,'start.'+stills.start),Buffer.from(start.data,'base64'));
  fs.writeFileSync(path.join(d,'end.'+stills.end),Buffer.from(end.data,'base64'));
  update(id,e.id,{status:'review',stills,error:null,ref:undefined,at:new Date().toISOString()});
 }).catch(err=>{
  update(id,e.id,{status:'failed',error:String(err.message||err).slice(0,300),ref:undefined});
  if(price>0)try{refund(price,ref)}catch{}
 });
}
// Step 1: a product photo (and the owner's note) to two stills for approval.
function start(id,{photo,note='',charge=()=>{},refund=()=>{},generateImage,env=process.env}){
 if(!configured(env,{images:Boolean(generateImage)}))throw fail(503,'Explode films need GEMINI_API_KEY and image generation on this server.');
 photoOf(id,String(photo||''));
 const meta=builder.loadMeta(id),all=meta.explodes||[];
 if(all.some(x=>x.status==='stills'||x.status==='rendering'))throw fail(409,'An explode film is still being made for this project. Wait for it to finish.');
 const price=prices().stills,ref='explode:'+id+':'+crypto.randomUUID();
 if(price>0)charge(price,ref,'Explode stills');
 const e={id:crypto.randomBytes(6).toString('hex'),photo:String(photo),note:clean(note),status:'stills',at:new Date().toISOString(),credits:price,ref};
 meta.explodes=[e,...all];builder.saveMeta(meta);prune(id);
 makeStills(id,e,{generateImage,refund,note:e.note});
 return view(e);
}
// New stills for the same photo (a changed note is used from now on).
function redo(id,eid,{note,charge=()=>{},refund=()=>{},generateImage,env=process.env}){
 if(!configured(env,{images:Boolean(generateImage)}))throw fail(503,'Explode films need GEMINI_API_KEY and image generation on this server.');
 const e=find(id,eid);
 if(e.status==='stills'||e.status==='rendering')throw fail(409,'This explode film is still being made.');
 const price=prices().stills,ref='explode:'+id+':'+crypto.randomUUID();
 if(price>0)charge(price,ref,'Explode stills');
 const patch={status:'stills',error:null,ref,credits:(e.credits||0)+price,...(note!==undefined?{note:clean(note)}:{})};
 const fresh=update(id,eid,patch);
 makeStills(id,fresh,{generateImage,refund,note:fresh.note});
 return view(fresh);
}
// Step 2: the owner approved the stills: the film (and the reel), then the frames.
function film(id,eid,{reel=false,charge=()=>{},refund=()=>{},env=process.env,render:renderFn=render,ffmpeg}){
 if(!configured(env))throw fail(503,'Explode films need GEMINI_API_KEY in Railway (service, Variables).');
 const e=find(id,eid);
 if(e.status!=='review'&&e.status!=='done')throw fail(409,e.status==='failed'?'Make new stills first.':'Wait until the stills are ready.');
 if(!e.stills)throw fail(409,'Make the stills first.');
 const p=prices(),price=p.film+(reel?p.reel:0),ref='explode:'+id+':'+crypto.randomUUID();
 if(price>0)charge(price,ref,reel?'Explode film and reel':'Explode film');
 const fresh=update(id,eid,{status:'rendering',error:null,ref,reel:Boolean(reel),credits:(e.credits||0)+price,started:new Date().toISOString()});
 const first=readStill(id,e,'start'),last=readStill(id,e,'end'),d=dir(id,eid);
 Promise.resolve().then(async()=>{
  const wide=await renderFn({first,last,prompt:filmPrompt(e.note,'16:9'),aspect:'16:9',env});
  fs.writeFileSync(path.join(d,'film.mp4'),wide.bytes);
  const frames=await cutFrames(path.join(d,'film.mp4'),path.join(d,'frames'),{ffmpeg});
  fs.rmSync(path.join(d,'reel.mp4'),{force:true});
  if(reel){const tall=await renderFn({first,last,prompt:filmPrompt(e.note,'9:16'),aspect:'9:16',env});fs.writeFileSync(path.join(d,'reel.mp4'),tall.bytes)}
  update(id,eid,{status:'done',frames,model:wide.model,ref:undefined,done_at:new Date().toISOString()});
 }).catch(err=>{
  // The stills stay, so the owner can try the film again.
  update(id,eid,{status:'review',error:'The film was not made: '+String(err.message||err).slice(0,260)+(price?' Your credits were refunded.':''),ref:undefined});
  if(price>0)try{refund(price,ref)}catch{}
 });
 return view(fresh);
}
// Steps still running long after they started (a restart): refunded and set back.
function sweep(id,{refund=()=>{},now=Date.now()}={}){
 const meta=builder.loadMeta(id);let changed=false;
 for(const e of meta.explodes||[])if((e.status==='stills'||e.status==='rendering')&&now-Date.parse(e.started||e.at)>STALE_MS){
  const back=e.status==='rendering'?'review':'failed';
  e.error='This step was interrupted. Your credits were refunded.';changed=true;
  if(e.ref)try{refund(e.status==='rendering'?prices().film+(e.reel?prices().reel:0):prices().stills,e.ref)}catch{}
  e.status=back;e.ref=undefined;
 }
 if(changed)builder.saveMeta(meta);
}
function prune(id){
 const meta=builder.loadMeta(id),all=meta.explodes||[];
 if(all.length<=MAX_KEPT)return;
 const drop=all.slice(MAX_KEPT).filter(e=>e.status!=='stills'&&e.status!=='rendering');
 for(const e of drop)fs.rmSync(dir(id,e.id),{recursive:true,force:true});
 meta.explodes=all.filter(e=>!drop.includes(e));builder.saveMeta(meta);
}
function remove(id,eid){
 const meta=builder.loadMeta(id),e=(meta.explodes||[]).find(x=>x.id===String(eid));
 if(!e)throw fail(404,'Unknown explode film');
 if(e.status==='stills'||e.status==='rendering')throw fail(409,'This explode film is still being made.');
 fs.rmSync(dir(id,e.id),{recursive:true,force:true});
 meta.explodes=meta.explodes.filter(x=>x!==e);builder.saveMeta(meta);
 return list(id);
}
// The owner's files: the stills, the film and the reel.
function read(id,eid,name){
 if(!/^[a-f0-9]{12}$/.test(String(eid))||!/^(start\.(png|jpg|webp)|end\.(png|jpg|webp)|film\.mp4|reel\.mp4)$/.test(String(name)))return null;
 const file=path.join(dir(id,String(eid)),name);
 return fs.existsSync(file)?{file,type:name.endsWith('.mp4')?'video/mp4':MIME[name.split('.').pop()]}:null;
}
// Finished frames go into every build at ./uploads/explode-<id>/.
function copyInto(id,publicDir){
 for(const e of builder.loadMeta(id).explodes||[]){
  if(e.status!=='done'&&!(e.status==='review'&&e.frames))continue;
  const src=path.join(dir(id,e.id),'frames');if(!fs.existsSync(src))continue;
  const out=path.join(publicDir,'uploads','explode-'+e.id);fs.mkdirSync(out,{recursive:true});
  for(const f of fs.readdirSync(src))if(/^\d{3}\.webp$/.test(f))fs.copyFileSync(path.join(src,f),path.join(out,f));
 }
}
module.exports={configured,prices,model,stillPrompts,filmPrompt,render,findVideo,cutFrames,start,redo,film,list,sweep,remove,read,copyInto,heroMessage};

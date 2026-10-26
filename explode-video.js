"use strict";
// Product films: one product photo, one button ("Make it move"), and Kairoq does the rest.
//  1. Motion: from the owner's line ("chocolate pouring over it") or the product: pour, splash,
//     steam, explode (comes apart into its layers) or turn.
//  2. Stills: the image model (the builder's generateImage, the photo as reference) makes the
//     product on a stage in the site's own background colour, then the same shot at the end of the
//     motion. Kairoq's vision check looks at both; when they look wrong it makes them once more.
//  3. Film: Google's Gemini Omni Flash (gemini-omni-1.1-flash, Gemini API "interactions") moves
//     from the first still to the last. ffmpeg cuts it into numbered WebP frames that go into
//     every build at ./uploads/explode-<id>/, played by <ScrollVideo layout="split"> from
//     'kairoq/scroll' beside a headline. A 9:16 reel to post is made from the same stills.
//  4. Done: the scene is added to the site with a normal build (onDone).
// Also the site reel: a screenshot of the site on a laptop on a cafe table, filmed in 9:16.
// One price, taken first; given back when the film cannot be made (the reel's part when only the
// reel fails). Needs GEMINI_API_KEY (billing on in Google AI Studio) and image generation.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{execFile}=require('child_process');
const builder=require('./react-builder');

const MODEL_DEFAULT='gemini-omni-1.1-flash';
const MAX_FILM_BYTES=80*1024*1024,MAX_KEPT=8,STALE_MS=30*60000,MAX_FRAMES=144;
function fail(status,message){return Object.assign(Error(message),{status})}
function key(env=process.env){return env.GEMINI_API_KEY||''}
function apiBase(env=process.env){return String(env.KAIROQ_GEMINI_API_BASE||'https://generativelanguage.googleapis.com').replace(/\/+$/,'')}
function model(env=process.env){const m=String(env.KAIROQ_EXPLODE_MODEL||MODEL_DEFAULT).trim();return/^[a-z0-9.-]+$/.test(m)?m:MODEL_DEFAULT}
function resolution(env=process.env){return['720p','1080p'].includes(env.KAIROQ_EXPLODE_RESOLUTION)?env.KAIROQ_EXPLODE_RESOLUTION:'720p'}
function configured(env=process.env,{images=true}={}){return Boolean(key(env))&&images&&env.KAIROQ_EXPLODE!=='off'}
function intEnv(name,def){const raw=process.env[name],n=Number(raw);return raw!==undefined&&String(raw).trim()!==''&&Number.isInteger(n)&&n>=0?n:def}
// One price per product film (stills, film and reel) and one per site reel.
function prices(){return{film:intEnv('KAIROQ_FILM_CREDITS',50),reel_part:intEnv('KAIROQ_FILM_REEL_PART',20),site_reel:intEnv('KAIROQ_SITE_REEL_CREDITS',25)}}
function dir(id,eid){return path.join(builder.projectDir(id),'explodes',...(eid?[eid]:[]))}
function sleep(ms,signal){return new Promise((resolve,reject)=>{const t=setTimeout(resolve,ms);signal&&signal.addEventListener('abort',()=>{clearTimeout(t);reject(fail(499,'Stopped'))},{once:true})})}
const clean=s=>String(s||'').replace(/[\u0000-\u001f<>{}]/g,' ').replace(/\s+/g,' ').trim().slice(0,300);

// ---------- motion and prompts ----------
const MOTIONS=['pour','splash','steam','explode','turn'];
// The motion the owner's words ask for; otherwise one that suits most products.
function motionOf(note){
 const t=String(note||'').toLowerCase();
 if(/\b(pour|pouring|drizzl\w*|sauce|syrup|melt\w*|caramel|honey|glaze)\b/.test(t))return'pour';
 if(/\b(splash\w*|drop|droplet|drip\w*|wave)\b/.test(t))return'splash';
 if(/\b(steam\w*|smok\w*|hot|sizzl\w*|rising|vapou?r)\b/.test(t))return'steam';
 if(/\b(explod\w*|apart|layers?|inside|parts?|ingredients?|components?|stack\w*)\b/.test(t))return'explode';
 if(/\b(turn\w*|spin\w*|rotat\w*|360)\b/.test(t))return'turn';
 // A list of what is in it ("a burger: bun, patty, cheese") reads as its layers.
 if(t.split(',').length>=3)return'explode';
 return'turn';
}
// The stage: the site's own background colour (from the design brief), dark or light.
function stageOf(design){
 const hex=String(design&&design.palette&&design.palette.background||'#141414').toLowerCase();
 const m=/^#([0-9a-f]{6})$/.exec(hex),n=m?parseInt(m[1],16):0x141414;
 const lum=(0.2126*(n>>16&255)+0.7152*(n>>8&255)+0.0722*(n&255))/255;
 return{hex:m?hex:'#141414',dark:lum<0.5};
}
function stillPrompts(note,motion,stage){
 const what=note?' The owner says: "'+note+'".':'';
 const room='Seamless studio backdrop in the colour '+stage.hex+' ('+(stage.dark?'dark':'light')+'), soft key light from the upper left, a thin rim light along its edges, a soft shadow beneath it.';
 const keep='Keep its shape, colours, materials, proportions and any printed details exactly as in the reference.';
 const end={
  pour:'The same shot, a moment later: a glossy, thick stream of the sauce or liquid that suits this product (as the owner says) pours onto it from above, mid-pour, with a few drips running down its side.',
  splash:'The same shot, a moment later: a single drop of the liquid that suits this product lands beside it with a crisp crown splash, droplets frozen in the air.',
  steam:'The same shot, a moment later: soft wisps of steam rise from the product and curl upward into the backdrop.',
  explode:'The same shot as an exploded view: the product separated into its real components, each floating apart along the vertical axis in its real order, evenly spaced with clear gaps, every part fully visible and nothing cut off; the stack is centred. Only the parts this product really has.',
  turn:'The same product, same backdrop and lighting, seen from a three-quarter angle after it has turned about 90 degrees on its own axis, still centred.',
 }[motion];
 return{
  start:'Studio product photograph made from the reference photo. Exactly the same product, whole, centred in a wide 16:9 frame with generous empty space around it (it fills about half the height). '+room+' '+keep+' Nothing else in the frame.'+what,
  end:end+' Same camera, framing, backdrop colour ('+stage.hex+') and lighting as the reference. '+keep+' Photoreal, no labels, arrows or lines.'+what,
 };
}
function filmPrompt(note,motion,aspect){
 const what=note?' The product: '+note+'.':'';
 const move={
  pour:'The sauce or liquid begins to pour from above and flows slowly over the product, glossy and thick, in slow motion.',
  splash:'A drop falls and lands beside the product with a slow-motion crown splash.',
  steam:'Soft steam begins to rise from the product and drifts upward.',
  explode:'Its parts slowly and smoothly lift apart, each moving straight along its own axis with a gentle ease, into the exploded arrangement of the last frame.',
  turn:'The product turns slowly on its own axis.',
 }[motion];
 return('<FIRST_FRAME> <LAST_FRAME> Cinematic studio product film.'+what+' It starts exactly on the first frame. '+move+' A slow, slight camera push-in. One continuous shot, no cuts. The same backdrop and lighting throughout. The product keeps its exact shape, colour and material; nothing else appears; no people, hands, text or logos are added.'+(aspect==='9:16'?' Framed vertically with the product centred.':'')+' It ends exactly on the last frame.').slice(0,1800);
}
const REVIEW=(note,motion)=>'These two pictures are the first and last still of a short product film'+(note?' ("'+String(note).slice(0,200)+'")':'')+'; the film shows: '+motion+'. Judge them like an art director. Do both show the same product, clearly and in full (nothing cut off), on a clean studio backdrop, photoreal, with no text, labels or extra objects? Does the second clearly show the '+motion+' moment? Reply with ONLY JSON: {"ok":true} or {"ok":false,"problems":["...", "..."]} (at most 3).';
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
// One film from a first still (and a last still, when the motion has one). Stills: {mime, data(base64)}.
async function render({first,last,prompt,aspect='16:9',signal,env=process.env,pollMs=Number(env.KAIROQ_VIDEO_POLL_MS||5000),timeoutMs=Number(env.KAIROQ_VIDEO_TIMEOUT_MS||15*60000)}){
 if(!key(env))throw fail(503,'Product films need GEMINI_API_KEY in Railway (service, Variables), with billing on in Google AI Studio.');
 const until=Date.now()+timeoutMs,base=apiBase(env);
 const body={model:model(env),input:[{type:'image',data:first.data,mime_type:first.mime},...(last?[{type:'image',data:last.data,mime_type:last.mime}]:[]),{type:'text',text:prompt}],
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

// ---------- per-project films ----------
// The message that adds a finished film to the site as a scene (a normal build).
function heroMessage(e){
 return'Add a full-width scene section for our product between the hero and the next section: <ScrollVideo layout="split" src="./uploads/explode-'+e.id+'/" frames={'+e.frames+'} title="..." text="..." cta={{ label: "...", href: "..." }} alt="'+(e.note||'Our product').replace(/"/g,"'")+'" /> from \'kairoq/scroll\'. Write the title as a short, confident headline (three to five words) and the text as one sentence, in our voice, about '+(e.note?'"'+e.note.replace(/"/g,"'")+'"':'the product')+', using only what the site already says; the button goes to the main action of the site (order, book or shop).';
}
function view(e){
 const done=e.status==='done';
 return{id:e.id,photo:e.photo,note:e.note||'',motion:e.motion,kind:e.kind||'product',status:e.status,step:e.step||null,error:e.error||null,at:e.at,credits:e.credits||0,
  film:done&&e.kind!=='site'?'film.mp4':null,reel:done&&e.reel?'reel.mp4':null,frames:done?e.frames||0:0,on_site:Boolean(e.on_site),
  ...(done&&e.kind!=='site'?{site_message:heroMessage(e)}:{})};
}
function list(id){return(builder.loadMeta(id).explodes||[]).map(view)}
function update(id,eid,patch){const meta=builder.loadMeta(id);const e=(meta.explodes||[]).find(x=>x.id===eid);if(!e)return null;Object.assign(e,patch);builder.saveMeta(meta);return e}
function photoOf(id,photo){
 const file=require('./react-assets').read(id,photo);
 if(!file||!/^image\/(png|jpeg|webp)$/.test(file.type))throw fail(400,'Pick a PNG, JPG or WebP photo of the product from your uploads.');
 return file;
}
const EXT={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'};
const MIME={png:'image/png',jpg:'image/jpeg',webp:'image/webp'};
function saveStill(d,name,pic){for(const f of fs.readdirSync(d))if(f.startsWith(name+'.'))fs.rmSync(path.join(d,f));fs.writeFileSync(path.join(d,name+'.'+(EXT[pic.mime]||'png')),Buffer.from(pic.data,'base64'))}
function busy(id){return(builder.loadMeta(id).explodes||[]).some(x=>x.status==='making')}
function begin(id,fields,{charge,price,label}){
 if(busy(id))throw fail(409,'A film is still being made for this project. Wait for it to finish.');
 const ref='film:'+id+':'+crypto.randomUUID();
 if(price>0)charge(price,ref,label);
 const meta=builder.loadMeta(id),e={id:crypto.randomBytes(6).toString('hex'),status:'making',step:'Starting',at:new Date().toISOString(),credits:price,ref,...fields};
 meta.explodes=[e,...(meta.explodes||[])];builder.saveMeta(meta);prune(id);
 fs.mkdirSync(dir(id,e.id),{recursive:true});
 return e;
}
// "Make it move": photo (and the owner's line) to a film on the site and a reel to post.
// review({request,pictures,prompt}) is the vision check; onDone(view) adds the scene to the site.
function make(id,{photo,note='',charge=()=>{},refund=()=>{},generateImage,review,onDone=()=>{},env=process.env,render:renderFn=render,ffmpeg}){
 if(!configured(env,{images:Boolean(generateImage)}))throw fail(503,'Product films need GEMINI_API_KEY and image generation on this server.');
 const file=photoOf(id,String(photo||'')),text=clean(note),motion=motionOf(text),stage=stageOf(builder.loadMeta(id).design);
 const p=prices(),e=begin(id,{kind:'product',photo:String(photo),note:text,motion},{charge,price:p.film,label:'Product film'});
 const d=dir(id,e.id),step=s=>update(id,e.id,{step:s});
 Promise.resolve().then(async()=>{
  // Stills, checked; once more when the check finds problems.
  const prompts=stillPrompts(text,motion,stage);let start,end,problems=[];
  for(let round=1;round<=2;round++){
   step(round===1?'Making the stills':'Making better stills');
   const fix=problems.length?' Fix: '+problems.join('; '):'';
   start=await generateImage({prompt:prompts.start+fix,aspect:'16:9',references:['data:'+file.type+';base64,'+file.bytes.toString('base64')]});
   end=await generateImage({prompt:prompts.end+fix,aspect:'16:9',references:['data:'+start.mime+';base64,'+start.data]});
   if(!review)break;
   step('Checking the stills');
   let v=null;try{v=await review({request:text||'a product film',pictures:[start,end].map(x=>({data:x.data,mime:x.mime})),prompt:REVIEW(text,motion)})}catch{v=null}
   if(!v||v.ok)break;
   problems=(v.problems||[]).map(String).slice(0,3);
   if(round===2)throw fail(422,'The stills did not look right ('+problems.join('; ').slice(0,200)+'). Try a clearer photo of the product on its own.');
  }
  saveStill(d,'start',start);saveStill(d,'end',end);
  step('Filming');
  const wide=await renderFn({first:start,last:end,prompt:filmPrompt(text,motion,'16:9'),aspect:'16:9',env});
  fs.writeFileSync(path.join(d,'film.mp4'),wide.bytes);
  const frames=await cutFrames(path.join(d,'film.mp4'),path.join(d,'frames'),{ffmpeg});
  update(id,e.id,{frames,model:wide.model});
  // The reel: when it fails, the film stays and the reel's part is given back.
  step('Making the reel');
  let reel=false;
  try{const tall=await renderFn({first:start,last:end,prompt:filmPrompt(text,motion,'9:16'),aspect:'9:16',env});fs.writeFileSync(path.join(d,'reel.mp4'),tall.bytes);reel=true}
  catch{if(p.reel_part>0)try{refund(Math.min(p.reel_part,p.film),e.ref+':reel')}catch{}}
  const done=update(id,e.id,{status:'done',step:null,reel,ref:undefined,done_at:new Date().toISOString()});
  try{await onDone(view(done))}catch{}
 }).catch(err=>{
  update(id,e.id,{status:'failed',step:null,error:String(err.message||err).slice(0,300)+(p.film?' Your credits were refunded.':''),ref:undefined});
  if(p.film>0)try{refund(p.film,e.ref)}catch{}
 });
 return view(e);
}
// "Make a reel of my site": the site's screenshot on a laptop on a cafe table, filmed in 9:16.
// shot: {mime, data} of the site's screenshot.
function siteReel(id,{shot,charge=()=>{},refund=()=>{},generateImage,env=process.env,render:renderFn=render}){
 if(!configured(env,{images:Boolean(generateImage)}))throw fail(503,'Reels need GEMINI_API_KEY and image generation on this server.');
 if(!shot||!/^image\/(png|jpeg)$/.test(shot.mime))throw fail(503,'Kairoq could not take a picture of the site.');
 const p=prices(),e=begin(id,{kind:'site',note:'',motion:'site'},{charge,price:p.site_reel,label:'Site reel'});
 const d=dir(id,e.id),step=s=>update(id,e.id,{step:s});
 Promise.resolve().then(async()=>{
  step('Making the picture');
  const still=await generateImage({aspect:'9:16',references:['data:'+shot.mime+';base64,'+shot.data],prompt:'A modern silver laptop open on a warm wooden cafe table, seen from a slightly low angle, its screen showing exactly the website in the reference picture: the same layout, text, colours and images, sharp and readable. A cup of coffee and soft window light in a blurred cafe behind. Vertical 9:16 photo. Do not change or invent anything on the screen.'});
  saveStill(d,'start',still);
  step('Filming');
  const out=await renderFn({first:still,prompt:'<FIRST_FRAME> A slow, smooth camera push-in towards the laptop screen on the cafe table; soft steam rises from the coffee; warm light shifts gently. One continuous shot. The website on the screen stays exactly as it is: no changes to its text, layout or images. No people, no hands.',aspect:'9:16',env});
  fs.writeFileSync(path.join(d,'reel.mp4'),out.bytes);
  update(id,e.id,{status:'done',step:null,reel:true,ref:undefined,model:out.model,done_at:new Date().toISOString()});
 }).catch(err=>{
  update(id,e.id,{status:'failed',step:null,error:String(err.message||err).slice(0,300)+(p.site_reel?' Your credits were refunded.':''),ref:undefined});
  if(p.site_reel>0)try{refund(p.site_reel,e.ref)}catch{}
 });
 return view(e);
}
// Films still "making" long after they started (a restart): refunded and marked failed.
function sweep(id,{refund=()=>{},now=Date.now()}={}){
 const meta=builder.loadMeta(id);let changed=false;
 for(const e of meta.explodes||[])if(e.status==='making'&&now-Date.parse(e.at)>STALE_MS){
  if(e.ref&&e.credits)try{refund(e.credits,e.ref)}catch{}
  Object.assign(e,{status:'failed',step:null,error:'This was interrupted. Your credits were refunded.',ref:undefined});changed=true;
 }
 if(changed)builder.saveMeta(meta);
}
function prune(id){
 const meta=builder.loadMeta(id),all=meta.explodes||[];
 if(all.length<=MAX_KEPT)return;
 const drop=all.slice(MAX_KEPT).filter(e=>e.status!=='making');
 for(const e of drop)fs.rmSync(dir(id,e.id),{recursive:true,force:true});
 meta.explodes=all.filter(e=>!drop.includes(e));builder.saveMeta(meta);
}
function remove(id,eid){
 const meta=builder.loadMeta(id),e=(meta.explodes||[]).find(x=>x.id===String(eid));
 if(!e)throw fail(404,'Unknown film');
 if(e.status==='making')throw fail(409,'This film is still being made.');
 fs.rmSync(dir(id,e.id),{recursive:true,force:true});
 meta.explodes=meta.explodes.filter(x=>x!==e);builder.saveMeta(meta);
 return list(id);
}
function markOnSite(id,eid){update(id,String(eid),{on_site:true})}
// The owner's files: the stills, the film and the reel.
function read(id,eid,name){
 if(!/^[a-f0-9]{12}$/.test(String(eid))||!/^(start\.(png|jpg|webp)|end\.(png|jpg|webp)|film\.mp4|reel\.mp4)$/.test(String(name)))return null;
 const file=path.join(dir(id,String(eid)),name);
 return fs.existsSync(file)?{file,type:name.endsWith('.mp4')?'video/mp4':MIME[name.split('.').pop()]}:null;
}
// Finished frames go into every build at ./uploads/explode-<id>/.
function copyInto(id,publicDir){
 for(const e of builder.loadMeta(id).explodes||[]){
  if(e.status!=='done'||!e.frames)continue;
  const src=path.join(dir(id,e.id),'frames');if(!fs.existsSync(src))continue;
  const out=path.join(publicDir,'uploads','explode-'+e.id);fs.mkdirSync(out,{recursive:true});
  for(const f of fs.readdirSync(src))if(/^\d{3}\.webp$/.test(f))fs.copyFileSync(path.join(src,f),path.join(out,f));
 }
}
module.exports={MOTIONS,configured,prices,model,motionOf,stageOf,stillPrompts,filmPrompt,render,findVideo,cutFrames,make,siteReel,list,sweep,remove,read,copyInto,heroMessage,markOnSite};

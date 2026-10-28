"use strict";
// 3D models in a Create project. Owners upload a model (.glb, or FBX/OBJ/STL/PLY/.blend/zip
// that Blender converts) or add one from Poly Haven (CC0). Each model is kept as one GLB file
// with a still preview picture, copied into every build at ./models/<file>, and shown in the
// app with Model3D from 'kairoq/3d' (react-model3d.js), which handles phones, AR and fallbacks.
// HDRI lighting from Poly Haven is kept the same way (./models/<file>.hdr).
const fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto');
const builder=require('./react-builder');

const MAX_MODELS=12,MAX_INPUT=60*1024*1024,MAX_GLB=25*1024*1024,MAX_TOTAL=160*1024*1024,OPTIMIZE_OVER=12*1024*1024;
const VIEWER_VERSION='4.4.0',VIEWER_FILE='model-viewer-'+VIEWER_VERSION+'.min.js';
// Google <model-viewer> (Apache-2.0), its bundled build with three.js inside. Served to the Create
// editor at /vendor/model-viewer/ and copied into apps that show 3D.
const VIEWER_SRC=path.join(__dirname,'public','vendor','model-viewer',VIEWER_FILE);
const FILE=/^[a-z0-9][a-z0-9-]{0,60}\.(glb|png|jpg|hdr)$/;
// The 3D styles an owner can pick in the look chooser (looks.js reads these too).
const STYLES={
 none:{label:'No 3D',hint:''},
 product:{label:'Product viewer',hint:'Show the main model large near the top with mode="product": visitors drag to turn it, pinch to zoom, and on phones "View in your room" opens AR.'},
 walkthrough:{label:'Room walkthrough',hint:'Use mode="walkthrough" for the space: a tall viewer with 3 to 6 labelled hotspots (hotspots prop) for the main features, plus buttons that move the camera to each.'},
 scroll:{label:'Scroll story',hint:'Use mode="scroll" in a tall section (about 300vh) with a sticky viewer: give 3 to 5 camera stops (stops prop) and a short caption that changes with each stop.'},
 background:{label:'3D background',hint:'Use mode="background" behind the hero only: slow turn, no controls, text on a solid or blurred panel so it stays readable.'},
};
function fail(status,message){return Object.assign(Error(message),{status})}
function dir(id){return path.join(builder.projectDir(id),'models')}
function indexFile(id){return path.join(dir(id),'models.json')}
function load(id){try{return JSON.parse(fs.readFileSync(indexFile(id),'utf8'))}catch{return[]}}
function store(id,items){fs.mkdirSync(dir(id),{recursive:true});const tmp=indexFile(id)+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,JSON.stringify(items,null,1));fs.renameSync(tmp,indexFile(id))}
function slug(s){return String(s||'model').toLowerCase().replace(/\.[a-z0-9]+$/,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)||'model'}
// File names carry a short hash, so a replaced model never shows an old cached copy.
function fileName(stem,bytes,ext){return slug(stem)+'-'+crypto.createHash('sha256').update(bytes).digest('hex').slice(0,8)+'.'+ext}
function view(m){return{...m,path:'./models/'+m.file,poster_path:m.poster?'./models/'+m.poster:null}}
function list(id){return load(id).map(view)}
function totalBytes(id){return load(id).reduce((n,m)=>n+(m.bytes||0)+(m.poster_bytes||0),0)}

// A GLB file: 'glTF' magic, version 2, and the length it says it has.
function isGlb(b){return b.length>=20&&b.readUInt32LE(0)===0x46546c67&&b.readUInt32LE(4)===2&&b.readUInt32LE(8)===b.length}
function isPng(b){return b.length>8&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))}
function isJpg(b){return b.length>3&&b[0]===0xff&&b[1]===0xd8}
function isHdr(b){return /^#\?(RADIANCE|RGBE)/.test(b.subarray(0,16).toString('latin1'))}
// The names of the animations inside a GLB (walk, run, jump...), read from its JSON chunk.
function animationNames(glb){
 try{
  if(!isGlb(glb)||glb.readUInt32LE(16)!==0x4e4f534a)return[];
  const doc=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString('utf8'));
  return(doc.animations||[]).map((a,i)=>String(a&&a.name||'Animation '+(i+1)).replace(/[^\w .|-]/g,'').slice(0,60)).filter(Boolean).slice(0,40);
 }catch{return[]}
}

// Packs a glTF (JSON plus its .bin and texture files) into one GLB. resource(uri) returns the
// bytes of a file the glTF points to.
function packGlb(json,resource){
 const doc=JSON.parse(JSON.stringify(json));
 if(String(doc.asset&&doc.asset.version)!=='2.0')throw fail(400,'Only glTF 2.0 models can be used');
 const chunks=[];let offset=0;
 const add=buf=>{const at=offset;chunks.push(buf);offset+=buf.length;const pad=(4-offset%4)%4;if(pad){chunks.push(Buffer.alloc(pad));offset+=pad}return at};
 const dataUri=uri=>{const m=/^data:[^;,]*(;base64)?,(.*)$/s.exec(uri);if(!m)throw fail(400,'Bad embedded data in the model');return m[1]?Buffer.from(m[2],'base64'):Buffer.from(decodeURIComponent(m[2]))};
 const starts=(doc.buffers||[]).map(b=>{const bytes=b.uri?(b.uri.startsWith('data:')?dataUri(b.uri):resource(b.uri)):null;if(!bytes)throw fail(400,'The model is missing its .bin file');return add(bytes.subarray(0,b.byteLength))});
 for(const v of doc.bufferViews||[]){v.byteOffset=(v.byteOffset||0)+starts[v.buffer||0];v.buffer=0}
 doc.bufferViews=doc.bufferViews||[];
 for(const img of doc.images||[]){
  if(!img.uri)continue;
  const bytes=img.uri.startsWith('data:')?dataUri(img.uri):resource(img.uri);
  if(!bytes)throw fail(400,'The model is missing a texture ('+String(img.uri).slice(0,60)+')');
  img.mimeType=isPng(bytes)?'image/png':isJpg(bytes)?'image/jpeg':bytes.subarray(8,12).toString('latin1')==='WEBP'?'image/webp':null;
  if(!img.mimeType)throw fail(400,'The model has a texture that is not PNG, JPEG or WebP');
  doc.bufferViews.push({buffer:0,byteOffset:add(bytes),byteLength:bytes.length});img.bufferView=doc.bufferViews.length-1;delete img.uri;
 }
 const bin=Buffer.concat(chunks);
 doc.buffers=bin.length?[{byteLength:bin.length}]:[];
 let text=Buffer.from(JSON.stringify(doc));const jpad=(4-text.length%4)%4;if(jpad)text=Buffer.concat([text,Buffer.alloc(jpad,0x20)]);
 const head=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);
 const total=12+8+text.length+(bin.length?8+bin.length:0);
 head.writeUInt32LE(0x46546c67,0);head.writeUInt32LE(2,4);head.writeUInt32LE(total,8);
 jh.writeUInt32LE(text.length,0);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(bin.length,0);bh.writeUInt32LE(0x004e4942,4);
 return Buffer.concat([head,jh,text,...(bin.length?[bh,bin]:[])]);
}

function room(id,adding){
 const items=load(id);
 if(items.length>=MAX_MODELS)throw fail(400,'A project can hold up to '+MAX_MODELS+' 3D files. Remove one first.');
 if(totalBytes(id)+adding>MAX_TOTAL)throw fail(413,'3D files in a project are limited to '+Math.round(MAX_TOTAL/1048576)+' MB in total.');
 return items;
}
function keep(id,entry,glb,poster){
 const items=room(id,glb.length+(poster?poster.length:0));
 fs.mkdirSync(dir(id),{recursive:true});
 const ext=entry.kind==='environment'?'hdr':'glb';
 const file=fileName(entry.title||'model',glb,ext);
 fs.writeFileSync(path.join(dir(id),file),glb);
 let posterFile=null;
 if(poster){posterFile=file.replace(/\.(glb|hdr)$/,isJpg(poster)?'.jpg':'.png');fs.writeFileSync(path.join(dir(id),posterFile),poster)}
 const animations=ext==='glb'?animationNames(glb):[];
 const item={file,kind:entry.kind||'model',title:String(entry.title||'Model').slice(0,80),bytes:glb.length,poster:posterFile,poster_bytes:poster?poster.length:0,
  source:entry.source||{provider:'upload'},converted:entry.converted||null,info:entry.info||null,...(animations.length?{animations}:{}),added_at:new Date().toISOString()};
 store(id,[...items.filter(m=>m.file!==file),item]);
 return view(item);
}

// A model Kairoq's Blender modelling agent made (model-agent.js), with its preview picture.
function saveMade(id,glb,poster,title){
 if(!isGlb(glb))throw fail(422,'The made model is not a valid GLB file');
 return keep(id,{title:title||'Model',kind:'model',source:{provider:'kairoq-blender'}},glb,poster&&isPng(poster)?poster:null);
}

// An upload from the owner. name: the original file name; bytes: the file.
async function upload(id,name,bytes,{blender=require('./blender')}={}){
 builder.loadMeta(id);
 const ext=path.extname(String(name||'')).slice(1).toLowerCase();
 const title=path.basename(String(name||'model'),path.extname(String(name||''))).replace(/[_-]+/g,' ').replace(/[^\p{L}\p{N} '&().]+/gu,'').replace(/\s+/g,' ').trim().slice(0,80)||'Model';
 if(!['glb',...blender.INPUTS].includes(ext))throw fail(400,'Upload a 3D model: .glb, or .fbx, .obj, .stl, .ply, .blend or a .zip with a .gltf and its files.');
 if(!bytes||!bytes.length)throw fail(400,'The file is empty');
 if(bytes.length>MAX_INPUT)throw fail(413,'3D files up to '+Math.round(MAX_INPUT/1048576)+' MB');
 room(id,0);
 if(ext==='glb'&&!isGlb(bytes))throw fail(400,'That file is not a valid .glb model');
 // A small GLB is kept as it is; Blender only adds the preview picture.
 if(ext==='glb'&&(bytes.length<=OPTIMIZE_OVER||!blender.available())){
  if(bytes.length>MAX_GLB)throw fail(413,'This model is '+Math.round(bytes.length/1048576)+' MB. Make it smaller (gltf.report can compress it) or ask for Blender on the server.');
  let poster=null;
  if(blender.available()){const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-model-in-'));try{const f=path.join(tmp,'model.glb');fs.writeFileSync(f,bytes);const r=await blender.run(f,{out:false,poster:true});poster=r.poster?fs.readFileSync(r.poster):null;fs.rmSync(r.dir,{recursive:true,force:true})}catch{}finally{fs.rmSync(tmp,{recursive:true,force:true})}}
  return keep(id,{title,kind:'model',source:{provider:'upload',name:String(name).slice(0,120)}},bytes,poster);
 }
 if(ext==='gltf'){
  // A single .gltf only works when everything is inside it (data: links); otherwise a zip.
  let json;try{json=JSON.parse(bytes.toString('utf8'))}catch{throw fail(400,'That .gltf file is not valid')}
  const glb=packGlb(json,()=>{throw fail(400,'This .gltf uses separate files. Upload a .zip with the .gltf, its .bin and its textures, or a .glb.')});
  return upload(id,slug(name)+'.glb',glb,{blender});
 }
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-model-in-'));
 try{
  const f=path.join(tmp,'upload.'+ext);fs.writeFileSync(f,bytes);
  const r=await blender.run(f,{out:true,poster:true});
  try{
   const glb=fs.readFileSync(r.glb);
   if(!isGlb(glb))throw fail(422,'Blender could not make a web model from this file');
   if(glb.length>MAX_GLB)throw fail(413,'Even after shrinking, this model is '+Math.round(glb.length/1048576)+' MB. Try a simpler model.');
   return keep(id,{title,kind:'model',source:{provider:'upload',name:String(name).slice(0,120)},converted:ext==='glb'?'optimized':'from .'+ext,info:r.info},glb,r.poster?fs.readFileSync(r.poster):null);
  }finally{fs.rmSync(r.dir,{recursive:true,force:true})}
 }finally{fs.rmSync(tmp,{recursive:true,force:true})}
}

// ---------- Poly Haven (polyhaven.com, CC0; api.polyhaven.com) ----------
const UA='Kairoq-Create (+https://kairoq.com)';
let phCache={};
async function phJson(url,fetchImpl){const r=await fetchImpl(url,{headers:{'User-Agent':UA,Accept:'application/json'},signal:AbortSignal.timeout(20000)});if(!r.ok)throw fail(502,'Poly Haven answered HTTP '+r.status);return r.json()}
async function phBytes(url,fetchImpl,limit){
 const u=new URL(url);if(u.protocol!=='https:'||!/(^|\.)polyhaven\.(org|com)$/.test(u.hostname))throw fail(502,'Unexpected Poly Haven download address');
 const r=await fetchImpl(u.href,{headers:{'User-Agent':UA},signal:AbortSignal.timeout(60000)});if(!r.ok)throw fail(502,'Poly Haven download failed (HTTP '+r.status+')');
 const b=Buffer.from(await r.arrayBuffer());if(b.length>limit)throw fail(413,'This Poly Haven file is too big');return b;
}
async function phAssets(type,fetchImpl){
 const hit=phCache[type];if(hit&&Date.now()-hit.at<3600000)return hit.data;
 const data=await phJson('https://api.polyhaven.com/assets?t='+type,fetchImpl);phCache[type]={at:Date.now(),data};return data;
}
async function searchPolyHaven(query,{kind='model',fetchImpl=fetch,limit=12}={}){
 const type=kind==='environment'?'hdris':'models';
 const all=await phAssets(type,fetchImpl);
 const words=String(query||'').toLowerCase().split(/[^a-z0-9]+/).filter(w=>w.length>1).slice(0,8);
 const rows=Object.entries(all).map(([id,a])=>{const hay=[id,a.name,...(a.tags||[]),...(a.categories||[])].join(' ').toLowerCase();return{id,a,score:words.length?words.filter(w=>hay.includes(w)).length:1}}).filter(x=>x.score>0);
 rows.sort((x,y)=>y.score-x.score||(y.a.download_count||0)-(x.a.download_count||0));
 return rows.slice(0,Math.min(24,limit)).map(({id,a})=>({id,kind,title:String(a.name||id).slice(0,80),thumb:'https://cdn.polyhaven.com/asset_img/thumbs/'+encodeURIComponent(id)+'.png?width=256&height=256',source_url:'https://polyhaven.com/a/'+id,categories:(a.categories||[]).slice(0,4)}));
}
async function addPolyHaven(id,assetId,{kind='model',fetchImpl=fetch}={}){
 builder.loadMeta(id);
 const pid=String(assetId||'');if(!/^[a-z0-9_]{2,80}$/i.test(pid))throw fail(400,'Pick a Poly Haven model');
 const type=kind==='environment'?'hdris':'models',all=await phAssets(type,fetchImpl),a=all[pid];
 if(!a)throw fail(404,'That Poly Haven '+(kind==='environment'?'lighting':'model')+' was not found');
 if(load(id).some(m=>m.source&&m.source.provider==='polyhaven'&&m.source.id===pid))throw fail(409,'"'+(a.name||pid)+'" is already in this project');
 const files=await phJson('https://api.polyhaven.com/files/'+encodeURIComponent(pid),fetchImpl);
 const source={provider:'polyhaven',id:pid,title:a.name||pid,creator:Object.keys(a.authors||{}).join(', ')||'Poly Haven',license:'CC0',url:'https://polyhaven.com/a/'+pid};
 let thumb=null;try{const t=await phBytes('https://cdn.polyhaven.com/asset_img/thumbs/'+encodeURIComponent(pid)+'.png?width=640&height=480',fetchImpl,3*1024*1024);thumb=isPng(t)?t:null}catch{}
 if(kind==='environment'){
  const hdr=files.hdri&&(files.hdri['1k']||files.hdri['2k']);const f=hdr&&hdr.hdr;
  if(!f||!f.url)throw fail(502,'Poly Haven has no HDR file for this lighting');
  const bytes=await phBytes(f.url,fetchImpl,12*1024*1024);if(!isHdr(bytes))throw fail(502,'Poly Haven sent a file that is not HDR lighting');
  return keep(id,{title:source.title,kind:'environment',source},bytes,thumb);
 }
 const g=files.gltf&&(files.gltf['1k']||files.gltf['2k']);const main=g&&g.gltf;
 if(!main||!main.url)throw fail(502,'Poly Haven has no web (glTF) version of this model');
 const json=JSON.parse((await phBytes(main.url,fetchImpl,8*1024*1024)).toString('utf8'));
 const res={};let total=0;
 for(const [rel,info] of Object.entries(main.include||{})){const b=await phBytes(typeof info==='string'?info:info&&info.url,fetchImpl,MAX_GLB);total+=b.length;if(total>40*1024*1024)throw fail(413,'This Poly Haven model is too big');res[rel]=b}
 const glb=packGlb(json,uri=>res[decodeURIComponent(uri)]||res[uri]||null);
 if(glb.length>MAX_GLB)throw fail(413,'This Poly Haven model is too big');
 return keep(id,{title:source.title,kind:'model',source},glb,thumb);
}

// ---------- Poly Pizza (poly.pizza; api.poly.pizza, key in POLY_PIZZA_KEY) ----------
// Over 10,000 free low-poly models, many animated (Quaternius, Kenney and others). Only models
// under CC0 (no credit needed) or CC-BY (credit the creator; the app shows it) are offered.
const PP_API='https://api.poly.pizza/v1';
function polyPizzaReady(){return Boolean(process.env.POLY_PIZZA_KEY)&&process.env.KAIROQ_POLYPIZZA!=='off'}
function ppLicence(v){const s=String(v||'').toUpperCase().replace(/\s+/g,' ');return /^CC0/.test(s)||/PUBLIC DOMAIN/.test(s)?'CC0':/^CC[- ]BY( 3\.0| 4\.0)?$/.test(s)?'CC-BY':null}
async function ppJson(pathname,fetchImpl){
 if(!polyPizzaReady())throw fail(409,'Finding ready-made characters needs a Poly Pizza key (POLY_PIZZA_KEY on the server).');
 const r=await fetchImpl(PP_API+pathname,{headers:{'X-Auth-Token':process.env.POLY_PIZZA_KEY,Accept:'application/json','User-Agent':UA},signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw fail(502,'Poly Pizza answered HTTP '+r.status);return r.json();
}
async function ppBytes(url,fetchImpl,limit){
 const u=new URL(url);if(u.protocol!=='https:'||!/(^|\.)poly\.pizza$/.test(u.hostname))throw fail(502,'Unexpected Poly Pizza download address');
 const r=await fetchImpl(u.href,{headers:{'User-Agent':UA},signal:AbortSignal.timeout(60000)});if(!r.ok)throw fail(502,'Poly Pizza download failed (HTTP '+r.status+')');
 const b=Buffer.from(await r.arrayBuffer());if(b.length>limit)throw fail(413,'This Poly Pizza model is too big');return b;
}
// One Poly Pizza model as Kairoq shows it, or null when its licence cannot be used.
function ppView(m){
 const licence=ppLicence(m&&m.Licence);if(!m||!m.ID||!licence||!m.Download)return null;
 const creator=String(m.Creator&&m.Creator.Username||'').slice(0,60),tris=Number(m.TriangleCount)||null;
 const notes=[];
 notes.push(m.Animated?'Animated':'Stands still');
 if(tris)notes.push(tris<3000?'faceted low-poly':tris<15000?'low-poly':'detailed');
 if(licence==='CC-BY')notes.push('app must credit '+(creator||'the creator'));
 return{id:String(m.ID).slice(0,40),title:String(m.Title||'Model').slice(0,80),creator,licence,animated:Boolean(m.Animated),tris,
  thumb:/^https:\/\/([\w-]+\.)*poly\.pizza\//.test(String(m.Thumbnail||''))?String(m.Thumbnail):null,url:'https://poly.pizza/m/'+encodeURIComponent(m.ID),note:notes.join(' · ')};
}
async function searchPolyPizza(query,{animated=false,fetchImpl=fetch,limit=3}={}){
 const q=String(query||'').replace(/[^\w ]+/g,' ').trim().slice(0,60);if(!q)return[];
 const run=async anim=>{const d=await ppJson('/search/'+encodeURIComponent(q)+'?limit=24'+(anim?'&animated=true':''),fetchImpl);return(d.results||[]).map(ppView).filter(Boolean)};
 let rows=await run(animated);
 if(animated&&rows.length<limit)rows=[...rows,...(await run(false)).filter(r=>!rows.some(x=>x.id===r.id))];
 return rows.slice(0,Math.max(1,Math.min(12,limit)));
}
async function addPolyPizza(id,modelId,{fetchImpl=fetch}={}){
 builder.loadMeta(id);
 const pid=String(modelId||'');if(!/^[\w-]{3,40}$/.test(pid))throw fail(400,'Pick a Poly Pizza model');
 if(load(id).some(m=>m.source&&m.source.provider==='polypizza'&&m.source.id===pid))return load(id).map(view).find(m=>m.source.id===pid);
 const m=await ppJson('/model/'+encodeURIComponent(pid),fetchImpl),v=ppView(m);
 if(!v)throw fail(422,'This model\'s licence does not allow use in your app');
 const glb=await ppBytes(m.Download,fetchImpl,MAX_GLB);if(!isGlb(glb))throw fail(502,'Poly Pizza sent a file that is not a GLB model');
 let thumb=null;try{if(v.thumb){const t=await ppBytes(v.thumb,fetchImpl,3*1024*1024);thumb=isPng(t)||isJpg(t)?t:null}}catch{}
 const source={provider:'polypizza',id:pid,title:v.title,creator:v.creator,license:v.licence,url:v.url};
 return keep(id,{title:v.title,kind:'model',source},glb,thumb);
}

// The owner picked a 3D style but has no model yet: once per project, the AI names an object
// that suits the app and the best Poly Haven match is added, so the first build already has 3D.
async function autoModel(id,request,{callModel,signal,fetchImpl=fetch}={}){
 const meta=builder.loadMeta(id),style=meta.three_d&&meta.three_d.style;
 if(!style||style==='none'||meta.three_d.auto_tried||load(id).some(m=>m.kind==='model')||process.env.KAIROQ_POLYHAVEN==='off')return null;
 meta.three_d.auto_tried=new Date().toISOString();builder.saveMeta(meta);
 const pick=await callModel({maxOutputTokens:120,signal,messages:[{role:'user',content:'Return ONLY JSON {"query":"one to three plain English words"} naming one physical object (furniture, a product, a plant, a vehicle, a building part, food...) that would look good as the 3D model in this app. Free models come from Poly Haven, which has furniture, props, plants, tools and interior items.\nApp request: '+String(request||'').slice(0,1500)}]});
 const query=String(pick&&pick.query||'').slice(0,60);if(!query)return null;
 const hit=(await searchPolyHaven(query,{fetchImpl,limit:1}))[0];if(!hit)return null;
 return addPolyHaven(id,hit.id,{fetchImpl});
}
// A preview picture made in the owner's browser (when the server has no Blender).
function setPoster(id,file,png){
 const items=load(id),m=items.find(x=>x.file===file);if(!m)throw fail(404,'Unknown 3D file');
 if(!isPng(png)||png.length>3*1024*1024)throw fail(400,'The preview must be a PNG up to 3 MB');
 const name=m.file.replace(/\.(glb|hdr)$/,'.png');fs.writeFileSync(path.join(dir(id),name),png);
 m.poster=name;m.poster_bytes=png.length;store(id,items);return view(m);
}
function remove(id,file){
 const items=load(id),m=items.find(x=>x.file===file);if(!m)throw fail(404,'Unknown 3D file');
 for(const f of [m.file,m.poster])if(f)fs.rmSync(path.join(dir(id),f),{force:true});
 store(id,items.filter(x=>x!==m));return list(id);
}
const TYPES={glb:'model/gltf-binary',png:'image/png',jpg:'image/jpeg',hdr:'application/octet-stream'};
function read(id,file){
 if(!FILE.test(String(file||'')))return null;
 const f=path.join(dir(id),file);if(!fs.existsSync(f))return null;
 return{bytes:fs.readFileSync(f),type:TYPES[path.extname(file).slice(1)]};
}
// Every build gets the project's models at ./models/ and, when the code shows 3D, the viewer.
function copyInto(id,publicDir){
 const items=load(id);if(!items.length)return;
 fs.mkdirSync(path.join(publicDir,'models'),{recursive:true});
 for(const m of items)for(const f of [m.file,m.poster])if(f&&fs.existsSync(path.join(dir(id),f)))fs.copyFileSync(path.join(dir(id),f),path.join(publicDir,'models',f));
}
function copyViewer(publicDir){
 if(!fs.existsSync(VIEWER_SRC))return false;
 fs.mkdirSync(path.join(publicDir,'_kairoq'),{recursive:true});fs.copyFileSync(VIEWER_SRC,path.join(publicDir,'_kairoq',VIEWER_FILE));return true;
}
function usesViewer(files){return Object.values(files||{}).some(c=>typeof c==='string'&&/['"]kairoq\/3d['"]/.test(c))}

// What the builder is told: the files, how to show them, and the owner's chosen 3D style.
function note(id,meta){
 const items=load(id),style=STYLES[meta&&meta.three_d&&meta.three_d.style]?meta.three_d.style:'none';
 if(!items.length&&style==='none')return'';
 const models=items.filter(m=>m.kind==='model'),envs=items.filter(m=>m.kind==='environment');
 const L=['3D IN THIS APP. Show 3D only with: import { Model3D } from \'kairoq/3d\'; (never three.js directly for these files, and never other model URLs).'];
 for(const m of models)L.push('- model ./models/'+m.file+' "'+m.title+'"'+(m.poster?' poster ./models/'+m.poster:'')+(m.source&&m.source.provider==='polyhaven'?' (Poly Haven, CC0)':'')+(m.source&&m.source.provider==='polypizza'?' (Poly Pizza, '+m.source.license+(m.source.license==='CC-BY'?': show the credit "'+m.title+'" by '+(m.source.creator||'its creator')+' (poly.pizza, CC-BY) on an about or credits screen':'')+')':'')+(m.animations&&m.animations.length?' animations: '+m.animations.map(a=>'"'+a+'"').join(', '):''));
 for(const m of envs)L.push('- lighting ./models/'+m.file+' "'+m.title+'" (pass as environment="./models/'+m.file+'")');
 L.push('<Model3D src="./models/x.glb" poster="./models/x.png" alt="what it shows" mode="product|walkthrough|scroll|background" className="h-[60vh] w-full" /> Props: environment, autoRotate, animation="Idle" (loops one of the model’s own animations; leave it out to loop the first), tapAnimation="Jump" (plays once when tapped, then back), onAnimations={names=>…} (the names, once loaded), onControls={setModel} (once loaded: {animations, materials, play(name,{once}), pause(), replay(), reset()} for buttons like Walk, Jump, Replay), blank (every part plain white, e.g. a character waiting to be coloured in), colors={{"Body":"#4caf50"}} (paint parts by material name from controls.materials, or by index "0"), credit line for the model under it, ar (default on in product mode), hotspots=[{position:"0 1 0",normal:"0 0 1",label:"Kitchen"}], stops=["0deg 75deg 105%","90deg 60deg 80%"] (scroll mode: camera stops as the section scrolls), cameraOrbit, cameraTarget, exposure. Give it a fixed height, real alt text, and a short text line nearby saying visitors can drag to turn it. It already shows the poster while loading, on old phones and for reduced motion.');
 if(style!=='none')L.push('The owner chose the 3D style "'+STYLES[style].label+'". '+STYLES[style].hint+(models.length?'':' No model is in the project yet: say in "message" that they can add one in Design → 3D models (upload or Poly Haven), and lay the section out so the model drops in.'));
 return L.join('\n');
}
module.exports={searchPolyPizza,addPolyPizza,polyPizzaReady,ppView,ppLicence,animationNames,saveMade,STYLES,MAX_MODELS,MAX_GLB,VIEWER_FILE,VIEWER_SRC,list,upload,addPolyHaven,searchPolyHaven,autoModel,setPoster,remove,read,copyInto,copyViewer,usesViewer,note,packGlb,isGlb,dir};

"use strict";
// Kairoq → Figma. Figma lets designs be created only from inside Figma, so Kairoq ships a small
// Figma plugin (figma-plugin/). In the editor, "Send to Figma" captures the app's page as layers
// (runtime-check.js captureLayout: desktop 1440 px and phone 390 px), embeds its images, and gives
// a short code. In Figma, the Kairoq plugin takes the code and rebuilds the page as editable
// frames: boxes, text with its fonts, images and icons. A code works for 30 minutes.
const crypto=require('crypto'),fs=require('fs'),path=require('path');
const builder=require('./react-builder');

const TTL=30*60000,MAX_IMAGES=40,MAX_IMAGE_BYTES=4*1024*1024;
const exportsByCode=new Map();// code -> {at, data}
function fail(status,message){return Object.assign(Error(message),{status})}
function newCode(){const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let c='';for(const b of crypto.randomBytes(8))c+=a[b%a.length];return c.slice(0,4)+'-'+c.slice(4)}
function sweep(){const now=Date.now();for(const [k,v] of exportsByCode)if(now-v.at>TTL)exportsByCode.delete(k)}

// Images the page shows: the app's own files are read from the build; outside images are fetched
// with Kairoq's safe fetch (public addresses only, size-limited).
async function embedImages(frames,{previewBase,readLocal,fetchRemote}){
 const cache=new Map();let count=0;
 const load=async src=>{
  if(cache.has(src))return cache.get(src);
  let out=null;
  try{
   if(count++>=MAX_IMAGES)return null;
   if(/^data:image\/(png|jpe?g|gif|webp);base64,/.test(src))out=src.slice(src.indexOf(',')+1);
   else{
    const u=new URL(src,previewBase);
    const bytes=u.origin===new URL(previewBase).origin?await readLocal(u.pathname):await fetchRemote(u.href);
    if(bytes&&bytes.length<=MAX_IMAGE_BYTES&&/^(\x89PNG|\xff\xd8|GIF8|RIFF)/.test(bytes.subarray(0,4).toString('latin1')))out=bytes.toString('base64');
   }
  }catch{out=null}
  cache.set(src,out);return out;
 };
 for(const f of frames)for(const n of f.nodes){
  if(n.t==='image'&&n.src){n.data=await load(n.src);delete n.src}
  if(n.t==='box'&&n.image){n.data=await load(n.image);delete n.image}
 }
 return frames;
}
// A file of the built app, read from its version folder (never outside it).
function readBuilt(pathname){
 const m=/^\/builder\/p\/([a-f0-9]{12})-[a-f0-9]{24}\/v\/(\d+)\/(.+)$/.exec(decodeURIComponent(String(pathname||'')));
 if(!m||m[3].split('/').some(x=>x==='..'||x.startsWith('.')))return null;
 const dist=path.join(builder.versionDir(m[1],m[2]),'dist'),f=path.join(dist,m[3]);
 return f.startsWith(dist+path.sep)&&fs.existsSync(f)?fs.readFileSync(f):null;
}
// Captures the current version and returns the code for the plugin.
async function create(id,{capture,readLocal=async p=>readBuilt(p),fetchRemote=async u=>(await require('./builder-assets').remote(u,{limit:MAX_IMAGE_BYTES})).bytes}={}){
 const meta=builder.loadMeta(id);
 if(!meta.current_version)throw fail(409,'Build the app first');
 if(!capture)throw fail(503,'Sending to Figma needs the browser on this server.');
 const url=builder.previewUrl(meta),native=Boolean(meta.native&&meta.native.enabled);
 const frames=[];
 for(const v of native?[{name:'Phone',width:390,height:844,mobile:true}]:[{name:'Desktop',width:1440,height:900},{name:'Phone',width:390,height:844,mobile:true}]){
  const page=await capture(url,v);
  frames.push({name:meta.name+' ('+v.name.toLowerCase()+')',label:v.name,...page});
 }
 await embedImages(frames,{previewBase:'http://127.0.0.1'+url,readLocal,fetchRemote});
 sweep();
 const code=newCode();
 exportsByCode.set(code,{at:Date.now(),data:{kairoq:1,app:meta.name,version:meta.current_version,frames}});
 return{code,expires_in_minutes:TTL/60000,frames:frames.map(f=>({name:f.name,label:f.label,nodes:f.nodes.length}))};
}
function take(code){
 sweep();
 const hit=exportsByCode.get(String(code||'').toUpperCase().replace(/[^A-Z0-9]/g,'').replace(/^(.{4})(.{4})$/,'$1-$2'));
 if(!hit)throw fail(404,'That code is not valid or has expired. In Kairoq, press Send to Figma again for a new one.');
 return hit.data;
}

// ---------- the plugin ----------
const PLUGIN_DIR=path.join(__dirname,'figma-plugin');
function pluginFiles(origin){
 const host=new URL(origin).origin;
 const manifest=JSON.parse(fs.readFileSync(path.join(PLUGIN_DIR,'manifest.json'),'utf8'));
 manifest.networkAccess={allowedDomains:[host],reasoning:'The plugin downloads the page you sent from Kairoq.'};
 return{
  'Kairoq for Figma/manifest.json':JSON.stringify(manifest,null,2)+'\n',
  'Kairoq for Figma/code.js':fs.readFileSync(path.join(PLUGIN_DIR,'code.js'),'utf8'),
  'Kairoq for Figma/ui.html':fs.readFileSync(path.join(PLUGIN_DIR,'ui.html'),'utf8').replace('__KAIROQ_ORIGIN__',host),
  'Kairoq for Figma/README.txt':'Kairoq for Figma\n\nIn the Figma desktop app: Plugins, Development, Import plugin from manifest, and choose manifest.json in this folder.\nThen in Kairoq press Send to Figma, run the plugin in Figma and paste the code.\n',
 };
}
function pluginZip(origin){return require('./project-portability').zip(pluginFiles(origin))}
module.exports={readBuilt,create,take,embedImages,pluginFiles,pluginZip,newCode,TTL};

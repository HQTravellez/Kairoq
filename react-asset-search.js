"use strict";
// Openly licensed assets for generated apps: photos and sounds from Openverse (licenses that
// allow commercial use only) and 3D models from Poly Haven (CC0). Every asset keeps its
// credit (title, creator, license, source) so the app can show attribution where required.
const UA='Kairoq-Create (+https://kairoq.com)';
const COMMERCIAL=new Set(['cc0','pdm','by','by-sa']);
const ATTRIBUTION=new Set(['by','by-sa']);
function enabled(){return process.env.KAIROQ_ASSET_SEARCH!=='off'}
async function getJson(url,fetchImpl){const r=await fetchImpl(url,{headers:{'User-Agent':UA,Accept:'application/json'},signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('HTTP '+r.status+' from '+new URL(url).hostname);return r.json()}
function credit(x,kind){
 const license=String(x.license||'').toLowerCase();
 return{kind,title:String(x.title||'Untitled').slice(0,120),creator:String(x.creator||'Unknown').slice(0,80),license:license==='cc0'?'CC0':license==='pdm'?'Public domain':'CC '+license.toUpperCase()+(x.license_version?' '+x.license_version:''),license_url:String(x.license_url||'').slice(0,200),source_url:String(x.foreign_landing_url||x.url||'').slice(0,300),attribution_required:ATTRIBUTION.has(license)};
}
async function searchOpenverse(kind,query,{fetchImpl=fetch,limit=8}={}){
 const u=new URL('https://api.openverse.org/v1/'+(kind==='audio'?'audio':'images')+'/');
 u.searchParams.set('q',String(query).slice(0,80));u.searchParams.set('license_type','commercial');u.searchParams.set('page_size',String(limit));u.searchParams.set('mature','false');
 if(kind!=='audio'){u.searchParams.set('extension','jpg,png,webp');u.searchParams.set('size','large')}
 const data=await getJson(u.href,fetchImpl);
 return(data.results||[]).filter(x=>COMMERCIAL.has(String(x.license||'').toLowerCase())&&/^https:\/\//.test(String(x.url||''))).map(x=>({...credit(x,kind),url:x.url,thumbnail:x.thumbnail||null,width:x.width||null,height:x.height||null,duration:x.duration||null}));
}
async function searchModels(query,{fetchImpl=fetch,limit=5}={}){
 const all=await getJson('https://api.polyhaven.com/assets?t=models',fetchImpl);
 const words=String(query).toLowerCase().split(/\W+/).filter(w=>w.length>2);
 const scored=Object.entries(all).map(([id,a])=>{const hay=[id,a.name,...(a.tags||[]),...(a.categories||[])].join(' ').toLowerCase();return{id,a,score:words.filter(w=>hay.includes(w)).length}}).filter(x=>x.score>0).sort((x,y)=>y.score-x.score).slice(0,limit);
 const out=[];
 for(const {id,a} of scored){
  let url=null;try{const files=await getJson('https://api.polyhaven.com/files/'+encodeURIComponent(id),fetchImpl);const g=files.gltf&&(files.gltf['1k']||files.gltf['2k']);url=g&&g.gltf&&g.gltf.url||null}catch{}
  if(url)out.push({kind:'model',title:String(a.name||id).slice(0,120),creator:Object.keys(a.authors||{}).join(', ').slice(0,80)||'Poly Haven',license:'CC0',license_url:'https://creativecommons.org/publicdomain/zero/1.0/',source_url:'https://polyhaven.com/a/'+id,attribution_required:false,url});
 }
 return out;
}
function slug(s){return String(s||'image').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)||'image'}
const TYPES={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
// Finds and saves photos for the plan's image needs, links sounds and 3D models.
// Returns {saved:[{file,...credit}], linked:[credit+url], errors:[]}.
async function gather(id,needs,{fetchImpl=fetch,maxImages=6}={}){
 const out={saved:[],linked:[],errors:[]};
 if(!enabled()||!Array.isArray(needs)||!needs.length)return out;
 const assets=require('./react-assets');
 for(const need of needs.slice(0,8)){
  try{
   // 3D models are saved into the project (react-models.js) so they work offline, in AR and with a preview picture.
   if(need.kind==='model'){
    const M=require('./react-models'),hit=(await M.searchPolyHaven(need.query,{fetchImpl,limit:3}))[0];
    if(hit){const m=await M.addPolyHaven(id,hit.id,{fetchImpl}).catch(e=>{if(e.status===409)return M.list(id).find(x=>x.source&&x.source.id===hit.id)||null;throw e});if(m)(out.models=out.models||[]).push({...m,use:need.use})}
    continue;
   }
   if(need.kind==='audio'){const a=(await searchOpenverse('audio',need.query,{fetchImpl,limit:5}))[0];if(a)out.linked.push({...a,use:need.use});continue}
   if(out.saved.length>=maxImages)continue;
   for(const img of await searchOpenverse('image',need.query,{fetchImpl})){
    try{
     const r=await fetchImpl(img.url,{headers:{'User-Agent':UA},signal:AbortSignal.timeout(20000),redirect:'follow'});
     const type=(r.headers.get('content-type')||'').split(';')[0];
     if(!r.ok||!TYPES[type])continue;
     const buf=Buffer.from(await r.arrayBuffer());if(buf.length>3*1024*1024||buf.length<100)continue;
     const [file]=assets.save(id,[{name:'stock-'+slug(need.query)+'.'+TYPES[type],mime:type,data:buf.toString('base64')}]);
     out.saved.push({file,...img,use:need.use});break;
    }catch{}
   }
  }catch(e){out.errors.push(need.query+': '+String(e.message||e).slice(0,120))}
 }
 if(out.saved.length||out.linked.length){
  const builder=require('./react-builder'),meta=builder.loadMeta(id);
  meta.asset_credits=[...(meta.asset_credits||[]).filter(c=>!out.saved.some(s=>s.file===c.file)),...out.saved.map(({url,thumbnail,width,height,duration,...c})=>c),...out.linked.map(({...c})=>c)].slice(-60);
  builder.saveMeta(meta);
 }
 return out;
}
// What the model is told about the assets it may use.
function note(result){
 const models=(result&&result.models)||[];
 if(!result||(!result.saved.length&&!result.linked.length&&!models.length))return'';
 const L=['OPENLY LICENSED ASSETS found for this app:'];
 for(const s of result.saved)L.push('- ./uploads/'+s.file+' — '+s.title+' by '+s.creator+' ('+s.license+')'+(s.use?' — use: '+s.use:''));
 for(const m of models)L.push('- 3D model '+m.path+(m.poster_path?' (poster '+m.poster_path+')':'')+' — '+m.title+' (Poly Haven, CC0)'+(m.use?' — use: '+m.use:'')+'. Show it with <Model3D> from \'kairoq/3d\' only where 3D adds real value.');
 for(const l of result.linked)L.push('- '+l.kind+' '+l.url+' — '+l.title+' by '+l.creator+' ('+l.license+')'+(l.use?' — use: '+l.use:''));
 const credits=[...result.saved,...result.linked].filter(x=>x.attribution_required);
 if(credits.length)L.push('Some of these need attribution: add a small "Photo credits" line in the footer (or a credits page) with title, creator and license for: '+credits.map(c=>c.title+' by '+c.creator+' ('+c.license+')').join('; ')+'.');
 L.push('Icons: use lucide-react (ISC license).');
 return L.join('\n');
}
module.exports={enabled,searchOpenverse,searchModels,gather,note,COMMERCIAL};

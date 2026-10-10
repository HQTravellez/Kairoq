"use strict";
// Provider results are resolved server-side. Clients cannot nominate arbitrary download URLs.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),https=require('https'),dns=require('dns').promises,net=require('net');
const ROOT=path.join(__dirname,'workspace','builder-assets'),MAX=32*1024*1024;
const TYPES={jpg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',mp3:'audio/mpeg',wav:'audio/wav',ogg:'audio/ogg',flac:'audio/flac',mp4:'video/mp4',webm:'video/webm',glb:'model/gltf-binary',gltf:'model/gltf+json',bin:'application/octet-stream',hdr:'application/octet-stream',exr:'application/octet-stream'};
function privateIP(ip){
 if(net.isIP(ip)===4){const [a,b]=ip.split('.').map(Number);return a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&[0,168].includes(b)||a===100&&b>=64&&b<=127||a===198&&[18,19].includes(b);}
 return !net.isIP(ip)||!/^2[0-9a-f]{3}:/i.test(ip); // accept only globally routable IPv6, never mapped IPv4
}
async function remote(url,{limit=MAX,redirects=3,lookup=dns.lookup,request=https.get}={}){
 const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||net.isIP(u.hostname))throw Error('Asset downloads require public HTTPS hosts');
 const addresses=await lookup(u.hostname,{all:true});if(!addresses.length||addresses.some(a=>privateIP(a.address)))throw Error('Private network asset URL blocked');
 const chosen=addresses.find(a=>a.family===4)||addresses[0];return new Promise((resolve,reject)=>{
  const deadline=setTimeout(()=>req.destroy(Error('Asset request deadline exceeded')),30000);const req=request(u,{headers:{'User-Agent':'Kairoq-Asset-Builder/1.0','Accept-Encoding':'identity'},lookup:(_h,opts,cb)=>opts.all?cb(null,[chosen]):cb(null,chosen.address,chosen.family)},res=>{
   if([301,302,303,307,308].includes(res.statusCode)){res.resume();if(!redirects)return reject(Error('Too many asset redirects'));return resolve(remote(new URL(res.headers.location,u).href,{limit,redirects:redirects-1,lookup,request}));}
   if(res.statusCode!==200){res.resume();return reject(Error('Asset provider returned HTTP '+res.statusCode));}
   if(Number(res.headers['content-length'])>limit){res.destroy();return reject(Error('Asset exceeds download size limit'));}
   let size=0;const parts=[];res.on('data',chunk=>{size+=chunk.length;if(size>limit){res.destroy(Error('Asset exceeds download size limit'));return;}parts.push(chunk);});res.on('error',reject);res.on('end',()=>resolve({bytes:Buffer.concat(parts),type:String(res.headers['content-type']||'').split(';')[0]}));
  });req.setTimeout(20000,()=>req.destroy(Error('Asset download timed out')));req.on('error',reject);req.on('close',()=>clearTimeout(deadline));
 });
}
async function json(url,options={},read=remote){return JSON.parse((await read(url,{limit:6*1024*1024,...options})).bytes.toString('utf8'));}
function catalog(root=ROOT){try{return JSON.parse(fs.readFileSync(path.join(root,'catalog.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return{results:{},downloads:{}};throw e;}}
function save(data,root=ROOT){fs.mkdirSync(root,{recursive:true});const tmp=path.join(root,'catalog.'+crypto.randomUUID()+'.tmp');fs.writeFileSync(tmp,JSON.stringify(data,null,2));fs.renameSync(tmp,path.join(root,'catalog.json'));}
function publicAsset(a){const {download_url,files,...out}=a;return out;}
function resultId(provider,id){return crypto.createHash('sha256').update(provider+':'+id).digest('hex').slice(0,24);}
async function search({query,kind='image',limit=8},{root=ROOT,read=remote}={}){
 query=String(query||'').trim().slice(0,140);if(query.length<2)throw Error('Enter an asset search of at least two characters');if(!['image','audio','model','texture','environment'].includes(kind))throw Error('Unsupported asset kind');limit=Math.max(1,Math.min(12,Number(limit)||8));let items=[];
 if(['image','audio'].includes(kind)){
  const data=await json('https://api.openverse.org/v1/'+(kind==='audio'?'audio':'images')+'/?q='+encodeURIComponent(query)+'&page_size='+limit+'&license=cc0,by',{},read);
  items=(data.results||[]).filter(a=>['cc0','by'].includes(a.license)&&a.url?.startsWith('https://')).map(a=>({id:resultId('openverse',a.id),provider:'openverse',provider_id:a.id,kind,title:String(a.title||query).slice(0,160),creator:String(a.creator||'Unknown creator').slice(0,160),source_url:a.foreign_landing_url,license:a.license==='cc0'?'CC0':'CC-BY',license_url:a.license_url,attribution_required:a.license==='by',download_url:a.url}));
 }else{
  const type=kind==='model'?'models':kind==='texture'?'textures':'hdris',data=await json('https://api.polyhaven.com/assets?t='+type,{},read),terms=query.toLowerCase().split(/\s+/);
  items=Object.entries(data).map(([id,a])=>({id,a,score:terms.reduce((n,t)=>n+Number((id+' '+a.name+' '+(a.tags||[]).join(' ')+' '+(a.categories||[]).join(' ')).toLowerCase().includes(t)),0)})).filter(a=>a.score>0).sort((a,b)=>b.score-a.score).slice(0,limit).map(({id,a})=>({id:resultId('polyhaven',id),provider:'polyhaven',provider_id:id,kind,title:a.name||id,creator:Object.keys(a.authors||{}).join(', ')||'Poly Haven',source_url:'https://polyhaven.com/a/'+id,license:'CC0',license_url:'https://polyhaven.com/license',attribution_required:false,provider_credit:'Powered by Poly Haven'}));
 }
 items=items.filter(a=>[a.source_url,a.license_url].every(value=>{try{return new URL(value).protocol==='https:';}catch{return false;}}));
 const data=catalog(root);for(const a of items)data.results[a.id]={...a,searched_at:new Date().toISOString()};const entries=Object.entries(data.results);if(entries.length>1000)data.results=Object.fromEntries(entries.slice(-1000));save(data,root);return items.map(publicAsset);
}
function extension(url,type){const ext=new URL(url).pathname.split('.').pop().toLowerCase();if(TYPES[ext])return ext;return Object.entries(TYPES).find(([,mime])=>mime===type)?.[0];}
function validateBytes(bytes,ext){
 if(!bytes.length||!TYPES[ext])throw Error('Unsupported or empty asset');
 const ok=ext==='jpg'?bytes[0]===255&&bytes[1]===216:ext==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):ext==='webp'?bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP':ext==='gif'?bytes.toString('ascii',0,3)==='GIF':ext==='wav'?bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WAVE':ext==='ogg'?bytes.toString('ascii',0,4)==='OggS':ext==='flac'?bytes.toString('ascii',0,4)==='fLaC':ext==='mp3'?bytes.toString('ascii',0,3)==='ID3'||bytes[0]===255&&(bytes[1]&224)===224:ext==='glb'?bytes.length>=20&&bytes.readUInt32LE(0)===0x46546c67&&bytes.readUInt32LE(4)===2&&bytes.readUInt32LE(8)===bytes.length:ext==='gltf'?JSON.parse(bytes.toString()).asset?.version==='2.0':ext==='mp4'?bytes.toString('ascii',4,8)==='ftyp':ext==='webm'?bytes.subarray(0,4).equals(Buffer.from([26,69,223,163])):true;
 if(!ok)throw Error('Downloaded bytes do not match asset format');return bytes;
}
function put(bytes,ext,root=ROOT){validateBytes(bytes,ext);const name=crypto.createHash('sha256').update(bytes).digest('hex')+'.'+ext;fs.mkdirSync(root,{recursive:true});const file=path.join(root,name);if(!fs.existsSync(file))fs.writeFileSync(file,bytes,{flag:'wx'});return{name,url:'/builder-assets/'+name,size:bytes.length,type:TYPES[ext]};}
function flatten(value,key='',out=[]){if(value&&typeof value==='object'){if(typeof value.url==='string')out.push({...value,key});else for(const [k,v]of Object.entries(value))flatten(v,key+'/'+k,out);}return out;}
async function download(id,{root=ROOT,read=remote}={}){
 const data=catalog(root),entry=data.results[id];if(!entry)throw Error('Search for this asset before downloading');if(data.downloads[id])return publicAsset(data.downloads[id]);let url=entry.download_url,details;
 if(entry.provider==='polyhaven'){
  const files=await json('https://api.polyhaven.com/files/'+encodeURIComponent(entry.provider_id),{},read);details=flatten(files).filter(f=>entry.kind==='model'?/\.(glb|gltf)$/i.test(new URL(f.url).pathname):entry.kind==='texture'?/\.(jpg|png)$/i.test(new URL(f.url).pathname)&&/diff|color|albedo/i.test(f.key):/\.(hdr|exr)$/i.test(new URL(f.url).pathname)).sort((a,b)=>(a.size||MAX)-(b.size||MAX))[0];if(!details)throw Error('Provider has no compatible downloadable format');url=details.url;
 }
 const fetched=await read(url,{limit:MAX});let bytes=fetched.bytes,ext=extension(url,fetched.type);if(['image','audio'].includes(entry.kind)&&!(TYPES[ext]||'').startsWith(entry.kind+'/'))throw Error('Provider returned the wrong asset type');let dependencies=[];
 if(ext==='gltf'){
  const doc=JSON.parse(bytes.toString());if(doc.asset?.version!=='2.0')throw Error('Unsupported glTF');const refs=[...(doc.buffers||[]),...(doc.images||[])];if(refs.length>16)throw Error('Model has too many dependencies');let total=bytes.length;
  for(const ref of refs){if(!ref.uri)continue;if(ref.uri.startsWith('data:')){if(ref.uri.length>MAX*1.4)throw Error('Embedded model resource too large');continue;}const included=details?.include?.[ref.uri],source=typeof included==='string'?included:included?.url||new URL(ref.uri,url).href;const child=await read(source,{limit:MAX});total+=child.bytes.length;if(total>64*1024*1024)throw Error('Model bundle too large');const childExt=extension(source,child.type)||'bin';if(!['bin','png','jpg','webp'].includes(childExt))throw Error('Unsupported model dependency');const saved=put(child.bytes,childExt,root);dependencies.push(saved);ref.uri=saved.url;}
  bytes=Buffer.from(JSON.stringify(doc));
 }
 const file=put(bytes,ext,root),asset={...publicAsset(entry),...file,dependencies,downloaded_at:new Date().toISOString(),sha256:file.name.split('.')[0]};const current=catalog(root);current.downloads[id]=asset;save(current,root);return asset;
}
function get(id,root=ROOT){const a=catalog(root).downloads[id];if(!a)throw Error('Asset has not been downloaded');return a;}
function list(root=ROOT){return Object.values(catalog(root).downloads).map(publicAsset);}
function handle(req,res,root=ROOT){const match=/^\/builder-assets\/([a-f0-9]{64}\.([a-z0-9]+))(?:\?.*)?$/.exec(req.url);if(!match||!TYPES[match[2]]||!['GET','HEAD'].includes(req.method)){res.writeHead(404);res.end();return;}try{const bytes=fs.readFileSync(path.join(root,match[1]));res.writeHead(200,{'Content-Type':TYPES[match[2]],'Cache-Control':'public, max-age=31536000, immutable','Access-Control-Allow-Origin':'*','X-Content-Type-Options':'nosniff','Content-Length':bytes.length});res.end(req.method==='HEAD'?undefined:bytes);}catch{res.writeHead(404);res.end();}}
function instructions(assets=[]){return assets.length?'\nAPPROVED LOCAL ASSETS: '+JSON.stringify(assets.map(a=>({id:a.id,kind:a.kind,title:a.title,url:a.url,license:a.license,credit:a.attribution_required?a.creator+' · '+a.source_url+' · '+a.license_url:a.provider_credit||''})))+'\nUse these exact same-origin URLs. Images need meaningful alt text, width/height and responsive sizing. Audio must be user-triggered with controls; never autoplay. Models use the trusted canvas data-kq-model attribute and a text alternative. Do not fetch remote assets or invent URLs. Include a small linked asset credits section for required creator attribution and provider credits. Do not replace the approved images with placeholders.':'';}
async function prepare(brief,callModel,{ids=[],auto=true,existing=[]}={},options={}){
 const assets=[...existing,...ids.map(id=>get(id,options.root))];if(auto&&/\b(photo(?:s|graphy)?|pictures?|images?|sounds?|audio|music|3d models?|textures?|hdri)\b/i.test(brief)){
  const plan=await callModel({maxOutputTokens:900,messages:[{role:'user',content:'Return ONLY JSON {assets:[{kind:"image|audio|model|texture|environment",query:"concise relevant search terms"}]}. Plan at most 3 downloadable assets explicitly requested in this user brief. Do not infer assets from generic design words. Existing assets:'+JSON.stringify(assets.map(a=>({kind:a.kind,title:a.title})))+'\nBrief:'+brief}]});if(!Array.isArray(plan.assets)||plan.assets.length>3)throw Error('Invalid asset search plan');
  for(const request of plan.assets){const results=await search({...request,limit:4},options);let picked,error;for(const candidate of results.slice(0,3)){try{picked=await download(candidate.id,options);break;}catch(e){error=e;}}if(!picked)throw Error('Could not download requested '+request.kind+' asset: '+(error?.message||'no matching licensed results'));assets.push(picked);}
 }
 return [...new Map(assets.map(a=>[a.id,a])).values()].slice(0,12);
}
function credits(files,items=[]){
 const escape=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const used=items.filter(a=>Object.values(files).some(code=>String(code).includes(a.url))&&(a.attribution_required||a.provider_credit));if(!used.length)return files;
 const html='<footer id="kq-asset-credits" style="padding:24px;font:14px/1.6 system-ui;background:#f7f8fa;color:#17242c"><p>Asset credits</p>'+used.map(a=>'<p>'+escape(a.title)+' · '+escape(a.creator)+' · <a style="display:inline-block;min-height:44px;padding:10px 4px;color:#174b68" href="'+escape(a.source_url)+'">'+escape(a.provider_credit||'Source')+'</a> · <a style="display:inline-block;min-height:44px;padding:10px 4px;color:#174b68" href="'+escape(a.license_url)+'">'+escape(a.license)+'</a></p>').join('')+'</footer>';
 return Object.fromEntries(Object.entries(files).map(([name,code])=>[name,name.endsWith('.html')?code.replace(/<footer id="kq-asset-credits"[\s\S]*?<\/footer>/g,'').replace(/<\/body>/i,html+'</body>'):code]));
}
function assertReferences(files){for(const code of Object.values(files))for(const match of String(code).matchAll(/(?:\b(?:src|poster|data-kq-model)\s*=\s*["']([^"']+)["']|url\(\s*["']?([^)'"\s]+))/gi)){const value=match[1]||match[2];if(/^(?:https?:|\/\/)/i.test(value))throw Error('Use downloaded local assets instead of external dependencies');if(value.startsWith('/builder-assets/')&&!/^\/builder-assets\/[a-f0-9]{64}\.(?:jpg|png|webp|gif|mp3|wav|ogg|flac|mp4|webm|glb|gltf|bin|hdr|exr)$/.test(value))throw Error('Invalid local asset URL');}}
module.exports={ROOT,TYPES,MAX,search,download,get,list,handle,instructions,prepare,assertReferences,remote,privateIP,credits,put,validateBytes,catalog};

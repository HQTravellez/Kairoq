"use strict";
// Figma import: reads a frame through the Figma REST API with the owner's personal
// access token, renders it to PNG, downloads its images, and turns the layer tree into
// a compact design spec (layout, sizes, colours, fonts and text) for the model.
const MAX_NODES=400,MAX_IMAGE=3*1024*1024,MAX_FILL_IMAGES=8;
const API='https://api.figma.com/v1';

function fail(status,message){return Object.assign(Error(message),{status})}
function parseUrl(raw){
 let u;try{u=new URL(String(raw||'').trim())}catch{throw fail(400,'Paste a Figma link, for example https://www.figma.com/design/AbC123/My-site?node-id=1-2')}
 if(u.protocol!=='https:'||!/(^|\.)figma\.com$/.test(u.hostname))throw fail(400,'That is not a figma.com link');
 const m=/^\/(?:design|file|proto)\/([A-Za-z0-9]{10,64})(?:\/branch\/([A-Za-z0-9]{10,64}))?/.exec(u.pathname);
 if(!m)throw fail(400,'Use a link to a Figma design file (figma.com/design/…)');
 const node=u.searchParams.get('node-id');
 if(node&&!/^\d+[-:]\d+$/.test(node))throw fail(400,'The node-id in that link is not valid');
 return{key:m[2]||m[1],nodeId:node?node.replace('-',':'):null};
}
function hex(c,opacity=1){
 if(!c)return null;
 const h=v=>Math.round(Math.max(0,Math.min(1,v))*255).toString(16).padStart(2,'0');
 const a=(c.a??1)*opacity;
 return'#'+h(c.r)+h(c.g)+h(c.b)+(a<0.99?h(a):'');
}
function fillText(fills,images){
 const out=[];
 for(const f of Array.isArray(fills)?fills:[]){
  if(f.visible===false)continue;
  if(f.type==='SOLID')out.push(hex(f.color,f.opacity??1));
  else if(f.type&&f.type.startsWith('GRADIENT_'))out.push(f.type.toLowerCase().replace('gradient_','')+'-gradient('+(f.gradientStops||[]).map(s=>hex(s.color)).join(' → ')+')');
  else if(f.type==='IMAGE')out.push(images.has(f.imageRef)?'image ./uploads/'+images.get(f.imageRef):'image');
 }
 return out.join(', ');
}
function slug(s){return String(s||'image').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)||'image'}
function collectImageRefs(node,out=new Map()){
 if(!node||out.size>=MAX_FILL_IMAGES)return out;
 for(const f of Array.isArray(node.fills)?node.fills:[])if(f.type==='IMAGE'&&f.imageRef&&!out.has(f.imageRef)&&out.size<MAX_FILL_IMAGES)out.set(f.imageRef,slug(node.name));
 for(const c of node.children||[])collectImageRefs(c,out);
 return out;
}
// Compact, indented description of the layer tree.
function spec(root,images=new Map()){
 const lines=[],colors=new Map(),fonts=new Map();let count=0,truncated=false;
 const count1=(map,k)=>{if(k)map.set(k,(map.get(k)||0)+1)};
 function walk(n,depth){
  if(!n||n.visible===false)return;
  if(count>=MAX_NODES){truncated=true;return}
  count++;
  const b=n.absoluteBoundingBox,parts=[n.type,JSON.stringify(String(n.name||'').slice(0,60))];
  if(b)parts.push(Math.round(b.width)+'×'+Math.round(b.height));
  if(n.layoutMode&&n.layoutMode!=='NONE'){
   parts.push('auto-layout '+(n.layoutMode==='HORIZONTAL'?'row':'column')+(n.itemSpacing?' gap '+n.itemSpacing:''));
   const pad=[n.paddingTop,n.paddingRight,n.paddingBottom,n.paddingLeft].map(v=>v||0);
   if(pad.some(Boolean))parts.push('padding '+pad.join('/'));
   if(n.primaryAxisAlignItems&&n.primaryAxisAlignItems!=='MIN')parts.push('justify '+n.primaryAxisAlignItems.toLowerCase());
   if(n.counterAxisAlignItems&&n.counterAxisAlignItems!=='MIN')parts.push('align '+n.counterAxisAlignItems.toLowerCase());
  }
  const fill=fillText(n.fills,images);
  if(fill&&n.type!=='TEXT')parts.push('fill '+fill);
  for(const f of n.fills||[])if(f.type==='SOLID'&&f.visible!==false)count1(colors,hex(f.color,f.opacity??1));
  const stroke=fillText(n.strokes,images);if(stroke&&n.strokeWeight)parts.push('border '+n.strokeWeight+'px '+stroke);
  if(n.cornerRadius)parts.push('radius '+n.cornerRadius);
  else if(Array.isArray(n.rectangleCornerRadii)&&n.rectangleCornerRadii.some(Boolean))parts.push('radius '+n.rectangleCornerRadii.join('/'));
  for(const e of n.effects||[])if(e.visible!==false&&/SHADOW/.test(e.type))parts.push((e.type==='INNER_SHADOW'?'inner-':'')+'shadow '+(e.offset?.x||0)+' '+(e.offset?.y||0)+' '+(e.radius||0)+' '+hex(e.color));
  if(n.opacity!==undefined&&n.opacity<1)parts.push('opacity '+Math.round(n.opacity*100)+'%');
  if(n.type==='TEXT'){
   const s=n.style||{};
   parts.push((s.fontFamily||'')+' '+(s.fontSize||'')+(s.lineHeightPx?'/'+Math.round(s.lineHeightPx):'')+' '+(s.fontWeight||'')+(s.italic?' italic':'')+(s.textCase&&s.textCase!=='ORIGINAL'?' '+s.textCase.toLowerCase():'')+(s.letterSpacing?' tracking '+Math.round(s.letterSpacing*10)/10:'')+(s.textAlignHorizontal&&s.textAlignHorizontal!=='LEFT'?' '+s.textAlignHorizontal.toLowerCase():''));
   if(fill)parts.push('color '+fill);
   parts.push('text '+JSON.stringify(String(n.characters||'').slice(0,400)));
   count1(fonts,s.fontFamily&&s.fontFamily+' '+(s.fontWeight||''));
  }
  lines.push('  '.repeat(Math.min(depth,12))+parts.join(' · '));
  if(n.type!=='TEXT'&&n.type!=='VECTOR'&&n.type!=='BOOLEAN_OPERATION')for(const c of n.children||[])walk(c,depth+1);
 }
 walk(root,0);
 const top=m=>[...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12).map(e=>e[0]).join(', ');
 return['Colours (most used first): '+(top(colors)||'none'),'Fonts: '+(top(fonts)||'none'),'Layers:',...lines,...(truncated?['(Only the first '+MAX_NODES+' layers are listed.)']:[])].join('\n');
}
function imageType(buf){
 if(buf.length>8&&buf[0]===0x89&&buf[1]===0x50)return['png','image/png'];
 if(buf.length>3&&buf[0]===0xff&&buf[1]===0xd8)return['jpg','image/jpeg'];
 if(buf.length>12&&buf.toString('ascii',0,4)==='RIFF'&&buf.toString('ascii',8,12)==='WEBP')return['webp','image/webp'];
 if(buf.length>6&&buf.toString('ascii',0,3)==='GIF')return['gif','image/gif'];
 return null;
}
async function importFrame({url,token,auth='pat'},{fetchImpl=fetch}={}){
 const {key,nodeId:linked}=parseUrl(url);
 if(!/^[A-Za-z0-9._~-]{20,20000}$/.test(String(token||'')))throw fail(400,auth==='oauth'?'Reconnect Figma and try again.':'Add a valid Figma access token.');
 const headers=auth==='oauth'?{Authorization:'Bearer '+String(token)}:{'X-Figma-Token':String(token)};
 const api=async p=>{
  const r=await fetchImpl(API+p,{headers,signal:AbortSignal.timeout(30000)});
  const body=await r.json().catch(()=>({}));
  if(r.status===403||r.status===401)throw fail(400,auth==='oauth'?'Figma connection cannot read this file. Reconnect Figma or check that the connected account has access.':'Figma refused the token. Check that it is valid and can read this file.');
  if(r.status===404)throw fail(404,'Figma could not find that file or frame. Check the link and that your account can open it.');
  if(r.status===429)throw fail(429,'Figma rate limit reached. Try again in a minute.');
  if(!r.ok)throw fail(502,'Figma API error '+r.status+(body.err?': '+body.err:''));
  return body;
 };
 const download=async(src,max=MAX_IMAGE)=>{
  let u;try{u=new URL(src)}catch{return null}
  if(u.protocol!=='https:'||!/(^|\.)(figma\.com|amazonaws\.com|figmausercontent\.com)$/.test(u.hostname))return null;
  const r=await fetchImpl(u.href,{signal:AbortSignal.timeout(30000)});
  if(!r.ok)return null;
  const buf=Buffer.from(await r.arrayBuffer());
  return buf.length<=max?buf:null;
 };
 let nodeId=linked;
 if(!nodeId){
  const file=await api('/files/'+key+'?depth=2');
  const page=(file.document?.children||[])[0];
  const frame=(page?.children||[]).find(c=>/^(FRAME|COMPONENT|SECTION|COMPONENT_SET)$/.test(c.type));
  if(!frame)throw fail(400,'Could not find a frame on the first page. Select a frame in Figma and copy its link.');
  nodeId=frame.id;
 }
 const nodes=await api('/files/'+key+'/nodes?ids='+encodeURIComponent(nodeId));
 const root=nodes.nodes?.[nodeId]?.document;
 if(!root)throw fail(404,'Figma could not find that frame. Copy the link with the frame selected.');
 // Rendered frame, used as the visual reference.
 let screenshot=null;
 for(const scale of [1,0.5]){
  const r=await api('/images/'+key+'?ids='+encodeURIComponent(nodeId)+'&format=png&scale='+scale);
  const src=r.images?.[nodeId];
  if(!src)break;
  const buf=await download(src);
  if(buf&&imageType(buf)){screenshot={name:'figma-'+slug(root.name)+'.png',mime:'image/png',data:buf.toString('base64')};break}
 }
 // Photos used as image fills, saved as project uploads.
 const refs=collectImageRefs(root),images=[];
 if(refs.size){
  const meta=await api('/files/'+key+'/images').catch(()=>({}));
  const used=new Set();
  for(const [ref,name] of refs){
   const src=meta.meta?.images?.[ref];if(!src)continue;
   const buf=await download(src).catch(()=>null);const type=buf&&imageType(buf);if(!type)continue;
   let base=name,i=2;while(used.has(base))base=name+'-'+i++;used.add(base);
   images.push({ref,name:base+'.'+type[0],mime:type[1],data:buf.toString('base64')});
  }
 }
 return{key,nodeId,name:String(root.name||'Frame').slice(0,80),root,screenshot,images};
}
module.exports={parseUrl,importFrame,spec,collectImageRefs,hex};

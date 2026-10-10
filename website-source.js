'use strict';
// Source components compile to static HTML; published pages need no framework/CDN.
const MAX_PAGES=40,NAME=/^[a-z0-9][a-z0-9-]{0,48}$/;
function components(files){
 const value=files['components.json'];if(!value)return{};
 const parsed=typeof value==='string'?JSON.parse(value):value;
 if(!parsed||Array.isArray(parsed)||typeof parsed!=='object'||Object.keys(parsed).length>30)throw Error('Invalid shared components');
 for(const[name,html]of Object.entries(parsed))if(!NAME.test(name)||typeof html!=='string'||html.length>40000)throw Error('Invalid shared component: '+name);
 return parsed;
}
function expand(html,files){
 const shared=components(files);
 function render(input,stack=[]){return input.replace(/<kairoq-component\s+name=["']([a-z0-9-]+)["']\s*>\s*<\/kairoq-component>/gi,(_,name)=>{
  if(!(name in shared))throw Error('Missing shared component: '+name);
  if(stack.includes(name)||stack.length>=8)throw Error('Recursive shared component: '+name);
  return render(shared[name],[...stack,name]);
 });}
 const rendered=render(String(html));if(/<kairoq-component\b/i.test(rendered))throw Error('Invalid shared component reference');
 if(rendered.length>250000)throw Error('Expanded page exceeds size limit');return rendered;
}
function assets(input=[]){
 if(!Array.isArray(input)||input.length>6)throw Error('Upload at most six brand images');
 const output=[];let total=0;
 for(const item of input){
  const name=String(item.name||'').toLowerCase().replace(/\.(png|jpe?g|webp)$/,'');
  if(!NAME.test(name)||output.some(x=>x.name===name))throw Error('Use unique image names with letters, numbers and hyphens');
  const data=String(item.data||''),match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(data);
  if(!match)throw Error('Images must be PNG, JPEG or WebP');
  const bytes=Buffer.from(match[2],'base64');
  const valid=match[1]==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):match[1]==='jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
  if(!valid||bytes.length>1024*1024||bytes.length<12||bytes.toString('base64')!==match[2])throw Error('Invalid image or image exceeds 1 MB');
  total+=bytes.length;if(total>4*1024*1024)throw Error('Brand images exceed 4 MB total');
  output.push({name,data,alt:String(item.alt||name).slice(0,160)});
 }return output;
}
function assetFiles(input){const list=assets(input);return list.length?{'assets.json':JSON.stringify(list)}:{ };}
function resolveAssets(html,files){
 const list=files['assets.json']?assets(JSON.parse(files['assets.json'])):[];
 return html.replace(/kairoq-asset:([a-z0-9-]+)/g,(_,name)=>{const asset=list.find(x=>x.name===name);if(!asset)throw Error('Missing uploaded image: '+name);return asset.data;});
}
function modelSource(files){const result={...files};if(result['assets.json'])result['assets.json']=JSON.stringify(JSON.parse(result['assets.json']).map(({name,alt})=>({name,alt,src:'kairoq-asset:'+name})));return result;}
function instructions(files={}){return '\nSHARED SITE ARCHITECTURE: Put reusable header, footer, CTA and other repeated sections in components.json, a JSON object mapping lowercase-kebab names to HTML strings. Reference them with <kairoq-component name="header"></kairoq-component>. Kairoq compiles these into every page. Keep route-specific content in each page; use one shared styles.css and app.js. Shared app.js must initialize safely on pages where a widget is absent. Give each page unique title, description and one h1. Use accessible tabs, real calculators and clearly labelled illustrative demos when relevant. Never portray scripted demos as real booking or AI results.\nCONNECTED FORMS: For contact, demo or enquiry capture, use <form data-kairoq-form="contact"> with labelled, named inputs and required attributes. Use contact or demo as the form name. Kairoq handles submission and saves enquiries in the owner inbox. Do not add your own submit handler, invent email delivery, or display success before the server confirms. Do not collect passwords, payment data or sensitive identity documents.\nUPLOADED BRAND ASSETS: '+(files['assets.json']?JSON.stringify(JSON.parse(files['assets.json']).map(({name,alt})=>({name,alt,src:'kairoq-asset:'+name}))):'No uploaded images. Use CSS or inline SVG illustration.')+' Use these exact src references with meaningful alt text. Never invent asset URLs.';}
module.exports={MAX_PAGES,components,expand,assets,assetFiles,resolveAssets,modelSource,instructions};

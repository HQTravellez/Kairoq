"use strict";
// ai.extract for generated apps: structured data from text or photos (a menu photo becomes menu
// items, a receipt becomes totals, a chat becomes a booking enquiry). The app describes the
// shape it wants; the answer is checked against it, retried once with the problems listed, and
// returned with the fields that could not be found.
//
// Shape: {"name":"string","price":"number","vegan":"boolean?","items":[{"name":"string"}]}
// Types: string, number, integer, boolean, date (YYYY-MM-DD), email, phone; "?" = optional;
// [shape] = a list; {…} = an object.
const TYPES=new Set(['string','number','integer','boolean','date','email','phone']);
const MAX_IMAGES=4,MAX_IMAGE_BYTES=4*1024*1024;
function fail(status,message){return Object.assign(Error(message),{status})}

function checkShape(shape,depth=0){
 if(depth>4)throw fail(400,'The shape is nested too deeply (4 levels at most)');
 if(typeof shape==='string'){if(!TYPES.has(shape.replace(/\?$/,'')))throw fail(400,'Unknown type "'+shape+'". Use string, number, integer, boolean, date, email or phone, with ? for optional.');return}
 if(Array.isArray(shape)){if(shape.length!==1)throw fail(400,'A list is written as [shape], with one shape inside');return checkShape(shape[0],depth+1)}
 if(!shape||typeof shape!=='object')throw fail(400,'Describe the shape as an object, e.g. {"name":"string","price":"number"}');
 const keys=Object.keys(shape);if(!keys.length||keys.length>60)throw fail(400,'A shape has 1 to 60 fields');
 for(const k of keys){if(!/^[A-Za-z_][\w]{0,40}$/.test(k))throw fail(400,'Field names are letters, numbers and _: "'+k+'"');checkShape(shape[k],depth+1)}
}
// A JSON example of the shape, for the model.
function example(shape){
 if(typeof shape==='string'){const t=shape.replace(/\?$/,'');return{string:'text',number:0,integer:0,boolean:false,date:'YYYY-MM-DD',email:'name@example.com',phone:'+1 555 0100'}[t]}
 if(Array.isArray(shape))return[example(shape[0])];
 return Object.fromEntries(Object.entries(shape).map(([k,v])=>[k,example(v)]));
}
// Checks and gently fixes a value: "12,50" → 12.5 for numbers, "yes" → true. Returns the clean
// value, the problems, and the paths of required fields that are missing.
function validate(shape,value,path='',out={problems:[],missing:[]}){
 if(typeof shape==='string'){
  const optional=shape.endsWith('?'),t=shape.replace(/\?$/,'');
  if(value===null||value===undefined||value===''){if(!optional)out.missing.push(path||'(value)');return{value:null,...out}}
  let v=value;
  if(t==='number'||t==='integer'){if(typeof v==='string'){const digits=v.replace(/[^\d.,-]/g,'');const n=/\d/.test(digits)?Number(digits.replace(/,(?=\d{1,2}$)/,'.').replace(/,/g,'')):NaN;v=Number.isFinite(n)?n:v}if(typeof v!=='number'||!Number.isFinite(v))out.problems.push(path+' should be a number');else if(t==='integer')v=Math.round(v)}
  else if(t==='boolean'){if(typeof v==='string')v=/^(true|yes|y|1|si|sí|oui|ja)$/i.test(v.trim())?true:/^(false|no|n|0|non|nein)$/i.test(v.trim())?false:v;if(typeof v!=='boolean')out.problems.push(path+' should be true or false')}
  else{v=String(v).trim().slice(0,5000);
   if(t==='date'&&!/^\d{4}-\d{2}-\d{2}$/.test(v))out.problems.push(path+' should be a date like 2026-05-30');
   if(t==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))out.problems.push(path+' should be an email address');
   if(t==='phone'&&(v.replace(/\D/g,'').length<6))out.problems.push(path+' should be a phone number')}
  return{value:v,...out};
 }
 if(Array.isArray(shape)){
  if(value===null||value===undefined)return{value:[],...out};
  if(!Array.isArray(value)){out.problems.push((path||'the answer')+' should be a list');return{value:[],...out}}
  return{value:value.slice(0,500).map((x,i)=>validate(shape[0],x,path+'['+i+']',out).value),...out};
 }
 if(!value||typeof value!=='object'||Array.isArray(value)){if(value!==null&&value!==undefined)out.problems.push((path||'the answer')+' should be an object');value={}}
 const obj={};for(const [k,s] of Object.entries(shape))obj[k]=validate(s,value[k],path?path+'.'+k:k,out).value;
 return{value:obj,...out};
}
function parseJson(text){const t=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'');try{return JSON.parse(t)}catch{const a=Math.min(...['{','['].map(c=>{const i=t.indexOf(c);return i<0?Infinity:i})),b=Math.max(t.lastIndexOf('}'),t.lastIndexOf(']'));if(!(a<b))return undefined;try{return JSON.parse(t.slice(a,b+1))}catch{return undefined}}}
function images(list){
 const arr=(Array.isArray(list)?list:list?[list]:[]).slice(0,MAX_IMAGES+1);
 if(arr.length>MAX_IMAGES)throw fail(400,'At most '+MAX_IMAGES+' images');
 return arr.map(u=>{const m=/^data:(image\/(?:png|jpe?g|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(String(u||''));if(!m)throw fail(400,'Images must be PNG, JPEG, WebP or GIF data URLs');if(m[2].length*0.75>MAX_IMAGE_BYTES)throw fail(413,'Each image can be up to 4 MB');return String(u)});
}
const SYSTEM=`You extract structured data for an app. Read the text and/or images and fill in the JSON shape.
Rules: use only what is written or shown; never invent values. Use null when something is not there. Dates as YYYY-MM-DD. Numbers without currency symbols.
Respond with ONLY JSON in exactly this shape:
`;
// args: {shape, text, images:[data URLs], instructions}. aiCall: react-backend's appAi.
async function extract(args,aiCall){
 const shape=args&&(args.shape||args.schema);
 checkShape(shape);
 const text=String(args.text||'').slice(0,60000),imgs=images(args.images||args.image);
 if(!text.trim()&&!imgs.length)throw fail(400,'Give text or an image to read');
 const system=SYSTEM+JSON.stringify(example(shape),null,1)+(args.instructions?'\n\nAlso: '+String(args.instructions).slice(0,1500):'');
 const ask=async extra=>{const out=await aiCall({system:system+(extra||''),messages:[{role:'user',content:text||'(see the image)'}],images:imgs,max_tokens:Math.max(300,Math.min(4000,Number(args.max_tokens)||2000))});return parseJson(out.text)};
 let raw=await ask(),v=validate(shape,raw);
 // One retry with the problems listed.
 if(raw===undefined||v.problems.length){
  const again=await ask('\n\nYour last answer had problems: '+(raw===undefined?'it was not valid JSON':v.problems.slice(0,10).join('; '))+'. Answer again in exactly the shape.');
  const v2=validate(shape,again);
  if(again!==undefined&&v2.problems.length<=v.problems.length){raw=again;v=v2}
 }
 if(raw===undefined)throw fail(502,'The AI did not return data. Try again.');
 return{data:v.value,missing:v.missing,...(v.problems.length?{problems:v.problems.slice(0,10)}:{})};
}
module.exports={extract,validate,example,checkShape,images};

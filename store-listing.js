"use strict";
// The store listing for a native app (App Store and Google Play), prepared by Kairoq and checked
// by the owner before anything is sent: the name, subtitle, description, keywords and category
// (written from the app itself, never invented claims), the privacy answers, a 1024 px icon and
// real screenshots of the app's screens at the sizes the stores ask for.
const fs=require('fs'),path=require('path');
const builder=require('./react-builder');
const clip=(v,n)=>String(v??'').replace(/[ \t]+/g,' ').trim().slice(0,n);

// What the stores accept.
const LIMITS={name:30,subtitle:30,promo:170,description:4000,keywords:100};
const CATEGORIES=['Business','Education','Entertainment','Finance','Food & Drink','Health & Fitness','Lifestyle','Medical','Music','Navigation','News','Photo & Video','Productivity','Reference','Shopping','Social Networking','Sports','Travel','Utilities','Weather','Games','Books','Graphics & Design','Kids'];
// iPhone 6.9" (1320 x 2868) and an Android phone (1080 x 1920).
const SHOTS={ios:{width:440,height:956,scale:3},android:{width:360,height:640,scale:3}};

function dir(id){const d=path.join(builder.projectDir(id),'store');fs.mkdirSync(d,{recursive:true});return d}
function slug(s){return String(s||'app').toLowerCase().replace(/[^a-z0-9]+/g,'').slice(0,24)||'app'}
// Store identifiers: reverse-domain, letters and digits only; the owner can change them before the first publish.
function identifiers(meta){
 const s=meta.store||{},base='app.kairoq.'+slug(meta.name)+meta.id.slice(0,4);
 return{bundle_id:s.bundle_id||base,package_name:s.package_name||base};
}
function validIdentifier(v){return /^[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*){2,}$/.test(String(v||''))&&String(v).length<=150}

function cleanListing(raw={}){
 const kw=[...new Set(String(raw.keywords||'').split(',').map(k=>k.trim().toLowerCase()).filter(Boolean))];
 let keywords='';for(const k of kw){const next=keywords?keywords+','+k:k;if(next.length>LIMITS.keywords)break;keywords=next}
 return{name:clip(raw.name,LIMITS.name),subtitle:clip(raw.subtitle,LIMITS.subtitle),promo:clip(raw.promo,LIMITS.promo),
  description:String(raw.description||'').replace(/\r/g,'').trim().slice(0,LIMITS.description),keywords,
  category:CATEGORIES.includes(raw.category)?raw.category:'Lifestyle',
  privacy:{collects:Boolean(raw.privacy&&raw.privacy.collects),data:Array.isArray(raw.privacy&&raw.privacy.data)?raw.privacy.data.map(x=>clip(x,60)).filter(Boolean).slice(0,8):[]},
  support_url:/^https:\/\/\S+$/.test(String(raw.support_url||''))?clip(raw.support_url,300):'',
  privacy_url:/^https:\/\/\S+$/.test(String(raw.privacy_url||''))?clip(raw.privacy_url,300):''};
}
// Problems that would stop a store from taking the listing.
function missing(listing,{icon,shots}={}){
 const out=[];
 if(!listing||!listing.name)out.push('An app name (up to 30 characters).');
 if(!listing||String(listing.description||'').length<10)out.push('A description.');
 if(!listing||!listing.privacy_url)out.push('A link to a privacy policy (both stores require one).');
 if(!listing||!listing.support_url)out.push('A support link (a page or contact form people can reach you on).');
 if(!icon)out.push('An icon.');
 if(!shots||!shots.ios||!shots.ios.length)out.push('iPhone screenshots.');
 if(!shots||!shots.android||!shots.android.length)out.push('Android screenshots.');
 return out;
}

const PROMPT=`You write App Store and Google Play listings for small businesses. Use ONLY what the app's code and the owner's messages say: never invent features, awards, numbers, reviews or claims ("#1", "best", "millions of users"). Plain, warm, specific words; no filler ("seamless", "elevate", "unlock").
Respond with ONLY JSON: {"name":"up to 30 characters","subtitle":"up to 30 characters, what it does","promo":"one sentence, up to 170 characters","description":"3 to 6 short paragraphs or lines: what the app does, who it is for, the main things people can do","keywords":"comma separated, up to 100 characters in total, no spaces after commas, no app name","category":"one of: ${CATEGORIES.join(', ')}","privacy":{"collects":false,"data":["kinds of personal data the app collects and sends anywhere, e.g. Name, Email address; empty when it keeps everything on the phone"]}}`;

async function write(meta,files,{callModel,signal}={}){
 const code=Object.entries(files||{}).filter(([n])=>/^src\/.*\.(jsx?|js)$/.test(n)&&n!=='src/main.jsx'&&!n.startsWith('src/components/native')).map(([n,c])=>'// '+n+'\n'+String(c).slice(0,4000)).join('\n\n').slice(0,24000);
 const asked=(meta.messages||[]).filter(m=>m.role==='user').map(m=>m.text).join('\n').slice(0,3000);
 const raw=await callModel({messages:[{role:'system',content:PROMPT},{role:'user',content:'App name: '+meta.name+'\nWhat the owner asked for:\n'+asked+'\n\nThe app code:\n'+code}],temperature:0.3,maxOutputTokens:1800,purpose:'store-listing',signal},
  c=>{const t=String(c).trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'');return JSON.parse(t.slice(t.indexOf('{'),t.lastIndexOf('}')+1))});
 return cleanListing({...raw,name:raw.name||meta.name});
}

// A 1024 px icon with no transparency: the owner's own icon when they uploaded one, otherwise
// the app's initials on its main colour.
function iconHtml(meta){
 const own=meta.mobile&&meta.mobile.icon&&require('./react-assets').read(meta.id,meta.mobile.icon);
 const p=(meta.design&&meta.design.palette)||{},bg=/^#[0-9a-f]{6}$/i.test(p.primary||'')?p.primary:'#3f4cf6';
 const initials=(String(meta.name).match(/\b[\p{L}\p{N}]/gu)||['A']).slice(0,2).join('').toUpperCase();
 const inner=own?'<img src="data:'+own.type+';base64,'+own.bytes.toString('base64')+'" style="width:100%;height:100%;object-fit:cover">'
  :'<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font:700 '+(initials.length>1?400:520)+'px -apple-system,system-ui,sans-serif;color:#fff;letter-spacing:-0.03em">'+initials.replace(/[<&>]/g,'')+'</div>';
 return'<!doctype html><html><body style="margin:0;width:1024px;height:1024px;background:'+bg+';overflow:hidden">'+inner+'</body></html>';
}

// Prepares everything: text (model), icon and screenshots. Keeps what the owner already edited.
async function prepare(id,{callModel,renderHtml,storeShots,signal}={}){
 const meta=builder.loadMeta(id);
 if(!meta.current_version)throw Object.assign(Error('Build the app first'),{status:409});
 const files=builder.loadFiles(id,meta.current_version),d=dir(id);
 const prev=meta.store||{};
 const listing=prev.listing&&prev.listing.edited?prev.listing:{...await write(meta,files,{callModel,signal}),privacy_url:prev.listing&&prev.listing.privacy_url||'',support_url:prev.listing&&prev.listing.support_url||''};
 let icon=prev.icon||null;
 if(renderHtml){try{fs.writeFileSync(path.join(d,'icon.png'),await renderHtml(iconHtml(meta),{width:1024,height:1024}));icon='icon.png'}catch(e){console.warn('[store] icon',String(e.message||e).slice(0,160))}}
 const shots={ios:[],android:[]};
 if(storeShots){
  const url=builder.previewUrl(meta);
  for(const [platform,size] of Object.entries(SHOTS)){
   try{const pics=await storeShots(url,size);pics.forEach((png,i)=>{const name=platform+'-'+(i+1)+'.png';fs.writeFileSync(path.join(d,name),png);shots[platform].push(name)})}
   catch(e){console.warn('[store] shots',platform,String(e.message||e).slice(0,160))}
  }
 }
 const m=builder.loadMeta(id);
 m.store={...(m.store||{}),...identifiers(m),listing,icon,shots,prepared_version:m.current_version,prepared_at:new Date().toISOString()};
 builder.saveMeta(m);
 return view(m);
}
// The owner's edits to the listing and identifiers.
function update(id,body={}){
 const m=builder.loadMeta(id),s=m.store||{};
 const listing=cleanListing({...(s.listing||{}),...(body.listing||{})});
 const next={...s,listing:{...listing,edited:true}};
 for(const k of ['bundle_id','package_name'])if(body[k]!==undefined){
  if(!validIdentifier(body[k]))throw Object.assign(Error('Use a reverse-domain ID with letters and numbers, like com.yourbusiness.app'),{status:400});
  if(s.locked&&s.locked[k]&&s[k]!==body[k])throw Object.assign(Error('This ID is already registered with the store and cannot change.'),{status:409});
  next[k]=String(body[k]);
 }
 m.store=next;builder.saveMeta(m);return view(m);
}
function file(id,name){if(!/^(icon|ios-\d|android-\d)\.png$/.test(String(name)))return null;const f=path.join(dir(id),name);return fs.existsSync(f)?fs.readFileSync(f):null}
function view(meta){
 const s=meta.store||{};
 return{...identifiers(meta),listing:s.listing||null,icon:s.icon||null,shots:s.shots||{ios:[],android:[]},prepared_version:s.prepared_version||null,current_version:meta.current_version,
  missing:missing(s.listing,{icon:s.icon,shots:s.shots}),limits:LIMITS,categories:CATEGORIES};
}
module.exports={prepare,update,view,file,write,cleanListing,missing,identifiers,validIdentifier,iconHtml,LIMITS,CATEGORIES,SHOTS};

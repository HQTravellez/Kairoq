"use strict";
// Real photos for a new site, found and downloaded before the first build: Pexels when
// PEXELS_API_KEY is set (free key; its licence allows free use, and asks for a credit to the
// photographer and a link to Pexels), otherwise Openverse (openly licensed photos, CC0 or CC BY only,
// commercial use). Downloaded through the safe fetcher in builder-assets.js (public HTTPS only, size
// limit, bytes checked), saved into the project's uploads, and every photo's licence and credit
// recorded. A real photo never looks generated; this replaces guessed stock links.
const assets=require('./builder-assets');

const MIN_WIDTH=1200;
function slug(s){return String(s||'photo').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,32)||'photo'}
async function readJson(url,read,headers){return JSON.parse((await read(url,{limit:6*1024*1024,headers})).bytes.toString('utf8'))}

// Candidates for one search, best first.
async function pexels(query,{key,read}){
 const data=await readJson('https://api.pexels.com/v1/search?query='+encodeURIComponent(query)+'&orientation=landscape&size=medium&per_page=6',read,{Authorization:key});
 return(data.photos||[]).filter(p=>p.src&&p.src.large2x&&p.width>=MIN_WIDTH).map(p=>({url:p.src.large2x,title:String(p.alt||query).slice(0,140),creator:String(p.photographer||'').slice(0,80),creator_url:p.photographer_url||'',source_url:p.url,license:'Pexels License',license_url:'https://www.pexels.com/license/',provider:'Pexels',attribution_required:true}));
}
async function openverse(query,{read}){
 const data=await readJson('https://api.openverse.org/v1/images/?q='+encodeURIComponent(query)+'&license=cc0,by&license_type=commercial&aspect_ratio=wide&size=large&page_size=8',read);
 return(data.results||[]).filter(a=>['cc0','by'].includes(a.license)&&a.url&&a.url.startsWith('https://')&&(!a.width||a.width>=MIN_WIDTH)).map(a=>({url:a.url,title:String(a.title||query).slice(0,140),creator:String(a.creator||'').slice(0,80),creator_url:a.creator_url||'',source_url:a.foreign_landing_url||'',license:a.license==='cc0'?'CC0':'CC BY '+(a.license_version||''),license_url:a.license_url||'',provider:'Openverse',attribution_required:a.license!=='cc0'}));
}

// Photos for up to three searches: [{name, data (base64), query, credit}].
async function find(queries,{env=process.env,read=(url,o)=>assets.remote(url,o)}={}){
 const key=env.PEXELS_API_KEY,out=[],used=new Set();
 for(const query of (queries||[]).map(q=>String(q||'').trim()).filter(q=>q.length>=3).slice(0,3)){
  let list=[];
  try{list=key?await pexels(query,{key,read}):[]}catch{}
  if(!list.length)try{list=await openverse(query,{read})}catch{}
  for(const c of list.slice(0,4)){
   if(used.has(c.url))continue;
   try{
    const got=await read(c.url,{limit:3*1024*1024});
    const ext=/png/.test(got.type)?'png':/webp/.test(got.type)?'webp':'jpg';
    assets.validateBytes(got.bytes,ext);
    used.add(c.url);
    out.push({name:'photo-'+slug(query)+'.'+ext,data:got.bytes.toString('base64'),query,credit:c});
    break;
   }catch{}
  }
 }
 return out;
}

// The credit line a site must show for the photos that need one.
function creditLine(photos){
 const need=(photos||[]).filter(p=>p.credit&&p.credit.attribution_required);
 if(!need.length)return'';
 const pex=need.some(p=>p.credit.provider==='Pexels');
 return'Photo credits (show them in small text in the footer, as links): '+need.map(p=>'"'+p.credit.title+'" by '+(p.credit.creator||'unknown')+' ('+p.credit.license+(p.credit.source_url?', '+p.credit.source_url:'')+')').join('; ')+(pex?'; and "Photos from Pexels" linking to https://www.pexels.com':'')+'.';
}
module.exports={find,creditLine,pexels,openverse};

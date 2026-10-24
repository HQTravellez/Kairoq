"use strict";
// Looks: the colours and fonts an owner picks for a new app before the first build.
// 100 looks are made from the design library's palettes (design-library/palettes.json) and a
// short list of font pairs, each tagged with a feel (Calm, Bold, Playful, Premium, Minimal).
// The builder asks "How should it feel?", shows three looks, and the one picked becomes the
// project's design (planned_design, used by react-builder prepareDesign instead of an AI brief).
// A look can also come from a public website: Kairoq reads its colours and fonts and either
// matches them exactly (the owner's own brand) or uses them only as inspiration.

const FEELS=[['calm','Calm'],['bold','Bold'],['playful','Playful'],['premium','Premium'],['minimal','Minimal']];
// Each library palette's feel, chosen by hand so every feel has enough looks.
const PALETTE_FEEL={
 'cool-white-slate':'calm','rose-grey-green':'calm','three-stones':'calm','moss-sand':'calm','green-mat-chocolate':'calm','teal-on-paper':'calm','olive-on-bone':'calm','charcoal-room-sage':'calm','green-black-bone':'calm','blush-sage-slate':'calm','studio-grey':'calm','swap-pastels':'calm','cobalt-on-sand':'calm',
 'white-link-blue':'minimal','white-navy-tab':'minimal','putty-black-teal':'minimal','stone-blueprint':'minimal','paper-grey-brass':'minimal','cool-grey-cobalt':'minimal','white-mint-tiles':'minimal','offwhite-bottle-yellow':'minimal','blue-red-black':'minimal','report-blocks':'minimal','mint-orange-grey':'minimal','mint-pink-accounts':'minimal',
 'graphite-safety-orange':'bold','black-crimson':'bold','white-signal-red':'bold','cobalt-field':'bold','mustard-field':'bold','carmine-field':'bold','orange-field-black':'bold','ultramarine-yellow':'bold','charcoal-primaries':'bold','poster-chapters':'bold','orange-sky-lime':'bold','post-red-mustard':'bold','blue-black-cornflower':'bold',
 'pink-field-lime':'playful','sky-sand':'playful','candy-chapters':'playful','candy-on-black':'playful','card-pastels':'playful','navy-pink':'playful','burgundy-bubblegum':'playful','sky-field-navy':'playful','soot-pale-lime':'playful','plum-black-pink':'playful','forest-pale-lime':'playful',
 'warm-black-gold':'premium','lunar-grey-bronze':'premium','bottle-green-gold':'premium','oxblood-grey':'premium','blush-aubergine':'premium','tobacco-olive':'premium','walnut-tan':'premium'
};
// Font pairs (all in react-design FONTS, so the built app can load them) and the feels they suit.
const TYPE=[
 {head:'Hanken Grotesk',headW:600,body:'Hanken Grotesk',kind:'clean',feels:['minimal','calm']},
 {head:'Albert Sans',headW:600,body:'Albert Sans',kind:'clean',feels:['calm','playful','minimal']},
 {head:'Archivo',headW:800,body:'Archivo',kind:'clean',feels:['bold','minimal']},
 {head:'Space Grotesk',headW:600,body:'Space Grotesk',kind:'clean',feels:['minimal','bold']},
 {head:'Literata',headW:500,body:'Albert Sans',kind:'serif',feels:['calm','premium']},
 {head:'Newsreader',headW:400,body:'Work Sans',kind:'serif',feels:['premium','calm']},
 {head:'Bodoni Moda',headW:500,body:'Work Sans',kind:'serif',feels:['premium']},
 {head:'EB Garamond',headW:500,body:'EB Garamond',kind:'serif',feels:['premium','calm']},
 {head:'Fraunces',headW:600,body:'Figtree',kind:'serif',feels:['playful','calm']},
 {head:'Bricolage Grotesque',headW:800,body:'Work Sans',kind:'bold',feels:['bold','playful']},
 {head:'Unbounded',headW:600,body:'Albert Sans',kind:'bold',feels:['playful','bold']},
 {head:'Anton',headW:400,body:'Work Sans',kind:'bold',feels:['bold']}
];
const CORNERS={sharp:'0.125rem',soft:'0.75rem',round:'1.25rem'};
const HEX=/^#[0-9a-f]{6}$/;

function palettes(){const p=require('./design-library/palettes.json');return Array.isArray(p)?p:p.palettes}
function slug(s){return String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
function group(tags){const t=tags||[];return t.includes('pastel-fields')?'pastel':t.includes('earth')?'earthy':t.includes('dark-neutral')?'dark':t.some(x=>['mono-accent','flat-loud','single-field','two-tone'].includes(x))?'colourful':'light'}

// The 100 looks: every palette once with its first suitable font pair, then 44 more with the next pair.
let cache=null;
function catalog(){
 if(cache)return cache;
 const P=palettes(),out=[];
 for(let i=0;out.length<100;i++){
  const p=P[i%P.length],round=Math.floor(i/P.length),feel=PALETTE_FEEL[p.id]||'calm';
  const fits=TYPE.filter(t=>t.feels.includes(feel)),t=fits[(round+i%fits.length)%fits.length];
  out.push({id:p.id+'--'+slug(t.head),name:p.name,feel,group:group(p.tags),
   colors:{bg:p.bg,surface:p.surface,ink:p.ink,muted:p.muted,accent:p.accent,accentInk:p.accentInk},
   head:t.head,headW:t.headW,body:t.body,kind:t.kind,corners:'soft',spacing:'comfortable'});
 }
 return cache=out;
}
function fonts(){return[...new Set(TYPE.flatMap(t=>[t.head,t.body]))]}

// ---------- colour helpers ----------
function rgb(h){const n=parseInt(String(h).slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255]}
function hex(c){return'#'+c.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('')}
function lum(h){return rgb(h).map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)}).reduce((a,v,i)=>a+v*[0.2126,0.7152,0.0722][i],0)}
function contrast(a,b){const x=lum(a),y=lum(b);return(Math.max(x,y)+0.05)/(Math.min(x,y)+0.05)}
function mix(a,b,t){const x=rgb(a),y=rgb(b);return hex(x.map((v,i)=>v+(y[i]-v)*t))}
function saturation(h){const c=rgb(h).map(v=>v/255),mx=Math.max(...c),mn=Math.min(...c);return mx===mn?0:(mx-mn)/(1-Math.abs(mx+mn-1))}

// ---------- checking a look sent by the browser ----------
function normalizeLook(v){
 if(!v||typeof v!=='object')throw Object.assign(Error('Pick a look first'),{status:400});
 const F=require('./react-design').FONTS,c=v.colors||{},colors={};
 for(const k of ['bg','surface','ink','muted','accent','accentInk']){const h=String(c[k]||'').toLowerCase();if(!HEX.test(h))throw Object.assign(Error('The look needs a valid '+k+' colour (#rrggbb)'),{status:400});colors[k]=h}
 const font=n=>Object.keys(F).find(f=>f.toLowerCase()===String(n||'').trim().toLowerCase()&&F[f][0]!=='mono')||'Inter';
 return{id:/^[a-z0-9-]{1,80}$/.test(String(v.id||''))?String(v.id):'custom',name:String(v.name||'Your look').replace(/[\u0000-\u001f]+/g,' ').trim().slice(0,60)||'Your look',
  feel:FEELS.some(f=>f[0]===v.feel)?v.feel:'',colors,head:font(v.head),body:font(v.body),
  corners:CORNERS[v.corners]?v.corners:'soft',spacing:v.spacing==='compact'?'compact':'comfortable',
  ...(v.source&&typeof v.source==='object'&&/^https?:\/\//.test(String(v.source.url||''))?{source:{url:String(v.source.url).slice(0,300),own:Boolean(v.source.own)}}:{})};
}

// A picked look as the project's design brief (react-design designNote reads these fields).
function toDesign(look,{request='',projectName=''}={}){
 const l=normalizeLook(look),c=l.colors,feel=(FEELS.find(f=>f[0]===l.feel)||[])[1];
 const details=[
  'The owner chose these colours; use them exactly: page background '+c.bg+', cards and input fields '+c.surface+', text '+c.ink+', secondary text '+c.muted+', buttons, links and highlights '+c.accent+', text on buttons '+c.accentInk+'.',
  'Headings in '+l.head+', body text in '+l.body+'.',
  {sharp:'Nearly square corners on cards, buttons and inputs.',soft:'Softly rounded corners on cards, buttons and inputs.',round:'Generously rounded corners; buttons may be pill-shaped.'}[l.corners],
  l.spacing==='compact'?'Compact spacing: tighter padding and gaps, more on each screen.':'Comfortable spacing: generous padding and room between sections.'
 ];
 let notes='';
 if(l.source&&l.source.own)notes='This is the owner\'s own brand (from '+l.source.url+'). Match these colours and fonts exactly.';
 else if(l.source)notes='The look is inspired by '+l.source.url+'. Use only the colour mood, font style and layout feel; never use that company\'s name, logo, trademarks, text or photos.';
 const design={name:l.name,summary:(feel?feel+' look':'Look')+' picked by the owner'+(l.source?(l.source.own?' from their own website':' from a website they like'):'')+'.',
  palette:{background:c.bg,foreground:c.ink,primary:c.accent,secondary:c.surface,accent:c.accent,muted:c.surface,card:c.surface},
  fonts:{display:l.head,body:l.body},radius:CORNERS[l.corners],layout:'',imagery:'',details,notes,skill:'',look_id:l.id,chosen:true,created_at:new Date().toISOString()};
 // A layout direction from the library keeps pages varied (the look only sets colours and fonts).
 try{const d=require('./design-directions').deal(projectName+' '+request,{seed:projectName});if(d.options.length){design.direction=d.options[0].id;design.sector=d.sector}}catch{}
 return design;
}

// ---------- a look from a website ----------
const SERIF=/serif|garamond|times|georgia|playfair|caslon|baskerville|bodoni|didot|tiempos|freight|canela|lora|merriweather|fraunces|literata|newsreader|recoleta|cormorant|libre caslon|domaine|ogg/i;
const DISPLAY=/condensed|compressed|impact|bebas|anton|oswald|league gothic|druk/i;
function closestFont(names){
 const F=require('./react-design').FONTS,list=(names||[]).map(n=>String(n||'').trim()).filter(Boolean);
 for(const n of list){const hit=Object.keys(F).find(f=>f.toLowerCase()===n.toLowerCase()&&F[f][0]!=='mono');if(hit)return{font:hit,exact:true,site:n}}
 const n=list[0]||'';
 if(/sans/i.test(n))return{font:'Hanken Grotesk',exact:false,site:n};
 if(SERIF.test(n))return{font:'Literata',exact:false,site:n};
 if(DISPLAY.test(n))return{font:'Anton',exact:false,site:n};
 return{font:'Hanken Grotesk',exact:false,site:n};
}
function px(v){const m=/([\d.]+)px/.exec(String(v||''));return m?Number(m[1]):null}
// Turns the reference reader's design tokens (react-reference designTokens) into a look and a
// plain-words summary of what was understood.
function fromTokens(t,{url='',own=false,page={}}={}){
 if(!t)throw Object.assign(Error('Kairoq could not read colours from that website'),{status:422});
 const ok=h=>HEX.test(String(h||''));
 const bg=ok(t.background)?t.background:'#ffffff',dark=lum(bg)<0.2;
 const texts=(t.text||[]).filter(ok);
 // Text: the strongest of the most-used text colours; soft text: the next readable one.
 const ink=texts.slice(0,3).filter(h=>contrast(h,bg)>=4.5).sort((x,y)=>contrast(y,bg)-contrast(x,bg))[0]||texts.find(h=>contrast(h,bg)>=4.5)||(dark?'#f5f5f5':'#1d1d1f');
 const muted=texts.find(h=>h!==ink&&contrast(h,bg)>=3)||mix(ink,bg,0.4);
 const surface=(t.surfaces||[]).filter(ok).find(h=>contrast(h,bg)<1.6&&h!==bg)||mix(bg,dark?'#ffffff':'#000000',0.05);
 // Accent: the site's button colour when it has one; otherwise its most colourful visible colour
 // (not near-black or near-white, which read as text rather than a brand colour).
 const usable=h=>ok(h)&&h!==bg&&h!==ink&&contrast(h,bg)>=1.8;
 const vivid=h=>lum(h)>0.02&&lum(h)<0.85;
 const accent=(t.buttons||[]).find(usable)||[...(t.surfaces||[]),...texts].filter(h=>usable(h)&&vivid(h)).sort((a,b)=>saturation(b)-saturation(a))[0]||ink;
 const accentInk=contrast('#ffffff',accent)>=contrast('#111111',accent)?'#ffffff':'#111111';
 const head=closestFont((t.fonts||[]).slice(1).concat(t.fonts||[])),body=closestFont(t.fonts||[]);
 const r=px((t.radii||[])[0]),corners=r==null||r<=4?'sharp':r<=14?'soft':'round';
 const host=(()=>{try{return new URL(url).hostname.replace(/^www\./,'')}catch{return'that website'}})();
 const serif=SERIF.test(head.site||'')||head.font==='Literata';
 const feel=dark&&serif?'premium':dark?'bold':saturation(accent)>0.75&&lum(accent)>0.25?'playful':serif?'calm':'minimal';
 const look={id:'site-'+slug(host).slice(0,60),name:own?'My brand':'Like '+host,feel,colors:{bg,surface,ink,muted,accent,accentInk},head:head.font,headW:600,body:body.font,corners,spacing:'comfortable',source:{url,own}};
 const counts=page.counts||{},motion=page.motion||{};
 const layout=[counts.images>6?'lots of photos':counts.images?'a few photos':'mostly text',motion.sticky?'a menu or button that stays on screen':'',(page.headings||[]).length>8?'many sections':'a few clear sections'].filter(Boolean).join(', ');
 const fontWords=f=>f.exact?f.font:(f.site?f.site+' (closest free match: '+f.font+')':f.font);
 return{look,understood:{
  colors:[{hex:bg,label:'Page'},{hex:ink,label:'Text'},{hex:surface,label:'Cards'},{hex:accent,label:'Buttons and links'}],
  fonts:head.font===body.font?fontWords(body):'Headings '+fontWords(head)+', text '+fontWords(body),
  shape:{sharp:'Square corners',soft:'Soft corners',round:'Round corners'}[corners]+(r!=null?' (about '+Math.round(r)+' px)':''),
  layout:layout.charAt(0).toUpperCase()+layout.slice(1),
  feel:(FEELS.find(f=>f[0]===feel)||[])[1]}};
}
async function fromSite(url,{own=false,crawl}={}){
 const ref=require('./react-reference');
 const site=await(crawl||ref.crawlSite)(url,{maxPages:1,lite:true});
 const page=(site.pages||[]).find(p=>!p.error)||{};
 return fromTokens(site.design,{url:site.url||url,own,page});
}

// ---------- the owner's saved brand ----------
function db(){
 const d=require('./builder-accounts').database();
 if(!d.__looks){d.exec('CREATE TABLE IF NOT EXISTS owner_brand(owner TEXT PRIMARY KEY,look TEXT NOT NULL,updated_at TEXT NOT NULL)');d.__looks=true}
 return d;
}
function brand(owner){try{const r=db().prepare('SELECT look FROM owner_brand WHERE owner=?').get(String(owner));return r?JSON.parse(r.look):null}catch{return null}}
function saveBrand(owner,look){
 if(look===null){db().prepare('DELETE FROM owner_brand WHERE owner=?').run(String(owner));return null}
 const l={...normalizeLook(look),id:'my-brand',name:String(look.name||'My brand').slice(0,60)||'My brand'};
 db().prepare('INSERT INTO owner_brand(owner,look,updated_at) VALUES(?,?,?) ON CONFLICT(owner) DO UPDATE SET look=excluded.look,updated_at=excluded.updated_at').run(String(owner),JSON.stringify(l),new Date().toISOString());
 return l;
}

module.exports={FEELS,TYPE,CORNERS,catalog,fonts,normalizeLook,toDesign,fromTokens,fromSite,closestFont,contrast,brand,saveBrand};

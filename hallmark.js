"use strict";
// Hallmark (Nutlope/hallmark, MIT, by Together AI): a design skill for coding agents. Kairoq takes
// three things from it, all in design-library/hallmark/:
//  - the 50 themes (themes/*.md): each a material (paper, ink, faces, surfaces, controls, motion,
//    voice, do-nots) with real OKLCH tokens. They become Looks the owner can pick before the first
//    build (looks.js catalog), and the theme's own words go into the project's design brief.
//  - the floor: the rules every page keeps (FLOOR below, added to react-design RULES).
//  - the photo library (photos.json): 755 openly licensed photographs on Wikimedia Commons, so a
//    new app can show a real picture with its credit instead of a placeholder or an invented one.

const fs=require('fs'),path=require('path');
const DIR=path.join(__dirname,'design-library','hallmark');

// The parts of Hallmark's Floor that Kairoq's own rules did not already say.
const FLOOR=`- Hallmark floor (always): never transition: all, never animate width, height, top or left; overflow-x: clip on html and body (never hidden, never 100vw); image grids use minmax(0,1fr) tracks and big headings get overflow-wrap: break-word and min-width: 0; the hero's headline, one sentence and primary action all fit at 1280×800 without scrolling; about 80 words on any one screen; the page container is capped and centred (at 1920 the gutters grow, not the text or the grids); content shows with scripting off and every animation has a prefers-reduced-motion fallback.`;

// ---------- OKLCH → hex ----------
function oklchToHex(L,C,h){
 const a=C*Math.cos(h*Math.PI/180),b=C*Math.sin(h*Math.PI/180);
 const l_=L+0.3963377774*a+0.2158037573*b,m_=L-0.1055613458*a-0.0638541728*b,s_=L-0.0894841775*a-1.2914855480*b;
 const l=l_**3,m=m_**3,s=s_**3;
 let r=4.0767416621*l-3.3077115913*m+0.2309699292*s,g=-1.2684380046*l+2.6097574011*m-0.3413193965*s,bb=-0.0041960863*l-0.7034186147*m+1.7076147010*s;
 const gam=v=>{v=Math.max(0,Math.min(1,v));return v<=0.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-0.055};
 return'#'+[r,g,bb].map(v=>Math.round(gam(v)*255).toString(16).padStart(2,'0')).join('');
}
function parseColor(v){
 const m=/oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)/i.exec(String(v||''));
 if(m){const L=m[2]||Number(m[1])>1?Number(m[1])/100:Number(m[1]);return oklchToHex(L,Number(m[3]),Number(m[4]))}
 const h=/#[0-9a-f]{6}\b/i.exec(String(v||''));return h?h[0].toLowerCase():null;
}

// ---------- theme files ----------
const CLASS_FONT={'grotesk-sans':'Hanken Grotesk','grotesk-heavy':'Archivo','geometric-sans':'Outfit','rounded-sans':'Nunito','roman-serif':'Literata','high-contrast-serif':'Bodoni Moda','slab-serif':'Zilla Slab','display-condensed':'Barlow Condensed','display-heavy':'Anton','mono':'Space Grotesk','pixel':'Press Start 2P','handwritten':'Caveat','blackletter':'Playfair Display SC'};
function kairoqFont(name,cls,fallback){
 const F=require('./react-design').FONTS,n=String(name||'').replace(/["']/g,'').split(',')[0].trim();
 const hit=Object.keys(F).find(f=>f.toLowerCase()===n.toLowerCase()&&F[f][0]!=='mono');
 if(hit)return{font:hit,exact:true};
 return{font:CLASS_FONT[cls]||fallback||'Hanken Grotesk',exact:false,wanted:n};
}
function section(body,title){const m=new RegExp('\\n## '+title+'\\n([\\s\\S]*?)(?=\\n## |$)').exec(body);return m?m[1].trim():''}
function parseTheme(text,file){
 const fm=/^---\n([\s\S]*?)\n---/.exec(text);if(!fm)return null;
 const head={};for(const line of fm[1].split('\n')){const i=line.indexOf(':');if(i>0)head[line.slice(0,i).trim()]=line.slice(i+1).trim()}
 const body=text.slice(fm[0].length);
 const tokens={};const block=/```css\n([\s\S]*?)```/.exec(section(body,'Tokens')||body);
 if(block)for(const m of block[1].matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g))tokens[m[1]]=m[2].trim();
 const [cls,...faceWords]=String(head.display||'').split(/\s+/);
 const display=kairoqFont(tokens['font-display']||faceWords.join(' '),cls);
 const bodyFont=kairoqFont(tokens['font-body'],null,display.font);
 const radius=parseFloat(tokens['radius-card']||'0')||0;
 const paper=parseColor(tokens['color-paper']),ink=parseColor(tokens['color-ink']);
 if(!paper||!ink)return null;
 const colors={bg:paper,surface:parseColor(tokens['color-paper-2'])||paper,ink,muted:parseColor(tokens['color-muted'])||ink,accent:parseColor(tokens['color-accent'])||ink,accentInk:parseColor(tokens['color-accent-ink'])||paper};
 const weight=parseInt(tokens['display-weight'],10)||600;
 const brief=['Type','Surfaces','Controls','Motion','Voice','Do-nots'].map(t=>{const s=section(body,t);return s?t+':\n'+s:''}).filter(Boolean).join('\n');
 return{slug:head.slug||path.basename(file,'.md'),name:head.name||head.slug,genre:head.genre||'',posture:head.posture||'',paperBand:String(head.paper||'').split(/\s+/)[0]||'',
  keywords:String(head.keywords||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean),material:head.material||'',photo:head.photo||'natural',
  colors,head:display.font,headW:weight,body:bodyFont.font,fontsExact:display.exact&&bodyFont.exact,wanted:[display.wanted,bodyFont.wanted].filter(w=>w&&!w.startsWith('var(')),
  corners:radius<=4?'sharp':radius<=14?'soft':'round',intro:body.replace(/^#[^\n]*\n/,'').split('\n## ')[0].trim().slice(0,600),brief:brief.slice(0,2600)};
}
let themeCache=null;
function themes(){
 if(themeCache)return themeCache;
 const dir=path.join(DIR,'themes');let files=[];try{files=fs.readdirSync(dir).filter(f=>f.endsWith('.md')).sort()}catch{}
 return themeCache=files.map(f=>{try{return parseTheme(fs.readFileSync(path.join(dir,f),'utf8'),f)}catch{return null}}).filter(Boolean);
}
function theme(slug){return themes().find(t=>t.slug===slug)||null}

// A theme as a Look (looks.js catalog shape). The feel comes from the material: dark paper and a
// serif read as premium, a drenched or full-palette posture as bold or playful, the rest calm or
// minimal.
function feelOf(t){
 const serif=/serif/.test(t.head)||['Literata','Bodoni Moda','Newsreader','Fraunces','EB Garamond','Playfair Display','Zilla Slab'].includes(t.head);
 if(t.genre==='playful'||t.posture==='drenched')return'playful';
 if(t.paperBand==='dark')return serif?'premium':'bold';
 if(t.posture==='full-palette')return'bold';
 if(t.genre==='atmospheric')return'premium';
 if(t.genre==='modern-minimal')return'minimal';
 return'calm';
}
function looks(){
 return themes().map(t=>({id:'hallmark-'+t.slug,name:t.name,feel:feelOf(t),group:t.paperBand==='dark'?'dark':t.paperBand==='mid'?'earthy':'light',
  colors:t.colors,head:t.head,headW:t.headW,body:t.body,kind:/Anton|Barlow Condensed|Archivo|Unbounded/.test(t.head)?'bold':/Literata|Bodoni|Newsreader|Fraunces|Garamond|Playfair|Zilla/.test(t.head)?'serif':'clean',
  corners:t.corners,spacing:'comfortable',hallmark:t.slug,material:t.material}));
}
// The theme's own words for the design brief of a project that picked it.
function briefFor(lookId){
 const t=theme(String(lookId||'').replace(/^hallmark-/,''));if(!t)return[];
 const out=['Hallmark theme "'+t.name+'": '+t.material+'. '+t.intro];
 if(t.wanted.length)out.push('The theme is set in '+t.wanted.join(' and ')+'; Kairoq\'s closest free faces are '+t.head+(t.body!==t.head?' and '+t.body:'')+', already in the tokens.');
 if(t.photo&&t.photo!=='natural')out.push('Photographs take the theme\'s treatment: '+t.photo+' (a CSS filter on every photo).');
 out.push(t.brief);
 return out;
}
// The themes whose keywords match a request, best first (for the three looks shown first).
function match(request,n=3){
 const words=new Set(String(request||'').toLowerCase().match(/[a-z][a-z0-9-]+/g)||[]);
 return themes().map(t=>({t,score:t.keywords.filter(k=>k.split(/\s+/).every(w=>words.has(w))).length})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,n).map(x=>'hallmark-'+x.t.slug);
}

// ---------- photos ----------
let photoCache=null;
function photos(){
 if(photoCache)return photoCache;
 try{const d=JSON.parse(fs.readFileSync(path.join(DIR,'photos.json'),'utf8'));photoCache=Array.isArray(d.photos)?d.photos:[]}catch{photoCache=[]}
 return photoCache;
}
// Photos for a request: tag and subject words in common, the best quality first.
function findPhotos(request,{n=6,tone=null}={}){
 const words=new Set(String(request||'').toLowerCase().match(/[a-z][a-z0-9-]{2,}/g)||[]);
 if(!words.size)return[];
 return photos().map(p=>{
  const tags=(p.tags||[]).map(String),subject=String(p.subject||'').toLowerCase();
  let s=0;for(const t of tags)if(words.has(t.toLowerCase()))s+=3;for(const w of words)if(subject.includes(w))s+=1;
  if(tone&&p.tone===tone)s+=0.5;
  return{p,s:s*(1+(Number(p.q)||0)/10)};
 }).filter(x=>x.s>=3).sort((a,b)=>b.s-a.s).slice(0,n).map(x=>x.p);
}
function credit(p){return String(p.author||'Wikimedia Commons')+' ('+String(p.license||'')+')'}
// The prompt note: real photos the builder may use, with the credit line each needs.
function photoNote(request,opts){
 const list=findPhotos(request,opts);if(!list.length)return'';
 return'\n\nREAL PHOTOS you may use (openly licensed, from Wikimedia Commons; use the file URL as the src and put the credit in the image caption or a small line in the footer, exactly as given):\n'+list.map(p=>'- '+p.file+' — '+p.subject+' ('+p.w+'×'+p.h+(p.tone?', '+p.tone:'')+'). Credit: '+credit(p)).join('\n')+'\nUse one or two of them where a photo helps; never a stock-style placeholder frame.';
}

module.exports={FLOOR,themes,theme,looks,briefFor,match,photos,findPhotos,photoNote,parseTheme,oklchToHex,parseColor};

"use strict";
// The "made by AI" giveaways, measured on the real page in the browser rather than judged by a
// model: tiny capital labels above headings, "·" strings, an arrow on every button, one coloured
// word in the headline, identical card grids, round corners and soft shadows on everything, more
// than two fonts, gradient text, glowing blobs, emoji icons, filler words and numbers the owner
// never gave. Each giveaway comes with the exact fix. design-slop.js describes the same look in
// words for the reviewers; this file proves it on the page (used by runtime-check.js designShots
// and the craft check in craft-check.js).

// Words that make copy sound generated rather than written about this business.
const FILLER=['seamless','seamlessly','elevate','elevated','unlock','unleash','empower','empowering','revolutionize','revolutionise','revolutionary','cutting-edge','cutting edge','world-class','state-of-the-art','next-generation','next-level','game-changer','game-changing','supercharge','effortless','effortlessly','streamline your','harness the power','in today\'s fast-paced','unparalleled','delve','tailored solutions','your journey','look no further','take it to the next level','transform your','robust solution','innovative solutions','one-stop shop','best-in-class','synergy'];

async function tells(page,screen='desktop'){
 return page.evaluate(({FILLER,screen})=>{
  const out=[],add=(severity,kind,issue,fix)=>{if(!out.some(o=>o.kind===kind))out.push({severity,kind,issue,fix,screen})};
  const visible=el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&parseFloat(s.opacity)>0.05&&r.width>1&&r.height>1&&!el.closest('[aria-hidden="true"]')};
  const own=el=>[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').replace(/\s+/g,' ').trim();
  const text=el=>(el.innerText||'').replace(/\s+/g,' ').trim();
  const short=s=>s.length>48?s.slice(0,45)+'…':s;
  const nodes=[...document.querySelectorAll('body *')].slice(0,4000).filter(el=>!['SCRIPT','STYLE','NOSCRIPT','SVG','PATH'].includes(el.tagName.toUpperCase()));
  const shown=nodes.filter(visible);
  const heads=shown.filter(el=>/^H[1-3]$/.test(el.tagName));

  // 1. Tiny capital "eyebrow" labels above headings.
  // Colour saturation of an rgb() value: an accent colour, not a grey.
  const sat=c=>{const m=/rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c||'');if(!m)return 0;const v=[m[1],m[2],m[3]].map(Number),mx=Math.max(...v),mn=Math.min(...v);return mx?(mx-mn)/mx:0};
  const eyebrows=[];
  for(const h of heads){
   let prev=h.previousElementSibling;
   if(!prev&&h.parentElement)prev=h.parentElement.previousElementSibling;
   for(let i=0;i<2&&prev;i++){
    const s=getComputedStyle(prev),t=text(prev);
    // Tiny capitals or letter-spacing, or a short line in the accent colour (the sentence-case variant).
    if(visible(prev)&&t&&t.length<=48&&!/^0?\d+\.?$/.test(t)&&parseFloat(s.fontSize)<=15&&(s.textTransform==='uppercase'||(t===t.toUpperCase()&&/[A-Z]{3}/.test(t))||parseFloat(s.letterSpacing)>=1.2||(s.color!==getComputedStyle(h).color&&sat(s.color)>0.35))){eyebrows.push(t);break}
    prev=prev.previousElementSibling;
   }
  }
  if(eyebrows.length>=2)add('major','eyebrow','Small capital labels above '+eyebrows.length+' headings ("'+short(eyebrows[0])+'", "'+short(eyebrows[1])+'")','Remove the little labels above headings; let each heading stand on its own, or fold the useful words into the heading or the sentence below it.');

  // 2. Meta strings joined with "·" (or "•", "|").
  const dots=shown.filter(el=>/\s[·•]\s/.test(own(el))).map(own);
  if(dots.length>=2)add('major','dots','Words joined with "·" in '+dots.length+' places ("'+short(dots[0])+'")','Write these as a short sentence, or as separate lines; drop the dot separators.');

  // 3. An arrow on every button or link.
  const actions=shown.filter(el=>el.matches('a,button,[role="button"]')&&text(el).length>1&&text(el).length<40);
  // Arrows as text or as icons (lucide arrow-right, arrow-up-right…); chevrons that open things are fine.
  const arrows=actions.filter(el=>/[→↗↘»]|->/.test(text(el))||[...el.querySelectorAll('svg')].some(v=>/arrow-(right|up-right|down-right)|move-right/i.test(v.getAttribute('class')||'')));
  if(arrows.length>=3)add('major','arrows',arrows.length+' buttons and links end in an arrow','Keep an arrow only where it means "go somewhere" (at most one); the button text says what happens.');

  // 4. One word of a headline picked out in another colour, italic or font.
  for(const h of heads.slice(0,8)){
   const hs=getComputedStyle(h),all=text(h);if(all.length<8)continue;
   for(const sp of h.querySelectorAll('span,em,i,strong,mark')){
    const ss=getComputedStyle(sp),t=text(sp);
    if(!t||t.length>all.length*0.45)continue;
    if(ss.color!==hs.color||ss.fontStyle!==hs.fontStyle||ss.fontFamily.split(',')[0]!==hs.fontFamily.split(',')[0]||ss.backgroundImage!=='none'){add('major','accent-word','The heading "'+short(all)+'" picks out "'+short(t)+'" in another colour or style','Set the whole heading in one colour and style; make it strong through size, weight and the words themselves.');break}
   }
  }

  // 5. Gradient text and glowing blobs.
  if(shown.some(el=>/text/.test(getComputedStyle(el).backgroundClip||getComputedStyle(el).webkitBackgroundClip||'')&&getComputedStyle(el).backgroundImage.includes('gradient')))add('major','gradient-text','Text filled with a gradient','Use one solid colour for text.');
  const blobs=shown.filter(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect(),f=s.filter||'';const blur=/blur\((\d+)/.exec(f);return(blur&&Number(blur[1])>=30&&r.width>120)||(s.position==='absolute'&&/radial-gradient/.test(s.backgroundImage)&&r.width>200&&!text(el))});
  if(blobs.length)add('major','blobs',blobs.length+' blurred glow shapes behind the content','Remove the glowing blobs; use a real image, a texture or a plain background.');

  // 6. Emoji used as icons.
  const emojiIcon=shown.filter(el=>{const t=own(el);return t&&t.length<=3&&/\p{Extended_Pictographic}/u.test(t)});
  if(emojiIcon.length>=2)add('major','emoji',emojiIcon.length+' emoji used as icons','Replace emoji with icons from the UI kit (lucide-react), drawn in one stroke weight, or drop the icons.');

  // 7. Boxes: identical card grids, round corners and shadows on everything.
  const boxy=el=>{const s=getComputedStyle(el);return s.borderTopWidth!=='0px'&&s.borderTopStyle!=='none'||s.boxShadow!=='none'||(s.backgroundColor!=='rgba(0, 0, 0, 0)'&&s.backgroundColor!==getComputedStyle(el.parentElement||document.body).backgroundColor)};
  const grids=[];
  for(const p of shown){
   const kids=[...p.children].filter(visible);
   if(kids.length<3||kids.length>8)continue;
   const rs=kids.map(k=>k.getBoundingClientRect());
   const same=rs.every(r=>Math.abs(r.width-rs[0].width)<6&&Math.abs(r.height-rs[0].height)<10)&&rs[0].width>140&&rs[0].width<innerWidth*0.45;
   if(same&&kids.every(boxy)&&kids.every(k=>k.querySelector('h2,h3,h4,h5,strong,p')))grids.push({p,n:kids.length,icons:kids.every(k=>k.querySelector('svg,img'))});
  }
  const outer=grids.filter(g=>!grids.some(o=>o!==g&&o.p.contains(g.p)));
  if(outer.length>=2)add('major','card-grids',outer.length+' rows of identical boxes (cards of the same size, each with a title and text)','Keep at most one card grid on the page. Turn the others into a different form: a list with thin dividers, a two-column text block, a table, a large image with captions, or one big feature with smaller ones of varied size.');
  else if(outer.length===1&&outer[0].icons&&outer[0].n>=3&&outer[0].n<=4)add('minor','icon-cards','A row of '+outer[0].n+' identical boxes, each an icon, a title and two lines','Give it a less template-like form: vary the sizes (one large, two small), or a list with dividers and no boxes.');
  const surfaces=shown.filter(el=>{const r=el.getBoundingClientRect();return r.width*r.height>9000&&r.width<innerWidth*0.95&&boxy(el)});
  if(surfaces.length>=5){
   const round=surfaces.filter(el=>parseFloat(getComputedStyle(el).borderTopLeftRadius)>=16).length;
   if(round>=surfaces.length*0.6)add('major','round',round+' of '+surfaces.length+' boxes have very round corners (16px or more)','Use small corners that follow hierarchy: buttons and inputs about 6 to 8px, cards 8 to 12px at most, photos square or slightly rounded. Not everything should be a rounded box.');
   const shadowed=surfaces.filter(el=>getComputedStyle(el).boxShadow!=='none').length;
   if(shadowed>=6)add('major','shadows',shadowed+' boxes have a soft shadow under them','Drop the shadows; separate areas with space, a thin border or a background tone. Keep a shadow only on things that float (menus, dialogs).');
   const boxed=surfaces.length;const sections=shown.filter(el=>el.tagName==='SECTION').length||1;
   if(boxed>=sections*4&&boxed>=14)add('minor','boxed',boxed+' boxes on the page','Use fewer boxes: let text and images sit directly on the page, in columns, with space between them.');
  }

  // 8. Fonts: at most two families (code fonts aside).
  const fams=new Map();
  for(const el of shown.slice(0,1500)){const t=own(el);if(t.length<2)continue;const f=getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g,'').trim();if(/mono|code|courier/i.test(f))continue;fams.set(f,(fams.get(f)||0)+t.length)}
  const used=[...fams.entries()].filter(([,n])=>n>=12).sort((a,b)=>b[1]-a[1]);
  if(used.length>2)add('major','fonts',used.length+' different fonts ('+used.map(([f])=>f).join(', ')+')','Use two fonts at most: one for headings, one for text, from the design tokens.');

  // 9. A pill badge above the hero headline.
  const h1=heads.find(h=>h.tagName==='H1');
  if(h1){const before=[...shown].filter(el=>el.getBoundingClientRect().bottom<=h1.getBoundingClientRect().top+2&&el.getBoundingClientRect().top>h1.getBoundingClientRect().top-140);
   if(before.some(el=>{const s=getComputedStyle(el),t=text(el);return t&&t.length<=40&&parseFloat(s.borderTopLeftRadius)>=12&&el.getBoundingClientRect().height<=40&&(s.backgroundColor!=='rgba(0, 0, 0, 0)'||s.borderTopStyle!=='none')}))add('major','pill','A small rounded badge above the main headline','Remove the badge above the headline.');}

  // 10. Filler words.
  const body=(document.body.innerText||'').toLowerCase();
  const found=FILLER.filter(w=>new RegExp('(^|[^a-z])'+w.replace(/[-']/g,m=>'\\'+m)+'([^a-z]|$)').test(body));
  if(found.length)add(found.length>=2?'major':'minor','filler','Filler words: '+found.slice(0,6).map(w=>'"'+w+'"').join(', '),'Rewrite those lines with what this business actually does, in plain words: who it is for, what they get, a concrete detail.');

  // 11. Numbers shown big (stats); the craft check keeps only those the owner never gave.
  const stats=shown.filter(el=>{const t=own(el);return /^[\d.,]+\s?(k|m|\+|%|x)?\+?$/i.test(t)&&parseFloat(getComputedStyle(el).fontSize)>=24}).map(own).slice(0,10);

  // 12. Too many sections, and numbered markers on things that are not steps.
  const secs=shown.filter(el=>el.tagName==='SECTION'&&el.getBoundingClientRect().height>120).length;
  if(secs>9)add('minor','sections',secs+' sections on one page','Cut to the 5 to 7 sections that matter; merge or drop the rest.');
  const numbered=shown.filter(el=>/^0\d$/.test(own(el)));
  if(numbered.length>=3)add('minor','numbers','Numbered markers (01, 02, 03…) on '+numbered.length+' items','Keep numbers only for real steps in order; otherwise remove them.');

  // Plain measurements, compared with what the best sites of the kind do (craft-norms.js).
  const h1el=heads.find(h=>h.tagName==='H1'),med=a=>a.length?a.slice().sort((x,y)=>x-y)[a.length>>1]:null;
  const boxesAll=shown.filter(el=>{const r=el.getBoundingClientRect();return r.width*r.height>9000&&r.width<innerWidth*0.95&&boxy(el)});
  const metrics={h1px:h1el?parseFloat(getComputedStyle(h1el).fontSize):null,h1words:h1el?text(h1el).split(/\s+/).filter(Boolean).length:null,radius:med(boxesAll.map(el=>parseFloat(getComputedStyle(el).borderTopLeftRadius))),shadows:boxesAll.filter(el=>getComputedStyle(el).boxShadow!=='none').length,sections:shown.filter(el=>el.tagName==='SECTION'&&el.getBoundingClientRect().height>200).length};
  return{issues:out,stats,metrics};
 },{FILLER,screen});
}

// Big numbers the owner never gave (not in their messages or project knowledge).
function madeUpStats(stats,facts){
 const given=String(facts||'').toLowerCase().replace(/,/g,'');
 return[...new Set(stats||[])].filter(s=>{const n=s.toLowerCase().replace(/[,\s+]/g,'').replace(/[kmx%]$/,'');return n&&!given.includes(n)});
}

module.exports={tells,madeUpStats,FILLER};

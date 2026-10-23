"use strict";
// Art directions for a new app's design brief, from the library in design-library/ (adapted from
// taste-skill by Leonxlnx, MIT; see design-library/LICENSE-taste-skill). Asked to invent a look, a
// model returns the category default every time, so Kairoq deals the choices instead:
//  - a page (a site people read and scroll) gets three of twenty researched directions that suit
//    the kind of business; the brief writer picks the one that carries the business's own idea;
//  - an app screen (a dashboard, admin, list, settings) gets three of the app styles distilled
//    from real product screens.
// The chosen direction then deals its hero and section blueprints, a palette, a type system and a
// motion, and these go into every build's instructions (blueprint()).
const L={
 directions:require('./design-library/directions.json'),heroes:require('./design-library/heroes.json'),sections:require('./design-library/sections.json'),
 motions:require('./design-library/motions.json'),palettes:require('./design-library/palettes.json'),type:require('./design-library/type.json'),app:require('./design-library/app.json')
};
const {FONTS}=require('./react-design');
// Only type systems whose faces Kairoq can load (Google Fonts, in the FONTS list).
const TYPES=L.type.filter(t=>FONTS[t.display.family]&&FONTS[t.text.family]);

// Words people use, mapped to the library's sectors.
const SECTOR_WORDS={
 restaurant:'restaurant cafe coffee bakery bistro pizzeria pizza bar pub brewery winery wine food menu catering kitchen takeaway dinner brunch patisserie deli',
 hospitality:'hotel hostel villa retreat apartment apartments bnb guesthouse stay stays lodge resort cabin camping housing rental rentals tours travel spa',
 health:'clinic dentist dental doctor physio therapist therapy health wellness yoga pilates gym fitness trainer massage salon barber beauty nails vet veterinary care nurse',
 education:'school course courses tutor tutoring lessons academy class classes training workshop learning nursery daycare',
 event:'event events wedding weddings party festival conference meetup tickets concert gig',
 'real-estate':'realtor property properties estate homes letting lettings mortgage',
 architecture:'architect architecture interior interiors builder construction renovation joinery',
 ecommerce:'shop store boutique ecommerce products sell selling jewellery jewelry clothing gifts',
 'physical-product':'product bottle furniture ceramics candles skincare cosmetics bike gadget device',
 fashion:'fashion clothing apparel label brand boutique',
 agency:'agency marketing studio consultancy consultant consulting freelance services',
 'personal-portfolio':'portfolio photographer photography resume artist designer illustrator writer',
 nonprofit:'charity nonprofit foundation volunteer community church cause donate',
 culture:'museum gallery theatre theater exhibition library heritage arts',
 music:'music band musician dj album record label',
 finance:'finance accountant accounting bookkeeping invoice invoices insurance bank budgeting',
 saas:'saas software platform startup tool subscription',
 'ai-product':'assistant chatbot',
 'consumer-app':'app mobile habit tracker'
};
const APP_WORDS=/\b(dashboard|admin|backoffice|back office|crm|inventory|stock|orders?|bookings? (list|manager)|internal|portal|tracker|tracking|analytics|reports?|staff|rota|ledger|pipeline|kanban|inbox|tickets?|helpdesk|manager|management|console)\b/i;
const APP_KINDS={commerce:/\b(orders?|shop|store|inventory|stock|products?|payouts?)\b/i,finance:/\b(finance|invoice|accounting|budget|expenses?|ledger|payroll)\b/i,
 support:/\b(support|tickets?|helpdesk|inbox|enquir(y|ies)|complaints?)\b/i,analytics:/\b(analytics|reports?|metrics|kpis?|insights)\b/i,
 'smb-admin':/\b(bookings?|appointments?|staff|rota|schedule|clients?|customers?|members?|crm|admin)\b/i,workspace:/\b(notes|projects?|tasks?|kanban|team)\b/i,
 community:/\b(community|members?|forum|club)\b/i,report:/\b(report|summary)\b/i};
const SECTIONS={
 restaurant:['intro','list','gallery','contact','footer'],hospitality:['intro','gallery','features','list','contact','footer'],
 health:['intro','features','how-it-works','testimonial','faq','cta','footer'],education:['intro','features','how-it-works','pricing','faq','cta','footer'],
 event:['intro','list','features','pricing','faq','cta','footer'],'real-estate':['intro','gallery','features','stats','contact','footer'],
 architecture:['work','intro','about','contact','footer'],ecommerce:['gallery','features','intro','testimonial','cta','footer'],
 'physical-product':['showcase','features','gallery','intro','cta','footer'],fashion:['gallery','intro','work','cta','footer'],
 agency:['intro','work','features','about','cta','footer'],'personal-portfolio':['work','about','cta','footer'],nonprofit:['intro','stats','features','about','cta','footer'],
 culture:['intro','gallery','list','about','cta','footer'],music:['list','gallery','about','cta','footer'],finance:['showcase','features','stats','faq','cta','footer'],
 saas:['showcase','features','how-it-works','pricing','faq','cta','footer'],'ai-product':['showcase','features','how-it-works','cta','footer'],
 'consumer-app':['showcase','features','testimonial','cta','footer'],other:['intro','features','showcase','cta','footer']
};
const SOFTWARE=new Set(['saas','dev-tool','ai-product','consumer-app','finance']);

function words(t){return String(t||'').toLowerCase().match(/[a-z]+/g)||[]}
function sectorOf(text){
 const have=new Set(words(text));let best='other',score=0;
 for(const [sector,list] of Object.entries(SECTOR_WORDS)){const n=list.split(' ').filter(w=>have.has(w)||have.has(w+'s')).length;if(n>score){best=sector;score=n}}
 return best;
}
// A screen people work in, unless the request is for a site (a site with an admin area is a site).
function isAppScreen(text){const t=String(text||'');return APP_WORDS.test(t)&&!/\b(website|site|landing|homepage|home page|portfolio|blog|shop front|storefront)\b/i.test(t)}
function appKind(text){const t=String(text||'');let best='smb-admin',n=0;for(const [k,re] of Object.entries(APP_KINDS)){const m=(t.match(new RegExp(re.source,'gi'))||[]).length;if(m>n){best=k;n=m}}return best}

// A small seeded random, so one project always gets the same choices and different projects differ.
function rng(seedText){let h=2166136261;for(const c of String(seedText||'kairoq'))h=Math.imul(h^c.charCodeAt(0),16777619);let s=h>>>0;return()=>{s=(s+0x6d2b79f5)|0;let t=Math.imul(s^(s>>>15),1|s);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296}}
function shuffle(list,rnd){const a=[...list];for(let i=a.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
const first=(t,n=2)=>String(t||'').split(/(?<=\.)\s+/).slice(0,n).join(' ');

// Three options for the brief writer. Returns {kind:'page'|'app', sector, options:[{id,name,idea,...}]}.
function deal(text,{seed='',n=3,avoid=[]}={}){
 const rnd=rng(seed+'|'+text);
 if(isAppScreen(text)){
  const kind=appKind(text),suits=(L.app.kinds[kind]||{}).styles||[];
  const pool=L.app.styles.filter(s=>!avoid.includes(s.id));
  const ordered=[...shuffle(pool.filter(s=>suits.includes(s.id)),rnd),...shuffle(pool.filter(s=>!suits.includes(s.id)),rnd)];
  return{kind:'app',sector:kind,options:ordered.slice(0,n).map(s=>({id:s.id,name:s.name,theme:s.theme,idea:s.idea}))};
 }
 const sector=sectorOf(text),photos=/\b(photo|photos|photographs|pictures|product shots)\b/i.test(text);
 let pool=L.directions.filter(d=>d.sectors.includes(sector)&&!avoid.includes(d.id));
 const feasible=pool.filter(d=>(d.needs||[]).every(x=>x!=='product-photo'||photos));if(feasible.length>=n)pool=feasible;
 if(SOFTWARE.has(sector)){const plain=pool.filter(d=>!d.needsPictures);if(plain.length>=n)pool=plain}
 if(pool.length<n)pool=[...pool,...shuffle(L.directions.filter(d=>!pool.includes(d)&&!avoid.includes(d.id)&&d.sectors.includes('other')),rnd)];
 return{kind:'page',sector,options:shuffle(pool,rnd).slice(0,n).map(d=>({id:d.id,name:d.name,idea:first(d.idea,3),composition:first(d.composition,1)}))};
}
// The block for the brief writer: the dealt options and how to choose.
function note(dealt){
 if(!dealt||!dealt.options.length)return'';
 const lines=['','','DIRECTIONS dealt for this '+(dealt.kind==='app'?'app (screens people work in)':'site')+' from a design library studied on real award-winning '+(dealt.kind==='app'?'product screens':'sites')+'. Choose the ONE that best carries this business\'s own idea and set "direction" to its id; then write "idea": one sentence tying something only this business has (its place, its craft, its product, its people) to that direction. Pick colours and fonts that suit the direction.'];
 for(const o of dealt.options)lines.push('- '+o.id+': '+o.name+(o.theme?' ('+o.theme+')':'')+'. '+o.idea+(o.composition?' First screen: '+o.composition:''));
 return lines.join('\n');
}
function validId(id){return L.directions.some(d=>d.id===id)||L.app.styles.some(s=>s.id===id)}

// ---------- the sheet for the chosen direction ----------
function pickFrom(list,rnd){return list.length?list[Math.floor(rnd()*list.length)]:null}
function sheet(design,{seed=''}={}){
 const id=design&&design.direction;if(!id)return null;
 const rnd=rng(seed+'|'+id);
 const style=L.app.styles.find(s=>s.id===id);
 if(style){
  const kind=design.sector&&L.app.kinds[design.sector]?design.sector:'smb-admin',screens=(L.app.kinds[kind]||{}).screens||['overview','list','settings'];
  const shell=L.app.shells.find(s=>s.id===style.shell)||null;
  const patterns=screens.map(sc=>pickFrom(L.app.patterns.filter(p=>p.screen===sc&&(p.kinds||[]).includes(kind)),rnd)||pickFrom(L.app.patterns.filter(p=>p.screen===sc),rnd)).filter(Boolean);
  return{kind:'app',style,shell,patterns};
 }
 const dir=L.directions.find(d=>d.id===id);if(!dir)return null;
 const sector=design.sector&&SECTIONS[design.sector]?design.sector:'other';
 const hero=pickFrom(L.heroes.filter(h=>(h.directions||[]).includes(dir.id)),rnd)||pickFrom(L.heroes,rnd);
 const sections=[];
 for(const role of SECTIONS[sector]){
  let pool=L.sections.filter(s=>s.role===role);
  const own=pool.filter(s=>(s.directions||[]).includes(dir.id)),tagged=pool.filter(s=>(s.tags||[]).some(t=>(dir.sectionTags||[]).includes(t)));
  pool=own.length?own:tagged.length?tagged:pool;
  const prev=sections.at(-1);const varied=pool.filter(s=>!prev||s.shape!==prev.shape);
  const s=pickFrom(varied.length?varied:pool,rnd);if(s)sections.push(s);
 }
 const types=TYPES.filter(t=>(dir.typeClasses||[]).includes(t.class));
 const palettes=L.palettes.filter(p=>(p.tags||[]).some(t=>(dir.paletteTags||[]).includes(t)));
 const motion=L.motions.find(m=>m.id===(hero&&hero.motion||dir.motion))||L.motions.find(m=>m.id===dir.motion)||null;
 return{kind:'page',direction:dir,hero,sections,type:pickFrom(types,rnd),palette:pickFrom(palettes,rnd),motion};
}
// The app-screen house rules in short (the full version is the "App screens" skill).
const APP_RULES='App screen rules: colour on data, not chrome (a near-black primary is fine); KPIs are a label over a 24-30px number in the text colour, no icon circles, no sparklines; flat surfaces (a border or a tone step, never both); a noun title at about 24px, no greeting banner or emoji; charts with a 2px line, faint gridlines, one hue each; the sidebar on the page background with a neutral active item; tables with 12px grey sentence-case headers, row rules, no zebra, right-aligned tabular numbers; honest zeros, grey dashes for missing values, empty states that keep their frame and offer the action; the main job one click from the first screen; on a phone the navigation folds into a menu or a bottom bar and tables become stacked rows.';
const PAGE_RULE='Blueprints were measured on real sites: keep their proportions and composition, but use this project\'s design tokens, fonts and one corner radius, keep body text 16px or more and readable contrast, and fill every section with this business\'s real content (no invented numbers or quotes).';
const clip=(t,n)=>{t=String(t||'').replace(/\s+/g,' ').trim();return t.length>n?t.slice(0,n-1).replace(/\s+\S*$/,'')+'…':t};
// The text that goes into every build for this project (after the design brief).
function blueprint(design,{seed='',budget=7000}={}){
 const s=sheet(design,{seed});if(!s)return'';
 const out=[];
 if(s.kind==='app'){
  const st=s.style;
  out.push('','APP STYLE "'+st.name+'" ('+st.theme+'): '+st.idea,'Colour: '+clip(st.colourBudget,200)+'. '+clip(st.signature,500));
  if(st.tokens)out.push('Measured tokens to start from (map them onto the design tokens in src/index.css): '+clip(JSON.stringify({ground:st.tokens.ground,surface:st.tokens.surface,border:st.tokens.border,text:st.tokens.text,muted:st.tokens.muted,accent:st.tokens.accent,radius:st.tokens.radius,font:st.tokens.font&&{sizes:st.tokens.font.sizes,weights:st.tokens.font.weights,note:st.tokens.font.note}}),600));
  if(s.shell)out.push('Shell "'+s.shell.name+'": '+clip(s.shell.blueprint,700)+(s.shell.phone?' On a phone: '+clip(s.shell.phone,300):''));
  for(const p of s.patterns)out.push('Screen "'+p.screen+'" ('+p.name+'): '+clip(p.blueprint,800)+(p.phone?' On a phone: '+clip(p.phone,250):''));
  if(Array.isArray(st.identity)&&st.identity.length)out.push('Give the product its own face: '+st.identity.slice(0,3).map(x=>clip(x,260)).join(' '));
  if(Array.isArray(st.avoid)&&st.avoid.length)out.push('Avoid: '+st.avoid.slice(0,8).map(x=>clip(x,120)).join('; ')+'.');
  out.push(APP_RULES);
 }else{
  const d=s.direction;
  out.push('','ART DIRECTION "'+d.name+'": '+clip(d.idea,700),'Composition: '+clip(d.composition,500),'Typography: '+clip(d.typography,300),'Colour: '+clip(d.colour,300),'Imagery: '+clip(d.imagery,350),'What makes it rich: '+clip(d.richness,300),'Pitfalls: '+clip(d.pitfalls,350));
  if(s.hero)out.push('Hero "'+s.hero.name+'": '+clip(s.hero.blueprint,750)+(s.hero.mobile?' On a phone: '+clip(s.hero.mobile,300):''));
  for(const sec of s.sections)out.push('Section '+sec.role+' "'+sec.name+'": '+clip(sec.blueprint,420)+(sec.mobile?' Phone: '+clip(sec.mobile,160):''));
  if(s.motion)out.push('Motion "'+s.motion.name+'": '+clip(s.motion.description,400));
  out.push(PAGE_RULE);
 }
 // The closing rule always fits; lines before it are kept in order while they fit.
 const last=out.pop();let text='';
 for(const line of out){if((text+'\n'+line+'\n'+last).length>budget)continue;text+=(text?'\n':'')+line}
 return text+'\n'+last;
}
// Suggestions for the brief writer once the direction is known (palette and fonts that suit it).
function suggestions(design,{seed=''}={}){
 const s=sheet(design,{seed});if(!s||s.kind!=='page')return null;
 return{palette:s.palette&&{background:s.palette.bg,foreground:s.palette.ink,primary:s.palette.accent,secondary:s.palette.surface,muted:s.palette.surface,accent:s.palette.accent,note:s.palette.note},fonts:s.type&&{display:s.type.display.family,body:s.type.text.family,settings:s.type.display.settings}};
}
module.exports={deal,note,sheet,blueprint,suggestions,sectorOf,isAppScreen,appKind,validId,L};

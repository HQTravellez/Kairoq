"use strict";
// Picking an app's look before the first build (server: looks.js, /api/create/looks).
// The last question in the chat is "How should it feel?": five feelings, three looks for the
// one picked, a live sample screen in the preview area, and four ways to go further:
// Show 3 more, Browse all (100 looks), From a website, and Fine-tune (every colour, the fonts,
// corners and spacing, with a readability check). Nothing is chosen at random: the owner picks,
// or presses "Decide for me".
(function(){
const LOOK_API='/api/create';
async function call(path,body){
 const r=await fetch(LOOK_API+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,credentials:'same-origin'});
 const d=await r.json().catch(()=>({}));
 if(!r.ok)throw Object.assign(Error(d.error||'Request failed ('+r.status+')'),{status:r.status});
 return d;
}
function h(tag,attrs,...kids){
 const e=document.createElement(tag);
 for(const [k,v] of Object.entries(attrs||{})){
  if(v==null||v===false)continue;
  if(k==='class')e.className=v;else if(k==='style'&&typeof v==='object')Object.assign(e.style,v);
  else if(k.startsWith('on'))e.addEventListener(k.slice(2),v);else e.setAttribute(k,v===true?'':v);
 }
 for(const k of kids.flat())if(k!=null&&k!==false)e.append(k.nodeType?k:document.createTextNode(String(k)));
 return e;
}
const ROLES=[['bg','Background'],['surface','Cards and fields'],['ink','Text'],['muted','Soft text'],['accent','Accent'],['accentInk','Text on accent']];
const HEADS=[['Hanken Grotesk',600],['Albert Sans',600],['Space Grotesk',600],['Archivo',800],['Literata',500],['Newsreader',400],['Bodoni Moda',500],['Fraunces',600],['Bricolage Grotesque',800],['Unbounded',600],['Anton',400],['EB Garamond',500]];
const BODIES=['Hanken Grotesk','Albert Sans','Work Sans','Figtree','Space Grotesk','EB Garamond'];
const RADIUS={sharp:'3px',soft:'12px',round:'22px'};

// ---------- fonts for the previews ----------
const loadedFonts=new Set();
function loadFonts(names){
 const want=[...new Set(names.filter(n=>n&&!loadedFonts.has(n)))];if(!want.length)return;
 want.forEach(n=>loadedFonts.add(n));
 const fam=want.map(n=>'family='+encodeURIComponent(n).replace(/%20/g,'+')+(n==='Anton'?'':':wght@400;500;600;800')).join('&');
 document.head.append(h('link',{rel:'stylesheet',href:'https://fonts.googleapis.com/css2?'+fam+'&display=swap'}));
}

// ---------- colour helpers ----------
function rgb(x){const n=parseInt(x.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255]}
function lum(x){return rgb(x).map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)}).reduce((a,v,i)=>a+v*[0.2126,0.7152,0.0722][i],0)}
function ratio(a,b){const x=lum(a),y=lum(b);return(Math.max(x,y)+0.05)/(Math.min(x,y)+0.05)}
function toHsl(x){let [r,g,b]=rgb(x).map(v=>v/255);const mx=Math.max(r,g,b),mn=Math.min(r,g,b);let hh=0,s=0;const l=(mx+mn)/2;if(mx!==mn){const d=mx-mn;s=l>0.5?d/(2-mx-mn):d/(mx+mn);hh=mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4;hh/=6}return[hh,s,l]}
function fromHsl(hh,s,l){const f=n=>{const k=(n+hh*12)%12,a=s*Math.min(l,1-l);const c=l-a*Math.max(-1,Math.min(k-3,9-k,1));return Math.round(c*255).toString(16).padStart(2,'0')};return'#'+f(0)+f(8)+f(4)}
function shift(x,d){const [a,s,l]=toHsl(x);return fromHsl(a,s,Math.max(0,Math.min(1,l+d)))}
const copy=l=>JSON.parse(JSON.stringify(l));

// ---------- a sample screen in a look ----------
function sample(look,name,{big=false}={}){
 const c=look.colors,r=RADIUS[look.corners]||RADIUS.soft,gap=look.spacing==='compact'?'12px':'18px';
 loadFonts([look.head,look.body]);
 const head={fontFamily:"'"+look.head+"',serif",fontWeight:String(look.headW||600)},body="'"+look.body+"',sans-serif";
 const row=(label,i)=>h('div',{class:'lk-s-row',style:{borderColor:i?c.bg:'transparent'}},h('span',null,label),h('span',{style:{color:c.muted},'aria-hidden':'true'},'›'));
 return h('div',{class:'lk-sample'+(big?' big':''),style:{background:c.bg,color:c.ink,fontFamily:body,gap,'--lk-r':r}},
  h('div',{class:'lk-s-top'},h('span',{style:{color:c.muted}},name||'Your app'),h('span',{class:'lk-s-dot',style:{background:c.accent}})),
  h('div',{class:'lk-s-title',style:head},'Good morning'),
  h('p',{class:'lk-s-text',style:{color:c.muted}},'A sample screen in this look. Your real app appears here after the build.'),
  h('div',{class:'lk-s-field',style:{background:c.surface,color:c.muted,borderRadius:r}},'Search'),
  h('div',{class:'lk-s-card',style:{background:c.surface,borderRadius:r}},
   h('div',{class:'lk-s-cardhead',style:head},'Today'),row('Upcoming',0),row('Saved',1),row('Messages',2)),
  h('div',{class:'lk-s-actions'},
   h('span',{class:'lk-s-btn',style:{background:c.accent,color:c.accentInk,borderRadius:r}},'Get started'),
   h('span',{class:'lk-s-link',style:{color:c.accent}},'Learn more')));
}
// A small card for one look.
function lookCard(look,{on,onPick}){
 const c=look.colors;loadFonts([look.head,look.body]);
 const fonts=look.head===look.body?look.head:look.head+' and '+look.body;
 return h('button',{type:'button',class:'lk-card'+(on?' on':''),'aria-pressed':String(Boolean(on)),onclick:onPick,title:look.name+' · '+fonts},
  h('span',{class:'lk-card-art',style:{background:c.bg}},
   h('span',{class:'lk-card-h',style:{color:c.ink,fontFamily:"'"+look.head+"',serif",fontWeight:String(look.headW||600)}},'Good morning'),
   h('span',{class:'lk-card-tile',style:{background:c.surface,color:c.muted,fontFamily:"'"+look.body+"',sans-serif"}},'Today · 3 items'),
   h('span',{class:'lk-card-btn',style:{background:c.accent,color:c.accentInk,fontFamily:"'"+look.body+"',sans-serif"}},'Get started')),
  h('span',{class:'lk-card-meta'},
   h('b',null,look.name),
   h('span',{class:'lk-dots','aria-hidden':'true'},...['bg','surface','ink','muted','accent'].map(k=>h('i',{style:{background:c[k]}}))),
   h('small',null,fonts)));
}

// ---------- data ----------
let data=null;
async function loadData(){if(!data)data=await call('/looks');return data}
function forFeel(feel){
 const recent=new Set(data.recent||[]),all=data.looks.filter(l=>l.feel===feel);
 // Looks used for the owner's newest apps go to the end so new apps do not repeat them.
 return all.filter(l=>!recent.has(l.id.split('--')[0])).concat(all.filter(l=>recent.has(l.id.split('--')[0])));
}

// ---------- dialogs ----------
function dialog(cls,label,onClose){
 const back=h('div',{class:'lk-dialog-back'});
 const box=h('div',{class:'lk-dialog '+cls,role:'dialog','aria-modal':'true','aria-label':label});
 back.append(box);document.body.append(back);document.body.classList.add('lk-open');
 const prev=document.activeElement;
 const close=()=>{back.remove();document.removeEventListener('keydown',key);if(!document.querySelector('.lk-dialog-back'))document.body.classList.remove('lk-open');try{prev&&prev.focus()}catch{}onClose&&onClose()};
 const key=e=>{if(e.key==='Escape'&&back.isConnected&&back===[...document.querySelectorAll('.lk-dialog-back')].pop()){e.preventDefault();close()}};
 document.addEventListener('keydown',key);
 return{box,close};
}

// All 100 looks, like a template gallery: filters, search and shuffle.
function openGallery(current,onUse,{name}={}){
 const {box,close}=dialog('lk-gallery','All looks');
 const st={group:'all',kind:'any',q:'',order:null,picked:current&&data.looks.some(l=>l.id===current.id)?current.id:null};
 const groups=[['all','All'],['light','Light'],['dark','Dark'],['colourful','Colourful'],['earthy','Earthy'],['pastel','Pastel']];
 const kinds=[['any','Any font'],['clean','Clean'],['serif','Serif'],['bold','Bold']];
 const count=h('span',{class:'lk-sub'}),grid=h('div',{class:'lk-grid'}),filters=h('div',{class:'lk-filters'}),foot=h('div',{class:'lk-foot'});
 const search=h('input',{type:'search',placeholder:'Search: gold, navy, serif…','aria-label':'Search looks',oninput:e=>{st.q=e.target.value.toLowerCase().trim();draw()}});
 const shuffle=h('button',{type:'button',class:'lk-btn',onclick:()=>{st.order=data.looks.map(l=>[Math.random(),l.id]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);draw()}},'Shuffle');
 box.append(h('div',{class:'lk-head'},
  h('button',{type:'button',class:'lk-icon','aria-label':'Close',onclick:close},'×'),
  h('div',{class:'lk-titles'},h('h2',null,'All looks'),count),
  h('label',{class:'lk-search'},search),shuffle),filters,grid,foot);
 const chip=(label,on,fn)=>h('button',{type:'button',class:'lk-chip'+(on?' on':''),'aria-pressed':String(on),onclick:fn},label);
 function draw(){
  let list=data.looks.filter(l=>(st.group==='all'||l.group===st.group)&&(st.kind==='any'||l.kind===st.kind)&&(!st.q||(l.name+' '+l.head+' '+l.body+' '+l.group+' '+l.feel).toLowerCase().includes(st.q)));
  if(st.order)list=list.slice().sort((a,b)=>st.order.indexOf(a.id)-st.order.indexOf(b.id));
  count.textContent=list.length+' of '+data.looks.length+' looks';
  filters.replaceChildren(...groups.map(([id,l])=>chip(l,st.group===id,()=>{st.group=id;draw()})),h('span',{class:'lk-sep'}),...kinds.map(([id,l])=>chip(l,st.kind===id,()=>{st.kind=id;draw()})));
  grid.replaceChildren(...list.map(l=>lookCard(l,{on:l.id===st.picked,onPick:()=>{st.picked=l.id;draw()}})));
  if(!list.length)grid.append(h('p',{class:'lk-empty'},'No looks match that. Try another word, or clear the filters.'));
  const sel=data.looks.find(l=>l.id===st.picked);
  foot.replaceChildren(h('span',{class:'lk-foot-text'},sel?[h('b',null,sel.name),' with '+(sel.head===sel.body?sel.head:sel.head+' and '+sel.body)]:'Pick a look'),
   h('button',{type:'button',class:'lk-btn',disabled:!sel,onclick:()=>{close();openTune(copy(sel),onUse,{name})}},'Fine-tune'),
   h('button',{type:'button',class:'lk-primary',disabled:!sel,onclick:()=>{close();onUse(copy(sel))}},'Use this look'));
 }
 draw();setTimeout(()=>search.focus(),30);
}

// Fine-tune: every colour (with locks and shuffle), readability, fonts, corners and spacing.
function openTune(start,onUse,{name}={}){
 const base=copy(start);let look=copy(start);const locks={};let sel='accent';
 const {box,close}=dialog('lk-tune','Fine-tune the look');
 const stage=h('div',{class:'lk-stage'}),side=h('div',{class:'lk-side'});
 box.append(h('div',{class:'lk-head'},h('button',{type:'button',class:'lk-icon','aria-label':'Close',onclick:close},'×'),h('div',{class:'lk-titles'},h('h2',null,'Fine-tune'),h('span',{class:'lk-sub'},'Changes show straight away. Nothing is built until you press Use this look.'))),
  h('div',{class:'lk-tune-body'},stage,side));
 // Any change to colours or fonts makes it "Your mix" (a look from the owner's own website stays "My brand").
 const changed=()=>{const same=JSON.stringify([look.colors,look.head,look.body])===JSON.stringify([base.colors,base.head,base.body]);look.name=same?base.name:(base.source&&base.source.own?'My brand':'Your mix');look.id=same?base.id:'custom'};
 const set=(fn)=>{fn(look);changed();draw()};
 function section(title,...kids){return h('section',{class:'lk-sec'},h('h3',null,title),...kids)}
 function draw(){
  stage.replaceChildren(sample(look,name,{big:true}));
  const c=look.colors;
  const roles=h('div',{class:'lk-roles'},...ROLES.map(([k,label])=>h('div',{class:'lk-role'+(sel===k?' on':'')},
   h('button',{type:'button',class:'lk-role-pick','aria-pressed':String(sel===k),onclick:()=>{sel=k;draw()}},h('i',{style:{background:c[k]}}),h('span',null,label),h('small',null,c[k].toUpperCase())),
   h('button',{type:'button',class:'lk-lock'+(locks[k]?' on':''),'aria-pressed':String(Boolean(locks[k])),'aria-label':(locks[k]?'Unlock ':'Lock ')+label.toLowerCase(),title:locks[k]?'Locked: Shuffle keeps it':'Lock it so Shuffle keeps it',onclick:()=>{locks[k]=!locks[k];draw()}},lockIcon(locks[k])))));
  const presets=[...new Set([base.colors[sel],...data.looks.map(l=>l.colors[sel])])].slice(0,24);
  const hexIn=h('input',{value:c[sel].toUpperCase(),'aria-label':'Colour code for '+ROLES.find(r=>r[0]===sel)[1].toLowerCase(),onchange:e=>{let v=e.target.value.trim();if(!v.startsWith('#'))v='#'+v;if(/^#[0-9a-fA-F]{6}$/.test(v))set(l=>{l.colors[sel]=v.toLowerCase()});else e.target.value=c[sel].toUpperCase()}});
  const picker=h('div',{class:'lk-picker'},
   h('span',{class:'lk-sub'},ROLES.find(r=>r[0]===sel)[1]+': pick one, or type a colour'),
   h('div',{class:'lk-swatches'},...presets.map(x=>h('button',{type:'button',class:'lk-swatch'+(x===c[sel]?' on':''),style:{background:x},'aria-label':x,onclick:()=>set(l=>{l.colors[sel]=x})}))),
   h('div',{class:'lk-row'},hexIn,
    h('input',{type:'color',value:c[sel],'aria-label':'Colour picker',oninput:e=>{look.colors[sel]=e.target.value;changed();stage.replaceChildren(sample(look,name,{big:true}))},onchange:()=>draw()}),
    h('button',{type:'button',class:'lk-btn sm',onclick:()=>set(l=>{l.colors[sel]=shift(l.colors[sel],0.06)})},'Lighter'),
    h('button',{type:'button',class:'lk-btn sm',onclick:()=>set(l=>{l.colors[sel]=shift(l.colors[sel],-0.06)})},'Darker')));
  const checks=[['Text on background','ink','bg'],['Soft text on background','muted','bg'],['Text on cards','ink','surface'],['Button text','accentInk','accent']].map(([label,f,b])=>{
   const r=ratio(c[f],c[b]),ok=r>=4.5;
   return h('div',{class:'lk-check'},h('span',{class:'lk-aa',style:{background:c[b],color:c[f]},'aria-hidden':'true'},'Aa'),h('span',{class:'lk-check-l'},label),
    h('span',{class:'lk-check-v'+(ok?'':' bad')},r.toFixed(1)+':1 · '+(ok?'Easy to read':r>=3?'Big text only':'Hard to read')),
    ok?null:h('button',{type:'button',class:'lk-fix',onclick:()=>set(l=>{let x=l.colors[f];const d=lum(l.colors[b])>0.35?-0.04:0.04;for(let i=0;i<30&&ratio(x,l.colors[b])<4.5;i++)x=shift(x,d);l.colors[f]=x})},'Fix'));
  });
  const seg=(opts,val,fn)=>h('div',{class:'lk-seg',role:'group'},...opts.map(([id,label])=>h('button',{type:'button','aria-pressed':String(val===id),class:val===id?'on':'',onclick:()=>set(l=>fn(l,id))},label)));
  loadFonts(HEADS.map(x=>x[0]).concat(BODIES));
  side.replaceChildren(
   h('div',{class:'lk-sec lk-sec-top'},h('div',null,h('b',null,look.name),h('span',{class:'lk-sub'},look.name===base.name?'  as picked':'  changed by you')),
    h('div',{class:'lk-row'},h('button',{type:'button',class:'lk-btn grow',onclick:()=>{const p=data.looks[Math.floor(Math.random()*data.looks.length)];set(l=>{for(const [k] of ROLES)if(!locks[k])l.colors[k]=p.colors[k]})}},'Shuffle unlocked colours'),
     h('button',{type:'button',class:'lk-btn',onclick:()=>{look=copy(base);draw()}},'Reset'))),
   section('Colours',roles,picker),
   section('Easy to read?',...checks),
   section('Fonts',h('span',{class:'lk-sub'},'Headings'),h('div',{class:'lk-fonts'},...HEADS.map(([f,w])=>h('button',{type:'button',class:'lk-font'+(look.head===f?' on':''),'aria-pressed':String(look.head===f),onclick:()=>set(l=>{l.head=f;l.headW=w})},h('span',{style:{fontFamily:"'"+f+"',serif",fontWeight:String(w)}},'Aa'),h('small',null,f)))),
    h('span',{class:'lk-sub'},'Body text'),h('div',{class:'lk-fonts two'},...BODIES.map(f=>h('button',{type:'button',class:'lk-font body'+(look.body===f?' on':''),'aria-pressed':String(look.body===f),style:{fontFamily:"'"+f+"',sans-serif"},onclick:()=>set(l=>{l.body=f})},f)))),
   section('Shape',h('span',{class:'lk-sub'},'Corners'),seg([['sharp','Sharp'],['soft','Soft'],['round','Round']],look.corners||'soft',(l,v)=>{l.corners=v}),
    h('span',{class:'lk-sub'},'Spacing'),seg([['compact','Compact'],['comfortable','Comfortable']],look.spacing||'comfortable',(l,v)=>{l.spacing=v})),
   h('div',{class:'lk-side-foot'},
    h('button',{type:'button',class:'lk-primary',onclick:()=>{close();onUse(copy(look))}},'Use this look'),
    h('button',{type:'button',class:'lk-plain',onclick:async e=>{const b=e.currentTarget;b.disabled=true;try{data.brand=(await call('/looks/brand',{look:{...look,name:'My brand'}})).brand;b.textContent='Saved. It will be offered for your next apps.'}catch(err){b.textContent=err.message;b.disabled=false}}},'Save as my brand for future apps')));
 }
 draw();
}
function lockIcon(on){
 const s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('viewBox','0 0 24 24');s.setAttribute('aria-hidden','true');
 s.innerHTML='<rect x="5" y="11" width="14" height="10" rx="2" fill="'+(on?'currentColor':'none')+'"/><path d="'+(on?'M8 11V8a4 4 0 0 1 8 0v3':'M8 11V8a4 4 0 0 1 7.5-2')+'" fill="none"/>';
 return s;
}

// A look from a public website: what Kairoq understood, and what it will and will not use.
function openSite(onUse,{name}={}){
 const {box,close}=dialog('lk-site','Look from a website');
 const st={own:false,result:null,busy:false,error:''};
 const url=h('input',{type:'url',placeholder:'https://yourbusiness.com','aria-label':'Website address',onkeydown:e=>{if(e.key==='Enter'){e.preventDefault();read()}}});
 const body=h('div',{class:'lk-site-body'});
 box.append(h('div',{class:'lk-head'},h('button',{type:'button',class:'lk-icon','aria-label':'Close',onclick:close},'×'),h('div',{class:'lk-titles'},h('h2',null,'Start from a website you like'),h('span',{class:'lk-sub'},'Kairoq opens the page like a normal visitor and measures its design. It never logs in.'))),body);
 async function read(){
  const v=url.value.trim();if(!v||st.busy)return;
  st.busy=true;st.error='';draw();
  try{st.result=await call('/looks/from-site',{url:/^https?:\/\//i.test(v)?v:'https://'+v,own:st.own})}
  catch(e){st.error=e.message;st.result=null}
  st.busy=false;draw();
 }
 function draw(){
  const look=st.result&&{...st.result.look,name:st.own?'My brand':st.result.look.name,source:{...st.result.look.source,own:st.own}};
  const sw=h('button',{type:'button',role:'switch','aria-checked':String(st.own),class:'lk-switch'+(st.own?' on':''),'aria-label':'This is my own business',onclick:()=>{st.own=!st.own;draw()}},h('i'));
  const left=h('div',{class:'lk-site-left'},
   h('div',{class:'lk-row'},url,h('button',{type:'button',class:'lk-dark',disabled:st.busy,onclick:read},st.busy?'Reading…':'Read the site')),
   st.error?h('p',{class:'lk-error',role:'alert'},st.error):null,
   h('div',{class:'lk-own'},h('div',null,h('b',null,'This is my own business'),h('span',{class:'lk-sub'},'Turn on to match it exactly, with your name.')),sw),
   h('div',{class:'lk-lists'},
    h('div',null,h('b',null,'Kairoq will use'),...(st.own?['Your exact colours','Your fonts, or the closest free match','Your business name','The same shapes and spacing']:['The colour mood','The style of the fonts, matched with free ones','Corners, spacing and shadows','Layout ideas']).map(t=>h('span',null,t))),
    h('div',null,h('b',null,st.own?'Kairoq still checks':'Kairoq will not copy'),...(st.own?['Text is easy to read on every colour','It works on a phone','Buttons are big enough to tap']:['Their name, logo or trademarks','Their text and photos','Their exact pages, pixel for pixel','Anything behind a login']).map(t=>h('span',null,t)))));
  if(st.result){
   const u=st.result.understood;
   left.insertBefore(h('div',{class:'lk-understood'},h('h3',null,'What Kairoq understood'),
    h('dl',null,
     h('dt',null,'Colours'),h('dd',null,h('span',{class:'lk-colour-list'},...u.colors.map(x=>h('span',{class:'lk-colour'},h('i',{style:{background:x.hex}}),x.label)))),
     h('dt',null,'Fonts'),h('dd',null,u.fonts),h('dt',null,'Shape'),h('dd',null,u.shape),h('dt',null,'Layout'),h('dd',null,u.layout||'—'),h('dt',null,'Feel'),h('dd',null,u.feel||'—'))),left.children[1]);
   left.append(h('div',{class:'lk-row end'},
    h('button',{type:'button',class:'lk-btn',onclick:()=>{close();openTune(copy(look),onUse,{name})}},'Fine-tune it first'),
    h('button',{type:'button',class:'lk-primary',onclick:()=>{close();onUse(copy(look))}},st.own?'Use my brand':'Use this feel')));
  }
  body.replaceChildren(left,h('div',{class:'lk-site-right'},look?sample(look,st.own?name:name,{big:true}):h('p',{class:'lk-sub lk-wait'},st.busy?'Reading the website… this takes about 15 seconds.':'Your app will appear here in that style.')));
  if(!st.result&&!st.busy)setTimeout(()=>url.focus(),30);
 }
 draw();
}

// ---------- the step inside the chat ----------
// card: the chat list item to draw into. count: "Question 3 of 3" or "One quick question".
// onBuild(look|null): null means "Decide for me" without a pick (Kairoq's own design brief).
async function step({card,count,name,onBuild,onBack,onSkip}){
 card.replaceChildren(h('p',{class:'ask-head'},'Loading looks…'));
 try{await loadData()}catch(e){return onBuild(null)}
 const st={feel:'calm',page:0,picked:null};
 const preview=previewPane();document.body.classList.add('picking-look');
 const done=()=>{document.body.classList.remove('picking-look');preview.remove()};
 // A look from the gallery, a website or Fine-tune joins the cards and is selected.
 const use=look=>{st.picked=look;if(!shown().some(l=>l.id===look.id)&&!(data.brand&&look.id===data.brand.id))st.extra=look;draw()};
 function shown(){const list=forFeel(st.feel);const n=list.length;const a=(st.page*3)%n;return[0,1,2].map(i=>list[(a+i)%n])}
 function draw(){
  const three=shown();if(!st.picked)st.picked=three[0];
  const cards=[...(data.brand?[data.brand]:[]),...(st.extra?[st.extra]:[]),...three];
  preview.replaceChildren(h('div',{class:'lk-preview-head'},h('b',null,'Live preview'),h('span',null,st.picked.name+', changes as you pick')),sample(st.picked,name));
  const foot=h('div',{class:'ask-foot'});
  if(onBack)foot.append(h('button',{type:'button',class:'ask-link',onclick:()=>{done();onBack()}},'Back'));
  foot.append(h('button',{type:'button',class:'ask-ghost',onclick:()=>{const l=three[Math.floor(Math.random()*3)];st.picked=l;draw();}},'Decide for me'),
   h('button',{type:'button',class:'ask-next',onclick:()=>{done();onBuild(copy(st.picked))}},'Build with '+st.picked.name));
  card.replaceChildren(
   h('div',{class:'ask-top'},h('span',{class:'ask-count'},count),h('button',{type:'button',class:'ask-link',onclick:()=>{done();(onSkip||onBuild)(null)}},'Skip')),
   h('p',{class:'ask-q'},'How should it feel?'),
   h('p',{class:'lk-sub lk-lead'},'Pick a feeling, then a look. You can change any colour or font afterwards.'),
   h('div',{class:'lk-feels',role:'group','aria-label':'Feeling'},...data.feels.map(f=>h('button',{type:'button',class:'lk-chip'+(st.feel===f.id?' on':''),'aria-pressed':String(st.feel===f.id),onclick:()=>{st.feel=f.id;st.page=0;st.picked=null;draw()}},f.label))),
   h('div',{class:'lk-cards'},...cards.map(l=>lookCard(l,{on:l===st.picked||l.id===st.picked.id,onPick:()=>{st.picked=l;draw()}}))),
   h('div',{class:'lk-tools'},
    h('button',{type:'button',class:'lk-btn',onclick:()=>{st.page++;st.picked=null;draw()}},'Show 3 more'),
    h('button',{type:'button',class:'lk-btn',onclick:()=>openGallery(st.picked,use,{name})},'Browse all '+data.looks.length),
    h('button',{type:'button',class:'lk-btn',onclick:()=>openSite(use,{name})},'From a website'),
    h('button',{type:'button',class:'lk-link',onclick:()=>openTune(copy(st.picked),use,{name})},'Fine-tune colours and fonts')),
   foot);
 }
 draw();
}
function previewPane(){
 const old=document.getElementById('look-preview');if(old)old.remove();
 const p=h('div',{id:'look-preview',class:'lk-preview',role:'region','aria-label':'Look preview'});
 (document.getElementById('canvas')||document.body).append(p);
 return p;
}

window.KairoqLook={step,openGallery,openTune,openSite,sample};
})();

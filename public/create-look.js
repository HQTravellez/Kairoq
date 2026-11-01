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
   h('small',null,look.material?look.material:fonts)));
}

// ---------- data ----------
let data=null;
async function loadData(prompt){if(!data)data=await call('/looks'+(prompt?'?prompt='+encodeURIComponent(String(prompt).slice(0,2000)):''));return data}
// Apps for children start on Playful and are offered only light, soft looks (no dark screens).
function forKids(prompt){return /\b(kids?|children|child|toddlers?|preschool(ers)?|little ones|nursery|kindergarten)\b/i.test(String(prompt||''))}
function light(l){const n=parseInt(String(l.colors&&l.colors.bg||'#ffffff').slice(1),16);return(0.2126*((n>>16)&255)+0.7152*((n>>8)&255)+0.0722*(n&255))/255>0.72}
function forFeel(feel,kids){
 const recent=new Set(data.recent||[]),every=data.looks.filter(l=>l.feel===feel),soft=kids?every.filter(light):every,all=soft.length>=3?soft:every;
 // Hallmark themes that fit the request come first; looks used for the owner's newest apps go
 // to the end so new apps do not repeat them.
 const sug=data.suggested||[],rank=l=>sug.includes(l.id)?0:recent.has(l.id.split('--')[0])?2:1;
 return all.map((l,i)=>[rank(l),sug.indexOf(l.id)>=0?sug.indexOf(l.id):i,l]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]).map(x=>x[2]);
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

// 3D styles (react-models.js STYLES). Kairoq adds a free Poly Haven model if none is uploaded.
const THREE_D=[
 {id:'none',label:'No 3D',tip:'A normal app. You can add 3D any time in Design → 3D models.'},
 {id:'product',label:'Product viewer',tip:'Visitors turn and zoom a 3D model; on phones they can place it in their room (AR).'},
 {id:'walkthrough',label:'Room walkthrough',tip:'Move around a space with labelled spots, for a property, venue or showroom.'},
 {id:'scroll',label:'Scroll story',tip:'The camera moves around your model as visitors scroll.'},
 {id:'background',label:'3D background',tip:'A slow-turning model behind the top of the page.'}];
// ---------- the brand step inside the chat ----------
// One question after the clarifying ones: "Do you have a brand?" Three ways in: the owner's own
// site or colours, Kairoq's pick for this business (recommended, shown as a real page preview),
// or a few words the owner writes. No gallery of palettes: Kairoq chooses from its looks and
// Hallmark's themes underneath, and the owner can still open the gallery or fine-tune.
const FEEL_WORDS=[[/\b(warm|cosy|cozy|friendly|soft|gentle|calm|quiet|natural|organic)\b/i,'calm'],[/\b(bold|loud|strong|punchy|energetic|sport|street|urban)\b/i,'bold'],[/\b(fun|playful|kids?|children|bright|colou?rful|cheerful|candy)\b/i,'playful'],[/\b(premium|luxury|luxurious|elegant|dark|moody|high.end|boutique|classy|refined)\b/i,'premium'],[/\b(minimal|clean|simple|plain|modern|tech|saas|startup)\b/i,'minimal']];
function feelFromWords(t){for(const [re,f] of FEEL_WORDS)if(re.test(String(t||'')))return f;return''}
// A short name for the preview: the project name when it is short, else the first few words of
// the request without the "a website for" part ("A field guide website for Ontario birds" → "Ontario birds").
function headline(name,prompt){
 let n=String(name||prompt||'').replace(/^(an?|the|my)\s+/i,'').replace(/\b(website|web app|app|site|landing page|page|platform)\b\s*(for|about|of)?\s*/i,'').replace(/\s+with\b.*$/i,'').trim();
 n=n.split(/[.,:;\n]/)[0].trim();
 if(n.length>28)n=n.split(/\s+/).slice(0,3).join(' ');
 return n?n.charAt(0).toUpperCase()+n.slice(1):'Your business';
}
// A real page in this look: menu, headline, one sentence, the action, a short list. Not a sample screen.
function pagePreview(look,name,prompt){
 const c=look.colors,r=RADIUS[look.corners]||RADIUS.soft;loadFonts([look.head,look.body]);
 const head={fontFamily:"'"+look.head+"',serif",fontWeight:String(look.headW||600)},body="'"+look.body+"',sans-serif";
 const row=(a,b,i)=>h('div',{class:'lk-p-row',style:{borderColor:i?c.surface:'transparent'}},h('span',null,a),h('span',{style:{color:c.muted}},b));
 return h('div',{class:'lk-page',style:{background:c.bg,color:c.ink,fontFamily:body,'--lk-r':r}},
  h('div',{class:'lk-p-nav',style:{borderColor:c.surface}},h('b',{style:head},headline(name,prompt)),h('span',{style:{color:c.muted}},'Home'),h('span',{style:{color:c.muted}},'About'),h('span',{class:'lk-p-cta',style:{background:c.accent,color:c.accentInk,borderRadius:r}},'Get in touch')),
  h('div',{class:'lk-p-hero'},
   h('div',{class:'lk-p-h1',style:head},headline(name,prompt)),
   h('p',{class:'lk-p-sub',style:{color:c.muted}},'One clear sentence about what you offer and who it is for.'),
   h('div',{class:'lk-p-actions'},h('span',{class:'lk-p-btn',style:{background:c.accent,color:c.accentInk,borderRadius:r}},'Get started'),h('span',{class:'lk-p-link',style:{color:c.ink}},'See how it works'))),
  h('div',{class:'lk-p-list',style:{background:c.surface,borderRadius:r}},h('div',{class:'lk-p-listhead',style:head},'What you get'),row('Made for your customers','Clear and quick',0),row('Works on every phone','Tested before you see it',1),row('Yours to change','Any colour, any word',2)));
}
function whyThis(look,name){
 if(look.material)return'For '+headline(name)+' I would go with '+look.name+': '+look.material+'.';
 const feel=({calm:'calm and clear',bold:'bold',playful:'playful',premium:'premium and quiet',minimal:'minimal'})[look.feel]||'clear';
 return'For '+headline(name)+' I would go with '+look.name+': a '+feel+' look, '+(look.head===look.body?look.head+' throughout':look.head+' for headings and '+look.body+' for reading')+'.';
}
async function step({card,count,name,prompt,onBuild,onBack,onSkip}){
 card.replaceChildren(h('p',{class:'ask-head'},'One more thing…'));
 try{await loadData(prompt)}catch(e){return onBuild(null)}
 const kids=forKids(prompt);
 // Kairoq's picks for this request: suggested themes first, then the looks of the fitting feel.
 const feel=feelFromWords(prompt)||(kids?'playful':'calm');
 const picks=()=>{const sug=(data.suggested||[]).map(id=>data.looks.find(l=>l.id===id)).filter(l=>l&&(!kids||light(l)));const rest=forFeel(feel,kids).filter(l=>!sug.includes(l));return[...sug,...rest]};
 const st={mode:data.brand?'mine':'kairoq',at:0,list:picks(),picked:null,words:'',site:null,busy:false,error:''};
 st.picked=data.brand||st.list[0];
 const use=look=>{st.picked=look;draw()};
 const describe=async()=>{
  const words=st.words.trim();if(!words||st.busy)return;
  st.busy=true;st.error='';draw();
  try{const d=await call('/looks?prompt='+encodeURIComponent(words.slice(0,300)));const f=feelFromWords(words);const sug=(d.suggested||[]).map(id=>data.looks.find(l=>l.id===id)).filter(Boolean);st.list=[...sug,...(f?data.looks.filter(l=>l.feel===f&&!sug.includes(l)):[])];if(!st.list.length)st.list=picks();st.at=0;st.picked=st.list[0]}
  catch(e){st.error=e.message}
  st.busy=false;draw();
 };
 const readSite=async(input)=>{
  const v=input.value.trim();if(!v||st.busy)return;
  st.busy=true;st.error='';draw();
  try{const r=await call('/looks/from-site',{url:/^https?:\/\//i.test(v)?v:'https://'+v,own:true});st.site=r;st.picked=r.look}
  catch(e){st.error=e.message}
  st.busy=false;draw();
 };
 function draw(){
  const look=st.picked;
  const opt=(id,title,sub)=>h('button',{type:'button',class:'brand-opt'+(st.mode===id?' on':''),'aria-pressed':String(st.mode===id),onclick:()=>{st.mode=id;if(id==='kairoq'){st.list=picks();st.at=0;st.picked=st.list[0]}if(id==='mine'&&data.brand)st.picked=data.brand;draw()}},h('b',null,title),h('span',null,sub));
  const body=h('div',{class:'brand-body'});
  if(st.mode==='mine'){
   const input=h('input',{type:'url',class:'brand-url',placeholder:'yourbusiness.com','aria-label':'Your website',value:'',onkeydown:e=>{if(e.key==='Enter'){e.preventDefault();readSite(input)}}});
   body.append(h('p',{class:'brand-note'},data.brand?'Your saved brand is ready; Kairoq matches it exactly.':'Paste your website and Kairoq reads your colours and fonts, or set them by hand.'),
    h('div',{class:'brand-row'},input,h('button',{type:'button',class:'lk-btn',disabled:st.busy,onclick:()=>readSite(input)},st.busy?'Reading…':'Read it'),h('button',{type:'button',class:'lk-link',onclick:()=>openTune(copy(look||st.list[0]),use,{name})},'Set colours and fonts by hand')));
   if(st.site&&st.site.understood){const u=st.site.understood;body.append(h('p',{class:'brand-got'},'Got it: '+u.colors.map(x=>x.label.toLowerCase()+' '+x.hex).join(', ')+'; '+u.fonts+'. We will match it exactly.'))}
  }else if(st.mode==='words'){
   const input=h('input',{type:'text',class:'brand-url',placeholder:'warm, like a Scandinavian bakery',value:st.words,'aria-label':'Describe the look',oninput:e=>{st.words=e.target.value},onkeydown:e=>{if(e.key==='Enter'){e.preventDefault();describe()}}});
   body.append(h('p',{class:'brand-note'},'A few words are enough: a mood, a material, a place.'),h('div',{class:'brand-row'},input,h('button',{type:'button',class:'lk-btn',disabled:st.busy,onclick:describe},st.busy?'Finding…':'Show me')));
  }else{
   body.append(h('p',{class:'brand-why'},look?whyThis(look,name):''));
  }
  if(st.error)body.append(h('p',{class:'lk-error'},st.error));
  if(look&&(st.mode!=='mine'||st.site||data.brand)){
   body.append(pagePreview(look,name,prompt),
    h('div',{class:'brand-tools'},
     st.mode!=='mine'&&st.list.length>1?h('button',{type:'button',class:'lk-btn',onclick:()=>{st.at=(st.at+1)%st.list.length;st.picked=st.list[st.at];draw()}},'Try another'):null,
     h('button',{type:'button',class:'lk-link',onclick:()=>openTune(copy(look),use,{name})},'Fine-tune'),
     h('button',{type:'button',class:'lk-link',onclick:()=>openGallery(look,use,{name})},'All looks')));
  }
  const foot=h('div',{class:'ask-foot'});
  if(onBack)foot.append(h('button',{type:'button',class:'ask-link',onclick:onBack},'Back'));
  foot.append(h('span',{class:'ask-gap'}),h('button',{type:'button',class:'ask-link',onclick:()=>(onSkip||onBuild)(null)},'Not now'),
   h('button',{type:'button',class:'ask-next',disabled:!look,onclick:()=>onBuild({...copy(look),three_d:'none'})},look?'Build with '+look.name:'Build'));
  card.replaceChildren(
   h('p',{class:'ask-intro'},'One more thing: do you have a brand?'),
   h('div',{class:'brand-opts',role:'group','aria-label':'Brand'},
    opt('mine','Use my brand','Your website, or your logo and colours'),
    opt('kairoq','Design it for me'+(st.mode==='kairoq'||!data.brand?' (Recommended)':''),'Kairoq picks a direction for this business and shows it'),
    opt('words','I\'ll describe it','"warm, like a Scandinavian bakery"')),
   body,foot);
 }
 draw();
}
window.KairoqLook={step,openGallery,openTune,openSite,sample,pagePreview,forKids};
})();

"use strict";
(()=>{
const $=id=>document.getElementById(id);
const state={me:null,project:null,job:null,mode:'signup',file:null,model:(()=>{try{return localStorage.getItem('kairoq-model')||'auto'}catch{return'auto'}})()};

async function api(path,{method='GET',body}={}){
 const r=await fetch('/api/create'+path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,credentials:'same-origin'});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw Object.assign(new Error(data.error||'Request failed ('+r.status+')'),{status:r.status,data});
 return data;
}
// Motion on Home (kept short, and off for people who ask for reduced motion):
// the heading rises in word by word, project cards fade in one after another.
const CALM=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
function revealTitle(){
 const h=$('home-title');if(!h||CALM)return;
 const words=h.textContent.trim().split(/\s+/);h.setAttribute('aria-label',words.join(' '));h.replaceChildren();
 words.forEach((w,i)=>{const s=el('span','hw',w);s.setAttribute('aria-hidden','true');s.style.setProperty('--i',i);h.append(s);if(i<words.length-1)h.append(' ')});
}
function show(screen){
 // Inside Kairoq's Home, tell it once the editor is on screen so it lifts its loading panel.
 if(screen==='editor'&&window.parent!==window)try{window.parent.postMessage({kairoq:'ready'},location.origin)}catch{}
 for(const id of ['auth','home','editor','share-screen','check-screen','plugins-screen','leads-screen','api-screen','ideas-screen','agents-screen','connectors-screen','templates-screen','pricing-screen','settings-screen'])$(id).classList.toggle('hidden',id!==screen);
 $('bar-project').classList.toggle('hidden',screen!=='editor');
 if(screen!=='check-screen'){clearTimeout(checkState.timer);checkState.id=null}
 $('landing-nav').classList.toggle('hidden',screen!=='auth');
 const app=screen==='home'||screen==='editor'||screen==='plugins-screen'||screen==='leads-screen'||screen==='api-screen'||screen==='ideas-screen'||screen==='agents-screen'||screen==='connectors-screen'||screen==='templates-screen'||screen==='pricing-screen'||screen==='settings-screen'||(screen==='check-screen'&&Boolean(state.me&&state.me.viewer));
 document.body.classList.toggle('app',app);document.body.classList.toggle('in-editor',screen==='editor');
 // The home sky follows the clock: a morning sky from 6:00 to 18:00, the night sky otherwise.
 document.body.classList.toggle('day',(()=>{const h=new Date().getHours();return h>=6&&h<18})());
 $('side').classList.toggle('hidden',!app);
 if(screen==='editor'&&!state.sideSet){state.sideSet=true;document.body.classList.remove('side-open')}
 if(window.innerWidth<=820)document.body.classList.remove('side-open');
 $('side-open-btn').classList.toggle('hidden',!app);
 for(const b of ['side-new','side-projects','side-templates','side-check','side-plugins','side-leads','side-api','side-ideas','side-agents','side-connectors','side-settings'])$(b).removeAttribute('aria-current');
 if(screen==='check-screen')$('side-check').setAttribute('aria-current','page');
 if(screen==='plugins-screen')$('side-plugins').setAttribute('aria-current','page');
 if(screen==='leads-screen')$('side-leads').setAttribute('aria-current','page');
 if(screen==='api-screen')$('side-api').setAttribute('aria-current','page');
 if(screen==='ideas-screen')$('side-ideas').setAttribute('aria-current','page');
 if(screen==='agents-screen')$('side-agents').setAttribute('aria-current','page');
 if(screen==='connectors-screen')$('side-connectors').setAttribute('aria-current','page');
 if(screen==='templates-screen')$('side-templates').setAttribute('aria-current','page');
 $('side-account').open=false; // the account menu closes once you pick a page from it
 if(screen==='settings-screen'||screen==='pricing-screen')$('side-settings').setAttribute('aria-current','page');
 if(screen==='home')$('side-projects').setAttribute('aria-current','page');
 if(screen==='home'&&document.getElementById('home')?.classList.contains('hidden')===false)revealTitle();
}
const cap=s=>s?s[0].toUpperCase()+s.slice(1):s;
function text(el,value){el.textContent=value==null?'':String(value)}
function when(iso){try{return new Date(iso).toLocaleString([], {dateStyle:'medium',timeStyle:'short'})}catch{return''}}

// ---------- account ----------
async function loadMe(){
 state.me=await api('/me');
 const v=state.me.viewer;
 text($('who'),v?(v.kind==='owner'?'Owner':v.account.email):'');
 const name=v?(v.kind==='owner'?'':v.account.email.split('@')[0].replace(/\d+$/,'').replace(/[._-]+/g,' ').trim().slice(0,24)):'';
 text($('ws-name'),!v?'Kairoq':name?cap(name)+"'s Kairoq":'Kairoq workspace');text($('ws-avatar'),(name||'K')[0].toUpperCase());
 text($('home-title'),name?'What should we build, '+cap(name.split(' ')[0])+'?':'What should we build?');revealTitle();
 $('side-admin').classList.toggle('hidden',!(v&&v.kind==='owner'));
 // The older chat page (Plugins, Skills, Sales Agent) is for the owner only; clients never see it.
 $('side-chat').classList.toggle('hidden',!(v&&v.kind==='owner'));
 const wa=state.me.whatsapp;$('side-wa').classList.toggle('hidden',!(wa&&v&&v.kind==='customer'));$('landing-wa').classList.toggle('hidden',!wa);if(wa)$('landing-wa').href=wa.start;
 $('logout').classList.toggle('hidden',!v||v.kind!=='customer');
 renderCredits(v&&v.account);
 text($('free-note'),state.me.free_credits?'Start building for free. Your first '+state.me.free_credits+' credits are on us.':'');
 return v;
}
function renderCredits(account){
 const customer=Boolean(account);
 $('credits').classList.toggle('hidden',!customer);$('credits-card').classList.toggle('hidden',!customer);
 $('buy').classList.toggle('hidden',!customer||!state.me?.purchases);
 $('plans-open').classList.toggle('hidden',!customer||!state.me?.subscriptions);
 if(customer)text($('credits'),account.credits+' credit'+(account.credits===1?'':'s')+(account.plan?' · '+planName(account.plan):''));
}
function planName(id){return(state.me?.plans||[]).find(p=>p.id===id)?.name||id}
function setMode(mode){
 state.mode=mode;
 $('forgot-form').classList.add('hidden'); // ui/screens: switching tabs leaves the reset-link form
 $('tab-signup').setAttribute('aria-selected',String(mode==='signup'));
 $('tab-login').setAttribute('aria-selected',String(mode==='login'));
 text($('auth-submit'),mode==='signup'?'Create free account':'Sign in');
 text($('auth-title'),mode==='signup'?'Make room for your ideas.':'Welcome back.');
 $('password').autocomplete=mode==='signup'?'new-password':'current-password';
 $('free-note').classList.toggle('hidden',mode!=='signup');
 text($('auth-error'),'');
}
// Sign-in and sign-up open as a pop-up over the page (no big form on the landing page).
function openAuth(mode){const d=$('auth-dialog');if(mode)setMode(mode);if(!d.open)d.showModal();(d.querySelector('form:not(.hidden) input')||$('email')).focus()}
$('auth-close').onclick=()=>$('auth-dialog').close();
$('auth-dialog').addEventListener('click',e=>{if(e.target===$('auth-dialog'))$('auth-dialog').close()});
$('foot-signin').onclick=e=>{e.preventDefault();openAuth('login')};
$('tab-signup').onclick=()=>setMode('signup');
$('tab-login').onclick=()=>setMode('login');
$('auth-form').onsubmit=async e=>{
 e.preventDefault();text($('auth-error'),'');$('auth-submit').disabled=true;
 try{await api('/'+state.mode,{method:'POST',body:{email:$('email').value,password:$('password').value}});await start()}
 catch(err){text($('auth-error'),err.message)}
 finally{$('auth-submit').disabled=false}
};
$('logout').onclick=async()=>{await api('/logout',{method:'POST'}).catch(()=>{});location.href='/create'};

// ---------- home ----------
// Inside the main Kairoq page the builder has no start page of its own: going home (or a
// build that could not start) goes back to Kairoq's Home, with the error and the request.
const EMBED=new URLSearchParams(location.search).get('embed')==='1'||window.self!==window.top;
function backToKairoq(extra={}){try{window.parent.postMessage({kairoq:'home',...extra},location.origin)}catch{}}
async function loadHome(){
 if(EMBED&&window.parent!==window){backToKairoq();return}
 show('home');history.replaceState(null,'','/create');
 const acct=state.me.viewer?.account;
 $('verify-notice').classList.toggle('hidden',!(acct&&!acct.email_verified&&state.me.email_ready));
 // The owner is warned when a deploy would wipe everything (no persistent volume).
 $('storage-warn').classList.toggle('hidden',!(state.me.storage&&state.me.storage.persistent===false));
 renderSetup(state.me.setup);
 // The first build's price, before typing (the questions before it are free).
 const firstNote=document.querySelector('#new-form .prompt-note'),std=(state.me.tiers||[]).find(t=>t.id==='standard'&&t.enabled);
 if(firstNote)firstNote.textContent='Tested in a real browser'+(acct&&std?' · first build '+std.credits+' credit'+(std.credits===1?'':'s')+', the questions are free':'');
 renderTemplates($('home-templates'),id=>startFromTemplate(id),id=>startFromSponsored(id));
 homeTab(state.homeTab||'projects');
 const {projects}=await api('/projects');
 renderProjects(projects);
}
// The owner's setup checklist: open while something required is missing, folded once all is set.
function renderSetup(setup){
 const card=$('setup-card');if(!card)return;
 card.classList.toggle('hidden',!setup);if(!setup)return;
 $('setup-title').textContent=setup.missing_required?'Finish setup: '+setup.missing_required+' needed':'Setup';
 $('setup-count').textContent=setup.done+' of '+setup.total;
 $('setup-list').replaceChildren(...setup.items.map(i=>{
  const li=document.createElement('li');li.className=i.ok?'ok':i.required?'missing':'optional';
  const head=document.createElement('div');head.className='setup-item';
  const mark=document.createElement('span');mark.className='setup-mark';mark.textContent=i.ok?'✓':i.required?'!':'○';
  const label=document.createElement('span');label.textContent=i.label+(i.required||i.ok?'':' (optional)');
  head.append(mark,label);li.append(head);
  if(!i.ok){const fix=document.createElement('p');fix.className='setup-fix';fix.textContent=i.fix;li.append(fix)}
  return li;
 }));
}
function initials(name){const w=String(name||'').trim().split(/\s+/).filter(Boolean);return ((w[0]||'K')[0]+(w[1]?w[1][0]:'')).toUpperCase()}
// Project cards: each app's picture sits in a soft colour frame, like the Figma dashboard.
const FRAMES=['#DFE9E0','#D8CEF3','#F0D3BE','#DCE5EE','#E9E4C9','#EADCE6'];
const ago=iso=>{const m=Math.round((Date.now()-new Date(iso))/60000);if(!(m>=0))return'';if(m<1)return'just now';if(m<60)return m+' minute'+(m===1?'':'s')+' ago';const h=Math.round(m/60);if(h<24)return h+' hour'+(h===1?'':'s')+' ago';const d=Math.round(h/24);return d===1?'yesterday':d<7?d+' days ago':new Date(iso).toLocaleDateString([],{month:'short',day:'numeric'})};
function renderProjects(projects){
 state.projects=projects;
 text($('project-count'),projects.length||'');
 const list=$('projects');list.replaceChildren();
 if(!projects.length){const li=document.createElement('li');li.className='muted';li.textContent='No projects yet. Describe one above, or start from a template.';list.append(li)}
 // Search and sort, as in the Figma dashboard ("Search projects…", "Last edited").
 const q=($('pj-search')?.value||'').trim().toLowerCase(),byName=$('pj-sort')?.value==='name';
 const shown=projects.filter(p=>!q||String(p.name).toLowerCase().includes(q)).sort((a,b)=>byName?String(a.name).localeCompare(String(b.name)):String(b.updated_at).localeCompare(String(a.updated_at)));
 if(projects.length&&!shown.length){const li=document.createElement('li');li.className='muted';li.textContent='No projects match "'+q+'".';list.append(li)}
 renderOnboard(projects);
 for(const [ci,p] of shown.entries()){
  const li=document.createElement('li'),thumb=el('div','thumb',initials(p.name)),open=document.createElement('button'),meta=document.createElement('span');
  thumb.setAttribute('aria-hidden','true');li.style.setProperty('--i',Math.min(ci,11));
  thumb.dataset.initials=initials(p.name);
  thumb.style.setProperty('--frame',FRAMES[[...String(p.id||p.name)].reduce((a,c)=>a+c.charCodeAt(0),0)%FRAMES.length]);
  // The app's own picture when there is one (project-thumbs.js); the initials stay underneath.
  if(p.thumb){const img=document.createElement('img');img.src=p.thumb;img.alt='';img.loading='lazy';img.decoding='async';img.className='thumb-img';img.onerror=()=>img.remove();thumb.append(img)}
  open.type='button';open.className='open';open.textContent=p.name;open.onclick=()=>openProject(p.id);
  // Card body like the Figma dashboard: name and a ··· menu, then Published or Draft and when it was edited.
  meta.className='meta';
  const st=el('span','pj-status'+(p.published?' live':''),p.published?'Published':'Draft');
  meta.append(st,el('span','pj-when','Edited '+ago(p.updated_at)));
  li.append(thumb,open,meta);li.onclick=e=>{if(e.target===li||e.target===thumb||e.target===meta)openProject(p.id)};
  if(p.role&&p.role!=='owner'){const b=document.createElement('span');b.className='role-badge';b.textContent='Shared · '+p.role;li.append(b)}
  if(p.role==='owner'){
   const menu=el('details','pj-menu'),sum=el('summary',null,'···');sum.setAttribute('aria-label','More for '+p.name);menu.append(sum);menu.onclick=e=>e.stopPropagation();
   const del=el('button','ghost link-btn','Delete');
   del.type='button';del.setAttribute('aria-label','Delete project '+p.name);
   del.onclick=async e=>{
    e.stopPropagation();
    if(!confirm('Permanently delete "'+p.name+'"? This removes the project and unpublishes its site. This cannot be undone.'))return;
    del.disabled=true;del.textContent='Deleting…';
    try{
     await api('/projects/'+encodeURIComponent(p.id),{method:'DELETE'});
     if(state.project?.id===p.id)state.project=null;
     await loadHome();
    }catch(err){del.disabled=false;del.textContent='Delete';alert('Could not delete project: '+err.message)}
   };
   menu.append(del);li.append(menu);
  }
  list.append(li);
 }
 renderRecents(projects);
}
function renderRecents(projects){
 const list=$('recents');list.replaceChildren();
 if(!projects.length){list.append(el('li','empty','Your projects will show up here.'));return}
 // Like Lovable: the five most recent, each with its first letter, then "See all projects".
 for(const p of projects.slice(0,5)){
  const li=document.createElement('li'),b=document.createElement('button');
  li.dataset.id=p.id;if(p.published)li.classList.add('live');if(state.project&&state.project.id===p.id)li.classList.add('active');
  b.type='button';b.append(el('i','r-tile',(String(p.name||'?').trim()[0]||'?').toUpperCase()),el('span',null,p.name));b.title=p.name;b.onclick=()=>openProject(p.id);
  li.append(b);
  if(p.role==='owner'){
   const del=el('button','recent-delete','×');del.type='button';del.title='Delete '+p.name;del.setAttribute('aria-label','Delete project '+p.name);
   del.onclick=async e=>{
    e.stopPropagation();
    if(!confirm('Permanently delete "'+p.name+'"? This removes the project and unpublishes its site. This cannot be undone.'))return;
    del.disabled=true;
    try{
     await api('/projects/'+encodeURIComponent(p.id),{method:'DELETE'});
     if(state.project?.id===p.id)state.project=null;
     await loadHome();
    }catch(err){del.disabled=false;alert('Could not delete project: '+err.message)}
   };
   li.append(del);
  }
  list.append(li);
 }
 if(projects.length>5){const li=el('li','see-all'),b=el('button',null,'See all projects');b.type='button';b.onclick=()=>$('side-projects').click();li.append(b);list.append(li)}
}
function markRecent(id){for(const li of $('recents').children)li.classList.toggle('active',li.dataset.id===id)}
function homeTab(which){
 state.homeTab=which;
 $('tab-projects').setAttribute('aria-selected',String(which==='projects'));$('tab-templates').setAttribute('aria-selected',String(which==='templates'));
 $('projects').classList.toggle('hidden',which!=='projects');$('home-templates').classList.toggle('hidden',which!=='templates');
 $('pj-search').closest('label').classList.toggle('hidden',which!=='projects');$('pj-sort').classList.toggle('hidden',which!=='projects');
 if(!$('home').classList.contains('hidden')){$('side-projects').toggleAttribute('aria-current',which==='projects');$('side-templates').toggleAttribute('aria-current',which==='templates')}
}
$('tab-projects').onclick=()=>homeTab('projects');$('tab-templates').onclick=()=>homeTab('templates');
$('new-template').onclick=()=>{homeTab('templates');$('browser').scrollIntoView({behavior:'smooth',block:'start'})};
$('side-new').onclick=async()=>{if($('home').classList.contains('hidden'))await loadHome();else homeTab('projects');$('home').scrollTo({top:0,behavior:'smooth'});$('new-prompt').focus()};
$('side-projects').onclick=async()=>{if($('home').classList.contains('hidden'))await loadHome();homeTab('projects');$('browser').scrollIntoView({behavior:'smooth',block:'start'})};
// ---------- Plugins and skills (a full page) ----------
// The account's skill library (built-in and its own). A skill switched on is used in every
// project (the same "all projects" setting as the Design dialog). Counts are real: nothing shown
// here is made up.
const plugins={list:[],tab:'All',q:''};
const PL_GROUPS=['Styles','Page types','Craft','Your skills'];
const plGroup=sk=>{if(sk.source!=='builtin')return'Your skills';const g=String(sk.group||'Styles').trim();return g[0].toUpperCase()+g.slice(1)};
const plInitials=n=>{const w=String(n||'?').replace(/[^A-Za-z0-9 ]+/g,' ').trim().split(/\s+/);return((w[0]||'?')[0]+((w[1]||w[0]||'')[w[1]?0:1]||'')).toUpperCase().replace(/^(.)(.)$/,(m,a,b)=>a+b.toLowerCase())};
function renderPlugins(){
 const owner=state.me?.viewer?.kind==='owner'||state.me?.viewer?.kind==='customer';
 const on=plugins.list.filter(s=>s.always).length;
 const pill=$('pl-count');pill.hidden=!plugins.list.length;text(pill,on+' turned on');
 const tabs=$('pl-tabs');tabs.replaceChildren();
 // Known groups first, then any other group a skill names (counts always add up to All).
 const groups=[...new Set([...PL_GROUPS,...plugins.list.map(plGroup)])];
 if(plugins.tab!=='All'&&!plugins.list.some(s=>plGroup(s)===plugins.tab))plugins.tab='All';
 for(const g of ['All',...groups]){
  const n=g==='All'?plugins.list.length:plugins.list.filter(s=>plGroup(s)===g).length;
  if(!n&&g!=='All')continue;
  const b=el('button',null,g==='All'?'All plugins':g);b.type='button';b.setAttribute('role','tab');b.setAttribute('aria-selected',String(plugins.tab===g));
  b.append(el('span','n',String(n)));b.onclick=()=>{plugins.tab=g;renderPlugins()};tabs.append(b);
 }
 const q=plugins.q.toLowerCase();
 const shown=plugins.list.filter(s=>(plugins.tab==='All'||plGroup(s)===plugins.tab)&&(!q||(s.name+' '+s.description).toLowerCase().includes(q)));
 const grid=$('pl-grid');grid.replaceChildren();
 for(const sk of shown){
  const li=el('li','tp-card'),top=el('div','tp-card-top'),g=plGroup(sk);
  const ic=el('span','tp-ic g'+Math.max(0,PL_GROUPS.indexOf(g)),plInitials(sk.name));ic.setAttribute('aria-hidden','true');
  const nm=el('span','tp-name',sk.name);nm.append(el('small',null,g+(sk.source==='github'?' · GitHub':'')));
  top.append(ic,nm);
  const foot=el('div','tp-card-foot');
  foot.append(el('span','small',sk.always?'On for all projects':'Off'));
  if(sk.url){const a=el('a',null,'Source');a.href=sk.url;a.target='_blank';a.rel='noopener';foot.append(a)}
  if(owner&&sk.source!=='builtin'){const del=el('button','link-btn','Remove');del.type='button';del.onclick=async()=>{if(!confirm('Remove the skill "'+sk.name+'"?'))return;text($('pl-error'),'');try{await api('/skills',{method:'DELETE',body:{id:sk.id}});await loadPlugins()}catch(err){text($('pl-error'),err.message)}};foot.append(del)}
  foot.append(el('span','tp-grow'));
  const sw=el('button','tp-sw');sw.type='button';sw.setAttribute('role','switch');sw.setAttribute('aria-checked',String(sk.always));sw.setAttribute('aria-label',sk.name+(sk.always?' is on':' is off'));sw.disabled=!owner;
  sw.onclick=async()=>{const next=!sk.always;sw.disabled=true;sw.setAttribute('aria-checked',String(next));text($('pl-error'),'');
   try{const r=await api('/skills/default',{method:'POST',body:{id:sk.id,on:next}});plugins.list=r.skills;renderPlugins()}catch(err){sw.setAttribute('aria-checked',String(sk.always));sw.disabled=false;text($('pl-error'),err.message)}};
  foot.append(sw);
  li.append(top,el('p','tp-desc',sk.description||''),foot);grid.append(li);
 }
 $('pl-empty').classList.toggle('hidden',shown.length>0||!plugins.list.length);
 $('pl-add-open').classList.toggle('hidden',!owner);
}
async function loadPlugins(){const r=await api('/skills');plugins.list=r.skills||[];renderPlugins()}
async function openPlugins(){
 show('plugins-screen');text($('pl-error'),'');
 if(!plugins.list.length)$('pl-grid').replaceChildren(el('li','tp-empty','Loading…'));
 try{await loadPlugins()}catch(err){$('pl-grid').replaceChildren();text($('pl-error'),err.message)}
}
$('side-plugins').onclick=openPlugins;
$('pl-search').oninput=e=>{plugins.q=e.target.value.trim();renderPlugins()};
const plAddClose=()=>{$('pl-add').classList.add('hidden');$('pl-add').reset();$('pl-choices').replaceChildren();text($('pl-status'),'')};
$('pl-add-open').onclick=()=>{const f=$('pl-add');f.classList.toggle('hidden');if(!f.classList.contains('hidden'))$('pl-url').focus()};
$('pl-add-cancel').onclick=plAddClose;
async function plAdd(path){
 const url=$('pl-url').value.trim(),body=url?{url,path}:{text:$('pl-text').value};
 if(!url&&!body.text.trim())return text($('pl-status'),'Paste a GitHub link or the skill text.');
 text($('pl-status'),'Adding…');text($('pl-error'),'');$('pl-choices').replaceChildren();
 try{
  const r=await api('/skills',{method:'POST',body});
  if(r.choices){text($('pl-status'),'This repository has '+r.choices.length+' skills. Pick one:');for(const c of r.choices){const b=el('button',null,c.name);b.type='button';b.onclick=()=>plAdd(c.path);$('pl-choices').append(b)}return}
  plAddClose();await loadPlugins();text($('pl-error'),'');
  text($('pl-status'),'');plugins.tab='Your skills';renderPlugins();
 }catch(err){text($('pl-status'),'');text($('pl-error'),err.message)}
}
$('pl-add').onsubmit=e=>{e.preventDefault();plAdd()};
// ---------- API checker (a full page) ----------
// One call through the server's guarded fetch (api-check.js). Header values are sent once and
// never saved; history keeps the address, method and outcome.
const apiUi={result:null,history:[],tab:'result',headers:[]};
const kb=n=>n<1024?n+' B':n<1048576?(n/1024).toFixed(1)+' KB':(n/1048576).toFixed(1)+' MB';
function acHeaderRows(){
 const box=$('ac-hrows');box.replaceChildren();
 apiUi.headers.forEach((h,i)=>{
  const row=el('div','ac-hrow'),k=document.createElement('input'),v=document.createElement('input'),x=el('button','link-btn','Remove');
  k.placeholder='Name, e.g. Authorization';k.value=h.k;k.oninput=()=>{h.k=k.value;acCount()};k.setAttribute('aria-label','Header name');
  v.placeholder='Value';v.value=h.v;v.oninput=()=>{h.v=v.value};v.setAttribute('aria-label','Header value');v.autocomplete='off';
  x.type='button';x.onclick=()=>{apiUi.headers.splice(i,1);acHeaderRows();acCount()};
  row.append(k,v,x);box.append(row);
 });
}
function acCount(){text($('ac-hcount'),apiUi.headers.filter(h=>h.k.trim()).length)}
function acPill(){
 const today=new Date().toDateString(),n=apiUi.history.filter(h=>new Date(h.at).toDateString()===today).length;
 const pill=$('ac-count');pill.hidden=!n;text(pill,n+' check'+(n===1?'':'s')+' today');
}
function renderApi(){
 const r=apiUi.result,tabs=$('ac-tabs');tabs.replaceChildren();
 const list=[['result','Result'],['raw','Raw response'],['headers','Headers'],['history','History ('+apiUi.history.length+')']];
 for(const [k,label] of list){if(!r&&k!=='history')continue;const b=el('button',null,label);b.type='button';b.setAttribute('role','tab');b.setAttribute('aria-selected',String(apiUi.tab===k));b.onclick=()=>{apiUi.tab=k;renderApi()};tabs.append(b)}
 if(!r&&apiUi.tab!=='history')apiUi.tab=apiUi.history.length?'history':'none';
 const view=$('ac-view');view.replaceChildren();
 if(apiUi.tab==='none'){view.append(el('p','tp-empty','Paste an API address above and press Try it.'));return}
 if(apiUi.tab==='history'){
  if(!apiUi.history.length){view.append(el('p','tp-empty','No checks yet.'));return}
  const ul=el('ul','ac-history');
  for(const h of apiUi.history){
   const li=el('li'),b=el('button');b.type='button';
   b.append(el('span','ac-code '+(h.ok?'ok':'bad'),String(h.status)),el('span','ac-m',h.method),el('span','ac-u',h.url),el('span','ac-t',when(h.at)));
   b.onclick=()=>{$('ac-method').value=h.method;$('ac-url').value=h.url;acBody();$('ac-url').focus()};
   li.append(b);ul.append(li);
  }
  view.append(ul);return;
 }
 if(apiUi.tab==='result'){
  const head=el('div','ac-status');
  head.append(el('span','ac-code big '+(r.ok?'ok':'bad'),r.status+(r.status_text?' '+r.status_text:'')),el('span','ac-meta',r.ms+' ms · '+kb(r.bytes)+(r.type?' · '+r.type:'')));
  const card=el('div','tp-card ac-plain');
  card.append(el('p','ac-label','In plain words'),el('p','ac-words',r.plain));
  const row=el('div','tp-row');
  if(r.ok){const use=el('button','primary','Use this in my app');use.type='button';use.onclick=async()=>{
   const names=r.fields.slice(0,8).map(f=>f.path).join(', ');
   await loadHome();homeTab('projects');
   $('new-prompt').value='Use this API in my app: '+r.method+' '+r.url+(names?'. It returns '+names+'.':'.')+' Show ';
   $('new-prompt').focus();$('home').scrollTo({top:0,behavior:'smooth'});
  };row.append(use)}
  card.append(row);
  view.append(head,card);
  if(r.fields.length){
   const t=el('div','tp-card ac-fields');t.append(el('p','ac-label','What you can use'));
   const tb=el('table');for(const f of r.fields){const tr=el('tr');tr.append(el('td','ac-path',f.path),el('td',null,f.value));tb.append(tr)}
   t.append(tb);view.append(t);
  }
  return;
 }
 if(apiUi.tab==='raw'){
  const box=el('div','tp-card ac-raw'),top=el('div','tp-row'),copy=el('button','link-btn','Copy');copy.type='button';
  copy.onclick=()=>navigator.clipboard&&navigator.clipboard.writeText(r.body).then(()=>text(copy,'Copied'));
  top.append(el('p','ac-label','Response'+(r.truncated?' (first 200 KB)':'')),el('span','tp-grow'),copy);
  box.append(top,el('pre',null,r.body||'(empty)'));view.append(box);return;
 }
 if(apiUi.tab==='headers'){
  const box=el('div','tp-card ac-fields');box.append(el('p','ac-label','Headers it sent back'));
  const tb=el('table');for(const [k,v] of Object.entries(r.headers)){const tr=el('tr');tr.append(el('td','ac-path',k),el('td',null,v));tb.append(tr)}
  box.append(tb);view.append(box);
 }
}
function acBody(){const m=$('ac-method').value;$('ac-body-wrap').classList.toggle('hidden',m==='GET'||m==='DELETE');if(m!=='GET'&&m!=='DELETE'){$('ac-extra').classList.remove('hidden');$('ac-headers-open').setAttribute('aria-expanded','true')}}
async function openApiCheck(){
 show('api-screen');text($('ac-error'),'');renderApi();
 try{const d=await api('/api-check');apiUi.history=d.history||[];acPill();renderApi()}catch(err){text($('ac-error'),err.message)}
}
$('side-api').onclick=openApiCheck;
$('ac-method').onchange=acBody;
$('ac-headers-open').onclick=()=>{const p=$('ac-extra'),open=p.classList.toggle('hidden');$('ac-headers-open').setAttribute('aria-expanded',String(!open));if(!apiUi.headers.length){apiUi.headers.push({k:'',v:''});acHeaderRows()}};
$('ac-hadd').onclick=()=>{apiUi.headers.push({k:'',v:''});acHeaderRows()};
$('ac-form').onsubmit=async e=>{
 e.preventDefault();const btn=$('ac-go');btn.disabled=true;text(btn,'Calling…');text($('ac-error'),'');
 try{
  const headers={};for(const h of apiUi.headers)if(h.k.trim())headers[h.k.trim()]=h.v;
  const {result}=await api('/api-check',{method:'POST',body:{url:$('ac-url').value.trim(),method:$('ac-method').value,headers,body:$('ac-body').value}});
  apiUi.result=result;apiUi.tab='result';
  const {body:_b,headers:_h,fields:_f,...brief}=result;apiUi.history=[brief,...apiUi.history].slice(0,20);acPill();renderApi();
 }catch(err){text($('ac-error'),err.message)}
 finally{btn.disabled=false;text(btn,'Try it')}
};
// ---------- Idea board (a full page) ----------
// Ideas for one project from project-ideas.js. Each card shows the facts it rests on; "Build this"
// opens the project and sends the idea as a normal build.
const ideasUi={projects:[],id:null,d:null,tab:'all'};
const IMPACT_LABEL={high:'High impact',medium:'Medium',low:'Small'};
function ideaPrice(){const t=(state.me?.tiers||[]).find(x=>x.id===(state.tier||'standard'))||(state.me?.tiers||[])[0];return state.me?.viewer?.kind==='customer'&&t?t.credits:0}
function renderIdeasPage(){
 const d=ideasUi.d,p=ideasUi.projects.find(x=>x.id===ideasUi.id);
 text($('id-crumb'),p?p.name:'Pick a project');
 const when=$('id-when');when.hidden=!(d&&d.at);if(d&&d.at)text(when,'Updated '+when_(d.at));
 const cost=state.me?.viewer?.kind==='customer'?state.me.discuss_credits:0;
 text($('id-refresh'),(d&&d.at?'Refresh ideas':'Get ideas')+(cost?' · '+cost+' credit'+(cost===1?'':'s'):''));
 $('id-refresh').disabled=!p||p.role==='viewer';
 const tabs=$('id-tabs'),list=$('id-list');tabs.replaceChildren();list.replaceChildren();
 if(!p){list.append(el('p','tp-empty',ideasUi.projects.length?'Pick a project.':'Make a project first, then come back for ideas.'));return}
 if(!d||!d.ideas.length){list.append(el('p','tp-empty',d&&d.at?'You have gone through every idea. Refresh for new ones.':'No ideas yet for this project. Press Get ideas.'));return}
 const groups=Object.keys(d.groups).filter(g=>d.ideas.some(x=>x.group===g));
 if(ideasUi.tab!=='all'&&!groups.includes(ideasUi.tab))ideasUi.tab='all';
 for(const g of ['all',...groups]){const n=g==='all'?d.ideas.length:d.ideas.filter(x=>x.group===g).length;const b=el('button',null,g==='all'?'All ideas':d.groups[g]);b.type='button';b.setAttribute('role','tab');b.setAttribute('aria-selected',String(ideasUi.tab===g));b.append(el('span','n',String(n)));b.onclick=()=>{ideasUi.tab=g;renderIdeasPage()};tabs.append(b)}
 const price=ideaPrice();
 for(const g of groups){
  if(ideasUi.tab!=='all'&&ideasUi.tab!==g)continue;
  const sec=el('section','id-group');sec.append(el('p','ac-label',d.groups[g]));
  const ul=el('ul','tp-grid');
  for(const x of d.ideas.filter(i=>i.group===g)){
   const li=el('li','tp-card id-card'),top=el('div','tp-card-top');
   top.append(el('span','tp-name',x.title),el('span','ld-fit'+(x.impact==='high'?' strong':''),IMPACT_LABEL[x.impact]||x.impact));
   const why=el('details','id-why'),sm=el('summary',null,x.why);const ul2=el('ul');for(const f of x.facts)ul2.append(el('li',null,f));why.append(sm,ul2);
   const foot=el('div','tp-card-foot ld-actions');
   foot.append(el('span','small','1 build'+(price?' · '+price+' credits':'')),el('span','tp-grow'));
   const no=el('button','link-btn','Not now');no.type='button';no.onclick=async()=>{no.disabled=true;try{ideasUi.d=await api('/projects/'+p.id+'/ideas',{method:'POST',body:{action:'dismiss',id:x.id}});renderIdeasPage()}catch(err){text($('id-error'),err.message);no.disabled=false}};
   const go=el('button','primary','Build this');go.type='button';go.disabled=p.role==='viewer';
   go.onclick=async()=>{go.disabled=true;try{await openProject(p.id);await send(x.title+': '+x.what,'build')}catch(err){text($('id-error'),err.message);go.disabled=false}};
   foot.append(no,go);
   li.append(top,el('p','tp-desc',x.what),why,foot);ul.append(li);
  }
  sec.append(ul);list.append(sec);
 }
}
const when_=iso=>{const d=new Date(iso),h=(Date.now()-d)/3600000;return h<1?'just now':h<24&&d.getDate()===new Date().getDate()?'today, '+d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):d.toLocaleDateString([],{month:'short',day:'numeric'})};
async function loadIdeas(){
 ideasUi.d=null;renderIdeasPage();if(!ideasUi.id)return;
 try{ideasUi.d=await api('/projects/'+ideasUi.id+'/ideas')}catch(err){text($('id-error'),err.message)}
 renderIdeasPage();
}
async function openIdeas(){
 show('ideas-screen');text($('id-error'),'');text($('id-status'),'');
 try{
  const {projects}=await api('/projects');ideasUi.projects=projects||[];
  const sel=$('id-project');sel.replaceChildren();for(const p of ideasUi.projects)sel.append(new Option(p.name,p.id));
  if(!ideasUi.projects.some(p=>p.id===ideasUi.id))ideasUi.id=(state.project&&ideasUi.projects.some(p=>p.id===state.project.id)?state.project.id:ideasUi.projects[0]?.id)||null;
  sel.value=ideasUi.id||'';await loadIdeas();
 }catch(err){text($('id-error'),err.message)}
}
$('side-ideas').onclick=openIdeas;
$('id-project').onchange=e=>{ideasUi.id=e.target.value;ideasUi.tab='all';text($('id-error'),'');loadIdeas()};
$('id-refresh').onclick=async()=>{
 const b=$('id-refresh');b.disabled=true;text($('id-error'),'');text($('id-status'),'Looking at the app and its facts…');
 try{ideasUi.d=await api('/projects/'+ideasUi.id+'/ideas',{method:'POST',body:{action:'refresh'}});ideasUi.tab='all';text($('id-status'),'');refreshCredits?.()}
 catch(err){text($('id-status'),'');text($('id-error'),err.message)}
 finally{renderIdeasPage()}
};
// ---------- Agent builder (a full page) ----------
// An app's agents are its automations (react-automations.js): shown with their real runs, and
// "Run now". A new agent is a normal build request, written from the form, so the builder adds
// the function and its trigger to the app.
const agentsUi={projects:[],id:null,list:[],data:null};
function agWhenOptions(){
 const sel=$('ag-when'),keep=sel.value;sel.replaceChildren();
 for(const c of agentsUi.data?.collections||[])sel.append(new Option('When a new '+c.name.replace(/_/g,' ')+' record is saved','on:'+c.name));
 for(const [v,l] of [['day','Every day'],['week-mon','Every Monday'],['hour','Every hour'],['hand','Only when I press Run']])sel.append(new Option(l,v));
 if([...sel.options].some(o=>o.value===keep))sel.value=keep;
 $('ag-at-wrap').classList.toggle('hidden',!/^(day|week)/.test(sel.value));
}
function agUses(){
 const box=$('ag-uses');box.replaceChildren();const d=agentsUi.data;if(!d)return;
 const chip=(label,on,note)=>{const c=el('span','ag-chip'+(on?' on':''),label);if(note)c.title=note;box.append(c)};
 chip('Its data'+(d.collections.length?': '+d.collections.map(c=>c.name.replace(/_/g,' ')).slice(0,4).join(', '):''),d.collections.length>0);
 chip(d.features.email?'Email':'Email (not set up yet)',d.features.email,d.features.email?'':'Emails wait in the app outbox until email is set up.');
 chip(d.features.payments.length?'Payments':'No payments',d.features.payments.length>0);
 chip('Kairoq AI',true,'Summaries, replies and sorting, inside the app.');
}
function agRequest(){
 const name=$('ag-name').value.trim(),what=$('ag-what').value.trim(),w=$('ag-when').value,at=$('ag-at').value||'09:00';
 const when=w.startsWith('on:')?'whenever a new record is saved in "'+w.slice(3)+'"':w==='day'?'every day at '+at:w==='week-mon'?'every Monday at '+at:w==='hour'?'every hour':'only when I press Run now (no schedule)';
 return 'Add an agent to this app called "'+name+'". What it does: '+what+'\nWhen it runs: '+when+'.'+($('ag-ask').checked?'\nIt must never send an email by itself: it saves each email as a draft I approve in the app first.':'')+'\nBuild it as a server function with an automation in src/backend.json, and show its runs to me.';
}
function renderAgents(){
 const p=agentsUi.projects.find(x=>x.id===agentsUi.id),ul=$('ag-list');ul.replaceChildren();
 text($('ag-crumb'),p?p.name:'Pick a project');
 const pill=$('ag-count');pill.hidden=!p;if(p)text(pill,agentsUi.list.length?agentsUi.list.length+' agent'+(agentsUi.list.length===1?'':'s'):'No agents yet');
 $('ag-new-open').disabled=!p||p.role==='viewer';
 if(!p){ul.append(el('li','tp-empty',agentsUi.projects.length?'Pick a project.':'Make a project first, then add agents to it.'));return}
 if(!agentsUi.list.length){ul.append(el('li','tp-empty','This app has no agents yet. Press New agent to describe one.'));return}
 for(const a of agentsUi.list){
  const li=el('li','tp-card'),top=el('div','tp-card-top');
  const ic=el('span','tp-ic',plInitials(a.name.replace(/[-_]/g,' ')));ic.setAttribute('aria-hidden','true');
  const nm=el('span','tp-name',cap(a.name.replace(/[-_]/g,' ')));nm.append(el('small',null,a.on?'When a '+a.collection.replace(/_/g,' ')+' record is '+a.on:a.every==='hour'?'Every hour':(a.every==='week'?'Every '+cap(a.day):'Every day')+' at '+a.at));
  top.append(ic,nm,el('span','ld-chip'+(a.ok===null?'':a.ok?' ok':' bad'),a.ok===null?'Not run yet':a.ok?'Working':'Failed'));
  li.append(top);
  li.append(el('p','tp-desc',a.last_run?'Last run '+when(a.last_run)+(a.last_result?': '+a.last_result:''):'It has not run yet.'+(a.next?' Next: '+when(a.next)+'.':'')));
  const foot=el('div','tp-card-foot ld-actions');
  foot.append(el('span','small',a.runs?a.runs+' run'+(a.runs===1?'':'s')+(a.failures?', '+a.failures+' failed':''):'No runs yet'),el('span','tp-grow'));
  const run=el('button','ghost tp-btn','Run now');run.type='button';run.disabled=p.role==='viewer';
  run.onclick=async()=>{run.disabled=true;text($('ag-error'),'');try{await api('/projects/'+p.id+'/automations',{method:'POST',body:{name:a.name}});await loadAgents()}catch(err){text($('ag-error'),err.message);run.disabled=false}};
  foot.append(run);li.append(foot);ul.append(li);
 }
}
async function loadAgents(){
 agentsUi.list=[];agentsUi.data=null;renderAgents();if(!agentsUi.id)return;
 try{const [a,d]=await Promise.all([api('/projects/'+agentsUi.id+'/automations'),api('/projects/'+agentsUi.id+'/data')]);agentsUi.list=a.automations||[];agentsUi.data=d}catch(err){text($('ag-error'),err.message)}
 agWhenOptions();agUses();renderAgents();
}
async function openAgents(){
 show('agents-screen');text($('ag-error'),'');
 try{
  const {projects}=await api('/projects');agentsUi.projects=projects||[];
  const sel=$('ag-project');sel.replaceChildren();for(const p of agentsUi.projects)sel.append(new Option(p.name,p.id));
  if(!agentsUi.projects.some(p=>p.id===agentsUi.id))agentsUi.id=(state.project&&agentsUi.projects.some(p=>p.id===state.project.id)?state.project.id:agentsUi.projects[0]?.id)||null;
  sel.value=agentsUi.id||'';await loadAgents();
 }catch(err){text($('ag-error'),err.message)}
}
$('side-agents').onclick=openAgents;
$('ag-project').onchange=e=>{agentsUi.id=e.target.value;text($('ag-error'),'');loadAgents()};
$('ag-new-open').onclick=()=>{const f=$('ag-form');f.classList.toggle('hidden');if(!f.classList.contains('hidden')){agWhenOptions();agUses();const t=(state.me?.tiers||[]).find(x=>x.id===(state.tier||'standard'));text($('ag-cost'),state.me?.viewer?.kind==='customer'&&t?'One build · '+t.credits+' credits':'One build');$('ag-name').focus()}};
$('ag-cancel').onclick=()=>$('ag-form').classList.add('hidden');
$('ag-when').onchange=()=>$('ag-at-wrap').classList.toggle('hidden',!/^(day|week)/.test($('ag-when').value));
$('ag-form').onsubmit=async e=>{
 e.preventDefault();const b=$('ag-create');b.disabled=true;text($('ag-error'),'');
 try{const ask=agRequest();await openProject(agentsUi.id);await send(ask,'build');$('ag-form').reset();$('ag-form').classList.add('hidden')}
 catch(err){text($('ag-error'),err.message)}finally{b.disabled=false}
};
$('pj-search').oninput=()=>state.projects&&renderProjects(state.projects);
$('pj-sort').onchange=()=>state.projects&&renderProjects(state.projects);
// ---------- The editor laid out like the Figma "App builder" frame ----------
// Row 1 (dark): project name on the left, More, Share and Publish on the right.
// Row 2 (light): "Chat with Kairoq" over the chat; Preview · Code · Data and the preview's own
// tools over the stage. The preview sits in a browser window with its address, and
// "Live preview · v7" under it. Built once from the existing controls, so every handler stays.
function formaRows(){
 const stage=document.querySelector('#editor .stage'),bar=stage?.querySelector('.stage-bar');
 if(!bar||stage.querySelector('.fm-sub'))return refreshWindow();
 const sub=el('div','fm-sub');
 const tabs=bar.querySelector('.tabs-seg'),tools=$('preview-bar-tools'),vis=$('visual-toggle'),tests=$('kq-tests-tab');
 if(tabs)sub.append(tabs);if(tests&&tabs&&!tabs.contains(tests))tabs.append(tests);
 sub.append(el('span','fm-grow'));if(vis)sub.append(vis);if(tools)sub.append(tools);
 bar.after(sub);
 sub.addEventListener('click',e=>{if(detailState.source!==null&&e.target.closest('button,a'))closeDetail()});
 const chat=document.querySelector('#editor .chat'),head=chat?.querySelector('.chat-head');
 if(head&&!chat.querySelector('.fm-chat-sub')){const c=el('div','fm-chat-sub');c.append(el('b',null,'Chat with Kairoq'));head.after(c)}
 const dev=$('device');
 if(dev&&!dev.querySelector('.fm-win')){
  const win=el('div','fm-win'),re=el('button','fm-win-btn'),addr=el('span','fm-addr'),op=el('button','fm-win-btn');
  re.type='button';re.setAttribute('aria-label','Reload the preview');re.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/></svg>';re.onclick=()=>$('refresh').click();
  op.type='button';op.setAttribute('aria-label','Open in a new tab');op.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';op.onclick=()=>{const h=$('open').href;if(h)window.open(h,'_blank','noopener')};
  addr.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg><span id="fm-addr-text"></span>';
  win.append(re,addr,op);dev.prepend(win);
  const foot=el('div','fm-foot');foot.append(el('span','fm-live'),el('span',null,''),el('span','fm-grow'),el('span','fm-size',''));foot.querySelector('span:nth-child(2)').id='fm-version';foot.querySelector('.fm-size').id='fm-size';dev.append(foot);
 }
 previewFloat();
 refreshWindow();
}
// Like Emergent: a small floating bar on the preview with Edit, Desktop / Phone and Full screen.
// The buttons are the editor's own (moved here), so they work exactly as before.
function previewFloat(){
 const canvas=$('canvas');if(!canvas||document.querySelector('#editor .pv-float'))return;
 const bar=el('div','pv-float');bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','Preview tools');
 const vis=$('visual-toggle');if(vis){if(!vis.querySelector('.pv-lbl'))vis.append(el('span','pv-lbl','Edit'));bar.append(vis)}
 const seg=$('preview-bar-tools')?.querySelector('.seg.icons');
 // Found now, while they are still in the page (the bar is not attached yet).
 const extras=['device-model','safari-shot'].map(id=>$(id)).filter(Boolean);
 // Laptop, phone and tablet, like before: the phone has its own model menu (iPhone 16, Pro Max,
 // SE, Pixel) and "Real Safari" next to it; both move here from the top toolbar.
 if(seg){
  if(!$('tablet')){const t=el('button');t.type='button';t.id='tablet';t.title='Tablet (iPad mini)';t.setAttribute('aria-label','Tablet');t.setAttribute('aria-pressed','false');
   t.innerHTML='<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="2.5" width="15" height="19" rx="2.2"/><path d="M11 18.5h2"/></svg>';
   t.onclick=()=>{state.deviceModel='ipad';try{localStorage.setItem('kq-device','ipad')}catch{}device(true)};seg.append(t)}
  $('desktop').title='Laptop';$('desktop').setAttribute('aria-label','Laptop');
  bar.append(seg);
  for(const x of extras)bar.append(x);
 }
 const full=el('button','pv-btn');full.type='button';full.title='Full screen';full.setAttribute('aria-label','Full screen');full.setAttribute('aria-pressed','false');
 full.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
 const stage=document.querySelector('#editor .stage');
 const setFull=on=>{stage?.classList.toggle('pv-full',on);full.setAttribute('aria-pressed',String(on));full.title=on?'Exit full screen':'Full screen'};
 full.onclick=()=>setFull(!stage?.classList.contains('pv-full'));
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&stage?.classList.contains('pv-full'))setFull(false)});
 const fold=el('button','pv-btn pv-fold');fold.type='button';fold.title='Hide the tools';fold.setAttribute('aria-label','Hide the preview tools');
 fold.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
 fold.onclick=()=>{const min=bar.classList.toggle('min');fitDevice();fold.title=min?'Show the tools':'Hide the tools';fold.setAttribute('aria-label',min?'Show the preview tools':'Hide the preview tools')};
 // Open on your phone: a QR code for this preview (GET /previewqr), like Emergent and Lovable.
 const qr=el('button','pv-btn pv-qr');qr.type='button';qr.title='Open on your phone';qr.setAttribute('aria-label','Open this preview on your phone');qr.setAttribute('aria-expanded','false');
 qr.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 14h2M14 18v2M17 17h3v3"/></svg>';
 const pop=el('div','pv-qr-pop hidden');pop.setAttribute('role','dialog');pop.setAttribute('aria-label','Open on your phone');
 const img=el('img','pv-qr-img');img.alt='QR code that opens this preview on your phone';img.width=168;img.height=168;
 const link=el('p','pv-qr-link'),copy=el('button','pv-qr-copy','Copy link');copy.type='button';
 pop.append(el('p','pv-qr-title','Open on your phone'),img,el('p','pv-qr-hint',"Point your phone's camera at the code."),link,copy);
 const close=()=>{pop.classList.add('hidden');qr.setAttribute('aria-expanded','false')};
 qr.onclick=e=>{e.stopPropagation();if(!pop.classList.contains('hidden'))return close();const p=state.project;if(!p||!p.preview_url)return;
  const url=location.origin+p.preview_url;img.src='/api/create/projects/'+p.id+'/previewqr?v='+(p.current_version||0);text(link,url.replace(/^https?:\/\//,''));
  copy.onclick=()=>{navigator.clipboard?.writeText(url).then(()=>{text(copy,'Copied');setTimeout(()=>text(copy,'Copy link'),1500)}).catch(()=>{})};
  pop.classList.remove('hidden');qr.setAttribute('aria-expanded','true')};
 pop.onclick=e=>e.stopPropagation();document.addEventListener('click',close);document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
 bar.append(qr,full,fold,pop);
 // Like Lovable: on a computer the tools sit in the bar above the preview (next to the version),
 // so nothing floats over the app; on a phone they float at the bottom of the preview as before.
 const narrow=window.matchMedia('(max-width:900px)');
 const place=()=>{const sub=document.querySelector('#editor .fm-sub'),tools=$('preview-bar-tools');
  // The phone model menu and "Real Safari" only matter in phone view: docked, they sit at the
  // top left of the preview instead of making the bar too long.
  if(!narrow.matches&&sub){bar.classList.add('docked');bar.classList.remove('min');sub.insertBefore(bar,tools&&tools.parentElement===sub?tools:null);fold.style.setProperty('display','none','important');
   let box=canvas.querySelector('.pv-devbox');if(!box){box=el('div','pv-devbox');canvas.append(box)}box.append(...extras)}
  else{bar.classList.remove('docked');canvas.append(bar);fold.style.removeProperty('display');for(const x of extras)bar.insertBefore(x,qr)}
  fitDevice()};
 place();narrow.addEventListener?.('change',place);
}
function refreshWindow(){
 const p=state.project;if(!p||!$('fm-addr-text'))return;
 // The real address of what is on screen: the live site once published, otherwise this preview.
 // Like Lovable's page picker: the live site's address once published, otherwise just the page ("/"),
 // not the long internal preview link (that one opens with the button on the right).
 const live=p.published&&p.urls&&p.urls[0],url=live?String(p.urls[0]):'/';
 text($('fm-addr-text'),String(url).replace(/^https?:\/\//,''));
 text($('fm-version'),'Live preview · v'+(p.current_version||1));
 const d=$('device');text($('fm-size'),d&&d.classList.contains('mobile')?'Phone':'Desktop · Fit to view');
}
// ---------- Connectors (a full page, like the Figma "Connectors" frame) ----------
// The services one app uses (the same list as the editor's Connectors), each with its real
// status from the project's settings. Connect opens the project and the right setting.
const cnUi={projects:[],id:null,settings:null,tab:'All',q:''};
const CN_GROUP={github:'Code',stripe:'Payments',email:'Communication',secrets:'Keys',figma:'Design',apps:'More apps',partners:'More apps',whatsapp:'Communication',domain:'Publishing',mcp:'Keys'};
const CN_HOW={github:'Access token',stripe:'API key',email:'Set up on the server',secrets:'API keys',figma:'Frame link',apps:'744 services',partners:'Partner offers',whatsapp:'Phone number',domain:'DNS records',mcp:'Personal key'};
function cnStatus(c,s=cnUi.settings){
 const sec=s?.secrets||{};
 if(c.id==='github')return sec.github_token?.set?'on':'off';
 if(c.id==='stripe')return sec.stripe_secret_key?.set?'on':'off';
 if(c.id==='email')return s?.email?'on':'admin';
 if(c.id==='secrets'){const n=Object.keys(sec).filter(k=>!['github_token','stripe_secret_key','stripe_webhook_secret'].includes(k)).length;return n?'n:'+n:'off'}
 if(c.id==='whatsapp')return state.me?.whatsapp?'off':'admin';
 return 'open';
}
// Real logos for the brands (paths from Simple Icons, CC0) and plain line icons for the rest,
// instead of a letter in a coloured square.
const CN_BRAND={
 github:{c:'#181717',d:'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12'},
 stripe:{c:'#635BFF',d:'M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z'},
 figma:{c:'#F24E1E',d:'M15.852 8.981h-4.588V0h4.588c2.476 0 4.49 2.014 4.49 4.49s-2.014 4.491-4.49 4.491zM12.735 7.51h3.117c1.665 0 3.019-1.355 3.019-3.019s-1.355-3.019-3.019-3.019h-3.117V7.51zm0 1.471H8.148c-2.476 0-4.49-2.014-4.49-4.49S5.672 0 8.148 0h4.588v8.981zm-4.587-7.51c-1.665 0-3.019 1.355-3.019 3.019s1.354 3.02 3.019 3.02h3.117V1.471H8.148zm4.587 15.019H8.148c-2.476 0-4.49-2.014-4.49-4.49s2.014-4.49 4.49-4.49h4.588v8.98zM8.148 8.981c-1.665 0-3.019 1.355-3.019 3.019s1.355 3.019 3.019 3.019h3.117V8.981H8.148zM8.172 24c-2.489 0-4.515-2.014-4.515-4.49s2.014-4.49 4.49-4.49h4.588v4.441c0 2.503-2.047 4.539-4.563 4.539zm-.024-7.51a3.023 3.023 0 0 0-3.019 3.019c0 1.665 1.365 3.019 3.044 3.019 1.705 0 3.093-1.376 3.093-3.068v-2.97H8.148zm7.704 0h-.098c-2.476 0-4.49-2.014-4.49-4.49s2.014-4.49 4.49-4.49h.098c2.476 0 4.49 2.014 4.49 4.49s-2.014 4.49-4.49 4.49zm-.097-7.509c-1.665 0-3.019 1.355-3.019 3.019s1.355 3.019 3.019 3.019h.098c1.665 0 3.019-1.355 3.019-3.019s-1.355-3.019-3.019-3.019h-.098z'},
 whatsapp:{c:'#25D366',d:'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z'}};
const CN_LINE={email:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',secrets:'<circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 8.2-8.2M16 7l2 2M14 9l2 2"/>',apps:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M17.5 14v7M14 17.5h7"/>',partners:'<path d="M9 7V3M15 7V3M6 7h12v4a6 6 0 0 1-12 0z"/><path d="M12 17v4"/>',domain:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',mcp:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M13 15h4"/>'};
function cnLogo(c){
 const ic=el('span','tp-ic cn-ic');ic.dataset.id=c.id;ic.setAttribute('aria-hidden','true');
 const b=CN_BRAND[c.id];
 if(b){ic.classList.add('brand');ic.innerHTML='<svg viewBox="0 0 24 24"><path fill="'+b.c+'" d="'+b.d+'"/></svg>'}
 else if(CN_LINE[c.id]){ic.classList.add('line');ic.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+CN_LINE[c.id]+'</svg>'}
 else ic.textContent=c.name.slice(0,1);
 return ic;
}
function renderConnectors(){
 const p=cnUi.projects.find(x=>x.id===cnUi.id),grid=$('cn-grid');grid.replaceChildren();
 text($('cn-crumb'),p?p.name:'Pick a project');
 const list=CONNECTORS.filter(c=>!c.owner||p?.role==='owner');
 const on=list.filter(c=>{const st=cnStatus(c);return st==='on'||st.startsWith('n:')}).length;
 const pill=$('cn-count');pill.hidden=!p||!cnUi.settings;text(pill,on+' connected');
 const groups=[...new Set(list.map(c=>CN_GROUP[c.id]||'More apps'))];
 if(cnUi.tab!=='All'&&!groups.includes(cnUi.tab))cnUi.tab='All';
 const tabs=$('cn-tabs');tabs.replaceChildren();
 for(const g of ['All',...groups]){const b=el('button',null,g==='All'?'All services':g);b.type='button';b.setAttribute('role','tab');b.setAttribute('aria-selected',String(cnUi.tab===g));b.onclick=()=>{cnUi.tab=g;renderConnectors()};tabs.append(b)}
 if(!p){grid.append(el('li','tp-empty',cnUi.projects.length?'Pick a project.':'Make a project first, then connect services to it.'));return}
 const q=cnUi.q.toLowerCase();
 for(const c of list.filter(c=>(cnUi.tab==='All'||(CN_GROUP[c.id]||'More apps')===cnUi.tab)&&(!q||(c.name+' '+c.desc).toLowerCase().includes(q)))){
  const li=el('li','tp-card cn-card'),top=el('div','tp-card-top'),st=cnStatus(c);
  const ic=cnLogo(c);
  const nm=el('span','tp-name',c.name);nm.append(el('small',null,CN_GROUP[c.id]||'More apps'));
  top.append(ic,nm);
  // "Set up by your admin" already says how; don't repeat it with the method on the left.
  const foot=el('div','tp-card-foot');foot.append(el('span','small',st==='admin'?'':CN_HOW[c.id]||''),el('span','tp-grow'));
  if(st==='on')foot.append(el('span','cn-on','✓ Connected'));
  else if(st.startsWith('n:'))foot.append(el('span','cn-on','✓ '+st.slice(2)+' added'));
  else if(st==='admin')foot.append(el('span','cn-wait','Set up by your admin'));
  const go=el('button',st==='on'||st.startsWith('n:')?'link-btn':'ghost tp-btn',st==='on'||st.startsWith('n:')?'Manage':st==='open'?'Open':'Connect');go.type='button';go.disabled=p.role==='viewer';
  if(st!=='admin')foot.append(go);
  go.onclick=async()=>{go.disabled=true;try{await openProject(p.id);c.open()}catch(err){text($('cn-error'),err.message)}finally{go.disabled=false}};
  li.append(top,el('p','tp-desc',c.desc),foot);grid.append(li);
 }
 const more=el('li','tp-card cn-more'),mi=el('span','tp-ic','+');mi.setAttribute('aria-hidden','true');
 const t=el('div');t.append(el('b',null,'Your stack, your way.'),el('p',null,'Missing a service? Pick from 744 apps and say what should happen.'));
 const ask=el('button','link-btn','Browse 744 apps ↗');ask.type='button';ask.onclick=async()=>{await openProject(p.id);openApps()};t.append(ask);
 more.append(mi,t);grid.append(more);
}
async function loadConnectors(){
 cnUi.settings=null;renderConnectors();if(!cnUi.id)return;
 try{cnUi.settings=(await api('/projects/'+cnUi.id+'/settings')).settings}catch(err){text($('cn-error'),err.message)}
 renderConnectors();
}
async function openConnectors(){
 show('connectors-screen');text($('cn-error'),'');
 try{
  const {projects}=await api('/projects');cnUi.projects=projects||[];
  const sel=$('cn-project');sel.replaceChildren();for(const p of cnUi.projects)sel.append(new Option(p.name,p.id));
  if(!cnUi.projects.some(p=>p.id===cnUi.id))cnUi.id=(state.project&&cnUi.projects.some(p=>p.id===state.project.id)?state.project.id:cnUi.projects[0]?.id)||null;
  sel.value=cnUi.id||'';await loadConnectors();
 }catch(err){text($('cn-error'),err.message)}
}
$('side-connectors').onclick=openConnectors;
$('cn-project').onchange=e=>{cnUi.id=e.target.value;text($('cn-error'),'');loadConnectors()};
$('cn-search').oninput=e=>{cnUi.q=e.target.value.trim();renderConnectors()};
// ---------- Templates, Pricing, Settings & usage (Figma "Template gallery", "Pricing", "Workspace settings") ----------
// Full pages built only from real data: the template list, the plans and packs Ka set in Railway,
// and the account's credit ledger. Nothing here invents counts, invoices or usage.
const tgUi={cat:'All',q:''};
async function openTemplates(){
 show('templates-screen');text($('tg-error'),'');
 try{if(!state.templates){const r=await api('/templates');state.templates=r.templates||[];state.sponsored=r.sponsored||[]}renderTemplatePage()}
 catch(err){text($('tg-error'),err.message)}
}
function renderTemplatePage(){
 const all=state.templates||[],cats=[...new Set(all.map(t=>t.category).filter(Boolean))];
 if(tgUi.cat!=='All'&&!cats.includes(tgUi.cat))tgUi.cat='All';
 const tabs=$('tg-tabs');tabs.replaceChildren();
 for(const c of ['All',...cats]){const b=el('button',null,c==='All'?'All templates':c);b.type='button';b.setAttribute('role','tab');b.setAttribute('aria-selected',String(tgUi.cat===c));b.onclick=()=>{tgUi.cat=c;renderTemplatePage()};tabs.append(b)}
 const q=tgUi.q.toLowerCase();
 const list=all.filter(t=>(tgUi.cat==='All'||t.category===tgUi.cat)&&(!q||(t.name+' '+t.description+' '+t.category).toLowerCase().includes(q)));
 text($('tg-count'),list.length+' template'+(list.length===1?'':'s')+' to make your own');
 const grid=$('tg-grid');grid.replaceChildren();
 for(const t of list)grid.append(templateCard(t,id=>{show('home');startFromTemplate(id)}));
 if(!list.length)grid.append(el('p','tp-empty','No templates match that. Try another word, or describe your app on Home.'));
}
$('side-templates').onclick=openTemplates;
$('tg-search').oninput=e=>{tgUi.q=e.target.value.trim();renderTemplatePage()};

function openPricing(){
 show('pricing-screen');text($('pr-error'),'');
 const me=state.me||{},account=me.viewer?.account||null,current=account?.plan||null;
 const grid=$('pr-grid');grid.replaceChildren();
 const card=(name,price,per,lines,btn,dark)=>{
  const c=el('div','pr-card'+(dark?' dark':''));
  const top=el('div','pr-card-top');top.append(el('h3',null,name));if(dark&&account)top.append(el('span','pr-badge','Your plan'));c.append(top);
  const p=el('div','pr-price');p.append(el('b',null,price));if(per)p.append(el('span',null,per));c.append(p);
  if(btn)c.append(btn);
  const ul=el('ul');for(const l of lines)ul.append(el('li',null,l));c.append(ul);return c;
 };
 const freeBtn=el('button','pr-btn',account?(current?'Included':'Your plan'):'Start for free');freeBtn.type='button';freeBtn.disabled=Boolean(account);
 grid.append(card('Free',(me.free_credits||0)+' credits','to start',['Every feature included','Publish to a Kairoq address','No card needed'],freeBtn,Boolean(account)&&!current));
 for(const p of me.plans||[]){
  const mine=current===p.id,b=el('button','pr-btn'+(mine?'':' primary'),mine?'Current plan':'Choose '+p.name);b.type='button';b.disabled=mine||!me.subscriptions;
  b.onclick=async()=>{b.disabled=true;try{const {url}=await api('/subscribe',{method:'POST',body:{plan:p.id}});location.href=url}catch(err){text($('pr-error'),err.message);b.disabled=false}};
  const m=/^(\S+)\s*(.*)$/.exec(p.label||'');
  grid.append(card(p.name,m?m[1]:p.credits+' credits',m?m[2]:'a month',[p.credits+' credits every month',...(p.features||[])],b,mine));
 }
 const packs=me.purchases?(me.packs||[]):[];
 $('pr-packs-wrap').classList.toggle('hidden',!packs.length);
 const pl=$('pr-packs');pl.replaceChildren();
 for(const p of packs){
  const b=el('button','pr-pack');b.type='button';b.append(el('b',null,p.credits+' credits'),el('span',null,p.name),el('em',null,p.label||'Buy'));
  b.onclick=async()=>{b.disabled=true;try{const {url}=await api('/checkout',{method:'POST',body:{pack:p.id}});location.href=url}catch(err){text($('pr-error'),err.message);b.disabled=false}};
  pl.append(b);
 }
 const per=(me.tiers||[]).filter(t=>t.enabled!==false).map(t=>t.credits+' credit'+(t.credits===1?'':'s')+' ('+t.label+')').join(', ');
 const faq=[
  ['What is a credit?','One credit pays for one change to your app. A message costs '+(per||'a few credits')+(me.discuss_credits?'; a question without changes costs '+me.discuss_credits+'.':'.')+' Visual edits are free.'],
  ['What if a change fails?','If a change does not work, or nothing is saved, the credits go back to you. If a change breaks your app, the next fix of that problem is free.'],
  ['Can I change plans later?',me.subscriptions?'Yes. Pick another plan here, or open Manage billing from Settings & usage to change or cancel.':'Paid plans are not open yet. Free credits and top-ups work today.']
 ];
 const f=$('pr-faq');f.replaceChildren();
 for(const [q,a] of faq){const d=el('div','pr-q');d.append(el('h3',null,q),el('p',null,a));f.append(d)}
}
$('plans-open').onclick=openPricing;
$('pr-settings').onclick=e=>{e.preventDefault();openSettings()};

const stUi={tab:'overview'};
async function openSettings(){
 show('settings-screen');text($('st-error'),'');stTab(stUi.tab);
 const me=state.me||{},v=me.viewer;
 let credits={history:[]},projects=[];
 try{[credits,{projects}]=await Promise.all([api('/credits'),api('/projects')])}catch(err){text($('st-error'),err.message)}
 const account=credits.account||v?.account||null,owner=v?.kind==='owner';
 const email=owner?'Owner account':account?.email||'';
 text($('st-email'),email);text($('st-avatar'),(email||'K')[0].toUpperCase());
 text($('st-since'),account?.created_at?'Joined '+new Date(account.created_at).toLocaleDateString([], {dateStyle:'medium'}):'');
 text($('st-role'),owner?'You run this Kairoq':'');
 const facts=$('st-facts');facts.replaceChildren();
 const fact=(k,val)=>{facts.append(el('dt',null,k),el('dd',null,val))};
 if(account)fact('Email',account.email_verified?'Verified':'Not verified yet');
 fact('Projects',String(projects.length));
 fact('Published',String(projects.filter(p=>p.published).length));
 // Plan card
 const plan=(me.plans||[]).find(p=>p.id===account?.plan);
 text($('st-plan-name'),owner?'Owner':plan?plan.name:'Free');
 text($('st-plan-price'),owner?'':plan?(plan.label||''):'');
 text($('st-plan-status'),owner?'Unlimited':account?.plan?cap(account.plan_status||'active'):'Active');
 text($('st-plan-lines'),owner?'Building costs you no credits.':plan?[plan.credits+' credits every month',...(plan.features||[])].join(' · '):'Every feature included · Pay as you go with credits');
 text($('st-plan-renew'),account?.plan_renews_at?'Renews '+new Date(account.plan_renews_at).toLocaleDateString([], {dateStyle:'medium'}):'');
 $('st-change').classList.toggle('hidden',owner||!(me.plans||[]).length);
 text($('st-change'),account?.plan?'Change plan':'See plans');
 $('st-billing').classList.toggle('hidden',!account?.billing);
 // Usage: from the ledger only.
 const hist=credits.history||[],since=Date.now()-30*864e5,recent=hist.filter(h=>Date.parse(h.at)>=since);
 const spent=recent.filter(h=>h.delta<0).reduce((n,h)=>n-h.delta,0);
 const back=recent.filter(h=>h.delta>0&&/^(Refund|Free:)/.test(h.reason)).reduce((n,h)=>n+h.delta,0);
 text($('st-window'),'Last 30 days');
 const u=$('st-usage');u.replaceChildren();
 const tile=(label,big,small,note,pct)=>{const t=el('div','st-card st-tile');t.append(el('span','st-tile-label',label));const b=el('div','st-big');b.append(el('b',null,big));if(small)b.append(el('span',null,small));t.append(b);if(pct!=null){const m=el('div','st-meter');const i=el('i');i.style.width=Math.max(0,Math.min(100,pct))+'%';m.append(i);t.append(m)}t.append(el('span','st-note',note));u.append(t)};
 if(owner)tile('Credits','Unlimited','','You run this Kairoq',null);
 else{const left=account?.credits??0,cap2=plan?plan.credits:null;tile('Credits left',String(left),cap2?'/ '+cap2:'',cap2?Math.max(0,cap2-left)+' used of this month’s '+cap2:'Top up any time',cap2?left/cap2*100:null)}
 tile('Credits used',String(spent),'',back?back+' came back as refunds or free changes':'Nothing refunded',null);
 tile('Projects',String(projects.length),'',projects.filter(p=>p.published).length+' published',null);
 // Where they went: group spending by what it was for.
 const groups=new Map();for(const h of recent)if(h.delta<0){const k=String(h.reason||'Other').replace(/\s*\(.*\)$/,'').split(':')[0].trim()||'Other';groups.set(k,(groups.get(k)||0)-h.delta)}
 const sorted=[...groups.entries()].sort((a,b)=>b[1]-a[1]),top=sorted.slice(0,3),rest=sorted.slice(3).reduce((n,x)=>n+x[1],0);if(rest)top.push(['Other',rest]);
 const bar=$('st-bar'),leg=$('st-legend');bar.replaceChildren();leg.replaceChildren();
 top.forEach(([k,n],i)=>{const s=el('i','s'+i);s.style.flexGrow=n;s.title=k+': '+n;bar.append(s);const li=el('li','s'+i);li.append(el('b',null,k),document.createTextNode(' '+n));leg.append(li)});
 if(!top.length)leg.append(el('li','st-none','No credits spent in the last 30 days.'));
 const packs=me.purchases?(me.packs||[]):[];
 $('st-more').classList.toggle('hidden',!packs.length||owner);
 if(packs.length)text($('st-more-text'),packs.map(p=>p.credits+' credits'+(p.label?' for '+p.label:'')).join(' · ')+'. They never expire.');
 // History table
 const rows=$('st-rows');rows.replaceChildren();
 for(const h of hist){const tr=el('tr');tr.append(el('td',null,h.reason||''),el('td',null,new Date(h.at).toLocaleDateString([], {dateStyle:'medium'})),el('td','st-num '+(h.delta<0?'neg':'pos'),(h.delta>0?'+':'')+h.delta));rows.append(tr)}
 text($('st-history-note'),owner?'The owner account does not use credits.':hist.length?'Your latest '+hist.length+' credit moves.':'No credit moves yet.');
}
function stTab(t){stUi.tab=t;$('st-tab-overview').setAttribute('aria-selected',String(t==='overview'));$('st-tab-history').setAttribute('aria-selected',String(t==='history'));$('st-overview').classList.toggle('hidden',t!=='overview');$('st-history').classList.toggle('hidden',t!=='history')}
$('st-tab-overview').onclick=()=>stTab('overview');
$('st-tab-history').onclick=()=>stTab('history');
$('side-settings').onclick=openSettings;
$('st-change').onclick=openPricing;
$('st-plans-link').onclick=e=>{e.preventDefault();openPricing()};
$('st-more-btn').onclick=openPricing;
$('st-billing').onclick=async()=>{try{const {url}=await api('/billing',{method:'POST'});location.href=url}catch(err){text($('st-error'),err.message)}};
// ---------- First project (Figma "First project onboarding") ----------
// A new account with no projects sees this on Home instead of the prompt box. It starts the
// same flow as the prompt (questions, plan, build); the name and "what for" go with it.
const OB_IDEAS=[['A business dashboard','A dashboard for my business with sales, customers and this week\'s numbers'],['A booking app','A booking app where customers pick a time, pay a deposit and get a confirmation email'],['An AI writing tool','An AI writing tool that turns my notes into polished posts in my brand voice']];
function onboardFor(){return $('ob-for').querySelector('[aria-checked=true]')?.dataset.for||'my business'}
function renderOnboard(projects){
 const skip=(()=>{try{return localStorage.getItem('kairoq-onboard-skip')==='1'}catch{return false}})();
 const on=Boolean(state.me?.viewer)&&!projects.length&&!skip;
 $('onboard').classList.toggle('hidden',!on);
 document.querySelector('#home .home-hero')?.classList.toggle('hidden',on);
 $('browser').classList.toggle('ob-hide',on);
 if(!on)return;
 const ideas=$('ob-ideas');if(!ideas.childElementCount)for(const [label,text_] of OB_IDEAS){const b=el('button','ob-idea',label);b.type='button';b.onclick=()=>{$('ob-what').value=text_;$('ob-what').dispatchEvent(new Event('input'));if(!$('ob-name').value)$('ob-name').value=label.replace(/^An? /,'').replace(/^./,c=>c.toUpperCase())};ideas.append(b)}
 const t=(state.me?.tiers||[]).find(x=>x.id==='standard')||(state.me?.tiers||[])[0];
 text($('ob-cost'),state.me?.viewer?.kind==='customer'&&t?'First build: '+t.credits+' credits'+(state.me.free_credits?' of your '+state.me.free_credits+' free':''):'');
}
$('ob-for').onclick=e=>{const b=e.target.closest('[data-for]');if(!b)return;for(const x of $('ob-for').children)x.setAttribute('aria-checked',String(x===b))};
$('ob-what').oninput=()=>text($('ob-count'),$('ob-what').value.length.toLocaleString()+' / 5,000');
$('ob-templates').onclick=()=>{$('browser').classList.remove('ob-hide');homeTab('templates');$('browser').scrollIntoView({behavior:'smooth'})};
$('ob-skip').onclick=()=>{try{localStorage.setItem('kairoq-onboard-skip','1')}catch{}renderOnboard(state.projects||[])};
$('ob-form').onsubmit=async e=>{
 e.preventDefault();text($('ob-error'),'');
 const what=$('ob-what').value.trim();if(!what){$('ob-what').focus();return}
 const go=$('ob-go');go.disabled=true;
 try{await askThenBuild(what+'\n\nIt is for '+onboardFor()+'.',$('ob-name').value)}catch(err){text($('ob-error'),err.message)}finally{go.disabled=false}
};
// Search (⌘K / Ctrl+K), like Lovable: one box that finds your projects, pages and tools as you type.
// Every result runs the same button the sidebar or account menu has, so nothing new can break.
const SEARCH_PAGES=[['side-new','New project'],['side-projects','All projects'],['side-templates','Templates'],['side-connectors','Connectors'],['side-settings','Settings & usage'],['side-docs','Help']];
let searchItems=[],searchAt=0;
async function openSearch(){
 const d=$('search-dlg');if(d.open)return;
 let projects=state.projects;if(!projects){try{projects=(await api('/projects')).projects;state.projects=projects}catch{projects=[]}}
 const tools=[...document.querySelectorAll('#side-account .acct-panel>button[id^="side-"]:not(.hidden)')].filter(b=>!SEARCH_PAGES.some(([id])=>id===b.id)).map(b=>({label:b.textContent.trim(),kind:'Tool',run:()=>b.click()}));
 searchItems=[...projects.map(p=>({label:p.name,kind:p.published?'Live':'Project',run:()=>openProject(p.id)})),...SEARCH_PAGES.map(([id,label])=>({label,kind:'Page',run:()=>$(id).click()})),...tools];
 $('search-input').value='';renderSearch();d.showModal();$('search-input').focus();
}
function renderSearch(){
 const q=$('search-input').value.trim().toLowerCase(),list=$('search-list');list.replaceChildren();
 const hits=searchItems.filter(x=>!q||x.label.toLowerCase().includes(q)).slice(0,q?10:8);
 searchAt=Math.min(searchAt,Math.max(0,hits.length-1));
 if(!hits.length){list.append(el('li','ks-search-empty','Nothing matches "'+$('search-input').value.trim()+'"'));return}
 hits.forEach((x,i)=>{const li=el('li','ks-search-item'+(i===searchAt?' on':''));li.setAttribute('role','option');li.setAttribute('aria-selected',String(i===searchAt));
  li.append(el('span','ks-search-label',x.label),el('span','ks-search-kind',x.kind));li.onmousemove=()=>{if(searchAt!==i){searchAt=i;renderSearch()}};li.onclick=()=>pickSearch(x);list.append(li)});
 list._hits=hits;
}
function pickSearch(x){$('search-dlg').close();x.run()}
$('side-search').onclick=openSearch;
$('search-input').oninput=()=>{searchAt=0;renderSearch()};
$('search-input').onkeydown=e=>{const hits=$('search-list')._hits||[];
 if(e.key==='ArrowDown'){e.preventDefault();searchAt=Math.min(hits.length-1,searchAt+1);renderSearch()}
 else if(e.key==='ArrowUp'){e.preventDefault();searchAt=Math.max(0,searchAt-1);renderSearch()}
 else if(e.key==='Enter'&&hits[searchAt]){e.preventDefault();pickSearch(hits[searchAt])}
 else if(e.key==='Escape'){e.preventDefault();$('search-dlg').close()}};
$('search-dlg').onclick=e=>{if(e.target===$('search-dlg'))$('search-dlg').close()};
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&!e.shiftKey&&!e.altKey&&e.key.toLowerCase()==='k'&&state.me&&state.me.viewer){e.preventDefault();openSearch()}});
// The account menu closes when you click anywhere else.
document.addEventListener('click',e=>{const a=$('side-account');if(a.open&&!a.contains(e.target))a.open=false});
$('side-docs').onclick=()=>window.open('https://github.com/HQTravellez/Kairoq/blob/main/docs/create.md','_blank','noopener');
$('ks-strip-stop').onclick=()=>$('stop-job').click();
// The phone top bar (#ph-bar): its buttons are the editor's own, so they work exactly as before.
$('ph-back').onclick=()=>$('back').click();
$('ph-publish').onclick=()=>$('publish-open').click();
$('ph-more').onclick=()=>document.body.classList.toggle('side-open');
setInterval(()=>{const p=state.project;if(!p||!$('ph-name'))return;text($('ph-name'),p.name||'Untitled');text($('ph-saved'),state.job?'Kairoq is working…':'All changes saved');$('ph-publish').classList.toggle('hidden',p.role==='viewer')},800);
$('side-toggle').onclick=()=>document.body.classList.toggle('side-open');$('side-open-btn').onclick=()=>document.body.classList.toggle('side-open');
$('side').addEventListener('click',e=>{if(window.innerWidth<=820&&e.target.closest('button'))document.body.classList.remove('side-open')});
// ui/screens: on a phone the menu is a drawer; a tap outside it closes it.
document.addEventListener('click',e=>{if(window.innerWidth<=900&&document.body.classList.contains('side-open')&&!e.target.closest('#side,#side-open-btn,#side-toggle')){document.body.classList.remove('side-open');e.preventDefault();e.stopPropagation()}},true);
// What to build (like superapp's first question): a website, a web app or a phone app. Each has
// its own examples, typed into the empty box one after another (they stop when you type or focus).
const KINDS={
 site:{prefix:'',examples:['A restaurant site with the menu, opening hours and reservations','A landing page for my renovation company with photos and a quote form','A portfolio for my photography studio with bookings']},
 app:{prefix:'',examples:['A CRM to track leads, deals and follow-ups','A booking system for my salon with staff calendars','An inventory tracker for my café with low-stock alerts']},
 phone:{prefix:'Build a mobile app: ',examples:['An iPhone app for my café: order ahead and see the menu','A gym app with class bookings and a membership card','A tour guide app with maps of the stops']}};
const home={kind:'site',typing:null};
function setKind(kind){
 home.kind=KINDS[kind]?kind:'site';
 for(const b of document.querySelectorAll('#new-kind button'))b.setAttribute('aria-pressed',String(b.dataset.kind===home.kind));
 text($('kind-hint'),{site:'A website people visit',app:'An app with sign-in and saved data',phone:'For iPhone and Android'}[home.kind]);
 const ex=$('examples');ex.replaceChildren();
 for(const t of KINDS[home.kind].examples){const b=el('button','example',t);b.type='button';b.onclick=()=>{$('new-prompt').value=t;$('new-prompt').focus()};ex.append(b)}
 typeExamples();
}
function typeExamples(){
 clearTimeout(home.typing);const box=$('new-prompt');
 const list=KINDS[home.kind].examples,still=STILL||document.activeElement===box||box.value;
 if(still){box.placeholder=list[0];return}
 let i=0,n=0,back=false;
 const tick=()=>{if(document.activeElement===box||box.value){box.placeholder=list[i%list.length];return}
  const t=list[i%list.length];
  if(!back){n++;box.placeholder=t.slice(0,n);if(n>=t.length){back=true;home.typing=setTimeout(tick,1800);return}}
  else{n=Math.max(0,n-3);box.placeholder=t.slice(0,n);if(!n){back=false;i++}}
  home.typing=setTimeout(tick,back?18:38)};
 home.typing=setTimeout(tick,500);
}
for(const b of document.querySelectorAll('#new-kind button'))b.onclick=()=>setKind(b.dataset.kind);
text($('home-date'),new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'}));
$('new-prompt').addEventListener('focus',()=>{clearTimeout(home.typing);$('new-prompt').placeholder=KINDS[home.kind].examples[0]});
$('new-prompt').addEventListener('blur',typeExamples);
// A new app from the home box: the editor opens straight away and any quick questions, then
// "How should it feel?" (the look), are asked inside the chat before the first build starts.
$('new-form').onsubmit=async e=>{
 e.preventDefault();text($('home-error'),'');$('new-submit').disabled=true;
 try{
  const typed=$('new-prompt').value.trim();
  if(!typed)return;
  // Remember where the prompt was, so it can slide into the chat as the first message.
  {const r=$('new-prompt').closest('.prompt-box').getBoundingClientRect();state.fly={rect:{left:r.left,top:r.top,width:r.width,height:r.height},text:typed,at:Date.now()}}
  // A greeting ("helo" too) or a question is a conversation, not an app: it opens a new chat in
  // Discuss mode (no design pick, no build) instead of starting a build or reopening the last project.
  const talk=homeTalk(typed);
  if(talk){
   const {project}=await api('/projects',{method:'POST',body:{name:talk==='greeting'?'New chat':shortName(typed)}});
   await openProject(project.id);
   $('new-prompt').value='';
   setChatMode('discuss');
   const sending=send(typed,'discuss');flyIn([...document.querySelectorAll('#messages>li.user')].pop());
   await sending;
   return;
  }
  $('home-error').classList.remove('welcome');
  // A phone app is asked for in words the builder knows (react-native-app.js wanted()).
  const prompt=(KINDS[home.kind].prefix&&!/^Build a mobile app:/i.test(typed)?KINDS[home.kind].prefix:'')+typed;
  await askThenBuild(prompt);
  $('new-prompt').value='';
 }catch(err){text($('home-error'),err.message)}
 finally{$('new-submit').disabled=false}
};

// Home composer: 'greeting' | 'question' | null (a build request). Kept in step with builder-smalltalk.js.
const HOME_GREET=/^(h+i+|h+e+l+o+w?|hel+o+|hal+o+|hey+a?|hiya|yo+|sup|howdy|hola|namaste|good (morning|afternoon|evening|day))\b/i;
const HOME_BUILD=/\b(build|make|create|generate|design|clone|set up|launch|code|develop)\b/i;
function homeTalk(t){
 t=String(t||'').trim();if(!t)return null;
 const words=t.split(/\s+/).length;
 if(HOME_GREET.test(t)&&words<=6&&!HOME_BUILD.test(t))return'greeting';
 if(HOME_BUILD.test(t))return null;
 const lead=t.replace(/^(well|so|ok(ay)?|um+|actually|hey|hi|hello|please)[,\s]+/i,'');
 if(/\b(discuss|talk (about|through)|compare|comparison|versus|vs\.?)\b/i.test(t))return'question';
 if(/\?\s*$/.test(t)||/^(what|why|how|when|which|who|is|are|should|could|can you (tell|explain|compare)|tell me|explain|compare|discuss|i want to (discuss|talk|know|understand)|let'?s (talk|discuss)|help me (understand|decide|choose))\b/i.test(lead))return'question';
 return null;
}

// A card-sized app name from the request: its first clause ("Digital menu for my café with today's
// specials" → "Digital menu for my café"), at most 40 characters, never ending on "with", "for" etc.
function shortName(prompt){
 let t=String(prompt).replace(/^Build a mobile app:\s*/i,'').replace(/\s+/g,' ').trim().split(/[.!?\n:;]/)[0].trim();
 const m=/\s(with|that|which|where|so|including|plus)\s/i.exec(t.slice(12));if(m)t=t.slice(0,12+m.index);
 if(t.length>40){const c=t.slice(0,41);t=c.slice(0,Math.max(c.lastIndexOf(' '),20))}
 return t.replace(/[\s,;-]+(a|an|the|and|or|with|for|of|to|in|my|our)$/i,'').replace(/[\s,;:-]+$/,'')||'New app';
}
// Sliding switches (like iOS and superapp): each segmented group in the editor gets a white thumb
// that glides to the pressed button, whatever changes aria-pressed (a click or the code).
function slideSegs(){
 for(const seg of document.querySelectorAll('#editor .seg,#home .kind-seg')){
  if(seg.querySelector('.seg-thumb'))continue;
  const thumb=document.createElement('span');thumb.className='seg-thumb';thumb.setAttribute('aria-hidden','true');seg.prepend(thumb);seg.classList.add('sliding');
  const place=()=>{const on=seg.querySelector('button[aria-pressed="true"]');if(!on||!on.offsetWidth){thumb.style.opacity='0';return}thumb.style.opacity='1';thumb.style.width=on.offsetWidth+'px';thumb.style.transform='translateX('+(on.offsetLeft-(thumb.offsetParent?thumb.offsetParent.clientLeft:0))+'px)'};
  new MutationObserver(place).observe(seg,{attributes:true,subtree:true,attributeFilter:['aria-pressed','class','hidden']});
  if(window.ResizeObserver)new ResizeObserver(place).observe(seg);
  requestAnimationFrame(place);
 }
}
slideSegs();
// Smooth steps in the ask card (like superapp): the old step slides out, the card's height eases
// to fit the next one, and the new step slides in from the side it comes from (dir 1 forward,
// -1 back, 0 fade). The slide-in itself is CSS (.ask-card[data-dir] > *). Reduced motion: instant.
const STILL=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
setKind('site');
function morph(card,fill,dir=1){
 card.dataset.dir=String(dir);
 if(STILL||!card.isConnected||!card.children.length){card.replaceChildren();fill();return}
 const from=card.offsetHeight;
 card.style.height=from+'px';card.classList.add('morphing');
 for(const c of card.children)c.classList.add('step-out');
 setTimeout(()=>{
  card.replaceChildren();fill();
  card.style.height='auto';const to=card.offsetHeight;card.style.height=from+'px';
  void card.offsetHeight;card.style.height=to+'px';
  setTimeout(()=>{card.style.height='';card.classList.remove('morphing')},340);
 },150);
}
// Start immediately. The build agent can ask for genuinely blocking information in chat.
// The agent's header above a reply, like Emergent's: "Kairoq Agent · Worked for 41s".
function agentHead(label){
 const h=el('div','agent-head');
 h.append(el('span','agent-name','Kairoq Agent'),el('span','agent-work',label||''));
 return h;
}
// A short line under a reply: what the agent did to get there ("Thought it through, used 3 tools").
function workLine(text){return el('p','work-line',text)}
function thinkLine(text){const p=el('p','ask-head think-line'),t=el('span',null,text||'');if(!text)sayThinking(t);p.append(t,dots());return p}
// Like Lovable: what you typed on Home slides from the Home box into the chat as your first message,
// instead of the page just jumping. Skipped for reduced motion or if anything is off screen.
function flyIn(target){
 const f=state.fly;state.fly=null;
 if(!f||!target||CALM||Date.now()-f.at>15000||!document.body.animate)return;
 requestAnimationFrame(()=>{
  const to=target.getBoundingClientRect();if(!to.width||!to.height||to.bottom<0||to.top>innerHeight)return;
  const cs=getComputedStyle(target),g=el('div','fly-ghost',f.text);
  Object.assign(g.style,{left:f.rect.left+'px',top:f.rect.top+'px',width:f.rect.width+'px',height:f.rect.height+'px'});
  // The chat may redraw while it flies (a fast reply), so hide the newest message by class, not on the element.
  const list=$('messages');document.body.append(g);list?.classList.add('fly-wait');
  const a=g.animate([{left:f.rect.left+'px',top:f.rect.top+'px',width:f.rect.width+'px',height:f.rect.height+'px',backgroundColor:'#ffffff',borderRadius:'18px',fontSize:'18px'},
   {left:to.left+'px',top:to.top+'px',width:to.width+'px',height:to.height+'px',backgroundColor:cs.backgroundColor,borderRadius:cs.borderRadius||'12px',fontSize:cs.fontSize}],{duration:560,easing:'cubic-bezier(.2,.8,.2,1)',fill:'forwards'});
  const done=()=>{list?.classList.remove('fly-wait');g.remove()};a.onfinish=done;a.oncancel=done;setTimeout(done,1200);
 });
}
async function askThenBuild(prompt,chosenName){
 const name=String(chosenName||'').trim()||shortName(prompt);
 const {project}=await api('/projects',{method:'POST',body:{name}});
 await openProject(project.id);
 const list=$('messages');list.replaceChildren();
 let mine=messageItem({role:'user',text:prompt});list.append(mine);
 flyIn(mine);
 const card=document.createElement('li');card.className='assistant ask-card';
 card.classList.add('enter');card.dataset.dir='0';
 const started=Date.now(),worked=()=>'Worked for '+Math.max(1,Math.round((Date.now()-started)/1000))+'s';
 card.append(agentHead('Reading your request…'),thinkLine());list.append(card);
 const {opening='',questions=[]}=await api('/clarify',{method:'POST',body:{prompt,tier:state.tier}}).catch(()=>({opening:'',questions:[]}));
 // The answers go with the request; the picked look becomes the project's colours and fonts; then
 // the plan (build-plan.js) is shown with Review, Skip and Approve, and the build starts on Approve.
 const request=answers=>answers.length?prompt+'\n\nDetails from the owner:\n'+answers.map(x=>'- '+x.q+' '+x.a.join(', ')).join('\n'):prompt;
 const go=(answers,plan)=>{mine.remove();card.remove();planWaiting(false);state.firstBuild=true;send(plan?withPlan(request(answers),plan):request(answers),'build')};
 const build=async(answers,look)=>{
  if(look)await api('/projects/'+project.id+'/look',{method:'POST',body:{look,prompt,three_d:look.three_d||'none'}}).catch(err=>console.warn('look',err.message));
  if(answers.length){mine.replaceWith(mine=messageItem({role:'user',text:request(answers)}))}
  morph(card,()=>card.append(agentHead(worked()),thinkLine('Planning the first version'),el('p','plan-sub','Looking up anything your request names, then writing the plan.')),0);
  planWaiting(true);
  const {plan}=await api('/projects/'+project.id+'/plan',{method:'POST',body:{prompt:request(answers),tier:state.tier}}).catch(()=>({plan:null}));
  if(!plan)return go(answers,null);
  // A character the owner picked in the plan is added to the project's 3D files first.
  const approve=async()=>{
   if(plan.pick){try{const d=await api('/projects/'+project.id+'/models?op=polypizza',{method:'POST',body:{id:plan.pick.id}});plan.picked=d.added.title}catch(err){card.querySelector('.char-pick')?.append(el('p','char-note char-err',err.message));return false}}
   go(answers,plan);
  };
  showBuildPlan(card,plan,{onApprove:approve,onSkip:()=>go(answers,null),projectId:project.id,head:agentHead(worked())});
  list.scrollTop=list.scrollHeight;
 };
 // Questions like Emergent: the chat keeps one slim line ("Kairoq has questions for you"), and the
 // questions open one at a time in a panel docked above the message box. Kairoq's suggested answer
 // is already ticked; "Use my suggestions" accepts them all, × skips the questions.
 const picked=questions.map(q=>new Set(Number.isInteger(q.recommended)?[q.options[q.recommended]]:[])),other=questions.map(()=>'');
 const suggest=()=>questions.forEach((q,i)=>{picked[i].clear();other[i]='';if(Number.isInteger(q.recommended))picked[i].add(q.options[q.recommended])});
 const answers=()=>questions.map((q,i)=>({q:q.q,a:[...picked[i],...(other[i].trim()?[other[i].trim()]:[])]})).filter(x=>x.a.length);
 const lookStep=()=>window.KairoqLook.step({card,name,prompt,count:'One more thing',onBuild:look=>build(answers(),look),onSkip:()=>build(answers()),onBack:questions.length?()=>{waiting();openDock(questions.length-1)}:null});
 const next=()=>{if(window.KairoqLook){morph(card,()=>card.append(agentHead(worked()),thinkLine('Thinking about the look')),1);setTimeout(lookStep,STILL?0:170)}else build(answers())};
 // No questions: the opening line says what gets built, then straight on to the brand.
 if(!questions.length){if(opening){morph(card,()=>card.append(agentHead(worked()),el('p','ask-intro',opening)),1);setTimeout(next,STILL?0:900)}else next();return}
 const waiting=()=>morph(card,()=>{
  card.append(agentHead(worked()));
  if(opening)card.append(el('p','ask-intro',opening));
  const row=el('div','ask-wait');
  row.append(el('span','ask-wait-ic','?'),el('span','ask-wait-t','Kairoq has questions for you'),el('span','ask-wait-s',questions.length+' question'+(questions.length===1?'':'s')+' · waiting for your answers'));
  card.append(row);list.scrollTop=list.scrollHeight;
 },1);
 const openDock=(start=0)=>{
  document.querySelector('.ask-dock')?.remove();
  let at=start;
  const btn=(cls,txt,label)=>{const b=el('button',cls,txt);b.type='button';if(label)b.setAttribute('aria-label',label);return b};
  const dock=el('section','ask-dock');dock.setAttribute('aria-label','Kairoq has questions for you');
  const head=el('div','ad-head');head.append(el('span','ad-ic','?'),el('span','ad-title','Kairoq has questions for you'));
  const x=btn('ad-x','','Skip the questions');x.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';head.append(x);
  const body=el('div','ad-body'),foot=el('div','ad-foot');
  const prev=btn('ad-nav','‹','Previous question'),count=el('span','ad-count'),fwd=btn('ad-nav','›','Next question');
  const auto=btn('ad-auto','Use my suggestions'),go=btn('ad-go ask-next','Next');
  const navs=el('div','ad-steps');navs.append(prev,count,fwd);foot.append(navs,el('span','ask-gap'),auto,go);
  dock.append(head,body,foot);
  const close=()=>{document.body.classList.remove('asking');if(STILL)dock.remove();else{dock.classList.add('leaving');setTimeout(()=>dock.remove(),220)}};
  const finish=()=>{close();next()};
  const fill=()=>{
   const q=questions[at];
   body.append(el('p','ad-q',q.q));
   const opts=el('div','ad-opts');
   const mark=()=>{for(const r of opts.querySelectorAll('.ad-opt'))r.classList.toggle('on',Boolean(r.querySelector('input:checked'))||(r.classList.contains('ad-own')&&Boolean(other[at].trim())))};
   (q.options||[]).forEach((o,i)=>{
    const r=el('label','ad-opt');const input=document.createElement('input');
    input.type=q.multi?'checkbox':'radio';input.name='ad'+at;input.checked=picked[at].has(o);
    input.onchange=()=>{if(!q.multi){picked[at].clear();other[at]='';own.value=''}input.checked?picked[at].add(o):picked[at].delete(o);mark()};
    const words=el('span','ad-words');words.append(el('b',null,o));
    if(q.details&&q.details[i])words.append(' ',el('span','ad-hint',q.details[i]));
    if(i===q.recommended)words.append(' ',el('span','ad-tag','Suggested'));
    r.append(input,el('span','ad-box'),words);opts.append(r);
   });
   const ownRow=el('label','ad-opt ad-own'+(q.multi?'':' ad-radio'));const own=document.createElement('input');own.className='ad-other';own.placeholder='Something else…';own.value=other[at];own.setAttribute('aria-label','Another answer');
   own.oninput=()=>{other[at]=own.value;if(own.value.trim()&&!q.multi){picked[at].clear();for(const r of opts.querySelectorAll('input[name]'))r.checked=false}mark()};
   ownRow.append(el('span','ad-box'),own);opts.append(ownRow);
   body.append(opts);mark();
   const last=at===questions.length-1;
   count.textContent='Question '+(at+1)+' of '+questions.length;
   prev.disabled=at===0;fwd.disabled=last;go.textContent=last?'Continue':'Next';
  };
  const step=d=>{at=Math.max(0,Math.min(questions.length-1,at+d));morph(body,fill,d)};
  prev.onclick=()=>step(-1);fwd.onclick=()=>step(1);
  go.onclick=()=>at===questions.length-1?finish():step(1);
  auto.onclick=()=>{suggest();finish()};
  x.onclick=()=>{for(const s of picked)s.clear();other.fill('');finish()};
  dock.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();x.click()}else if(e.key==='Enter'&&!e.shiftKey&&e.target.tagName!=='BUTTON'){e.preventDefault();go.click()}};
  fill();
  $('chat-form').before(dock);document.body.classList.add('asking');
  requestAnimationFrame(()=>dock.querySelector('.ad-opt input:checked,.ad-opt input')?.focus({preventScroll:true}));
 };
 waiting();openDock(0);
}
// A first request with the owner's answers and the approved plan, shown like superapp: the request,
// each question small with its answer under it, then the plan's title.
function requestCard(t){
 const box=el('div','req-card');
 const [main,...rest]=String(t).split(/\n\n(?=Details from the owner:|Approved plan \(build exactly this first version\):)/);
 box.append(el('div','msg-text',main));
 for(const part of rest){
  if(part.startsWith('Details from the owner:')){
   const qa=el('div','req-answers');
   for(const line of part.split('\n').slice(1)){const m=/^- (.*\?)\s*(.*)$/.exec(line);if(!m)continue;qa.append(el('p','req-q',m[1]),el('p','req-a',m[2]))}
   box.append(qa);
  }else{const title=(part.split('\n')[1]||'').split('. ')[0];if(title)box.append(el('p','req-plan','Plan approved: '+title))}
 }
 return box;
}
// The plan before the first build: a title, a short summary, Review (the screens, features, what
// waits, what was looked up), Skip and Approve.
function showBuildPlan(card,plan,{onApprove,onSkip,projectId,head}){
 morph(card,()=>{fillPlan(card,plan,{onApprove,onSkip,projectId});if(head)card.prepend(head)},0);
}
// The character in the plan (build-plan.js characterChoices): real ready-made 3D models to pick
// from, each with its picture, creator, licence and one honest note. Nothing is built until one
// is picked; "Show others" looks for more.
function characterPick(plan,{projectId,onChange}){
 const c=plan.characters,box=el('div','char-pick');
 box.append(el('p','plan-part','Pick the character'));
 if(c.phone_note)box.append(el('p','char-note',c.phone_note));
 if(c.unavailable&&!(c.options||[]).length){box.append(el('p','char-note',c.unavailable+' The app will be built without a ready-made character.'));return box}
 const grid=el('div','char-grid');box.append(grid);
 const draw=list=>{
  grid.replaceChildren();
  if(!list.length){grid.append(el('p','char-note','No ready-made "'+c.search+'" model was found. Try Show others, or skip and add one later in Design → 3D models.'));return}
  for(const o of list){
   const b=el('button','char-opt');b.type='button';b.setAttribute('aria-pressed',String(plan.pick&&plan.pick.id===o.id));
   const pic=el('div','char-pic');if(o.thumb){const img=document.createElement('img');img.src=o.thumb;img.alt=o.title;img.loading='lazy';img.referrerPolicy='no-referrer';pic.append(img)}
   const link=el('a','char-link','View in 3D');link.href=o.url;link.target='_blank';link.rel='noopener';link.onclick=e=>e.stopPropagation();
   b.append(pic,el('span','char-name',o.title),el('span','char-meta',(o.creator?o.creator+' · ':'')+o.licence),el('span','char-note',o.note),link);
   b.onclick=()=>{plan.pick=o;for(const x of grid.querySelectorAll('.char-opt'))x.setAttribute('aria-pressed','false');b.setAttribute('aria-pressed','true');onChange()};
   grid.append(b);
  }
 };
 draw(c.options||[]);
 const more=el('button','ask-link char-more','Show others');more.type='button';
 more.onclick=async()=>{more.disabled=true;more.textContent='Looking…';try{const d=await api('/projects/'+projectId+'/models?op=polypizza-search',{method:'POST',body:{query:c.search,animated:c.animated}});const seen=new Set((c.options||[]).map(x=>x.id));const fresh=(d.results||[]).filter(x=>!seen.has(x.id));c.options=[...fresh,...(c.options||[])].slice(0,6);draw(c.options);more.textContent=fresh.length?'Show others':'No more found'}catch(err){more.textContent=err.message}more.disabled=false};
 box.append(more);
 return box;
}
function fillPlan(card,plan,{onApprove,onSkip,projectId}){
 card.classList.add('plan-card');
 if(plan.searches)card.append(el('p','plan-research','✓ Looked up '+plan.searches+' source'+(plan.searches===1?'':'s')+' before planning'));
 const t=(state.me?.tiers||[]).find(x=>x.id===(state.tier||'standard')),cost=state.me?.viewer?.kind==='customer'&&t?t.credits:0;
 const top=el('div','plan-top');top.append(el('p','plan-kicker','Plan'),el('span','plan-meta','1 build'+(cost?' · '+cost+' credits':'')));
 card.append(top,el('h3','plan-title',plan.title),el('p','plan-summary',plan.summary));
 const more=el('div','plan-more hidden');
 const part=(title,items)=>{if(!items.length)return;more.append(el('p','plan-part',title));const ul=el('ul');for(const x of items)ul.append(el('li',null,x));more.append(ul)};
 part('Screens',(plan.screens||[]).map(x=>x.name+(x.what?': '+x.what:'')));
 part('Features',plan.features||[]);
 part('Left for later',plan.left_out||[]);
 if((plan.sources||[]).length){more.append(el('p','plan-part','Looked up'));const ul=el('ul');for(const x of plan.sources){const li=el('li'),a=el('a',null,x.title);a.href=x.url;a.target='_blank';a.rel='noopener';li.append(a);ul.append(li)}more.append(ul)}
 const foot=el('div','ask-foot');
 const review=el('button','plan-review','Review plan');review.type='button';review.setAttribute('aria-expanded','false');
 review.onclick=()=>{const open=more.classList.toggle('hidden');review.setAttribute('aria-expanded',String(!open));review.textContent=open?'Review plan':'Hide details'};
 const skip=el('button','ask-link','Skip');skip.type='button';skip.title='Build without the plan';skip.onclick=onSkip;
 const ok=el('button','ask-next plan-approve','Build it');ok.type='button';
 const needPick=()=>Boolean(plan.characters&&(plan.characters.options||[]).length&&!plan.pick);
 const sync=()=>{ok.disabled=needPick();ok.textContent=needPick()?'Pick a character':'Build it'};
 ok.onclick=async()=>{if(needPick())return;ok.disabled=true;ok.textContent='Adding the character…';if(await onApprove()===false)sync()};
 foot.classList.add('plan-foot');foot.append(ok,review,el('span','ask-gap'),skip);
 card.append(more);
 if(plan.characters)card.append(characterPick(plan,{projectId,onChange:sync}));
 card.append(foot);sync();
 ok.focus({preventScroll:true});
}
// The approved plan, added to the request (the same words as build-plan.js withPlan).
function withPlan(req,p){
 return req.trim()+'\n\nApproved plan (build exactly this first version):\n'+p.title+'. '+p.summary
  +((p.screens||[]).length?'\nScreens: '+p.screens.map(s=>s.name+(s.what?' ('+s.what+')':'')).join('; '):'')
  +((p.features||[]).length?'\nFeatures: '+p.features.join('; '):'')
  +((p.left_out||[]).length?'\nLeft out for now: '+p.left_out.join('; '):'')
  +(p.picked?'\nCharacter: the owner picked the ready-made 3D model "'+p.picked+'" (in this project\'s 3D files). Show it with Model3D and use its own animations; never draw the character from shapes or SVG.':'');
}
// While the plan waits, and while the first version is built, the preview shows the app being
// put together (blocks appear, a cursor moves, a shimmer runs) instead of the bare starter.
function previewWait(id,title,sub,spin){
 let box=$(id);
 if(!box){
  box=el('div','pw');box.id=id;box.setAttribute('role','status');
  const win=el('div','pw-win'),top=el('div','pw-top'),body=el('div','pw-body'),cur=el('span','pw-cursor');
  top.append(el('i'),el('i'),el('i'),el('b'));
  for(const k of ['nav','hero','pic','c1','c2','c3','line','btn'])body.append(el('span','pw-b '+k));
  cur.innerHTML='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 1l11 6-5 1.5L6 14z"/></svg>';
  win.append(top,body,cur);
  const txt=el('div','pw-text'),t=el('p','pw-title'),s2=el('p','pw-sub');
  txt.append(t,s2);box.append(win,txt);$('canvas').append(box);
 }
 const t=box.querySelector('.pw-title'),s2=box.querySelector('.pw-sub');
 if(t.textContent!==title)t.textContent=title;
 const line=s2.querySelector('.pw-line')||el('span','pw-line');
 if(line.textContent!==sub)line.textContent=sub;
 if(!s2.contains(line))s2.replaceChildren(...(spin?[el('span','pw-spin'),line]:[line]));
}
function planWaiting(on){
 if(!on){$('plan-wait')?.remove();return}
 previewWait('plan-wait','Your app will appear here','Approve the plan to start building.',false);
}
// A new project still shows Kairoq's starter page: the preview plays the "app being put
// together" scene instead, until the first real version arrives.
function starterWaiting(on){
 if(!on){$('start-wait')?.remove();return}
 previewWait('start-wait','Your app will appear here','Describe it in the chat. You will watch it come together here.',false);
}
function buildWaiting(label){
 if(!label){const b=$('build-wait');if(b&&!b.classList.contains('leaving')){if(STILL)b.remove();else{b.classList.add('leaving');setTimeout(()=>b.remove(),650)}}return}
 previewWait('build-wait','Building your app',label,true);
 const box=$('build-wait');if(box&&!box.querySelector('.pw-matrix'))dotMatrix(box.querySelector('.pw-win'));
}
// A field of dots in Kairoq purple with a ripple running across it, drawn on a canvas over the
// placeholder window. It stops when the window leaves the page and pauses while the tab is hidden;
// with reduced motion it is a still grid.
function dotMatrix(win){
 if(!win)return;
 const c=document.createElement('canvas');c.className='pw-matrix';c.setAttribute('aria-hidden','true');win.append(c);
 const ctx=c.getContext('2d');if(!ctx)return;
 const GAP=14,start=performance.now();
 const size=()=>{const r=c.getBoundingClientRect(),d=Math.min(2,devicePixelRatio||1);c.width=Math.max(1,r.width*d);c.height=Math.max(1,r.height*d);ctx.setTransform(d,0,0,d,0,0);return r};
 let box=size();const ro=window.ResizeObserver?new ResizeObserver(()=>{box=size()}):null;ro?.observe(c);
 const draw=now=>{
  if(!c.isConnected){ro?.disconnect();return}
  if(!document.hidden){
   const t=(now-start)/1000,w=box.width,h=box.height;ctx.clearRect(0,0,w,h);
   const cx=w*(0.5+0.32*Math.sin(t*0.35)),cy=h*(0.5+0.28*Math.cos(t*0.27));
   for(let y=GAP/2;y<h;y+=GAP)for(let x=GAP/2;x<w;x+=GAP){
    const d=Math.hypot(x-cx,y-cy)/GAP,wave=STILL?0.2:Math.max(0,Math.sin(d*0.55-t*3.2));
    const a=0.1+0.75*Math.pow(wave,3);
    ctx.fillStyle='rgba(117,82,232,'+a.toFixed(3)+')';ctx.beginPath();ctx.arc(x,y,1.2+1.1*Math.pow(wave,3),0,6.2832);ctx.fill();
   }
  }
  if(!STILL)requestAnimationFrame(draw);
 };
 requestAnimationFrame(draw);
}
// Run on your phone (react-native-app.js): Expo Snack gives a QR code the Expo Go app opens.
$('run-phone').onclick=async()=>{
 const d=$('phone-dialog');text($('phone-error'),'');text($('phone-status'),'Getting your app ready for your phone…');$('phone-box').classList.add('hidden');d.showModal();
 try{
  const {phone}=await api('/projects/'+state.project.id+'/phone',{method:'POST',body:{}});
  $('phone-qr').src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(phone.qr);
  $('phone-snack').href=phone.snack_url;
  text($('phone-status'),'Version '+phone.version+' is ready. Scan the code with your phone.');
  $('phone-box').classList.remove('hidden');
 }catch(err){text($('phone-status'),'');text($('phone-error'),err.message)}
};
// Send to Figma (figma-export.js): a code the Kairoq Figma plugin uses to rebuild the page.
$('figma-send').onclick=async()=>{
 const d=$('figma-dialog');text($('figma-error'),'');text($('figma-status'),'Capturing the page as layers… (about 20 seconds)');$('figma-box').classList.add('hidden');d.showModal();
 try{
  const r=await api('/projects/'+state.project.id+'/figmaexport',{method:'POST',body:{}});
  text($('figma-code'),r.code);text($('figma-frames'),r.frames.map(f=>(f.label||f.name)+': '+f.nodes+' layers').join('. ')+'.');
  text($('figma-status'),'Ready. Paste this code in the Kairoq plugin in Figma.');$('figma-box').classList.remove('hidden');
 }catch(err){text($('figma-status'),'');text($('figma-error'),err.message)}
};
// Publish to the App Store and Google Play (store-listing.js, store-publish.js).
const storeState={timer:null};
function storeFile(name){return '/api/create/projects/'+state.project.id+'/storefile?name='+encodeURIComponent(name)+'&t='+Date.now()}
function renderStores(st){
 const check=$('store-check');check.replaceChildren();
 for(const c of st.checklist||[]){const li=el('li',c.ok?'ok':'todo');li.append(el('span','vmark',c.ok?'✓':'•'),el('span',null,c.text));check.append(li)}
 const media=$('store-media');media.replaceChildren();
 if(st.icon){const f=el('figure');const img=document.createElement('img');img.src=storeFile(st.icon);img.alt='App icon';img.className='store-icon';f.append(img,el('figcaption',null,'Icon'));media.append(f)}
 for(const p of ['ios','android'])for(const n of (st.shots&&st.shots[p])||[]){const f=el('figure');const a=document.createElement('a');a.href=storeFile(n);a.target='_blank';a.rel='noopener';const img=document.createElement('img');img.src=storeFile(n);img.alt=(p==='ios'?'iPhone':'Android')+' screenshot';a.append(img);f.append(a,el('figcaption',null,p==='ios'?'iPhone':'Android'));media.append(f)}
 const L=st.listing;$('store-fields').classList.toggle('hidden',!L);
 text($('store-prepare'),L?'Prepare again':'Prepare the listing');
 const cat=$('st-category');if(!cat.options.length)for(const c of st.categories||[]){const o=document.createElement('option');o.value=o.textContent=c;cat.append(o)}
 if(L){$('st-name').value=L.name||'';$('st-subtitle').value=L.subtitle||'';$('st-promo').value=L.promo||'';$('st-description').value=L.description||'';$('st-keywords').value=L.keywords||'';cat.value=L.category||'Lifestyle';$('st-privacy').value=L.privacy_url||'';$('st-support').value=L.support_url||''}
 $('st-bundle').value=st.bundle_id||'';$('st-package').value=st.package_name||'';$('st-bundle').disabled=Boolean(st.locked&&st.locked.bundle_id);$('st-package').disabled=Boolean(st.locked&&st.locked.package_name);
 text($('st-bundle-show'),st.bundle_id||'');
 text($('st-apple-state'),st.apple&&st.apple.key_saved_at?(st.apple.app_found?'Key saved. App found: '+(st.apple.app_name||'yes')+'.':'Key saved. The app is not in App Store Connect yet.'):'');
 text($('st-google-state'),st.google&&st.google.key_saved_at?'Key saved ('+st.google.client_email+').':'');
 const runs=$('store-runs');runs.replaceChildren();
 for(const r of st.runs||[]){
  const li=el('li','run '+r.state);
  li.append(el('b',null,(r.platform==='ios'?'iPhone':'Android')+' · version '+r.version),el('span',null,r.text||r.state));
  const acts=el('span','run-acts');
  if(r.build_url){const a=el('a','link-btn','Build log');a.href=r.build_url;a.target='_blank';a.rel='noopener';acts.append(a)}
  if(r.file){const a=el('a','link-btn',r.platform==='ios'?'Download the build':'Download the .aab file');a.href=r.file;a.target='_blank';a.rel='noopener';acts.append(a)}
  if(r.state==='built'){const b=el('button','ghost',r.platform==='ios'?'Send to App Store':'I uploaded it');b.type='button';b.onclick=()=>storeCall({action:'send',run:r.id},b);acts.append(b)}
  li.append(acts);runs.append(li);
 }
 clearTimeout(storeState.timer);
 if($('stores-dialog').open&&(st.runs||[]).some(r=>['starting','building','submitting'].includes(r.state)))storeState.timer=setTimeout(()=>loadStores(true),30000);
}
async function loadStores(refresh){try{const {stores}=await api('/projects/'+state.project.id+'/stores'+(refresh?'?refresh=1':''));renderStores(stores)}catch(err){text($('store-error'),err.message)}}
async function storeCall(body,btn){
 text($('store-error'),'');const was=btn&&btn.textContent;if(btn){btn.disabled=true;btn.textContent='Working…'}
 try{const r=await api('/projects/'+state.project.id+'/stores',{method:'POST',body});renderStores(r.stores);return r}
 catch(err){text($('store-error'),err.message)}
 finally{if(btn){btn.disabled=false;btn.textContent=was}}
}
$('stores-open').onclick=()=>{text($('store-error'),'');$('stores-dialog').showModal();loadStores(true)};
$('stores-dialog').addEventListener('close',()=>clearTimeout(storeState.timer));
$('store-prepare').onclick=e=>{text($('store-prep-note'),'Writing the listing and taking screenshots… (about a minute)');storeCall({action:'prepare'},e.currentTarget).finally(()=>text($('store-prep-note'),'Check the text and the pictures. You can change anything before you build.'))};
$('store-save').onclick=e=>storeCall({action:'update',listing:{name:$('st-name').value,subtitle:$('st-subtitle').value,promo:$('st-promo').value,description:$('st-description').value,keywords:$('st-keywords').value,category:$('st-category').value,privacy_url:$('st-privacy').value.trim(),support_url:$('st-support').value.trim()},...($('st-bundle').disabled?{}:{bundle_id:$('st-bundle').value.trim()}),...($('st-package').disabled?{}:{package_name:$('st-package').value.trim()})},e.currentTarget);
$('store-apple').onclick=async e=>{const r=await storeCall({action:'apple',keyId:$('st-asc-key').value.trim(),issuerId:$('st-asc-issuer').value.trim(),p8:$('st-asc-p8').value},e.currentTarget);if(r){$('st-asc-p8').value='';$('st-asc-key').value='';$('st-asc-issuer').value=''}};
$('store-google').onclick=async e=>{const r=await storeCall({action:'google',serviceAccount:$('st-play').value},e.currentTarget);if(r)$('st-play').value=''};
$('store-ios').onclick=e=>storeCall({action:'publish',platform:'ios'},e.currentTarget);
$('store-android').onclick=e=>storeCall({action:'publish',platform:'android'},e.currentTarget);
// ---------- editor ----------
async function openProject(id,{pendingText,job}={}){
 document.querySelector('.ask-dock')?.remove();document.body.classList.remove('asking');
 const {project,account,active_job}=await api('/projects/'+id);
 const previousProject=state.project&&state.project.id;
 state.project=project;
 if(previousProject&&previousProject!==project.id)window.kairoqBrowserPane?.reset();
 if(previousProject&&previousProject!==project.id){buildWaiting(null);state.firstBuild=false}
 if(account)renderCredits(account);
 show('editor');history.replaceState(null,'','/create?'+(EMBED?'embed=1&':'')+'project='+encodeURIComponent(id));
 if(window.parent!==window)window.parent.postMessage({kairoq:'project',id:project.id,name:project.name},location.origin);
 applyRole();
 $('project-name').value=project.name;
 if(!state.projects)api('/projects').then(r=>renderRecents(r.projects)).catch(()=>{});else markRecent(id);
 renderTiers();setChatMode(state.mode);
 renderMessages(pendingText);
 starterWaiting(Boolean(project.starter)&&!job&&!active_job);
 formaRows();
 renderVersions();
 device(Boolean(project.mobile&&project.mobile.enabled)||Boolean(project.native));
 $('run-phone').classList.toggle('hidden',!project.native);$('stores-open').classList.toggle('hidden',!project.native);
 setPreview(project.preview_url);
 renderSamplePill();
 if(state.code)await renderFiles();
 if(state.data)await renderData();
 if(job||active_job)watch(job||active_job);
}
// Next-step chips above the message box: one click builds that idea. Cleared once you send.
function renderIdeas(m){
 const box=$('composer-ideas');if(!box)return;box.replaceChildren();
 const can=m&&m.role==='assistant'&&!state.job&&state.project?.role!=='viewer';
 // What is left to do comes first: one chip that fixes the "Not done yet" list.
 const left=can?(verdictParts(m.text)||{todo:[]}).todo:[];
 const chips=[];
 if(left.length)chips.push({label:'Fix what is not done yet',ask:'Fix what is not done yet: '+left.join('; ')});
 for(const idea of can&&Array.isArray(m.ideas)?m.ideas:[])chips.push({label:idea,ask:/^(add|make|create|build|show|let|use|turn|put|change|connect|allow|improve|redesign|translate|write|map|design|draft|plan|outline|list|sketch|define|test|verify|check|review|compare|set|track|send|fix|move|rename|remove|hide|split|link|import|export)\b/i.test(idea)?idea:'Add '+idea.charAt(0).toLowerCase()+idea.slice(1)});
 const ideas=chips.slice(0,3);
 box.classList.toggle('hidden',!ideas.length);
 // Like Lovable: small pills above the message box; a click puts the step in the box to send or change.
 for(const {label:idea,ask} of ideas){
  const b=el('button','idea-chip');b.type='button';b.title=idea;
  b.append(el('span','idea-text',idea));
  b.onclick=()=>{const t=$('chat-input');t.value=ask;t.dispatchEvent(new Event('input',{bubbles:true}));box.classList.add('hidden');t.focus();t.setSelectionRange(t.value.length,t.value.length)};
  box.append(b);
 }
}
function doneLine(m){
 const li=el('li','agent-done');li.setAttribute('role','presentation');
 const t=m.at?new Date(m.at):null,ok=t&&!isNaN(t);
 const tick=el('span','agent-done-tick');tick.setAttribute('aria-hidden','true');tick.innerHTML='<svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7"/></svg>';
 li.append(tick,el('span','agent-done-t','Kairoq Agent finished'),el('span','agent-done-line'),el('time','agent-done-at',ok?t.toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):''));
 if(ok)li.querySelector('time').dateTime=t.toISOString();
 return li;
}
function renderMessages(pendingText){
 const list=$('messages');list.replaceChildren();
 const msgs=state.project.messages;
 if(!msgs.length&&!pendingText){const li=document.createElement('li');li.className='assistant';li.textContent='Tell me what to build or change. Switch to Discuss to plan without changing code.';list.append(li)}
 const questionIndex=msgs.findLastIndex(m=>m.role==='assistant'&&m.question&&m.question.text===state.project.pending_question?.text);
 msgs.forEach((m,i)=>list.append(messageItem(m,i===msgs.length-1||i===questionIndex,i)));
 if(pendingText){const mine=messageItem({role:'user',text:pendingText});mine.classList.add('enter');list.append(mine)}
 // Like Emergent: a quiet "finished" line under the last piece of work.
 const end=msgs[msgs.length-1];
 if(!pendingText&&!state.job&&end&&end.role==='assistant'&&end.duration_ms!=null&&!end.failed&&!end.version)list.append(doneLine(end));
 renderIdeas(pendingText?null:msgs[msgs.length-1]);
 list.scrollTop=list.scrollHeight;
 renderErrors();
}
// A reply stored as raw JSON (the builder's own format) reads as its message, plan and question.
function readable(t){
 const s=String(t||'').trim();
 if(!/^(?:```(?:json)?\s*)?\{/.test(s))return s;
 try{
  const v=JSON.parse(s.replace(/^```(?:json)?\s*/,'').replace(/```\s*$/,''));
  const q=v.question||v.before_building||v.ask,qt=typeof q==='string'?q:q&&q.text;
  const plan=Array.isArray(v.plan)?v.plan.map(x=>'- '+x).join('\n'):'';
  return[v.message,plan,qt?'**'+qt+'**':''].filter(Boolean).join('\n\n')||s;
 }catch{return s}
}
// Under each answer, like Lovable: copy, thumbs up, thumbs down (kept on the message).
function replyActions(m,index){
 const bar=el('div','reply-actions');
 const svg=d=>{const n=document.createElementNS('http://www.w3.org/2000/svg','svg');n.setAttribute('viewBox','0 0 24 24');n.setAttribute('aria-hidden','true');n.classList.add('ico');n.innerHTML=d;return n};
 const ICON={up:'<path d="M7 11v9H4v-9zM7 11l4-7a2 2 0 0 1 3 2l-1 4h5a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 16.8 20H7"/>',down:'<path d="M17 13V4h3v9zM17 13l-4 7a2 2 0 0 1-3-2l1-4H6a2 2 0 0 1-2-2.3l1.2-6A2 2 0 0 1 7.2 4H17"/>',copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'};
 const btn=(name,label)=>{const b=el('button','reply-act');b.type='button';b.title=label;b.setAttribute('aria-label',label);b.append(svg(ICON[name]));return b};
 const copy=btn('copy','Copy');copy.onclick=async()=>{try{await navigator.clipboard.writeText(String(m.text||''));copy.title='Copied';copy.classList.add('done');setTimeout(()=>{copy.classList.remove('done');copy.title='Copy'},1400)}catch{}};
 const up=btn('up','Good answer'),down=btn('down','Bad answer');
 const paint=r=>{up.setAttribute('aria-pressed',String(r==='up'));down.setAttribute('aria-pressed',String(r==='down'))};paint(m.rating);
 const rate=async want=>{const next=m.rating===want?null:want;paint(next);try{const r=await api('/projects/'+state.project.id+'/rating',{method:'POST',body:{at:m.at,rating:next}});m.rating=r.rating||undefined;paint(m.rating)}catch{paint(m.rating)}};
 up.onclick=()=>rate('up');down.onclick=()=>rate('down');
 bar.append(copy,up,down);
 return bar;
}
function messageItem(m,last,index){
 const li=document.createElement('li');li.className=m.role+(m.mode==='discuss'?' discuss':'')+(m.failed?' failed':'');
 const tl=m.timeline||[];
 if(m.role==='assistant'){
  // Like Lovable: "Thought for Ns", the answer (formatted), then what was done, folded.
  const think=tl.find(e=>e.t==='think');
  const thoughtMs=m.thought_ms!=null?m.thought_ms:think?think.ms:null;
  // "Worked for 41s · 9 steps": the steps fold out under it (like a coding agent's log); Details has the rest.
  if((thoughtMs!=null||tl.length)&&index>=0){
   const steps=tl.filter(e=>e.t!=='note'||e.icon).length;
   // Just how long it worked; the steps stay folded behind it (like Lovable and Emergent, the
   // owner sees the work, then what was done, not a log).
   const label=m.duration_ms!=null?'Worked for '+secsShort(m.duration_ms):thoughtMs!=null?'Thought for '+secsShort(thoughtMs):'Worked for '+secsShort(0);
   const b=el('button','status-line done');b.type='button';b.setAttribute('aria-expanded','false');b.append(el('span','agent-name','Kairoq Agent'),el('span','status-text',label),icon('chev'));
   const rail=el('ol','rail done'),fold=el('div','fold');fold.append(rail);
   // Like Emergent: each step is a slim row (an icon, what was done, the file); an edit opens its diff.
   // The latest reply shows its steps; older replies keep them folded.
   const fill=()=>{if(!rail.childElementCount)for(const e of tl.filter(e=>e.t!=='say'&&(e.t!=='think'||e.text||e.note)))rail.append(eventRow(e,{expand:true,version:m.version}))};
   b.onclick=()=>{fill();const open=fold.classList.toggle('open');b.setAttribute('aria-expanded',String(open))};
   li.append(b,fold);
  }
  // Like Lovable: what Kairoq said while it worked (a grey heading, its line under it, the
  // thinking folded), then one card for the change (Details, Preview), then its message.
  const story=storyRows(tl);if(story)li.append(story);
  if(m.version&&index>=0)li.append(resultCard(m,index));
  const verdict=verdictCard(m.text,m);
  if(verdict)li.append(...verdict);else li.append(renderMarkdown(readable(m.text)));
  // The builder's open question: one click answers it and builds (asking was free).
  if(last&&m.question&&Array.isArray(m.question.options)&&m.question.options.length){
   const q=el('div','question-options');
   m.question.options.forEach((o,i)=>{
    const rec=i===m.question.recommended,b=el('button','q-opt'+(rec?' recommended':''),o);b.type='button';
    if(rec)b.append(el('span','q-tag','Recommended'));
    b.onclick=()=>{q.querySelectorAll('button').forEach(x=>{x.disabled=true});send(o,'build')};
    q.append(b);
   });
   li.append(q,el('p','q-hint','Pick one, or type your own answer. "ok" goes with the recommended option.'));
  }
  // Suggested next steps sit in the message box (renderIdeas), like Emergent; only an old reply
  // shown on its own (index==null) still carries them inline.
  if(last&&index==null&&Array.isArray(m.ideas)&&m.ideas.length){
   const q=el('div','idea-list');
   for(const idea of m.ideas){
    const ask=/^(add|make|create|build|show|let|use|turn|put|change|connect|allow|improve|redesign|translate|write|map|design|draft|plan|outline|list|sketch|define|test|verify|check|review|compare|set|track|send|fix|move|rename|remove|hide|split|link|import|export)\b/i.test(idea)?idea:'Add '+idea.charAt(0).toLowerCase()+idea.slice(1);
    const b=el('button','q-opt idea',idea);b.type='button';b.title='Build this: '+ask;
    b.onclick=()=>{q.querySelectorAll('button').forEach(x=>{x.disabled=true});send(ask,'build')};
    q.append(b);
   }
   li.append(q,el('p','q-hint','Pick an idea to build it, or tell me what you want.'));
  }
  // The same steps already fold out under "Worked for …"; list them here only when that line is absent.
  const acts=tl.filter(e=>e.t!=='think'&&e.t!=='plan'&&e.t!=='say');
  if(acts.length&&!((thoughtMs!=null||tl.length)&&index>=0)){
   const d=el('details','acts'),s=el('summary');s.append(icon('down','toggle'),el('span',null,summarize(tl)||acts.length+' steps'));
   d.append(s,rail(acts.slice(0,30),{}));li.append(d);
  }
 }else if(m.role==='user'&&/\n\n(Details from the owner|Approved plan \(build exactly this first version\)):\n/.test(m.text||''))li.append(requestCard(m.text));
 else{const body=el('div','msg-text');body.textContent=m.text;li.append(body)}
 if(m.role==='assistant'&&m.failed&&m.retry&&(last||index==null)){const b=el('button','ghost retry','Try again');b.type='button';b.onclick=()=>{b.disabled=true;send(m.retry,m.retry_mode==='discuss'?'discuss':m.retry_mode==='agent'?'agent':'build')};li.append(b)}
 if(m.images&&m.images.length){const s=document.createElement('span');s.className='changed';s.textContent='Attached: '+m.images.join(', ');li.append(s)}
 if(m.design){const d=document.createElement('div');d.className='design-chip';for(const c of Object.values(m.design.palette||{}).slice(0,6)){const i=document.createElement('i');i.style.background=c;d.append(i)}d.append(document.createTextNode('Style: '+m.design.name+(m.design.fonts?' · '+m.design.fonts.display+' / '+m.design.fonts.body:'')));li.append(d)}
 if(m.generated&&m.generated.length&&state.project){const g=document.createElement('div');g.className='generated';for(const n of m.generated){const img=document.createElement('img');img.alt=n;img.title='./uploads/'+n;img.loading='lazy';img.src='/api/create/projects/'+state.project.id+'/asset?name='+encodeURIComponent(n);g.append(img)}li.append(g)}
 if(m.role==='assistant'&&m.scope&&m.scope.length){const d=el('div','scope-chip');const plain={'saved data and bookings':'how the app saves information (like enquiries or bookings)','payments':'payments','sign-in':'a sign-in'};const t=el('span',null,'I also changed '+m.scope.map(f=>plain[f.area]||f.area).join(' and ')+', which you didn\'t ask for.');t.title=[...new Set(m.scope.flatMap(f=>f.files))].slice(0,8).join(', ');d.append(icon('note'),t);
  // One click back to the version before this change.
  if(m.version>1&&state.project.role!=='viewer'&&m.version===state.project.current_version){const u=el('button','link-btn','Undo this change');u.type='button';u.onclick=async()=>{u.disabled=true;try{const {project}=await api('/projects/'+state.project.id+'/restore',{method:'POST',body:{version:m.version-1}});state.project=project;renderMessages();renderVersions();setPreview(project.preview_url)}catch(err){u.disabled=false;u.textContent=err.message}};d.append(u)}li.append(d)}
 if(m.role==='assistant'&&m.memory){const bits=[...(m.memory.recipes||[]).map(t=>'Used your recipe: '+t),...(m.memory.recalled?['Looked at your project “'+m.memory.recalled+'”']:[]),...(m.memory.learned||[]).map(t=>'Remembered: '+t)];if(bits.length){const d=el('div','memory-chip');d.append(icon('think'),el('span',null,bits.join(' · ')));d.title='Open Memory to see or change this';d.onclick=()=>openMemory();li.append(d)}}
 // Sources: one quiet line of the sites it read ("Read 2 pages · xero.com · waveapps.com").
 if(m.role==='assistant'&&Array.isArray(m.sources)&&m.sources.length){const list=m.sources.slice(0,8),s=el('div','sources');s.append(el('span','sources-label','Read '+list.length+' page'+(list.length===1?'':'s')));for(const src of list){let host=src.url;try{host=new URL(src.url).hostname.replace(/^www\./,'')}catch{}const a=el('a','source',host);a.href=src.url;a.target='_blank';a.rel='noopener noreferrer';a.title=(src.title&&src.title!==src.url?src.title+' — ':'')+src.url;s.append(a)}li.append(s)}
 if(m.role==='assistant'&&!m.failed&&m.at&&String(m.text||'').trim()&&Number.isInteger(index)&&index>=0&&state.project&&state.project.role!=='viewer')li.append(replyActions(m,index));
 if(m.role==='assistant'&&!tl.length&&m.changed&&m.changed.length){const c=el('div','file-chips done');for(const f of m.changed.slice(0,12))c.append(fileChip(f));if(m.changed.length>12)c.append(el('span','chip more','+'+(m.changed.length-12)+' more'));li.append(c)}
 if(m.role==='assistant'&&(m.version||m.credits!=null)&&index!=null){
  const f=el('div','msg-meta');
  if(m.version)f.append(el('span','ver','v'+m.version));
  if(m.duration_ms!=null){const t=el('span');t.append(icon('clock'),secs(m.duration_ms));f.append(t)}
  if(m.credits!=null){const t=el('span');t.append(icon('coin'),creditsLabel(m));t.title='What this change cost';f.append(t)}
  if(m.attempts>1)f.append(el('span',null,'Fixed '+(m.attempts-1)+' problem'+(m.attempts>2?'s':'')));
  // Which model wrote this version (quality.js), so the owner always knows.
  if(m.built_by&&m.built_by.label){const t=el('span','built-by',m.built_by.label+(m.built_by.agent?' (agent)':''));t.title='The AI model that wrote this version';f.append(t)}
  const det=el('button','link-btn details-link','Details');det.type='button';det.onclick=()=>openDetail(index,'timeline');f.append(det);
  li.append(f);
 }
 if(m.role==='assistant'&&(m.verified||m.tests_added))li.append(verifiedCard(m.verified||{},m.checks,m.tests_added));
 // What the screenshot review saw (look-check.js): it matched, or what it fixed.
 // The owner is told when a build ran on a cheaper model than the top ones (budget, credits, an outage).
 if(m.role==='assistant'&&m.built_by&&m.built_by.cheap&&state.me&&state.me.viewer&&state.me.viewer.kind==='owner'){const d=el('p','look-note warn');d.append(el('span','vmark','!'),el('span',null,'Built with '+m.built_by.label+', not a top model. The top models were not used: check OpenRouter credits and the AI budget limits in Railway.'));li.append(d)}
 if(m.role==='assistant'&&m.craft){const d=el('p','look-note');d.append(el('span','vmark','✓'),el('span',null,m.craft));li.append(d)}
 if(m.role==='assistant'&&m.look){const d=el('p','look-note');d.append(el('span','vmark',m.look.ok?'✓':'↻'),el('span',null,m.look.ok?'Checked the screenshots: it looks the way you asked.':m.look.fixed?'Checked the screenshots and fixed: '+m.look.problems.join(' '):'The screenshots show: '+m.look.problems.join(' ')+' Ask again to fix it.'));li.append(d)}
 if(m.role==='assistant'&&m.feature_acceptance?.requested){
  const a=m.feature_acceptance,box=el('div','verified '+(a.allPassed?'ok':'bad'));
  box.append(el('div','verified-head',a.passed+' of '+a.requested+' requested features verified'));
  const ul=el('ul');
  for(const result of a.results||[]){const pass=result.status==='passed',item=el('li',pass?'ok':'bad');
   item.append(el('span','vmark',pass?'✓':'?'),el('span',null,result.label+': '+(pass?'browser journey passed':'not verified')));
   if(!pass&&result.reason)item.title=result.reason;
   ul.append(item);
  }
  box.append(ul);li.append(box);
 }
 if(m.checks&&!tl.some(e=>e.t==='check')){const c=document.createElement('div');c.className='check-chip '+(m.checks.failed.length?'bad':'ok');c.textContent=m.checks.failed.length?'✗ Broke '+m.checks.failed.length+' of '+m.checks.ran+' saved checks: '+m.checks.failed.join(', '):'✓ All '+m.checks.ran+' saved check'+(m.checks.ran===1?'':'s')+' passed';li.append(c)}
 if(m.steps&&m.steps.length&&!tl.length){const d=document.createElement('details'),s=document.createElement('summary');s.textContent='Agent steps ('+m.steps.length+')';const ol=document.createElement('ol');ol.className='agent-steps';for(const st of m.steps){const li2=document.createElement('li');li2.textContent=st;ol.append(li2)}d.append(s,ol);li.append(d)}
 if(m.role==='assistant'&&m.mode==='discuss'&&m.proposal&&!m.question&&!m.failed&&last){const b=document.createElement('button');b.type='button';b.className='ghost small-btn';b.textContent='Review & build';b.onclick=()=>{
   const chosen=(state.me?.models||[]).find(x=>x.id===state.model&&x.credits);
   const tier=(state.me?.tiers||[]).find(x=>x.id===state.tier);
   const credits=chosen?.credits??tier?.credits??1;
   const price=state.me?.viewer?.kind==='customer'?credits+' credit'+(credits===1?'':'s'):'owner account (no credits)';
   if(!window.confirm('Build the proposed changes to this project?\\n\\nEstimated cost: '+price+'.\\nChatting is free; this action generates code and may use credits.'))return;
   b.disabled=true;setChatMode('build');send('Implement this plan.','build','/chat',{implementFrom:m.at});
  };li.append(b)}
 if(m.role==='assistant'){
  const extra=[...li.children].filter(n=>n.matches('.acts,.design-chip,.memory-chip,.file-chips.done,.msg-meta,.look-note:not(.warn),.check-chip:not(.bad),.agent-steps,.verified.ok,.verified-quiet'));
  // A build folds its extras under "Build details". A chat reply drops its cost line (credits still
  // show in Usage), so most replies have no fold at all; other notes stay folded under "Details".
  // A finished agent build is just its message: no "Build details" fold under it.
  const quiet=m.version&&verdictParts(m.text);if(quiet)for(const n of extra)n.remove();
  const kept=quiet?[]:m.version?extra:extra.filter(n=>{if(n.matches('.msg-meta')){n.remove();return false}return true});
  // When the result card is shown, its Details button already opens the build, so no fold repeats it.
  const card=li.querySelector('.ks-card');if(card)for(const n of kept)n.remove();
  if(kept.length&&!card){const details=el('details','message-details'),summary=el('summary',null,m.version?'Build details':'Details');details.append(summary,...kept);li.append(details);}
 }
 return li;
}
// The agent's finished message (engineering-completion-gate.js resultMessage) is stored as
// "VERIFIED BUILD / UNVERIFIED DRAFT · … \n\nPROOF\n- Build: passed …\n\nBuilder notes: …".
// In the chat it reads as one plain sentence, the notes, and the checks as a short list.
// The finished build as a short write-up, like Emergent: the verdict and one-line result, then
// "What's there" (the pages written), "What I tested" (the checks that passed), "Not done yet"
// (what failed or is still open, in plain words) and "Agent finished · 12m 04s".
function verdictParts(raw){
 const m=/^(VERIFIED BUILD|UNVERIFIED DRAFT)[^\n]*\n+PROOF\n([\s\S]*?)(?:\n\n(?:Builder notes:\s*)?([\s\S]*))?$/.exec(String(raw||'').trim());
 if(!m)return null;
 const ok=m[1]==='VERIFIED BUILD';
 const rows=m[2].split('\n').map(l=>/^- ([^:]+): (.*)$/.exec(l)).filter(Boolean).map(r=>({label:r[1],value:r[2]}));
 const unresolved=((rows.find(r=>r.label==='Unresolved')||{}).value||'').trim();
 const NAMES={Build:'Builds','Browser':'Opens and works in a browser','Visual quality':'Looks right','Verification tests':'Tests','Regression checks':'Saved checks','Engineering review':'Code review'};
 const shown=rows.filter(r=>NAMES[r.label]&&!/^not-required|^skipped/.test(r.value));
 const tested=[],todo=[];
 for(const r of shown){
  const pass=/^passed/.test(r.value),detail=r.value.replace(/^(passed|failed)\s*(·\s*)?/,'').replace(/interaction step\(s\)/,'actions tried').trim();
  if(pass)tested.push(NAMES[r.label]+(detail?' · '+detail:''));
  else todo.push(NAMES[r.label]+': '+(detail.replace(/^failed/,'').trim()||'did not pass'));
 }
 // The open problem in its own words says more than "Looks right: did not pass"; show that instead.
 if(unresolved&&unresolved!=='none'){for(let i=todo.length-1;i>=0;i--)if(/: did not pass$/.test(todo[i]))todo.splice(i,1);todo.push(unresolved)}
 let notes=String(m[3]||'').trim();
 notes=notes.replace(/^Stopped after (\d+) steps?\.\s*(The last changes did not build, so the last working build was saved\.)?\s*/,(_,n,kept)=>'I used all '+n+' rounds before every check passed'+(kept?', so the last working build is what you see':'')+'. ');
 const repairs=Number((rows.find(r=>r.label==='Repair attempts')||{}).value)||0;
 return{ok,tested,todo,notes,repairs};
}
function storyRow(e){
 const row=el('div','ks-step');
 if(e.title){
  const h=el('button','ks-head',e.title);h.type='button';
  if(e.note){h.append(icon('chev','ks-chev'));h.setAttribute('aria-expanded','false');
   h.onclick=()=>{const open=h.getAttribute('aria-expanded')!=='true';h.setAttribute('aria-expanded',String(open));let n=row.querySelector('.ks-note');if(open&&!n){n=el('div','ks-note');n.append(icon('think'),el('p',null,e.note));h.after(n)}else if(!open&&n)n.remove()}}
  else h.disabled=true;
  row.append(h);
 }
 if(e.text){const p=el('p','ks-say');inlineMd(p,e.text);row.append(p)}
 return row;
}
// The line above the message box while a job runs: the project, then what Kairoq is doing now
// (its latest heading, or the stage in plain words). Stop is the editor's own Stop.
function liveStrip(j){
 const s=$('ks-strip');if(!s)return;
 if(!j||j.status==='complete'||j.status==='failed'){s.classList.add('hidden');return}
 // Present tense, what is happening now (the chat above already has the past-tense headings).
 const line=liveStatus(j);
 text($('ks-strip-name'),(state.project?.name||'Kairoq')+': ');
 const t=$('ks-strip-line');if(t.textContent!==line){t.textContent=line;t.classList.remove('in');void t.offsetWidth;t.classList.add('in')}
 s.classList.remove('hidden');
}
function storyRows(tl){const says=(tl||[]).filter(e=>e.t==='say'&&(e.text||e.title));if(!says.length)return null;const box=el('div','ks-story');for(const e of says)box.append(storyRow(e));return box}
// The change as one card: its title, Details (the steps and files) and Preview (that version).
function resultCard(m,index){
 const ver=(state.project?.versions||[]).find(v=>v.n===m.version);
 // What was built ("Built a tip calculator"), not just "Version 2": the title, else the version's summary.
 const title=m.title||String(ver?.title||ver?.summary||'').replace(/\.$/,'')||'Version '+m.version;
 const card=el('div','ks-card'),head=el('div','ks-card-head');
 head.append(el('span','ks-card-title',title),el('span','ks-card-v','v'+m.version));
 const row=el('div','ks-card-btns'),det=el('button','ks-btn','Details'),pre=el('button','ks-btn','Preview');det.type=pre.type='button';
 det.onclick=()=>openDetail(index,'timeline');
 pre.onclick=()=>{if($('versions'))$('versions').value=String(m.version);setPreview(previewFor(m.version));const tab=document.querySelector('#phone-panes [data-pane=preview]');if(tab&&getComputedStyle($('phone-panes')).display!=='none')tab.click()};
 row.append(det,pre);card.append(head,row);return card;
}
function verdictCard(raw,msg={}){
 const v=verdictParts(raw);if(!v)return null;
 // Only what was done, in Kairoq Agent's own words (agent-reply.js). The checks it ran stay in
 // the version's data; the chat doesn't list them.
 return[renderMarkdown(v.notes||(v.ok?'Done.':"Done, but some checks didn't pass yet. Try it in the preview and tell me what to fix."))];
}
// "Verified by Kairoq": what its browser tested on this build, like a customer would.
function verifiedCard(v,checks,added){
 const rows=[];
 const add=(ok,good,bad)=>{if(ok===null||ok===undefined)return;rows.push([ok,ok?good:bad])};
 add(v.opens,'Opens without errors','Shows errors when it opens');
 if(v.menus)add(!v.menus.dead,v.menus.checked+' menu item'+(v.menus.checked===1?'':'s')+' and buttons work',v.menus.dead+' of '+v.menus.checked+' menu items do nothing');
 add(v.phone,'Fits a phone screen','Scrolls sideways on a phone');
 add(v.signup,'Sign-up works','Sign-up failed');
 add(v.saves,'Added a record and it was saved','A new record was not saved');
 if(checks&&checks.ran)add(!checks.failed.length,'All '+checks.ran+' saved check'+(checks.ran===1?'':'s')+' still pass',checks.failed.length+' saved check'+(checks.failed.length===1?'':'s')+' broke');
 if(added&&added.length)add(true,'New check'+(added.length===1?'':'s')+' kept for every later change: '+added.join(', '),'');
 if(!rows.length)return document.createTextNode('');
 const all=rows.every(r=>r[0]);
 const box=el('div','verified '+(all?'ok':'bad'));
 box.append(el('div','verified-head',all?'Browser checks passed':'Browser checks found problems'));
 const ul=el('ul');for(const [ok,t] of rows){const li=el('li',ok?'ok':'bad');li.append(el('span','vmark',ok?'✓':'✗'),el('span',null,t));ul.append(li)}
 box.append(ul);
 const actualFlows=checks&&checks.ran>0&&Array.isArray(checks.failed)&&checks.failed.length===0;
 const note=el('p','verification-scope',actualFlows?'Kairoq tested the basics above and your saved checks. Anything else in this change was not tested, so try it in the preview.':'Kairoq opened the app in a browser and checked the basics above. It did not test the new feature itself, so try it in the preview.');
 box.append(note);
 box.title='Browser check scope only; this is not certification that the whole application is complete.';
 // When everything passed, nothing shows under the reply: the results stay in Details.
 // Only problems are shown, so they are seen.
 if(all)return document.createTextNode('');
 return box;
}
function renderVersions(){
 const sel=$('versions');sel.replaceChildren();
 for(const v of [...state.project.versions].reverse()){const o=document.createElement('option');o.value=v.n;o.textContent='v'+v.n+' · '+(v.broken?'⚠ did not load · ':'')+(v.summary||'').slice(0,40);if(v.n===state.project.current_version)o.selected=true;sel.append(o)}
}
function previewFor(n){return state.project.preview_url.replace(/\/v\/\d+\/$/,'/v/'+n+'/')}
function setPreview(url){if(!url)return;setTimeout(()=>refreshWindow&&refreshWindow(),0);$('frame-next')?.remove();state.previewBase=url;state.runtimeErrors=[];renderErrors();state.selected=null;renderVisual();$('frame').src=url;$('open').href=url;$('preview-open').href=url;watchPreview()}
// A new version is loaded behind the one on screen and swapped in once it has drawn, so the
// preview never flashes white, and it opens on the page the owner was looking at.
function routeFor(url){const r=state.previewRoute||'';return r&&/\/v\/\d+\/$/.test(url)?url+r:url}
function swapPreview(url){
 const old=$('frame');
 if(url&&url!==state.previewBase)starterWaiting(false);
 if(!url||url===state.previewBase)return;
 if(!old||!old.getAttribute('src')||old.classList.contains('hidden')||!old.offsetWidth)return setPreview(url);
 $('frame-next')?.remove();
 const next=document.createElement('iframe');
 next.id='frame-next';next.title=old.title;next.setAttribute('sandbox',old.getAttribute('sandbox'));next.setAttribute('aria-hidden','true');next.tabIndex=-1;
 Object.assign(next.style,{position:'absolute',left:old.offsetLeft+'px',top:old.offsetTop+'px',width:old.offsetWidth+'px',height:old.offsetHeight+'px',opacity:'0',pointerEvents:'none',border:'0'});
 old.after(next);state.previewBase=url;
 let shown=false;
 const show=()=>{
  if(shown||!next.isConnected)return;shown=true;clearTimeout(timer);
  // Fade the new version in over the old one, then drop the old one.
  const fade=matchMedia('(prefers-reduced-motion: reduce)').matches?0:260;
  next.style.transition='opacity '+fade+'ms ease';next.style.opacity='1';
  setTimeout(()=>{if(!next.isConnected)return;
  old.remove();for(const a of ['style','aria-hidden','tabindex'])next.removeAttribute(a);next.id='frame';
  state.runtimeErrors=[];renderErrors();state.selected=null;renderVisual();
  $('open').href=url;$('preview-open').href=url;state.previewReady=true;clearTimeout(state.previewTimer);$('preview-notice').classList.add('hidden');
  },fade);
 };
 // "load" fires when the files are in; a short wait lets React draw the first screen.
 next.addEventListener('load',()=>setTimeout(show,350));
 const timer=setTimeout(show,8000);
 next.src=routeFor(url);
}
// The preview reports "ready" once it has rendered; when nothing arrives, say so instead of showing a blank frame.
function watchPreview(){state.previewReady=false;$('preview-notice').classList.add('hidden');text($('preview-diagnosis'),'');clearTimeout(state.previewTimer);state.previewTimer=setTimeout(()=>{if(!state.previewReady&&!$('frame').classList.contains('hidden')){$('preview-notice').classList.remove('hidden');diagnosePreview()}},9000)}
// When the preview does not load, Kairoq opens it in its own browser on the server: either the
// app itself breaks (the errors go to the Fix it bar) or it works there and the visitor's
// browser is blocking it.
async function diagnosePreview(){
 if(!state.project||state.diagnosing)return;state.diagnosing=true;
 const out=$('preview-diagnosis');text(out,'Checking it in Kairoq\'s browser…');
 try{
  const r=await api('/projects/'+state.project.id+'/diagnose',{method:'POST',body:{version:previewVersion()}});
  if(state.previewReady)return text(out,'');
  if(r.skipped)text(out,'');
  else if(!r.errors.length)text(out,'It works in Kairoq\'s browser, so something here is blocking it. Try opening it in a new tab.');
  else{text(out,'The app has an error: '+r.errors[0].slice(0,140)+'. Use Fix it above, it\'s free.');for(const e of r.errors)if(!state.runtimeErrors.includes(e)&&state.runtimeErrors.length<10)state.runtimeErrors.push(e);renderErrors()}
 }catch(err){text(out,'')}
 finally{state.diagnosing=false}
}
$('preview-reload').onclick=()=>{const f=$('frame');const u=f.src;f.src='about:blank';setTimeout(()=>{f.src=u;watchPreview()},50)};
// Builds the shown version again from its saved code on the server (free), then reloads it.
async function rebuildPreview(){
 if(!state.project)return;
 const st=$('preview-rebuild-status'),btn=$('preview-rebuild');btn.disabled=true;text(st,'Rebuilding…');
 try{const r=await api('/projects/'+state.project.id+'/rebuild',{method:'POST',body:{version:previewVersion()}});text(st,'');setPreview(r.preview_url)}
 catch(err){text(st,err.message)}
 finally{btn.disabled=false}
}
$('preview-rebuild').onclick=rebuildPreview;
$('versions').onchange=()=>setPreview(previewFor($('versions').value));
$('restore').onclick=async()=>{
 const n=Number($('versions').value);if(n===state.project.current_version)return;
 const {project}=await api('/projects/'+state.project.id+'/restore',{method:'POST',body:{version:n}});
 state.project=project;renderMessages();renderVersions();setPreview(project.preview_url);
};
$('back').onclick=()=>{closeDetail();state.project=null;loadHome()};
$('project-name').onchange=async()=>{try{const {project}=await api('/projects/'+state.project.id,{method:'PATCH',body:{name:$('project-name').value}});state.project.name=project.name}catch{}};
// The preview as a real device: iPhone (Dynamic Island, status bar, Safari's address bar, home bar),
// iPhone SE, a Pixel or an iPad, at its true size in CSS pixels and scaled down to fit the screen.
// "Real Safari" opens the page in Safari's own engine (WebKit) on the server and shows that screenshot.
const MODELS={
 iphone16:{label:'iPhone 16',w:393,h:852,top:54,urlTop:0,bottom:84,radius:55,island:true,os:'ios'},
 iphone16max:{label:'iPhone 16 Pro Max',w:440,h:956,top:62,urlTop:0,bottom:84,radius:62,island:true,os:'ios'},
 iphonese:{label:'iPhone SE',w:375,h:667,top:20,urlTop:0,bottom:74,radius:0,island:false,os:'ios',home:true},
 pixel:{label:'Pixel 9',w:412,h:923,top:32,urlTop:56,bottom:24,radius:42,island:false,os:'android'},
 ipad:{label:'iPad mini',w:744,h:1133,top:24,urlTop:50,bottom:20,radius:22,island:false,os:'ipados'}};
state.deviceModel=(()=>{try{return localStorage.getItem('kq-device')||'iphone16'}catch{return'iphone16'}})();
if(!MODELS[state.deviceModel])state.deviceModel='iphone16';
// The phone button goes back to the last phone picked (the tablet has its own button).
state.lastPhone=state.deviceModel==='ipad'?'iphone16':state.deviceModel;
function fitDevice(){
 const d=$('device'),m=MODELS[state.deviceModel];if(!d||d.classList.contains('desktop')||!m)return;
 // Room for the floating preview bar under the device, so it never covers the home bar.
 const c=$('canvas'),pad=28,bar=c.querySelector('.pv-float:not(.min)')?64:0,bez=m.home?72:24;
 const scale=Math.min(1,(c.clientHeight-pad-bar)/(m.h+bez),(c.clientWidth-pad)/(m.w+24));
 d.style.setProperty('--dev-scale',String(Math.max(0.3,scale)));
}
function device(mobile){
 const m=MODELS[state.deviceModel],d=$('device');
 const tablet=mobile&&state.deviceModel==='ipad';
 $('canvas').classList.toggle('mobile',mobile);$('desktop').setAttribute('aria-pressed',String(!mobile));$('mobile').setAttribute('aria-pressed',String(mobile&&!tablet));$('tablet')?.setAttribute('aria-pressed',String(tablet));
 const hidden=d.classList.contains('hidden');
 d.className='device '+(hidden?'hidden ':'')+(mobile?'phone '+m.os+(m.island?' island':'')+(m.home?' homebutton':''):'desktop');
 for(const [k,v] of Object.entries({'--dev-w':m.w+'px','--dev-h':m.h+'px','--dev-top':m.top+'px','--dev-url':m.urlTop+'px','--dev-bottom':m.bottom+'px','--dev-radius':m.radius+'px'}))d.style.setProperty(k,v);
 $('device-model').classList.toggle('hidden',!mobile||tablet);if(!tablet)$('device-model').value=state.deviceModel;
 $('safari-shot').classList.toggle('hidden',!mobile||m.os==='android'||Boolean(state.project&&state.project.native));
 // A native app is not a web page: no browser address bar in its phone frame.
 $('editor').classList.toggle('is-native',Boolean(state.project&&state.project.native));
 $('dev-shot').classList.add('hidden');
 try{const host=new URL($('frame').src||location.href).host;for(const h of d.querySelectorAll('.dev-host'))h.textContent=state.project&&state.project.published&&state.project.published.slug?state.project.published.slug+'.kairoq.app':host}catch{}
 fitDevice();
}
$('desktop').onclick=()=>device(false);$('mobile').onclick=()=>{state.deviceModel=state.lastPhone;try{localStorage.setItem('kq-device',state.deviceModel)}catch{}device(true)};
$('device-model').onchange=()=>{state.deviceModel=state.lastPhone=$('device-model').value;try{localStorage.setItem('kq-device',state.deviceModel)}catch{}device(true)};
addEventListener('resize',fitDevice);
// The preview column changes size when the sidebar, code panel, or browser chrome changes.
// A window resize listener alone misses those transitions and leaves the iPhone clipped.
if(typeof ResizeObserver!=='undefined'){
 const previewObserver=new ResizeObserver(()=>fitDevice());
 previewObserver.observe($('canvas'));
}
$('safari-shot').onclick=async()=>{
 const b=$('safari-shot'),m=MODELS[state.deviceModel];b.disabled=true;const was=b.textContent;b.textContent='Opening in Safari…';
 try{const r=await api('/projects/'+state.project.id+'/safari',{method:'POST',body:{width:m.w,height:m.h-m.top-m.bottom-m.urlTop,ipad:m.os==='ipados'}});
  $('dev-shot-img').src='data:image/jpeg;base64,'+r.screenshot;text($('dev-shot-model'),m.label);$('dev-shot').classList.remove('hidden');
  if(r.errors&&r.errors.length)text($('chat-error'),'Safari reported: '+r.errors.slice(0,2).join(' · '));
 }catch(err){text($('chat-error'),err.message)}finally{b.disabled=false;b.textContent=was}
};
$('dev-shot-close').onclick=()=>$('dev-shot').classList.add('hidden');
// Reload; when the preview had not loaded, rebuild it first.
$('refresh').onclick=()=>{if(!$('preview-notice').classList.contains('hidden'))return rebuildPreview();const f=$('frame');if(f.src){const u=f.src;f.src='about:blank';setTimeout(()=>setPreview(u),30)}};
// Share: a small popover like Emergent's: the preview link and Copy, then Publish.
function renderSharePop(){
 const p=state.project,on=Boolean(p.share);text($('share-pop-error'),'');
 $('share-pop-off').classList.toggle('hidden',on);$('share-pop-link').classList.toggle('hidden',!on);
 if(on){$('share-pop-url').value=location.origin+p.share.url;$('share-pop-remix').checked=Boolean(p.share.remix)}
 text($('share-pop-copy'),'Copy link');
 const live=$('share-pop-live');live.replaceChildren();
 if(p.published){const a=el('a',null,location.origin+'/sites/'+p.published.slug+'/');a.href=a.textContent;a.target='_blank';a.rel='noopener';live.append(el('span','muted small','Live at '),a)}
 // Like Emergent's Share: a picture of the app, and share-on links for its public address.
 const pic=$('share-pop-pic');pic.replaceChildren();pic.classList.toggle('hidden',!p.thumb);
 if(p.thumb){const img=el('img');img.src=p.thumb;img.alt='';img.loading='lazy';img.onerror=()=>pic.classList.add('hidden');pic.append(img)}
 const pub=p.published?location.origin+'/sites/'+p.published.slug+'/':on?location.origin+p.share.url:'',soc=$('share-pop-social');soc.replaceChildren();soc.classList.toggle('hidden',!pub);
 if(pub)for(const [name,href] of [['X','https://twitter.com/intent/tweet?url='],['Facebook','https://www.facebook.com/sharer/sharer.php?u='],['LinkedIn','https://www.linkedin.com/sharing/share-offsite/?url=']]){const a=el('a','share-on',name);a.href=href+encodeURIComponent(pub);a.target='_blank';a.rel='noopener noreferrer';a.setAttribute('aria-label','Share on '+name);soc.append(a)}
 text($('share-pop-publish'),p.published?'Publish changes':'Publish your site');
 $('share-pop-team').classList.toggle('hidden',state.project.role!=='owner');
}
function toggleSharePop(open){const pop=$('share-pop');open=open==null?pop.classList.contains('hidden'):open;pop.classList.toggle('hidden',!open);$('share-open').setAttribute('aria-expanded',String(open));if(open)renderSharePop()}
async function sharePopCall(body){try{const r=await api('/projects/'+state.project.id+'/share',{method:'POST',body});if(r.project)state.project=r.project;renderSharePop()}catch(err){text($('share-pop-error'),err.message)}}
$('share-open').onclick=e=>{e.stopPropagation();toggleSharePop()};
$('share-pop').addEventListener('click',e=>e.stopPropagation());
document.addEventListener('click',()=>{if(!$('share-pop').classList.contains('hidden'))toggleSharePop(false)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('share-pop').classList.contains('hidden'))toggleSharePop(false)});
$('share-pop-on').onclick=()=>sharePopCall({enabled:true,remix:false});
$('share-pop-stop').onclick=()=>sharePopCall({enabled:false,remix:false});
$('share-pop-remix').onchange=()=>sharePopCall({enabled:true,remix:$('share-pop-remix').checked});
$('share-pop-copy').onclick=()=>{navigator.clipboard?.writeText($('share-pop-url').value).then(()=>text($('share-pop-copy'),'Copied')).catch(()=>$('share-pop-url').select())};
$('share-pop-publish').onclick=()=>{toggleSharePop(false);$('publish-open').click()};
$('share-pop-team').onclick=()=>{toggleSharePop(false);$('team-open').click()};
function view(mode){
 state.code=mode==='code';state.data=mode==='data';
 for(const m of ['preview','code','data','manage'])$('view-'+m).setAttribute('aria-pressed',String(m===mode));
 $('device').classList.toggle('hidden',mode!=='preview');$('frame').classList.toggle('hidden',mode!=='preview');$('code').classList.toggle('hidden',mode!=='code');$('data').classList.toggle('hidden',mode!=='data');$('manage').classList.toggle('hidden',mode!=='manage');$('canvas').dataset.view=mode;
 // The shown view fades in (dark.css .view-in) instead of snapping.
 const shown=$(mode==='preview'?'frame':mode);if(shown&&!STILL){shown.classList.remove('view-in');void shown.offsetWidth;shown.classList.add('view-in')}
 if(mode==='code')renderFiles();
 if(mode==='data')renderData();
 if(mode==='manage')renderManage();
}
$('view-preview').onclick=()=>view('preview');$('view-code').onclick=()=>view('code');$('view-data').onclick=()=>view('data');$('view-manage').onclick=()=>view('manage');
// ---------- Settings in the preview area (like Emergent's gear): Connectors, Payments, Secrets,
// Monitoring. Everything shown is read from the project: connector status from its settings, its
// own keys (names and last characters only), Stripe's webhook address, visits and server errors.
const mgUi={tab:'connectors',group:'All',q:''};
function openManage(tab){
 if(tab)mgUi.tab=tab;
 // On a phone the panel lives in the Preview pane.
 if(matchMedia('(max-width:820px)').matches)document.querySelector('[data-pane="preview"]')?.click();
 view('manage');
}
for(const b of document.querySelectorAll('#manage [data-mg]'))b.onclick=()=>{mgUi.tab=b.dataset.mg;renderManage()};
$('composer-connect').onclick=()=>openManage('connectors');
$('plus-connectors').onclick=()=>{$('menu-plus').open=false;openManage('connectors')};
// The + menu's search box filters its rows; it clears and takes focus each time the menu opens.
$('plus-search').oninput=()=>{const t=$('plus-search').value.trim().toLowerCase();for(const r of document.querySelectorAll('#menu-plus .plus-panel>:is(button,a):not([hidden])'))r.classList.toggle('hidden',Boolean(t)&&!(r.textContent+' '+(r.title||'')).toLowerCase().includes(t))};
$('menu-plus').addEventListener('toggle',()=>{if(!$('menu-plus').open)return;$('plus-search').value='';$('plus-search').oninput();setTimeout(()=>$('plus-search').focus(),0)});
// The Connectors button in the message box shows one service after another, like Emergent's.
(function(){
 const box=document.querySelector('#composer-connect .cn-spin-ico');if(!box)return;
 const SVC=[['S','#635BFF'],['G','#24292F'],['@','#7552E8'],['W','#25D366'],['F','#F24E1E']];
 let i=0;const draw=()=>{const [t,c]=SVC[i%SVC.length];const n=el('i',null,t);n.style.background=c;box.replaceChildren(n);i++};
 draw();if(!STILL)setInterval(()=>{if(!document.hidden&&document.body.classList.contains('in-editor'))draw()},2400);
})();
async function renderManage(){
 const body=$('mg-body'),p=state.project;if(!body||!p)return;
 for(const b of document.querySelectorAll('#manage [data-mg]'))b.toggleAttribute('aria-current',b.dataset.mg===mgUi.tab);
 const tab=mgUi.tab;
 const head=(title,sub)=>{const h=el('div','mg-head');h.append(el('h2',null,title),el('p',null,sub));return h};
 body.replaceChildren(head(...{connectors:['Connectors','Connect the services your app uses.'],payments:['Payments','Take card payments with your own Stripe account.'],secrets:['Secrets','Keys your app uses to talk to other services.'],monitoring:['Monitoring','Visits to your app and problems on its server.']}[tab]),el('p','mg-loading','Loading…'));
 const done=(...nodes)=>{if(mgUi.tab!==tab)return;body.querySelector('.mg-loading')?.remove();body.append(...nodes)};
 const fail=err=>done(el('p','error',err.message));
 let settings=null;
 if(tab!=='monitoring'){try{settings=(await api('/projects/'+p.id+'/settings')).settings}catch(err){if(tab!=='connectors')return fail(err)}}
 const owner=p.role==='owner'||!p.role,viewer=p.role==='viewer';
 if(tab==='connectors'){
  const list=CONNECTORS.filter(c=>!c.owner||owner);
  const groups=[...new Set(list.map(c=>CN_GROUP[c.id]||'More apps'))];
  const find=el('label','tp-search mg-search');find.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
  const q=document.createElement('input');q.type='search';q.placeholder='Search';q.value=mgUi.q;q.setAttribute('aria-label','Search connectors');find.append(q);
  const pills=el('div','mg-pills'),rows=el('ul','mg-rows');
  const draw=()=>{
   pills.replaceChildren();
   for(const g of ['All',...groups]){const b=el('button',null,g);b.type='button';b.setAttribute('aria-pressed',String(mgUi.group===g));b.onclick=()=>{mgUi.group=g;draw()};pills.append(b)}
   rows.replaceChildren();const words=mgUi.q.toLowerCase();
   for(const c of list.filter(c=>(mgUi.group==='All'||(CN_GROUP[c.id]||'More apps')===mgUi.group)&&(!words||(c.name+' '+c.desc).toLowerCase().includes(words)))){
    const st=settings?cnStatus(c,settings):'open',li=el('li','mg-row');
    const ic=cnLogo(c);
    const t=el('div','mg-row-t');t.append(el('b',null,c.name),el('span',null,c.desc));
    li.append(ic,t);
    const on=st==='on'||st.startsWith('n:');
    if(st==='admin')li.append(el('span','mg-wait','Set up by your admin'));
    else{
     if(on)li.append(el('span','mg-on',st==='on'?'✓ Connected':'✓ '+st.slice(2)+' added'));
     const go=el('button',on?'mg-link':'mg-add',on?'Manage':st==='open'?'Open':'+ Add');go.type='button';go.disabled=viewer;go.onclick=()=>c.open();li.append(go);
    }
    rows.append(li);
   }
   if(!rows.childElementCount)rows.append(el('li','mg-empty','Nothing matches. Try "744 apps" for more services.'));
  };
  q.oninput=()=>{mgUi.q=q.value.trim();draw()};
  draw();done(find,pills,rows);
 }else if(tab==='payments'){
  const sec=settings?.secrets||{},on=Boolean(sec.stripe_secret_key?.set);
  const card=el('div','mg-card mg-stripe');const ic=el('span','mg-logo','S');ic.setAttribute('aria-hidden','true');
  const t=el('div','mg-row-t');t.append(el('b',null,on?'Stripe is connected':'Take payments with Stripe'),el('span',null,on?'Payments go straight to your Stripe account.':'Connect your own Stripe account to take card payments and subscriptions.'));
  const go=el('button',on?'mg-link':'mg-add',on?'Manage':'Add Stripe');go.type='button';go.disabled=!owner;go.onclick=()=>openSettingsAt('stripe-key');
  card.append(ic,t,go);
  const nodes=[card];
  if(settings?.stripe_webhook_url){
   const hook=el('div','mg-card mg-field');hook.append(el('b',null,'Webhook address for Stripe'),el('span','muted small','In Stripe, add this address under Developers → Webhooks'+((settings.stripe_events||[]).length?', for: '+settings.stripe_events.join(', ')+'.':'.')));
   const row=el('div','mg-copy'),inp=document.createElement('input');inp.readOnly=true;inp.value=settings.stripe_webhook_url;inp.setAttribute('aria-label','Webhook address');
   const cp=el('button','mg-link','Copy');cp.type='button';cp.onclick=async()=>{try{await navigator.clipboard.writeText(inp.value);cp.textContent='Copied';setTimeout(()=>cp.textContent='Copy',1400)}catch{inp.select()}};
   row.append(inp,cp);hook.append(row);nodes.push(hook);
  }
  try{const d=await api('/projects/'+p.id+'/data');if((d.features?.payments||[]).length)nodes.push(el('p','mg-note',(d.payments||[]).length+' purchase'+((d.payments||[]).length===1?'':'s')+' so far, of '+d.features.payments.join(', ')+'.'))}catch{}
  const faq=el('div','mg-card mg-faq');
  for(const [q,a] of [['How do I test first?','Use a test key (it starts with sk_test_). Switch to your live key when you are ready to take real money.'],['Where does the money go?','Straight to your own Stripe account. Kairoq does not hold it.'],['Is my key safe?',settings?.encryption?'It is stored encrypted and never shown again after you save it.':'It is never shown again after you save it.']]){const d=el('details');d.append(el('summary',null,q),el('p',null,a));faq.append(d)}
  nodes.push(faq);done(...nodes);
 }else if(tab==='secrets'){
  if(!owner)return done(el('p','mg-note','Only the project owner can see and change its keys.'));
  let mine=[];try{mine=(await api('/projects/'+p.id+'/secrets')).secrets||[]}catch(err){return fail(err)}
  const card=el('div','mg-card'),top=el('div','mg-card-top');top.append(el('b',null,'Your keys'),el('span','muted small','Your app’s server functions read these by name. Values are never shown again.'));card.append(top);
  const rows=el('ul','mg-keys');
  for(const k of mine){const li=el('li');li.append(el('code',null,k.name),el('span','mg-mask','••••••••'+(k.hint||'')),el('span','muted small',k.at?new Date(k.at).toLocaleDateString([], {dateStyle:'medium'}):''));
   const rm=el('button','mg-link mg-rm','Remove');rm.type='button';rm.onclick=async()=>{if(!confirmRemove(rm))return;try{await api('/projects/'+p.id+'/secrets',{method:'POST',body:{name:k.name,value:null}});renderManage()}catch(err){text(err_,err.message)}};li.append(rm);rows.append(li)}
  if(!mine.length)rows.append(el('li','mg-empty','No keys yet.'));
  const form=el('form','mg-addkey'),nm=document.createElement('input'),val=document.createElement('input');
  nm.placeholder='NAME, like MAPS_KEY';nm.setAttribute('aria-label','Key name');nm.autocomplete='off';
  val.type='password';val.placeholder='Value';val.setAttribute('aria-label','Key value');val.autocomplete='off';
  const add=el('button','mg-add','+ Add');add.type='submit';const err_=el('p','error');
  form.append(nm,val,add);
  form.onsubmit=async e=>{e.preventDefault();text(err_,'');add.disabled=true;try{await api('/projects/'+p.id+'/secrets',{method:'POST',body:{name:nm.value,value:val.value}});renderManage()}catch(err){text(err_,err.message);add.disabled=false}};
  card.append(rows,form,err_);
  const sys=el('div','mg-card'),st=el('div','mg-card-top');st.append(el('b',null,'Built-in keys'),el('span','muted small','Set from Connectors.'));sys.append(st);
  const sl=el('ul','mg-keys');const sec=settings?.secrets||{};
  for(const [k,label] of [['github_token','GitHub'],['stripe_secret_key','Stripe key'],['stripe_webhook_secret','Stripe webhook secret']]){const li=el('li');li.append(el('span',null,label),el('span',sec[k]?.set?'mg-on':'muted small',sec[k]?.set?'✓ Set':'Not set'));sl.append(li)}
  sys.append(sl);done(card,sys);
 }else{
  const live=(p.urls||[]).length>0;
  const nodes=[];
  if(!live){const c=el('div','mg-card mg-publish');c.append(el('b',null,'Publish to see real visitors'),el('span','muted small','Visits are counted on your published app.'));const b=el('button','mg-add','Publish');b.type='button';b.disabled=viewer;b.onclick=()=>$('publish-open').click();c.append(b);nodes.push(c)}
  try{
   const [{analytics:a},{logs}]=await Promise.all([api('/projects/'+p.id+'/analytics'),api('/projects/'+p.id+'/logs')]);
   const stats=el('div','mg-stats');
   const tile=(label,n)=>{const t=el('div','mg-card mg-stat');t.append(el('span','muted small',label),el('b',null,String(n)));return t};
   stats.append(tile('Visits, 30 days',a.totals?.views||0),tile('Visitors, 30 days',a.totals?.visitors||0),tile('Server problems',(logs||[]).filter(l=>l.level==='error').length));
   nodes.push(stats);
   const max=Math.max(1,...a.series.map(x=>x.views)),bars=el('div','mg-card mg-chart');bars.setAttribute('aria-label','Visits per day, last 30 days');
   for(const x of a.series){const i=el('i');i.style.height=Math.max(2,Math.round(x.views/max*100))+'%';i.title=x.day+': '+x.views+' visit'+(x.views===1?'':'s');bars.append(i)}
   nodes.push(bars);
   if((a.referrers||[]).length){const r=el('div','mg-card'),ul=el('ul','mg-keys');r.append(el('b',null,'Where visitors come from'));for(const x of a.referrers){const li=el('li');li.append(el('span',null,x.referrer),el('span','muted small',x.views+' visit'+(x.views===1?'':'s')));ul.append(li)}r.append(ul);nodes.push(r)}
   const lg=el('div','mg-card'),ul=el('ul','mg-logs');lg.append(el('b',null,'Recent server messages'));
   for(const l of (logs||[]).slice(-15).reverse()){const li=el('li','lv-'+(l.level||'info'));li.append(el('i'),el('span','mg-log-m',l.message),el('span','muted small',(l.source?l.source+' · ':'')+when(l.at)));ul.append(li)}
   if(!(logs||[]).length)ul.append(el('li','mg-empty','No problems reported.'));
   lg.append(ul);nodes.push(lg);
  }catch(err){nodes.push(el('p','error',err.message))}
  done(...nodes);
 }
}
function confirmRemove(b){if(b.dataset.sure)return true;b.dataset.sure='1';b.textContent='Remove?';setTimeout(()=>{delete b.dataset.sure;b.textContent='Remove'},3000);return false}
async function renderData(){
 const d=await api('/projects/'+state.project.id+'/data');
 const list=$('collections');list.replaceChildren();
 if(!d.collections.length){const li=document.createElement('li');li.className='muted small';li.textContent='No collections yet. Ask for a feature that saves data, like "let visitors book a class".';list.append(li)}
 if(!d.collections.some(c=>c.name===state.collection))state.collection=d.collections[0]?.name;
 for(const c of d.collections){const li=document.createElement('li'),b=document.createElement('button');b.type='button';b.textContent=c.name+' ('+c.count+') · '+c.access;b.setAttribute('aria-current',String(c.name===state.collection));b.onclick=()=>{state.collection=c.name;renderData()};li.append(b);list.append(li)}
 text($('user-count'),'('+d.user_count+')');
 const feats=[];
 if(d.features.storage)feats.push('Files: '+d.files.n+' ('+Math.round(d.files.bytes/1024)+' KB)');
 if(d.features.email)feats.push('Email on');
 if(d.features.payments.length)feats.push('Payments: '+d.payments.length+' purchase'+(d.payments.length===1?'':'s')+' of '+d.features.payments.join(', '));
 for(const sc of d.features.schedules)feats.push('Schedule "'+sc.name+'" every '+sc.every+(sc.last_result?' · last: '+sc.last_result:''));
 text($('data-features'),feats.join(' · '));
 const outbox=d.outbox||[];$('outbox').hidden=!outbox.length;
 text($('outbox-title'),outbox.length+' email'+(outbox.length===1?'':'s')+' kept because email is not set up yet');
 $('outbox-list').replaceChildren(...outbox.map(m=>{const li=document.createElement('li'),pre=document.createElement('pre');pre.textContent=(m.to_kind==='me'&&m.user_email?'To '+m.user_email:'To you')+' · '+when(new Date(m.at).toISOString())+'\n'+m.subject+'\n\n'+m.text;li.append(pre);return li}));
 const users=$('users');users.replaceChildren();
 for(const u of d.users){
  const li=document.createElement('li'),name=document.createElement('span'),remove=document.createElement('button');
  name.textContent=u.email+' · '+when(u.created_at);remove.type='button';remove.className='ghost';
  remove.textContent='Remove account';remove.setAttribute('aria-label','Remove '+u.email+' from this app');
  remove.onclick=async()=>{
   if(!confirm('Remove account '+u.email+' from this app? This will revoke sign-in sessions. Saved app records will be retained.'))return;
   remove.disabled=true;
   try{
    await api('/projects/'+state.project.id+'/users',{method:'DELETE',body:{email:u.email,confirm:true,deleteOwnedRecords:false}});
    await renderData();
   }catch(error){alert('Account was not removed: '+error.message);remove.disabled=false;}
  };
  li.append(name,document.createTextNode(' '),remove);users.append(li);
 }
 const records=$('records');records.replaceChildren();
 text($('records-title'),state.collection?'Records in '+state.collection:'Records');
 const nutritionCollections=new Set(['food_logs','food_log','food_entries','food_diary','meal_entries','meal_logs','nutrition_entries','nutrition_logs','daily_foods','logged_foods']);
 if(nutritionCollections.has(state.collection)){
  const clear=document.createElement('button');clear.type='button';clear.className='ghost';clear.textContent='Clear nutrition entries in '+state.collection;
  clear.onclick=async()=>{
   if(!confirm('Delete ALL nutrition records in '+state.collection+' for this app? This cannot be undone. Accounts, goals, and weight history will be kept.'))return;
   clear.disabled=true;
   try{const result=await api('/projects/'+state.project.id+'/nutrition',{method:'DELETE',body:{collection:state.collection,confirm:true}});alert(result.deleted+' nutrition records deleted. Other data was kept.');await renderData()}
   catch(err){alert('Nothing was deleted: '+err.message);clear.disabled=false}
  };
  records.append(clear);
 }
 renderSql().catch(()=>{});renderLogs().catch(()=>{});renderAutomations().catch(()=>{});renderAssistant().catch(()=>{});
 if(!state.collection)return;
 const {items}=await api('/projects/'+state.project.id+'/records?collection='+encodeURIComponent(state.collection));
 if(!items.length){const li=document.createElement('li');li.className='muted small';li.textContent='No records yet.';records.append(li)}
 for(const it of items){
  const li=document.createElement('li'),pre=document.createElement('pre'),del=document.createElement('button');
  pre.textContent=JSON.stringify(it,null,2);del.type='button';del.className='ghost';del.textContent='Delete';
  del.onclick=async()=>{if(!confirm('Delete this record?'))return;await api('/projects/'+state.project.id+'/records',{method:'DELETE',body:{id:it.id}});renderData()};
  li.append(pre,del);records.append(li);
 }
}
// Ask your data: an answer, the rows behind it and the query that found them.
$('ask-data').onsubmit=async e=>{
 e.preventDefault();
 const q=$('ask-data-q').value.trim(),box=$('ask-data-result'),btn=$('ask-data-go');if(!q)return;
 box.classList.remove('hidden');box.replaceChildren(el('p','muted small','Looking through your data…'));btn.disabled=true;
 try{
  const r=await api('/projects/'+state.project.id+'/askdata',{method:'POST',body:{question:q}});
  box.replaceChildren(el('p','ask-data-answer',r.answer));
  if(r.rows.length){const d=el('details'),s=el('summary',null,r.rows.length+' row'+(r.rows.length===1?'':'s')+(r.rows.length===200?' (first 200)':'')+' · how it was counted');d.append(s,el('p','muted small',r.note),sqlTable(r.rows),el('pre','small',r.sql));box.append(d)}
 }catch(err){box.replaceChildren(el('p','error small',err.message))}
 finally{btn.disabled=false}
};
// AI assistant: the documents the app's AI answers from (ai.ask), and a test question.
const assistantState={add:'text'};
async function renderAssistant(){
 const {assistant:a}=await api('/projects/'+state.project.id+'/assistant');
 const editor=state.project.role!=='viewer';
 $('assistant-off').classList.toggle('hidden',a.ai_enabled||!a.docs.length);
 $('assistant-form').classList.toggle('hidden',!editor);$('assistant-test').classList.toggle('hidden',!a.docs.length||!editor);
 document.querySelector('.assistant-tabs').classList.toggle('hidden',!editor);
 text($('assistant-count'),a.docs.length?'('+a.docs.length+' document'+(a.docs.length===1?'':'s')+')':'');
 renderQuestions(a.questions||[],editor);
 $('assistant-change').classList.toggle('hidden',!editor);
 const ul=$('assistant-docs');ul.replaceChildren();
 for(const d of a.docs){
  const li=el('li'),t=el('div','skill-text');
  t.append(el('b',null,d.title),el('span',null,(d.kind==='web'?d.source:(d.kind==='file'?'File':'Text')+(d.source&&d.kind!=='file'?' · '+d.source:''))+' · '+d.chars.toLocaleString()+' characters · '+when(d.created_at)));
  const del=el('button','ghost link-btn','Remove');del.type='button';del.disabled=!editor;
  del.onclick=async()=>{if(!confirm('Remove "'+d.title+'"? The assistant stops using it.'))return;await api('/projects/'+state.project.id+'/assistant',{method:'DELETE',body:{id:d.id}});renderAssistant()};
  li.append(t,del);ul.append(li);
 }
}
// Questions visitors asked that the documents did not answer: add the answer, or dismiss.
function renderQuestions(list,editor){
 $('assistant-questions-box').classList.toggle('hidden',!list.length);
 text($('assistant-questions-count'),list.length?'('+list.length+')':'');
 const ul=$('assistant-questions');ul.replaceChildren();
 for(const q of list){
  const li=el('li'),head=el('div','skill-text');
  head.append(el('b',null,q.question),el('span',null,(q.count>1?'Asked '+q.count+' times · ':'')+q.reason+' · '+when(q.last_at)));
  const act=el('div','skill-actions');
  const add=el('button','ghost link-btn','Add answer');add.type='button';add.disabled=!editor;
  const skip=el('button','ghost link-btn','Dismiss');skip.type='button';skip.disabled=!editor;
  skip.onclick=async()=>{await api('/projects/'+state.project.id+'/assistant',{method:'POST',body:{action:'dismiss',key:q.key}});renderAssistant()};
  add.onclick=()=>{
   if(li.querySelector('textarea'))return;
   const ta=el('textarea');ta.rows=2;ta.placeholder='The answer, e.g. Yes, there is free parking behind the building.';
   const save=el('button','ghost','Save answer');save.type='button';
   save.onclick=async()=>{try{await api('/projects/'+state.project.id+'/assistant',{method:'POST',body:{action:'answer',key:q.key,answer:ta.value}});renderAssistant()}catch(err){text($('assistant-error'),err.message)}};
   li.append(ta,save);ta.focus();
  };
  act.append(add,skip);li.append(head,act);ul.append(li);
 }
}
// Something changed: find outdated information, fix it in the documents here and in the app through the builder.
$('assistant-change').onsubmit=async e=>{
 e.preventDefault();
 const change=$('assistant-change-text').value.trim(),box=$('assistant-findings'),btn=$('assistant-change-run');
 if(!change)return;
 box.classList.remove('hidden');box.replaceChildren(el('p','muted small','Looking through your app and documents…'));btn.disabled=true;
 try{
  const r=await api('/projects/'+state.project.id+'/assistant',{method:'POST',body:{action:'outdated',change}});
  box.replaceChildren();
  if(!r.findings.length){box.append(el('p','small','Nothing outdated found in '+r.checked+' places that mention it.'));return}
  box.append(el('p','small',r.findings.length===1?'1 place still says the old thing:':r.findings.length+' places still say the old thing:'));
  const ul=el('ul','assistant-findings-list');
  for(const f of r.findings){
   const li=el('li'),cb=document.createElement('input');cb.type='checkbox';cb.checked=f.action!=='needs_info';cb.disabled=f.action==='needs_info';
   const t=el('div','skill-text');
   t.append(el('b',null,f.where==='doc'?'Document: '+f.title:f.file+' (line '+f.line+')'),el('span',null,f.action==='needs_info'?'Check this yourself: '+f.why:'“'+f.current+'” → '+(f.action==='delete'?'remove it':'“'+f.replacement+'”')));
   const lab=el('div','finding');cb.setAttribute('aria-label','Fix this');t.onclick=()=>{if(!cb.disabled)cb.checked=!cb.checked};lab.append(cb,t);li.append(lab);li._f=f;li._cb=cb;ul.append(li);
  }
  const apply=el('button','primary','Fix the selected');apply.type='button';
  apply.onclick=async()=>{
   const picked=[...ul.children].filter(li=>li._cb.checked).map(li=>li._f);
   const docs=picked.filter(f=>f.where==='doc').map(f=>({doc_id:f.doc_id,current:f.current,replacement:f.action==='delete'?'':f.replacement}));
   const app=picked.filter(f=>f.where==='app');
   apply.disabled=true;
   try{
    if(docs.length)await api('/projects/'+state.project.id+'/assistant',{method:'POST',body:{action:'fix_docs',fixes:docs}});
    if(app.length)send('Update outdated information ('+change+'). Change only these places, nothing else:\n'+app.map(f=>'- '+f.file+' line '+f.line+': '+(f.action==='delete'?'remove “'+f.current+'”':'replace “'+f.current+'” with “'+f.replacement+'”')).join('\n'),'build');
    box.replaceChildren(el('p','small',(docs.length?docs.length+' document fix'+(docs.length===1?'':'es')+' saved. ':'')+(app.length?'The builder is updating the app now (see the chat).':'')));
    renderAssistant();
   }catch(err){text($('assistant-error'),err.message);apply.disabled=false}
  };
  box.append(ul,apply);
 }catch(err){box.replaceChildren(el('p','error small',err.message))}
 finally{btn.disabled=false}
};
for(const b of document.querySelectorAll('.assistant-tabs [data-add]'))b.onclick=()=>{
 assistantState.add=b.dataset.add;
 for(const x of document.querySelectorAll('.assistant-tabs [data-add]'))x.setAttribute('aria-pressed',String(x===b));
 for(const p of document.querySelectorAll('#assistant-form [data-pane]'))p.classList.toggle('hidden',p.dataset.pane!==b.dataset.add);
};
function fileBase64(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]||'');r.onerror=()=>reject(Error('Could not read the file'));r.readAsDataURL(file)})}
$('assistant-form').onsubmit=async e=>{
 e.preventDefault();text($('assistant-error'),'');
 const btn=$('assistant-add');btn.disabled=true;btn.textContent='Adding…';
 try{
  let body;
  if(assistantState.add==='url')body={url:$('assistant-url').value};
  else if(assistantState.add==='file'){const f=$('assistant-file').files[0];if(!f)throw Error('Choose a file');body={file:{name:f.name,mime:f.type,data:await fileBase64(f)}}}
  else body={title:$('assistant-title').value,text:$('assistant-text').value};
  await api('/projects/'+state.project.id+'/assistant',{method:'POST',body});
  $('assistant-form').reset();await renderAssistant();
 }catch(err){text($('assistant-error'),err.message)}
 finally{btn.disabled=false;btn.textContent='Add'}
};
$('assistant-test').onsubmit=async e=>{
 e.preventDefault();
 const q=$('assistant-question').value.trim(),box=$('assistant-answer');if(!q)return;
 box.classList.remove('hidden');box.replaceChildren(el('p','muted small','Thinking…'));
 try{
  const {answer}=await api('/projects/'+state.project.id+'/assistant',{method:'POST',body:{action:'test',question:q}});
  box.replaceChildren(el('p',null,answer.text));
  if(answer.sources.length){const s=el('p','muted small','Sources: '+answer.sources.map(x=>'['+x.n+'] '+x.title).join(' · '));box.append(s)}
 }catch(err){box.replaceChildren(el('p','error small',err.message))}
};
// Automations (src/backend.json "automations"): what runs when, the last result, and Run now.
async function renderAutomations(){
 const {automations}=await api('/projects/'+state.project.id+'/automations');
 $('auto-section').classList.toggle('hidden',!automations.length);
 const ol=$('automations');ol.replaceChildren();
 const editor=state.project.role!=='viewer';
 for(const a of automations){
  const li=document.createElement('li');
  const badge=el('span','state '+(a.ok===null?'':a.ok?'ok':'bad'),a.ok===null?'never run':a.ok?'ok':'failed');
  const t=el('div','skill-text');t.append(el('b',null,a.text),el('span',null,(a.last_run?'Last: '+when(a.last_run)+' · '+(a.last_result||''):'Not run yet')+(a.next?' · Next: '+when(a.next):'')+(a.runs?' · '+a.runs+' run'+(a.runs===1?'':'s')+(a.failures?', '+a.failures+' failed':''):'')));
  const act=el('div','skill-actions');
  const run=document.createElement('button');run.type='button';run.className='ghost link-btn';run.textContent='Run now';run.disabled=!editor;
  run.onclick=async()=>{run.disabled=true;try{await api('/projects/'+state.project.id+'/automations',{method:'POST',body:{name:a.name}});await renderAutomations();renderLogs().catch(()=>{})}catch(err){text($('chat-error'),err.message)}finally{run.disabled=!editor}};
  act.append(run);li.append(badge,t,act);ol.append(li);
 }
}
$('automations-refresh').onclick=()=>renderAutomations().catch(err=>text($('chat-error'),err.message));
// SQL tables (sql/ migrations) and recent server logs, shown under the Data tab.
function sqlTable(rows){
 const table=document.createElement('table');table.className='sql-table';
 if(!rows.length){const p=document.createElement('p');p.className='muted small';p.textContent='No rows.';return p}
 const cols=Object.keys(rows[0]),head=table.createTHead().insertRow();
 for(const c of cols){const th=document.createElement('th');th.textContent=c;head.append(th)}
 const body=table.createTBody();
 for(const r of rows){const tr=body.insertRow();for(const c of cols){const td=tr.insertCell();const v=r[c];td.textContent=v===null?'null':typeof v==='object'?JSON.stringify(v):String(v)}}
 const wrap=document.createElement('div');wrap.className='sql-scroll';wrap.append(table);return wrap;
}
async function renderSql(){
 const d=await api('/projects/'+state.project.id+'/sql');
 const owner=state.project.role==='owner'||!state.project.role;
 $('sql-section').classList.toggle('hidden',!d.tables.length&&!d.migrations.length);
 $('sql-form').classList.toggle('hidden',!owner);
 text($('sql-migrations'),d.migrations.length?'Migrations applied: '+d.migrations.map(m=>m.name.replace(/^sql\//,'')).join(', '):'');
 const wrap=$('sql-tables');wrap.replaceChildren();
 for(const t of d.tables){
  const det=document.createElement('details'),sum=document.createElement('summary');
  sum.textContent=t.name+' ('+t.count+' row'+(t.count===1?'':'s')+') · '+t.columns.map(c=>c.name+(c.type?' '+c.type.toLowerCase():'')+(c.pk?' pk':'')).join(', ');
  det.append(sum);
  if(t.foreign_keys.length){const p=document.createElement('p');p.className='muted small';p.textContent='Links: '+t.foreign_keys.map(f=>f.col+' → '+f.ref+'.'+f.ref_col).join(', ');det.append(p)}
  det.append(sqlTable(t.rows));wrap.append(det);
 }
}
$('sql-form').onsubmit=async e=>{
 e.preventDefault();text($('sql-error'),'');$('sql-result').replaceChildren();
 try{const {result}=await api('/projects/'+state.project.id+'/sql',{method:'POST',body:{query:$('sql-query').value}});$('sql-result').append(Array.isArray(result)?sqlTable(result):Object.assign(document.createElement('p'),{className:'small',textContent:result.changes+' row'+(result.changes===1?'':'s')+' changed'}));renderSql()}
 catch(err){text($('sql-error'),err.message)}
};
async function renderLogs(){
 const {logs}=await api('/projects/'+state.project.id+'/logs');
 const ol=$('logs');ol.replaceChildren();
 if(!logs.length){const li=document.createElement('li');li.className='muted small';li.textContent='No server logs yet. Function console.log output and backend errors appear here.';ol.append(li)}
 for(const l of logs.slice(-60).reverse()){const li=document.createElement('li');li.className='log '+l.level;li.textContent=when(l.at)+' · '+l.source+' · '+l.message;ol.append(li)}
}
$('logs-refresh').onclick=()=>renderLogs().catch(()=>{});
// ---------- Code: the files as a folder tree, like an editor ----------
// The app's own files first (pages, components, hooks, lib, data), the shared UI kit folded away.
const DIR_ORDER=['src','functions','sql','public'],SRC_ORDER=['pages','components','hooks','lib','data','styles','assets'];
function fileTree(paths){
 const root={dirs:new Map(),files:[]};
 for(const p of paths){const parts=p.split('/');let node=root;for(const d of parts.slice(0,-1)){if(!node.dirs.has(d))node.dirs.set(d,{dirs:new Map(),files:[]});node=node.dirs.get(d)}node.files.push(p)}
 return root;
}
function dirRank(path,name){const order=path===''?DIR_ORDER:path==='src'?SRC_ORDER:path==='src/components'?[]:[];const i=order.indexOf(name);return path==='src/components'&&name==='ui'?99:i<0?50:i}
function fileRank(path){const n=path.split('/').pop();return/^(App|main)\.jsx$/.test(n)?0:/^index\.css$/.test(n)?2:/\.json$/.test(n)?3:1}
function renderTree(list,paths){
 if(!state.openDirs){state.openDirs=new Set(['src','src/pages','src/components','src/hooks','src/lib','src/data','functions','sql']);for(const p of paths){const parts=p.split('/');for(let i=1;i<parts.length;i++){const d=parts.slice(0,i).join('/');if(d!=='src/components/ui')state.openDirs.add(d)}}}
 if(state.file){const parts=state.file.split('/');for(let i=1;i<parts.length;i++)state.openDirs.add(parts.slice(0,i).join('/'))}
 list.classList.add('file-tree');list.setAttribute('role','tree');
 const walk=(node,path,depth)=>{
  const dirs=[...node.dirs.entries()].sort((a,b)=>dirRank(path,a[0])-dirRank(path,b[0])||a[0].localeCompare(b[0]));
  for(const [name,child] of dirs){
   const full=path?path+'/'+name:name,open=state.openDirs.has(full),count=countFiles(child);
   const li=el('li','dir'),b=el('button','tree-row');b.type='button';b.style.setProperty('--depth',depth);b.setAttribute('aria-expanded',String(open));b.title=full;
   b.append(icon(open?'down':'chev','tree-chev'),el('span','tree-name',name),el('span','tree-count',String(count)));
   b.onclick=()=>{open?state.openDirs.delete(full):state.openDirs.add(full);list.replaceChildren();renderTree(list,paths)};
   li.append(b);list.append(li);
   if(open)walk(child,full,depth+1);
  }
  for(const f of [...node.files].sort((a,b)=>fileRank(a)-fileRank(b)||a.localeCompare(b))){
   const li=el('li','file'),b=el('button','tree-row');b.type='button';b.style.setProperty('--depth',depth);b.title=f;b.setAttribute('aria-current',String(f===state.file));
   b.append(el('span','tree-ext tree-ext-'+(f.split('.').pop()||'').toLowerCase(),fileBadge(f)),el('span','tree-name',f.split('/').pop()));
   b.onclick=()=>{state.file=f;renderFiles()};li.append(b);list.append(li);
  }
 };
 walk(fileTree(paths),'',0);
}
function countFiles(node){let n=node.files.length;for(const c of node.dirs.values())n+=countFiles(c);return n}
function fileBadge(f){const e=(f.split('.').pop()||'').toLowerCase();return{jsx:'JSX',js:'JS',ts:'TS',tsx:'TSX',css:'CSS',json:'{ }',sql:'SQL',md:'MD',html:'<>'}[e]||'·'}
async function renderFiles(){
 const list=$('file-list');list.replaceChildren();
 const files=state.project.files;
 if(!files.includes(state.file))state.file=files.includes('src/App.jsx')?'src/App.jsx':files[0];
 renderTree(list,files);
 if(state.file){const {content}=await api('/projects/'+state.project.id+'/file?path='+encodeURIComponent(state.file));state.fileContent=content;text($('file-view').firstChild,content)}
 text($('file-name'),state.file||'');setEditing(false);
 const editor=state.project.role!=='viewer';$('file-edit').classList.toggle('hidden',!editor||!state.file);$('file-new').classList.toggle('hidden',!editor);$('file-tidy').classList.toggle('hidden',!editor||!state.project.current_version);
}
// Editing code by hand: Save checks, builds and keeps it as a new version (undo with the version menu).
function setEditing(on){
 $('file-view').classList.toggle('hidden',on);$('file-editor').classList.toggle('hidden',!on);
 $('file-save').classList.toggle('hidden',!on);$('file-cancel').classList.toggle('hidden',!on);$('file-edit').classList.toggle('hidden',on);
 if(on){$('file-editor').value=state.fileContent||'';$('file-editor').focus()}
}
$('file-edit').onclick=()=>{text($('file-status'),'');setEditing(true)};
$('file-cancel').onclick=()=>{text($('file-status'),'');setEditing(false)};
$('file-editor').addEventListener('keydown',e=>{
 if(e.key==='Tab'&&!e.shiftKey){e.preventDefault();const t=e.target,a=t.selectionStart;t.setRangeText('  ',a,t.selectionEnd,'end')}
 if((e.metaKey||e.ctrlKey)&&e.key==='s'){e.preventDefault();$('file-save').click()}
});
async function saveSourceFile(body,done){
 const save=$('file-save');save.disabled=true;text($('file-status'),'Checking and building…');
 try{
  const {project,result}=await api('/projects/'+state.project.id+'/source',{method:'POST',body});
  state.project=project;renderVersions();renderMessages();setPreview(project.preview_url);
  text($('file-status'),'Saved as v'+result.version+'. Undo it from the version menu.');done&&done();await renderFiles();
 }catch(err){text($('file-status'),err.message)}finally{save.disabled=false}
}
$('file-save').onclick=()=>saveSourceFile({path:state.file,content:$('file-editor').value});
$('file-tidy').onclick=()=>{if(state.job){text($('file-status'),'Wait for the current change to finish.');return}send('Tidy up the code','build')};
$('file-new').onclick=()=>{
 const name=prompt('New file path, for example src/components/Hero.jsx');if(!name)return;
 saveSourceFile({path:name.trim(),content:name.endsWith('.css')?'/* '+name+' */\n':name.endsWith('.json')?'{}\n':'export default function Component(){\n  return null;\n}\n',create:true},()=>{state.file=name.trim()});
};

// ---------- chat ----------
state.mode='build';state.tier='standard';state.attachments=[];state.runtimeErrors=[];
// The send button stays quiet until there is something to send.
const syncSend=()=>{const input=$('chat-input');$('send').classList.toggle('is-empty',!input.value.trim());input.style.height='auto';input.style.height=Math.min(input.scrollHeight,180)+'px'};
$('chat-input').addEventListener('input',syncSend);syncSend();
$('chat-input').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('chat-form').requestSubmit()}});
const PLACEHOLDERS={build:'Message Kairoq…',discuss:'Ask about this project…',agent:'Describe what you want to build…'};
function setChatMode(mode){if(!PLACEHOLDERS[mode])mode='build';state.mode=mode;for(const m of ['build','discuss','agent'])$('mode-'+m).setAttribute('aria-pressed',String(mode===m));text($('mode-label'),{build:'Build',discuss:'Discuss',agent:'Agent'}[mode]);$('menu-mode').open=false;$('chat-input').placeholder=PLACEHOLDERS[mode];$('send').setAttribute('aria-label',mode==='discuss'?'Ask':mode==='agent'?'Start':'Send');$('send').title=$('send').getAttribute('aria-label');costHint()}
$('mode-build').onclick=()=>setChatMode('build');$('mode-discuss').onclick=()=>setChatMode('discuss');$('mode-agent').onclick=()=>setChatMode('agent');
// The maker's mark beside a model: the real coloured logo from LobeHub's icon set
// (@lobehub/icons-static-svg, MIT, pinned version; THIRD_PARTY_NOTICES), with a lettered square
// behind it until it loads or when there is none.
const MARK_BASE='https://unpkg.com/@lobehub/icons-static-svg@1.101.0/icons/';
const MARK_FILES={anthropic:'claude-color',openai:'openai',google:'gemini-color',meta:'meta-color','meta-llama':'meta-color',deepseek:'deepseek-color',mistralai:'mistral-color',mistral:'mistral-color',qwen:'qwen-color',nvidia:'nvidia-color',microsoft:'microsoft-color','x-ai':'xai',xai:'xai',cohere:'cohere-color',perplexity:'perplexity-color',amazon:'aws-color',moonshotai:'moonshot',moonshot:'moonshot',minimax:'minimax-color','z-ai':'zhipu-color',zai:'zhipu-color',baidu:'baidu-color',bytedance:'bytedance-color',tencent:'tencent-color',ai21:'ai21',nousresearch:'nousresearch',liquid:'liquid',huggingface:'huggingface-color',openrouter:'openrouter'};
function modelMark(m,small){
 const p=(m&&m.provider)||{},key=String(p.key||'').toLowerCase(),box=el('span','m-mark'+(small?' small':''));
 const letter=el('span','m-letter',m&&m.id==='auto'?'✦':(p.name||m&&m.label||'?').charAt(0).toUpperCase());box.append(letter);
 const file=MARK_FILES[key];
 if(file&&m.id!=='auto'){const img=document.createElement('img');img.alt='';img.loading='lazy';img.src=MARK_BASE+file+'.svg';img.onerror=()=>img.remove();box.append(img)}
 return box;
}
function renderTiers(){
 const sel=$('tier');sel.replaceChildren();
 for(const t of state.me.tiers||[]){const o=document.createElement('option');o.value=t.id;o.disabled=!t.enabled;o.textContent=t.label+(t.enabled?'':' (off)');o.title=t.credits+' credit'+(t.credits===1?'':'s')+' per message';if(t.id===state.tier)o.selected=true;sel.append(o)}
 // The model menu, like Lovable's: one short line per model, its name and what a message costs,
 // a tick on the chosen one. The free models (often dozens) sit behind one "Free models" line,
 // with a search box once opened.
 const models=state.me.models||[{id:'auto',label:'Auto',enabled:true}];
 const freeModels=(state.me.free_models||[]).filter(m=>!models.some(x=>x.id===m.id));
 const usable=models.filter(m=>m.enabled),all=[...usable,...freeModels];
 if(!all.some(m=>m.id===state.model))state.model='auto';
 const panel=$('tier-panel');panel.replaceChildren();
 const list=el('div','model-list');panel.append(list);
 const row=m=>{
  const b=document.createElement('button');b.type='button';b.setAttribute('aria-pressed',String(m.id===state.model));b.dataset.name=(m.label+' '+m.id).toLowerCase();
  if(m.note)b.title=m.note;
  const cost=m.id==='auto'?'':m.free===true||m.credits===0?'Free':m.credits?m.credits+' credit'+(m.credits===1?'':'s'):'';
  b.append(modelMark(m),el('b','m-name',m.label),el('span','m-cost',cost));
  b.onclick=()=>{state.model=m.id;try{localStorage.setItem('kairoq-model',m.id)}catch{}$('menu-tier').open=false;renderTiers()};
  return b;
 };
 for(const m of usable)list.append(row(m));
 if(freeModels.length){
  const pickedFree=freeModels.some(m=>m.id===state.model);
  const more=document.createElement('button');more.type='button';more.className='model-more';more.setAttribute('aria-expanded',String(pickedFree));
  more.append(el('b','m-name','Free models'),el('span','m-cost',String(freeModels.length)));
  const box=el('div','model-free');box.hidden=!pickedFree;
  const q=el('input','model-search');q.type='search';q.placeholder='Search free models';q.setAttribute('aria-label','Search free models');
  const flist=el('div','model-list');for(const m of freeModels)flist.append(row(m));
  box.append(q,flist);
  more.onclick=()=>{box.hidden=!box.hidden;more.setAttribute('aria-expanded',String(!box.hidden));if(!box.hidden)q.focus()};
  q.oninput=()=>{const t=q.value.trim().toLowerCase();for(const n of flist.children)n.hidden=Boolean(t)&&!n.dataset.name.includes(t)};
  panel.append(more,box);
 }
 const cur=all.find(m=>m.id===state.model)||usable[0];
 const lbl=$('tier-label');lbl.replaceChildren(modelMark(cur,true),document.createTextNode(cur?cur.label:'Auto'));

}
$('tier').onchange=()=>{state.tier=$('tier').value;costHint()};
function costHint(){
 const base='Screenshot the app on desktop and phone and let the AI fix what looks off';
 if(!state.me||!state.me.viewer||state.me.viewer.kind!=='customer'){text($('cost-hint'),'');$('polish').title=base;return}
 const tier=(state.me.tiers||[]).find(x=>x.id===state.tier),picked=(state.me.models||[]).find(m=>m.id===state.model&&m.credits);
 // A model picked by name is priced at its own credits instead of the tier's.
 const t=picked?{credits:picked.credits}:tier;
 const p=Math.max(t?t.credits:1,state.me.polish_credits||1);$('polish').title=base+' ('+p+' credit'+(p===1?'':'s')+')';
 const n=state.mode==='discuss'?0:(t?t.credits:1)*(state.mode==='agent'?state.me.agent_multiplier||3:1)+(state.attachments.some(a=>a.kind!=='file')?state.me.image_credits:0);
 // Before sending: what this message costs, and what could come on top.
 const img=state.mode!=='discuss'&&state.me.image_generation?.enabled&&state.me.image_generation.credits;
 text($('cost-hint'),state.mode==='discuss'?'Free chat · No project changes':'Build: '+n+' credit'+(n===1?'':'s')+(img?' (+'+img+' per AI image, if generated)':''));
 $('cost-hint').title=state.mode==='discuss'?'Discuss answers questions and plans; it does not change the app.':'Charged when the change is saved. A change that fails or is not kept is free, and so is the fix of a problem it causes.';
}
// What a message cost, for the line under it.
function creditsLabel(m){return m.on_us?'on us':m.credits===0?'free':m.credits+' credit'+(m.credits===1?'':'s')}
// Attachments: button, paste or drop.
$('attach').onclick=()=>{$('menu-plus').open=false;$('attach-input').click()};
$('attach-clip').onclick=()=>$('attach-input').click();
$('attach-input').onchange=()=>{addFiles($('attach-input').files);$('attach-input').value=''};
$('chat-input').addEventListener('paste',e=>{const files=[...(e.clipboardData?.files||[])];if(files.length){e.preventDefault();addFiles(files)}});
$('chat-form').addEventListener('dragover',e=>e.preventDefault());
$('chat-form').addEventListener('drop',e=>{e.preventDefault();addFiles(e.dataTransfer.files)});
// Attachments: images the AI looks at (up to 4, 3 MB each) and files whose text it reads
// (PDF, Word, text, Markdown, CSV, JSON, HTML; up to 3, 10 MB each).
const DOC_FILE=/\.(pdf|docx|txt|md|markdown|csv|json|html?)$/i;
async function addFiles(files){
 text($('chat-error'),'');
 for(const f of [...files]){
  const image=/^image\/(png|jpeg|webp|gif)$/.test(f.type),doc=!image&&DOC_FILE.test(f.name||'');
  if(!image&&!doc){text($('chat-error'),f.name+': attach images (PNG, JPEG, WebP, GIF) or files (PDF, Word .docx, text, Markdown, CSV, JSON, HTML).');continue}
  const count=state.attachments.filter(a=>a.kind===(image?'image':'file')).length;
  if(image&&count>=4){text($('chat-error'),'Attach up to 4 images.');continue}
  if(doc&&count>=3){text($('chat-error'),'Attach up to 3 files.');continue}
  if(f.size>(image?3:10)*1024*1024){text($('chat-error'),f.name+' is larger than '+(image?3:10)+' MB.');continue}
  const dataUrl=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f)});
  state.attachments.push({name:f.name||'pasted.png',dataUrl,kind:image?'image':'file'});
 }
 renderAttachments();
}
function renderAttachments(){
 const wrap=$('attachments');wrap.replaceChildren();
 state.attachments.forEach((a,i)=>{const fig=document.createElement('figure');let img;if(a.kind==='file'){fig.className='file';img=document.createElement('span');img.className='file-chip';img.textContent=a.name;img.title=a.name}else{img=document.createElement('img');img.src=a.dataUrl;img.alt=a.name}const x=document.createElement('button');x.type='button';x.textContent='×';x.setAttribute('aria-label','Remove '+a.name);x.onclick=()=>{state.attachments.splice(i,1);renderAttachments()};fig.append(img,x);wrap.append(fig)});
 wrap.classList.toggle('hidden',!state.attachments.length);costHint();
}
$('chat-form').onsubmit=e=>{e.preventDefault();const message=$('chat-input').value.trim();if(message)send(message,state.mode)};
// Keep the build watcher intact while a separate, read-only discussion streams.
async function discussWhileBuilding(message){
 if(state.sideChatPending){text($('chat-error'),'Your discussion reply is still arriving.');return}
 state.sideChatPending=true;
 const projectId=state.project.id;
 const images=state.attachments.filter(a=>a.kind!=='file').map(a=>({name:a.name,dataUrl:a.dataUrl}));
 $('messages').append(messageItem({role:'user',text:message,mode:'discuss'}));
 let answer=messageItem({role:'assistant',text:'Reading your question…'});$('messages').append(answer);
 $('chat-input').value='';
 try{
  const {job}=await api('/projects/'+projectId+'/chat',{method:'POST',body:{message,mode:'discuss',tier:state.tier,images:images.length?images:undefined}});
  if(state.project?.id!==projectId){answer.remove();return;}
  state.attachments=[];renderAttachments();
  let current=job;
  const deadline=Date.now()+60000;
  while(!['complete','failed'].includes(current.status)){
   if(Date.now()>deadline)throw Error('The discussion is taking longer than expected. Your build continues; reopen the project to retrieve the reply.');
   await new Promise(r=>setTimeout(r,300));
   current=(await api('/jobs/'+job.id)).job;
   if(state.project?.id!==projectId){answer.remove();return;}
   // Show text as soon as the model streams it instead of masking it behind a spinner.
   const said=typeof current.stream?.text==='string'&&current.stream.text.trim()?current.stream.text:'Thinking about your question…';
   if(answer.dataset.streamText!==said){const next=messageItem({role:'assistant',text:said});next.dataset.streamText=said;answer.replaceWith(next);answer=next;}
  }
  if(current.status==='failed'){if(current.saved){answer.remove();const k=(await api('/projects/'+projectId)).project.messages.at(-1);$('messages').append(messageItem(k&&k.failed?k:{role:'assistant',text:current.error,failed:true,retry:message,retry_mode:'discuss'}));return}throw Error(current.error)}
  // Reload the durable conversation, keeping the active build watcher intact.
  if(state.project?.id!==projectId){answer.remove();return;}
  const {project}=await api('/projects/'+projectId);
  if(state.project?.id!==projectId){answer.remove();return;}
  state.project=project;answer.remove();renderMessages();
  if(state.job)renderWork(work.job||state.job);
 }catch(err){answer.remove();if(state.project?.id!==projectId)return;$('messages').append(messageItem({role:'assistant',text:/busy|timed|provider|failed to fetch|network/i.test(err.message)?'The free models could not finish this one, even after trying again. Nothing was changed and no credits were used.':err.message,failed:true,retry:message,retry_mode:'discuss'}));}
 finally{state.sideChatPending=false;}
}
async function send(message,mode,path='/chat',extra={}){
 // One accepted turn at a time; rapid clicks must not duplicate the message.
 if(state.sending)return;
 if(state.job){
  const msg=String(message||'').trim();
  if(!msg)return;
  return discussWhileBuilding(msg);
 }
 state.sending=true;const projectId=state.project.id;
 text($('chat-error'),'');
 const images=state.attachments.filter(a=>a.kind!=='file').map(a=>({name:a.name,dataUrl:a.dataUrl}));
 const files=state.attachments.filter(a=>a.kind==='file').map(a=>({name:a.name,dataUrl:a.dataUrl}));
 state.lastSent=message;$('composer-ideas')?.classList.add('hidden');
 $('messages').append(messageItem({role:'user',text:message,mode,images:[...images,...files].map(i=>i.name)}));$('messages').scrollTop=$('messages').scrollHeight;
 $('chat-input').value='';state.attachments=[];renderAttachments();
 try{const {job}=await api('/projects/'+projectId+path,{method:'POST',body:{message,mode,tier:state.tier,...(state.model&&state.model!=='auto'?{model:state.model}:{}),images:images.length?images:undefined,files:files.length?files:undefined,...extra}});if(state.project?.id===projectId)watch(job)}
 catch(err){
  if(state.project?.id!==projectId)return;
  $('messages').append(messageItem({role:'assistant',text:err.message,failed:true,retry:err.status===402?null:message,retry_mode:mode}));
  if(err.status===402&&state.me.purchases)openBuy();
 }
 finally{state.sending=false;syncSend()}
}
const LABELS={autopilot:'Autopilot: testing the app against your request…',researching:'Looking things up on the web…',pitching:'Writing the pitch and launch posts…',watching:'Running the growth watch…',reproducing:'Replaying what visitors did to confirm the problems…',retesting:'Replaying the same steps on the new version…',locking:'Saving checks so fixed problems cannot come back…',personas:'Creating synthetic customers…',visiting:'Synthetic customers are using your app…',reporting:'Writing the report…',queued:'Starting…',working:'Working…',thinking:'Thinking…',designing:'Choosing the design direction…',modelling:'Modelling a 3D object in Blender…',images:'Generating images…',reviewing:'Reviewing the design on desktop and phone…',checking:'Re-running your saved checks…',writing:'Writing code…',fixing:'Fixing a problem and retrying…',building:'Building preview…',testing:'Testing the app in a browser…',analyzing:'Studying the reference in a browser…',reviews:'Reading what its users say in public reviews…',scoring:'Checking each planned feature against the code…',sweeping:'Checking nothing of the original is left…',planning:'Writing the feature inventory and build plan…',assets:'Finding openly licensed images and assets…',verifying:'Testing the user journeys on desktop and phone…',repairing:'Repairing the journeys that failed…',comparing:'Comparing the design with the reference…',publishing:'Publishing and checking the live app…'};
// ---------- the AI at work: activity rail, Details panel (Timeline / Changes) ----------
const PHASES={autopilot:'Autopilot',queued:'Getting started',thinking:'Understanding your idea',designing:'Designing the interface',modelling:'Modelling in Blender',writing:'Building the application',fixing:'Fixing issues',images:'Generating images',building:'Building the application',testing:'Testing interactions',checking:'Re-running saved checks',reviewing:'Reviewing the design',working:'Working',analyzing:'Studying the reference',reviews:'Reading reviews',scoring:'Match score',sweeping:'Checking for leftovers',planning:'Writing the plan',assets:'Finding licensed images',verifying:'Testing user journeys',repairing:'Repairing failed journeys',comparing:'Comparing with the reference',publishing:'Publishing'};
const work={started:0,timer:null,job:null,files:[],current:null,message:'',tail:'',thinking:''};
function el(tag,cls,txt){const e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e}
// "12s" or "2m 05s" (for "Thought for …"; secs() below gives " in 4.0 s").
function secsShort(ms){const s=Math.max(0,Math.round(ms/1000));return s<60?s+'s':Math.floor(s/60)+'m '+String(s%60).padStart(2,'0')+'s'}
function phaseOf(j){if(j.mode==='discuss')return'thinking';if(j.status==='queued'||(j.status==='writing'&&!(j.stream&&j.stream.chars)))return'thinking';return j.status}
const ICONS={book:'<path d="M4 19.5V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M8 7h7M8 11h5"/>',think:'<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z"/>',plan:'<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',read:'<path d="M4 19.5V5a2 2 0 0 1 2-2h8l6 6v10.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.5z"/><path d="M14 3v6h6"/>',edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',build:'<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',test:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 6.5h.01M10 6.5h.01"/>',check:'<path d="M20 6 9 17l-5-5"/>',fix:'<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',note:'<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',design:'<circle cx="13.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="10.5" r="1.5"/><circle cx="8.5" cy="7.5" r="1.5"/><path d="M12 2a10 10 0 0 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4A5.6 5.6 0 0 0 22 9.8C22 5.5 17.5 2 12 2z"/>',image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',db:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',web:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',logs:'<path d="M4 17l6-6-6-6M12 19h8"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',coin:'<circle cx="12" cy="12" r="9"/><path d="M14.5 9.5a2.5 2 0 0 0-2.5-1.5c-1.4 0-2.5.8-2.5 1.9 0 2.6 5 1.4 5 4.2 0 1.1-1.1 1.9-2.5 1.9a2.5 2 0 0 1-2.5-1.5M12 6.5V8M12 16v1.5"/>',back:'<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',chev:'<path d="m9 6 6 6-6 6"/>',down:'<path d="m6 9 6 6 6-6"/>'};
function icon(name,cls){const s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('viewBox','0 0 24 24');s.setAttribute('class','ico'+(cls?' '+cls:''));s.setAttribute('aria-hidden','true');s.innerHTML=ICONS[name]||ICONS.note;return s}
function fileChip(name,active){const c=el('code','chip'+(active?' active':''),name.replace(/^src\//,''));c.title=name;return c}
// Tiny, safe Markdown: headings, lists, bold, inline code, paragraphs (text only, no HTML).
function inlineMd(parent,textIn){const re=/(\*\*[^*]+\*\*|`[^`]+`)/g;let last=0,m;while((m=re.exec(textIn))){if(m.index>last)parent.append(textIn.slice(last,m.index));const t=m[0];parent.append(t.startsWith('**')?el('strong',null,t.slice(2,-2)):el('code','inline',t.slice(1,-1)));last=m.index+t.length}if(last<textIn.length)parent.append(textIn.slice(last))}
// A table written on one line ("| A | B | | :--- | :--- | | 1 | 2 |") is split back into rows.
function tableLines(src){return String(src||'').replace(/\r/g,'').split('\n').flatMap(l=>/\|\s*:?-{3,}:?\s*\|/.test(l)&&/\|\s+\|/.test(l)?l.trim().split(/\|\s+\|/).map((r,i,a)=>(i?'|':'')+r+(i<a.length-1?'|':'')):[l])}
function tableCells(line){return line.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(c=>c.trim())}
function renderMarkdown(src){
 const root=el('div','md'),lines=tableLines(src);let para=[],stack=[],rows=[];
 const flush=()=>{if(para.length){const p=el('p');inlineMd(p,para.join(' '));root.append(p);para=[]}};
 const closeLists=()=>{stack=[]};
 // Markdown tables become real tables (header row, then body rows; the --- row is skipped).
 const flushTable=()=>{if(!rows.length)return;const body=rows.filter(r=>!/^\|?\s*:?-{3,}/.test(r.trim()));if(body.length){const wrap=el('div','md-table'),t=el('table'),head=el('thead'),tb=el('tbody'),hr=el('tr');for(const c of tableCells(body[0])){const th=el('th');inlineMd(th,c);hr.append(th)}head.append(hr);for(const r of body.slice(1)){const tr=el('tr');for(const c of tableCells(r)){const td=el('td');inlineMd(td,c);tr.append(td)}tb.append(tr)}t.append(head,tb);wrap.append(t);root.append(wrap)}rows=[]};
 for(const raw of lines){
  const line=raw.replace(/\s+$/,'');
  if(/^\s*\|.*\|\s*$/.test(line)){flush();closeLists();rows.push(line);continue}
  flushTable();
  const h=/^(#{1,4})\s+(.*)$/.exec(line),li=/^(\s*)([-*•]|\d+[.)])\s+(.*)$/.exec(line);
  if(!line.trim()){flush();closeLists();continue}
  if(/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)){flush();closeLists();root.append(el('hr'));continue}
  if(h){flush();closeLists();const x=el(h[1].length<=2?'h3':'h4');inlineMd(x,h[2]);root.append(x);continue}
  if(li){
   flush();const depth=Math.min(3,Math.floor(li[1].replace(/\t/g,'  ').length/2)),ordered=/\d/.test(li[2]);
   while(stack.length>depth+1)stack.pop();
   if(stack.length<depth+1||stack.at(-1).ordered!==ordered&&stack.length===depth+1){
    if(stack.length===depth+1)stack.pop();
    const list=el(ordered?'ol':'ul');const parent=stack.length?stack.at(-1).list.lastElementChild||stack.at(-1).list:root;parent.append(list);stack.push({list,ordered});
   }
   const item=el('li');inlineMd(item,li[3]);stack.at(-1).list.append(item);continue;
  }
  if(stack.length&&/^\s{2,}/.test(raw)){inlineMd(stack.at(-1).list.lastElementChild,' '+line.trim());continue}
  closeLists();para.push(line.trim());
 }
 flushTable();flush();return root;
}
// One row of the activity rail. Rows with more detail expand in place.
function editVerb(k){return k==='created'?'Created':k==='deleted'?'Deleted':'Edited'}
function eventRow(e,{expand=false,version=null,live=false}={}){
 const row=el('li','ev ev-'+e.t+(e.ok===false?' bad':''));
 const name=e.t==='note'?(e.icon||'note'):e.t;row.append(icon(name));
 const main=el('div','ev-main'),head=el('div','ev-head');main.append(head);row.append(main);
 let more=null;
 // Kairoq Agent's one line to the owner between steps (react-agent.js "say"): plain text, no pill.
 if(e.t==='say'){const p=el('li','ev ev-say');const t=el('p','ev-say-text');inlineMd(t,e.text||'');p.append(t);return p}
 if(e.t==='think'&&e.note!==undefined){
  head.append(el('span','ev-label',live&&e.live?'Thinking…':'Thought for '+secsShort(e.ms||0)));
  if(e.note)more=()=>el('p','ev-thought',e.note);
 }else if(e.t==='think'){
  if(e.title){const t=el('div','ev-title');inlineMd(t,e.title);main.insertBefore(t,head)}
  head.append(el('span','ev-label',live&&e.live?'Thinking…':'Thought for '+secsShort(e.ms||0)));
  if(e.text)more=()=>el('p','ev-thought',e.text);
 }else if(e.t==='plan'){head.append(el('span','ev-label','Plan'));const ol=el('ol','ev-plan');for(const it of e.items||[]){const x=el('li');inlineMd(x,it);ol.append(x)}main.append(ol)}
 else if(e.t==='read'){head.append(el('span','ev-label','Read'));for(const f of e.files||[])head.append(fileChip(f))}
 else if(e.t==='edit'){head.append(el('span','ev-label',editVerb(e.kind)),fileChip(e.file,live&&e.file===work.current));if(version&&expand)more=()=>diffFor(version,e.file)}
 else if(e.t==='build'){head.append(el('span','ev-label',e.ok?'Built the preview'+secs(e.ms):'The build failed'));if(e.detail)more=()=>el('pre','ev-detail',e.detail)}
 else if(e.t==='test'){head.append(el('span','ev-label',(e.text||'Tested in a browser')+(e.ok?' · no errors':' · found problems')+secs(e.ms)));if(e.detail)more=()=>el('pre','ev-detail',e.detail)}
 else if(e.t==='check'){head.append(el('span','ev-label',e.text||'Saved checks'));if(e.detail)more=()=>el('pre','ev-detail',e.detail)}
 else{head.append(el('span','ev-label',e.text||''));if(e.detail)more=()=>el('pre','ev-detail',e.detail)}
 if(more&&expand){
  row.classList.add('expandable');const t=icon(e.t==='edit'?'down':'chev','toggle');head.append(t);
  let box=null;head.tabIndex=0;head.setAttribute('role','button');
  const toggle=()=>{if(box){box.remove();box=null;row.classList.remove('open');return}box=el('div','ev-more');const c=more();if(c instanceof Promise)c.then(x=>box&&box.append(x));else box.append(c);main.append(box);row.classList.add('open')};
  head.onclick=toggle;head.onkeydown=ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();toggle()}};
 }
 return row;
}
function rail(events,opts){const ol=el('ol','rail');for(const e of events)ol.append(eventRow(e,opts));return ol}
// A one-line summary of what a change did, e.g. "Edited 3 files · tested in a browser".
function summarize(events){
 const edits=[...new Set(events.filter(e=>e.t==='edit').map(e=>e.file))].length,reads=[...new Set(events.filter(e=>e.t==='read').flatMap(e=>e.files||[]))].length;
 const tests=events.filter(e=>e.t==='test'),fixes=events.filter(e=>e.t==='fix').length;
 return[reads&&'read '+reads+' file'+(reads===1?'':'s'),edits&&'edited '+edits+' file'+(edits===1?'':'s'),tests.length&&(tests.at(-1).ok?'tested in a browser':'browser test found problems'),fixes&&'fixed '+fixes+' problem'+(fixes===1?'':'s')].filter(Boolean).join(' · ').replace(/^./,c=>c.toUpperCase());
}
// ---------- live: the chat shows a status line and the latest activity ----------
// While Kairoq thinks, its status says it in a playful word that changes every few seconds
// ("Kairoq Agent is noodling…"). Concrete steps (writing, building, testing) keep their own words.
const THINK_WORDS=['musing','noodling','tinkering','pondering','mulling it over','percolating','brewing ideas','connecting the dots','doodling','puzzling it out','sketching','chewing on it'];
function thinkWord(){return THINK_WORDS[Math.floor(Date.now()/3200)%THINK_WORDS.length]}
function thinkText(lead){const w=thinkWord();return lead+(lead?w:w[0].toUpperCase()+w.slice(1))+'…'}
function sayThinking(node,lead=''){if(!node)return;node.dataset.think=lead;const t=thinkText(lead);if(node.textContent!==t)node.textContent=t}
setInterval(()=>{if(document.hidden)return;for(const n of document.querySelectorAll('[data-think]')){const t=thinkText(n.dataset.think);if(n.textContent!==t){n.textContent=t;n.classList.remove('tw-in');void n.offsetWidth;n.classList.add('tw-in')}}},800);
// Three breathing dots: shown wherever Kairoq is thinking.
function dots(){const d=el('span','k-dots');d.setAttribute('aria-hidden','true');d.append(el('i'),el('i'),el('i'));return d}
// The working mark beside the agent's name: a 4×4 grid of dots that breathes in a wave.
function workingMark(){const g=el('span','k-grid');g.setAttribute('aria-hidden','true');g.dataset.p='think';for(let i=0;i<16;i++){const d=el('i'),x=i%4,y=Math.floor(i/4);d.style.setProperty('--x',x);d.style.setProperty('--y',y);d.style.setProperty('--r',Math.round(Math.hypot(x-1.5,y-1.5)*10)/10);g.append(d)}return g}
// The working grid's pattern says what Kairoq is doing (like Emergent's dot matrix): a pulse from
// the centre while thinking, a wave while writing, rows filling while building, a scan while testing.
function gridPattern(j){
 const p=phaseOf(j);
 if(/^(writing|fixing|repairing|designing|images|working)$/.test(p))return'write';
 if(/^(building|assets|publishing)$/.test(p))return'build';
 if(/^(testing|verifying|checking|reviewing|comparing|visiting|personas)$/.test(p))return'test';
 return'think';
}
// For the kairoq-design tests: render a saved message the way the chat does.
window.kairoqRenderMessage=(m,last,index)=>messageItem(m,last,index);
window.kairoqSetMe=patch=>{Object.assign(state.me,patch);renderTiers()};
function workCard(){
 let li=$('stream');
 if(!li){
  li=el('li','assistant work');li.id='stream';
  const status=el('button','status-line');status.type='button';status.append(workingMark(),el('span','agent-name','Kairoq Agent'),(()=>{const t=el('span','status-text');sayThinking(t,'is ');return t})(),icon('chev'));status.onclick=()=>openDetail('live');
  const head=el('div','work-head');head.append(status,el('span','work-time'));const stop=el('button','ghost work-stop','Stop');stop.type='button';stop.onclick=()=>$('stop-job').click();head.append(stop);
  // Like Lovable: one status line, then what Kairoq says and plans; the step checklist stays in Details.
  li.append(head,el('div','work-msg hidden'),el('ol','stages'),el('p','work-think hidden'),el('ol','rail live'));
  $('messages').append(li);$('messages').scrollTop=$('messages').scrollHeight;
 }
 return li;
}
// The stages of a build, shown as a checklist while it works (and over the preview on a first build).
const STAGES=[['thinking','Understanding your idea'],['designing','Designing the interface'],['writing','Building the application'],['building','Building the application'],['testing','Testing interactions']];
function stageOf(p){return{designing:'designing',modelling:'designing',images:'designing',writing:'writing',fixing:'writing',building:'building',testing:'testing',checking:'testing',reviewing:'testing',autopilot:'testing',verifying:'testing',repairing:'writing'}[p]||'thinking'}
function stageList(j){
 const p=phaseOf(j),cur=stageOf(p);work.seen=work.seen||new Set();work.seen.add(cur);
 const shown=STAGES.filter(([id])=>id!=='designing'||work.seen.has('designing')),at=shown.findIndex(([id])=>id===cur);
 const ol=el('ol','stages');
 shown.forEach(([id,label],i)=>{
  const li=el('li',i<at?'done':i===at?'now':'todo');
  li.append(el('span','st-dot'),el('span','st-label',i===at&&p==='fixing'?'Fixing issues':label));
  // The AI's plan, under "Writing the code", as soon as it has written it.
  if(id==='writing'&&(work.plan||[]).length&&i<=at){const ul=el('ul','st-plan');for(const step of work.plan)ul.append(el('li',null,step));li.append(ul)}
  ol.append(li);
 });
 return ol;
}
// The latest thought, in plain words, while the AI works out what to build.
// Only finished, readable sentences (no code, JSON or half words), and it changes at most every 3 seconds.
function plainSentence(x){const letters=(x.match(/[a-z]/gi)||[]).length;return x.length>=20&&x.length<=200&&/[.!?]$/.test(x)&&letters/x.length>0.7&&!/[{}<>`=;$\\]|\b(const|function|import|return|null|undefined|json)\b|\w+\.(jsx?|tsx?|css)\b/i.test(x)}
function thinkingLine(){
 const t=String(work.thinking||'').replace(/\s+/g,' ').trim();if(!t)return work.thought||'';
 if(work.thought&&Date.now()-(work.thoughtAt||0)<3000)return work.thought;
 const next=t.split(/(?<=[.!?])\s+/).filter(plainSentence).at(-1);
 if(next&&next!==work.thought){work.thought=next;work.thoughtAt=Date.now()}
 return work.thought||'';
}
// A small chip at the foot of the preview says what is happening while the AI works. The preview
// itself stays sharp and usable: no veil, no blur.
// How long a step took, for the timeline (" in 3.4 s").
function secs(ms){return typeof ms==='number'&&ms>=0?' in '+(ms<10000?(ms/1000).toFixed(1):Math.round(ms/1000))+' s':''}
function renderBuildOverlay(j){
 const overlay=$('build-overlay');
 if(!overlay)return;
 if(!j||j.mode==='discuss'||j.status==='complete'||j.status==='failed'){overlay.classList.add('hidden');buildWaiting(null);state.firstBuild=false;return}
 const card=overlay.querySelector('.bo-card');
 const shown=j.preview&&j.preview.version;
 const files=work.files.length;
 // Short, like Lovable and Emergent: what is happening now, nothing about versions.
 const label=(shown&&phaseOf(j)==='verifying'?'Checking it':liveStatus(j))+(phaseOf(j)==='writing'&&files>1?' · '+files+' files':'')+'…';
 const spin=card.querySelector('.bo-spin')||el('span','bo-spin');spin.setAttribute('aria-hidden','true');
 const line=card.querySelector('.bo-line')||el('span','bo-line');
 if(line.textContent!==label)line.textContent=label;
 if(!card.contains(spin))card.replaceChildren(spin,line);
 overlay.classList.remove('first');overlay.classList.remove('hidden');
 // First build: nothing to show yet, so the preview shows the app being put together.
 if(state.firstBuild&&!shown)buildWaiting(label);else{buildWaiting(null);if(shown)state.firstBuild=false}
}
function liveStatus(j){
 const p=phaseOf(j);
 if(j.mode==='discuss')return j.stream&&j.stream.text?'Writing the answer':/\b(suggest|ideas?|recommend|what else|what next)\b/i.test(work.asked||'')?'Thinking about ideas for your app':'Thinking about your question';
 // The agent (react-agent.js) works in rounds: the label follows what it is doing right now, not
 // the round's first phase ("Understanding your idea" stayed on screen for a whole build once).
 if(j.agent&&j.agent.step){
  const ev=j.events||[],last=ev.at(-1),did=ev.some(e=>e.t==='edit'||e.t==='build'||e.t==='test');
  if(p==='thinking')return did?'Thinking about the next step':'Understanding your idea';
  if(p==='repairing')return'Repairing what the checks found';
  if(p==='checking'||p==='reviewing')return PHASES[p];
  if(last&&last.t==='edit')return'Writing the code';
  if(last&&last.t==='build')return'Building the preview';
  if(last&&last.t==='test')return'Testing in a browser';
  if(last&&last.t==='note'&&last.icon==='web')return'Reading the web';
  return did?'Working on it':'Understanding your idea';
 }
 if(p==='writing'&&work.current)return'Writing the code';
 return PHASES[p]||'Working';
}
function liveEvents(j){
 const ev=(j.events||[]).slice();
 // The current thinking, before the model has answered.
 // (While it thinks, the checklist and the thought line above show it.)
 // Files being written right now (from the streamed reply) in Build mode.
 if(j.mode!=='agent'&&phaseOf(j)==='writing')for(const f of work.files)if(!ev.some(e=>e.t==='edit'&&e.file===f))ev.push({t:'edit',file:f,kind:'edited'});
 return ev;
}
function renderWork(j){
 work.job=j;
 const list=$('messages'),stick=list.scrollHeight-list.scrollTop-list.clientHeight<120;
 const li=workCard(),st=j.stream||null;
 if(st&&st.files)for(const f of st.files)if(!work.files.includes(f))work.files.push(f);
 if(st)work.current=st.current||null;
 if(st&&st.plan&&st.plan.length)work.plan=st.plan;
 if(st&&st.message)work.message=st.message;
 if(st&&st.tail)work.tail=st.tail;
 if(j.thinking)work.thinking=j.thinking;
 // "Kairoq Agent is building the application…", like a person at work.
 const kg=li.querySelector('.k-grid'),pat=gridPattern(j);if(kg&&kg.dataset.p!==pat)kg.dataset.p=pat;
 const stx=li.querySelector('.status-text');if(phaseOf(j)==='thinking'&&!(j.mode==='discuss'&&j.stream&&j.stream.text))sayThinking(stx,'is ');else{const st0=liveStatus(j);delete stx.dataset.think;text(stx,'is '+st0.charAt(0).toLowerCase()+st0.slice(1).replace(/\u2026?$/,'')+'\u2026')}
 const ask=j.mode==='discuss';
 li.querySelector('.stages').replaceWith(ask?el('ol','stages hidden'):stageList(j));
 const th=li.querySelector('.work-think'),thought='';th.classList.toggle('hidden',!thought);text(th,thought);
 renderBuildOverlay(j);
 // The steps so far, in the chat, like a coding agent's log: the last eight, the rest folded
 // behind "earlier steps"; a live "Thinking…" row with breathing dots while the model works.
 const r=li.querySelector('.rail.live');r.replaceChildren();
 const events=liveEvents(j),cut=Math.max(0,events.length-8);
 if(cut){const more=el('li','ev ev-more');const b=el('button','link-btn',cut+' earlier step'+(cut===1?'':'s'));b.type='button';b.onclick=()=>openDetail('live');more.append(b);r.append(more)}
 for(const e of events.slice(cut))r.append(eventRow(e,{live:true}));
 // What Kairoq says while it works (its headings and lines), and one line above the message box.
 {const old=li.querySelector('.ks-story');const st=storyRows(j.events||[]);if(st){st.classList.add('live');if(old)old.replaceWith(st);else li.querySelector('.rail.live').after(st)}else old?.remove()}
 liveStrip(j);
 if(phaseOf(j)==='thinking'||(j.status==='writing'&&!(st&&st.chars))){const row=el('li','ev ev-think live');row.append(icon('think'));const main=el('div','ev-main'),head=el('div','ev-head');head.append(el('span','ev-label','Thinking'),dots());main.append(head);row.append(main);r.append(row)}
 li.querySelector('.stages').classList.add('hidden');
 const msg=li.querySelector('.work-msg');
 const said=j.mode==='discuss'&&st?.text?st.text:'';
 const planText='';
 const body=[said,planText].filter(Boolean).join('\n\n');
 msg.classList.toggle('hidden',!body);msg.replaceChildren(body?renderMarkdown(body):'');
 if(detailState.source==='live')renderDetail();
 if(stick)list.scrollTop=list.scrollHeight;
}
function tickWork(){const li=$('stream');if(!li)return;text(li.querySelector('.work-time'),secs(Date.now()-work.started));if(work.job&&phaseOf(work.job)==='thinking'){const r=li.querySelector('.rail.live .ev-think:last-child .ev-label');const ev=work.job.events||[],n=ev.length;if(n!==work.roundEvents){work.roundEvents=n;work.roundAt=Date.now()}const waited=Date.now()-(work.roundAt||work.started),did=ev.some(e=>e.t==='edit'||e.t==='build'||e.t==='test');if(r)text(r,did?(waited>60000?'Still thinking about the next step…':'Thinking about the next step…'):waited>45000?'Planning the app… (a full app plan can take a minute or two)':waited>15000?'Planning the app…':'Thinking…')}if(detailState.source==='live')renderDetail()}
// ---------- the Details panel (over the preview) ----------
const detailState={source:null,tab:'timeline'};
function openDetail(source,tab){detailState.source=source;if(tab)detailState.tab=tab;$('detail').classList.remove('hidden');document.querySelector('.stage').classList.add('show-detail');renderDetail()}
function closeDetail(){detailState.source=null;$('detail').classList.add('hidden');document.querySelector('.stage').classList.remove('show-detail')}
$('detail-close').onclick=closeDetail;
document.querySelector('.stage-bar').addEventListener('click',e=>{if(detailState.source!==null&&e.target.closest('button,a'))closeDetail()});
document.querySelector('.preview-bar').addEventListener('click',e=>{if(detailState.source!==null&&e.target.closest('button,a'))closeDetail()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&detailState.source!==null&&!document.querySelector('dialog[open]'))closeDetail()});
for(const b of document.querySelectorAll('#detail [data-tab]'))b.onclick=()=>{detailState.tab=b.dataset.tab;renderDetail()};
const diffCache=new Map();
async function changesFor(version){if(!diffCache.has(version))diffCache.set(version,api('/projects/'+state.project.id+'/changes?version='+version).catch(e=>{diffCache.delete(version);throw e}));return diffCache.get(version)}
// Line diff (LCS) with 3 lines of context, as a list of hunks.
function lineDiff(a,b){
 const A=a===null?[]:a.split('\n'),B=b===null?[]:b.split('\n');
 if(A.length*B.length>4e6)return[...A.map(t=>({k:'-',t})),...B.map(t=>({k:'+',t}))];
 const n=A.length,m=B.length,dp=Array.from({length:n+1},()=>new Uint32Array(m+1));
 for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)dp[i][j]=A[i]===B[j]?dp[i+1][j+1]+1:Math.max(dp[i+1][j],dp[i][j+1]);
 const out=[];let i=0,j=0;
 while(i<n&&j<m){if(A[i]===B[j]){out.push({k:' ',t:A[i]});i++;j++}else if(dp[i+1][j]>=dp[i][j+1])out.push({k:'-',t:A[i++]});else out.push({k:'+',t:B[j++]})}
 while(i<n)out.push({k:'-',t:A[i++]});while(j<m)out.push({k:'+',t:B[j++]});
 return out;
}
function diffView(f){
 const box=el('div','diff');
 if(f.too_large){box.append(el('p','muted small','This file is too large to show here. Open it in the Code tab.'));return box}
 const lines=lineDiff(f.before,f.after),show=new Array(lines.length).fill(false);
 lines.forEach((l,i)=>{if(l.k!==' ')for(let k=Math.max(0,i-3);k<=Math.min(lines.length-1,i+3);k++)show[k]=true});
 const pre=el('pre');let gap=false,added=0,removed=0;
 lines.forEach((l,i)=>{if(l.k==='+')added++;if(l.k==='-')removed++;if(!show[i]){if(!gap){pre.append(el('span','dl gap','⋯'));gap=true}return}gap=false;pre.append(el('span','dl '+(l.k==='+'?'add':l.k==='-'?'del':'ctx'),(l.k===' '?'  ':l.k+' ')+l.t))});
 const stats=el('div','diff-stats');stats.append(el('span','add','+'+added),el('span','del','−'+removed));
 box.append(stats,pre);return box;
}
async function diffFor(version,file){const d=await changesFor(version);const f=d.files.find(x=>x.path===file);return f?diffView(f):el('p','muted small','No changes to show.')}
function renderDetail(){
 const body=$('detail-body'),src=detailState.source;if(src===null)return;
 const live=src==='live',j=work.job,m=live?null:state.project&&state.project.messages[src];
 if(!live&&!m){closeDetail();return}
 const running=live&&j&&j.status!=='complete'&&j.status!=='failed';
 const version=live?null:m.version||null;
 text($('detail-time'),live?secs(Date.now()-work.started):m.duration_ms!=null?secs(m.duration_ms):'');
 $('detail-time').parentElement.classList.toggle('hidden',!$('detail-time').textContent);
 const cr=live?(j&&j.credits):m.credits;text($('detail-credits'),cr!=null?String(cr):'');$('detail-credits').parentElement.classList.toggle('hidden',cr==null);
 text($('detail-title'),running?liveStatus(j):'Details');
 for(const b of document.querySelectorAll('#detail [data-tab]')){b.setAttribute('aria-pressed',String(b.dataset.tab===detailState.tab));b.disabled=b.dataset.tab==='changes'&&!version}
 if(detailState.tab==='changes'&&!version)detailState.tab='timeline';
 // Keep the scroll position while live updates arrive.
 const top=body.scrollTop,atEnd=body.scrollHeight-body.scrollTop-body.clientHeight<40;
 body.replaceChildren();
 if(detailState.tab==='changes'){
  const list=el('div','changes');body.append(list);list.append(el('p','muted small','Loading changes…'));
  changesFor(version).then(d=>{list.replaceChildren();if(!d.files.length){list.append(el('p','muted','No file changes in this version.'));return}
   list.append(el('p','muted small','Version '+d.version+(d.previous?' compared with version '+d.previous:'')));
   {const b=el('button','ghost','Explain in plain English');b.type='button';b.onclick=()=>explainProblem('change','','What changed in version '+d.version,d.version);list.append(b)}
   d.files.forEach((f,i)=>{const det=el('details','change');det.open=i===0;const s=el('summary');s.append(el('span','ev-label',editVerb(f.status)),fileChip(f.path));det.append(s,diffView(f));list.append(det)});
  }).catch(e=>{list.replaceChildren(el('p','error',e.message))});
  return;
 }
 const events=live?liveEvents(j):(m.timeline||[]);
 if(!events.length&&!live){
  // Older messages, saved before timelines existed.
  if(m.plan&&m.plan.length)events.push({t:'plan',items:m.plan});
  for(const f of m.changed||[])events.push({t:'edit',file:f,kind:'edited'});
 }
 body.append(rail(events,{expand:true,version,live}));
 if(live&&running&&work.tail&&phaseOf(j)==='writing'){const pre=el('pre','stream-code');pre.textContent=String(work.tail).replace(/\\n/g,'\n').replace(/\\t/g,'  ').replace(/\\"/g,'"').split('\n').slice(-30).join('\n');body.append(pre)}
 if(!live&&m.text){const card=el('div','detail-answer');card.append(renderMarkdown(m.text));body.append(card)}
 if(!body.childElementCount||(!events.length&&live))body.append(el('p','muted','Reading your project…'));
 body.scrollTop=live&&atEnd?body.scrollHeight:top;
}
async function watch(job){
 state.job=job;const watchToken=state.watchToken=(state.watchToken||0)+1;busy(true,LABELS[job.status]);refreshCredits();
 const id=state.project.id;
 Object.assign(work,{started:Date.now(),roundAt:0,roundEvents:-1,files:[],current:null,message:'',tail:'',thinking:'',thought:'',thoughtAt:0,asked:state.lastSent||'',plan:[],seen:new Set()});if(detailState.source!==null)closeDetail();
 clearInterval(work.timer);work.timer=setInterval(tickWork,1000);
 const done=await new Promise(resolve=>{
  let finished=false;
  const finish=j=>{if(!finished){finished=true;resolve(j)}};
  const apply=j=>{if(state.watchToken!==watchToken||state.project?.id!==id){finish(null);return;}if(j.preview&&j.preview.url&&j.mode!=='discuss')swapPreview(j.preview.url);if(j.browser)window.kairoqBrowserPane?.show(j.browser);renderBuildOverlay(j);text($('progress-text'),(j.mode==='agent'&&j.agent&&j.agent.step?'Step '+j.agent.step+' · ':'')+(j.progress||LABELS[j.status]||'Working…'));if(j.status!=='complete'&&j.status!=='failed')renderWork(j);if(j.status==='complete'||j.status==='failed')finish(j)};
  apply(job);
  if(finished)return;
  if(window.EventSource){
   const es=new EventSource('/api/create/jobs/'+job.id+'/events');
   es.onmessage=e=>{const j=JSON.parse(e.data);apply(j);if(finished)es.close()};
   es.onerror=()=>{es.close();poll()};
  }else poll();
  async function poll(){
   while(!finished){
    await new Promise(r=>setTimeout(r,1000));
    try{apply((await api('/jobs/'+job.id)).job)}catch(err){text($('chat-error'),err.message);finish(null)}
   }
  }
 });
 if(state.watchToken!==watchToken||state.project?.id!==id)return done;
 clearInterval(work.timer);renderBuildOverlay(null);liveStrip(null);
 const wasLive=detailState.source==='live';
 $('stream')?.remove();
 try{if(done&&state.project&&state.project.id===id){
  const {project,account}=await api('/projects/'+id);
  if(state.watchToken!==watchToken||state.project?.id!==id)return done;
  // A first build can turn the project into a native app: switch to the phone frame then.
  const becameNative=Boolean(project.native)&&!state.project.native;
  state.project=project;if(account)renderCredits(account);
  if(becameNative)device(true);
  $('run-phone').classList.toggle('hidden',!project.native);$('stores-open').classList.toggle('hidden',!project.native);
  state.runtimeErrors=[];
  renderMessages();renderVersions();
  if(wasLive){const k=state.project.messages.length-1;if(k>=0&&state.project.messages[k].role==='assistant')openDetail(k);else closeDetail()}
  if(done.mode!=='discuss'){if(project.preview_url!==state.previewBase)swapPreview(project.preview_url);// "Preview ready" only when this run made a new version; a run that built nothing says so itself.
  const builtNothing=Boolean(done.result&&done.result.not_built);
  if(done.status==='complete'&&!done.problem&&!builtNothing&&project.preview_url){const ready=el('li','assistant preview-ready','Preview ready');ready.setAttribute('role','status');$('messages').append(ready)}}
  if(done.problem)$('messages').append(messageItem({role:'assistant',text:(done.problem==='checks'?'This change still breaks a saved check. Use Fix it or describe the problem.':'This change still shows errors in the browser. Use Fix it to repair them.')+(done.free?' '+done.free:'')+(done.fix_on_us?' The fix is on us: the next Fix costs nothing.':'')}));
  // The not-built message already says nothing was charged; a second "it was free" line repeats it.
  else if(done.free&&!(done.result&&done.result.not_built))$('messages').append(messageItem({role:'assistant',text:done.free}));
  if(done.model_fallback)$('messages').append(messageItem({role:'assistant',text:done.model_fallback}));
  if(done.result&&done.result.polish_error)$('messages').append(messageItem({role:'assistant',text:done.result.polish_error}));
  if(done.result&&done.result.reference&&done.mode==='agent')$('messages').append(messageItem({role:'assistant',text:referenceReport(done.result.reference)}));
  // A message that could not be built stays in the chat and goes back in the box to try again.
  const saved=done.status==='failed'&&done.saved;
  if(done.status==='failed'&&!saved&&state.lastSent&&!state.project.messages.some(m=>m.role==='user'&&m.text===state.lastSent)){$('messages').append(messageItem({role:'user',text:state.lastSent}));if(!$('chat-input').value.trim()){$('chat-input').value=state.lastSent;syncSend()}}
  if(done.status==='failed'&&!saved)$('messages').append(messageItem({role:'assistant',retry:done.retry?state.lastSent:null,retry_mode:done.mode,text:done.error+(done.credits&&state.me.viewer.kind==='customer'?(done.mode==='repair'?'\nRounds that did not finish were refunded.':'\nYour credits were refunded.'):''),failed:true}));
  if(state.code)renderFiles();
  if(state.data)renderData();
 }
 }catch(err){text($('chat-error'),'The operation finished, but the conversation could not refresh. Reopen this project to load your saved messages.');}
 finally{if(state.watchToken===watchToken){state.job=null;work.job=null;busy(false);syncSend();const end=state.project?.messages?.at(-1),list=$('messages');if(end&&end.role==='assistant'&&end.duration_ms!=null&&!end.failed&&!end.version&&list&&!list.querySelector('.agent-done')){list.append(doneLine(end));list.scrollTop=list.scrollHeight}}}
 return done;
}
// ---------- mobile app ----------
async function renderMobile(){
 const id=state.project.id,d=await api('/projects/'+id+'/mobile'),m=d.mobile;
 $('mobile-enabled').checked=m.enabled;$('mobile-name').value=m.name;$('mobile-short').value=m.short_name;$('mobile-theme').value=m.theme_color;$('mobile-appid').value=m.app_id;
 const sel=$('mobile-icon');sel.replaceChildren(new Option('Letters on the theme colour',''));for(const a of d.assets)sel.append(new Option(a,a));sel.value=m.icon||'';
 $('mobile-icon-preview').src='/api/create/projects/'+id+'/appicon?t='+Date.now();
 $('mobile-download').href='/api/create/projects/'+id+'/download';
 $('mobile-qr').classList.toggle('hidden',!d.url);
 if(d.url)$('mobile-qr').src='/api/create/projects/'+id+'/qr?t='+Date.now();
 text($('mobile-url'),d.url?d.url:'Publish the app first, then scan the code with your phone camera.');
 // Owner-only setup detail (the KAIROQ_SITES_DOMAIN variable) is shown to the owner only.
  text($('mobile-install-note'),d.url&&!d.installable?'Installing works on the app\'s own address or custom domain ('+(state.me?.viewer?.kind==='owner'?'set KAIROQ_SITES_DOMAIN or ':'')+'add a domain in Publish). This link opens as a normal web page.':'');
 const editor=state.project.role!=='viewer';for(const el of ['mobile-enabled','mobile-name','mobile-short','mobile-theme','mobile-icon','mobile-appid','mobile-save'])$(el).disabled=!editor;
}
$('mobile-open').onclick=async()=>{text($('mobile-error'),'');text($('mobile-status'),'');try{await renderMobile();$('mobile-dialog').showModal()}catch(err){text($('chat-error'),err.message)}};
$('mobile-save').onclick=async()=>{
 text($('mobile-error'),'');
 try{
  const {mobile}=await api('/projects/'+state.project.id+'/mobile',{method:'POST',body:{enabled:$('mobile-enabled').checked,name:$('mobile-name').value,short_name:$('mobile-short').value,theme_color:$('mobile-theme').value,icon:$('mobile-icon').value,app_id:$('mobile-appid').value}});
  state.project.mobile=mobile;device(mobile.enabled);
  text($('mobile-status'),mobile.enabled?'Saved. The AI now designs phone-first; ask it to "make this a mobile app" to adapt the current screens.':'Saved.');
  setTimeout(()=>{$('mobile-icon-preview').src='/api/create/projects/'+state.project.id+'/appicon?t='+Date.now()},1500);
 }catch(err){text($('mobile-error'),err.message)}
};
// ---------- Figma import ----------
// Two dialogs share the id "figma-dialog" (Send to Figma comes first in the page), so $('figma-dialog')
// and $('figma-error') reach the Send one. The import form has its own id: use its dialog and error line.
const figmaImportDialog=()=>$('figma-form').closest('dialog');
const figmaImportError=()=>$('figma-form').querySelector('.error');
$('figma-open').onclick=async()=>{
 text(figmaImportError(),'');
 const owner=state.project.role==='owner'||!state.project.role;
 $('figma-save').closest('label').classList.toggle('hidden',!owner);
 text($('figma-cost'),'Builds with the '+(state.mode==='agent'?'Agent':'Build')+' mode and the tier selected in the chat.');
 try{const {token_saved}=await api('/projects/'+state.project.id+'/figma');text($('figma-token-status'),token_saved?'(saved; leave empty to reuse)':'')}catch{}
 figmaImportDialog().showModal();
};
$('figma-import').onclick=async()=>{
 if(state.job)return;
 text(figmaImportError(),'');
 const url=$('figma-url').value.trim();if(!url){text(figmaImportError(),'Paste the frame link.');return}
 $('figma-import').disabled=true;
 try{
  const r=await api('/projects/'+state.project.id+'/figma',{method:'POST',body:{url,token:$('figma-token').value.trim()||undefined,save_token:$('figma-save').checked,message:$('figma-message').value.trim(),mode:state.mode==='agent'?'agent':'build',tier:state.tier}});
  figmaImportDialog().close();$('figma-token').value='';
  $('messages').append(messageItem({role:'user',text:'Import from Figma: '+r.frame.name+(r.frame.images.length?' ('+r.frame.images.length+' images)':'')}));
  watch(r.job);
 }catch(err){text(figmaImportError(),err.message);if(err.status===402&&state.me.purchases)openBuy()}
 finally{$('figma-import').disabled=false}
};
// ---------- build from a reference ----------
const refState={plan:null,info:null};
function referenceReport(r){
 const L=['Build from reference: finished.'];
 if(r.last_run){const d=r.last_run.desktop,p=r.last_run.phone;L.push('Journeys: '+d.passed+'/'+d.ran+' pass on desktop, '+p.passed+'/'+p.ran+' on phone'+(r.repairs?' after '+r.repairs+' repair round'+(r.repairs>1?'s':''):'')+'.');for(const f of r.last_run.failed||[])L.push('• Still failing: '+f.name+(f.step?' (at '+f.step+')':'')+(f.error?': '+f.error:''))}
 else if(!r.checks.length)L.push('No journeys were tested (the browser is not available or the plan had none).');
 if(r.design)L.push('Design compared with the reference: '+r.design.score+'/10'+(r.polished?', then polished.':'.')+(r.design.improvements.length&&!r.polished?' Ideas: '+r.design.improvements.slice(0,3).join('; '):''));
 if(r.match&&r.match.score!=null){L.push('Match score: '+r.match.score+'% of the planned features'+(r.match.musts?' ('+r.match.musts_done+' of '+r.match.musts+' must-haves done)':'')+'.');for(const m of r.match.missing.slice(0,5))L.push('• '+(m.status==='partial'?'Partly done: ':'Missing: ')+m.name+(m.why?' ('+m.why+')':''));if(r.match.missing.length)L.push('Ask "build the missing features" to finish them.');if((r.match.added||[]).length)L.push('Your improvements: '+r.match.added.map(a=>a.name+(a.status==='yes'?' ✓':a.status==='partial'?' (partly)':' (not yet)')).join(', ')+'.')}
 if(r.leftovers&&!r.leftovers.length&&r.match)L.push('Nothing of the original\'s name, address or brand colours is left.');
 if(r.published)L.push((r.published.ok?'Published and verified: ':'Published, but the live check found problems: ')+r.published.url+(r.published.errors.length?' ('+r.published.errors.join('; ')+')':''));
 if(r.github)L.push('Pushed to GitHub: '+(r.github.url||r.github.repo)+(r.github.warning?' ('+r.github.warning+')':''));
 for(const p of r.problems||[])L.push('• '+p);
 return L.join('\n');
}
// What its users complain about (react-reviews.js): real reviews, counts and linked quotes, then
// the fixes the owner can tick into their version.
const SOURCE_NAMES={'app-store':'App Store','hacker-news':'Hacker News'};
function showReviews(rv){
 const box=$('ref-reviews-box');box.classList.toggle('hidden',!rv);if(!rv)return;
 const tried=(rv.sources_tried||[]).map(s=>s.source+(s.count?' ('+s.count+')':s.note?' ('+s.note+')':' (none)')).join(', ');
 text($('ref-reviews-sources'),rv.error?rv.error:rv.reviews?'Read '+rv.reviews+' public review'+(rv.reviews===1?'':'s')+' and comments about '+rv.name+': '+tried+'. Every quote is copied exactly, with its link.':'No public reviews found for '+rv.name+(tried?': '+tried:'')+'.');
 const tl=$('ref-themes');tl.replaceChildren();
 for(const t of rv.themes||[]){
  const head=refSpan(t.label+' · '+t.count+' mention'+(t.count===1?'':'s')+(t.avg_rating!=null?' · '+t.avg_rating+'★ average':'')+(t.thin?' · few mentions':''));head.className='ref-theme-head'+(t.kind==='request'?' req':'');
  const quotes=document.createElement('div');quotes.className='ref-quotes';
  for(const q of t.quotes.slice(0,2)){const bq=document.createElement('blockquote');bq.append(refSpan('“'+q.quote+'” '));const a=document.createElement('a');a.href=q.url;a.target='_blank';a.rel='noopener nofollow';a.textContent=(SOURCE_NAMES[q.source]||q.source)+(q.rating?' '+q.rating+'★':'');bq.append(a);quotes.append(bq)}
  tl.append(refItem([head,quotes]));
 }
 const fl=$('ref-fixes');fl.replaceChildren();
 (rv.fixes||[]).forEach((f,i)=>{const l=document.createElement('label');l.className='check';const c=document.createElement('input');c.type='checkbox';c.dataset.fix=i;c.checked=i<2;l.append(c,refSpan(' '+f.title));fl.append(refItem([l,refSpan('Because '+f.count+' mention'+(f.count===1?'':'s')+': '+f.theme_label.toLowerCase()+'. Adds: '+f.feature.name,'muted')]))});
 $('ref-fixes-box').classList.toggle('hidden',!(rv.fixes||[]).length);
 text($('ref-angle'),rv.angle?'How to sell it: '+rv.angle:'');
}
function pickedFixes(){return[...document.querySelectorAll('#ref-fixes input[data-fix]')].filter(c=>c.checked).map(c=>Number(c.dataset.fix))}
function refStep(n){$('ref-step1').classList.toggle('hidden',n!==1);$('ref-step2').classList.toggle('hidden',n!==2)}
function priceFor(kind){const p=(refState.info&&refState.info.prices||[]).find(x=>x.tier===state.tier);return p?p[kind]:null}
async function openReference(){
 text($('ref-error'),'');
 try{refState.info=await api('/projects/'+state.project.id+'/reference')}catch(err){text($('chat-error'),err.message);return}
 const i=refState.info;
 $('ref-app-box').classList.toggle('hidden',!i.rea);
 $('ref-owner-box').classList.toggle('hidden',!i.can_publish);
 const a=priceFor('analyze'),b=priceFor('build');
 text($('ref-cost'),(i.browser?'':'Website analysis is not available on this server (no browser); use a repository or screenshots. ')+(a!=null&&state.me.viewer.kind==='customer'?'Analysis and plan: '+a+' credits on the '+state.tier+' model. Building it: '+b+' credits (agent build, browser tests, repairs and design review). A failed step is refunded.':''));
 if(i.reference&&i.reference.plan){showPlan(i.reference);refStep(2)}else refStep(1);
 $('ref-dialog').showModal();
}
function refItem(html){const x=document.createElement('li');x.append(...html);return x}
function refSpan(t,cls){const x=document.createElement('span');x.textContent=t;if(cls)x.className=cls;return x}
function showPlan(ref){
 const plan=ref.plan,a=ref.analysis||{};refState.plan=plan;
 const src=a.kind==='website'?a.url+' — '+a.pages.length+' page'+(a.pages.length===1?'':'s')+' studied, '+a.api_calls+' API call'+(a.api_calls===1?'':'s')+' observed'+(a.integrations.length?', services: '+a.integrations.join(', '):'')+(a.openapi?', OpenAPI with '+a.openapi.endpoints+' endpoints':'')+(a.rea?', REA network analysis':'')+(a.robots_skipped&&a.robots_skipped.length?' ('+a.robots_skipped.length+' page'+(a.robots_skipped.length===1?'':'s')+' skipped for robots.txt)':'')
  :a.kind==='repo'?a.url+' — '+(a.frameworks.join(', ')||a.languages.join(', '))+'; license: '+a.license.name+(a.license.use!=='permissive'?' (code is not reused)':'')
  :a.kind==='app'?a.name+' — '+a.files+' files analyzed with REA':(a.count||0)+' screenshots';
 text($('ref-summary'),plan.name+': '+plan.summary+'\nFrom '+src);
 $('ref-summary').style.whiteSpace='pre-line';
 const shots=$('ref-shots');shots.replaceChildren();for(const n of ref.shots||[]){const img=document.createElement('img');img.alt='Reference screenshot';img.loading='lazy';img.src='/api/create/projects/'+state.project.id+'/refshot?name='+encodeURIComponent(n);shots.append(img)}
 const fl=$('ref-features');fl.replaceChildren();
 plan.features.forEach((f,i)=>{const l=document.createElement('label');l.className='check';const c=document.createElement('input');c.type='checkbox';c.checked=f.enabled!==false;c.dataset.i=i;l.append(c,refSpan(' '+f.name+' ('+(f.priority===1?'must have':f.priority===2?'should have':'nice to have')+')'));fl.append(refItem([l,refSpan(f.description,'muted')]))});
 const pl=$('ref-pages');pl.replaceChildren();for(const p of plan.pages)pl.append(refItem([refSpan(p.path+' '+p.name),refSpan(p.purpose+(p.sections.length?' · '+p.sections.join(' · '):''),'muted')]));
 const dl=$('ref-data');dl.replaceChildren();
 for(const e of plan.entities)dl.append(refItem([refSpan('Data: '+e.name+' ('+e.access+')'),refSpan(e.fields.join(', '),'muted')]));
 dl.append(refItem([refSpan(plan.auth.required?'Sign-in: '+(plan.auth.methods.join(', ')||'email')+(plan.auth.roles.length?' · roles: '+plan.auth.roles.join(', '):''):'No sign-in in the first version')]));
 for(const x of plan.integrations)dl.append(refItem([refSpan('Integration: '+x.name),refSpan(x.purpose+' — '+x.how,'muted')]));
 showReviews(ref.reviews);
 const sk=$('ref-skip');sk.replaceChildren();for(const o of plan.out_of_scope||[])sk.append(refItem([refSpan(o.what),refSpan(o.why,'muted')]));$('ref-skip-box').classList.toggle('hidden',!(plan.out_of_scope||[]).length);
 const jl=$('ref-journeys');jl.replaceChildren();for(const j of plan.journeys)jl.append(refItem([refSpan(j.name),refSpan(j.steps,'muted')]));
 if(!plan.journeys.length)jl.append(refItem([refSpan('None planned','muted')]));
 const d=$('ref-design');d.replaceChildren();
 if(plan.design){for(const k of ['background','foreground','primary','secondary','accent']){const c=plan.design.palette[k];if(!c)continue;const sw=document.createElement('span');sw.className='swatch';sw.style.background=c;sw.title=k+' '+c;d.append(sw)}d.append(refSpan(plan.design.name+' · '+plan.design.fonts.display+' / '+plan.design.fonts.body))}
 $('ref-plan').value=JSON.stringify(plan,null,2);
 const b=priceFor('build');text($('ref-build-cost'),b!=null&&state.me.viewer.kind==='customer'?'Building costs '+b+' credits on the '+state.tier+' model. If journeys still fail or the app shows errors after the repairs, it is free.':'');
}
$('ref-features').onchange=e=>{const i=e.target.dataset.i;if(i===undefined)return;try{const p=JSON.parse($('ref-plan').value);if(p.features&&p.features[i]){p.features[i].enabled=e.target.checked;$('ref-plan').value=JSON.stringify(p,null,2)}}catch{}};
$('ref-github').onchange=()=>$('ref-github-repo').classList.toggle('hidden',!$('ref-github').checked);
$('ref-open').onclick=()=>{if(!state.project)return;openReference()};
$('ref-back').onclick=()=>{text($('ref-error'),'');refStep(1)};
const asDataUrl=f=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f)});
$('ref-analyze').onclick=async()=>{
 if(state.job)return;
 text($('ref-error'),'');
 const url=$('ref-url').value.trim(),repo=$('ref-repo').value.trim(),files=[...$('ref-images').files].slice(0,4),zip=$('ref-app').files[0];
 if(!url&&!repo&&!files.length&&!zip){text($('ref-error'),'Give a website, a repository, app files or screenshots.');return}
 if(zip&&!$('ref-rights').checked){text($('ref-error'),'Confirm that you have the right to analyze this app.');return}
 $('ref-analyze').disabled=true;
 try{
  const images=[];for(const f of files){if(f.size>3*1024*1024)throw Error(f.name+' is larger than 3 MB');images.push({name:f.name,dataUrl:await asDataUrl(f)})}
  const app=zip?{name:zip.name,data:await asDataUrl(zip)}:undefined;
  const r=await api('/projects/'+state.project.id+'/reference',{method:'POST',body:{step:'analyze',url:zip||repo?undefined:url,repo:zip?undefined:repo||undefined,app,rights:$('ref-rights').checked,images,note:$('ref-note').value.trim(),tier:state.tier}});
  $('ref-dialog').close();
  $('messages').append(messageItem({role:'user',text:'Study the reference: '+(zip?zip.name:repo||url||files.length+' screenshots')}));
  const done=await watch(r.job);
  if(done&&done.status==='complete'&&done.result&&done.result.reference){refState.info=await api('/projects/'+state.project.id+'/reference');showPlan(refState.info.reference);refStep(2);$('ref-dialog').showModal()}
 }catch(err){text($('ref-error'),forViewer(err.message));if(err.status===402&&state.me.purchases)openBuy()}
 finally{$('ref-analyze').disabled=false}
};
$('ref-build').onclick=async()=>{
 if(state.job)return;
 text($('ref-error'),'');
 let plan;try{plan=JSON.parse($('ref-plan').value)}catch{text($('ref-error'),'The plan JSON is not valid. Fix it or reopen the dialog.');return}
 $('ref-build').disabled=true;
 try{
  const github=$('ref-github').checked?{repo:$('ref-github-repo').value.trim()||undefined}:undefined;
  const r=await api('/projects/'+state.project.id+'/reference',{method:'POST',body:{step:'build',plan,fixes:pickedFixes(),tier:state.tier,publish:$('ref-publish').checked,github}});
  $('ref-dialog').close();
  $('messages').append(messageItem({role:'user',text:'Build "'+plan.name+'" from the approved plan'+($('ref-publish').checked?', then publish':'')}));
  watch(r.job);
 }catch(err){text($('ref-error'),forViewer(err.message));if(err.status===402&&state.me.purchases)openBuy()}
 finally{$('ref-build').disabled=false}
};
$('stop-job').onclick=async()=>{if(!state.job)return;$('stop-job').disabled=true;try{await api('/jobs/'+state.job.id+'/cancel',{method:'POST'})}catch(err){text($('chat-error'),err.message)}finally{$('stop-job').disabled=false}};
function busy(on,label){$('progress').classList.toggle('hidden',!on);$('send').disabled=false;$('fix').disabled=on;if(label)text($('progress-text'),label)}
async function refreshCredits(){try{const v=await loadMe();if(v&&v.account)renderCredits(v.account)}catch{}}

// ---------- visual edits ----------
state.selecting=false;
function postFrame(msg){try{$('frame').contentWindow.postMessage({source:'kairoq-editor',...msg},'*')}catch{}}
$('frame').addEventListener('load',()=>{if(state.selecting)setTimeout(()=>postFrame({type:'select-mode',on:true}),300)});
function previewVersion(){return Number($('versions').value)||state.project.current_version}
$('visual-toggle').onclick=()=>{
 state.selecting=!state.selecting;
 if(state.selecting&&previewVersion()!==state.project.current_version){$('versions').value=state.project.current_version;setPreview(state.project.preview_url)}
 if(state.selecting)view('preview');
 $('visual-toggle').setAttribute('aria-pressed',String(state.selecting));
 postFrame({type:'select-mode',on:state.selecting});
 state.selected=null;renderVisual();
};
$('visual-cancel').onclick=()=>{state.selecting=false;$('visual-toggle').setAttribute('aria-pressed','false');postFrame({type:'select-mode',on:false});state.selected=null;renderVisual()};
const COLORS=[['slate-900','#0f172a'],['white','#ffffff'],['rose-600','#e11d48'],['amber-500','#f59e0b'],['emerald-600','#059669'],['sky-600','#0284c7'],['indigo-600','#4f46e5'],['violet-600','#7c3aed']];
function renderVisual(){
 $('visual-panel').classList.toggle('hidden',!state.selecting);
 $('chat-form').classList.toggle('hidden',state.selecting);
 const el=state.selected;
 $('visual-fields').classList.toggle('hidden',!el);
 text($('visual-hint'),el?'Editing this element. Click another element to switch.':'Click any element in the preview to edit it. Visual edits are free.');
 text($('visual-error'),'');
 if(!el)return;
 text($('visual-tag'),'<'+el.tag+'>');
 $('visual-text').value=el.text??'';$('visual-text').disabled=!el.text_editable;
 text($('visual-text-label').firstChild,el.text_editable?'Text':'Text (set by code: ask the AI to change it)');
 $('visual-class').value=el.class_name??'';$('visual-class').disabled=el.class_name===null;
 $('visual-image').classList.toggle('hidden',el.tag!=='img');
 $('visual-src').value=el.src??'';$('visual-alt').value=el.alt??'';
 const sw=$('swatches');sw.replaceChildren();
 for(const kind of ['text','bg']){const lab=document.createElement('span');lab.className='muted small swatch-label';lab.textContent=kind==='bg'?'Background':'Text';sw.append(lab);for(const [name,hex] of COLORS){const b=document.createElement('button');b.type='button';b.style.background=hex;b.title=kind+'-'+name;b.setAttribute('aria-label',(kind==='bg'?'Background ':'Text ')+name);if(kind==='bg')b.style.borderRadius='4px';b.onclick=()=>{const re=kind==='bg'?/\bbg-[a-z]+(-\d+)?\b/g:/\btext-(?:white|black|[a-z]+-\d+)\b/g;$('visual-class').value=($('visual-class').value.replace(re,'').trim()+' '+kind+'-'+name).trim()};sw.append(b)}}
 if(el.tag==='img')api('/projects/'+state.project.id+'/assets').then(({assets})=>{const sel=$('visual-uploads');sel.replaceChildren(new Option('Use an uploaded image…',''));for(const a of assets)sel.append(new Option(a.name,a.path))}).catch(()=>{});
}
$('visual-uploads').onchange=()=>{if($('visual-uploads').value)$('visual-src').value=$('visual-uploads').value};
$('visual-panel').onsubmit=async e=>{
 e.preventDefault();const el=state.selected;if(!el)return;
 const changes={};
 if(el.text_editable&&$('visual-text').value!==(el.text??''))changes.text=$('visual-text').value;
 if(el.class_name!==null&&$('visual-class').value!==(el.class_name??''))changes.className=$('visual-class').value;
 if(el.tag==='img'){if($('visual-src').value!==(el.src??''))changes.src=$('visual-src').value;if($('visual-alt').value!==(el.alt??''))changes.alt=$('visual-alt').value}
 if(!Object.keys(changes).length){text($('visual-error'),'Nothing changed yet.');return}
 $('visual-apply').disabled=true;
 try{
  const {project}=await api('/projects/'+state.project.id+'/visual',{method:'POST',body:{loc:el.loc,version:state.project.current_version,changes}});
  state.project=project;state.selected=null;renderMessages();renderVersions();setPreview(project.preview_url);
 }catch(err){text($('visual-error'),err.message)}
 finally{$('visual-apply').disabled=false}
};

// ---------- runtime errors from the preview ----------
window.addEventListener('message',e=>{
 if(e.source!==$('frame').contentWindow||!e.data||e.data.source!=='kairoq-app')return;
 if(e.data.type==='select'&&state.selecting){api('/projects/'+state.project.id+'/inspect',{method:'POST',body:{loc:e.data.loc,version:previewVersion()}}).then(({element})=>{state.selected={...element,loc:e.data.loc};renderVisual()}).catch(err=>{state.selected=null;renderVisual();text($('visual-error'),err.message)});return}
 if(e.data.type==='route'){const m=/\/v\/\d+\/(.*)$/.exec(String(e.data.path||''));const r=m?m[1]:'';state.previewRoute=r.length<300&&!r.includes('..')&&/^[\w\-./?=&#%~+]*$/.test(r)?r:''}
 if(e.data.type==='ready'){state.previewReady=true;clearTimeout(state.previewTimer);$('preview-notice').classList.add('hidden')}
 if(e.data.type==='runtime-error'){const msg=String(e.data.message||'').slice(0,800);if(msg&&!state.runtimeErrors.includes(msg)&&state.runtimeErrors.length<10){state.runtimeErrors.push(msg);renderErrors()}}
});
function currentVersionErrors(){return state.project?.versions.find(v=>v.n===state.project.current_version)?.runtime_errors||[]}
function renderErrors(){
 const errors=[...new Set([...state.runtimeErrors,...currentVersionErrors()])];
 $('errors').classList.toggle('hidden',!errors.length);
 text($('errors-count'),errors.length+' problem'+(errors.length===1?'':'s')+' found while running the app');
 const list=$('errors-list');list.replaceChildren();
 for(const e of errors){const li=document.createElement('li');li.textContent=e;list.append(li)}
}
$('fix').onclick=()=>{
 const errors=[...new Set([...state.runtimeErrors,...currentVersionErrors()])];
 if(errors.length)send('Fix the problems found while running the app.','build','/fix',{errors});
};

// ---------- publish & domains ----------
$('publish-open').onclick=()=>{renderPublish();renderInsights().catch(()=>{});$('publish-dialog').showModal()};
function slugFrom(name){return String(name||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)}
function renderPublish(){
 const p=state.project;
 $('slug').value=p.published?.slug||slugFrom(p.name);
 text($('slug-preview'),location.origin+'/sites/'+($('slug').value||'…')+'/');
 $('unpublish').classList.toggle('hidden',!p.published);
 // Live hosting: what it costs and when it renews (owner projects show nothing).
 const h=p.hosting||{},note=$('hosting-note');
 note.classList.toggle('hidden',!h.price&&!h.domain_price);if(!h.price&&h.domain_price)text(note,'Publishing on your Kairoq address is free. Hosting on your own domain costs '+h.domain_price+' credits a month, from when you connect it.');note.classList.toggle('warn',Boolean(h.paused||h.failing_since));
 if(h.price){
  const until=h.paid_until?new Date(h.paid_until).toLocaleDateString([], {dateStyle:'medium'}):null,paid=h.paid_until&&Date.parse(h.paid_until)>Date.now()&&!h.paused;
  text(note,h.paused?'This site is paused: its monthly '+h.price+' credits could not be charged. Add credits and it comes back within the hour.':h.failing_since?'The monthly '+h.price+' credits could not be charged. Add credits soon: the site pauses '+h.grace_days+' days after the first try.':paid?'Live hosting is paid until '+until+'. It renews for '+h.price+' credits a month.':'Live hosting: '+h.price+' credits a month, charged when you publish.');
 }
 text($('publish').firstChild,p.published?'Update to current version (v'+p.current_version+')':'Publish current version');
 const links=$('live-links');links.replaceChildren();
 if(p.urls){
  const status=document.createElement('p');status.className='muted small';const lc=p.published.live_check;status.textContent='Live: version '+p.published.version+', published '+when(p.published.at)+(lc?(lc.ok?' · ✓ the live link opens without errors':' · ✗ the live link shows problems: '+lc.errors.join('; ')):'');links.append(status);
  for(const u of [p.urls.path,p.urls.subdomain,...p.urls.domains].filter(Boolean)){const a=document.createElement('a');a.href=u;a.target='_blank';a.rel='noopener';a.textContent=u;links.append(a)}
 }
 const list=$('domains');list.replaceChildren();
 for(const d of p.domains){
  const li=document.createElement('li'),head=document.createElement('div');
  head.className='row';head.style.marginTop='0';
  const name=document.createElement('strong');name.textContent=d.hostname;name.style.flex='1';
  const badge=document.createElement('span');badge.className='badge'+(d.verified?' live':'');badge.textContent=d.verified?(d.https==='manual'?(state.me?.viewer?.kind==='owner'?'Connected · add in Railway for HTTPS':'Connected · HTTPS on the way')/* Railway is an owner-only detail */:d.https&&/VALID|ISSUED/i.test(d.https)?'Connected · HTTPS':'Connected'):'Waiting for DNS';
  head.append(name,badge);
  if(!d.verified){const b=document.createElement('button');b.type='button';b.className='ghost';b.textContent='Verify';b.onclick=()=>domainAction('/verify','POST',d.hostname);head.append(b)}
  const rm=document.createElement('button');rm.type='button';rm.className='ghost';rm.textContent='Remove';rm.onclick=()=>domainAction('/domains','DELETE',d.hostname);head.append(rm);
  li.append(head);
  if(d.railway_error){const p=document.createElement('p');p.className='error small';p.textContent='Automatic HTTPS setup failed'+(state.me?.viewer?.kind==='owner'?': '+d.railway_error:'. Try removing the domain and adding it again.');/* the raw hosting error is for the owner only */li.append(p)}
  if(!d.verified){
   const dns=document.createElement('div');dns.className='dns';
   const intro=document.createElement('span');intro.className='muted';intro.textContent='Add these records at your domain provider:';dns.append(intro);
   for(const r of d.dns){const line=document.createElement('code');line.textContent=r.type+'  '+r.name+'  →  '+r.value;dns.append(line)}
   li.append(dns);
  }
  list.append(li);
 }
}
$('slug').oninput=()=>text($('slug-preview'),location.origin+'/sites/'+(slugFrom($('slug').value)||'…')+'/');
$('slug').onblur=()=>{const v=slugFrom($('slug').value);if(v&&v!==$('slug').value)$('slug').value=v};
async function publishAction(path,body){
 text($('publish-error'),'');
 // The launch gate checks the app's money flows in Kairoq's browser first (up to a minute or two).
 if(path==='/publish'&&!body.force)text($('publish-error'),'Checking that bookings, orders and sign-ups work before it goes live…');
 try{const {project,error}=await api('/projects/'+state.project.id+path,{method:'POST',body});state.project=project;renderPublish();text($('publish-error'),error||'')}
 catch(err){
  // Saved checks failed on the version going live: the owner decides.
  if(err.status===409&&err.data&&err.data.checks_failed){text($('publish-error'),err.message);if(confirm(err.message+'\n\nPublish anyway?'))return publishAction(path,{...body,force:true});return}
  text($('publish-error'),err.message);
 }
}
$('publish').onclick=()=>publishAction('/publish',{slug:slugFrom($('slug').value)});
$('unpublish').onclick=()=>publishAction('/unpublish',{});
$('add-domain').onclick=async()=>{await domainAction('/domains','POST',$('domain').value);if(!$('publish-error').textContent)$('domain').value=''};
async function domainAction(path,method,hostname){
 text($('publish-error'),'');
 try{const r=await api('/projects/'+state.project.id+path,{method,body:{hostname}});state.project=r.project;renderPublish();if(r.error)text($('publish-error'),r.error)}
 catch(err){text($('publish-error'),err.message)}
}

// ---------- settings: code, GitHub, Stripe ----------
// The owner's AI cost report: real cost per call next to what that message sells for.
async function renderCosts(){
 const owner=state.me?.viewer?.kind==='owner';$('costs-section').classList.toggle('hidden',!owner);if(!owner)return;
 try{
  const {costs}=await api('/admin/costs'),body=$('costs-body');body.replaceChildren();
  const usd=n=>'$'+(n<1?n.toFixed(3):n.toFixed(2));
  for(const g of costs.groups){const tr=document.createElement('tr');const loss=g.credit_value!==null&&g.avg_cost>g.credit_value;for(const v of [g.tier,g.model,g.calls,usd(g.cost),usd(g.avg_cost),g.credit_value===null?'-':usd(g.credit_value),g.cached_share+'%']){const td=document.createElement('td');td.textContent=v;tr.append(td)}if(loss)tr.className='loss';body.append(tr)}
  text($('costs-note'),costs.groups.length?'Total '+usd(costs.total_cost)+' over '+costs.total_calls+' AI calls. "Sells for" uses $'+costs.credit_price_usd+' per credit (KAIROQ_CREDIT_PRICE_USD); rows in red cost more than they earn. Agent tasks make several calls each.':'No paid AI calls in the last 30 days.');
 }catch(err){text($('costs-note'),err.message)}
}
// Support (server owner only): look up a customer and grant credits back after reviewing a request.
function renderSupport(r){
 const out=$('support-result');out.replaceChildren();
 if(!r)return;
 const p=document.createElement('p');p.textContent=r.account.email+' · '+r.account.credits+' credits · joined '+String(r.account.created_at).slice(0,10);out.append(p);
 const ul=document.createElement('ul');ul.className='support-history';
 for(const h of r.history.slice(0,30)){const li=document.createElement('li');li.textContent=String(h.at).slice(0,16).replace('T',' ')+'  '+(h.delta>0?'+':'')+h.delta+'  '+h.reason;ul.append(li)}
 out.append(ul);
}
$('support-find').onclick=async()=>{text($('support-status'),'');try{renderSupport(await api('/admin/account?email='+encodeURIComponent($('support-email').value.trim())))}catch(err){renderSupport(null);text($('support-status'),err.message)}};
$('support-grant').onclick=async()=>{
 text($('support-status'),'');
 try{const r=await api('/admin/credits',{method:'POST',body:{email:$('support-email').value.trim(),amount:Number($('support-amount').value),reason:$('support-reason').value}});renderSupport(r);$('support-reason').value='';text($('support-status'),'Credits granted.')}
 catch(err){text($('support-status'),err.message)}
};
$('settings-open').onclick=async()=>{
 renderCosts();
 loadApiKeys();
 $('support-section').classList.toggle('hidden',state.me?.viewer?.kind!=='owner');
 text($('settings-error'),'');text($('gh-status'),'');text($('knowledge-status'),'');
 $('knowledge').value=state.project.knowledge||'';
 $('memory-box').open=false;text($('memory-text'),'');
 $('memory-box').ontoggle=async()=>{if(!$('memory-box').open||$('memory-text').textContent)return;try{const {memory}=await api('/projects/'+state.project.id+'/memory');text($('memory-text'),memory||'Nothing yet: it starts with your first request.')}catch(err){text($('memory-text'),err.message)}};
 renderSecrets().catch(err=>text($('settings-error'),err.message));
 renderApis().catch(err=>text($('api-status'),err.message));
 renderDatabase().catch(err=>text($('settings-error'),err.message));
 $('download').href='/api/create/projects/'+state.project.id+'/download';
 try{
  const [{settings},gh]=await Promise.all([api('/projects/'+state.project.id+'/settings'),api('/projects/'+state.project.id+'/github')]);
  const st=settings.secrets;
  text($('stripe-key-status'),st.stripe_secret_key?'(saved '+st.stripe_secret_key.hint+')':'');
  text($('stripe-hook-status'),st.stripe_webhook_secret?'(saved '+st.stripe_webhook_secret.hint+')':'');
  text($('gh-token-status'),gh.token?'(saved '+gh.token.hint+')':gh.owner_fallback?(state.me?.viewer?.kind==='owner'?'(using the server GITHUB_TOKEN)':'(connected)'):''/* env var name: owner only */);
  text($('stripe-hook-url'),settings.stripe_webhook_url);text($('stripe-events'),settings.stripe_events.join(', '));
  // Plain wording for everyone; the env var names are shown to the owner only.
   text($('email-status'),settings.email?'Email is on. Your app can send confirmations and notify you.':'Email is not set up yet.'+(state.me?.viewer?.kind==='owner'?' Add KAIROQ_RESEND_API_KEY and KAIROQ_EMAIL_FROM on the server.':''));
  const engines=settings.engines||['kairoq'];$('engine-row').classList.toggle('hidden',engines.length<2);$('engine-note').classList.toggle('hidden',engines.length<2);$('engine-select').value=settings.engine||'kairoq';
  $('app-managers').value=(settings.app_managers||[]).join(', ');text($('app-managers-status'),'');
  $('gh-repo').value=gh.github?.repo||'';
  if(gh.github?.last_push)text($('gh-status'),'Last push: version '+gh.github.last_push.version+' · '+when(gh.github.last_push.at));
  if(!settings.encryption)text($('settings-error'),state.me?.viewer?.kind==='owner'?'Saving keys needs APP_ENCRYPTION_KEY on the server.':'Saving keys is not available yet.');/* env var name: owner only */
 }catch(err){text($('settings-error'),err.message)}
 $('settings-dialog').showModal();
};
// The app's data in the owner's own Supabase (app-database.js on the server).
function showDatabase(d){
 const on=Boolean(d&&d.connected);
 text($('db-status'),on?'Connected to Supabase ('+d.host+') since '+when(d.connected_at)+'. Sign-ups and saved data are kept in your Supabase, schema '+d.schema+(d.copied?' ('+d.copied+' rows copied across).':'.'):'Your app\'s sign-ups and saved data are stored by Kairoq. Connect your own Supabase to keep them in your account instead.');
 $('db-form').classList.toggle('hidden',on);$('db-howto').classList.toggle('hidden',on);
 $('db-connect').classList.toggle('hidden',on);$('db-disconnect').classList.toggle('hidden',!on);
 $('db-open').classList.toggle('hidden',!on);if(on)$('db-open').href=d.dashboard;
}
async function renderDatabase(){const {database}=await api('/projects/'+state.project.id+'/database');showDatabase(database)}
$('db-connect').onclick=async()=>{
 text($('settings-error'),'');const b=$('db-connect');b.disabled=true;const was=b.textContent;b.textContent='Connecting…';
 try{const {database}=await api('/projects/'+state.project.id+'/database',{method:'POST',body:{url:$('db-url').value.trim(),ca:$('db-ca').value.trim()}});$('db-url').value='';$('db-ca').value='';showDatabase(database)}
 catch(err){text($('settings-error'),err.message)}
 finally{b.disabled=false;b.textContent=was}
};
$('db-disconnect').onclick=async()=>{
 if(!confirm('Disconnect Supabase? Your data stays in Supabase. The app goes back to Kairoq\'s own copy, as it was when you connected.'))return;
 try{const {database}=await api('/projects/'+state.project.id+'/database',{method:'DELETE'});showDatabase(database)}catch(err){text($('settings-error'),err.message)}
};
$('app-managers-save').onclick=async()=>{
 text($('settings-error'),'');
 try{const {settings}=await api('/projects/'+state.project.id+'/settings',{method:'POST',body:{app_managers:$('app-managers').value}});$('app-managers').value=(settings.app_managers||[]).join(', ');text($('app-managers-status'),'Saved')}
 catch(err){text($('settings-error'),err.message)}
};
async function saveSecrets(fields){
 const body={};for(const [id,name] of fields){const v=$(id).value.trim();if(v)body[name]=v}
 if(!Object.keys(body).length)return;
 await api('/projects/'+state.project.id+'/settings',{method:'POST',body});
 for(const [id] of fields)$(id).value='';
}
$('settings-save').onclick=async()=>{
 text($('settings-error'),'');
 try{await saveSecrets([['stripe-key','stripe_secret_key'],['stripe-hook','stripe_webhook_secret']]);$('settings-open').click()}catch(err){text($('settings-error'),err.message)}
};
$('engine-select').onchange=async e=>{
 text($('settings-error'),'');
 try{await api('/projects/'+state.project.id+'/settings',{method:'POST',body:{engine:e.target.value}})}catch(err){text($('settings-error'),err.message);e.target.value='kairoq'}
};
$('gh-push').onclick=async()=>{
 text($('settings-error'),'');text($('gh-status'),'Pushing…');$('gh-push').disabled=true;
 try{
  await saveSecrets([['gh-token','github_token']]);
  const {result}=await api('/projects/'+state.project.id+'/push',{method:'POST',body:{repo:$('gh-repo').value}});
  $('gh-status').replaceChildren(document.createTextNode(result.unchanged?'Already up to date. ':'Pushed. '),Object.assign(document.createElement('a'),{href:result.url,target:'_blank',rel:'noopener',textContent:'Open on GitHub ↗'}));
 }catch(err){text($('gh-status'),'');text($('settings-error'),err.message)}
 finally{$('gh-push').disabled=false}
};
$('gh-pull').onclick=async()=>{
 text($('settings-error'),'');text($('gh-status'),'Pulling…');$('gh-pull').disabled=true;
 try{
  const {result,project}=await api('/projects/'+state.project.id+'/pull',{method:'POST'});
  if(result.unchanged)text($('gh-status'),'No changes on GitHub.');
  else{text($('gh-status'),'Pulled '+result.changed.length+' changed file'+(result.changed.length===1?'':'s')+' as version '+result.version+'.');state.project=project;renderMessages();renderVersions();setPreview(project.preview_url)}
 }catch(err){text($('gh-status'),'');text($('settings-error'),err.message)}
 finally{$('gh-pull').disabled=false}
};

// ---------- credits ----------
$('buy').onclick=()=>openBuy();
function openBuy(){
 const wrap=$('packs');wrap.replaceChildren();text($('buy-error'),'');
 for(const p of state.me.packs){
  const b=document.createElement('button');b.type='button';
  const name=document.createElement('span');name.textContent=p.name+' · '+p.credits+' credits';
  const price=document.createElement('span');price.className='muted';price.textContent=p.label||'';
  b.append(name,price);
  b.onclick=async()=>{b.disabled=true;try{const {url}=await api('/checkout',{method:'POST',body:{pack:p.id}});location.href=url}catch(err){text($('buy-error'),err.message);b.disabled=false}};
  wrap.append(b);
 }
 $('buy-dialog').showModal();
}

// ---------- start ----------
// ---------- landing, templates, plans ----------
function setPending(p){try{sessionStorage.setItem('kairoq-pending',JSON.stringify(p))}catch{}state.pending=p}
function takePending(){let p=state.pending;try{p=p||JSON.parse(sessionStorage.getItem('kairoq-pending')||'null');sessionStorage.removeItem('kairoq-pending')}catch{}state.pending=null;return p}
async function renderTemplates(wrap,onPick,onSponsored){
 if(!state.templates){const r=await api('/templates');state.templates=r.templates;state.sponsored=r.sponsored||[]}
 wrap.replaceChildren();
 // Sponsored slots come first, clearly labelled with who pays for them.
 for(const t of onSponsored?state.sponsored:[]){
  const b=document.createElement('button');b.type='button';b.className='sponsored';
  b.append(Object.assign(document.createElement('span'),{className:'cat',textContent:'Sponsored · '+t.sponsor}),Object.assign(document.createElement('strong'),{textContent:t.title}),Object.assign(document.createElement('span'),{className:'desc',textContent:t.description||''}));
  b.dataset.cat=t.category||'';b.onclick=()=>onSponsored(t.id);wrap.append(b);
 }
 for(const t of state.templates)wrap.append(templateCard(t,onPick));
}
// A template card: a picture of the real app (taken by the server) in a browser or phone frame,
// or, until that exists, a drawn page with the template's own name.
const TPL_TINT={hospitality:'sand',travel:'slate',ai:'ember',health:'moss',marketing:'iris',business:'slate',services:'sea',personal:'rose'};
function templateCard(t,onPick){
 const mk=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e};
 const b=mk('button','tpl');b.type='button';b.dataset.tint=TPL_TINT[String(t.category||'').toLowerCase()]||'sand';
 b.setAttribute('aria-label','Start from the '+t.name+' template');
 const shot=mk('div','tpl-shot'+(t.mobile?' phone':''));
 const frame=mk('div',t.mobile?'tpl-device':'tpl-window');
 if(!t.mobile){const bar=mk('div','tpl-bar');bar.append(mk('i'),mk('i'),mk('i'),mk('span',null,t.name.toLowerCase().replace(/[^a-z0-9]+/g,'')+'.kairoq.app'));frame.append(bar)}
 const view=mk('div','tpl-view');
 if(t.thumb){const img=mk('img');img.src=t.thumb;img.alt='';img.loading='lazy';img.decoding='async';img.onerror=()=>{img.remove();view.append(drawnPage(t,mk))};view.append(img)}
 else view.append(drawnPage(t,mk));
 frame.append(view);shot.append(frame);
 const body=mk('div','tpl-body');
 body.append(mk('span','cat',t.category),mk('strong',null,t.name),mk('span','desc',t.description),mk('span','tpl-use','Use template'));
 b.append(shot,body);b.onclick=()=>onPick(t.id);
 return b;
}
function drawnPage(t,mk){
 const d=mk('div','tpl-drawn');
 const nav=mk('div','d-nav');nav.append(mk('b',null,t.name),mk('span'),mk('span'),mk('em'));
 const hero=mk('div','d-hero');hero.append(mk('small',null,t.category),mk('h4',null,t.description.split(/[.:]/)[0]),mk('div','d-btns'));
 hero.lastChild.append(mk('i'),mk('i'));
 const cards=mk('div','d-cards');for(let i=0;i<3;i++){const c=mk('div');c.append(mk('i'),mk('span'),mk('span'));cards.append(c)}
 d.append(nav,hero,cards);return d;
}
async function startFromSponsored(id){
 text($('home-error'),'');
 try{const {project,job}=await api('/projects',{method:'POST',body:{sponsored:id}});await openProject(project.id,{job})}catch(err){text($('home-error'),err.message)}
}
async function startFromTemplate(id){
 text($('home-error'),'');
 try{const {project}=await api('/projects',{method:'POST',body:{template:id}});await openProject(project.id)}catch(err){text($('home-error'),err.message)}
}
function planCard(title,price,lines,action){
 const card=document.createElement('div');card.className='plan';
 card.append(Object.assign(document.createElement('h3'),{textContent:title}),Object.assign(document.createElement('span'),{className:'price',textContent:price}));
 const ul=document.createElement('ul');for(const l of lines)ul.append(Object.assign(document.createElement('li'),{textContent:l}));card.append(ul);
 if(action)card.append(action);
 return card;
}
function renderLanding(){
 renderTemplates($('landing-templates'),id=>{setPending({template:id});openAuth('signup')},id=>{setPending({sponsored:id});openAuth('signup')}).then(trimShowcase).catch(()=>{});
 const wrap=$('landing-plans');wrap.replaceChildren();
 const per=(state.me.tiers||[]).map(t=>t.label+' '+t.credits+' credit'+(t.credits===1?'':'s')).join(', ');
 wrap.append(planCard('Free',(state.me.free_credits||0)+' credits',['Every feature included','Publish to a Kairoq URL','No card needed']));
 for(const p of state.me.plans||[])wrap.append(planCard(p.name,p.label||p.credits+' credits / month',[p.credits+' credits every month',...p.features]));
 for(const p of state.me.packs||[])wrap.append(planCard(p.name,p.label||p.credits+' credits',[p.credits+' credits, one-time','Never expire']));
 text($('pricing-note'),'Credits per message: '+per+(state.me.discuss_credits?'; Discuss '+state.me.discuss_credits:'')+'. Visual edits are free. If a change breaks your app, the next fix of that problem is on us. A request that fails before anything is saved is not charged.');
}
$('landing-form').onsubmit=e=>{e.preventDefault();setPending({prompt:$('landing-prompt').value.trim()});openAuth('signup')};
for(const b of document.querySelectorAll('.hero-chip'))b.onclick=()=>{$('landing-prompt').value=b.textContent.trim();$('landing-prompt').focus()};
// On a phone the gallery shows three templates (like the Figma phone frame) and "Explore all
// templates" opens the rest; CSS hides cards marked data-more under 600px only.
function trimShowcase(){
 const wrap=$('landing-templates');if(!wrap)return;let n=0;
 for(const c of wrap.children){if(c.hidden){delete c.dataset.more;continue}if(++n>3)c.dataset.more='';else delete c.dataset.more}
 let more=$('show-more');
 if(!more){more=document.createElement('button');more.type='button';more.id='show-more';more.className='show-more';more.onclick=()=>{const all=$('showcase').classList.toggle('show-all');more.textContent=all?'Show fewer':'Explore all templates'};wrap.after(more)}
 more.textContent=$('showcase').classList.contains('show-all')?'Show fewer':'Explore all templates';
 more.hidden=n<=3;
}
// Template gallery tabs: filter the cards by their category.
for(const t of document.querySelectorAll('.show-tabs .tab'))t.onclick=()=>{for(const x of document.querySelectorAll('.show-tabs .tab'))x.setAttribute('aria-pressed',String(x===t));const cat=t.dataset.cat||'';for(const card of $('landing-templates').children){const c=(card.dataset.cat||card.querySelector('.cat')?.textContent||'').toLowerCase();card.hidden=Boolean(cat)&&c!==cat}trimShowcase()};
$('nav-signin').onclick=()=>{if($('auth').classList.contains('hidden')){location.href='/create#signup';return}openAuth('login')};
$('nav-start').onclick=()=>{if($('auth').classList.contains('hidden')){location.href='/create';return}$('top').scrollIntoView({behavior:'smooth'});$('landing-prompt').focus()};
// Landing motion: a typing placeholder, reveal-on-scroll and a cursor glow on the tiles. Nothing here is needed to use the page.
(function(){
 const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const ta=$('landing-prompt'),ideas=['A booking site for my yoga studio with class times, prices and online payments','A marketplace where parents find and pay private tutors','A guest portal for my hotel with Wi-Fi, check-out and local tips','A CRM for my agency with leads, deals and weekly follow-ups'];
 let i=0,pos=0,del=false,timer;
 function tick(){
  if(document.activeElement===ta||ta.value||$('auth').classList.contains('hidden')){timer=setTimeout(tick,900);return}
  const s=ideas[i];pos+=del?-1:1;ta.placeholder=s.slice(0,pos);
  let wait=del?22:38;if(!del&&pos>=s.length){del=true;wait=2200}else if(del&&pos<=0){del=false;i=(i+1)%ideas.length;wait=350}
  timer=setTimeout(tick,wait);
 }
 if(!reduce)timer=setTimeout(tick,1200);
 const items=document.querySelectorAll('.landing .section-head,.landing .steps li,.landing .tile,.landing .proof div,.landing .cmp-table,.landing .credits-how');
 if(!reduce&&'IntersectionObserver' in window){
  const io=new IntersectionObserver(es=>{for(const e of es)if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}},{rootMargin:'0px 0px -6% 0px',threshold:0});
  for(const el of items){el.classList.add('rv');io.observe(el)}
 }
 for(const t of document.querySelectorAll('.landing .tile'))t.addEventListener('pointermove',e=>{const r=t.getBoundingClientRect();t.style.setProperty('--mx',(e.clientX-r.left)+'px');t.style.setProperty('--my',(e.clientY-r.top)+'px')});

})();

// ---------- roles, sharing, team ----------
function applyRole(){
 const role=state.project.role||'owner';
 document.body.classList.toggle('readonly',role==='viewer');
 for(const id of ['team-open','settings-open'])$(id).classList.toggle('hidden',role!=='owner');
}
$('team-open').onclick=()=>{renderTeam();$('team-dialog').showModal()};
function renderTeam(){
 text($('team-error'),'');
 const p=state.project,list=$('members');list.replaceChildren();
 for(const m of p.members||[]){
  const li=document.createElement('li'),row=document.createElement('div');row.className='row';row.style.marginTop='0';
  const who=Object.assign(document.createElement('span'),{textContent:m.email});who.style.flex='1';
  const role=Object.assign(document.createElement('span'),{className:'role-badge',textContent:m.role});
  const rm=Object.assign(document.createElement('button'),{type:'button',className:'ghost',textContent:'Remove'});
  rm.onclick=()=>teamCall('/members','DELETE',{email:m.email});
  row.append(who,role,rm);li.append(row);list.append(li);
 }
 $('share-on').checked=!!p.share;$('share-remix').checked=!!p.share?.remix;$('share-remix').disabled=!p.share;
 $('share-link-row').classList.toggle('hidden',!p.share);
 if(p.share)$('share-link').value=location.origin+p.share.url;
}
async function teamCall(path,method,body){
 text($('team-error'),'');
 try{const r=await api('/projects/'+state.project.id+path,{method,body});if(r.project)state.project=r.project;renderTeam()}catch(err){text($('team-error'),err.message)}
}
$('member-add').onclick=async()=>{await teamCall('/members','POST',{email:$('member-email').value,role:$('member-role').value});if(!$('team-error').textContent)$('member-email').value=''};
$('share-on').onchange=()=>teamCall('/share','POST',{enabled:$('share-on').checked,remix:$('share-remix').checked});
$('share-remix').onchange=()=>teamCall('/share','POST',{enabled:true,remix:$('share-remix').checked});
$('share-copy').onclick=()=>{navigator.clipboard?.writeText($('share-link').value).then(()=>text($('share-copy'),'Copied')).catch(()=>{$('share-link').select()})};
async function openShare(token,v){
 show('share-screen');
 try{
  const {share}=await api('/share/'+token);
  text($('share-name'),share.name);document.title=share.name+' · Kairoq Create';
  $('share-frame').src=share.preview_url;
  $('remix').classList.toggle('hidden',!share.remix);
  $('remix').onclick=()=>{if(!v){setPending({remix:token});location.href='/create#signup';return}remix(token)};
 }catch(err){text($('share-error'),err.message);$('remix').classList.add('hidden')}
}
async function remix(token){
 try{const {project}=await api('/remix',{method:'POST',body:{token}});await openProject(project.id)}
 catch(err){show('share-screen');text($('share-error'),err.message)}
}

// ---------- analytics & SEO (publish dialog) ----------
async function renderInsights(){
 const p=state.project;
 $('seo-title').value=p.seo?.title||'';$('seo-description').value=p.seo?.description||'';$('seo-image').value=p.seo?.image||'';text($('seo-status'),'');
 $('analytics').classList.toggle('hidden',!p.published);
 loadGrow().catch(()=>{});
 if(!p.published)return;
 const {analytics:a}=await api('/projects/'+p.id+'/analytics');
 text($('an-views'),a.totals.views.toLocaleString());text($('an-visitors'),a.totals.visitors.toLocaleString());
 const bars=$('an-bars'),max=Math.max(1,...a.series.map(d=>d.views));bars.replaceChildren();
 bars.setAttribute('aria-label','Daily page views: '+a.series.filter(d=>d.views).map(d=>d.day+' '+d.views).join(', ')||'none yet');
 for(const d of a.series){const s=document.createElement('span');s.style.height=Math.max(d.views?6:1,Math.round(d.views/max*100))+'%';if(!d.views)s.style.opacity='.25';s.tabIndex=-1;
  const tip=new Date(d.day+'T00:00:00Z').toLocaleDateString([], {month:'short',day:'numeric',timeZone:'UTC'})+': '+d.views+' view'+(d.views===1?'':'s')+', '+d.visitors+' visitor'+(d.visitors===1?'':'s');
  s.onmouseenter=()=>{$('an-tip').classList.remove('hidden');text($('an-tip'),tip)};bars.append(s)}
 bars.onmouseleave=()=>$('an-tip').classList.add('hidden');
 const refs=$('an-referrers');refs.replaceChildren();
 for(const r of a.referrers)refs.append(Object.assign(document.createElement('li'),{textContent:r.referrer+' · '+r.views}));
}
// ---------- grow: found on Google and in AI answers ----------
const GROW_TYPES={LocalBusiness:'Local business',Restaurant:'Restaurant',CafeOrCoffeeShop:'Café',Bakery:'Bakery',Hotel:'Hotel',BedAndBreakfast:'Bed and breakfast',LodgingBusiness:'Guesthouse or rental',TouristTrip:'Tours',TravelAgency:'Travel agency',HealthAndBeautySalon:'Beauty salon',HairSalon:'Hair salon',DaySpa:'Spa',SportsActivityLocation:'Sports or yoga studio',ExerciseGym:'Gym',MedicalBusiness:'Clinic',Physiotherapy:'Physiotherapy',Dentist:'Dentist',Store:'Shop',ProfessionalService:'Professional service',RealEstateAgent:'Real estate',EducationalOrganization:'School or courses',Event:'Event',SoftwareApplication:'Software product',Organization:'Organization'};
function faqText(list){return(list||[]).map(f=>'Q: '+f.q+'\nA: '+f.a).join('\n\n')}
function parseFaq(text){const out=[];let cur=null;for(const line of String(text||'').split('\n')){const q=/^\s*Q:\s*(.*)$/i.exec(line),a=/^\s*A:\s*(.*)$/i.exec(line);if(q){cur={q:q[1].trim(),a:''};out.push(cur)}else if(a&&cur)cur.a=a[1].trim();else if(cur&&cur.a&&line.trim())cur.a+=' '+line.trim()}return out.filter(f=>f.q&&f.a)}
function fillGrowForm(b,faq){
 b=b||{};
 const sel=$('gb-type');if(!sel.options.length)for(const [v,l] of Object.entries(GROW_TYPES))sel.append(new Option(l,v));
 $('gb-name').value=b.name||'';sel.value=b.type||'LocalBusiness';$('gb-description').value=b.description||'';$('gb-street').value=b.street||'';$('gb-city').value=b.city||'';$('gb-postal').value=b.postal||'';$('gb-country').value=b.country||'';$('gb-phone').value=b.phone||'';$('gb-email').value=b.email||'';$('gb-hours').value=(b.hours||[]).join('\n');$('gb-price').value=b.price_range||'';$('gb-faq').value=faqText(faq);
}
function renderReferrals(r){
 if(!r){text($('ref-stats'),'Every customer who signs up gets a personal invite link; friends who join through it are counted here.');return}
 text($('ref-stats'),r.joined?r.joined+' of '+r.users+' accounts joined through an invite.'+(r.top.length?' Top inviters: '+r.top.map(t=>(t.name||t.email)+' ('+t.invited+')').join(', ')+'.':''):'No one has joined through an invite yet'+(r.users?' ('+r.users+' accounts so far)':'')+'.');
}
$('ref-add').onclick=()=>{
 const reward=$('ref-reward').value.trim();
 $('publish-dialog').close();
 send('Add an "Invite a friend" section for signed-in users, using referrals from the kairoq module: show their personal invite link with Copy and Share buttons, how many friends joined through it'+(reward?', and this reward: '+reward:'')+'. Put it where signed-in users will see it (their account or dashboard page), and add a short line about it near the sign-up form.','build');
};
function renderGrow(g){
 renderReferrals(g.referrals);
 const ul=$('grow-items');ul.replaceChildren();
 for(const i of g.items){const li=el('li',i.ok?'ok':'todo');li.append(el('span','vmark',i.ok?'✓':'○'),el('span',null,i.label));ul.append(li)}
 text($('grow-pages'),g.pages.length?'Pages search engines can read: '+g.pages.map(p=>p.title||p.path).slice(0,8).join(' · ')+(g.pages.length>8?' and '+(g.pages.length-8)+' more':'')+(g.urls?' · Summary for AI: '+g.urls.path+'llms.txt':''):'Kairoq reads your live pages a minute after you publish.');
}
// The live guard: when Kairoq last checked the live app, what it found and did, and the switch.
const GUARD_EVENTS={broken:'Found a problem',recovered:'Working again',rolled_back:'Put back the version that worked',repaired:'Fixed it and published the fix',escalated:'Asked you to look'};
function renderGuard(g){
 $('guard-section').classList.remove('hidden');
 const when=t=>t?new Date(t).toLocaleString():'';
 text($('guard-status'),!g.checked_at?'Kairoq\'s browser checks your live app every '+(g.hours===1?'hour':g.hours+' hours')+': the page and every saved check. The first check runs soon after you publish.'
  :g.incident?'Not working since '+when(g.incident.since)+':\n'+g.incident.problem+(g.incident.told?'\nWe emailed you; Kairoq keeps checking.':'')
  :'Working. Last checked '+when(g.checked_at)+' (version '+g.version+'). Checked every '+(g.hours===1?'hour':g.hours+' hours')+'.');
 const cb=$('guard-autofix');cb.checked=g.autofix;cb.disabled=state.project.role!=='owner';
 const cov=g.coverage;
 text($('guard-coverage'),cov?(cov.protected.length?'Protected flows: '+cov.protected.join(', ')+'.':'No flows are protected yet.')+(cov.flows.filter(f=>!f.covered).length?' Not yet checked: '+cov.flows.filter(f=>!f.covered).map(f=>f.name+' ('+f.why+')').join('; ')+'.':''):'');
 const ul=$('guard-history');ul.replaceChildren();
 for(const e of g.history.filter(e=>e.kind!=='broken'||!g.incident).slice(0,5))ul.append(el('li',null,when(e.at)+' · '+(GUARD_EVENTS[e.kind]||e.kind)+(e.version?' (version '+e.version+')':'')));
}
$('guard-autofix').onchange=async()=>{try{const {guard}=await api('/projects/'+state.project.id+'/guard',{method:'POST',body:{autofix:$('guard-autofix').checked}});renderGuard(guard)}catch(err){text($('guard-status'),err.message)}};
async function loadGrow(){
 const p=state.project;$('grow').classList.toggle('hidden',!p.published);if(!p.published){$('guard-section').classList.add('hidden');return}
 $('kit-poster').href='/api/create/projects/'+p.id+'/poster';
 const {grow}=await api('/projects/'+p.id+'/grow');renderGrow(grow);fillGrowForm(grow.business,grow.faq);renderKit(grow.kit);text($('grow-status'),'');text($('kit-status'),'');api('/projects/'+p.id+'/guard').then(r=>renderGuard(r.guard)).catch(()=>{});text($('clips-status'),'');loadVideos('launch').catch(err=>text($('clips-status'),err.message));text($('sitereel-status'),'');loadFilms().catch(err=>text($('sitereel-status'),err.message));
}
// The launch kit: each text with a Copy button.
function renderKit(kit){
 const box=$('kit');box.replaceChildren();if(!kit)return;
 const items=[['Instagram',kit.instagram],['Google Business',kit.google_business],['WhatsApp',kit.whatsapp],['Facebook',kit.facebook],['LinkedIn',kit.linkedin],['Email to your customers',kit.email&&kit.email.body?'Subject: '+kit.email.subject+'\n\n'+kit.email.body:'']];
 for(const [name,body] of items){
  if(!body)continue;
  const card=el('div','kit-card'),head=el('div','kit-head');head.append(el('strong',null,name));
  const copy=el('button','link-btn','Copy');copy.type='button';copy.onclick=async()=>{try{await navigator.clipboard.writeText(body);copy.textContent='Copied'}catch{copy.textContent='Select and copy'}setTimeout(()=>copy.textContent='Copy',1600)};
  head.append(copy);card.append(head,el('pre','kit-text',body));box.append(card);
 }
}
$('kit-write').onclick=async()=>{
 const b=$('kit-write');b.disabled=true;text($('kit-status'),'Writing from your live pages…');
 try{const {kit,credits}=await api('/projects/'+state.project.id+'/grow',{method:'POST',body:{op:'kit'}});renderKit(kit);text($('kit-status'),'Ready'+(credits?' ('+credits+' credit'+(credits===1?'':'s')+')':'')+'. Check each text before posting.')}
 catch(err){text($('kit-status'),err.message)}finally{b.disabled=false}
};
// Videos made from the project's photos: launch clips (Grow) and a hero video (Design).
// One panel per kind: photo picker, price on the button, and the clips with their state.
const VIDEO_UI={launch:{section:'clips-section',photos:'clips-photos',note:'clips-note',go:'clips-go',status:'clips-status',list:'clips-list',max:4},
 hero:{section:'herovideo-section',photos:'herovideo-photos',note:'herovideo-note',go:'herovideo-go',status:'herovideo-status',list:'herovideo-list',max:1}};
const videoPicks={launch:new Set(),hero:new Set()};let videoTimer=null;
function videoPrice(kind){
 const u=VIDEO_UI[kind],n=videoPicks[kind].size,c=state.me.video_generation?.credits||0,paid=state.me.viewer?.kind==='customer'&&c>0;
 $(u.go).textContent=(kind==='hero'?'Make the video':'Make '+(n>1?n+' clips':'a clip'))+(paid&&n?' · '+c*n+' credits':'');
 $(u.go).disabled=!n||state.project.role==='viewer';
}
async function loadVideos(kind){
 const u=VIDEO_UI[kind];
 $(u.section).classList.toggle('hidden',!state.me.video_generation?.enabled);
 if(!state.me.video_generation?.enabled)return;
 const id=state.project.id,d=await api('/projects/'+id+'/videos');
 const box=$(u.photos);box.replaceChildren();
 for(const n of [...videoPicks[kind]])if(!d.photos.some(p=>p.name===n))videoPicks[kind].delete(n);
 if(!d.photos.length)box.append(el('p','muted small','Add photos to the project first (the image button in the chat). Your own photos look best.'));
 for(const p of d.photos){
  const b=el('button','photo-pick');b.type='button';b.title=p.name;b.setAttribute('aria-pressed',String(videoPicks[kind].has(p.name)));
  const img=el('img');img.alt=p.name;img.loading='lazy';img.src='/api/create/projects/'+id+'/asset?name='+encodeURIComponent(p.name);b.append(img);
  b.onclick=()=>{const s=videoPicks[kind];if(s.has(p.name))s.delete(p.name);else{if(s.size>=u.max){if(u.max===1)s.clear();else return}s.add(p.name)}loadVideosLocal(kind,d)};
  box.append(b);
 }
 loadVideosLocal(kind,d);
}
// Re-renders the picks and the clip list from data already loaded.
function loadVideosLocal(kind,d){
 const u=VIDEO_UI[kind],id=state.project.id;
 for(const b of $(u.photos).querySelectorAll('.photo-pick'))b.setAttribute('aria-pressed',String(videoPicks[kind].has(b.title)));
 videoPrice(kind);
 const list=$(u.list);list.replaceChildren();
 for(const v of d.videos.filter(x=>x.kind===kind)){
  const card=el('div','video-card'+(kind==='hero'?' hero':''));
  if(v.status==='done'){
   const vid=el('video');vid.controls=true;vid.muted=true;vid.loop=true;vid.playsInline=true;vid.preload='metadata';vid.src='/api/create/projects/'+id+'/video?name='+encodeURIComponent(v.name);card.append(vid);
   const row=el('div','row'),dl=el('a','ghost button-link','Download');dl.href=vid.src+'&download=1';row.append(dl);
   if(kind==='hero'&&v.site_message&&state.project.role!=='viewer'){const put=el('button','ghost','Put it on my site');put.type='button';put.onclick=()=>{for(const dlg of ['design-dialog','publish-dialog'])if($(dlg).open)$(dlg).close();send(v.site_message,'build')};row.append(put)}
   card.append(row);
  }else card.append(el('span','muted',v.status==='running'?'Making the video… (usually 1 to 3 minutes)':'Not made: '+(v.error||'failed')+(v.credits?' Credits refunded.':'')));
  if(v.status!=='running'&&state.project.role!=='viewer'){const del=el('button','link-btn','Remove');del.type='button';del.onclick=async()=>{try{const r=await api('/projects/'+id+'/videos',{method:'DELETE',body:{id:v.id}});loadVideosLocal(kind,{...d,videos:r.videos})}catch(err){text($(u.status),err.message)}};card.append(del)}
  list.append(card);
 }
 // While clips are being made, check again every 10 seconds.
 clearTimeout(videoTimer);
 if(d.videos.some(x=>x.status==='running'))videoTimer=setTimeout(()=>{if(!$(u.section).closest('dialog')?.open)return;loadVideos(kind).catch(()=>{})},10000);
}
for(const kind of ['launch','hero']){
 const u=VIDEO_UI[kind];
 $(u.go).onclick=async()=>{
  const b=$(u.go);b.disabled=true;text($(u.status),'Starting…');
  try{const r=await api('/projects/'+state.project.id+'/videos',{method:'POST',body:{kind,photos:[...videoPicks[kind]],note:$(u.note).value}});
   text($(u.status),(r.started.length>1?r.started.length+' clips are':'The video is')+' being made'+(r.credits?' ('+r.credits+' credits)':'')+'. You can close this window; they keep going.');
   videoPicks[kind].clear();$(u.note).value='';refreshCredits();await loadVideos(kind)}
  catch(err){text($(u.status),err.message);if(err.status===402&&state.me.purchases)openBuy()}
  finally{videoPrice(kind)}
 };
}
// Product films (Design, "Make it move") and the site reel (Grow): one button each; Kairoq picks
// the motion, checks its stills, films, adds the scene to the site and makes the reel.
let explodePick=null,explodeTimer=null;
function filmPrice(n){return state.me.viewer?.kind==='customer'&&n?' · '+n+' credits':''}
async function loadFilms(){
 const g=state.me.explode_generation;
 for(const sec of ['explode-section','sitereel-section'])$(sec).classList.toggle('hidden',!g?.enabled);
 if(!g?.enabled)return;
 const id=state.project.id,d=await api('/projects/'+id+'/explodes');
 const box=$('explode-photos');box.replaceChildren();
 if(explodePick&&!d.photos.some(p=>p.name===explodePick))explodePick=null;
 if(!d.photos.length)box.append(el('p','muted small','Add a photo of the product first (the image button in the chat). One product, well lit, nothing in front of it.'));
 for(const p of d.photos){
  const b=el('button','photo-pick');b.type='button';b.title=p.name;
  const img=el('img');img.alt=p.name;img.loading='lazy';img.src='/api/create/projects/'+id+'/asset?name='+encodeURIComponent(p.name);b.append(img);
  b.onclick=()=>{explodePick=explodePick===p.name?null:p.name;renderFilms(d)};
  box.append(b);
 }
 renderFilms(d);
}
function filmCard(d,e){
 const id=state.project.id,editor=state.project.role!=='viewer',card=el('div','explode-card');
 const file=(name,dl)=>'/api/create/projects/'+id+'/explodefile?id='+e.id+'&name='+encodeURIComponent(name)+(dl?'&download=1':'');
 if(e.note)card.append(el('strong','',e.note));
 if(e.status==='making')card.append(el('span','muted',(e.step||'Starting')+'… (usually 3 to 6 minutes; you can close this window)'));
 if(e.status==='failed')card.append(el('p','error',e.error||'It was not made.'));
 if(e.status==='done'){
  if(e.film){const vid=el('video');vid.controls=true;vid.muted=true;vid.loop=true;vid.playsInline=true;vid.preload='metadata';vid.src=file(e.film);card.append(vid)}
  else if(e.reel){const vid=el('video','reel');vid.controls=true;vid.muted=true;vid.loop=true;vid.playsInline=true;vid.preload='metadata';vid.src=file(e.reel);card.append(vid)}
  if(e.film)card.append(el('span','muted small',e.on_site?'Added to your site as a scene.':'Not on the site yet.'));
 }
 const row=el('div','row');
 if(e.status==='done'&&e.reel){const r=el('a','ghost button-link','Download reel (9:16)');r.href=file(e.reel,true);row.append(r)}
 if(e.status==='done'&&e.film&&!e.on_site&&editor){const put=el('button','ghost','Put it on my site');put.type='button';put.onclick=()=>{for(const dlg of ['design-dialog','publish-dialog'])if($(dlg).open)$(dlg).close();send(e.site_message,'build')};row.append(put)}
 if(e.status!=='making'&&e.kind!=='site'&&editor&&e.photo){const again=el('button','ghost','Try again'+filmPrice(d.credits.film));again.type='button';again.onclick=()=>startFilm({photo:e.photo,note:e.note});row.append(again)}
 if(e.status!=='making'&&editor){const del=el('button','link-btn','Remove');del.type='button';del.onclick=async()=>{try{const r=await api('/projects/'+id+'/explodes',{method:'DELETE',body:{id:e.id}});renderFilms({...d,explodes:r.explodes})}catch(err){text($('explode-status'),err.message)}};row.append(del)}
 if(row.childNodes.length)card.append(row);
 return card;
}
function renderFilms(d){
 const editor=state.project.role!=='viewer',busy=d.explodes.some(e=>e.status==='making');
 for(const b of $('explode-photos').querySelectorAll('.photo-pick'))b.setAttribute('aria-pressed',String(explodePick===b.title));
 $('explode-go').textContent='Make it move'+filmPrice(d.credits.film);
 $('explode-go').disabled=!explodePick||!editor||busy;
 $('sitereel-go').textContent='Make a reel of my site'+filmPrice(d.credits.site_reel);
 $('sitereel-go').disabled=!editor||busy||!state.project.current_version;
 const films=$('explode-list'),reels=$('sitereel-list');films.replaceChildren();reels.replaceChildren();
 for(const e of d.explodes)(e.kind==='site'?reels:films).append(filmCard(d,e));
 clearTimeout(explodeTimer);
 if(busy)explodeTimer=setTimeout(()=>{if(!$('explode-section').closest('dialog')?.open&&!$('sitereel-section').closest('dialog')?.open)return;loadFilms().catch(()=>{})},8000);
}
async function startFilm(body,status='explode-status'){
 text($(status),'Starting…');
 try{const r=await api('/projects/'+state.project.id+'/explodes',{method:'POST',body});text($(status),'');refreshCredits();await loadFilms()}
 catch(err){text($(status),err.message);if(err.status===402&&state.me.purchases)openBuy()}
}
$('explode-go').onclick=async()=>{$('explode-go').disabled=true;await startFilm({photo:explodePick,note:$('explode-note').value});$('explode-note').value=''};
$('sitereel-go').onclick=async()=>{$('sitereel-go').disabled=true;await startFilm({op:'site'},'sitereel-status')};
$('grow-suggest').onclick=async()=>{
 const b=$('grow-suggest');b.disabled=true;text($('grow-status'),'Reading your pages…');$('grow-details').open=true;
 try{const {suggestion:s,credits}=await api('/projects/'+state.project.id+'/grow',{method:'POST',body:{op:'suggest'}});fillGrowForm(s.business,s.faq);if(s.seo&&s.seo.title&&!$('seo-title').value)$('seo-title').value=s.seo.title;if(s.seo&&s.seo.description&&!$('seo-description').value)$('seo-description').value=s.seo.description;text($('grow-status'),'Filled in from what your pages say'+(credits?' ('+credits+' credit'+(credits===1?'':'s')+')':'')+'. Check it, add anything missing, then Save.')}
 catch(err){text($('grow-status'),err.message)}finally{b.disabled=false}
};
$('grow-refresh').onclick=async()=>{
 const b=$('grow-refresh');b.disabled=true;text($('grow-status'),'Reading the live pages…');
 try{const {grow}=await api('/projects/'+state.project.id+'/grow',{method:'POST',body:{op:'refresh'}});renderGrow(grow);text($('grow-status'),'Read '+grow.pages.length+' page'+(grow.pages.length===1?'':'s')+'.')}
 catch(err){text($('grow-status'),err.message)}finally{b.disabled=false}
};
$('grow-save').onclick=async()=>{
 const business={name:$('gb-name').value,type:$('gb-type').value,description:$('gb-description').value,street:$('gb-street').value,city:$('gb-city').value,postal:$('gb-postal').value,country:$('gb-country').value,phone:$('gb-phone').value,email:$('gb-email').value,hours:$('gb-hours').value.split('\n'),price_range:$('gb-price').value};
 try{const {grow}=await api('/projects/'+state.project.id+'/grow',{method:'POST',body:{business,faq:parseFaq($('gb-faq').value),seo:{title:$('seo-title').value,description:$('seo-description').value}}});renderGrow(grow);fillGrowForm(grow.business,grow.faq);text($('grow-status'),'Saved. Google and AI assistants see it on the live site right away.')}
 catch(err){text($('grow-status'),err.message)}
};
$('seo-save').onclick=async()=>{
 try{const {project}=await api('/projects/'+state.project.id+'/seo',{method:'POST',body:{title:$('seo-title').value,description:$('seo-description').value,image:$('seo-image').value}});state.project=project;text($('seo-status'),'Saved. Applies to the live site right away.')}
 catch(err){text($('seo-status'),err.message)}
};

// ---------- password reset, verification, Google ----------
// ui/screens: the dialog title says what this step is ("Sign in" again when a tab is picked).
$('forgot-open').onclick=()=>{$('forgot-form').classList.toggle('hidden');text($('auth-title'),'Reset your password');$('forgot-email').value=$('email').value;$('forgot-email').focus()};
$('forgot-form').onsubmit=async e=>{e.preventDefault();try{await api('/password/forgot',{method:'POST',body:{email:$('forgot-email').value}});text($('forgot-status'),state.me.email_ready?'If that email has an account, a reset link is on its way.':'Email is not set up on this server yet, so reset links cannot be sent.')}catch(err){text($('forgot-status'),err.message)}};
$('reset-form').onsubmit=async e=>{e.preventDefault();text($('reset-error'),'');try{await api('/password/reset',{method:'POST',body:{token:state.resetToken,password:$('reset-password').value}});state.resetToken=null;history.replaceState(null,'','/create');await start()}catch(err){text($('reset-error'),err.message)}};
$('verify-resend').onclick=async()=>{try{await api('/verify/resend',{method:'POST'});text($('verify-resend'),'Sent. Check your inbox.')}catch(err){text($('verify-resend'),err.message)}};
async function handleLinks(){
 const q=new URLSearchParams(location.search);
 if(q.get('verify')){try{await api('/verify',{method:'POST',body:{token:q.get('verify')}});state.flash='Your email is confirmed.'}catch(err){state.flash=err.message}history.replaceState(null,'','/create')}
 if(q.get('reset')){state.resetToken=q.get('reset');history.replaceState(null,'','/create')}
 if(q.get('auth_error')){state.flash=q.get('auth_error');history.replaceState(null,'','/create')}
}

// ---------- security check ----------
$('security-open').onclick=async()=>{
 const list=$('findings');list.replaceChildren();text($('security-summary'),'Checking…');$('security-fix').classList.add('hidden');
 $('security-dialog').showModal();
 try{
  const {findings,version}=await api('/projects/'+state.project.id+'/security');
  const counts=['high','medium','low'].map(s=>findings.filter(f=>f.severity===s).length);
  text($('security-summary'),findings.length?'Version '+version+': '+counts[0]+' high, '+counts[1]+' medium, '+counts[2]+' low.':'Version '+version+': no problems found.');
  for(const f of findings){
   const li=document.createElement('li');
   li.append(Object.assign(document.createElement('span'),{className:'sev '+f.severity,textContent:f.severity}),Object.assign(document.createElement('strong'),{textContent:f.title}));
   li.append(Object.assign(document.createElement('p'),{textContent:f.detail}),Object.assign(document.createElement('p'),{textContent:'Fix: '+f.fix}));
   list.append(li);
  }
  const serious=findings.filter(f=>f.severity!=='low');
  const canEdit=(state.project.role||'owner')!=='viewer';
  $('security-fix').classList.toggle('hidden',!serious.length||!canEdit);
  $('security-fix').onclick=()=>{$('security-dialog').close();send('Fix these security problems:\n'+serious.map(f=>'- '+f.title+(f.file?' ('+f.file+')':'')+': '+f.detail+' Suggested fix: '+f.fix).join('\n'),'build','/chat',{fix:true})};
 }catch(err){text($('security-summary'),err.message)}
};

// ---------- knowledge and server secrets (settings) ----------
async function renderSecrets(){
 const {secrets}=await api('/projects/'+state.project.id+'/secrets');
 const list=$('secrets-list');list.replaceChildren();
 if(!secrets.length)list.append(Object.assign(document.createElement('li'),{className:'muted small',textContent:'No keys yet.'/* matches the "API keys for your app" heading */}));
 for(const sec of secrets){
  const li=document.createElement('li'),row=document.createElement('div');row.className='row';row.style.marginTop='0';
  const name=Object.assign(document.createElement('code'),{textContent:sec.name});name.style.flex='1';
  const rm=Object.assign(document.createElement('button'),{type:'button',className:'ghost',textContent:'Delete'});
  rm.onclick=async()=>{await api('/projects/'+state.project.id+'/secrets',{method:'POST',body:{name:sec.name,value:null}});renderSecrets();renderApis().catch(()=>{})};
  row.append(name,Object.assign(document.createElement('span'),{className:'muted small',textContent:sec.hint}),rm);li.append(row);list.append(li);
 }
}
$('secret-add').onclick=async()=>{
 text($('settings-error'),'');
 try{await api('/projects/'+state.project.id+'/secrets',{method:'POST',body:{name:$('secret-name').value,value:$('secret-value').value}});$('secret-name').value='';$('secret-value').value='';renderSecrets();renderApis().catch(()=>{})}
 catch(err){text($('settings-error'),err.message)}
};
$('knowledge-save').onclick=async()=>{
 try{const {project}=await api('/projects/'+state.project.id+'/knowledge',{method:'POST',body:{text:$('knowledge').value}});state.project=project;text($('knowledge-status'),'Saved. The AI will follow this from the next message.')}
 catch(err){text($('knowledge-status'),err.message)}
};

// ---------- outside APIs (settings) ----------
// Above the preview: which outside APIs answer with sample data because their key is missing.
function renderSamplePill(apis){
 const pill=$('sample-pill'),id=state.project&&state.project.id;if(!id)return;
 const show=list=>{const m=list.filter(a=>a.secret&&!a.key_added);pill.classList.toggle('hidden',!m.length);pill.textContent=m.length?'Sample data: '+m.map(a=>a.title).join(', '):'';pill.title=m.length?'Add '+m.map(a=>a.secret).join(', ')+' in Settings, Server secrets, for real answers. The live site always calls the real API.':''};
 if(apis)return show(apis);
 api('/projects/'+id+'/apis').then(d=>{if(state.project&&state.project.id===id)show(d.apis)}).catch(()=>pill.classList.add('hidden'));
}
async function renderApis(){
 const id=state.project.id,{apis,log,suggested=[]}=await api('/projects/'+id+'/apis'),owner=(state.project.role||'owner')==='owner',editor=(state.project.role||'owner')!=='viewer';
 renderSamplePill(apis);
 const list=$('apis-list');list.replaceChildren();
 for(const a of apis){
  const li=el('li'),row=el('div','row');row.style.marginTop='0';
  const name=el('div','api-name');name.append(el('strong','',a.title),el('span','muted small',' '+a.base_url+(a.drafted?' · read from its docs':'')));
  const key=el('span','api-key '+(!a.secret||a.key_added?'real':'sample'),!a.secret?'No key needed':a.key_added?'Key added: real answers':'Sample answers until you add its key');
  row.append(name,key);
  if(a.secret&&owner){const add=el('button',a.key_added?'ghost':'primary',a.key_added?'Replace key':'Add key');add.type='button';add.onclick=()=>openKey(a);row.append(add)}
  if(editor){const rm=el('button','link-btn','Remove');rm.type='button';rm.onclick=async()=>{try{await api('/projects/'+id+'/apis',{method:'DELETE',body:{slug:a.slug}});renderApis()}catch(err){text($('api-status'),err.message)}};row.append(rm)}
  li.append(row);
  if(a.endpoints&&a.endpoints.length)li.append(apiTryout(id,a,editor));
  list.append(li);
 }
 const sug=$('api-suggested');sug.replaceChildren();
 for(const g of suggested){
  const row=el('div','api-offer');row.append(el('span','','Your app calls '+g.host+' without a key.'));
  if(editor){const b=el('button','ghost','Use sample answers');b.type='button';b.onclick=()=>addApi({name:g.host,secret:g.secret});row.append(b)}
  sug.append(row);
 }
 showApiLog(log);
 for(const b of ['api-add','api-add-spec'])$(b).disabled=!editor;
}
function prettyJson(t){try{return JSON.stringify(JSON.parse(t),null,2)}catch{return String(t||'')}}
// Try an API like Beeceptor: its endpoints with inputs filled from the spec's examples, Send shows
// the answer (real, or a sample while the key is missing), Check all calls every read-only one.
function apiTryout(id,a,editor){
 const wrap=el('details','api-tryout'),sum=el('summary','',a.endpoints.length+' endpoint'+(a.endpoints.length>1?'s':'')+': try them');wrap.append(sum);
 const bar=el('div','row api-tryout-bar');
 const checkBtn=el('button','ghost','Check all');checkBtn.type='button';checkBtn.disabled=!editor;checkBtn.title='Calls every read-only endpoint once and shows which work';
 const filter=el('input','api-filter');filter.placeholder='Find an endpoint';filter.setAttribute('aria-label','Find an endpoint');
 bar.append(filter,checkBtn);wrap.append(bar);
 // A test address next to the live one (Try and Check all only; the app keeps calling the live one).
 if(editor){
  const test=el('details','api-test'),ts=el('summary','',a.test&&a.test.use?'Using the test address':'Test address');test.append(ts);
  const row=el('div','row'),base=el('input'),key=el('input'),use=el('label','api-sample-toggle'),useBox=el('input'),save=el('button','ghost','Save'),note=el('p','muted small');
  base.placeholder='https://test.api.example.com/v2';base.value=(a.test&&a.test.base_url)||'';key.placeholder='Test key name, e.g. AMADEUS_TEST_KEY';key.value=(a.test&&a.test.secret)||'';useBox.type='checkbox';useBox.checked=Boolean(a.test&&a.test.use);use.append(useBox,document.createTextNode(' Use it for Try and Check all'));save.type='button';
  save.onclick=async()=>{try{await api('/projects/'+id+'/apitest',{method:'POST',body:{slug:a.slug,base_url:base.value.trim()||null,secret:key.value.trim(),use:useBox.checked}});text(note,'Saved. Your app keeps calling the live address.');renderApis().catch(()=>{})}catch(err){text(note,err.message)}};
  row.append(base,key,use,save);test.append(row,note);
  if(a.test&&a.test.secret&&!a.test.key_added&&(state.project.role||'owner')==='owner'){const k=el('button','link-btn','Add the test key');k.type='button';k.onclick=()=>openKey({...a,secret:a.test.secret,key_added:false,title:a.title+' (test)'});test.append(k)}
  wrap.append(test);
 }
 const checkOut=el('div','api-check hidden');wrap.append(checkOut);
 const ul=el('ul','api-endpoints');wrap.append(ul);
 const rows=[];
 for(const e of a.endpoints){
  const li=el('li','api-endpoint'),head=el('button','api-endpoint-head');head.type='button';
  head.append(el('span','api-method m-'+e.method.toLowerCase(),e.method),el('code','api-path',e.path),el('span','muted small api-summary',e.summary));
  const panel=el('div','api-endpoint-panel hidden');
  head.onclick=()=>{panel.classList.toggle('hidden');if(!panel.dataset.ready){panel.dataset.ready='1';fillPanel(panel,e)}};
  const open=preset=>{wrap.open=true;panel.classList.remove('hidden');if(preset&&panel.dataset.ready){panel.replaceChildren();delete panel.dataset.ready}if(!panel.dataset.ready){panel.dataset.ready='1';fillPanel(panel,e,preset)}li.scrollIntoView({block:'nearest'})};
  li.append(head,panel);ul.append(li);rows.push({li,e,open});
  // A pasted cURL command opens the matching endpoint with its inputs filled in.
  (window.__apiOpen=window.__apiOpen||{})[a.slug+'|'+e.id]=open;
 }
 filter.oninput=()=>{const q=filter.value.trim().toLowerCase();for(const r of rows)r.li.classList.toggle('hidden',Boolean(q)&&!(r.e.method+' '+r.e.path+' '+r.e.summary).toLowerCase().includes(q))};
 function fillPanel(panel,e,preset){
  const inputs={};
  if(e.params.length){
   const grid=el('div','api-params');
   for(const p of e.params){
    const lab=el('label','api-param');lab.append(el('span','',p.name+(p.required?' *':'')+' ('+(p.in==='path'?'in the address':p.in==='header'?'header':'query')+')'));
    const start=preset&&preset.values&&preset.values[p.name]!==undefined?String(preset.values[p.name]):p.value;
    let inp;if(p.options){inp=el('select');for(const o of ['',...p.options]){const op=el('option','',o||'(none)');op.value=o;inp.append(op)}inp.value=start}else{inp=el('input');inp.value=start;inp.spellcheck=false}
    if(p.description)lab.title=p.description;
    lab.append(inp);grid.append(lab);inputs[p.name]=inp;
   }
   panel.append(grid);
  }else panel.append(el('p','muted small','No inputs needed.'));
  let bodyBox=null;
  if(!e.read_only){const lab=el('label','api-param api-body');lab.append(el('span','','Request body (JSON)'));bodyBox=el('textarea');bodyBox.rows=6;bodyBox.spellcheck=false;bodyBox.value=(preset&&preset.body)||e.body||'';lab.append(bodyBox);panel.append(lab)}
  const actions=el('div','row'),sendBtn=el('button','primary','Send');sendBtn.type='button';sendBtn.disabled=!editor;
  const sampleLab=el('label','api-sample-toggle'),sampleBox=el('input');sampleBox.type='checkbox';sampleLab.append(sampleBox,document.createTextNode(' Sample answer'));
  const keyName=a.test&&a.test.use?a.test.secret:a.secret,keyIn=a.test&&a.test.use?a.test.key_added:a.key_added;
  if(keyName&&!keyIn){sampleBox.checked=true;sampleBox.disabled=true;sampleLab.title='Add the '+keyName+' key for real answers'}
  actions.append(sendBtn,sampleLab);panel.append(actions);
  // Checks on the answer (api-rules.js), like Hoppscotch tests: saved per endpoint.
  let rules=(e.rules||[]).slice();
  const checks=el('div','api-rules'),ruleList=el('ul','api-rule-list');
  checks.append(el('p','api-rules-title','Checks on the answer'),ruleList);
  const label=r=>r.kind==='status'?'Status is '+String(r.value).toUpperCase():r.kind==='time'?'Answers within '+(r.value>=1000?r.value/1000+' s':r.value+' ms'):(r.kind==='header'?'Header '+r.name:r.path)+({exists:' exists',missing:' is not there',eq:' is '+r.value,neq:' is not '+r.value,contains:' contains '+r.value,gt:' is more than '+r.value,lt:' is less than '+r.value,type:' is a '+r.value,length:' has '+r.value+' items'})[r.op||'exists'];
  const save=async next=>{try{rules=(await api('/projects/'+id+'/apirules',{method:'POST',body:{slug:a.slug,op:e.id,rules:next}})).rules;e.rules=rules;drawRules()}catch(err){text(ruleNote,err.message)}};
  const ruleNote=el('p','muted small');
  function drawRules(){
   ruleList.replaceChildren();
   if(!rules.length)ruleList.append(el('li','muted small','None yet: a success status counts as passing.'));
   rules.forEach((r,i)=>{const li=el('li','api-rule');li.append(el('span','',label(r)));if(editor){const x=el('button','link-btn','Remove');x.type='button';x.onclick=()=>save(rules.filter((_,k)=>k!==i));li.append(x)}ruleList.append(li)});
  }
  drawRules();
  if(editor){
   const add=el('div','row api-rule-add'),kind=el('select'),path=el('input'),val=el('input'),addBtn=el('button','ghost','Add check'),sug=el('button','link-btn','Suggest checks');
   for(const [v,t] of [['status','Status is'],['time','Answers within (ms)'],['exists','Field exists'],['eq','Field is'],['contains','Field contains'],['gt','Field is more than'],['header','Header exists']]){const o=el('option','',t);o.value=v;kind.append(o)}
   path.placeholder='Field, e.g. data[0].price';val.placeholder='Value';path.spellcheck=val.spellcheck=false;addBtn.type=sug.type='button';
   const shape=()=>{const k=kind.value;path.classList.toggle('hidden',k==='status'||k==='time');path.placeholder=k==='header'?'Header name':'Field, e.g. data[0].price';val.classList.toggle('hidden',k==='exists'||k==='header');val.placeholder=k==='status'?'200 or 2xx':k==='time'?'2000':'Value'};kind.onchange=shape;shape();
   addBtn.onclick=()=>{const k=kind.value,r=k==='status'?{kind:'status',value:val.value||'2xx'}:k==='time'?{kind:'time',value:Number(val.value)||2000}:k==='header'?{kind:'header',name:path.value,op:'exists'}:{kind:'field',path:path.value,op:k,...(k==='exists'?{}:{value:val.value})};save([...rules,r]);path.value='';val.value=''};
   sug.onclick=()=>save([...rules,...(e.suggested||[]).filter(s=>!rules.some(r=>JSON.stringify(r)===JSON.stringify(s)))]);
   add.append(kind,path,val,addBtn,sug);checks.append(add,ruleNote);
  }
  panel.append(checks);
  const out=el('div','api-reply hidden');panel.append(out);
  const go=async confirm=>{
   sendBtn.disabled=true;sendBtn.textContent='Sending…';
   try{
    const r=await api('/projects/'+id+'/apitry',{method:'POST',body:{slug:a.slug,op:e.id,values:Object.fromEntries(Object.entries(inputs).map(([k,v])=>[k,v.value])),body:bodyBox?bodyBox.value:undefined,sample:sampleBox.checked,confirm}});
    showReply(out,r);renderApisLogOnly();
   }catch(err){
    if(err.data&&err.data.confirm&&!confirm){if(window.confirm(err.message))return go(true)}
    out.classList.remove('hidden');out.replaceChildren(el('p','api-reply-error',err.message));
   }finally{sendBtn.disabled=!editor;sendBtn.textContent='Send'}
  };
  sendBtn.onclick=()=>go(false);
 }
 function showReply(out,r){
  out.classList.remove('hidden');out.replaceChildren();
  const head=el('div','api-reply-head');
  head.append(el('span','api-status '+(r.status>=200&&r.status<300?'ok':'bad'),String(r.status)),el('span','api-key '+(r.sample?'sample':'real'),r.sample?'Sample':'Real'),el('span','muted small',r.ms+' ms · '+(r.size>=1024?Math.round(r.size/1024)+' KB':r.size+' bytes')));
  const copy=el('button','link-btn','Copy');copy.type='button';copy.onclick=()=>navigator.clipboard&&navigator.clipboard.writeText(r.body);head.append(copy);
  out.append(head,el('p','muted small api-reply-url',r.method+' '+r.url),el('p','small',r.why+(r.reason?' '+r.reason:'')));
  if(r.checks&&r.checks.length){const ul=el('ul','api-check-results');for(const c of r.checks){const li=el('li','api-check-item '+(c.pass?'ok':'fail'));li.append(el('span','api-check-mark',c.pass?'✓':'✕'),el('span','',c.label),el('span','muted small',' got '+c.actual));ul.append(li)}out.append(ul)}
  out.append(el('pre','api-reply-body',r.body||'(empty answer)'));
 }
 checkBtn.onclick=async()=>{
  checkBtn.disabled=true;checkBtn.textContent='Checking…';checkOut.classList.remove('hidden');checkOut.replaceChildren(el('p','muted small','Calling each read-only endpoint once…'));
  try{
   const r=await api('/projects/'+id+'/apicheck',{method:'POST',body:{slug:a.slug}});
   checkOut.replaceChildren(el('p','api-check-summary',r.summary));
   const list=el('ul','api-check-list');
   for(const x of r.results){
    const li=el('li','api-check-item '+x.result);
    li.append(el('span','api-check-mark',x.result==='ok'?'✓':x.result==='sample'?'○':x.result==='input'?'…':'✕'),el('span','api-method m-'+x.method.toLowerCase(),x.method),el('code','api-path',x.path),el('span','small api-check-why',x.reason));
    const row=rows.find(r=>r.e.id===x.id);if(row){li.tabIndex=0;li.title='Open this endpoint';li.onclick=()=>{row.open();row.li.scrollIntoView({block:'nearest'})}}
    list.append(li);
   }
   checkOut.append(list);renderApisLogOnly();
  }catch(err){checkOut.replaceChildren(el('p','api-reply-error',err.message))}
  finally{checkBtn.disabled=!editor;checkBtn.textContent='Check all'}
 };
 return wrap;
}
// The call log, with each answer one click away.
function showApiLog(log){
 const box=$('api-log');box.replaceChildren();
 if(!log.length){box.append(el('p','muted small','No calls yet. Calls your server functions make to other services, and the ones you try here, show here.'));return}
 const t=el('table','api-log-table'),head=el('tr');for(const h of ['When','Call','Answer','Status','Time'])head.append(el('th','',h));t.append(head);
 for(const c of log.slice(0,50)){
  const tr=el('tr');tr.append(el('td','',new Date(c.at).toLocaleTimeString()),el('td','',c.method+' '+c.url),el('td','',(c.sample?'Sample':'Real')+(c.mode==='try'?' (tried here)':'')),el('td','',c.status?String(c.status):(c.error||'failed')),el('td','',c.ms+' ms'));t.append(tr);
  if(c.reply){tr.classList.add('api-log-row');tr.title='Show the answer';const r2=el('tr','api-log-reply hidden'),td=el('td');td.colSpan=5;td.append(el('pre','api-reply-body',prettyJson(c.reply)));r2.append(td);tr.onclick=()=>r2.classList.toggle('hidden');t.append(r2)}
 }
 box.append(t);
}
// After a try, refresh only the call log (keeps the open endpoint panels as they are).
function renderApisLogOnly(){const id=state.project&&state.project.id;if(id)api('/projects/'+id+'/apis').then(({log})=>showApiLog(log)).catch(()=>{})}
async function addApi(body){
 text($('api-status'),body.name?'Looking up '+body.name+'… (up to a minute)':'Reading the spec…');
 for(const b of ['api-add','api-add-spec'])$(b).disabled=true;
 try{const r=await api('/projects/'+state.project.id+'/apis',{method:'POST',body});
  text($('api-status'),'Added '+r.api.title+(r.api.drafted?', read from its docs':'')+' ('+r.api.operations+' endpoints). Ask the chat to use it.');
  for(const f of ['api-name','api-spec-url','api-spec','api-secret','api-base'])$(f).value='';
  await renderApis();
  if(r.api.secret&&!r.api.key_added&&(state.project.role||'owner')==='owner')openKey(r.api);
 }catch(err){text($('api-status'),err.message)}
 finally{for(const b of ['api-add','api-add-spec'])$(b).disabled=false}
}
// A pasted cURL command: opens the matching endpoint with its inputs filled, or offers to add it.
async function openCurl(add){
 const curl=$('api-curl').value.trim(),st=$('api-curl-status');if(!curl)return;
 text(st,'Reading the command…');
 try{
  const r=await api('/projects/'+state.project.id+'/apicurl',{method:'POST',body:{curl,add}});
  if(r.match){
   if(r.added)await renderApis();
   const open=window.__apiOpen&&window.__apiOpen[r.match.slug+'|'+r.match.op];
   text(st,(r.added?'Added '+r.added.title+'. ':'')+'Opened '+r.method+' '+r.url.split('?')[0]+' below. '+r.note);
   if(open)open({values:r.match.values,body:r.match.body});
  }else{
   st.replaceChildren(el('span','',r.method+' '+r.url.split('?')[0]+' is not part of an API added here. '+r.note+' '));
   const b=el('button','link-btn','Add it as an API');b.type='button';b.onclick=()=>openCurl(true);st.append(b);
  }
 }catch(err){text(st,err.message)}
}
$('api-curl-go').onclick=()=>openCurl(false);
$('api-add').onclick=()=>{const n=$('api-name').value.trim();if(n)addApi({name:n})};
$('api-name').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('api-add').click()}};
$('api-add-spec').onclick=()=>addApi({spec_url:$('api-spec-url').value.trim()||undefined,spec:$('api-spec').value.trim()||undefined,secret:$('api-secret').value.trim(),base_url:$('api-base').value.trim()||undefined});
// The key pop-up: a hidden field, saved encrypted, never shown again. "Later" is fine: samples meanwhile.
let keyFor=null;
function openKey(a){keyFor=a;text($('key-title'),(a.key_added?'Replace your ':'Add your ')+a.title+' key');text($('key-label'),a.secret);text($('key-error'),'');$('key-value').value='';$('key-dialog').showModal();$('key-value').focus()}
$('key-save').onclick=async()=>{
 const value=$('key-value').value;if(!value.trim()){text($('key-error'),'Paste the key first.');return}
 $('key-save').disabled=true;
 try{await api('/projects/'+state.project.id+'/secrets',{method:'POST',body:{name:keyFor.secret,value}});$('key-value').value='';$('key-dialog').close();renderApis().catch(()=>{});if(typeof renderSecrets==='function')renderSecrets().catch(()=>{})}
 catch(err){text($('key-error'),err.message)}
 finally{$('key-save').disabled=false;$('key-value').value=''}
};
$('key-dialog').addEventListener('close',()=>{$('key-value').value=''});

// ---------- free website check ----------
const checkState={id:null,timer:null};
function openCheckForm(){
 show('check-screen');history.replaceState(null,'','/create');document.title='Website check · Kairoq Create';
 for(const x of ['check-running','check-report','check-failed'])$(x).classList.add('hidden');
 $('check-form').classList.remove('hidden');text($('check-error'),'');
 const acct=state.me&&state.me.viewer&&state.me.viewer.account;if(acct&&!$('check-email').value)$('check-email').value=acct.email;
 $('check-url').focus();
}
async function startCheck({url,email,goal,force=false},errEl,btn){
 text(errEl,'');btn.disabled=true;
 try{const r=await api('/site-check',{method:'POST',body:{url,email,goal,force}});history.pushState(null,'','/create/check/'+r.id);openCheck(r.id)}
 catch(err){text(errEl,err.message)}
 finally{btn.disabled=false}
}
async function openCheck(id){
 show('check-screen');checkState.id=id;clearTimeout(checkState.timer);
 $('check-form').classList.add('hidden');$('check-failed').classList.add('hidden');
 try{
  const {check}=await api('/site-check/'+id);
  if(checkState.id!==id)return;
  if(check.status==='running'){
   $('check-report').classList.add('hidden');$('check-running').classList.remove('hidden');
   text($('check-running-title'),'Checking '+(check.host||'your website'));text($('check-progress'),check.progress||'Working…');
   checkState.timer=setTimeout(()=>openCheck(id),2500);return;
  }
  $('check-running').classList.add('hidden');
  if(check.status==='failed'){$('check-report').classList.add('hidden');$('check-failed').classList.remove('hidden');text($('check-failed-text'),check.error||'');return}
  renderCheck(check);
 }catch(err){$('check-running').classList.add('hidden');$('check-report').classList.add('hidden');$('check-failed').classList.remove('hidden');text($('check-failed-text'),err.message)}
}
// What visitors remembered afterwards (price, place, how to book), per question.
function renderRecall(box,recall){
 box.replaceChildren();box.classList.toggle('hidden',!(recall&&recall.length));
 if(!recall||!recall.length)return;
 box.append(el('li','recall-head','Afterwards, visitors remembered:'));
 for(const r of recall){const li=el('li',r.remembered*2>=r.asked?'ok':'bad');li.append(el('b',null,r.remembered+' of '+r.asked),' '+r.question.replace(/\?$/,'').replace(/^What does it cost$/,'the price').replace(/^Where is it, or how do you get there$/,'where it is').replace(/^How do you book or get in touch$/,'how to book or get in touch'));box.append(li)}
}
function renderCheck(c){
 checkState.report=c;
 document.title=c.host+' website check · Kairoq Create';
 $('check-report').classList.remove('hidden');
 const inconclusive=c.inconclusive||c.score===null||c.score===undefined;const sc=inconclusive?null:Math.max(0,Math.min(100,Number(c.score)||0)),ring=$('cr-ring'),C=2*Math.PI*52;
 ring.style.strokeDasharray=String(C);ring.style.strokeDashoffset=String(inconclusive?C:C*(1-sc/100));
 $('cr-score').className='cr-score '+(sc>=75?'good':sc>=50?'fair':'poor');text($('cr-score-n'),inconclusive?'—':sc);
 text($('cr-host'),c.host);text($('cr-business'),c.business||'');text($('cr-goal'),String(c.goal||'').replace(/\.$/,''));
 const n=c.numbers||{};
 text($('cr-headline'),c.summary&&c.summary.headline?c.summary.headline:n.completed===n.visitors?'Every visitor managed it.':'Some visitors did not manage it.');
 text($('cr-numbers'),inconclusive?'Insufficient evidence: '+(n.agent_failures||0)+' AI journeys failed or were blocked. No conversion score is assigned.':c.blocked?'The site\'s bot protection turned our AI customers away, so this score covers the technical basics only.':(n.completed||0)+' of '+((n.visitors||0)-(n.blocked||0))+' AI customers managed it'+(n.blocked?' ('+n.blocked+' blocked by bot protection)':'')+(n.by_device&&n.by_device.phone?' · on phones '+n.by_device.phone.completed+' of '+n.by_device.phone.visitors:'')+(n.median_steps?' · '+n.median_steps+' steps for those who did':''));
 renderRecall($('cr-recall'),n.recall);
 const shots=$('cr-shots');shots.replaceChildren();
 for(const name of c.shots||[]){const f=el('figure','cr-shot '+name),img=document.createElement('img');img.alt=c.host+' on '+(name==='phone'?'a phone':'a desktop');img.loading='lazy';img.src='/api/create/site-check/'+c.id+'/shot?name='+name;f.append(img,el('figcaption',null,name==='phone'?'Phone':'Desktop'));shots.append(f)}
 const iss=$('cr-issues');iss.replaceChildren();
 const issues=(c.summary&&c.summary.issues)||[];
 if(!issues.length)iss.append(el('li','muted','No visitor gave up on the way.'));
 for(const i of issues){const li=document.createElement('li');li.append(el('b',null,i.title));if(i.why)li.append(el('p',null,i.why));if(i.quote)li.append(el('blockquote',null,'“'+i.quote+'”'));const who=[i.who,i.visitors?i.visitors+' of '+(n.visitors||0)+' visitors':''].filter(Boolean).join(' · ');if(who)li.append(el('span','muted small',who));iss.append(li)}
 const fx=$('cr-fixes');fx.replaceChildren();
 const fixes=[...((c.summary&&c.summary.fixes)||[]),...(c.technical||[]).filter(t=>!t.ok).slice(0,3).map(t=>t.title+': '+t.detail)].slice(0,8);
 if(!fixes.length)fx.append(el('li','muted','Nothing urgent. Keep an eye on it after each change.'));
 for(const f of fixes)fx.append(el('li',null,f));
 const tech=$('cr-tech');tech.replaceChildren();
 for(const t of c.technical||[]){const li=el('li',t.ok?'ok':'bad');li.append(icon(t.ok?'check':'note'),el('b',null,t.title),el('span',null,t.detail));tech.append(li)}
 const vs=$('cr-visits');vs.replaceChildren();
 const said={completed:'managed it',gave_up:'gave up',stuck:'did not finish',error:'hit an error',blocked:'blocked by the site'};
 for(const v of c.visits||[]){
  const d=el('details','cr-visit'),s=el('summary');
  s.append(el('b',null,v.name+', '+v.age),el('span','muted',' · '+(v.device==='phone'?'phone':'desktop')+(v.about?' · '+v.about:'')),el('span','cr-outcome '+(v.outcome==='completed'?'ok':'bad'),said[v.outcome]||v.outcome));
  const ol=el('ol');if(v.judged)ol.append(el('li','muted small','Said it was done, but the check found: '+v.judged));for(const st of v.steps||[]){const li=el('li','feel-'+(st.feeling||'unsure'));li.append(el('span',null,st.thought||''),el('span','muted small',' '+st.action+(st.label?' “'+st.label+'”':'')));ol.append(li)}
  d.append(s,ol);vs.append(d);
 }
 for(const b of ['cr-rebuild','cr-rebuild-2'])$(b).onclick=()=>rebuildFromCheck(c).catch(err=>alert(err.message));
 $('cr-copy').onclick=()=>navigator.clipboard?.writeText(location.origin+'/create/check/'+c.id).then(()=>{text($('cr-copy'),'Copied');setTimeout(()=>text($('cr-copy'),'Copy link'),1500)}).catch(()=>{});
}
async function rebuildFromCheck(c){
 const lines=[...((c.summary&&c.summary.issues)||[]).map(i=>'- '+i.title+(i.why?': '+i.why:'')),...(c.technical||[]).filter(t=>!t.ok).map(t=>'- '+t.title+': '+t.detail)];
 const r={url:c.url,host:c.host,note:('My own, better version of this site. Fix what the website check found:\n'+lines.join('\n')).slice(0,1900)};
 if(!(state.me&&state.me.viewer)){setPending({rebuild:r});location.href='/create#signup';return}
 await rebuild(r);
}
async function rebuild(r){
 const {project}=await api('/projects',{method:'POST',body:{name:r.host}});
 await openProject(project.id);
 await openReference();
 $('ref-url').value=r.url;$('ref-note').value=r.note||'';
}
$('landing-check-form').onsubmit=e=>{e.preventDefault();startCheck({url:$('landing-check-url').value.trim(),email:$('landing-check-email').value.trim()},$('landing-check-error'),$('landing-check-go'))};
$('check-form').onsubmit=e=>{e.preventDefault();startCheck({url:$('check-url').value.trim(),email:$('check-email').value.trim(),goal:$('check-goal').value.trim()},$('check-error'),$('check-go'))};
$('cr-again').onclick=()=>{const c=checkState.report;if(!c)return openCheckForm();const email=window.prompt('Enter the email to receive the new report:');if(!email)return;startCheck({url:c.url,email,goal:c.goal,force:true},$('check-error'),$('cr-again'))};$('check-retry').onclick=openCheckForm;$('side-check').onclick=openCheckForm;
window.addEventListener('popstate',()=>{const m=/^\/create\/check\/([a-f0-9]{24})\/?$/.exec(location.pathname);if(m)openCheck(m[1])});

// ---------- WhatsApp ----------
async function openWhatsApp(){text($('wa-error'),'');$('wa-dialog').showModal();$('wa-code-line').classList.add('hidden');try{renderWhatsApp((await api('/whatsapp')).whatsapp)}catch(err){text($('wa-error'),err.message)}}
function renderWhatsApp(w){
 text($('wa-status'),w.connected?'✅ Your WhatsApp is connected. Message Kairoq any time.':'Not connected yet.');
 $('wa-connect').classList.toggle('hidden',w.connected);$('wa-connected-row').classList.toggle('hidden',!w.connected);
 if(w.start)$('wa-open').href=w.start;
}
$('wa-go').onclick=async()=>{text($('wa-error'),'');try{const r=await api('/whatsapp/code',{method:'POST'});text($('wa-code'),'link '+r.code);text($('wa-number'),r.number?'+'+r.number:'Kairoq');$('wa-code-line').classList.remove('hidden');if(r.link)window.open(r.link,'_blank','noopener')}catch(err){text($('wa-error'),err.message)}};
$('wa-disconnect').onclick=async()=>{try{await api('/whatsapp/disconnect',{method:'POST'});renderWhatsApp({connected:false})}catch(err){text($('wa-error'),err.message)}};
$('side-wa').onclick=openWhatsApp;

// ---------- memory: preferences and recipes ----------
async function openMemory(){text($('mem-error'),'');$('memory-dialog').showModal();try{renderMemory((await api('/memory')).memory)}catch(err){text($('mem-error'),err.message)}}
async function memoryAction(body){try{renderMemory((await api('/memory',{method:'POST',body})).memory)}catch(err){text($('mem-error'),err.message)}}
function renderMemory(mem){
 $('mem-enabled').checked=mem.enabled;$('mem-enabled').disabled=!mem.on;$('mem-off').classList.toggle('hidden',mem.on);
 const prefs=$('mem-prefs');prefs.replaceChildren();
 if(!mem.preferences.length)prefs.append(el('li','muted','Nothing yet. Say things like “never use purple” or “prices in euros” in a chat, or add them here.'));
 for(const p of mem.preferences){const li=el('li');li.append(el('span',null,p.text),el('span','muted small',p.source==='you'?' · added by you':' · learned '+when(p.at)));const x=el('button','ghost small-btn','Forget');x.type='button';x.onclick=()=>memoryAction({action:'delete_preference',id:p.id});li.append(x);prefs.append(li)}
 const rec=$('mem-recipes');rec.replaceChildren();
 if(!mem.recipes.length)rec.append(el('li','muted','No recipes yet. Kairoq writes one when a feature needed a few tries to get right.'));
 const owner=state.me&&state.me.viewer&&state.me.viewer.kind==='owner';
 for(const r of mem.recipes){
  const li=el('li','recipe '+r.status),d=el('details'),s=el('summary');
  s.append(el('b',null,r.title),el('span','muted small',' · '+(r.status==='off'?'off':r.uses?r.uses+' use'+(r.uses===1?'':'s')+', '+r.success_rate+'% right first time':'not used yet')+(r.improved?' · improved '+r.improved+'×':'')+(r.shared?' · shared with everyone':'')));
  const body=el('div','recipe-body');body.append(el('p','small',r.when));const ol=el('ol');for(const st of r.steps)ol.append(el('li',null,st));body.append(ol);
  if(r.pitfalls.length){const ul=el('ul');for(const p of r.pitfalls)ul.append(el('li',null,'Watch for: '+p));body.append(ul)}
  if(r.reason)body.append(el('p','muted small',r.reason));
  d.append(s,body);li.append(d);
  const row=el('div','row');
  const act=(label,b)=>{const x=el('button','ghost small-btn',label);x.type='button';x.onclick=()=>memoryAction(b);row.append(x)};
  act(r.status==='off'?'Turn on':'Switch off',{action:'recipe_status',id:r.id,status:r.status==='off'?'active':'off'});
  if(owner)act(r.shared?'Stop sharing':'Share with all accounts',{action:'share',id:r.id,shared:!r.shared});
  act('Delete',{action:'delete_recipe',id:r.id});
  li.append(row);rec.append(li);
 }
 $('mem-shared-box').classList.toggle('hidden',!mem.shared.length);
 const sh=$('mem-shared');sh.replaceChildren();for(const r of mem.shared){const li=el('li');li.append(el('b',null,r.title),el('span','muted small',' · '+r.when));sh.append(li)}
}
$('side-memory').onclick=openMemory;
// The older chat page (Sales Agent, Studio and the rest) lives at /chat; / now opens this page.
$('side-chat').onclick=()=>{location.href='/chat'};
// Web agent: tasks on other websites, and watches that repeat them and email changes.
const webState={poll:null};
function webRunItem(r){
 const li=el('li'),t=el('div','skill-text');
 const said={completed:'Done',gave_up:'Could not do it',stuck:'Did not finish',blocked:'Blocked by the site',error:'Error'};
 t.append(el('b',null,r.task),el('span',null,(r.status==='needs_you'?'Needs you: '+(r.need||''):r.status==='running'?'Working… '+(r.progress||''):(r.quick?'Quick check'+(r.changed?': changed':': no change'):said[r.outcome]||r.status)+' · '+when(r.at))+' · '+r.url));
 li.append(t);
 li.onclick=()=>showWebRun(r);
 return li;
}
// The live view: a picture of the agent's browser, refreshed while a run works. When it needs
// you (a captcha, a sign-in) or you take over, your clicks and typing go to that browser.
const live={id:null,timer:null,busy:false};
function liveFrame(){
 if(!live.id||!$('web-dialog').open){clearInterval(live.timer);live.timer=null;return}
 const img=$('web-live-img');if(live.busy)return;live.busy=true;
 const next=new Image();next.onload=()=>{img.src=next.src;live.busy=false};next.onerror=()=>{live.busy=false};
 next.src='/api/create/web-agent/'+live.id+'/frame?t='+Date.now();
}
function showLive(r){
 const box=$('web-live'),mine=r.status==='needs_you';
 if(r.status!=='running'&&!mine){box.classList.add('hidden');live.id=null;clearInterval(live.timer);live.timer=null;return}
 box.classList.remove('hidden');
 if(live.id!==r.id){live.id=r.id;clearInterval(live.timer);live.timer=setInterval(liveFrame,800);liveFrame()}
 text($('web-live-title'),mine?'Your turn':'Watching the agent work');
 text($('web-live-need'),mine?r.need||'':r.progress||'');
 for(const id of ['web-live-controls','web-live-help','web-handback','web-stop'])$(id).classList.toggle('hidden',!mine);
 $('web-takeover').classList.toggle('hidden',mine);
 box.classList.toggle('yours',mine);
}
async function liveInput(ev){
 if(!live.id)return;
 try{await api('/web-agent/'+live.id+'/input',{method:'POST',body:ev});liveFrame()}catch(err){text($('web-error'),err.message)}
}
$('web-live-img').onclick=e=>{
 const img=e.currentTarget,r=img.getBoundingClientRect();
 if(!img.naturalWidth)return;
 liveInput({type:'click',x:Math.round((e.clientX-r.left)*img.naturalWidth/r.width),y:Math.round((e.clientY-r.top)*img.naturalHeight/r.height)});
};
$('web-live-img').onkeydown=e=>{
 if(e.ctrlKey||e.metaKey||e.altKey)return;
 const keys={Enter:1,Tab:1,Backspace:1,Delete:1,Escape:1,ArrowUp:1,ArrowDown:1,ArrowLeft:1,ArrowRight:1,PageUp:1,PageDown:1,Home:1,End:1};
 if(keys[e.key]){e.preventDefault();liveInput({type:'key',key:e.key})}
 else if(e.key.length===1){e.preventDefault();liveInput({type:'type',text:e.key})}
};
$('web-live-img').addEventListener('wheel',e=>{if(!$('web-live').classList.contains('yours'))return;e.preventDefault();liveInput({type:'scroll',dy:Math.round(e.deltaY)})},{passive:false});
$('web-live-type').onclick=()=>{const t=$('web-live-text').value;if(t){liveInput({type:'type',text:t});$('web-live-text').value=''}};
for(const b of document.querySelectorAll('#web-live-controls [data-key]'))b.onclick=()=>liveInput({type:'key',key:b.dataset.key});
for(const b of document.querySelectorAll('#web-live-controls [data-scroll]'))b.onclick=()=>liveInput({type:'scroll',dy:Number(b.dataset.scroll)});
$('web-takeover').onclick=async()=>{if(!live.id)return;try{const {run}=await api('/web-agent/'+live.id+'/takeover',{method:'POST'});text($('web-live-need'),'Pausing the agent…');showLive(run)}catch(err){text($('web-error'),err.message)}};
$('web-handback').onclick=async()=>{if(!live.id)return;try{const {run}=await api('/web-agent/'+live.id+'/handback',{method:'POST',body:{}});showLive(run);renderWeb()}catch(err){text($('web-error'),err.message)}};
$('web-stop').onclick=async()=>{if(!live.id)return;try{const {run}=await api('/web-agent/'+live.id+'/handback',{method:'POST',body:{cancel:true}});showLive(run);renderWeb()}catch(err){text($('web-error'),err.message)}};
function showWebRun(r){
 const box=$('web-result');box.classList.remove('hidden');box.replaceChildren();
 showLive(r);
 if(r.status==='needs_you'){box.append(el('p',null,'The agent needs you: '+(r.need||'')));return}
 if(r.status==='running'){box.append(el('p','muted','Working on it… '+(r.progress||'')));return}
 if(r.status==='failed'){box.append(el('p','error',r.error||'It did not work.'));return}
 const head={completed:'Answer',gave_up:'It could not do it',stuck:'It did not finish',blocked:'The website blocked the agent',error:'Something went wrong'}[r.outcome]||'Result';
 box.append(el('h4',null,head),el('p','web-answer',r.answer||'(no answer)'));
 if(r.verdict&&!r.verdict.ok)box.append(el('p','muted small','Double-check: '+r.verdict.reason));
 if(r.change)box.append(el('p','small','Change: '+r.change));
 if(r.steps&&r.steps.length){const d=el('details'),s=el('summary',null,'What it did ('+r.steps.length+' steps)'),ol=el('ol','small');for(const st of r.steps)ol.append(el('li',null,st.action+(st.label?' “'+st.label+'”':'')+(st.value?' '+st.value:'')+(st.error?' (failed)':'')+(st.thought?' — '+st.thought:'')));d.append(s,ol);box.append(d)}
 if(r.charged)box.append(el('p','muted small',r.charged+' credits'));
}
async function renderWeb(){
 const d=await api('/web-agent');
 text($('web-price'),d.price?'Each run costs '+d.price+' credits.':'');
 const runs=$('web-runs');runs.replaceChildren();
 if(!d.runs.length)runs.append(el('li','muted small','Nothing yet.'));
 for(const r of d.runs)runs.append(webRunItem(r));
 $('web-watches-box').classList.toggle('hidden',!d.watches.length);
 const ws=$('web-watches');ws.replaceChildren();
 for(const w of d.watches){
  const li=el('li'),t=el('div','skill-text');
  t.append(el('b',null,w.task),el('span',null,w.url+' · every '+w.every+(w.paused?' · paused':w.last?' · last checked '+when(w.last):' · first check within the hour')+(w.quick?' · quick checks on':'')));
  const act=el('div','skill-actions');
  const pause=el('button','ghost link-btn',w.paused?'Resume':'Pause');pause.type='button';pause.onclick=async()=>{await api('/web-agent/watches/'+w.id,{method:'PATCH',body:{paused:!w.paused}});renderWeb()};
  const del=el('button','ghost link-btn','Remove');del.type='button';del.onclick=async()=>{if(!confirm('Remove this watch?'))return;await api('/web-agent/watches/'+w.id,{method:'DELETE'});renderWeb()};
  act.append(pause,del);li.append(t,act);ws.append(li);
 }
 const active=d.runs.find(r=>r.status==='running'||r.status==='needs_you');
 clearTimeout(webState.poll);
 if(active&&$('web-dialog').open)webState.poll=setTimeout(async()=>{try{const {run}=await api('/web-agent/'+active.id);showWebRun(run);renderWeb()}catch{}},1500);
}
$('side-web').onclick=async()=>{text($('web-error'),'');$('web-dialog').showModal();try{await renderWeb()}catch(err){text($('web-error'),err.message)}};
$('web-run').onclick=async()=>{
 text($('web-error'),'');const btn=$('web-run');btn.disabled=true;
 try{
  const body={url:$('web-url').value.trim(),task:$('web-task').value.trim()};
  const {run}=await api('/web-agent',{method:'POST',body:{...body,...($('web-every').value?{every:$('web-every').value}:{})}});
  showWebRun(run);await renderWeb();
 }catch(err){text($('web-error'),err.message)}
 finally{btn.disabled=false}
};
// ----- Find customers (outreach.js): leads, drafts, an outbox the owner approves -----
const LEAD_STATUS={new:'New',drafted:'Draft in outbox',contacted:'Emailed',replied:'Replied',not_interested:'Not interested',opted_out:'Asked not to be emailed',bounced:'Bounced',skipped:'Skipped'};
// Server messages can name a setting (e.g. "(KAIROQ_OUTREACH_FROM)"); only the owner sees those names.
function forViewer(msg){return state.me&&state.me.viewer&&state.me.viewer.kind==='owner'?msg:String(msg||'').replace(/\s*\((?:set )?KAIROQ_[A-Z0-9_]+\)/g,'')}
async function leadsAction(fn){text($('leads-error'),'');try{const d=await fn();if(d&&d.leads)renderLeads(d);else await loadLeads()}catch(err){text($('leads-error'),forViewer(err.message))}}
async function loadLeads(){renderLeads(await api('/outreach'))}
// The page keeps the last view so tabs and "Read draft" redraw without asking the server again.
const leadsUi={d:null,tab:'new',open:new Set()};
const LD_TABS=[['new','New',l=>l.status==='new'],['drafted','Draft ready',l=>l.status==='drafted'],['contacted','Contacted',l=>l.status==='contacted'],['replied','Replied',l=>l.status==='replied'],['closed','Closed',l=>['skipped','not_interested','opted_out','bounced'].includes(l.status)]];
// Fit is only the signals the owner ticked that Kairoq actually saw on the lead's own website.
function leadFit(l,d){const seen=(l.observations||[]).filter(o=>o.value&&(d.settings.signals||[]).includes(o.code));return{n:seen.length,labels:seen.map(o=>(d.signals.find(x=>x.code===o.code)||{}).label).filter(Boolean)}}
function renderLeads(d){
 leadsUi.d=d;const s=d.settings||{};
 for(const [id,v] of [['leads-offer',s.offer],['leads-customers',s.customers],['leads-sender',s.sender],['leads-business',s.sender_business],['leads-address',s.address],['leads-reply',s.reply_to]])if(document.activeElement!==$(id))$(id).value=v||'';
 text($('leads-missing'),d.missing.length?'Add '+d.missing.join(', ')+' before emails can be written.':'');
 $('ld-about-dot').classList.toggle('hidden',!d.missing.length);
 const sig=$('leads-signals');sig.textContent='';
 for(const x of d.signals){const l=el('label','ld-sig');const c=document.createElement('input');c.type='checkbox';c.value=x.code;c.checked=s.signals.includes(x.code);const t=el('span');t.append(el('b',null,x.label),el('small',null,x.why));l.append(c,t);sig.append(l)}
 const kind=$('leads-kind');if(!kind.options.length)for(const k of d.kinds){const o=document.createElement('option');o.value=k;o.textContent=cap(k.replace(/_/g,' '));kind.append(o)}
 const pill=$('leads-sending');pill.hidden=false;pill.classList.toggle('warn',Boolean(d.paused||!d.sending_ready));
 text(pill,d.paused?'Sending paused':!d.sending_ready?'You send approved emails yourself':d.stats.sent+' sent · up to '+d.daily+' a day');
 pill.title=d.paused?'Sending is paused: '+d.paused.reason:!d.sending_ready?'Sending needs its own address (set up by the Kairoq admin). Until then, copy approved emails into your own email.':d.stats.bounced+' bounced';
 const sub=$('ld-sub');sub.replaceChildren();
 if(s.customers){sub.append('Looking for ',el('b',null,s.customers),'. ')}else sub.append('Kairoq lists local businesses, reads their own websites and writes a short, honest first email. ');
 sub.append(el('b',null,'Nothing is sent until you approve it.'));
 text($('leads-attribution'),d.attribution);
 const tabs=$('ld-tabs');tabs.replaceChildren();
 for(const [key,label,match] of LD_TABS){const n=d.leads.filter(match).length;const b=el('button',null,label);b.type='button';b.setAttribute('role','tab');b.setAttribute('aria-selected',String(leadsUi.tab===key));b.append(el('span','n',String(n)));b.onclick=()=>{leadsUi.tab=key;renderLeads(leadsUi.d)};tabs.append(b)}
 const match=(LD_TABS.find(t=>t[0]===leadsUi.tab)||LD_TABS[0])[2];
 const shown=d.leads.filter(match),grid=$('ld-grid');grid.replaceChildren();
 if(!shown.length)grid.append(el('li','tp-empty',d.leads.length?'Nothing here yet.':'No leads yet. Pick a kind of business and a place, then Find.'));
 for(const l of shown)grid.append(leadCard(l,d));
}
function leadCard(l,d){
 const li=el('li','tp-card ld-card'),top=el('div','tp-card-top'),fit=leadFit(l,d);
 const ic=el('span','tp-ic',plInitials(l.name));ic.setAttribute('aria-hidden','true');
 const nm=el('span','tp-name',l.name);nm.append(el('small',null,[cap(l.kind.replace(/_/g,' ')),l.address].filter(Boolean).join(' · ')));
 top.append(ic,nm);
 if(fit.n)top.append(el('span','ld-fit'+(fit.n>=2?' strong':''),fit.n>=2?'Strong fit':'Good fit'));
 li.append(top);
 const why=fit.labels.length?fit.labels.join(' · '):l.profiled_at?'None of your signals seen on their website.':l.website?'Website not read yet.':'No website listed.';
 li.append(el('p','tp-desc',why));
 const contact=el('p','ld-contact');
 contact.append(l.email?el('span',null,l.email):el('span','ld-none','No published email'));
 if(l.website){const a=el('a',null,l.website.replace(/^https?:\/\/(www\.)?/,'').replace(/\/$/,''));a.href=l.website;a.target='_blank';a.rel='noopener nofollow';contact.append(a)}
 li.append(contact);
 const mail=d.outbox.find(o=>o.lead===l.id&&o.status!=='rejected'&&o.status!=='sent');
 const foot=el('div','tp-card-foot ld-actions');
 const btn=(label,cls,fn)=>{const b=el('button',cls,label);b.type='button';b.onclick=async()=>{b.disabled=true;try{await fn()}finally{b.disabled=false}};foot.append(b);return b};
 if(l.status==='new'){
  if(l.website&&!l.profiled_at)btn('Read their website','ghost tp-btn',()=>leadsAction(()=>api('/outreach/leads/'+l.id+'/profile',{method:'POST'})));
  if(l.email)btn('Write an email','primary',async()=>{text($('leads-status'),'Writing an email to '+l.name+'…');await leadsAction(()=>api('/outreach/leads/'+l.id+'/draft',{method:'POST'}));text($('leads-status'),'');leadsUi.tab='drafted';leadsUi.open.add(l.id);renderLeads(leadsUi.d)});
  else if(l.profiled_at||!l.website)foot.append(el('span','ld-chip','Needs a contact'));
  foot.append(el('span','tp-grow'));
  btn('Skip','link-btn',()=>leadsAction(()=>api('/outreach/leads/'+l.id,{method:'POST',body:{status:'skipped'}})));
 }else if(l.status==='drafted'&&mail){
  const st={waiting:'Draft ready',approved:'Approved',blocked:'Needs a fix'}[mail.status]||mail.status;
  foot.append(el('span','ld-chip'+(mail.status==='blocked'?' bad':' ok'),st));foot.append(el('span','tp-grow'));
  const openIt=leadsUi.open.has(l.id);
  btn(openIt?'Hide draft':'Read draft','ghost tp-btn',()=>{openIt?leadsUi.open.delete(l.id):leadsUi.open.add(l.id);renderLeads(leadsUi.d)});
  if(openIt){
   const box=el('div','ld-draft');
   box.append(el('p','ld-to','To '+mail.to));
   const subj=document.createElement('input');subj.value=mail.subject;subj.maxLength=120;subj.setAttribute('aria-label','Subject');
   const body=document.createElement('textarea');body.value=mail.text;body.rows=9;body.setAttribute('aria-label','Email');
   box.append(subj,body);
   if(mail.reasons&&mail.reasons.length)box.append(el('p','error small',mail.reasons.join(' ')));
   const row=el('div','tp-row');
   const mk=(label,cls,fn)=>{const b=el('button',cls,label);b.type='button';b.onclick=fn;row.append(b);return b};
   mk('Discard','link-btn',()=>leadsAction(()=>api('/outreach/outbox/'+mail.id,{method:'POST',body:{action:'reject'}})));
   mk('Copy','link-btn',()=>navigator.clipboard&&navigator.clipboard.writeText('To: '+mail.to+'\nSubject: '+subj.value+'\n\n'+body.value).then(()=>text($('leads-status'),'Copied.')));
   row.append(el('span','tp-grow'));
   mk('Save changes','ghost tp-btn',()=>leadsAction(()=>api('/outreach/outbox/'+mail.id,{method:'POST',body:{action:'edit',subject:subj.value,text:body.value}})));
   const sendable=mail.status==='approved'&&d.sending_ready&&!d.paused;
   mk(mail.status==='approved'?(sendable?'Send now':'Approved'):d.sending_ready&&!d.paused?'Approve and send':'Approve','primary',()=>leadsAction(async()=>{
    await api('/outreach/outbox/'+mail.id,{method:'POST',body:{action:'edit',subject:subj.value,text:body.value}});
    if(mail.status!=='approved'){await api('/outreach/outbox/'+mail.id,{method:'POST',body:{action:'approve'}});if(!d.sending_ready||d.paused){text($('leads-status'),'Approved. Copy it into your own email to send it.');return}}
    if(!d.sending_ready||d.paused)return;
    if(!confirm('Send this email to '+mail.to+' now?'))return;
    await api('/outreach/outbox/'+mail.id,{method:'POST',body:{action:'send'}});
   })).disabled=mail.status==='approved'&&!sendable;
   box.append(row);li.append(foot,box);return li;
  }
 }else if(l.status==='contacted'){
  foot.append(el('span','ld-chip ok','Emailed'));foot.append(el('span','tp-grow'));
  for(const [st,label] of [['replied','They replied'],['not_interested','Not interested'],['opted_out','Asked to stop'],['bounced','Bounced']])btn(label,'link-btn',()=>leadsAction(()=>api('/outreach/leads/'+l.id,{method:'POST',body:{status:st}})));
 }else{
  foot.append(el('span','ld-chip',LEAD_STATUS[l.status]||l.status));foot.append(el('span','tp-grow'));
  if(['skipped','not_interested','replied'].includes(l.status))btn('Move to New','link-btn',()=>leadsAction(()=>api('/outreach/leads/'+l.id,{method:'POST',body:{status:'new'}})));
 }
 li.append(foot);return li;
}
async function openLeads(){
 show('leads-screen');text($('leads-error'),'');
 if(!leadsUi.d)$('ld-grid').replaceChildren(el('li','tp-empty','Loading…'));
 try{await loadLeads();if(leadsUi.d.missing.length&&!leadsUi.d.leads.length)$('ld-about').classList.remove('hidden')}catch(err){$('ld-grid').replaceChildren();text($('leads-error'),forViewer(err.message))}
}
$('side-leads').onclick=openLeads;
$('ld-about-open').onclick=()=>$('ld-about').classList.toggle('hidden');
$('ld-about-close').onclick=()=>$('ld-about').classList.add('hidden');
$('ld-about').onsubmit=e=>e.preventDefault();
$('leads-save').onclick=()=>leadsAction(async()=>{const d=await api('/outreach/settings',{method:'POST',body:{offer:$('leads-offer').value,customers:$('leads-customers').value,sender:$('leads-sender').value,sender_business:$('leads-business').value,address:$('leads-address').value,reply_to:$('leads-reply').value.trim(),signals:[...$('leads-signals').querySelectorAll('input:checked')].map(c=>c.value)}});text($('leads-saved'),'Saved.');return d});
$('leads-search').onclick=async()=>{const b=$('leads-search');b.disabled=true;text($('leads-status'),'Looking on the map…');await leadsAction(async()=>{const d=await api('/outreach/search',{method:'POST',body:{kind:$('leads-kind').value,area:$('leads-area').value.trim()}});text($('leads-status'),'Found '+d.added+' new '+d.kind.replace(/_/g,' ')+' in '+d.area+'.');leadsUi.tab='new';return d});b.disabled=false};
$('mem-enabled').onchange=()=>memoryAction({action:'enabled',enabled:$('mem-enabled').checked});
$('mem-add').onclick=()=>{const t=$('mem-new').value.trim();if(!t)return;$('mem-new').value='';memoryAction({action:'add_preference',text:t})};
$('mem-new').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('mem-add').click()}});

// ---------- partner integrations ----------
const CATEGORY_NAMES={payments:'Payments',booking:'Booking',email:'Email',domains:'Domains',hosting:'Hosting',analytics:'Analytics',marketing:'Marketing',other:'Other'};
async function openIntegrations(){
 text($('integrations-error'),'');$('integrations-dialog').showModal();
 const grid=$('partner-grid');grid.replaceChildren(el('p','muted small','Loading…'));
 try{
  const {partners}=await api('/partners');grid.replaceChildren();
  if(!partners.length){grid.append(el('p','muted','No integrations yet. You can still ask for any service in the chat, for example “add Stripe checkout”.'));return}
  for(const p of partners){
   const card=el('div','partner-card'+(p.sponsored?' sponsored':''));
   const head=el('div','partner-head');head.append(el('span','partner-mark',p.name.slice(0,1).toUpperCase()),el('div'));
   head.lastChild.append(el('b',null,p.name),el('span','muted small',CATEGORY_NAMES[p.category]||p.category));
   head.append(el('span','badge '+(p.sponsored?'sponsored':'partner'),p.sponsored?'Sponsored':'Partner'));
   card.append(head);if(p.description)card.append(el('p','small',p.description));
   if(p.secrets.length)card.append(el('p','muted small','You will need: '+p.secrets.join(', ')+' (add it under Settings, then Secrets).'));
   const row=el('div','row');
   const add=el('button','primary','Add to my app');add.type='button';
   add.onclick=async()=>{add.disabled=true;try{const r=await api('/partners/'+p.id+'/add',{method:'POST'});$('integrations-dialog').close();setChatMode('build');send(r.message,'build')}catch(err){text($('integrations-error'),err.message);add.disabled=false}};
   row.append(add);
   if(p.has_signup){const a=el('a','ghost link','Create an account ↗');a.href='/api/create/partners/'+p.id+'/go';a.target='_blank';a.rel='noopener noreferrer';row.append(a)}
   card.append(row);grid.append(card);
  }
 }catch(err){grid.replaceChildren();text($('integrations-error'),err.message)}
}
// Connectors: every service this app can connect to, in one place. Each opens the panel
// where it is set up.
const CONNECTORS=[
 {id:'github',name:'GitHub',desc:'Push the code to your repository and pull changes back.',open:()=>openSettingsAt('gh-howto')},
 {id:'stripe',name:'Stripe payments',desc:'Take card payments and subscriptions with your own Stripe account.',open:()=>openSettingsAt('stripe-key')},
 {id:'email',name:'Email',desc:'Booking confirmations, password resets and owner notifications.',open:()=>openSettingsAt('email-status')},
 {id:'secrets',name:'API keys for your app',desc:'Keys for other services your server functions call (maps, SMS, AI…).',open:()=>openSettingsAt('secret-name')},
 {id:'figma',name:'Figma',desc:'Build a screen from a Figma frame.',open:()=>$('figma-open').click()},
 {id:'apps',name:'744 apps',desc:'Mailchimp, HubSpot, Slack, Airtable, Shopify, Twilio and more: pick one and say what should happen.',open:()=>openApps()},
 {id:'partners',name:'Integrations',desc:'Booking, payments, reviews and more from our partners.',open:()=>openIntegrations()},
 {id:'whatsapp',name:'WhatsApp',desc:'Answer customers on WhatsApp with your app\'s assistant.',open:()=>openWhatsApp()},
 {id:'domain',name:'Custom domain',desc:'Publish the app on your own domain, like www.yourhotel.com.',open:()=>$('publish-open').click()},
 {id:'mcp',name:'MCP and API keys',desc:'Let AI tools such as Claude build and test apps in your account.',open:()=>openSettingsAt('mcp-url'),owner:true}
];
async function openSettingsAt(id){
 $('connectors-dialog').close();
 await $('settings-open').onclick();
 const el=$(id);if(!el)return;
 if(el.tagName==='DETAILS')el.open=true;
 el.scrollIntoView({block:'center'});if(el.focus&&el.tagName!=='DETAILS')el.focus({preventScroll:true});
}
$('connect-open').onclick=()=>openManage('connectors');
// "744 apps" (integrations.js): search a service, pick what should happen, and Kairoq adds it.
let appsTimer=null;
const CONNECT_LABEL={key:'Works with an API key',oauth:'Connect with your account (sign in on its own page)',none:'No sign-in needed'};
async function openApps(){$('apps-dialog').showModal();$('apps-search').value='';$('apps-detail').replaceChildren(el('p','muted small','Pick a service to see what it can do.'));await appsSearch('');$('apps-search').focus()}
async function appsSearch(q){
 const ul=$('apps-list');
 try{const d=await api('/integrations?limit=60&q='+encodeURIComponent(q));ul.replaceChildren();
  if(!d.results.length)ul.append(el('li','muted small','No service found. Try another name.'));
  for(const r of d.results){const li=el('li'),b=el('button','apps-item');b.type='button';b.append(el('b',null,r.name),el('span','muted small',r.actions+' actions'+(r.connect==='oauth'?' · sign-in needed':'')));b.onclick=()=>{for(const x of ul.querySelectorAll('.apps-item'))x.classList.toggle('on',x===b);appsShow(r.id)};li.append(b);ul.append(li)}
 }catch(err){ul.replaceChildren(el('li','error',err.message))}
}
$('apps-search').oninput=()=>{clearTimeout(appsTimer);appsTimer=setTimeout(()=>appsSearch($('apps-search').value.trim()),200)};
async function appsShow(id){
 const box=$('apps-detail');box.replaceChildren(el('p','muted small','Loading…'));
 const {integration:d}=await api('/integrations/'+encodeURIComponent(id));
 const picked=new Set();
 box.replaceChildren(el('h3',null,d.name),el('p','small',d.description),el('p','apps-connect '+d.connect,CONNECT_LABEL[d.connect]+(d.secrets.length?': '+d.how:'')));
 const list=el('div','apps-actions');
 const row=(x,kind)=>{const l=el('label','apps-action'),c=document.createElement('input');c.type='checkbox';c.onchange=()=>{c.checked?picked.add(x.label):picked.delete(x.label)};l.append(c,el('span',null,(kind==='trigger'?'When: ':'')+x.label));if(x.description)l.title=x.description;return l};
 for(const a of d.actions.slice(0,40))list.append(row(a,'action'));
 for(const t of d.triggers.slice(0,15))list.append(row(t,'trigger'));
 const what=document.createElement('textarea');what.rows=2;what.placeholder='What should happen? e.g. "add everyone who books to my Mailchimp list"';what.className='apps-what';
 const add=el('button','primary','Add '+d.name+' to my app');add.type='button';
 add.onclick=()=>{
  const want=what.value.trim()||[...picked].join('; ');if(!want){what.focus();return}
  $('apps-dialog').close();
  send('Connect '+d.name+': '+want+(picked.size?'\nUse: '+[...picked].join('; '):'')+'\n(Integration "'+d.id+'" from Kairoq\'s integrations library.)','build');
 };
 const tail=el('div','row');tail.append(add);
 if(d.connect==='oauth')box.insertBefore(await oauthBox(d),box.querySelector('.plan-part'));
 if(d.secrets.length){const keys=el('button','ghost','Add the key');keys.type='button';keys.title='Add '+d.secrets.join(', ')+' in Settings → Secrets';keys.onclick=async()=>{$('apps-dialog').close();await openSettingsAt('secret-name');$('secret-name').value=d.secrets[0]};tail.append(keys)}
 box.append(el('p','plan-part','What should it do?'),list,what,tail,d.secrets.length?el('p','muted small','Keys it needs (added in Settings → Secrets, encrypted): '+d.secrets.join(', ')):'');
}
// "Connect with …" (oauth-connect.js): the owner signs in on the service's page in a small
// window; with no Kairoq OAuth app for the service, the owner can use their own.
async function oauthBox(d){
 const box=el('div','oauth-box');
 const draw=async()=>{
  let s;try{s=(await api('/projects/'+state.project.id+'/oauth?service='+encodeURIComponent(d.id))).oauth}catch(err){box.replaceChildren(el('p','error',err.message));return}
  box.replaceChildren();
  if(s.connected){box.append(el('p','oauth-on','Connected'+(s.account?' ('+s.account+')':'')+' since '+new Date(s.connected_at).toLocaleDateString()));const off=el('button','ghost','Disconnect');off.type='button';off.onclick=async()=>{await api('/projects/'+state.project.id+'/oauth',{method:'POST',body:{op:'disconnect',service:d.id}});draw()};box.append(off);return}
  if(s.app){
   const go=el('button','primary','Connect with '+d.name);go.type='button';
   go.onclick=async()=>{go.disabled=true;try{const r=await api('/projects/'+state.project.id+'/oauth',{method:'POST',body:{op:'start',service:d.id}});const w=window.open(r.url,'kairoq-oauth','width=520,height=720');if(!w)location.href=r.url}catch(err){box.append(el('p','error',err.message))}go.disabled=false};
   box.append(go);
  }else box.append(el('p','muted small','Kairoq has no '+d.name+' sign-in app yet. Use your own below, or ask Kairoq\'s team to add one.'));
  const own=document.createElement('details');own.className='oauth-own';own.open=!s.app;
  own.append(el('summary',null,'Use your own OAuth app'));
  const form=el('div','oauth-form');
  form.append(el('p','muted small','In '+d.name+'\'s developer settings, create an app and set its redirect (callback) address to:'),el('code','small',s.redirect_uri));
  const f=(label,name,type='text')=>{const l=el('label',null,label),i=document.createElement('input');i.type=type;i.name=name;i.autocomplete='off';l.append(i);form.append(l);return i};
  const cid=f('Client ID','client_id'),cs=f('Client Secret','client_secret','password');
  const au=s.needs_urls?f('Authorize address (https://…)','auth_url'):null,tu=s.needs_urls?f('Token address (https://…)','token_url'):null;
  const save=el('button','ghost','Save');save.type='button';
  save.onclick=async()=>{try{await api('/projects/'+state.project.id+'/oauth',{method:'POST',body:{op:'app',service:d.id,client_id:cid.value,client_secret:cs.value,...(au?{auth_url:au.value,token_url:tu.value}:{})}});draw()}catch(err){form.append(el('p','error',err.message))}};
  form.append(save);own.append(form);box.append(own);
 };
 await draw();
 const onMsg=e=>{if(e.origin===location.origin&&e.data&&e.data.kairoqOauth){draw()}};
 window.addEventListener('message',onMsg);
 return box;
}
$('integrations-open').onclick=()=>{$('menu-plus').open=false;if(state.project)openIntegrations()};

// ---------- admin: partners and sponsored templates ----------
let partnerAdmin=null;
function fillPartnerForm(p={}){
 $('pf-id').value=p.id||'';$('pf-name').value=p.name||'';$('pf-category').value=p.category||'payments';$('pf-description').value=p.description||'';$('pf-instructions').value=p.instructions||'';$('pf-secrets').value=(p.secrets||[]).join(', ');$('pf-signup').value=p.signup_url||'';$('pf-note').value=p.note||'';$('pf-sponsored').checked=Boolean(p.sponsored);$('pf-active').checked=p.active!==false;
 text($('partner-form-title'),p.id?'Edit '+p.name:'Add a partner');
}
function fillSlotForm(s={}){
 $('sf-id').value=s.id||'';$('sf-partner').value=s.partner_id||($('sf-partner').options[0]||{}).value||'';$('sf-title').value=s.title||'';$('sf-description').value=s.description||'';$('sf-template').value=s.template||'';$('sf-category').value=s.category||'';$('sf-prompt').value=s.prompt||'';$('sf-starts').value=s.starts||'';$('sf-ends').value=s.ends||'';$('sf-active').checked=s.active!==false;
 text($('slot-form-title'),s.id?'Edit '+s.title:'Add a sponsored template');
}
function renderPartnerAdmin(d){
 partnerAdmin=d;
 const cat=$('pf-category');if(!cat.options.length)for(const c of d.categories)cat.append(new Option(CATEGORY_NAMES[c]||c,c));
 const sp=$('sf-partner'),keep=sp.value;sp.replaceChildren();for(const p of d.partners)sp.append(new Option(p.name,p.id));if(keep)sp.value=keep;
 const tp=$('sf-template');if(tp.options.length<2&&state.templates)for(const t of state.templates)tp.append(new Option(t.name,t.id));
 text($('slot-help'),'A labelled card at the front of the template gallery, for set dates. At most '+d.max_slots+' run at once.');
 const ul=$('partner-admin-list');ul.replaceChildren();
 if(!d.partners.length)ul.append(el('li','muted','No partners yet.'));
 for(const p of d.partners){
  const li=el('li','rule'),head=el('div','rule-head');
  head.append(el('span','badge '+(!p.active?'retired':p.sponsored?'sponsored':'partner'),!p.active?'Hidden':p.sponsored?'Sponsored':'Partner'),el('b',null,p.name),el('span','muted small',' · '+(CATEGORY_NAMES[p.category]||p.category)));li.append(head);
  li.append(el('p','muted small','This month: '+(p.stats.this_month.clicks||0)+' clicks, '+(p.stats.this_month.adds||0)+' added to apps · all time: '+p.stats.clicks+' clicks, '+p.stats.adds+' adds'+(p.note?' · '+p.note:'')));
  const row=el('div','row'),edit=el('button','ghost small-btn','Edit');edit.type='button';edit.onclick=()=>{fillPartnerForm(p);$('partner-form-box').open=true};
  const del=el('button','ghost small-btn','Remove');del.type='button';del.onclick=()=>partnerAdminAction({action:'delete_partner',id:p.id});
  row.append(edit,del);li.append(row);ul.append(li);
 }
 const sl=$('slot-admin-list');sl.replaceChildren();
 if(!d.slots.length)sl.append(el('li','muted','No sponsored templates.'));
 for(const s of d.slots){
  const li=el('li','rule'),head=el('div','rule-head');
  head.append(el('span','badge '+(s.running?'active':'retired'),s.running?'Running':'Not running'),el('b',null,s.title),el('span','muted small',' · by '+s.sponsor+(s.starts||s.ends?' · '+(s.starts||'…')+' to '+(s.ends||'…'):'')));li.append(head);
  li.append(el('p','muted small','This month: '+(s.stats.this_month.impressions||0)+' views, '+(s.stats.this_month.starts||0)+' projects started · all time: '+s.stats.impressions+' views, '+s.stats.starts+' started'));
  const row=el('div','row'),edit=el('button','ghost small-btn','Edit');edit.type='button';edit.onclick=()=>{fillSlotForm(s);$('slot-form-box').open=true};
  const del=el('button','ghost small-btn','Remove');del.type='button';del.onclick=()=>partnerAdminAction({action:'delete_slot',id:s.id});
  row.append(edit,del);li.append(row);sl.append(li);
 }
}
async function partnerAdminAction(body){try{renderPartnerAdmin((await api('/admin/partners',{method:'POST',body})).partners);return true}catch(err){text($('admin-error'),err.message);return false}}
$('pf-save').onclick=async()=>{text($('admin-error'),'');if(await partnerAdminAction({action:'save_partner',partner:{id:$('pf-id').value||undefined,name:$('pf-name').value,category:$('pf-category').value,description:$('pf-description').value,instructions:$('pf-instructions').value,secrets:$('pf-secrets').value,signup_url:$('pf-signup').value.trim(),note:$('pf-note').value,sponsored:$('pf-sponsored').checked,active:$('pf-active').checked}}))fillPartnerForm()};
$('pf-clear').onclick=()=>fillPartnerForm();
$('sf-save').onclick=async()=>{text($('admin-error'),'');if(await partnerAdminAction({action:'save_slot',slot:{id:$('sf-id').value||undefined,partner_id:$('sf-partner').value,title:$('sf-title').value,description:$('sf-description').value,template:$('sf-template').value,category:$('sf-category').value,prompt:$('sf-prompt').value,starts:$('sf-starts').value,ends:$('sf-ends').value,active:$('sf-active').checked}})){fillSlotForm();state.templates=null}};
$('sf-clear').onclick=()=>fillSlotForm();

// ---------- admin (owner only): what Kairoq is learning, and website check leads ----------
// The reference library (builder-references.js): how much Kairoq has learned, and the button
// that has it read every tutorial once and keep its notes.
let refTimer=null;
async function renderRefs(){
 clearTimeout(refTimer);
 try{
  const s=await api('/admin/references'),j=s.job,on=Boolean(j&&j.running);
  text($('ref-status'),s.learned+' of '+s.total+' tutorials learned in '+s.topics+' topics'+(s.pages?' ('+s.pages+' pages and files read)':'')+(s.unlearnable?' · '+s.unlearnable+' videos have no written version to learn from':'')+(j?(on?' · learning now: '+j.done+' done':' · last run: '+j.done+' learned')+(j.skipped?', '+j.skipped+' had no readable text':'')+(j.failed?', '+j.failed+' failed'+(j.last_error?' ('+j.last_error.error+')':''):''):'')+'.'+(j&&j.paused?' '+j.paused:''));
  $('ref-learn').classList.toggle('hidden',on||s.learned>=s.total);$('ref-stop').classList.toggle('hidden',!on);
  if(on&&$('admin-dialog').open)refTimer=setTimeout(renderRefs,4000);
 }catch(err){text($('ref-status'),err.message)}
}
$('ref-learn').onclick=async()=>{$('ref-learn').disabled=true;try{await api('/admin/references',{method:'POST',body:{}})}catch(err){text($('ref-status'),err.message)}$('ref-learn').disabled=false;renderRefs()};
$('ref-import').onclick=()=>$('ref-file').click();
$('ref-file').onchange=async()=>{const f=$('ref-file').files[0];$('ref-file').value='';if(!f)return;
 if(f.size>11000000){text($('ref-status'),'That file is too big (over 11 MB).');return}
 text($('ref-status'),'Importing '+f.name+'…');
 try{const r=await api('/admin/references/import',{method:'POST',body:{text:await f.text()}});
  text($('ref-status'),'Imported '+r.imported+' tutorial'+(r.imported===1?'':'s')+(r.skipped_marked?', '+r.skipped_marked+' marked as videos':'')+(r.already?', '+r.already+' already learned (kept)':'')+(r.not_in_list?', '+r.not_in_list+' not in the list':'')+(r.too_short?', '+r.too_short+' too short':'')+(r.bad_lines?', '+r.bad_lines+' unreadable lines':'')+'. Now '+r.status.learned+' of '+r.status.total+' learned.')}
 catch(err){text($('ref-status'),err.message)}};
$('ref-stop').onclick=async()=>{try{await api('/admin/references',{method:'POST',body:{stop:true}})}catch{}renderRefs()};
async function openAdmin(){{const card=$('setup-card'),h=$('admin-dialog').querySelector('.dialog>h3');if(card&&h&&card.parentElement!==h.parentElement){h.before(card);card.open=true}}text($('admin-error'),'');renderRefs();text($('learn-status'),'');$('admin-dialog').showModal();if(!state.templates)try{const r=await api('/templates');state.templates=r.templates;state.sponsored=r.sponsored||[]}catch{}try{renderPartnerAdmin((await api('/admin/partners')).partners)}catch(err){text($('admin-error'),err.message)}await renderAdmin()}
function pctText(r){return r==null?'–':Math.round(r*1000)/10+'%'}
async function renderAdmin(given){
 try{
  const L=given||(await api('/learning')).learning;
  text($('learn-mode'),L.mode==='auto'?'New rules go live by themselves, and are switched off again when they do not make their problem rarer.':L.mode==='off'?'Learning is switched off on this server (KAIROQ_LEARNING=off).':'New rules wait for your approval. Kairoq still switches off approved rules that do not help. Set KAIROQ_LEARNING=auto to skip the approval.');
  const tiles=$('learn-tiles');tiles.replaceChildren();
  for(const [v,l] of [[L.builds,'builds in '+L.window_days+' days'],[L.clean_rate==null?'–':L.clean_rate+'%','worked first time'],[L.retries_per_build==null?'–':L.retries_per_build,'retries per build'],[L.saved_with_errors+L.failed,'saved with errors or failed'],[L.complaints,'"still not working" messages']]){const d=el('div');d.append(el('span','tile-value',String(v)),el('span','muted small',l));tiles.append(d)}
  const ul=$('learn-rules');ul.replaceChildren();
  if(!L.lessons.length)ul.append(el('li','muted','No rules yet. Kairoq proposes one when the same problem shows up in several projects.'));
  for(const r of L.lessons){
   const li=el('li','rule '+r.status),head=el('div','rule-head');
   head.append(el('span','badge '+r.status,r.status==='active'?(r.proven?'Live · proven':'Live'):r.status==='proposed'?'Waiting for you':'Off'),el('b',null,r.rule));li.append(head);
   if(r.why)li.append(el('p','small',r.why));
   const ev=r.evidence||{};
   li.append(el('p','muted small','Seen in '+ev.projects+' projects, '+pctText(ev.rate)+' of builds. Error: '+r.shape+(r.baseline?' · before: '+pctText(r.baseline.rate):'')+(r.after?' · after: '+pctText(r.after.rate)+' over '+r.after.builds+' builds':'')+(r.reason?' · '+r.reason:'')));
   const row=el('div','row');
   const act=(label,action,cls)=>{const b=el('button',cls,label);b.type='button';b.onclick=async()=>{b.disabled=true;try{renderAdmin((await api('/learning',{method:'POST',body:{id:r.id,action}})).learning)}catch(err){text($('admin-error'),err.message);b.disabled=false}};row.append(b)};
   if(r.status==='proposed')act('Approve','approve','primary');
   if(r.status!=='retired')act(r.status==='proposed'?'Reject':'Switch off','retire','ghost');
   if(r.status==='retired')act('Turn back on','approve','ghost');
   li.append(row);ul.append(li);
  }
  const top=$('learn-top');top.replaceChildren();
  if(!L.top_problems.length)top.append(el('li','muted','No repeated problems in this period.'));
  for(const p of L.top_problems){const li=el('li');li.append(el('code',null,p.shape),el('span','muted small',' · '+(p.stage==='build'?'build':p.stage==='browser'?'browser':'failed')+' · '+p.builds+' builds in '+p.projects+' projects'));top.append(li)}
 }catch(err){text($('admin-error'),err.message)}
 try{
  const {checks}=await api('/site-checks'),ul=$('lead-list');ul.replaceChildren();
  if(!checks.length)ul.append(el('li','muted','No website checks yet.'));
  for(const c of checks.slice(0,60)){const li=el('li'),a=el('a',null,c.url.replace(/^https?:\/\//,''));a.href='/create/check/'+c.id;a.target='_blank';a.rel='noopener';li.append(el('b',null,c.email),document.createTextNode(' · '),a,el('span','muted small',' · '+(c.score!=null?c.score+'/100':c.status)+' · '+when(c.at)+(c.cached?' · saved report':'')));ul.append(li)}
 }catch{}
}
$('side-admin').onclick=openAdmin;
// Dialog shell (docs/DESIGN-SYSTEM.md, public/ui/dialogs.css): each settings-type dialog gets a
// close (×) button in its top-right corner. It sits outside the form, so Enter in a field never hits it.
for(const id of ['settings','connectors','apps','integrations','publish','team','design','mobile','phone','stores','key','buy','explain','memory','admin']){
 const d=$(id+'-dialog');if(!d||d.querySelector(':scope>.kq-dlg-x'))continue;
 const x=document.createElement('button');x.type='button';x.className='kq-dlg-x';x.setAttribute('aria-label','Close');
 x.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
 x.onclick=()=>d.close(d.id==='key-dialog'?'cancel':'close');d.append(x);// after the form, so opening still focuses the first field
}
$('learn-run').onclick=async()=>{const b=$('learn-run');b.disabled=true;text($('learn-status'),'Looking at recent builds…');try{const r=await api('/learning',{method:'POST',body:{action:'run'}});text($('learn-status'),r.result.proposed.length?'Proposed '+r.result.proposed.length+' new rule'+(r.result.proposed.length===1?'':'s')+'.':'No new repeated problems found.');renderAdmin(r.learning)}catch(err){text($('learn-status'),err.message)}finally{b.disabled=false}};

async function start(){
 // Opened inside the main Kairoq page: no second sidebar.
 if(new URLSearchParams(location.search).get('embed')==='1'||window.self!==window.top)document.body.classList.add('embed');
 await handleLinks();
 const v=await loadMe();
 $('google-login').classList.toggle('hidden',!state.me.google);
 if(state.resetToken){show('auth');renderLanding();$('auth-form').classList.add('hidden');$('reset-form').classList.remove('hidden');text($('auth-title'),'Choose a new password');/* ui/screens: title for the reset step */openAuth();return}
 if(state.flash){text($('auth-error'),state.flash);text($('home-error'),state.flash);state.flash=null}
 const share=/^\/create\/share\/([a-f0-9]{24})\/?$/.exec(location.pathname);
 if(share)return openShare(share[1],v);
 const ck=/^\/create\/check\/([a-f0-9]{24})\/?$/.exec(location.pathname);
 if(ck){if(v)api('/projects').then(r=>renderRecents(r.projects)).catch(()=>{});return openCheck(ck[1])}
 if(!v){show('auth');setMode(state.me.signups?'signup':'login');$('tab-signup').classList.toggle('hidden',!state.me.signups);renderLanding();if(location.hash==='#signup')openAuth();return}
 const pending=takePending();
 if(pending){
  if(pending.ask){try{return await askThenBuild(pending.prompt)}catch(err){if(EMBED&&window.parent!==window)return backToKairoq({error:err.message,prompt:pending.prompt});await loadHome();text($('home-error'),err.message);return}}
  if(pending.remix)return remix(pending.remix);
  if(pending.sponsored){try{const {project,job}=await api('/projects',{method:'POST',body:{sponsored:pending.sponsored}});return openProject(project.id,{job})}catch(err){await loadHome();text($('home-error'),err.message);return}}
  if(pending.rebuild){try{return await rebuild(pending.rebuild)}catch(err){await loadHome();text($('home-error'),err.message);return}}
  try{const {project,job}=await api('/projects',{method:'POST',body:pending.template?{template:pending.template}:{prompt:pending.prompt}});return openProject(project.id,{pendingText:pending.prompt,job})}catch(err){await loadHome();text($('home-error'),err.message);return}
 }
 if(new URLSearchParams(location.search).get('purchase')==='success')setTimeout(refreshCredits,3000);
 const params=new URLSearchParams(location.search);
 const id=params.get('project');
 if(id&&/^[a-f0-9]{12}$/.test(id)){try{return await openProject(id)}catch{}}
 await loadHome();
}
start().catch(err=>{document.body.append(Object.assign(document.createElement('p'),{className:'error',textContent:err.message}))});
// ---------- saved checks ----------
async function renderChecks(){
 const d=await api('/projects/'+state.project.id+'/checks'),list=$('checks-list'),editor=state.project.role!=='viewer';
 list.replaceChildren();
 text($('checks-monitor'),d.monitor?('Live app, checked '+when(d.monitor.at)+': '+(d.monitor.ok?'all '+d.monitor.ran+' passed.':'failing: '+d.monitor.failed.join(', ')+'.')):(state.project.published?'The live app is checked once a day.':'After you publish, the live app is checked once a day and you get an email if a check fails.'));
 if(!d.checks.length){const li=document.createElement('li');li.className='muted small';li.textContent='No checks yet. Agent mode saves the flows it tests, or describe one below, for example "a guest can book the Garden room".';list.append(li)}
 for(const c of d.checks){
  const li=document.createElement('li'),st=document.createElement('span');st.className='check-state '+(c.last?(c.last.ok?'ok':'bad'):'');st.textContent=c.last?(c.last.ok?'✓':'✗'):'•';
  const t=document.createElement('div');t.className='skill-text';const b=document.createElement('b');b.textContent=c.name;const sp=document.createElement('span');sp.textContent=c.steps.length+' step'+(c.steps.length===1?'':'s')+' · '+({agent:'saved by the agent',ai:'written by the AI',kairoq:'written by Kairoq with the change that built this flow',user:'added by you'}[c.source]||c.source)+(c.last?' · last run '+when(c.last.at)+(c.last.version?' on v'+c.last.version:''):'')+(c.last&&!c.last.ok?' · failed: '+(c.last.step?c.last.step+(c.last.error?' ('+c.last.error+')':''):c.last.error):'');t.append(b,sp);
  const act=document.createElement('div');act.className='skill-actions';
  const on=document.createElement('label'),cb=document.createElement('input');cb.type='checkbox';cb.checked=c.enabled!==false;cb.disabled=!editor;cb.onchange=async()=>{try{await api('/projects/'+state.project.id+'/checks',{method:'POST',body:{id:c.id,enabled:cb.checked}})}catch(err){text($('checks-error'),err.message)}};on.append(cb,document.createTextNode(' on'));act.append(on);
  if(editor){const del=document.createElement('button');del.type='button';del.className='ghost link-btn';del.textContent='Remove';del.onclick=async()=>{if(!confirm('Remove the check "'+c.name+'"?'))return;try{await api('/projects/'+state.project.id+'/checks',{method:'DELETE',body:{id:c.id}});renderChecks()}catch(err){text($('checks-error'),err.message)}};act.append(del)}
  // How the check did on each device (react-checks.runDevices).
  if(c.last&&c.last.devices){const row=el('div','check-devices');const L={desktop:'Desktop',phone:'Phone',iphone:'iPhone Safari',slow:'Slow phone'};
   for(const k of ['desktop','phone','iphone','slow']){const r=c.last.devices[k];if(!r)continue;const b=el('span','dev-badge '+(r.ok?'ok':'bad'),L[k]+' '+(r.ok?'✓':'✗')+(k==='slow'&&r.ready_ms?' '+(r.ready_ms/1000).toFixed(1)+' s':''));if(!r.ok)b.title=(r.step?'At: '+r.step+'. ':'')+(r.error||'');row.append(b)}
   t.append(row)}
  li.append(st,t,act);
  // A renamed button or field: the check found the likely new one and proved the flow still works with it.
  if(c.last&&!c.last.ok&&c.last.repair){
   const fix=el('div','check-repair'),r=c.last.repair;
   fix.append(el('span',null,'Likely fix: the '+(r.field==='text'?'button':'field')+' “'+r.from+'” is now “'+r.to+'”, and the check passes with it.'));
   if(editor){const ap=el('button','ghost link-btn','Use it');ap.type='button';ap.onclick=async()=>{try{await api('/projects/'+state.project.id+'/checks',{method:'POST',body:{repair:c.id}});text($('checks-status'),'Updated “'+c.name+'”.');renderChecks()}catch(err){text($('checks-error'),err.message)}};fix.append(ap)}
   li.append(fix);
  }
  list.append(li);
 }
 for(const el of ['checks-run','checks-describe','checks-add'])$(el).disabled=!editor;
 $('checks-run').disabled=!editor||!d.checks.length;
}
// ---------- plain-English explanations ----------
// A card: what is happening, where (and the real code lines, with what each one means), why,
// what it costs and the fix. Code is optional reading behind "Show me the code".
function explainCard(c,{onFix}={}){
 const box=document.createElement('div');box.className='explain-card';
 const what=document.createElement('p');what.className='explain-what';what.textContent=c.what||'';box.append(what);
 const dl=document.createElement('dl');
 for(const [k,v] of [['Where',c.where?(c.where+(c.file?' ('+c.file+', line '+c.line+')':'')):''],['Why',c.why],['What it costs',c.impact],['The fix',c.fix]]){if(!v)continue;const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=k;dd.textContent=v;dl.append(dt,dd)}
 box.append(dl);
 if(c.sure===false)box.append(el('p','muted small','Kairoq is not certain this is the exact place; treat it as the most likely one.'));
 if(c.snippet&&c.snippet.length){
  const det=document.createElement('details'),sum=document.createElement('summary');sum.textContent='Show me the code';det.append(sum);
  const meaning=new Map((c.code||[]).map(x=>[x.n,x.meaning]));
  const pre=document.createElement('div');pre.className='explain-code';
  for(const ln of c.snippet){
   const row=document.createElement('div');row.className='explain-line'+(meaning.has(ln.n)?' marked':'')+(ln.n===c.line?' target':'');
   const num=document.createElement('span');num.className='n';num.textContent=ln.n;
   const code=document.createElement('code');code.textContent=ln.code||' ';
   row.append(num,code);pre.append(row);
   if(meaning.has(ln.n)){const m=document.createElement('div');m.className='explain-meaning';m.textContent='↳ '+meaning.get(ln.n);pre.append(m)}
  }
  det.append(pre);box.append(det);
 }
 if(onFix&&c.fix){const b=document.createElement('button');b.type='button';b.className='ghost';b.textContent='Fix this';b.onclick=onFix;box.append(b)}
 return box;
}
async function explainProblem(kind,textValue,title,version){
 const body=$('explain-body');body.replaceChildren(el('p','muted','Working it out…'));text($('explain-error'),'');text($('explain-title'),title);$('explain-fix').classList.add('hidden');
 $('explain-dialog').showModal();
 try{
  const {explanation:x}=await api('/projects/'+state.project.id+'/explain',{method:'POST',body:{kind,text:textValue,version:version||previewVersion(),tier:state.tier}});
  body.replaceChildren();
  if(kind==='change'){
   body.append(el('p','explain-what',x.summary||''));
   const ul=document.createElement('ul');for(const c of x.changes){const item=document.createElement('li');item.textContent=c.what+(c.where?' — '+c.where:'')+(c.why_it_matters?'. '+c.why_it_matters:'');ul.append(item)}body.append(ul);
   if(x.watch)body.append(el('p','small','Worth checking by hand: '+x.watch));
  }else{
   body.append(explainCard(x));
   if(x.fix){const b=$('explain-fix');b.classList.remove('hidden');b.onclick=()=>{$('explain-dialog').close();setChatMode('build');send('Fix this problem: '+x.what+(x.file?' (in '+x.file+' around line '+x.line+')':'')+'. Cause: '+x.why+'. Fix: '+x.fix,'build','/chat',{fix:true})}}
  }
  refreshCredits();
 }catch(err){body.replaceChildren();text($('explain-error'),err.message);if(err.status===402&&state.me.purchases)openBuy()}
}
$('explain-errors').onclick=()=>{const errors=[...new Set([...state.runtimeErrors,...currentVersionErrors()])];if(errors.length)explainProblem('error',errors.join('\n'),'What these problems mean')};
// ---------- synthetic customers ----------
const cust={info:null,report:null,fix:''};
function li(textValue,cls){const el=document.createElement('li');el.textContent=textValue;if(cls)el.className=cls;return el}
function custCost(){
 const n=Number($('cust-count').value),per=cust.info&&cust.info.price_per_visitor&&cust.info.price_per_visitor[state.tier];
 const sites=$('cust-compare').value.trim()?2:1;
 text($('cust-cost'),state.me.viewer.kind==='customer'&&per!=null?n+' visitors'+(sites>1?' on each of 2 sites':'')+' on the '+state.tier+' model cost '+n*per*sites+' credits.':'');
}
$('cust-compare').oninput=custCost;
function renderCustReports(){
 const ul=$('cust-reports');ul.replaceChildren();
 const list=cust.info?cust.info.reports:[];
 if(!list.length){ul.append(li('No tests yet.','muted'));return}
 for(const r of list){
  const el=document.createElement('li'),b=document.createElement('button');b.type='button';b.className='ghost';
  b.textContent=r.at.slice(0,16).replace('T',' ')+(r.site?' · '+siteName(r.site):'')+' · '+r.completion_rate+'% of '+r.visitors+' · '+r.goal;
  b.onclick=()=>openCustReport(r.id);el.append(b);ul.append(el);
 }
}
function siteName(u){try{return new URL(u).hostname}catch{return u}}
function renderComparison(c){
 const box=$('cust-comparison'),body=$('cust-comparison-body');body.replaceChildren();
 if(!c){box.classList.add('hidden');return}
 box.classList.remove('hidden');
 const best=Math.max(...c.sites.map(x=>x.numbers.completion_rate));
 for(const x of c.sites){
  const row=document.createElement('p');row.className='cust-stats';
  const b=document.createElement('b');b.textContent=x.numbers.completion_rate+'%';
  row.append(b,' '+x.label+': '+x.numbers.completed+' of '+x.numbers.visitors+' reached the goal'+(x.numbers.frustrated?' · '+x.numbers.frustrated+' got frustrated':'')+(x.numbers.completion_rate===best&&c.sites.some(y=>y.numbers.completion_rate<best)?' · better':''));
  const open=document.createElement('button');open.type='button';open.className='ghost';open.textContent='Open report';open.onclick=()=>openCustReport(x.report_id);row.append(' ',open);
  body.append(row);
 }
 if(!c.fair)body.append(el('p','muted small','This app ran on a test copy of its data; the other site had its sends answered by Kairoq. For the fairest comparison, test two published links.'));
}
function showCustReport(report,fix){
 cust.report=report;cust.fix=fix||'';
 const n=report.numbers,s=report.summary;
 const site=report.target&&report.target.kind==='site';
 text($('cust-target'),site?'Tested '+report.target.url+' (nothing was really sent to the site)':'Tested this app, version '+report.version+', on a test copy of its data');
 renderComparison(report.comparison);
 text($('cust-headline'),s.headline||'Test from '+report.at.slice(0,16).replace('T',' '));
 text($('cust-rate'),n.completion_rate+'% reached the goal');
 renderRecall($('cust-recall'),n.recall);
 text($('cust-numbers'),n.completed+' of '+n.visitors+' visitors · '+n.gave_up+' gave up · '+n.stuck+' did not finish'+(n.blocked?' · '+n.blocked+' blocked by bot protection':'')+(n.frustrated?' · '+n.frustrated+' got frustrated':'')+Object.entries(n.by_device||{}).map(([d,x])=>' · '+d+': '+x.completed+'/'+x.visitors).join(''));
 const drop=$('cust-drop');drop.replaceChildren();for(const d of n.drop_off)drop.append(li(d.path+' — '+d.visitors+' visitor'+(d.visitors===1?'':'s')));if(!n.drop_off.length)drop.append(li('Nobody left early.','muted'));
 const iss=$('cust-issues');iss.replaceChildren();for(const x of s.issues)iss.append(li(x.title+(x.why?': '+x.why:'')+(x.who?' ('+x.who+')':'')+(x.quote?' — “'+x.quote+'”':'')));if(!s.issues.length)iss.append(li('No issues found.','muted'));
 const cards=$('cust-cards');cards.replaceChildren();
 for(const c of report.explanations||[])cards.append(explainCard(c,{onFix:()=>{$('customers-dialog').close();setChatMode('build');send('Fix this problem found by synthetic customers: '+c.what+(c.file?' (in '+c.file+' around line '+c.line+')':'')+'. Cause: '+c.why+'. Fix: '+c.fix,'build','/chat',{fix:true})}}));
 if(!(report.explanations||[]).length)cards.append(el('p','muted small','No explanations for this test.'));
 // With explanations, the short issue list is a summary.
 text($('cust-issues-title'),(report.explanations||[]).length?'Issues in short':'Issues');
 const fx=$('cust-fixes');fx.replaceChildren();for(const f of s.fixes)fx.append(li(f));if(!s.fixes.length)fx.append(li('—','muted'));
 const probs=$('cust-problems');probs.replaceChildren();
 const word={confirmed:'Confirmed',not_reproduced:'Could not reproduce, left alone',experience:'Visitor experience (judged by the rerun)',not_checked:'Not checked'};
 for(const p of report.problems||[]){const item=li(p.title+' — '+(word[p.status]||p.status)+' · '+p.visitors.join(', ')+(p.steps&&p.steps.length?' · steps: '+p.steps.map(x=>x.action+(x.label?' “'+x.label+'”':'')).join(' → '):''),p.status==='confirmed'?'error':p.status==='not_reproduced'?'muted':'');probs.append(item)}
 if(!report.problems)probs.append(li('This test is older than replays; Fix and retest replays it first.','muted'));
 else if(!report.problems.length)probs.append(li('Everyone reached the goal.','muted'));
 const canFix=!site&&(s.issues.length||(report.problems||[]).some(p=>p.status==='confirmed')||!report.problems);
 $('cust-repair-box').classList.toggle('hidden',!canFix);
 repairCost();
 renderRepair(report.repair);
 const vis=$('cust-visits');vis.replaceChildren();
 for(const v of report.visits){
  const box=document.createElement('div');box.className='cust-visit';
  const h=document.createElement('p');const p=v.persona;h.textContent=p.name+', '+p.age+' · '+p.device+' · patience '+p.patience+' · tech '+p.tech+' — '+({completed:'reached the goal',gave_up:'gave up',stuck:'did not finish',blocked:'blocked by the site',error:'error',skipped:'skipped'}[v.outcome]||v.outcome)+(v.verdict&&!v.verdict.ok?' (said done; the check found: '+v.verdict.reason+')':'');h.className='small';box.append(h);
  const ol=document.createElement('ol');for(const st of v.steps)ol.append(li(st.path+' — “'+st.thought+'” → '+st.action+(st.label?' “'+st.label+'”':'')+(st.value?' “'+st.value+'”':''),st.feeling==='frustrated'?'error':''));box.append(ol);vis.append(box);
 }
 $('cust-report').classList.remove('hidden');
}
async function openCustReport(rid){try{const r=await api('/projects/'+state.project.id+'/synthetic?report='+encodeURIComponent(rid));showCustReport(r.report,r.fix_message)}catch(err){text($('cust-error'),err.message)}}
$('customers-open').onclick=async()=>{
 if(!state.project)return;text($('cust-error'),'');$('cust-report').classList.add('hidden');
 try{cust.info=await api('/projects/'+state.project.id+'/synthetic');text($('cust-site-max'),cust.info.site_max||25);if(!cust.info.browser)text($('cust-error'),'Synthetic customers need a browser (Chromium) on this server.');renderCustReports();custCost();$('customers-dialog').showModal()}
 catch(err){text($('chat-error'),err.message)}
};
$('cust-count').onchange=custCost;
$('cust-run').onclick=async()=>{
 if(state.job)return;text($('cust-error'),'');
 const audience=$('cust-audience').value.trim(),goal=$('cust-goal').value.trim();
 if(!audience||!goal){text($('cust-error'),'Describe your customers and what they come to do.');return}
 $('cust-run').disabled=true;
 try{
  const site=$('cust-site').value.trim(),compare=$('cust-compare').value.trim();
  if((site||compare)&&!$('cust-permission').checked)throw Error('Confirm that you own the other website or have permission to test it.');
  const r=await api('/projects/'+state.project.id+'/synthetic',{method:'POST',body:{audience,goal,count:Number($('cust-count').value),path:$('cust-path').value.trim()||undefined,tier:state.tier,...(site?{site}:{}),...(compare?{compare}:{}),...(site||compare?{permission:true}:{})}});
  $('customers-dialog').close();
  $('messages').append(messageItem({role:'user',text:'Test with '+$('cust-count').value+' synthetic customers: '+goal}));
  const done=await watch(r.job);
  if(done&&done.status==='complete'&&done.result&&done.result.synthetic){
   const n=done.result.synthetic.numbers,c=done.result.comparison;
   $('messages').append(messageItem({role:'assistant',text:c?'Same customers, two sites: '+c.sites.map(x=>x.label+' '+x.numbers.completed+' of '+x.numbers.visitors+' ('+x.numbers.completion_rate+'%)').join(' · ')+'. Open Customers to see both reports.':(done.result.synthetic.summary.headline?done.result.synthetic.summary.headline+'\n':'')+n.completed+' of '+n.visitors+' synthetic customers reached the goal ('+n.completion_rate+'%). Open Customers to see the report.'}));
   cust.info=await api('/projects/'+state.project.id+'/synthetic');renderCustReports();await openCustReport(done.result.synthetic.id);$('customers-dialog').showModal();
  }
 }catch(err){text($('cust-error'),err.message);if(err.status===402&&state.me.purchases)openBuy()}
 finally{$('cust-run').disabled=false}
};
function repairCost(){
 const r=cust.report;if(!r||!cust.info)return;
 const round=cust.info.price_per_fix_round&&cust.info.price_per_fix_round[state.tier],visit=cust.info.price_per_visitor&&cust.info.price_per_visitor[state.tier];
 if(state.me.viewer.kind!=='customer'||round==null){text($('cust-repair-cost'),'');return}
 const rounds=Number($('cust-rounds').value),rerun=$('cust-rerun').checked?r.visits.length*visit:0;
 text($('cust-repair-cost'),'At most '+(rounds*round+rerun)+' credits: '+round+' per fix round (only rounds that run are charged)'+(rerun?' plus '+rerun+' to rerun '+r.visits.length+' customers':'')+'.');
}
$('cust-rounds').onchange=repairCost;$('cust-rerun').onchange=repairCost;
function renderRepair(r){
 const box=$('cust-repair-result'),body=$('cust-repair-body');body.replaceChildren();
 if(!r){box.classList.add('hidden');return}
 box.classList.remove('hidden');
 if(r.nothing){body.append(el('p','muted','Nothing to fix.'));return}
 if(r.rerun){const x=r.rerun;body.append(el('p','cust-stats',x.before.completed+' of '+x.before.visitors+' reached the goal before → '+x.after.completed+' of '+x.after.visitors+' after ('+(x.change>=0?'+':'')+x.change+' points)'))}
 const word={fixed:'✓ Fixed (the same steps now work)',still:'✗ Still there',changed:'? The steps changed, judged by the rerun',confirmed:'Not retested',not_reproduced:'Left alone (could not reproduce)',experience:'Visitor experience',not_checked:'Not checked'};
 const ul=document.createElement('ul');for(const p of r.problems)ul.append(li(p.title+' — '+(word[p.after]||p.after),p.after==='still'?'error':''));body.append(ul);
 if(r.rerun&&r.rerun.issues.length){const u2=document.createElement('ul');for(const x of r.rerun.issues)u2.append(li(x.title+' — '+({gone:'no longer reported',still:'still reported',new:'new'}[x.status]),x.status==='new'?'error':''));body.append(el('p','small','What visitors said, before and after:'),u2)}
 if(r.checks.length)body.append(el('p','small','Saved as checks: '+r.checks.join('; ')));
 body.append(el('p','muted small',r.rounds.length+' fix round'+(r.rounds.length===1?'':'s')+(r.rounds.length?' (version '+r.rounds.map(x=>x.version).join(', ')+')':'')+(r.credits?' · '+r.credits+' credits':'')+(r.stopped?' · '+r.stopped:'')+(r.rerun_error?' · The rerun did not finish: '+r.rerun_error:'')));
 if(r.rerun&&r.rerun.report_id){const b=document.createElement('button');b.type='button';b.className='ghost';b.textContent='Open the new report';b.onclick=()=>openCustReport(r.rerun.report_id);body.append(b)}
}
$('cust-repair').onclick=async()=>{
 if(state.job||!cust.report)return;text($('cust-error'),'');$('cust-repair').disabled=true;
 const rid=cust.report.id;
 try{
  const r=await api('/projects/'+state.project.id+'/synthetic',{method:'POST',body:{repair:rid,rounds:Number($('cust-rounds').value),rerun:$('cust-rerun').checked,tier:state.tier}});
  $('customers-dialog').close();
  $('messages').append(messageItem({role:'user',text:'Fix and retest what synthetic customers found'}));
  const done=await watch(r.job);
  if(done&&done.status==='complete'&&done.result&&done.result.repair){
   const x=done.result.repair,fixed=x.problems.filter(p=>p.after==='fixed').length,confirmed=x.problems.filter(p=>p.before==='confirmed').length;
   $('messages').append(messageItem({role:'assistant',text:x.nothing?'The test found nothing to fix.':(confirmed?fixed+' of '+confirmed+' confirmed problems fixed and checked by replaying the same steps.':'Sent what visitors found hard to the AI.')+(x.rerun?' Rerun: '+x.rerun.before.completed+' → '+x.rerun.after.completed+' of '+x.rerun.after.visitors+' reached the goal.':'')+(x.checks.length?' Saved '+x.checks.length+' check'+(x.checks.length===1?'':'s')+'.':'')}));
   cust.info=await api('/projects/'+state.project.id+'/synthetic');renderCustReports();await openCustReport(rid);$('customers-dialog').showModal();
  }
 }catch(err){text($('cust-error'),err.message);if(err.status===402&&state.me.purchases)openBuy()}
 finally{$('cust-repair').disabled=false}
};
$('cust-fix').onclick=()=>{if(!cust.fix)return;$('customers-dialog').close();setChatMode('build');send(cust.fix,'build')};
// ---------- customers before code ----------
const launch={info:null,watch:null};
function copyButton(value){const b=document.createElement('button');b.type='button';b.className='ghost';b.textContent='Copy';b.onclick=()=>navigator.clipboard?.writeText(value).then(()=>{b.textContent='Copied'}).catch(()=>{});return b}
function launchPost(title,body,extra){
 const box=document.createElement('div');box.className='launch-post';
 const h=document.createElement('p');h.className='small';const b=document.createElement('b');b.textContent=title;h.append(b);if(extra)h.append(' · '+extra);
 const pre=document.createElement('pre');pre.className='small';pre.textContent=body;
 box.append(h,pre,copyButton(body));return box;
}
function launchCost(){
 const parts=launch.info&&launch.info.price_parts&&launch.info.price_parts[state.tier];
 if(state.me.viewer.kind!=='customer'||!parts){text($('launch-cost'),'');return}
 const n=Number($('launch-visitors').value),total=parts.pitch+parts.page+(launch.info.browser?parts.per_visitor*n:0);
 text($('launch-cost'),'At most '+total+' credits: '+parts.pitch+' for the pitch, '+parts.page+' for the page'+(launch.info.browser?', '+parts.per_visitor*n+' for '+n+' AI customers':'')+'. A part that does not work is free.');
}
function renderLaunch(){
 const l=launch.info&&launch.info.launch;
 $('launch-new').classList.toggle('hidden',Boolean(l));$('launch-view').classList.toggle('hidden',!l);
 launchCost();
 if(!l)return;
 const st=l.status;
 text($('launch-count'),st.signups+' of '+st.target+' signups');text($('launch-say'),st.say);
 $('launch-bar').style.width=Math.min(100,Math.round(st.signups/st.target*100))+'%';
 const link=$('launch-link');link.replaceChildren();
 if(st.link){const a=document.createElement('a');a.href=st.link;a.target='_blank';a.rel='noopener';a.textContent=st.link;link.append('Your page: ',a,st.visitors_30d?' · '+st.visitors_30d+' visitors in 30 days'+(st.rate!=null?' · '+st.rate+'% signed up':''):'')}
 else link.append('Publish the page (Publish, top right) to get the link to share.');
 $('launch-target-edit').value=st.target;
 text($('launch-headline'),l.pitch.headline);text($('launch-sub'),l.pitch.subheadline);
 const r=l.reaction;
 text($('launch-reaction'),r?r.joined+' of '+r.visitors+' AI customers joined the waitlist ('+r.rate+'%). '+(r.headline||'')+' This is a first read of the pitch, not a prediction: real signups decide.':'No AI customer reactions for this launch.');
 const ul=$('launch-objections');ul.replaceChildren();for(const o of (r&&r.objections)||[])ul.append(li(o.title+(o.quote?' — “'+o.quote+'”':'')));
 $('launch-report').classList.toggle('hidden',!l.report_id);
 const posts=$('launch-posts');posts.replaceChildren();const p=l.posts;
 if(p.reddit.title||p.reddit.body)posts.append(launchPost('Reddit',p.reddit.title+'\n\n'+p.reddit.body,p.reddit.where.length?'fits '+p.reddit.where.map(x=>'r/'+x).join(', ')+' (read each community\'s rules first)':''));
 if(p.linkedin)posts.append(launchPost('LinkedIn',p.linkedin));
 if(p.whatsapp)posts.append(launchPost('WhatsApp groups',p.whatsapp));
 if(p.x)posts.append(launchPost('X',p.x));
 if(p.email.body)posts.append(launchPost('Email to friends and contacts','Subject: '+p.email.subject+'\n\n'+p.email.body));
}
function renderWatch(){
 const d=launch.watch;if(!d)return;const w=d.watch||{};
 $('watch-enabled').checked=Boolean(w.enabled);
 $('watch-audience').value=w.audience||(launch.info&&launch.info.launch&&launch.info.launch.pitch.audience)||'';
 $('watch-goal').value=w.goal||'';
 const sel=$('watch-collection');sel.replaceChildren();for(const c of d.collections)sel.append(new Option(c,c));if(!d.collections.length)sel.append(new Option('(no collections yet)',''));sel.value=w.collection||(d.collections.includes('waitlist')?'waitlist':d.collections[0]||'');
 if(w.count)$('watch-count').value=String(w.count);
 const per=d.price_per_visitor&&d.price_per_visitor[state.tier];
 text($('watch-cost'),(d.published?'':'Publish the app first: the watch tests the live version. ')+(state.me.viewer.kind==='customer'&&per!=null?'Each weekly run costs '+Number($('watch-count').value)*per+' credits.':''));
 $('watch-run').disabled=!d.published||!w.audience;
 const box=$('watch-history');box.replaceChildren();
 for(const e of d.history){
  const div=document.createElement('div');div.className='watch-entry';
  const n=e.numbers.this_week,last=e.numbers.last_week;
  div.append(el('p','small muted',e.at.slice(0,10)+' · '+n.visitors+' visitors, '+n.signups+' signups'+(n.rate!=null?' ('+n.rate+'%)':'')+' · last week '+last.visitors+' / '+last.signups+' · AI customers '+e.ai.completed+' of '+e.ai.visitors));
  div.append(el('p','',e.brief.headline));
  if(e.brief.stopping.length){const u=document.createElement('ul');u.className='small';for(const x of e.brief.stopping)u.append(li(x.what+(x.evidence?' — '+x.evidence:'')));div.append(el('p','small','What is stopping signups:'),u)}
  if(e.brief.next.length){const u=document.createElement('ul');u.className='small';for(const x of e.brief.next)u.append(li(x));div.append(el('p','small','What to change next:'),u)}
  if(e.brief.good)div.append(el('p','small muted','Working well: '+e.brief.good));
  const b=document.createElement('button');b.type='button';b.className='primary';b.textContent='Open the report and fix';b.onclick=async()=>{$('launch-dialog').close();cust.info=await api('/projects/'+state.project.id+'/synthetic');renderCustReports();await openCustReport(e.report_id);$('customers-dialog').showModal()};
  div.append(b);box.append(div);
 }
}
async function loadLaunch(){
 [launch.info,launch.watch]=await Promise.all([api('/projects/'+state.project.id+'/launch'),api('/projects/'+state.project.id+'/watch')]);
 renderLaunch();renderWatch();
}
$('launch-open').onclick=async()=>{if(!state.project)return;text($('launch-error'),'');text($('watch-status'),'');try{await loadLaunch();$('launch-dialog').showModal()}catch(err){text($('chat-error'),err.message)}};
$('launch-visitors').onchange=launchCost;$('watch-count').onchange=renderWatch;
$('launch-start').onclick=async()=>{
 if(state.job)return;text($('launch-error'),'');
 const idea=$('launch-idea').value.trim();if(idea.length<20){text($('launch-error'),'Describe the idea in a few sentences: who it is for and what it does.');return}
 $('launch-start').disabled=true;
 try{
  const r=await api('/projects/'+state.project.id+'/launch',{method:'POST',body:{idea,target:Number($('launch-target').value),visitors:Number($('launch-visitors').value),tier:state.tier}});
  $('launch-dialog').close();$('messages').append(messageItem({role:'user',text:'Test this idea before building it: '+idea}));
  const done=await watch(r.job);
  if(done&&done.status==='complete'&&done.result&&done.result.launch){const l=done.result.launch;$('messages').append(messageItem({role:'assistant',text:'Your landing page and launch posts are ready.'+(l.reaction?' '+l.reaction.joined+' of '+l.reaction.visitors+' AI customers joined the waitlist.':'')+' Publish the page, share the posts, and Kairoq counts real signups toward your goal of '+l.target+'. Open Launch to see everything.'}));await loadLaunch();$('launch-dialog').showModal()}
 }catch(err){text($('launch-error'),err.message);if(err.status===402&&state.me.purchases)openBuy()}
 finally{$('launch-start').disabled=false}
};
$('launch-target-save').onclick=async()=>{try{launch.info.launch=(await api('/projects/'+state.project.id+'/launch',{method:'POST',body:{target:Number($('launch-target-edit').value)}})).launch;renderLaunch()}catch(err){text($('launch-error'),err.message)}};
$('launch-report').onclick=async()=>{const rid=launch.info&&launch.info.launch&&launch.info.launch.report_id;if(!rid)return;$('launch-dialog').close();cust.info=await api('/projects/'+state.project.id+'/synthetic');renderCustReports();await openCustReport(rid);$('customers-dialog').showModal()};
$('watch-save').onclick=async()=>{
 text($('launch-error'),'');
 try{const r=await api('/projects/'+state.project.id+'/watch',{method:'POST',body:{enabled:$('watch-enabled').checked,audience:$('watch-audience').value,goal:$('watch-goal').value,collection:$('watch-collection').value,count:Number($('watch-count').value),tier:state.tier}});launch.watch={...launch.watch,watch:r.watch,history:r.history};renderWatch();text($('watch-status'),'Saved.')}
 catch(err){text($('launch-error'),err.message)}
};
$('watch-run').onclick=async()=>{
 if(state.job)return;text($('launch-error'),'');
 try{
  const r=await api('/projects/'+state.project.id+'/watch',{method:'POST',body:{run:true}});
  $('launch-dialog').close();$('messages').append(messageItem({role:'user',text:'Run the growth watch now'}));
  const done=await watch(r.job);
  if(done&&done.status==='complete'&&done.result&&done.result.watch){$('messages').append(messageItem({role:'assistant',text:done.result.watch.brief.headline+' Open Launch to see the brief.'}));await loadLaunch();$('launch-dialog').showModal()}
 }catch(err){text($('launch-error'),err.message);if(err.status===402&&state.me.purchases)openBuy()}
};
// ---------- API keys (MCP) ----------
function renderApiKeys(keys){
 const ul=$('apikey-list');ul.replaceChildren();
 if(!keys.length){ul.append(li('No API keys yet.','muted'));return}
 for(const k of keys){
  const el=document.createElement('li'),t=document.createElement('span'),b=document.createElement('button');
  t.textContent=k.name+' · '+k.hint+' · '+(k.last_used_at?'used '+k.last_used_at.slice(0,10):'never used');
  b.type='button';b.className='ghost';b.textContent='Remove';
  b.onclick=async()=>{try{renderApiKeys((await api('/api-keys',{method:'DELETE',body:{id:k.id}})).keys)}catch(err){text($('apikey-status'),err.message)}};
  el.append(t,b);ul.append(el);
 }
}
async function loadApiKeys(){text($('mcp-url'),location.origin+'/mcp');$('apikey-new').classList.add('hidden');try{renderApiKeys((await api('/api-keys')).keys)}catch(err){text($('apikey-status'),err.message)}}
$('apikey-create').onclick=async()=>{
 text($('apikey-status'),'');
 try{
  const r=await api('/api-keys',{method:'POST',body:{name:$('apikey-name').value.trim()}});
  $('apikey-name').value='';renderApiKeys(r.keys);
  const box=$('apikey-new');box.replaceChildren();
  const code=document.createElement('code');code.textContent=r.created.key;
  box.append('Copy this key now; it is shown only once: ',code);box.classList.remove('hidden');
 }catch(err){text($('apikey-status'),err.message)}
};
$('checks-open').onclick=async()=>{text($('checks-error'),'');text($('checks-status'),'');$('checks-save-anyway').classList.add('hidden');try{await renderChecks();$('checks-dialog').showModal()}catch(err){text($('chat-error'),err.message)}};
$('checks-run').onclick=async()=>{const btn=$('checks-run');btn.disabled=true;text($('checks-status'),'Running the checks on a test copy of your data: desktop, phone, iPhone Safari and a slow phone…');text($('checks-error'),'');
 try{const {result}=await api('/projects/'+state.project.id+'/checks',{method:'POST',body:{run:true}});text($('checks-status'),result.failed.length?result.failed.length+' of '+result.ran+' failed.'+(result.repairs&&result.repairs.length?' '+result.repairs.length+' look like a renamed button or field: see “Likely fix” below.':' Use Fix it in the chat, or describe what changed.'):'All '+result.ran+' passed.');await renderChecks()}
 catch(err){text($('checks-status'),'');text($('checks-error'),err.message)}finally{btn.disabled=false}};
let checkDraft=null;
$('checks-add').onclick=async()=>{const btn=$('checks-add');btn.disabled=true;text($('checks-status'),'Writing the check and trying it…');text($('checks-error'),'');$('checks-save-anyway').classList.add('hidden');
 try{const r=await api('/projects/'+state.project.id+'/checks',{method:'POST',body:{describe:$('checks-describe').value,tier:state.tier}});
  if(r.saved){text($('checks-status'),'Added "'+r.check.name+'"'+(r.verified?' and it passes.':'.'));$('checks-describe').value='';await renderChecks()}
  else{checkDraft=r.draft;text($('checks-status'),'"'+r.draft.name+'" does not pass on the current version ('+(r.failed.step?'failed at '+r.failed.step+': ':'')+r.failed.error+'). Either the app has a bug, or the description needs to be clearer.');$('checks-save-anyway').classList.remove('hidden')}
  refreshCredits();
 }catch(err){text($('checks-status'),'');text($('checks-error'),err.message);if(err.status===402&&state.me.purchases)openBuy()}finally{btn.disabled=false}};
$('checks-save-anyway').onclick=async()=>{if(!checkDraft)return;try{await api('/projects/'+state.project.id+'/checks',{method:'POST',body:{...checkDraft,force:true}});$('checks-save-anyway').classList.add('hidden');text($('checks-status'),'Saved. It will fail until the app is fixed.');$('checks-describe').value='';await renderChecks()}catch(err){text($('checks-error'),err.message)}};
// ---------- design ----------
const PALETTE_KEYS=['background','foreground','primary','secondary','accent','muted'];
state.designData=null;
async function renderDesign(){
 const id=state.project.id,d=await api('/projects/'+id+'/design');state.designData=d;
 const ds=d.design||{},editor=state.project.role!=='viewer';
 // Plain wording (no file names) for the dialog subtitle.
 text($('design-intro'),d.design?'The AI follows this design in every change. Saving here restyles the whole app at once.':'No design brief yet. One is created automatically with the first build of a new app, or describe a direction below.');
 $('design-missing').classList.toggle('hidden',d.has_tokens);
 $('design-name').value=ds.name||'';$('design-summary').value=ds.summary||'';$('design-notes').value=ds.notes||'';
 const pal=$('design-palette');pal.replaceChildren();
 for(const k of PALETTE_KEYS){const l=document.createElement('label'),inp=document.createElement('input');inp.type='color';inp.dataset.key=k;inp.value=(ds.palette&&ds.palette[k])||({background:'#ffffff',foreground:'#0f172a',primary:'#4f46e5',secondary:'#f1f5f9',accent:'#ec4899',muted:'#f4f4f5'})[k];inp.disabled=!editor;l.append(inp,document.createTextNode(k));pal.append(l)}
 for(const [sel,val] of [['design-display',ds.fonts?.display||'Inter'],['design-body',ds.fonts?.body||'Inter']]){const el=$(sel);el.replaceChildren();for(const f of d.fonts)el.append(new Option(f,f));el.value=val}
 {const el=$('design-mono');el.replaceChildren(new Option('Default (system)',''));for(const f of d.fonts.filter(n=>/ Mono$|^Fira Code$/.test(n)))el.append(new Option(f,f));el.value=ds.fonts?.mono||''}
 $('design-radius').value=['0rem','0.375rem','0.75rem','1.25rem'].includes(ds.radius)?ds.radius:'0.75rem';
 renderSkills();
 text($('herovideo-status'),'');loadVideos('hero').catch(err=>text($('herovideo-status'),err.message));
 text($('explode-status'),'');loadFilms().catch(err=>text($('explode-status'),err.message));
 text($('models-status'),'');$('models-results').replaceChildren();loadModels().catch(err=>text($('models-status'),err.message));
 $('genimage-section').classList.toggle('hidden',!state.me.image_generation?.enabled);
 const c=state.me.image_generation?.credits;text($('genimage-status'),state.me.viewer?.kind==='customer'&&c?c+' credits per image. Saved to the project images; then ask the chat to use it.':'Saved to the project images; then ask the chat to use it.');
 for(const el of ['design-name','design-summary','design-notes','design-display','design-body','design-mono','design-radius','design-save','design-direction','design-regenerate','design-add-system','genimage-go'])$(el).disabled=!editor;
 const t=(state.me.tiers||[]).find(x=>x.id===state.tier);
 text($('design-regenerate-note'),'Picks new colours and fonts with the '+(t?t.label:'chosen')+' model'+(state.me.viewer?.kind==='customer'?' ('+(state.tier==='standard'||!t?state.me.discuss_credits:Math.max(t.credits,state.me.discuss_credits))+' credits)':'')+'. Ask the chat afterwards to restyle pages that need more than new colours.');
}
function renderSkills(){
 const d=state.designData,list=$('skills-list');list.replaceChildren();
 const on=new Set(d.skills),editor=state.project.role!=='viewer',owner=state.project.role==='owner';
 // Built-in styles first, then built-in page types, then the account's own skills, each under a heading.
 const groupOf=sk=>sk.source!=='builtin'?'Your skills':sk.group||'Styles',order=['Styles','Page types','Craft','Your skills'];
 const rank=g=>{const i=order.indexOf(g);return i<0?1.5:i};
 let heading=null;
 for(const sk of [...d.library].sort((a,b)=>rank(groupOf(a))-rank(groupOf(b)))){
  if(groupOf(sk)!==heading){heading=groupOf(sk);const h=document.createElement('li');h.className='skill-group';h.textContent=heading;list.append(h)}
  const li=document.createElement('li'),cb=document.createElement('input');cb.type='checkbox';cb.checked=on.has(sk.id)||sk.always;cb.disabled=!editor||sk.always;cb.title=sk.always?'On for all your projects':'Use in this project';
  cb.onchange=()=>saveDesign({skills:[...d.library.filter(x=>x.id===sk.id?cb.checked:on.has(x.id)).map(x=>x.id)]});
  const t=document.createElement('div');t.className='skill-text';const b=document.createElement('b');b.textContent=sk.name+(sk.source==='builtin'?'':sk.source==='github'?' · GitHub':' · yours');const sp=document.createElement('span');sp.textContent=sk.description;t.append(b,sp);
  const act=document.createElement('div');act.className='skill-actions';
  if(owner){const all=document.createElement('label');const ab=document.createElement('input');ab.type='checkbox';ab.checked=sk.always;ab.onchange=async()=>{try{await api('/skills/default',{method:'POST',body:{id:sk.id,on:ab.checked}});await renderDesign()}catch(err){text($('design-error'),err.message)}};all.append(ab,document.createTextNode(' all projects'));act.append(all)}
  if(owner&&sk.source!=='builtin'){const del=document.createElement('button');del.type='button';del.className='ghost link-btn';del.textContent='Remove';del.onclick=async()=>{if(!confirm('Remove the skill "'+sk.name+'"?'))return;try{await api('/skills',{method:'DELETE',body:{id:sk.id}});await renderDesign()}catch(err){text($('design-error'),err.message)}};act.append(del)}
  if(sk.url){const a=document.createElement('a');a.href=sk.url;a.target='_blank';a.rel='noopener';a.className='muted';a.textContent='source';act.append(a)}
  li.append(cb,t,act);list.append(li);
 }
 $('skill-add').classList.toggle('hidden',!owner);
}
async function saveDesign(body,status='Saved.'){
 text($('design-error'),'');text($('design-status'),'Saving…');
 try{
  const r=await api('/projects/'+state.project.id+'/design',{method:'POST',body});
  state.project=r.project;renderVersions();renderMessages();
  if(r.version)setPreview(r.project.preview_url);
  await renderDesign();text($('design-status'),r.version?status+' The preview now uses it (version '+r.version+').':status);
 }catch(err){text($('design-status'),'');text($('design-error'),err.message);if(err.status===402&&state.me.purchases)openBuy()}
}
$('design-open').onclick=async()=>{text($('design-error'),'');text($('design-status'),'');text($('skill-status'),'');$('skill-choices').replaceChildren();try{await renderDesign();$('design-dialog').showModal()}catch(err){text($('chat-error'),err.message)}};
$('design-save').onclick=()=>{const palette={};for(const inp of $('design-palette').querySelectorAll('input'))palette[inp.dataset.key]=inp.value;saveDesign({design:{name:$('design-name').value,summary:$('design-summary').value,notes:$('design-notes').value,palette,fonts:{display:$('design-display').value,body:$('design-body').value,...($('design-mono').value?{mono:$('design-mono').value}:{})},radius:$('design-radius').value}})};
$('design-regenerate').onclick=async()=>{$('design-regenerate').disabled=true;text($('design-status'),'Creating a new direction…');try{await saveDesign({regenerate:$('design-direction').value,tier:state.tier},'New direction saved.');refreshCredits()}finally{$('design-regenerate').disabled=false}};
$('design-add-system').onclick=()=>saveDesign({add_system:true},'Design system added.');
async function importSkill(path){
 text($('skill-status'),'Importing…');text($('design-error'),'');$('skill-choices').replaceChildren();
 try{
  const r=await api('/skills',{method:'POST',body:{url:$('skill-url').value,path}});
  if(r.choices){text($('skill-status'),'This repository has '+r.choices.length+' skills. Pick one:');for(const c of r.choices){const li=document.createElement('li'),b=document.createElement('button');b.type='button';b.className='ghost';b.textContent=c.name;b.title=c.path;b.onclick=()=>importSkill(c.path);li.append(b);$('skill-choices').append(li)};return}
  text($('skill-status'),'Added "'+r.skill.name+'". Tick it to use it in this project.'+(r.skill.warnings?' Checked it first and noticed: '+r.skill.warnings.join('; ')+'.':''));$('skill-url').value='';await renderDesign();
 }catch(err){text($('skill-status'),'');text($('design-error'),err.message)}
}
$('skill-import').onclick=()=>importSkill();
$('skill-save').onclick=async()=>{text($('design-error'),'');try{const r=await api('/skills',{method:'POST',body:{text:$('skill-text').value}});$('skill-text').value='';text($('skill-status'),'Added "'+r.skill.name+'".'+(r.skill.warnings?' Noticed: '+r.skill.warnings.join('; ')+'.':''));await renderDesign()}catch(err){text($('design-error'),err.message)}};
$('genimage-go').onclick=async()=>{
 const btn=$('genimage-go');btn.disabled=true;text($('genimage-status'),'Generating… (up to a minute)');text($('design-error'),'');
 try{const r=await api('/projects/'+state.project.id+'/images',{method:'POST',body:{prompt:$('genimage-prompt').value,aspect:$('genimage-aspect').value}});text($('genimage-status'),'Saved ./uploads/'+r.saved[0]+'. Ask the chat to use it, for example "use ./uploads/'+r.saved[0]+' as the hero image".');$('genimage-prompt').value='';refreshCredits()}
 catch(err){text($('genimage-status'),'');text($('design-error'),err.message);if(err.status===402&&state.me.purchases)openBuy()}
 finally{btn.disabled=false}
};
// ---------- 3D models (react-models.js) ----------
let modelsData=null;const posterTried=new Set();
const sizeMb=n=>(n/1048576).toFixed(n<10485760?1:0)+' MB';
async function loadModels(){modelsData=await api('/projects/'+state.project.id+'/models');renderModels()}
function renderModels(){
 const d=modelsData,id=state.project.id,editor=state.project.role!=='viewer',list=$('models-list');list.replaceChildren();
 text($('models-formats'),d.blender?'.glb, .fbx, .obj, .stl, .ply, .blend or a zipped glTF, up to 60 MB':'.glb up to 25 MB');
 $('models-file').accept=d.blender?'.glb,.gltf,.fbx,.obj,.stl,.ply,.blend,.zip':'.glb,.gltf';
 $('models-ph').classList.toggle('hidden',!d.polyhaven);
 if(!d.models.length)list.append(el('p','muted small','No 3D models yet.'));
 for(const m of d.models){
  const card=el('div','model-card'),pic=el('div','model-pic');
  if(m.poster){const img=el('img');img.alt=m.title;img.loading='lazy';img.src='/api/create/projects/'+id+'/model?file='+encodeURIComponent(m.poster);pic.append(img)}
  else{pic.append(el('span','muted small',m.kind==='model'?'Making a preview…':'Lighting'));if(m.kind==='model'&&editor)makePoster(m)}
  const info=el('div','model-info'),src=m.source||{};
  info.append(el('b',null,m.title),el('span','muted small',(m.kind==='environment'?'Lighting · ':'')+sizeMb(m.bytes)+(src.provider==='polyhaven'?' · Poly Haven (CC0)':m.converted?' · converted '+m.converted:'')),el('code','small',m.path));
  const act=el('div','row');
  const copy=el('button','link-btn','Copy path');copy.type='button';copy.onclick=()=>{try{navigator.clipboard.writeText(m.path)}catch{}text($('models-status'),'Copied '+m.path+'. Use it in the chat, for example "show '+m.path+' as a 3D viewer".')};act.append(copy);
  if(editor){const del=el('button','link-btn','Remove');del.type='button';del.onclick=async()=>{if(!confirm('Remove "'+m.title+'"? Pages that show it will need a new model.'))return;try{modelsData=await api('/projects/'+id+'/models',{method:'DELETE',body:{file:m.file}});renderModels()}catch(err){text($('models-status'),err.message)}};act.append(del)}
  info.append(act);card.append(pic,info);list.append(card);
 }
 const sel=$('models-style');sel.replaceChildren();for(const s of d.styles)sel.append(new Option(s.label,s.id));sel.value=d.style;sel.disabled=!editor;
 for(const b of ['models-upload','models-search'])$(b).disabled=!editor;
}
// Without Blender on the server, the preview picture is made here: the model is shown once,
// out of the way, and photographed with model-viewer's toBlob.
let viewerLoad=null;
function loadViewerScript(){if(customElements.get('model-viewer'))return Promise.resolve();if(!viewerLoad)viewerLoad=new Promise((ok,bad)=>{const s=document.createElement('script');s.type='module';s.src='/vendor/model-viewer/model-viewer-4.4.0.min.js';s.onload=()=>customElements.whenDefined('model-viewer').then(ok);s.onerror=()=>{viewerLoad=null;bad(Error('3D viewer did not load'))};document.head.append(s)});return viewerLoad}
async function makePoster(m){
 if(posterTried.has(m.file))return;posterTried.add(m.file);
 const id=state.project.id;let mv=null;
 try{
  await loadViewerScript();
  mv=document.createElement('model-viewer');mv.setAttribute('src','/api/create/projects/'+id+'/model?file='+encodeURIComponent(m.file));mv.setAttribute('camera-orbit','35deg 70deg auto');mv.setAttribute('shadow-intensity','1');mv.setAttribute('interaction-prompt','none');
  Object.assign(mv.style,{position:'fixed',right:'0',bottom:'0',width:'640px',height:'480px',opacity:'0.01',pointerEvents:'none',zIndex:'-1',background:'transparent'});
  document.body.append(mv);
  await new Promise((ok,bad)=>{const t=setTimeout(()=>bad(Error('timeout')),45000);mv.addEventListener('load',()=>{clearTimeout(t);ok()},{once:true});mv.addEventListener('error',()=>{clearTimeout(t);bad(Error('could not open the model'))},{once:true})});
  await new Promise(r=>setTimeout(r,600));
  const blob=await mv.toBlob({mimeType:'image/png',idealAspect:false});
  const r=await fetch('/api/create/projects/'+id+'/models?op=poster&file='+encodeURIComponent(m.file),{method:'POST',body:blob,headers:{'Content-Type':'image/png'},credentials:'same-origin'});
  if(r.ok){modelsData=await r.json();renderModels()}
 }catch(err){console.warn('3D preview',err.message)}finally{if(mv)mv.remove()}
}
$('models-upload').onclick=()=>$('models-file').click();
$('models-file').onchange=async()=>{
 const f=$('models-file').files[0];$('models-file').value='';if(!f)return;
 if(f.size>61*1024*1024){text($('models-status'),'3D files up to 60 MB');return}
 const b=$('models-upload');b.disabled=true;text($('models-status'),/\.glb$/i.test(f.name)?'Uploading '+f.name+'…':'Uploading and converting '+f.name+' with Blender… (up to a few minutes)');
 try{
  const r=await fetch('/api/create/projects/'+state.project.id+'/models?op=upload&name='+encodeURIComponent(f.name),{method:'POST',body:f,headers:{'Content-Type':'application/octet-stream'},credentials:'same-origin'});
  const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Upload failed ('+r.status+')');
  modelsData=d;renderModels();text($('models-status'),'Added '+d.added.title+' ('+d.added.path+'). Ask the chat to show it.');
 }catch(err){text($('models-status'),err.message)}finally{b.disabled=false}
};
async function searchModels(){
 const q=$('models-query').value.trim(),kind=$('models-kind').value,box=$('models-results');
 if(q.length<2){text($('models-status'),'Type what to look for, for example chair');return}
 text($('models-status'),'Searching Poly Haven…');box.replaceChildren();
 try{
  const {results}=await api('/projects/'+state.project.id+'/models?op=search',{method:'POST',body:{query:q,kind}});
  text($('models-status'),results.length?'Tap one to add it. All Poly Haven models are free to use (CC0).':'Nothing found for "'+q+'". Try a simpler word.');
  for(const x of results){
   const b=el('button','model-result');b.type='button';b.title='Add '+x.title;
   const img=el('img');img.alt='';img.loading='lazy';img.src=x.thumb;b.append(img,el('span',null,x.title));
   b.onclick=async()=>{b.disabled=true;text($('models-status'),'Adding '+x.title+'…');try{const d=await api('/projects/'+state.project.id+'/models?op=polyhaven',{method:'POST',body:{id:x.id,kind}});modelsData=d;renderModels();text($('models-status'),'Added '+d.added.title+' ('+d.added.path+'). Ask the chat to show it.')}catch(err){b.disabled=false;text($('models-status'),err.message)}};
   box.append(b);
  }
 }catch(err){text($('models-status'),err.message)}
}
$('models-search').onclick=searchModels;
$('models-query').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();searchModels()}};
$('models-style').onchange=async()=>{try{modelsData=await api('/projects/'+state.project.id+'/models?op=style',{method:'POST',body:{style:$('models-style').value}});renderModels();text($('models-status'),$('models-style').value==='none'?'Saved.':'Saved. Ask the chat to "add the 3D" to put it on the pages.')}catch(err){text($('models-status'),err.message)}};
// Autopilot (autopilot.js): test against the request, fix what is missing, repeat.
$('autopilot-run').onclick=()=>{$('menu-project').open=false;if(!state.project||!state.project.current_version){text($('chat-error'),'Build the app first.');return}const note=$('chat-input').value.trim();send(note?"Keep going until it's right: "+note:"Keep going until it's right",'autopilot',undefined,{message:note})};
$('polish').onclick=()=>{if(!state.me.design_review){text($('chat-error'),'The design review needs a browser on the server (Chromium), which is not available here.');return}const note=$('chat-input').value.trim();send(note?'Polish the design: '+note:'Polish the design','polish',undefined,{message:note})};

// Model and advanced choices open from the plus menu without duplicating their state.
$('builder-model-open').onclick=e=>{e.stopPropagation();$('menu-plus').open=false;$('menu-tier').open=true;$('tier-panel').querySelector('button')?.focus()};
$('builder-advanced-open').onclick=()=>{$('menu-plus').open=false;$('settings-open').click()};
$('view-settings').onclick=()=>$('settings-open').click();

})();

// Dropdown menus (details.menu) close when something inside is chosen or when clicking elsewhere.
document.addEventListener('click',e=>{for(const d of document.querySelectorAll('details.menu[open]'))if(!d.contains(e.target)||e.target.closest('.menu-panel button,.menu-panel a'))d.removeAttribute('open')});
document.addEventListener('keydown',e=>{if(e.key==='Escape')for(const d of document.querySelectorAll('details.menu[open]'))d.removeAttribute('open')});
// The editor's top bar scrolls sideways on narrow screens, which would clip a dropdown inside it,
// so an open menu there is placed on the page itself, under its button.
for(const d of document.querySelectorAll('#editor .stage-bar details.menu'))d.addEventListener('toggle',()=>{
 const p=d.querySelector('.menu-panel');if(!p)return;
 if(!d.open){p.style.position=p.style.top=p.style.right=p.style.left='';return}
 const r=d.querySelector('summary').getBoundingClientRect();
 p.style.position='fixed';p.style.top=Math.round(r.bottom+6)+'px';p.style.left='auto';p.style.right=Math.max(8,Math.round(innerWidth-r.right))+'px';
});

// Menus show one line per item; the longer explanation becomes the item's tooltip.
for(const item of document.querySelectorAll('#editor .menu-panel>button,#editor .menu-panel>a')){const sp=item.querySelector(':scope>span');if(sp&&!item.title&&sp.textContent.trim())item.title=sp.textContent.trim()}
// More menu groups: "Your app", "Test", "Launch" (the order is set in calm.css).
(()=>{const panel=document.querySelector('#menu-project>.menu-panel');if(!panel)return;const notes=[...panel.querySelectorAll(':scope>.menu-note')];
 const mk=(t,c)=>{const n=document.createElement('p');n.className='menu-note '+c;n.textContent=t;return n};
 notes.forEach(n=>n.remove());panel.prepend(mk('Your app','g-app'),mk('Test','g-test'),mk('Launch','g-launch'))})();

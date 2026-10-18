"use strict";
(()=>{
const $=id=>document.getElementById(id);
const state={me:null,project:null,job:null,mode:'signup',file:null};

async function api(path,{method='GET',body}={}){
 const r=await fetch('/api/create'+path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,credentials:'same-origin'});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw Object.assign(new Error(data.error||'Request failed ('+r.status+')'),{status:r.status,data});
 return data;
}
function show(screen){
 for(const id of ['auth','home','editor','share-screen','check-screen'])$(id).classList.toggle('hidden',id!==screen);
 $('bar-project').classList.toggle('hidden',screen!=='editor');
 if(screen!=='check-screen'){clearTimeout(checkState.timer);checkState.id=null}
 $('landing-nav').classList.toggle('hidden',screen!=='auth');
 const app=screen==='home'||screen==='editor'||(screen==='check-screen'&&Boolean(state.me&&state.me.viewer));
 document.body.classList.toggle('app',app);document.body.classList.toggle('in-editor',screen==='editor');
 $('side').classList.toggle('hidden',!app);
 if(screen==='editor'&&!state.sideSet){state.sideSet=true;document.body.classList.toggle('side-open',window.innerWidth>=1600)}
 if(window.innerWidth<=820)document.body.classList.remove('side-open');
 $('side-open-btn').classList.toggle('hidden',!app);
 for(const b of ['side-new','side-projects','side-templates','side-check'])$(b).removeAttribute('aria-current');
 if(screen==='check-screen')$('side-check').setAttribute('aria-current','page');
 if(screen==='home')$(state.homeTab==='templates'?'side-templates':'side-projects').setAttribute('aria-current','page');
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
 text($('home-title'),name?'Got an idea, '+cap(name.split(' ')[0])+'?':'Got an idea?');
 $('side-admin').classList.toggle('hidden',!(v&&v.kind==='owner'));
 const wa=state.me.whatsapp;$('side-wa').classList.toggle('hidden',!(wa&&v&&v.kind==='customer'));$('landing-wa').classList.toggle('hidden',!wa);if(wa)$('landing-wa').href=wa.start;
 $('logout').classList.toggle('hidden',!v||v.kind!=='customer');
 renderCredits(v&&v.account);
 text($('free-note'),state.me.free_credits?'New accounts get '+state.me.free_credits+' free credits. One credit = one change.':'');
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
 $('tab-signup').setAttribute('aria-selected',String(mode==='signup'));
 $('tab-login').setAttribute('aria-selected',String(mode==='login'));
 text($('auth-submit'),mode==='signup'?'Create account':'Sign in');
 $('password').autocomplete=mode==='signup'?'new-password':'current-password';
 $('free-note').classList.toggle('hidden',mode!=='signup');
 text($('auth-error'),'');
}
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
async function loadHome(){
 show('home');history.replaceState(null,'','/create');
 const acct=state.me.viewer?.account;
 $('verify-notice').classList.toggle('hidden',!(acct&&!acct.email_verified&&state.me.email_ready));
 renderTemplates($('home-templates'),id=>startFromTemplate(id),id=>startFromSponsored(id));
 homeTab(state.homeTab||'projects');
 const {projects}=await api('/projects');
 renderProjects(projects);
}
function initials(name){const w=String(name||'').trim().split(/\s+/).filter(Boolean);return ((w[0]||'K')[0]+(w[1]?w[1][0]:'')).toUpperCase()}
function renderProjects(projects){
 state.projects=projects;
 text($('project-count'),projects.length?projects.length+' project'+(projects.length===1?'':'s'):'');
 const list=$('projects');list.replaceChildren();
 if(!projects.length){const li=document.createElement('li');li.className='muted';li.textContent='No projects yet. Describe one above, or start from a template.';list.append(li)}
 for(const p of projects){
  const li=document.createElement('li'),thumb=el('div','thumb',initials(p.name)),open=document.createElement('button'),meta=document.createElement('span');
  thumb.setAttribute('aria-hidden','true');
  open.type='button';open.className='open';open.textContent=p.name;open.onclick=()=>openProject(p.id);
  meta.className='meta';meta.textContent='v'+p.current_version+' · '+when(p.updated_at);
  li.append(thumb,open,meta);li.onclick=e=>{if(e.target===li||e.target===thumb||e.target===meta)openProject(p.id)};
  if(p.role&&p.role!=='owner'){const b=document.createElement('span');b.className='role-badge';b.textContent='Shared · '+p.role;li.append(b)}
  if(p.published){const b=document.createElement('span');b.className='badge live';b.textContent='Live';li.append(b)}
  list.append(li);
 }
 renderRecents(projects);
}
function renderRecents(projects){
 const list=$('recents');list.replaceChildren();
 if(!projects.length){list.append(el('li','empty','Your projects will show up here.'));return}
 for(const p of projects.slice(0,14)){
  const li=document.createElement('li'),b=document.createElement('button');
  li.dataset.id=p.id;if(p.published)li.classList.add('live');if(state.project&&state.project.id===p.id)li.classList.add('active');
  b.type='button';b.append(el('i','diamond'),el('span',null,p.name));b.title=p.name;b.onclick=()=>openProject(p.id);
  li.append(b);list.append(li);
 }
}
function markRecent(id){for(const li of $('recents').children)li.classList.toggle('active',li.dataset.id===id)}
function homeTab(which){
 state.homeTab=which;
 $('tab-projects').setAttribute('aria-selected',String(which==='projects'));$('tab-templates').setAttribute('aria-selected',String(which==='templates'));
 $('projects').classList.toggle('hidden',which!=='projects');$('home-templates').classList.toggle('hidden',which!=='templates');
 if(!$('home').classList.contains('hidden')){$('side-projects').toggleAttribute('aria-current',which==='projects');$('side-templates').toggleAttribute('aria-current',which==='templates')}
}
$('tab-projects').onclick=()=>homeTab('projects');$('tab-templates').onclick=()=>homeTab('templates');
$('new-template').onclick=()=>{homeTab('templates');$('browser').scrollIntoView({behavior:'smooth',block:'start'})};
$('side-new').onclick=async()=>{if($('home').classList.contains('hidden'))await loadHome();else homeTab('projects');$('home').scrollTo({top:0,behavior:'smooth'});$('new-prompt').focus()};
$('side-projects').onclick=async()=>{if($('home').classList.contains('hidden'))await loadHome();homeTab('projects');$('browser').scrollIntoView({behavior:'smooth',block:'start'})};
$('side-templates').onclick=async()=>{if($('home').classList.contains('hidden'))await loadHome();homeTab('templates');$('browser').scrollIntoView({behavior:'smooth',block:'start'})};
$('side-docs').onclick=()=>window.open('https://github.com/HQTravellez/Kairoq/blob/main/docs/create.md','_blank','noopener');
$('side-toggle').onclick=()=>document.body.classList.toggle('side-open');$('side-open-btn').onclick=()=>document.body.classList.toggle('side-open');
$('side').addEventListener('click',e=>{if(window.innerWidth<=820&&e.target.closest('button'))document.body.classList.remove('side-open')});
for(const b of document.querySelectorAll('.example'))b.onclick=()=>{$('new-prompt').value=b.textContent;$('new-prompt').focus()};
$('new-form').onsubmit=async e=>{
 e.preventDefault();text($('home-error'),'');$('new-submit').disabled=true;
 try{
  const prompt=$('new-prompt').value.trim();
  const {project,job}=await api('/projects',{method:'POST',body:{prompt}});
  $('new-prompt').value='';
  await openProject(project.id,{pendingText:prompt,job});
 }catch(err){text($('home-error'),err.message)}
 finally{$('new-submit').disabled=false}
};

// ---------- editor ----------
async function openProject(id,{pendingText,job}={}){
 const {project,account}=await api('/projects/'+id);
 state.project=project;
 if(account)renderCredits(account);
 show('editor');history.replaceState(null,'','/create?project='+id);
 applyRole();
 $('project-name').value=project.name;
 if(!state.projects)api('/projects').then(r=>renderRecents(r.projects)).catch(()=>{});else markRecent(id);
 renderTiers();setChatMode(state.mode);
 renderMessages(pendingText);
 renderVersions();
 device(Boolean(project.mobile&&project.mobile.enabled));
 setPreview(project.preview_url);
 if(state.code)await renderFiles();
 if(state.data)await renderData();
 if(job)watch(job);
}
function renderMessages(pendingText){
 const list=$('messages');list.replaceChildren();
 const msgs=state.project.messages;
 if(!msgs.length&&!pendingText){const li=document.createElement('li');li.className='assistant';li.textContent='Tell me what to build or change. Switch to Discuss to plan without changing code.';list.append(li)}
 msgs.forEach((m,i)=>list.append(messageItem(m,i===msgs.length-1,i)));
 if(pendingText)list.append(messageItem({role:'user',text:pendingText}));
 list.scrollTop=list.scrollHeight;
 renderErrors();
}
function messageItem(m,last,index){
 const li=document.createElement('li');li.className=m.role+(m.mode==='discuss'?' discuss':'')+(m.failed?' failed':'');
 const tl=m.timeline||[];
 if(m.role==='assistant'&&index!=null){
  // Like Lovable: "Thought for Ns", the answer (formatted), then what was done, folded.
  const think=tl.find(e=>e.t==='think');
  const thoughtMs=m.thought_ms!=null?m.thought_ms:think?think.ms:null;
  if(thoughtMs!=null){const b=el('button','status-line done');b.type='button';b.append(el('span','status-text','Thought for '+secs(thoughtMs)),icon('chev'));b.onclick=()=>openDetail(index,'timeline');li.append(b)}
  li.append(renderMarkdown(m.text));
  const acts=tl.filter(e=>e.t!=='think'&&e.t!=='plan');
  if(acts.length){
   const d=el('details','acts'),s=el('summary');s.append(icon('down','toggle'),el('span',null,summarize(tl)||acts.length+' steps'));
   d.append(s,rail(acts.slice(0,30),{}));li.append(d);
  }
 }else{const body=el('div','msg-text');body.textContent=m.text;li.append(body)}
 if(m.images&&m.images.length){const s=document.createElement('span');s.className='changed';s.textContent='Images: '+m.images.join(', ');li.append(s)}
 if(m.design){const d=document.createElement('div');d.className='design-chip';for(const c of Object.values(m.design.palette||{}).slice(0,6)){const i=document.createElement('i');i.style.background=c;d.append(i)}d.append(document.createTextNode('Design: '+m.design.name+(m.design.fonts?' · '+m.design.fonts.display+' / '+m.design.fonts.body:'')));li.append(d)}
 if(m.generated&&m.generated.length&&state.project){const g=document.createElement('div');g.className='generated';for(const n of m.generated){const img=document.createElement('img');img.alt=n;img.title='./uploads/'+n;img.loading='lazy';img.src='/api/create/projects/'+state.project.id+'/asset?name='+encodeURIComponent(n);g.append(img)}li.append(g)}
 if(m.role==='assistant'&&m.scope&&m.scope.length){const d=el('div','scope-chip');d.append(icon('note'),el('span',null,'Also changed '+m.scope.map(f=>f.area).join(' and ')+' ('+[...new Set(m.scope.flatMap(f=>f.files))].slice(0,4).join(', ')+'), which you did not ask about. If that was not intended, undo this version.'));li.append(d)}
 if(m.role==='assistant'&&m.memory){const bits=[...(m.memory.recipes||[]).map(t=>'Used your recipe: '+t),...(m.memory.recalled?['Looked at your project “'+m.memory.recalled+'”']:[]),...(m.memory.learned||[]).map(t=>'Remembered: '+t)];if(bits.length){const d=el('div','memory-chip');d.append(icon('think'),el('span',null,bits.join(' · ')));d.title='Open Memory to see or change this';d.onclick=()=>openMemory();li.append(d)}}
 if(m.role==='assistant'&&Array.isArray(m.sources)&&m.sources.length){const s=el('div','sources');s.append(el('span','sources-label','Sources'));for(const src of m.sources.slice(0,8)){const a=el('a','source',src.title&&src.title!==src.url?src.title.slice(0,60):src.url.replace(/^https?:\/\/(www\.)?/,'').slice(0,60));a.href=src.url;a.target='_blank';a.rel='noopener noreferrer';a.title=src.url;s.append(a)}li.append(s)}
 if(m.role==='assistant'&&!tl.length&&m.changed&&m.changed.length){const c=el('div','file-chips done');for(const f of m.changed.slice(0,12))c.append(fileChip(f));if(m.changed.length>12)c.append(el('span','chip more','+'+(m.changed.length-12)+' more'));li.append(c)}
 if(m.role==='assistant'&&(m.version||m.credits!=null)&&index!=null){
  const f=el('div','msg-meta');
  if(m.version)f.append(el('span','ver','v'+m.version));
  if(m.duration_ms!=null){const t=el('span');t.append(icon('clock'),secs(m.duration_ms));f.append(t)}
  if(m.credits!=null){const t=el('span');t.append(icon('coin'),m.on_us?'on us':String(m.credits));f.append(t)}
  if(m.attempts>1)f.append(el('span',null,'Fixed '+(m.attempts-1)+' problem'+(m.attempts>2?'s':'')));
  const det=el('button','link-btn details-link','Details');det.type='button';det.onclick=()=>openDetail(index,'timeline');f.append(det);
  li.append(f);
 }
 if(m.checks&&!tl.some(e=>e.t==='check')){const c=document.createElement('div');c.className='check-chip '+(m.checks.failed.length?'bad':'ok');c.textContent=m.checks.failed.length?'✗ Broke '+m.checks.failed.length+' of '+m.checks.ran+' saved checks: '+m.checks.failed.join(', '):'✓ All '+m.checks.ran+' saved check'+(m.checks.ran===1?'':'s')+' passed';li.append(c)}
 if(m.steps&&m.steps.length&&!tl.length){const d=document.createElement('details'),s=document.createElement('summary');s.textContent='Agent steps ('+m.steps.length+')';const ol=document.createElement('ol');ol.className='agent-steps';for(const st of m.steps){const li2=document.createElement('li');li2.textContent=st;ol.append(li2)}d.append(s,ol);li.append(d)}
 if(m.role==='assistant'&&m.mode==='discuss'&&last){const b=document.createElement('button');b.type='button';b.className='ghost small-btn';b.textContent='Implement this plan';b.onclick=()=>{setChatMode('build');send('Implement the plan you just described.','build')};li.append(b)}
 return li;
}
function renderVersions(){
 const sel=$('versions');sel.replaceChildren();
 for(const v of [...state.project.versions].reverse()){const o=document.createElement('option');o.value=v.n;o.textContent='v'+v.n+' · '+(v.summary||'').slice(0,40);if(v.n===state.project.current_version)o.selected=true;sel.append(o)}
}
function previewFor(n){return state.project.preview_url.replace(/\/v\/\d+\/$/,'/v/'+n+'/')}
function setPreview(url){if(!url)return;state.runtimeErrors=[];renderErrors();state.selected=null;renderVisual();$('frame').src=url;$('open').href=url;$('preview-open').href=url;watchPreview()}
// The preview reports "ready" once it has rendered; when nothing arrives, say so instead of showing a blank frame.
function watchPreview(){state.previewReady=false;$('preview-notice').classList.add('hidden');clearTimeout(state.previewTimer);state.previewTimer=setTimeout(()=>{if(!state.previewReady&&!$('frame').classList.contains('hidden'))$('preview-notice').classList.remove('hidden')},9000)}
$('preview-reload').onclick=()=>{const f=$('frame');const u=f.src;f.src='about:blank';setTimeout(()=>{f.src=u;watchPreview()},50)};
$('versions').onchange=()=>setPreview(previewFor($('versions').value));
$('restore').onclick=async()=>{
 const n=Number($('versions').value);if(n===state.project.current_version)return;
 const {project}=await api('/projects/'+state.project.id+'/restore',{method:'POST',body:{version:n}});
 state.project=project;renderMessages();renderVersions();setPreview(project.preview_url);
};
$('back').onclick=()=>{closeDetail();state.project=null;loadHome()};
$('project-name').onchange=async()=>{try{const {project}=await api('/projects/'+state.project.id,{method:'PATCH',body:{name:$('project-name').value}});state.project.name=project.name}catch{}};
function device(mobile){$('canvas').classList.toggle('mobile',mobile);$('desktop').setAttribute('aria-pressed',String(!mobile));$('mobile').setAttribute('aria-pressed',String(mobile))}
$('desktop').onclick=()=>device(false);$('mobile').onclick=()=>device(true);
$('refresh').onclick=()=>{const f=$('frame');if(f.src){const u=f.src;f.src='about:blank';setTimeout(()=>setPreview(u),30)}};
$('share-open').onclick=()=>$('team-open').click();
function view(mode){
 state.code=mode==='code';state.data=mode==='data';
 for(const m of ['preview','code','data'])$('view-'+m).setAttribute('aria-pressed',String(m===mode));
 $('frame').classList.toggle('hidden',mode!=='preview');$('code').classList.toggle('hidden',mode!=='code');$('data').classList.toggle('hidden',mode!=='data');
 if(mode==='code')renderFiles();
 if(mode==='data')renderData();
}
$('view-preview').onclick=()=>view('preview');$('view-code').onclick=()=>view('code');$('view-data').onclick=()=>view('data');
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
 const users=$('users');users.replaceChildren();
 for(const u of d.users){const li=document.createElement('li');li.textContent=u.email+' · '+when(u.created_at);users.append(li)}
 const records=$('records');records.replaceChildren();
 text($('records-title'),state.collection?'Records in '+state.collection:'Records');
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
async function renderFiles(){
 const list=$('file-list');list.replaceChildren();
 const files=state.project.files;
 if(!files.includes(state.file))state.file=files.includes('src/App.jsx')?'src/App.jsx':files[0];
 for(const f of files){const li=document.createElement('li'),b=document.createElement('button');b.type='button';b.textContent=f;b.setAttribute('aria-current',String(f===state.file));b.onclick=()=>{state.file=f;renderFiles()};li.append(b);list.append(li)}
 if(state.file){const {content}=await api('/projects/'+state.project.id+'/file?path='+encodeURIComponent(state.file));text($('file-view').firstChild,content)}
}

// ---------- chat ----------
state.mode='build';state.tier='standard';state.attachments=[];state.runtimeErrors=[];
$('chat-input').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('chat-form').requestSubmit()}});
const PLACEHOLDERS={build:'Ask for a change, or paste a link: "add a pricing section like https://…"',discuss:'Ask a question, plan a feature, or ask me to look something up on the web. No code changes.',agent:'Give the agent a bigger task: "add room booking with availability, test the whole flow and fix any errors". It can open websites and read docs on the way.'};
function setChatMode(mode){if(!PLACEHOLDERS[mode])mode='build';state.mode=mode;for(const m of ['build','discuss','agent'])$('mode-'+m).setAttribute('aria-pressed',String(mode===m));$('chat-input').placeholder=PLACEHOLDERS[mode];$('send').setAttribute('aria-label',mode==='discuss'?'Ask':mode==='agent'?'Start':'Send');$('send').title=$('send').getAttribute('aria-label');costHint()}
$('mode-build').onclick=()=>setChatMode('build');$('mode-discuss').onclick=()=>setChatMode('discuss');$('mode-agent').onclick=()=>setChatMode('agent');
function renderTiers(){
 const sel=$('tier');sel.replaceChildren();
 for(const t of state.me.tiers||[]){const o=document.createElement('option');o.value=t.id;o.disabled=!t.enabled;o.textContent=t.label+(t.enabled?'':' (off)');o.title=t.credits+' credit'+(t.credits===1?'':'s')+' per message';if(t.id===state.tier)o.selected=true;sel.append(o)}
 costHint();
}
$('tier').onchange=()=>{state.tier=$('tier').value;costHint()};
function costHint(){
 const base='Screenshot the app on desktop and phone and let the AI fix what looks off';
 if(!state.me||!state.me.viewer||state.me.viewer.kind!=='customer'){text($('cost-hint'),'');$('polish').title=base;return}
 const t=(state.me.tiers||[]).find(x=>x.id===state.tier);
 const p=Math.max(t?t.credits:1,state.me.polish_credits||1);$('polish').title=base+' ('+p+' credit'+(p===1?'':'s')+')';
 const n=(state.mode==='discuss'?(state.tier==='standard'||!t?state.me.discuss_credits:Math.max(t.credits,state.me.discuss_credits)):(t?t.credits:1)*(state.mode==='agent'?state.me.agent_multiplier||3:1))+(state.attachments.length?state.me.image_credits:0);
 text($('cost-hint'),n+' credit'+(n===1?'':'s'));
}
// Attachments: button, paste or drop.
$('attach').onclick=()=>$('attach-input').click();
$('attach-input').onchange=()=>{addFiles($('attach-input').files);$('attach-input').value=''};
$('chat-input').addEventListener('paste',e=>{const files=[...(e.clipboardData?.files||[])].filter(f=>f.type.startsWith('image/'));if(files.length){e.preventDefault();addFiles(files)}});
$('chat-form').addEventListener('dragover',e=>e.preventDefault());
$('chat-form').addEventListener('drop',e=>{e.preventDefault();addFiles(e.dataTransfer.files)});
async function addFiles(files){
 text($('chat-error'),'');
 for(const f of [...files]){
  if(state.attachments.length>=4){text($('chat-error'),'Attach up to 4 images.');break}
  if(!/^image\/(png|jpeg|webp|gif)$/.test(f.type)){text($('chat-error'),f.name+': use PNG, JPEG, WebP or GIF.');continue}
  if(f.size>3*1024*1024){text($('chat-error'),f.name+' is larger than 3 MB.');continue}
  const dataUrl=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f)});
  state.attachments.push({name:f.name||'pasted.png',dataUrl});
 }
 renderAttachments();
}
function renderAttachments(){
 const wrap=$('attachments');wrap.replaceChildren();
 state.attachments.forEach((a,i)=>{const fig=document.createElement('figure');const img=document.createElement('img');img.src=a.dataUrl;img.alt=a.name;const x=document.createElement('button');x.type='button';x.textContent='×';x.setAttribute('aria-label','Remove '+a.name);x.onclick=()=>{state.attachments.splice(i,1);renderAttachments()};fig.append(img,x);wrap.append(fig)});
 wrap.classList.toggle('hidden',!state.attachments.length);costHint();
}
$('chat-form').onsubmit=e=>{e.preventDefault();const message=$('chat-input').value.trim();if(message)send(message,state.mode)};
async function send(message,mode,path='/chat',extra={}){
 if(state.job)return;
 text($('chat-error'),'');
 const images=state.attachments.map(a=>({name:a.name,dataUrl:a.dataUrl}));
 $('messages').append(messageItem({role:'user',text:message,mode,images:images.map(i=>i.name)}));$('messages').scrollTop=$('messages').scrollHeight;
 $('chat-input').value='';state.attachments=[];renderAttachments();
 try{const {job}=await api('/projects/'+state.project.id+path,{method:'POST',body:{message,mode,tier:state.tier,images:images.length?images:undefined,...extra}});watch(job)}
 catch(err){
  $('messages').append(messageItem({role:'assistant',text:err.message,failed:true}));
  if(err.status===402&&state.me.purchases)openBuy();
 }
}
const LABELS={researching:'Looking things up on the web…',pitching:'Writing the pitch and launch posts…',watching:'Running the growth watch…',reproducing:'Replaying what visitors did to confirm the problems…',retesting:'Replaying the same steps on the new version…',locking:'Saving checks so fixed problems cannot come back…',personas:'Creating synthetic customers…',visiting:'Synthetic customers are using your app…',reporting:'Writing the report…',queued:'Starting…',working:'Working…',thinking:'Thinking…',designing:'Choosing the design direction…',images:'Generating images…',reviewing:'Reviewing the design on desktop and phone…',checking:'Re-running your saved checks…',writing:'Writing code…',fixing:'Fixing a problem and retrying…',building:'Building preview…',testing:'Testing the app in a browser…',analyzing:'Studying the reference in a browser…',planning:'Writing the feature inventory and build plan…',assets:'Finding openly licensed images and assets…',verifying:'Testing the user journeys on desktop and phone…',repairing:'Repairing the journeys that failed…',comparing:'Comparing the design with the reference…',publishing:'Publishing and checking the live app…'};
// ---------- the AI at work: activity rail, Details panel (Timeline / Changes) ----------
const PHASES={queued:'Getting started',thinking:'Thinking',designing:'Choosing a design direction',writing:'Writing code',fixing:'Fixing a problem',images:'Generating images',building:'Building the preview',testing:'Testing in a browser',checking:'Re-running saved checks',reviewing:'Reviewing the design',working:'Working',analyzing:'Studying the reference',planning:'Writing the plan',assets:'Finding licensed images',verifying:'Testing user journeys',repairing:'Repairing failed journeys',comparing:'Comparing with the reference',publishing:'Publishing'};
const work={started:0,timer:null,job:null,files:[],current:null,message:'',tail:'',thinking:''};
function el(tag,cls,txt){const e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e}
function secs(ms){const s=Math.max(0,Math.round(ms/1000));return s<60?s+'s':Math.floor(s/60)+'m '+String(s%60).padStart(2,'0')+'s'}
function phaseOf(j){if(j.mode==='discuss')return'thinking';if(j.status==='queued'||(j.status==='writing'&&!(j.stream&&j.stream.chars)))return'thinking';return j.status}
const ICONS={think:'<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z"/>',plan:'<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',read:'<path d="M4 19.5V5a2 2 0 0 1 2-2h8l6 6v10.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.5z"/><path d="M14 3v6h6"/>',edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',build:'<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',test:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 6.5h.01M10 6.5h.01"/>',check:'<path d="M20 6 9 17l-5-5"/>',fix:'<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',note:'<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',design:'<circle cx="13.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="10.5" r="1.5"/><circle cx="8.5" cy="7.5" r="1.5"/><path d="M12 2a10 10 0 0 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4A5.6 5.6 0 0 0 22 9.8C22 5.5 17.5 2 12 2z"/>',image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',db:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',web:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',logs:'<path d="M4 17l6-6-6-6M12 19h8"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',coin:'<circle cx="12" cy="12" r="9"/><path d="M14.5 9.5a2.5 2 0 0 0-2.5-1.5c-1.4 0-2.5.8-2.5 1.9 0 2.6 5 1.4 5 4.2 0 1.1-1.1 1.9-2.5 1.9a2.5 2 0 0 1-2.5-1.5M12 6.5V8M12 16v1.5"/>',back:'<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',chev:'<path d="m9 6 6 6-6 6"/>',down:'<path d="m6 9 6 6 6-6"/>'};
function icon(name,cls){const s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('viewBox','0 0 24 24');s.setAttribute('class','ico'+(cls?' '+cls:''));s.setAttribute('aria-hidden','true');s.innerHTML=ICONS[name]||ICONS.note;return s}
function fileChip(name,active){const c=el('code','chip'+(active?' active':''),name.replace(/^src\//,''));c.title=name;return c}
// Tiny, safe Markdown: headings, lists, bold, inline code, paragraphs (text only, no HTML).
function inlineMd(parent,textIn){const re=/(\*\*[^*]+\*\*|`[^`]+`)/g;let last=0,m;while((m=re.exec(textIn))){if(m.index>last)parent.append(textIn.slice(last,m.index));const t=m[0];parent.append(t.startsWith('**')?el('strong',null,t.slice(2,-2)):el('code','inline',t.slice(1,-1)));last=m.index+t.length}if(last<textIn.length)parent.append(textIn.slice(last))}
function renderMarkdown(src){
 const root=el('div','md'),lines=String(src||'').replace(/\r/g,'').split('\n');let para=[],stack=[];
 const flush=()=>{if(para.length){const p=el('p');inlineMd(p,para.join(' '));root.append(p);para=[]}};
 const closeLists=()=>{stack=[]};
 for(const raw of lines){
  const line=raw.replace(/\s+$/,'');
  const h=/^(#{1,4})\s+(.*)$/.exec(line),li=/^(\s*)([-*•]|\d+[.)])\s+(.*)$/.exec(line);
  if(!line.trim()){flush();closeLists();continue}
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
 flush();return root;
}
// One row of the activity rail. Rows with more detail expand in place.
function editVerb(k){return k==='created'?'Created':k==='deleted'?'Deleted':'Edited'}
function eventRow(e,{expand=false,version=null,live=false}={}){
 const row=el('li','ev ev-'+e.t+(e.ok===false?' bad':''));
 const name=e.t==='note'?(e.icon||'note'):e.t;row.append(icon(name));
 const main=el('div','ev-main'),head=el('div','ev-head');main.append(head);row.append(main);
 let more=null;
 if(e.t==='think'){
  if(e.title){const t=el('div','ev-title');inlineMd(t,e.title);main.insertBefore(t,head)}
  head.append(el('span','ev-label',live&&e.live?'Thinking…':'Thought for '+secs(e.ms||0)));
  if(e.text)more=()=>el('p','ev-thought',e.text);
 }else if(e.t==='plan'){head.append(el('span','ev-label','Plan'));const ol=el('ol','ev-plan');for(const it of e.items||[]){const x=el('li');inlineMd(x,it);ol.append(x)}main.append(ol)}
 else if(e.t==='read'){head.append(el('span','ev-label','Read'));for(const f of e.files||[])head.append(fileChip(f))}
 else if(e.t==='edit'){head.append(el('span','ev-label',editVerb(e.kind)),fileChip(e.file,live&&e.file===work.current));if(version&&expand)more=()=>diffFor(version,e.file)}
 else if(e.t==='build'){head.append(el('span','ev-label',e.ok?'Built the preview':'The build failed'));if(e.detail)more=()=>el('pre','ev-detail',e.detail)}
 else if(e.t==='test'){head.append(el('span','ev-label',(e.text||'Tested in a browser')+(e.ok?' · no errors':' · found problems')));if(e.detail)more=()=>el('pre','ev-detail',e.detail)}
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
function workCard(){
 let li=$('stream');
 if(!li){
  li=el('li','assistant work');li.id='stream';
  const status=el('button','status-line');status.type='button';status.append(el('span','status-text','Thinking'),icon('chev'));status.onclick=()=>openDetail('live');
  const head=el('div','work-head');head.append(status,el('span','work-time'));const stop=el('button','ghost work-stop','Stop');stop.type='button';stop.onclick=()=>$('stop-job').click();head.append(stop);
  li.append(head,el('ol','rail live'),el('div','work-msg hidden'));
  $('messages').append(li);$('messages').scrollTop=$('messages').scrollHeight;
 }
 return li;
}
function liveStatus(j){
 const p=phaseOf(j);
 if(j.mode==='agent'&&j.agent&&j.agent.step){const last=(j.events||[]).at(-1);return'Step '+j.agent.step+' · '+(p==='thinking'?'Thinking':last&&last.t==='edit'?'Editing '+last.file.replace(/^src\//,''):PHASES[p]||'Working')}
 if(p==='writing'&&work.current)return'Writing '+work.current.replace(/^src\//,'');
 return PHASES[p]||'Working';
}
function liveEvents(j){
 const ev=(j.events||[]).slice();
 // The current thinking, before the model has answered.
 if(phaseOf(j)==='thinking'&&j.mode!=='discuss')ev.push({t:'think',live:true,ms:Date.now()-work.started,text:work.thinking});
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
 if(st&&st.message)work.message=st.message;
 if(st&&st.tail)work.tail=st.tail;
 if(j.thinking)work.thinking=j.thinking;
 text(li.querySelector('.status-text'),liveStatus(j));
 const r=li.querySelector('.rail.live');r.replaceChildren();
 for(const e of liveEvents(j).filter(e=>e.t!=='plan').slice(-6))r.append(eventRow(e,{live:true}));
 const msg=li.querySelector('.work-msg');
 const said=j.mode==='discuss'?(st&&st.text)||'':j.mode==='agent'&&j.agent&&j.agent.steps.length?'':work.message;
 msg.classList.toggle('hidden',!said);text(msg,said);
 if(detailState.source==='live')renderDetail();
 if(stick)list.scrollTop=list.scrollHeight;
}
function tickWork(){const li=$('stream');if(!li)return;text(li.querySelector('.work-time'),secs(Date.now()-work.started));if(work.job&&phaseOf(work.job)==='thinking'){const r=li.querySelector('.rail.live .ev-think:last-child .ev-label');if(r)text(r,'Thinking…')}if(detailState.source==='live')renderDetail()}
// ---------- the Details panel (over the preview) ----------
const detailState={source:null,tab:'timeline'};
function openDetail(source,tab){detailState.source=source;if(tab)detailState.tab=tab;$('detail').classList.remove('hidden');document.querySelector('.stage').classList.add('show-detail');renderDetail()}
function closeDetail(){detailState.source=null;$('detail').classList.add('hidden');document.querySelector('.stage').classList.remove('show-detail')}
$('detail-close').onclick=closeDetail;
document.querySelector('.stage-bar').addEventListener('click',e=>{if(detailState.source!==null&&e.target.closest('button,a'))closeDetail()});
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
 state.job=job;busy(true,LABELS[job.status]);refreshCredits();
 const id=state.project.id;
 Object.assign(work,{started:Date.now(),files:[],current:null,message:'',tail:'',thinking:''});if(detailState.source!==null)closeDetail();
 clearInterval(work.timer);work.timer=setInterval(tickWork,1000);
 const done=await new Promise(resolve=>{
  let finished=false;
  const finish=j=>{if(!finished){finished=true;resolve(j)}};
  const apply=j=>{text($('progress-text'),(j.mode==='agent'&&j.agent&&j.agent.step?'Step '+j.agent.step+' · ':'')+(j.progress||LABELS[j.status]||'Working…'));if(j.status!=='complete'&&j.status!=='failed')renderWork(j);if(j.status==='complete'||j.status==='failed')finish(j)};
  if(window.EventSource){
   const es=new EventSource('/api/create/jobs/'+job.id+'/events');
   es.onmessage=e=>{const j=JSON.parse(e.data);apply(j);if(j.status==='complete'||j.status==='failed')es.close()};
   es.onerror=()=>{es.close();poll()};
  }else poll();
  async function poll(){
   while(!finished){
    await new Promise(r=>setTimeout(r,1000));
    try{apply((await api('/jobs/'+job.id)).job)}catch(err){text($('chat-error'),err.message);finish(null)}
   }
  }
 });
 clearInterval(work.timer);
 const wasLive=detailState.source==='live';
 $('stream')?.remove();
 if(done&&state.project&&state.project.id===id){
  const {project,account}=await api('/projects/'+id);
  state.project=project;if(account)renderCredits(account);
  state.runtimeErrors=[];
  renderMessages();renderVersions();
  if(wasLive){const k=state.project.messages.length-1;if(k>=0&&state.project.messages[k].role==='assistant')openDetail(k);else closeDetail()}
  if(done.mode!=='discuss')setPreview(project.preview_url);
  if(done.problem)$('messages').append(messageItem({role:'assistant',text:(done.problem==='checks'?'This change still breaks a saved check. Use Fix it or describe the problem.':'This change still shows errors in the browser. Use Fix it to repair them.')+(done.free?' '+done.free:'')+(done.fix_on_us?' The fix is on us: the next Fix costs nothing.':'')}));
  else if(done.free)$('messages').append(messageItem({role:'assistant',text:done.free}));
  if(done.result&&done.result.polish_error)$('messages').append(messageItem({role:'assistant',text:done.result.polish_error}));
  if(done.result&&done.result.reference&&done.mode==='agent')$('messages').append(messageItem({role:'assistant',text:referenceReport(done.result.reference)}));
  if(done.status==='failed')$('messages').append(messageItem({role:'assistant',text:done.error+(done.credits&&state.me.viewer.kind==='customer'?(done.mode==='repair'?'\nRounds that did not finish were refunded.':'\nYour credits were refunded.'):''),failed:true}));
  if(state.code)renderFiles();
  if(state.data)renderData();
 }
 state.job=null;busy(false);
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
 text($('mobile-install-note'),d.url&&!d.installable?'Installing works on the app\'s own subdomain or custom domain (set KAIROQ_SITES_DOMAIN or add a domain in Publish). The /sites/ link opens as a normal web page.':'');
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
$('figma-open').onclick=async()=>{
 text($('figma-error'),'');
 const owner=state.project.role==='owner'||!state.project.role;
 $('figma-save').closest('label').classList.toggle('hidden',!owner);
 text($('figma-cost'),'Builds with the '+(state.mode==='agent'?'Agent':'Build')+' mode and the tier selected in the chat.');
 try{const {token_saved}=await api('/projects/'+state.project.id+'/figma');text($('figma-token-status'),token_saved?'(saved; leave empty to reuse)':'')}catch{}
 $('figma-dialog').showModal();
};
$('figma-import').onclick=async()=>{
 if(state.job)return;
 text($('figma-error'),'');
 const url=$('figma-url').value.trim();if(!url){text($('figma-error'),'Paste the frame link.');return}
 $('figma-import').disabled=true;
 try{
  const r=await api('/projects/'+state.project.id+'/figma',{method:'POST',body:{url,token:$('figma-token').value.trim()||undefined,save_token:$('figma-save').checked,message:$('figma-message').value.trim(),mode:state.mode==='agent'?'agent':'build',tier:state.tier}});
  $('figma-dialog').close();$('figma-token').value='';
  $('messages').append(messageItem({role:'user',text:'Import from Figma: '+r.frame.name+(r.frame.images.length?' ('+r.frame.images.length+' images)':'')}));
  watch(r.job);
 }catch(err){text($('figma-error'),err.message);if(err.status===402&&state.me.purchases)openBuy()}
 finally{$('figma-import').disabled=false}
};
// ---------- build from a reference ----------
const refState={plan:null,info:null};
function referenceReport(r){
 const L=['Build from reference: finished.'];
 if(r.last_run){const d=r.last_run.desktop,p=r.last_run.phone;L.push('Journeys: '+d.passed+'/'+d.ran+' pass on desktop, '+p.passed+'/'+p.ran+' on phone'+(r.repairs?' after '+r.repairs+' repair round'+(r.repairs>1?'s':''):'')+'.');for(const f of r.last_run.failed||[])L.push('• Still failing: '+f.name+(f.step?' (at '+f.step+')':'')+(f.error?': '+f.error:''))}
 else if(!r.checks.length)L.push('No journeys were tested (the browser is not available or the plan had none).');
 if(r.design)L.push('Design compared with the reference: '+r.design.score+'/10'+(r.polished?', then polished.':'.')+(r.design.improvements.length&&!r.polished?' Ideas: '+r.design.improvements.slice(0,3).join('; '):''));
 if(r.published)L.push((r.published.ok?'Published and verified: ':'Published, but the live check found problems: ')+r.published.url+(r.published.errors.length?' ('+r.published.errors.join('; ')+')':''));
 if(r.github)L.push('Pushed to GitHub: '+(r.github.url||r.github.repo)+(r.github.warning?' ('+r.github.warning+')':''));
 for(const p of r.problems||[])L.push('• '+p);
 return L.join('\n');
}
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
 }catch(err){text($('ref-error'),err.message);if(err.status===402&&state.me.purchases)openBuy()}
 finally{$('ref-analyze').disabled=false}
};
$('ref-build').onclick=async()=>{
 if(state.job)return;
 text($('ref-error'),'');
 let plan;try{plan=JSON.parse($('ref-plan').value)}catch{text($('ref-error'),'The plan JSON is not valid. Fix it or reopen the dialog.');return}
 $('ref-build').disabled=true;
 try{
  const github=$('ref-github').checked?{repo:$('ref-github-repo').value.trim()||undefined}:undefined;
  const r=await api('/projects/'+state.project.id+'/reference',{method:'POST',body:{step:'build',plan,tier:state.tier,publish:$('ref-publish').checked,github}});
  $('ref-dialog').close();
  $('messages').append(messageItem({role:'user',text:'Build "'+plan.name+'" from the approved plan'+($('ref-publish').checked?', then publish':'')}));
  watch(r.job);
 }catch(err){text($('ref-error'),err.message);if(err.status===402&&state.me.purchases)openBuy()}
 finally{$('ref-build').disabled=false}
};
$('stop-job').onclick=async()=>{if(!state.job)return;$('stop-job').disabled=true;try{await api('/jobs/'+state.job.id+'/cancel',{method:'POST'})}catch(err){text($('chat-error'),err.message)}finally{$('stop-job').disabled=false}};
function busy(on,label){$('progress').classList.toggle('hidden',!on);$('send').disabled=on;$('fix').disabled=on;if(label)text($('progress-text'),label)}
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
 note.classList.toggle('hidden',!h.price);note.classList.toggle('warn',Boolean(h.paused||h.failing_since));
 if(h.price){
  const until=h.paid_until?new Date(h.paid_until).toLocaleDateString([], {dateStyle:'medium'}):null,paid=h.paid_until&&Date.parse(h.paid_until)>Date.now()&&!h.paused;
  text(note,h.paused?'This site is paused: its monthly '+h.price+' credits could not be charged. Add credits and it comes back within the hour.':h.failing_since?'The monthly '+h.price+' credits could not be charged. Add credits soon: the site pauses '+h.grace_days+' days after the first try.':paid?'Live hosting is paid until '+until+'. It renews for '+h.price+' credits a month.':'Live hosting: '+h.price+' credits a month, charged when you publish.');
 }
 text($('publish').firstChild,p.published?'Update to current version (v'+p.current_version+')':'Publish current version');
 const links=$('live-links');links.replaceChildren();
 if(p.urls){
  const status=document.createElement('p');status.className='muted small';status.textContent='Live: version '+p.published.version+', published '+when(p.published.at);links.append(status);
  for(const u of [p.urls.path,p.urls.subdomain,...p.urls.domains].filter(Boolean)){const a=document.createElement('a');a.href=u;a.target='_blank';a.rel='noopener';a.textContent=u;links.append(a)}
 }
 const list=$('domains');list.replaceChildren();
 for(const d of p.domains){
  const li=document.createElement('li'),head=document.createElement('div');
  head.className='row';head.style.marginTop='0';
  const name=document.createElement('strong');name.textContent=d.hostname;name.style.flex='1';
  const badge=document.createElement('span');badge.className='badge'+(d.verified?' live':'');badge.textContent=d.verified?(d.https==='manual'?'Connected · add in Railway for HTTPS':d.https&&/VALID|ISSUED/i.test(d.https)?'Connected · HTTPS':'Connected'):'Waiting for DNS';
  head.append(name,badge);
  if(!d.verified){const b=document.createElement('button');b.type='button';b.className='ghost';b.textContent='Verify';b.onclick=()=>domainAction('/verify','POST',d.hostname);head.append(b)}
  const rm=document.createElement('button');rm.type='button';rm.className='ghost';rm.textContent='Remove';rm.onclick=()=>domainAction('/domains','DELETE',d.hostname);head.append(rm);
  li.append(head);
  if(d.railway_error){const p=document.createElement('p');p.className='error small';p.textContent='Automatic HTTPS setup failed: '+d.railway_error;li.append(p)}
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
 try{const {project,error}=await api('/projects/'+state.project.id+path,{method:'POST',body});state.project=project;renderPublish();if(error)text($('publish-error'),error)}
 catch(err){
  // Saved checks failed on the version going live: the owner decides.
  if(err.status===409&&err.data&&err.data.checks_failed&&confirm(err.message+'\n\nPublish anyway?'))return publishAction(path,{...body,force:true});
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
 renderSecrets().catch(err=>text($('settings-error'),err.message));
 $('download').href='/api/create/projects/'+state.project.id+'/download';
 try{
  const [{settings},gh]=await Promise.all([api('/projects/'+state.project.id+'/settings'),api('/projects/'+state.project.id+'/github')]);
  const st=settings.secrets;
  text($('stripe-key-status'),st.stripe_secret_key?'(saved '+st.stripe_secret_key.hint+')':'');
  text($('stripe-hook-status'),st.stripe_webhook_secret?'(saved '+st.stripe_webhook_secret.hint+')':'');
  text($('gh-token-status'),gh.token?'(saved '+gh.token.hint+')':gh.owner_fallback?'(using the server GITHUB_TOKEN)':'');
  text($('stripe-hook-url'),settings.stripe_webhook_url);text($('stripe-events'),settings.stripe_events.join(', '));
  text($('email-status'),settings.email?'Email is set up. Apps can notify you with email.send({to:"owner", …}).':'Email is not set up on this server yet (KAIROQ_RESEND_API_KEY and KAIROQ_EMAIL_FROM).');
  $('gh-repo').value=gh.github?.repo||'';
  if(gh.github?.last_push)text($('gh-status'),'Last push: version '+gh.github.last_push.version+' · '+when(gh.github.last_push.at));
  if(!settings.encryption)text($('settings-error'),'Saving keys needs APP_ENCRYPTION_KEY on the server.');
 }catch(err){text($('settings-error'),err.message)}
 $('settings-dialog').showModal();
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
 for(const t of state.templates){
  const b=document.createElement('button');b.type='button';
  b.append(Object.assign(document.createElement('span'),{className:'cat',textContent:t.category}),Object.assign(document.createElement('strong'),{textContent:t.name}),Object.assign(document.createElement('span'),{className:'desc',textContent:t.description}));
  b.onclick=()=>onPick(t.id);wrap.append(b);
 }
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
 renderTemplates($('landing-templates'),id=>{setPending({template:id});$('signup').scrollIntoView({behavior:'smooth'});$('email').focus()},id=>{setPending({sponsored:id});$('signup').scrollIntoView({behavior:'smooth'});$('email').focus()}).catch(()=>{});
 const wrap=$('landing-plans');wrap.replaceChildren();
 const per=(state.me.tiers||[]).map(t=>t.label+' '+t.credits+' credit'+(t.credits===1?'':'s')).join(', ');
 wrap.append(planCard('Free',(state.me.free_credits||0)+' credits',['Every feature included','Publish to a Kairoq URL','No card needed']));
 for(const p of state.me.plans||[])wrap.append(planCard(p.name,p.label||p.credits+' credits / month',[p.credits+' credits every month',...p.features]));
 for(const p of state.me.packs||[])wrap.append(planCard(p.name,p.label||p.credits+' credits',[p.credits+' credits, one-time','Never expire']));
 text($('pricing-note'),'Credits per message: '+per+(state.me.discuss_credits?'; Discuss '+state.me.discuss_credits:'')+'. Visual edits are free. If a change breaks your app, the next fix of that problem is on us. A request that fails before anything is saved is not charged.');
}
$('landing-form').onsubmit=e=>{e.preventDefault();setPending({prompt:$('landing-prompt').value.trim()});setMode('signup');$('signup').scrollIntoView({behavior:'smooth'});$('email').focus()};
for(const b of document.querySelectorAll('.hero-chip'))b.onclick=()=>{$('landing-prompt').value=b.textContent.trim();$('landing-prompt').focus()};
// Template gallery tabs: filter the cards by their category.
for(const t of document.querySelectorAll('.show-tabs .tab'))t.onclick=()=>{for(const x of document.querySelectorAll('.show-tabs .tab'))x.setAttribute('aria-pressed',String(x===t));const cat=t.dataset.cat||'';for(const card of $('landing-templates').children){const c=(card.dataset.cat||card.querySelector('.cat')?.textContent||'').toLowerCase();card.hidden=Boolean(cat)&&c!==cat}};
$('nav-signin').onclick=()=>{if($('auth').classList.contains('hidden')){location.href='/create#signup';return}setMode(state.me&&state.me.signups===false?'login':'login');$('signup').scrollIntoView({behavior:'smooth'});$('email').focus()};
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
 const items=document.querySelectorAll('.landing .section-head,.landing .steps li,.landing .tile,.landing .proof div,.landing .cmp-table,.landing .credits-how,.landing .cta-text,.landing .cta .auth-card');
 if(!reduce&&'IntersectionObserver' in window){
  const io=new IntersectionObserver(es=>{for(const e of es)if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}},{rootMargin:'0px 0px -6% 0px',threshold:0});
  for(const el of items){el.classList.add('rv');io.observe(el)}
 }
 for(const t of document.querySelectorAll('.landing .tile'))t.addEventListener('pointermove',e=>{const r=t.getBoundingClientRect();t.style.setProperty('--mx',(e.clientX-r.left)+'px');t.style.setProperty('--my',(e.clientY-r.top)+'px')});
})();
$('plans-open').onclick=()=>{
 text($('plans-error'),'');
 const account=state.me.viewer?.account||{};
 text($('plan-current'),account.plan?'Current plan: '+planName(account.plan)+' ('+(account.plan_status||'active')+')'+(account.plan_renews_at?' · renews '+when(account.plan_renews_at):''):'You are on the free plan.');
 const wrap=$('plans-list');wrap.replaceChildren();
 for(const p of state.me.plans||[]){
  const btn=Object.assign(document.createElement('button'),{type:'button',className:'primary',textContent:account.plan===p.id?'Current plan':'Choose '+p.name});
  btn.disabled=account.plan===p.id;
  btn.onclick=async()=>{btn.disabled=true;try{const {url}=await api('/subscribe',{method:'POST',body:{plan:p.id}});location.href=url}catch(err){text($('plans-error'),err.message);btn.disabled=false}};
  const card=planCard(p.name,p.label||p.credits+' credits / month',[p.credits+' credits every month',...p.features],btn);if(account.plan===p.id)card.classList.add('current');wrap.append(card);
 }
 $('billing').classList.toggle('hidden',!account.billing);
 $('plans-dialog').showModal();
};
$('billing').onclick=async()=>{try{const {url}=await api('/billing',{method:'POST'});location.href=url}catch(err){text($('plans-error'),err.message)}};

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
$('seo-save').onclick=async()=>{
 try{const {project}=await api('/projects/'+state.project.id+'/seo',{method:'POST',body:{title:$('seo-title').value,description:$('seo-description').value,image:$('seo-image').value}});state.project=project;text($('seo-status'),'Saved. Applies to the live site right away.')}
 catch(err){text($('seo-status'),err.message)}
};

// ---------- password reset, verification, Google ----------
$('forgot-open').onclick=()=>{$('forgot-form').classList.toggle('hidden');$('forgot-email').value=$('email').value;$('forgot-email').focus()};
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
 if(!secrets.length)list.append(Object.assign(document.createElement('li'),{className:'muted small',textContent:'No secrets yet.'}));
 for(const sec of secrets){
  const li=document.createElement('li'),row=document.createElement('div');row.className='row';row.style.marginTop='0';
  const name=Object.assign(document.createElement('code'),{textContent:sec.name});name.style.flex='1';
  const rm=Object.assign(document.createElement('button'),{type:'button',className:'ghost',textContent:'Delete'});
  rm.onclick=async()=>{await api('/projects/'+state.project.id+'/secrets',{method:'POST',body:{name:sec.name,value:null}});renderSecrets()};
  row.append(name,Object.assign(document.createElement('span'),{className:'muted small',textContent:sec.hint}),rm);li.append(row);list.append(li);
 }
}
$('secret-add').onclick=async()=>{
 text($('settings-error'),'');
 try{await api('/projects/'+state.project.id+'/secrets',{method:'POST',body:{name:$('secret-name').value,value:$('secret-value').value}});$('secret-name').value='';$('secret-value').value='';renderSecrets()}
 catch(err){text($('settings-error'),err.message)}
};
$('knowledge-save').onclick=async()=>{
 try{const {project}=await api('/projects/'+state.project.id+'/knowledge',{method:'POST',body:{text:$('knowledge').value}});state.project=project;text($('knowledge-status'),'Saved. The AI will follow this from the next message.')}
 catch(err){text($('knowledge-status'),err.message)}
};

// ---------- free website check ----------
const checkState={id:null,timer:null};
function openCheckForm(){
 show('check-screen');history.replaceState(null,'','/create');document.title='Website check · Kairoq Create';
 for(const x of ['check-running','check-report','check-failed'])$(x).classList.add('hidden');
 $('check-form').classList.remove('hidden');text($('check-error'),'');
 const acct=state.me&&state.me.viewer&&state.me.viewer.account;if(acct&&!$('check-email').value)$('check-email').value=acct.email;
 $('check-url').focus();
}
async function startCheck({url,email,goal},errEl,btn){
 text(errEl,'');btn.disabled=true;
 try{const r=await api('/site-check',{method:'POST',body:{url,email,goal}});history.pushState(null,'','/create/check/'+r.id);openCheck(r.id)}
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
 document.title=c.host+' website check · Kairoq Create';
 $('check-report').classList.remove('hidden');
 const sc=Math.max(0,Math.min(100,Number(c.score)||0)),ring=$('cr-ring'),C=2*Math.PI*52;
 ring.style.strokeDasharray=String(C);ring.style.strokeDashoffset=String(C*(1-sc/100));
 $('cr-score').className='cr-score '+(sc>=75?'good':sc>=50?'fair':'poor');text($('cr-score-n'),sc);
 text($('cr-host'),c.host);text($('cr-business'),c.business||'');text($('cr-goal'),String(c.goal||'').replace(/\.$/,''));
 const n=c.numbers||{};
 text($('cr-headline'),c.summary&&c.summary.headline?c.summary.headline:n.completed===n.visitors?'Every visitor managed it.':'Some visitors did not manage it.');
 text($('cr-numbers'),c.blocked?'The site\'s bot protection turned our AI customers away, so this score covers the technical basics only.':(n.completed||0)+' of '+((n.visitors||0)-(n.blocked||0))+' AI customers managed it'+(n.blocked?' ('+n.blocked+' blocked by bot protection)':'')+(n.by_device&&n.by_device.phone?' · on phones '+n.by_device.phone.completed+' of '+n.by_device.phone.visitors:'')+(n.median_steps?' · '+n.median_steps+' steps for those who did':''));
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
$('cr-again').onclick=openCheckForm;$('check-retry').onclick=openCheckForm;$('side-check').onclick=openCheckForm;
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
// Web agent: tasks on other websites, and watches that repeat them and email changes.
const webState={poll:null};
function webRunItem(r){
 const li=el('li'),t=el('div','skill-text');
 const said={completed:'Done',gave_up:'Could not do it',stuck:'Did not finish',blocked:'Blocked by the site',error:'Error'};
 t.append(el('b',null,r.task),el('span',null,(r.status==='needs_you'?'Needs you: '+(r.need||''):r.status==='running'?'Working… '+(r.progress||''):(said[r.outcome]||r.status)+' · '+when(r.at))+' · '+r.url));
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
  t.append(el('b',null,w.task),el('span',null,w.url+' · every '+w.every+(w.paused?' · paused':w.last?' · last checked '+when(w.last):' · first check within the hour')));
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
async function openAdmin(){text($('admin-error'),'');text($('learn-status'),'');$('admin-dialog').showModal();if(!state.templates)try{const r=await api('/templates');state.templates=r.templates;state.sponsored=r.sponsored||[]}catch{}try{renderPartnerAdmin((await api('/admin/partners')).partners)}catch(err){text($('admin-error'),err.message)}await renderAdmin()}
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
$('learn-run').onclick=async()=>{const b=$('learn-run');b.disabled=true;text($('learn-status'),'Looking at recent builds…');try{const r=await api('/learning',{method:'POST',body:{action:'run'}});text($('learn-status'),r.result.proposed.length?'Proposed '+r.result.proposed.length+' new rule'+(r.result.proposed.length===1?'':'s')+'.':'No new repeated problems found.');renderAdmin(r.learning)}catch(err){text($('learn-status'),err.message)}finally{b.disabled=false}};

async function start(){
 await handleLinks();
 const v=await loadMe();
 $('google-login').classList.toggle('hidden',!state.me.google);
 if(state.resetToken){show('auth');renderLanding();$('auth-form').classList.add('hidden');$('reset-form').classList.remove('hidden');$('signup').scrollIntoView();return}
 if(state.flash){text($('auth-error'),state.flash);text($('home-error'),state.flash);state.flash=null}
 const share=/^\/create\/share\/([a-f0-9]{24})\/?$/.exec(location.pathname);
 if(share)return openShare(share[1],v);
 const ck=/^\/create\/check\/([a-f0-9]{24})\/?$/.exec(location.pathname);
 if(ck){if(v)api('/projects').then(r=>renderRecents(r.projects)).catch(()=>{});return openCheck(ck[1])}
 if(!v){show('auth');setMode(state.me.signups?'signup':'login');$('tab-signup').classList.toggle('hidden',!state.me.signups);renderLanding();return}
 const pending=takePending();
 if(pending){
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
  const t=document.createElement('div');t.className='skill-text';const b=document.createElement('b');b.textContent=c.name;const sp=document.createElement('span');sp.textContent=c.steps.length+' step'+(c.steps.length===1?'':'s')+' · '+({agent:'saved by the agent',ai:'written by the AI',user:'added by you'}[c.source]||c.source)+(c.last?' · last run '+when(c.last.at)+(c.last.version?' on v'+c.last.version:''):'')+(c.last&&!c.last.ok?' · failed: '+(c.last.step?c.last.step+(c.last.error?' ('+c.last.error+')':''):c.last.error):'');t.append(b,sp);
  const act=document.createElement('div');act.className='skill-actions';
  const on=document.createElement('label'),cb=document.createElement('input');cb.type='checkbox';cb.checked=c.enabled!==false;cb.disabled=!editor;cb.onchange=async()=>{try{await api('/projects/'+state.project.id+'/checks',{method:'POST',body:{id:c.id,enabled:cb.checked}})}catch(err){text($('checks-error'),err.message)}};on.append(cb,document.createTextNode(' on'));act.append(on);
  if(editor){const del=document.createElement('button');del.type='button';del.className='ghost link-btn';del.textContent='Remove';del.onclick=async()=>{if(!confirm('Remove the check "'+c.name+'"?'))return;try{await api('/projects/'+state.project.id+'/checks',{method:'DELETE',body:{id:c.id}});renderChecks()}catch(err){text($('checks-error'),err.message)}};act.append(del)}
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
$('checks-run').onclick=async()=>{const btn=$('checks-run');btn.disabled=true;text($('checks-status'),'Running the checks on a test copy of your data…');text($('checks-error'),'');
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
 text($('design-intro'),d.design?'The AI follows this design in every change. Colours and fonts live in src/index.css, so saving here restyles the whole app at once.':'No design brief yet. One is created automatically with the first build of a new app, or describe a direction below.');
 $('design-missing').classList.toggle('hidden',d.has_tokens);
 $('design-name').value=ds.name||'';$('design-summary').value=ds.summary||'';$('design-notes').value=ds.notes||'';
 const pal=$('design-palette');pal.replaceChildren();
 for(const k of PALETTE_KEYS){const l=document.createElement('label'),inp=document.createElement('input');inp.type='color';inp.dataset.key=k;inp.value=(ds.palette&&ds.palette[k])||({background:'#ffffff',foreground:'#0f172a',primary:'#4f46e5',secondary:'#f1f5f9',accent:'#ec4899',muted:'#f4f4f5'})[k];inp.disabled=!editor;l.append(inp,document.createTextNode(k));pal.append(l)}
 for(const [sel,val] of [['design-display',ds.fonts?.display||'Inter'],['design-body',ds.fonts?.body||'Inter']]){const el=$(sel);el.replaceChildren();for(const f of d.fonts)el.append(new Option(f,f));el.value=val}
 $('design-radius').value=['0rem','0.375rem','0.75rem','1.25rem'].includes(ds.radius)?ds.radius:'0.75rem';
 renderSkills();
 $('genimage-section').classList.toggle('hidden',!state.me.image_generation?.enabled);
 const c=state.me.image_generation?.credits;text($('genimage-status'),state.me.viewer?.kind==='customer'&&c?c+' credits per image. Saved to the project images; then ask the chat to use it.':'Saved to the project images; then ask the chat to use it.');
 for(const el of ['design-name','design-summary','design-notes','design-display','design-body','design-radius','design-save','design-direction','design-regenerate','design-add-system','genimage-go'])$(el).disabled=!editor;
 const t=(state.me.tiers||[]).find(x=>x.id===state.tier);
 text($('design-regenerate-note'),'Picks new colours and fonts with the '+(t?t.label:'chosen')+' model'+(state.me.viewer?.kind==='customer'?' ('+(state.tier==='standard'||!t?state.me.discuss_credits:Math.max(t.credits,state.me.discuss_credits))+' credits)':'')+'. Ask the chat afterwards to restyle pages that need more than new colours.');
}
function renderSkills(){
 const d=state.designData,list=$('skills-list');list.replaceChildren();
 const on=new Set(d.skills),editor=state.project.role!=='viewer',owner=state.project.role==='owner';
 for(const sk of d.library){
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
$('design-save').onclick=()=>{const palette={};for(const inp of $('design-palette').querySelectorAll('input'))palette[inp.dataset.key]=inp.value;saveDesign({design:{name:$('design-name').value,summary:$('design-summary').value,notes:$('design-notes').value,palette,fonts:{display:$('design-display').value,body:$('design-body').value},radius:$('design-radius').value}})};
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
$('polish').onclick=()=>{if(!state.me.design_review){text($('chat-error'),'The design review needs a browser on the server (Chromium), which is not available here.');return}const note=$('chat-input').value.trim();send(note?'Polish the design: '+note:'Polish the design','polish',undefined,{message:note})};

})();

// Dropdown menus (details.menu) close when something inside is chosen or when clicking elsewhere.
document.addEventListener('click',e=>{for(const d of document.querySelectorAll('details.menu[open]'))if(!d.contains(e.target)||e.target.closest('.menu-panel button,.menu-panel a'))d.removeAttribute('open')});
document.addEventListener('keydown',e=>{if(e.key==='Escape')for(const d of document.querySelectorAll('details.menu[open]'))d.removeAttribute('open')});

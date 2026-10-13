"use strict";
(()=>{
const $=id=>document.getElementById(id);
const state={me:null,project:null,job:null,mode:'signup',file:null};

async function api(path,{method='GET',body}={}){
 const r=await fetch('/api/create'+path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,credentials:'same-origin'});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw Object.assign(new Error(data.error||'Request failed ('+r.status+')'),{status:r.status});
 return data;
}
function show(screen){for(const id of ['auth','home','editor'])$(id).classList.toggle('hidden',id!==screen);$('bar-project').classList.toggle('hidden',screen!=='editor')}
function text(el,value){el.textContent=value==null?'':String(value)}
function when(iso){try{return new Date(iso).toLocaleString([], {dateStyle:'medium',timeStyle:'short'})}catch{return''}}

// ---------- account ----------
async function loadMe(){
 state.me=await api('/me');
 const v=state.me.viewer;
 text($('who'),v?(v.kind==='owner'?'Owner':v.account.email):'');
 $('logout').classList.toggle('hidden',!v||v.kind!=='customer');
 renderCredits(v&&v.account);
 text($('free-note'),state.me.free_credits?'New accounts get '+state.me.free_credits+' free credits. One credit = one change.':'');
 return v;
}
function renderCredits(account){
 const customer=Boolean(account);
 $('credits').classList.toggle('hidden',!customer);
 $('buy').classList.toggle('hidden',!customer||!state.me?.purchases);
 if(customer)text($('credits'),account.credits+' credit'+(account.credits===1?'':'s'));
}
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
 const {projects}=await api('/projects');
 const list=$('projects');list.replaceChildren();
 if(!projects.length){const li=document.createElement('li');li.className='muted';li.textContent='No projects yet. Describe one above.';list.append(li);return}
 for(const p of projects){
  const li=document.createElement('li'),open=document.createElement('button'),meta=document.createElement('span');
  open.type='button';open.className='open';open.textContent=p.name;open.onclick=()=>openProject(p.id);
  meta.className='meta';meta.textContent='v'+p.current_version+' · '+when(p.updated_at);
  li.append(open,meta);
  if(p.published){const b=document.createElement('span');b.className='badge live';b.textContent='Live';li.append(b)}
  list.append(li);
 }
}
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
 $('project-name').value=project.name;
 renderMessages(pendingText);
 renderVersions();
 setPreview(project.preview_url);
 if(state.code)await renderFiles();
 if(job)watch(job);
}
function renderMessages(pendingText){
 const list=$('messages');list.replaceChildren();
 const msgs=state.project.messages;
 if(!msgs.length&&!pendingText){const li=document.createElement('li');li.className='assistant';li.textContent='Tell me what to build or change. I will edit the code and refresh the preview.';list.append(li)}
 for(const m of msgs)list.append(messageItem(m.role,m.text,m.changed));
 if(pendingText)list.append(messageItem('user',pendingText));
 list.scrollTop=list.scrollHeight;
}
function messageItem(role,body,changed){
 const li=document.createElement('li');li.className=role;li.textContent=body;
 if(changed&&changed.length){const s=document.createElement('span');s.className='changed';s.textContent='Changed: '+changed.join(', ');li.append(s)}
 return li;
}
function renderVersions(){
 const sel=$('versions');sel.replaceChildren();
 for(const v of [...state.project.versions].reverse()){const o=document.createElement('option');o.value=v.n;o.textContent='v'+v.n+' · '+(v.summary||'').slice(0,40);if(v.n===state.project.current_version)o.selected=true;sel.append(o)}
}
function previewFor(n){return state.project.preview_url.replace(/\/v\/\d+\/$/,'/v/'+n+'/')}
function setPreview(url){if(!url)return;$('frame').src=url;$('open').href=url}
$('versions').onchange=()=>setPreview(previewFor($('versions').value));
$('restore').onclick=async()=>{
 const n=Number($('versions').value);if(n===state.project.current_version)return;
 const {project}=await api('/projects/'+state.project.id+'/restore',{method:'POST',body:{version:n}});
 state.project=project;renderMessages();renderVersions();setPreview(project.preview_url);
};
$('back').onclick=()=>{state.project=null;loadHome()};
$('project-name').onchange=async()=>{try{const {project}=await api('/projects/'+state.project.id,{method:'PATCH',body:{name:$('project-name').value}});state.project.name=project.name}catch{}};
function device(mobile){$('canvas').classList.toggle('mobile',mobile);$('desktop').setAttribute('aria-pressed',String(!mobile));$('mobile').setAttribute('aria-pressed',String(mobile))}
$('desktop').onclick=()=>device(false);$('mobile').onclick=()=>device(true);
function view(code){
 state.code=code;
 $('view-preview').setAttribute('aria-pressed',String(!code));$('view-code').setAttribute('aria-pressed',String(code));
 $('frame').classList.toggle('hidden',code);$('code').classList.toggle('hidden',!code);
 if(code)renderFiles();
}
$('view-preview').onclick=()=>view(false);$('view-code').onclick=()=>view(true);
async function renderFiles(){
 const list=$('file-list');list.replaceChildren();
 const files=state.project.files;
 if(!files.includes(state.file))state.file=files.includes('src/App.jsx')?'src/App.jsx':files[0];
 for(const f of files){const li=document.createElement('li'),b=document.createElement('button');b.type='button';b.textContent=f;b.setAttribute('aria-current',String(f===state.file));b.onclick=()=>{state.file=f;renderFiles()};li.append(b);list.append(li)}
 if(state.file){const {content}=await api('/projects/'+state.project.id+'/file?path='+encodeURIComponent(state.file));text($('file-view').firstChild,content)}
}

$('chat-input').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('chat-form').requestSubmit()}});
$('chat-form').onsubmit=async e=>{
 e.preventDefault();
 const message=$('chat-input').value.trim();if(!message||state.job)return;
 text($('chat-error'),'');
 $('messages').append(messageItem('user',message));$('messages').scrollTop=$('messages').scrollHeight;
 $('chat-input').value='';
 try{const {job}=await api('/projects/'+state.project.id+'/chat',{method:'POST',body:{message}});watch(job)}
 catch(err){
  $('messages').append(messageItem('assistant failed',err.message));
  if(err.status===402&&state.me.purchases)openBuy();
 }
};
const LABELS={queued:'Starting…',writing:'Writing code…',fixing:'Fixing a problem and retrying…',building:'Building preview…'};
async function watch(job){
 state.job=job;busy(true,LABELS[job.status]);
 refreshCredits();
 const id=state.project.id;
 while(state.job&&state.job.id===job.id){
  await new Promise(r=>setTimeout(r,1500));
  let current;
  try{current=(await api('/jobs/'+job.id)).job}catch(err){text($('chat-error'),err.message);break}
  text($('progress-text'),LABELS[current.status]||'Working…');
  if(current.status==='complete'||current.status==='failed'){
   if(state.project&&state.project.id===id){
    const {project,account}=await api('/projects/'+id);
    state.project=project;if(account)renderCredits(account);
    renderMessages();renderVersions();setPreview(project.preview_url);
    if(current.status==='failed')$('messages').append(messageItem('assistant failed',current.error+'\nYour credit was refunded.'));
    if(state.code)renderFiles();
   }
   break;
  }
 }
 state.job=null;busy(false);
}
function busy(on,label){$('progress').classList.toggle('hidden',!on);$('send').disabled=on;if(label)text($('progress-text'),label)}
async function refreshCredits(){try{const v=await loadMe();if(v&&v.account)renderCredits(v.account)}catch{}}

// ---------- publish & domains ----------
$('publish-open').onclick=()=>{renderPublish();$('publish-dialog').showModal()};
function slugFrom(name){return String(name||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)}
function renderPublish(){
 const p=state.project;
 $('slug').value=p.published?.slug||slugFrom(p.name);
 text($('slug-preview'),location.origin+'/sites/'+($('slug').value||'…')+'/');
 $('unpublish').classList.toggle('hidden',!p.published);
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
  const badge=document.createElement('span');badge.className='badge'+(d.verified?' live':'');badge.textContent=d.verified?'Connected':'Waiting for DNS';
  head.append(name,badge);
  if(!d.verified){const b=document.createElement('button');b.type='button';b.className='ghost';b.textContent='Verify';b.onclick=()=>domainAction('/verify','POST',d.hostname);head.append(b)}
  const rm=document.createElement('button');rm.type='button';rm.className='ghost';rm.textContent='Remove';rm.onclick=()=>domainAction('/domains','DELETE',d.hostname);head.append(rm);
  li.append(head);
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
async function publishAction(path,body){
 text($('publish-error'),'');
 try{const {project,error}=await api('/projects/'+state.project.id+path,{method:'POST',body});state.project=project;renderPublish();if(error)text($('publish-error'),error)}
 catch(err){text($('publish-error'),err.message)}
}
$('publish').onclick=()=>publishAction('/publish',{slug:slugFrom($('slug').value)});
$('unpublish').onclick=()=>publishAction('/unpublish',{});
$('add-domain').onclick=async()=>{await domainAction('/domains','POST',$('domain').value);if(!$('publish-error').textContent)$('domain').value=''};
async function domainAction(path,method,hostname){
 text($('publish-error'),'');
 try{const r=await api('/projects/'+state.project.id+path,{method,body:{hostname}});state.project=r.project;renderPublish();if(r.error)text($('publish-error'),r.error)}
 catch(err){text($('publish-error'),err.message)}
}

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
async function start(){
 const v=await loadMe();
 if(!v){show('auth');setMode(state.me.signups?'signup':'login');$('tab-signup').classList.toggle('hidden',!state.me.signups);return}
 const params=new URLSearchParams(location.search);
 const id=params.get('project');
 if(id&&/^[a-f0-9]{12}$/.test(id)){try{return await openProject(id)}catch{}}
 await loadHome();
}
start().catch(err=>{document.body.append(Object.assign(document.createElement('p'),{className:'error',textContent:err.message}))});
})();

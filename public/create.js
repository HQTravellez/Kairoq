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
 renderTiers();setChatMode(state.mode);
 renderMessages(pendingText);
 renderVersions();
 setPreview(project.preview_url);
 if(state.code)await renderFiles();
 if(state.data)await renderData();
 if(job)watch(job);
}
function renderMessages(pendingText){
 const list=$('messages');list.replaceChildren();
 const msgs=state.project.messages;
 if(!msgs.length&&!pendingText){const li=document.createElement('li');li.className='assistant';li.textContent='Tell me what to build or change. Switch to Discuss to plan without changing code.';list.append(li)}
 msgs.forEach((m,i)=>list.append(messageItem(m,i===msgs.length-1)));
 if(pendingText)list.append(messageItem({role:'user',text:pendingText}));
 list.scrollTop=list.scrollHeight;
 renderErrors();
}
function messageItem(m,last){
 const li=document.createElement('li');li.className=m.role+(m.mode==='discuss'?' discuss':'')+(m.failed?' failed':'');
 const body=document.createElement('div');body.textContent=m.text;li.append(body);
 if(m.images&&m.images.length){const s=document.createElement('span');s.className='changed';s.textContent='Images: '+m.images.join(', ');li.append(s)}
 if(m.changed&&m.changed.length){const s=document.createElement('span');s.className='changed';s.textContent='Changed: '+m.changed.join(', ');li.append(s)}
 if(m.role==='assistant'&&m.mode==='discuss'&&last){const b=document.createElement('button');b.type='button';b.className='ghost small-btn';b.textContent='Implement this plan';b.onclick=()=>send('Implement the plan you just described.','build');li.append(b)}
 return li;
}
function renderVersions(){
 const sel=$('versions');sel.replaceChildren();
 for(const v of [...state.project.versions].reverse()){const o=document.createElement('option');o.value=v.n;o.textContent='v'+v.n+' · '+(v.summary||'').slice(0,40);if(v.n===state.project.current_version)o.selected=true;sel.append(o)}
}
function previewFor(n){return state.project.preview_url.replace(/\/v\/\d+\/$/,'/v/'+n+'/')}
function setPreview(url){if(!url)return;state.runtimeErrors=[];renderErrors();$('frame').src=url;$('open').href=url}
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
 const users=$('users');users.replaceChildren();
 for(const u of d.users){const li=document.createElement('li');li.textContent=u.email+' · '+when(u.created_at);users.append(li)}
 const records=$('records');records.replaceChildren();
 text($('records-title'),state.collection?'Records in '+state.collection:'Records');
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
function setChatMode(mode){state.mode=mode;$('mode-build').setAttribute('aria-pressed',String(mode==='build'));$('mode-discuss').setAttribute('aria-pressed',String(mode==='discuss'));$('chat-input').placeholder=mode==='discuss'?'Ask a question or plan a feature. No code changes, no surprises.':'Ask for a change: add a pricing section, make the header sticky…';text($('send'),mode==='discuss'?'Ask':'Send');costHint()}
$('mode-build').onclick=()=>setChatMode('build');$('mode-discuss').onclick=()=>setChatMode('discuss');
function renderTiers(){
 const sel=$('tier');sel.replaceChildren();
 for(const t of state.me.tiers||[]){const o=document.createElement('option');o.value=t.id;o.disabled=!t.enabled;o.textContent=t.label+' · '+t.credits+' credit'+(t.credits===1?'':'s')+(t.enabled?'':' (not enabled)');if(t.id===state.tier)o.selected=true;sel.append(o)}
 costHint();
}
$('tier').onchange=()=>{state.tier=$('tier').value;costHint()};
function costHint(){
 if(!state.me||!state.me.viewer||state.me.viewer.kind!=='customer'){text($('cost-hint'),'');return}
 const t=(state.me.tiers||[]).find(x=>x.id===state.tier);
 const n=(state.mode==='discuss'?state.me.discuss_credits:(t?t.credits:1))+(state.attachments.length?state.me.image_credits:0);
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
const LABELS={queued:'Starting…',thinking:'Thinking…',writing:'Writing code…',fixing:'Fixing a problem and retrying…',building:'Building preview…',testing:'Testing the app in a browser…'};
function streamItem(){
 let li=$('stream');
 if(!li){li=document.createElement('li');li.id='stream';li.className='assistant streaming';li.innerHTML='<div class="stream-msg"></div><div class="stream-files changed"></div><pre class="stream-code hidden"></pre>';$('messages').append(li)}
 return li;
}
function renderStream(job){
 const st=job.stream;
 if(!st){$('stream')?.remove();return}
 const li=streamItem();
 if(job.mode==='discuss'){text(li.querySelector('.stream-msg'),st.text);}
 else{
  text(li.querySelector('.stream-msg'),st.message||'Planning the change…');
  text(li.querySelector('.stream-files'),st.files&&st.files.length?'Writing '+st.files.join(', '):'');
  const pre=li.querySelector('.stream-code');pre.classList.toggle('hidden',!st.tail);
  pre.textContent=String(st.tail||'').replace(/\\n/g,'\n').replace(/\\t/g,'  ').replace(/\\"/g,'"').split('\n').slice(-14).join('\n');
 }
 $('messages').scrollTop=$('messages').scrollHeight;
}
async function watch(job){
 state.job=job;busy(true,LABELS[job.status]);refreshCredits();
 const id=state.project.id;
 const done=await new Promise(resolve=>{
  let finished=false;
  const finish=j=>{if(!finished){finished=true;resolve(j)}};
  const apply=j=>{text($('progress-text'),LABELS[j.status]||'Working…');renderStream(j);if(j.status==='complete'||j.status==='failed')finish(j)};
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
 $('stream')?.remove();
 if(done&&state.project&&state.project.id===id){
  const {project,account}=await api('/projects/'+id);
  state.project=project;if(account)renderCredits(account);
  state.runtimeErrors=[];
  renderMessages();renderVersions();
  if(done.mode!=='discuss')setPreview(project.preview_url);
  if(done.status==='failed')$('messages').append(messageItem({role:'assistant',text:done.error+(done.credits&&state.me.viewer.kind==='customer'?'\nYour credits were refunded.':''),failed:true}));
  if(state.code)renderFiles();
  if(state.data)renderData();
 }
 state.job=null;busy(false);
}
function busy(on,label){$('progress').classList.toggle('hidden',!on);$('send').disabled=on;$('fix').disabled=on;if(label)text($('progress-text'),label)}
async function refreshCredits(){try{const v=await loadMe();if(v&&v.account)renderCredits(v.account)}catch{}}

// ---------- runtime errors from the preview ----------
window.addEventListener('message',e=>{
 if(e.source!==$('frame').contentWindow||!e.data||e.data.source!=='kairoq-app')return;
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

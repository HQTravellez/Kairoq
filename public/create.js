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
function show(screen){for(const id of ['auth','home','editor','share-screen'])$(id).classList.toggle('hidden',id!==screen);$('bar-project').classList.toggle('hidden',screen!=='editor')}
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
 renderTemplates($('home-templates'),id=>startFromTemplate(id));
 const {projects}=await api('/projects');
 const list=$('projects');list.replaceChildren();
 if(!projects.length){const li=document.createElement('li');li.className='muted';li.textContent='No projects yet. Describe one above.';list.append(li);return}
 for(const p of projects){
  const li=document.createElement('li'),open=document.createElement('button'),meta=document.createElement('span');
  open.type='button';open.className='open';open.textContent=p.name;open.onclick=()=>openProject(p.id);
  meta.className='meta';meta.textContent='v'+p.current_version+' · '+when(p.updated_at);
  li.append(open,meta);
  if(p.role&&p.role!=='owner'){const b=document.createElement('span');b.className='role-badge';b.textContent='Shared · '+p.role;li.append(b)}
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
 applyRole();
 $('project-name').value=project.name;
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
 if(m.role==='assistant'&&!tl.length&&m.changed&&m.changed.length){const c=el('div','file-chips done');for(const f of m.changed.slice(0,12))c.append(fileChip(f));if(m.changed.length>12)c.append(el('span','chip more','+'+(m.changed.length-12)+' more'));li.append(c)}
 if(m.role==='assistant'&&(m.version||m.credits!=null)&&index!=null){
  const f=el('div','msg-meta');
  if(m.version)f.append(el('span','ver','v'+m.version));
  if(m.duration_ms!=null){const t=el('span');t.append(icon('clock'),secs(m.duration_ms));f.append(t)}
  if(m.credits!=null){const t=el('span');t.append(icon('coin'),String(m.credits));f.append(t)}
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
function setPreview(url){if(!url)return;state.runtimeErrors=[];renderErrors();state.selected=null;renderVisual();$('frame').src=url;$('open').href=url}
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
 renderSql().catch(()=>{});renderLogs().catch(()=>{});
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
const PLACEHOLDERS={build:'Ask for a change: add a pricing section, make the header sticky…',discuss:'Ask a question or plan a feature. No code changes, no surprises.',agent:'Give the agent a bigger task: "add room booking with availability, test the whole flow and fix any errors"'};
function setChatMode(mode){if(!PLACEHOLDERS[mode])mode='build';state.mode=mode;for(const m of ['build','discuss','agent'])$('mode-'+m).setAttribute('aria-pressed',String(mode===m));$('chat-input').placeholder=PLACEHOLDERS[mode];text($('send'),mode==='discuss'?'Ask':mode==='agent'?'Start':'Send');costHint()}
$('mode-build').onclick=()=>setChatMode('build');$('mode-discuss').onclick=()=>setChatMode('discuss');$('mode-agent').onclick=()=>setChatMode('agent');
function renderTiers(){
 const sel=$('tier');sel.replaceChildren();
 for(const t of state.me.tiers||[]){const o=document.createElement('option');o.value=t.id;o.disabled=!t.enabled;o.textContent=t.label+' · '+t.credits+' credit'+(t.credits===1?'':'s')+(t.enabled?'':' (not enabled)');if(t.id===state.tier)o.selected=true;sel.append(o)}
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
const LABELS={queued:'Starting…',working:'Working…',thinking:'Thinking…',designing:'Choosing the design direction…',images:'Generating images…',reviewing:'Reviewing the design on desktop and phone…',checking:'Re-running your saved checks…',writing:'Writing code…',fixing:'Fixing a problem and retrying…',building:'Building preview…',testing:'Testing the app in a browser…',analyzing:'Studying the reference in a browser…',planning:'Writing the feature inventory and build plan…',assets:'Finding openly licensed images and assets…',verifying:'Testing the user journeys on desktop and phone…',repairing:'Repairing the journeys that failed…',comparing:'Comparing the design with the reference…',publishing:'Publishing and checking the live app…'};
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
  const apply=j=>{text($('progress-text'),(j.mode==='agent'&&j.agent&&j.agent.step?'Step '+j.agent.step+' · ':'')+(LABELS[j.status]||'Working…'));if(j.status!=='complete'&&j.status!=='failed')renderWork(j);if(j.status==='complete'||j.status==='failed')finish(j)};
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
  if(done.problem)$('messages').append(messageItem({role:'assistant',text:done.problem==='checks'?'This change still breaks a saved check. Use Fix it or describe the problem.':'This change still shows errors in the browser. Use Fix it to repair them.'}));
  if(done.result&&done.result.polish_error)$('messages').append(messageItem({role:'assistant',text:done.result.polish_error}));
  if(done.result&&done.result.reference&&done.mode==='agent')$('messages').append(messageItem({role:'assistant',text:referenceReport(done.result.reference)}));
  if(done.status==='failed')$('messages').append(messageItem({role:'assistant',text:done.error+(done.credits&&state.me.viewer.kind==='customer'?'\nYour credits were refunded.':''),failed:true}));
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
async function renderTemplates(wrap,onPick){
 if(!state.templates)state.templates=(await api('/templates')).templates;
 wrap.replaceChildren();
 for(const t of state.templates){
  const b=document.createElement('button');b.type='button';
  b.append(Object.assign(document.createElement('span'),{className:'cat',textContent:t.category}),Object.assign(document.createElement('strong'),{textContent:t.name}),Object.assign(document.createElement('span'),{className:'desc',textContent:t.description}));
  b.onclick=()=>onPick(t.id);wrap.append(b);
 }
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
 renderTemplates($('landing-templates'),id=>{setPending({template:id});$('signup').scrollIntoView({behavior:'smooth'});$('email').focus()}).catch(()=>{});
 const wrap=$('landing-plans');wrap.replaceChildren();
 const per=(state.me.tiers||[]).map(t=>t.label+' '+t.credits+' credit'+(t.credits===1?'':'s')).join(', ');
 wrap.append(planCard('Free',(state.me.free_credits||0)+' credits',['Every feature included','Publish to a free URL','No card needed']));
 for(const p of state.me.plans||[])wrap.append(planCard(p.name,p.label||p.credits+' credits / month',[p.credits+' credits every month',...p.features]));
 for(const p of state.me.packs||[])wrap.append(planCard(p.name,p.label||p.credits+' credits',[p.credits+' credits, one-time','Never expire']));
 text($('pricing-note'),'Credits per message: '+per+(state.me.discuss_credits?'; Discuss '+state.me.discuss_credits:'')+'. Visual edits are free. A request that fails before anything is saved is not charged. Not happy with a change? Contact support.');
}
$('landing-form').onsubmit=e=>{e.preventDefault();setPending({prompt:$('landing-prompt').value.trim()});setMode('signup');$('signup').scrollIntoView({behavior:'smooth'});$('email').focus()};
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
  $('security-fix').onclick=()=>{$('security-dialog').close();send('Fix these security problems:\n'+serious.map(f=>'- '+f.title+(f.file?' ('+f.file+')':'')+': '+f.detail+' Suggested fix: '+f.fix).join('\n'),'build')};
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

async function start(){
 await handleLinks();
 const v=await loadMe();
 $('google-login').classList.toggle('hidden',!state.me.google);
 if(state.resetToken){show('auth');renderLanding();$('auth-form').classList.add('hidden');$('reset-form').classList.remove('hidden');$('signup').scrollIntoView();return}
 if(state.flash){text($('auth-error'),state.flash);text($('home-error'),state.flash);state.flash=null}
 const share=/^\/create\/share\/([a-f0-9]{24})\/?$/.exec(location.pathname);
 if(share)return openShare(share[1],v);
 if(!v){show('auth');setMode(state.me.signups?'signup':'login');$('tab-signup').classList.toggle('hidden',!state.me.signups);renderLanding();return}
 const pending=takePending();
 if(pending){
  if(pending.remix)return remix(pending.remix);
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
  li.append(st,t,act);list.append(li);
 }
 for(const el of ['checks-run','checks-describe','checks-add'])$(el).disabled=!editor;
 $('checks-run').disabled=!editor||!d.checks.length;
}
$('checks-open').onclick=async()=>{text($('checks-error'),'');text($('checks-status'),'');$('checks-save-anyway').classList.add('hidden');try{await renderChecks();$('checks-dialog').showModal()}catch(err){text($('chat-error'),err.message)}};
$('checks-run').onclick=async()=>{const btn=$('checks-run');btn.disabled=true;text($('checks-status'),'Running the checks on a test copy of your data…');text($('checks-error'),'');
 try{const {result}=await api('/projects/'+state.project.id+'/checks',{method:'POST',body:{run:true}});text($('checks-status'),result.failed.length?result.failed.length+' of '+result.ran+' failed. Use Fix it in the chat, or describe what changed.':'All '+result.ran+' passed.');await renderChecks()}
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
  text($('skill-status'),'Added "'+r.skill.name+'". Tick it to use it in this project.');$('skill-url').value='';await renderDesign();
 }catch(err){text($('skill-status'),'');text($('design-error'),err.message)}
}
$('skill-import').onclick=()=>importSkill();
$('skill-save').onclick=async()=>{text($('design-error'),'');try{const r=await api('/skills',{method:'POST',body:{text:$('skill-text').value}});$('skill-text').value='';text($('skill-status'),'Added "'+r.skill.name+'".');await renderDesign()}catch(err){text($('design-error'),err.message)}};
$('genimage-go').onclick=async()=>{
 const btn=$('genimage-go');btn.disabled=true;text($('genimage-status'),'Generating… (up to a minute)');text($('design-error'),'');
 try{const r=await api('/projects/'+state.project.id+'/images',{method:'POST',body:{prompt:$('genimage-prompt').value,aspect:$('genimage-aspect').value}});text($('genimage-status'),'Saved ./uploads/'+r.saved[0]+'. Ask the chat to use it, for example "use ./uploads/'+r.saved[0]+' as the hero image".');$('genimage-prompt').value='';refreshCredits()}
 catch(err){text($('genimage-status'),'');text($('design-error'),err.message);if(err.status===402&&state.me.purchases)openBuy()}
 finally{btn.disabled=false}
};
$('polish').onclick=()=>{if(!state.me.design_review){text($('chat-error'),'The design review needs a browser on the server (Chromium), which is not available here.');return}const note=$('chat-input').value.trim();send(note?'Polish the design: '+note:'Polish the design','polish',undefined,{message:note})};

})();

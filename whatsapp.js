"use strict";
// Build from WhatsApp: people message Kairoq's WhatsApp number (text, a voice note or a photo)
// and get their app built, with the preview link sent back when it is ready. No laptop needed.
//
// Uses the WhatsApp Business Cloud API (Meta). Set:
//   KAIROQ_WHATSAPP_TOKEN        access token for the WhatsApp Business app
//   KAIROQ_WHATSAPP_PHONE_ID     the phone number id that sends messages
//   KAIROQ_WHATSAPP_VERIFY_TOKEN any secret string, also entered in Meta's webhook settings
//   KAIROQ_WHATSAPP_APP_SECRET   the Meta app secret (every webhook call is signed with it)
//   KAIROQ_WHATSAPP_NUMBER       the public number in international format, e.g. 971501234567
//   KAIROQ_PUBLIC_URL            so the links in replies point at this server
// Webhook URL to give Meta: <KAIROQ_PUBLIC_URL>/api/whatsapp/webhook
//
// Voice notes are transcribed with GEMINI_API_KEY (Gemini) or OPENAI_API_KEY (Whisper).
// Phone numbers are stored only as hashes, mapped to the Kairoq account they belong to.
const fs=require('fs'),path=require('path'),crypto=require('crypto');

function cfg(){
 return{token:process.env.KAIROQ_WHATSAPP_TOKEN||'',phoneId:process.env.KAIROQ_WHATSAPP_PHONE_ID||'',verify:process.env.KAIROQ_WHATSAPP_VERIFY_TOKEN||'',secret:process.env.KAIROQ_WHATSAPP_APP_SECRET||'',number:String(process.env.KAIROQ_WHATSAPP_NUMBER||'').replace(/\D/g,''),api:(process.env.KAIROQ_WHATSAPP_API||'https://graph.facebook.com/v21.0').replace(/\/$/,''),origin:(process.env.KAIROQ_PUBLIC_URL||(process.env.RAILWAY_PUBLIC_DOMAIN?'https://'+process.env.RAILWAY_PUBLIC_DOMAIN:'')).replace(/\/$/,'')};
}
function enabled(){const c=cfg();return Boolean(c.token&&c.phoneId&&c.verify&&c.secret&&c.origin)}
function chatLink(text){const c=cfg();return c.number?'https://wa.me/'+c.number+(text?'?text='+encodeURIComponent(text):''):null}
function dir(){return process.env.KAIROQ_WHATSAPP_DIR||path.join(path.dirname(require('./react-builder').ROOT()),'whatsapp')}
function phoneKey(p){return crypto.createHash('sha256').update('kq-wa:'+String(p).replace(/\D/g,'')).digest('hex').slice(0,32)}
function load(){try{const d=JSON.parse(fs.readFileSync(path.join(dir(),'state.json'),'utf8'));return{phones:d.phones||{},codes:d.codes||{}}}catch{return{phones:{},codes:{}}}}
function save(d){fs.mkdirSync(dir(),{recursive:true});fs.writeFileSync(path.join(dir(),'state.json'),JSON.stringify(d))}
function clip(v,n){return String(v??'').replace(/\s+/g,' ').trim().slice(0,n)}

// ---------- sending ----------
async function send(to,body,{fetchImpl=fetch}={}){
 const c=cfg();
 const r=await fetchImpl(c.api+'/'+c.phoneId+'/messages',{method:'POST',headers:{Authorization:'Bearer '+c.token,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:String(to),type:'text',text:{body:String(body).slice(0,4000),preview_url:true}})});
 if(!r.ok)throw Error('WhatsApp send failed: '+r.status);
}
// Media (voice notes, photos): Meta gives an id; its URL needs the same token.
async function media(id,{fetchImpl=fetch}={}){
 const c=cfg(),auth={Authorization:'Bearer '+c.token};
 const info=await (await fetchImpl(c.api+'/'+encodeURIComponent(id),{headers:auth})).json();
 if(!info||!info.url)throw Error('No media URL');
 if(Number(info.file_size)>16*1024*1024)throw Error('That file is too large');
 const r=await fetchImpl(info.url,{headers:auth});if(!r.ok)throw Error('Media download failed');
 return{data:Buffer.from(await r.arrayBuffer()),mime:String(info.mime_type||'application/octet-stream').split(';')[0]};
}
// Voice notes to text: Gemini first, then Whisper.
async function transcribe({data,mime},{fetchImpl=fetch}={}){
 if(process.env.GEMINI_API_KEY){
  const r=await fetchImpl('https://generativelanguage.googleapis.com/v1beta/models/'+(process.env.KAIROQ_TRANSCRIBE_MODEL||'gemini-2.5-flash')+':generateContent?key='+encodeURIComponent(process.env.GEMINI_API_KEY),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:'Transcribe this voice message word for word in its original language. Reply with only the transcript.'},{inline_data:{mime_type:mime,data:data.toString('base64')}}]}]})});
  const j=await r.json().catch(()=>null);const t=j&&j.candidates&&j.candidates[0]&&j.candidates[0].content&&j.candidates[0].content.parts&&j.candidates[0].content.parts.map(p=>p.text||'').join('');
  if(t&&t.trim())return t.trim();
 }
 if(process.env.OPENAI_API_KEY){
  const fd=new FormData();fd.append('model','whisper-1');fd.append('file',new Blob([data],{type:mime}),'voice.'+(mime.includes('ogg')?'ogg':mime.includes('mpeg')?'mp3':'m4a'));
  const r=await fetchImpl('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY},body:fd});
  const j=await r.json().catch(()=>null);if(j&&j.text&&j.text.trim())return j.text.trim();
 }
 return null;
}

// ---------- linking a web account ----------
// A six-digit code shown on the web; sending "link 123456" on WhatsApp connects that number.
function issueCode(accountId){
 const d=load(),now=Date.now();
 for(const [k,v] of Object.entries(d.codes))if(v.expires<now||v.account===accountId)delete d.codes[k];
 let code;do{code=String(crypto.randomInt(100000,1000000))}while(d.codes[code]);
 d.codes[code]={account:accountId,expires:now+15*60000};save(d);
 return{code,link:chatLink('link '+code),number:cfg().number||null};
}
function connected(accountId){return Object.values(load().phones).some(p=>p.account===accountId)}
function disconnect(accountId){const d=load();for(const [k,p] of Object.entries(d.phones))if(p.account===accountId)delete d.phones[k];save(d)}

// ---------- the conversation ----------
const seen=new Set(),bursts=new Map();
const HELP='Here is what you can send me:\n• Describe what to build or change, in your own words (text or a voice note)\n• A photo or screenshot with a caption, e.g. "make it look like this"\n• *projects* to see your apps, *switch 2* to change app, *new* to start a fresh one\n• *publish* to put the current app live and get a link to share\n• *undo* to go back one version\n• *open* for a link to the full editor\n• *credits* to see what you have left';
function viewerFor(accountId){const accounts=require('./builder-accounts'),a=accounts.get(accountId);if(!a)return null;return{kind:'customer',owner:a.id,account:accounts.publicAccount(a)}}
function projectsOf(accountId){return require('./react-builder').list().filter(p=>p.owner===accountId).sort((a,b)=>Date.parse(b.updated_at||0)-Date.parse(a.updated_at||0))}

// deps: {callModel, checkRuntime, inspect, webSearch, designShots, generateImage, screenshot, fetchImpl, transcribeImpl, wait}
async function onMessage(msg,deps){
 const c=cfg(),from=String(msg.from||'').replace(/\D/g,'');if(!from)return;
 const reply=t=>send(from,t,deps).catch(()=>{});
 // At most 20 messages in 10 minutes from one number.
 const now=Date.now(),b=(bursts.get(from)||[]).filter(t=>now-t<600000);b.push(now);bursts.set(from,b);
 if(b.length>20){if(b.length===21)await reply('That is a lot of messages at once. Give me a few minutes and send your change again.');return}
 // What they said: text, a voice note (transcribed) or a photo (with its caption).
 let text='',images=[];
 try{
  if(msg.type==='text')text=clip(msg.text&&msg.text.body,2000);
  else if(msg.type==='audio'){
   const audio=await media(msg.audio.id,deps),heard=await (deps.transcribeImpl||transcribe)(audio,deps);
   if(!heard)return reply('I could not understand that voice note. Please send it as text.');
   text=clip(heard,2000);await reply('🎙️ I heard: "'+clip(text,300)+'"');
  }else if(msg.type==='image'){
   const img=await media(msg.image.id,deps);
   if(!/^image\/(png|jpeg|webp)$/.test(img.mime))return reply('Please send the picture as a normal photo (JPG or PNG).');
   if(img.data.length>3*1024*1024)return reply('That photo is too large. Please send a smaller one (under 3 MB).');
   images=[{name:'whatsapp-photo.'+(img.mime==='image/png'?'png':img.mime==='image/webp'?'webp':'jpg'),mime:img.mime,data:img.data.toString('base64')}];text=clip(msg.image.caption,2000)||'Use this picture as a reference for the design.';
  }else return reply('I can read text, voice notes and photos. '+HELP.split('\n')[0]);
 }catch(e){return reply('Something went wrong reading that message. Please try again, or send it as text.')}
 if(!text)return;
 const d=load(),key=phoneKey(from),st=d.phones[key]||(d.phones[key]={stage:'new',at:new Date().toISOString()});
 const accounts=require('./builder-accounts');
 // Linking an existing web account.
 const lk=/^link\s+(\d{6})$/i.exec(text);
 if(lk){
  const code=d.codes[lk[1]];
  if(!code||code.expires<Date.now()){save(d);return reply('That code has expired. Open Kairoq on the web, choose WhatsApp in the menu and send the new code.')}
  delete d.codes[lk[1]];
  for(const [k,p] of Object.entries(d.phones))if(p.account===code.account&&k!==key)delete d.phones[k];
  Object.assign(st,{account:code.account,stage:'ready',project:null});save(d);
  return reply('✅ Connected to your Kairoq account ('+accounts.get(code.account).email+'). Tell me what to build or change.');
 }
 // New numbers: an account from their email (one per number), then straight to building.
 if(!st.account){
  const email=/^\S+@\S+\.\S{2,}$/.test(text)?text.toLowerCase():null;
  if(st.stage==='email'&&email){
   try{
    const s=accounts.signup(email,crypto.randomBytes(18).toString('base64url'));
    accounts.grantFreeCredits(s.account.id);accounts.sendVerification(s.account.id,c.origin).catch(()=>{});
    Object.assign(st,{account:s.account.id,stage:'ready',project:null});
    const first=st.pending;delete st.pending;save(d);
    await reply('🎉 Your Kairoq account is ready with '+accounts.get(s.account.id).credits+' free credits.'+(first?' Starting on what you asked for…':' Now tell me what to build, for example: "a booking site for my salon with prices and opening hours".'));
    if(first)return build(from,s.account.id,first,[],deps);
    return;
   }catch(e){
    save(d);
    if(e.status===409)return reply('That email already has a Kairoq account. Sign in on the web, open the menu, choose *WhatsApp* and send me the code it shows (like: link 123456).');
    return reply('That email did not work: '+e.message+'. Please send it again.');
   }
  }
  // The first thing they asked for is kept; later non-email replies do not replace it.
  if(!email&&text.length>8&&!st.pending)st.pending=text;
  st.stage='email';save(d);
  return reply('👋 Hi! I am Kairoq. I build websites and apps from your messages, test them in a real browser and send you the link.\n\nTo start, reply with your *email address* (it is your account, so you can also open your apps on a computer).'+(st.pending?' I will build what you asked for right after.':''));
 }
 return command(from,st,d,text,images,deps);
}

async function command(from,st,d,text,images,deps){
 const reply=t=>send(from,t,deps).catch(()=>{}),c=cfg();
 const builder=require('./react-builder'),api=require('./create-api'),accounts=require('./builder-accounts');
 const account=accounts.get(st.account);
 if(!account){delete d.phones[phoneKey(from)];save(d);return reply('Your account was not found. Send your email to start again.')}
 const t=text.trim(),lower=t.toLowerCase();
 const list=projectsOf(account.id);
 if(st.project&&!list.some(p=>p.id===st.project))st.project=null;
 const current=st.project||(list[0]&&list[0].id)||null;
 if(/^(help|menu|\?|commands)$/.test(lower))return reply(HELP);
 if(/^(credits|balance)$/.test(lower))return reply('You have '+account.credits+' credits. Each change costs about 1. Get more: '+c.origin+'/create');
 if(/^(projects|apps|my apps|list)$/.test(lower)){
  if(!list.length)return reply('No apps yet. Describe one and I will build it.');
  return reply('Your apps:\n'+list.slice(0,9).map((p,i)=>(i+1)+'. '+p.name+(p.id===current?'  ← current':'')).join('\n')+'\n\nSend *switch 2* to work on another one.');
 }
 const sw=/^(switch|use|open app|app)\s+(\d)$/.exec(lower);
 if(sw){const p=list[Number(sw[2])-1];if(!p)return reply('There is no app number '+sw[2]+'. Send *projects* to see the list.');st.project=p.id;save(d);return reply('Now working on *'+p.name+'*. What should I change?')}
 const nw=/^new\b[:\s-]*(.*)$/i.exec(t);
 if(nw){st.project=null;st.fresh=true;save(d);if(nw[1].trim().length>8)return build(from,account.id,nw[1].trim(),images,deps,{fresh:true});return reply('OK, a fresh app. Describe it in a sentence or two.')}
 if(/^(open|editor|link|computer|laptop)$/.test(lower)){
  const token=accounts.loginToken(account.id);
  return reply('Open the full editor (link works once, for 15 minutes):\n'+c.origin+'/api/create/auth/link?token='+encodeURIComponent(token)+(current?'&project='+current:''));
 }
 if(!current&&/^(publish|undo)$/.test(lower))return reply('You have no app yet. Describe one and I will build it.');
 if(lower==='publish'){
  try{const out=await api.publishProject(current,{},{inspect:deps.inspect,screenshot:deps.screenshot});return reply('🚀 Live: '+out.urls.path+'\nShare it anywhere. Every change you send from now on can be published again with *publish*.'+(out.billing&&out.billing.charged?'\nHosting: '+out.billing.charged+' credits for 30 days, renewed monthly.':''))}
  catch(e){return reply('I could not publish it: '+e.message)}
 }
 if(lower==='undo'){
  const meta=builder.loadMeta(current),prev=meta.versions.filter(v=>v.n<meta.current_version).at(-1);
  if(!prev)return reply('This is already the first version.');
  builder.restore(current,prev.n);return reply('↩️ Back to version '+prev.n+'. Preview: '+c.origin+builder.previewUrl(builder.loadMeta(current)));
 }
 // "fix it": the fix of a change that still shows errors (on Kairoq when it is the fix-on-us).
 if(/^fix( it| this| the errors?)?[.!]*$/.test(lower)){if(!current)return reply('You have no app yet. Describe one and I will build it.');return build(from,account.id,'Fix the errors the browser shows, without changing what already works.',[],deps,{fix:true})}
 return build(from,account.id,t,images,deps,{fresh:Boolean(st.fresh)});
}

// Builds (or changes) the current app and sends the link when it is done.
async function build(from,accountId,message,images,deps,{fresh=false,fix=false}={}){
 const reply=t=>send(from,t,deps).catch(()=>{}),c=cfg();
 const builder=require('./react-builder'),api=require('./create-api');
 const v=viewerFor(accountId);if(!v)return;
 const d=load(),st=d.phones[phoneKey(from)];
 const list=projectsOf(accountId);
 let id=fresh?null:(st.project||(list[0]&&list[0].id)||null),job;
 const jobDeps={callModel:deps.callModel,checkRuntime:deps.checkRuntime,inspect:deps.inspect,webSearch:deps.webSearch,designShots:deps.designShots,generateImage:deps.generateImage};
 try{
  if(!id){
   const r=await api.createProject(v,{prompt:message,images},jobDeps);id=r.meta.id;job=r.job;
   st.project=id;delete st.fresh;save(d);
   await reply('🛠️ Building *'+r.meta.name+'*. I will send you the link in a minute or two.');
  }else{
   job=api.startJob(v,id,{message,images,fix},jobDeps);
   await reply(job.support?job.result.message.split('\n')[0]:'🛠️ On it. I will send the new link when it is ready.');
  }
 }catch(e){
  if(e.status===402||/credit/i.test(e.message))return reply('You are out of credits. Get more here: '+c.origin+'/create');
  if(e.status===409)return reply('I am still working on your last message. I will send the link as soon as it is done.');
  return reply('That did not work: '+clip(e.message,300));
 }
 if(!job||job.support)return;
 const wait=deps.wait||(ms=>new Promise(r=>setTimeout(r,ms)));
 for(let i=0;i<900&&!['complete','failed'].includes(job.status);i++)await wait(2000);
 if(job.status!=='complete')return reply('❌ That change did not work'+(job.error?': '+clip(job.error,300):'')+'. Your credits were refunded. Try describing it differently.');
 const meta=builder.loadMeta(id),r=job.result||{};
 const lines=[clip(r.message,700)||'Done.'];
 if(job.problem)lines.push('⚠️ It still shows a problem in the browser. Send *fix it* and the fix is on us.');
 lines.push('👀 Preview: '+c.origin+builder.previewUrl(meta));
 lines.push(meta.published?'Send *publish* to update your live site.':'Send changes, or *publish* to put it live.');
 return reply(lines.join('\n\n'));
}

// ---------- the webhook ----------
function verifySignature(raw,header){
 const c=cfg();if(!c.secret||!header)return false;
 const want=Buffer.from('sha256='+crypto.createHmac('sha256',c.secret).update(raw).digest('hex')),got=Buffer.from(String(header));
 return want.length===got.length&&crypto.timingSafeEqual(want,got);
}
async function handle(req,res,deps={}){
 const url=String(req.url||'').split('?')[0];
 if(url!=='/api/whatsapp/webhook')return false;
 const c=cfg();
 if(!enabled()){res.writeHead(404);res.end();return true}
 if(req.method==='GET'){
  const q=new URL(req.url,'http://x').searchParams;
  const ok=q.get('hub.mode')==='subscribe'&&q.get('hub.verify_token')&&crypto.timingSafeEqual(crypto.createHash('sha256').update(q.get('hub.verify_token')).digest(),crypto.createHash('sha256').update(c.verify).digest());
  res.writeHead(ok?200:403,{'Content-Type':'text/plain'});res.end(ok?String(q.get('hub.challenge')||''):'');return true;
 }
 if(req.method!=='POST'){res.writeHead(405);res.end();return true}
 const chunks=[];let size=0;
 for await(const ch of req){size+=ch.length;if(size>1e6){res.writeHead(413);res.end();return true}chunks.push(ch)}
 const raw=Buffer.concat(chunks);
 if(!verifySignature(raw,req.headers['x-hub-signature-256'])){res.writeHead(401);res.end();return true}
 res.writeHead(200,{'Content-Type':'application/json'});res.end('{"ok":true}');
 let body;try{body=JSON.parse(raw.toString('utf8'))}catch{return true}
 const done=[];
 for(const entry of body.entry||[])for(const ch of entry.changes||[])for(const msg of (ch.value&&ch.value.messages)||[]){
  // Meta retries deliveries: each message is handled once.
  if(!msg.id||seen.has(msg.id))continue;seen.add(msg.id);if(seen.size>5000)for(const k of [...seen].slice(0,1000))seen.delete(k);
  done.push(onMessage(msg,deps).catch(e=>console.warn('[whatsapp]',e.message)));
 }
 if(deps.onHandled)Promise.all(done).then(()=>deps.onHandled());
 return true;
}
module.exports={handle,enabled,chatLink,issueCode,connected,disconnect,onMessage,verifySignature,transcribe,phoneKey,HELP};

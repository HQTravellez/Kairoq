"use strict";
// Kairoq over Telegram: pair once from the signed-in web app, then keep working from Telegram.
// This channel uses the same Kairoq project/job engine as the web chat; it is not a separate agent.
//
// Required environment variables:
//   KAIROQ_TELEGRAM_BOT_TOKEN       token from @BotFather
//   KAIROQ_TELEGRAM_BOT_USERNAME    bot username without @
//   KAIROQ_TELEGRAM_WEBHOOK_SECRET  random A-Z/a-z/0-9/_/- secret sent by Telegram in the webhook header
//   KAIROQ_PUBLIC_URL               public HTTPS Kairoq origin
//
// Webhook:
//   <KAIROQ_PUBLIC_URL>/api/telegram/webhook
const fs=require("fs"),path=require("path"),crypto=require("crypto");

function cfg(){
 return{
  token:String(process.env.KAIROQ_TELEGRAM_BOT_TOKEN||"").trim(),
  username:String(process.env.KAIROQ_TELEGRAM_BOT_USERNAME||"").replace(/^@/,"").trim(),
  secret:String(process.env.KAIROQ_TELEGRAM_WEBHOOK_SECRET||"").trim(),
  api:String(process.env.KAIROQ_TELEGRAM_API||"https://api.telegram.org").replace(/\/$/,""),
  origin:String(process.env.KAIROQ_PUBLIC_URL||(process.env.RAILWAY_PUBLIC_DOMAIN?"https://"+process.env.RAILWAY_PUBLIC_DOMAIN:"")).replace(/\/$/,"")
 };
}
function enabled(){const c=cfg();return Boolean(c.token&&c.username&&c.secret&&c.origin)}
function botLink(start=""){const c=cfg();return c.username?"https://t.me/"+c.username+(start?"?start="+encodeURIComponent(start):""):null}
function dir(){return process.env.KAIROQ_TELEGRAM_DIR||path.join(path.dirname(require("./react-builder").ROOT()),"telegram")}
function chatKey(id){return crypto.createHash("sha256").update("kq-tg:"+String(id)).digest("hex").slice(0,32)}
function load(){try{const d=JSON.parse(fs.readFileSync(path.join(dir(),"state.json"),"utf8"));return{chats:d.chats||{},codes:d.codes||{}}}catch{return{chats:{},codes:{}}}}
function save(d){fs.mkdirSync(dir(),{recursive:true});fs.writeFileSync(path.join(dir(),"state.json"),JSON.stringify(d))}
function clip(v,n){return String(v??"").replace(/\s+/g," ").trim().slice(0,n)}

async function api(method,body={},fetchImpl=fetch){
 const c=cfg(),r=await fetchImpl(c.api+"/bot"+c.token+"/"+method,{
  method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)
 });
 const d=await r.json().catch(()=>null);
 if(!r.ok||!d||d.ok!==true)throw Error((d&&d.description)||("Telegram "+method+" failed: "+r.status));
 return d.result;
}
async function send(chatId,text,{fetchImpl=fetch}={}){
 return api("sendMessage",{chat_id:String(chatId),text:String(text||"").slice(0,4000),disable_web_page_preview:false},fetchImpl);
}
function issueCode(accountId){
 const d=load(),now=Date.now();
 for(const [k,v] of Object.entries(d.codes))if(v.expires<now||v.account===accountId)delete d.codes[k];
 let code;do{code=crypto.randomBytes(9).toString("base64url")}while(d.codes[code]);
 d.codes[code]={account:accountId,expires:now+15*60000};save(d);
 return{code,link:botLink(code),username:cfg().username};
}
function connected(accountId){return Object.values(load().chats).some(x=>x.account===accountId)}
function disconnect(accountId){const d=load();for(const [k,v] of Object.entries(d.chats))if(v.account===accountId)delete d.chats[k];save(d)}
function projectsOf(accountId){return require("./react-builder").list().filter(p=>p.owner===accountId).sort((a,b)=>Date.parse(b.updated_at||0)-Date.parse(a.updated_at||0))}
function viewerFor(accountId){const accounts=require("./builder-accounts"),a=accounts.get(accountId);return a?{kind:"customer",owner:a.id,account:accounts.publicAccount(a)}:null}

const HELP=[
 "Message Kairoq exactly like you do in the app.",
 "",
 "Useful commands:",
 "• projects — show your projects",
 "• switch 2 — work on another project",
 "• new — start a fresh project",
 "• open — one-time link to the full editor",
 "• publish — publish the current project",
 "• undo — restore the previous version",
 "• credits — show your balance",
 "",
 "Or just say what you want done."
].join("\n");
const seen=new Set(),bursts=new Map();

async function onUpdate(update,deps={}){
 const msg=update&&update.message;if(!msg||!msg.chat||msg.chat.type!=="private")return;
 const chatId=String(msg.chat.id),reply=t=>send(chatId,t,deps).catch(()=>{});
 if(update.update_id!=null){const id=String(update.update_id);if(seen.has(id))return;seen.add(id);if(seen.size>6000)for(const k of [...seen].slice(0,1200))seen.delete(k)}
 const now=Date.now(),b=(bursts.get(chatId)||[]).filter(t=>now-t<600000);b.push(now);bursts.set(chatId,b);
 if(b.length>30){if(b.length===31)await reply("You’ve sent a lot at once. Give Kairoq a moment to finish the current work, then send the next change.");return}
 const text=clip(msg.text||msg.caption,3000);if(!text)return reply("For now, send Kairoq a text message describing what you want done.");
 const d=load(),key=chatKey(chatId),st=d.chats[key]||(d.chats[key]={stage:"unpaired",project:null,at:new Date().toISOString()});
 const accounts=require("./builder-accounts");

 const start=/^\/start(?:\s+([A-Za-z0-9_-]{4,64}))?$/i.exec(text);
 const link=/^link\s+([A-Za-z0-9_-]{4,64})$/i.exec(text);
 const pairing=(start&&start[1])||(link&&link[1])||"";
 if(pairing){
  const code=d.codes[pairing];
  if(!code||code.expires<Date.now()){delete d.codes[pairing];save(d);return reply("That connection link has expired. Open Kairoq once, choose Telegram, and press Connect again.");}
  const account=accounts.get(code.account);
  if(!account){delete d.codes[pairing];save(d);return reply("That Kairoq account is no longer available.");}
  delete d.codes[pairing];
  for(const [k,v] of Object.entries(d.chats))if(v.account===code.account&&k!==key)delete d.chats[k];
  Object.assign(st,{account:code.account,stage:"ready",project:null,paired_at:new Date().toISOString()});save(d);
  return reply("Connected to Kairoq. You can use this chat from now on — tell me what you want to get done.");
 }
 if(!st.account){
  save(d);
  return reply("Connect this Telegram chat to Kairoq first. Sign in to Kairoq once, open Telegram in the sidebar, and press Connect. After that you can keep working from here without signing in each time.");
 }
 if(/^\/start$/i.test(text))return reply("You’re already connected to Kairoq. Tell me what you want to get done, or send “help”.");
 return command(chatId,st,d,text,deps);
}

async function command(chatId,st,d,text,deps){
 const reply=t=>send(chatId,t,deps).catch(()=>{}),c=cfg(),builder=require("./react-builder"),create=require("./create-api"),accounts=require("./builder-accounts");
 const account=accounts.get(st.account);
 if(!account){delete d.chats[chatKey(chatId)];save(d);return reply("Your Kairoq account could not be found. Reconnect Telegram from the Kairoq web app.");}
 const t=text.trim(),lower=t.toLowerCase(),list=projectsOf(account.id);
 if(st.project&&!list.some(p=>p.id===st.project))st.project=null;
 const current=st.project||(list[0]&&list[0].id)||null;
 if(/^(help|menu|\?|commands|\/help)$/.test(lower))return reply(HELP);
 if(/^(credits|balance|\/credits)$/.test(lower))return reply("You have "+account.credits+" credits.");
 if(/^(projects|apps|my apps|list|\/projects)$/.test(lower)){
  if(!list.length)return reply("You don’t have a project yet. Tell me what you want Kairoq to build.");
  return reply("Your projects:\n"+list.slice(0,9).map((p,i)=>(i+1)+". "+p.name+(p.id===current?"  ← current":"")).join("\n")+"\n\nSend “switch 2” to change project.");
 }
 const sw=/^(?:switch|use|open app|app)\s+(\d)$/i.exec(t);
 if(sw){const p=list[Number(sw[1])-1];if(!p)return reply("There isn’t a project "+sw[1]+". Send “projects” to see the list.");st.project=p.id;save(d);return reply("Now working on “"+p.name+"”. What should Kairoq do?")}
 const nw=/^(?:new|\/new)\b[:\s-]*(.*)$/i.exec(t);
 if(nw){st.project=null;st.fresh=true;save(d);if(nw[1].trim().length>3)return build(chatId,account.id,nw[1].trim(),deps,{fresh:true});return reply("Starting fresh. Tell me the outcome you want.");}
 if(/^(open|editor|link|\/open)$/.test(lower)){
  const token=accounts.loginToken(account.id);
  return reply("Open the full Kairoq editor — this one-time link works for 15 minutes:\n"+c.origin+"/api/create/auth/link?token="+encodeURIComponent(token)+(current?"&project="+current:""));
 }
 if(!current&&/^(publish|undo)$/.test(lower))return reply("There isn’t a current project yet. Tell Kairoq what you want to build.");
 if(lower==="publish"){
  try{const out=await create.publishProject(current,{},{inspect:deps.inspect,screenshot:deps.screenshot,renderSite:deps.renderSite,callModel:deps.callModel});return reply("Published: "+out.urls.path)}
  catch(e){return reply("I couldn’t publish it: "+clip(e.message,350))}
 }
 if(lower==="undo"){
  const meta=builder.loadMeta(current),prev=meta.versions.filter(v=>v.n<meta.current_version).at(-1);
  if(!prev)return reply("This is already the first version.");
  builder.restore(current,prev.n);return reply("Restored version "+prev.n+". Preview: "+c.origin+builder.previewUrl(builder.loadMeta(current)));
 }
 if(/^fix(?: it| this| the errors?)?[.!]*$/.test(lower))return build(chatId,account.id,"Fix the errors the browser shows without changing what already works.",deps,{fix:true});
 return build(chatId,account.id,t,deps,{fresh:Boolean(st.fresh)});
}

async function build(chatId,accountId,message,deps,{fresh=false,fix=false}={}){
 const reply=t=>send(chatId,t,deps).catch(()=>{}),c=cfg(),builder=require("./react-builder"),create=require("./create-api"),v=viewerFor(accountId);if(!v)return;
 const d=load(),st=d.chats[chatKey(chatId)],list=projectsOf(accountId);
 let id=fresh?null:(st.project||(list[0]&&list[0].id)||null),job;
 const jobDeps={
  callModel:deps.callModel,checkRuntime:deps.checkRuntime,inspect:deps.inspect,webSearch:deps.webSearch,browseSite:deps.browseSite,
  designShots:deps.designShots,generateImage:deps.generateImage,reviewLook:deps.reviewLook,screenshot:deps.screenshot,renderSite:deps.renderSite
 };
 try{
  if(!id){
   const r=await create.createProject(v,{prompt:message,images:[]},jobDeps);id=r.meta.id;job=r.job;st.project=id;delete st.fresh;save(d);
   await reply("I’m on it — building “"+r.meta.name+"”. I’ll send the result here when it’s ready.");
  }else{
   job=create.startJob(v,id,{message,images:[],fix},jobDeps);
   if(job.support)return reply(job.result.message);
   await reply("On it. I’ll test the result and send it here when it’s ready.");
  }
 }catch(e){
  if(e.status===402||/credit/i.test(e.message))return reply("You’re out of Kairoq credits. Open the editor to add more: "+c.origin+"/create");
  if(e.status===409)return reply("Kairoq is still working on the previous request. I’ll send the result when that finishes.");
  return reply("Sorry — that request did not start correctly. "+clip(e.message,320));
 }
 const wait=deps.wait||(ms=>new Promise(r=>setTimeout(r,ms)));
 for(let i=0;i<900&&!["complete","failed"].includes(job.status);i++)await wait(2000);
 if(job.status!=="complete")return reply("Sorry — that run did not finish successfully"+(job.error?": "+clip(job.error,320):".")+" The project was not marked complete.");
 const meta=builder.loadMeta(id),r=job.result||{},lines=[clip(r.message,1000)||"Done."];
 lines.push("Preview: "+c.origin+builder.previewUrl(meta));
 if(job.problem)lines.push("Kairoq still sees a problem in verification. Send “fix it” and I’ll repair it.");
 return reply(lines.join("\n\n"));
}

function secretOk(header){
 const want=Buffer.from(cfg().secret),got=Buffer.from(String(header||""));
 return want.length===got.length&&crypto.timingSafeEqual(want,got);
}
async function handle(req,res,deps={}){
 const url=String(req.url||"").split("?")[0];if(url!=="/api/telegram/webhook")return false;
 if(!enabled()){res.writeHead(404);res.end();return true}
 if(req.method!=="POST"){res.writeHead(405);res.end();return true}
 if(!secretOk(req.headers["x-telegram-bot-api-secret-token"])){res.writeHead(401);res.end();return true}
 const chunks=[];let size=0;
 for await(const ch of req){size+=ch.length;if(size>1000000){res.writeHead(413);res.end();return true}chunks.push(ch)}
 let body;try{body=JSON.parse(Buffer.concat(chunks).toString("utf8"))}catch{res.writeHead(400);res.end();return true}
 res.writeHead(200,{"Content-Type":"application/json"});res.end('{"ok":true}');
 setImmediate(()=>onUpdate(body,deps).catch(e=>console.warn("[telegram-kairoq]",e.message)));
 return true;
}
async function configureWebhook({fetchImpl=fetch}={}){
 const c=cfg();if(!enabled())throw Error("Kairoq Telegram is not configured");
 return api("setWebhook",{url:c.origin+"/api/telegram/webhook",secret_token:c.secret,allowed_updates:["message"],drop_pending_updates:false},fetchImpl);
}

module.exports={cfg,enabled,botLink,issueCode,connected,disconnect,onUpdate,handle,configureWebhook,secretOk,chatKey,HELP};

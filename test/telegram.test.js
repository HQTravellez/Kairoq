"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"kairoq-tg-"));
process.env.NODE_ENV="test";
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,"projects");
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,"accounts.sqlite");
process.env.KAIROQ_HOSTING_REGISTRY=path.join(tmp,"hosting.json");
process.env.KAIROQ_TELEGRAM_DIR=path.join(tmp,"telegram");
process.env.KAIROQ_MEMORY_DIR=path.join(tmp,"memory");
process.env.KAIROQ_LEARNING_DIR=path.join(tmp,"learning");
process.env.KAIROQ_RUNTIME_CHECK="off";
process.env.KAIROQ_DESIGN_BRIEF="off";
process.env.KAIROQ_WEB_RESEARCH="off";
process.env.KAIROQ_PUBLIC_URL="https://kairoq.example";
process.env.KAIROQ_FREE_CREDITS="20";
Object.assign(process.env,{
 KAIROQ_TELEGRAM_BOT_TOKEN:"123:TEST",
 KAIROQ_TELEGRAM_BOT_USERNAME:"KairoqTestBot",
 KAIROQ_TELEGRAM_WEBHOOK_SECRET:"secret_ABC-123"
});
const tg=require("../telegram"),accounts=require("../builder-accounts"),builder=require("../react-builder");

const fakeCreateApi={
 async createProject(v,{prompt}={}){
  const meta=builder.create({name:String(prompt||"Telegram project").slice(0,80),owner:v.owner});
  await builder.initialize(meta);
  return{meta:builder.loadMeta(meta.id),job:{status:"complete",support:false,result:{message:"Built through the Kairoq project engine."}}};
 },
 startJob(v,id,{message}={}){
  return{status:"complete",support:false,result:{message:"Updated through the Kairoq project engine: "+String(message||"").slice(0,80)}};
 },
 async publishProject(){return{urls:{path:"https://kairoq.example/sites/test/"}}}
};
const sent=[],apiCalls=[];
const fetchImpl=async(url,opts={})=>{
 apiCalls.push({url,body:opts.body?JSON.parse(opts.body):null});
 if(url.endsWith("/sendMessage")){
  const body=JSON.parse(opts.body);sent.push(body);
  return{ok:true,status:200,json:async()=>({ok:true,result:{message_id:sent.length}})};
 }
 if(url.endsWith("/setWebhook"))return{ok:true,status:200,json:async()=>({ok:true,result:true})};
 throw Error("unexpected Telegram API call "+url);
};
const deps={fetchImpl,createApi:fakeCreateApi,wait:()=>new Promise(r=>setTimeout(r,1))};

test.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));

test("Telegram config and webhook secret are deterministic",()=>{
 assert.equal(tg.enabled(),true);
 assert.equal(tg.botLink(),"https://t.me/KairoqTestBot");
 assert.equal(tg.secretOk("secret_ABC-123"),true);
 assert.equal(tg.secretOk("wrong"),false);
});

let accountId="";
test("a signed-in Kairoq account gets a one-time Telegram deep link",()=>{
 const s=accounts.signup("telegram@example.com","password1");
 accountId=s.account.id;
 accounts.grantFreeCredits(accountId);
 const pair=tg.issueCode(accountId);
 assert.match(pair.code,/^[A-Za-z0-9_-]{8,20}$/);
 assert.equal(pair.link,"https://t.me/KairoqTestBot?start="+pair.code);
 assert.equal(pair.username,"KairoqTestBot");
 assert.equal(tg.connected(accountId),false);
});

test("private Telegram chat pairs once, never stores the raw chat id, then builds through Kairoq",async()=>{
 const state=JSON.parse(fs.readFileSync(path.join(tmp,"telegram","state.json"),"utf8"));
 const code=Object.keys(state.codes)[0];
 await tg.onUpdate({update_id:1,message:{chat:{id:987654321,type:"private"},text:"/start "+code}},deps);
 assert.match(sent.at(-1).text,/Connected to Kairoq/);
 assert.equal(tg.connected(accountId),true);
 const raw=fs.readFileSync(path.join(tmp,"telegram","state.json"),"utf8");
 assert.ok(!raw.includes("987654321"),"raw Telegram chat id must not be stored");

 const before=sent.length;
 await tg.onUpdate({update_id:2,message:{chat:{id:987654321,type:"private"},text:"new: a simple booking dashboard"}},deps);
 const replies=sent.slice(before).map(x=>x.text);
 assert.match(replies[0],/I’m on it/);
 assert.match(replies.at(-1),/Built through the Kairoq project engine[\s\S]*Preview:/);
 assert.ok(builder.list().some(p=>/simple booking dashboard/i.test(p.name)));
});

test("Telegram project commands use the same account project state",async()=>{
 const before=sent.length;
 await tg.onUpdate({update_id:3,message:{chat:{id:987654321,type:"private"},text:"projects"}},deps);
 assert.match(sent.slice(before).at(-1).text,/Your projects:/);

 await tg.onUpdate({update_id:4,message:{chat:{id:987654321,type:"private"},text:"open"}},deps);
 assert.match(sent.at(-1).text,/https:\/\/kairoq\.example\/api\/create\/auth\/link\?token=/);
});

test("unpaired and group chats cannot operate Kairoq projects",async()=>{
 const before=sent.length;
 await tg.onUpdate({update_id:5,message:{chat:{id:111222333,type:"private"},text:"Build me a CRM"}},deps);
 assert.match(sent.slice(before).at(-1).text,/Connect this Telegram chat to Kairoq first/);
 const count=sent.length;
 await tg.onUpdate({update_id:6,message:{chat:{id:-100123,type:"supergroup"},text:"Build me a CRM"}},deps);
 assert.equal(sent.length,count);
});

test("configureWebhook uses Telegram secret-token verification and Kairoq endpoint",async()=>{
 await tg.configureWebhook({fetchImpl});
 const call=apiCalls.find(x=>x.url.endsWith("/setWebhook"));
 assert.equal(call.body.url,"https://kairoq.example/api/telegram/webhook");
 assert.equal(call.body.secret_token,"secret_ABC-123");
 assert.deepEqual(call.body.allowed_updates,["message"]);
});

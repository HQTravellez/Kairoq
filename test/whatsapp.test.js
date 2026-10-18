"use strict";
// Build from WhatsApp: sign up from the chat, build and change apps with text, voice notes and
// photos, get links back, link a web account, and only signed webhook calls are accepted.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http'),crypto=require('crypto');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-wa-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
process.env.KAIROQ_HOSTING_REGISTRY=path.join(tmp,'hosting.json');
process.env.KAIROQ_WHATSAPP_DIR=path.join(tmp,'wa');
process.env.KAIROQ_MEMORY_DIR=path.join(tmp,'memory');
process.env.KAIROQ_LEARNING_DIR=path.join(tmp,'learning');
process.env.KAIROQ_FREE_CREDITS='12';
process.env.KAIROQ_HOSTING_CREDITS='5';
process.env.KAIROQ_RUNTIME_CHECK='off';
process.env.KAIROQ_DESIGN_BRIEF='off';
process.env.KAIROQ_WEB_RESEARCH='off';
process.env.KAIROQ_PUBLIC_URL='https://kairoq.example';
Object.assign(process.env,{KAIROQ_WHATSAPP_TOKEN:'tok',KAIROQ_WHATSAPP_PHONE_ID:'555',KAIROQ_WHATSAPP_VERIFY_TOKEN:'verify-me',KAIROQ_WHATSAPP_APP_SECRET:'app-secret',KAIROQ_WHATSAPP_NUMBER:'+971 50 123 4567'});
const builder=require('../react-builder'),createApi=require('../create-api'),wa=require('../whatsapp'),hosting=require('../react-hosting');

let n=0;
const callModel=async(opts,parse)=>{n++;return parse(JSON.stringify({plan:[],message:'Built version '+n+' of your salon page.',files:{'src/App.jsx':'export default function App() { return <h1>Salon '+n+'</h1>; }\n'}}))};
const sent=[];
const fetchImpl=async(url,opts={})=>{
 if(url==='https://graph.facebook.com/v21.0/555/messages'){const b=JSON.parse(opts.body);assert.equal(opts.headers.Authorization,'Bearer tok');sent.push({to:b.to,text:b.text.body});return{ok:true,status:200,json:async()=>({})}}
 if(url==='https://graph.facebook.com/v21.0/VOICE1')return{ok:true,json:async()=>({url:'https://media.example/voice',mime_type:'audio/ogg; codecs=opus',file_size:1000})};
 if(url==='https://graph.facebook.com/v21.0/PHOTO1')return{ok:true,json:async()=>({url:'https://media.example/photo',mime_type:'image/jpeg',file_size:1000})};
 if(url.startsWith('https://media.example/'))return{ok:true,arrayBuffer:async()=>url.endsWith('voice')?Buffer.from('OggS-audio'):JPEG};
 throw Error('unexpected fetch '+url);
};
const JPEG=Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=','base64');
const transcribeImpl=async a=>{assert.equal(a.mime,'audio/ogg');return 'Make the buttons green please'};
let server,pending=[];
const deps={callModel,fetchImpl,transcribeImpl,wait:ms=>new Promise(r=>setTimeout(r,10)),onHandled:()=>{}};
function request(method,url,{body,raw,headers={}}={}){
 return new Promise((resolve,reject)=>{
  const payload=raw!==undefined?Buffer.from(raw):body!==undefined?Buffer.from(JSON.stringify(body)):null;
  const r=http.request({host:'127.0.0.1',port:server.address().port,method,path:url,headers:{...(payload?{'Content-Type':'application/json','Content-Length':payload.length}:{}),...headers}},res=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>{const text=Buffer.concat(c).toString();let json=null;try{json=JSON.parse(text)}catch{}resolve({status:res.statusCode,headers:res.headers,text,json})})});
  r.on('error',reject);if(payload)r.write(payload);r.end();
 });
}
test.before(async()=>{
 server=http.createServer(async(req,res)=>{
  if(req.url.startsWith('/api/whatsapp/')){const done=new Promise(r=>{deps.onHandled=r});pending.push(done);if(await wa.handle(req,res,deps))return}
  if(builder.handlePreview(req,res))return;if(hosting.handlePath(req,res))return;
  if(await createApi.handle(req,res,{isOwner:()=>false,callModel,secure:false}))return;res.writeHead(404);res.end();
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
});
test.after(()=>{server.close();fs.rmSync(tmp,{recursive:true,force:true})});

let mid=0;
async function message(from,m){
 const body=JSON.stringify({object:'whatsapp_business_account',entry:[{changes:[{value:{messages:[{id:'wamid.'+(++mid),from,...m}]}}]}]});
 const sig='sha256='+crypto.createHmac('sha256','app-secret').update(body).digest('hex');
 const before=sent.length;
 pending=[];const r=await request('POST','/api/whatsapp/webhook',{raw:body,headers:{'x-hub-signature-256':sig}});
 assert.equal(r.status,200);await Promise.all(pending);
 return sent.slice(before).filter(x=>x.to===from).map(x=>x.text);
}
const say=(from,text)=>message(from,{type:'text',text:{body:text}});

test('Meta can verify the webhook; unsigned or wrongly signed calls are refused',async()=>{
 assert.equal((await request('GET','/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=12345')).text,'12345');
 assert.equal((await request('GET','/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=1')).status,403);
 const body=JSON.stringify({entry:[]});
 assert.equal((await request('POST','/api/whatsapp/webhook',{raw:body})).status,401);
 assert.equal((await request('POST','/api/whatsapp/webhook',{raw:body,headers:{'x-hub-signature-256':'sha256='+'0'.repeat(64)}})).status,401);
});

test('a new number signs up with an email, gets free credits, and the first request is built with the link sent back',async()=>{
 const phone='971501112233';
 let r=await say(phone,'A booking page for my salon with prices and opening hours');
 assert.match(r[0],/reply with your \*email address\*[\s\S]*right after/);
 r=await say(phone,'Not an email');
 assert.match(r[0],/email address/);
 r=await say(phone,'Salon@Example.com');
 assert.match(r[0],/account is ready with 12 free credits[\s\S]*Starting on what you asked for/);
 assert.match(r[1],/Building \*A booking page for my salon/);
 assert.match(r[2],/Built version 1 of your salon page[\s\S]*Preview: https:\/\/kairoq\.example\/builder\/p\/[a-f0-9]{12}-[a-f0-9]{24}\/v\/2\/[\s\S]*publish/);
 // The preview link really opens.
 const preview=new URL(r[2].match(/https:\/\/kairoq\.example(\/builder\/\S+)/)[0]).pathname;
 assert.equal((await request('GET',preview)).status,200);
 // The phone number is never stored in clear.
 assert.ok(!fs.readFileSync(path.join(tmp,'wa','state.json'),'utf8').includes(phone));
 // Meta retries the same delivery: handled once.
 const body=JSON.stringify({entry:[{changes:[{value:{messages:[{id:'wamid.dupe',from:phone,type:'text',text:{body:'credits'}}]}}]}]});
 const sig='sha256='+crypto.createHmac('sha256','app-secret').update(body).digest('hex');
 const before=sent.length;
 for(let i=0;i<2;i++){pending=[];await request('POST','/api/whatsapp/webhook',{raw:body,headers:{'x-hub-signature-256':sig}});await Promise.all(pending)}
 assert.equal(sent.length-before,1);assert.match(sent.at(-1).text,/You have 11 credits/);
});

test('changes, voice notes, photos and commands from the chat',async()=>{
 const phone='971501112233';
 let r=await say(phone,'Add a gallery section');
 assert.match(r[0],/On it/);assert.match(r[1],/Built version 2[\s\S]*\/v\/3\//);
 // A voice note is read back first; nothing is built until it is confirmed.
 r=await message(phone,{type:'audio',audio:{id:'VOICE1'}});
 assert.equal(r.length,1);assert.match(r[0],/^🎙️ I heard: "Make the buttons green please"[\s\S]*Reply \*OK\*/);
 r=await say(phone,'OK');
 assert.match(r[0],/On it/);assert.match(r[1],/Built version 3[\s\S]*\/v\/4\//);
 assert.match(builder.loadMeta(builder.list().find(p=>p.name.startsWith('A booking page')).id).messages.at(-2).text,/Make the buttons green please/);
 r=await message(phone,{type:'image',image:{id:'PHOTO1',caption:'Make it look like this'}});
 assert.match(r[1],/\/v\/5\//);
 const id=builder.list().find(p=>p.name.startsWith('A booking page')).id;
 assert.match(builder.loadMeta(id).messages.at(-2).text,/Make it look like this/);
 assert.equal(builder.loadMeta(id).messages.at(-2).images.length,1);
 r=await say(phone,'undo');assert.match(r[0],/Back to version 4/);
 assert.equal(builder.loadMeta(id).current_version,4);
 r=await say(phone,'publish');assert.match(r[0],/Live: https:\/\/kairoq\.example\/sites\/[a-z0-9-]+\/[\s\S]*Hosting: 5 credits for 30 days/);
 r=await say(phone,'new: a menu site for my cafe in Dubai');
 assert.match(r[0],/Building \*a menu site for my cafe/);assert.match(r[1],/Preview/);
 r=await say(phone,'projects');assert.match(r[0],/1\. a menu site for my cafe in Dubai  ← current\n2\. A booking page/);
 r=await say(phone,'switch 2');assert.match(r[0],/Now working on \*A booking page/);
 r=await say(phone,'help');assert.match(r[0],/publish[\s\S]*undo[\s\S]*open/);
 // "open": a one-time link into the full editor.
 r=await say(phone,'open');
 const link=new URL(r[0].match(/https:\/\/kairoq\.example\/\S+/)[0]);
 const first=await request('GET',link.pathname+link.search);
 assert.equal(first.status,302);assert.equal(first.headers.location,'/create?project='+id);assert.match(first.headers['set-cookie'][0],/^kq_builder=/);
 const again=await request('GET',link.pathname+link.search);
 assert.match(again.headers.location,/auth_error=/);
});

test('a web account connects with a code; an email that already has an account is not taken over',async()=>{
 const s=await request('POST','/api/create/signup',{body:{email:'web@example.com',password:'password1'},headers:{'x-forwarded-for':'10.2.2.1'}});
 const cookie=s.headers['set-cookie'][0].split(';')[0];
 assert.equal((await request('GET','/api/create/whatsapp',{headers:{cookie}})).json.whatsapp.connected,false);
 // Someone on WhatsApp who types that email is told to link instead.
 await say('447700900123','hello');
 let r=await say('447700900123','web@example.com');
 assert.match(r[0],/already has a Kairoq account[\s\S]*link 123456/);
 const code=(await request('POST','/api/create/whatsapp/code',{headers:{cookie}})).json;
 assert.match(code.code,/^\d{6}$/);assert.equal(code.link,'https://wa.me/971501234567?text=link%20'+code.code);
 r=await say('447700900123','link 000000');assert.match(r[0],/expired/);
 r=await say('447700900123','link '+code.code);assert.match(r[0],/Connected to your Kairoq account \(web@example.com\)/);
 assert.equal((await request('GET','/api/create/whatsapp',{headers:{cookie}})).json.whatsapp.connected,true);
 r=await say('447700900123','link '+code.code);assert.match(r[0],/expired/,'a code works once');
 await request('POST','/api/create/whatsapp/disconnect',{headers:{cookie}});
 assert.equal((await request('GET','/api/create/whatsapp',{headers:{cookie}})).json.whatsapp.connected,false);
 assert.match((await say('447700900123','hi again'))[0],/email address/);
});

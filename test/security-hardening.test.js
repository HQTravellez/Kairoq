'use strict';
// Regression tests for the security hardening pass.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-sec-'));
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(root,'projects');process.env.KAIROQ_BUILD_WORKERS='0';
const builder=require('../react-builder'),functions=require('../react-functions');

const MAIN="import React from 'react';import {createRoot} from 'react-dom/client';import App from './App.jsx';createRoot(document.getElementById('root')).render(<App/>);";
async function leaks(app){
 const canary=path.join(root,'canary.txt');fs.writeFileSync(canary,'SECRET-CANARY-'+Math.random());
 const out=path.join(root,'out-'+Math.random().toString(36).slice(2));
 let error=null;try{await builder.build({'src/main.jsx':MAIN,'src/App.jsx':app(canary)},out,{})}catch(e){error=e}
 let leaked=false;try{for(const f of fs.readdirSync(out,{recursive:true})){const p=path.join(out,f);if(fs.statSync(p).isFile()&&fs.readFileSync(p,'utf8').includes('SECRET-CANARY'))leaked=true}}catch{}
 return{error,leaked};
}
test('the build refuses imports of files outside the project, however they are written',async()=>{
 for(const app of [c=>`import $e from '${c}?raw';export default function App(){return $e}`,c=>`import $e from '${c}';export default function App(){return String($e)}`,c=>`import é from '../../../../../../..${c}';export default function App(){return String(é)}`]){
  const r=await leaks(app);
  assert.equal(r.leaked,false,'server file must not reach the bundle');
  assert.ok(r.error,'the build must fail');
 }
 // Ordinary code still builds.
 const ok=await leaks(()=>`import {useState} from 'react';export default function App(){const [n]=useState(1);return <p>{n}</p>}`);
 assert.equal(ok.error,null);
});
test('private addresses in every IPv4/IPv6 form are blocked',()=>{
 for(const a of ['127.0.0.1','10.1.2.3','169.254.169.254','0.0.0.0','::1','::ffff:7f00:1','::7f00:1','::ffff:a9fe:a9fe','2002:7f00:1::','2001:0:4136::1','fd00:ec2::254','fe80::1'])assert.equal(functions.privateAddress(a),true,a);
 for(const a of ['8.8.8.8','1.1.1.1','2606:4700::1111','2001:4860:4860::8888'])assert.equal(functions.privateAddress(a),false,a);
});
test('function redirects stay on the app unless it has its own domain',()=>{
 const fake=()=>{const r={};return{writeHead(s,h){r.status=s;r.headers=h},end(){},r}};
 let res=fake();functions.respond(res,{status:302,headers:{location:'https://evil.example/'}},{});assert.equal(res.r.headers.Location,undefined);
 res=fake();functions.respond(res,{status:302,headers:{location:'//evil.example/'}},{});assert.equal(res.r.headers.Location,undefined);
 res=fake();functions.respond(res,{status:302,headers:{location:'/thanks'}},{});assert.equal(res.r.headers.Location,'/thanks');
 res=fake();functions.respond(res,{status:302,headers:{location:'https://pay.example/'}},{},{externalRedirects:true});assert.equal(res.r.headers.Location,'https://pay.example/');
});
test('a server function cannot make unlimited host calls',async()=>{
 const source="export default async function(req,{db}){let ok=0,limited=0;for(let i=0;i<260;i++){try{await db.collection('x').list();ok++}catch(e){if(/At most/.test(e.message))limited++}}return {json:{ok,limited}}}";
 const host={db:async()=>[],secret:async()=>null,ai:async()=>({}),email:async()=>({})};
 const {result}=await functions.run({source,request:{},user:null,host});
 assert.equal(result.json.ok,200);assert.equal(result.json.limited,60);
});
test.after(()=>fs.rmSync(root,{recursive:true,force:true}));

test('the app security scan catches unsafe HTML, open redirects, trusting the request body and guessable codes',()=>{
 const scan=require('../react-security').scan;
 const titles=files=>scan(files,{collections:{}}).map(f=>f.title);
 const bad=titles({'src/App.jsx':"box.innerHTML = note; window.location.href = new URLSearchParams(location.search).get('next'); window.addEventListener('message', e => run(e.data));",
  'functions/order.js':"export default async function(request,{db,user,crypto}){ if(!user) return {status:401}; const code=Math.random().toString(36).slice(2); if(request.headers.signature !== secret) return {status:400}; await db.collection('orders').create(request.body); return {json:{code}} }",
  'functions/report.py':'async def handler(r, ctx):\n    return await ctx.db.sql(f"SELECT * FROM orders WHERE id={r[\'body\'][\'id\']}")\n'});
 for(const t of ['HTML is written into the page directly','The page sends visitors to an address taken from the link','Messages from other sites are trusted','Function saves whatever the visitor sends','Codes or tokens are made with Math.random','A secret is compared with ===','SQL built from strings'])assert.ok(bad.includes(t),t+' in '+bad.join(' | '));
 const good=titles({'src/App.jsx':"export default function App(){return <a href='/menu' rel='noopener noreferrer'>Menu</a>}",
  'functions/order.js':"export default async function(request,{db,user,crypto}){ if(!user) return {status:401}; const b=request.body; if(!crypto.timingSafeEqual(String(request.headers.signature),String(expected)))return {status:400}; await db.collection('orders').create({item:String(b.item).slice(0,80),qty:Math.max(1,Math.floor(Number(b.qty)||1)),owner:user.id}); return {json:{id:crypto.randomId()}} }"});
 assert.deepEqual(good,[]);
});

test('a change that adds a serious security mistake goes back to the AI once before it is built',async()=>{
 const meta=builder.create({name:'Gate',owner:'owner'});
 await builder.initializeFrom(meta,{'src/main.jsx':MAIN,'src/App.jsx':'export default function App(){return <p>hi</p>}\n'},'Start');
 const asks=[];
 const replies=[{message:'v',files:{'src/App.jsx':"const KEY='sk_live_abcdefghijklmnop1234';export default function App(){return <p>{KEY.length}</p>}\n"}},{message:'v',files:{'src/App.jsx':'export default function App(){return <p>safe</p>}\n'}}];
 const callModel=(o,parse)=>{asks.push(o.messages[o.messages.length-1].content);return Promise.resolve(parse(JSON.stringify(replies.shift())))};
 const r=await builder.edit(meta.id,'show the key',{callModel});
 assert.equal(asks.length,2);assert.match(asks[1],/security scan found serious problems[\s\S]*Secret exposed in the app code/);
 assert.match(builder.loadFiles(meta.id,r.version)['src/App.jsx'],/safe/);
});

test('logic checks: another customer\'s record, staff-only functions, the last place, prices and AI instructions from the visitor',()=>{
 const scan=require('../react-security').scan,titles=f=>scan(f,{collections:{}}).map(x=>x.title);
 const fn=body=>"export default async function(request,{db,user,payments}){ if(!user) return {status:401}; "+body+" }";
 assert.ok(titles({'functions/booking.js':fn("return {json:await db.collection('bookings').get(request.body.id)}")}).includes('Any signed-in user can open or change any record'));
 assert.deepEqual(titles({'functions/booking.js':fn("const b=await db.collection('bookings').get(request.body.id); if(b.owner!==user.id) return {status:403}; return {json:b}")}),[]);
 assert.ok(titles({'functions/admin-export.js':fn("return {json:await db.collection('orders').list()}")}).includes('Staff-only function open to every signed-in user'));
 assert.deepEqual(titles({'functions/admin-export.js':fn("if(user.role!=='staff') return {status:403}; return {json:await db.collection('orders').list()}")}),[]);
 assert.ok(titles({'functions/book.js':fn("const taken=await db.collection('bookings').list({where:{slot:request.body.slot}}); if(taken.length>=capacity) return {status:409}; await db.collection('bookings').create({slot:String(request.body.slot),owner:user.id}); return {json:{ok:true}}")}).includes('Two customers can take the last place at the same time'));
 assert.ok(titles({'functions/checkout.js':fn("return {json:await payments.checkout({amount:request.body.amount})}")}).includes('The price comes from the visitor'));
 assert.ok(titles({'src/Chat.jsx':'const r=await ai.chat({ system: `You are helpful. ${input}`, messages:[] })'}).includes('Visitor text is used as instructions for the AI'));
 assert.deepEqual(titles({'src/Chat.jsx':"const r=await ai.chat({ system:'You answer about our bakery.', messages:[{role:'user',content:input}] })"}),[]);
 assert.ok(titles({'src/Up.jsx':'await storage.upload(file)'}).includes('Uploads accept any kind of file'));
 assert.deepEqual(titles({'src/Up.jsx':"if(!file.type.startsWith('image/')||file.size>5e6)return; await storage.upload(file)"}),[]);
});

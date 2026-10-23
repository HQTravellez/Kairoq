"use strict";
// "I can't see the website": answered for free, without touching the code or the model.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-support-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
process.env.KAIROQ_FREE_CREDITS='10';
process.env.KAIROQ_RUNTIME_CHECK='off';
process.env.KAIROQ_DESIGN_BRIEF='off';
const builder=require('../react-builder'),createApi=require('../create-api'),backend=require('../react-backend');
const MAIN="import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App.jsx';\ncreateRoot(document.getElementById('root')).render(<App />);\n";
const OK="export default function App() { return <h1>Stillroom Yoga</h1>; }\n";
let modelCalls=0;
const callModel=async(opts,parse)=>{modelCalls++;const sys=opts.messages[0].content;if(/decide what to look up/.test(sys))return parse('{"web":[]}');return parse(JSON.stringify({plan:[],message:'Changed the title.',files:{'src/App.jsx':OK.replace('Stillroom','Sunrise')}}))};
function request(server,method,url,{body,headers={}}={}){
 return new Promise((resolve,reject)=>{
  const payload=body!==undefined?Buffer.from(JSON.stringify(body)):null;
  const req=http.request({host:'127.0.0.1',port:server.address().port,method,path:url,headers:{...(payload?{'Content-Type':'application/json','Content-Length':payload.length}:{}),...headers}},res=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>{const text=Buffer.concat(c).toString();let json=null;try{json=JSON.parse(text)}catch{}resolve({status:res.statusCode,headers:res.headers,text,json})})});
  req.on('error',reject);if(payload)req.write(payload);req.end();
 });
}
let server,ip=0;
test.before(async()=>{server=http.createServer(async(req,res)=>{if(await backend.handle(req,res))return;if(builder.handlePreview(req,res))return;if(await createApi.handle(req,res,{isOwner:()=>false,callModel,secure:false}))return;res.writeHead(404);res.end()});await new Promise(r=>server.listen(0,'127.0.0.1',r))});
test.after(()=>{server.close();fs.rmSync(tmp,{recursive:true,force:true})});
async function signup(email){const r=await request(server,'POST','/api/create/signup',{body:{email,password:'password1'},headers:{'x-forwarded-for':'10.5.0.'+(++ip)}});return r.headers['set-cookie'][0].split(';')[0]}
async function waitJob(cookie,job){for(let i=0;i<600;i++){const j=(await request(server,'GET','/api/create/jobs/'+job.id,{headers:{cookie}})).json.job;if(['complete','failed'].includes(j.status))return j;await new Promise(r=>setTimeout(r,50))}throw Error('job did not finish')}
const credits=async cookie=>(await request(server,'GET','/api/create/credits',{headers:{cookie}})).json.account.credits;

test('"I can\'t see the website" gets a free answer with what to check; a real change still builds',async()=>{
 const cookie=await signup('see@example.com');
 const id=(await request(server,'POST','/api/create/projects',{headers:{cookie},body:{name:'Yoga'}})).json.project.id;
 await builder.saveSource(id,{'src/main.jsx':MAIN,'src/App.jsx':OK},{summary:'Start'});
 const c0=await credits(cookie),versions=builder.loadMeta(id).versions.length;
 for(const msg of ['I cant see the website','I cant see the preview','no I want to see the website','the page is blank','Why is the app not showing?']){
  const j=await waitJob(cookie,(await request(server,'POST','/api/create/projects/'+id+'/chat',{headers:{cookie},body:{message:msg}})).json.job);
  assert.equal(j.status,'complete',msg);assert.equal(j.support,true,msg);assert.equal(j.credits,0,msg);assert.equal(j.result.unchanged,true,msg);
  assert.match(j.result.message,/cost nothing[\s\S]*Preview[\s\S]*new browser tab/);
 }
 assert.equal(modelCalls,0,'the model is never called for these');
 assert.equal(await credits(cookie),c0,'nothing charged');
 assert.equal(builder.loadMeta(id).versions.length,versions,'no new version');
 const last=builder.loadMeta(id).messages.at(-1);
 assert.equal(last.role,'assistant');assert.equal(last.support,true);assert.equal(last.credits,0);assert.equal(last.mode,'support');
 // A version with browser errors says so and points at Fix it instead.
 const m=builder.loadMeta(id);m.versions.at(-1).runtime_errors=['Uncaught TypeError: x is undefined'];builder.saveMeta(m);
 const e=await waitJob(cookie,(await request(server,'POST','/api/create/projects/'+id+'/chat',{headers:{cookie},body:{message:'I cannot see the site'}})).json.job);
 assert.match(e.result.message,/shows errors[\s\S]*Fix it/);
 // Real requests are untouched, even when they mention the preview.
 for(const msg of ['Change the title to Sunrise Yoga','Make the preview text bigger on the home page','Add a booking form so visitors can see available classes']){
  const j=await waitJob(cookie,(await request(server,'POST','/api/create/projects/'+id+'/chat',{headers:{cookie},body:{message:msg}})).json.job);
  assert.equal(j.status,'complete',msg);assert.ok(!j.support,msg);
 }
 assert.ok(modelCalls>=3);
});

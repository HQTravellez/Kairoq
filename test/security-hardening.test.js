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

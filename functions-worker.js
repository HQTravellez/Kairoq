"use strict";
// Runs Create server functions off the main thread. Database, secrets, AI and
// email calls are forwarded to the main thread, and so is fetch (guarded there; outside APIs the
// owner added may get sample answers, api-samples.js).
const {parentPort}=require('worker_threads');
const functions=require('./react-functions');
const pending=new Map();let seq=0;
function ask(op,args,user){return new Promise((resolve,reject)=>{const callId=++seq;pending.set(callId,{resolve,reject});parentPort.postMessage({type:'host',callId,op,args,user})})}
parentPort.on('message',async msg=>{
 if(msg.type==='hostReply'){const p=pending.get(msg.callId);if(!p)return;pending.delete(msg.callId);msg.error?p.reject(Object.assign(Error(msg.error),{status:msg.status})):p.resolve(msg.value);return}
 if(msg.type!=='run')return;
 if(msg.timeoutMs)process.env.KAIROQ_FUNCTION_TIMEOUT_MS=String(msg.timeoutMs);
 const host={secret:name=>ask('secret',{name}),oauth:service=>ask('oauth',{service}),db:(op,args,user)=>ask('db',{op,args},user),ai:(args,user)=>ask('ai',args,user),ask:(args,user)=>ask('ai.ask',args,user),extract:(args,user)=>ask('ai.extract',args,user),email:(args,user)=>ask('email',args,user)};
 host.fetch=args=>ask('fetch',args);host.sql=(query,params)=>ask('sql',{query,params});host.sqlBatch=steps=>ask('sqlBatch',{steps});
 try{const out=await functions.run({source:msg.source,request:msg.request,user:msg.user,host});parentPort.postMessage({type:'done',id:msg.id,ok:true,out})}
 catch(e){parentPort.postMessage({type:'done',id:msg.id,ok:false,status:e.status||500,message:String(e.message||e)})}
});

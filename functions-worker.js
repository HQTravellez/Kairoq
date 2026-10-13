"use strict";
// Runs Create server functions off the main thread. Database, secrets, AI and
// email calls are forwarded to the main thread; fetch runs here (guarded).
const {parentPort}=require('worker_threads');
const functions=require('./react-functions');
const pending=new Map();let seq=0;
function ask(op,args,user){return new Promise((resolve,reject)=>{const callId=++seq;pending.set(callId,{resolve,reject});parentPort.postMessage({type:'host',callId,op,args,user})})}
parentPort.on('message',async msg=>{
 if(msg.type==='hostReply'){const p=pending.get(msg.callId);if(!p)return;pending.delete(msg.callId);msg.error?p.reject(Object.assign(Error(msg.error),{status:msg.status})):p.resolve(msg.value);return}
 if(msg.type!=='run')return;
 if(msg.timeoutMs)process.env.KAIROQ_FUNCTION_TIMEOUT_MS=String(msg.timeoutMs);
 const host={secret:name=>ask('secret',{name}),db:(op,args,user)=>ask('db',{op,args},user),ai:(args,user)=>ask('ai',args,user),email:(args,user)=>ask('email',args,user)};
 try{const out=await functions.run({source:msg.source,request:msg.request,user:msg.user,host});parentPort.postMessage({type:'done',id:msg.id,ok:true,out})}
 catch(e){parentPort.postMessage({type:'done',id:msg.id,ok:false,status:e.status||500,message:String(e.message||e)})}
});

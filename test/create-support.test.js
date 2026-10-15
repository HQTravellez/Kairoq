'use strict';
// Completed work is never refunded automatically; support grants credits back after review.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-support-'));
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'acc.sqlite');process.env.KAIROQ_FREE_CREDITS='5';
const createApi=require('../create-api'),accounts=require('../builder-accounts');
function call(server,method,url,body){
 return new Promise((resolve,reject)=>{
  const payload=body?Buffer.from(JSON.stringify(body)):null;
  const req=http.request({host:'127.0.0.1',port:server.address().port,method,path:url,headers:payload?{'Content-Type':'application/json','Content-Length':payload.length}:{}},res=>{let b='';res.on('data',d=>b+=d);res.on('end',()=>resolve({status:res.statusCode,json:JSON.parse(b||'{}')}))});
  req.on('error',reject);if(payload)req.write(payload);req.end();
 });
}
test('support looks up a customer and grants credits with a recorded reason; only the owner can',async()=>{
 accounts.signup('unhappy@example.com','password123');
 let owner=true;
 const server=http.createServer(async(req,res)=>{if(await createApi.handle(req,res,{isOwner:()=>owner,callModel:async()=>{}}))return;res.writeHead(404);res.end()});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const found=await call(server,'GET','/api/create/admin/account?email=Unhappy@example.com');
  assert.equal(found.status,200);assert.equal(found.json.account.credits,5);
  assert.equal((await call(server,'POST','/api/create/admin/credits',{email:'unhappy@example.com',amount:3,reason:''})).status,400,'a reason is required');
  assert.equal((await call(server,'POST','/api/create/admin/credits',{email:'unhappy@example.com',amount:-3,reason:'ticket 12'})).status,400);
  const granted=await call(server,'POST','/api/create/admin/credits',{email:'unhappy@example.com',amount:3,reason:'ticket 12: form never saved'});
  assert.equal(granted.status,200);assert.equal(granted.json.account.credits,8);
  assert.equal(granted.json.history[0].reason,'Support: ticket 12: form never saved');
  assert.equal((await call(server,'GET','/api/create/admin/account?email=nobody@example.com')).status,404);
  owner=false;
  assert.equal((await call(server,'POST','/api/create/admin/credits',{email:'unhappy@example.com',amount:3,reason:'free credits please'})).status,401,'customers cannot grant credits');
 }finally{server.close();fs.rmSync(tmp,{recursive:true,force:true})}
});

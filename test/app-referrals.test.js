"use strict";
// Invite a friend in every Kairoq app: a personal link per user; a visitor who signs up through
// it is counted once for the inviter, never for themselves, and old accounts cannot be claimed.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-ref-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
const builder=require('../react-builder'),backend=require('../react-backend'),ref=require('../app-referrals');

test('signing up through an invite link is counted for the inviter, once',async()=>{
 const meta=builder.create({name:'Refs',owner:'owner'});await builder.initialize(meta);
 const server=http.createServer(async(req,res)=>{if(!(await backend.handle(req,res))){res.writeHead(404);res.end()}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port+'/api/apps/'+meta.id;
 const post=(p,body,token)=>fetch(base+p,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)}).then(async r=>({status:r.status,...await r.json()}));
 const get=(p,token)=>fetch(base+p,{headers:token?{Authorization:'Bearer '+token}:{}}).then(async r=>({status:r.status,...await r.json()}));
 try{
  const ana=await post('/auth/signup',{email:'ana@example.com',password:'password1',name:'Ana Silva'});
  assert.equal((await get('/referrals/me')).status,401,'only signed-in users have a link');
  const me=await get('/referrals/me',ana.token);
  assert.match(me.code,/^[a-z0-9]{8}$/);assert.equal(me.joined,0);
  assert.equal((await get('/referrals/me',ana.token)).code,me.code,'the code stays the same');
  const ben=await post('/auth/signup',{email:'ben@example.com',password:'password1',name:'Ben Costa',ref:me.code.toUpperCase()});
  assert.equal(ben.status,201);
  const after=await get('/referrals/me',ana.token);
  assert.equal(after.joined,1);assert.deepEqual(after.people.map(p=>p.name),['Ben'],'first names only');
  // A Google sign-up claims after the account exists; a second claim and a self-claim do nothing.
  const cleo=await post('/auth/signup',{email:'cleo@example.com',password:'password1'});
  assert.equal((await post('/referrals/claim',{code:me.code},cleo.token)).claimed,true);
  assert.equal((await post('/referrals/claim',{code:me.code},cleo.token)).claimed,false);
  assert.equal((await post('/referrals/claim',{code:me.code},ana.token)).claimed,false);
  assert.equal((await post('/auth/signup',{email:'dan@example.com',password:'password1',ref:'nope!'})).status,201,'a bad code never blocks sign-up');
  const db=backend.database(meta.id);
  // An account older than the claim window cannot be credited later.
  db.prepare("UPDATE users SET created_at=? WHERE email='dan@example.com'").run(new Date(Date.now()-ref.CLAIM_WINDOW_MS-1000).toISOString());
  const dan=await post('/auth/signin',{email:'dan@example.com',password:'password1'});
  assert.equal((await post('/referrals/claim',{code:me.code},dan.token)).claimed,false);
  const st=ref.stats(db);
  assert.equal(st.joined,2);assert.equal(st.users,4);assert.deepEqual(st.top,[{email:'ana@example.com',name:'Ana Silva',invited:2}]);
 }finally{server.close()}
});

test('the kairoq client keeps an invite code from the link and sends it with the sign-up',()=>{
 const src=backend.clientSource('abcdefabcdef','',1,'');
 assert.match(src,/export const referrals=/);
 assert.match(src,/new URLSearchParams\(location\.search\)\.get\('ref'\)/);
 assert.match(src,/body:\{email,password,name,ref:pendingRef\(\)\}/);
});

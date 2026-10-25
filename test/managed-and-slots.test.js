"use strict";
// "managed" collections (only the app's managers change menus, services, prices) and booking
// forms whose slot fields anyone can read back (public_fields), so two people cannot take one slot.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-managed-'));
process.env.NODE_ENV='test';
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
process.env.KAIROQ_HOSTING_REGISTRY=path.join(tmp,'hosting.json');
process.env.KAIROQ_OWNER_EMAIL='owner@barber.example';
const builder=require('../react-builder'),backend=require('../react-backend');
let server;
function request(method,url,{body,token}={}){
 return new Promise((resolve,reject)=>{
  const payload=body!==undefined?Buffer.from(JSON.stringify(body)):null;
  const r=http.request({host:'127.0.0.1',port:server.address().port,method,path:url,headers:{...(payload?{'Content-Type':'application/json','Content-Length':payload.length}:{}),...(token?{Authorization:'Bearer '+token}:{})}},res=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>{const t=Buffer.concat(c).toString();let json=null;try{json=JSON.parse(t)}catch{}resolve({status:res.statusCode,json})})});
  r.on('error',reject);if(payload)r.write(payload);r.end();
 });
}
test.before(async()=>{server=http.createServer(async(req,res)=>{if(await backend.handle(req,res))return;res.writeHead(404);res.end()});await new Promise(r=>server.listen(0,'127.0.0.1',r))});
test.after(()=>{server.close();fs.rmSync(tmp,{recursive:true,force:true})});

test('public_fields must be slot fields of a submit-only collection, never personal details',()=>{
 const cfg=f=>backend.parseConfig({'src/backend.json':JSON.stringify(f)});
 assert.deepEqual(cfg({collections:{bookings:{access:'submit-only',public_fields:['date','time']}}}).collections.bookings,{access:'submit-only',public_fields:['date','time']});
 assert.throws(()=>cfg({collections:{bookings:{access:'submit-only',public_fields:['date','phone']}}}),/personal details/);
 assert.throws(()=>cfg({collections:{bookings:{access:'public',public_fields:['date']}}}),/only applies to "submit-only"/);
 assert.equal(cfg({collections:{services:{access:'managed'}}}).collections.services.access,'managed');
});

test('only managers change a managed collection; everyone reads it; booked slots are visible without customer details',async()=>{
 const meta=builder.create({name:'Barber',owner:'owner'}),id=meta.id;
 await builder.saveSource(id,{...require('../react-design').starterFiles('Barber'),'src/backend.json':JSON.stringify({collections:{services:{access:'managed'},bookings:{access:'submit-only',public_fields:['date','time']}}})},{summary:'setup'});
 const base='/api/apps/'+id;
 const signup=async email=>(await request('POST',base+'/auth/signup',{body:{email,password:'password1'}})).json.token;
 const owner=await signup('owner@barber.example'),visitor=await signup('visitor@example.com');
 // Who is a manager is visible to the app (to show edit controls).
 assert.equal((await request('GET',base+'/auth/user',{token:owner})).json.user.manager,true);
 assert.equal((await request('GET',base+'/auth/user',{token:visitor})).json.user.manager,false);
 // A signed-up visitor cannot add, change or delete services; the owner can.
 assert.equal((await request('POST',base+'/collections/services',{token:visitor,body:{data:{name:'Free cut',price:0}}})).status,403);
 const cut=(await request('POST',base+'/collections/services',{token:owner,body:{data:{name:'Cut',price:35}}})).json.item;
 assert.equal((await request('PATCH',base+'/collections/services/'+cut.id,{token:visitor,body:{data:{price:1}}})).status,403);
 assert.equal((await request('DELETE',base+'/collections/services/'+cut.id,{token:visitor})).status,403);
 // Another manager (set in Kairoq settings) can change the owner's entries.
 const m=builder.loadMeta(id);m.app_managers=['manager@barber.example'];builder.saveMeta(m);
 const mgr=await signup('manager@barber.example');
 assert.equal((await request('PATCH',base+'/collections/services/'+cut.id,{token:mgr,body:{data:{price:40}}})).json.item.price,40);
 assert.equal((await request('POST',base+'/collections/services',{token:owner,body:{data:{name:'x'}}})).status,403,'once managers are named, only they manage');
 // Anyone, signed in or not, reads the services.
 assert.equal((await request('GET',base+'/collections/services')).json.items[0].price,40);
 // Bookings: anyone adds; listing shows only date and time, never who booked.
 await request('POST',base+'/collections/bookings',{body:{data:{date:'2026-10-25',time:'10:00',name:'Ana',phone:'555-0100'}}});
 const slots=(await request('GET',base+'/collections/bookings')).json.items;
 assert.deepEqual(slots,[{date:'2026-10-25',time:'10:00'}]);
});

test('the builder is told when to use managed collections and public_fields',()=>{
 const rules=fs.readFileSync(path.join(__dirname,'..','react-builder.js'),'utf8');
 assert.match(rules,/"managed" = anyone reads, only the app's managers add, change or delete/);
 assert.match(rules,/"public_fields":\["date","time","service"\]/);
});

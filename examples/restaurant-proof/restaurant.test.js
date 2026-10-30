"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),http=require("node:http");
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"kairoq-restaurant-proof-"));
process.env.RESTAURANT_DB=path.join(dir,"reservations.json");process.env.RESTAURANT_ADMIN_TOKEN="local-test-token";
const {handler}=require("./server.js");
const server=http.createServer(handler);
let base;
test.before(async()=>{await new Promise(r=>server.listen(0,"127.0.0.1",r));base="http://127.0.0.1:"+server.address().port});
test.after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true})});
const sample={name:"Test Visitor",email:"visitor@example.test",date:"2030-06-20",time:"18:00",party:2};
test("restaurant landing page and seats endpoint respond",async()=>{
 const page=await fetch(base);assert.equal(page.status,200);const html=await page.text();assert.match(html,/Your table awaits/);assert.match(html,/booking/);
 const slots=await fetch(base+"/api/slots");assert.equal(slots.status,200);assert.ok((await slots.json()).slots.includes("18:00"));
});
test("admin reservations require authorization",async()=>{
 assert.equal((await fetch(base+"/api/reservations")).status,401);
});
test("submit, persist, read back, and reject duplicate reservations",async()=>{
 const post=body=>fetch(base+"/api/reservations",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
 const first=await post(sample);assert.equal(first.status,201);const created=(await first.json()).reservation;assert.ok(created.id);assert.equal(created.email,sample.email);
 const saved=JSON.parse(fs.readFileSync(process.env.RESTAURANT_DB,"utf8"));assert.equal(saved.length,1);assert.equal(saved[0].id,created.id);
 const admin=await fetch(base+"/api/reservations",{headers:{authorization:"Bearer local-test-token"}});assert.equal(admin.status,200);assert.equal((await admin.json()).reservations[0].id,created.id);
 const second=await post(sample);assert.equal(second.status,409);assert.equal(JSON.parse(fs.readFileSync(process.env.RESTAURANT_DB,"utf8")).length,1);
});
test("reject malformed and invalid reservations",async()=>{
 for(const bad of [{...sample,party:0},{...sample,date:"2030-02-30"},{...sample,email:"bad"},{...sample,time:"02:00"}]){
  const r=await fetch(base+"/api/reservations",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(bad)});assert.equal(r.status,400);
 }
});

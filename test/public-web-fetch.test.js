"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {EventEmitter}=require("node:events");
const {Readable}=require("node:stream");
const {fetchPublic,publicUrl,cleanHeaders}=require("../public-web-fetch");

function fakeTransport(routes,seen=[]){
 return (url,options,callback)=>{
  const req=new EventEmitter();let destroyed=false;
  req.destroy=err=>{if(destroyed)return;destroyed=true;if(err)queueMicrotask(()=>req.emit("error",err))};
  req.end=()=>queueMicrotask(()=>{
   if(destroyed)return;
   seen.push({url:url.href,headers:{...options.headers}});
   const hit=routes[url.href];
   if(!hit){req.emit("error",Error("unexpected URL "+url.href));return}
   if(hit.error){req.emit("error",hit.error);return}
   const res=Readable.from(hit.body?[Buffer.from(hit.body)]:[]);
   res.statusCode=hit.status;res.headers={...(hit.headers||{})};
   callback(res);
  });
  return req;
 };
}

test("follows the exact GitHub .git canonical redirect without asking the user for another URL",async()=>{
 const start="https://github.com/K-Dense-AI/scientific-agent-skills.git";
 const final="https://github.com/K-Dense-AI/scientific-agent-skills";
 const requestImpl=fakeTransport({
  [start]:{status:301,headers:{location:"/K-Dense-AI/scientific-agent-skills"}},
  [final]:{status:200,headers:{"content-type":"text/html; charset=utf-8"},body:"<html><title>Scientific Agent Skills</title><body>repo</body></html>"}
 });
 const r=await fetchPublic(start,{requestImpl,lookup:()=>{},maxRedirects:5});
 assert.equal(r.status,200);
 assert.equal(r.url,final);
 assert.equal(r.redirects.length,1);
 assert.deepEqual(r.redirects[0],{status:301,from:start,to:final});
 assert.match(r.body,/Scientific Agent Skills/);
});

test("relative redirects are bounded and every redirect stays HTTPS/public",async()=>{
 const requestImpl=fakeTransport({
  "https://example.com/start":{status:302,headers:{location:"/next"}},
  "https://example.com/next":{status:307,headers:{location:"http://example.com/nope"}}
 });
 await assert.rejects(fetchPublic("https://example.com/start",{requestImpl,lookup:()=>{}}),/unsafe destination|Only public HTTPS/);
 const loop=fakeTransport({
  "https://example.com/a":{status:302,headers:{location:"/b"}},
  "https://example.com/b":{status:302,headers:{location:"/a"}}
 });
 await assert.rejects(fetchPublic("https://example.com/a",{requestImpl:loop,lookup:()=>{}}),/redirect loop/i);
});

test("public URL guard blocks credentials, private names and direct IPs",()=>{
 assert.equal(publicUrl("https://example.com/a#x").href,"https://example.com/a");
 for(const value of ["http://example.com","https://user:pass@example.com","https://localhost/x","https://192.168.1.1/x"])
  assert.throws(()=>publicUrl(value));
});

test("public reader never forwards credentials or cookies",()=>{
 const h=cleanHeaders({Authorization:"Bearer secret",Cookie:"sid=secret","X-API-Key":"secret",Accept:"text/html","X-Test":"ok"});
 assert.equal(h.Authorization,undefined);assert.equal(h.Cookie,undefined);assert.equal(h["X-API-Key"],undefined);
 assert.equal(h.Accept,"text/html");assert.equal(h["X-Test"],"ok");
});

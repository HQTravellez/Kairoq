"use strict";
// One front door: / opens the app builder (/create); the older chat page stays at /chat.
const test=require("node:test"),assert=require("node:assert/strict"),path=require("node:path"),fs=require("node:fs"),{spawn}=require("node:child_process");
test("/ sends everyone to /create, /chat still opens the chat page, and the builder links to it",{timeout:40000},async()=>{
 const port=39000+Math.floor(Math.random()*900);
 const p=spawn(process.execPath,["server.js"],{cwd:path.join(__dirname,".."),env:{...process.env,PORT:String(port)},stdio:"ignore"});
 try{
  const end=Date.now()+20000;while(Date.now()<end){try{if((await fetch(`http://127.0.0.1:${port}/health`)).ok)break}catch{}await new Promise(r=>setTimeout(r,250))}
  const go=u=>fetch(`http://127.0.0.1:${port}${u}`,{redirect:"manual"});
  let r=await go("/");assert.equal(r.status,302);assert.equal(r.headers.get("location"),"/create");
  r=await go("/?ref=email");assert.equal(r.headers.get("location"),"/create?ref=email","query strings are kept");
  r=await go("/create");assert.equal(r.status,200);assert.match(await r.text(),/What should we build\?/);
  r=await go("/chat");assert.equal(r.status,200);const chat=await r.text();assert.equal(chat,fs.readFileSync(path.join(__dirname,"..","public","index.html"),"utf8"));
  r=await go("/app.js");assert.equal(r.status,200,"the chat page's own files still load");
 }finally{p.kill()}
 const html=fs.readFileSync(path.join(__dirname,"..","public","create.html"),"utf8"),js=fs.readFileSync(path.join(__dirname,"..","public","create.js"),"utf8");
 assert.match(html,/id="side-chat" class="hidden"/,"hidden until the page knows the viewer is the owner");assert.match(js,/\$\('side-chat'\)\.classList\.toggle\('hidden',!\(v&&v\.kind==='owner'\)\)/);assert.match(js,/\$\('side-chat'\)\.onclick=\(\)=>\{location\.href='\/chat'\}/);
});

test("/chat is for the owner: a visitor who is not signed in goes to /create",{timeout:40000},async()=>{
 const port=39000+Math.floor(Math.random()*900);
 const p=spawn(process.execPath,["server.js"],{cwd:path.join(__dirname,".."),env:{...process.env,PORT:String(port),APP_PASSWORD:"test-owner-pass",KAIROQ_OPEN_ACCESS_UNTIL:""},stdio:"ignore"});
 try{
  const end=Date.now()+20000;while(Date.now()<end){try{if((await fetch(`http://127.0.0.1:${port}/health`)).ok)break}catch{}await new Promise(r=>setTimeout(r,250))}
  const r=await fetch(`http://127.0.0.1:${port}/chat`,{redirect:"manual"});
  assert.equal(r.status,302);assert.equal(r.headers.get("location"),"/create");
 }finally{p.kill()}
});

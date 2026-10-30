"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const g=require("../github-repository-intelligence");
test("accept only public HTTPS GitHub repository roots",()=>{
 assert.deepEqual(g.parse("https://github.com/HKUDS/CLI-Anything"),{owner:"HKUDS",repo:"CLI-Anything"});
 for(const url of ["https://evil.com/HKUDS/CLI-Anything","http://github.com/a/b","https://github.com/a/b/tree/main","https://github.com@evil.com/a/b"]){assert.throws(()=>g.parse(url))}
});
test("repository analysis reads a bounded manifest and explicit source files without executing code",async()=>{
 const urls=[];
 const remote=async url=>{
  urls.push(url);
  if(url.endsWith("/repos/sample/demo"))return {bytes:Buffer.from(JSON.stringify({description:"Demo",default_branch:"main",license:{spdx_id:"MIT"}}))};
  if(url.includes("/git/trees/"))return{bytes:Buffer.from(JSON.stringify({truncated:false,tree:[{type:"blob",path:"README.md",size:200},{type:"blob",path:"package.json",size:60},{type:"blob",path:"secret.txt",size:10}]}))};
  if(url.endsWith("/README.md"))return{bytes:Buffer.from("Build with npm test")};
  if(url.endsWith("/package.json"))return{bytes:Buffer.from('{"scripts":{"test":"node --test"}}')};
  throw Error("Unexpected network call");
 };
 const r=await g.analyze("https://github.com/sample/demo",{remote});
 assert.equal(r.license,"MIT");assert.equal(r.inspected.length,2);assert.ok(r.sampledFiles.includes("secret.txt"));assert.ok(!urls.some(u=>u.endsWith("secret.txt")));
 assert.match(r.securityNote,/untrusted/);
});

"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const g=require("../github-repository-intelligence");
test("accept only public HTTPS GitHub repository roots",()=>{
 assert.deepEqual(g.parse("https://github.com/HKUDS/CLI-Anything"),{owner:"HKUDS",repo:"CLI-Anything"});
 assert.deepEqual(g.parse("https://github.com/HKUDS/CLI-Anything.git"),{owner:"HKUDS",repo:"CLI-Anything"});
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

test("API documentation candidates are prioritized and returned",async()=>{
 const remote=async url=>{
  if(url.endsWith("/repos/sample/api-demo"))return{bytes:Buffer.from(JSON.stringify({description:"API demo",default_branch:"main",license:{spdx_id:"MIT"}}))};
  if(url.includes("/git/trees/"))return{bytes:Buffer.from(JSON.stringify({truncated:false,tree:[
   {type:"blob",path:"README.md",size:200},
   {type:"blob",path:"docs/openapi.yaml",size:5000},
   {type:"blob",path:"src/index.js",size:300}
  ]}))};
  if(url.endsWith("/docs/openapi.yaml"))return{bytes:Buffer.from("openapi: 3.1.0\ninfo:\n  title: Demo API\npaths: {}")};
  if(url.endsWith("/README.md"))return{bytes:Buffer.from("Demo API repository")};
  throw Error("Unexpected network call "+url);
 };
 const r=await g.analyze("https://github.com/sample/api-demo",{remote});
 assert.deepEqual(r.documentationCandidates.map(x=>x.path),["docs/openapi.yaml"]);
 assert.equal(r.inspected[0].path,"docs/openapi.yaml");
 assert.match(r.inspected[0].excerpt,/openapi: 3\.1\.0/);
});
test("API-document path classifier recognizes common contracts",()=>{
 for(const p of ["openapi.json","swagger.yaml","docs/openapi.yaml","docs/api/reference.md","api/reference/openapi.json","postman_collection.json"])assert.equal(g.apiDoc(p),true,p);
 assert.equal(g.apiDoc("src/App.jsx"),false);
});

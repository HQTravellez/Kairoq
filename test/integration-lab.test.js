"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const lab=require("../integration-lab/bridges");
const spec={openapi:"3.0.3",info:{title:"Trips",version:"1"},servers:[{url:"https://api.example.com"}],paths:{"/trips":{get:{responses:{"200":{description:"OK"}}}}}};
test("Onlook-pattern inspector reports Vite project limitations",()=>{
 const r=lab.onlookCompatibility({"src/App.jsx":'<main data-kq="src/App.jsx:1:1" className="p-4"/>',"src/index.css":"kairoq:tokens"});
 assert.equal(r.directOnlookCompatible,false);assert.equal(r.sourceMarkers,1);assert.equal(r.hasDesignTokens,true);
});
test("read-only DOM inspector delegates to Playwright evaluation",async()=>{
 const r=await lab.inspectVisualDom({evaluate:fn=>{assert.equal(typeof fn,"function");return[{source:"src/App.jsx:1:1"}]}});
 assert.equal(r[0].source,"src/App.jsx:1:1");
});
test("Hey API validates local spec and blocks remote refs",()=>{
 assert.equal(lab.validateLocalSpec(spec).plan.operations.length,1);
 const x=structuredClone(spec);x.paths["/trips"].get.responses["200"].content={json:{schema:{$ref:"https://unsafe.example/schema"}}};
 assert.throws(()=>lab.validateLocalSpec(x),/External OpenAPI/);
 assert.throws(()=>lab.validateLocalSpec("a".repeat(2_000_001)),/2 MB/);
});
test("missing SDK executable is honestly reported",async()=>{
 const r=await lab.heyApiTrial(spec,{bin:"/no/such/openapi-ts"});assert.equal(r.status,"unavailable");
});
test("fake SDK CLI smoke generates file without external network",async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"kairoq-hey-fake-")),bin=path.join(dir,"openapi-ts");
 try{
 fs.writeFileSync(bin,'#!/usr/bin/env node\nconst fs=require("fs"),path=require("path"),a=process.argv.slice(2),dest=a[a.indexOf("-o")+1];fs.mkdirSync(dest,{recursive:true});fs.writeFileSync(path.join(dest,"types.gen.ts"),"export type Trip = {id:string};");\n',{mode:0o755});
 const r=await lab.heyApiTrial(spec,{bin});assert.equal(r.status,"generated");assert.ok(r.files.includes("types.gen.ts"));
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test("Stagehand refuses external and authenticated URLs",()=>{
 for(const url of ["https://example.com","http://192.168.0.1","http://localhost.evil.test","file:///etc/passwd","http://user:pass@localhost:3000"])
  assert.throws(()=>lab.localPreview(url),/Only local HTTP/);
 assert.equal(lab.localPreview("http://127.0.0.1:3333/"),"http://127.0.0.1:3333/");
});

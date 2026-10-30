"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const tools=require("../external-agent-tools");
test("both adapters are off by default",async()=>{
 await assert.rejects(tools.cliHubList({env:{}}),/disabled/);
 await assert.rejects(tools.inspectJavascript(".",{env:{}}),/disabled/);
});
test("CLI-Hub cannot install or execute arbitrary tools",async()=>{
 let seen=[];
 const spawnImpl=(bin,args)=>{seen.push([bin,args]);const{EventEmitter}=require("node:events"),child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();process.nextTick(()=>{child.stdout.emit("data",Buffer.from("OK"));child.emit("close",0)});child.kill=()=>{};return child};
 const env={KAIROQ_CLI_ANYTHING_ENABLED:"true",PATH:"/bin"};
 assert.equal(await tools.cliHubList({env,spawnImpl}),"OK");
 assert.equal(await tools.cliHubInfo("blender",{env,spawnImpl}),"OK");
 assert.deepEqual(seen.map(x=>x[1]),[["list"],["info","blender"]]);
 await assert.rejects(tools.cliHubInfo("../bad",{env,spawnImpl}),/Invalid/);
});
test("REA never inspects outside an isolated workspace",async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"kairoq-rea-test-"));
 const outside=fs.mkdtempSync(path.join(os.tmpdir(),"outside-rea-test-"));
 try{
  fs.mkdirSync(path.join(root,"app"));fs.symlinkSync(outside,path.join(root,"escape"));
  assert.throws(()=>tools.under(root,path.join(root,"escape")),/approved workspace/);
  await assert.rejects(tools.inspectJavascript("../",{env:{KAIROQ_REA_ENABLED:"true"},workspaceRoot:root}),/approved workspace|Expected/);
  let calls=0;
  const spawnImpl=(bin,args)=>{calls++;assert.equal(bin,"rea");assert.deepEqual(args,["analyze-javascript-application",fs.realpathSync(path.join(root,"app")),"--json"]);const{EventEmitter}=require("node:events"),child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();process.nextTick(()=>{child.stdout.emit("data",Buffer.from("{}"));child.emit("close",0)});child.kill=()=>{};return child};
  assert.equal(await tools.inspectJavascript("app",{env:{KAIROQ_REA_ENABLED:"true"},workspaceRoot:root,spawnImpl}),"{}");assert.equal(calls,1);
 }finally{fs.rmSync(root,{recursive:true,force:true});fs.rmSync(outside,{recursive:true,force:true})}
});

"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const pg=require("../project-graph");

const files={
 "src/auth.js":"import {db} from './db.js'; export function login(){ return db.findUser(); }",
 "src/db.js":"export const db={findUser(){return {id:1}}};",
 "src/App.jsx":"import {login} from './auth.js'; export default function App(){ return <button onClick={login}>Login</button> }",
 ".env":"SECRET=never-materialize",
 "uploads/private.txt":"nope"
};
const extraction={
 upstream_version:"0.1.14",mode:"deterministic-ast-only",
 nodes:[
  {id:"auth_login",label:"login",source_file:"src/auth.js",file_type:"code"},
  {id:"db_findUser",label:"findUser",source_file:"src/db.js",file_type:"code"},
  {id:"app_App",label:"App",source_file:"src/App.jsx",file_type:"code"}
 ],
 edges:[
  {source:"app_App",target:"auth_login",relation:"calls",confidence:"EXTRACTED",confidence_score:1},
  {source:"auth_login",target:"db_findUser",relation:"calls",confidence:"EXTRACTED",confidence_score:1}
 ]
};

test("project graph materialization excludes secrets and unsupported files",()=>{
 const src=pg.sourceFiles(files);
 assert.deepEqual(Object.keys(src).sort(),["src/App.jsx","src/auth.js","src/db.js"]);
 assert.equal(pg.safePath(".env"),false);
 assert.equal(pg.safePath("../escape.js"),false);
});

test("Graphify adapter normalizes and queries structural relationships",async()=>{
 pg.invalidate("p1");
 const graph=await pg.build(files,{projectId:"p1",runner:async src=>{
   assert.equal(src[".env"],undefined);
   return extraction;
 }});
 assert.equal(graph.source,"graphify");
 assert.equal(graph.version,"0.1.14");
 assert.deepEqual(graph.stats,{nodes:3,edges:2,files:3});
 const q=pg.query(graph,"authentication login");
 assert.equal(q.matches[0].id,"auth_login");
 assert.ok(q.neighbors.some(x=>x.node.id==="db_findUser"));
});

test("project graph finds dependency paths and reverse impact",async()=>{
 pg.invalidate("p2");
 const graph=await pg.build(files,{projectId:"p2",runner:async()=>extraction});
 const path=pg.shortestPath(graph,"App","findUser");
 assert.equal(path.found,true);
 assert.deepEqual(path.path.map(x=>x.node.id),["app_App","auth_login","db_findUser"]);
 const impact=pg.impact(graph,["src/db.js"]);
 assert.deepEqual(impact.affectedFiles,["src/App.jsx","src/auth.js","src/db.js"]);
});

test("project graph cache is invalidated by project id",async()=>{
 let runs=0;pg.invalidate("cache");
 await pg.build(files,{projectId:"cache",runner:async()=>{runs++;return extraction}});
 await pg.build(files,{projectId:"cache",runner:async()=>{runs++;return extraction}});
 assert.equal(runs,1);
 pg.invalidate("cache");
 await pg.build(files,{projectId:"cache",runner:async()=>{runs++;return extraction}});
 assert.equal(runs,2);
});

test("capability registry advertises project_graph with an honest runtime state",()=>{
 const rows=require("../capability-registry").listCapabilities();
 const c=rows.find(x=>x.id==="project_intelligence");
 assert.ok(c);
 assert.ok(["wired","native-fallback"].includes(c.status));
 assert.ok(c.tools.includes("project_graph"));
});

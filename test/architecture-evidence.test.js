"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const arch=require("../architecture-evidence"),pg=require("../project-graph");

const before=pg.normalize({
 nodes:[
  {id:"app",label:"App",source_file:"src/App.jsx",file_type:"component",start_line:4,end_line:20},
  {id:"auth",label:"login",source_file:"src/auth.js",file_type:"function",start_line:3,end_line:8},
  {id:"db",label:"findUser",source_file:"src/db.js",file_type:"function",start_line:5,end_line:9}
 ],
 edges:[
  {source:"app",target:"auth",relation:"calls",confidence:"EXTRACTED"},
  {source:"auth",target:"db",relation:"calls",confidence:"EXTRACTED"}
 ]
},"graphify","before");

const after=pg.normalize({
 nodes:[
  {id:"app",label:"App",source_file:"src/App.jsx",file_type:"component",start_line:4,end_line:20},
  {id:"auth",label:"login",source_file:"src/auth.js",file_type:"function",start_line:3,end_line:10},
  {id:"db",label:"findUser",source_file:"src/db.js",file_type:"function",start_line:5,end_line:9},
  {id:"audit",label:"recordAudit",source_file:"src/audit.js",file_type:"function",start_line:2,end_line:6}
 ],
 edges:[
  {source:"app",target:"auth",relation:"calls",confidence:"EXTRACTED"},
  {source:"auth",target:"db",relation:"calls",confidence:"EXTRACTED"},
  {source:"auth",target:"audit",relation:"calls",confidence:"EXTRACTED"}
 ]
},"graphify","after");

test("source-backed architecture map preserves file and line evidence",()=>{
 const view=arch.map(after,{limit:4});
 assert.equal(view.kind,"source-backed-architecture");
 assert.equal(view.nodes.length,4);
 assert.deepEqual(view.nodes.find(x=>x.id==="auth").source,{file:"src/auth.js",line:3,endLine:10});
 assert.match(view.notice,/does not claim runtime traffic/);
});

test("architecture delta reports only structural source facts",()=>{
 const d=arch.delta(before,after);
 assert.equal(d.changed,true);
 assert.deepEqual(d.addedNodes.map(x=>x.id),["audit"]);
 assert.ok(d.addedEdges.some(x=>x.target==="audit"));
 assert.deepEqual(d.removedNodes,[]);
 assert.match(d.notice,/not proof of runtime impact, risk or merge safety/);
});

test("source-backed path reuses Kairoq graph traversal without calling it a runtime trace",()=>{
 const p=arch.path(after,"App","findUser",pg);
 assert.equal(p.found,true);
 assert.deepEqual(p.path.map(x=>x.node.id),["app","auth","db"]);
 assert.equal(p.path[1].node.source.line,3);
 assert.match(p.notice,/not a measured runtime trace/);
});

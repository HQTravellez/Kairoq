"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const knowledge=require("../project-knowledge"),tasks=require("../task-graph"),review=require("../engineering-review"),retro=require("../build-retro"),intel=require("../engineering-intelligence");

test("project knowledge persists only sourced glossary terms and architecture decisions",()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"kq-knowledge-")),id="000000000000";
 try{
  knowledge.putTerm(id,{term:"Journey",meaning:"A business trip containing one or more bookings",source:"owner",root});
  knowledge.addDecision(id,{title:"Auth seam",decision:"Authentication remains behind one session interface",rationale:"Keeps callers independent of provider",source:"code",root});
  const d=knowledge.read(id,{root});
  assert.equal(d.terms[0].term,"Journey");
  assert.equal(d.decisions.length,1);
  assert.match(knowledge.note(id,{root}),/Journey/);
  assert.match(knowledge.note(id,{root}),/Auth seam/);
  assert.throws(()=>knowledge.putTerm(id,{term:"Guess",meaning:"maybe something",source:"model",root}),/source/);
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});

test("tracer-bullet task graph exposes only unblocked frontier and rejects cycles",()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"kq-tasks-")),id="000000000000",instruction="Build booking flow";
 try{
  let state=tasks.define(id,{instruction,root,tasks:[
   {id:"T1",title:"Create booking",delivers:"User can create and see one persisted booking",blockedBy:[],acceptance:["booking visible after refresh"]},
   {id:"T2",title:"Cancel booking",delivers:"User can cancel the persisted booking end to end",blockedBy:["T1"],acceptance:["status becomes cancelled"]}
  ]});
  assert.deepEqual(state.ready,["T1"]);
  assert.throws(()=>tasks.start(id,instruction,"T2",{root}),/blocked/);
  tasks.start(id,instruction,"T1",{root});
  state=tasks.complete(id,instruction,"T1",{root,evidence:"browser + database"});
  assert.deepEqual(state.ready,["T2"]);
  tasks.start(id,instruction,"T2",{root});
  state=tasks.complete(id,instruction,"T2",{root,evidence:"browser"});
  assert.equal(state.complete,true);
  assert.throws(()=>tasks.define(id,{instruction:"bad",root,tasks:[
   {id:"A",title:"A task",delivers:"A behavior",blockedBy:["B"]},
   {id:"B",title:"B task",delivers:"B behavior",blockedBy:["A"]}
  ]}),/cycle/);
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});

test("engineering review keeps Standards and Spec independent and blocks high-confidence findings",async()=>{
 let n=0;
 const callModel=async(_opts,parser)=>parser(n++===0
  ?{verdict:"pass",findings:[]}
  :{verdict:"block",findings:[{id:"P1",severity:"important",confidence:.93,file:"src/App.jsx",message:"Comparison mode requested but missing",evidence:"request asks for comparison"}]});
 const r=await review.run({
  callModel,base:{"src/App.jsx":"export default()=>null"},current:{"src/App.jsx":"export default()=> <main>Lab</main>","src/lib/physics.js":"export const g=9.81"},
  request:"Build the lab with comparison mode",ownerRequirements:[],knowledge:""
 });
 assert.equal(n,2);
 assert.equal(r.standards.verdict,"pass");
 assert.equal(r.spec.findings.length,1);
 assert.equal(r.ok,false);
 assert.equal(r.blocking[0].id,"P1");
 assert.match(review.summary(r),/Standards: pass/);
 assert.match(review.summary(r),/Spec: IMPORTANT/);
});

test("review requirement scales with blast radius and risk",()=>{
 assert.equal(review.required({a:"1"},{a:"2"},"change a label"),false);
 assert.equal(review.required({a:"1"},{a:"2",b:"3"},"change behavior"),true);
 assert.equal(review.required({a:"1"},{a:"2"},"change authentication permissions"),true);
});

test("build retro turns observed friction into project-local guardrail suggestions",()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"kq-retro-")),id="000000000000";
 try{
  const row=retro.capture(id,{root,instruction:"large change",changed:["a.js","b.js","c.js","d.js","e.js"],events:[
   {tool:"read_files",status:"failed"},{tool:"read_files",status:"failed"},{tool:"search",status:"ok"},{tool:"search",status:"ok"},{tool:"search",status:"ok"}
  ],review:{blocking:[{id:"P1"}]},verification:{verified:false}});
  assert.ok(row.suggestions.some(x=>/project_graph/.test(x)));
  assert.ok(row.suggestions.some(x=>/feedback loop/.test(x)));
  assert.match(retro.note(id,{root}),/PROJECT ENGINEERING RETRO LESSONS/);
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});

test("engineering intelligence requires task graph only for substantial work",()=>{
 assert.equal(intel.substantial("Fix the button label"),false);
 assert.equal(intel.substantial("Build a platform with auth, database, API integration and automation"),true);
 assert.match(intel.prompt("Build a platform with auth database API integration"),/task_graph/);
 assert.match(intel.prompt("fix formula"),/tautological|Expected values/i);
});

test("Build exposes knowledge, task graph and two-axis review and gates substantial writes",()=>{
 const src=fs.readFileSync(path.join(__dirname,"..","react-agent.js"),"utf8");
 for(const tool of ["project_knowledge","task_graph","engineering_review"])assert.match(src,new RegExp(tool));
 assert.match(src,/substantial work needs a tracer-bullet task graph first/);
 assert.match(src,/reviewRequired/);
 assert.match(src,/build-retro/);
});

test("completion gate records independent engineering review evidence",()=>{
 const gate=require("../engineering-completion-gate");
 const base={built:{n:1},dirty:false,inspect:()=>{},lastTest:{errors:[],failed:0,steps:2},checks:{ran:1,failed:[]},reviewRequired:true};
 const missing=gate.evaluate(base);
 assert.equal(missing.verified,false);
 assert.match(missing.issues.join(" "),/Standards \+ Spec review/);
 const pass=gate.evaluate({...base,review:{blocking:[]}});
 assert.equal(pass.verified,true);
 assert.equal(pass.evidence.engineering_review,"passed");
});

test("Capability OS recommends engineering intelligence for architecture work",()=>{
 const rows=require("../capability-registry").recommendCapabilities("Refactor this platform architecture and review the spec",12);
 const ids=rows.map(x=>x.id);
 assert.ok(ids.includes("engineering_intelligence"));
 assert.ok(ids.includes("execution_discipline"));
});

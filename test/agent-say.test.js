"use strict";
// Between steps Kairoq Agent says one plain line to the owner ("say"); its working note folds into
// the step log and the model's private reasoning is not stored.
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const root=fs.mkdtempSync(path.join(os.tmpdir(),"kairoq-say-"));
Object.assign(process.env,{KAIROQ_REACT_PROJECTS_DIR:root,KAIROQ_AUTONOMY_DIR:path.join(root,"learning"),KAIROQ_DESIGN_BRIEF:"off",KAIROQ_PARALLEL_WRITERS:"off",KAIROQ_AGENT_REPLY:"off"});
const agent=require("../react-agent"),builder=require("../react-builder");

test("parseStep keeps a short say line and tolerates replies without one",()=>{
 const r=agent.parseStep(JSON.stringify({say:"  The page builds;\n now I'll try the checkout. ",thought:"Run build_and_test on #/checkout.",actions:[{tool:"read_files",paths:["src/App.jsx"]}]}));
 assert.equal(r.say,"The page builds; now I'll try the checkout.");
 assert.equal(r.thought,"Run build_and_test on #/checkout.");
 assert.equal(agent.parseStep('{"thought":"x","actions":[{"tool":"finish"}]}').say,"");
 assert.equal(agent.parseStep(JSON.stringify({say:"x".repeat(500),actions:[{tool:"finish"}]})).say.length,240);
 assert.match(agent.protocol({maxSteps:10}),/"say":"one short sentence to the owner/);
});

test("the timeline keeps the say lines (once each) and no private reasoning",async()=>{
 const meta=builder.create({name:"Pulse",owner:"owner"});await builder.initialize(meta);
 const says=["Let me look at what's there first.","Let me look at what's there first.","The page is still the starter, so I'll write it now."];
 let n=0;
 const callModel=async(o,parse)=>{
  if(o.onReasoning)o.onReasoning("x","PRIVATE: maybe the owner wants a cheaper plan");
  const say=says[n++]||"";
  return parse(JSON.stringify({say,thought:"Working note "+n,actions:[{tool:"read_files",paths:["src/App.jsx"]}]}));
 };
 await agent.run(meta.id,"An Apple-style product page for Pulse",{callModel,maxSteps:3});
 const last=builder.loadMeta(meta.id).messages.at(-1),tl=last.timeline||[];
 assert.deepEqual(tl.filter(e=>e.t==="say").map(e=>e.text),["Let me look at what's there first.","The page is still the starter, so I'll write it now."]);
 const think=tl.filter(e=>e.t==="think");
 assert.ok(think.length>=3);assert.equal(think[0].note,"Working note 1");
 assert.ok(!JSON.stringify(builder.loadMeta(meta.id)).includes("PRIVATE"),"private reasoning is not stored");
});
// How the chat shows these lines is covered in lovable-chat.test.js.

"use strict";
// Free models send files in several shapes. All of them must be written: on the live site every
// write came back "nothing written" 27 times in a row and the build failed, because only
// {"files":{"path":"code"}} was read. When nothing usable arrives, the reply says the shape to use.
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const root=fs.mkdtempSync(path.join(os.tmpdir(),"kairoq-shapes-"));
Object.assign(process.env,{KAIROQ_REACT_PROJECTS_DIR:root,KAIROQ_AUTONOMY_DIR:path.join(root,"learning"),KAIROQ_DESIGN_BRIEF:"off",KAIROQ_PARALLEL_WRITERS:"off",KAIROQ_AGENT_REPLY:"off"});
const agent=require("../react-agent"),builder=require("../react-builder");
const APP='export default function App(){return <main><h1>Tip</h1></main>}';
test("every common file shape is read",()=>{
 assert.deepEqual(agent.normFiles({files:{"src/App.jsx":APP}}),{"src/App.jsx":APP});
 assert.deepEqual(agent.normFiles({files:[{path:"src/App.jsx",content:APP}]}),{"src/App.jsx":APP});
 assert.deepEqual(agent.normFiles({files:[{file:"src/App.jsx",code:APP}]}),{"src/App.jsx":APP});
 assert.deepEqual(agent.normFiles({files:{"src/App.jsx":{content:APP}}}),{"src/App.jsx":APP});
 assert.deepEqual(agent.normFiles({path:"src/App.jsx",content:APP}),{"src/App.jsx":APP});
 assert.deepEqual(agent.normFiles({files:JSON.stringify({"src/App.jsx":APP})}),{"src/App.jsx":APP});
 assert.deepEqual(agent.normFiles({files:[]}),{});
 const r=agent.parseStep(JSON.stringify({actions:[{tool:"write_files",files:[{path:"src/App.jsx",content:APP}]},{tool:"write_files",files:[{path:"src/a.jsx",content:"x"}]}]}));
 assert.deepEqual(Object.keys(r.actions[0].files).sort(),["src/App.jsx","src/a.jsx"],"list-shaped writes are merged like map-shaped ones");
});
test("a list-shaped write reaches the files, and an empty one says what shape to use",async()=>{
 const meta=builder.create({name:"Tip",owner:"owner"});await builder.initialize(meta);
 const seen=[];let n=0;
 const callModel=async(o,parse)=>{
  seen.push(JSON.stringify(o.messages.at(-1)).slice(0,4000));
  const steps=[
   {thought:"write",actions:[{tool:"write_files",files:[]}]},
   {thought:"write",actions:[{tool:"write_files",files:[{path:"src/App.jsx",content:APP}]}]},
   {thought:"read",actions:[{tool:"read_files",paths:["src/App.jsx"]}]}
  ];
  return parse(JSON.stringify(steps[n++]||steps[2]));
 };
 await agent.run(meta.id,"A tip calculator",{callModel,maxSteps:3});
 const all=seen.join("\n");
 assert.match(all,/nothing written because \\"files\\" was empty or not in a shape Kairoq reads/,"the empty write explains the shape");
 assert.match(all,/write_files: src\/App\.jsx/,"the list-shaped write was written");
 assert.match(all,/Tip<\/h1>/,"reading the file back shows the new content");
});

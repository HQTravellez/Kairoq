"use strict";
// A first build that never gets past the starter page saves nothing, charges nothing, and says
// what happened (the Pulse page: the agent's replies kept coming back too large to read).
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const root=fs.mkdtempSync(path.join(os.tmpdir(),"kairoq-honest-"));
Object.assign(process.env,{KAIROQ_REACT_PROJECTS_DIR:root,KAIROQ_AUTONOMY_DIR:path.join(root,"learning"),KAIROQ_DESIGN_BRIEF:"off",KAIROQ_PARALLEL_WRITERS:"off"});
const agent=require("../react-agent"),builder=require("../react-builder");

test("replies that cannot be read: no version is saved and the message says why",async()=>{
 const meta=builder.create({name:"Pulse",owner:"owner"});await builder.initialize(meta);
 const before=builder.loadMeta(meta.id).current_version;
 let calls=0;
 const callModel=async(_o,parse)=>{calls++;return parse('{"thought":"Writing the whole page","actions":[{"tool":"write_files","files":{"src/App.jsx":"import gsap from');};
 const r=await agent.run(meta.id,"An Apple-style product page for Pulse",{callModel,maxSteps:4});
 assert.equal(calls,3,"three unreadable replies in a row end the run");
 assert.ok(r.not_built,"marked as not built");
 assert.equal(r.unchanged,true);
 assert.equal(builder.loadMeta(meta.id).current_version,before,"no new version");
 assert.equal(r.not_built.unreadable,3);
 assert.match(r.message,/^I didn't get to build this\. The page is still the starter: my replies came back too large to read 3 times\. Nothing was saved and you were not charged\.$/);
 const last=builder.loadMeta(meta.id).messages.at(-1);
 assert.equal(last.failed,true);assert.equal(last.retry,"An Apple-style product page for Pulse","Try again sends the same request");
});

test("finish on the starter page is refused, and running out of steps saves nothing",async()=>{
 const meta=builder.create({name:"Pulse 2",owner:"owner"});await builder.initialize(meta);
 const before=builder.loadMeta(meta.id).current_version;
 const seen=[];
 const callModel=async(o,parse)=>{seen.push(o.messages.at(-1).content);return parse(JSON.stringify({thought:"Looks done.",actions:[{tool:"finish",message:"Built the page."}]}))};
 const r=await agent.run(meta.id,"An Apple-style product page for Pulse",{callModel,maxSteps:2});
 assert.ok(seen.slice(1).some(t=>/has not been written yet \(src\/App\.jsx is still the starter page\)/.test(String(t))),"the agent is told to write the app");
 assert.ok(r.not_built);
 assert.equal(builder.loadMeta(meta.id).current_version,before);
 assert.doesNotMatch(r.message,/Built the page/,"the model's claim is not passed on");
});

test("the server refunds a build that was not built, and the agent asks for smaller replies",()=>{
 const api=fs.readFileSync(path.join(__dirname,"..","create-api.js"),"utf8");
 assert.match(api,/if\(job\.result&&job\.result\.not_built&&!job\.refunded\)\{job\.refunded=true;job\.free='Nothing was built, so it was free\.';/);
 const src=fs.readFileSync(path.join(__dirname,"..","react-agent.js"),"utf8");
 assert.match(src,/Keep replies small: write at most 2 files per step/);
 assert.match(src,/The first version could not be written all at once; writing it step by step/);
});

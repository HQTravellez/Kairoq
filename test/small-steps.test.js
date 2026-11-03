"use strict";
// Like Emergent and Lovable, a build goes in small steps: at most 3 files, build, test, next part.
// The all-at-once first write is off unless KAIROQ_PARALLEL_WRITERS=on.
const test=require("node:test"),assert=require("node:assert/strict");
test("the agent is told to build in small slices and never write the whole app at once",()=>{
 const p=require("../react-agent").protocol({maxSteps:24});
 assert.match(p,/Each step writes at most 3 files/);
 assert.match(p,/Never write the whole app in one reply/);
 assert.doesNotMatch(p,/put all needed files in ONE write_files action/);
 const cut=require("../react-agent").parseStepSafe('{"thought":"x","actions":[{"tool":"write_files","files":{"src/App.jsx":"export');
 assert.match(cut.invalid,/at most 2 or 3 files per step/);
});
test("parallel writers are off unless turned on",()=>{
 const PW=require("../parallel-writers"),keep=process.env.KAIROQ_PARALLEL_WRITERS;
 delete process.env.KAIROQ_PARALLEL_WRITERS;assert.equal(PW.enabled(),false);
 process.env.KAIROQ_PARALLEL_WRITERS="on";assert.equal(PW.enabled(),true);
 if(keep===undefined)delete process.env.KAIROQ_PARALLEL_WRITERS;else process.env.KAIROQ_PARALLEL_WRITERS=keep;
});

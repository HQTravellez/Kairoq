"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const habits=require('../builder-method');
const builder=require('../react-builder');
const opencode=require('../opencode-engine');
const planner=require('../product-orchestrator');
test('Karpathy-inspired guidelines are actually included in the React coding agent prompt',()=>{
 const prompt=builder.SYSTEM_PROMPT;
 for(const x of ['Think before coding','Simplicity first','Surgical changes','Goal-driven verification','External APIs']){
  assert.match(prompt,new RegExp(x));
 }
 assert.match(prompt,/Respond with ONLY a JSON object/,'existing output contract remains authoritative');
 assert.match(prompt,/never invent an answer/i);
 assert.match(prompt,/smallest complete solution/i);
});
test('same guidelines reach the alternative OpenCode coding agent',()=>{
 const prompt=opencode.rules(builder.SYSTEM_PROMPT,'Account guidelines');
 assert.match(prompt,/Surgical changes/);
 assert.match(prompt,/Goal-driven verification/);
 assert.match(prompt,/Kairoq app rules/);
 assert.match(prompt,/Account guidelines/);
 assert.doesNotMatch(prompt,/Respond with ONLY a JSON object/,'file-editing agent keeps its existing non-JSON output format');
});
test('product planning model gets guidelines and retains full spec validation',async()=>{
 let seen='';
 await assert.rejects(
  planner.plan(async options=>{seen=options.messages[0].content;throw Error('fixture');},
   {brief:'Book a business trip using an approved API'}),
  /Product planning failed after 3 attempts/
 );
 assert.match(seen,/Think before coding/);
 assert.match(seen,/External APIs:/);
 assert.match(seen,/IMPORTED CONTRACT/);
 assert.match(seen,/USER BRIEF: Book a business trip/);
});
test('existing verified repair methods are preserved and guidance is bounded',()=>{
 for(const key of ['DEBUG','VERIFY','REVIEW'])assert.equal(typeof habits[key],'string');
 assert.ok(habits.DEBUG.includes('find the cause first'));
 assert.ok(habits.VERIFY.includes('honest'));
 assert.ok(habits.KARPATHY.length<2500,'avoid bloating prompts');
 assert.doesNotMatch(habits.KARPATHY,/curl |npx |npm install|eval\s*\(/,'instruction text does not install or execute external commands');
});

"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const mc=require('../model-continue');

test('a reply cut off at the length limit is continued and joined without repeats',async()=>{
 const full=JSON.stringify({message:'Built it.',files:{'src/App.jsx':'export default function App(){return <main>'+'x'.repeat(200)+'</main>}\n'}});
 const parts=[full.slice(0,120),full.slice(120,230),full.slice(230)];
 const seen=[],streamed=[];
 const ask=async(messages,onToken)=>{seen.push(messages);const i=seen.length-1;if(onToken)onToken(parts[i],parts[i]);return{content:i===1?'```json\n'+parts[1]:parts[i],finish:i<2?'length':'stop'}};
 const r=await mc.complete(ask,[{role:'user',content:'build'}],{onToken:(d,all)=>streamed.push(all)});
 assert.equal(r.content,full);assert.equal(r.continuations,2);assert.equal(r.finish,'stop');
 assert.deepEqual(seen[1].slice(-2).map(m=>m.role),['assistant','user']);
 assert.equal(seen[1].at(-2).content,parts[0]);assert.match(seen[1].at(-1).content,/Continue exactly where you left off/);
 assert.equal(seen[2].at(-2).content,full.slice(0,230),'the second continuation sees everything so far');
 assert.ok(streamed.at(-1).startsWith(full.slice(0,230)),'the live stream shows the whole reply so far');
 assert.doesNotThrow(()=>JSON.parse(r.content));
});

test('continuations stop at the limit, on an empty reply, or when the reply ends normally',async()=>{
 let n=0;const always=async()=>({content:'abc'+(n++),finish:'length'});
 assert.equal((await mc.complete(always,[],{max:2})).continuations,2);
 const done=async()=>({content:'{"a":1}',finish:'stop'});
 assert.equal((await mc.complete(done,[])).continuations,0);
 let k=0;const empty=async()=>({content:k++?'':'{"a":',finish:'length'});
 const r=await mc.complete(empty,[]);assert.equal(r.content,'{"a":');assert.equal(r.continuations,1);
 assert.equal(mc.merge('{"a":','```json\n1}'),'{"a":1}','a stray fence is dropped');
 assert.equal(mc.merge('xxxx','xxxx'),'xxxxxxxx','repeated content is kept');
});

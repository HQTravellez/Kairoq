"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const zen=require("../opencode-free");
const env={KAIROQ_OPENCODE_ZEN_FREE_ENABLED:"true",KAIROQ_OPENCODE_ZEN_KEY:"test-private-key",KAIROQ_OPENCODE_ZEN_FREE_MODEL:"space-bunny-free"};
test("disabled without separate credential and explicit activation",()=>{
 assert.equal(zen.configured({}),false);
 assert.equal(zen.configured({...env,KAIROQ_OPENCODE_ZEN_FREE_ENABLED:"false"}),false);
});
test("never selects unapproved paid model",()=>assert.throws(()=>zen.choose({...env,KAIROQ_OPENCODE_ZEN_FREE_MODEL:"gpt-6-astra"}),/approved free/));
test("calls only approved OpenCode URL with configured key",async()=>{
 let observed;
 const result=await zen.complete([{role:"user",content:"hi"}],{env,fetchImpl:async(url,options)=>{observed={url,options};return{ok:true,json:async()=>({choices:[{message:{content:"hello"}}]})}}});
 assert.equal(result.text,"hello");
 assert.equal(observed.url,zen.ENDPOINT);
 assert.equal(JSON.parse(observed.options.body).model,"space-bunny-free");
 assert.equal(observed.options.headers.Authorization,"Bearer test-private-key");
});
test("provider failures are surfaced without inventing success",async()=>{
 await assert.rejects(zen.complete([{role:"user",content:"hi"}],{env,fetchImpl:async()=>({ok:false,status:429,json:async()=>({error:{message:"daily cap"}})})}),/429/);
});

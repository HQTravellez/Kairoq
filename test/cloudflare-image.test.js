"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {generate,configured,MODEL}=require("../cloudflare-image");
const env={CLOUDFLARE_ACCOUNT_ID:"abc123",CLOUDFLARE_API_TOKEN:"fake"};
test("free image provider needs explicit credentials",()=>{assert.equal(configured({}),false);assert.equal(configured(env),true);assert.match(MODEL,/flux-1-schnell/);});
test("image tool returns JPEG bytes and never tries secondary providers",async()=>{
 let calls=0;const result=await generate({prompt:"A minimal hotel lobby",env,fetchImpl:async(url,opts)=>{calls++;assert.match(url,/api.cloudflare.com/);assert.match(url,/flux-1-schnell/);assert.match(opts.body,/minimal hotel/);return{ok:true,json:async()=>({success:true,result:{image:"YWJj"}})}}});
 assert.equal(result.mime,"image/jpeg");assert.equal(result.data,"YWJj");assert.equal(calls,1);
});
test("quota failure surfaces explicitly, with no retry or paid fallback",async()=>{
 let calls=0;
 await assert.rejects(()=>generate({prompt:"Hotel",env,fetchImpl:async()=>{calls++;return{ok:false,status:429,json:async()=>({success:false,errors:[{message:"Daily allocation exhausted"}]})}}}),/Daily allocation exhausted/);
 assert.equal(calls,1);
});

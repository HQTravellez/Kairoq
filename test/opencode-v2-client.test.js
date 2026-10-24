"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {config,makeClient}=require("../opencode-v2-client");
test("requires explicit approval for remote OpenCode servers",()=>{
 assert.throws(()=>config({KAIROQ_OPENCODE_V2_URL:"http://169.254.169.254:4096"}),/trusted/);
 assert.throws(()=>config({KAIROQ_OPENCODE_V2_URL:"file:///etc/passwd"}),/Invalid/);
 assert.equal(config({}).base,"http://127.0.0.1:4096");
});
test("calls direct OpenCode V2 session routes without Hermes",async()=>{
 const seen=[],env={KAIROQ_OPENCODE_V2_TOKEN:"test-token"};
 const fetchImpl=async(url,opts)=>{seen.push({url,opts});return{ok:true,json:async()=>({data:{id:"ses_1"}})}};
 const client=makeClient({env,fetchImpl});
 await client.createSession("/workspace/project");
 await client.setModel("ses_1",{providerID:"opencode",modelID:"free-model"});
 await client.prompt("ses_1","Review the code");
 await client.wait("ses_1");
 assert.match(seen[0].url,/\/api\/session$/);
 assert.match(seen[2].url,/\/api\/session\/ses_1\/prompt$/);
 assert.match(seen[3].url,/\/wait$/);
 assert.ok(seen.every(s=>s.opts.headers.Authorization==="Basic "+Buffer.from("opencode:test-token").toString("base64")));
});

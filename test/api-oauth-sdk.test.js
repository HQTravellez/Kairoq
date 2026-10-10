"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const oauth=require("../api-oauth"),sdk=require("../api-sdk");
const original={key:process.env.KAIROQ_OAUTH_ENCRYPTION_KEY,providers:process.env.KAIROQ_OAUTH_PROVIDERS,redirect:process.env.KAIROQ_OAUTH_REDIRECT_URI};
process.env.KAIROQ_OAUTH_ENCRYPTION_KEY=crypto.randomBytes(32).toString("hex");
process.env.KAIROQ_OAUTH_REDIRECT_URI="https://kairoq.example.com/api/developer/oauth/callback";
process.env.KAIROQ_OAUTH_PROVIDERS=JSON.stringify({example:{clientId:"test-id",authorizationUrl:"https://auth.example.com/authorize",tokenUrl:"https://auth.example.com/token",scopes:["read:trips"]}});
test("OAuth authorization uses PKCE, single-use state, encrypted tokens and refresh",async()=>{
 const flow=oauth.start("example"),url=new URL(flow.url);
 assert.equal(url.searchParams.get("code_challenge_method"),"S256");assert.equal(url.searchParams.get("response_type"),"code");
 assert.ok(!url.searchParams.has("code_verifier"));
 const state=url.searchParams.get("state"),cookie=flow.cookie.split(";")[0].split("=")[1];
 await assert.rejects(oauth.complete({state,code:"abc",cookie:"wrong"}),/mismatch/);
 const connected=await oauth.complete({state,code:"abc",cookie,exchange:async()=>({access_token:"initial-token",refresh_token:"refresh-secret",expires_in:1})});
 assert.equal(connected.connected,true);assert.equal(connected.hasRefreshToken,true);
 await assert.rejects(oauth.complete({state,code:"abc",cookie}),/already used/);
 let calls=0;
 const token=await oauth.accessToken("example",{exchange:async(c,params)=>{calls++;assert.equal(params.grant_type,"refresh_token");assert.equal(params.refresh_token,"refresh-secret");return{access_token:"rotated-token",refresh_token:"rotated-refresh",expires_in:3600};}});
 assert.equal(token,"rotated-token");assert.equal(calls,1);
 const disk=fs.readFileSync(path.join(__dirname,"..","workspace","api-oauth","token-example.json.enc"),"utf8");assert.ok(!disk.includes("rotated-token"));
 assert.equal(oauth.disconnect("example").connected,false);
});
test("OAuth rejects unconfigured providers and invalid callback URLs",()=>{
 assert.throws(()=>oauth.config("not-configured"),/not configured/);
 assert.throws(()=>oauth.config("../escape"),/Invalid/);
});
test('OAuth state filenames accept generated base64url states beginning with an underscore',async()=>{
 const originalRandom=crypto.randomBytes;let flow;
 try{crypto.randomBytes=size=>size===32?Buffer.alloc(32,255):originalRandom(size);flow=oauth.start('example');}finally{crypto.randomBytes=originalRandom;}
 const state=new URL(flow.url).searchParams.get('state');assert.ok(state.startsWith('_'));
 const result=await oauth.complete({state,code:'test-code',cookie:state,exchange:async()=>({access_token:'test-token',expires_in:3600})});assert.equal(result.connected,true);oauth.disconnect('example');
});
test("SDK generation emits executable JavaScript with encoded parameters",async()=>{
 const plan={title:"Trips",operations:[{id:"getTrip",method:"GET",path:"/trips/{id}"},{id:"createTrip",method:"POST",path:"/trips"}]};
 const result=sdk.generate(plan);
 assert.equal(result.operations,2);assert.match(result.source,/class KairoqApiClient/);
 const context={module:{exports:{}},URL,encodeURIComponent,fetch:async()=>{throw Error("Unexpected network call")}};
 vm.runInNewContext(result.source,context,{timeout:1000});
 const Client=context.module.exports.KairoqApiClient;
 const client=new Client({baseUrl:"https://api.example.com/v1",token:"test",fetchImpl:async(url,opts)=>({ok:true,text:async()=>JSON.stringify({url,method:opts.method,auth:opts.headers.Authorization})})});
 const response=await client.getTrip({pathParams:{id:"a/b"}});
 assert.equal(response.url,"https://api.example.com/v1/trips/a%2Fb");assert.equal(response.auth,"Bearer test");
});
test.after(()=>{for(const [k,v] of Object.entries({KAIROQ_OAUTH_ENCRYPTION_KEY:original.key,KAIROQ_OAUTH_PROVIDERS:original.providers,KAIROQ_OAUTH_REDIRECT_URI:original.redirect})){if(v===undefined)delete process.env[k];else process.env[k]=v;}});

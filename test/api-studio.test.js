"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const html=fs.readFileSync(path.join(__dirname,"..","public","api-studio.html"),"utf8");
const main=fs.readFileSync(path.join(__dirname,"..","public","index.html"),"utf8");
const build=fs.readFileSync(path.join(__dirname,"..","public","build-studio.html"),"utf8");
const server=fs.readFileSync(path.join(__dirname,"..","server.js"),"utf8");
test("OAuth connect and disconnect controls are visible and wired",()=>{
 for(const id of ["oauthProvider","oauthConnect","oauthDisconnect","oauthRefresh","oauthStatus","oauthForTest"]){
  assert.match(html,new RegExp('id="'+id+'"'),id+" missing from API Studio");
 }
 for(const route of ["/api/developer/oauth/providers","/api/developer/oauth/start","/api/developer/oauth/disconnect"]){
  assert.ok(html.includes(route),"UI missing route "+route);assert.ok(server.includes(route),"server missing route "+route);
 }
 assert.match(server,/Set APP_PASSWORD before enabling shared OAuth connections/);
 assert.match(server,/Set APP_PASSWORD before managing OAuth connections/);
});
test("SDK generation and download controls are visible and wired",()=>{
 for(const id of ["sdkGenerate","sdkDownload","sdkStatus"])assert.ok(html.includes('id="'+id+'"'));
 assert.ok(html.includes("/api/developer/api/sdk"));
 assert.ok(html.includes('link.download="kairoq-api-client.js"'));
 assert.ok(html.includes("oauthProvider:"));
});
test("API Studio is discoverable from home and Build Studio",()=>{
 assert.ok(main.includes('href="/api-studio.html"'));
 assert.ok(build.includes('href="/api-studio.html"'));
});
test("API Studio inline script parses as valid JavaScript",()=>{
 const match=html.match(/<script>([\s\S]*?)<\/script>/);
 assert.ok(match,"Missing inline script");
 assert.doesNotThrow(()=>new vm.Script(match[1],{filename:"api-studio.html"}));
});
test("expired Studio sessions reveal sign-in and successful login preserves the imported plan",async()=>{
 const elements=new Map();const element=id=>{if(!elements.has(id))elements.set(id,{hidden:true,value:"",disabled:false,textContent:"",listeners:{},addEventListener(event,fn){this.listeners[event]=fn;},replaceChildren(){},append(){}});return elements.get(id);};
 let signedIn=false;const requests=[];
 const context=vm.createContext({URLSearchParams,window:{location:{hash:"",pathname:"/api-studio.html",search:""},history:{replaceState(){}}},document:{getElementById:element,createElement:()=>({})},fetch:async(url,options)=>{
  requests.push({url,options});if(url==="/api/login"){signedIn=true;return{ok:true,status:200,json:async()=>({ok:true})};}
  return{ok:signedIn,status:signedIn?200:401,json:async()=>signedIn?{providers:[]}:{error:"Authentication required"}};
 }});
 vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],context);
 await vm.runInContext("refreshProviders()",context);assert.equal(element("signInPanel").hidden,false);
 vm.runInContext('plan={title:"Preserved",operations:[{id:"getTrips"}]};',context);
 element("studioPassword").value="test-password";
 await element("studioLogin").listeners.submit({preventDefault(){}});
 assert.equal(element("signInPanel").hidden,true);assert.equal(element("studioPassword").value,"");
 assert.equal(vm.runInContext("plan.title",context),"Preserved");assert.ok(requests.some(r=>r.url==="/api/login"));
});

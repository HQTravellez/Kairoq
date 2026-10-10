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

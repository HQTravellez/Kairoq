"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
const start=source.indexOf('function isAppCreationRequest(message){');
const end=source.indexOf('async function send(regenerateFrom=null)',start);
assert.ok(start>=0&&end>start,'Intent routing helper must be present in chat UI');
const isAppCreationRequest=vm.runInNewContext(source.slice(start,end)+'\nisAppCreationRequest;');
test('explicit app creation requests route to builder in Ask mode',()=>{
 for(const prompt of ['I need a webapp on the calaorie count','Build a calorie counter web app','Create an expense tracking dashboard','I want a SaaS booking app','Make me a mobile app for restaurants'])
  assert.equal(isAppCreationRequest(prompt),true,prompt);
});
test('normal questions and explanation requests remain in chat',()=>{
 for(const prompt of ['Hello!','How do I build a web app?','Explain how to design a website','Give me a code snippet for an app','What is the difference between a web application and mobile app?','Debug this website code'])
  assert.equal(isAppCreationRequest(prompt),false,prompt);
});
test('Ask chat submit calls builder before generic model for build intents',()=>{
 const start=source.indexOf('async function send(regenerateFrom=null)');
 const block=source.slice(start,start+900);
 assert.match(block,/isAppCreationRequest\(asked\)/);
 assert.ok(block.indexOf('return startAppBuild(asked)')<block.indexOf('setMainView("chat")'));
});

"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {extractWebsite}=require("../chat-url");
test("reads bare, www, https and escaped-dot domains",()=>{
 assert.equal(extractWebsite("www.travellez.com"),"https://www.travellez.com/");
 assert.equal(extractWebsite("www\\.travellez.com"),"https://www.travellez.com/");
 assert.equal(extractWebsite("https://developer.sabre.com/docs"),"https://developer.sabre.com/docs");
 assert.equal(extractWebsite("Check travellez.com please"),"https://travellez.com/");
 assert.equal(extractWebsite("https://github.com/K-Dense-AI/scientific-agent-skills.git"),"https://github.com/K-Dense-AI/scientific-agent-skills.git");
});
test("rejects localhost, private numeric addresses, insecure schemes",()=>{
 for(const q of ["http://localhost","127.0.0.1","10.0.0.1","http://travellez.com"])assert.equal(extractWebsite(q),null);
});
test("ignores text without URL",()=>assert.equal(extractWebsite("hi there"),null));

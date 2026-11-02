"use strict";
// A chat started from the home page is a conversation until an app is asked for.
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.join(__dirname,"..");
const api=fs.readFileSync(path.join(root,"create-api.js"),"utf8");

test("only a request for an app turns a chat into a build",()=>{
 const appRequest=new Function(/function appRequest\(text\)\{[^\n]+\}/.exec(api)[0]+";return appRequest")();
 for(const t of ["build a CRM for my accounting firm","Make me a booking site for my yoga studio","create a landing page for Halo","let's start the app"])assert.equal(appRequest(t),true,t);
 for(const t of ["Add list best payroll add-ons for Wave","i want you search actual xero and wave","compare Wave and Xero","add more detail on pricing"])assert.equal(appRequest(t),false,t);
});

test("the home page opens chats as chats, and the server keeps them in Discuss until an app is asked for",()=>{
 const ui=fs.readFileSync(path.join(root,"public/create.js"),"utf8");
 assert.match(ui,/body:\{name:talk==='greeting'\?'New chat':shortName\(typed\),chat:true\}/);
 assert.match(api,/chat:b\.chat===true/);
 assert.match(api,/if\(chat&&!tpl&&!prompt\)\{meta\.chat=true;builder\.saveMeta\(meta\)\}/);
 assert.match(api,/if\(cm\.chat&&\(mode==='build'\|\|mode==='agent'\)&&!hooks\)\{if\(appRequest\(ownerText\)\)\{cm\.chat=false;builder\.saveMeta\(cm\)\}else mode='discuss'\}/);
 const rb=fs.readFileSync(path.join(root,"react-builder.js"),"utf8");
 assert.match(rb,/\.\.\.\(m\.chat\?\{chat:true\}:\{\}\)/,"the page learns it is a chat");
 assert.match(rb,/\(meta\.chat\?CHAT_NOTE:knowledgeNote\(meta\)/);
 assert.match(rb,/THIS IS A CONVERSATION, NOT AN APP/);
 assert.match(rb,/Never promise work in the answer/);
 assert.match(ui,/\$\('editor'\)\.classList\.toggle\('chat-only',Boolean\(project\.chat\)\)/);
 const css=fs.readFileSync(path.join(root,"public/ui/chat.css"),"utf8");
 assert.match(css,/#editor\.chat-only \.stage/);
});

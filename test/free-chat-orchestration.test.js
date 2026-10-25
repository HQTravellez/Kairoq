"use strict";
const t=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const builder=fs.readFileSync(path.join(__dirname,'../react-builder.js'),'utf8');
const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
t('longer durable chat history is delivered and 20 turns are available as conversational context',()=>{
 assert.match(builder,/messages:lightMessages\(m\.messages\.slice\(-500\)\)/);
 assert.match(builder,/\.slice\(-20\)\.map\(m=>/);
});
t('Discuss saves owner message before inference and never duplicates it after inference',()=>{
 const start=builder.indexOf('async function discuss('),end=builder.indexOf('// Validates, builds',start),body=builder.slice(start,end);
 assert.ok(body.indexOf("addMessages(id,[{role:'user'")<body.indexOf("await callModel("));
 assert.match(body,/addMessages\(id,\[\{role:'assistant'/);
 assert.match(body,/discussionTier\(images,tier\)/);
 assert.match(body,/maxOutputTokens:2500/);
});
t('normal conversations receive summary rather than full project files',()=>{
 const start=builder.indexOf('async function discuss('),end=builder.indexOf('// Validates, builds',start),body=builder.slice(start,end);
 assert.match(body,/codeQuestion\?contextFiles\(files,24000\):require\('\.\/project-memory'\)\.note/);
});
t('free chat path is isolated from expensive builder provider and paid models',()=>{
 // Questions go to chat models (Kairoq Agent, Ollama, free providers), then only free OpenRouter models.
 assert.match(server,/if\(opts\.tier==="chat"\)return callChatAnswer\(opts,parse\)/);
 assert.match(server,/async function callChatAnswer[\s\S]*?try\{return await callOpenRouterBuilder\(opts,parse\)\}/);
 assert.match(server,/const models=opts\.only\?\[opts\.only\]:opts\.tier==="chat"\?freeCandidates/);
});

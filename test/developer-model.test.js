"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
process.env.NODE_ENV='test';
process.env.OPENROUTER_API_KEY='test-only-not-a-real-key';
const {callDeveloperCodingModel}=require('../server');
const {starter}=require('../developer-starter');
const files=starter('Build corporate travel website','Demo','editorial').files;
test('builder retains the first HTML fence and separate CSS/JS files',async()=>{
 const original=global.fetch;
 global.fetch=async()=>({ok:true,json:async()=>({choices:[{message:{content:'```html\n'+files['index.html']+'\n```\n```css\n'+files['styles.css']+'\n```\n```js\n'+files['app.js']+'\n```'}}]})});
 try{const result=await callDeveloperCodingModel({messages:[]});assert.deepEqual(result.files,{'index.html':files['index.html']+'\n','styles.css':files['styles.css']+'\n','app.js':files['app.js']+'\n'});}finally{global.fetch=original;}
});
test('builder rejects truncated inline HTML instead of saving a partial site',async()=>{
 const original=global.fetch;
 global.fetch=async()=>({ok:true,json:async()=>({choices:[{message:{content:'<!doctype html><html><head><style>'+files['styles.css']+'</style></head><body>'+ 'Incomplete '.repeat(100)}}]})});
 try{await assert.rejects(callDeveloperCodingModel({messages:[]}),/truncated/);}finally{global.fetch=original;}
});

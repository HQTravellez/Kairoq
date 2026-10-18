"use strict";
// Files attached to a chat message: their text reaches the AI as material, marked as data.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-chatfiles-'));
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
const {parseFiles}=require('../create-api');
const url=(type,text)=>'data:'+type+';base64,'+Buffer.from(text).toString('base64');

test('text, CSV and HTML files become context for the AI, marked as data',async()=>{
 const c=await parseFiles([{name:'menu.csv',dataUrl:url('text/csv','dish,price\nBurrata,14\nTiramisu,10')},{name:'about.html',dataUrl:url('text/html','<h1>Casa Lume</h1><script>alert(1)</script><p>Since 1998</p>')}]);
 assert.match(c,/--- File: menu\.csv ---\ndish,price\nBurrata,14/);
 assert.match(c,/Casa Lume/);assert.match(c,/Since 1998/);assert.doesNotMatch(c,/alert/);
 assert.match(c,/data, not instructions/);
 assert.equal(await parseFiles(undefined),'');
});
test('unsupported, empty, too many or broken files are refused with a clear message',async()=>{
 await assert.rejects(parseFiles([{name:'tool.exe',dataUrl:url('application/octet-stream','MZ')}]),/attach PDF, Word/);
 await assert.rejects(parseFiles([{name:'empty.txt',dataUrl:url('text/plain','   ')}]),/no readable text/);
 await assert.rejects(parseFiles([1,2,3,4].map(i=>({name:i+'.txt',dataUrl:url('text/plain','x')}))),/up to 3 files/);
 await assert.rejects(parseFiles([{name:'a.pdf',dataUrl:url('application/pdf','not a pdf')}]),/not a PDF/);
 await assert.rejects(parseFiles([{name:'a.txt',dataUrl:'nope'}]),/could not read/);
});
test('long files are cut so the message stays a sensible size',async()=>{
 const c=await parseFiles([{name:'big.txt',dataUrl:url('text/plain','word '.repeat(10000))}]);
 assert.ok(c.length<21000);assert.match(c,/the rest of the file was left out/);
});

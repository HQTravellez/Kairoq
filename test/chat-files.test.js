"use strict";
// Files attached to a chat message: their text reaches the AI as material, marked as data.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kairoq-chatfiles-'));
process.env.KAIROQ_REACT_PROJECTS_DIR=path.join(tmp,'projects');
process.env.KAIROQ_BUILDER_ACCOUNTS_DB=path.join(tmp,'accounts.sqlite');
const {parseFiles,nameFromPrompt}=require('../create-api');
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

test('a new project is named after the business, or after the first words without cutting one',()=>{
 assert.equal(nameFromPrompt('A one-page website for a small bakery called Rosa Bakery: hero, three breads with prices.'),'Rosa Bakery');
 assert.equal(nameFromPrompt('Website for my hotel named Casa Azul in Lisbon'),'Casa Azul');
 assert.equal(nameFromPrompt('A CRM to track leads, deals and follow-ups'),'A CRM to track leads, deals and follow-ups');
 // "for <business>": the business is the name (it is the brand on the look preview).
 assert.equal(nameFromPrompt('A website for Marigold Bakery in Leslieville, Toronto: the menu, pre-orders for custom cakes'),'Marigold Bakery');
 assert.equal(nameFromPrompt('A web app for a small dog-walking business: clients sign up, book a walk'),'Small dog-walking business');
 assert.equal(nameFromPrompt('A landing page for Northline Build Co'),'Northline Build Co');
 assert.equal(nameFromPrompt('An iPhone app for kids who love dinosaurs'),'Kids who love dinosaurs');
 const long=nameFromPrompt('Build a booking page for my yoga studio with class times, prices and a sign-up form');
 assert.ok(long.length<=48&&/studio$/.test(long),long);
});

test('only small, clear edits to an existing app take the fast lane',()=>{
 const {quickEdit}=require('../create-api');
 const built={current_version:3},fresh={current_version:1};
 const yes=['Make the button blue','Change the phone number to 020 7946 0000','Rename Contact to Get in touch','Make the heading bigger','Replace the hero photo'];
 const no=['Add a booking system with a calendar','Add a login page for staff','Save the leads in the database','Build a dashboard with charts','Make the contact form email me'];
 for(const m of yes)assert.equal(quickEdit(built,m,{mode:'build'}),true,m);
 for(const m of no)assert.equal(quickEdit(built,m,{mode:'build'}),false,m);
 // A first build, an attached image or another mode is never a quick edit.
 assert.equal(quickEdit(fresh,'Make the button blue',{mode:'build'}),false);
 assert.equal(quickEdit(built,'Make the button blue',{mode:'build',images:[{}]}),false);
 assert.equal(quickEdit(built,'Make the button blue',{mode:'agent'}),false);
});

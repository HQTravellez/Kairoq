"use strict";
// Quick questions before a first build: only useful ones, cleaned, and folded into the request.
const test=require('node:test'),assert=require('node:assert/strict');
const clarify=require('../clarify');

test('questions are cleaned: at most three, two to four options each, nothing asked for detailed requests',async()=>{
 const raw={questions:[{q:'Do your staff need to sign in',options:['Yes','No','Yes']},{q:'Which parts?',options:['Contacts','Deals','Follow-ups','Reports','Invoices'],multi:true},{q:'Bad',options:['x']},{q:'Payments?',options:['Card','Later']},{q:'Fourth?',options:['a','b']}]};
 const qs=clarify.clean(raw);
 assert.equal(qs.length,3);
 assert.deepEqual(qs[0],{q:'Do your staff need to sign in?',options:['Yes','No'],multi:false});
 assert.equal(qs[1].options.length,4);assert.equal(qs[1].multi,true);
 const callModel=async(o,parse)=>parse(JSON.stringify(raw));
 assert.equal((await clarify.questions('A CRM',{callModel})).length,3);
 assert.deepEqual(await clarify.questions('x'.repeat(400),{callModel}),[]);
 // A failing or broken AI means no questions: the build simply starts.
 assert.deepEqual(await clarify.questions('A CRM',{callModel:async()=>{throw Error('down')}}),[]);
 assert.deepEqual(await clarify.questions('A CRM',{callModel:async(o,parse)=>parse('not json')}),[]);
});
test('answers are added to the request the builder reads',()=>{
 const p=clarify.withAnswers('A CRM',[{q:'Do your staff need to sign in?',a:['Yes']},{q:'Which parts?',a:['Contacts','Deals']},{q:'Empty?',a:[]}]);
 assert.equal(p,'A CRM\n\nDetails from the owner:\n- Do your staff need to sign in? Yes\n- Which parts? Contacts, Deals');
 assert.equal(clarify.withAnswers('A CRM',[]),'A CRM');
});

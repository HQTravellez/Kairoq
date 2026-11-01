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
 assert.deepEqual(await clarify.questions('x'.repeat(700),{callModel}),[]);
 // A failing or broken AI means no questions: the build simply starts.
 assert.deepEqual(await clarify.questions('A CRM',{callModel:async()=>{throw Error('down')}}),[]);
 assert.deepEqual(await clarify.questions('A CRM',{callModel:async(o,parse)=>parse('not json')}),[]);
});
test('answers are added to the request the builder reads',()=>{
 const p=clarify.withAnswers('A CRM',[{q:'Do your staff need to sign in?',a:['Yes']},{q:'Which parts?',a:['Contacts','Deals']},{q:'Empty?',a:[]}]);
 assert.equal(p,'A CRM\n\nDetails from the owner:\n- Do your staff need to sign in? Yes\n- Which parts? Contacts, Deals');
 assert.equal(clarify.withAnswers('A CRM',[]),'A CRM');
});

test('options can carry one sentence each and a recommended one',()=>{
 const [q]=clarify.clean({questions:[{q:'Who is it for?',options:[{label:'Kids: watch and play',detail:'A child scans a page and taps the animal.'},{label:'Anyone: realistic AR',detail:'A life-size animal on the paper.'}],recommended:0}]});
 assert.deepEqual(q,{q:'Who is it for?',options:['Kids: watch and play','Anyone: realistic AR'],details:['A child scans a page and taps the animal.','A life-size animal on the paper.'],recommended:0,multi:false});
});

test('ask() returns the opening line with the questions; a bad line is dropped',async()=>{
 const raw={opening:'A field guide for Ontario birds with sighting tables — lovely. Two things so I get the data right:',questions:[{q:'Who adds sightings?',options:[{label:'Just you',detail:'You sign in; visitors read.'},{label:'Any birder',detail:'Anyone can sign up.'}],recommended:0}]};
 const r=await clarify.ask('A field guide for Ontario birds',{callModel:async(o,parse)=>{assert.match(o.messages[0].content,/warm, quick and specific/);return parse(JSON.stringify(raw))}});
 assert.equal(r.opening,raw.opening);assert.equal(r.questions.length,1);
 assert.equal(clarify.opening({opening:'{'}),'');assert.equal(clarify.opening({}),'');
 assert.deepEqual(await clarify.ask('x'.repeat(700),{callModel:async()=>{throw Error('no')}}),{opening:'',questions:[]});
});
